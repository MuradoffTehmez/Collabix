// Autentifikasiyalı testlər üçün `test` — sessiyanı LAYİHƏYƏ GÖRƏ seçir.
//
// 🔴 NİYƏ LAZIMDIR (≈40 mobile sınığının kök səbəbi):
// `globalSetup` sessiyanı fayla yazır və bütün kontekstlər onu paylaşırdı.
// Access token ömrü 15 dəqiqədir (`worker/auth.ts` → ACCESS_TTL), tam dəst isə
// ~28 dəqiqə çəkir. Token bitəndə client `/api/auth/refresh` çağırır, refresh
// isə ROTASİYA edir — fayldakı nüsxə köhnəlir. Növbəti kontekst köhnə refresh
// token təqdim edəndə bu, "token reuse" sayılıb SESSİYANI LƏĞV EDİR.
// (Server davranışı DÜZGÜNDÜR — qüsur harness-də idi.) Nəticədə dəstin ikinci
// yarısı kütləvi 401 alırdı və bu, səhvən "mobile responsive qüsuru" sayılmışdı.
//
// HƏLL: hər layihə ÖZ sessiyasını işlədir (`global-setup.ts` ikisini yaradır),
// yəni desktop-un rotasiyası mobile-a TOXUNMUR.
//
// ⚠ NİYƏ FIXTURE, NİYƏ KONFİQ DEYİL: layihə səviyyəsində `use.storageState`
// təyin etsək, o, QONAQ testlərinə də (məs. `home.spec.ts` → `#pub-welcome`)
// tətbiq olunar və onlar sınar. Fixture yalnız bunu İDXAL EDƏN spec-lərə təsir edir.
//
// ⚠ Sıra ilə həll cəhdləri UĞURSUZ oldu, təkrarlanmasın:
//   • asılılıqsız "auth-refresh" layihəsi → Playwright onu ƏN ƏVVƏL işlətdi;
//   • `dependencies: ['desktop']` → desktop sınanda mobile ATLANIR (570 → 292 test);
//   • `teardown` → yalnız ən sonda, mobile-dan SONRA işləyir.
import { test as base } from '@playwright/test';
import { AUTH_FILE_DESKTOP, AUTH_FILE_MOBILE } from './seed';

export const test = base.extend({
  storageState: async ({}, use, testInfo) => {
    await use(testInfo.project.name === 'mobile' ? AUTH_FILE_MOBILE : AUTH_FILE_DESKTOP);
  },
});
export { expect } from '@playwright/test';
