// Bütün /api marşrutları. Dispatch cədvəli index.ts-dədir.
import {
  Ctx, json, err, readJson, uuid, now, todayStr, b64uRandom,
  normalizeUsername, validUsername, clampStr, toJSON, fromJSON,
  pairIdFor, extractMentions,
  mapUser, mapPost, mapMsg, mapTask, mapSubmission, fileUrl, withCookies,
} from './util';
import {
  hashPassword, verifyPassword, createSession, rotateSession,
  revokeSession, revokeAllSessions, destroyAllSessions, destroyLegacySessions,
  sessionCookies, clearCookies, clearLegacyCookie, TokenPair,
} from './auth';
import { logAdmin, isAdminLogAction, invalidAdminAction } from './admin-log';
import {
  reqInfo, logSecurityEvent, recentFailures, checkGeoChange, verifyTurnstile,
  sniffType, imageDimensions,
} from './security';
import {
  isConfigured, configuredProviders, createState, consumeState, clearStateCookie,
  STATE_COOKIE, authorizeUrl, exchangeCode, fetchProfile, resolveAccount,
  createPending, readPending, consumePending, suggestUsername,
} from './oauth';
import { readCookie } from './auth';
import { emailEnabled, sendEmail, magicLinkMail, mailLang } from './email';
import { QueueService } from './services/queue';
import { sanitizeMsg } from './msg';
import {
  generateSecret, otpauthUri, verifyTotp, generateBackupCodes,
  hashBackupCode, mfaEnabled,
} from './totp';

const D = (c: Ctx) => c.env.DB;

/* ================= köməkçilər ================= */
async function notify(c: Ctx, toUid: string, type: string, text: string, postId: string | null = null) {
  if (!c.user || toUid === c.user.id) return;
  // bildiriş tərcihləri
  const target = await D(c).prepare('SELECT settings FROM users WHERE id = ?').bind(toUid).first<any>();
  if (!target) return;
  const prefs = fromJSON<any>(target.settings, {})?.notifications || {};
  const prefKey = ({ like: 'likes', comment: 'comments', follow: 'follows' } as any)[type];
  if (prefKey && prefs[prefKey] === false) return;
  await D(c).prepare(
    'INSERT INTO notifications (id, user_id, type, from_id, from_name, post_id, text, read, created_at) VALUES (?,?,?,?,?,?,?,0,?)',
  ).bind(uuid(), toUid, type, c.user.id, c.user.name, postId, text, now()).run();
  // Sətir HƏQİQƏTƏN yazıldıqdan sonra fan-out (tərcih söndürülübsə yuxarıda
  // return olunur → boş yerə siqnal getmir).
  await userPush(c, toUid, { t: 'notif' });
}

async function notifyMentions(c: Ctx, text: string, label: string, postId: string | null = null) {
  const names = extractMentions(text);
  if (!names.length) return;
  const q = `SELECT id FROM users WHERE username IN (${names.map(() => '?').join(',')})`;
  const rows = await D(c).prepare(q).bind(...names).all<any>();
  for (const r of rows.results) await notify(c, r.id, 'mention', label, postId);
}

// Gündəlik fəaliyyət sayğacı (Bənd 9).
//
// İKİ yerə yazılır və bu, keçid dövrü üçün QƏSDƏNDİR:
//   * `user_activity` — yeni, normalized mənbə. Artımlı UPSERT: bütün tarixçəni
//     oxuyub geri yazmır, yəni "lost update" problemi yoxdur və yazı həcmi sabitdir.
//   * `users.activity_days` — köhnə JSON blob. Hələ də yenilənir, çünki keşlənmiş
//     köhnə client-lər (`mapUser` → `activityDays`) onu oxuyur. Bütün client-lər
//     yeni endpoint-ə keçəndən sonra bu sətir silinə bilər.
async function bumpActivity(c: Ctx) {
  const day = todayStr();
  // AUDIT M-8 — köhnə `users.activity_days` JSON blob-una yazı DAYANDIRILDI.
  //
  // Problem: blob read-modify-write idi (bütün tarixçəni oxu → dəyiş → geri
  // yaz). İki paralel sorğu eyni köhnə blob-u oxuyub bir-birinin artımını
  // itirirdi (lost update). `user_activity` isə artımlı UPSERT-dir — yarış
  // yoxdur və yazı həcmi sabitdir.
  //
  // ⚠ Oxu yolu ƏVVƏLCƏ köçürülüb (Task 3 §5.2 "giriş yolu ≠ qiymətləndirmə
  // yolu" tələsi): `activityFor` artıq `user_activity` cədvəlindən oxuyur və
  // sətri olmayan istifadəçi üçün blob-u BİR DƏFƏ köçürür (tənbəl miqrasiya).
  // Blob sütunu SİLİNMİR — həmin tənbəl miqrasiya hələ ona güvənir.
  await D(c).prepare(
    `INSERT INTO user_activity (uid, date, count) VALUES (?,?,1)
     ON CONFLICT(uid, date) DO UPDATE SET count = count + 1`,
  ).bind(c.user!.id, day).run();
}

async function bumpProgress(c: Ctx, uid: string, field: string, col: 'posts' | 'tasks', amount = 1) {
  await D(c).prepare(
    `INSERT INTO progress (user_id, field, ${col}) VALUES (?,?,?)
     ON CONFLICT(user_id, field) DO UPDATE SET ${col} = ${col} + ?`,
  ).bind(uid, field, amount, amount).run();
}

// Admin jurnalı `worker/admin-log.ts`-ə köçürüldü (AUDIT-TASK-6 §B-3):
// `team-routes.ts` də ona ehtiyac duyur (M-11), lakin oradan `routes.ts`-i
// import etmək komanda route-larının lazy yüklənməsini pozardı.
export type { LogLevel } from './admin-log';

const badReq = (m: string) => err(m, 400);

/**
 * Post `blocks` JSON-unun ümumi tavanı — AUDIT M-5.
 *
 * 64 KB seçimi ölçmə ilədir, təxminlə deyil: bazadakı ƏN BÖYÜK mövcud post
 * 58 bayt idi (uzaq bazada ümumiyyətlə post yox idi), yəni tavan real
 * istifadədən üç böyüklük dərəcəsi yuxarıdadır və heç bir mövcud postu
 * kəsmir. Məqsəd storage DoS-un qarşısını almaqdır, məzmunu məhdudlaşdırmaq
 * deyil.
 */
const POST_BLOCKS_MAX_BYTES = 64 * 1024;

// Realtime: otaq mesajı dəyişəndə (yeni / redaktə / sil) həmin otağın DO-suna
// "yenilə" siqnalı göndərilir → bağlı client-lər dərhal refetch edir. Fan-out
// yalnız siqnaldır, məzmun D1-dən gəlir (persistence orada qalır). Xəta olsa
// susdurulur — realtime opsionaldır, REST hər halda işləyir.
async function roomBroadcast(c: Ctx, roomId: string, payload: unknown): Promise<void> {
  try {
    const stub = c.env.ROOM_DO.get(c.env.ROOM_DO.idFromName(roomId));
    await stub.broadcast(payload);
  } catch { /* realtime opsional */ }
}

// Realtime: konkret istifadəçinin açıq tablarına siqnal (bildiriş / DM).
// Qlobal PresenceDO uid→soket indeksini saxlayır — ayrıca DO sinfi lazım deyil.
// roomBroadcast kimi: yalnız siqnal, məzmun REST-dən; xəta susdurulur.
async function userPush(c: Ctx, uid: string, payload: unknown): Promise<void> {
  try {
    const stub = c.env.PRESENCE_DO.get(c.env.PRESENCE_DO.idFromName('global'));
    await stub.push(uid, payload);
  } catch { /* realtime opsional */ }
}

/* ================= AUTH ================= */

// Sessiya cavabı: gövdə + access/refresh cookie cütü.
const withSession = (body: unknown, pair: TokenPair) => withCookies(json(body), sessionCookies(pair));

// Turnstile qapısı (Bənd 7). Açar qurulmayıbsa `verifyTurnstile` skipped:true
// qaytarır və axın maneəsiz davam edir — bax security.ts-dəki izah.
async function turnstileGate(c: Ctx, token: unknown, username = ''): Promise<Response | null> {
  const r = await verifyTurnstile(c.env, c.req, token);
  if (r.ok) return null;
  await logSecurityEvent(c.env, c.req, {
    type: 'turnstile_failed', username, severity: 'warning', meta: { reason: r.reason },
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
  const { hash, salt } = await hashPassword(
    pending ? b64uRandom() : b.pass,
  );
  const id = uuid();
  const day = todayStr();
  await D(c).prepare(
    `INSERT INTO users (id, username, name, age, birth_date, gender, country, city, bio, contact_email,
      photo_url, prog_levels, lang_levels, goals, looking_for, instagram, github, linkedin, telegram, website,
      streak, last_active_day, last_active_at, activity_days, joined_at, pass_hash, pass_salt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)`,
  ).bind(
    id, username, clampStr(b.name, 60) || username, age, clampStr(b.birthDate, 10),
    clampStr(b.gender, 10), clampStr(b.country, 40), clampStr(b.city, 40),
    clampStr(b.bio, 400), clampStr(b.contactEmail, 120),
    null, toJSON(b.progLevels, '{}'), toJSON(b.langLevels, '{}'),
    clampStr(b.goals, 300), toJSON(b.lookingFor, '[]'),
    clampStr(b.instagram, 40), clampStr(b.github, 40), clampStr(b.linkedin, 60),
    clampStr(b.telegram, 40), clampStr(b.website, 100),
    day, now(), JSON.stringify({ [day]: 1 }), now(), hash, salt,
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
  const fails = await recentFailures(c.env, c.req, username);
  if (fails >= 3) {
    const gate = await turnstileGate(c, b.turnstileToken, username);
    if (gate) return gate;
  }

  const row = await D(c).prepare('SELECT * FROM users WHERE username = ?').bind(username).first<any>();
  const ok = row ? await verifyPassword(String(b.pass || ''), row.pass_hash, row.pass_salt) : false;
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
    const ok = await verifyPassword(String(b.current || ''), u.pass_hash as any, u.pass_salt as any);
    if (!ok) return err('Hazırkı şifrə yanlışdır.', 403, 'invalid_password');
  }
  if (typeof b.next !== 'string' || b.next.length < 6) return badReq('Yeni şifrə minimum 6 simvol.');
  const { hash, salt } = await hashPassword(b.next);
  await D(c).prepare(
    'UPDATE users SET pass_hash = ?, pass_salt = ?, must_reset_password = 0, has_password = 1 WHERE id = ?',
  ).bind(hash, salt, u.id).run();
  // Parol dəyişməsi BÜTÜN digər cihazları çıxarır. Parolun dəyişməsinin əsas
  // səbəbi "kimsə hesabıma girib" şübhəsidir — köhnə sessiyalar canlı qalsaydı
  // parol dəyişmək təhlükəni aradan qaldırmazdı. Cari cihaz saxlanılır.
  await revokeAllSessions(c.env, u.id, 'password', c.sid);
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
    const ok = await verifyPassword(String(b.current || ''), u.pass_hash as any, u.pass_salt as any);
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
    const ok = await verifyPassword(String(b.pass || ''), u.pass_hash as any, u.pass_salt as any);
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
  await Promise.all(keys.slice(0, 100).map(k => c.env.FILES.delete(k).catch(() => {})));
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
    // security_events-də uid boşaldılır, SƏTİR SAXLANILIR: hadisələr təhlükəsizlik
    // telemetriyasıdır (hansı IP-dən neçə uğursuz giriş oldu) və şəxsi məlumat
    // çıxarıldıqdan sonra artıq həmin istifadəçiyə aid deyil. Silinsəydi, hesabı
    // silərək öz izini təmizləyən hücumçu monitorinqi kor edərdi.
    D(c).prepare('UPDATE security_events SET uid = NULL, username = \'\' WHERE uid = ?').bind(u.id),
    D(c).prepare('DELETE FROM users WHERE id = ?').bind(u.id),
  ]);
  await destroyAllSessions(c.env, u.id);
  return withCookies(json({ ok: true }), clearCookies());
}

/* ================= USERS / PROFİL ================= */
export async function listUsers(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM users ORDER BY joined_at DESC LIMIT 500').all<any>();
  return json({ users: rows.results.map(r => mapUser(r)) });
}

/* ---------- İstifadəçi kataloqu (TASK-6 / İstifadəçilər#5) ----------
   listUsers() qlobal identifikasiya keşidir (post müəllifi, DM, mention) və
   OLDUĞU KİMİ qalır. Bu isə İstifadəçilər səhifəsinin sorğusudur: D1-də
   sıralama + filtr + keyset pagination (0006-dakı kompozit index-lər).      */

// sort açarı → [SQL sütunu, istiqamət]. Ağ siyahı: dəyər birbaşa SQL-ə düşdüyü
// üçün istifadəçi girişi HEÇ VAXT buraya keçmir (injection qapısı bağlıdır).
const DIR_SORTS: Record<string, [string, 'ASC' | 'DESC']> = {
  recent: ['joined_at', 'DESC'],      // default — ən yeni qoşulanlar
  xp: ['xp', 'DESC'],
  active: ['last_active_at', 'DESC'],
  alpha: ['username', 'ASC'],
};
const DIR_PAGE = 24;

