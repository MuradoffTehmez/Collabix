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
import { readCookie } from '../auth';
import { QueueService } from '../services/queue';
import {
  hashPassword, verifyPassword, createSession, rotateSession,
  revokeSession, revokeAllSessions, destroyAllSessions, destroyLegacySessions,
  sessionCookies, clearCookies, clearLegacyCookie, TokenPair,
  upgradePasswordHash, PBKDF2_ITER_LEGACY,
} from '../auth';
import {
  reqInfo, logSecurityEvent, recentFailures, checkGeoChange, verifyTurnstile,
} from '../security';
import {
  isConfigured, configuredProviders, createState, consumeState, clearStateCookie,
  exchangeCode, fetchProfile, authorizeUrl, STATE_COOKIE,
  createPending, readPending, consumePending, resolveAccount, suggestUsername,
} from '../oauth';
import {
  generateSecret, otpauthUri, verifyTotp, generateBackupCodes,
  hashBackupCode, mfaEnabled,
} from '../totp';
import { emailEnabled, sendEmail, magicLinkMail, attackAlertMail, mailLang } from '../email';
import { kickEverywhere } from '../ws-kick';
import { markUidDeleted } from '../archive';
import { D, badReq, deleteR2Keys, DELETED_UID, DELETED_NAME } from './shared';

/* ================= AUTH ================= */

// Sessiya cavabı: gövdə + access/refresh cookie cütü.
const withSession = (body: unknown, pair: TokenPair) => withCookies(json(body), sessionCookies(pair));

/**
 * 🔴 HESAB BAŞINA QORUMA ASTANALARI — AUDIT-TASK-9 / A-3.
 *
 * IP əsaslı rate limit paylanmış hücumu (hər IP-dən 5 cəhd, 1000 IP) TUTMUR.
 * `recentFailures` isə həm IP, həm İSTİFADƏÇİ ADI üzrə sayır → hədəflənmiş
 * hücum məhz orada görünür.
 *
 * ⚠ NİYƏ KİLİD DEYİL, CAPTCHA: sadə hesab kilidi YENİ hücum vektoru yaradır —
 * rəqib qurbanın hesabını istənilən vaxt bloklaya bilər (audit §5.2 "dörd tələ").
 * Turnstile layihədə artıq qurulub və qurbanı heç vaxt kilidləmir.
 */
const CAPTCHA_SOFT_AT = 3;    // şübhə → CAPTCHA istənilir, lakin fail-open qalır
const CAPTCHA_HARD_AT = 10;   // hücum → CAPTCHA MƏCBURİDİR, fail-open BAĞLANIR

/**
 * Hesab sahibinə hücum xəbərdarlığı — AUDIT-TASK-9 / A-3 "Bildiriş".
 *
 * ⚠ HESAB SADALANMASI: funksiya çağırılır, lakin nəticəsi cavaba TƏSİR ETMİR
 *   və `waitUntil` ilə arxada işləyir. Mövcud olmayan hesab üçün sadəcə sətir
 *   tapılmır — cavab və gecikmə eyni qalır.
 *
 * Tıxac qapısı: eyni hesaba pəncərə başına BİR məktub. Olmasaydı hücumçu
 * 11-ci cəhddən sonrakı hər cəhdlə qurbanın poçtunu doldura bilərdi — yəni
 * xəbərdarlığın özü spam vektoruna çevrilərdi.
 */
async function alertAccountOwner(c: Ctx, username: string, attempts: number): Promise<void> {
  if (!emailEnabled(c.env)) return;
  const throttleKey = `secalert:${username}`;
  if (await c.env.SESSIONS.get(throttleKey)) return;
  const row = await D(c).prepare('SELECT name, contact_email, settings FROM users WHERE username = ?')
    .bind(username).first<any>();
  const to = String(row?.contact_email || '').trim();
  if (!to) return;
  await c.env.SESSIONS.put(throttleKey, '1', { expirationTtl: 3600 });
  const mail = attackAlertMail(String(row.name || username), attempts,
    mailLang(fromJSON<any>(row.settings, {})?.lang));
  await sendEmail(c.env, { ...mail, to });
}

