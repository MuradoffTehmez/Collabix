// Autentifikasiya domeni — AUDIT-TASK-10 / Faza 3.1.
//
// `routes.ts` bölünməsinin ikinci modulu. Dörd bölmə BİRLƏŞDİRİLİB, çünki
// onlar eyni domenin mərhələləridir və eyni köməkçiləri (`turnstileGate`,
// `alertAccountOwner`, `CAPTCHA_*` astanaları) paylaşır:
//   • AUTH        — qeydiyyat, giriş, sessiya, parol/ad dəyişmə, hesab silmə
//   • 2FA / TOTP  — girişin ikinci addımı
//   • MAGIC LINK  — parolsuz giriş
//   • OAUTH       — üçüncü tərəf provayderləri
//
// ⚠ Ayrı fayllara bölsək `turnstileGate` və `CAPTCHA_HARD_AT` üçüncü modula
//   çıxarılmalı olardı — halbuki onlar YALNIZ bu domendə mənalıdır.
//   AUDIT-TASK-9 / A-3 hesab qoruması məhz bu dörd yolun HAMISINA aiddir.
//
// 🔴 SAF REFAKTOR: gövdə və şərhlər olduğu kimi köçürülüb (§11.2, §11.5).
import {
  Ctx, json, err, readJson, uuid, now, todayStr, b64uRandom,
  normalizeUsername, validUsername, clampStr, fromJSON, toJSON, searchNormalize,
  mapUser, withCookies,
} from '../util';
import { QueueService } from '../services/queue';
import {
  hashPassword, verifyPassword, createSession, rotateSession,
  revokeSession, revokeAllSessions, destroyAllSessions, destroyLegacySessions,
  sessionCookies, clearCookies, clearLegacyCookie, 
  upgradePasswordHash, PBKDF2_ITER_LEGACY,
} from '../auth';
import {
  reqInfo, logSecurityEvent, recentFailures, checkGeoChange, 
} from '../security';
import {
  
  
  readPending, consumePending, 
} from '../oauth';
import {
  
  mfaEnabled,
} from '../totp';
import { kickEverywhere } from '../ws-kick';
import { markUidDeleted } from '../archive';
import {
  D, badReq, deleteR2Keys, withSession, checkPasswordStrength,
  SIGNUP_XP, grantDailyLogin,
} from './shared';
import { cascadeStatements } from '../services/cascade';
import { grantXp } from '../xp';
import { redeemInvite } from './invite';
import {
  CAPTCHA_SOFT_AT, CAPTCHA_HARD_AT, turnstileGate, alertAccountOwner,
} from './auth-guard';
import { issueMfaChallenge } from './auth-methods';

