import { type Page, type Browser } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { AUTH_FILE, PRIMARY, TEST_PASS, E2E_TURNSTILE } from './seed';

// TASK-8 / FAZA 1 — PROTOKOL səviyyəsi: token refresh (15), sessiya API-si (3),
// fayl validasiyası (14), təhlükə monitorinqi API-si (1).
//
// ⚠ YALNIZ `desktop` layihəsində işləyir. Bu testlərin heç biri viewport-dan
// asılı deyil (HTTP cavabları, cookie atributları, D1 sətrləri) — iki dəfə
// işlətmək əlavə əhatə vermir, əvəzində `auth` rate-limit-ini (5 dəq / 10 sorğu)
// yandırır və dəsti səbəbsiz qırmızı edir. Viewport-dan asılı UI yoxlamaları
// ayrıca `security.spec.ts`-dədir və HƏR İKİ layihədə işləyir.
// `test.skip(fn)` callback-i yalnız fixture-ləri alır — layihə adı orada yoxdur.
// `testInfo`-ya çıxış üçün sənədləşdirilmiş yol `beforeEach`-dir.
test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Protokol testi — viewport-dan asılı deyil, bir dəfə icra olunur');
});


// Dağıdıcı sessiya testləri üçün ayrıca hesab — PRIMARY paylaşılan
// storageState-i daşıyır və ona toxunmaq bütün dəsti sıradan çıxarır.
const VICTIM = 'e2e_zara';

// Səhifədaxili API sorğusu (metod + gövdə ilə).
// `page.request` İŞLƏDİLMİR: sessiya cookie-ləri `Secure` bayraqlıdır və
// Playwright-in Node tərəfli konteksti onları http://127.0.0.1-ə göndərmir
// (bax helpers.ts-dəki eyni izah). Brauzer isə localhost-u etibarlı sayır.
async function apiCall(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(async ([p, i]) => {
    const r = await fetch(p as string, i as RequestInit);
    let body: any = null;
    try { body = await r.json(); } catch { /* gövdəsiz cavab */ }
    return { status: r.status, ok: r.ok, body };
  }, [path, init] as const);
}

// İzolə edilmiş "cihaz": öz konteksti, öz girişi.
// `storageState` AÇIQ boş verilir — fayl səviyyəsindəki `test.use({ storageState })`
// `browser.newContext()`-ə də sirayət edir; boş vermək təmiz cihazı zəmanətləyir.
async function freshDevice(browser: Browser, username = PRIMARY) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/');
  const login = await apiCall(page, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE }),
  });
  expect(login.status, `${username} girişi`).toBe(200);
  // `mfaRequired` cavabı da 200-dür, amma sessiya VERMİR. Yoxlamasaq sonrakı
  // hər sorğu 401 alar və səbəb aydın olmazdı.
  expect(login.body.mfaRequired,
    `${username} hesabında 2FA qalıb — əvvəlki işə salmanın təmizliyi işləməyib`).toBeFalsy();
  return { ctx, page };
}

async function openApp(page: Page, hash = '#home') {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/' + hash, { waitUntil: 'networkidle' });
}