export async function usersDirectory(c: Ctx) {
  const u = new URL(c.req.url).searchParams;
  const sortKey = u.get('sort') || 'recent';
  const [col, dir] = DIR_SORTS[sortKey] || DIR_SORTS.recent;

  const where: string[] = ['blocked = 0', 'id != ?'];
  const vals: unknown[] = [c.user!.id];

  // Mətn axtarışı — ad / istifadəçi adı üzrə.
  // ⚠ Hər `LIKE`-da `ESCAPE '\'` MƏCBURİDİR — dəyərlərdə `_`/`%` escape olunur,
  // amma ESCAPE bəyan edilməsə SQLite `\_`-i "\ + istənilən simvol" sayır və
  // `_` olan adlar (bütün `e2e_*` hesablar) tapılmır (adminUsersList-dəki eyni buq).
  const q = (u.get('q') || '').trim().toLowerCase();
  if (q) {
    where.push("(lower(name) LIKE ? ESCAPE '\\' OR lower(username) LIKE ? ESCAPE '\\')");
    const like = '%' + q.replace(/[%_\\]/g, ch => '\\' + ch) + '%';
    vals.push(like, like);
  }

  // Skill/səviyyə/məqsəd JSON sütunlarındadır (prog_levels, lang_levels,
  // looking_for). D1-də json_extract var, amma açar adı dinamikdir → LIKE ilə
  // ilkin daraltma edib dəqiq yoxlamanı JS-də aparırıq (aşağıda).
  const skill = (u.get('skill') || '').trim();
  if (skill) {
    where.push("(prog_levels LIKE ? ESCAPE '\\' OR lang_levels LIKE ? ESCAPE '\\')");
    const key = '%"' + skill.replace(/[%_\\]/g, ch => '\\' + ch) + '"%';
    vals.push(key, key);
  }
  const looking = (u.get('looking') || '').trim();
  if (looking) {
    where.push("looking_for LIKE ? ESCAPE '\\'");
    vals.push('%"' + looking.replace(/[%_\\]/g, ch => '\\' + ch) + '"%');
  }
  if (u.get('extra') === 'verified') where.push('verified = 1');

  // Keyset (cursor): "<sortDəyəri>|<id>". OFFSET-dən fərqli olaraq dərin
  // səhifələrdə də sabit sürətlidir və sətir sürüşməsi baş vermir.
  // `username` mətn, qalan sıra sütunları INTEGER-dir — cursor dəyəri URL-dən
  // həmişə string gəldiyi üçün rəqəm sütunlarında Number-ə çevrilir, əks halda
  // SQLite mətn müqayisəsi edərdi ("9" > "10").
  const numericSort = col !== 'username';
  const cursor = u.get('cursor');
  if (cursor) {
    const i = cursor.lastIndexOf('|');
    if (i > 0) {
      const rawVal = cursor.slice(0, i);
      const cid = cursor.slice(i + 1);
      const cv: string | number = numericSort ? Number(rawVal) : rawVal;
      if (!(numericSort && Number.isNaN(cv as number))) {
        const cmp = dir === 'DESC' ? '<' : '>';
        where.push(`(${col} ${cmp} ? OR (${col} = ? AND id > ?))`);
        vals.push(cv, cv, cid);
      }
    }
  }

  const limit = Math.min(Math.max(parseInt(u.get('limit') || '', 10) || DIR_PAGE, 1), 60);
  // limit+1 çəkirik: əlavə sətir gəlirsə daha səhifə var deməkdir.
  const sql =
    `SELECT * FROM users WHERE ${where.join(' AND ')} ` +
    `ORDER BY ${col} ${dir}, id ASC LIMIT ?`;
  const rows = await D(c).prepare(sql).bind(...vals, limit + 1).all<any>();

  // Cursor SQL nəticəsindən hesablanır — aşağıdakı JS süzgəcindən ƏVVƏL.
  // Əks halda süzgəcin atdığı sətrlər növbəti səhifədə təkrar sorğulanardı.
  const hasMore = rows.results.length > limit;
  const pageRows = hasMore ? rows.results.slice(0, limit) : rows.results;
  const lastRow = pageRows[pageRows.length - 1] as any;
  const nextCursor = hasMore && lastRow ? `${lastRow[col]}|${lastRow.id}` : null;

  let list = pageRows.map(r => mapUser(r));

  // Dəqiq skill/səviyyə süzgəci: LIKE yalnız açarın mətndə olmasını yoxlayır
  // (məs. "Java" sorğusu "JavaScript"-ə də uyğun gəlir), burada isə həqiqətən
  // həmin skill-in — və istənilirsə səviyyəsinin — olması təsdiqlənir.
  // ⚠ Nəticədə səhifə `limit`-dən az element qaytara bilər; müştəri
  // `nextCursor` null olana qədər yükləməyə davam edir.
  const level = (u.get('level') || '').trim();
  if (skill || level) {
    list = list.filter((x: any) => {
      const all = { ...(x.progLevels || {}), ...(x.langLevels || {}) };
      if (skill && !(skill in all)) return false;
      if (level) {
        if (skill) return all[skill] === level;
        return Object.values(all).includes(level);
      }
      return true;
    });
  }

  return json({ users: list, nextCursor });
}

const SELF_FIELDS: Record<string, [string, number]> = {
  name: ['name', 60], bio: ['bio', 400], birthDate: ['birth_date', 10], gender: ['gender', 10],
  country: ['country', 40], city: ['city', 40], goals: ['goals', 300],
  instagram: ['instagram', 40], github: ['github', 40], linkedin: ['linkedin', 60],
  telegram: ['telegram', 40], website: ['website', 100], contactEmail: ['contact_email', 120],
  photoURL: ['photo_url', 300], lastActiveDay: ['last_active_day', 10],
  activeProjectId: ['active_project_id', 36],
};
export async function patchMe(c: Ctx) {
  const b = await readJson(c.req);
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, [col, max]] of Object.entries(SELF_FIELDS)) {
    if (k in b) { sets.push(`${col} = ?`); vals.push(b[k] === null ? null : clampStr(b[k], max)); }
  }
  if ('showProjectOnProfile' in b) {
    sets.push('show_project_on_profile = ?');
    vals.push(b.showProjectOnProfile ? 1 : 0);
  }
  for (const k of ['progLevels', 'langLevels', 'lookingFor', 'activityDays'] as const) {
    if (k in b) {
      const col = { progLevels: 'prog_levels', langLevels: 'lang_levels', lookingFor: 'looking_for', activityDays: 'activity_days' }[k];
      sets.push(`${col} = ?`);
      vals.push(toJSON(b[k], k === 'lookingFor' ? '[]' : '{}'));
    }
  }
  if ('age' in b) { sets.push('age = ?'); vals.push(parseInt(b.age, 10) || 18); }
  if ('streak' in b) { sets.push('streak = ?'); vals.push(parseInt(b.streak, 10) || 0); }
  if ('mustResetPassword' in b && b.mustResetPassword === false) sets.push('must_reset_password = 0');
  if (!sets.length) return badReq('Dəyişiklik yoxdur.');
  vals.push(c.user!.id);
  await D(c).prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  let fresh = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(c.user!.id).first<any>();

  // TASK-8 / Bənd 6 — profil tamamlama bonusu (bir dəfə, +20 XP).
  //
  // Tamlıq SERVERDƏ hesablanır: client-ə güvənsək istifadəçi öz-özünə XP
  // "hədiyyə" edə bilərdi. Verildi-verilmədi `settings.profileBonusGiven`
  // bayrağı ilə izlənilir — idempotent, təkrar verilmir.
  const gaveBonus = await maybeProfileBonus(c, fresh);
  if (gaveBonus) fresh = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(c.user!.id).first<any>();

  return json({ user: mapUser(fresh, true), bonusGiven: gaveBonus });
}

const PROFILE_BONUS_XP = 20;
// Bənd 6-dakı tamlıq sahələri — `js/completeness.js` ilə EYNİ məntiq.
// İki tərəf ayrılsa client bir faiz, server başqa faiz göstərər.
function isProfileComplete(u: any): boolean {
  const prog = fromJSON<Record<string, unknown>>(u.prog_levels, {});
  const langs = fromJSON<Record<string, unknown>>(u.lang_levels, {});
  const looking = fromJSON<unknown[]>(u.looking_for, []);
  return !!u.photo_url
    && (u.bio || '').trim().length >= 10
    && (u.goals || '').trim().length >= 5
    && Object.keys(prog).length > 0
    && Object.keys(langs).length > 0
    && looking.length > 0
    && !!(u.city || '').trim()
    && !!(u.github || u.linkedin || u.instagram || u.telegram || u.website);
}

async function maybeProfileBonus(c: Ctx, u: any): Promise<boolean> {
  const settings = fromJSON<any>(u.settings, {});
  if (settings.profileBonusGiven) return false;
  if (!isProfileComplete(u)) return false;

  settings.profileBonusGiven = true;
  await D(c).prepare('UPDATE users SET xp = xp + ?, settings = ? WHERE id = ?')
    .bind(PROFILE_BONUS_XP, JSON.stringify(settings), u.id).run();
  return true;
}

export async function patchSettings(c: Ctx) {
  const b = await readJson(c.req);
  const cur = fromJSON<any>(c.user!.settings as any, {});
  const merged = {
    ...cur, ...b,
    privacy: { ...(cur.privacy || {}), ...(b.privacy || {}) },
    notifications: { ...(cur.notifications || {}), ...(b.notifications || {}) },
  };
  await D(c).prepare('UPDATE users SET settings = ? WHERE id = ?')
    .bind(JSON.stringify(merged), c.user!.id).run();
  return json({ settings: merged });
}

export async function mySocial(c: Ctx) {
  const uid = c.user!.id;
  const [likes, bms, fing, fers, shares] = await D(c).batch([
    D(c).prepare('SELECT post_id FROM likes WHERE user_id = ?').bind(uid),
    D(c).prepare('SELECT post_id FROM bookmarks WHERE user_id = ?').bind(uid),
    D(c).prepare('SELECT target_id FROM follows WHERE follower_id = ?').bind(uid),
    D(c).prepare('SELECT follower_id FROM follows WHERE target_id = ?').bind(uid),
    // Re-post toggle vəziyyəti: müştəri əvvəl bunu yalnız feed pəncərəsindən
    // çıxarırdı və pəncərədən kənar re-post-lar itirdi (TASK-7 / Bənd 4).
    D(c).prepare('SELECT post_id FROM post_shares WHERE user_id = ?').bind(uid),
  ]);
  return json({
    likes: (likes.results as any[]).map(r => r.post_id),
    bookmarks: (bms.results as any[]).map(r => r.post_id),
    following: (fing.results as any[]).map(r => r.target_id),
    followers: (fers.results as any[]).map(r => r.follower_id),
    reposts: (shares.results as any[]).map(r => r.post_id),
  });
}

export async function followLists(c: Ctx, uid: string) {
  const kind = c.url.searchParams.get('kind') === 'followers' ? 'followers' : 'following';
  if (uid !== c.user!.id && !c.isAdmin && kind === 'following') {
    const target = await D(c).prepare('SELECT settings FROM users WHERE id = ?').bind(uid).first<any>();
    const priv = fromJSON<any>(target?.settings, {})?.privacy || {};
    if (priv.showFollowing === false) return err('Bu siyahı gizlidir.', 403, 'forbidden');
  }
  const q = kind === 'followers'
    ? 'SELECT follower_id AS u FROM follows WHERE target_id = ?'
    : 'SELECT target_id AS u FROM follows WHERE follower_id = ?';
  const rows = await D(c).prepare(q).bind(uid).all<any>();
  return json({ uids: rows.results.map(r => r.u) });
}

export async function followPut(c: Ctx, uid: string) {
  if (uid === c.user!.id) return badReq('Özünü izləyə bilməzsən.');
  await D(c).prepare('INSERT OR IGNORE INTO follows (follower_id, target_id, created_at) VALUES (?,?,?)')
    .bind(c.user!.id, uid, now()).run();
  await notify(c, uid, 'follow', 'səni izləməyə başladı');
  return json({ ok: true });
}
export async function followDelete(c: Ctx, uid: string) {
  await D(c).prepare('DELETE FROM follows WHERE follower_id = ? AND target_id = ?').bind(c.user!.id, uid).run();
  return json({ ok: true });
}

export async function progressOf(c: Ctx, uid: string) {
  const rows = await D(c).prepare('SELECT * FROM progress WHERE user_id = ?').bind(uid).all<any>();
  const out: Record<string, any> = {};
  rows.results.forEach(r => { out[r.field] = { posts: r.posts, tasks: r.tasks, xp: r.xp }; });
  return json({ progress: out });
}

/* ================= POSTS ================= */
/**
 * AUDIT M-10 — bloklanmış istifadəçinin postları feed-də QALIRDI, halbuki
 * `publicGetPost` onları 404 ilə gizlədirdi. Daxili ziddiyyət: eyni post
 * birbaşa linkdə "yoxdur", feed-də isə görünürdü.
 * `JOIN users … WHERE blocked = 0` hər iki yolu eyniləşdirir.
 * (İndeks: `idx_users_blocked` — bax D-4.)
 */
export async function feed(c: Ctx) {
  const query = `
    SELECT p.*,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    JOIN users u ON p.author_id = u.id
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE u.blocked = 0
    ORDER BY p.created_at DESC LIMIT 60
  `;
  const rows = await D(c).prepare(query).all<any>();
  return json({ posts: rows.results.map(mapPost) });
}

export async function getPost(c: Ctx, id: string) {
  const query = `
    SELECT p.*,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE p.id = ?
  `;
  const row = await D(c).prepare(query).bind(id).first();
  if (!row) return err('Post tapılmadı.', 404);
  return json({ post: mapPost(row) });
}

export async function createPost(c: Ctx) {
  const b = await readJson(c.req);
  // AUDIT M-5 — `blocks` JSON-u ölçü limiti OLMADAN saxlanılırdı: blok sayı
  // 20-yə kəsilirdi, lakin BİR blokun məzmunu istənilən uzunluqda ola bilərdi
  // → D1 sətrinin şişməsi, storage DoS.
  //
  // İki qatlı tavan: hər blok üçün 5000 simvol, sonra ÜMUMİ JSON üçün 64 KB.
  // Ümumi tavan blok sayına deyil, `JSON.stringify(...).length`-ə baxır —
  // 20 × 5000 = 100 KB hələ də D1 sətri üçün çoxdur.
  const blocks = Array.isArray(b.blocks)
    ? b.blocks.slice(0, 20).map((blk: any) => (
      blk && typeof blk === 'object' && typeof blk.content === 'string'
        ? { ...blk, content: clampStr(blk.content, 5000) }
        : blk
    ))
    : [];
  if (JSON.stringify(blocks).length > POST_BLOCKS_MAX_BYTES) {
    return err('Post həddindən artıq böyükdür.', 400, 'payload_too_large');
  }
  let sharedPostId = b.sharedPostId ? clampStr(b.sharedPostId, 50) : null;
  if (sharedPostId) {
    // İçiçə re-postların qarşısını al: hədəf özü də re-post-dursa, ən orijinal posta düzəlt (flatten-to-root).
    const target = await D(c).prepare('SELECT shared_post_id FROM posts WHERE id = ?').bind(sharedPostId).first<any>();
    if (!target) return err('Orijinal post tapılmadı.', 404);
    if (target?.shared_post_id) sharedPostId = target.shared_post_id;
  }
  // Birbaşa re-post (mətnsiz) artıq toggle endpoint-dən keçir → burada yalnız quote (öz mətni ilə).
  if (sharedPostId && !blocks.length) return badReq('Birbaşa re-post üçün /repost istifadə edin.');
  if (!blocks.length && !sharedPostId) return badReq('Post boş ola bilməz.');
  const postType = sharedPostId ? 'quote' : 'original';
  const tags: string[] = Array.isArray(b.tags) ? b.tags.slice(0, 12).map((t: unknown) => clampStr(t, 30)) : [];
  const firstText = (blocks.find((x: any) => x.type === 'text') || {}).content || '';
  const quoteText = postType === 'quote' ? clampStr(firstText, 500) : null;
  const id = uuid();
  await D(c).prepare(
    'INSERT INTO posts (id, author_id, author_name, blocks, image_keys, text, tags, created_at, shared_post_id, post_type, quote_text) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
  ).bind(id, c.user!.id, c.user!.name, JSON.stringify(blocks),
    toJSON(b.imageKeys, '[]'), clampStr(firstText, 300), JSON.stringify(tags), now(), sharedPostId, postType, quoteText).run();
  await D(c).prepare('UPDATE users SET xp = xp + 10 WHERE id = ?').bind(c.user!.id).run();
  await bumpActivity(c);
  for (const t of tags) await bumpProgress(c, c.user!.id, t, 'posts');
  // ⚡ FAN-OUT NÖVBƏYƏ (TASK-8 / Bənd 18).
  //
  // Əvvəl @mention bildirişləri MƏHZ BURADA, sorğunun içində göndərilirdi:
  // 20 nəfər qeyd edilmiş postda 20+ ardıcıl D1 yazısı — istifadəçi "Paylaş"
  // düyməsindən sonra hamısını gözləyirdi. İndi post yazılan kimi cavab
  // qayıdır, bildirişlər isə arxada işlənir.
  //
  // `enqueue` növbə yoxdursa işi SİNXRON icra edir → funksionallıq itmir.
  const mentionText = blocks.map((x: any) => x.content || '').join(' ');
  const queueService = new QueueService(c.env);
  c.ctx.waitUntil(Promise.all([
    queueService.publish({
      type: 'MentionFanout', fromId: c.user!.id, fromName: c.user!.name,
      text: mentionText, label: 'səni paylaşımda qeyd etdi', postId: id,
    }),
    queueService.publish({
      type: 'PostCreated', postId: id, authorId: c.user!.id,
      authorName: c.user!.name, text: clampStr(mentionText, 120),
    }),
  ]));

  if (sharedPostId) {
    await D(c).prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').bind(sharedPostId).run();
    const orig = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(sharedPostId).first<any>();
    if (orig) await notify(c, orig.author_id, 'repost', 'paylaşımını sitat gətirdi', sharedPostId);
  }

  const query = `
    SELECT p.*,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE p.id = ?
  `;
  const row = await D(c).prepare(query).bind(id).first();
  return json({ post: mapPost(row) });
}