export async function register(c: Ctx) {
  const b = await readJson(c.req);
  const gate = await turnstileGate(c, b.turnstileToken, String(b.username || ''));
  if (gate) return gate;
  const username = normalizeUsername(b.username);
  if (!validUsername(username)) return badReq('İstifadəçi adı düzgün deyil (3-20: a-z, 0-9, . _).');

  // OAuth qeydiyyatı: profil provayderdən gəlir, parol İSTƏNMİR.
  // Bilet callback-də yaradılıb (oauth.ts `createPending`) və serverdə saxlanılır —
  // yəni client email/provider id-ni saxtalaşdıra bilmir.
  const pending = b.oauthTicket ? await readPending(c.env, String(b.oauthTicket)) : null;
  if (b.oauthTicket && !pending) return badReq('OAuth bileti etibarsız və ya vaxtı bitib.');

  // AUDIT-TASK-10 / Faza 5/#6 — parol gücü qaydası (bax `checkPasswordStrength`).
  const pw = !pending ? checkPasswordStrength(b.pass) : { ok: true as const };
  if (!pw.ok) return badReq(pw.error!);
  if (!pending && (typeof b.pass !== 'string' || b.pass.length < 6)) {
    return badReq('Şifrə minimum 6 simvol olmalıdır.');
  }
  // 18+ qapısı OAuth axınında da TƏTBİQ OLUNUR — provayder yaş vermir, ona görə
  // doğum tarixi sihirbazda soruşulur və yoxlama burada eyni qalır.
  const age = parseInt(b.age, 10) || 0;
  if (age < 18 || age > 100) return badReq('Platforma yalnız 18+ üçündür.');
  const exists = await D(c).prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
  if (exists) return badReq('Bu istifadəçi adı artıq tutulub.');

  // Parolsuz hesabda da `pass_hash` NOT NULL-dur. Boş qoymaq əvəzinə İSTİFADƏ
  // OLUNMAYAN təsadüfi parol heşlənir: belədə heç bir sətir "boş heş" ilə
  // qalmır və gələcəkdə heş müqayisəsi təsadüfən uğur qaytara bilmir.
  const { hash, salt, iterations } = await hashPassword(
    pending ? b64uRandom() : b.pass,
  );
  const id = uuid();
  const day = todayStr();
  await D(c).prepare(
    // 🔴 `role` AÇIQ YAZILIR — sütun default-una GÜVƏNMƏ.
    //
    // `0001_init.sql` sütunu `DEFAULT 'user'` (KİÇİK hərf) ilə yaratmışdı,
    // `roles` cədvəlindəki ad isə `'USER'`-dir. Sütun burada verilmədiyi üçün
    // hər yeni hesab etibarsız rol alırdı və `rbac.ts` onun üçün SIFIR icazə
    // hesablayırdı (bax `migrations/0038_fix_user_role_default.sql`).
    //
    // ⚠ SQLite `ALTER COLUMN ... SET DEFAULT` dəstəkləmir və `users` 40+
    //   cədvəldən FK ilə istinad olunur → cədvəli yenidən qurmaq canlı bazada
    //   yüksək riskdir. Ona görə həqiqət mənbəyi BU SƏTİRDİR.
    `INSERT INTO users (id, username, name, age, birth_date, gender, country, city, bio, contact_email,
      photo_url, prog_levels, lang_levels, goals, looking_for, instagram, github, linkedin, telegram, website,
      streak, last_active_day, last_active_at, activity_days, joined_at, pass_hash, pass_salt, pass_iter,
      search_name, role)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,'USER')`,
  ).bind(
    id, username, clampStr(b.name, 60) || username, age, clampStr(b.birthDate, 10),
    clampStr(b.gender, 10), clampStr(b.country, 40), clampStr(b.city, 40),
    clampStr(b.bio, 400), clampStr(b.contactEmail, 120),
    null, toJSON(b.progLevels, '{}'), toJSON(b.langLevels, '{}'),
    clampStr(b.goals, 300), toJSON(b.lookingFor, '[]'),
    clampStr(b.instagram, 40), clampStr(b.github, 40), clampStr(b.linkedin, 60),
    clampStr(b.telegram, 40), clampStr(b.website, 100),
    day, now(), JSON.stringify({ [day]: 1 }), now(), hash, salt, iterations,
    // D-3: axtarış üçün normallaşdırılmış forma (`ə`→`e` və s.).
    searchNormalize((clampStr(b.name, 60) || username) + ' ' + username),
  ).run();

  // Qeydiyyat anındakı ölkə coğrafi anomaliya müqayisəsinin başlanğıc nöqtəsidir.
  await D(c).prepare('UPDATE users SET last_country = ? WHERE id = ?')
    .bind(reqInfo(c.req).country, id).run();

  if (pending) {
    // Email YALNIZ provayder onu doğrulayıbsa yazılır — doğrulanmamış email
    // sonrakı hesab birləşdirmələrində ələ keçirmə vektoru olardı (bax oauth.ts).
    const email = pending.emailVerified ? (pending.email || '').toLowerCase() : '';
    await D(c).batch([
      D(c).prepare('UPDATE users SET email = ?, email_verified = ?, has_password = 0 WHERE id = ?')
        .bind(email, pending.emailVerified ? 1 : 0, id),
      D(c).prepare(
        'INSERT OR IGNORE INTO oauth_accounts (provider, provider_id, uid, email, login, linked_at) VALUES (?,?,?,?,?,?)',
      ).bind(pending.provider, pending.providerId, id, email, pending.login, now()),
    ]);
    await consumePending(c.env, String(b.oauthTicket));
  }
  const emailToEmit = pending ? (pending.emailVerified ? (pending.email || '').toLowerCase() : '') : clampStr(b.contactEmail, 120);
  const queueService = new QueueService(c.env);
  c.ctx.waitUntil(
    queueService.publish({
      type: 'UserRegistered',
      userId: id,
      username,
      email: emailToEmit
    })
  );

  // AUDIT-TASK-10 / D-6.b — PRD §6: "İlk qeydiyyat +50".
  //
  // ⚠ `refId = id` (uid) — hesab başına BİR DƏFƏ. `ux_xp_logs_source` UNIQUE
  //   indeksi (`uid, source, ref_id`) onsuz da təkrarı bağlayır, lakin uid-i
  //   açar kimi vermək niyyəti açıq edir: "bu, hesabın öz birdəfəlik bonusudur".
  //
  // ⚠ `await` QƏSDƏNDİR (waitUntil deyil): XP `mapUser` ilə qaytarılan sətrə
  //   düşməlidir, əks halda istifadəçi qeydiyyatdan dərhal sonra 0 XP görər və
  //   yalnız növbəti yükləmədə 50 XP peyda olar.
  await grantXp(c.env, id, 'signup', id, SIGNUP_XP);

  // PRD §6 "Dost dəvəti +50" — XP DƏVƏT EDƏNƏ verilir.
  //
  // ⚠ `await` (waitUntil deyil): `redeemInvite` özü səhvləri udur və
  //   qeydiyyatı bloklamır, lakin `invite_redemptions` sətri cavabdan ƏVVƏL
  //   yazılmalıdır — əks halda istifadəçi dərhal ikinci kodu işlədə bilərdi.
  await redeemInvite(c, b.inviteCode, id);

  const pair = await createSession(c.env, c.req, id);
  const row = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return withSession({ user: mapUser(row, true) }, pair);
}