/* ================= Bənd 15 — token refresh + rotasiya ================= */
//
// ⚠ Bu blokdakı testlər PAYLAŞILAN sessiyaya (AUTH_FILE) TOXUNMUR.
// Səbəb: refresh token hər istifadədə rotasiya olunur, köhnəsi isə
// `prev_refresh_hash`-ə düşür. Paylaşılan token fırlansaydı, AUTH_FILE-dakı
// nüsxə "istifadə olunmuş" sayılıb reuse aşkarlamasını işə salardı və
// ondan sonrakı BÜTÜN testlər sistemdən çıxarılardı.
test.describe('Token refresh (Bənd 15)', () => {

  test('giriş qısa access + uzun refresh cookie cütü qoyur', async ({ browser }) => {
    const { ctx } = await freshDevice(browser);
    const cookies = await ctx.cookies();
    const at = cookies.find(c => c.name === 'cx_at');
    const rt = cookies.find(c => c.name === 'cx_rt');

    expect(at, 'access cookie qoyulmalıdır').toBeTruthy();
    expect(rt, 'refresh cookie qoyulmalıdır').toBeTruthy();

    // Access token qısaömürlüdür (≈15 dəq), refresh isə uzun (≈30 gün).
    const lifetime = (c: any) => c.expires - Date.now() / 1000;
    expect(lifetime(at)).toBeLessThan(30 * 60);
    expect(lifetime(rt)).toBeGreaterThan(20 * 86400);

    // Refresh token adi API sorğularında şəbəkəyə çıxmamalıdır.
    expect(rt!.path).toBe('/api/auth');
    expect(at!.httpOnly && rt!.httpOnly).toBe(true);

    await ctx.close();
  });

  test('refresh hər istifadədə token-i ROTASİYA edir', async ({ browser }) => {
    const { ctx, page } = await freshDevice(browser);
    const before = (await ctx.cookies()).find(c => c.name === 'cx_rt')?.value;

    expect((await apiCall(page, '/api/auth/refresh', { method: 'POST' })).status).toBe(200);

    const after = (await ctx.cookies()).find(c => c.name === 'cx_rt')?.value;
    expect(after, 'refresh token dəyişməlidir (rotasiya)').not.toBe(before);
    expect((await ctx.cookies()).find(c => c.name === 'cx_at')).toBeTruthy();

    // Sessiya sağdır.
    expect((await apiCall(page, '/api/auth/me')).body.user).toBeTruthy();
    await ctx.close();
  });

  test('istifadə olunmuş refresh token TƏKRAR işlədilsə bütün sessiyalar ləğv olunur', async ({ browser }) => {
    const { ctx, page } = await freshDevice(browser, VICTIM);
    const stolen = (await ctx.cookies()).find(c => c.name === 'cx_rt')?.value;
    expect(stolen).toBeTruthy();

    // Qurban normal refresh edir → oğurlanmış token köhnəlir.
    expect((await apiCall(page, '/api/auth/refresh', { method: 'POST' })).status).toBe(200);

    // "Oğru" köhnə token-lə gəlir.
    await ctx.addCookies([{
      name: 'cx_rt', value: stolen!, domain: new URL(page.url()).hostname, path: '/api/auth',
      httpOnly: true, secure: true, sameSite: 'Strict',
    }]);

    const replay = await apiCall(page, '/api/auth/refresh', { method: 'POST' });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('refresh_reuse');

    // Reuse aşkarlaması QURBANIN sessiyalarını da bağlamalıdır — token-in
    // iki tərəfdə olması hesabın kompromiss olduğunu göstərir.
    expect((await apiCall(page, '/api/auth/me')).body.user, 'reuse-dan sonra sessiya ölməlidir').toBeFalsy();
    await ctx.close();
  });
});