export async function patchPost(c: Ctx, id: string) {
  const row = await D(c).prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>();
  if (!row) return err('Post tapılmadı.', 404);
  if (row.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const b = await readJson(c.req);
  const blocks = Array.isArray(b.blocks) ? b.blocks.slice(0, 20) : fromJSON(row.blocks, []);
  const firstText = (blocks.find((x: any) => x.type === 'text') || {}).content || b.text || '';
  await D(c).prepare('UPDATE posts SET blocks = ?, text = ?, edited_at = ? WHERE id = ?')
    .bind(JSON.stringify(blocks), clampStr(firstText, 300), now(), id).run();
  return json({ ok: true });
}

export async function deletePost(c: Ctx, id: string) {
  const row = await D(c).prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>();
  // ⚠ Tapılmayanda 404 qaytarılır, `{ok:true}` DEYİL. Səssiz 200 real bir bug-ı
  // gizlədirdi: müştəri `/api/posts/undefined`-ə sorğu göndərirdi, server "oldu"
  // deyirdi, UI "silindi" toast-ı göstərirdi, post isə yerində qalırdı
  // (TASK-7 / Bənd 1). İdempotentlik müştəri tərəfdə saxlanılır: 404 = "artıq yoxdur".
  if (!row) return err('Post tapılmadı.', 404);
  if (row.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const keys = fromJSON<string[]>(row.image_keys, []);
  await Promise.all(keys.slice(0, 30).map(k => c.env.FILES.delete(k).catch(() => {})));
  // Cascade (Cloud-Function trigger ekvivalenti), atomik batch. D1-də
  // `PRAGMA foreign_keys` zəmanətli deyil, `bookmarks`/`notifications`-da isə
  // FK ümumiyyətlə yoxdur — ona görə asılılar burada AÇIQ təmizlənir.
  const stmts = [
    D(c).prepare('DELETE FROM posts WHERE id = ?').bind(id),
    // orijinal müəllifin öz postu → ona istinad edən repost/quote-lar "silinib"
    // soft-mark olunur (quote öz mətnini saxlayır).
    D(c).prepare('UPDATE posts SET original_deleted = 1 WHERE shared_post_id = ?').bind(id),
    D(c).prepare('DELETE FROM post_shares WHERE post_id = ? OR repost_id = ?').bind(id, id),
    D(c).prepare('DELETE FROM comments WHERE post_id = ?').bind(id),
    D(c).prepare('DELETE FROM likes WHERE post_id = ?').bind(id),
    D(c).prepare('DELETE FROM bookmarks WHERE post_id = ?').bind(id),
    D(c).prepare('DELETE FROM notifications WHERE post_id = ?').bind(id),
  ];
  if (row.shared_post_id) {
    stmts.push(D(c).prepare('UPDATE posts SET share_count = MAX(0, share_count - 1) WHERE id = ?').bind(row.shared_post_id));
  }
  await D(c).batch(stmts);
  return json({ ok: true });
}

// Birbaşa re-post — idempotent toggle (repost / undo-repost). Cloud-Function trigger yerinə
// share_count-u atomik batch-də saxlayır; post_shares kompozit-PK ilə dublikat qarşılanmır.
export async function toggleRepost(c: Ctx, id: string) {
  const target = await D(c).prepare('SELECT id, author_id, shared_post_id FROM posts WHERE id = ?').bind(id).first<any>();
  if (!target) return err('Post tapılmadı.', 404);
  // flatten-to-root: re-post-un re-post-u həmişə kök orijinala istinad edir
  const rootId = target.shared_post_id || id;
  const root = target.shared_post_id
    ? await D(c).prepare('SELECT id, author_id FROM posts WHERE id = ?').bind(rootId).first<any>()
    : target;
  if (!root) return err('Post tapılmadı.', 404);
  if (root.author_id === c.user!.id) return err('Öz paylaşımını re-post edə bilməzsən.', 400);

  const existing = await D(c).prepare('SELECT repost_id FROM post_shares WHERE user_id = ? AND post_id = ?')
    .bind(c.user!.id, rootId).first<any>();
  if (existing) {
    // undo-repost
    await D(c).batch([
      D(c).prepare('DELETE FROM posts WHERE id = ?').bind(existing.repost_id),
      D(c).prepare('DELETE FROM post_shares WHERE user_id = ? AND post_id = ?').bind(c.user!.id, rootId),
      D(c).prepare('UPDATE posts SET share_count = MAX(0, share_count - 1) WHERE id = ?').bind(rootId),
    ]);
    return json({ reposted: false });
  }
  const newId = uuid();
  await D(c).batch([
    D(c).prepare('INSERT INTO posts (id, author_id, author_name, blocks, image_keys, text, tags, created_at, shared_post_id, post_type) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(newId, c.user!.id, c.user!.name, '[]', '[]', '', '[]', now(), rootId, 'repost'),
    D(c).prepare('INSERT INTO post_shares (user_id, post_id, repost_id, created_at) VALUES (?,?,?,?)')
      .bind(c.user!.id, rootId, newId, now()),
    D(c).prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').bind(rootId),
  ]);
  await notify(c, root.author_id, 'repost', 'paylaşımını re-post etdi', rootId);
  return json({ reposted: true, id: newId });
}

export async function likePut(c: Ctx, id: string) {
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(id).first<any>();
  if (!post) return err('Post tapılmadı.', 404);
  const r = await D(c).prepare('INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?,?,?)')
    .bind(id, c.user!.id, now()).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').bind(id).run();
    await notify(c, post.author_id, 'like', 'paylaşımını bəyəndi', id);
  }
  return json({ ok: true });
}
export async function likeDelete(c: Ctx, id: string) {
  const r = await D(c).prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').bind(id, c.user!.id).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(id).run();
  }
  return json({ ok: true });
}

export async function bookmarkPut(c: Ctx, id: string) {
  await D(c).prepare('INSERT OR IGNORE INTO bookmarks (user_id, post_id, created_at) VALUES (?,?,?)')
    .bind(c.user!.id, id, now()).run();
  return json({ ok: true });
}
export async function bookmarkDelete(c: Ctx, id: string) {
  await D(c).prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').bind(c.user!.id, id).run();
  return json({ ok: true });
}

// LinkedIn üslublu rəylər (TASK-7 / Bənd 8): üst səviyyə rəylər + bir səviyyəli
// cavablar (thread), rəyə bəyənmə, sıralama (ən yeni / ən çox bəyənilən), limit ilə
// "daha çox yüklə". Polling ilə uzlaşsın deyə səhifələmə `limit`-lə aparılır: müştəri
// cari limit-i saxlayır, "daha çox" onu artırır, hər poll cari limit-i gətirir.
const mapComment = (r: any, myLikes: Set<string>) => ({
  id: r.id, postId: r.post_id, parentId: r.parent_comment_id || null,
  authorUid: r.author_id, authorName: r.author_name, text: r.text,
  createdAt: r.created_at, editedAt: r.edited_at || null,
  likeCount: r.like_count || 0, likedByMe: myLikes.has(r.id),
});
export async function listComments(c: Ctx, postId: string) {
  const sort = c.url.searchParams.get('sort') === 'top' ? 'top' : 'new';
  const limit = Math.min(Math.max(parseInt(c.url.searchParams.get('limit') || '20', 10) || 20, 5), 200);
  // JOIN əlavə olunduğu üçün sütunlar açıq prefiksli olmalıdır (M-10).
  const order = sort === 'top' ? 'cm.like_count DESC, cm.created_at DESC' : 'cm.created_at DESC';
  // Üst səviyyə rəylər (limit+1 → daha çoxu var?).
  // M-10: bloklanmış müəllifin rəyləri gizlədilir (feed ilə eyni qayda).
  const topRows = await D(c).prepare(
    `SELECT cm.* FROM comments cm JOIN users u ON cm.author_id = u.id
      WHERE cm.post_id = ? AND cm.parent_comment_id IS NULL AND u.blocked = 0
      ORDER BY ${order} LIMIT ?`,
  ).bind(postId, limit + 1).all<any>();
  const hasMore = topRows.results.length > limit;
  const top = topRows.results.slice(0, limit);
  const topIds = top.map(r => r.id);
  // Yalnız yüklənmiş üst rəylərin cavabları (xronoloji).
  let replyRows: any[] = [];
  if (topIds.length) {
    const ph = topIds.map(() => '?').join(',');
    const rr = await D(c).prepare(
      `SELECT cm.* FROM comments cm JOIN users u ON cm.author_id = u.id
        WHERE cm.parent_comment_id IN (${ph}) AND u.blocked = 0
        ORDER BY cm.created_at ASC`,
    ).bind(...topIds).all<any>();
    replyRows = rr.results;
  }
  // Mənim bəyəndiyim rəylər (yalnız görünənlər üçün — bir sorğu).
  const allIds = [...topIds, ...replyRows.map(r => r.id)];
  let myLikes = new Set<string>();
  if (allIds.length) {
    const ph = allIds.map(() => '?').join(',');
    const lr = await D(c).prepare(
      `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${ph})`,
    ).bind(c.user!.id, ...allIds).all<any>();
    myLikes = new Set(lr.results.map(r => r.comment_id as string));
  }
  const replies: Record<string, any[]> = {};
  for (const r of replyRows) (replies[r.parent_comment_id] ||= []).push(mapComment(r, myLikes));
  const cnt = await D(c).prepare(
    'SELECT COUNT(*) AS n FROM comments WHERE post_id = ? AND parent_comment_id IS NULL',
  ).bind(postId).first<any>();
  return json({ comments: top.map(r => mapComment(r, myLikes)), replies, total: cnt?.n || 0, hasMore });
}
export async function addComment(c: Ctx, postId: string) {
  const b = await readJson(c.req);
  const text = clampStr(b.text, 1000).trim();
  if (!text) return badReq('Şərh boş ola bilməz.');
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first<any>();
  if (!post) return err('Post tapılmadı.', 404);

  // Bir səviyyə qaydası: cavaba cavab yazılırsa, kök üst rəyə düzlənir
  // (dərin cavablar eyni thread-də @mention ilə). replyToAuthor → cavab bildirişi.
  let parentId: string | null = null;
  let replyToAuthor: string | null = null;
  if (b.parentId) {
    const parent = await D(c).prepare('SELECT id, author_id, parent_comment_id FROM comments WHERE id = ? AND post_id = ?')
      .bind(clampStr(b.parentId, 40), postId).first<any>();
    if (parent) {
      parentId = parent.parent_comment_id || parent.id;   // flatten-to-root
      replyToAuthor = parent.author_id;
    }
  }
  const id = uuid();
  const ts = now();
  await D(c).prepare('INSERT INTO comments (id, post_id, author_id, author_name, text, created_at, parent_comment_id) VALUES (?,?,?,?,?,?,?)')
    .bind(id, postId, c.user!.id, c.user!.name, text, ts, parentId).run();
  await D(c).batch([
    D(c).prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').bind(postId),
    D(c).prepare('UPDATE users SET xp = xp + 5 WHERE id = ?').bind(c.user!.id),
  ]);
  if (parentId && replyToAuthor) await notify(c, replyToAuthor, 'comment', 'şərhinə cavab yazdı', postId);
  else await notify(c, post.author_id, 'comment', 'paylaşımına şərh yazdı', postId);
  await notifyMentions(c, text, 'səni şərhdə qeyd etdi', postId);
  return json({ ok: true, id, createdAt: ts, parentId });
}
export async function editComment(c: Ctx, postId: string, cid: string) {
  const b = await readJson(c.req);
  const text = clampStr(b.text, 1000).trim();
  if (!text) return badReq('Şərh boş ola bilməz.');
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return err('Şərh tapılmadı.', 404);
  if (row.author_id !== c.user!.id) return err('İcazə yoxdur.', 403, 'forbidden');   // redaktə yalnız müəllif
  await D(c).prepare('UPDATE comments SET text = ?, edited_at = ? WHERE id = ?').bind(text, now(), cid).run();
  return json({ ok: true });
}
export async function deleteComment(c: Ctx, postId: string, cid: string) {
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return json({ ok: true });
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first<any>();
  const allowed = row.author_id === c.user!.id || c.isAdmin || post?.author_id === c.user!.id;
  if (!allowed) return err('İcazə yoxdur.', 403, 'forbidden');
  // Cascade sil: rəy + bütün cavabları (dərinlik 1 olduğu üçün birbaşa uşaqlar tamdır) + reaksiyalar.
  const kids = await D(c).prepare('SELECT id FROM comments WHERE parent_comment_id = ?').bind(cid).all<any>();
  const ids = [cid, ...kids.results.map(r => r.id as string)];
  const ph = ids.map(() => '?').join(',');
  await D(c).batch([
    D(c).prepare(`DELETE FROM comments WHERE id IN (${ph})`).bind(...ids),
    D(c).prepare(`DELETE FROM comment_likes WHERE comment_id IN (${ph})`).bind(...ids),
    D(c).prepare('UPDATE posts SET comment_count = MAX(0, comment_count - ?) WHERE id = ?').bind(ids.length, postId),
  ]);
  return json({ ok: true });
}
export async function commentLikePut(c: Ctx, postId: string, cid: string) {
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return err('Şərh tapılmadı.', 404);
  const r = await D(c).prepare('INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at) VALUES (?,?,?)')
    .bind(cid, c.user!.id, now()).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE comments SET like_count = like_count + 1 WHERE id = ?').bind(cid).run();
    await notify(c, row.author_id, 'like', 'şərhini bəyəndi', postId);
  }
  return json({ ok: true });
}
export async function commentLikeDelete(c: Ctx, _postId: string, cid: string) {
  const r = await D(c).prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').bind(cid, c.user!.id).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(cid).run();
  }
  return json({ ok: true });
}

