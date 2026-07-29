// Autentifikasiyalı testlər üçün `test` — sessiyanı LAYİHƏYƏ görə seçir və
// KÖHNƏLMƏDƏN ƏVVƏL təzələyir.
//
// ════════════════════════════════════════════════════════════════════════════
// İKİ AYRI QÜSUR, İKİ AYRI HƏLL
// ════════════════════════════════════════════════════════════════════════════
//
// ── Qüsur 1 (Task 9-da bağlandı): PAYLAŞILAN fayl ──────────────────────────
// `globalSetup` sessiyanı TƏK fayla yazırdı və hər iki layihə onu paylaşırdı.
// Refresh ROTASİYA edir → bir layihənin refresh-i digərinin nüsxəsini
// köhnəldirdi. Həll: hər layihəyə ayrı fayl.
//
// ── Qüsur 2 (AUDIT-TASK-10 / Faza 1.2 — BU FAYL): sessiyanın YAŞI ─────────
// 🔴 Baseline ölçməsi (2026-07-29, commit `1a00d96`, tək kəsilməmiş qaçış):
//      desktop → 0 sınıq
//      mobile  → 66 sınıq
//    Bütün mobile sınıqlarının səbəbi eyni idi:
//
//      `ACCESS_TTL = 15 dəqiqə` (worker/auth.ts)
//      `globalSetup` HƏR İKİ sessiyanı t = 0-da yaradır
//      `desktop` layihəsi ~20 dəqiqə çəkir
//      → `mobile` başlayanda fayldakı access token ARTIQ BİTİB
//      → hər mobile konteksti refresh etməli olur
//      → BİRİNCİ refresh token-i rotasiya edir, fayl köhnə nüsxəni saxlayır
//      → İKİNCİ kontekst köhnə token təqdim edir
//      → server bunu "token reuse" sayıb `revokeAllSessions` çağırır
//      → qalan BÜTÜN mobile testləri 401 alır
//
//    HƏLLEDİCİ SÜBUT: mobile-ın QONAQ testləri (`home.spec` 21/21) KEÇİRDİ,
//    yalnız sessiyalılar sınırdı. Yəni qüsur viewport-da deyil, sessiyanın
//    yaşındadır. ⚠ Server davranışı DÜZGÜNDÜR — reuse aşkarlaması Task 8-in
//    qəsdli təhlükəsizlik mexanizmidir; qüsur harness-dədir.
//
//    HƏLL: sessiya `globalSetup`-da deyil, İSTİFADƏ ANINDA yaradılır və
//    `SESSION_MAX_AGE_MS` keçəndə təzələnir.
//
// ⚠ NİYƏ HƏR TESTDƏ YENİ GİRİŞ DEYİL: `auth` səbəti IP üzrədir (10/300 s,
//   test mühitində ×20 = 200). 600+ test × 1 giriş həmin büdcəni yeyər və dəst
//   öz-özünü 429-a salardı. Keş ilə qaçış başına cəmi bir neçə giriş olur.
//
// ⚠ NİYƏ FIXTURE, NİYƏ KONFİQ: layihə səviyyəsində `use.storageState` təyin
//   etsək, o, QONAQ testlərinə də (məs. `home.spec.ts` → `#pub-welcome`)
//   tətbiq olunar və onlar sınar — Task 9-da məhz bu baş verdi.
//
// ⚠ Sıra ilə həll cəhdləri UĞURSUZ oldu, təkrarlanmasın:
//   • asılılıqsız "auth-refresh" layihəsi → Playwright onu ƏN ƏVVƏL işlətdi;
//   • `dependencies: ['desktop']` → desktop sınanda mobile ATLANIR (570 → 292);
//   • `teardown` → yalnız ən sonda, mobile-dan SONRA işləyir.
import { test as base, request as apiRequest } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  AUTH_FILE_DESKTOP, AUTH_FILE_MOBILE, TEST_PASS, PRIMARY, E2E_TURNSTILE,
} from './seed';

/**
 * Sessiya bu yaşdan sonra təzələnir.
 *
 * `ACCESS_TTL` 15 dəqiqədir; 8 dəqiqə seçilib ki, ən uzun tək test (arxiv UI
 * testi — 120 s timeout) belə pəncərənin içində qalsın və heç bir kontekst
 * bitmiş token ilə başlamasın.
 */
const SESSION_MAX_AGE_MS = 8 * 60_000;

/** Layihə adı → son yazılmış sessiya faylı və onun yazılma anı. */
const cache = new Map<string, { file: string; at: number }>();

async function ensureSession(project: string, baseURL: string): Promise<string> {
  const file = project === 'mobile' ? AUTH_FILE_MOBILE : AUTH_FILE_DESKTOP;
  const hit = cache.get(project);
  if (hit && Date.now() - hit.at < SESSION_MAX_AGE_MS) return hit.file;

  mkdirSync(dirname(file), { recursive: true });
  const ctx = await apiRequest.newContext({ baseURL });
  try {
    const res = await ctx.post('/api/auth/login', {
      data: { username: PRIMARY, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE },
    });
    if (!res.ok()) {
      throw new Error(`E2E sessiyası təzələnmədi (${res.status()}): ${await res.text()}`);
    }
    await ctx.storageState({ path: file });
  } finally {
    await ctx.dispose();
  }
  cache.set(project, { file, at: Date.now() });
  return file;
}

export const test = base.extend({
  storageState: async ({ baseURL }, use, testInfo) => {
    await use(await ensureSession(testInfo.project.name, baseURL as string));
  },
});
export { expect } from '@playwright/test';
