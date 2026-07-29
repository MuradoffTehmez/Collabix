// AUDIT C-3 / AUDIT-TASK-8 — arxiv oxu yolu (@archive).
//
// ⚠ İKİ QRUP BƏRABƏR VACİBDİR:
//   1. OXU — 90 gündən köhnə mesaj məhsul daxilində əlçatan olmalıdır.
//   2. SƏRHƏD — Task 7 avtorizasiyası pozulmamalı, R2 açarı client-ə SIZMAMALIDIR.
//
// ⚠ Test datası YAZI YOLUNUN ÖZ funksiyası ilə yaradılır (`/__scheduled` cron →
// `archiveKind`), əl ilə qurulmuş JSON ilə YOX — bax e2e/archive-seed.ts (§8.9).
import { type Page, type Browser } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { AUTH_FILE, TEST_PASS, E2E_TURNSTILE, d1 } from './seed';
import { E2E_TEAM } from './fixtures';
import { seedRoomMessages, seedDmMessages, archiveMetaFor, queryJson } from './archive-seed';


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
    let raw = '';
    try { raw = await r.text(); body = JSON.parse(raw); } catch { /* gövdəsiz */ }
    return { status: r.status, ok: r.ok, body, raw };
  }, [path, init] as const);
}

async function openApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'networkidle' });
}

/** Cron-u işə salıb arxivin yazılmasını gözləyir (iş `waitUntil` içindədir). */
async function runArchiveCron(page: Page, scopeId: string, expectMeta = true) {
  const res = await page.request.get('/__scheduled');
  expect(res.status(), 'cron işə düşməlidir').toBe(200);
  if (!expectMeta) return;
  await expect.poll(() => archiveMetaFor(scopeId).length,
    { timeout: 25_000, message: 'arxiv kataloq sətri yaranmalıdır' }).toBeGreaterThan(0);
}

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

const ROOM = 'e2e-arch-read-room';

