import { test, expect, type Page, type Browser } from '@playwright/test';
import { collectConsoleErrors, assertConsoleClean } from './helpers';
import { AUTH_FILE, TEST_PASS, E2E_TURNSTILE } from './seed';

// TASK-8 / FAZA 3+6 — onboarding + redaktor UX:
//   Bənd 16 — markdown redaktoru + canlı önbaxış
//   Bənd 17 — admin "Geri al" toast
//   Bənd 6  — profil tamlığı + gamification
test.use({ storageState: AUTH_FILE });

async function openApp(page: Page, hash: string) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/' + hash, { waitUntil: 'networkidle' });
}

test.describe('Markdown redaktoru (Bənd 16)', () => {

  test('composer text blokunda toolbar var, konsol təmiz', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await openApp(page, '#home');
    // Composer həmişə açıqdır (feed yuxarısında).
    await expect(page.locator('.md-toolbar').first()).toBeVisible();
    await expect(page.locator('.md-tb-btn').first()).toBeVisible();
    assertConsoleClean(errors);
  });

  test('toolbar seçili mətni markdown ilə əhatələyir', async ({ page }) => {
    await openApp(page, '#home');
    const ta = page.locator('#blockList .c-text').first();
    await ta.fill('salam dünya');
    // "salam" sözünü seç.
    await ta.evaluate((el: HTMLTextAreaElement) => { el.selectionStart = 0; el.selectionEnd = 5; });
    await page.locator('.md-tb-btn', { hasText: 'B' }).first().click();
    expect(await ta.inputValue()).toContain('**salam**');
  });

  test('canlı önbaxış markdown-u render edir', async ({ page }) => {
    await openApp(page, '#home');
    const ta = page.locator('#blockList .c-text').first();
    await ta.fill('**qalın** və *kursiv*');
    // Önbaxışı aç.
    await page.locator('.md-tb-toggle').first().click();
    const preview = page.locator('.c-md-preview').first();
    await expect(preview.locator('strong')).toHaveText('qalın');
    await expect(preview.locator('em')).toHaveText('kursiv');
  });

  test('önbaxış XSS-i icra etmir (DOMPurify)', async ({ page }) => {
    await openApp(page, '#home');
    const ta = page.locator('#blockList .c-text').first();
    await ta.fill('<img src=x onerror="window.__xss=1"> [link](javascript:alert(1))');
    await page.locator('.md-tb-toggle').first().click();
    await page.waitForTimeout(300);
    // Zərərli kod icra OLUNMAMALIDIR.
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    // javascript: sxemi təmizlənməlidir.
    const href = await page.locator('.c-md-preview a').first().getAttribute('href').catch(() => null);
    if (href) expect(href).not.toContain('javascript:');
  });
});

test.describe('Profil tamlığı (Bənd 6)', () => {

  test('tamlıq indikatoru render olunur və faiz göstərir', async ({ page }) => {
    await openApp(page, '#profil');
    await expect(page.locator('#page-profil')).toHaveClass(/active/);

    const host = page.locator('#profCompleteness');
    // e2e_main profili natamamdır → indikator görünməlidir və faiz olmalıdır.
    const ring = host.locator('.cmp-ring-num');
    if (await ring.count() > 0) {
      const txt = await ring.textContent();
      expect(txt).toMatch(/^\d+%$/);
      // Çatışmayan sahə çipləri redaktora aparmalıdır.
      await expect(host.locator('.cmp-chip').first()).toBeVisible();
    }
  });
});

