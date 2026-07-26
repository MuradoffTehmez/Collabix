// TASK-11 — icazə (RBAC), dəvət axını və XP üçün PROTOKOL səviyyəli testlər.
//
// UI testləri `teams.spec.ts`-dədir; burada məqsəd docs/TASK-11-REPORT.md-də
// aşkarlanan K1–K5 boşluqlarının BAĞLI qaldığını maşınla təsbit etməkdir.
//
// ⚠ `page.request` İŞLƏDİLMİR: sessiya cookie-si `Secure` bayraqlıdır və
// Playwright-in Node tərəfli konteksti onu http://127.0.0.1-ə göndərmir → 401.
// Sorğular səhifədaxili `fetch` ilə gedir (helpers.ts-dəki eyni izah).
import { test, expect, type Page, type Browser } from '@playwright/test';
import { AUTH_FILE, TEST_PASS, E2E_TURNSTILE } from './seed';

test.use({ storageState: AUTH_FILE });

// Bu testlər viewport-dan asılı deyil (HTTP cavabları, D1 sətrləri) — iki
// layihədə işlətmək əlavə əhatə vermir, əvəzində rate-limit-i yandırır.
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
const del = (page: Page, path: string) => apiCall(page, path, { method: 'DELETE' });

async function openApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'networkidle' });
}

/**
 * RBAC testləri üçün KƏNAR istifadəçi.
 *
 * `PRIMARY` (e2e_main) seed-də SAYT ADMİNİ edilir və admin bütün komandalara
 * çıxış əldə edir (moderasiya üçün qəsdən belədir) — ona görə "üzv deyiləm →
 * 403" ssenarisi onunla yoxlana bilməz. Burada ayrıca, admin olmayan və heç
 * bir komandaya üzv olmayan hesab öz izolə kontekstində istifadə olunur.
 */
const OUTSIDER = 'e2e_bahram';

async function outsiderPage(browser: Browser) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/');
  const login = await apiCall(page, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: OUTSIDER, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE }),
  });
  expect(login.status, `${OUTSIDER} girişi`).toBe(200);
  expect(login.body.mfaRequired, `${OUTSIDER} hesabında 2FA qalıb`).toBeFalsy();
  return { ctx, page };
}

/** Test komandası yaradır və id-sini qaytarır. */
async function makeTeam(page: Page, label: string) {
  const res = await post(page, '/api/teams', {
    name: `${label} ${Date.now()}`, description: 'e2e', visibility: 'Private',
  });
  expect(res.status, 'komanda yaradılmalıdır').toBe(200);
  return res.body.id as string;
}

test.describe('TASK-11 RBAC — üzv olmayanın çıxışı bağlıdır', () => {
  // K3–K5: bu endpointlər əvvəl HEÇ BİR üzvlük yoxlaması etmirdi — istənilən
  // login olmuş istifadəçi Private komandanın feed-ini, fayllarını, üzvlərini,
  // aktivliyini və statistikasını oxuya bilirdi.
  test('Private komandanın bütün bölmələri kənar istifadəçiyə 403 verir', async ({ browser }) => {
    const { ctx, page } = await outsiderPage(browser);
    try {
      for (const path of [
        '/api/teams/beta-team',
        '/api/teams/beta-team/feed',
        '/api/teams/beta-team/files',
        '/api/teams/beta-team/members',
        '/api/teams/beta-team/activity',
        '/api/teams/beta-team/stats',
        '/api/teams/beta-team/rooms',
      ]) {
        const res = await apiCall(page, path);
        expect(res.status, path).toBe(403);
      }
    } finally { await ctx.close(); }
  });

  test('komanda otağının mesajları kənar istifadəçiyə bağlıdır', async ({ browser }) => {
    // `team_chat_rooms` qlobal `rooms` cədvəlini paylaşır — otaq id-si bilinsə
    // belə komandaya aid olmayan şəxs oxuya/yaza bilməməlidir.
    const { ctx, page } = await outsiderPage(browser);
    try {
      const read = await apiCall(page, '/api/rooms/tcr_1/messages');
      expect(read.status).toBe(403);

      const write = await post(page, '/api/rooms/tcr_1/messages', { type: 'text', text: 'icazəsiz' });
      expect(write.status).toBe(403);

      // Qlobal otaq (komandaya aid deyil) toxunulmaz qalır.
      const globalRoom = await apiCall(page, '/api/rooms/general/messages');
      expect(globalRoom.ok).toBeTruthy();
    } finally { await ctx.close(); }
  });

  test('kənar istifadəçi post ata və layihə yarada bilmir', async ({ browser }) => {
    const { ctx, page } = await outsiderPage(browser);
    try {
      const postRes = await post(page, '/api/teams/beta-team/feed', { content: 'icazəsiz post' });
      expect(postRes.status).toBe(403);

      const projRes = await post(page, '/api/teams/beta-team/projects', { name: 'icazəsiz layihə' });
      expect(projRes.status).toBe(403);
    } finally { await ctx.close(); }
  });

  test('Public komanda kənar istifadəçiyə oxunur, amma üzv göstərilmir', async ({ browser }) => {
    const { ctx, page } = await outsiderPage(browser);
    try {
      const res = await apiCall(page, '/api/teams/gamma-team');
      expect(res.ok).toBeTruthy();
      expect(res.body.team.isMember).toBeFalsy();
      // Public komandanın belə FEED-i yalnız üzvlərə açıqdır (PDR tələbi).
      const feed = await apiCall(page, '/api/teams/gamma-team/feed');
      expect(feed.status).toBe(403);
    } finally { await ctx.close(); }
  });

  test('kənar istifadəçi Public komandaya qoşulub ayrıla bilir, rolu Owner deyil', async ({ browser }) => {
    const { ctx, page } = await outsiderPage(browser);
    try {
      const join = await post(page, '/api/teams/gamma-team/join');
      expect(join.ok).toBeTruthy();

      const detail = await apiCall(page, '/api/teams/gamma-team');
      expect(detail.body.team.isMember).toBeTruthy();
      // K1 doğrulaması: yeni üzv HEÇ VAXT Owner olmamalıdır.
      expect(detail.body.team.myRole).not.toBe('Owner');
      expect(detail.body.team.permissions).not.toContain('*');

      const leave = await post(page, '/api/teams/gamma-team/leave');
      expect(leave.ok).toBeTruthy();
    } finally { await ctx.close(); }
  });
});

