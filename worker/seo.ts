// Server-side SEO: public path-lar üçün per-route meta + JSON-LD injection (HTMLRewriter),
// D1-dən generasiya olunan robots.txt / sitemap.xml / llms.txt.
// Crawler və social scraper JS icra etmədən düzgün meta görür (hash-routing problemi həlli).
import { Env, fromJSON, fileUrl } from './util';

export const ORIGIN = 'https://collabix.muradofftehmez01.workers.dev';
const LOCALES = ['az', 'en', 'ru'] as const;
type Locale = typeof LOCALES[number];
const OG_LOCALE: Record<Locale, string> = { az: 'az_AZ', en: 'en_US', ru: 'ru_RU' };

export interface Meta {
  status: number;            // 200 | 404
  lang: Locale;
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  ogImage: string;
  jsonld: any[];             // route-spesifik əlavə sxemlər (#routeSchema-ya yazılır)
  faq?: any;                 // FAQPage sxemi (yalnız /faq)
  breadcrumb?: any;          // BreadcrumbList
}

export interface RouteInfo { page: string; param?: string; locale: Locale; }

/* ---------- path → route ---------- */
export function matchPublicRoute(pathname: string): RouteInfo | null {
  let locale: Locale = 'az';
  let p = pathname;
  const lm = p.match(/^\/(en|ru)(\/|$)/);
  if (lm) { locale = lm[1] as Locale; p = p.slice(lm[1].length + 1) || '/'; }
  if (p === '') p = '/';
  if (p === '/') return { page: 'welcome', locale };
  const staticPages = ['about', 'faq', 'privacy', 'terms', 'contact', 'security', 'cookies', 'changelog'];
  const sm = p.match(/^\/([a-z]+)$/);
  if (sm && staticPages.includes(sm[1])) return { page: sm[1], locale };
  const pm = p.match(/^\/post\/([\w-]+)$/);
  if (pm) return { page: 'post', param: pm[1], locale };
  const um = p.match(/^\/u\/([\w.]+)$/);
  if (um) return { page: 'u', param: um[1], locale };
  return null;
}

function pathFor(page: string, param?: string): string {
  if (page === 'welcome') return '/';
  if (page === 'post') return '/post/' + param;
  if (page === 'u') return '/u/' + param;
  return '/' + page;
}
export function urlFor(locale: Locale, page: string, param?: string): string {
  const path = pathFor(page, param);
  const prefix = locale === 'az' ? '' : '/' + locale;
  if (page === 'welcome') return ORIGIN + (prefix || '/');
  return ORIGIN + prefix + path;
}
// hreflang alternatları — hər dil üçün real fərqli URL (+ x-default = az).
export function alternatesFor(page: string, param?: string): { hreflang: string; href: string }[] {
  const out = LOCALES.map(l => ({ hreflang: l as string, href: urlFor(l, page, param) }));
  out.push({ hreflang: 'x-default', href: urlFor('az', page, param) });
  return out;
}

