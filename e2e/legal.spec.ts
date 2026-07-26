import { test, expect } from '@playwright/test';

/**
 * AUDIT-TASK-2 / 2.7 — hüquqi məzmun üçün PLACEHOLDER REQRESSİYA QORUMASI.
 *
 * NİYƏ BU FAYL VAR:
 * `[ŞİRKƏT ADI / Collabix]`, `[Rəsmi ünvan — şəhər, küçə]`, `[email]`,
 * `[ölkə/şəhər]` və `https://discord.gg/[collabix]` AYLARLA canlı saytda
 * qaldı və yalnız 2026-07-26 auditində aşkarlandı (§9/12 — hüquqi risk).
 * Placeholder-li məxfilik siyasəti data controller-i identifikasiya etmir,
 * yəni hüquqi baxımdan etibarsızdır. Sınıq sosial link isə etibar itkisidir.
 *
 * Auditin özü də problemi az qiymətləndirmişdi: yalnız `SITE` obyektindəki
 * 3 sətri görmüşdü, faktiki olaraq 18 placeholder ÜÇ DİLDƏ mövcud idi.
 * Ona görə burada səhifənin RENDER OLUNMUŞ mətni yoxlanılır — mənbə kodu yox.
 *
 * ⚠ Bu testlər PUBLİK səhifələri yoxlayır → giriş TƏLƏB ETMİR və paylaşılan
 * `AUTH_FILE` sessiyasına TOXUNMUR (qəsdən `storageState` verilmir).
 */

// Viewport-dan asılı deyil (mətn məzmunu + HTTP status) → bir dəfə icra olunur.
// İki layihədə işlətmək əlavə əhatə vermir, sadəcə dəsti yavaşladır.
test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Məzmun testi — viewport-dan asılı deyil, bir dəfə icra olunur');
});

const PLACEHOLDER_PATTERNS: Array<{ re: RegExp; why: string }> = [
  // `[ŞİRKƏT ADI]`, `[Rəsmi ünvan …]`, `[email]`, `[ölkə/şəhər]` …
  // ⚠ Minimum 2 simvol: changelog-dakı markdown checkbox-ları (`- [ ]`)
  // mötərizə içində TƏK boşluq daşıyır və yalançı pozitiv verməməlidir.
  { re: /\[[^\]]{2,60}\]/, why: 'mötərizəli placeholder' },
  { re: /\bTODO\b|\bFIXME\b|\bXXX\b/i, why: 'işarələnmiş yarımçıq iş' },
  { re: /lorem ipsum/i, why: 'doldurma mətni' },
  { re: /example\.com/i, why: 'nümunə domen' },
  // Auditdə tapılan konkret sınıq dəyərlər — adları ilə bloklanır.
  { re: /discord\.gg\/\[/i, why: 'sınıq Discord dəvəti' },
  { re: /collabix\.app/i, why: 'köhnə/sahibi təsdiqlənməmiş domen' },
  { re: /collabix\.site/i, why: 'DNS-də mövcud olmayan domen' },
];

// Faktiki route-lar: Worker `worker/seo.ts` → `staticPages` ilə SSR edir,
// SPA isə gövdəni `#<page>Body` konteynerinə render edir.
const LEGAL_PAGES = [
  { path: '/privacy',  body: '#privacyBody' },
  { path: '/terms',    body: '#termsBody' },
  { path: '/about',    body: '#aboutBody' },
  { path: '/security', body: '#securityBody' },
];

// Cookie banner / onboarding overlay-i söndür — əks halda mətn konteyneri
// örtülü qalır və `innerText` boş gəlir (yalançı yaşıl test).
async function openPublic(page: import('@playwright/test').Page, path: string) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent',
      JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto(path, { waitUntil: 'networkidle' });
}

for (const { path, body } of LEGAL_PAGES) {
  test(`${path} — placeholder qalmayıb`, async ({ page }) => {
    await openPublic(page, path);

    const container = page.locator(body);
    await expect(container, `${body} render olunmalıdır`).toBeVisible();
    const text = await container.innerText();

    // Boş konteyner testi mənasız yaşıl edərdi — məzmunun HƏQİQƏTƏN
    // yükləndiyini təsdiqləyirik.
    expect(text.length, `${path} boş render olundu — test mənasız olardı`)
      .toBeGreaterThan(200);

    for (const { re, why } of PLACEHOLDER_PATTERNS) {
      expect(text, `${path} səhifəsində ${why} aşkarlandı (${re})`).not.toMatch(re);
    }
  });
}

test('Privacy səhifəsi data controller-i identifikasiya edir', async ({ page }) => {
  await openPublic(page, '/privacy');
  const text = await page.locator('#privacyBody').innerText();
  // GDPR Art. 13(1)(a) analoqu: kim + necə əlaqə. Konkret dəyər yoxlanılmır
  // (o, sahibin datasıdır və dəyişə bilər) — STRUKTUR yoxlanılır.
  expect(text, 'hüquqi ad göstərilməlidir').toMatch(/Tahmaz Muradov/);
  expect(text, 'ünvan göstərilməlidir').toMatch(/Naxçıvan/i);
  expect(text, 'işlək əlaqə kanalı göstərilməlidir').toMatch(/[\w.]+@[\w.]+\.\w+/);
});

test('footer-də sınıq sosial link yoxdur', async ({ page }) => {
  await openPublic(page, '/');
  const hrefs = await page.locator('footer a[href^="http"]').evaluateAll(
    els => els.map(e => (e as HTMLAnchorElement).href),
  );

  // Hazırda `SITE.social` boşdur (AUDIT-TASK-2 / 2.3) → siyahı boş ola bilər.
  // Test buna görə uğursuz OLMUR: məqsəd "sınıq link yoxdur", "link var" deyil.
  // Profil əlavə edildiyi an bu dövrə onu avtomatik yoxlamağa başlayır.
  for (const href of hrefs) {
    expect(href, `sintaktik olaraq etibarsız URL: ${href}`).not.toMatch(/[[\]]/);
    const res = await page.request.get(href, { maxRedirects: 3, timeout: 15_000 });
    expect(res.status(), `${href} → ${res.status()}`).toBeLessThan(400);
  }
});

test('JSON-LD valid parse olunur və sameAs sınıq link daşımır', async ({ page }) => {
  await openPublic(page, '/');
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.length, 'ən azı bir JSON-LD bloku olmalıdır').toBeGreaterThan(0);

  for (const raw of blocks) {
    if (!raw.trim() || raw.trim() === '{}') continue;
    // `JSON.parse` özü sintaksis yoxlamasıdır — pozulmuş struktur data
    // Google-da "Unparsable structured data" xətası verir.
    const ld = JSON.parse(raw);
    const nodes = Array.isArray(ld) ? ld : [ld];
    for (const node of nodes) {
      // `sameAs` MÖVCUD OLMAMALIDIR (2.4) — amma gələcəkdə real profil
      // əlavə edilsə, hər URL-in canlı olduğu burada yoxlanılır.
      for (const url of node?.sameAs ?? []) {
        const res = await page.request.get(url, { maxRedirects: 3, timeout: 15_000 });
        expect(res.status(), `sameAs sınıqdır: ${url}`).toBeLessThan(400);
      }
    }
  }
});