/* ================= ROOMS ================= */
export async function listRooms(c: Ctx) {
  // TASK-11: komanda otaqları (`team_chat_rooms`) qlobal `rooms` cədvəlini
  // paylaşır — RoomDO və mesaj API-si tək modeldən işləsin deyə. Amma onlar
  // QLOBAL söhbət siyahısında görünməməlidir: hər komanda 5 otaqla gəlir və
  // siyahı tanımadığı otaqlarla dolardı (üstəlik ad sızıntısı olardı).
  const rows = await D(c).prepare(
    `SELECT r.* FROM rooms r
      WHERE NOT EXISTS (SELECT 1 FROM team_chat_rooms t WHERE t.id = r.id)
      ORDER BY r.created_at ASC`
  ).all<any>();
  return json({ rooms: rows.results.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at })) });
}
export async function createRoom(c: Ctx) {
  const b = await readJson(c.req);
  const name = clampStr(b.name, 40).trim();
  if (!name) return badReq('Ad boşdur.');
  await D(c).prepare('INSERT INTO rooms (id, name, created_by, created_at) VALUES (?,?,?,?)')
    .bind(uuid(), name, c.user!.id, now()).run();
  return json({ ok: true });
}
export async function deleteRoom(c: Ctx, id: string) {
  if (id === 'general') return badReq('Ümumi otaq silinə bilməz.');
  await D(c).prepare('DELETE FROM rooms WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

const MSG_COLS = '(id, room_id, author_id, author_name, type, text, file_key, file_name, file_size, mime_type, language, created_at)';

/**
 * TASK-11 — komanda otağı qapısı.
 *
 * `team_chat_rooms` qlobal `rooms` cədvəlini paylaşır, ona görə otaq id-si
 * bilinən hər kəs komandanın MƏXFİ söhbətini oxuya/yaza bilərdi. Otaq hansısa
 * komandaya aiddirsə, sorğu sahibi həmin komandanın aktiv üzvü olmalıdır.
 * Komandaya aid olmayan otaqlar (qlobal söhbət) toxunulmaz qalır.
 */
export async function guardTeamRoom(c: Ctx, roomId: string): Promise<Response | null> {
  const room = await D(c).prepare('SELECT team_id FROM team_chat_rooms WHERE id = ?').bind(roomId).first<any>();
  if (!room) return null;                       // qlobal otaq
  if (c.isAdmin) return null;
  const member = await D(c).prepare(
    "SELECT 1 AS x FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'",
  ).bind(room.team_id, c.user!.id).first<any>();
  return member ? null : err('Bu otaq komandaya aiddir — üzv deyilsiniz.', 403, 'forbidden');
}

export async function roomMessages(c: Ctx, roomId: string) {
  const denied = await guardTeamRoom(c, roomId);
  if (denied) return denied;

  const rows = await D(c).prepare(
    'SELECT * FROM (SELECT * FROM room_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 120) ORDER BY created_at ASC',
  ).bind(roomId).all<any>();
  return json({ messages: rows.results.map(r => mapMsg(r)) });
}
export async function sendRoomMessage(c: Ctx, roomId: string) {
  const denied = await guardTeamRoom(c, roomId);
  if (denied) return denied;

  const b = await readJson(c.req);
  const m = sanitizeMsg(b);
  if (!m) return badReq('Mesaj boşdur.');
  await D(c).prepare(`INSERT INTO room_messages ${MSG_COLS} VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uuid(), roomId, c.user!.id, c.user!.name, m.type, m.text, m.fileKey, m.fileName, m.fileSize, m.mimeType, m.language, now()).run();
  await bumpActivity(c);
  if (m.text) await notifyMentions(c, m.text, 'səni otaqda qeyd etdi');
  await roomBroadcast(c, roomId, { t: 'refresh' });
  return json({ ok: true });
}
export async function editRoomMessage(c: Ctx, roomId: string, mid: string) {
  const b = await readJson(c.req);
  const row = await D(c).prepare('SELECT author_id FROM room_messages WHERE id = ?').bind(mid).first<any>();
  if (!row) return err('Tapılmadı.', 404);
  if (row.author_id !== c.user!.id) return err('İcazə yoxdur.', 403, 'forbidden');
  await D(c).prepare('UPDATE room_messages SET text = ?, edited_at = ? WHERE id = ?')
    .bind(clampStr(b.text, 8000), now(), mid).run();
  await roomBroadcast(c, roomId, { t: 'refresh' });
  return json({ ok: true });
}
export async function deleteRoomMessage(c: Ctx, roomId: string, mid: string) {
  const row = await D(c).prepare('SELECT author_id, file_key FROM room_messages WHERE id = ?').bind(mid).first<any>();
  if (!row) return json({ ok: true });
  if (row.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  if (row.file_key) await c.env.FILES.delete(row.file_key).catch(() => {});
  await D(c).prepare('DELETE FROM room_messages WHERE id = ?').bind(mid).run();
  await roomBroadcast(c, roomId, { t: 'refresh' });
  return json({ ok: true });
}

// `sanitizeMsg` PAYLAŞILAN `./msg` modulundadır — REST və WebSocket (RoomDO)
// yolları eyni qaydaları işlətməlidir. Bax msg.ts-dəki izah.

/* ================= DM ================= */
export async function listThreads(c: Ctx) {
  const uid = c.user!.id;
  const rows = await D(c).prepare(
    'SELECT * FROM dm_threads WHERE user_a = ? OR user_b = ? ORDER BY last_at DESC LIMIT 100',
  ).bind(uid, uid).all<any>();
  return json({
    threads: rows.results.map(r => ({
      id: r.pair_id, users: [r.user_a, r.user_b],
      lastMsg: r.last_msg, lastFrom: r.last_from, lastAt: r.last_at,
      readAt: { [r.user_a]: r.read_a, [r.user_b]: r.read_b },
    })),
  });
}

export async function dmMessages(c: Ctx, pairId: string) {
  if (!pairId.split('_').includes(c.user!.id)) return err('İcazə yoxdur.', 403, 'forbidden');
  const rows = await D(c).prepare(
    'SELECT * FROM (SELECT * FROM dm_messages WHERE pair_id = ? ORDER BY created_at DESC LIMIT 150) ORDER BY created_at ASC',
  ).bind(pairId).all<any>();
  return json({ messages: rows.results.map(r => mapMsg(r, true)) });
}

export async function sendDM(c: Ctx, toUid: string) {
  const me = c.user!;
  if (toUid === me.id) return badReq('Özünə DM göndərə bilməzsən.');
  const target = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(toUid).first<any>();
  if (!target || target.blocked) return err('İstifadəçi tapılmadı.', 404);

  // whoCanMessage siyasəti (server tərəfdə məcburi)
  const pol = fromJSON<any>(target.settings, {})?.privacy?.whoCanMessage || 'everyone';
  if (pol !== 'everyone' && !c.isAdmin) {
    const theyFollowMe = await D(c).prepare('SELECT 1 FROM follows WHERE follower_id = ? AND target_id = ?')
      .bind(toUid, me.id).first();
    if (!theyFollowMe) return err('Bu istifadəçi yalnız izlədiyi şəxslərdən mesaj qəbul edir.', 403, 'forbidden');
    if (pol === 'mutual') {
      const iFollow = await D(c).prepare('SELECT 1 FROM follows WHERE follower_id = ? AND target_id = ?')
        .bind(me.id, toUid).first();
      if (!iFollow) return err('Bu istifadəçi yalnız qarşılıqlı izləyənlərdən mesaj qəbul edir.', 403, 'forbidden');
    }
  }

  const b = await readJson(c.req);
  const m = sanitizeMsg(b);
  if (!m) return badReq('Mesaj boşdur.');
  const pairId = pairIdFor(me.id, toUid);
  const [a, bUid] = pairId.split('_');
  const preview = m.type === 'text' ? m.text.slice(0, 80)
    : m.type === 'image' ? '🖼 şəkil' : m.type === 'code' ? '</> kod' : '📎 ' + (m.fileName || 'fayl');
  const readCol = me.id === a ? 'read_a' : 'read_b';
  await D(c).batch([
    D(c).prepare(
      `INSERT INTO dm_threads (pair_id, user_a, user_b, last_msg, last_from, last_at, ${readCol}) VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(pair_id) DO UPDATE SET last_msg = ?, last_from = ?, last_at = ?, ${readCol} = ?`,
    ).bind(pairId, a, bUid, preview, me.id, now(), now(), preview, me.id, now(), now()),
    D(c).prepare(
      'INSERT INTO dm_messages (id, pair_id, from_id, to_id, type, text, file_key, file_name, file_size, mime_type, language, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    ).bind(uuid(), pairId, me.id, toUid, m.type, m.text, m.fileKey, m.fileName, m.fileSize, m.mimeType, m.language, now()),
  ]);
  await notify(c, toUid, 'dm', 'sənə mesaj yazdı');
  await dmPush(c, pairId);
  await bumpActivity(c);
  return json({ ok: true });
}

// DM dəyişikliyində (yeni / redaktə / sil) hər iki tərəfin açıq tablarına siqnal.
// Göndərənin özünə də gedir ki, digər tabları sinxron qalsın.
async function dmPush(c: Ctx, pairId: string): Promise<void> {
  for (const uid of pairId.split('_')) await userPush(c, uid, { t: 'dm', pairId });
}

export async function editDM(c: Ctx, _pairId: string, mid: string) {
  const b = await readJson(c.req);
  // pair_id sətirdən oxunur (marşrut parametri client-dəndir — ona güvənmirik).
  const row = await D(c).prepare('SELECT from_id, pair_id FROM dm_messages WHERE id = ?').bind(mid).first<any>();
  if (!row) return err('Tapılmadı.', 404);
  if (row.from_id !== c.user!.id) return err('İcazə yoxdur.', 403, 'forbidden');
  await D(c).prepare('UPDATE dm_messages SET text = ?, edited_at = ? WHERE id = ?')
    .bind(clampStr(b.text, 8000), now(), mid).run();
  await dmPush(c, row.pair_id);
  return json({ ok: true });
}
export async function deleteDMMsg(c: Ctx, _pairId: string, mid: string) {
  const row = await D(c).prepare('SELECT from_id, file_key, pair_id FROM dm_messages WHERE id = ?').bind(mid).first<any>();
  if (!row) return json({ ok: true });
  if (row.from_id !== c.user!.id) return err('İcazə yoxdur.', 403, 'forbidden');
  if (row.file_key) await c.env.FILES.delete(row.file_key).catch(() => {});
  await D(c).prepare('DELETE FROM dm_messages WHERE id = ?').bind(mid).run();
  await dmPush(c, row.pair_id);
  return json({ ok: true });
}
export async function markThreadRead(c: Ctx, pairId: string) {
  const [a] = pairId.split('_');
  if (!pairId.split('_').includes(c.user!.id)) return err('İcazə yoxdur.', 403, 'forbidden');
  const col = c.user!.id === a ? 'read_a' : 'read_b';
  await D(c).prepare(`UPDATE dm_threads SET ${col} = ? WHERE pair_id = ?`).bind(now(), pairId).run();
  return json({ ok: true });
}

/* ================= PRESENCE ================= */
export async function heartbeat(c: Ctx) {
  const priv = fromJSON<any>(c.user!.settings as any, {})?.privacy || {};
  if (priv.showOnlineStatus === false) {
    await D(c).prepare('DELETE FROM presence WHERE user_id = ?').bind(c.user!.id).run();
    return json({ ok: true });
  }
  await D(c).prepare(
    'INSERT INTO presence (user_id, last_seen) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen = ?',
  ).bind(c.user!.id, now(), now()).run();
  await D(c).prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(now(), c.user!.id).run();
  return json({ ok: true });
}
export async function presenceMap(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM presence WHERE last_seen > ?').bind(now() - 120000).all<any>();
  const out: Record<string, number> = {};
  rows.results.forEach(r => { out[r.user_id] = r.last_seen; });
  return json({ presence: out });
}

/* ================= NOTIFICATIONS ================= */
export async function listNotifs(c: Ctx) {
  const rows = await D(c).prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60',
  ).bind(c.user!.id).all<any>();
  return json({
    notifications: rows.results.map(r => ({
      id: r.id, type: r.type, fromUid: r.from_id, fromName: r.from_name,
      postId: r.post_id, text: r.text, read: !!r.read, createdAt: r.created_at,
    })),
  });
}
export async function readNotif(c: Ctx, id: string) {
  await D(c).prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').bind(id, c.user!.id).run();
  return json({ ok: true });
}
export async function readAllNotifs(c: Ctx) {
  await D(c).prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(c.user!.id).run();
  return json({ ok: true });
}

/* ================= TASKS ================= */
export async function listTasks(c: Ctx) {
  const scope = c.url.searchParams.get('scope') || 'approved';
  if (scope === 'pending') {
    if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
    const rows = await D(c).prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at DESC").all<any>();
    return json({ tasks: rows.results.map(mapTask) });
  }
  if (scope === 'mine') {
    const rows = await D(c).prepare("SELECT * FROM tasks WHERE created_by = ? AND status != 'approved' ORDER BY created_at DESC")
      .bind(c.user!.id).all<any>();
    return json({ tasks: rows.results.map(mapTask) });
  }

  // Global approved tasks
  const rows = await D(c).prepare("SELECT * FROM tasks WHERE status = 'approved' ORDER BY created_at DESC LIMIT 200").all<any>();
  let allTasks = rows.results.map(mapTask);

  // Sync team tasks assigned to user from Public projects
  if (c.user) {
    const teamTasks = await D(c).prepare(`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.created_at, p.name as project_name 
      FROM team_tasks t 
      JOIN team_projects p ON t.project_id = p.id 
      WHERE t.assignee_id = ? AND p.visibility = 'Public' AND t.status != 'Done'
    `).bind(c.user.id).all<any>();
    
    if (teamTasks.results.length > 0) {
      const mappedTeamTasks = teamTasks.results.map(t => ({
        id: t.id,
        title: t.title,
        desc: t.description,
        category: 'Team Task',
        status: t.status,
        author: { name: t.project_name || 'Komanda Layihəsi' },
        createdAt: t.created_at,
        xp: 0, // Team tasks don't have global XP logic currently
        isTeamTask: true
      }));
      allTasks = [...mappedTeamTasks, ...allTasks];
      // Sort globally
      allTasks.sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  return json({ tasks: allTasks });
}
export async function createTask(c: Ctx) {
  const b = await readJson(c.req);
  const title = clampStr(b.title, 120).trim();
  const desc = clampStr(b.desc, 3000).trim();
  const category = clampStr(b.category, 30);
  if (!title || !desc) return badReq('Başlıq və təsvir doldurulmalıdır.');
  const status = c.isAdmin ? 'approved' : 'pending';
  await D(c).prepare(
    'INSERT INTO tasks (id, title, descr, category, created_by, created_by_name, status, created_at, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
  ).bind(uuid(), title, desc, category, c.user!.id, c.user!.username, status, now(),
    c.isAdmin ? c.user!.id : null, c.isAdmin ? now() : null).run();
  return json({ ok: true, status });
}
export async function reviewTask(c: Ctx, id: string) {
  const b = await readJson(c.req);
  const row = await D(c).prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<any>();
  if (!row) return err('Tapılmadı.', 404);
  const status = b.approve ? 'approved' : 'rejected';
  await D(c).prepare('UPDATE tasks SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?')
    .bind(status, c.user!.id, now(), id).run();
  await notify(c, row.created_by, 'task',
    b.approve ? `"${row.title}" tapşırıq təklifin təsdiqləndi 🎉` : `"${row.title}" təklifin rədd edildi`);
  await logAdmin(c, 'task-' + status, row.created_by, row.title);
  return json({ ok: true });
}
export async function deleteTask(c: Ctx, id: string) {
  await D(c).prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

export async function submitSolution(c: Ctx, taskId: string) {
  const b = await readJson(c.req);
  const task = await D(c).prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first<any>();
  if (!task) return err('Tapşırıq tapılmadı.', 404);
  const text = clampStr(b.text, 5000).trim();
  const link = clampStr(b.link, 300).trim();
  if (!text && !link) return badReq('Həll boş ola bilməz.');
  if (link && !/^https:\/\//.test(link)) return badReq('Link https:// ilə başlamalıdır.');
  await D(c).prepare(
    `INSERT INTO submissions (task_id, user_id, username, name, task_title, category, text, link, status, submitted_at)
     VALUES (?,?,?,?,?,?,?,?, 'pending', ?)
     ON CONFLICT(task_id, user_id) DO UPDATE SET text = ?, link = ?, status = 'pending', submitted_at = ?`,
  ).bind(taskId, c.user!.id, c.user!.username, c.user!.name, task.title, task.category,
    text, link, now(), text, link, now()).run();
  await bumpActivity(c);
  return json({ ok: true });
}
export async function listSubmissions(c: Ctx) {
  const scope = c.url.searchParams.get('scope') || 'mine';
  if (scope === 'pending') {
    if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
    const rows = await D(c).prepare("SELECT * FROM submissions WHERE status = 'pending' ORDER BY submitted_at ASC").all<any>();
    return json({ submissions: rows.results.map(mapSubmission) });
  }
  const rows = await D(c).prepare('SELECT * FROM submissions WHERE user_id = ?').bind(c.user!.id).all<any>();
  return json({ submissions: rows.results.map(mapSubmission) });
}
export async function reviewSubmission(c: Ctx, taskId: string, uid: string) {
  const b = await readJson(c.req);
  const status = b.status === 'approved' ? 'approved' : 'rejected';
  const row = await D(c).prepare('SELECT * FROM submissions WHERE task_id = ? AND user_id = ?')
    .bind(taskId, uid).first<any>();
  if (!row) return err('Tapılmadı.', 404);
  await D(c).prepare('UPDATE submissions SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE task_id = ? AND user_id = ?')
    .bind(status, now(), c.user!.id, taskId, uid).run();
  if (status === 'approved' && row.status !== 'approved') {
    await D(c).prepare('UPDATE users SET xp = xp + 50, tasks_completed = tasks_completed + 1 WHERE id = ?').bind(uid).run();
    if (row.category) await bumpProgress(c, uid, row.category, 'tasks');
  }
  await notify(c, uid, 'task',
    status === 'approved' ? `"${row.task_title}" həllin təsdiqləndi 🎉 +50 XP` : `"${row.task_title}" həllin rədd edildi`);
  return json({ ok: true });
}

/* ================= REPORTS ================= */
export async function createReport(c: Ctx) {
  const b = await readJson(c.req);
  const reason = clampStr(b.reason, 1000).trim();
  if (!reason) return badReq('Səbəb boşdur.');
  // AUDIT L-4 — hədəfin MÖVCUDLUĞU yoxlanmırdı: uydurma uid ilə şikayət
  // yaradıla bilirdi və admin paneli heç vaxt açıla bilməyən sətirlərlə
  // dolurdu. Ad da bazadan götürülür — client-in göndərdiyi ada güvənmirik.
  const target = await D(c).prepare('SELECT id, username FROM users WHERE id = ?')
    .bind(clampStr(b.targetUid, 40)).first<any>();
  if (!target) return err('Şikayət edilən istifadəçi tapılmadı.', 404);
  await D(c).prepare(
    'INSERT INTO reports (id, reporter_id, reporter_name, target_id, target_username, reason, created_at) VALUES (?,?,?,?,?,?,?)',
  ).bind(uuid(), c.user!.id, c.user!.username, target.id, target.username, reason, now()).run();
  return json({ ok: true });
}
export async function listReports(c: Ctx) {
  const rows = await D(c).prepare("SELECT * FROM reports WHERE status = 'open' ORDER BY created_at DESC").all<any>();
  return json({
    reports: rows.results.map(r => ({
      id: r.id, reporterUid: r.reporter_id, reporterName: r.reporter_name,
      targetUid: r.target_id, targetUsername: r.target_username,
      reason: r.reason, status: r.status, createdAt: r.created_at,
    })),
  });
}
/**
 * AUDIT L-5 — `status` İXTİYARİ 20 simvolluq sətir ola bilirdi. `listReports`
 * yalnız `status = 'open'` sətirlərini göstərir, yəni uydurma status
 * (məs. "opened") şikayəti həm açıq siyahıdan, həm həll olunmuşlardan
 * çıxarırdı — sətir sükutla itirdi. Ağ siyahı bunu bağlayır.
 */
const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;

export async function resolveReport(c: Ctx, id: string) {
  const b = await readJson(c.req);
  const status = String(b.status ?? 'dismissed');
  if (!(REPORT_STATUSES as readonly string[]).includes(status)) {
    return err('Naməlum şikayət statusu.', 400, 'invalid_status');
  }
  await D(c).prepare('UPDATE reports SET status = ? WHERE id = ?').bind(status, id).run();
  return json({ ok: true });
}

/* ================= TAXONOMY ================= */
export async function listTaxonomies(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM taxonomies WHERE active = 1 ORDER BY sort_order ASC').all<any>();
  const out: Record<string, any[]> = { prog: [], spoken: [] };
  rows.results.forEach(r => {
    (out[r.type] = out[r.type] || []).push({
      id: r.id, label: r.label, color: r.color, icon: r.icon, flag: r.flag,
      highlightId: r.highlight_id, order: r.sort_order, active: !!r.active,
    });
  });
  return json({ taxonomies: out });
}
export async function saveTaxItem(c: Ctx, type: string) {
  const b = await readJson(c.req);
  const id = clampStr(b.id, 30) || clampStr(b.label, 30).toLowerCase().replace(/[^a-z0-9]/g, '') || uuid().slice(0, 8);
  await D(c).prepare(
    `INSERT INTO taxonomies (type, id, label, color, icon, flag, highlight_id, sort_order, active)
     VALUES (?,?,?,?,?,?,?,?,1)
     ON CONFLICT(type, id) DO UPDATE SET label=?, color=?, icon=?, flag=?, highlight_id=?, sort_order=?, active=1`,
  ).bind(type, id, clampStr(b.label, 40), b.color || null, b.icon || null, b.flag || null,
    b.highlightId || null, parseInt(b.order, 10) || 99,
    clampStr(b.label, 40), b.color || null, b.icon || null, b.flag || null,
    b.highlightId || null, parseInt(b.order, 10) || 99).run();
  return json({ ok: true });
}
export async function deactivateTaxItem(c: Ctx, type: string, id: string) {
  await D(c).prepare('UPDATE taxonomies SET active = 0 WHERE type = ? AND id = ?').bind(type, id).run();
  return json({ ok: true });
}

/* ================= PUBLIC ================= */
export async function publicFaqs(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM faqs WHERE active = 1 ORDER BY sort_order ASC').all<any>();
  return json({
    faqs: rows.results.map(r => ({
      id: r.id, q: fromJSON(r.q, {}), a: fromJSON(r.a, {}),
      category: r.category, order: r.sort_order, active: !!r.active,
    })),
  });
}
export async function publicTestimonials(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM testimonials WHERE approved = 1 AND featured = 1 LIMIT 12').all<any>();
  return json({
    testimonials: rows.results.map(r => ({
      id: r.id, authorName: r.author_name, authorTitle: fromJSON(r.author_title, {}),
      text: fromJSON(r.text, {}), rating: r.rating, featured: !!r.featured, approved: !!r.approved,
    })),
  });
}
export async function publicStats(c: Ctx) {
  const [u, p] = await D(c).batch([
    D(c).prepare('SELECT COUNT(*) AS n FROM users'),
    D(c).prepare('SELECT COUNT(*) AS n FROM posts'),
  ]);
  return json({ users: (u.results[0] as any).n, posts: (p.results[0] as any).n });
}

// Auth-suz tək-post oxuması — SSR meta + OG şəkil üçün. Yalnız public-safe sahələr;
// müəllif bloklanıbsa 404. (Feed-dəki eyni JOIN forması.)
export async function publicGetPost(c: Ctx, id: string) {
  const row = await D(c).prepare(`
    SELECT p.*, u.blocked AS author_blocked, u.username AS author_username,
           u.photo_url AS author_photo, u.verified AS author_verified,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE p.id = ?
  `).bind(id).first<any>();
  if (!row || row.author_blocked) return err('Post tapılmadı.', 404);
  const post = mapPost(row);
  post.authorUsername = row.author_username;
  post.authorPhoto = fileUrl(row.author_photo);
  post.authorVerified = !!row.author_verified;
  return json({ post });
}

// Auth-suz username→profil oxuması — SSR meta + OG şəkil üçün. Şifrə/sessiya sahələri yox.
export async function publicGetUser(c: Ctx, username: string) {
  const uname = normalizeUsername(username);
  const row = await D(c).prepare(
    'SELECT id, username, name, bio, photo_url, verified, xp, streak, tasks_completed, joined_at, prog_levels, lang_levels FROM users WHERE username = ? AND blocked = 0',
  ).bind(uname).first<any>();
  if (!row) return err('İstifadəçi tapılmadı.', 404);
  return json({
    user: {
      uid: row.id, username: row.username, name: row.name, bio: row.bio,
      photoURL: fileUrl(row.photo_url), verified: !!row.verified,
      xp: row.xp, streak: row.streak, tasksCompleted: row.tasks_completed, joinedAt: row.joined_at,
      prog: Object.keys(fromJSON(row.prog_levels, {})), langs: Object.keys(fromJSON(row.lang_levels, {})),
    },
  });
}
export async function newsletterSubscribe(c: Ctx) {
  const b = await readJson(c.req);
  const email = clampStr(b.email, 120).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badReq('Email formatı düzgün deyil.');
  const lang = ['az', 'en', 'ru'].includes(b.lang) ? b.lang : 'az';
  const r = await D(c).prepare('INSERT OR IGNORE INTO newsletter (email, lang, created_at) VALUES (?,?,?)')
    .bind(email, lang, now()).run();
  if (!r.meta.changes) return badReq('Bu e-poçt artıq abunədir.');
  return json({ ok: true });
}
export async function contactSubmit(c: Ctx) {
  const b = await readJson(c.req);
  const name = clampStr(b.name, 80).trim();
  const email = clampStr(b.email, 120).trim();
  const message = clampStr(b.message, 2000).trim();
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badReq('Sahələri düzgün doldurun.');
  await D(c).prepare('INSERT INTO contact_messages (id, name, email, message, created_at) VALUES (?,?,?,?,?)')
    .bind(uuid(), name, email, message, now()).run();
  return json({ ok: true });
}

/* ================= ADMIN ================= */
export async function adminListFaqs(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM faqs ORDER BY sort_order ASC').all<any>();
  return json({
    faqs: rows.results.map(r => ({
      id: r.id, q: fromJSON(r.q, {}), a: fromJSON(r.a, {}),
      category: r.category, order: r.sort_order, active: !!r.active,
    })),
  });
}
export async function adminSaveFaq(c: Ctx) {
  const b = await readJson(c.req);
  const id = clampStr(b.id, 40) || uuid().slice(0, 10);
  await D(c).prepare(
    `INSERT INTO faqs (id, q, a, category, sort_order, active, created_at) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET q=?, a=?, category=?, sort_order=?, active=?`,
  ).bind(id, toJSON(b.q, '{}'), toJSON(b.a, '{}'), clampStr(b.category, 30),
    parseInt(b.order, 10) || 99, b.active === false ? 0 : 1, now(),
    toJSON(b.q, '{}'), toJSON(b.a, '{}'), clampStr(b.category, 30),
    parseInt(b.order, 10) || 99, b.active === false ? 0 : 1).run();
  return json({ ok: true });
}
export async function adminDeleteFaq(c: Ctx, id: string) {
  await D(c).prepare('DELETE FROM faqs WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
export async function adminListTestimonials(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM testimonials ORDER BY created_at DESC').all<any>();
  return json({
    testimonials: rows.results.map(r => ({
      id: r.id, authorName: r.author_name, authorTitle: fromJSON(r.author_title, {}),
      text: fromJSON(r.text, {}), rating: r.rating, featured: !!r.featured, approved: !!r.approved,
    })),
  });
}
export async function adminSaveTestimonial(c: Ctx) {
  const b = await readJson(c.req);
  const id = clampStr(b.id, 40) || uuid().slice(0, 10);
  await D(c).prepare(
    `INSERT INTO testimonials (id, author_name, author_title, text, rating, featured, approved, created_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET author_name=?, author_title=?, text=?, rating=?, featured=?, approved=?`,
  ).bind(id, clampStr(b.authorName, 60), toJSON(b.authorTitle, '{}'), toJSON(b.text, '{}'),
    Math.min(5, Math.max(1, parseInt(b.rating, 10) || 5)), b.featured ? 1 : 0, b.approved ? 1 : 0, now(),
    clampStr(b.authorName, 60), toJSON(b.authorTitle, '{}'), toJSON(b.text, '{}'),
    Math.min(5, Math.max(1, parseInt(b.rating, 10) || 5)), b.featured ? 1 : 0, b.approved ? 1 : 0).run();
  return json({ ok: true });
}
export async function adminDeleteTestimonial(c: Ctx, id: string) {
  await D(c).prepare('DELETE FROM testimonials WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
export async function adminContacts(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100').all<any>();
  return json({
    contacts: rows.results.map(r => ({
      id: r.id, name: r.name, email: r.email, message: r.message, read: !!r.read, createdAt: r.created_at,
    })),
  });
}
export async function adminContactRead(c: Ctx, id: string) {
  await D(c).prepare('UPDATE contact_messages SET read = 1 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

const ADMIN_FIELDS: Record<string, [string, number]> = {
  name: ['name', 60], bio: ['bio', 400], instagram: ['instagram', 40], github: ['github', 40],
  role: ['role', 20],
};
export async function adminPatchUser(c: Ctx, uid: string) {
  const b = await readJson(c.req);
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, [col, max]] of Object.entries(ADMIN_FIELDS)) {
    if (k in b) { sets.push(`${col} = ?`); vals.push(clampStr(b[k], max)); }
  }
  if ('verified' in b) { sets.push('verified = ?'); vals.push(b.verified ? 1 : 0); }
  if ('blocked' in b) { sets.push('blocked = ?'); vals.push(b.blocked ? 1 : 0); }
  // TASK-7 / Bənd 6: admin XP redaktəsi. Level XP-dən törənir (levelFromXP) —
  // ayrıca stored sütun yoxdur, ona görə "Lv redaktəsi" = XP redaktəsi.
  if ('xp' in b) { sets.push('xp = ?'); vals.push(Math.max(0, parseInt(String(b.xp), 10) || 0)); }
  if (!sets.length) return badReq('Dəyişiklik yoxdur.');
  vals.push(uid);
  await D(c).prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  if ('blocked' in b && b.blocked) await destroyAllSessions(c.env, uid);

  // Jurnal: blok/blokdan-çıxarma AYRICA əməliyyatdır. Əvvəl hamısı 'user-edit'
  // kimi yazılırdı və audit jurnalında "user-edit blocked" sətrləri adi profil
  // redaktəsindən seçilmirdi — kim kimi bloklayıb, izləmək mümkün deyildi.
  const changed = Object.keys(b);
  if ('blocked' in b) {
    const act = b.blocked ? 'user-block' : 'user-unblock';
    await logAdmin(c, act, uid, '', b.blocked ? 'error' : 'success');
    // Eyni sorğuda başqa sahələr də dəyişibsə, onlar ayrıca qeyd olunur.
    const rest = changed.filter(k => k !== 'blocked');
    if (rest.length) await logAdmin(c, 'user-edit', uid, rest.join(','), 'warning');
  } else if ('verified' in b) {
    await logAdmin(c, b.verified ? 'user-verify' : 'user-unverify', uid,
      changed.join(','), b.verified ? 'success' : 'warning');
  } else if ('xp' in b) {
    const xpVal = Math.max(0, parseInt(String(b.xp), 10) || 0);
    const lvl = Math.max(1, Math.floor(Math.sqrt(xpVal / 100)) + 1);
    await logAdmin(c, 'user-level-edit', uid, `Lv${lvl} · ${xpVal} XP`, 'warning');
  } else {
    await logAdmin(c, 'user-edit', uid, changed.join(','), 'warning');
  }
  return json({ ok: true });
}

export async function adminTempPassword(c: Ctx, uid: string) {
  const b = await readJson(c.req);
  if (typeof b.password !== 'string' || b.password.length < 6) return badReq('Şifrə minimum 6 simvol.');
  const { hash, salt } = await hashPassword(b.password);
  await D(c).prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, must_reset_password = 1 WHERE id = ?')
    .bind(hash, salt, uid).run();
  await destroyAllSessions(c.env, uid);
  await logAdmin(c, 'temp-password', uid);
  return json({ ok: true });
}

// ⚠ Qapı İKİ YERDƏ var və bu, ŞÜURLU dublikatdır (AUDIT-2026-07-26 / H-2).
// Marşrut cədvəlindəki `admin: true` bayrağı bir dəfə səhvən buraxılmışdı —
// qonşu 32 admin route-unda vardı, məhz bunda yox idi. Nəticədə giriş etmiş
// İSTƏNİLƏN istifadəçi bütün admin uid-lərini sadalaya bilirdi; `/api/users`
// onsuz da uid→username xəritəsi verdiyi üçün bu, birbaşa "kimi hədəfləməli"
// siyahısı demək idi. Handler səviyyəsindəki bu yoxlama cədvəldəki bayraq
// yenidən itsə də sızmanın qarşısını alır.
export async function adminListAdmins(c: Ctx) {
  if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const rows = await D(c).prepare('SELECT user_id FROM admins').all<any>();
  return json({ admins: rows.results.map(r => r.user_id) });
}
export async function adminAddAdmin(c: Ctx, uid: string) {
  await D(c).prepare('INSERT OR IGNORE INTO admins (user_id, added_at, added_by) VALUES (?,?,?)')
    .bind(uid, now(), c.user!.id).run();
  await logAdmin(c, 'admin-add', uid);
  return json({ ok: true });
}
export async function adminRemoveAdmin(c: Ctx, uid: string) {
  // 🔴 AUDIT M-14 — ən kritik bənd: əvvəl İSTƏNİLƏN admini, o cümlədən
  // SONUNCUNU və ÖZÜNÜ silmək mümkün idi. Bütün adminlər silinsə panelə
  // çıxış BƏRPA OLUNMAZ şəkildə bağlanır ("özünü admin et" endpoint-i yoxdur
  // və olmamalıdır — yeganə yol birbaşa D1 müdaxiləsidir).
  //
  // İki AYRI müdafiə (biri digərini əvəz etmir):
  //   1) sonuncu admin — panel sahibsiz qalmasın;
  //   2) özünü silmə — səhvən öz-özünü çıxarma (ən çox rast gəlinən hal).
  if (uid === c.user!.id) {
    return err('Öz admin hüququnuzu silə bilməzsiniz.', 409, 'self_admin_removal');
  }
  const row = await D(c).prepare('SELECT COUNT(*) AS n FROM admins').first<any>();
  if (Number(row?.n || 0) <= 1) {
    return err('Sonuncu admini silmək olmaz.', 409, 'last_admin');
  }

  await D(c).prepare('DELETE FROM admins WHERE user_id = ?').bind(uid).run();
  await logAdmin(c, 'admin-remove', uid);
  return json({ ok: true });
}
const mapLog = (r: any) => ({
  id: r.id, action: r.action, targetUid: r.target_id, byUid: r.by_id, byName: r.by_name,
  detail: r.detail, createdAt: r.created_at, level: r.level || 'info',
});

// Admin#6 (səviyyə filtri) + Admin#10 (keyset pagination).
export async function adminLogs(c: Ctx) {
  const u = new URL(c.req.url).searchParams;
  const where: string[] = [];
  const vals: unknown[] = [];

  const level = u.get('level');
  if (level && ['info', 'success', 'warning', 'error'].includes(level)) {
    where.push('level = ?');
    vals.push(level);
  }
  // Cursor: "<created_at>|<id>" — eyni millisaniyəli sətrlər üçün id tiebreaker.
  const cursor = u.get('cursor');
  if (cursor) {
    const i = cursor.lastIndexOf('|');
    if (i > 0) {
      const ts = Number(cursor.slice(0, i));
      if (!Number.isNaN(ts)) {
        where.push('(created_at < ? OR (created_at = ? AND id > ?))');
        vals.push(ts, ts, cursor.slice(i + 1));
      }
    }
  }
  const limit = Math.min(Math.max(parseInt(u.get('limit') || '', 10) || 40, 1), 100);
  const sql = `SELECT * FROM admin_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ` +
    'ORDER BY created_at DESC, id ASC LIMIT ?';
  const rows = await D(c).prepare(sql).bind(...vals, limit + 1).all<any>();

  const hasMore = rows.results.length > limit;
  const page = hasMore ? rows.results.slice(0, limit) : rows.results;
  const last = page[page.length - 1] as any;
  return json({
    logs: page.map(mapLog),
    nextCursor: hasMore && last ? `${last.created_at}|${last.id}` : null,
  });
}
/* ================= TASK-6 / BÖLMƏ 3 — Admin paneli ================= */

/* ---------- Admin#4 + #10: filtrlənən, səhifələnən istifadəçi siyahısı ---------- */
export async function adminUsersList(c: Ctx) {
  const u = new URL(c.req.url).searchParams;
  const where: string[] = [];
  const vals: unknown[] = [];

  const q = (u.get('q') || '').trim().toLowerCase();
  if (q) {
    // ⚠ `ESCAPE '\'` MƏCBURİDİR: aşağıda `_` və `%` `\` ilə escape olunur, amma
    // ESCAPE bəyan edilməsə SQLite `\`-i adi simvol sayır və `\_` = "\ + istənilən
    // simvol" olur. Nəticədə `_` olan İSTƏNİLƏN istifadəçi adı (məs. hər test
    // hesabı `e2e_*`) axtarışda TAPILMIRDI. `_`-siz adlar təsadüfən işləyirdi,
    // ona görə buq uzun müddət gizli qaldı.
    where.push("(lower(u.name) LIKE ? ESCAPE '\\' OR lower(u.username) LIKE ? ESCAPE '\\')");
    const like = '%' + q.replace(/[%_\\]/g, ch => '\\' + ch) + '%';
    vals.push(like, like);
  }
  // Filtrlər 0006-dakı index-lərdən istifadə edir (blocked / role / verified).
  switch (u.get('filter')) {
    case 'blocked':  where.push('u.blocked = 1'); break;
    case 'verified': where.push('u.verified = 1'); break;
    case 'admin':    where.push('a.user_id IS NOT NULL'); break;
  }
  const cursor = u.get('cursor');
  if (cursor) where.push('u.username > ?'), vals.push(cursor);

  const limit = Math.min(Math.max(parseInt(u.get('limit') || '', 10) || 30, 1), 100);
  // admins ilə LEFT JOIN — hər sətrin admin olub-olmadığı bir sorğuda gəlir
  // (əvvəl bütün admin siyahısı ayrıca çəkilib client-də uzlaşdırılırdı).
  const sql =
    `SELECT u.*, (a.user_id IS NOT NULL) AS is_admin FROM users u ` +
    `LEFT JOIN admins a ON a.user_id = u.id ` +
    `${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.username ASC LIMIT ?`;
  const rows = await D(c).prepare(sql).bind(...vals, limit + 1).all<any>();

  const hasMore = rows.results.length > limit;
  const page = hasMore ? rows.results.slice(0, limit) : rows.results;
  const last = page[page.length - 1] as any;
  return json({
    users: page.map(r => ({ ...mapUser(r), isAdmin: !!r.is_admin })),
    nextCursor: hasMore && last ? String(last.username) : null,
  });
}

/* ---------- Admin#5: toplu blok / blokdan çıxarma ---------- */
export async function adminBulkUsers(c: Ctx) {
  const b = await readJson(c.req);
  const action = String(b.action || '');
  if (!['block', 'unblock'].includes(action)) return badReq('Naməlum əməliyyat.');
  const uids: string[] = Array.isArray(b.uids) ? b.uids.filter((x: any) => typeof x === 'string').slice(0, 200) : [];
  if (!uids.length) return badReq('İstifadəçi seçilməyib.');
  // Admin özünü bloklaya bilməz — paneldən çıxış yolunu bağlamasın.
  const targets = uids.filter(id => id !== c.user!.id);
  if (!targets.length) return badReq('Özünü bloklaya bilməzsən.');

  const blocked = action === 'block' ? 1 : 0;
  const ph = targets.map(() => '?').join(',');
  // D1 batch(): tək sorğuda toplu yeniləmə + jurnal yazısı.
  await D(c).batch([
    D(c).prepare(`UPDATE users SET blocked = ? WHERE id IN (${ph})`).bind(blocked, ...targets),
    D(c).prepare(
      'INSERT INTO admin_logs (id, action, target_id, by_id, by_name, detail, created_at, level) VALUES (?,?,?,?,?,?,?,?)',
    ).bind(uuid(), 'bulk-' + action, '', c.user!.id, c.user!.username,
      `${targets.length} istifadəçi`, now(), blocked ? 'error' : 'success'),
  ]);
  // Bloklananların sessiyaları dərhal ləğv olunur (batch-dən kənar — KV işidir).
  if (blocked) for (const id of targets) await destroyAllSessions(c.env, id);

  return json({ ok: true, affected: targets.length });
}

/* ---------- Admin#8: sparkline üçün gündəlik zaman-seriyası ---------- */
// stats_daily bugünkü sətri hər çağırışda yeniləyir (upsert), sonra son N günü
// qaytarır. Ayrıca cron lazım deyil — panel açıldıqca seriya özü dolur.
export async function adminStatsDaily(c: Ctx) {
  const day = todayStr();
  const [uc, pc, rc, bc] = await D(c).batch([
    D(c).prepare('SELECT COUNT(*) AS n FROM users'),
    D(c).prepare('SELECT COUNT(*) AS n FROM posts'),
    D(c).prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    D(c).prepare('SELECT COUNT(*) AS n FROM users WHERE blocked = 1'),
  ]);
  const g = (r: any) => (r.results[0] as any).n as number;
  await D(c).prepare(
    `INSERT INTO stats_daily (date, users, posts, complaints, blocked, updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(date) DO UPDATE SET users=?, posts=?, complaints=?, blocked=?, updated_at=?`,
  ).bind(day, g(uc), g(pc), g(rc), g(bc), now(),
    g(uc), g(pc), g(rc), g(bc), now()).run();

  const days = Math.min(Math.max(parseInt(new URL(c.req.url).searchParams.get('days') || '', 10) || 30, 2), 90);
  const rows = await D(c).prepare(
    'SELECT * FROM stats_daily ORDER BY date DESC LIMIT ?',
  ).bind(days).all<any>();
  return json({
    // köhnədən yeniyə — qrafik soldan sağa oxunur
    series: rows.results.reverse(),
    today: { users: g(uc), posts: g(pc), complaints: g(rc), blocked: g(bc) },
  });
}

/* ---------- Admin#11: CSV ixracı (stream) ---------- */
// Bütün nəticəni yaddaşda yığmaq əvəzinə D1-dən hissə-hissə oxuyub axına yazırıq —
// Worker-in yaddaş limiti böyük siyahılarda da aşılmır.
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Formula injection qorunması: =, +, -, @ ilə başlayan xanalar Excel-də
  // formul kimi icra oluna bilər — apostrofla neytrallaşdırılır.
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
};
const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',') + '\r\n';

const EXPORTS: Record<string, { cols: string[]; sql: string; map: (r: any) => unknown[] }> = {
  users: {
    cols: ['username', 'name', 'email', 'xp', 'streak', 'tasks_completed', 'verified', 'blocked', 'role', 'joined_at', 'last_active_at'],
    sql: 'SELECT * FROM users ORDER BY username ASC LIMIT ? OFFSET ?',
    map: r => [r.username, r.name, r.contact_email, r.xp, r.streak, r.tasks_completed,
      r.verified ? 'yes' : 'no', r.blocked ? 'yes' : 'no', r.role,
      new Date(r.joined_at).toISOString(), r.last_active_at ? new Date(r.last_active_at).toISOString() : ''],
  },
  logs: {
    cols: ['created_at', 'level', 'action', 'by_name', 'target_id', 'detail'],
    sql: 'SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
    map: r => [new Date(r.created_at).toISOString(), r.level || 'info', r.action, r.by_name, r.target_id, r.detail],
  },
};

export async function adminExportCsv(c: Ctx, kind: string) {
  const spec = EXPORTS[kind];
  if (!spec) return err('Naməlum ixrac növü.', 404);

  const CHUNK = 500;
  const enc = new TextEncoder();
  const db = D(c);
  const stream = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      // İlk çağırışda BOM + başlıq: BOM olmadan Excel UTF-8-i tanımır və
      // Azərbaycan hərfləri (ə, ğ, ş) pozulur.
      if (!(this as any)._started) {
        (this as any)._started = true;
        (this as any)._offset = 0;
        ctrl.enqueue(enc.encode('\uFEFF' + csvRow(spec.cols)));
        return;
      }
      const offset = (this as any)._offset as number;
      const rows = await db.prepare(spec.sql).bind(CHUNK, offset).all<any>();
      for (const r of rows.results) ctrl.enqueue(enc.encode(csvRow(spec.map(r))));
      (this as any)._offset = offset + CHUNK;
      if (rows.results.length < CHUNK) ctrl.close();
    },
  });

  await logAdmin(c, 'export-' + kind, '', '', 'info');
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="collabix-${kind}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

