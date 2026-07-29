// AUDIT C-1 / AUDIT-TASK-7 — `/files/*` oxu avtorizasiyası (@files).
//
// ⚠ BU DƏSTDƏ İKİ QRUP BƏRABƏR DƏRƏCƏDƏ VACİBDİR:
//   1. TƏHLÜKƏSİZLİK — yad komandanın faylı, başqasının DM əlavəsi, arxiv və
//      sadalanmayan prefiks 404 verməlidir.
//   2. REQRESSİYA — feed şəkilləri, avatarlar, öz DM əlavəm və öz komandamın
//      faylı İŞLƏMƏLİDİR. Birinci olmadan task mənasızdır, ikinci olmadan
//      məhsul çökür (§1).
//
// ⚠ `page.request` İŞLƏDİLMİR: sessiya cookie-si `Secure` bayraqlıdır və
// Playwright-in Node tərəfli konteksti onu http://127.0.0.1-ə göndərmir → 401.
// Sorğular səhifədaxili `fetch` ilə gedir (helpers.ts-dəki eyni izah).
//
// ⚠ İZOLYASİYA: `PRIMARY` (e2e_main) seed-də SAYT ADMİNİDİR və admin bütün
// prefiksləri oxuya bilir (qəsdən belədir) — "üzv deyiləm → 404" ssenariləri
// onunla yoxlana BİLMƏZ. Kənar hesab öz izolə kontekstində işlədilir.
import { type Page, type Browser } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { AUTH_FILE, TEST_PASS, E2E_TURNSTILE } from './seed';
import { E2E_TEAM } from './fixtures';


// Protokol testləri — viewport-dan asılı deyil. İki layihədə işlətmək əlavə
// əhatə vermir, əvəzində asset rate-limit-ini yandırır.
test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Protokol testi — viewport-dan asılı deyil, bir dəfə icra olunur');
});

/* ---------- köməkçilər ---------- */

async function apiCall(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(async ([p, i]) => {
    const opts = i as RequestInit;
    if (opts.body) opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const r = await fetch(p as string, opts);
    let body: any = null;
    try { body = await r.json(); } catch { /* gövdəsiz cavab */ }
    return { status: r.status, ok: r.ok, body };
  }, [path, init] as const);
}

const post = (page: Page, path: string, data?: unknown) =>
  apiCall(page, path, { method: 'POST', body: data ? JSON.stringify(data) : undefined });
const del = (page: Page, path: string) => apiCall(page, path, { method: 'DELETE' });

/** Xam `/files/*` sorğusu — status + keş başlıqları ilə. */
async function fetchFile(page: Page, url: string, init: { method?: string; range?: string } = {}) {
  return page.evaluate(async ([u, i]) => {
    const opts = i as { method?: string; range?: string };
    const headers: Record<string, string> = {};
    if (opts.range) headers.Range = opts.range;
    const r = await fetch(u as string, { method: opts.method || 'GET', headers });
    // Gövdəni oxumuruq (fayl binar ola bilər) — status + başlıqlar kifayətdir.
    try { await r.arrayBuffer(); } catch { /* keç */ }
    return {
      status: r.status,
      cacheControl: r.headers.get('cache-control') || '',
      vary: r.headers.get('vary') || '',
    };
  }, [url, init] as const);
}

/**
 * Kiçik, ƏSL PNG yükləyir. Server magic-byte imzasını yoxlayır (routes.ts
 * `sniffType`), ona görə saxta baytlar rədd olunardı — 1×1 şəffaf PNG işlədilir.
 */
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function uploadPng(page: Page, query: string, name = 'e2e-files.png') {
  return page.evaluate(async ([q, b64, fname]) => {
    const bin = atob(b64 as string);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const fd = new FormData();
    fd.append('file', new File([bytes], fname as string, { type: 'image/png' }));
    const r = await fetch(`/api/upload?${q}`, { method: 'POST', body: fd });
    let body: any = null;
    try { body = await r.json(); } catch { /* keç */ }
    return { status: r.status, body };
  }, [query, PNG_B64, name] as const);
}

async function openApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'networkidle' });
}

/** Kənar (admin OLMAYAN) hesab — izolə kontekstdə giriş. */
const OUTSIDER = 'e2e_bahram';