export async function login(c: Ctx) {
  const b = await readJson(c.req);
  const username = normalizeUsername(b.username);

  // Turnstile yalnız ŞÜBHƏ YARANANDA tələb olunur — ilk uğursuz cəhddən sonra.
  // Hər girişdə göstərsək normal istifadəçiyə hər dəfə maneə çıxarardıq;
  // parol seçən bot isə bir neçə cəhddən sonra onsuz da bura ilişir.
  //
  // A-3: 10 cəhddən sonra qapı FAIL-CLOSED olur (bax `turnstileGate`).
  //
  // 🔴 PERF (2026-08-09): uğursuzluq sayğacı və istifadəçi sətri bir-birindən
  //   ASILI DEYİL — birincisi yalnız `username` sətrini, ikincisi də yalnız
  //   həmin sətri istəyir. Əvvəl ardıcıl gedirdilər və bu, HƏR girişə (uğurlu
  //   və uğursuz) bir tam D1 gediş-gəlişi əlavə edirdi.
  //
  // ⚠ SƏTİR SPEKULYATİV OXUNUR: CAPTCHA qapısı işə düşsə bu sorğu boşa gedir.
  //   Mübadilə qəsdlidir — qapı NADİR haldır (ardıcıl 3+ uğursuzluq), sorğunun
  //   qənaəti isə HƏR girişdədir. Nəticə də istifadə olunmur, yəni qapının
  //   davranışı dəyişmir.
  const [fails, row] = await Promise.all([
    recentFailures(c.env, c.req, username),
    D(c).prepare('SELECT * FROM users WHERE username = ?').bind(username).first<any>(),
  ]);
  if (fails >= CAPTCHA_SOFT_AT) {
    const gate = await turnstileGate(c, b.turnstileToken, username, fails >= CAPTCHA_HARD_AT);
    if (gate) {
      // Sərt astanaya çatan hesabın sahibi xəbərdar edilir. `waitUntil` —
      // məktub 403 cavabını gecikdirməməlidir (və gecikmə fərqi sadalama
      // siqnalı olardı).
      if (fails >= CAPTCHA_HARD_AT) c.ctx.waitUntil(alertAccountOwner(c, username, fails));
      return gate;
    }
  }

  // M-2: iterasiya SƏTİRDƏN gəlir. Köhnə hesab 100 000 ilə yazılıb;
  // sabitlə (600 000) yoxlasaq düzgün parol da uyğunsuz heş verərdi.
  //
  // 🔴 PERF (2026-08-09): `mfaEnabled` sorğusu PBKDF2 ilə PARALEL gedir.
  //   PBKDF2 100 000 iterasiya SAF CPU-dur (~80 ms) və bu müddətdə Worker
  //   şəbəkə gözləmir. `mfaEnabled` isə saf şəbəkədir (D1 Buxarestdə, ~60 ms).
  //   Ardıcıl icra edəndə ikisi toplanırdı; indi böyüyü qədər çəkir.
  //
  // ⚠ Sıra vacibdir: `mfaEnabled` YALNIZ `row` varsa çağırılır — əks halda
  //   mövcud olmayan istifadəçi üçün əlavə sorğu getməklə cavab müddəti
  //   dəyişər və bu, hesab sadalama (enumeration) siqnalına çevrilərdi.
  const [ok, mfaOn] = row
    ? await Promise.all([
      verifyPassword(String(b.pass || ''), row.pass_hash, row.pass_salt, Number(row.pass_iter) || PBKDF2_ITER_LEGACY),
      mfaEnabled(c.env, row.id),
    ])
    : [false, false];
  if (!row || !ok) {
    // Hadisə HƏM mövcud olmayan istifadəçi, HƏM yanlış parol üçün yazılır —
    // əks halda jurnalın özü "bu ad mövcuddur" siqnalı verərdi (user enumeration).
    await logSecurityEvent(c.env, c.req, {
      type: 'login_failed', uid: row?.id || null, username,
      severity: fails >= 5 ? 'critical' : 'warning',
      meta: { attempt: fails + 1, reason: row ? 'bad_password' : 'no_user' },
    });
    return err('İstifadəçi adı və ya şifrə yanlışdır.', 401, 'invalid_credentials');
  }
  if (row.blocked) return err('Hesabınız admin tərəfindən bloklanıb.', 403, 'account_blocked');

  // 2FA aktivdirsə parol TƏK BAŞINA kifayət etmir — sessiya HƏLƏ verilmir.
  // Challenge KV-də "parolu bilirəm" faktını daşıyır; ikinci addım
  // `/api/auth/mfa`-dadır. Cavabda istifadəçi məlumatı QAYTARILMIR.
  //
  // 🔴 PERF: bu yoxlama YUXARI QALDIRILDI (əvvəl streak/geo yazılarından SONRA
  //   idi). MFA açıq hesabda həmin yazılar İSTİFADƏSİZ görülürdü — istifadəçi
  //   hələ giriş etməmişdi, amma `streak`, `activity_days` və `last_country`
  //   artıq yenilənmişdi. Yəni bu, həm bir neçə RTT qənaətidir, həm də
  //   davranış düzəlişi: uğursuz 2FA-da statistika daha şişmir.
  if (mfaOn) {
    return json({ mfaRequired: true, challenge: await issueMfaChallenge(c, row.id) });
  }

  // M-2 TƏDRİCİ KÖÇÜRMƏ: açıq parol MƏHZ İNDİ əlimizdədir — başqa heç bir
  // nöqtədə onu yenidən heşləmək mümkün deyil (bazada yalnız heş var).
  // `waitUntil`: 600 000 iterasiya ~6× baha başa gəlir və cavabı
  // GÖZLƏTMƏMƏLİDİR. Uğursuz olsa növbəti girişdə yenidən cəhd edilir.
  c.ctx.waitUntil(
    upgradePasswordHash(c.env, row.id, String(b.pass || ''), Number(row.pass_iter) || PBKDF2_ITER_LEGACY)
      .catch(e => console.error('pass_iter köçürməsi alınmadı', e)),
  );

  // 🔴 PERF: `login_ok` jurnalı və coğrafi anomaliya `waitUntil`-a keçdi.
  //   İkisi də TELEMETRİYADIR — cavabın məzmununa təsir etmir, heç bir qərar
  //   onları GÖZLƏMİR. Əvvəl `await` idilər və istifadəçi hər girişdə iki
  //   Buxarest gediş-gəlişini gözləyirdi.
  //
  // ⚠ `recentFailures` sayğacı `login_ok`-u OXUYUR (uğurlu girişdə CAPTCHA
  //   sayğacını sıfırlayır). `waitUntil` yazını LƏĞV ETMİR, yalnız cavabdan
  //   sonraya salır — növbəti giriş ayrıca sorğudur və o vaxta yazı çoxdan
  //   bitib. Uğursuz girişin jurnalı isə QƏSDƏN `await` qalır (aşağıda):
  //   o, birbaşa CAPTCHA astanasını qidalandırır.
  const country = reqInfo(c.req).country;
  c.ctx.waitUntil(Promise.all([
    logSecurityEvent(c.env, c.req, { type: 'login_ok', uid: row.id, username }),
    checkGeoChange(c.env, c.req, row.id, row.last_country || ''),
  ]).then(() => undefined).catch(e => console.error('login telemetriyası yazılmadı', e)));

  // PRD §6 "Gündəlik giriş +5" — gün ərzində bir dəfə (bax `grantDailyLogin`).
  //
  // 🔴 PERF: XP verilməsi və sessiya yaradılması bir-birindən ASILI DEYİL,
  //   ona görə paralel gedir. XP MÜTLƏQ sessiyadan əvvəl bitməlidir ki,
  //   aşağıdakı `RETURNING *` artıq yenilənmiş `xp` dəyərini qaytarsın —
  //   `Promise.all` bunu təmin edir (ikisi də bitir, sonra UPDATE gedir).
  const [, pair] = await Promise.all([
    grantDailyLogin(c, String(row.id)),
    createSession(c.env, c.req, row.id),
  ]);

  // Seriya (streak) + sonuncu ölkə + `fresh` istifadəçi — TƏK sorğuda.
  //
  // 🔴 PERF: əvvəl BURADA ÜÇ ayrıca gediş-gəliş var idi:
  //     1) UPDATE users SET streak, last_active_day, last_active_at, activity_days
  //     2) UPDATE users SET last_country            (yalnız ölkə dəyişəndə)
  //     3) SELECT * FROM users WHERE id = ?         (cavab üçün təzə sətir)
  //   Üçü də EYNİ sətrə toxunur. İndi bir `UPDATE ... RETURNING *`-dır:
  //   dəyişməyən sütun öz dəyəri ilə geri yazılır (`COALESCE` deyil, JS-də
  //   hesablanmış dəyər), `RETURNING` isə SELECT-i lazımsız edir.
  //
  // ⚠ `RETURNING *` D1/SQLite-da dəstəklənir və `.first()` ilə oxunur.
  //   `.run()` işlətsən sətir GERİ QAYITMAZ və `mapUser(undefined)` çökər.
  // ⚠ DAVRANIŞ EYNİ SAXLANILIR: köhnə kod bu dörd sütunu YALNIZ gün dəyişəndə
  //   yazırdı. Ona görə gün dəyişməyibsə hər sütuna ÖZ mövcud dəyəri geri
  //   yazılır — sorğu tək olur, amma nəticə fərqlənmir. `last_active_at`-i hər
  //   girişdə təzələmək cazibədar görünür, lakin bu, tələb olunmayan davranış
  //   dəyişikliyidir (profil "sonuncu aktivlik" göstəricisi ondan oxuyur).
  const day = todayStr();
  const newDay = row.last_active_day !== day;
  let streak = row.streak || 0;
  let activityDays = row.activity_days;
  let lastActiveAt = row.last_active_at;
  if (newDay) {
    const diff = row.last_active_day
      ? Math.round((new Date(day).getTime() - new Date(row.last_active_day).getTime()) / 86400000) : 99;
    streak = diff === 1 ? (row.streak || 0) + 1 : 1;
    const days = fromJSON<Record<string, number>>(row.activity_days, {});
    days[day] = (days[day] || 0) + 1;
    activityDays = JSON.stringify(days);
    lastActiveAt = now();
  }
  // ⚠ `last_country`: köhnə kod ölkə BOŞDURSA sütuna toxunmurdu (NULL NULL
  //   qalırdı). `country || row.last_country` eyni nəticəni verir — `''`-ə
  //   çevirmə YOXDUR, əks halda NULL-ı boş sətirlə əvəz edərdik.
  const fresh = await D(c).prepare(
    `UPDATE users
        SET streak = ?1, last_active_day = ?2, last_active_at = ?3,
            activity_days = ?4, last_country = ?5
      WHERE id = ?6
      RETURNING *`,
  ).bind(
    streak, newDay ? day : row.last_active_day, lastActiveAt, activityDays,
    country || row.last_country, row.id,
  ).first();
  return withSession({ user: mapUser(fresh, true) }, pair);
}