/* ================= Bənd 3 — sessiya / cihaz API-si ================= */
test.describe('Sessiya API-si (Bənd 3)', () => {

  test('cari cihazı işarələnmiş sessiya siyahısı qaytarır', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/auth/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBeGreaterThan(0);

    const current = res.body.sessions.filter((s: any) => s.current);
    expect(current, 'dəqiq bir sessiya "cari" olmalıdır').toHaveLength(1);
    // Cihaz konteksti serverdə parse olunur.
    expect(current[0].browser).toBeTruthy();
    expect(current[0].os).toBeTruthy();
  });

  test('başqa sessiya tək kliklə ləğv olunur və ANİ təsir edir', async ({ page, browser }) => {
    await openApp(page);
    // Təmiz başlanğıc: əvvəlki testlərdən qalan sessiyalar siyahını qeyri-müəyyən
    // edərdi və "qurban" olaraq yanlış sətir seçilə bilərdi.
    await apiCall(page, '/api/auth/sessions/others', { method: 'DELETE' });

    const { ctx, page: otherPage } = await freshDevice(browser);

    const list = await apiCall(page, '/api/auth/sessions');
    expect(list.body.sessions).toHaveLength(2);
    const victim = list.body.sessions.find((s: any) => !s.current);

    expect((await apiCall(page, '/api/auth/sessions/' + victim.id, { method: 'DELETE' })).status).toBe(200);

    // D1 JOIN sayəsində ləğv KV negative-cache gecikməsi olmadan dərhal işləyir.
    expect((await apiCall(otherPage, '/api/auth/me')).body.user, 'ləğv edilmiş cihaz dərhal düşməlidir').toBeFalsy();
    expect((await apiCall(page, '/api/auth/me')).body.user, 'ləğv edən cihaz qalmalıdır').toBeTruthy();

    await ctx.close();
  });

  test('"hamısını çıxart" cari cihazı saxlayır', async ({ page, browser }) => {
    await openApp(page);
    const { ctx, page: otherPage } = await freshDevice(browser);

    expect((await apiCall(page, '/api/auth/sessions/others', { method: 'DELETE' })).status).toBe(200);

    expect((await apiCall(otherPage, '/api/auth/me')).body.user, 'digər cihaz düşməlidir').toBeFalsy();
    expect((await apiCall(page, '/api/auth/me')).body.user, 'cari cihaz qalmalıdır').toBeTruthy();

    const after = await apiCall(page, '/api/auth/sessions');
    expect(after.body.sessions).toHaveLength(1);
    expect(after.body.sessions[0].current).toBe(true);

    await ctx.close();
  });

  test('başqasının sessiya id-si ilə ləğv mümkün deyil', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/auth/sessions/uydurma-sessiya-id', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

/* ================= Bənd 14 — server-side fayl validasiyası ================= */
test.describe('Fayl yükləmə validasiyası (Bənd 14)', () => {

  // Baytları səhifə daxilində qurub multipart göndərir — client resizer-i
  // tamamilə keçir, yəni əsl hücum yolunu təkrarlayır.
  async function uploadBytes(page: Page, bytes: number[], type: string, name: string) {
    return page.evaluate(async ([b, t, n]) => {
      const file = new File([new Uint8Array(b as number[])], n as string, { type: t as string });
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload?kind=post', { method: 'POST', body: fd });
      let body: any = null;
      try { body = await r.json(); } catch { /* boş */ }
      return { status: r.status, body };
    }, [bytes, type, name] as const);
  }

  // Düzgün PNG başlığı (imza + IHDR) — istənilən en/hündürlüklə.
  function png(w: number, h: number): number[] {
    const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
    const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    b.push(...u32(w), ...u32(h), 8, 6, 0, 0, 0);
    while (b.length < 120) b.push(0);   // gövdəni doldur
    return b;
  }

  test('düzgün PNG qəbul olunur', async ({ page }) => {
    await openApp(page);
    const res = await uploadBytes(page, png(64, 64), 'image/png', 'ok.png');
    expect(res.status).toBe(200);
    expect(res.body.mimeType).toBe('image/png');
  });

  test('PNG kimi maskalanmış HTML rədd olunur (magic byte)', async ({ page }) => {
    await openApp(page);
    // "<html><script>..." — brauzerdə icra olunsaydı stored-XSS olardı.
    const html = [...'<html><script>alert(1)</script></html>'].map(c => c.charCodeAt(0));
    const res = await uploadBytes(page, html, 'image/png', 'xss.png');
    expect(res.status).toBe(400);
  });

  test('elan edilən MIME məzmunla uyğun gəlmirsə rədd olunur', async ({ page }) => {
    await openApp(page);
    const res = await uploadBytes(page, png(32, 32), 'image/jpeg', 'yalan.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('uyğun gəlmir');
  });

  test('nəhəng piksel ölçüsü (decompression bomb) rədd olunur', async ({ page }) => {
    await openApp(page);
    // Cəmi ~120 bayt, amma 40000×40000 piksel elan edir — fayl ÖLÇÜSÜ limiti
    // bunu TUTMUR, yalnız piksel yoxlaması tutur.
    const res = await uploadBytes(page, png(40000, 40000), 'image/png', 'bomba.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('8000');
  });
});

/* ================= Bənd 1 — təhlükə monitorinqi API-si ================= */
test.describe('Təhlükə monitorinqi API-si (Bənd 1)', () => {

  test('uğursuz giriş security_events-ə düşür, parol jurnala YAZILMIR', async ({ page }) => {
    await openApp(page);

    // Turnstile token-i GÖNDƏRİLİR: uğursuz cəhdlər 15 dəqiqəlik pəncərədə
    // yığılır və 3-dən sonra giriş bot yoxlaması tələb edir. Token olmasaydı
    // dəst təkrar işə salınanda 401 əvəzinə 403 gələrdi (real client də
    // bu vəziyyətdə token göndərir).
    const bad = await apiCall(page, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: PRIMARY, pass: 'tamamile-yanlis-parol', turnstileToken: E2E_TURNSTILE,
      }),
    });
    expect(bad.status).toBe(401);

    const res = await apiCall(page, '/api/admin/security/events?type=login_failed');
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);

    const ev = res.body.events[0];
    expect(ev.type).toBe('login_failed');
    expect(ev.username).toBe(PRIMARY);
    // Parol HEÇ VAXT jurnala düşməməlidir.
    expect(JSON.stringify(ev)).not.toContain('tamamile-yanlis-parol');
  });

  test('xülasə endpoint-i sayğac + 24 xanalı trend qaytarır', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/admin/security/summary');
    expect(res.status).toBe(200);
    expect(res.body.sparkline).toHaveLength(24);
    expect(typeof res.body.total24h).toBe('number');
  });

  test('admin olmayan üçün bağlıdır', async ({ browser }) => {
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const gp = await guest.newPage();
    await gp.goto('/');
    expect((await apiCall(gp, '/api/admin/security/events')).status).toBe(401);
    await guest.close();
  });
});