async function loginAs(browser: Browser, username: string) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/');
  const login = await apiCall(page, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE }),
  });
  expect(login.status, `${username} girişi`).toBe(200);
  return { ctx, page };
}

/* ================= 🔴 REQRESSİYA — ən vacib blok ================= */

test.describe('AUDIT C-1 — reqressiya: qanuni fayllar işləyir @files', () => {
  test('öz avatarım yüklənir və PUBLIK keşlənə bilir', async ({ page }) => {
    await openApp(page);
    const up = await uploadPng(page, 'kind=avatar', 'avatar.png');
    expect(up.status, 'avatar yüklənməlidir').toBe(200);
    expect(up.body.key).toMatch(/^avatars\//);

    const res = await fetchFile(page, up.body.url);
    expect(res.status, 'avatar 200 qaytarmalıdır').toBe(200);
    // Meyar 16 — publik prefikslər keşlənə bilir (performans reqressiyası olmasın).
    expect(res.cacheControl).toContain('public');
    expect(res.vary, 'publik cavabda Vary lazım deyil').toBe('');
  });

  test('post şəkli yüklənir və PUBLIK keşlənə bilir', async ({ page }) => {
    await openApp(page);
    const up = await uploadPng(page, 'kind=post', 'post.png');
    expect(up.status).toBe(200);
    expect(up.body.key).toMatch(/^posts\//);

    const res = await fetchFile(page, up.body.url);
    expect(res.status, 'feed şəkli 200 qaytarmalıdır').toBe(200);
    expect(res.cacheControl).toContain('public');
  });

  test('öz mesaj əlavəm yüklənir, lakin PRIVATE keşlə', async ({ page }) => {
    await openApp(page);
    const up = await uploadPng(page, 'kind=msg', 'dm.png');
    expect(up.status).toBe(200);
    expect(up.body.key).toMatch(/^msgfiles\//);

    const res = await fetchFile(page, up.body.url);
    expect(res.status, 'öz əlavəm 200 qaytarmalıdır').toBe(200);
    // 🔴 Meyar 15 — məxfi cavab edge-də QALMAMALIDIR.
    expect(res.cacheControl).toContain('private');
    expect(res.cacheControl).not.toContain('public');
  });

  // ⚠ Bu test `teams/` prefiksinin KEŞ siyasətini doğrulayır; `PRIMARY` sayt
  // admini olduğu üçün qərar `admin` yolundan gəlir. ƏSL ÜZVLÜK yolu
  // (`isTeamMemberCached` → true) aşağıdakı "çıxarılan üzv" testinin 1-ci
  // addımında yoxlanılır — orada kənar hesab public komandaya qoşulub faylı oxuyur.
  test('üzvü olduğum komandanın faylı yüklənir (private keş)', async ({ page }) => {
    await openApp(page);
    const up = await uploadPng(page, `kind=team&teamId=${E2E_TEAM.id}&category=documents`, 'doc.png');
    expect(up.status, 'komanda faylı yüklənməlidir').toBe(200);
    expect(up.body.key).toMatch(new RegExp(`^teams/${E2E_TEAM.id}/`));

    const res = await fetchFile(page, up.body.url);
    expect(res.status, 'öz komandamın faylı 200 qaytarmalıdır').toBe(200);
    expect(res.cacheControl).toContain('private');
    expect(res.cacheControl).not.toContain('public');
    expect(res.vary, 'məxfi cavab istifadəçiyə görə dəyişir').toContain('Cookie');
  });
});

/* ================= 🔴 TƏHLÜKƏSİZLİK ================= */

test.describe('AUDIT C-1 — icazəsiz oxu bağlıdır @files', () => {
  test('yad komandanın faylı 404 qaytarır (403 DEYİL)', async ({ page, browser }) => {
    await openApp(page);
    const up = await uploadPng(page, `kind=team&teamId=${E2E_TEAM.id}&category=documents`, 'secret.png');
    expect(up.status).toBe(200);

    const outsider = await loginAs(browser, OUTSIDER);
    try {
      const res = await fetchFile(outsider.page, up.body.url);
      // 🔴 Meyar 5 + 9 — 403 açarın MÖVCUDLUĞUNU təsdiqləyərdi.
      expect(res.status, 'kənar şəxs komanda faylını görməməlidir').toBe(404);
      expect(res.cacheControl, 'rədd cavabı da keşlənməməlidir').toContain('no-store');
    } finally { await outsider.ctx.close(); }
  });

  test('başqasının mesaj əlavəsi 404 qaytarır', async ({ page, browser }) => {
    await openApp(page);
    const up = await uploadPng(page, 'kind=msg', 'private-dm.png');
    expect(up.status).toBe(200);

    const outsider = await loginAs(browser, OUTSIDER);
    try {
      // Fayl heç bir söhbətə bağlanmayıb → iştirakçılıq yoxdur → rədd.
      const res = await fetchFile(outsider.page, up.body.url);
      expect(res.status).toBe(404);
    } finally { await outsider.ctx.close(); }
  });

  test('arxiv dump-u adi istifadəçi üçün 404', async ({ browser }) => {
    const outsider = await loginAs(browser, OUTSIDER);
    try {
      const res = await fetchFile(outsider.page, '/files/archive/room/general/2026-01-01-abcdef12.json.gz');
      expect(res.status).toBe(404);
      expect(res.cacheControl).toContain('no-store');
    } finally { await outsider.ctx.close(); }
  });

  test('sadalanmayan prefiks 404 (default DENY)', async ({ browser }) => {
    const outsider = await loginAs(browser, OUTSIDER);
    try {
      for (const key of ['random/xxx.png', 'backup/db.sql', 'legacy/secret.txt']) {
        const res = await fetchFile(outsider.page, `/files/${key}`);
        expect(res.status, key).toBe(404);
      }
    } finally { await outsider.ctx.close(); }
  });

  test('HEAD sorğusu da avtorizasiyadan keçir', async ({ page, browser }) => {
    await openApp(page);
    const up = await uploadPng(page, `kind=team&teamId=${E2E_TEAM.id}&category=documents`, 'head.png');
    expect(up.status).toBe(200);

    const outsider = await loginAs(browser, OUTSIDER);
    try {
      // Əvvəl HEAD `/files/*` yolundan KEÇMİRDİ və SPA fallback-ına düşüb
      // 200 HTML qaytarırdı — yəni yoxlamadan yan keçirdi.
      const res = await fetchFile(outsider.page, up.body.url, { method: 'HEAD' });
      expect(res.status).toBe(404);
    } finally { await outsider.ctx.close(); }
  });

  test('Range sorğusu da avtorizasiyadan keçir', async ({ page, browser }) => {
    await openApp(page);
    const up = await uploadPng(page, `kind=team&teamId=${E2E_TEAM.id}&category=documents`, 'range.png');
    expect(up.status).toBe(200);

    const outsider = await loginAs(browser, OUTSIDER);
    try {
      const res = await fetchFile(outsider.page, up.body.url, { range: 'bytes=0-100' });
      expect(res.status).toBe(404);
    } finally { await outsider.ctx.close(); }
  });

  test('traversal açarı rədd olunur', async ({ browser }) => {
    const outsider = await loginAs(browser, OUTSIDER);
    try {
      // `msgfiles/../teams/x` regex uyğunluğunu poza bilərdi → açıq rədd.
      const res = await fetchFile(outsider.page, '/files/msgfiles/..%2Fteams%2Fx%2Fy.png');
      expect(res.status).toBe(404);
    } finally { await outsider.ctx.close(); }
  });
});

/* ========= 🔴 ÇIXARILAN ÜZV — C-1-in əsas ssenarisi ========= */

test('komandadan çıxarılan üzv fayla çıxışını DƏRHAL itirir @files', async ({ page, browser }) => {
  await openApp(page);
  // Public komanda: kənar hesab dəvətsiz qoşula bilsin.
  const created = await post(page, '/api/teams', {
    name: `E2E Files Kick ${Date.now()}`, description: 'e2e', visibility: 'Public',
  });
  expect(created.status, 'komanda yaradılmalıdır').toBe(200);
  const teamId = created.body.id as string;

  const up = await uploadPng(page, `kind=team&teamId=${teamId}&category=documents`, 'kick.png');
  expect(up.status).toBe(200);

  const outsider = await loginAs(browser, OUTSIDER);
  try {
    const me = await apiCall(outsider.page, '/api/auth/me');
    const outsiderId = me.body?.user?.uid as string;
    expect(outsiderId, 'kənar hesabın uid-i alınmalıdır').toBeTruthy();

    const joined = await post(outsider.page, `/api/teams/${teamId}/join`);
    expect(joined.status, 'public komandaya qoşulma').toBe(200);

    // 1) Üzv faylı oxuyur → 200. Bu sorğu üzvlük keşinə '1' yazır.
    const before = await fetchFile(outsider.page, up.body.url);
    expect(before.status, 'üzv faylı görməlidir').toBe(200);

    // 2) Owner üzvü çıxarır.
    const removed = await del(page, `/api/teams/${teamId}/members/${outsiderId}`);
    expect(removed.status, 'üzv çıxarılmalıdır').toBe(200);

    // 3) ⚠ TTL GÖZLƏNİLMİR — açıq keş invalidasiyası (§7.3) işləməlidir.
    //    Sınarsa, "çıxarılmış üzv 60 saniyə əlavə çıxış saxlayır" deməkdir.
    const after = await fetchFile(outsider.page, up.body.url);
    expect(after.status, 'çıxarılan üzv çıxışını İTİRMƏLİDİR').toBe(404);
  } finally { await outsider.ctx.close(); }
});

/* ========= İstismar zəncirinin 1-ci addımı ========= */

test.describe('AUDIT C-1 — istinadın yaradılması bloklanır @files', () => {
  test('createPost yad komanda faylına istinadı rədd edir (blocks[].urls)', async ({ page }) => {
    await openApp(page);
    const res = await post(page, '/api/posts', {
      blocks: [{ type: 'image', urls: [`/files/teams/${E2E_TEAM.id}/documents/gizli.png`], caption: '' }],
      tags: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_image_ref');
  });

  test('createPost imageKeys sahəsində də rədd edir', async ({ page }) => {
    await openApp(page);
    const res = await post(page, '/api/posts', {
      blocks: [{ type: 'text', content: 'zərərsiz mətn' }],
      imageKeys: [`teams/${E2E_TEAM.id}/documents/gizli.png`],
      tags: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_image_ref');
  });

  test('createPost xarici domen şəklini rədd edir', async ({ page }) => {
    await openApp(page);
    const res = await post(page, '/api/posts', {
      blocks: [{ type: 'image', urls: ['https://evil.example/x.png'] }],
      tags: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_image_ref');
  });

  test('öz şəkli ilə post YARADILIR (reqressiya)', async ({ page }) => {
    await openApp(page);
    const up = await uploadPng(page, 'kind=post', 'ok.png');
    expect(up.status).toBe(200);
    const res = await post(page, '/api/posts', {
      blocks: [{ type: 'image', urls: [up.body.url], caption: 'e2e' }],
      imageKeys: [up.body.key], tags: [],
    });
    expect(res.status, 'öz şəklimlə post yaradıla bilməlidir').toBe(200);
  });

  test('mesajda başqasının fileKey-i qəbul olunmur', async ({ page }) => {
    await openApp(page);
    // `sanitizeMsg` yad açarı atır → `image` tipi fileKey-siz qalır → boş mesaj.
    const res = await post(page, `/api/rooms/${E2E_TEAM.roomId}/messages`, {
      type: 'image', fileUrl: '/files/msgfiles/e2e_someone_else/2026-x.png', fileName: 'x.png',
    });
    expect(res.status, 'yad açarlı əlavə qəbul olunmamalıdır').toBe(400);
  });

  test('mesajda ÖZ fileKey-im qəbul olunur (reqressiya)', async ({ page }) => {
    await openApp(page);
    const up = await uploadPng(page, 'kind=msg', 'mine.png');
    expect(up.status).toBe(200);
    const res = await post(page, `/api/rooms/${E2E_TEAM.roomId}/messages`, {
      type: 'image', fileUrl: up.body.url, fileName: 'mine.png',
    });
    expect(res.status, 'öz əlavəm göndərilə bilməlidir').toBe(200);
  });
});
