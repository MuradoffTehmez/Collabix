// Dinamik OG preview şəkli (post/profil) — WhatsApp/Telegram/Facebook/X-də zəngin kart.
// workers-og: HTML+CSS → SVG (Satori) → PNG (resvg-wasm). Workers runtime-da Canvas yoxdur.
// Nəticə caches.default-də saxlanılır (edit → ?v=updated_at ilə cache bust).
import { ImageResponse } from 'workers-og';
import { Env, fromJSON, avatarUrl } from './util';
import { siteOrigin } from './seo';

const W = 1200, H = 630;
const esc = (s: string) => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as any)[c]);
const truncate = (s: string, n: number) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function initials(name: string): string {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function hue(str: string): number {
  let h = 0; for (const ch of String(str || '?')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h;
}

const shell = (inner: string) => `
  <div style="display:flex;flex-direction:column;width:${W}px;height:${H}px;padding:64px;
    background:linear-gradient(135deg,#0b0f1a 0%,#111a2e 100%);color:#e6edf6;font-family:sans-serif;justify-content:space-between;">
    ${inner}
    <div style="display:flex;align-items:center;gap:14px;">
      <div style="width:40px;height:40px;border-radius:10px;background:#4a8fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:24px;">C</div>
      <span style="font-size:30px;font-weight:700;color:#5eeaea;">Collabix</span>
    </div>
  </div>`;

/**
 * Avatarın `data:` URI-si — AUDIT-TASK-10 / Faza 3.5 (Task 7 §8/2 miras bəndi).
 *
 * ⚠ NİYƏ ÜNVAN İŞLƏMİR: Satori `<img src>`-i ÖZÜ çəkir və o sorğuda SESSİYA
 *   YOXDUR. `/files/*` yolu isə (Task 7 / C-1) autentifikasiya tələb edir və
 *   401 qaytarır → OG kartında avatar HEÇ VAXT görünmürdü. Sosial botlar da
 *   giriş etmir, yəni ünvanı publik etmək də seçim deyil.
 *
 * HƏLL: obyekt R2-dən SERVER TƏRƏFDƏ oxunur və şəklin içinə `data:` kimi
 * yerləşdirilir — heç bir əlavə sorğu getmir.
 *
 * ⚠ ÖLÇÜ TAVANI MƏCBURİDİR: base64 həcmi ~1,37× artırır və nəticə HTML-i
 *   Satori-nin yaddaşına düşür. Avatar yükləmə limiti onsuz da kiçikdir;
 *   gözlənilməz böyük obyekt gəlsə kartı çökdürməkdənsə hərfli fallback-a
 *   qayıdırıq.
 */
const OG_AVATAR_MAX = 512 * 1024;

async function avatarDataUri(env: Env, photo: string | null): Promise<string | null> {
  const u = avatarUrl(photo);
  if (!u) return null;
  // OAuth provayderindən gələn xarici avatar — publikdir, Satori özü çəkə bilər.
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (!u.startsWith('/files/')) return null;

  try {
    const key = decodeURIComponent(u.slice('/files/'.length));
    const obj = await env.FILES.get(key);
    if (!obj) return null;
    if (obj.size > OG_AVATAR_MAX) return null;
    const buf = new Uint8Array(await obj.arrayBuffer());
    // ⚠ `String.fromCharCode(...buf)` İŞLƏMİR: 100 KB-lıq avatar üçün arqument
    //   sayı yığın limitini aşır. Parça-parça yığırıq.
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    const mime = obj.httpMetadata?.contentType || 'image/jpeg';
    return `data:${mime};base64,${btoa(bin)}`;
  } catch {
    return null;   // avatar OG kartını çökdürməməlidir
  }
}

function avatarBox(name: string, photoUrl: string | null): string {
  if (photoUrl) {
    return `<img src="${esc(photoUrl)}" style="width:120px;height:120px;border-radius:26px;object-fit:cover;" />`;
  }
  const hh = hue(name);
  return `<div style="width:120px;height:120px;border-radius:26px;display:flex;align-items:center;justify-content:center;
    background:hsl(${hh} 45% 32%);color:hsl(${hh} 80% 82%);font-size:52px;font-weight:800;">${esc(initials(name))}</div>`;
}

// resvg/Satori render-i (font fetch daxil) heç vaxt sorğunu asmasın deyə timeout ilə
// yarışdırılır; uğursuzluqda statik brend şəklinə fallback.
const RENDER_TIMEOUT_MS = 8000;
async function render(html: string): Promise<Response> {
  const img = new ImageResponse(html, { width: W, height: H, format: 'png' });
  const buf = await Promise.race([
    img.arrayBuffer(),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('og-timeout')), RENDER_TIMEOUT_MS)),
  ]);
  return new Response(buf, { headers: { 'Content-Type': 'image/png' } });
}

