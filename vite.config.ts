import { defineConfig, type Plugin } from 'vite';

/**
 * `index.html`-dəki boş `data-i18n` yuvalarını build vaxtı AZ mətni ilə doldurur.
 *
 * 🔴 NİYƏ LAZIMDIR (PageSpeed 2026-08-03 ilə ölçülüb):
 *   290 `data-i18n` elementindən 275-i HTML-də BOŞ gedirdi. Yəni landing
 *   səhifəsinin bütün görünən mətni yalnız `applyI18n()` işləyəndən sonra
 *   yaranırdı. Nəticə ölçmədə: TTFB cəmi 10 ms, amma LCP render gecikməsi
 *   1 350 ms — brauzer 165 KiB JS-i endirib icra edənə qədər səhifə ağ idi.
 *   Eyni kök SEO-nu da vururdu: crawler boş `<a>` və boş başlıq görürdü.
 *
 * ⚠ RUNTIME DAVRANIŞI DƏYİŞMİR: `applyI18n()` yenə də `textContent`-i üstünə
 *   yazır. AZ üçün eyni mətn yazılır (görünən dəyişiklik yoxdur), EN/RU üçün
 *   isə əvvəlki kimi əvəzlənir. Ön-doldurma yalnız "ilk boya"nı qabaqlayır.
 *
 * ⚠ NİYƏ YALNIZ BOŞ ELEMENTLƏR: içində artıq mətn olan element toxunulmur —
 *   əks halda əl ilə yazılmış məzmun səssizcə silinərdi.
 */
function i18nPrefill(): Plugin {
  return {
    name: 'collabix-i18n-prefill',
    // `order: 'pre'` lazım deyil: Vite-ın öz asset yenidən yazması ilə
    // toqquşmuruq, yalnız mətn qovuqlarını doldururuq.
    async transformIndexHtml(html) {
      // ⚠ 2026-08-09: əvvəl burada `js/i18n.js`-dən `DICT` import olunurdu və
      //   o modul səviyyəsində `localStorage` oxuduğu üçün Node-da `localStorage`
      //   stub-u lazım gəlirdi. Lüğət ayrı paketlərə bölünəndən sonra plagin
      //   birbaşa AZ xəritəsini oxuyur: o, SAF DATADIR — nə import, nə də
      //   brauzer qlobalı tələb edir, ona görə stub da silindi.
      //
      // ⚠ MƏHZ AZ: ön-doldurma `index.html`-in default dilini yazır. EN/RU
      //   paketləri runtime-da `applyI18n()` ilə tətbiq olunur.
      const { default: AZ } = (await import('./js/i18n.dict.az.js')) as {
        default: Record<string, string>;
      };

      const az = (key: string): string | null => {
        const value = AZ[key];
        return typeof value === 'string' ? value : null;
      };
      // Atribut dəyəri kimi də, mətn kimi də təhlükəsiz olmalıdır.
      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      let filled = 0;
      let attrs = 0;

      // 1) Mətn: <tag ... data-i18n="key"></tag> → içini doldur.
      //    `data-i18n="` şablonu `data-i18n-ph="` ilə uyğun gəlmir (dərhal `="`).
      html = html.replace(
        /<([a-zA-Z][\w-]*)([^>]*\sdata-i18n="([^"]+)"[^>]*)>\s*<\/\1\s*>/g,
        (whole, tag: string, attrStr: string, key: string) => {
          const text = az(key);
          if (text === null) return whole; // açar yoxdursa toxunma
          filled++;
          return `<${tag}${attrStr}>${esc(text)}</${tag}>`;
        },
      );

      // 2) Atributlar: placeholder / aria-label / title.
      //    Element artıq həmin atributu daşıyırsa üstünə yazmırıq.
      const attrMap: Array<[string, string]> = [
        ['data-i18n-ph', 'placeholder'],
        ['data-i18n-aria', 'aria-label'],
        ['data-i18n-title', 'title'],
      ];
      for (const [dataAttr, htmlAttr] of attrMap) {
        const re = new RegExp(`<([a-zA-Z][\\w-]*)([^>]*\\s${dataAttr}="([^"]+)"[^>]*)>`, 'g');
        html = html.replace(re, (whole, tag: string, attrStr: string, key: string) => {
          if (new RegExp(`\\s${htmlAttr}=`).test(attrStr)) return whole;
          const text = az(key);
          if (text === null) return whole;
          attrs++;
          return `<${tag}${attrStr} ${htmlAttr}="${esc(text)}">`;
        });
      }

      // 3) HTML şərhlərini yalnız BUILD çıxışından təmizlə.
      //
      //    Mənbədəki 80 izahlı şərh developer üçün qalır, amma istehsala
      //    getməsinin mənası yoxdur: ölçülüb — 7.8 KiB xam / 3.76 KiB gzip,
      //    yəni sənədin gzip həcminin ~19%-i. `index.html` kritik yolda
      //    render-bloklayan sənəddir, ona görə bu, birbaşa FCP-yə yazılır.
      //
      // ⚠ `<script>` və `<style>` DAXİLİNƏ TOXUNMURUQ: səhifədə 6 ədəd
      //   `application/ld+json` bloku var (struktur data). JSON sətrinin
      //   içində `<!--` ardıcıllığı olsa, kor-koranə silmə strukturu pozar.
      //   Ona görə əvvəlcə həmin bloklar kənara ayrılır, sonra geri qoyulur.
      //
      // ⚠ Marker DÜZ ASCII olmalıdır: ilk variantda ayırıcı kimi NUL baytı
      //   düşmüşdü və git bütün faylı BİNAR sayırdı (diff/review itir).
      const guarded: string[] = [];
      html = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, m => {
        guarded.push(m);
        return `__COLLABIX_GUARD_${guarded.length - 1}__`;
      });
      const beforeComments = html.length;
      html = html.replace(/<!--[\s\S]*?-->/g, '');
      const saved = beforeComments - html.length;
      html = html.replace(/__COLLABIX_GUARD_(\d+)__/g, (_m, i: string) => guarded[Number(i)]);

      // Build çıxışında görünsün ki, plagin həqiqətən işləyib (səssiz sınmasın).
      console.log(
        `  ✓ i18n ön-doldurma: ${filled} element mətni, ${attrs} atribut` +
        ` · şərhlər təmizləndi: ${(saved / 1024).toFixed(1)} KiB`,
      );
      return html;
    },
  };
}

