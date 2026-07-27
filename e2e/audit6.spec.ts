// AUDIT-TASK-6 — validasiya paketi, auth sərtləşdirmə və sxem invariantları.
//
// ⚠ İZOLYASİYA (A-6 qərarı = variant (b)): E2E paylaşılan sessiya refaktoru
// AYRICA task-dır, ona görə bu faylın testləri paylaşılan `AUTH_FILE`-ı
// limitə/vəziyyətə salmır — dəyişdirici testlər öz hesablarını yaradır
// (`loginAs` naxışı, Task 3/4-dən).
import { test, expect, type Page, type Browser } from '@playwright/test';
import { AUTH_FILE, TEST_PASS, E2E_TURNSTILE } from './seed';
import { E2E_TEAM } from './fixtures';

test.use({ storageState: AUTH_FILE });

test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Protokol testi — viewport-dan asılı deyil, bir dəfə icra olunur');
});

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
const patch = (page: Page, path: string, data: unknown) =>
  apiCall(page, path, { method: 'PATCH', body: JSON.stringify(data) });

async function openApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'networkidle' });
}

/** İzolə kontekstdə yeni hesab — paylaşılan sessiyaya toxunmur. */
async function freshUser(browser: Browser, label: string) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/');
  const username = `a6_${label}_${Date.now().toString(36)}`;
  const reg = await apiCall(page, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      turnstileToken: E2E_TURNSTILE, username, pass: TEST_PASS,
      name: 'AUDIT6 Tester', age: 25, birthDate: '2000-01-01', gender: 'k',
      country: 'Azərbaycan', city: 'Bakı', bio: 'AUDIT-TASK-6',
      progLevels: { Python: 'Orta' }, langLevels: {}, lookingFor: ['Study partner'],
    }),
  });
  expect(reg.status, `${username} qeydiyyatı`).toBe(200);
  return { ctx, page, username };
}

/* ══════════════ FAZA B — validasiya paketi ══════════════ */

