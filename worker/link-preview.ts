/* link-preview.ts — Mesajlardakı linklərin önizləməsi (OpenGraph "unfurl").
 *
 * 🔴 TƏHLÜKƏSİZLİK: BU ENDPOINT SERVERİ İSTİFADƏÇİNİN GÖSTƏRDİYİ ÜNVANA
 *    SORĞU GÖNDƏRMƏYƏ MƏCBUR EDİR (SSRF sinfi). Ona görə aşağıdakılar
 *    MÜTLƏQDİR və zəiflədilməməlidir:
 *      1) yalnız `http`/`https` sxemi — `file:`, `data:`, `gopher:` və s. YOX;
 *      2) daxili/loopback/link-local host adları RƏDD edilir;
 *      3) sorğu vaxtla məhdudlaşır (asılıb qalmasın);
 *      4) cavab ölçüsü məhdudlaşır (10 MB HTML ilə yaddaş yeyilməsin);
 *      5) yalnız `text/html` işlənir;
 *      6) yönləndirmə sayı brauzer default-u ilə məhdud (`redirect: 'follow'`
 *         Workers-də daxili həddə malikdir).
 *
 * ⚠ Cloudflare Workers edge-dən RFC1918 şəbəkələrinə çıxa bilmir, lakin bu,
 *   TƏK müdafiə sayılmır: host yoxlaması lokal `wrangler dev` mühitində də
 *   qorumalıdır (orada fetch HƏQİQƏTƏN 127.0.0.1-ə çata bilər).
 *
 * ⚠ NƏTİCƏ KEŞLƏNİR (KV, 24 saat): eyni link söhbətdə onlarla dəfə görünə
 *   bilər və hər baxışda xarici sayta sorğu atmaq həm yavaş, həm nəzakətsizdir.
 */
import { Ctx, json, err } from './util';

const TIMEOUT_MS = 6000;
const MAX_BYTES = 512 * 1024;      // 512 KB — OG teqləri <head>-dədir, artığı lazımsız
const CACHE_TTL = 86400;           // 24 saat

/** Daxili/xüsusi host adları — SSRF qapısı. */
const BLOCKED_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?fc00:|\[?fe80:)/i;

function safeUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (BLOCKED_HOST.test(u.hostname)) return null;
  // Nöqtəsiz host (məs. `intranet`) daxili ad ola bilər.
  if (!u.hostname.includes('.')) return null;
  return u;
}

interface Preview {
  url: string; title: string; desc: string; image: string; site: string;
}

/** `<meta>` teqlərini HTMLRewriter ilə oxuyur — regex-dən etibarlıdır. */
async function parseOG(res: Response, finalUrl: string): Promise<Preview> {
  const out: Preview = { url: finalUrl, title: '', desc: '', image: '', site: new URL(finalUrl).hostname };
  const pick = (p: string, c: string) => {
    if (p === 'og:title' || (p === 'title' && !out.title)) out.title ||= c;
    else if (p === 'og:description' || p === 'description') out.desc ||= c;
    else if (p === 'og:image') out.image ||= c;
    else if (p === 'og:site_name') out.site = c || out.site;
  };
  const rewriter = new HTMLRewriter()
    .on('meta', {
      element(e) {
        const key = e.getAttribute('property') || e.getAttribute('name') || '';
        const content = e.getAttribute('content') || '';
        if (key && content) pick(key.toLowerCase(), content.slice(0, 300));
      },
    })
    .on('title', {
      text(t) { if (!out.title) out.title = (out.title + t.text).slice(0, 300); },
    });
  // Nəticə oxunmalıdır ki, rewriter işləsin.
  await rewriter.transform(res).text();
  out.title = out.title.trim().slice(0, 200);
  out.desc = out.desc.trim().slice(0, 300);
  // Nisbi şəkil URL-i mütləqə çevrilir; yararsızdırsa atılır.
  if (out.image) {
    try { out.image = new URL(out.image, finalUrl).toString(); } catch { out.image = ''; }
  }
  return out;
}

/**
 * Önizləmə şəklinin proxy-si.
 *
 * ⚠ `linkPreview` ilə EYNİ `safeUrl` qapılarından keçir — bu endpoint də
 *   ixtiyari ünvana sorğu göndərir (SSRF sinfi).
 * ⚠ Yalnız `image/*` cavabı ötürülür: HTML/JS qaytaran ünvan öz origin-imizdə
 *   məzmun kimi verilməməlidir.
 * ⚠ Ölçü həddi var — 5 MB-lıq şəkil axını bağlanır.
 */
