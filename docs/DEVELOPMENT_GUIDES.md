# Collabix Development & Architecture Guides (2026 Standards)

Bu sənəd layihənin bütün arxitektura, təhlükəsizlik, performans və axtarış sistemləri üçün (SEO, GEO, AEO) optimizasiya qaydalarını əhatə edir.

## 1. Architecture Guide
Collabix bir **Hybrid SPA (Single Page Application)** arxitekturasına sahibdir:
- **Frontend**: Vite.js vasitəsilə vanilla JavaScript/ESM modulları ilə çalışır. Modullar xüsusi olaraq məqsədə xidmət edir (məs: `public.js` ictimai səhifələr üçün, `app.js` autentifikasiya olunmuş istifadəçilər üçün).
- **Edge Layer (Backend)**: Cloudflare Workers vasitəsilə çalışır (`worker/index.ts`). Worker daxilolmaları filterləyir, HTTP Təhlükəsizlik başlıqlarını (Security Headers) əlavə edir və `sitemap.xml`, `robots.txt` kimi statik SEO fayllarına xidmət edir.

## 2. SEO Guide (Search Engine Optimization)
- **Meta Etiketləri (Meta Tags)**: `index.html` faylında statik (canonical, hreflang) olaraq təyin olunur. JS tərəfində (`public.js` daxilində `updateDynamicMeta()`) səhifə dəyişdikcə dinamik olaraq yenilənir.
- **Sitemap & Robots**: Cloudflare Worker səviyyəsində avtomatik olaraq formalaşdırılır. Yeni route əlavə etdikdə `worker/index.ts`-dəki `sitemapXML` dəyişəninə əlavə etməyi unutmayın.
- **JSON-LD Schema**: Təşkilat, FAQ və Breadcrumb sxemləri dinamik olaraq generasiya edilir.

## 3. GEO & AEO Guide (Generative / Answer Engine Optimization)
AI Axtarış Sistemləri (ChatGPT, Gemini, Perplexity) və Google AI Overviews üçün xüsusi struktur:
- Bütün məzmun "Question -> Short Answer -> Explanation" məntiqi əsasında qurulur (`js/legal.js` faylında EEAT tərkiblərinə baxın).
- Hər sual-cavab hissəsi üçün avtomatik **FAQ Schema** yaradılır (`updateFaqSchema`).
- Featured Snippets əldə etmək üçün UI-da siyahılar və cədvəllərdən geniş istifadə edilir.

## 4. Performance Guide
- **Vite Konfiqurasiyası**: `esnext` hədəflənib. Böyük asılılıqlar (Firebase, Marked, DOMPurify) rollup manualChunks vasitəsilə Code Splitting olunur (`vite.config.ts`).
- **CSS / JS**: Tam minification tətbiq olunub.
- **Core Web Vitals**: Həm DOM render strategiyası, həm də Preconnect / DNS-Prefetch sayəsində INP < 200ms, LCP < 2.5s hədəflənir.

## 5. Security Guide
- **Cloudflare Worker Headers**: `worker/index.ts`-də müəyyən edilmişdir. Buraya CSP (Content-Security-Policy), X-Frame-Options, Strict-Transport-Security daxildir. 
- Məlumatlar (Contact form kimi) təmizlənir, və məzmun (Markdown) DOMPurify ilə filterlənir. 

## 6. Deployment Guide
- **Cloudflare Pages / Workers**: `npm run build` komandası işə salındıqda statik fayllar `dist` qovluğuna yığılır.
- `wrangler.toml` konfiqurasiyası istifadə edərək proyektin deployment prosesi avtomatlaşdırılmışdır. API endpointləri `worker/` daxilində idarə olunur.

## 7. Developer Guide
- **Yeni Dil Əlavə Etmək**: `js/i18n.js` faylındakı lüğətə yeni sözlər əlavə edin.
- **Yeni Public Page Əlavə Etmək**:
  1. `index.html` içində `<article class="pub-page">` yaradın.
  2. `js/legal.js`-ə səhifə məzmununu əlavə edin.
  3. `js/public.js`-də `PUBLIC_PAGES` array-inə adını yazın və renderPage() daxilində renderMd çağırın.
