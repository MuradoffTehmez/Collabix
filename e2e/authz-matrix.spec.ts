import { type Page, type Browser } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { TEST_PASS, E2E_TURNSTILE } from './seed';

// BACKEND AUDIT / BE-010 — inteqrasiya testi boşluğunun bağlanması.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 NİYƏ BU FAYL VAR
// ════════════════════════════════════════════════════════════════════════════
//
// Auditin ölçdüyü vəziyyət: `test/`-də 89 test var və hamısı SAF FUNKSİYADIR
// (util, permissions, rate-limit qaydaları, marşrut adları). D1/KV/DO ilə heç
// bir inteqrasiya testi yoxdur. Yəni "130 mutasiya marşrutunun hamısında qapı
// var" iddiası ƏL İLƏ oxumaqla təsdiqlənib — bir dəfə, bir adam tərəfindən.
//
// Audit ən dəyərli üç çatışmayan testi açıq sadaladı; bu fayl onları yazır:
//   (1) "başqasının resursu → 403" matrisi;
//   (2) paralel reaksiya → TƏK bildiriş (BE-003/BE-004 düzəlişinin sübutu);
//   (3) səhifələmə tavanının aşıla bilməməsi.
//
// ⚠ E2E, VAHİD TEST DEYİL — və bu, qəsdlidir. Qapılar `c.user`, D1 sətirləri və
//   marşrut cədvəlinin birgə işindən yaranır; mock-lanmış Ctx ilə yoxlamaq
//   yalnız mock-un düzgünlüyünü sübut edərdi.
//
// ⚠ YALNIZ `desktop` layihəsində: cavab kodları viewport-dan asılı deyil, iki
//   dəfə işlətmək `auth` rate-limit-ini (5 dəq / 10 sorğu) səbəbsiz yandırır.
test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Protokol testi — viewport-dan asılı deyil, bir dəfə icra olunur');
});

/* ⚠ HEÇ BİRİ `PRIMARY` DEYİL.
 *   `e2e_main` seed-də `admins` cədvəlinə yazılır (bax `e2e/seed.ts`), yəni
 *   moderasiya icazələri var və onunla "kənar şəxs" rolunu oynamaq MÜMKÜN
 *   DEYİL: 403 gözlədiyimiz yerdə 200 alardıq və test yalançı yaşıl verərdi.
 *   Üstəlik `PRIMARY` paylaşılan `storageState`-i daşıyır — ona toxunmaq bütün
 *   dəsti sıradan çıxarır. */
const OWNER = 'e2e_zara';        // resursların sahibi
const OUTSIDER = 'e2e_dilara';   // heç bir əlaqəsi olmayan adi hesab

async function apiCall(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(async ([p, i]) => {
    const r = await fetch(p as string, i as RequestInit);
    let body: any = null;
    try { body = await r.json(); } catch { /* gövdəsiz cavab */ }
    return { status: r.status, ok: r.ok, body };
  }, [path, init] as const);
}

const post = (page: Page, path: string, body: unknown) => apiCall(page, path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

/** İzolə "cihaz": öz konteksti, öz girişi (bax security-api.spec.ts). */
async function freshDevice(browser: Browser, username: string) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/');
  const login = await post(page, '/api/auth/login',
    { username, pass: TEST_PASS, turnstileToken: E2E_TURNSTILE });
  expect(login.status, `${username} girişi`).toBe(200);
  expect(login.body.mfaRequired, `${username} hesabında 2FA qalıb`).toBeFalsy();
  return { ctx, page };
}

/** Sahibin adından bir post + bir şərh yaradır. */
async function seedContent(page: Page) {
  const p = await post(page, '/api/posts', {
    blocks: [{ type: 'text', content: 'BE-010 authz matrisi üçün test postu' }],
  });
  expect(p.status, 'post yaradılmadı').toBe(200);
  const postId = p.body.post.id as string;

  const cm = await post(page, `/api/posts/${postId}/comments`, { text: 'sahibin şərhi' });
  expect(cm.status, 'şərh yaradılmadı').toBe(200);
  const commentId = (cm.body.comment?.id || cm.body.id) as string;

  return { postId, commentId };
}

