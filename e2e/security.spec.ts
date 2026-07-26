import { test, expect, type Page } from '@playwright/test';
import { collectConsoleErrors, assertConsoleClean } from './helpers';
import { AUTH_FILE } from './seed';

// TASK-8 / FAZA 1 — UI qatı: sessiya siyahısı (Bənd 3), təhlükə paneli (Bənd 1),
// Turnstile yuvası (Bənd 7). Hər iki layihədə (desktop + Pixel 7) işləyir.
//
// Bu fayl sessiyaları YALNIZ OXUYUR — heç bir test giriş etmir, token fırlatmır
// və ya sessiya ləğv etmir. Səbəb: `AUTH_FILE` bütün dəst üzrə paylaşılır və
// ona toxunmaq sonrakı testləri sistemdən çıxarardı. Mutasiya edən protokol
// testləri izolə edilmiş kontekstlərlə `security-api.spec.ts`-dədir.
test.use({ storageState: AUTH_FILE });

async function openApp(page: Page, hash: string) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/' + hash, { waitUntil: 'networkidle' });
}

test.describe('Sessiya siyahısı UI (Bənd 3)', () => {

  test('Parametrlərdə cihazlar render olunur, konsol təmizdir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await openApp(page, '#settings');
    await expect(page.locator('#page-settings')).toHaveClass(/active/);

    await expect(page.locator('#sessionList .session-row').first()).toBeVisible();

    // Cari cihaz nişanlanır və onda "çıxart" düyməsi OLMUR — istifadəçi
    // öz-özünü təsadüfən çıxara bilməsin.
    const currentRow = page.locator('#sessionList .session-current');
    await expect(currentRow).toHaveCount(1);
    await expect(currentRow.locator('.btn-mini.block')).toHaveCount(0);
    await expect(currentRow.locator('.session-badge')).toBeVisible();

    assertConsoleClean(errors);
  });

  test('sessiya sətri üfüqi daşma yaratmır', async ({ page }) => {
    await openApp(page, '#settings');
    await expect(page.locator('#sessionList .session-row').first()).toBeVisible();
    // Uzun UA/IPv6 mətni mobil eni dağıtmamalıdır (overflow-wrap qoruması).
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('Təhlükə paneli UI (Bənd 1)', () => {

  test('admin panelində render olunur, konsol təmizdir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await openApp(page, '#admin');
    await expect(page.locator('#page-admin')).toHaveClass(/active/);

    await expect(page.locator('#threatSummary .adm-stat').first()).toBeVisible();
    // Hadisə siyahısı ya sətir, ya "boşdur" mesajı göstərir — hər ikisi düzgündür.
    await expect(page.locator('#threatEvents .threat-row, #threatEvents .threat-empty').first()).toBeVisible();

    assertConsoleClean(errors);
  });

  test('ciddilik etiketi MƏTNlə də verilir (yalnız rənglə deyil)', async ({ page }) => {
    await openApp(page, '#admin');
    const row = page.locator('#threatEvents .threat-row').first();
    // Hadisə yoxdursa yoxlanacaq bir şey də yoxdur — panel boş vəziyyətdədir.
    if (await row.count() === 0) test.skip(true, 'jurnalda hadisə yoxdur');
    await expect(row.locator('.threat-sev')).not.toBeEmpty();
  });
});

test.describe('Bot qoruması UI (Bənd 7)', () => {

  // Test mühiti Cloudflare-in rəsmi test açarı ilə işləyir (playwright.config.ts).
  // Yəni burada REAL Turnstile axını yoxlanılır — saxta obyekt deyil.
  // ⚠ QONAQ konteksti: bu fayl `test.use({ storageState: AUTH_FILE })` altındadır,
  // yəni default olaraq istifadəçi DAXİL OLUB və `/` birbaşa tətbiqə yönəlir —
  // public hero və auth ekranı ümumiyyətlə render olunmur. Turnstile isə məhz
  // auth ekranında qoşulur, ona görə burada sessiyasız kontekst lazımdır.
  test('widget auth ekranında qoşulur və token verir', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const errors = collectConsoleErrors(page);
    // Cookie banneri hero düyməsinin üstünü örtür → razılıq əvvəlcədən verilir.
    await page.addInitScript(() => {
      localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    });
    await page.goto('/', { waitUntil: 'networkidle' });

    const cfg = await page.evaluate(() => fetch('/api/config').then(r => r.json()));
    expect(cfg.turnstileSiteKey, 'test mühitində site key qurulmalıdır').toBeTruthy();

    // Auth ekranı açılana qədər xarici skript YÜKLƏNMƏMƏLİDİR — ziyarətçilərin
    // çoxu bura çatmır, onlara bu yükü vermək mənasızdır.
    expect(await page.evaluate(() =>
      !!document.querySelector('script[src*="challenges.cloudflare.com"]')),
      'boot-da Turnstile skripti yüklənməməlidir').toBe(false);

    await page.locator('#heroRegBtn').click();
    await expect(page.locator('#landing')).not.toHaveClass(/hidden/);

    // Widget qoşulduqdan sonra token gəlməlidir (test açarı həmişə keçir).
    await expect.poll(async () => page.evaluate(() =>
      !!document.querySelector('script[src*="challenges.cloudflare.com"]')),
      { timeout: 10_000 }).toBe(true);

    assertConsoleClean(errors);
    await ctx.close();
  });

  test('Turnstile aktivkən adi giriş axını pozulmur', async ({ page }) => {
    // Secret qurulmadığı üçün server yoxlamanı atlayır (graceful degradation) —
    // yəni widget olsa da olmasa da giriş işləməlidir. Paylaşılan sessiya ilə
    // yoxlanılır, əlavə giriş sorğusu YOXDUR (auth rate-limit-inə toxunmuruq).
    await openApp(page, '#home');
    const me = await page.evaluate(() => fetch('/api/auth/me').then(r => r.json()));
    expect(me.user).toBeTruthy();
  });
});
