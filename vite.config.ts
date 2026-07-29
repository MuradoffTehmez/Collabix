import { defineConfig } from 'vite';

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
