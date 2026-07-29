import { type Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { collectConsoleErrors, assertConsoleClean } from './helpers';
import { AUTH_FILE } from './seed';

// TASK-6 / BÖLMƏ 2 — İstifadəçilər səhifəsi (6 bənd).
// Sessiya global-setup-da bir dəfə qurulub (auth rate-limit-i üçün) —
// bütün testlər hazır cookie ilə başlayır.

async function login(page: Page) {
  // Səhifə açılmadan ƏVVƏL: razılıq banneri və onboarding turu klikləri örtməsin.
  // (Tur yeni hesab üçün normal davranışdır — burada sadəcə kənara qoyulur.)
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#users', { waitUntil: 'networkidle' });
  await expect(page.locator('#page-users')).toHaveClass(/active/);
  await expect(page.locator('#userGrid .user-card').first()).toBeVisible();
}

const names = (page: Page) =>
  page.locator('#userGrid .user-card .uc-id b').allInnerTexts();

// Lokal bazada bu dəstdən kənar istifadəçilər də ola bilər (əl ilə yaradılmış
// hesablar). Sıralama testləri yalnız SEED etdiyimiz hesabların NİSBİ sırasını
// yoxlayır — beləliklə bazadakı əlavə sətrlər nəticəni pozmur.
const SEEDED = ['Zara Quliyeva', 'Aysel Məmmədli', 'Bəhram Əliyev', 'Camal Hüseyn', 'Dilarə Nəbi'];
const onlySeeded = (list: string[]) => list.filter(n => SEEDED.includes(n));

test.describe('İstifadəçilər səhifəsi', () => {

  test('yüklənir, sıfır konsol xətası', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page);
    // öz hesabı siyahıda olmamalıdır
    expect(await names(page)).not.toContain('Main Tester');
    assertConsoleClean(errors);
  });

  // #1 — onlayn nöqtə: presence-dən gəlir və showOnlineStatus-a hörmət edir.
  test('#1 onlayn indikatoru presence ilə uzlaşır', async ({ page }) => {
    await login(page);
    // Seed hesabları heartbeat göndərmir və last_active_at-ları köhnədir
    // (1-30 gün) → onlarda onlayn nöqtəsi OLMAMALIDIR.
    // Qeyd: bazadakı digər (əl ilə yaradılmış) hesablar aktiv ola bilər,
    // ona görə qlobal say deyil, konkret kart yoxlanılır.
    const zara = page.locator('#userGrid .user-card', { hasText: 'Zara Quliyeva' });
    await expect(zara).toBeVisible();
    await expect(zara.locator('.online-dot')).toHaveCount(0);
    // "Mesaj yaz" düyməsi hər kartda var (birbaşa əlaqə tələbi)
    const cards = page.locator('#userGrid .user-card');
    await expect(cards.first().locator('.user-card-actions .primary')).toBeVisible();
  });

  // #2 — bərabər hündürlük + "+N" nişanı və popover.
  test('#2 kartlar bərabər hündürlükdə, "+N" popover açılır', async ({ page }) => {
    await login(page);
    // Kartlar grid SƏTRİ daxilində bərabər hündürlükdə olmalıdır.
    // (Fərqli sətrlər bir-birindən fərqlənə bilər — bu normaldır.)
    const rows = await page.locator('#userGrid .user-card').evaluateAll(els => {
      const byTop = new Map<number, number[]>();
      for (const e of els) {
        const r = e.getBoundingClientRect();
        const top = Math.round(r.top);
        if (!byTop.has(top)) byTop.set(top, []);
        byTop.get(top)!.push(Math.round(r.height));
      }
      return [...byTop.values()];
    });
    expect(rows.flat().length).toBeGreaterThan(1);
    for (const heights of rows) {
      expect(new Set(heights).size, `sətirdə fərqli hündürlüklər: ${heights}`).toBe(1);
    }

    // Zara-nın 5 bacarığı var → 3 görünür + "+2" nişanı
    const more = page.locator('#userGrid .user-card', { hasText: 'Zara Quliyeva' }).locator('.more-tag');
    await expect(more).toBeVisible();
    await expect(more).toHaveText('+2');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    const pop = page.locator('#userGrid .user-card', { hasText: 'Zara Quliyeva' })
      .locator('.more-wrap.open .skill-pop');
    await expect(pop).toBeVisible();
    // popover-də BÜTÜN bacarıqlar var
    expect(await pop.locator('.tag').count()).toBe(5);
  });

  // #3 — grid ⇄ list, seçim localStorage-da qalır.
  test('#3 grid/list keçidi yadda qalır', async ({ page }) => {
    await login(page);
    const grid = page.locator('#userGrid');
    await expect(grid).not.toHaveClass(/list-view/);

    await page.locator('#userViewToggle button[data-view="list"]').click();
    await expect(grid).toHaveClass(/list-view/);
    expect(await page.evaluate(() => localStorage.getItem('collabix_users_view'))).toBe('list');

    // reload → siyahı görünüşü qalır
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#userGrid')).toHaveClass(/list-view/);
    await expect(page.locator('#userViewToggle button[data-view="list"]')).toHaveClass(/active/);
  });

  // #4 — command palette.
  test('#4 Ctrl+K palitrası klaviatura ilə işləyir', async ({ page }) => {
    await login(page);
    const bg = page.locator('#paletteBg');
    await expect(bg).toBeHidden();

    await page.keyboard.press('Control+k');
    await expect(bg).toBeVisible();
    await expect(page.locator('#paletteInput')).toBeFocused();

    // sorğusuz da səhifələr göstərilir
    expect(await page.locator('.pal-item').count()).toBeGreaterThan(3);

    // istifadəçi axtarışı
    await page.locator('#paletteInput').fill('zara');
    await expect(page.locator('.pal-item')).toHaveCount(1);
    await expect(page.locator('.pal-item .pal-sub')).toHaveText('@e2e_zara');

    // ↵ → profil səhifəsinə keçid
    await page.keyboard.press('Enter');
    await expect(bg).toBeHidden();
    await expect(page).toHaveURL(/\/u\/e2e_zara$/);
  });

  test('#4 Esc palitranı bağlayır və fokusu qaytarır', async ({ page }) => {
    await login(page);
    await page.locator('#userSearch').focus();
    await page.keyboard.press('Control+k');
    await expect(page.locator('#paletteBg')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#paletteBg')).toBeHidden();
    await expect(page.locator('#userSearch')).toBeFocused();
  });

  // #5 — sıralama serverdə (D1 ORDER BY).
  test('#5 XP sıralaması azalan qaydadadır', async ({ page }) => {
    await login(page);
    await page.locator('#userSortSelect').selectOption('xp');
    await expect(page.locator('#userGrid .user-card').first()).toBeVisible();
    // xp: Zara 900 > Aysel 700 > Bəhram 500 > Camal 300 > Dilarə 100
    expect(onlySeeded(await names(page))).toEqual(SEEDED);
  });

  test('#5 əlifba sıralaması', async ({ page }) => {
    await login(page);
    await page.locator('#userSortSelect').selectOption('alpha');
    await expect(page.locator('#userGrid .user-card').first()).toBeVisible();
    // username üzrə: e2e_aysel, e2e_bahram, e2e_camal, e2e_dilara, e2e_zara
    expect(onlySeeded(await names(page)))
      .toEqual(['Aysel Məmmədli', 'Bəhram Əliyev', 'Camal Hüseyn', 'Dilarə Nəbi', 'Zara Quliyeva']);
  });

  test('#5 son aktiv sıralaması', async ({ page }) => {
    await login(page);
    await page.locator('#userSortSelect').selectOption('active');
    await expect(page.locator('#userGrid .user-card').first()).toBeVisible();
    // aktivlik: Zara 1 gün → Dilarə 30 gün əvvəl
    expect(onlySeeded(await names(page))).toEqual(SEEDED);
  });

  test('#5 sıralama serverdən gəlir (D1 ORDER BY)', async ({ page }) => {
    await login(page);
    const req = page.waitForRequest(r => r.url().includes('/api/users/directory') && r.url().includes('sort=xp'));
    await page.locator('#userSortSelect').selectOption('xp');
    expect((await req).url()).toContain('sort=xp');
  });

  // #6 — initial avatar rəngləri determinist və fərqlidir.
  test('#6 initial avatar rəngləri fərqli və kontrastlıdır', async ({ page }) => {
    await login(page);
    const colors = await page.locator('#userGrid .avatar-initials').evaluateAll(els =>
      els.map(e => ({ bg: getComputedStyle(e).backgroundColor, fg: getComputedStyle(e).color })));
    expect(colors.length).toBeGreaterThan(2);
    // ən azı 2 fərqli fon rəngi (hash-ə görə paylanma)
    expect(new Set(colors.map(c => c.bg)).size).toBeGreaterThan(1);

    // WCAG kontrast: mətn/fon nisbəti ən azı 4.5:1
    const ratio = (a: string, b: string) => {
      const lum = (s: string) => {
        const [r, g, bl] = s.match(/\d+/g)!.slice(0, 3).map(Number).map(v => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      };
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    for (const c of colors) {
      expect(ratio(c.fg, c.bg), `zəif kontrast: ${c.fg} / ${c.bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Filtr + sıralama birlikdə işləyir, nəticə serverdən gəlir.
  test('skill filtri serverə ötürülür', async ({ page }) => {
    await login(page);
    await page.locator('#userSkillFilter').selectOption('Python');
    await expect(page.locator('#userGrid .user-card').first()).toBeVisible();
    // Seed-dən Python bilənlər: Zara, Camal (Main özü siyahıda yoxdur)
    expect(onlySeeded(await names(page)).sort()).toEqual(['Camal Hüseyn', 'Zara Quliyeva']);
  });

  test('nəticə yoxdursa boş vəziyyət göstərilir', async ({ page }) => {
    await login(page);
    await page.locator('#userSearch').fill('zzzz_yoxdur_zzzz');
    await expect(page.locator('#userGrid .empty-state')).toBeVisible();
  });
});