// Access token yeniləmə (Bənd 15). Client `api()` 401/token_expired görəndə
// avtomatik bura vurur, sonra orijinal sorğunu bir dəfə təkrarlayır.
export async function refresh(c: Ctx) {
  const r = await rotateSession(c.env, c.req);
  if (!r.ok) {
    // Uğursuz refresh HƏMİŞƏ cookie-ləri təmizləyir. Əks halda client
    // etibarsız token-lə sonsuz refresh döngüsünə düşərdi.
    const msg = r.reason === 'reuse'
      ? 'Təhlükəsizlik səbəbindən bütün sessiyalar bağlandı. Yenidən daxil olun.'
      : 'Sessiya bitib. Yenidən daxil olun.';
    return withCookies(err(msg, 401, `refresh_${r.reason}`), clearCookies());
  }
  return withCookies(json({ ok: true }), sessionCookies(r.pair));
}

export async function logout(c: Ctx) {
  if (c.sid) await revokeSession(c.env, c.sid, 'logout');
  // Köhnə cookie ilə gələn istifadəçidə `sid` olmur (KV sessiyası, D1 sətri yox).
  // Yalnız cookie-ni silmək KİFAYƏT ETMİR: server tərəfdəki KV yazısı TTL
  // bitənə qədər sağ qalardı və cookie bərpa edilsə giriş yenidən işləyərdi.
  else if (c.legacy && c.user) await destroyLegacySessions(c.env, c.user.id);
  return withCookies(json({ ok: true }), clearCookies());
}

