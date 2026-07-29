import { type Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { collectConsoleErrors, assertConsoleClean, apiGet } from './helpers';
import { AUTH_FILE } from './seed';

// TASK-7 / Bənd 9 — otaq/DM mesajlarında initials-avatar + vaxt + ardıcıl
// eyni-göndərən qruplaşdırma (Slack/LinkedIn üslubu).

async function apiSend(page: Page, path: string, method: string, body?: unknown) {
  return page.evaluate(async ({ p, m, b }) => {
    const r = await fetch(p, {
      method: m,
      headers: b ? { 'Content-Type': 'application/json' } : {},
      body: b ? JSON.stringify(b) : undefined,
    });
    let data: any = null;
    try { data = await r.json(); } catch { /* boş */ }
    return { status: r.status, ok: r.ok, data };
  }, { p: path, m: method, b: body });
}

async function bootApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toHaveClass(/active/);
}

test.describe('Mesaj avatar+vaxt (Bənd 9)', () => {

  test('otaq mesajı avatar + ad + vaxt ilə qrupda render olur', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);

    // 'general' seed-də var → chat açılanda avtomatik seçilir.
    const marker = 'E2E qrup mesajı ' + Date.now();
    const one = await apiSend(page, '/api/rooms/general/messages', 'POST', { type: 'text', text: marker });
    expect(one.ok, JSON.stringify(one)).toBeTruthy();
    // Ardıcıl ikinci mesaj — eyni göndərən → eyni qrupa düşməli (ayrıca avatar YOX).
    await apiSend(page, '/api/rooms/general/messages', 'POST', { type: 'text', text: marker + ' #2' });

    await page.goto('/#chat', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#page-chat')).toHaveClass(/active/);

    const group = page.locator('#chatMessages .msg-group', { hasText: marker }).last();
    await expect(group).toBeVisible({ timeout: 12_000 });
    // Qrup başlığı: bir avatar + ad + vaxt (ardıcıl mesajlar üçün BİR dəfə).
    await expect(group.locator('.mg-avatar')).toHaveCount(1);
    await expect(group.locator('.mg-name')).not.toBeEmpty();
    await expect(group.locator('.mg-time')).toBeVisible();
    // Hər iki ardıcıl mesaj EYNİ qrupdadır (qruplaşdırma işləyir; tək avatar, çox bubble).
    await expect(group).toContainText(marker);
    await expect(group).toContainText(marker + ' #2');
    expect(await group.locator('.msg').count()).toBeGreaterThanOrEqual(2);

    assertConsoleClean(errors);
  });
});