/* ---------- Admin#3: taksonomiya sırasının toplu yenilənməsi ---------- */
export async function reorderTaxonomy(c: Ctx, type: string) {
  const b = await readJson(c.req);
  const ids: string[] = Array.isArray(b.ids) ? b.ids.filter((x: any) => typeof x === 'string').slice(0, 300) : [];
  if (!ids.length) return badReq('Sıra boşdur.');
  // Tək batch: N sətrin sort_order-i bir gedişdə yazılır (Admin#3 "batch yenilə").
  await D(c).batch(ids.map((id, i) =>
    D(c).prepare('UPDATE taxonomies SET sort_order = ? WHERE type = ? AND id = ?').bind(i + 1, type, id)));
  await logAdmin(c, 'taxonomy-reorder', type, `${ids.length} element`, 'info');
  return json({ ok: true });
}

export async function adminLogAction(c: Ctx) {
  const b = await readJson(c.req);
  // AUDIT M-13 — əvvəl İXTİYARİ `action` sətri jurnala düşürdü: admin öz izini
  // saxtalaşdıra bilirdi (log forging). Jurnal audit üçündürsə, məzmununu
  // client təyin edə bilməz. Ağ siyahı `admin-log.ts`-dədir (tək mənbə).
  if (!isAdminLogAction(b.action)) return invalidAdminAction();
  await logAdmin(c, b.action, clampStr(b.targetUid, 40), clampStr(b.detail, 120));
  return json({ ok: true });
}

