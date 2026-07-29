// Playwright globalSetup: test istifadəçilərini hazırlayır və HƏR LAYİHƏ ÜÇÜN
// AYRICA giriş edib sessiyanı fayla yazır. Hər test ayrıca login etsəydi `auth`
// rate-limit-i (5 dəq / 10 sorğu) işə düşərdi və dəst səbəbsiz qırmızı olardı.
//
// 🔴 NİYƏ İKİ AYRI SESSİYA — bax `seed.ts` → AUTH_FILE_DESKTOP/MOBILE şərhi.
// Qısaca: paylaşılan fayl refresh rotasiyası ilə zəhərlənirdi və dəstin ikinci
// yarısı (≈40 test) kütləvi 401 alırdı.
import { request, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  seedTestUsers, TEST_PASS, PRIMARY, E2E_TURNSTILE,
  AUTH_FILE_DESKTOP, AUTH_FILE_MOBILE,
} from './seed';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  await seedTestUsers(baseURL);

  mkdirSync(dirname(AUTH_FILE_DESKTOP), { recursive: true });
  // ⚠ ARDICIL, paralel DEYİL: `auth` səbəti 5 dəqiqədə 10 sorğudur və paralel
  // iki giriş eyni pəncərəyə düşür. İki giriş limitin çox altındadır.
  for (const path of [AUTH_FILE_DESKTOP, AUTH_FILE_MOBILE]) {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.post('/api/auth/login', {
      data: { username: PRIMARY, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE },
    });
    if (!res.ok()) {
      throw new Error(`E2E girişi alınmadı (${res.status()}): ${await res.text()}`);
    }
    await ctx.storageState({ path });
    await ctx.dispose();
  }
}