test.describe('TASK-11 rollar və dəvətlər', () => {
  test('yeni komandada 10 standart rol yaradılır (yalnız Owner deyil)', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'Rol Testi');

    const res = await apiCall(page, `/api/teams/${teamId}/roles`);
    expect(res.ok).toBeTruthy();
    const names = res.body.roles.map((r: any) => r.name);

    // K1: əvvəl YALNIZ "Owner" yaradılırdı → dəvət qəbul edən Owner olurdu.
    expect(names).toContain('Owner');
    expect(names).toContain('Developer');
    expect(names).toContain('Viewer');
    expect(res.body.roles.length).toBeGreaterThanOrEqual(10);

    await del(page, `/api/teams/${teamId}`);
  });

  test('dəvətin default rolu Owner DEYİL', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'Dəvət Testi');

    const inv = await post(page, `/api/teams/${teamId}/invites`, { email: `nobody-${Date.now()}@example.com` });
    expect(inv.ok).toBeTruthy();

    const list = await apiCall(page, `/api/teams/${teamId}/invites`);
    expect(list.body.invites.length).toBeGreaterThan(0);
    expect(list.body.invites[0].role_name).not.toBe('Owner');

    await del(page, `/api/teams/${teamId}`);
  });

  test('başqasına ünvanlanmış dəvəti qəbul etmək olmur', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'Dəvət Guard');

    const inv = await post(page, `/api/teams/${teamId}/invites`, { email: `someone-else-${Date.now()}@example.com` });
    const inviteId = inv.body.id;

    // K2: invite id-sini bilən kənar şəxs komandaya girə bilirdi.
    const accept = await post(page, `/api/invites/${inviteId}/accept`);
    expect(accept.status).toBe(400);

    await del(page, `/api/teams/${teamId}`);
  });

  test('rol CRUD işləyir və Owner rolu qorunur', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'Rol CRUD');

    const created = await post(page, `/api/teams/${teamId}/roles`, {
      name: 'Reviewer', permissions: ['manage_tasks'], priority: 30,
    });
    expect(created.ok).toBeTruthy();

    const upd = await patch(page, `/api/teams/${teamId}/roles/${created.body.id}`, {
      permissions: ['manage_tasks', 'manage_feed'],
    });
    expect(upd.ok).toBeTruthy();

    const roles = await apiCall(page, `/api/teams/${teamId}/roles`);
    const owner = roles.body.roles.find((r: any) => r.name === 'Owner');
    const ownerEdit = await patch(page, `/api/teams/${teamId}/roles/${owner.id}`, { name: 'Hack' });
    expect(ownerEdit.status).toBe(400);

    const removed = await del(page, `/api/teams/${teamId}/roles/${created.body.id}`);
    expect(removed.ok).toBeTruthy();

    await del(page, `/api/teams/${teamId}`);
  });

  test('komanda sahibi öz komandasından ayrıla bilmir', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'Leave Guard');

    const leave = await post(page, `/api/teams/${teamId}/leave`);
    expect(leave.status).toBe(400);

    await del(page, `/api/teams/${teamId}`);
  });

  test('kəşfiyyat siyahısı yalnız Public komandaları göstərir', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/teams/discover');
    expect(res.ok).toBeTruthy();
    const slugs = res.body.teams.map((t: any) => t.slug);
    expect(slugs).toContain('gamma-team');
    expect(slugs).not.toContain('beta-team');   // Private
  });
});