// Client build: tree-shaking + minification + hashed adlar (uzunmüddətli cache).
// worker/ Vite-ə aid deyil — onu wrangler özü bundle edir.
export default defineConfig({
  // AUDIT-TASK-10 / Faza 3.4 — SABİT (hash-sız) ikon URL-ləri.
  //
  // 🔴 Əvvəl ikonlar `dist/assets/favicon-<hash>.svg` kimi çıxırdı və Vite
  //   `index.html`-dəki `<link>` istinadını avtomatik yeniləyirdi. LAKİN eyni
  //   faylı SABİT URL ilə göstərən İKİ yer var idi və onlar 404 alırdı:
  //     • `index.html` JSON-LD → `"logo": ".../favicon.svg"`
  //     • `manifest.webmanifest` → `"src": "/favicon.svg"`
  //   Yəni struktur data və PWA ikonu SINIQ idi.
  //
  // `publicDir` faylları OLDUĞU KİMİ `dist/` kökünə köçürür — hash yoxdur,
  // URL sabitdir, hər iki istinad işləyir.
  //
  // ⚠ Qiyməti: bu fayllar uzunmüddətli keşlənə bilməz (hash yoxdur). İkonlar
  //   nadir dəyişdiyi üçün bu, məqbul mübadilədir.
  publicDir: 'public',
  plugins: [i18nPrefill()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libraries
          vendor: ['marked', 'dompurify'],
          // Qeyd: köhnə `firebase` manual-chunk-ı silindi — layihə Cloudflare
          // (Workers + D1 + R2 + KV) üzərindədir, firebase asılılığı yoxdur.
          // Qalıq konfiq hər build-də boş chunk yaradırdı.
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
