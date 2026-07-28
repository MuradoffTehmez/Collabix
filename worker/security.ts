// TASK-8 / FAZA 1 — təhlükəsizlik telemetriyası, geo kontekst və bot qoruması.
//
// Burada TOPLANAN hər şey Cloudflare-in sorğuya artıq əlavə etdiyi məlumatdır
// (`request.cf`, `CF-Connecting-IP`) — üçüncü tərəf GeoIP xidmətinə ehtiyac yoxdur,
// əlavə gecikmə sıfırdır.
import { Env, uuid, now } from './util';

/* ================= geo / sorğu konteksti ================= */

export interface ReqInfo {
  ip: string;
  country: string;   // ISO-2, məs. 'AZ'
  city: string;
  ua: string;
}

// `request.cf` yalnız Cloudflare şəbəkəsindən keçən sorğularda dolur.
// Lokal `wrangler dev`-də undefined-dir → boş sətirlərə düşürük ki, kod
// eyni işləsin (feature yoxa çıxsın, çökməsin).
export function reqInfo(req: Request): ReqInfo {
  const cf = (req as any).cf as IncomingRequestCfProperties | undefined;
  return {
    ip: req.headers.get('CF-Connecting-IP') || '',
    country: (cf?.country as string) || '',
    city: (cf?.city as string) || '',
    ua: (req.headers.get('User-Agent') || '').slice(0, 300),
  };
}

/**
 * CSRF dərinlikdə müdafiə — AUDIT M-1 (AUDIT-TASK-6 §C-1).
 *
 * Əsas müdafiə `SameSite=Lax` (access) və `SameSite=Strict` (refresh)
 * cookie-ləridir və o, öz işini görür. Bu, İKİNCİ qatdır: `Authorization:
 * Bearer` yolunun mövcudluğu (auth.ts `resolveUser`) və gələcək cross-origin
 * ehtiyacı tək-qatlı müdafiəni kövrək edir.
 *
 * ⚠ HAZIRDA YALNIZ LOG REJİMİNDƏ — sorğu BLOKLANMIR.
 *
 * Səbəb: yoxlama çox sərt olarsa mobil tətbiq, API client-lər və
 * `Sec-Fetch-Site` göndərməyən köhnə brauzerlər kəsilər. Əvvəlcə real
 * trafikdə pozma halları toplanır (`security_events` → `meta.csrf`), sonra
 * bloklamaya keçilir. Keçid AUDIT-TASK-6 hesabatında açıq öhdəlikdir.
 *
 * Qərar məntiqi:
 *   `Sec-Fetch-Site: same-origin | none`  → təhlükəsiz (müasir brauzer).
 *   `Origin` bizim origin-lə üst-üstə düşür → təhlükəsiz.
 *   Hər ikisi YOXDUR → brauzer deyil (curl, mobil app) → şübhəli SAYILMIR,
 *     çünki belə client-lər cookie daşımır; onlar Bearer token yolundadır.
 *   `Origin` VAR və FƏRQLİDİR → şübhəli.
 */
export function csrfSuspicion(req: Request, siteOrigin: string): string | null {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  const fetchSite = req.headers.get('Sec-Fetch-Site');
  if (fetchSite === 'same-origin' || fetchSite === 'none') return null;

  const origin = req.headers.get('Origin');
  if (!origin) return fetchSite ? `sec_fetch_site:${fetchSite}` : null;

  try {
    const allowed = new URL(siteOrigin || req.url).origin;
    if (new URL(origin).origin === allowed) return null;
  } catch {
    return 'origin_parse_failed';
  }
  return `cross_origin:${origin.slice(0, 100)}`;
}

/* ================= security_events ================= */