test.describe('AUDIT C-3 — arxiv oxu yolu @archive', () => {

  test('🔴 REQRESSİYA: arxivsiz otaq mesajları əvvəlki kimi işləyir', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, `/api/rooms/${E2E_TEAM.roomId}/messages`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages), 'messages massivi qalmalıdır').toBe(true);
    // Yeni sahələr ƏLAVƏDİR, köhnə müqavilə pozulmur.
    expect(res.body).toHaveProperty('hasMore');
  });

  test('isti pəncərədən köhnə mesaj ARXİVDƏN gəlir', async ({ page }) => {
    await openApp(page);
    const { oldIds, newIds } = seedRoomMessages({ roomId: ROOM, oldCount: 6, newCount: 2 });
    await runArchiveCron(page, ROOM);

    // Köhnələr D1-dən çıxmalıdır — yəni yalnız arxivdən gələ bilər.
    const left = queryJson(`SELECT id FROM room_messages WHERE room_id = '${ROOM}';`);
    expect(left.map(r => r.id).sort()).toEqual(newIds.slice().sort());

    // ⚠ Kursor CANLI cavabdan GÖTÜRÜLMÜR: D1-də `limit`-dən az sətir qaldığı
    // üçün ilk səhifə onsuz da arxivlə tamamlanır (dizayn belədir — §8.1
    // "D1 nəticəsi limit-dən azdırsa arxivə keç"), yəni `messages[0]` artıq
    // arxiv mesajı olur. Kursor arxivin ÖZ zaman aralığından götürülür.
    const meta = archiveMetaFor(ROOM)[0];
    expect(meta, 'arxiv kataloqu olmalıdır').toBeTruthy();
    const cursor = Number(meta.to_ts) + 1;   // bütün arxiv mesajları bundan köhnədir

    const arch = await apiCall(page, `/api/rooms/${ROOM}/messages?before=${cursor}`);
    expect(arch.status).toBe(200);
    const ids = arch.body.messages.map((m: any) => m.id);
    expect(ids.length, 'arxivdən mesaj gəlməlidir').toBe(oldIds.length);
    for (const id of ids) expect(oldIds).toContain(id);
    // Canlı mesajlar bu kursordan YENİdir → yalnız arxivdən gəlməlidir.
    for (const id of newIds) expect(ids).not.toContain(id);
    expect(arch.body.source, 'mənbə yalnız arxiv olmalıdır').toBe('archive');
  });

  test('sərhəd sorğusunda DUBLİKAT yoxdur və sıralama düzgündür', async ({ page }) => {
    await openApp(page);
    // ⚠ Sərhəd = `before` CANLI mesajların ARASINDADIR: D1 bir neçə sətir
    // verir, qalanı arxivdən gəlir. `before` olmadan arxivə ümumiyyətlə
    // getmirik (bax routes.ts — poll-un R2-ni döyməməsi üçün).
    const live = await apiCall(page, `/api/rooms/${ROOM}/messages`);
    expect(live.status).toBe(200);
    const newestLive = Math.max(...live.body.messages.map((m: any) => Number(m.createdAt)));

    const res = await apiCall(page, `/api/rooms/${ROOM}/messages?limit=5&before=${newestLive}`);
    expect(res.status).toBe(200);
    const msgs = res.body.messages as any[];

    const ids = msgs.map(m => m.id);
    expect(new Set(ids).size, 'dublikat mesaj OLMAMALIDIR').toBe(ids.length);

    // ASC sıralama — client bu formanı gözləyir.
    const ts = msgs.map(m => Number(m.createdAt));
    expect(ts.slice().sort((a, b) => a - b), 'sıralama artan olmalıdır').toEqual(ts);
    expect(res.body.source, 'sərhəd səhifəsi hər iki mənbədən gəlir').toBe('mixed');
  });

  // 🔴 REQRESSİYA — arxiv oxusu POLL yoluna sızmamalıdır.
  //
  // İlk versiyada şərt sadəcə "D1 səhifəni doldura bilmədi" idi. Az mesajlı
  // otaqda bu HƏMİŞƏ doğrudur, yəni hər 3 saniyəlik poll R2 sorğusu + gzip
  // açması edirdi və `archive` səbətini (120/saat) ~6 dəqiqəyə doldururdu —
  // istifadəçi ADİ söhbətdə 429 alardı. Arxivə yalnız açıq `before` ilə gedilir.
  test('ən son səhifə (before YOXDUR) arxivə TOXUNMUR', async ({ page }) => {
    await openApp(page);
    for (let i = 0; i < 8; i++) {
      const res = await apiCall(page, `/api/rooms/${ROOM}/messages`);
      expect(res.status, `poll #${i}`).toBe(200);
      expect(res.body.source, 'poll arxivə getməməlidir').toBe('live');
    }
    // Arxivin mövcudluğu yenə bildirilir ki, UI düyməni göstərə bilsin.
    const last = await apiCall(page, `/api/rooms/${ROOM}/messages`);
    expect(last.body.hasMore, 'arxiv var → "daha köhnə" mümkündür').toBe(true);
  });

  test('arxiv də bitəndə hasMore=false (sonsuz döngü olmasın)', async ({ page }) => {
    await openApp(page);
    // Ən köhnə mesajdan da geri get → heç nə qalmamalıdır.
    const res = await apiCall(page, `/api/rooms/${ROOM}/messages?before=1`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toEqual([]);
    expect(res.body.hasMore, 'daha köhnəsi yoxdur').toBe(false);
  });

  test('boş arxiv XƏTA deyil — 200 + boş massiv', async ({ page }) => {
    await openApp(page);
    // Heç vaxt arxivlənməmiş otaq.
    const res = await apiCall(page, `/api/rooms/${E2E_TEAM.roomId}/messages?before=1`);
    expect(res.status, 'obyektsiz scope 200 verməlidir').toBe(200);
    expect(res.body.messages).toEqual([]);
    expect(res.body.hasMore).toBe(false);
  });

  test('DM arxivi oxunur', async ({ page }) => {
    await openApp(page);
    const me = await apiCall(page, '/api/auth/me');
    const myId = me.body.user.uid as string;
    const peer = queryJson(`SELECT id FROM users WHERE username = '${OUTSIDER}';`)[0]?.id;
    expect(peer, 'kənar hesab seed-də olmalıdır').toBeTruthy();

    const pairId = [myId, peer].sort().join('_');
    const { oldIds } = seedDmMessages(pairId, { oldCount: 4, newCount: 1, fromId: myId, toId: peer });
    await runArchiveCron(page, pairId);

    // Kursor arxivin öz aralığından — otaq testindəki eyni səbəb.
    const meta = archiveMetaFor(pairId)[0];
    expect(meta, 'DM arxiv kataloqu olmalıdır').toBeTruthy();

    const arch = await apiCall(page, `/api/dms/${pairId}/messages?before=${Number(meta.to_ts) + 1}`);
    expect(arch.status).toBe(200);
    const ids = arch.body.messages.map((m: any) => m.id);
    expect(ids.length).toBe(oldIds.length);
    for (const id of ids) expect(oldIds).toContain(id);
  });
});