/* ================= Bənd 5 — OAuth 2.0 ================= */
test.describe('OAuth (Bənd 5)', () => {

  // Bu mühitdə provayder açarları qurulmayıb (docs/TASK-8-SETUP.md).
  // Yoxlanan şey məhz budur: qurulmamış provayder TAM BAĞLI olmalıdır —
  // yarımçıq konfiq istifadəçini işləməyən axına buraxmamalıdır.
  test('qurulmamış provayder /api/config-də görünmür', async ({ page }) => {
    await openApp(page);
    const cfg = await apiCall(page, '/api/config');
    expect(cfg.status).toBe(200);
    expect(Array.isArray(cfg.body.oauthProviders)).toBe(true);
    expect(cfg.body.oauthProviders).toEqual([]);
  });

  test('qurulmamış provayderin start endpoint-i 404 verir', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/auth/oauth/github/start');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('provider_off');
  });

  test('tanınmayan provayder marşrutu ümumiyyətlə yoxdur', async ({ page }) => {
    await openApp(page);
    // Marşrut şablonu yalnız üç adı qəbul edir → dispatcher 404 qaytarır.
    expect((await apiCall(page, '/api/auth/oauth/evil/start')).status).toBe(404);
  });

  test('etibarsız bilet ilə pending sorğusu rədd olunur', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/auth/oauth/pending?ticket=uydurma');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ticket_invalid');
  });

  test('etibarsız OAuth bileti ilə qeydiyyat mümkün deyil', async ({ page }) => {
    await openApp(page);
    // Bilet serverdə saxlanılır — client onu uydurub email/provayder id-si
    // "gətirə" bilməz. Uydurma bilet qeydiyyatı dayandırmalıdır.
    const res = await apiCall(page, '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        turnstileToken: E2E_TURNSTILE,
        username: 'oauth_saxta', oauthTicket: 'uydurma-bilet',
        name: 'Saxta', age: 25, birthDate: '2000-01-01',
      }),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('bilet');
  });

  test('bağlı hesablar siyahısı giriş tələb edir', async ({ browser }) => {
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const gp = await guest.newPage();
    await gp.goto('/');
    expect((await apiCall(gp, '/api/me/oauth')).status).toBe(401);
    await guest.close();
  });

  test('daxil olmuş istifadəçi üçün bağlı hesablar boş qayıdır', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/me/oauth');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toEqual([]);
    expect(res.body.available).toEqual([]);
    // Parolla yaradılmış hesab — UI "şifrəni dəyiş" göstərməlidir.
    expect(res.body.hasPassword).toBe(true);
  });
});