/* ---------- statik səhifə mətnləri (public.js PAGE_META ilə eyni) ---------- */
const T: Record<string, Record<Locale, { title: string; desc: string }>> = {
  welcome: {
    az: { title: 'Collabix — Proqramlaşdırma və Dil Öyrənmə Platforması', desc: 'Birgə öyrən, kod paylaş, XP qazan. Proqramlaşdırma və xarici dilləri birlikdə öyrənmək üçün 18+ icma platforması.' },
    en: { title: 'Collabix — Coding & Language Learning Platform', desc: 'Learn together, share code, earn XP. An 18+ community platform for learning programming and languages together.' },
    ru: { title: 'Collabix — Платформа для изучения программирования', desc: 'Учись вместе, делись кодом, зарабатывай XP. Платформа 18+ для совместного изучения программирования и языков.' },
  },
  about: {
    az: { title: 'Haqqımızda — Collabix', desc: 'Collabix icma platformasının hekayəsi, missiyası və komandası.' },
    en: { title: 'About Us — Collabix', desc: 'The story, mission and team behind Collabix.' },
    ru: { title: 'О нас — Collabix', desc: 'История, миссия и команда Collabix.' },
  },
  faq: {
    az: { title: 'FAQ — Tez-tez verilən suallar — Collabix', desc: 'Collabix haqqında ən çox soruşulan suallar və cavablar.' },
    en: { title: 'FAQ — Frequently Asked Questions — Collabix', desc: 'Most commonly asked questions and answers about Collabix.' },
    ru: { title: 'FAQ — Частые вопросы — Collabix', desc: 'Часто задаваемые вопросы и ответы о Collabix.' },
  },
  contact: {
    az: { title: 'Əlaqə — Collabix', desc: 'Bizimlə əlaqə saxlayın — sual, təklif və ya problem.' },
    en: { title: 'Contact — Collabix', desc: 'Get in touch with us — questions, ideas or issues.' },
    ru: { title: 'Контакты — Collabix', desc: 'Свяжитесь с нами — вопросы, идеи или проблемы.' },
  },
  privacy: {
    az: { title: 'Məxfilik siyasəti — Collabix', desc: 'Məlumatlarınızın necə toplandığı və qorunduğu.' },
    en: { title: 'Privacy Policy — Collabix', desc: 'How your data is collected and protected.' },
    ru: { title: 'Политика конфиденциальности — Collabix', desc: 'Как собираются и защищаются ваши данные.' },
  },
  terms: {
    az: { title: 'İstifadə şərtləri — Collabix', desc: 'Platformanın istifadə qaydaları və şərtləri.' },
    en: { title: 'Terms & Conditions — Collabix', desc: 'Platform usage rules and conditions.' },
    ru: { title: 'Условия использования — Collabix', desc: 'Правила и условия использования платформы.' },
  },
  security: {
    az: { title: 'Təhlükəsizlik — Collabix', desc: 'Təhlükəsizlik siyasəti və məlumat qoruması.' },
    en: { title: 'Security — Collabix', desc: 'Security policy and data protection.' },
    ru: { title: 'Безопасность — Collabix', desc: 'Политика безопасности и защита данных.' },
  },
  cookies: {
    az: { title: 'Cookie siyasəti — Collabix', desc: 'Cookie-lərin istifadəsi barədə məlumat.' },
    en: { title: 'Cookie Policy — Collabix', desc: 'Information about how we use cookies.' },
    ru: { title: 'Cookies — Collabix', desc: 'Информация об использовании cookies.' },
  },
  changelog: {
    az: { title: 'Yenilik jurnalı — Collabix', desc: 'Platform yenilikləri və yol xəritəsi.' },
    en: { title: 'Changelog — Collabix', desc: 'Platform updates and roadmap.' },
    ru: { title: 'Изменения — Collabix', desc: 'Platform updates and roadmap.' },
  },
};

function pageLabel(page: string, locale: Locale): string {
  return (T[page]?.[locale]?.title || page).replace(/ — Collabix$/, '');
}