export async function me(c: Ctx) {
  if (!c.user) return json({ user: null });
  const body = { user: mapUser(c.user, true), isAdmin: c.isAdmin };
  // Keçid dövrü: köhnə `cx_sess` cookie-si ilə gələn istifadəçi burada səssizcə
  // yeni cüt-token modelinə köçürülür. `me()` tətbiqin hər açılışında çağırıldığı
  // üçün miqrasiya istifadəçi heç nə hiss etmədən, tək deploy-da tamamlanır.
  if (c.legacy) {
    // YALNIZ köhnə KV sessiyaları silinir. `destroyAllSessions` İŞLƏDİLMİR:
    // o, D1-dəki sessiyaları da ləğv edərdi, yəni istifadəçi köhnə cookie qalan
    // bir cihazı açan kimi artıq miqrasiya olunmuş DİGƏR cihazlarından çıxarılardı.
    await destroyLegacySessions(c.env, c.user.id);
    const pair = await createSession(c.env, c.req, c.user.id);
    return withCookies(json(body), [...sessionCookies(pair), clearLegacyCookie()]);
  }
  return json(body);
}

/* ---------- aktiv sessiyalar / cihazlar (Bənd 3) ---------- */

// User-Agent → oxunaqlı cihaz adı. Serverdə edilir ki, hər üç dil və hər
// client (gələcək mobil tətbiq daxil) eyni nəticəni görsün.
function parseUA(ua: string): { device: string; os: string; browser: string } {
  const s = ua || '';
  const os =
    /Windows NT 10/.test(s) ? 'Windows' : /Windows/.test(s) ? 'Windows' :
    /iPhone|iPad|iPod/.test(s) ? 'iOS' :
    /Mac OS X/.test(s) ? 'macOS' :
    /Android/.test(s) ? 'Android' :
    /Linux/.test(s) ? 'Linux' : 'Naməlum';
  // Sıra vacibdir: Edge həm "Chrome", həm "Safari" sətrini daşıyır;
  // Chrome isə "Safari" daşıyır. Ən spesifikdən ümumiyə doğru yoxlanılır.
  const browser =
    /Edg\//.test(s) ? 'Edge' :
    /OPR\/|Opera/.test(s) ? 'Opera' :
    /Firefox\//.test(s) ? 'Firefox' :
    /Chrome\//.test(s) ? 'Chrome' :
    /Safari\//.test(s) ? 'Safari' : 'Naməlum';
  const device = /Mobile|iPhone|Android/.test(s) ? 'mobil' : /iPad|Tablet/.test(s) ? 'planşet' : 'masaüstü';
  return { device, os, browser };
}