/* ================= Bənd 4 — Magic link ================= */
test.describe('Magic link (Bənd 4)', () => {

  // Bu mühitdə email binding-i qurulmayıb → funksiya söndürülüdür.
  // Yoxlanan şey: söndürülü halda da endpoint TƏHLÜKƏSİZ davranır.
  test('email qurulmayıbsa UI bayrağı sönülüdür', async ({ page }) => {
    await openApp(page);
    const cfg = await apiCall(page, '/api/config');
    expect(cfg.body).toHaveProperty('magicLink');
    expect(cfg.body.magicLink).toBe(false);
  });

  test('cavab HƏMİŞƏ neytraldır (istifadəçi sadalanması qapalı)', async ({ page }) => {
    await openApp(page);
    // Mövcud OLMAYAN ünvan.
    const a = await apiCall(page, '/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'yoxdur-belə-hesab@example.com', turnstileToken: E2E_TURNSTILE }),
    });
    // Formatı POZUQ ünvan.
    const b = await apiCall(page, '/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ümumiyyətlə-email-deyil', turnstileToken: E2E_TURNSTILE }),
    });

    // Status və gövdə eyni olmalıdır — fərq olsaydı hansı email-in qeydiyyatda
    // olduğunu bu endpoint-lə bir-bir yoxlamaq mümkün olardı.
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body).toEqual({ ok: true });
    expect(b.body).toEqual(a.body);
  });

  test('uydurma magic token ilə giriş mümkün deyil', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();

    // ⚠ `page.goto` İŞLƏMİR: yönləndirmədən sonra SPA boot olur və
    // `handleMagicReturn()` `?magic=...` parametrini ünvandan TƏMİZLƏYİR
    // (toast göstərildikdən sonra — düzgün davranış). Yəni son URL-də
    // parametr qalmır. Ona görə yönləndirmənin ÖZÜ yoxlanılır.
    const res = await p.request.get('/api/auth/magic/uydurma-token-12345', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('magic=expired');

    // Ən vacibi: etibarsız token HEÇ BİR sessiya cookie-si qoymamalıdır.
    const setCookie = res.headersArray()
      .filter(h => h.name.toLowerCase() === 'set-cookie')
      .map(h => h.value).join(' ');
    expect(setCookie).not.toContain('cx_at=');
    expect(setCookie).not.toContain('cx_rt=');

    await ctx.close();
  });
});