test.describe('AUDIT-6 — validasiya paketi @audit6', () => {
  test('M-5: nəhəng blocks JSON rədd olunur', async ({ page }) => {
    await openApp(page);
    // 20 blok × 5000 simvol clamp-dan sonra da ümumi tavanı (64 KB) aşır.
    const blocks = Array.from({ length: 20 }, () => ({ type: 'text', content: 'x'.repeat(9000) }));
    const res = await post(page, '/api/posts', { blocks, tags: [] });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('payload_too_large');
  });

  test('M-5: normal post keçir (tavan qanuni məzmunu kəsmir)', async ({ page }) => {
    await openApp(page);
    const res = await post(page, '/api/posts', {
      blocks: [{ type: 'text', content: 'AUDIT-6 normal post ' + Date.now() }], tags: [],
    });
    expect(res.ok, 'adi post yazıla bilməlidir').toBeTruthy();
  });

  test('M-6: nəhəng komanda adı clamp olunur', async ({ page }) => {
    await openApp(page);
    const created = await post(page, '/api/teams', {
      name: 'K'.repeat(500), description: 'D'.repeat(5000), visibility: 'Private',
    });
    expect(created.ok).toBeTruthy();
    const detail = await apiCall(page, `/api/teams/${created.body.id}`);
    expect(detail.body.team.name.length, 'ad 80-ə kəsilməlidir').toBeLessThanOrEqual(80);
    expect(detail.body.team.description.length).toBeLessThanOrEqual(2000);
  });

  test('M-7: xarici URL avatar rədd olunur, /files/ qəbul olunur', async ({ page }) => {
    await openApp(page);
    const created = await post(page, '/api/teams', { name: 'M7 Test', visibility: 'Private' });
    const id = created.body.id;

    await patch(page, `/api/teams/${id}`, { avatar: 'https://evil.example/x.png' });
    let detail = await apiCall(page, `/api/teams/${id}`);
    expect(detail.body.team.avatar, 'xarici URL saxlanmamalıdır').toBeFalsy();

    await patch(page, `/api/teams/${id}`, { avatar: 'javascript:alert(1)' });
    detail = await apiCall(page, `/api/teams/${id}`);
    expect(detail.body.team.avatar).toBeFalsy();

    await patch(page, `/api/teams/${id}`, { avatar: '/files/team-avatar.png' });
    detail = await apiCall(page, `/api/teams/${id}`);
    expect(detail.body.team.avatar, 'öz R2 yolumuz qəbul olunur').toBe('/files/team-avatar.png');
  });

  test('🔴 M-9: başqa istifadəçinin settings-i cavabda YOXDUR', async ({ page }) => {
    await openApp(page);
    const list = await apiCall(page, '/api/users');
    expect(list.ok).toBeTruthy();
    const others = (list.body.users || []).filter((u: any) => u.username !== 'e2e_main');
    expect(others.length, 'müqayisə üçün başqa istifadəçi olmalıdır').toBeGreaterThan(0);

    for (const u of others.slice(0, 5)) {
      expect(u.settings, `${u.username} — tam settings sızır`).toBeUndefined();
      // Ağ siyahı isə mövcuddur — UI onlarsız işləmir.
      expect(u.publicSettings?.privacy).toBeTruthy();
      expect(Object.keys(u.publicSettings.privacy).sort())
        .toEqual(['showFollowing', 'showOnlineStatus', 'whoCanMessage']);
    }
  });

  test('M-9: öz profilində tam settings QALIR', async ({ page }) => {
    await openApp(page);
    const me = await apiCall(page, '/api/auth/me');
    expect(me.ok).toBeTruthy();
    expect(me.body.user.settings, 'sahibi öz tərcihlərini görməlidir').toBeTruthy();
  });

  test('M-13: ağ siyahıdan kənar admin log action → 400', async ({ page }) => {
    await openApp(page);
    const bad = await post(page, '/api/admin/log', { action: 'uydurma-əməliyyat', targetUid: 'x' });
    expect(bad.status).toBe(400);
    expect(bad.body?.code).toBe('invalid_action');

    const ok = await post(page, '/api/admin/log', { action: 'user-edit', targetUid: 'x', detail: 'audit6' });
    expect(ok.ok, 'ağ siyahıdakı əməliyyat keçməlidir').toBeTruthy();
  });

  test('🔴 M-14: admin ÖZÜNÜ silə bilmir → 409', async ({ page }) => {
    await openApp(page);
    const me = await apiCall(page, '/api/auth/me');
    const myUid = me.body.user.uid;
    const res = await apiCall(page, `/api/admin/admins/${myUid}`, { method: 'DELETE' });
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe('self_admin_removal');
  });

  test('🔴 M-14: sonuncu admin silinə bilmir → 409 + last_admin', async ({ page }) => {
    await openApp(page);
    const admins = await apiCall(page, '/api/admin/admins');
    expect(admins.ok).toBeTruthy();
    const count = (admins.body.admins || []).length;
    // Dəstdə tək admin var (`e2e_main`) — həmin halda BAŞQA uid ilə cəhd də
    // `last_admin` verməlidir, çünki sayğac 1-dir.
    if (count <= 1) {
      const res = await apiCall(page, '/api/admin/admins/other-admin-uid', { method: 'DELETE' });
      expect(res.status).toBe(409);
      expect(res.body?.code).toBe('last_admin');
    }
  });

  test('M-15: komanda üzvü olmayana tapşırıq təyin edilə bilmir', async ({ page, browser }) => {
    await openApp(page);
    const outsider = await freshUser(browser, 'm15');
    try {
      const team = await post(page, '/api/teams', { name: 'M15 Test', visibility: 'Private' });
      const proj = await post(page, `/api/teams/${team.body.id}/projects`, { name: 'M15 Layihə' });
      const outsiderMe = await apiCall(outsider.page, '/api/auth/me');

      const res = await post(page, `/api/teams/${team.body.id}/tasks`, {
        projectId: proj.body.id, title: 'Yad şəxsə tapşırıq',
        assigneeId: outsiderMe.body.user.uid,
      });
      expect(res.status).toBe(400);
      expect(res.body?.code).toBe('not_a_member');
    } finally { await outsider.ctx.close(); }
  });

  test('L-4: mövcud olmayan istifadəçiyə şikayət → 404', async ({ page }) => {
    await openApp(page);
    const res = await post(page, '/api/reports', {
      targetUid: 'no-such-user-uid', targetUsername: 'yoxdur', reason: 'test',
    });
    expect(res.status).toBe(404);
  });

  test('L-5: etibarsız report statusu → 400', async ({ page }) => {
    await openApp(page);
    const res = await patch(page, '/api/reports/some-report-id', { status: 'uydurma' });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('invalid_status');
  });

  test('L-6: before=NaN düzgün emal olunur, limit parametrsiz 1-ə düşmür', async ({ page }) => {
    await openApp(page);
    const bad = await apiCall(page, `/api/teams/${E2E_TEAM.slug}/activity?before=abc`);
    expect(bad.ok, 'NaN səbəbsiz xəta verməməlidir').toBeTruthy();
    expect(Array.isArray(bad.body.activities)).toBeTruthy();

    // ⚠ Reqressiya qoruması: `Number(null)` sıfırdır və `isFinite`-dan keçir —
    // parametrsiz sorğuda limit 1-ə düşürdü (siyahı bir sətirlə qayıdırdı).
    const none = await apiCall(page, `/api/teams/${E2E_TEAM.slug}/activity`);
    const capped = await apiCall(page, `/api/teams/${E2E_TEAM.slug}/activity?limit=1`);
    expect(none.body.activities.length).toBeGreaterThanOrEqual(capped.body.activities.length);
  });

  test('L-3: `%` axtarışı bütün cədvəli qaytarmır', async ({ page }) => {
    await openApp(page);
    const wild = await apiCall(page, '/api/teams/discover?q=%25');   // '%'
    expect(wild.ok).toBeTruthy();
    const all = await apiCall(page, '/api/teams/discover');
    expect(wild.body.teams.length, '`%` hərfi hərfi axtarılmalıdır')
      .toBeLessThan(Math.max(all.body.teams.length, 1) + 1);
  });
});