export async function listSessions(c: Ctx) {
  const rows = await D(c).prepare(
    `SELECT id, ua, ip, city, country, created_at, last_seen
       FROM sessions WHERE uid = ? AND revoked = 0 AND expires_at > ?
      ORDER BY last_seen DESC LIMIT 50`,
  ).bind(c.user!.id, now()).all<any>();
  return json({
    sessions: rows.results.map(r => ({
      id: r.id,
      current: r.id === c.sid,        // "bu cihaz" — UI onu silinə bilməz kimi göstərir
      ...parseUA(r.ua),
      // IP tam göstərilir: bu istifadəçinin ÖZ sessiya siyahısıdır, şübhəli
      // girişi tanıya bilməsi üçün tam ünvan lazımdır.
      ip: r.ip, city: r.city, country: r.country,
      createdAt: r.created_at, lastSeen: r.last_seen,
    })),
  });
}

export async function revokeOneSession(c: Ctx, sid: string) {
  // Sahiblik yoxlaması — başqasının sessiya id-si təxmin edilib göndərilə bilər.
  const row = await D(c).prepare('SELECT uid FROM sessions WHERE id = ?').bind(sid).first<any>();
  if (!row || row.uid !== c.user!.id) return err('Sessiya tapılmadı.', 404);
  await revokeSession(c.env, sid, 'user');
  await logSecurityEvent(c.env, c.req, {
    type: 'session_revoked', uid: c.user!.id, username: c.user!.username, meta: { sid },
  });
  // Cari cihazı bağlayırsa cookie-ləri də təmizlə → dərhal çıxış.
  return sid === c.sid
    ? withCookies(json({ ok: true, self: true }), clearCookies())
    : json({ ok: true });
}

// "Hamısını çıxart (bu istisna)" — cari cihaz qalır, qalanları ləğv olunur.
export async function revokeOtherSessions(c: Ctx) {
  await revokeAllSessions(c.env, c.user!.id, 'user', c.sid);
  // H-6 / C-2: sessiya ləğvi WS-ə TƏSİR ETMİRDİ — ləğv edilmiş cihaz açıq soket
  // üzərindən oxumağa/yazmağa davam edirdi. `c.sid` istisna edilir ki, CARİ
  // cihazın çatı ölməsin (client 4403-də yenidən qoşulmur).
  c.ctx.waitUntil(kickEverywhere(c.env, c.user!.id, c.sid));
  await logSecurityEvent(c.env, c.req, {
    type: 'session_revoked', uid: c.user!.id, username: c.user!.username,
    severity: 'warning', meta: { scope: 'others', keep: c.sid },
  });
  return json({ ok: true });
}

