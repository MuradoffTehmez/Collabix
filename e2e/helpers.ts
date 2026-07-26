import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

// Konsol xətalarını toplayır. DoD "sıfır konsol xətası" tələb edir, ona görə
// hər testdə quraşdırılır və sonda assertConsoleClean() ilə yoxlanılır.
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', req => {
    // Test dayandırılanda ləğv olunan sorğular səs-küydür — sayılmır.
    const f = req.failure()?.errorText || '';
    if (f.includes('ERR_ABORTED') || f.includes('NS_BINDING_ABORTED')) return;
    errors.push(`requestfailed: ${req.url()} — ${f}`);
  });
  return errors;
}

export function assertConsoleClean(errors: string[]) {
  expect(errors, `Konsol xətaları:\n${errors.join('\n')}`).toEqual([]);
}

// Homepage-ə keç və ilk render-i gözlə.
export async function gotoHome(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#pub-welcome')).toHaveClass(/active/);
}

// Sessiyalı API sorğusu — SƏHİFƏ daxilindən (brauzer fetch-i ilə).
//
// Niyə page.request YOX: sessiya cookie-si `Secure` bayrağı ilə qoyulur
// (prod HTTPS-dir — bu, düzgün davranışdır). Brauzer `127.0.0.1`-i etibarlı
// origin sayıb cookie-ni http üzərində də göndərir; Playwright-in Node tərəfli
// APIRequestContext-i isə `Secure`-u sərt tətbiq edib göndərmir → 401.
// Səhifədaxili fetch həm işləyir, həm də tətbiqin əsl kod yolunu təkrarlayır.
export async function apiGet(page: Page, path: string) {
  return page.evaluate(async p => {
    const r = await fetch(p);
    const headers: Record<string, string> = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    return { status: r.status, ok: r.ok, headers, body: await r.text() };
  }, path);
}

// Cookie banneri bağla — digər testlərdə klikləri örtməsin.
export async function dismissCookies(page: Page) {
  const banner = page.locator('#cookieBanner');
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole('button').last().click();
    await expect(banner).toHaveCount(0);
  }
}