/* ================= GDPR — DATA İXRACI (Bənd 10) ================= */

// CSV formatlaması üçün yuxarıdakı `csvCell` / `csvRow` TƏKRAR-İSTİFADƏ olunur
// (TASK-6 admin ixracı ilə eyni funksiyalar). Orada formula-injection qoruması
// artıq var: `=`, `+`, `-`, `@` ilə başlayan xana apostrofla neytrallaşdırılır,
// yəni Excel onu düstur kimi İCRA ETMİR.
//
// İkinci nüsxə yazsaydıq qaydalar vaxtla ayrılar və bir ixrac qorunub, o biri
// qorunmamış qalardı — məhz belə fərqlər real təhlükəsizlik boşluqları yaradır.

// İstifadəçinin BÜTÜN datasını toplayan sorğular. Hər biri ayrıca "bölmə"dir —
// stream-də bir-bir yazılır ki, yaddaşda tam nüsxə yığılmasın.
const EXPORT_SECTIONS: Array<{ name: string; sql: string; binds: (uid: string) => unknown[] }> = [
  { name: 'profile', sql: 'SELECT * FROM users WHERE id = ?', binds: u => [u] },
  { name: 'posts', sql: 'SELECT * FROM posts WHERE author_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'comments', sql: 'SELECT * FROM comments WHERE author_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'likes', sql: 'SELECT * FROM likes WHERE user_id = ?', binds: u => [u] },
  { name: 'bookmarks', sql: 'SELECT * FROM bookmarks WHERE user_id = ?', binds: u => [u] },
  { name: 'follows', sql: 'SELECT * FROM follows WHERE follower_id = ? OR target_id = ?', binds: u => [u, u] },
  { name: 'room_messages', sql: 'SELECT * FROM room_messages WHERE author_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'direct_messages', sql: 'SELECT * FROM dm_messages WHERE from_id = ? OR to_id = ? ORDER BY created_at', binds: u => [u, u] },
  { name: 'tasks_created', sql: 'SELECT * FROM tasks WHERE created_by = ?', binds: u => [u] },
  { name: 'submissions', sql: 'SELECT * FROM submissions WHERE user_id = ?', binds: u => [u] },
  { name: 'notifications', sql: 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'activity', sql: 'SELECT date, count FROM user_activity WHERE uid = ? ORDER BY date', binds: u => [u] },
  { name: 'sessions', sql: 'SELECT id, ua, ip, city, country, created_at, last_seen, revoked FROM sessions WHERE uid = ?', binds: u => [u] },
  { name: 'oauth_accounts', sql: 'SELECT provider, login, email, linked_at FROM oauth_accounts WHERE uid = ?', binds: u => [u] },
  { name: 'reports_filed', sql: 'SELECT * FROM reports WHERE reporter_id = ?', binds: u => [u] },
];

// Parol heşi və TOTP sirri ixracdan ÇIXARILIR: onlar istifadəçinin "şəxsi
// datası" deyil, autentifikasiya sirridir. İxrac faylı email ilə paylaşıla,
// buludda saxlanıla bilər — sirri ora qoymaq hesabı riskə atmaqdır.
const EXPORT_OMIT = new Set(['pass_hash', 'pass_salt', 'totp_secret', 'refresh_hash', 'prev_refresh_hash']);
const scrub = (row: any) => {
  const out: any = {};
  for (const [k, v] of Object.entries(row)) if (!EXPORT_OMIT.has(k)) out[k] = v;
  return out;
};

// Tam data ixracı — STREAM ilə.
//
// Nə üçün stream: aktiv istifadəçinin mesaj+bildiriş tarixçəsi meqabaytlarla
// ola bilər. Hamısını sətirdə yığıb sonda qaytarsaq Worker-in yaddaş limitinə
// dəyərdi. Burada hər bölmə hazır olan kimi ötürülür.
export async function exportMyData(c: Ctx) {
  const uid = c.user!.id;
  const format = c.url.searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `collabix-data-${c.user!.username}-${stamp}.${format}`;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const write = (s: string) => writer.write(encoder.encode(s));

  // Yazma fon işidir: cavab başlıqları DƏRHAL qaytarılır, gövdə axır.
  // `waitUntil` işlədilmir — cavab gövdəsi hələ oxunur, Worker onsuz da diridir.
  (async () => {
    try {
      if (format === 'csv') {
        // CSV-də bir neçə cədvəl var → hər bölmə öz başlığı ilə ardıcıl yazılır.
        // Excel UTF-8-i tanısın deyə BOM əlavə olunur (Azərbaycan hərfləri!).
        await write('﻿');
        for (const sec of EXPORT_SECTIONS) {
          const rows = await c.env.DB.prepare(sec.sql).bind(...sec.binds(uid)).all<any>();
          await write(`\r\n### ${sec.name}\r\n`);
          if (!rows.results.length) { await write('(boş)\r\n'); continue; }
          const cols = Object.keys(scrub(rows.results[0]));
          await write(csvRow(cols));
          for (const r of rows.results) {
            const clean = scrub(r);
            await write(csvRow(cols.map(k => clean[k])));
          }
        }
      } else {
        await write(`{\n  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n`);
        await write(`  "username": ${JSON.stringify(c.user!.username)},\n`);
        for (let i = 0; i < EXPORT_SECTIONS.length; i++) {
          const sec = EXPORT_SECTIONS[i];
          const rows = await c.env.DB.prepare(sec.sql).bind(...sec.binds(uid)).all<any>();
          const data = rows.results.map(scrub);
          const comma = i < EXPORT_SECTIONS.length - 1 ? ',' : '';
          await write(`  ${JSON.stringify(sec.name)}: ${JSON.stringify(data)}${comma}\n`);
        }
        await write('}\n');
      }
    } catch (e: any) {
      console.error('export', e?.message || e);
      // Başlıqlar artıq göndərilib — status kodu dəyişdirmək mümkün deyil.
      // Ona görə xəta faylın İÇİNƏ yazılır: istifadəçi natamam faylı sükutla
      // "tam" sanmasın.
      await write(`\n/* İXRAC YARIMÇIQ QALDI: ${String(e?.message || e)} */\n`);
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',   // şəxsi data keşlənməməlidir
    },
  });
}

/* ================= QLOBAL AXTARIŞ — FTS5 (Bənd 11) ================= */

// İstifadəçi girişini TƏHLÜKƏSİZ FTS5 sorğusuna çevirir.
//
// ⚠ Xam mətni birbaşa MATCH-ə vermək OLMAZ: FTS5-in öz sintaksisi var
// (`"`, `*`, `NEAR`, `AND/OR/NOT`, `:`, `^`). İstifadəçi «C++ "test"» yazsa
// sorğu sintaksis xətası verib 500 qaytarardı — yəni adi axtarış sözü
// endpoint-i sındıra bilərdi. Ona görə hər söz ayrıca sitat içinə alınır
// (sitat daxilində operatorlar adi mətn sayılır).
function ftsQuery(raw: string): string | null {
  const terms = String(raw || '')
    .toLowerCase()
    .replace(/["*():^\-]/g, ' ')      // FTS operator simvolları söz ayırıcıya çevrilir
    .split(/\s+/)
    .filter(t => t.length >= 2)       // tək hərf indeksdə mənalı deyil, hər şeyi qaytarır
    .slice(0, 8);                     // sorğu uzunluğu limiti (DoS qapısı)
  if (!terms.length) return null;
  // Son söz PREFİKS kimi axtarılır ("prog" → "proqramlaşdırma") — yazarkən
  // axtarış (as-you-type) üçün. Qalanları tam söz.
  return terms.map((t, i) => (i === terms.length - 1 ? `"${t}"*` : `"${t}"`)).join(' AND ');
}

const SEARCH_LIMIT = 8;

export async function globalSearch(c: Ctx) {
  const q = ftsQuery(c.url.searchParams.get('q') || '');
  if (!q) return json({ posts: [], users: [], comments: [], query: '' });

  const scope = c.url.searchParams.get('scope') || 'all';
  const want = (s: string) => scope === 'all' || scope === s;

  // Üç indeks paralel sorğulanır — `batch` tək D1 gedişində icra edir.
  // `bm25()` FTS5-in daxili reytinq funksiyasıdır (kiçik = daha uyğun);
  // sütun çəkiləri ilə ad/başlıq mətndən üstün tutulur.
  const stmts: D1PreparedStatement[] = [];
  const kinds: string[] = [];

  if (want('posts')) {
    kinds.push('posts');
    stmts.push(D(c).prepare(
      `SELECT p.id, p.author_id, p.author_name, p.created_at, p.tags,
              snippet(posts_fts, 0, '<mark>', '</mark>', '…', 18) AS snip
         FROM posts_fts
         JOIN posts p ON p.rowid = posts_fts.rowid
        WHERE posts_fts MATCH ?1
        ORDER BY bm25(posts_fts, 1.0, 2.0), p.created_at DESC
        LIMIT ?2`,
    ).bind(q, SEARCH_LIMIT));
  }
  if (want('users')) {
    kinds.push('users');
    stmts.push(D(c).prepare(
      `SELECT u.id, u.username, u.name, u.photo_url, u.xp,
              snippet(users_fts, 2, '<mark>', '</mark>', '…', 14) AS snip
         FROM users_fts
         JOIN users u ON u.rowid = users_fts.rowid
        WHERE users_fts MATCH ?1 AND u.blocked = 0
        ORDER BY bm25(users_fts, 4.0, 3.0, 1.0, 1.0), u.xp DESC
        LIMIT ?2`,
    ).bind(q, SEARCH_LIMIT));
  }
  if (want('comments')) {
    kinds.push('comments');
    stmts.push(D(c).prepare(
      `SELECT cm.id, cm.post_id, cm.author_name, cm.created_at,
              snippet(comments_fts, 0, '<mark>', '</mark>', '…', 16) AS snip
         FROM comments_fts
         JOIN comments cm ON cm.rowid = comments_fts.rowid
        WHERE comments_fts MATCH ?1
        ORDER BY bm25(comments_fts), cm.created_at DESC
        LIMIT ?2`,
    ).bind(q, SEARCH_LIMIT));
  }

  let results: any[];
  try {
    results = await D(c).batch<any>(stmts);
  } catch (e: any) {
    // FTS sintaksis xətası buraya düşməməlidir (`ftsQuery` təmizləyir),
    // amma düşsə istifadəçi 500 yox, boş nəticə görsün.
    console.error('fts search', e?.message || e);
    return json({ posts: [], users: [], comments: [], query: '' });
  }

  const out: Record<string, any[]> = { posts: [], users: [], comments: [] };
  kinds.forEach((kind, i) => {
    const rows = results[i]?.results || [];
    if (kind === 'posts') {
      out.posts = rows.map((r: any) => ({
        id: r.id, authorUid: r.author_id, authorName: r.author_name,
        createdAt: r.created_at, tags: fromJSON(r.tags, []), snippet: r.snip,
      }));
    } else if (kind === 'users') {
      out.users = rows.map((r: any) => ({
        uid: r.id, username: r.username, name: r.name,
        photoURL: r.photo_url, xp: r.xp, snippet: r.snip,
      }));
    } else {
      out.comments = rows.map((r: any) => ({
        id: r.id, postId: r.post_id, authorName: r.author_name,
        createdAt: r.created_at, snippet: r.snip,
      }));
    }
  });

  return json({ ...out, query: c.url.searchParams.get('q') || '' });
}

/* ================= PRECOMPUTED STATİSTİKA (Bənd 8) ================= */

// Profil statistikası — TRIGGER-lərlə artımlı saxlanılan tək sətir.
// Əvvəl hər açılışda 6 ayrı COUNT(*) icra olunurdu.
export async function userStats(c: Ctx, username: string) {
  const row = await D(c).prepare(
    `SELECT u.id, u.xp, u.streak, u.tasks_completed,
            COALESCE(s.posts, 0)          AS posts,
            COALESCE(s.comments, 0)       AS comments,
            COALESCE(s.likes_given, 0)    AS likes_given,
            COALESCE(s.likes_received, 0) AS likes_received,
            COALESCE(s.followers, 0)      AS followers,
            COALESCE(s.following, 0)      AS following
       FROM users u LEFT JOIN user_stats s ON s.uid = u.id
      WHERE u.username = ?`,
  ).bind(normalizeUsername(username)).first<any>();
  if (!row) return err('İstifadəçi tapılmadı.', 404);
  return json({
    stats: {
      posts: row.posts, comments: row.comments,
      likesGiven: row.likes_given, likesReceived: row.likes_received,
      followers: row.followers, following: row.following,
      xp: row.xp, streak: row.streak, tasksCompleted: row.tasks_completed,
    },
  });
}

/* ================= FƏALİYYƏT QRAFİKİ (Bənd 9) ================= */

// Heatmap datası — normalized `user_activity` cədvəlindən.
//
// TƏNBƏL MİQRASİYA: köhnə `users.activity_days` JSON blob-u hələ də mövcuddur.
// İstifadəçinin cədvəldə heç bir sətri yoxdursa, JSON bir dəfə köçürülür.
// Belədə migration ani qalır, data itmir və köçürmə yükü zamana yayılır.
export async function activityFor(c: Ctx, username: string) {
  const u = await D(c).prepare('SELECT id, activity_days FROM users WHERE username = ?')
    .bind(normalizeUsername(username)).first<any>();
  if (!u) return err('İstifadəçi tapılmadı.', 404);

  const has = await D(c).prepare('SELECT 1 FROM user_activity WHERE uid = ? LIMIT 1').bind(u.id).first();
  if (!has) {
    const legacy = fromJSON<Record<string, number>>(u.activity_days, {});
    const entries = Object.entries(legacy)
      .filter(([d, n]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(n) > 0)
      .slice(0, 800);   // ~2 il — heatmap onsuz da bir ildən çoxunu göstərmir
    if (entries.length) {
      await D(c).batch(entries.map(([d, n]) => D(c).prepare(
        'INSERT OR IGNORE INTO user_activity (uid, date, count) VALUES (?,?,?)',
      ).bind(u.id, d, Number(n))));
    }
  }

  // Heatmap son 1 ili göstərir — bütün tarixçəni çəkmək mənasızdır.
  const since = new Date(Date.now() - 371 * 86400000).toISOString().slice(0, 10);
  const rows = await D(c).prepare(
    'SELECT date, count FROM user_activity WHERE uid = ? AND date >= ? ORDER BY date',
  ).bind(u.id, since).all<any>();

  const days: Record<string, number> = {};
  for (const r of rows.results) days[r.date] = r.count;
  return json({ activityDays: days });
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

  if (!(await consumeMfaCode(c, uid, String(b.code || '')))) {
    await logSecurityEvent(c.env, c.req, {
      type: 'login_failed', uid, severity: 'warning', meta: { flow: 'mfa', reason: 'bad_code' },
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

/* ================= PUBLIC KONFİQ ================= */
// Frontend-in build zamanı BİLƏ BİLMƏDİYİ public dəyərlər.
// Turnstile site key public-dir (secret deyil) — amma `wrangler.jsonc` var-ından
// gəldiyi üçün statik JS bundle-a hardcode edilə bilməz. Boş qayıdırsa
// frontend widget-i ümumiyyətlə render etmir (graceful degradation).
export async function publicConfig(c: Ctx) {
  return json({
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || '',
    // Magic link yalnız email göndərilə bildikdə UI-da görünür (Bənd 4).
    magicLink: emailEnabled(c.env),
    // Yalnız TAM konfiqurasiya olunmuş provayderlər — frontend işləməyən
    // düymə göstərməsin.
    oauthProviders: configuredProviders(c.env),
  });
}

/**
 * Sağlamlıq yoxlaması — AUDIT-TASK-5 §10/2 → AUDIT-TASK-6 §A-3.
 *
 * NİYƏ VAR: `0021_restore_bootstrap_rooms.sql` itmiş `general` otağını bərpa
 * etdi, lakin heç nə TƏKRARIN qarşısını almır. `e2e/seed-hygiene.spec.ts`
 * bunu yalnız LOKAL mühitdə tutur — istehsalda tutmur. Otaq silinsə
 * `room_messages.room_id` FK-sı pozulur və qlobal çat sükutla çökür.
 *
 * ⚠ MƏLUMAT SIZDIRMIR: sətir sayı, istifadəçi adı, versiya, xəta mətni
 * qaytarılmır — yalnız 'ok' / 'fail' / 'missing'. Endpoint autentifikasiyasız
 * olduğu üçün bu, məcburi şərtdir.
 */
export async function health(c: Ctx) {
  let db: 'ok' | 'fail' = 'ok';
  let bootstrapGeneralRoom: 'ok' | 'missing' = 'missing';
  let migrationsApplied = 0;

  try {
    const row = await D(c).prepare(
      `SELECT (SELECT COUNT(*) FROM rooms WHERE id = 'general') AS room,
              (SELECT COUNT(*) FROM d1_migrations)              AS migs`,
    ).first<any>();
    bootstrapGeneralRoom = Number(row?.room || 0) > 0 ? 'ok' : 'missing';
    migrationsApplied = Number(row?.migs || 0);
  } catch {
    // Səbəb QAYTARILMIR — xəta mətni sxem detalı sızdıra bilər.
    db = 'fail';
  }

  const checks = { db, bootstrap_general_room: bootstrapGeneralRoom, migrations_applied: migrationsApplied };
  const ok = db === 'ok' && bootstrapGeneralRoom === 'ok';
  // 503: monitorinq alətləri status kodundan da oxuya bilsin.
  return json({ ok, checks }, ok ? 200 : 503);
}

/* ================= TƏHLÜKƏ MONİTORİNQİ (Bənd 1) ================= */

const SEC_TYPES = ['login_failed', 'login_ok', 'geo_change', 'rate_limit', 'token_reuse',
  'turnstile_failed', 'session_revoked', 'upload_rejected', 'password_changed'];
const SEC_SEVERITIES = ['info', 'warning', 'critical'];

// Son hadisələr — tip/səviyyə filtri + keyset pagination.
export async function securityEvents(c: Ctx) {
  const p = c.url.searchParams;
  const where: string[] = [];
  const vals: unknown[] = [];

  // ⚠ Ağ siyahı: dəyərlər SQL-ə birbaşa düşmür, amma filtr açarı yalnız
  // tanınan siyahıdan qəbul edilir ki, gözlənilməz dəyər sorğunu boşaltmasın.
  const type = p.get('type');
  if (type && SEC_TYPES.includes(type)) { where.push('type = ?'); vals.push(type); }
  const sev = p.get('severity');
  if (sev && SEC_SEVERITIES.includes(sev)) { where.push('severity = ?'); vals.push(sev); }
  const ip = p.get('ip');
  if (ip) { where.push('ip = ?'); vals.push(clampStr(ip, 45)); }

  // Keyset kursoru: (created_at, id) — offset-dən fərqli olaraq yeni hadisə
  // gələndə səhifələr sürüşmür.
  const cursor = p.get('cursor');
  if (cursor) {
    const [ts, id] = cursor.split('_');
    where.push('(created_at < ? OR (created_at = ? AND id < ?))');
    vals.push(parseInt(ts, 10) || 0, parseInt(ts, 10) || 0, id || '');
  }

  const limit = Math.min(parseInt(p.get('limit') || '50', 10) || 50, 100);
  const sql = `SELECT id, type, uid, username, ip, country, city, severity, meta, created_at
                 FROM security_events
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY created_at DESC, id DESC LIMIT ?`;
  const rows = await D(c).prepare(sql).bind(...vals, limit + 1).all<any>();

  const list = rows.results.slice(0, limit);
  const last = list[list.length - 1];
  return json({
    events: list.map(r => ({
      id: r.id, type: r.type, uid: r.uid, username: r.username,
      ip: r.ip, country: r.country, city: r.city, severity: r.severity,
      meta: fromJSON(r.meta, {}), createdAt: r.created_at,
    })),
    cursor: rows.results.length > limit && last ? `${last.created_at}_${last.id}` : null,
  });
}

// Dashboard xülasəsi: sayğaclar + trend sparkline + top IP/ölkə.
export async function securitySummary(c: Ctx) {
  const day = 86_400_000;
  const since24 = now() - day;
  const since7d = now() - 7 * day;

  const [counts, trend, topIps, topCountries] = await D(c).batch<any>([
    // Son 24 saatın tip üzrə bölgüsü — kartlar üçün.
    D(c).prepare(
      `SELECT type, severity, COUNT(*) AS n FROM security_events
        WHERE created_at > ? GROUP BY type, severity`,
    ).bind(since24),
    // Uğursuz giriş trendi (saatlıq, son 24 saat) — sparkline üçün.
    // Saat qovşağı epoch-ms-dən bölmə ilə hesablanır; strftime SQLite-da
    // saniyə gözləyir, bizim vaxtlar isə millisaniyədir.
    D(c).prepare(
      `SELECT (created_at / 3600000) AS hour, COUNT(*) AS n FROM security_events
        WHERE type = 'login_failed' AND created_at > ?
        GROUP BY hour ORDER BY hour`,
    ).bind(since24),
    // Ən çox uğursuz giriş göndərən IP-lər (son 7 gün) — auto-blok namizədləri.
    D(c).prepare(
      `SELECT ip, country, city, COUNT(*) AS n,
              COUNT(DISTINCT username) AS targets, MAX(created_at) AS last_at
         FROM security_events
        WHERE type = 'login_failed' AND created_at > ? AND ip != ''
        GROUP BY ip ORDER BY n DESC LIMIT 10`,
    ).bind(since7d),
    // Coğrafi bölgü — xəritə üçün.
    D(c).prepare(
      `SELECT country, COUNT(*) AS n FROM security_events
        WHERE created_at > ? AND country != ''
        GROUP BY country ORDER BY n DESC LIMIT 20`,
    ).bind(since7d),
  ]);

  const byType: Record<string, number> = {};
  let critical = 0, warning = 0;
  for (const r of counts.results) {
    byType[r.type] = (byType[r.type] || 0) + Number(r.n);
    if (r.severity === 'critical') critical += Number(r.n);
    if (r.severity === 'warning') warning += Number(r.n);
  }

  // Sparkline üçün 24 xanalı sıx massiv (boş saatlar 0) — client-də deşik olmasın.
  const nowHour = Math.floor(now() / 3600000);
  const map = new Map(trend.results.map((r: any) => [Number(r.hour), Number(r.n)]));
  const sparkline = Array.from({ length: 24 }, (_, i) => map.get(nowHour - 23 + i) || 0);

  return json({
    window: { hours: 24 },
    byType, critical, warning,
    total24h: Object.values(byType).reduce((a, b) => a + b, 0),
    sparkline,
    topIps: topIps.results.map((r: any) => ({
      ip: r.ip, country: r.country, city: r.city,
      count: Number(r.n), targets: Number(r.targets), lastAt: r.last_at,
    })),
    countries: topCountries.results.map((r: any) => ({ country: r.country, count: Number(r.n) })),
  });
}

/* ================= UPLOAD (Bənd 14 — server-side validasiya) ================= */
//
// ⚠ TƏHLÜKƏSİZLİK MODELİ: client-in göndərdiyi HEÇ NƏYƏ inanılmır.
// `util.js`-dəki resizer yalnız istifadəçi rahatlığı üçündür — hücumçu onu
// tamamilə keçib birbaşa `POST /api/upload`-a istədiyi baytı göndərə bilər.
// Ona görə burada üç müstəqil yoxlama var:
//   1) ƏSL ölçü — oxunmuş baytların uzunluğu (elan edilən `file.size` deyil)
//   2) ƏSL tip  — magic byte imzası (elan edilən `file.type` deyil)
//   3) PİKSEL ölçüsü — "decompression bomb" (kiçik fayl, nəhəng şəkil) qoruması
//
// R2-yə YALNIZ üç yoxlamadan keçən obyekt yazılır və `contentType` client-in
// dediyi yox, BAYTLARDAN OXUNAN tip olur.

// Şəkil üçün icazə verilən əsl tiplər (magic byte ilə tanınanlar).
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// Mesaj əlavəsində şəkilə əlavə olaraq PDF də olur. ZIP/CSV/JSON/TXT üçün
// etibarlı magic byte yoxlaması yoxdur (mətn formatlarının imzası yoxdur),
// ona görə onlar `application/octet-stream` kimi yazılır və brauzerdə
// HEÇ VAXT icra olunmur — `serveFile` onları attachment kimi verir.
const MSG_SNIFFABLE = [...IMAGE_TYPES, 'application/pdf'];
const MSG_OPAQUE_EXT = ['txt', 'csv', 'json', 'zip'];

// TASK-11 komanda faylları: sənəd arxivi olduğu üçün icazəli formatlar daha
// genişdir. Mətn/ofis formatlarının etibarlı magic byte-ı yoxdur, ona görə
// onlar da `application/octet-stream` kimi yazılır və `serveFile` onları
// məcburi endirmə (attachment) ilə verir — R2 stored-XSS vektoru bağlanır.
const TEAM_SNIFFABLE = [...IMAGE_TYPES, 'application/pdf'];
const TEAM_OPAQUE_EXT = [
  'txt', 'csv', 'json', 'zip', 'md', 'log', 'xml', 'yml', 'yaml',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  'fig', 'sketch', 'psd', 'ai', 'svg',
  'js', 'ts', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'sql', 'sh',
];
const TEAM_MAX_SIZE = 10_485_760; // 10 MB

// Maksimum piksel ölçüsü. 8000×8000 = 64 MP — real avatar/post şəkli üçün
// fövqəladə boldur, amma RAM partladan 40000×40000 bombanı kəsir.
const MAX_DIM = 8000;

export async function upload(c: Ctx) {
  const kind = c.url.searchParams.get('kind') || 'post';
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return badReq('Fayl yoxdur.');

  // TASK-11: komanda faylı — açar `teams/{teamId}/{category}/...` olur və
  // yükləyən şəxsin həmin komandada `manage_files` icazəsi yoxlanılır.
  // Bundan əvvəl komanda faylları `kind=post` ilə gedirdi: yalnız şəkil,
  // 2 MB limit və `posts/{userId}/` açarı — yəni sənəd arxivi işləmirdi.
  let teamCtx: { teamId: string; category: string } | null = null;
  if (kind === 'team') {
    const teamId = c.url.searchParams.get('teamId') || '';
    if (!teamId) return badReq('teamId tələb olunur.');

    const { TeamService } = await import('./services/team/team.service');
    const team = await new TeamService(c.env).getTeam(teamId);
    if (!team) return badReq('Komanda tapılmadı.');

    const { requireTeamPermission } = await import('./middleware/team-auth');
    const denied = await requireTeamPermission(c, String(team.id), 'manage_files');
    if (denied) return denied;

    const { normalizeCategory } = await import('./services/team/file.service');
    teamCtx = { teamId: String(team.id), category: normalizeCategory(c.url.searchParams.get('category')) };
  }

  const maxSize = kind === 'avatar' ? 1_048_576 : kind === 'team' ? TEAM_MAX_SIZE : 2_097_152;
  const mb = kind === 'avatar' ? '1' : kind === 'team' ? '10' : '2';

  const reject = async (msg: string, reason: string) => {
    await logSecurityEvent(c.env, c.req, {
      type: 'upload_rejected', uid: c.user!.id, username: c.user!.username, severity: 'warning',
      meta: { reason, kind, declared: file.type, name: String(file.name || '').slice(0, 80) },
    });
    return badReq(msg);
  };

  // Baytları oxu. Limit 1–2 MB olduğu üçün buferləmək təhlükəsizdir və
  // imza + ölçü yoxlaması onsuz da faylın başını tələb edir.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > maxSize) return reject(`Fayl ${mb} MB-dan böyükdür.`, 'too_large');
  if (bytes.length === 0) return reject('Fayl boşdur.', 'empty');

  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || '';
  const sniffed = sniffType(bytes);

  const opaqueOk =
    (kind === 'msg' && MSG_OPAQUE_EXT.includes(ext)) ||
    (kind === 'team' && TEAM_OPAQUE_EXT.includes(ext));

  let contentType: string;
  if (opaqueOk && !sniffed) {
    // İmzası olmayan sənəd formatı — məzmununa zəmanət vermirik, ona görə
    // brauzerin təxmin etməsinə də imkan vermirik.
    contentType = 'application/octet-stream';
  } else {
    if (!sniffed) return reject('Bu fayl tipi dəstəklənmir.', 'unknown_signature');
    const allowed = kind === 'msg' ? MSG_SNIFFABLE : kind === 'team' ? TEAM_SNIFFABLE : IMAGE_TYPES;
    if (!allowed.includes(sniffed)) return reject('Bu fayl tipi dəstəklənmir.', 'type_not_allowed');
    // Elan edilən tip əsl tiplə uyuşmursa bu, sadəcə səhv deyil — qəsdən
    // saxtakarlıq əlamətidir. Yükləməni dayandırıb hadisəni jurnala yazırıq.
    if (file.type && file.type !== sniffed) {
      return reject('Fayl tipi məzmunla uyğun gəlmir.', 'mime_mismatch');
    }
    contentType = sniffed;
  }

  // Piksel ölçüsü yoxlaması — yalnız şəkillərdə.
  if (sniffed && IMAGE_TYPES.includes(sniffed)) {
    const dim = imageDimensions(bytes, sniffed);
    if (!dim || dim.w <= 0 || dim.h <= 0) return reject('Şəkil oxuna bilmədi.', 'bad_dimensions');
    if (dim.w > MAX_DIM || dim.h > MAX_DIM) {
      return reject(`Şəkil ölçüsü ${MAX_DIM}×${MAX_DIM} pikseldən böyük ola bilməz.`, 'dimensions_too_large');
    }
  }

  const safeName = (file.name || 'file').replace(/[^\w.\-]/g, '_').slice(0, 80);
  // PDR-dəki komanda qovluq strukturu: /teams/{team_id}/{category}/...
  const key = teamCtx
    ? `teams/${teamCtx.teamId}/${teamCtx.category}/${now()}-${uuid().slice(0, 8)}-${safeName}`
    : `${kind === 'avatar' ? 'avatars' : kind === 'msg' ? 'msgfiles' : 'posts'}/${c.user!.id}/${now()}-${uuid().slice(0, 8)}-${safeName}`;
  await c.env.FILES.put(key, bytes, { httpMetadata: { contentType } });
  return json({
    key, url: fileUrl(key), fileName: file.name, fileSize: bytes.length, mimeType: contentType,
    category: teamCtx?.category,
  });
}

export async function serveFile(c: Ctx, key: string) {
  const obj = await c.env.FILES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers as any);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', obj.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  // Yalnız imzası doğrulanmış şəkillər brauzerdə açılır (inline).
  // Qalan hər şey (PDF, ZIP, mətn — tipi zəmanətsiz olanlar) məcburi endirilir:
  // inline açılsaydı R2 stored-XSS vektoru olardı. `nosniff` ikinci qat qorumadır.
  const ct = headers.get('Content-Type') || '';
  headers.set('Content-Disposition', IMAGE_TYPES.includes(ct) ? 'inline' : 'attachment');
  return new Response(obj.body as any, { headers });
}
