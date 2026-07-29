// ESLint (flat config) — AUDIT-TASK-10 / Faza 1.3 (audit proses borcu #9).
//
// Audit: "450 KB `js/` heç bir statik analizdən keçmir."
//
// ════════════════════════════════════════════════════════════════════════════
// STRATEGİYA — sənədin açıq göstərişi (§1.3)
// ════════════════════════════════════════════════════════════════════════════
//
// ⚠ "İlk qaçış minlərlə xəbərdarlıq verəcək. Qaydaları TƏDRİCƏN aktivləşdir:
//    əvvəlcə `error` səviyyəli təhlükəsizlik qaydaları, sonra stil."
//
// Ona görə burada üç səviyyə var:
//   error → SƏHVDİR, CI-nı bloklayır (təhlükəsizlik + korrektlik)
//   warn  → görünür, lakin bloklamır (tədricən təmizlənir)
//   off   → qəsdən söndürülüb, ƏSASLANDIRMA ilə
//
// 🔴 KÜTLƏVİ FORMATLAŞDIRMA QADAĞASI (§1.3):
//   Prettier `npm run lint`-ə DAXİL EDİLMİR. Bütün faylı yenidən formatlamaq
//   `git blame`-i məhv edir və hər sonrakı merge-i konfliktə salır. Formatlaşdırma
//   yalnız YENİ/DƏYİŞDİRİLƏN fayllara əl ilə tətbiq olunur (`npm run format`).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**', 'node_modules/**', '.wrangler/**', 'test-results/**',
      'playwright-report/**', 'legacy/**',
      // Vite build çıxışı və tip-only shim-lər.
      'js/dom-shims.d.ts',
    ],
  },

  /* ═══════════════ worker/ — Cloudflare Workers (TypeScript) ═══════════════ */
  ...tseslint.config({
    files: ['worker/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.worker, ...globals.node },
    },
    rules: {
      /* ── Təhlükəsizlik: bloklayır ── */
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      /* ── Korrektlik: bloklayır ── */
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-self-compare': 'error',
      'no-unsafe-negation': 'error',
      'require-atomic-updates': 'off',   // async D1 naxışlarında yalançı pozitiv verir
      'no-debugger': 'error',

      /* ── TypeScript ── */
      // `any` layihədə D1 sətirləri üçün QƏSDƏN işlədilir (`first<any>()`):
      // D1 sxemi tip səviyyəsində təsvir olunmayıb. Bu, ayrıca işdir.
      '@typescript-eslint/no-explicit-any': 'off',
      // `tsc --noEmit` onsuz da `noUnusedLocals` ilə bunu tutur; ikiqat
      // xəbərdarlıq səs-küydür.
      '@typescript-eslint/no-unused-vars': 'off',
      // `catch {}` bloklarının hamısında izahlı şərh var (Task 10 inventarı:
      // 16 blok, şərhsiz 0) — qayda yalançı pozitiv verərdi.
      'no-empty': ['error', { allowEmptyCatch: true }],

      // ⚠ QƏSDƏN SÖNDÜRÜLÜB — `let ok = false; try { ok = … } catch { … }`
      // naxışı bu layihədə FAIL-CLOSED başlanğıc dəyəridir (auth.ts verifyJWT,
      // files-auth.ts üzvlük, archive.ts). ESLint 10 onu "istifadəsiz təyinat"
      // sayır, çünki hər yol yenidən mənimsədir. İnitializer-i silmək
      // dəyişəni `undefined` riskinə açardı və qorumanın NİYYƏTİNİ gizlədərdi.
      'no-useless-assignment': 'off',
    },
  }),

  /* ═══════════════ js/ — brauzer (ES modulları) ═══════════════ */
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    ...js.configs.recommended,
    rules: {
      ...js.configs.recommended.rules,

      /* ── Təhlükəsizlik: bloklayır ── */
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      // 🔴 Brauzer modal dialoqu bütün axını bloklayır və E2E-ni dondurur.
      'no-alert': 'error',

      /* ── Korrektlik: bloklayır ── */
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-self-compare': 'error',

      /* ── Tədricən təmizlənir ── */
      // `js/` kodunda onlarla istifadə olunmayan dəyişən var; onları indi
      // silmək DAVRANIŞ dəyişikliyi riski daşıyır (Faza 3 refaktor qaydası).
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  /* ═══════════════ e2e/ + test/ — test kodu ═══════════════ */
  ...tseslint.config({
    files: ['e2e/**/*.ts', 'test/**/*.ts', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
      // ⚠ `test.beforeEach(({ }, testInfo) => …)` PLAYWRIGHT İDİOMUDUR: birinci
      // parametr fixture obyektidir və bu testlərdə lazım deyil, lakin ikinci
      // (`testInfo`) lazımdır. Boş naxışı silmək mümkün deyil.
      'no-empty-pattern': 'off',
      'no-useless-assignment': 'off',
    },
  }),
];