/* ================= Bənd 2 — 2FA / TOTP ================= */
test.describe('2FA / TOTP (Bənd 2)', () => {

  // Testin özü ƏSL TOTP kodu hesablayır (RFC 6238) — serverin implementasiyası
  // ilə müstəqil şəkildə uzlaşmalıdır. Saxta obyekt işlətsəydik, hər ikisi eyni
  // səhvi paylaşsa test yenə yaşıl qalardı.
  async function totpCode(page: Page, secretB32: string, stepOffset = 0): Promise<string> {
    return page.evaluate(async ([secret, off]) => {
      const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const bytes: number[] = [];
      let bits = 0, value = 0;
      for (const ch of String(secret).toUpperCase().replace(/=+$/, '')) {
        const i = B32.indexOf(ch);
        if (i < 0) continue;
        value = (value << 5) | i; bits += 5;
        if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
      }
      const key = await crypto.subtle.importKey(
        'raw', new Uint8Array(bytes), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
      const counter = Math.floor(Date.now() / 1000 / 30) + Number(off);
      const msg = new Uint8Array(8);
      let hi = Math.floor(counter / 0x100000000), lo = counter >>> 0;
      for (let i = 3; i >= 0; i--) { msg[i] = hi & 255; hi >>>= 8; }
      for (let i = 7; i >= 4; i--) { msg[i] = lo & 255; lo >>>= 8; }
      const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
      const o = sig[sig.length - 1] & 0x0f;
      const bin = ((sig[o] & 0x7f) << 24) | (sig[o + 1] << 16) | (sig[o + 2] << 8) | sig[o + 3];
      return String(bin % 1000000).padStart(6, '0');
    }, [secretB32, stepOffset] as const);
  }

  // 2FA hesabın giriş davranışını dəyişdiyi üçün PAYLAŞILAN hesabda qurulmur.
  // Həm də `users.spec.ts`-dəki sıralama testlərinə düşməyən hesab seçilib:
  // giriş `last_active_at`-ı yeniləyir və "son aktiv" sıralamasını pozardı.
  // `MFA Tester` adı həmin testlərin SEEDED siyahısında yoxdur → süzülür.
  const MFA_USER = 'e2e_mfa';

  // ⚠ Bu test hesabın vəziyyətini DƏYİŞİR (2FA aktivləşdirir). Assertion
  // ortada sınsa 2FA açıq qalar və növbəti işə salmada həmin hesaba giriş
  // ikinci addım tələb edərdi → dəst özünü bloklayardı. `finally` bunun
  // qarşısını alır: nə olursa olsun 2FA söndürülür.
  test('tam axın: qurma → təsdiq → girişdə kod tələbi → ehtiyat kod', async ({ browser }) => {
    const { ctx, page } = await freshDevice(browser, MFA_USER);
    let secret = '';
    try {

    // --- 1. Qurma: sirr verilir, amma 2FA HƏLƏ aktiv deyil ---
    const setup = await apiCall(page, '/api/me/mfa/setup', { method: 'POST' });
    secret = setup.body.secret;
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toBeTruthy();
    expect(setup.body.uri).toContain('otpauth://totp/');
    expect(setup.body.uri).toContain('algorithm=SHA1');

    let status = await apiCall(page, '/api/me/mfa');
    expect(status.body.enabled, 'təsdiqlənməmiş sirr girişi bloklamamalıdır').toBe(false);
    expect(status.body.pending).toBe(true);

    // --- 2. Yanlış kod təsdiqi rədd edir ---
    const bad = await apiCall(page, '/api/me/mfa/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '000000' }),
    });
    expect(bad.status).toBe(400);

    // --- 3. Düzgün kod → aktiv + ehtiyat kodlar ---
    const ok = await apiCall(page, '/api/me/mfa/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: await totpCode(page, setup.body.secret) }),
    });
    expect(ok.status).toBe(200);
    expect(ok.body.backupCodes).toHaveLength(10);
    const backup: string[] = ok.body.backupCodes;

    status = await apiCall(page, '/api/me/mfa');
    expect(status.body.enabled).toBe(true);
    expect(status.body.backupRemaining).toBe(10);

    // --- 4. Giriş artıq TƏK PAROLLA bitmir ---
    const fresh = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const fp = await fresh.newPage();
    await fp.goto('/');
    const login = await apiCall(fp, '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: MFA_USER, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE }),
    });
    expect(login.status).toBe(200);
    expect(login.body.mfaRequired, 'parol tək başına kifayət etməməlidir').toBe(true);
    expect(login.body.challenge).toBeTruthy();
    // Sessiya HƏLƏ verilməməlidir.
    expect((await fresh.cookies()).find(c => c.name === 'cx_at')).toBeFalsy();
    expect(login.body.user, 'ikinci addımdan əvvəl profil sızmamalıdır').toBeFalsy();

    // --- 5. Ehtiyat kod ilə ikinci addım ---
    const step2 = await apiCall(fp, '/api/auth/mfa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge: login.body.challenge, code: backup[0] }),
    });
    expect(step2.status).toBe(200);
    expect(step2.body.user.username).toBe(MFA_USER);
    expect((await fresh.cookies()).find(c => c.name === 'cx_at')).toBeTruthy();

    // --- 6. Eyni ehtiyat kod İKİNCİ DƏFƏ işləməməlidir ---
    const login2 = await apiCall(fp, '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: MFA_USER, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE }),
    });
    const replay = await apiCall(fp, '/api/auth/mfa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge: login2.body.challenge, code: backup[0] }),
    });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('mfa_bad_code');

    const after = await apiCall(page, '/api/me/mfa');
    expect(after.body.backupRemaining, 'bir kod işlədilib').toBe(9);

      await fresh.close();
    } finally {
      // Zəmanətli təmizlik: 2FA söndürülür.
      //
      // ⚠ NÖVBƏTİ pəncərənin kodu (offset +1) işlədilir, cari pəncərəninki YOX.
      // Səbəb: `mfaConfirm` replay qoruması üçün `last_step`-i cari addıma
      // yazır, `consumeMfaCode` isə `step > last_step` tələb edir. Test bir
      // neçə saniyə çəkdiyi üçün söndürmə HƏMİN 30 saniyəlik pəncərəyə düşür
      // və cari kod haqlı olaraq rədd edilir → 2FA açıq qalardı və növbəti
      // işə salmada bu hesaba giriş sınardı.
      if (secret) {
        const off = await apiCall(page, '/api/me/mfa', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: await totpCode(page, secret, 1) }),
        });
        // Təmizlik sınsa SƏSSİZ qalmasın: növbəti işə salmanı zəhərləyir.
        if (off.status !== 200) console.error('2FA təmizliyi UĞURSUZ:', off.status, off.body);
      }
      await ctx.close();
    }
  });

  test('uydurma challenge ilə ikinci addım keçilmir', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    await p.goto('/');
    const res = await apiCall(p, '/api/auth/mfa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge: 'uydurma', code: '123456' }),
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('mfa_challenge_expired');
    expect((await ctx.cookies()).find(c => c.name === 'cx_at')).toBeFalsy();
    await ctx.close();
  });
});