/* ================= 🔴 AVTORİZASİYA — Task 7 sərhədi ================= */

test.describe('AUDIT C-3 — arxiv avtorizasiyası @archive', () => {

  test('yad komanda otağının arxivi oxunmur', async ({ browser }) => {
    const outsider = await loginAs(browser, OUTSIDER);
    try {
      const res = await apiCall(outsider.page,
        `/api/rooms/${E2E_TEAM.roomId}/messages?before=${Date.now()}`);
      expect(res.status, 'üzv olmayan komanda otağını oxuya bilməz').toBe(403);
    } finally { await outsider.ctx.close(); }
  });

  test('yad DM-in arxivi oxunmur', async ({ browser }) => {
    const outsider = await loginAs(browser, OUTSIDER);
    try {
      // İştirakçısı olmadığım cütlük.
      const res = await apiCall(outsider.page,
        `/api/dms/aaaaaaaa_bbbbbbbb/messages?before=${Date.now()}`);
      expect(res.status).toBe(403);
    } finally { await outsider.ctx.close(); }
  });

  test('🔴 cavabda R2 AÇARI yoxdur (Task 7 sərhədi)', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, `/api/rooms/${ROOM}/messages?limit=5`);
    expect(res.status).toBe(200);
    // Arxiv açarı (`archive/room/...`) client-ə HEÇ VAXT verilməməlidir —
    // əks halda `/files/archive/` qapısını açmaq cazibəsi yaranır və C-1
    // qismən yenidən açılar.
    expect(res.raw).not.toContain('archive/');
    expect(res.raw).not.toContain('.json.gz');
    expect(res.raw).not.toContain('r2_key');
  });

  test('🔴 /files/archive/ HƏLƏ DƏ bağlıdır (Task 7 reqressiyası)', async ({ browser }) => {
    const outsider = await loginAs(browser, OUTSIDER);
    try {
      const key = archiveMetaFor(ROOM)[0]?.r2_key;
      expect(key, 'test arxivi mövcud olmalıdır').toBeTruthy();
      const res = await outsider.page.evaluate(async (u) => {
        const r = await fetch(u as string);
        return r.status;
      }, `/files/${key}`);
      expect(res, 'adi istifadəçi arxiv obyektini birbaşa oxuya bilməz').toBe(404);
    } finally { await outsider.ctx.close(); }
  });
});

/* ================= 🔴 UNUDULMAQ HÜQUQU (§8.6) ================= */

test('silinmiş hesabın arxiv mesajları GÖRÜNMÜR @archive', async ({ page }) => {
  await openApp(page);
  const GHOST = 'e2e_ghost_uid';
  const GROOM = 'e2e-arch-ghost-room';

  // ⚠ İDEMPOTENTLİK (Task 5 qaydası): tombstone ƏVVƏLCƏ təmizlənir. Əks halda
  // əvvəlki (uğursuz) qaçışdan qalan sətir cron-un təmizlik mərhələsini işə
  // salır, yeni arxiv dərhal boşaldılır və test öz-özünü sındırır — məhz belə
  // oldu: sonda silmə yalnız test KEÇƏNDƏ icra olunurdu.
  d1(`DELETE FROM deleted_uids WHERE uid = '${GHOST}';`);

  // Otaqda iki müəllif: biri sonradan "silinmiş" sayılacaq.
  seedRoomMessages({ roomId: GROOM, oldCount: 4, newCount: 1, authorId: GHOST, tag: 'ghost' });
  await runArchiveCron(page, GROOM);

  // Kursor arxivin aralığından — yalnız ARXİVDƏKİ mesajlar qiymətləndirilir.
  const meta = archiveMetaFor(GROOM)[0];
  expect(meta, 'ghost arxivi olmalıdır').toBeTruthy();
  const cursor = Number(meta.to_ts) + 1;

  const before = await apiCall(page, `/api/rooms/${GROOM}/messages?before=${cursor}`);
  expect(before.status).toBe(200);
  expect(before.body.messages.length, 'silinmədən ƏVVƏL arxiv mesajları görünür').toBeGreaterThan(0);

  // Hesabın silinməsini modelləşdir (deleteAccount məhz bu sətri yazır).
  d1(`INSERT OR IGNORE INTO deleted_uids (uid, deleted_at, purged_at) VALUES ('${GHOST}', ${Date.now()}, NULL);`);

  const after = await apiCall(page, `/api/rooms/${GROOM}/messages?before=${cursor}`);
  expect(after.status).toBe(200);
  // ⚠ ƏHATƏ: filtr ARXİV oxu yoluna aiddir (§8.6 variant b). `deleteAccount`
  // `room_messages`/`dm_messages` D1 sətirlərinə ONSUZ DA toxunmur — yəni isti
  // pəncərədəki mesajlar görünməyə davam edir. Bu ziddiyyət hesabatda açıq
  // risk kimi qeyd olunub (§9) və siyasət qərarı tələb edir.
  expect(after.body.messages, 'silinmiş hesabın ARXİV mesajları filtrlənməlidir').toEqual([]);

  // §8.6/(c) — gecə cron-u onları FİZİKİ silir.
  await page.request.get('/__scheduled');
  await expect.poll(() => Number(archiveMetaFor(GROOM)[0]?.msg_count ?? -1),
    { timeout: 25_000, message: 'dump yenidən yazılıb mesaj sayı sıfırlanmalıdır' }).toBe(0);

  d1(`DELETE FROM deleted_uids WHERE uid = '${GHOST}';`);
});