// Generic brend kartı — statik səhifələr (/, /about ...) və son-fallback üçün.
// DB oxuması yoxdur, uzun cache. Heç vaxt 404 og:image olmasın deyə.
export async function ogDefaultResponse(env: Pick<Env, 'SITE_ORIGIN'>, request: Request, ctx?: ExecutionContext): Promise<Response> {
  const cache = (caches as any).default as Cache;
  try {
    const hit = await cache.match(request);
    if (hit) return hit;
    const html = shell(`
      <div style="display:flex;flex-direction:column;gap:16px;">
        <span style="font-size:76px;font-weight:800;">Collabix</span>
        <span style="font-size:38px;color:#8aa0bd;max-width:900px;">Birgə öyrən · Kod paylaş · İnkişaf et</span>
      </div>
      <div style="display:flex;font-size:30px;color:#b8c6da;">Proqramlaşdırma və dil öyrənmə icması · 18+</div>`);
    const res = await render(html);
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'public, max-age=604800, immutable');
    const put = cache.put(request, out.clone()).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(put);
    return out;
  } catch (e: any) {
    console.error('OG default error', e?.message || e);
    return Response.redirect(siteOrigin(env) + '/favicon.svg', 302);
  }
}

export async function ogImageResponse(env: Env, request: Request, kind: 'post' | 'user', id: string, ctx?: ExecutionContext): Promise<Response> {
  // Cache: URL + updated_at (v param) — dəyişəndə avtomatik bust.
  const cache = (caches as any).default as Cache;
  const cacheUrl = new URL(request.url);

  try {
    let html: string;
    let version = '0';

    if (kind === 'post') {
      const row = await env.DB.prepare(`
        SELECT p.author_name, p.text, p.blocks, p.created_at, p.edited_at, p.share_count, p.original_deleted,
               u.blocked AS author_blocked, u.photo_url AS author_photo
        FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = ?
      `).bind(id).first<any>();
      if (!row || row.author_blocked) return fallback(env);
      version = String(row.edited_at || row.created_at || 0);
      const blocks = fromJSON<any[]>(row.blocks, []);
      const body = truncate(row.text || blocks.map(b => b.content || '').join(' '), 180) || 'Collabix paylaşımı';
      html = shell(`
        <div style="display:flex;align-items:center;gap:20px;">
          ${avatarBox(row.author_name, await avatarDataUri(env, row.author_photo))}
          <span style="font-size:40px;font-weight:700;">${esc(row.author_name)}</span>
        </div>
        <div style="display:flex;font-size:44px;line-height:1.3;font-weight:600;max-height:260px;overflow:hidden;">${esc(body)}</div>`);
    } else {
      const row = await env.DB.prepare(
        'SELECT username, name, bio, photo_url, verified, xp, tasks_completed FROM users WHERE username = ? AND blocked = 0',
      ).bind(id).first<any>();
      if (!row) return fallback(env);
      version = String(row.xp || 0) + '-' + String(row.tasks_completed || 0);
      html = shell(`
        <div style="display:flex;align-items:center;gap:28px;">
          ${avatarBox(row.name, await avatarDataUri(env, row.photo_url))}
          <div style="display:flex;flex-direction:column;gap:8px;">
            <span style="font-size:52px;font-weight:800;">${esc(row.name)}${row.verified ? ' <span style="color:#5eeaea;">✓</span>' : ''}</span>
            <span style="font-size:32px;color:#8aa0bd;">@${esc(row.username)}</span>
          </div>
        </div>
        <div style="display:flex;font-size:34px;color:#b8c6da;line-height:1.4;max-height:180px;overflow:hidden;">${esc(truncate(row.bio, 140) || 'Collabix icma üzvü')}</div>`);
    }

    cacheUrl.searchParams.set('v', version);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const res = await render(html);
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    // Cache yazısı bloklamasın (sorğu dərhal qayıtsın).
    const put = cache.put(cacheKey, out.clone()).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(put);
    return out;
  } catch (e: any) {
    console.error('OG image error', e?.message || e);
    return fallback(env);
  }
}

// Xəta/tapılmadı → generic brend kartına yönləndir (heç vaxt qırıq preview göstərmə).
function fallback(env: Pick<Env, 'SITE_ORIGIN'>): Response {
  return Response.redirect(siteOrigin(env) + '/og/default.png', 302);
}
