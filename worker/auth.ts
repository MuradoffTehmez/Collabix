// Autentifikasiya: PBKDF2 (WebCrypto) parol heşi + HS256 access JWT + rotated refresh token.
//
// TASK-8 / Bənd 15 — token modeli:
//   • ACCESS TOKEN  — 15 dəqiqəlik imzalanmış JWT, `cx_at` cookie-də, Path=/.
//                     Stateless deyil: hər sorğuda `sessions` sətri ilə yoxlanılır
//                     (aşağıda `resolveUser`-dəki JOIN — əlavə sorğu XƏRCİ YOXDUR,
//                     istifadəçi sətri onsuz da çəkilirdi).
//   • REFRESH TOKEN — 30 günlük təsadüfi 256-bit sətir, `cx_rt` cookie-də,
//                     Path=/api/auth (yəni adi API sorğularında ŞƏBƏKƏYƏ ÇIXMIR).
//                     D1-də yalnız SHA-256 heşi saxlanılır; hər istifadədə ROTASİYA olunur.
//
// Niyə ikisi birdən? Tək 30-günlük JWT oğurlansa 30 gün etibarlıdır və geri
// çağırıla bilmir. Bu modeldə oğurlanmış access token 15 dəqiqədə ölür, refresh
// token isə istifadə edilən kimi dəyişir → təkrar istifadə AŞKARLANIR (`prev_refresh_hash`).
import { Env, uuid, now } from './util';
import { reqInfo, logSecurityEvent } from './security';

/**
 * PBKDF2 iterasiya köçürməsi — AUDIT M-2 (AUDIT-TASK-6 §C-2).
 *
 * OWASP 2023: SHA-256 üçün 600 000. Köhnə hesablar 100 000 ilə yazılıb və
 * kütləvi yenidən heşləmə MÜMKÜN DEYİL (bazada açıq parol yoxdur) → köçürmə
 * girişdə TƏDRİCƏN baş verir:
 *
 *   1. `users.pass_iter` hər hesabın ÖZ iterasiyasını saxlayır (0023 miqrasiyası).
 *   2. `verifyPassword` sətirdəki dəyərlə yoxlayır — sabitlə YOX.
 *   3. Uğurlu girişdə `pass_iter < PBKDF2_ITER` olarsa parol yeni iterasiya
 *      ilə yenidən heşlənir və sütun yenilənir.
 *   4. Yeni qeydiyyat həmişə `PBKDF2_ITER` işlədir.
 *
 * ⚠ Köhnə hesablar köçürülənə qədər işləməyə DAVAM EDİR — bu, kütləvi
 * kilidlənmənin qarşısını alan yeganə mexanizmdir.
 */
const PBKDF2_ITER = 600_000;

/** Köçürməmiş hesabların iterasiyası — `pass_iter` sütununun default-u ilə eyni. */
export const PBKDF2_ITER_LEGACY = 100_000;
const ACCESS_TTL = 15 * 60;              // 15 dəqiqə (saniyə)
const REFRESH_TTL = 60 * 60 * 24 * 30;   // 30 gün (saniyə)

export const AT_COOKIE = 'cx_at';
export const RT_COOKIE = 'cx_rt';
// Köhnə 30-günlük tək-token cookie-si. TASK-8-dən ƏVVƏLKİ sessiyalar hələ də
// bununla gəlir — dərhal silmirik, əks halda deploy anında BÜTÜN istifadəçilər
// çıxarılardı. `me()` onları səssizcə yeni cüt-token modelinə köçürür.
export const LEGACY_COOKIE = 'cx_sess';

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uDecode = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

/* ---------- PBKDF2 ---------- */
export async function hashPassword(
  password: string, saltHex?: string, iterations: number = PBKDF2_ITER,
): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  if (!salt) throw new Error('etibarsız salt');
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key, 256,
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt as Uint8Array), iterations };
}
export async function verifyPassword(
  password: string, hash: string, salt: string, iterations: number = PBKDF2_ITER_LEGACY,
): Promise<boolean> {
  // AUDIT M-17 — FAIL-CLOSED. Əvvəl pozulmuş salt `hexToBytes`-da
  // `null.map()` → TypeError → **500** verirdi. Bu, oracle idi: hücumçu cavab
  // KODUNDAN hansı hesabların pozulmuş sətrə malik olduğunu öyrənə bilərdi
  // (500 = pozulmuş, 401 = sadəcə səhv parol).
  // İndi belə hal adi "parol yanlışdır" kimi görünür.
  if (!hash || !salt || !hexToBytes(salt)) return false;
  // M-2: iterasiya SƏTİRDƏN gəlir, sabitdən yox. Köhnə hesab 100 000 ilə
  // yazılıbsa 600 000 ilə yoxlanmamalıdır — əks halda düzgün parol da
  // uyğunsuz heş verər və istifadəçi kilidlənər.
  const { hash: h } = await hashPassword(password, salt, iterations);
  return timingSafeEqual(h, hash);
}