/* ================= UI — "daha köhnə mesajlar" (§8.4) ================= */

test.describe('AUDIT C-3 — UI tarixçə yükləməsi @archive', () => {
  // ⚠ Düymənin görünməsi üçün ilk səhifə DOLU olmalıdır (`hasMore: true`),
  // yəni ümumi mesaj sayı standart səhifə həcmindən (120) çox olmalıdır.
  const UIROOM = 'e2e-arch-ui-room';

  test('"daha köhnə" düyməsi yükləyir, scroll SIÇRAMIR, sonda başlanğıc göstərilir', async ({ page }) => {
    test.setTimeout(120_000);
    seedRoomMessages({ roomId: UIROOM, oldCount: 130, newCount: 4, tag: 'ui',
      roomName: 'Arxiv UI testi' });
    await openApp(page);
    await runArchiveCron(page, UIROOM);

    await page.goto('/#chat', { waitUntil: 'networkidle' });
    // Otağı siyahıdan seç (seed-dəki ad `archive-seed.ts`-dədir).
    await page.getByText("Arxiv UI testi", { exact: false }).first().click();

    const box = page.locator('#chatMessages');
    await expect(box.locator('.msg-group').first()).toBeVisible({ timeout: 15_000 });

    const btn = box.locator('.hist-btn');
    await expect(btn, 'ilk səhifə dolu olduğu üçün düymə görünməlidir').toBeVisible({ timeout: 15_000 });

    const countBefore = await box.locator('.mg-body > .msg').count();
    // ⚠ Ölçü düymə GÖRÜNÜŞƏ GƏTİRİLDİKDƏN SONRA götürülür: Playwright klikdən
    // əvvəl elementi avtomatik scroll edir, yəni əvvəlcədən alınan mövqe köhnəlir
    // və müqayisə yalançı fərq göstərərdi.
    await btn.scrollIntoViewIfNeeded();
    const posBefore = await box.evaluate((n: HTMLElement) => ({ top: n.scrollTop, h: n.scrollHeight }));

    await btn.click();
    // Yükləmə bitənə qədər gözlə: ya düymə qayıdır, ya "başlanğıc" görünür.
    await expect(box.locator('.hist-bar.loading')).toHaveCount(0, { timeout: 20_000 });

    const countAfter = await box.locator('.mg-body > .msg').count();
    expect(countAfter, 'köhnə mesajlar əlavə olunmalıdır').toBeGreaterThan(countBefore);

    // 🔴 Scroll sıçramamalıdır: yuxarıya məzmun əlavə olunanda `scrollTop`
    // hündürlük fərqi qədər artırılır (js/history.js → rerenderWithScrollLock).
    const posAfter = await box.evaluate((n: HTMLElement) => ({ top: n.scrollTop, h: n.scrollHeight }));
    const grew = posAfter.h - posBefore.h;
    expect(grew, 'məzmun böyüməlidir').toBeGreaterThan(0);
    expect(Math.abs(posAfter.top - (posBefore.top + grew)),
      'oxunan yer qorunmalıdır (scroll sıçraması YOXDUR)').toBeLessThan(40);

    // Bitmə vəziyyəti: qalanı da yüklə → "söhbətin başlanğıcı".
    for (let i = 0; i < 4; i++) {
      const more = box.locator('.hist-btn');
      if (!(await more.count())) break;
      await more.click();
      await expect(box.locator('.hist-bar.loading')).toHaveCount(0, { timeout: 20_000 });
    }
    await expect(box.locator('.hist-bar.done'),
      'arxiv bitəndə "söhbətin başlanğıcı" göstərilməlidir').toBeVisible({ timeout: 20_000 });
  });

  test('429-da AVTOMATİK təkrar cəhd YOXDUR', async ({ page }) => {
    await openApp(page);
    await page.goto('/#chat', { waitUntil: 'networkidle' });
    await page.getByText("Arxiv UI testi", { exact: false }).first().click();
    const box = page.locator('#chatMessages');
    await expect(box).toBeVisible();

    // Arxiv sorğularını 429 ilə cavabla və SAYĞACI izlə.
    let hits = 0;
    await page.route('**/api/rooms/**/messages?before=*', route => {
      hits++;
      route.fulfill({ status: 429, headers: { 'Retry-After': '60' }, contentType: 'application/json',
        body: JSON.stringify({ error: 'limit', code: 'rate_limited' }) });
    });

    const btn = box.locator('.hist-btn');
    if (await btn.count()) {
      await btn.first().click();
      await expect(box.locator('.hist-bar.err'), 'xəta istifadəçiyə göstərilməlidir')
        .toBeVisible({ timeout: 15_000 });
      const after = hits;
      // Task 4 §7/1 dərsi: 429-dan sonra client ÖZBAŞINA təkrar etməməlidir.
      await page.waitForTimeout(6000);
      expect(hits, '429-dan sonra əlavə sorğu getməməlidir').toBe(after);
    }
    await page.unroute('**/api/rooms/**/messages?before=*');
  });
});

