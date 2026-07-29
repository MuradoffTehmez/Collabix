// Vitest — AUDIT-TASK-10 / Faza 1.5.
//
// ⚠ `include` MƏCBURİDİR: default naxış (`**/*.{test,spec}.*`) `e2e/*.spec.ts`
// Playwright fayllarını da götürür və onlar Vitest altında çökür
// ("You are calling test() from an async test.describe() block").
// İki dəst QƏSDƏN ayrıdır:
//   test/  → saf funksiyalar, millisaniyələr, hər push-da (CI `gates` job-u)
//   e2e/   → real Worker + brauzer, ~27 dəqiqə (CI ayrıca `e2e` job-u)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // `worker/` kodu Cloudflare Workers runtime-ı üçün yazılıb, lakin buradakı
    // testlər YALNIZ saf funksiyalara toxunur (D1/KV/DO tələb etmir), ona görə
    // node mühiti kifayətdir. Miniflare inteqrasiyası ikinci mərhələdir
    // (AUDIT-TASK-10 §1.5) — E2E onu qismən örtür.
    environment: 'node',
    reporters: ['default'],
  },
});