test.describe('TASK-11 XP, aktivlik və feed', () => {
  test('tapşırıq tamamlandıqda komanda XP-si artır, təkrar PATCH XP vermir', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'XP Testi');

    const proj = await post(page, `/api/teams/${teamId}/projects`, { name: 'XP Layihə' });
    const task = await post(page, `/api/teams/${teamId}/tasks`, {
      projectId: proj.body.id, title: 'XP tapşırığı',
    });

    const before = await apiCall(page, `/api/teams/${teamId}/stats`);

    await patch(page, `/api/teams/${teamId}/tasks/${task.body.id}`, { status: 'Done' });
    const afterFirst = await apiCall(page, `/api/teams/${teamId}/stats`);
    expect(afterFirst.body.stats.xp).toBeGreaterThan(before.body.stats.xp);
    expect(afterFirst.body.stats.completedTasksCount).toBe(1);

    // Təkrar "Done" — XP DƏYİŞMƏMƏLİDİR (əvvəl hər PATCH XP əlavə edirdi).
    await patch(page, `/api/teams/${teamId}/tasks/${task.body.id}`, { status: 'Done' });
    const afterSecond = await apiCall(page, `/api/teams/${teamId}/stats`);
    expect(afterSecond.body.stats.xp).toBe(afterFirst.body.stats.xp);

    await del(page, `/api/teams/${teamId}`);
  });

  test('layihə tamamlandıqda komandaya +100 XP yazılır', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'Layihə XP');

    const proj = await post(page, `/api/teams/${teamId}/projects`, { name: 'Bitəcək layihə' });
    const before = await apiCall(page, `/api/teams/${teamId}/stats`);

    await patch(page, `/api/teams/${teamId}/projects/${proj.body.id}`, { status: 'completed' });
    const after = await apiCall(page, `/api/teams/${teamId}/stats`);

    expect(after.body.stats.xp - before.body.stats.xp).toBe(100);
    expect(after.body.stats.completedProjectsCount).toBe(1);

    await del(page, `/api/teams/${teamId}`);
  });

  test('komanda hadisələri aktivlik jurnalına düşür', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'Aktivlik Testi');

    await post(page, `/api/teams/${teamId}/projects`, { name: 'Log layihəsi' });
    await post(page, `/api/teams/${teamId}/feed`, { content: 'Log postu' });

    // Jurnal EVENTUAL-dır: event növbəyə (Queues) düşür və `waitUntil` fonunda
    // emal olunur. Ona görə dərhal deyil, qısa müddət ərzində gözlənilir.
    await expect.poll(async () => {
      const res = await apiCall(page, `/api/teams/${teamId}/activity`);
      return (res.body?.activities || []).map((a: any) => a.event_type);
    }, { timeout: 15_000, message: 'aktivlik jurnalı dolmalıdır' })
      .toEqual(expect.arrayContaining(['TeamCreated', 'ProjectCreated', 'TeamPostCreated']));

    await del(page, `/api/teams/${teamId}`);
  });

  test('öz postunu silmək olur, feed üzvlərə açıqdır', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'Feed Testi');

    const created = await post(page, `/api/teams/${teamId}/feed`, { content: 'Silinəcək post' });
    expect(created.ok).toBeTruthy();

    const feed = await apiCall(page, `/api/teams/${teamId}/feed`);
    expect(feed.body.feed.length).toBe(1);
    expect(feed.body.feed[0].canDelete).toBeTruthy();

    const removed = await del(page, `/api/teams/${teamId}/feed/${created.body.id}`);
    expect(removed.ok).toBeTruthy();

    const after = await apiCall(page, `/api/teams/${teamId}/feed`);
    expect(after.body.feed.length).toBe(0);

    await del(page, `/api/teams/${teamId}`);
  });

  test('komanda daxili axtarış layihə və tapşırığı tapır', async ({ page }) => {
    await openApp(page);
    const teamId = await makeTeam(page, 'Axtarış Testi');

    const proj = await post(page, `/api/teams/${teamId}/projects`, { name: 'Kubernetes miqrasiyası' });
    await post(page, `/api/teams/${teamId}/tasks`, {
      projectId: proj.body.id, title: 'Kubernetes manifestlərini yaz',
    });

    const res = await apiCall(page, `/api/teams/${teamId}/search?q=Kubernetes`);
    expect(res.ok).toBeTruthy();
    expect(res.body.projects.length).toBeGreaterThan(0);
    expect(res.body.tasks.length).toBeGreaterThan(0);

    await del(page, `/api/teams/${teamId}`);
  });
});

test.describe('TASK-11 admin paneli', () => {
  test('admin komanda siyahısı sayğaclarla gəlir və detal açılır', async ({ page }) => {
    await openApp(page);

    const list = await apiCall(page, '/api/admin/teams');
    expect(list.ok, 'e2e_main hesabı admin olmalıdır').toBeTruthy();
    const alpha = list.body.teams.find((t: any) => t.slug === 'alpha-team');
    expect(alpha).toBeTruthy();
    expect(alpha.members_count).toBeGreaterThan(0);
    expect(alpha.owner_name || alpha.username).toBeTruthy();

    const detail = await apiCall(page, `/api/admin/teams/${alpha.id}`);
    expect(detail.ok).toBeTruthy();
    expect(detail.body.members.length).toBeGreaterThan(0);
    expect(detail.body.stats).toBeTruthy();
  });
});
