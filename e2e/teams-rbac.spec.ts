// TASK-11 — icazə (RBAC), dəvət axını və XP üçün PROTOKOL səviyyəli testlər.
//
// UI testləri `teams.spec.ts`-dədir; burada məqsəd docs/TASK-11-REPORT.md-də
// aşkarlanan K1–K5 boşluqlarının BAĞLI qaldığını maşınla təsbit etməkdir.
//
// ⚠ `page.request` İŞLƏDİLMİR: sessiya cookie-si `Secure` bayraqlıdır və
// Playwright-in Node tərəfli konteksti onu http://127.0.0.1-ə göndərmir → 401.
// Sorğular səhifədaxili `fetch` ilə gedir (helpers.ts-dəki eyni izah).
import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test';
import { AUTH_FILE, TEST_PASS, E2E_TURNSTILE } from './seed';
import { E2E_TEAM, E2E_TEAM_PRIVATE, E2E_TEAM_PUBLIC } from './fixtures';

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
/** RBAC ssenarilərində "üçüncü şəxs" — nə sayt admini, nə də hədəf aktyor. */
const THIRD_PARTY = 'e2e_camal';

/** Verilən hesabla İZOLƏ kontekstdə giriş edir (paylaşılan sessiyaya toxunmur). */
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
  expect(login.body.mfaRequired, `${username} hesabında 2FA qalıb`).toBeFalsy();
  return { ctx, page };
}

async function outsiderPage(browser: Browser) {
  return loginAs(browser, OUTSIDER);
}

