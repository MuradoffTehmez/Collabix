// Sessiyanın yenilənməsi — layihələr arasında işləyən "setup" layihəsi.
//
// 🔴 NİYƏ LAZIMDIR (bu, ~40 mobile sınığının KÖK SƏBƏBİ idi):
//
//   `globalSetup` bir dəfə giriş edib sessiyanı `AUTH_FILE`-a yazır və HƏR İKİ
//   layihə (desktop, mobile) onu paylaşır. Lakin:
//     • access token ömrü 15 dəqiqədir (`worker/auth.ts` → ACCESS_TTL);
//     • tam dəst ~28 dəqiqə çəkir və `desktop` təkbaşına ~14 dəqiqə aparır.
//
//   Yəni `mobile` layihəsi başlayanda fayldakı access token ARTIQ BİTİB.
//   Client onu refresh etməyə çalışır, refresh token isə desktop testləri
//   zamanı ROTASİYA olunmuş ola bilər — fayldakı nüsxə köhnə qalır. Köhnə
//   refresh token təqdim edilməsi isə "token reuse" kimi qiymətləndirilir və
//   sessiya LƏĞV EDİLİR (təhlükəsizlik davranışı DÜZGÜNDÜR — qüsur harness-dədir).
//
//   Nəticə: mobile layihəsinin demək olar bütün autentifikasiyalı testləri
//   401 alıb sınırdı və bu, "mobile responsive qüsuru" kimi görünürdü.
//
// HƏLL: `mobile` layihəsi bu setup-dan ASILIDIR (bax playwright.config.ts).
// Setup mobile başlamazdan DƏRHAL ƏVVƏL yenidən giriş edib `AUTH_FILE`-ı
// TƏZƏ sessiya ilə əvəzləyir. Spec fayllarına toxunmaq lazım gəlmir —
// onlar `AUTH_FILE`-ı yol kimi oxuyur və kontekst yaradılanda faylın SON
// məzmunu götürülür.
//
// ⚠ Alternativ (hər layihəyə ayrıca fayl) 22 spec faylının redaktəsini tələb
// edərdi; bu variant eyni nəticəni sıfır spec dəyişikliyi ilə verir.
import { test as setup, request, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TEST_PASS, PRIMARY, AUTH_FILE, E2E_TURNSTILE } from './seed';

setup('sessiyanı yenilə (növbəti layihə üçün)', async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', {
    data: { username: PRIMARY, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE },
  });
  expect(res.ok(), `sessiya yenilənmədi (${res.status()}): ${await res.text()}`).toBeTruthy();
  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  await ctx.storageState({ path: AUTH_FILE });
  await ctx.dispose();
});