export async function usernameAvailable(c: Ctx) {
  const u = normalizeUsername(c.url.searchParams.get('u') || '');
  if (!validUsername(u)) return json({ available: false, invalid: true });
  const exists = await D(c).prepare('SELECT 1 FROM users WHERE username = ?').bind(u).first();
  return json({ available: !exists });
}

export async function changePassword(c: Ctx) {
  const b = await readJson(c.req);
  const u = c.user!;
  // OAuth ilə yaradılmış hesabda istifadəyə yararlı parol YOXDUR — ondan
  // "hazırkı şifrə" istəmək istifadəçini əbədi kilidləyərdi. Belə hallarda bu
  // əməliyyat "şifrə TƏYİN ET"-dir; kimlik onsuz da canlı sessiya ilə sübutdur.
  const settingFirst = u.has_password === 0;
  if (!settingFirst) {
    const ok = await verifyPassword(String(b.current || ''), u.pass_hash as any, u.pass_salt as any, Number(u.pass_iter) || PBKDF2_ITER_LEGACY);
    if (!ok) return err('Hazırkı şifrə yanlışdır.', 403, 'invalid_password');
  }
  const pwNext = checkPasswordStrength(b.next);
  if (!pwNext.ok) return badReq(pwNext.error!);
  const { hash, salt, iterations } = await hashPassword(b.next);
  await D(c).prepare(
    'UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iter = ?, must_reset_password = 0, has_password = 1 WHERE id = ?',
  ).bind(hash, salt, iterations, u.id).run();
  // Parol dəyişməsi BÜTÜN digər cihazları çıxarır. Parolun dəyişməsinin əsas
  // səbəbi "kimsə hesabıma girib" şübhəsidir — köhnə sessiyalar canlı qalsaydı
  // parol dəyişmək təhlükəni aradan qaldırmazdı. Cari cihaz saxlanılır.
  await revokeAllSessions(c.env, u.id, 'password', c.sid);
  c.ctx.waitUntil(kickEverywhere(c.env, u.id, c.sid));   // H-6 / C-2
  await logSecurityEvent(c.env, c.req, {
    type: 'password_changed', uid: u.id, username: u.username, severity: 'warning',
  });
  return json({ ok: true });
}

export async function changeUsername(c: Ctx) {
  const b = await readJson(c.req);
  const u = c.user!;
  // Parolsuz (OAuth) hesab — bax changePassword-dəki eyni izah.
  if (u.has_password !== 0) {
    const ok = await verifyPassword(String(b.current || ''), u.pass_hash as any, u.pass_salt as any, Number(u.pass_iter) || PBKDF2_ITER_LEGACY);
    if (!ok) return err('Şifrə yanlışdır.', 403, 'invalid_password');
  }
  const next = normalizeUsername(b.next);
  if (!validUsername(next)) return badReq('Ad düzgün deyil.');
  const exists = await D(c).prepare('SELECT 1 FROM users WHERE username = ?').bind(next).first();
  if (exists) return badReq('Bu ad artıq tutulub.');
  await D(c).prepare('UPDATE users SET username = ? WHERE id = ?').bind(next, u.id).run();
  return json({ ok: true, username: next });
}