test.describe('BE-010 — başqasının resursu 403 verir', () => {
  test('🔴 kənar hesab sahibin postuna və şərhinə YAZA BİLMİR', async ({ browser }) => {
    const owner = await freshDevice(browser, OWNER);
    const outsider = await freshDevice(browser, OUTSIDER);
    try {
      const { postId, commentId } = await seedContent(owner.page);

      /* ⚠ QƏBUL EDİLƏN KODLAR 403 VƏ 404-dür.
       *   Bəzi qapılar resursu "yoxdur" kimi göstərir (mövcudluğu sızdırmamaq
       *   üçün) — bu, DAHA GÜCLÜ davranışdır və testi sındırmamalıdır.
       *   Sındıran YEGANƏ hal 2xx-dir: yəni əməliyyat GERÇƏKDƏN icra olundu. */
      const attempts: Array<[string, string, unknown?]> = [
        ['PATCH',  `/api/posts/${postId}`, { blocks: [{ type: 'text', content: 'oğurlandı' }] }],
        ['DELETE', `/api/posts/${postId}`],
        ['PATCH',  `/api/posts/${postId}/comments/${commentId}`, { text: 'oğurlandı' }],
        ['DELETE', `/api/posts/${postId}/comments/${commentId}`],
        ['PUT',    `/api/posts/${postId}/pin`],
        ['PUT',    `/api/posts/${postId}/hide`],
        ['PUT',    `/api/posts/${postId}/comments/${commentId}/pin`],
        ['PUT',    `/api/posts/${postId}/comments/${commentId}/hide`],
      ];

      const leaked: string[] = [];
      for (const [method, path, body] of attempts) {
        const res = await apiCall(outsider.page, path, {
          method,
          ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        });
        if (res.status < 400) leaked.push(`${method} ${path} → ${res.status}`);
      }
      expect(leaked, 'kənar hesab üçün AÇIQ qalan mutasiya(lar)').toEqual([]);

      // Kontrol: post HƏLƏ də sahibindədir və silinməyib. Bu olmasa yuxarıdakı
      // "hamısı 403" nəticəsi endpoint-in ümumiyyətlə sınıq olmasından da
      // gələ bilərdi.
      const still = await apiCall(owner.page, `/api/posts/${postId}`);
      expect(still.status, 'post sahibi üçün də əlçatmaz oldu — qapı çox geniş bağlanıb').toBe(200);
    } finally {
      await owner.ctx.close();
      await outsider.ctx.close();
    }
  });

  test('🔴 kənar hesab yad DM söhbətini oxuya bilmir', async ({ browser }) => {
    const owner = await freshDevice(browser, OWNER);
    const outsider = await freshDevice(browser, OUTSIDER);
    try {
      const me = await apiCall(owner.page, '/api/auth/me');
      const them = await apiCall(outsider.page, '/api/auth/me');
      /* ⚠ SAHƏ ADI `uid`-dir, `id` DEYİL (`worker/util.ts` → `mapUser`).
       *   `id` yazsaq dəyər `undefined` olur, cüt `"undefined_undefined"`
       *   şəklini alır və 403 gözləyən sətirlər TRİVİAL olaraq keçir — yəni
       *   test yaşıl görünüb heç nə sübut etməzdi. Aşağıdakı `expect`-lər
       *   məhz bunun qarşısını alır. */
      const ownerUid = me.body.user.uid as string;
      const outsiderUid = them.body.user.uid as string;
      expect(ownerUid, 'sahibin uid-i oxunmadı').toMatch(/^[0-9a-f]{32}$/);
      expect(outsiderUid, 'kənar hesabın uid-i oxunmadı').toMatch(/^[0-9a-f]{32}$/);

      // `pairIdFor` = sıralanmış `a_b`. Kənar şəxs onu TƏXMİN EDƏ BİLƏR —
      // uid-lər publik profildə görünür. Qapı məhz bunu dayandırmalıdır.
      const third = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const foreignPair = [ownerUid, third].sort().join('_');

      const read = await apiCall(outsider.page, `/api/dms/${foreignPair}/messages`);
      expect(read.status, 'yad DM söhbəti oxundu').toBe(403);

      const send = await post(outsider.page, `/api/dms/${foreignPair}/read`, {});
      expect(send.status, 'yad DM söhbəti oxunmuş işarələndi').toBe(403);

      // Kontrol: ÖZ söhbəti işləyir — yəni 403 hər şeyə deyil, YADA verilir.
      const ownPair = [ownerUid, outsiderUid].sort().join('_');
      const own = await apiCall(outsider.page, `/api/dms/${ownPair}/messages`);
      expect(own.status, 'öz DM söhbəti də bağlandı').toBe(200);
    } finally {
      await owner.ctx.close();
      await outsider.ctx.close();
    }
  });
});

