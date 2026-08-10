import { test, expect } from '@playwright/test';
import { collectConsoleErrors, assertConsoleClean, gotoHome, dismissCookies } from './helpers';

// TASK-6 / BÖLMƏ 1 — Ana səhifə (13 bənd) smoke doğrulaması.

// 🔴 QONAQ SPEC-İ — sessiya AÇIQ şəkildə TƏMİZLƏNİR.
//
// `playwright.config.ts` layihə səviyyəsində `storageState` təyin edir, yəni
// SESSİYALI kontekst BÜTÜN spec-lərə, o cümlədən buna da tətbiq olunur.
// Sessiya ilə `/` açılanda tətbiq publik səhifəni deyil, giriş etmiş görünüşü
// qurur → `#pub-welcome` heç vaxt `active` olmur və BÜTÜN 21 test 7 saniyəlik
// timeout-a düşür. (`e2e/auth-fixture.ts` başlığındakı xəbərdarlıq məhz bunu
// proqnozlaşdırırdı.)
//
// ⚠ Konfiqdəki "spec-lərdə `test.use({ storageState })` OLMAMALIDIR" qaydası
//   AUTENTİFİKASİYALI spec-lərə aiddir — orada paylaşılan fayla qayıtmaq
//   layihə ayrımını pozardı. Sessiyanı BOŞALTMAQ o problemi yaratmır.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Ana səhifə', () => {

  test('yüklənir, sıfır konsol xətası', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await gotoHome(page);
    await expect(page.locator('.hero .hero-h1')).toBeVisible();
    await expect(page.locator('.hero .hero-h1')).not.toBeEmpty();
    assertConsoleClean(errors);
  });

  // Ana#1 — hero elementləri stagger ilə gəlir, sonda hamısı görünür (opacity 1).
  test('Ana#1 hero fade-in tamamlanır', async ({ page }) => {
    await gotoHome(page);
    for (const sel of ['.hero .hero-h1', '.hero-tagline', '.hero-sub', '.hero-cta']) {
      await expect(page.locator(sel)).toBeVisible();
      await expect
        .poll(() => page.locator(sel).evaluate(n => Number(getComputedStyle(n).opacity)))
        .toBe(1);
    }
  });

  // Ana#2 — sayğac görünəndə real dəyərə qalxır.
  // Qeyd: istifadəçi/paylaşım sayı bazadan gəlir və lokal D1 boş ola bilər (0),
  // ona görə mexanizm 3-cü sayğacla (dil/skill sayı — taksonomiyadan, həmişə > 0)
  // yoxlanılır; ilk iki sayğac isə API-nin qaytardığı dəyərlə tutuşdurulur.
  test('Ana#2 count-up işə düşür', async ({ page }) => {
    await gotoHome(page);
    const stats = await page.evaluate(async () =>
      (await fetch('/api/public/stats').then(r => r.json())) as { users: number; posts: number });

    const nums = page.locator('.sb-num');
    await expect(nums).toHaveCount(3);
    await nums.first().scrollIntoViewIfNeeded();

    // dil/skill sayğacı sıfırdan böyük dəyərə çatır → animasiya həqiqətən işlədi
    await expect.poll(
      () => nums.nth(2).textContent(),
      { message: 'count-up 0-da ilişib' },
    ).toMatch(/[1-9]/);

    // istifadəçi/paylaşım sayğacları API dəyərinə oturur (locale formatı ilə)
    const fmt = (n: number) => new Intl.NumberFormat('az').format(n);
    await expect.poll(() => nums.nth(0).textContent()).toBe(fmt(stats.users));
    await expect.poll(() => nums.nth(1).textContent()).toBe(fmt(stats.posts));
  });

  // Ana#4 — heatmap public profildə deyil, app-dadır; burada yalnız
  // homepage-də stagger sinfi tətbiq olunan komponent yoxlanılmır.
  // (Heatmap testi İstifadəçilər bölməsində — profil səhifəsində.)

  // Ana#5 — karusel: nöqtələr, oxlar, slayd dəyişməsi.
  test('Ana#5 testimonials karuseli sürüşür', async ({ page }) => {
    await gotoHome(page);
    await dismissCookies(page);
    const carousel = page.locator('.testi-carousel');
    await carousel.scrollIntoViewIfNeeded();
    await expect(carousel).toBeVisible();

    const dots = page.locator('.testi-dot');
    const n = await dots.count();
    expect(n).toBeGreaterThan(0);

    if (n > 1) {
      const track = page.locator('.testi-track');
      const before = await track.evaluate(el => getComputedStyle(el).transform);
      await page.locator('.testi-dot').nth(1).click();
      await expect(dots.nth(1)).toHaveClass(/on/);
      await expect
        .poll(() => track.evaluate(el => getComputedStyle(el).transform))
        .not.toBe(before);
    }
  });

  // Ana#6 — scroll-dan sonra header .scrolled alır (blur + kölgə).
  test('Ana#6 sticky nav scroll-da dəyişir', async ({ page }) => {
    await gotoHome(page);
    const hdr = page.locator('#pubHeader');
    await expect(hdr).not.toHaveClass(/scrolled/);
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(hdr).toHaveClass(/scrolled/);
    await expect
      .poll(() => hdr.evaluate(n => getComputedStyle(n).backdropFilter))
      .toContain('blur');
  });

  // Ana#7 — loqolu nişanlar: SVG olanlar + fallback initial olanlar.
  test('Ana#7 tech badge loqoları render olunur', async ({ page }) => {
    await gotoHome(page);
    const badges = page.locator('#sbTrends .tech-badge');
    await expect(badges.first()).toBeVisible();
    expect(await badges.count()).toBeGreaterThan(4);
    // Ən azı bir rəsmi SVG loqo (Python/JS/TS ...)
    expect(await page.locator('#sbTrends .tech-badge svg').count()).toBeGreaterThan(0);
    // Hər nişanın mətn etiketi var
    await expect(badges.first().locator('.tl-label')).not.toBeEmpty();
  });

  // Ana#8 — 4 addımın hər birində ikon.
  test('Ana#8 addım ikonları var', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('.how-step')).toHaveCount(4);
    await expect(page.locator('.how-step .hs-ic svg')).toHaveCount(4);
  });

  // Ana#9 — kod bloklarında "Kopyala" işləyir (clipboard + toast).
  test('Ana#9 kod kopyalama işləyir', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard icazəsi yalnız chromium-da');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoHome(page);
    await dismissCookies(page);

    const block = page.locator('#codeShowcase .feed-code').first();
    await block.scrollIntoViewIfNeeded();
    await expect(block).toBeVisible();
    await block.locator('.code-copy').click();

    // düymə "kopyalandı" vəziyyətinə keçir
    await expect(block.locator('.code-copy')).toHaveClass(/copied/);
    // buferdə həqiqətən kod var
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip.length).toBeGreaterThan(10);
    expect(clip).toContain('def fib');
  });

  // Ana#10 — nişana klik qonağı qeydiyyata aparır və seçimi saxlayır.
  test('Ana#10 klik-tag qonağı auth-a aparır və skill-i saxlayır', async ({ page }) => {
    await gotoHome(page);
    await dismissCookies(page);
    const badge = page.locator('#sbTrends .tech-badge.tb-click').first();
    const label = (await badge.locator('.tl-label').textContent())!.trim();
    await badge.click();
    await expect(page.locator('#landing')).not.toHaveClass(/hidden/);
    const pending = await page.evaluate(() => sessionStorage.getItem('collabix_pending_skill'));
    expect(pending).toBe(label);
  });

  // Ana#11 — wizard: faiz + addım etiketləri.
  test('Ana#11 wizard tərəqqi paneli', async ({ page }) => {
    await gotoHome(page);
    await dismissCookies(page);
    await page.locator('#heroRegBtn').click();
    await expect(page.locator('#regForm')).toBeVisible();
    await expect(page.locator('.wiz-step-chip')).toHaveCount(4);
    await expect(page.locator('.wiz-step-chip.cur')).toHaveCount(1);
    await expect(page.locator('#wizStepLbl')).toContainText('%');
    await expect(page.locator('#wizProgress')).toHaveAttribute('aria-valuenow', '25');
  });

  // Ana#12 — footer sosial ikonları `SITE.social`-dan KONFİQURATİVDİR.
  //
  // ⚠ TEST YENİDƏN YAZILDI (AUDIT-TASK-2 / 2.3). Əvvəl burada
  // `toHaveCount(3)` və sabit `['Discord', 'GitHub', 'LinkedIn']` siyahısı
  // var idi — yəni test PLACEHOLDER dəyərləri kilidləyirdi. Həmin üç URL
  // `https://discord.gg/[collabix]` formasında SINTAKTİK OLARAQ ETİBARSIZ idi
  // və auditdə etibar riski kimi qeyd olundu → massiv boşaldıldı.
  //
  // Ana#12-nin ƏSL tələbi "3 ikon olsun" deyil, "ikonlar `SITE.social`-dan
  // konfiqurativ olsun" idi. Test artıq həmin İNVARİANTI yoxlayır:
  // nə varsa təhlükəsiz render olunmalıdır, boş konfiqurasiya da etibarlıdır.
  // Real profil əlavə ediləndə bu test onu avtomatik yoxlamağa başlayır.
  // Sınıq link aşkarlaması ayrıca `e2e/legal.spec.ts`-dədir.
  test('Ana#12 sosial ikonlar konfiqurativdir və təhlükəsiz render olunur', async ({ page }) => {
    await gotoHome(page);
    const soc = page.locator('#pfSocial');
    const links = soc.locator('a');
    const n = await links.count();

    if (n === 0) {
      // Boş konfiqurasiya: konteyner gizlədilməlidir (footer-də boş yer qalmasın).
      await expect(soc).toBeHidden();
      return;
    }

    await expect(soc).toBeVisible();
    for (let i = 0; i < n; i++) {
      const a = links.nth(i);
      // Yeni tabda açılan xarici link `noopener` OLMADAN window.opener sızdırır.
      await expect(a).toHaveAttribute('rel', /noopener/);
      await expect(a).toHaveAttribute('target', '_blank');
      // Ekran oxuyucu üçün ad (ikon-yalnız link mətnsizdir).
      await expect(a).toHaveAttribute('aria-label', /.+/);
      // URL placeholder mötərizəsi daşımamalıdır.
      expect(await a.getAttribute('href') || '').not.toMatch(/[[\]]/);
    }
    // Hər link ya rəsmi SVG loqo, ya da mətn-nişan göstərməlidir (boş qalmasın).
    await expect.poll(() => soc.locator('svg, .pf-soc-mark').count()).toBeGreaterThanOrEqual(n);
  });

  // Ana#13 — cookie banner: görünür, qərar saxlanılır, təkrar görünmür.
  test('Ana#13 cookie banner razılığı saxlayır', async ({ page }) => {
    await gotoHome(page);
    const banner = page.locator('#cookieBanner');
    await expect(banner).toBeVisible();

    await banner.getByRole('button').last().click();   // "Hamısını qəbul et"
    await expect(banner).toHaveCount(0);

    const consent = await page.evaluate(() => localStorage.getItem('collabix_cookie_consent'));
    expect(JSON.parse(consent!)).toMatchObject({ v: 1, analytics: true });

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#cookieBanner')).toHaveCount(0);
  });

  test('Ana#13 "yalnız zəruri" analitikanı söndürür', async ({ page }) => {
    await gotoHome(page);
    await page.locator('#cookieBanner').getByRole('button').first().click();
    const consent = await page.evaluate(() => localStorage.getItem('collabix_cookie_consent'));
    expect(JSON.parse(consent!)).toMatchObject({ analytics: false });
  });
});