/**
 * Girişdən sonra parolu yeni iterasiya ilə yenidən heşləyir — M-2 köçürməsi.
 *
 * ⚠ Yalnız PAROL DOĞRULANDIQDAN sonra çağırılmalıdır (açıq parol yalnız
 * həmin anda mövcud olur). `pass_iter` artıq güncəldirsə heç nə etmir.
 *
 * Çağıran tərəf bunu `ctx.waitUntil` ilə işlədir: yenidən heşləmə 600 000
 * iterasiyadır və cavabı GÖZLƏTMƏMƏLİDİR.
 */
export async function upgradePasswordHash(
  env: Env, uid: string, password: string, currentIter: number,
): Promise<void> {
  if (currentIter >= PBKDF2_ITER) return;
  const { hash, salt, iterations } = await hashPassword(password);
  await env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iter = ? WHERE id = ?')
    .bind(hash, salt, iterations, uid).run();
}
const bytesToHex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, '0')).join('');

/** Hex sətri baytlara çevirir. Format pozulubsa `null` — istisna ATMIR (M-17). */
function hexToBytes(h: string): Uint8Array | null {
  const m = (h || '').match(/.{2}/g);
  if (!m || m.length * 2 !== (h || '').length) return null;
  const bytes = m.map(x => parseInt(x, 16));
  return bytes.some(Number.isNaN) ? null : Uint8Array.from(bytes);
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/* ---------- JWT (HS256) ---------- */
async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signJWT(env: Env, payload: Record<string, unknown>): Promise<string> {
  const header = b64u(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(env.JWT_SECRET);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${b64u(sig)}`;
}
export async function verifyJWT(env: Env, token: string): Promise<Record<string, any> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const key = await hmacKey(env.JWT_SECRET);
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      'HMAC', key, b64uDecode(parts[2]) as BufferSource, enc.encode(`${parts[0]}.${parts[1]}`),
    );
  } catch { return null; }   // pozulmuş base64 → atob throw edir
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64uDecode(parts[1])));
    if (typeof payload.exp === 'number' && payload.exp * 1000 < now()) return null;
    return payload;
  } catch { return null; }
}

/* ---------- refresh token ---------- */
// 256-bit entropiya — lüğət/brute-force hücumu praktiki olaraq mümkün deyil.
const newRefreshToken = () => b64u(crypto.getRandomValues(new Uint8Array(32)));

async function sha256Hex(s: string): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
}

/* ---------- sessiya yaratma / rotasiya / ləğv ---------- */

export interface TokenPair { accessToken: string; refreshToken: string; sid: string }

async function issueAccess(env: Env, uid: string, sid: string): Promise<string> {
  const iat = Math.floor(now() / 1000);
  return signJWT(env, { sub: uid, sid, typ: 'at', iat, exp: iat + ACCESS_TTL });
}

// Yeni sessiya (giriş / qeydiyyat / OAuth). Cihaz konteksti `request.cf`-dən gəlir.
export async function createSession(env: Env, req: Request, uid: string): Promise<TokenPair> {
  const sid = uuid();
  const refreshToken = newRefreshToken();
  const info = reqInfo(req);
  const t = now();
  await env.DB.prepare(
    `INSERT INTO sessions (id, uid, refresh_hash, prev_refresh_hash, ua, ip, city, country,
       created_at, last_seen, expires_at, revoked)
     VALUES (?,?,?,'',?,?,?,?,?,?,?,0)`,
  ).bind(
    sid, uid, await sha256Hex(refreshToken),
    info.ua, info.ip, info.city, info.country,
    t, t, t + REFRESH_TTL * 1000,
  ).run();
  return { accessToken: await issueAccess(env, uid, sid), refreshToken, sid };
}

export type RotateResult =
  | { ok: true; pair: TokenPair; uid: string }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'revoked' | 'reuse' | 'blocked' };

// Refresh token-i yeni cütlə əvəz edir (rotasiya).
//
// ⚠ `expires_at` UZADILMIR. Rotasiya sessiyanı sonsuza qədər canlı saxlamamalıdır —
// əks halda oğurlanmış token-i avtomatik yeniləyən bot əbədi giriş qazanardı.
// 30 gündən sonra istifadəçi yenidən parol daxil etməlidir.
export async function rotateSession(env: Env, req: Request): Promise<RotateResult> {
  const raw = readCookie(req, RT_COOKIE);
  if (!raw) return { ok: false, reason: 'missing' };
  const hash = await sha256Hex(raw);

  const row = await env.DB.prepare(
    'SELECT id, uid, expires_at, revoked FROM sessions WHERE refresh_hash = ?',
  ).bind(hash).first<any>();

  if (!row) {
    // Cari heş uyğun gəlmədi. Bəlkə bu ARTIQ İSTİFADƏ OLUNMUŞ token-dir?
    // Əgər elədirsə, token iki tərəfdədir → sessiya kompromiss olunub.
    const stale = await env.DB.prepare(
      'SELECT id, uid FROM sessions WHERE prev_refresh_hash = ? AND prev_refresh_hash != \'\'',
    ).bind(hash).first<any>();
    if (stale) {
      await revokeAllSessions(env, stale.uid, 'reuse');
      await logSecurityEvent(env, req, {
        type: 'token_reuse', uid: stale.uid, severity: 'critical',
        meta: { sid: stale.id, action: 'bütün sessiyalar ləğv edildi' },
      });
      return { ok: false, reason: 'reuse' };
    }
    return { ok: false, reason: 'invalid' };
  }

  if (row.revoked) return { ok: false, reason: 'revoked' };
  if (Number(row.expires_at) < now()) return { ok: false, reason: 'expired' };

  const blocked = await env.DB.prepare('SELECT blocked FROM users WHERE id = ?').bind(row.uid).first<any>();
  if (!blocked || blocked.blocked) return { ok: false, reason: 'blocked' };

  const next = newRefreshToken();
  const info = reqInfo(req);
  await env.DB.prepare(
    `UPDATE sessions SET refresh_hash = ?, prev_refresh_hash = ?, last_seen = ?,
       ip = ?, city = ?, country = ?, ua = ?
     WHERE id = ?`,
  ).bind(await sha256Hex(next), hash, now(), info.ip, info.city, info.country, info.ua, row.id).run();

  return {
    ok: true, uid: row.uid,
    pair: { accessToken: await issueAccess(env, row.uid, row.id), refreshToken: next, sid: row.id },
  };
}

// Tək sessiyanı ləğv et. Sətir SİLİNMİR (`revoked = 1` işarələnir) — belədə
// istifadəçi "bu cihaz çıxarıldı" tarixçəsini görə bilir və reuse aşkarlaması
// üçün heşlər yerində qalır. Cron təmizləməsi vaxtı bitmişləri sonra silir.
export async function revokeSession(env: Env, sid: string, by = 'user'): Promise<void> {
  await env.DB.prepare(
    'UPDATE sessions SET revoked = 1, revoked_at = ?, revoked_by = ? WHERE id = ? AND revoked = 0',
  ).bind(now(), by, sid).run();
}

// İstifadəçinin bütün sessiyalarını ləğv et (parol dəyişmə, blok, token reuse).
// `exceptSid` verilsə həmin cihaz qalır — "hamısını çıxart (bu istisna)" üçün.
export async function revokeAllSessions(
  env: Env, uid: string, by = 'user', exceptSid?: string | null,
): Promise<void> {
  const sql = exceptSid
    ? 'UPDATE sessions SET revoked = 1, revoked_at = ?, revoked_by = ? WHERE uid = ? AND revoked = 0 AND id != ?'
    : 'UPDATE sessions SET revoked = 1, revoked_at = ?, revoked_by = ? WHERE uid = ? AND revoked = 0';
  const stmt = env.DB.prepare(sql).bind(...(exceptSid ? [now(), by, uid, exceptSid] : [now(), by, uid]));
  await stmt.run();
  // Köhnə modeldəki KV sessiyaları da təmizlənməlidir, yoxsa `cx_sess` cookie-si
  // olan cihaz bloklamadan/parol dəyişməsindən sonra da içəridə qalardı.
  await destroyLegacySessions(env, uid);
}

// Geriyə uyğunluq adı — mövcud çağırış yerləri (blok, temp-password, bulk) dəyişmir.
export const destroyAllSessions = (env: Env, uid: string) => revokeAllSessions(env, uid, 'admin');

/* ---------- köhnə (TASK-8 öncəsi) KV sessiyaları ---------- */
// Yalnız KV-dəki köhnə sessiyaları silir, D1-dəki yeni sessiyalara TOXUNMUR.
// `me()`-dəki miqrasiya bunu işlədir: köhnə cookie ilə gələn cihaz yeni modelə
// keçirilərkən istifadəçinin BAŞQA cihazlarındakı yeni sessiyalar sağ qalmalıdır.
export async function destroyLegacySessions(env: Env, uid: string): Promise<void> {
  const list = await env.SESSIONS.list({ prefix: `sess:${uid}:` });
  await Promise.all(list.keys.map(k => env.SESSIONS.delete(k.name)));
}

/* ---------- cookie-lər ---------- */
// Ortaq atributlar. `__Host-` prefiksi İSTİFADƏ OLUNMUR, çünki o, Path=/ tələb
// edir — refresh cookie-sini isə qəsdən Path=/api/auth ilə məhdudlaşdırırıq.
const BASE = 'HttpOnly; Secure; SameSite=Lax';

export const accessCookie = (token: string) =>
  `${AT_COOKIE}=${token}; ${BASE}; Path=/; Max-Age=${ACCESS_TTL}`;

// SameSite=Strict — refresh token yalnız öz saytımızdan gələn sorğuda getsin.
// Path=/api/auth — feed, upload, mesaj sorğularında ŞƏBƏKƏDƏN KEÇMİR;
// yəni token-in ifşa səthi bütün API-dən 3 endpoint-ə enir.
export const refreshCookie = (token: string) =>
  `${RT_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${REFRESH_TTL}`;

export const sessionCookies = (p: TokenPair): string[] => [accessCookie(p.accessToken), refreshCookie(p.refreshToken)];

// Çıxışda hər üç cookie silinir (köhnə `cx_sess` daxil) — atributlar
// qoyulan andakı ilə EYNİ olmalıdır, əks halda brauzer cookie-ni tapmır.
export const clearCookies = (): string[] => [
  `${AT_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  `${RT_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0`,
  clearLegacyCookie(),
];

// Yalnız köhnə cookie-ni silir — miqrasiyada yeni cütlə BİRLİKDƏ göndərilir,
// yoxsa `cx_sess` brauzerdə qalıb hər sorğuda boş yerə daşınardı.
export const clearLegacyCookie = () =>
  `${LEGACY_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('Cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

/* ---------- istifadəçi həlli ---------- */

export interface Resolved { user: any; sid: string | null; legacy: boolean }

// Sorğudan istifadəçini həll et.
//
// Yeni yol:  cx_at (JWT) → sessions sətri ilə birgə tək D1 sorğusu.
//            LEFT JOIN sayəsində ləğv olunmuş sessiya ANİ 401 verir — KV
//            negative-cache gecikməsi (≈60 s) yoxdur.
// Köhnə yol: cx_sess (JWT + KV) — yalnız keçid dövrü üçün; `me()` köçürür.
export async function resolveUser(env: Env, req: Request): Promise<Resolved | null> {
  const at = readCookie(req, AT_COOKIE)
    || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || null;

  if (at) {
    const payload = await verifyJWT(env, at);
    if (payload?.sub && payload?.sid) {
      const row = await env.DB.prepare(
        `SELECT u.*, s.revoked AS s_revoked, s.expires_at AS s_expires
           FROM users u LEFT JOIN sessions s ON s.id = ?1 AND s.uid = ?2
          WHERE u.id = ?2`,
      ).bind(payload.sid, payload.sub).first<any>();
      // s_revoked === null → sessiya sətri yoxdur (silinib) → token etibarsız.
      if (row && !row.blocked && row.s_revoked === 0 && Number(row.s_expires) > now()) {
        delete row.s_revoked; delete row.s_expires;
        return { user: row, sid: payload.sid, legacy: false };
      }
      return null;
    }
  }

  // --- keçid dövrü: köhnə tək-token sessiyası ---
  const legacy = readCookie(req, LEGACY_COOKIE);
  if (!legacy) return null;
  const payload = await verifyJWT(env, legacy);
  if (!payload?.sub || !payload?.jti) return null;
  const live = await env.SESSIONS.get(`sess:${payload.sub}:${payload.jti}`);
  if (!live) return null;
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first<any>();
  if (!row || row.blocked) return null;
  return { user: row, sid: null, legacy: true };
}

/* ---------- rate limit (KV, sadə pəncərə) ---------- */

/**
 * Rate limit səbətləri — AUDIT-TASK-4 / H-4.
 *
 * `critical: true` = TƏHLÜKƏSİZLİK kontroludur, atomiklik TƏLƏB EDİR.
 *   ⚠ Hazırkı KV limiter atomik DEYİL (AUDIT-2026-07-26 / H-3): oxu ilə yazı
 *   arasında yarış var, paralel sorğularda sayğac sızır. Yəni bu səbətlər real
 *   dünyada elan edilən limitdən ZƏİFDİR və TƏK müdafiə kimi işlədilməməlidir.
 *   AUDIT-TASK-9 atomik limiterə keçir; ora qədər `security.ts`-dəki
 *   `recentFailures` və Turnstile əlavə qat kimi qalır.
 *
 * `critical: false` = XƏRC qoruyucusudur (maliyyə DoS, kvota). Təxmini sayma
 *   kifayətdir: 20 əvəzinə 25 AI çağırışı keçsə təsir kiçikdir.
 *
 * `key` — açar kimliyi (AUDIT-TASK-4 §4.5):
 *   'auto' — autentifikasiya olunubsa `uid`, olunmayıbsa IP. Korporativ NAT və
 *            ya mobil operator arxasındakı 50 istifadəçi eyni IP-dən gəlir;
 *            yalnız IP ilə açarlasaq default `read` səbəti onları kütləvi 429-a
 *            salardı.
 *   'ip'    — HƏMİŞƏ IP. Login/qeydiyyat üçün məcburidir: orada uid hələ məlum
 *            deyil və hücumçu onsuz da fərqli istifadəçi adları sınayır.
 */
export interface RateBucketCfg {
  limit: number;
  windowSec: number;
  critical: boolean;
  key: 'auto' | 'ip';
}

export const RL = {
  /* ═══ TƏHLÜKƏSİZLİK kontrolları (atomiklik tələb edir — H-3 / Task 9) ═══ */

  // Brute-force qapısı. Aşağı limit qəsdəndir; qanuni istifadəçi 5 dəqiqədə
  // 10 dəfə giriş etmir.
  auth:     { limit: 10,   windowSec: 300,  critical: true,  key: 'ip'   },
  // 15 dəq access TTL → normal istifadədə saatda ~4 refresh. 60/5dəq bir neçə
  // tab + bir neçə cihaz üçün geniş ehtiyatdır.
  refresh:  { limit: 60,   windowSec: 300,  critical: true,  key: 'ip'   },
  // Fayl yükləmə: R2 yazısı + antivirus/validasiya xərci.
  upload:   { limit: 30,   windowSec: 3600, critical: true,  key: 'auto' },

  /* ═══ XƏRC qoruyucuları (təxmini sayma kifayətdir) ═══ */

  // Anonim publik formalar (newsletter, contact) — spam qapısı.
  form:     { limit: 5,    windowSec: 3600, critical: false, key: 'ip'   },
  // Mutasiyalar. D1 yazısı = kvota. 60/dəq insan sürətindən onlarla dəfə
  // yuxarıdır (ən sıx UI axını — mesaj yazmaq — dəqiqədə ~10-15 sorğudur).
  write:    { limit: 60,   windowSec: 60,   critical: false, key: 'auto' },
  // DEFAULT səbət (bax `DEFAULT_RL`, worker/index.ts).
  //
  // 600/dəq necə seçildi (AUDIT-TASK-4 §4.0/Sual 6 ölçmələri):
  //   ən yüklü TƏK tab (mesajlar səhifəsi, DM açıq) ≈ 44 sorğu/dəq
  //     = DM mesajları 3s (20) + söhbətlər 5s (12) + bildirişlər 8s (7,5)
  //       + presence GET/POST 30s (4)
  //   admin paneli tabı ≈ 37 sorğu/dəq (9 paralel poll)
  //   4 tab paralel ≈ 180 sorğu/dəq + səhifə açılışı partlayışları
  // Auditin təklifi 300 idi — real profilə cəmi 1,7× ehtiyat verirdi, yəni
  // 6-7 tab açan istifadəçi 429 alardı. 600 hücumçunu (saniyədə 10+ sorğu
  // davamlı) hələ də kəsir, istifadəçini isə kəsmir.
  read:     { limit: 600,  windowSec: 60,   critical: false, key: 'auto' },
  // Presence heartbeat (POST 30s) + izləmə (GET 30s) = 5 dəqiqədə 20 sorğu.
  // Auditin təklifi 60/300s idi — cəmi 3 tab açan istifadəçini kəsirdi.
  // 150 → ~7 tab ehtiyatı. Polling→WS keçidi Task 10-dur; ora qədər səxavətli.
  presence: { limit: 150,  windowSec: 300,  critical: false, key: 'auto' },
  // 🔴 Workers AI çağırışı = REAL PUL. Ən sıx səbət qəsdən budur.
  ai:       { limit: 20,   windowSec: 3600, critical: false, key: 'auto' },
  // Embedding + Vectorize sorğusu. AI-dan ucuzdur, `read`-dən bahalıdır.
  search:   { limit: 60,   windowSec: 3600, critical: false, key: 'auto' },
  // Admin paneli 9 paralel poll işlədir və toplu əməliyyatlar edir.
  // ❌ Admin YOLU BYPASS EDİLMİR: hesab ələ keçirilsə limitsiz admin yolu
  // hücumçuya sərbəst vasitə verərdi — sadəcə səxavətli limit verilir.
  admin:    { limit: 300,  windowSec: 60,   critical: false, key: 'auto' },
  // Tam cədvəl skanı / ixrac: `COUNT(*)` × 4, CSV ixracı, GDPR export.
  // Bunlar səhifə açılışında çağırılmır — istifadəçi düyməyə basır.
  heavy:    { limit: 20,   windowSec: 3600, critical: false, key: 'auto' },
  // R2 statik asset axını (`/files/*`). Bir feed səhifəsi 20+ obyekt çəkir;
  // `read` səbətinə salınsaydı normal gəzinti bir neçə səhifədən sonra kəsilərdi.
  asset:    { limit: 1200, windowSec: 60,   critical: false, key: 'auto' },
  // Arxivdən oxu (AUDIT-TASK-8 §8.1). `read` səbətindən AYRIDIR, çünki xərci
  // tamam başqadır: hər sorğu R2-dən obyekt çəkib gzip açır (ölçüldü: tipik
  // 4,4 ms, ən pis 54,6 ms CPU + R2 sorğu haqqı), halbuki `read` sadəcə D1-ə
  // dəyir. ⚠ Bu səbət YALNIZ arxiv yolu FAKTİKİ olaraq işə düşəndə sayılır —
  // adi mesaj oxusu (`before` yoxdur və ya D1 kifayət edir) ona toxunmur, əks
  // halda normal söhbət polling-i istifadəçini kəsərdi.
  // 120/saat: 120 mesajlıq səhifə ilə saatda ~14 400 mesaj geri getmək olar —
  // real vərəqləmə üçün bol, avtomatlaşdırılmış kütləvi çəkmə üçün dar.
  archive:  { limit: 120,  windowSec: 3600, critical: false, key: 'auto' },
} satisfies Record<string, RateBucketCfg>;

export type RateBucket = keyof typeof RL;

/**
 * Rate limit açarı üçün UCUZ kimlik: yalnız JWT imzasını yoxlayır, D1-ə GETMİR.
 *
 * `resolveUser`-dən ƏVVƏL çağırılır ki, limiterin mövcud sırası qorunsun
 * (anonim hücum baza sorğusuna çatmadan kəsilir), amma açar yenə də `uid` üzrə
 * olsun. HMAC yoxlaması I/O tələb etmir — əlavə gecikmə mikrosaniyələrlədir.
 */
export async function peekUid(env: Env, req: Request): Promise<string | null> {
  const at = readCookie(req, AT_COOKIE)
    || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || null;
  if (!at) return null;
  try {
    const p = await verifyJWT(env, at);
    return p?.sub ? String(p.sub) : null;
  } catch {
    return null;   // bozuk token → anonim kimi davran, IP üzrə açarlanır
  }
}

/**
 * IPv6-nı `/64` prefiksi üzrə qruplaşdırır.
 *
 * Bir istifadəçiyə /64 daxilində milyonlarla ünvan düşür — tam ünvan üzrə
 * açarlamaq limiti mənasızlaşdırır (hücumçu hər sorğuda ünvan dəyişir).
 * IPv4 olduğu kimi qalır.
 */
export function normalizeIp(ip: string): string {
  const raw = (ip || '').trim().toLowerCase();
  if (!raw) return 'unknown';
  if (!raw.includes(':')) return raw;

  const [head, tail = ''] = raw.split('::');
  const h = head ? head.split(':').filter(Boolean) : [];
  const t = tail ? tail.split(':').filter(Boolean) : [];
  const fill = raw.includes('::')
    ? Array(Math.max(0, 8 - h.length - t.length)).fill('0')
    : [];
  return [...h, ...fill, ...t].slice(0, 4).join(':') + '::/64';
}

/**
 * Test mühitində limitləri boşaldan çarpan.
 *
 * ⚠ Çarpan YALNIZ qeyri-production mühitdə tətbiq olunur. `ENVIRONMENT`
 * 'production' olduqda HƏMİŞƏ 1 qaytarılır — yəni səhvən və ya qəsdən
 * qoyulmuş konfiq canlı mühitdəki limitləri ZƏİFLƏDƏ BİLMİR.
 * Test mühiti bunu `wrangler dev --var ENVIRONMENT:test` ilə seçir
 * (bax playwright.config.ts).
 *
 * Çarpan açar sinfinə görə fərqlidir (AUDIT-TASK-4 §4.5-dən sonra):
 *
 *   IP üzrə (20×) — E2E dəstində BÜTÜN virtual "cihazlar" eyni 127.0.0.1-dən
 *     gəlir: onlarla hesab, paralel kontekstlər, uğursuz giriş ssenariləri.
 *     Bu, real istifadəçi profili deyil və dəst öz-özünü bloklayardı.
 *
 *   uid üzrə (5×) — burada hesablar artıq QARIŞMIR (hər test istifadəçisinin
 *     öz sayğacı var), ona görə 20× həddindən artıqdır və rate limit
 *     testlərini praktiki olaraq mümkünsüz edirdi. 5× yenə də ehtiyat saxlayır:
 *     bir test hesabı bir neçə spec-də ardıcıl işlədilir və bu da real insan
 *     profili deyil.
 */
const rlFactor = (env: Env, cfg: RateBucketCfg) =>
  env.ENVIRONMENT === 'production' ? 1 : (cfg.key === 'ip' ? 20 : 5);

export interface RateLimitResult {
  ok: boolean;
  /** `Retry-After` başlığı üçün — cari pəncərənin bitməsinə qalan saniyə. */
  retryAfter: number;
  /** Diaqnostika: qərarı hansı mexanizm verdi (AUDIT-TASK-9 / A-2 telemetriya). */
  mechanism: RlMechanism;
}

export type RlMechanism = 'do' | 'kv';

/**
 * 🔴 MÜVƏQQƏTİ GERİ QAYTARMA BAYRAĞI — AUDIT-TASK-9 / H-3, §5.3.
 *
 * `RL_MECHANISM=kv` bütün səbətləri köhnə (atomik OLMAYAN) KV yoluna qaytarır.
 * Yalnız miqrasiya dövründəki gözlənilməz problem üçün nəzərdə tutulub.
 *
 * ⛔ SİLİNMƏ ÖHDƏLİYİ: atomik mexanizm istehsalda 2 həftə stabil işlədikdən
 *    sonra BU FUNKSİYA, `RL_MECHANISM` var-ı və aşağıdakı `kvHit` yolu
 *    SİLİNMƏLİDİR. Əsas: AUDIT-TASK-1-in `ARCHIVE_HOT_DAYS = 3650` dərsi —
 *    "müvəqqəti" bayraq öhdəliklə yazılmasa illərlə qalır və gizli qüsur örtür.
 *
 * Bayraq QOYULMAYANDA hədəf vəziyyət işləyir: təhlükəsizlik → DO, xərc → KV.
 * `RL_MECHANISM=do` xərc səbətlərini DO-ya KÖÇÜRMÜR — taksonomiya qərarı
 * (AUDIT-TASK-4 §4.1) qəsdən qorunur.
 */
function mechanismFor(env: Env, cfg: RateBucketCfg): RlMechanism {
  if ((env.RL_MECHANISM || '').toLowerCase() === 'kv') return 'kv';
  if (!cfg.critical) return 'kv';
  // Binding ÜMUMİYYƏTLƏ yoxdursa (konfiq hələ tətbiq olunmayıb) KV-yə düşürük.
  // Bu, `catch` blokundakı FAIL-CLOSED qaydasından FƏRQLİDİR və qəsdəndir:
  // runtime nasazlığı ilə konfiq çatışmazlığı eyni şey deyil — sonuncuda
  // fail-closed bütün girişi bloklayıb saytı özümüz çökdürərdik.
  if (!env.RATE_LIMIT_DO) {
    console.error('RATE_LIMIT_DO binding-i yoxdur — təhlükəsizlik səbəti KV-yə düşdü', cfg);
    return 'kv';
  }
  return 'do';
}

export async function rateLimit(
  env: Env, req: Request, bucket: RateBucket, uid?: string | null,
): Promise<RateLimitResult> {
  const cfg = RL[bucket];
  const limit = cfg.limit * rlFactor(env, cfg);
  const nowSec = Math.floor(now() / 1000);
  const win = Math.floor(nowSec / cfg.windowSec);
  // Sabit pəncərə: sayğac pəncərə sonunda sıfırlanır, ona görə "nə vaxt təkrar
  // cəhd et" sualının dəqiq cavabı pəncərənin bitməsinə qalan vaxtdır.
  // ⚠ Bu hesab HƏR İKİ mexanizm üçün eynidir — `Retry-After` semantikası
  // miqrasiyada dəyişmir (AUDIT-TASK-4 §4.6 reqressiyası).
  const retryAfter = cfg.windowSec - (nowSec % cfg.windowSec);

  const identity = cfg.key === 'auto' && uid
    ? `u:${uid}`
    : `i:${normalizeIp(req.headers.get('CF-Connecting-IP') || '')}`;
  const mechanism = mechanismFor(env, cfg);

  try {
    const ok = mechanism === 'do'
      // Pəncərə DO-ya ARQUMENT kimi ötürülür, açara QATILMIR: əks halda hər
      // pəncərədə yeni DO instansı yaranar və köhnələri storage-da qalardı.
      ? await env.RATE_LIMIT_DO!
        .get(env.RATE_LIMIT_DO!.idFromName(`rl:${bucket}:${identity}`))
        .hit(win, limit, cfg.windowSec)
      : await kvHit(env, `rl:${bucket}:${identity}:${win}`, limit, cfg.windowSec);
    return { ok, retryAfter, mechanism };
  } catch (e) {
    // §5.3 — nasazlıqda davranış səbətin SİNFİNDƏN asılıdır:
    //   xərc qoruyucusu → FAIL-OPEN (nasazlıq bütün saytı çökdürməməlidir),
    //   təhlükəsizlik   → FAIL-CLOSED (limiter işləmirsə brute-force açıqdır).
    console.error('rateLimit xətası', mechanism, bucket, (e as any)?.message || e);
    return { ok: !cfg.critical, retryAfter, mechanism };
  }
}

/**
 * Köhnə KV yolu — XƏRC qoruyucuları üçün QƏSDƏN saxlanılır (taksonomiya).
 *
 * ⚠ ATOMİK DEYİL və bu, məlum-qəbul edilmiş itkidir (AUDIT-TASK-4 §5.2):
 *   (1) oxu→yaz yarışı — paralel sorğular eyni `cur` dəyərini görür;
 *   (2) KV eyni açara saniyədə ~1 yazı qəbul edir → artımların bir hissəsi
 *       sükutla itir.
 * Yəni faktiki limit elan ediləndən bir qədər YUXARIDIR. 20 əvəzinə 25 AI
 * çağırışı keçsə təsir kiçikdir; parol hücumunda isə deyil — məhz ona görə
 * `critical: true` səbətlər artıq buradan KEÇMİR.
 */
async function kvHit(env: Env, key: string, limit: number, windowSec: number): Promise<boolean> {
  const cur = parseInt((await env.SESSIONS.get(key)) || '0', 10);
  if (cur >= limit) return false;
  await env.SESSIONS.put(key, String(cur + 1), { expirationTtl: windowSec + 60 });
  return true;
}