/**
 * Turnstile qapısı (Bənd 7).
 *
 * `required = false` (default): açar qurulmayıbsa və ya Turnstile xidmətinə
 *   çatılmasa axın maneəsiz davam edir (`verifyTurnstile` → `skipped: true`).
 *   Bu, qəsdli fail-open-dır — CAPTCHA əlçatmazlığı bütün saytı bağlamamalıdır.
 *
 * `required = true` (AUDIT-TASK-9 / A-3): FAIL-CLOSED. `CAPTCHA_HARD_AT`-dan
 *   sonra qapı yeganə hesab-səviyyəli müdafiədir; orada "skipped" qəbul etmək
 *   qorumanı tamamilə mənasızlaşdırardı — hücumçu sadəcə Turnstile-ı
 *   əlçatmaz etməyə çalışar (və ya açar konfiqi düşərsə qapı sükutla açılar).
 *
 * ⚠ HESAB SADALANMASI: bu qapı `recentFailures` ilə açılır, istifadəçinin
 *   MÖVCUDLUĞU ilə YOX. Uğursuz girişlər mövcud olmayan ad üçün də jurnala
 *   düşdüyünə görə (bax `login`) sayğac hər iki halda eyni artır və cavab
 *   fərqlənmir → hücumçu hansı adların mövcud olduğunu öyrənə bilmir.
 */