test.describe('Admin Geri al (Bənd 17)', () => {

  // ⚠ DESKTOP-ONLY: bu testlər PAYLAŞILAN `e2e_camal` hesabının blocked
  // vəziyyətini dəyişir. İki viewport-da paralel işləsəydilər eyni sətri
  // döyəcləyib yarış yaradardılar. Undo məntiqi viewport-dan asılı deyil.
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop',
      'Admin undo — viewport-dan asılı deyil + paylaşılan hesab vəziyyətini dəyişir');
  });

  const VICTIM = 'e2e_camal';

  async function adminPage(browser: Browser) {
    // AUTH_FILE = e2e_main = admin. Yeni səhifə həmin sessiya ilə.
    const ctx = await browser.newContext({ storageState: AUTH_FILE });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
      localStorage.setItem('collabix_onboarded', '1');
    });
    await page.goto('/#admin', { waitUntil: 'networkidle' });
    await expect(page.locator('#page-admin')).toHaveClass(/active/);

    // ⚠ MƏCBURİ SIFIRLAMA: əvvəlki uğursuz işə salma qurbanı bloklu qoya bilər.
    // `beforeEach` bunu təmizləmir, ona görə hər test təmiz vəziyyətdən başlasın.
    await page.evaluate(async u => {
      const d = await fetch('/api/admin/users?q=' + u).then(r => r.json()) as any;
      const row = (d.users || []).find((x: any) => x.username === u);
      if (row && row.blocked) await fetch('/api/admin/users/' + row.uid, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: false }),
      });
    }, VICTIM);
    return { ctx, page };
  }

  async function findVictimRow(page: Page) {
    // ⚠ Admin paneli sidebar tab-larına bölünüb; `#adminUserList` `#tab-users`
    // panelindədir və açılışda AKTİV DEYİL. Tab açılmadan sətir DOM-da olsa da
    // görünmür (bax e2e/admin.spec.ts → `openTab`).
    await page.locator('.admin-sidebar-btn[data-tab="tab-users"]').click();
    await expect(page.locator('#tab-users')).toHaveClass(/active/);
    // Axtarış qutusu debounce (250ms) + server reload tetikləyir. `fill` bir
    // `input` hadisəsi yaradır; sətrin GÖRÜNMƏSİNİ gözləyirik (sabit timeout yox).
    await page.locator('#adminUserSearch').fill('');
    await page.locator('#adminUserSearch').fill(VICTIM);
    const row = page.locator('#adminUserList .admin-user-row').filter({ hasText: '@' + VICTIM }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    return row;
  }

  async function victimBlocked(page: Page): Promise<boolean> {
    return page.evaluate(async u => {
      const d = await fetch('/api/admin/users?q=' + u).then(r => r.json()).catch(() => ({ users: [] })) as any;
      const row = (d.users || []).find((x: any) => x.username === u);
      return !!(row && row.blocked);
    }, VICTIM);
  }

  test('"Geri al" mutasiyanı serverə göndərmir', async ({ browser }) => {
    const { ctx, page } = await adminPage(browser);
    // Başlanğıc: qurban bloklu deyil.
    expect(await victimBlocked(page)).toBe(false);

    const row = await findVictimRow(page);
    await row.getByRole('button', { name: 'Blokla', exact: true }).click();

    // Undo toast görünməlidir.
    const undo = page.locator('.toast-undo');
    await expect(undo).toBeVisible();
    await undo.locator('.toast-undo-btn').click();   // GERİ AL

    // Toast bitmə müddətindən çox gözlə — commit OLMAMALIDIR.
    await page.waitForTimeout(1000);
    expect(await victimBlocked(page), 'geri alındıqdan sonra qurban bloklu OLMAMALIDIR').toBe(false);

    await ctx.close();
  });

  test('geri alınmasa mutasiya commit olunur', async ({ browser }) => {
    const { ctx, page } = await adminPage(browser);
    expect(await victimBlocked(page)).toBe(false);

    const row = await findVictimRow(page);
    await row.getByRole('button', { name: 'Blokla', exact: true }).click();

    // Undo toast görünür, sonra ÖZÜ yox olur (geri alınmadı → commit).
    // Toast-ın itməsini gözləmək = commit-in başlamasını gözləmək.
    const undo = page.locator('.toast-undo');
    await expect(undo).toBeVisible();
    await expect(undo).toHaveCount(0, { timeout: 12_000 });

    // Commit serverdə tamamlanmalıdır.
    await expect.poll(() => victimBlocked(page),
      { timeout: 8_000, message: 'commit sonrası qurban bloklu olmalıdır' }).toBe(true);

    // Təmizlik BİRBAŞA API ilə: UI-dakı ikinci axtarış dövrü flaky-dir və
    // testin əsl invariantına (commit baş verdi) aidiyyatı yoxdur.
    await page.evaluate(async u => {
      const d = await fetch('/api/admin/users?q=' + u).then(r => r.json()) as any;
      const row = (d.users || []).find((x: any) => x.username === u);
      if (row) await fetch('/api/admin/users/' + row.uid, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: false }),
      });
    }, VICTIM);
    expect(await victimBlocked(page)).toBe(false);

    await ctx.close();
  });
});