/** Test komandası yaradır və id-sini qaytarır. */
async function makeTeam(page: Page, label: string, visibility = 'Private') {
  const res = await post(page, '/api/teams', {
    name: `${label} ${Date.now()}`, description: 'e2e', visibility,
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
        `/api/teams/${E2E_TEAM_PRIVATE.slug}`,
        `/api/teams/${E2E_TEAM_PRIVATE.slug}/feed`,
        `/api/teams/${E2E_TEAM_PRIVATE.slug}/files`,
        `/api/teams/${E2E_TEAM_PRIVATE.slug}/members`,
        `/api/teams/${E2E_TEAM_PRIVATE.slug}/activity`,
        `/api/teams/${E2E_TEAM_PRIVATE.slug}/stats`,
        `/api/teams/${E2E_TEAM_PRIVATE.slug}/rooms`,
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
      const read = await apiCall(page, `/api/rooms/${E2E_TEAM.roomId}/messages`);
      expect(read.status).toBe(403);

      const write = await post(page, `/api/rooms/${E2E_TEAM.roomId}/messages`, { type: 'text', text: 'icazəsiz' });
      expect(write.status).toBe(403);

      // Qlobal otaq (komandaya aid deyil) toxunulmaz qalır.
      const globalRoom = await apiCall(page, '/api/rooms/general/messages');
      expect(globalRoom.ok).toBeTruthy();
    } finally { await ctx.close(); }
  });

  test('kənar istifadəçi post ata və layihə yarada bilmir', async ({ browser }) => {
    const { ctx, page } = await outsiderPage(browser);
    try {
      const postRes = await post(page, `/api/teams/${E2E_TEAM_PRIVATE.slug}/feed`, { content: 'icazəsiz post' });
      expect(postRes.status).toBe(403);

      const projRes = await post(page, `/api/teams/${E2E_TEAM_PRIVATE.slug}/projects`, { name: 'icazəsiz layihə' });
      expect(projRes.status).toBe(403);
    } finally { await ctx.close(); }
  });

  test('Public komanda kənar istifadəçiyə oxunur, amma üzv göstərilmir', async ({ browser }) => {
    const { ctx, page } = await outsiderPage(browser);
    try {
      const res = await apiCall(page, `/api/teams/${E2E_TEAM_PUBLIC.slug}`);
      expect(res.ok).toBeTruthy();
      expect(res.body.team.isMember).toBeFalsy();
      // Public komandanın belə FEED-i yalnız üzvlərə açıqdır (PDR tələbi).
      const feed = await apiCall(page, `/api/teams/${E2E_TEAM_PUBLIC.slug}/feed`);
      expect(feed.status).toBe(403);
    } finally { await ctx.close(); }
  });

  test('kənar istifadəçi Public komandaya qoşulub ayrıla bilir, rolu Owner deyil', async ({ browser }) => {
    const { ctx, page } = await outsiderPage(browser);
    try {
      const join = await post(page, `/api/teams/${E2E_TEAM_PUBLIC.slug}/join`);
      expect(join.ok).toBeTruthy();

      const detail = await apiCall(page, `/api/teams/${E2E_TEAM_PUBLIC.slug}`);
      expect(detail.body.team.isMember).toBeTruthy();
      // K1 doğrulaması: yeni üzv HEÇ VAXT Owner olmamalıdır.
      expect(detail.body.team.myRole).not.toBe('Owner');
      expect(detail.body.team.permissions).not.toContain('*');

      const leave = await post(page, `/api/teams/${E2E_TEAM_PUBLIC.slug}/leave`);
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
    expect(slugs).toContain(E2E_TEAM_PUBLIC.slug);
    expect(slugs).not.toContain(E2E_TEAM_PRIVATE.slug);   // Private
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

/* ════════ AUDIT-TASK-3 — H-1 privilege escalation reqressiya qoruması ════════
 *
 * AUDIT-2026-07-26 §H-1-də doğrulanmış 3 sorğuluq zəncir:
 *   1. `manage_roles` ilə `permissions:['*']` rol yarat
 *   2. `manage_members` ilə özünü ora keçir
 *   3. `manage_team` tələb edən `DELETE /api/teams/:id` çağır
 * Hər halqa AYRICA test olunur — birinci bağlansa da qalanları müstəqil
 * müdafiə kimi qalmalıdır (defense in depth).
 *
 * ⚠ AKTYOR SEÇİMİ: PRIMARY (`e2e_main`) seed-də SAYT ADMİNİDİR və
 * `requireTeamPermission` onu bütün komandalarda keçirir — onunla "Admin 403
 * alır" ssenarisi YOXLANA BİLMƏZ. Komanda Admin-i rolunda sayt admini olmayan
 * `e2e_bahram`, üçüncü şəxs kimi `e2e_camal` işlədilir. Reqressiya testində isə
 * `e2e_camal` ÖZ komandasını yaradır — yəni HƏQİQİ, sayt admini olmayan Owner.
 */
test.describe.serial('AUDIT H-1 — komanda RBAC eskalasiyası', () => {
  let ownerCtx: BrowserContext, ownerPage: Page;     // PRIMARY — stendi quran sahib
  let adminCtx: BrowserContext, adminPage: Page;     // e2e_bahram — komanda Admin-i
  let thirdCtx: BrowserContext, thirdPage: Page;     // e2e_camal — üçüncü şəxs
  let ready = false;

  test.beforeAll(async ({ browser }, testInfo) => {
    // `beforeEach`-dəki skip hook-lara şamil olunmur — girişlər yalnız
    // testlərin həqiqətən icra olunduğu layihədə edilir (auth rate-limit).
    if (testInfo.project.name !== 'desktop') return;

    ownerCtx = await browser.newContext({ storageState: AUTH_FILE });
    ownerPage = await ownerCtx.newPage();
    await openApp(ownerPage);

    ({ ctx: adminCtx, page: adminPage } = await loginAs(browser, OUTSIDER));
    ({ ctx: thirdCtx, page: thirdPage } = await loginAs(browser, THIRD_PARTY));
    ready = true;
  });

  test.afterAll(async () => {
    if (!ready) return;
    await Promise.all([ownerCtx.close(), adminCtx.close(), thirdCtx.close()]);
  });

  /**
   * Stend: Public komanda; `e2e_bahram` standart **Admin** rolunda
   * (`manage_roles` + `manage_members` var, `manage_team` YOX — bu, auditdəki
   * hücumçunun tam olaraq başlanğıc mövqeyidir), `e2e_camal` isə adi üzv.
   */
  async function stand() {
    const teamId = await makeTeam(ownerPage, 'H1 Eskalasiya', 'Public');

    for (const p of [adminPage, thirdPage]) {
      const join = await post(p, `/api/teams/${teamId}/join`);
      expect(join.ok, 'iştirakçı Public komandaya qoşulmalıdır').toBeTruthy();
    }

    const members = await apiCall(ownerPage, `/api/teams/${teamId}/members`);
    const uid = (username: string) => {
      const m = members.body.members.find((x: any) => x.username === username);
      expect(m, `${username} üzv siyahısında olmalıdır`).toBeTruthy();
      return String(m.user_id);
    };
    const adminUid = uid(OUTSIDER), thirdUid = uid(THIRD_PARTY);

    const roles = await apiCall(ownerPage, `/api/teams/${teamId}/roles`);
    const byName = (n: string) => {
      const r = roles.body.roles.find((x: any) => x.name === n);
      expect(r, `${n} rolu olmalıdır`).toBeTruthy();
      return r;
    };
    const adminRole = byName('Admin'), ownerRole = byName('Owner');

    const promote = await patch(ownerPage, `/api/teams/${teamId}/members/${adminUid}`,
      { roleId: adminRole.id });
    expect(promote.ok, 'sahib Admin rolunu təyin edə bilməlidir').toBeTruthy();

    return {
      teamId, adminUid, thirdUid, adminRole, ownerRole,
      cleanup: () => del(ownerPage, `/api/teams/${teamId}`),
    };
  }

  /** Rolun bazadakı FAKTİKİ dəyəri (cavabın gövdəsinə deyil, saxlanana baxır). */
  async function roleById(teamId: string, roleId: string) {
    const roles = await apiCall(ownerPage, `/api/teams/${teamId}/roles`);
    return roles.body.roles.find((r: any) => r.id === roleId);
  }

  /* ─── Addım 1: wildcard giriş yolundan süzülür ─── */
  test("Admin permissions:['*'] ilə səlahiyyət ala bilmir", async () => {
    const s = await stand();
    try {
      // `'*'` `TEAM_PERMISSIONS` ağ siyahısında olmadığı üçün süzülür: rol
      // yaranır, lakin BOŞ icazə ilə (3.1/detal 2 — mövcud davranış qorunur).
      const created = await post(adminPage, `/api/teams/${s.teamId}/roles`, {
        name: 'Ops', permissions: ['*'], priority: 50,
      });
      expect(created.ok, 'rol yaradılır, amma icazəsiz').toBeTruthy();

      const ops = await roleById(s.teamId, created.body.id);
      expect(ops.permissions).not.toContain('*');
      expect(ops.permissions).toEqual([]);
    } finally { await s.cleanup(); }
  });

  /* ─── Addım 1b: açıq eskalasiya rədd olunur ─── */
  test('Admin özündə olmayan manage_team icazəsini VERƏ BİLMƏZ', async () => {
    const s = await stand();
    try {
      const res = await post(adminPage, `/api/teams/${s.teamId}/roles`, {
        name: 'Ops2', permissions: ['manage_team'], priority: 50,
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');

      // Özündə OLAN icazə ilə rol yaratmaq isə işləməyə davam edir.
      const ok = await post(adminPage, `/api/teams/${s.teamId}/roles`, {
        name: 'Ops3', permissions: ['manage_tasks'], priority: 50,
      });
      expect(ok.ok, 'Admin öz səlahiyyəti daxilində rol yarada bilməlidir').toBeTruthy();
    } finally { await s.cleanup(); }
  });

  test('Admin özündən yüksək prioritetli rol YARADA BİLMƏZ', async () => {
    const s = await stand();
    try {
      // Auditdəki istismar məhz `priority: 99` işlədirdi (Admin = 90).
      const res = await post(adminPage, `/api/teams/${s.teamId}/roles`, {
        name: 'Ops4', permissions: ['manage_tasks'], priority: 99,
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');
    } finally { await s.cleanup(); }
  });

  /* ─── Addım 2: prioritet qaydası — təyinat ─── */
  test('Admin Owner rolunu ÖZÜNƏ təyin edə bilməz', async () => {
    const s = await stand();
    try {
      const res = await patch(adminPage, `/api/teams/${s.teamId}/members/${s.adminUid}`,
        { roleId: s.ownerRole.id });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');
    } finally { await s.cleanup(); }
  });

  test('Admin Owner rolunu BAŞQASINA da təyin edə bilməz', async () => {
    const s = await stand();
    try {
      // "Yalnız özünə" boşluğu qalmasın: hədəf üçüncü üzvdür.
      const res = await patch(adminPage, `/api/teams/${s.teamId}/members/${s.thirdUid}`,
        { roleId: s.ownerRole.id });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');

      // Öz səviyyəsindən aşağı rolu isə təyin edə bilir (reqressiya yoxdur).
      const ok = await patch(adminPage, `/api/teams/${s.teamId}/members/${s.thirdUid}`,
        { roleId: s.adminRole.id });
      expect(ok.ok, 'Admin öz səviyyəsinə qədər rol təyin edə bilməlidir').toBeTruthy();
    } finally { await s.cleanup(); }
  });

  test('Admin AŞAĞI prioritetli, lakin güclü rolu da özünə təyin edə bilməz', async () => {
    const s = await stand();
    try {
      // Prioritet yoxlaması tək başına kifayət deyil: köhnə/seed məlumatında
      // prioriteti aşağı, amma `manage_team` daşıyan rol ola bilər (demo
      // `role_1` — priority 10 + manage_team). Belə rolu yalnız Owner yarada
      // bilər, lakin Admin onu ÖZÜNƏ təyin edə bilməməlidir — altçoxluq tutur.
      const legacy = await post(ownerPage, `/api/teams/${s.teamId}/roles`, {
        name: 'Legacy', permissions: ['manage_team'], priority: 5,
      });
      expect(legacy.ok, 'Owner belə rol yarada bilər').toBeTruthy();

      const res = await patch(adminPage, `/api/teams/${s.teamId}/members/${s.adminUid}`,
        { roleId: legacy.body.id });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');
    } finally { await s.cleanup(); }
  });

  test('Admin özündən güclü rola DƏVƏT göndərə bilməz', async () => {
    const s = await stand();
    try {
      // Auditdə yoxdur: dəvətə rol bağlamaq da səlahiyyət verməkdir.
      // `invite.service.ts` yalnız `name === 'Owner'` yoxlayırdı.
      const res = await post(adminPage, `/api/teams/${s.teamId}/invites`, {
        email: `h1-invite-${Date.now()}@example.com`, roleId: s.ownerRole.id,
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');

      // Öz səviyyəsindəki rolla dəvət isə işləyir (reqressiya yoxdur).
      const ok = await post(adminPage, `/api/teams/${s.teamId}/invites`, {
        email: `h1-invite-ok-${Date.now()}@example.com`, roleId: s.adminRole.id,
      });
      expect(ok.ok, 'Admin öz səviyyəsində dəvət göndərə bilməlidir').toBeTruthy();
    } finally { await s.cleanup(); }
  });

  /* ─── 3.3.b: yuxarı rola müdaxilə ─── */
  test('Admin Owner rolunu REDAKTƏ edə bilməz', async () => {
    const s = await stand();
    try {
      const res = await patch(adminPage, `/api/teams/${s.teamId}/roles/${s.ownerRole.id}`,
        { permissions: ['manage_tasks'] });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');

      // Owner rolunun icazələri toxunulmaz qalıb.
      const owner = await roleById(s.teamId, s.ownerRole.id);
      expect(owner.permissions).toContain('*');
    } finally { await s.cleanup(); }
  });

  test('Admin Owner rolunun prioritetini ENDİRƏ bilməz', async () => {
    const s = await stand();
    try {
      const res = await patch(adminPage, `/api/teams/${s.teamId}/roles/${s.ownerRole.id}`,
        { priority: 1 });
      expect(res.status).toBe(403);

      const owner = await roleById(s.teamId, s.ownerRole.id);
      expect(Number(owner.priority)).toBe(100);
    } finally { await s.cleanup(); }
  });

  test('Admin öz rolunun prioritetini QALDIRA bilməz', async () => {
    const s = await stand();
    try {
      const res = await patch(adminPage, `/api/teams/${s.teamId}/roles/${s.adminRole.id}`,
        { priority: 999 });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');
    } finally { await s.cleanup(); }
  });

  test('Admin Owner rolunu SİLƏ bilməz', async () => {
    const s = await stand();
    try {
      const res = await del(adminPage, `/api/teams/${s.teamId}/roles/${s.ownerRole.id}`);
      expect(res.status).toBe(403);
      expect(await roleById(s.teamId, s.ownerRole.id), 'Owner rolu qalmalıdır').toBeTruthy();
    } finally { await s.cleanup(); }
  });

  /* ─── 3.3.c: ad dəyişikliyi ilə qorumadan yayınma ─── */
  test('Admin Owner rolunu YENİDƏN ADLANDIRA bilməz', async () => {
    const s = await stand();
    try {
      // Ad əsaslı `'Owner'` qoruması tək başına kövrəkdir: rol yenidən
      // adlandırılsaydı, sonrakı bütün ad yoxlamaları düşərdi.
      const res = await patch(adminPage, `/api/teams/${s.teamId}/roles/${s.ownerRole.id}`,
        { name: 'Ops' });
      expect(res.status).toBe(403);

      const owner = await roleById(s.teamId, s.ownerRole.id);
      expect(owner.name).toBe('Owner');
    } finally { await s.cleanup(); }
  });

  /* ─── Addım 3: son müdafiə ─── */
  test('Admin komandanı SİLƏ BİLMƏZ', async () => {
    const s = await stand();
    try {
      const res = await del(adminPage, `/api/teams/${s.teamId}`);
      expect(res.status).toBe(403);
      const still = await apiCall(ownerPage, `/api/teams/${s.teamId}`);
      expect(still.ok, 'komanda silinməməlidir').toBeTruthy();
    } finally { await s.cleanup(); }
  });

  /* ─── Zəncirin bütövlükdə bağlandığının sübutu ─── */
  test('3 sorğuluq Admin→Owner zənciri komandanı silə bilmir', async () => {
    const s = await stand();
    try {
      // 1) wildcard rol — yaranır, amma icazəsiz
      const role = await post(adminPage, `/api/teams/${s.teamId}/roles`, {
        name: 'Ops', permissions: ['*'], priority: 50,
      });
      expect(role.ok).toBeTruthy();

      // 2) özünü ora keçir — rol zəif olduğu üçün keçid təhlükəsizdir
      const assign = await patch(adminPage, `/api/teams/${s.teamId}/members/${s.adminUid}`,
        { roleId: role.body.id });
      expect(assign.ok).toBeTruthy();

      // 3) manage_team tələb edən silmə — ƏVVƏL 200, İNDİ 403
      const drop = await del(adminPage, `/api/teams/${s.teamId}`);
      expect(drop.status).toBe(403);

      const still = await apiCall(ownerPage, `/api/teams/${s.teamId}`);
      expect(still.ok, 'komanda yerindədir').toBeTruthy();
    } finally { await s.cleanup(); }
  });

  /* ─── 🔴 REQRESSİYA — ən vacib testlər (AUDIT-TASK-3 §6 meyar 1 və 6) ─── */
  test('Owner BÜTÜN səlahiyyətlərini saxlayır', async () => {
    // Sahib qəsdən `e2e_camal`-dır: sayt admini DEYİL, yəni `c.isAdmin`
    // yan qapısı burada işləmir — yoxlanan şey əsl komanda Owner-idir.
    const teamId = await makeTeam(thirdPage, 'H1 Owner Reqressiya', 'Public');
    const join = await post(adminPage, `/api/teams/${teamId}/join`);
    expect(join.ok).toBeTruthy();

    const detail = await apiCall(thirdPage, `/api/teams/${teamId}`);
    expect(detail.body.team.myRole, 'yaradıcı Owner rolundadır').toBe('Owner');
    expect(detail.body.team.permissions, "Owner bazada ['*'] daşıyır").toContain('*');

    const roles = await apiCall(thirdPage, `/api/teams/${teamId}/roles`);
    const managerRole = roles.body.roles.find((r: any) => r.name === 'Manager');

    // rol yaradır ✅
    const created = await post(thirdPage, `/api/teams/${teamId}/roles`, {
      name: 'Owner Reqressiya', permissions: ['manage_team', 'manage_roles'], priority: 80,
    });
    expect(created.ok, 'Owner rol yarada bilməlidir').toBeTruthy();

    // rol redaktə edir ✅
    const edited = await patch(thirdPage, `/api/teams/${teamId}/roles/${created.body.id}`,
      { permissions: ['manage_team'], priority: 85 });
    expect(edited.ok, 'Owner rolu redaktə edə bilməlidir').toBeTruthy();

    // üzv rolunu dəyişir ✅
    const members = await apiCall(thirdPage, `/api/teams/${teamId}/members`);
    const bahram = members.body.members.find((m: any) => m.username === OUTSIDER);
    const assign = await patch(thirdPage, `/api/teams/${teamId}/members/${bahram.user_id}`,
      { roleId: managerRole.id });
    expect(assign.ok, 'Owner üzv rolunu dəyişə bilməlidir').toBeTruthy();

    // rol silir ✅
    const removed = await del(thirdPage, `/api/teams/${teamId}/roles/${created.body.id}`);
    expect(removed.ok, 'Owner rolu silə bilməlidir').toBeTruthy();

    // komanda parametrlərini dəyişir ✅
    const settings = await patch(thirdPage, `/api/teams/${teamId}`, { description: 'yenilənmiş' });
    expect(settings.ok, 'Owner parametrləri dəyişə bilməlidir').toBeTruthy();

    // komandanı silir ✅
    const dropped = await del(thirdPage, `/api/teams/${teamId}`);
    expect(dropped.ok, 'Owner komandanı silə bilməlidir').toBeTruthy();
  });

  test('Owner istənilən icazəni verə bilər — altçoxluq qaydası onu bloklamır', async () => {
    const teamId = await makeTeam(thirdPage, 'H1 Owner Icaze', 'Private');
    try {
      const available = (await apiCall(thirdPage, `/api/teams/${teamId}/roles`)).body.available;
      expect(available.length, 'icazə kataloqu boş ola bilməz').toBeGreaterThan(0);

      // Owner-in dəsti bazada `['*']`-dır; genişləndirilməsəydi bu sorğu 403
      // alardı və hər Owner rol yaratmaqdan məhrum qalardı (funksional çökmə).
      const res = await post(thirdPage, `/api/teams/${teamId}/roles`, {
        name: 'Tam Səlahiyyət', permissions: available, priority: 95,
      });
      expect(res.status, 'Owner tam icazə dəsti ilə rol yarada bilməlidir').toBe(200);

      const roles = await apiCall(thirdPage, `/api/teams/${teamId}/roles`);
      const made = roles.body.roles.find((r: any) => r.id === res.body.id);
      expect([...made.permissions].sort()).toEqual([...available].sort());
    } finally { await del(thirdPage, `/api/teams/${teamId}`); }
  });

  /* ─── Fail-closed (§5.3, meyar 17) ─── */
  test('komanda üzvü olmayan rol yaratmağa cəhd edəndə 403 alır (500 deyil)', async () => {
    const teamId = await makeTeam(ownerPage, 'H1 Fail Closed', 'Private');
    try {
      const res = await post(adminPage, `/api/teams/${teamId}/roles`, {
        name: 'Kənar', permissions: ['manage_tasks'], priority: 10,
      });
      expect(res.status).toBe(403);
    } finally { await del(ownerPage, `/api/teams/${teamId}`); }
  });
});

test.describe('TASK-11 admin paneli', () => {
  test('admin komanda siyahısı sayğaclarla gəlir və detal açılır', async ({ page }) => {
    await openApp(page);

    const list = await apiCall(page, '/api/admin/teams');
    expect(list.ok, 'e2e_main hesabı admin olmalıdır').toBeTruthy();
    const alpha = list.body.teams.find((t: any) => t.slug === E2E_TEAM.slug);
    expect(alpha).toBeTruthy();
    expect(alpha.members_count).toBeGreaterThan(0);
    expect(alpha.owner_name || alpha.username).toBeTruthy();

    const detail = await apiCall(page, `/api/admin/teams/${alpha.id}`);
    expect(detail.ok).toBeTruthy();
    expect(detail.body.members.length).toBeGreaterThan(0);
    expect(detail.body.stats).toBeTruthy();
  });
});