/* ================= FAZA 4 — data, axtarış, miqyaslanma ================= */
test.describe('FTS5 qlobal axtarış (Bənd 11)', () => {

  test('istifadəçi adı və bio üzrə tapır', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/search?q=zara');
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThan(0);
    expect(res.body.users.some((u: any) => u.username === 'e2e_zara')).toBe(true);
  });

  test('diakritiksiz yazılış da tapır (remove_diacritics)', async ({ page }) => {
    await openApp(page);
    // "Hüseyn" → "huseyn". `ü` Unicode-da `u` + birləşən nöqtələrə ayrılır,
    // ona görə `remove_diacritics` onu normallaşdıra bilir.
    //
    // ⚠ `ə` (U+0259) İSTİSNADIR: o, `e`-nin diakritik forması deyil, ayrıca
    // hərfdir və dekompozisiyası yoxdur — yəni "Məmmədli" YAZILIŞI "memmedli"
    // ilə tapılmır. Bu, unicode61-in məhdudiyyətidir, bizim kodun deyil.
    const res = await apiCall(page, '/api/search?q=huseyn');
    expect(res.body.users.some((u: any) => u.username === 'e2e_camal')).toBe(true);
  });

  test('FTS operator simvolları sorğunu SINDIRMIR', async ({ page }) => {
    await openApp(page);
    // Xam FTS5 sintaksisi: bunlar birbaşa MATCH-ə düşsəydi 500 verərdi.
    for (const q of ['C++', '"test', 'a AND OR b', 'NEAR(x y)', '*', '^^^', 'a: b']) {
      const res = await apiCall(page, '/api/search?q=' + encodeURIComponent(q));
      expect(res.status, `sorğu sındı: ${q}`).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    }
  });

  test('boş və çox qısa sorğu boş nəticə qaytarır', async ({ page }) => {
    await openApp(page);
    expect((await apiCall(page, '/api/search?q=')).body.users).toEqual([]);
    expect((await apiCall(page, '/api/search?q=a')).body.users).toEqual([]);
  });

  test('axtarış giriş tələb edir', async ({ browser }) => {
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const gp = await guest.newPage();
    await gp.goto('/');
    expect((await apiCall(gp, '/api/search?q=test')).status).toBe(401);
    await guest.close();
  });
});

test.describe('Precomputed statistika (Bənd 8)', () => {

  test('trigger-lər sayğacları artımlı saxlayır', async ({ page }) => {
    await openApp(page);
    const before = (await apiCall(page, `/api/users/${PRIMARY}/stats`)).body.stats;
    expect(typeof before.posts).toBe('number');

    // Post yaradılır → `user_stats.posts` TRIGGER ilə artmalıdır.
    // Gövdə `blocks` formatındadır (`text` sahəsi serverdə bloklardan çıxarılır).
    const created = await apiCall(page, '/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [{ type: 'text', content: 'FTS və stats testi üçün paylaşım' }],
        tags: ['test'],
      }),
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);

    const after = (await apiCall(page, `/api/users/${PRIMARY}/stats`)).body.stats;
    expect(after.posts, 'post sayğacı artmalıdır').toBe(before.posts + 1);

    // Silinəndə geri enməlidir.
    await apiCall(page, '/api/posts/' + created.body.post.id, { method: 'DELETE' });
    const final = (await apiCall(page, `/api/users/${PRIMARY}/stats`)).body.stats;
    expect(final.posts, 'silinmə sayğacı azaltmalıdır').toBe(before.posts);
  });
});