const MAX_IMG_BYTES = 3 * 1024 * 1024;

export async function linkImage(c: Ctx) {
  const u = safeUrl(c.url.searchParams.get('url') || '');
  if (!u) return err('Yararsız URL.', 400, 'bad_url');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'CollabixBot/1.0 (+link preview)', 'Accept': 'image/*' },
    });
    if (!res.ok) return err('Şəkil alınmadı.', 502, 'img_failed');
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.startsWith('image/')) return err('Şəkil deyil.', 415, 'not_image');
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_IMG_BYTES) return err('Şəkil çox böyükdür.', 413, 'too_large');

    return new Response(res.body, {
      headers: {
        'Content-Type': ctype,
        // Uzun keş: önizləmə şəkilləri praktiki olaraq dəyişmir.
        'Cache-Control': 'public, max-age=86400, immutable',
        // Bu, İSTİFADƏÇİ məzmunu deyil, xarici resursdur — sniffing bağlanır.
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return err('Şəkil alınmadı.', 504, 'img_failed');
  } finally {
    clearTimeout(timer);
  }
}

export async function linkPreview(c: Ctx) {
  const raw = c.url.searchParams.get('url') || '';
  const u = safeUrl(raw);
  if (!u) return err('Yararsız və ya icazə verilməyən URL.', 400, 'bad_url');

  /* ⚠ AÇAR VERSİYALIDIR (`lp2:`). Keşlənmiş qeydin FORMATI dəyişəndə köhnə
   * girişlər səssizcə yanlış nəticə verir: `lp:` dövründə `image` XARİCİ
   * mütləq URL idi, indi isə öz proxy yolumuzdur. Versiyanı artırmadan
   * istifadəçilər 24 saat CSP tərəfindən bloklanan şəkil alardı.
   * Format növbəti dəfə dəyişəndə bu rəqəm yenə artırılmalıdır. */
  const key = 'lp2:' + u.toString();
  const cached = await c.env.SESSIONS.get(key);
  if (cached) return json({ preview: JSON.parse(cached), cached: true });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Bəzi saytlar UA-sız sorğunu rədd edir; kimliyimizi AÇIQ bildiririk.
        'User-Agent': 'CollabixBot/1.0 (+link preview)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return err('Sayt cavab vermədi.', 502, 'fetch_failed');
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('text/html')) return err('HTML deyil.', 415, 'not_html');
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return err('Çox böyük səhifə.', 413, 'too_large');

    const preview = await parseOG(res, res.url || u.toString());
    // Başlıq yoxdursa önizləmə mənasızdır — client sadə link göstərsin.
    if (!preview.title) return err('Önizləmə tapılmadı.', 404, 'no_preview');

    /* 🔴 ŞƏKİL ÖZ ORİGİN-İMİZDƏN VERİLİR (proxy), birbaşa YOX.
     * İki səbəb:
     *   1) CSP `img-src 'self' data: blob:` — xarici şəkil QƏSDƏN bloklanır.
     *      Siyasəti `https:` ilə genişləndirmək bütün sayt üçün zəifləmə olardı.
     *   2) Birbaşa yükləmə istifadəçinin IP-sini və `Referer`-ini YAD SAYTA
     *      sızdırır — link göndərən şəxs bununla baxanları izləyə bilərdi. */
    if (preview.image) {
      preview.image = '/api/link-image?url=' + encodeURIComponent(preview.image);
    }

    // ⚠ `waitUntil`: keş yazısı cavabı GECİKDİRMƏMƏLİDİR.
    c.ctx.waitUntil(
      c.env.SESSIONS.put(key, JSON.stringify(preview), { expirationTtl: CACHE_TTL })
        .catch(() => {}),
    );
    return json({ preview, cached: false });
  } catch (e: any) {
    // Abort = timeout. İstifadəçiyə səbəb açıq deyilir.
    return err(e?.name === 'AbortError' ? 'Sayt vaxtında cavab vermədi.' : 'Önizləmə alınmadı.',
      504, 'preview_failed');
  } finally {
    clearTimeout(timer);
  }
}