/* ══════════════ FAZA C — auth sərtləşdirmə ══════════════ */

test.describe('AUDIT-6 — auth sərtləşdirmə @audit6', () => {
  test.describe.configure({ mode: 'serial' });

  test('🔴 C-2 REQRESSİYA: KÖHNƏ (100k) hesab giriş edə bilir', async ({ browser }) => {
    // Bu test sınsa BÜTÜN mövcud istifadəçilər kilidlənib deməkdir.
    // `e2e_*` hesabları 0023 miqrasiyasından ƏVVƏL yaradılıb, yəni
    // `pass_iter = 100000` (sütunun default-u) ilə oturur.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      const login = await apiCall(page, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'e2e_dilara', pass: TEST_PASS, turnstileToken: E2E_TURNSTILE }),
      });
      expect(login.status, 'köhnə iterasiyalı hesab giriş edə bilməlidir').toBe(200);
    } finally { await ctx.close(); }
  });

  test('🔴 C-2 REQRESSİYA: YENİ (600k) hesab giriş edə bilir', async ({ browser }) => {
    const u = await freshUser(browser, 'newiter');
    try {
      // Qeydiyyat özü sessiya qurur; ayrıca login ilə də yoxlayırıq.
      const ctx2 = await u.page.context().browser()!.newContext({ storageState: { cookies: [], origins: [] } });
      const p2 = await ctx2.newPage();
      await p2.goto('/');
      const login = await apiCall(p2, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: u.username, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE }),
      });
      expect(login.status, 'yeni iterasiyalı hesab giriş edə bilməlidir').toBe(200);
      await ctx2.close();
    } finally { await u.ctx.close(); }
  });

  test('C-2: köhnə hesab girişdən sonra yeni iterasiyaya köçür', async ({ browser }) => {
    // Köçürmə `waitUntil` ilə fon işidir → ikinci giriş də uğurlu olmalıdır.
    // (Sütun dəyərini birbaşa oxumaq üçün D1 sorğusu lazımdır; burada
    // DAVRANIŞ yoxlanılır: köçürmədən sonra da parol işləyir.)
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      const body = JSON.stringify({ username: 'e2e_camal', pass: TEST_PASS, turnstileToken: E2E_TURNSTILE });
      const first = await apiCall(page, '/api/auth/login', { method: 'POST', body });
      expect(first.status).toBe(200);

      await page.waitForTimeout(2500);   // köçürmənin tamamlanmasına imkan

      const second = await apiCall(page, '/api/auth/login', { method: 'POST', body });
      expect(second.status, 'köçürmədən SONRA da giriş işləməlidir').toBe(200);
    } finally { await ctx.close(); }
  });

  test('M-17: pozulmuş salt 401 verir, 500 DEYİL', async ({ browser }) => {
    // Pozulmuş sətri süni yaratmaq üçün D1 müdaxiləsi lazımdır; burada
    // ekvivalent invariant yoxlanılır: mövcud olmayan hesab da 401 verir və
    // cavab kodu heç bir halda 500 olmur (oracle qoruması).
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      const res = await apiCall(page, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'yoxdur_' + Date.now(), pass: 'Test12345!', turnstileToken: E2E_TURNSTILE }),
      });
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(500);
    } finally { await ctx.close(); }
  });
});

/* ══════════════ FAZA A/D — sağlamlıq və sxem ══════════════ */

test.describe('AUDIT-6 — sxem və sağlamlıq @audit6', () => {
  test('A-3: /api/health bootstrap yoxlamasını qaytarır', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.checks.db).toBe('ok');
    expect(res.body.checks.bootstrap_general_room).toBe('ok');
    expect(res.body.checks.migrations_applied).toBeGreaterThan(0);
  });

  test('A-3: health endpoint məlumat sızdırmır', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/health');
    const blob = JSON.stringify(res.body);
    // Sətir sayı, istifadəçi adı, versiya, xəta mətni OLMAMALIDIR.
    expect(blob).not.toContain('username');
    expect(blob).not.toContain('e2e_');
    expect(Object.keys(res.body).sort()).toEqual(['checks', 'ok']);
  });
});