test.describe('Fəaliyyət storage (Bənd 9)', () => {

  test('heatmap normalized cədvəldən gəlir', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, `/api/users/${PRIMARY}/activity`);
    expect(res.status).toBe(200);
    expect(typeof res.body.activityDays).toBe('object');
    // Açarlar ISO tarix formatında olmalıdır.
    for (const k of Object.keys(res.body.activityDays)) {
      expect(k).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

test.describe('GDPR ixracı (Bənd 10)', () => {

  test('JSON ixracı bütün bölmələri əhatə edir, sirləri SIZMIR', async ({ page }) => {
    await openApp(page);
    // ⚠ `page.request` İŞLƏMİR: sessiya cookie-ləri `Secure` bayraqlıdır və
    // Node tərəfli kontekst onları http://127.0.0.1-ə göndərmir (bax helpers.ts).
    // Stream cavab səhifə daxilində oxunur.
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/me/export?format=json');
      return { status: r.status, cd: r.headers.get('content-disposition') || '', body: await r.text() };
    });
    expect(res.status).toBe(200);
    expect(res.cd).toContain('attachment');

    const body = res.body;
    const data = JSON.parse(body);
    for (const section of ['profile', 'posts', 'comments', 'direct_messages', 'sessions', 'activity']) {
      expect(data, `bölmə əskikdir: ${section}`).toHaveProperty(section);
    }
    // ⚠ Autentifikasiya sirləri ixracda OLMAMALIDIR — fayl email ilə
    // paylaşıla, buludda saxlanıla bilər.
    expect(body).not.toContain('pass_hash');
    expect(body).not.toContain('pass_salt');
    expect(body).not.toContain('totp_secret');
    expect(body).not.toContain('refresh_hash');
  });

  test('CSV ixracı formula-injection-a qarşı qorunur', async ({ page }) => {
    await openApp(page);
    // Bio-ya düstur yazılır — ixracda apostrofla neytrallaşmalıdır.
    await apiCall(page, '/api/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: '=HYPERLINK("http://evil.example","klik")' }),
    });

    const res = await page.evaluate(async () => {
      const r = await fetch('/api/me/export?format=csv');
      return { status: r.status, body: await r.text() };
    });
    expect(res.status).toBe(200);
    const csv = res.body;
    expect(csv).toContain('### profile');
    // Düstur mətndə var, amma `=` ilə BAŞLAYAN xana kimi yox.
    expect(csv).toContain('HYPERLINK');
    expect(csv, 'düstur neytrallaşdırılmalıdır').not.toMatch(/(^|,)"?=HYPERLINK/m);
  });

  test('ixrac giriş tələb edir', async ({ browser }) => {
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const gp = await guest.newPage();
    await gp.goto('/');
    expect((await apiCall(gp, '/api/me/export')).status).toBe(401);
    await guest.close();
  });
});

/* ================= AUDIT H-2 — /api/admin/admins avtorizasiyası ================= */
//
// ⚠ NİYƏ BU TEST VAR: `worker/index.ts`-dəki marşrut cədvəlində bu route BİR
// SƏTİRLİK nəzarətsizlik ucbatından `admin: true` bayrağı OLMADAN qalmışdı —
// qonşu 32 admin route-unda bayraq var idi, məhz bunda yox. Nəticədə giriş
// etmiş İSTƏNİLƏN istifadəçi bütün admin uid-lərini sadalaya bilirdi.
// Belə bir sətir yenidən itə bilər, ona görə qapı testlə bağlanır.
//
// `page.request` İŞLƏDİLMİR (fayl başındaki `apiCall` izahı) — sessiya
// cookie-ləri `Secure` bayraqlıdır və Node konteksti onları göndərmir.
test.describe('AUDIT H-2 — /api/admin/admins avtorizasiyası', () => {

  // Paylaşılan AUTH_FILE sessiyası `e2e_main`-dir və seed onu `admins`
  // cədvəlinə salır (e2e/seed.ts) — yəni bu, admin yolunun testidir.
  // GET olduğu üçün paylaşılan sessiyaya heç bir təsiri yoxdur.
  test('admin 200 alır və siyahı qaytarılır', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/admin/admins');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.admins), 'admins massiv olmalıdır').toBe(true);
  });

  // Admin OLMAYAN hesab. `e2e_zara` QƏSDƏN seçilmir — o, dağıdıcı sessiya
  // testlərində işlədilir və oradaki ləğvlər bu testi qeyri-deterministik edərdi.
  test('adi istifadəçi 403 alır', async ({ browser }) => {
    const { ctx, page } = await freshDevice(browser, 'e2e_dilara');
    const res = await apiCall(page, '/api/admin/admins');
    expect(res.status, 'admin olmayan hesab 403 almalıdır').toBe(403);
    // ⚠ `body.code` BURADA GÖZLƏNİLMİR və bu, düzgün davranışdır:
    // marşrut cədvəlindəki qapı (`worker/index.ts` → `route.admin && !c.isAdmin`)
    // handler-dən ƏVVƏL işə düşür və `err('Yalnız admin.', 403)` qaytarır — kodsuz.
    // Handler-in içindəki `code: 'forbidden'` yalnız cədvəl bayrağı yenidən
    // itsə işə düşən ikinci qat müdafiədir. Yəni kodun olmaması qapının
    // DÜZGÜN sıra ilə bağlandığının sübutudur.
    expect(typeof res.body.error, 'insan üçün mesaj olmalıdır').toBe('string');
    await ctx.close();
  });

  test('anonim istifadəçi 401 alır', async ({ browser }) => {
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const gp = await guest.newPage();
    await gp.goto('/');
    expect((await apiCall(gp, '/api/admin/admins')).status).toBe(401);
    await guest.close();
  });
});
