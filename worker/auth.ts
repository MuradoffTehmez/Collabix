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

const PBKDF2_ITER = 100_000;
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
export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITER },
    key, 256,
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt as Uint8Array) };
}
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const { hash: h } = await hashPassword(password, salt);
  return timingSafeEqual(h, hash);
}
const bytesToHex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
const hexToBytes = (h: string) => Uint8Array.from(h.match(/.{2}/g)!.map(x => parseInt(x, 16)));
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
const RL: Record<string, { limit: number; windowSec: number }> = {
  auth:    { limit: 10, windowSec: 300 },
  refresh: { limit: 60, windowSec: 300 },   // 15 dəq access TTL → normal istifadədə saatda ~4
  write:   { limit: 60, windowSec: 60 },
  upload:  { limit: 30, windowSec: 3600 },
  form:    { limit: 5, windowSec: 3600 },
};
export type RateBucket = keyof typeof RL;

// Limitlər IP başınadır. E2E dəstində isə BÜTÜN virtual "cihazlar" eyni
// 127.0.0.1-dən gəlir (bir neçə hesab, paralel kontekstlər, uğursuz giriş
// ssenariləri) — bu, real istifadəçi profili deyil və dəst öz-özünü bloklayır.
//
// ⚠ Çarpan YALNIZ qeyri-production mühitdə tətbiq olunur. `ENVIRONMENT`
// 'production' olduqda bu funksiya HƏMİŞƏ 1 qaytarır — yəni səhvən və ya
// qəsdən qoyulmuş konfiq canlı mühitdəki limitləri ZƏİFLƏDƏ BİLMİR.
// Test mühiti bunu `wrangler dev --var ENVIRONMENT:test` ilə seçir
// (bax playwright.config.ts).
const rlFactor = (env: Env) => (env.ENVIRONMENT === 'production' ? 1 : 20);

export async function rateLimit(env: Env, req: Request, bucket: RateBucket): Promise<boolean> {
  const cfg = RL[bucket];
  const limit = cfg.limit * rlFactor(env);
  const ip = req.headers.get('CF-Connecting-IP') || '127.0.0.1';
  const win = Math.floor(now() / 1000 / cfg.windowSec);
  const key = `rl:${bucket}:${ip}:${win}`;
  const cur = parseInt((await env.SESSIONS.get(key)) || '0', 10);
  if (cur >= limit) return false;
  await env.SESSIONS.put(key, String(cur + 1), { expirationTtl: cfg.windowSec + 60 });
  return true;
}
