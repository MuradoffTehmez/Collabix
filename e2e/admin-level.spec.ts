import { type Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { collectConsoleErrors, assertConsoleClean, apiGet } from './helpers';
import { AUTH_FILE } from './seed';

// TASK-7 / Bənd 6 — admin XP redaktəsi (Level XP-dən törənir) + 'user-level-edit' audit log.

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

test.describe('Admin XP/Level redaktəsi (Bənd 6)', () => {

  test('XP dəyişir, Lv törənir, user-level-edit jurnala düşür', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);

    // Admin olmayan hədəf istifadəçi tap.
    const users = JSON.parse((await apiGet(page, '/api/users')).body).users;
    const target = users.find((u: any) => u.username === 'e2e_dilara') || users.find((u: any) => u.username !== 'e2e_main');
    expect(target, 'hədəf istifadəçi tapılmadı').toBeTruthy();

    // ⚠ Lokal D1 bütün spec-lər arasında PAYLAŞILIR və silinmir. XP-ni bərpa
    // etməsək `users.spec.ts` XP-sıralama testi sonrakı işə salmalarda sınır
    // (Dilarə 100 → 12300 olub siyahının başına keçirdi). Ona görə `finally`.
    const originalXp = target.xp;
    const newXp = 12300;   // levelFromXP = floor(sqrt(123))+1 = 12
    try {
      const res = await apiSend(page, `/api/admin/users/${target.uid}`, 'PATCH', { xp: newXp });
      expect(res.ok, JSON.stringify(res)).toBeTruthy();

      // XP D1-də yeniləndi.
      const after = JSON.parse((await apiGet(page, '/api/users')).body).users.find((u: any) => u.uid === target.uid);
      expect(after.xp).toBe(newXp);

      // Audit jurnalında 'user-level-edit' sətri (warning səviyyəli).
      const logs = JSON.parse((await apiGet(page, '/api/admin/logs')).body).logs;
      const entry = logs.find((l: any) => l.action === 'user-level-edit' && l.targetUid === target.uid);
      expect(entry, 'user-level-edit jurnal sətri yoxdur').toBeTruthy();
      expect(entry.level).toBe('warning');
    } finally {
      await apiSend(page, `/api/admin/users/${target.uid}`, 'PATCH', { xp: originalXp });
    }

    assertConsoleClean(errors);
  });

  test('admin user-edit modalında XP sahəsi + Lv önizləmə var', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
      localStorage.setItem('collabix_onboarded', '1');
    });
    await page.goto('/#admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#page-admin')).toHaveClass(/active/);
    // İstifadəçi siyahısı `#tab-users` panelindədir — açılışda aktiv deyil.
    await page.locator('.admin-sidebar-btn[data-tab="tab-users"]').click();
    await expect(page.locator('#tab-users')).toHaveClass(/active/);
    const editBtn = page.locator('#adminUserList .admin-user-row button.btn-mini[title="Redaktə et"]').first();
    await expect(editBtn).toBeVisible({ timeout: 12_000 });
    await editBtn.click();

    const modal = page.locator('#modalCard');
    await expect(modal.locator('input[type="number"]')).toBeVisible();
    await expect(modal.locator('.role-badge', { hasText: 'Lv' })).toBeVisible();

    assertConsoleClean(errors);
  });
});
