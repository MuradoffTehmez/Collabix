// Vite asset importları üçün ambient bəyanlar — AUDIT/perf, 2026-08-09.
//
// 🔴 NİYƏ LAZIMDIR: `js/ui.js` əlavə tema vərəqini DİNAMİK import edir
//   (`import('../css/theme-extra.css')`). Dinamik import-un qaytardığı tip
//   məlum olmalıdır, ona görə `tsc -p tsconfig.js.json` modulu həll etməyə
//   çalışır və `TS2307: Cannot find module` verir. CSS faylı TypeScript üçün
//   modul deyil — onu Vite build vaxtı ayrıca chunk-a çevirir.
//
// ⚠ `js/app.js`-dəki `import 'highlight.js/styles/atom-one-dark.css'` xəta
//   vermirdi, çünki o, YAN TƏSİR importudur (qaytarılan dəyər işlədilmir).
//   Fərq burada: dinamik import ifadədir və tipi tələb olunur.
//
// ⚠ Bu fayl `tsconfig.js.json` → `include` siyahısına AÇIQ yazılıb (naxış
//   yalnız `js/**/*.js` götürür). Yeni ambient bəyan lazım olsa ora əlavə et,
//   əks halda fayl sükutla nəzərə alınmaz.

declare module '*.css' {
  const url: string;
  export default url;
}
