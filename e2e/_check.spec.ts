import { test, expect } from './auth-fixture';
import { AUTH_FILE } from './seed';
test('code btn text', async ({ page }, info) => {
  if (info.project.name !== 'mobile') { test.skip(); return; }
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'networkidle' });
  const txt = await page.locator('#addCodeBlockBtn').textContent();
  console.log('CODE-BTN:', JSON.stringify(txt));
  expect(txt).toContain('</>');
  expect(txt).not.toContain('&lt;');
});