test.describe('BE-003/BE-004 — paralel reaksiya TƏK bildiriş yazır', () => {
  test('🔴 eyni anda iki reaksiya sorğusu bir bildiriş yaradır', async ({ browser }) => {
    const owner = await freshDevice(browser, OWNER);
    const outsider = await freshDevice(browser, OUTSIDER);
    try {
      const { postId } = await seedContent(owner.page);

      /* 🔴 SORĞULAR BRAUZERDƏ, `Promise.all` İLƏ ATILIR.
       *   Ardıcıl göndərsək `if (!prev)` şərti ikincini onsuz da kəsərdi və
       *   test yarışı HEÇ VAXT canlandırmazdı — yəni yaşıl olardı və heç nə
       *   sübut etməzdi. Yarışı yaradan məhz eyni anda iki `prev = null`
       *   oxunuşudur; qoruma isə `ux_notifications_event` unikal indeksidir. */
      const results = await outsider.page.evaluate(async (id) => {
        const fire = () => fetch(`/api/posts/${id}/reaction`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'like' }),
        }).then(r => r.status);
        return Promise.all([fire(), fire(), fire(), fire()]);
      }, postId);
      expect(results.every(s => s === 200), `reaksiya sorğuları: ${results}`).toBe(true);

      const notifs = await apiCall(owner.page, '/api/notifications?state=all&limit=100');
      expect(notifs.status).toBe(200);
      const mine = (notifs.body.notifications as any[])
        .concat(notifs.body.pinned || [])
        .filter(n => n.postId === postId && n.type === 'like');

      expect(mine.length, `bu post üçün ${mine.length} bildiriş — idempotentlik açarı işləmir`).toBe(1);
    } finally {
      await owner.ctx.close();
      await outsider.ctx.close();
    }
  });
});

test.describe('səhifələmə tavanı aşıla bilmir', () => {
  test('🔴 nəhəng `limit` server tavanına sıxılır', async ({ browser }) => {
    const dev = await freshDevice(browser, OUTSIDER);
    try {
      // Tavanlar mənbədədir: feed 100 (`routes/post.ts`), mesaj 200
      // (`routes/room.ts` → MSG_PAGE_MAX), bildiriş 100 (`notification.ts`).
      const cases: Array<[string, number]> = [
        ['/api/feed?limit=99999', 100],
        ['/api/notifications?limit=99999', 100],
        ['/api/rooms/general/messages?limit=99999', 200],
      ];
      for (const [path, cap] of cases) {
        const res = await apiCall(dev.page, path);
        expect(res.status, path).toBe(200);
        const arr: any[] = res.body.posts || res.body.notifications || res.body.messages || [];
        expect(arr.length, `${path} tavanı aşdı`).toBeLessThanOrEqual(cap);
      }
    } finally {
      await dev.ctx.close();
    }
  });
});
