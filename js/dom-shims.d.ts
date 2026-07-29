// DOM tip genişləndirmələri — AUDIT-TASK-10 / Faza 1.4.
//
// ════════════════════════════════════════════════════════════════════════════
// NİYƏ BU FAYL VAR VƏ NƏYİ QURBAN VERİR
// ════════════════════════════════════════════════════════════════════════════
//
// `checkJs` ilk qaçışda 211 xəta verdi. Paylanma ölçüldü:
//
//   183 × TS2339 "property does not exist"  ← DOM DARALTMA səs-küyü
//        81 HTMLElement · 38 Element · 31 EventTarget · 15 {} · 10 Event · 6 Window
//    28 × qalan                              ← ƏSL siqnal
//
// Yəni `document.getElementById('x').value` naxışı (kodda onlarla yerdə)
// xətaların 87%-ni yaradır. Bunlar QÜSUR DEYİL — kod işləyir; TypeScript
// sadəcə `HTMLElement`-in `.value` daşımadığını deyir.
//
// 🔴 SEÇİM VƏ ONUN QİYMƏTİ:
//   Alternativ A — 20 faylda yüzlərlə `/** @type {HTMLInputElement} */` cast
//     əlavə etmək. 450 KB-da mexaniki dəyişiklik, `git blame`-i korlayır və
//     Faza 3-ün "refaktor davranış dəyişikliyi daşımamalıdır" qaydası ilə
//     eyni commit-də qarışardı.
//   Alternativ B (SEÇİLDİ) — səs-küy yaradan DAR DOM səthini genişləndirmək.
//
//   ⚠ QURBAN: `getElementById(...)` nəticəsində DOM tip təhlükəsizliyi itir.
//   ⚠ QORUNUR: yanlış arqument sayı, `possibly undefined`, mümkünsüz müqayisə,
//     rəqəm olmayan üzərində arifmetika, yanlış tipli funksiya arqumenti —
//     yəni sənədin tələb etdiyi "tipik səhvlər" (§1.4).
//
// 🔴 GERİ QAYTARMA YOLU (bu fayl ƏBƏDİ qalmamalıdır):
//   `js/` modul-modul JSDoc ilə tiplənəndə bu faylın müvafiq bloku silinir.
//   Hər blok ayrıca silinə bilsin deyə qəsdən bölünüb. Tam silinmə hədəfi
//   `docs/SCHEMA-ROADMAP.md` deyil, `docs/TASK-10-SCOPE.md` §4-dədir.
//
// ⚠ Bu fayl TİP-ONLY-dir: `.d.ts` bundle-a düşmür, icra vaxtına təsiri SIFIRDIR.

/* ─── 1. Sorğu metodları (81 + 38 xəta) ────────────────────────────────────
 *
 * Deklarasiya birləşməsində SONRA elan olunan overload ƏVVƏL yoxlanılır,
 * ona görə bu `any` variantı standart imzanı üstələyir.
 */
interface Document {
  getElementById(elementId: string): any;
  querySelector(selectors: string): any;
}

interface Element {
  querySelector(selectors: string): any;
  closest(selector: string): any;
}

interface DocumentFragment {
  querySelector(selectors: string): any;
}

/* ─── 2. Hadisə hədəfləri (31 + 10 xəta) ───────────────────────────────────
 *
 * `e.target` standartda `EventTarget | null`-dır və `.value`/`.dataset`
 * daşımır. Kod hər yerdə `e.target.dataset.id` işlədir.
 *
 * ⚠ `CustomEvent.detail` üçün də lazımdır: kod `bus` hadisələrini
 *   `addEventListener('cx-...', e => e.detail)` ilə oxuyur.
 */
interface EventTarget {
  [key: string]: any;
}

interface Event {
  readonly detail?: any;
}

/* ─── 3. Qlobal `window` genişləndirmələri (6 xəta) ────────────────────────
 *
 * Layihə bir neçə köməkçini `window`-a bağlayır (məs. `window.toast`) ki,
 * inline `onclick` və debug konsolu ona çata bilsin.
 */
interface Window {
  [key: string]: any;
}

/* ─── 4. Vite `import.meta.env` (2 xəta) ───────────────────────────────────
 *
 * Vite bunu build zamanı inyeksiya edir; standart `ImportMeta`-da yoxdur.
 */
interface ImportMeta {
  readonly env: Record<string, any>;
}