export async function deleteAccount(c: Ctx) {
  const b = await readJson(c.req);
  const u = c.user!;
  // Parolsuz (yalnız OAuth) hesabda yoxlanacaq parol yoxdur — canlı sessiya
  // özü kifayət edir. Parollu hesabda isə təkrar-autentifikasiya qalır.
  if (u.has_password !== 0) {
    const ok = await verifyPassword(String(b.pass || ''), u.pass_hash as any, u.pass_salt as any, Number(u.pass_iter) || PBKDF2_ITER_LEGACY);
    if (!ok) return err('Şifrə yanlışdır.', 403, 'invalid_password');
  }
  // R2 fayllarını təmizlə (avatar + post şəkilləri)
  const posts = await D(c).prepare('SELECT image_keys FROM posts WHERE author_id = ?').bind(u.id).all<any>();
  const keys: string[] = [];
  posts.results.forEach(p => keys.push(...fromJSON<string[]>(p.image_keys, [])));
  if ((u as any).photo_url) {
    const m = String((u as any).photo_url).match(/^\/files\/(.+)$/);
    if (m) keys.push(m[1]);
  }
  await deleteR2Keys(c, keys);
  /* 🔴 BE-001 — KASKAD SİYASƏTİ ARTIQ BURADA DEYİL.
   *
   *   Əvvəl bu batch əl ilə yazılmış SQL siyahısı idi və istifadəçi sütunu olan
   *   63 cədvəldən yalnız 20-sini örtürdü. Qalanları yetim sətir kimi qalırdı —
   *   FK bəyan olunmadığı üçün heç bir xəta vermədən, yalnız zamanla artan
   *   məlumat çirkliliyi kimi. Siyasət indi `services/cascade.ts`-dəki
   *   `USER_REFS` xəritəsindədir; `test/cascade.test.ts` sxemi oxuyub xəritənin
   *   TAM olmasını tələb edir, yəni siyasətsiz yeni cədvəl testi sındırır.
   *
   * ⚠ AŞAĞIDAKI ADDIMLAR XƏRİTƏYƏ KÖÇÜRÜLMÜR, ÇÜNKİ ONLAR SİYASƏT DEYİL,
   *   ARDICILLIQDIR — sıra pozulsa nəticə səssizcə yanlış olur. Xəritə obyekt
   *   açarları ilə gəzilir, ona görə sıraya güvənmək mümkün deyil.
   */
  await D(c).batch([
    // Bu istifadəçinin postlarının re-post/quote-larını soft-mark et (posts silinməzdən ƏVVƏL).
    D(c).prepare('UPDATE posts SET original_deleted = 1 WHERE shared_post_id IN (SELECT id FROM posts WHERE author_id = ?)').bind(u.id),
    D(c).prepare('DELETE FROM post_shares WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE author_id = ?)').bind(u.id, u.id),
    D(c).prepare('DELETE FROM posts WHERE author_id = ?').bind(u.id),
    // 🔴 SAYĞACLAR `follows` SİLİNMƏZDƏN ƏVVƏL azaldılır (miqrasiya 0051).
    //    Sıra bağlayıcıdır: sətirlər silindikdən sonra kimin sayğacını
    //    azaltmaq lazım olduğunu öyrənmək mümkün olmazdı. Onsuz hesab
    //    silindikdə QALAN istifadəçilərin izləyici sayı şişik qalırdı —
    //    heç bir xəta vermədən, yalnız rəqəm yalan danışırdı.
    D(c).prepare(
      `UPDATE users SET followers_count = MAX(0, followers_count - 1)
        WHERE id IN (SELECT target_id FROM follows WHERE follower_id = ?)`).bind(u.id),
    D(c).prepare(
      `UPDATE users SET following_count = MAX(0, following_count - 1)
        WHERE id IN (SELECT follower_id FROM follows WHERE target_id = ?)`).bind(u.id),
    // ⚠ `username` sütunu xəritədə deyil: o, `security_events`-in ÖZ sahəsidir
    //   (hadisə anındakı ad), uid istinadı deyil. Xəritə yalnız istifadəçi
    //   İSTİNADLARINI idarə edir; uid `null` siyasəti ilə orada boşalır.
    D(c).prepare("UPDATE security_events SET username = '' WHERE uid = ?").bind(u.id),

    /* 🔴 QALAN HƏR ŞEY XƏRİTƏDƏN GƏLİR (`services/cascade.ts` → `USER_REFS`).
     *
     *   Burada nə silindiyini görmək üçün xəritəyə bax — siyahını iki yerdə
     *   saxlamaq məhz BE-001-in şikayət etdiyi vəziyyətdir.
     *
     * ⚠ AUDIT-TASK-9 / D-2 (anonimləşdirmə variantı b) xəritədə davam edir:
     *   `room_messages` / `dm_messages` sətirləri SİLİNMİR, kimliyi dəyişir —
     *   qarşı tərəf öz söhbət tarixçəsini itirmir, GDPR isə ödənir.
     */
    ...cascadeStatements(D(c), u.id),

    D(c).prepare('DELETE FROM users WHERE id = ?').bind(u.id),
  ]);
  // AUDIT-TASK-8 §8.6 — GDPR Art. 17 (unudulmaq hüququ) arxiv üçün.
  //
  // ⚠ Yuxarıdakı batch `room_messages`/`dm_messages` sətirlərinə TOXUNMUR
  // (mövcud davranış: söhbətin qarşı tərəfi öz tarixçəsini itirməsin), və
  // arxivlənmiş mesajlar onsuz da R2-də gzip içindədir. Tombstone hər iki halı
  // örtür: arxiv oxu yolu bu uid-in mesajlarını DƏRHAL filtrləyir, gecə cron-u
  // isə dump-ları yenidən yazıb onları FİZİKİ silir (archive.ts).
  await markUidDeleted(c.env, u.id);
  await destroyAllSessions(c.env, u.id);
  c.ctx.waitUntil(kickEverywhere(c.env, u.id));   // H-6 / C-2 — hesab silindi
  return withCookies(json({ ok: true }), clearCookies());
}