/* ================= GDPR İXRACI (§8.5) ================= */

test.describe('AUDIT hüquqi risk #13 — GDPR ixracı @archive', () => {

  test('ixrac yeni bölmələri əhatə edir', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/me/export?format=json');
    expect(res.status).toBe(200);
    for (const section of [
      'contact_messages', 'team_memberships', 'team_tasks_assigned',
      'team_posts', 'team_files', 'archived_messages',
    ]) {
      expect(res.raw, `${section} bölməsi ixracda olmalıdır`).toContain(`"${section}"`);
    }
    // Natamamlıq göstəricisi — GDPR-də "bu qədərdir" ilə "bu qədərini verə
    // bildik" fərqi hüquqi əhəmiyyət daşıyır.
    expect(res.raw).toContain('archived_messages_meta');
  });

  test('🔴 ixracda SİRLƏR yoxdur (mövcud qorumanın reqressiyası)', async ({ page }) => {
    await openApp(page);
    const res = await apiCall(page, '/api/me/export?format=json');
    expect(res.status).toBe(200);
    for (const secret of ['pass_hash', 'pass_salt', 'totp_secret', 'refresh_hash', 'prev_refresh_hash']) {
      expect(res.raw, `${secret} ixraca DÜŞMƏMƏLİDİR`).not.toContain(secret);
    }
  });

  test('🔴 ixracda BAŞQASININ komanda datası yoxdur', async ({ page, browser }) => {
    await openApp(page);
    // Kənar hesab komanda postu yazsın.
    const outsider = await loginAs(browser, OUTSIDER);
    let marker = '';
    try {
      const me = await apiCall(outsider.page, '/api/auth/me');
      const oid = me.body.user.uid as string;
      marker = 'e2e-ozge-post-' + Date.now();
      d1(`INSERT INTO team_posts (id, team_id, author_id, content, visibility, created_at) ` +
         `VALUES ('e2e_tp_${Date.now()}', '${E2E_TEAM.id}', '${oid}', '${marker}', 'Team', ${Date.now()});`);
    } finally { await outsider.ctx.close(); }

    const res = await apiCall(page, '/api/me/export?format=json');
    expect(res.status).toBe(200);
    expect(res.raw, 'başqasının komanda postu ixraca düşməməlidir').not.toContain(marker);
  });

  test('CSV formula injection qoruması işləyir', async ({ page }) => {
    await openApp(page);
    // `=` ilə başlayan məzmun — Excel-də düstur kimi icra olunmamalıdır.
    d1(`INSERT INTO team_posts (id, team_id, author_id, content, visibility, created_at) ` +
       `SELECT 'e2e_tp_csv', '${E2E_TEAM.id}', id, '=SUM(1+1)', 'Team', ${Date.now()} ` +
       `FROM users WHERE username = 'e2e_main';`);
    const res = await apiCall(page, '/api/me/export?format=csv');
    expect(res.status).toBe(200);
    expect(res.raw, 'düstur neytrallaşdırılmalıdır').toContain("'=SUM(1+1)");
    d1(`DELETE FROM team_posts WHERE id = 'e2e_tp_csv';`);
  });
});