/* ---------- ortaq JSON-LD (hər route) ---------- */
function orgSchema() {
  return {
    '@context': 'https://schema.org', '@type': 'EducationalOrganization',
    name: 'Collabix', url: ORIGIN, logo: ORIGIN + '/favicon.svg',
    description: 'Proqramlaşdırma və xarici dilləri birlikdə öyrənmək üçün 18+ icma platforması.',
    sameAs: ['https://instagram.com/collabix', 'https://github.com/collabix', 'https://linkedin.com/company/collabix'],
  };
}
function websiteSchema() {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', name: 'Collabix', url: ORIGIN,
    inLanguage: ['az', 'en', 'ru'],
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: ORIGIN + '/faq?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };
}
function breadcrumbSchema(page: string, locale: Locale, param?: string) {
  const items: any[] = [{ '@type': 'ListItem', position: 1, name: locale === 'en' ? 'Home' : locale === 'ru' ? 'Главная' : 'Ana Səhifə', item: urlFor(locale, 'welcome') }];
  if (page !== 'welcome') {
    items.push({ '@type': 'ListItem', position: 2, name: pageLabel(page, locale), item: urlFor(locale, page, param) });
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

/* ---------- FAQPage (D1-dən, cari dildə) ---------- */
async function faqSchema(env: Env, locale: Locale) {
  try {
    const rows = await env.DB.prepare('SELECT q, a FROM faqs WHERE active = 1 ORDER BY sort_order ASC LIMIT 20').all<any>();
    const pick = (o: any) => { const v = fromJSON<any>(o, {}); return v[locale] || v.az || ''; };
    const mainEntity = rows.results.map(r => ({
      '@type': 'Question', name: pick(r.q),
      acceptedAnswer: { '@type': 'Answer', text: pick(r.a) },
    })).filter(q => q.name);
    if (!mainEntity.length) return undefined;
    return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity };
  } catch { return undefined; }
}

const truncate = (s: string, n: number) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/* ---------- route → Meta ---------- */
export async function buildMeta(route: RouteInfo, env: Env): Promise<Meta> {
  const { page, param, locale } = route;
  const base: Meta = {
    status: 200, lang: locale, ogType: 'website', ogImage: ORIGIN + '/og/default.png',
    canonical: urlFor(locale, page, param), jsonld: [orgSchema(), websiteSchema()],
    title: '', description: '',
    breadcrumb: breadcrumbSchema(page, locale, param),
  };

  if (page === 'post') {
    const row = await env.DB.prepare(`
      SELECT p.id, p.author_name, p.text, p.blocks, p.created_at, p.original_deleted,
             u.blocked AS author_blocked, u.username AS author_username
      FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = ?
    `).bind(param).first<any>();
    if (!row || row.author_blocked) return { ...base, status: 404, title: '404 — Collabix', description: 'Səhifə tapılmadı.' };
    const blocks = fromJSON<any[]>(row.blocks, []);
    const bodyText = row.text || blocks.map(b => b.content || '').join(' ');
    const excerpt = truncate(bodyText, 160) || 'Collabix paylaşımı';
    base.title = `${row.author_name} — Collabix`;
    base.description = excerpt;
    base.ogType = 'article';
    base.ogImage = ORIGIN + '/og/post/' + row.id + '.png';
    base.jsonld.push({
      '@context': 'https://schema.org', '@type': 'SocialMediaPosting',
      headline: truncate(bodyText, 110), articleBody: excerpt,
      datePublished: new Date(row.created_at).toISOString(),
      author: { '@type': 'Person', name: row.author_name, url: row.author_username ? urlFor(locale, 'u', row.author_username) : undefined },
      url: base.canonical, mainEntityOfPage: base.canonical,
    });
    return base;
  }

  if (page === 'u') {
    const row = await env.DB.prepare(
      'SELECT id, username, name, bio, photo_url, verified, xp, tasks_completed FROM users WHERE username = ? AND blocked = 0',
    ).bind(param).first<any>();
    if (!row) return { ...base, status: 404, title: '404 — Collabix', description: 'İstifadəçi tapılmadı.' };
    base.title = `${row.name} (@${row.username}) — Collabix`;
    base.description = truncate(row.bio, 160) || `${row.name} — Collabix icma üzvü. Profil, bacarıqlar və fəaliyyət.`;
    base.ogType = 'profile';
    base.ogImage = ORIGIN + '/og/user/' + row.username + '.png';
    base.jsonld.push({
      '@context': 'https://schema.org', '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person', name: row.name, alternateName: '@' + row.username,
        description: truncate(row.bio, 200) || undefined,
        image: row.photo_url ? ORIGIN + fileUrl(row.photo_url) : undefined,
        url: base.canonical,
      },
    });
    return base;
  }

  // statik səhifələr
  const meta = T[page] || T.welcome;
  base.title = meta[locale].title;
  base.description = meta[locale].desc;
  if (page === 'faq') base.faq = await faqSchema(env, locale);
  return base;
}

/* ---------- HTMLRewriter: shell HTML-ə meta injection ---------- */
export function rewriteHead(res: Response, meta: Meta, route: RouteInfo): Response {
  const alts = alternatesFor(route.page, route.param);
  const setAttr = (name: string, val: string) => ({ element(el: any) { el.setAttribute(name, val); } });
  const setText = (val: string) => ({ element(el: any) { el.setInnerContent(val); } });
  const setJson = (obj: any) => ({ element(el: any) { el.setInnerContent(obj ? JSON.stringify(obj) : '{}'); } });

  return new HTMLRewriter()
    .on('html', setAttr('lang', meta.lang))
    .on('title', setText(meta.title))
    .on('meta[name="description"]', setAttr('content', meta.description))
    .on('link[rel="canonical"]', setAttr('href', meta.canonical))
    .on('meta[property="og:title"]', setAttr('content', meta.title))
    .on('meta[property="og:description"]', setAttr('content', meta.description))
    .on('meta[property="og:url"]', setAttr('content', meta.canonical))
    .on('meta[property="og:type"]', setAttr('content', meta.ogType))
    .on('meta[property="og:image"]', setAttr('content', meta.ogImage))
    .on('meta[property="og:locale"]', setAttr('content', OG_LOCALE[meta.lang]))
    .on('meta[name="twitter:title"]', setAttr('content', meta.title))
    .on('meta[name="twitter:description"]', setAttr('content', meta.description))
    .on('meta[name="twitter:image"]', setAttr('content', meta.ogImage))
    // hreflang alternatları: hər link[rel=alternate] öz hreflang-ına görə real URL alır
    .on('link[rel="alternate"]', {
      element(el: any) {
        const hl = el.getAttribute('hreflang');
        const a = alts.find(x => x.hreflang === hl);
        if (a) el.setAttribute('href', a.href);
      },
    })
    .on('#breadcrumbSchema', setJson(meta.breadcrumb))
    .on('#faqSchema', setJson(meta.faq || { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] }))
    .on('#routeSchema', setJson(meta.jsonld.length ? meta.jsonld : null))
    .transform(res);
}