// Ümumi DoD: üçdilli + reduced-motion + tema.
test.describe('Ümumi tələblər', () => {

  for (const lang of ['az', 'en', 'ru']) {
    test(`${lang.toUpperCase()} dilində konsol təmizdir və mətnlər dolur`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await page.addInitScript(l => localStorage.setItem('collabix_lang', l), lang);
      await gotoHome(page);
      await expect(page.locator('.hero .hero-h1')).not.toBeEmpty();
      await expect(page.locator('#sbTrendsHint')).not.toBeEmpty();

      // Tərcümə boşluğu: hər [data-i18n] elementi dolu olmalı və mətni
      // ÖZ açarının eynisi olmamalıdır (açar sızıntısı = çatışmayan tərcümə).
      // Ümumi regex işləmir — "collabix.qoşul()" kimi qanuni mətnlər var.
      const leaks = await page.$$eval('#pub-welcome [data-i18n], .pub-footer [data-i18n]',
        nodes => nodes
          .map(n => ({ key: n.getAttribute('data-i18n')!, text: (n.textContent || '').trim() }))
          .filter(x => x.text === '' || x.text === x.key));
      expect(leaks, `tərcümə çatışmır: ${JSON.stringify(leaks)}`).toEqual([]);
      assertConsoleClean(errors);
    });
  }

  // Reqressiya: səhifə ÜFÜQİ sürüşməməlidir.
  // Tarixçə: public header telefonda (412px) ~446px yer tuturdu; bu, layout
  // viewport-unu genişləndirir və toxunma koordinatlarını sürüşdürürdü —
  // cookie bannerindəki düymələr real cihazda basıla bilmirdi.
  test('üfüqi daşma yoxdur', async ({ page }) => {
    await gotoHome(page);
    const m = await page.evaluate(() => ({
      docW: document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth,
    }));
    expect(m.scrollW, `səhifə üfüqi daşır (${m.scrollW}px > ${m.docW}px)`).toBeLessThanOrEqual(m.docW);
  });

  test('reduced-motion: məzmun dərhal görünür, xəta yoxdur', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoHome(page);

    // hero dərhal tam görünür
    await expect(page.locator('.hero .hero-h1')).toHaveCSS('opacity', '1');
    // count-up dərhal son dəyəri göstərir (animasiyasız) — dil/skill sayğacı > 0
    await page.locator('.sb-num').first().scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('.sb-num').nth(2).textContent()).toMatch(/[1-9]/);
    // karusel auto-advance İŞLƏMİR — 2s sonra eyni slaydda qalır
    await dismissCookies(page);
    const dot0 = page.locator('.testi-dot').first();
    if (await dot0.count()) {
      await expect(dot0).toHaveClass(/on/);
      await page.waitForTimeout(2000);
      await expect(dot0).toHaveClass(/on/);
    }
    assertConsoleClean(errors);
  });

  for (const theme of ['dark', 'light', 'matrix']) {
    test(`${theme} teması xətasız render olunur`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await page.addInitScript(t => localStorage.setItem('collabix_theme', t), theme);
      await gotoHome(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.hero .hero-h1')).toBeVisible();
      assertConsoleClean(errors);
    });
  }
});