async function turnstileGate(
  c: Ctx, token: unknown, username = '', required = false,
): Promise<Response | null> {
  const r = await verifyTurnstile(c.env, c.req, token);
  if (r.ok && !(required && r.skipped)) return null;
  await logSecurityEvent(c.env, c.req, {
    type: 'turnstile_failed', username, severity: required ? 'critical' : 'warning',
    meta: { reason: r.reason || (r.skipped ? 'skipped_but_required' : 'failed'), required },
  });
  return err('Bot yoxlaması uğursuz oldu. Səhifəni yeniləyib yenidən cəhd edin.', 403, 'turnstile_failed');
}

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
    `INSERT INTO users (id, username, name, age, birth_date, gender, country, city, bio, contact_email,
      photo_url, prog_levels, lang_levels, goals, looking_for, instagram, github, linkedin, telegram, website,
      streak, last_active_day, last_active_at, activity_days, joined_at, pass_hash, pass_salt, pass_iter,
      search_name)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?)`,
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
  const fails = await recentFailures(c.env, c.req, username);
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

  const row = await D(c).prepare('SELECT * FROM users WHERE username = ?').bind(username).first<any>();
  // M-2: iterasiya SƏTİRDƏN gəlir. Köhnə hesab 100 000 ilə yazılıb;
  // sabitlə (600 000) yoxlasaq düzgün parol da uyğunsuz heş verərdi.
  const ok = row
    ? await verifyPassword(String(b.pass || ''), row.pass_hash, row.pass_salt, Number(row.pass_iter) || PBKDF2_ITER_LEGACY)
    : false;
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

  // seriya (streak) yeniləməsi
  const day = todayStr();
  if (row.last_active_day !== day) {
    const diff = row.last_active_day
      ? Math.round((new Date(day).getTime() - new Date(row.last_active_day).getTime()) / 86400000) : 99;
    const streak = diff === 1 ? (row.streak || 0) + 1 : 1;
    const days = fromJSON<Record<string, number>>(row.activity_days, {});
    days[day] = (days[day] || 0) + 1;
    await D(c).prepare('UPDATE users SET streak = ?, last_active_day = ?, last_active_at = ?, activity_days = ? WHERE id = ?')
      .bind(streak, day, now(), JSON.stringify(days), row.id).run();
  }
  // Coğrafi anomaliya: əvvəlki ölkə ilə müqayisə (yalnız jurnal, blok deyil).
  await checkGeoChange(c.env, c.req, row.id, row.last_country || '');
  const country = reqInfo(c.req).country;
  if (country && country !== row.last_country) {
    await D(c).prepare('UPDATE users SET last_country = ? WHERE id = ?').bind(country, row.id).run();
  }
  // 2FA aktivdirsə parol TƏK BAŞINA kifayət etmir — sessiya HƏLƏ verilmir.
  // Challenge KV-də "parolu bilirəm" faktını daşıyır; ikinci addım
  // `/api/auth/mfa`-dadır. Cavabda istifadəçi məlumatı QAYTARILMIR.
  if (await mfaEnabled(c.env, row.id)) {
    return json({ mfaRequired: true, challenge: await issueMfaChallenge(c, row.id) });
  }

  await logSecurityEvent(c.env, c.req, { type: 'login_ok', uid: row.id, username });

  // M-2 TƏDRİCİ KÖÇÜRMƏ: açıq parol MƏHZ İNDİ əlimizdədir — başqa heç bir
  // nöqtədə onu yenidən heşləmək mümkün deyil (bazada yalnız heş var).
  // `waitUntil`: 600 000 iterasiya ~6× baha başa gəlir və cavabı
  // GÖZLƏTMƏMƏLİDİR. Uğursuz olsa növbəti girişdə yenidən cəhd edilir.
  c.ctx.waitUntil(
    upgradePasswordHash(c.env, row.id, String(b.pass || ''), Number(row.pass_iter) || PBKDF2_ITER_LEGACY)
      .catch(e => console.error('pass_iter köçürməsi alınmadı', e)),
  );

  const pair = await createSession(c.env, c.req, row.id);
  const fresh = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(row.id).first();
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
  if (typeof b.next !== 'string' || b.next.length < 6) return badReq('Yeni şifrə minimum 6 simvol.');
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
  await D(c).batch([
    // Bu istifadəçinin postlarının re-post/quote-larını soft-mark et (posts silinməzdən ƏVVƏL).
    D(c).prepare('UPDATE posts SET original_deleted = 1 WHERE shared_post_id IN (SELECT id FROM posts WHERE author_id = ?)').bind(u.id),
    D(c).prepare('DELETE FROM post_shares WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE author_id = ?)').bind(u.id, u.id),
    D(c).prepare('DELETE FROM posts WHERE author_id = ?').bind(u.id),
    D(c).prepare('DELETE FROM follows WHERE follower_id = ? OR target_id = ?').bind(u.id, u.id),
    D(c).prepare('DELETE FROM likes WHERE user_id = ?').bind(u.id),
    D(c).prepare('DELETE FROM bookmarks WHERE user_id = ?').bind(u.id),
    D(c).prepare('DELETE FROM notifications WHERE user_id = ?').bind(u.id),
    D(c).prepare('DELETE FROM presence WHERE user_id = ?').bind(u.id),
    D(c).prepare('DELETE FROM progress WHERE user_id = ?').bind(u.id),
    D(c).prepare('DELETE FROM admins WHERE user_id = ?').bind(u.id),
    D(c).prepare('DELETE FROM sessions WHERE uid = ?').bind(u.id),
    D(c).prepare('DELETE FROM oauth_accounts WHERE uid = ?').bind(u.id),
    // AUDIT-TASK-9 / B-4: `xp_logs`-da FK yoxdur → sətirlər YETİM qalardı və
    // `SUM(xp_logs) == users.xp` invariantı hər hesab silinməsindən sonra
    // pozulardı (`/api/health` daimi "drift" göstərərdi).
    D(c).prepare('DELETE FROM xp_logs WHERE uid = ?').bind(u.id),
    // security_events-də uid boşaldılır, SƏTİR SAXLANILIR: hadisələr təhlükəsizlik
    // telemetriyasıdır (hansı IP-dən neçə uğursuz giriş oldu) və şəxsi məlumat
    // çıxarıldıqdan sonra artıq həmin istifadəçiyə aid deyil. Silinsəydi, hesabı
    // silərək öz izini təmizləyən hücumçu monitorinqi kor edərdi.
    D(c).prepare('UPDATE security_events SET uid = NULL, username = \'\' WHERE uid = ?').bind(u.id),
    // 🔴 AUDIT-TASK-9 / D-2 — İSTİ PƏNCƏRƏNİN ANONİMLƏŞDİRİLMƏSİ (variant b).
    //
    // PROBLEM (Task 8 §9/1): tombstone filtri yalnız ARXİV oxu yoluna tətbiq
    // olunmuşdu. Nəticə ziddiyyətli idi — silinmiş hesabın son 90 günlük
    // mesajları GÖRÜNÜRDÜ, 90 gündən köhnələri isə YOX.
    //
    // Variant (a) hər mesaj sorğusuna `LEFT JOIN deleted_uids` əlavə edərdi;
    // mesaj oxusu ən sıx yoldur, ona görə rədd edildi. Variant (c) ziddiyyəti
    // sadəcə sənədləşdirərdi. (b) həm GDPR-i, həm söhbət bütövlüyünü qoruyur:
    // MƏZMUN qalır (qarşı tərəf öz tarixçəsini itirmir), KİMLİK silinir.
    //
    // ⚠ `author_id` da dəyişdirilir, təkcə ad yox: uid qalsaydı, o, hələ də
    //   həmin şəxsə bağlanan identifikator olardı və anonimləşdirmə GDPR
    //   mənasında natamam qalardı.
    D(c).prepare(
      `UPDATE room_messages SET author_id = ?2, author_name = ?3 WHERE author_id = ?1`,
    ).bind(u.id, DELETED_UID, DELETED_NAME),
    // `dm_messages`-də ad sütunu yoxdur (UI adı `users`-dan çəkir) — yalnız uid.
    D(c).prepare('UPDATE dm_messages SET from_id = ?2 WHERE from_id = ?1').bind(u.id, DELETED_UID),
    D(c).prepare('UPDATE dm_messages SET to_id = ?2 WHERE to_id = ?1').bind(u.id, DELETED_UID),
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


/* ================= 2FA / TOTP (Bənd 2) ================= */

const MFA_CHALLENGE_TTL = 300;   // 5 dəqiqə — kodu tapıb yazmağa kifayətdir

// Parol doğrulandı, amma sessiya HƏLƏ verilmir: ikinci addım gözlənilir.
// Challenge KV-də saxlanılır və "parolu bilirəm" faktını daşıyır — client
// sadəcə uid göndərib bu addımı ata bilməsin.
async function issueMfaChallenge(c: Ctx, uid: string): Promise<string> {
  const token = b64uRandom(32);
  await c.env.SESSIONS.put(`mfachal:${await sha256Hex(token)}`, uid, { expirationTtl: MFA_CHALLENGE_TTL });
  return token;
}

// TOTP kodunu VƏ YA ehtiyat kodu yoxlayır. Uğurda replay qoruması yenilənir.
async function consumeMfaCode(c: Ctx, uid: string, code: string): Promise<boolean> {
  const row = await D(c).prepare(
    'SELECT totp_secret, last_step FROM user_mfa WHERE uid = ? AND confirmed = 1',
  ).bind(uid).first<any>();
  if (!row) return false;

  const step = await verifyTotp(row.totp_secret, code, Number(row.last_step) || 0);
  if (step !== null) {
    // İstifadə olunmuş addım yazılır → eyni kod ikinci dəfə keçmir.
    await D(c).prepare('UPDATE user_mfa SET last_step = ? WHERE uid = ?').bind(step, uid).run();
    return true;
  }

  // TOTP tutmadı — ehtiyat kod ola bilər (telefon itib).
  const hash = await hashBackupCode(code);
  const bc = await D(c).prepare(
    'SELECT used_at FROM mfa_backup_codes WHERE uid = ? AND code_hash = ?',
  ).bind(uid, hash).first<any>();
  if (!bc || bc.used_at) return false;      // yoxdur və ya artıq işlədilib
  await D(c).prepare('UPDATE mfa_backup_codes SET used_at = ? WHERE uid = ? AND code_hash = ?')
    .bind(now(), uid, hash).run();
  await logSecurityEvent(c.env, c.req, {
    type: 'login_ok', uid, severity: 'warning', meta: { flow: 'mfa_backup_code' },
  });
  return true;
}

// Girişin ikinci addımı.
export async function mfaVerify(c: Ctx) {
  const b = await readJson(c.req);
  const key = `mfachal:${await sha256Hex(String(b.challenge || ''))}`;
  const uid = await c.env.SESSIONS.get(key);
  if (!uid) return err('Təsdiq müddəti bitib. Yenidən daxil olun.', 401, 'mfa_challenge_expired');

  // 🔴 AUDIT-TASK-9 / A-3: audit qeyd edirdi ki, MFA kodu hücumu YALNIZ `auth`
  // səbətinə güvənir. Səbət indi atomikdir (Faza A), lakin o, IP üzrə sayır —
  // paylanmış hücum 6 rəqəmlik fəzanı yenə də gəzə bilər. Login ilə EYNİ
  // hesab-səviyyəli qapı buraya da qoyulur.
  //
  // `username` MƏHZ ONA GÖRƏ oxunur ki, uğursuz MFA cəhdi jurnala adla düşsün:
  // `recentFailures` istifadəçi adı üzrə saymasa, bütün MFA nasazlıqları
  // `username = ''` altında qarışar və sayğac mənasızlaşardı.
  const acct = await D(c).prepare('SELECT username FROM users WHERE id = ?').bind(uid).first<any>();
  const uname = String(acct?.username || '');
  const mfaFails = await recentFailures(c.env, c.req, uname);
  if (uname && mfaFails >= CAPTCHA_SOFT_AT) {
    const gate = await turnstileGate(c, b.turnstileToken, uname, mfaFails >= CAPTCHA_HARD_AT);
    if (gate) {
      if (mfaFails >= CAPTCHA_HARD_AT) c.ctx.waitUntil(alertAccountOwner(c, uname, mfaFails));
      return gate;
    }
  }

  if (!(await consumeMfaCode(c, uid, String(b.code || '')))) {
    await logSecurityEvent(c.env, c.req, {
      type: 'login_failed', uid, username: uname, severity: 'warning',
      meta: { flow: 'mfa', reason: 'bad_code' },
    });
    // Challenge SİLİNMİR: istifadəçi kodu səhv yazmış ola bilər, yenidən
    // parol daxil etməyə məcbur etmək lazım deyil. Cəhdlərin sayı rate-limit
    // ilə məhdudlaşır (`auth` səbəti).
    return err('Kod yanlışdır.', 401, 'mfa_bad_code');
  }

  await c.env.SESSIONS.delete(key);   // birdəfəlik
  const row = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(uid).first<any>();
  if (!row || row.blocked) return err('Hesabınız bloklanıb.', 403, 'account_blocked');

  await logSecurityEvent(c.env, c.req, { type: 'login_ok', uid, username: row.username, meta: { flow: 'mfa' } });
  const pair = await createSession(c.env, c.req, uid);
  return withSession({ user: mapUser(row, true) }, pair);
}

/* ---------- MFA idarəetməsi (Parametrlər) ---------- */

export async function mfaStatus(c: Ctx) {
  const row = await D(c).prepare('SELECT confirmed, enabled_at FROM user_mfa WHERE uid = ?')
    .bind(c.user!.id).first<any>();
  const left = await D(c).prepare(
    'SELECT COUNT(*) AS n FROM mfa_backup_codes WHERE uid = ? AND used_at IS NULL',
  ).bind(c.user!.id).first<any>();
  return json({
    enabled: !!row && row.confirmed === 1,
    pending: !!row && row.confirmed === 0,
    enabledAt: row?.enabled_at || null,
    backupRemaining: Number(left?.n || 0),
  });
}

// Sirr yaradır (HƏLƏ aktiv deyil) və QR üçün otpauth URI qaytarır.
export async function mfaSetup(c: Ctx) {
  if (await mfaEnabled(c.env, c.user!.id)) return badReq('2FA artıq aktivdir.');
  const secret = generateSecret();
  // `INSERT OR REPLACE`: təsdiqlənməmiş köhnə cəhd varsa üzərinə yazılır —
  // istifadəçi QR-ı yenidən skan etmək istəyəndə köhnə sirr ilişib qalmasın.
  await D(c).prepare(
    'INSERT OR REPLACE INTO user_mfa (uid, totp_secret, confirmed, last_step, created_at) VALUES (?,?,0,0,?)',
  ).bind(c.user!.id, secret, now()).run();
  return json({
    secret,   // əl ilə daxil etmək üçün (QR skan edilə bilmirsə)
    uri: otpauthUri(secret, c.user!.username, c.env.APP_NAME || 'Collabix'),
  });
}

// İlk kodu təsdiqləyir → 2FA aktivləşir + ehtiyat kodlar verilir.
export async function mfaConfirm(c: Ctx) {
  const b = await readJson(c.req);
  const row = await D(c).prepare('SELECT totp_secret, confirmed FROM user_mfa WHERE uid = ?')
    .bind(c.user!.id).first<any>();
  if (!row) return badReq('Əvvəlcə 2FA qurulmalıdır.');
  if (row.confirmed) return badReq('2FA artıq aktivdir.');

  const step = await verifyTotp(row.totp_secret, String(b.code || ''));
  if (step === null) return err('Kod yanlışdır. Telefonun saatının düzgün olduğunu yoxla.', 400, 'mfa_bad_code');

  const codes = generateBackupCodes();
  const hashes = await Promise.all(codes.map(hashBackupCode));
  await D(c).batch([
    D(c).prepare('UPDATE user_mfa SET confirmed = 1, enabled_at = ?, last_step = ? WHERE uid = ?')
      .bind(now(), step, c.user!.id),
    // Köhnə kodlar (təkrar qurulmadırsa) təmizlənir.
    D(c).prepare('DELETE FROM mfa_backup_codes WHERE uid = ?').bind(c.user!.id),
    ...hashes.map(h => D(c).prepare(
      'INSERT INTO mfa_backup_codes (uid, code_hash, created_at) VALUES (?,?,?)',
    ).bind(c.user!.id, h, now())),
  ]);

  await logSecurityEvent(c.env, c.req, {
    type: 'password_changed', uid: c.user!.id, username: c.user!.username,
    severity: 'warning', meta: { change: 'mfa_enabled' },
  });
  // Kodlar YALNIZ BU DƏFƏ göstərilir — bazada yalnız heşləri var.
  return json({ ok: true, backupCodes: codes });
}

export async function mfaDisable(c: Ctx) {
  const b = await readJson(c.req);
  // Söndürmə üçün CARİ kod tələb olunur: kimsə açıq qalmış sessiyaya çatsa
  // 2FA-nı bir kliklə söndürüb qorumanı çıxara bilməsin.
  if (!(await consumeMfaCode(c, c.user!.id, String(b.code || '')))) {
    return err('Kod yanlışdır.', 403, 'mfa_bad_code');
  }
  await D(c).batch([
    D(c).prepare('DELETE FROM user_mfa WHERE uid = ?').bind(c.user!.id),
    D(c).prepare('DELETE FROM mfa_backup_codes WHERE uid = ?').bind(c.user!.id),
  ]);
  await logSecurityEvent(c.env, c.req, {
    type: 'password_changed', uid: c.user!.id, username: c.user!.username,
    severity: 'critical', meta: { change: 'mfa_disabled' },
  });
  return json({ ok: true });
}

export async function mfaRegenerateBackup(c: Ctx) {
  const b = await readJson(c.req);
  if (!(await consumeMfaCode(c, c.user!.id, String(b.code || '')))) {
    return err('Kod yanlışdır.', 403, 'mfa_bad_code');
  }
  const codes = generateBackupCodes();
  const hashes = await Promise.all(codes.map(hashBackupCode));
  await D(c).batch([
    D(c).prepare('DELETE FROM mfa_backup_codes WHERE uid = ?').bind(c.user!.id),
    ...hashes.map(h => D(c).prepare(
      'INSERT INTO mfa_backup_codes (uid, code_hash, created_at) VALUES (?,?,?)',
    ).bind(c.user!.id, h, now())),
  ]);
  return json({ ok: true, backupCodes: codes });
}

/* ================= MAGIC LINK (Bənd 4) ================= */

const MAGIC_TTL = 600;   // 10 dəqiqə

const sha256Hex = async (s: string) => {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
};

// Parolsuz giriş linki istəyi.
//
// ⚠ CAVAB HƏMİŞƏ EYNİDİR (`{ ok: true }`) — email mövcuddur, yoxdur, göndərmə
// alındı, alınmadı: fərq etməz. Fərqli cavab versəydik, bu endpoint "hansı
// email Collabix-də qeydiyyatdadır?" sualına cavab verən pulsuz alətə çevrilərdi
// (istifadəçi sadalanması). Əsl nəticə yalnız poçt qutusunda görünür.
export async function magicLinkRequest(c: Ctx) {
  const b = await readJson(c.req);
  const gate = await turnstileGate(c, b.turnstileToken);
  if (gate) return gate;

  const neutral = json({ ok: true });
  if (!emailEnabled(c.env)) return neutral;

  const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return neutral;

  // Ünvan başına limit — IP limiti tək başına kifayət etmir: botnet fərqli
  // IP-lərdən eyni qurbanın qutusunu doldura bilərdi.
  const perAddr = `mlrate:${await sha256Hex(email)}`;
  const sent = parseInt((await c.env.SESSIONS.get(perAddr)) || '0', 10);
  if (sent >= 3) return neutral;
  await c.env.SESSIONS.put(perAddr, String(sent + 1), { expirationTtl: 900 });

  // Doğrulanmış `email` VƏ YA istifadəçinin özünün yazdığı `contact_email`.
  // İkincisi doğrulanmayıb, amma linkə klik məhz o qutuya çıxışı SÜBUT edir —
  // ona görə uğurlu istifadədən sonra ünvan doğrulanmış kimi işarələnir.
  const row = await D(c).prepare(
    `SELECT id, name, blocked, settings FROM users
      WHERE (email = ?1 AND email != '') OR lower(contact_email) = ?1 LIMIT 1`,
  ).bind(email).first<any>();
  if (!row || row.blocked) return neutral;

  const token = b64uRandom(32);
  await c.env.SESSIONS.put(
    `magic:${await sha256Hex(token)}`,
    JSON.stringify({ uid: row.id, email }),
    { expirationTtl: MAGIC_TTL },
  );

  const lang = mailLang(fromJSON<any>(row.settings, {})?.lang);
  const url = `${c.url.origin}/api/auth/magic/${token}`;
  const mail = magicLinkMail(row.name || '', url, lang);
  await sendEmail(c.env, { ...mail, to: email });
  return neutral;
}

// Linkə klik — brauzer naviqasiyasıdır, ona görə cavab 302-dir.
export async function magicLinkConsume(c: Ctx, token: string) {
  const key = `magic:${await sha256Hex(token)}`;
  const raw = await c.env.SESSIONS.get(key);
  if (!raw) {
    await logSecurityEvent(c.env, c.req, {
      type: 'login_failed', severity: 'warning', meta: { flow: 'magic_link', reason: 'invalid_or_used' },
    });
    return appRedirect(c, '/?magic=expired');
  }
  // BİRDƏFƏLİK: oxunan kimi silinir. Email-dəki link forward edilsə, keşlənsə
  // və ya skaner tərəfindən açılsa belə ikinci dəfə işləmir.
  await c.env.SESSIONS.delete(key);

  const { uid, email } = JSON.parse(raw) as { uid: string; email: string };
  const row = await D(c).prepare('SELECT id, blocked FROM users WHERE id = ?').bind(uid).first<any>();
  if (!row || row.blocked) return appRedirect(c, '/?magic=blocked');

  // Klik qutuya çıxışı sübut etdi → ünvanı doğrulanmış kimi qeyd et.
  // Bu, gələcək OAuth hesab birləşdirməsi üçün də etibarlı açar yaradır.
  await D(c).prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?').bind(email, uid).run();
  await logSecurityEvent(c.env, c.req, { type: 'login_ok', uid, meta: { flow: 'magic_link' } });

  const pair = await createSession(c.env, c.req, uid);
  return appRedirect(c, '/?magic=ok#home', sessionCookies(pair));
}

/* ================= OAUTH (Bənd 5) ================= */

// Provayderdən qayıdanda istifadəçini tətbiqə qaytaran 302.
//
// Nəticə QUERY sətrində daşınır (`?oauth=...`), fraqmentdə YOX: marşrutlaşdırıcı
// `location.hash`-i səhifə adı kimi oxuyur (`js/app.js` route()), ona görə
// `#auth?oauth=...` formasında hash tanınmayan səhifəyə çevrilib istifadəçini
// vitrinə atardı. Query isə `URLSearchParams` ilə təmiz oxunur və hash öz
// marşrut vəzifəsində qalır.
const appRedirect = (c: Ctx, target: string, cookies: string[] = []) =>
  withCookies(new Response(null, {
    status: 302,
    headers: { Location: new URL(target, c.url.origin).toString() },
  }), [clearStateCookie(), ...cookies]);

export async function oauthStart(c: Ctx, provider: string) {
  if (!isConfigured(c.env, provider)) return err('Bu provayder aktiv deyil.', 404, 'provider_off');

  // Giriş etmiş istifadəçi üçün bu, hesab BAĞLAMA axınıdır (yeni giriş yox).
  const linkUid = c.user?.id;
  const { state, cookie } = await createState(c.env, {
    provider,
    linkUid,
    returnTo: linkUid ? '/#settings' : '/#home',
  });
  return withCookies(new Response(null, {
    status: 302,
    headers: { Location: authorizeUrl(c.env, c.url, provider, state) },
  }), [cookie]);
}

export async function oauthCallback(c: Ctx, provider: string) {
  if (!isConfigured(c.env, provider)) return err('Bu provayder aktiv deyil.', 404, 'provider_off');

  const q = c.url.searchParams;
  // İstifadəçi provayderdə "imtina" seçə bilər — bu xəta deyil, sakit qayıdış.
  if (q.get('error')) return appRedirect(c, '/?oauth=cancelled');

  const st = await consumeState(c.env, q.get('state') || '', readCookie(c.req, STATE_COOKIE));
  if (!st || st.provider !== provider) {
    await logSecurityEvent(c.env, c.req, {
      type: 'login_failed', severity: 'warning',
      meta: { flow: 'oauth', provider, reason: 'bad_state' },
    });
    return appRedirect(c, '/?oauth=state_error');
  }

  let profile;
  try {
    profile = await fetchProfile(provider, await exchangeCode(c.env, c.url, provider, q.get('code') || ''));
  } catch (e: any) {
    console.error('oauth exchange', provider, e?.message || e);
    return appRedirect(c, '/?oauth=provider_error');
  }

  // --- Bağlama rejimi: mövcud hesaba əlavə provayder qoşulur ---
  if (st.linkUid) {
    const taken = await D(c).prepare(
      'SELECT uid FROM oauth_accounts WHERE provider = ? AND provider_id = ?',
    ).bind(provider, profile.providerId).first<any>();
    // Eyni provayder hesabı başqa istifadəçidə varsa bağlamırıq — əks halda
    // bir GitHub hesabı iki Collabix profilinə giriş verərdi.
    if (taken && taken.uid !== st.linkUid) return appRedirect(c, '/?oauth=already_linked#settings');

    await D(c).prepare(
      'INSERT OR IGNORE INTO oauth_accounts (provider, provider_id, uid, email, login, linked_at) VALUES (?,?,?,?,?,?)',
    ).bind(provider, profile.providerId, st.linkUid, (profile.email || '').toLowerCase(), profile.login, now()).run();
    return appRedirect(c, '/?oauth=linked#settings');
  }

  // --- Giriş / qeydiyyat rejimi ---
  const outcome = await resolveAccount(c.env, provider, profile);

  if (outcome.kind === 'signup') {
    // Hesab HƏLƏ yaradılmır — 18+ qapısı sihirbazdadır (bax oauth.ts izahı).
    const ticket = await createPending(c.env, outcome.profile);
    return appRedirect(c, `/?oauth_ticket=${ticket}`);
  }

  const uid = outcome.uid;
  const row = await D(c).prepare('SELECT blocked FROM users WHERE id = ?').bind(uid).first<any>();
  if (!row || row.blocked) return appRedirect(c, '/?oauth=blocked');

  await logSecurityEvent(c.env, c.req, {
    type: 'login_ok', uid, severity: 'info', meta: { flow: 'oauth', provider, linked: outcome.kind === 'linked' },
  });
  const pair = await createSession(c.env, c.req, uid);
  return appRedirect(c, st.returnTo, sessionCookies(pair));
}

// Sihirbaz gözləyən OAuth profilini oxuyur (ad/email/avatar ilkin doldurma).
export async function oauthPending(c: Ctx) {
  const p = await readPending(c.env, c.url.searchParams.get('ticket') || '');
  if (!p) return err('Bilet etibarsız və ya vaxtı bitib.', 404, 'ticket_invalid');
  return json({
    provider: p.provider, name: p.name, email: p.email, avatar: p.avatar,
    // İstifadəçi adı təklifi serverdə yoxlanılır ki, sihirbaz boş olanı göstərsin.
    username: await suggestUsername(c.env, p.login, p.email),
  });
}

/* ---------- bağlı hesablar (Parametrlər) ---------- */
export async function listOAuthAccounts(c: Ctx) {
  const rows = await D(c).prepare(
    'SELECT provider, login, email, linked_at FROM oauth_accounts WHERE uid = ?',
  ).bind(c.user!.id).all<any>();
  return json({
    accounts: rows.results.map(r => ({
      provider: r.provider, login: r.login, email: r.email, linkedAt: r.linked_at,
    })),
    available: configuredProviders(c.env),
    hasPassword: c.user!.has_password !== 0,
  });
}

export async function unlinkOAuth(c: Ctx, provider: string) {
  const rows = await D(c).prepare('SELECT provider FROM oauth_accounts WHERE uid = ?').bind(c.user!.id).all<any>();
  const hasPassword = c.user!.has_password !== 0;
  // Son giriş üsulunu silməyə İCAZƏ VERİLMİR — istifadəçi öz hesabından
  // birdəfəlik kilidlənərdi (parol yoxdur, bağlı provayder qalmır).
  if (!hasPassword && rows.results.length <= 1) {
    return err('Bu yeganə giriş üsulunuzdur. Əvvəlcə şifrə təyin edin.', 400, 'last_method');
  }
  await D(c).prepare('DELETE FROM oauth_accounts WHERE uid = ? AND provider = ?')
    .bind(c.user!.id, provider).run();
  // AUDIT M-12 — bu, İSTİFADƏÇİ əməliyyatıdır, admin əməliyyatı deyil.
  // `admin_logs`-a yazılması admin jurnalını çirkləndirirdi: panel "admin
  // nə etdi" sualına cavab verməli ikən istifadəçi hərəkətləri ilə dolurdu.
  // Doğru yer `security_events`-dir — giriş üsulunun dəyişməsi təhlükəsizlik
  // hadisəsidir və `sessions` ilə eyni panelə düşür.
  c.ctx.waitUntil(logSecurityEvent(c.env, c.req, {
    type: 'session_revoked', severity: 'warning',
    uid: c.user!.id, username: c.user!.username,
    meta: { action: 'oauth_unlink', provider },
  }));
  return json({ ok: true });
}