/* ---------- robots.txt / sitemap.xml / llms.txt (D1-driven, tək mənbə) ---------- */
export function buildRobots(): string {
  return `# Collabix — ${ORIGIN}
User-agent: *
Allow: /
Allow: /og/
Disallow: /api/
Disallow: /files/
Disallow: /assets/

User-agent: GPTBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: CCBot
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;
}

export async function buildSitemap(env: Env): Promise<string> {
  const staticPages = ['', 'about', 'faq', 'privacy', 'terms', 'contact', 'security', 'cookies', 'changelog'];
  const urls: string[] = [];
  const alt = (page: string, param?: string) =>
    alternatesFor(page, param).map(a => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`).join('\n');

  for (const sp of staticPages) {
    const page = sp === '' ? 'welcome' : sp;
    urls.push(`  <url>\n    <loc>${urlFor('az', page)}</loc>\n${alt(page)}\n    <changefreq>${page === 'welcome' || page === 'faq' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${page === 'welcome' ? '1.0' : '0.7'}</priority>\n  </url>`);
  }
  try {
    const posts = await env.DB.prepare(`
      SELECT p.id, p.created_at, p.edited_at FROM posts p LEFT JOIN users u ON p.author_id = u.id
      WHERE COALESCE(u.blocked,0) = 0 AND p.post_type = 'original' ORDER BY p.created_at DESC LIMIT 500
    `).all<any>();
    for (const r of posts.results) {
      urls.push(`  <url>\n    <loc>${urlFor('az', 'post', r.id)}</loc>\n    <lastmod>${new Date(r.edited_at || r.created_at).toISOString().slice(0, 10)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`);
    }
    const users = await env.DB.prepare('SELECT username, joined_at FROM users WHERE blocked = 0 ORDER BY joined_at DESC LIMIT 500').all<any>();
    for (const r of users.results) {
      urls.push(`  <url>\n    <loc>${urlFor('az', 'u', r.username)}</loc>\n${alt('u', r.username)}\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>`);
    }
  } catch { /* D1 xətası — statik səhifələr yenə də qaytarılır */ }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`;
}

export async function buildLlms(env: Env): Promise<string> {
  let faqLines = '';
  try {
    const rows = await env.DB.prepare('SELECT q, a FROM faqs WHERE active = 1 ORDER BY sort_order ASC LIMIT 10').all<any>();
    faqLines = rows.results.map(r => {
      const q = fromJSON<any>(r.q, {}); const a = fromJSON<any>(r.a, {});
      return `- **${q.en || q.az || ''}** ${truncate(a.en || a.az || '', 160)}`;
    }).filter(l => l.length > 6).join('\n');
  } catch { /* ignore */ }

  return `# Collabix

> Collabix is an 18+ community platform for learning programming and human languages together. Users find study partners, share code (with syntax highlighting), solve tasks, earn XP, keep activity streaks, chat in topic rooms, and message directly. Trilingual: Azerbaijani, English, Russian.

## Key pages
- [Home](${ORIGIN}/): overview and features
- [About](${ORIGIN}/about): mission, team, values
- [FAQ](${ORIGIN}/faq): common questions and answers
- [Privacy](${ORIGIN}/privacy) · [Terms](${ORIGIN}/terms) · [Security](${ORIGIN}/security) · [Contact](${ORIGIN}/contact)

## Content
- Public posts: ${ORIGIN}/post/{id}
- Public profiles: ${ORIGIN}/u/{username}

## Notes for AI answer engines
- The site is trilingual; language variants use /en/ and /ru/ path prefixes (bare path = Azerbaijani).
- The JSON API under /api/ is private and must not be crawled.
${faqLines ? '\n## FAQ highlights\n' + faqLines + '\n' : ''}`;
}