export type SecEventType =
  | 'login_failed' | 'login_ok' | 'geo_change' | 'rate_limit' | 'token_reuse'
  | 'turnstile_failed' | 'session_revoked' | 'upload_rejected' | 'password_changed'
  // AUDIT M-1 — yalnız MÜŞAHİDƏ: sorğu bloklanmır, hal jurnala düşür.
  | 'csrf_suspect'
  // AUDIT C-1 / TASK-7 §5.3 — `/files/*` oxu rəddi. Fail-closed sistem SÜKUTLA
  // sınа bilər (istifadəçi "sınıq şəkil" görür, səbəbini bilmir), ona görə hər
  // rədd jurnala düşür. ⚠ Meta-da yalnız PREFİKS + səbəb olur, tam açar YOX.
  | 'file_access_denied';

export type Severity = 'info' | 'warning' | 'critical';

interface SecEventInput {
  type: SecEventType;
  uid?: string | null;
  username?: string;
  severity?: Severity;
  meta?: Record<string, unknown>;
}

// Təhlükəsizlik hadisəsini D1-ə yazır.
//
// ⚠ Bu funksiya HEÇ VAXT throw etmir. Monitorinq köməkçi funksiyadır: jurnal
// yazısı uğursuz olsa (D1 qısamüddətli xəta, cədvəl hələ migrate olunmayıb)
// istifadəçinin girişi ÇÖKMƏMƏLİDİR. Xəta konsola düşür, axın davam edir.
export async function logSecurityEvent(
  env: Env, req: Request, ev: SecEventInput,
): Promise<void> {
  const info = reqInfo(req);
  try {
    await env.DB.prepare(
      `INSERT INTO security_events (id, type, uid, username, ip, country, city, severity, meta, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      uuid(), ev.type, ev.uid || null, (ev.username || '').slice(0, 40),
      info.ip, info.country, info.city,
      ev.severity || 'info', JSON.stringify(ev.meta || {}), now(),
    ).run();
  } catch (e: any) {
    console.error('security_events yazıla bilmədi', ev.type, e?.message || e);
  }
}

// Ardıcıl uğursuz giriş sayğacı — IP və istifadəçi adı üzrə AYRI-AYRI.
// Yalnız IP-yə baxsaq NAT arxasındakı bütöv ofis bir hücumçuya görə bloklanardı;
// yalnız istifadəçi adına baxsaq botnet fərqli IP-lərdən eyni hesabı döyəcləyərdi.
// İkisinin maksimumu götürülür.
export async function recentFailures(
  env: Env, req: Request, username: string, windowMs = 15 * 60_000,
): Promise<number> {
  const since = now() - windowMs;
  const ip = reqInfo(req).ip;
  try {
    const row = await env.DB.prepare(
      `SELECT
         SUM(CASE WHEN ip = ?1 THEN 1 ELSE 0 END)       AS by_ip,
         SUM(CASE WHEN username = ?2 THEN 1 ELSE 0 END) AS by_user
       FROM security_events
       WHERE type = 'login_failed' AND created_at > ?3 AND (ip = ?1 OR username = ?2)`,
    ).bind(ip, username, since).first<any>();
    return Math.max(Number(row?.by_ip || 0), Number(row?.by_user || 0));
  } catch { return 0; }
}

// Coğrafi anomaliya: istifadəçinin sonuncu görülən ölkəsi ilə indiki fərqlidirsə
// siqnal ver. VPN/səyahət yalançı pozitiv verir — buna görə bu HADİSƏ jurnalıdır,
// BLOKLAMA deyil. Admin dashboard-da görünür, istifadəçinin girişini kəsmir.
export async function checkGeoChange(
  env: Env, req: Request, uid: string, lastCountry: string,
): Promise<void> {
  const { country } = reqInfo(req);
  if (!country || !lastCountry || country === lastCountry) return;
  await logSecurityEvent(env, req, {
    type: 'geo_change', uid, severity: 'warning',
    meta: { from: lastCountry, to: country },
  });
}

/* ================= Turnstile (Bənd 7) ================= */

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileResult { ok: boolean; skipped: boolean; reason?: string }

// Turnstile token-ini serverdə doğrulayır.
//
// GRACEFUL DEGRADATION: `TURNSTILE_SECRET` qurulmayıbsa (lokal dev, və ya
// açarlar hələ yaradılmayıb) yoxlama ATLANIR və `skipped: true` qayıdır.
// Bu qəsdlidir — əks halda açar qoyulmadan bütün qeydiyyat/giriş axını
// tamamilə bağlanardı. Frontend də eyni məntiqlə widget-i gizlədir.
// Açar qoyulan an qoruma avtomatik aktivləşir, kod dəyişmir.
export async function verifyTurnstile(
  env: Env, req: Request, token: unknown,
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) return { ok: true, skipped: true };
  if (typeof token !== 'string' || !token) {
    return { ok: false, skipped: false, reason: 'missing-input-response' };
  }
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  const ip = reqInfo(req).ip;
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY, { method: 'POST', body });
    const data = await res.json<any>();
    if (data?.success) return { ok: true, skipped: false };
    return { ok: false, skipped: false, reason: (data?.['error-codes'] || []).join(',') || 'failed' };
  } catch (e: any) {
    // Turnstile xidmətinə çatmadıqsa istifadəçini kilidləmirik (fail-open).
    // Bu şüurlu seçimdir: CAPTCHA əlçatmazlığı bütün saytı bağlamamalıdır,
    // rate-limit və digər təbəqələr hər halda işləyir.
    console.error('turnstile verify xətası', e?.message || e);
    return { ok: true, skipped: true, reason: 'verify-unreachable' };
  }
}

/* ================= şəkil/fayl validasiyası (Bənd 14) ================= */

// Magic byte (fayl imzası) ilə ƏSL tip. Client-in göndərdiyi `file.type`
// tamamilə saxtalaşdırıla bilər — `.jpg` adlı HTML faylı `image/jpeg` kimi
// elan edilib R2-yə düşsə, /files/ üzərindən stored-XSS vektoru olardı.
// Ona görə tip BAYTLARDAN oxunur, elandan yox.
export type SniffedType =
  | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf' | null;

export function sniffType(buf: Uint8Array): SniffedType {
  const b = buf;
  if (b.length < 12) return null;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  // GIF: "GIF87a" / "GIF89a"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  // WEBP: "RIFF" .... "WEBP"
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  // PDF: "%PDF-"
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return 'application/pdf';
  return null;
}

// Şəkil ölçüləri (en×hündürlük) — başlıq baytlarından, tam dekodlaşdırma olmadan.
// Məqsəd "decompression bomb" qorumasıdır: 10 KB-lıq PNG açılanda 40000×40000
// piksel ola bilər (~6 GB RAM). Fayl ölçüsü limiti bunu TUTMUR — ona görə
// piksel ölçüsü ayrıca yoxlanılır.
export function imageDimensions(buf: Uint8Array, type: SniffedType): { w: number; h: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  try {
    if (type === 'image/png') {
      // IHDR həmişə ilk chunk-dır: 8 bayt imza + 4 uzunluq + 4 tip → en/hündürlük 16-cı baytdan
      return { w: dv.getUint32(16), h: dv.getUint32(20) };
    }
    if (type === 'image/gif') {
      return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
    }
    if (type === 'image/jpeg') {
      // SOFn marker-ini axtar (C0-CF, amma C4/C8/CC deyil — onlar Huffman/arifmetik cədvəllərdir)
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        const len = dv.getUint16(off + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { h: dv.getUint16(off + 5), w: dv.getUint16(off + 7) };
        }
        if (len <= 0) break;
        off += 2 + len;
      }
      return null;
    }
    if (type === 'image/webp') {
      // VP8X (genişlənmiş) / VP8L (lossless) / VP8 (lossy) — hər birinin öz formatı var
      const fourcc = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
      if (fourcc === 'VP8X') {
        const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { w, h };
      }
      if (fourcc === 'VP8 ') {
        return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
      }
      if (fourcc === 'VP8L') {
        const bits = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24);
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
  } catch { return null; }
  return null;
}
