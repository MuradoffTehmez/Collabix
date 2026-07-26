// Playwright globalSetup: test istifadəçilərini hazırlayır və BİR DƏFƏ giriş edib
// sessiyanı fayla yazır. Hər test ayrıca login etsəydi `auth` rate-limit-i
// (5 dəq / 10 sorğu) işə düşərdi və dəst səbəbsiz qırmızı olardı.
import { request, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedTestUsers, TEST_PASS, PRIMARY, AUTH_FILE, E2E_TURNSTILE } from './seed';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  await seedTestUsers(baseURL);

  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', { data: { username: PRIMARY, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE } });
  if (!res.ok()) {
    throw new Error(`E2E girişi alınmadı (${res.status()}): ${await res.text()}`);
  }
  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  await ctx.storageState({ path: AUTH_FILE });
  await ctx.dispose();
}
