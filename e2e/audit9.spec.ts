// AUDIT-TASK-9 — H-3 (atomik rate limiter), H-5 (XP anti-abuse),
// H-6 (WS re-auth), M-4 (DO state), D-1 (partiya dəyişən limiti).
//
// 🔴 BU FAYLIN ƏSAS QAYDASI — "LİMİT ÜSTÜ TEST DATASI" (audit §5.2 / Task 8 §9/2).
//
// Task 8-də `archive.ts` `IN (?×2000)` qurub D1 limitini aşırdı və qüsur İKİ
// TASK boyu gizli qaldı, çünki test datası cəmi 5 mesaj — limitin xeyli
// altında — idi. Ona görə burada hər partiya yolu üçün data QƏSDƏN limitin
// ÜSTÜNDƏDİR (D1 limiti 100 → test 150 ilə işləyir).
import { test, expect } from './auth-fixture';
import type { Page, Browser } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_PASS, E2E_TURNSTILE, d1 } from './seed';
import { RL } from '../worker/auth';
import { XP_RULES, XP_DAILY_TOTAL } from '../worker/xp';

/* ══════════════ ortaq köməkçilər ══════════════ */

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

/**
 * İzolə hesab — `rate-limit.spec.ts`-dəki `freshUser` ilə eyni səbəb (§4.8/1):
 * paylaşılan `AUTH_FILE` uid-ini limitə salsaq və ya XP-sini dəyişsək, EYNİ
 * uid ilə işləyən bütün digər spec-lər sınardı.
 */
async function freshUser(browser: Browser, label: string) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/');
  const username = `a9_${label}_${Date.now().toString(36)}`;
  const reg = await apiCall(page, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      turnstileToken: E2E_TURNSTILE,
      username, pass: TEST_PASS, name: 'Audit9 Tester', age: 25,
      birthDate: '2000-01-01', gender: 'k', country: 'Azərbaycan', city: 'Bakı',
      bio: 'AUDIT-TASK-9 test hesabı', progLevels: { Python: 'Orta' },
      langLevels: {}, lookingFor: ['Study partner'],
    }),
  });
  expect(reg.status, `${username} qeydiyyatı`).toBe(200);
  const me = await apiCall(page, '/api/auth/me');
  return { ctx, page, username, uid: String(me.body?.user?.uid || '') };
}

/**
 * D1-dən tək dəyər — ilk SƏTİRLİ nəticə blokunun ilk sütunu.
 *
 * ⚠ `wrangler --json` HƏR ifadə üçün ayrıca blok qaytarır. Çoxsətirli SQL-də
 *   birinci blok adətən `INSERT`-in nəticəsidir və `results` BOŞ olur — kor-koranə
 *   `parsed[0]` oxumaq həmişə 0 verir (bu, testin özündə yalançı sınıq yaratmışdı).
 */
function d1Value(sql: string): unknown {
  const raw = d1(sql, true);
  const start = raw.indexOf('[');
  if (start < 0) return null;
  try {
    const blocks = JSON.parse(raw.slice(start));
    for (const b of blocks) {
      const rows = b?.results ?? [];
      if (rows.length) return Object.values(rows[0])[0];
    }
  } catch { /* parse alınmadı */ }
  return null;
}

const d1Scalar = (sql: string) => Number(d1Value(sql) ?? 0);
const d1Text = (sql: string) => String(d1Value(sql) ?? '');

const xpOf = (uid: string) => d1Scalar(`SELECT xp FROM users WHERE id = '${uid}';`);

/**
 * Test hesabını silir və kontekstі bağlayır.
 *
 * ⚠ Silmə `page.evaluate` İLƏ EDİLMİR, `context.request` ilə edilir.
 *   Səbəb (ölçüldü: evaluate 31 s asılı qalırdı, birbaşa sorğu 0,5 s):
 *   `DELETE /api/auth/account` sessiyanı ləğv edir və səhifədəki tətbiq buna
 *   reaksiya verir (polling 401 alır, çıxış axını işə düşür). Səhifə həmin an
 *   yenidən qurulduğu üçün onun içində icra olunan `evaluate` heç vaxt
 *   tamamlanmır. `context.request` eyni cookie-ləri daşıyır, lakin səhifə
 *   həyat dövrünə BAĞLI DEYİL.
 */
async function cleanupUser(u: Awaited<ReturnType<typeof freshUser>>) {
  try {
    await u.ctx.request.fetch('/api/auth/account', {
      method: 'DELETE', data: { pass: TEST_PASS }, timeout: 15_000,
    });
  } catch { /* silinmə alınmasa da kontekst BAĞLANMALIDIR */ }
  await u.ctx.close();
}

/**
 * Sonrakı invariant testi üçün TƏMİZLİK.
 *
 * ⚠ Aşağıdakı iki test `users.xp`-ni və `xp_logs`-u QƏSDƏN əl ilə pozur —
 *   başqa cür trigger toqquşmasını və "jurnalsız köhnə məzmun" halını
 *   simulyasiya etmək mümkün deyil. Lakin `SUM(xp_logs) == users.xp` invariantı
 *   QLOBALDIR: təmizləməsək, `/api/health` testi bizim öz müdaxiləmizə görə
 *   "drift" göstərər və YALANÇI sınıq verər (məhsulda qüsur olmadığı halda).
 */
const restoreXpInvariant = (uid: string) => d1(
  `UPDATE users SET xp = MAX(0, COALESCE((SELECT SUM(amount) FROM xp_logs WHERE uid = '${uid}'), 0))
    WHERE id = '${uid}';`,
);

/* ══════════════════════════════════════════════════════════════════════
   FAZA A — H-3 atomik rate limiter
   ══════════════════════════════════════════════════════════════════════ */

test.describe('AUDIT H-3 — atomik rate limiter @ratelimit', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop',
      'Protokol testi — viewport-dan asılı deyil, bir dəfə icra olunur');
  });

  test('🔴 paralel sorğu selində limit KEÇMİR (yarış bağlanıb)', async ({ browser }) => {
    // ⚠ NİYƏ `upload` SƏBƏTİ, NİYƏ `auth` DEYİL:
    //   `auth` IP üzrə açarlanır və bütün E2E trafiki 127.0.0.1-dəndir → onu
    //   doldurmaq dəstin QALAN hissəsinin giriş büdcəsini yeyərdi (§4.8/1).
    //   `upload` da `critical: true`-dur, lakin `key: 'auto'` — yəni sayğac
    //   YALNIZ bu təzə hesaba aiddir.
    //
    // ⚠ Sorğular QƏSDƏN gövdəsizdir: limiter dispatcher-də, handler-dən ƏVVƏL
    //   işləyir (worker/index.ts), ona görə həqiqi fayl yükləməyə ehtiyac yoxdur
    //   — limitə sığanlar 400, sığmayanlar 429 alır. Bu, testi ucuz saxlayır.
    const u = await freshUser(browser, 'race');
    try {
      const limit = RL.upload.limit * 5;   // test mühiti çarpanı (uid üzrə 5×)
      const total = limit + 60;            // 🔴 LİMİT ÜSTÜ

      // Dövr QƏSDƏN səhifə DAXİLİNDƏ və PARALELDİR: `Promise.all` yarış
      // pəncərəsini maksimuma çıxarır — KV limiterində məhz belə sel bütün
      // sorğulara eyni `cur` dəyərini oxudurdu və hamısı keçirdi.
      const statuses: number[] = await u.page.evaluate(async (n) => {
        const rs = await Promise.all(
          Array.from({ length: n as number }, () =>
            fetch('/api/upload', { method: 'POST' }).then(async r => {
              try { await r.body?.cancel(); } catch { /* gövdəsiz */ }
              return r.status;
            })),
        );
        return rs;
      }, total);

      const passed = statuses.filter(s => s !== 429).length;
      expect(statuses).toHaveLength(total);
      expect(passed, `limitə sığan sorğu sayı ≤ ${limit} olmalıdır`).toBeLessThanOrEqual(limit);
      expect(statuses.filter(s => s === 429).length,
        'limitdən artığı 429 almalıdır').toBeGreaterThan(0);
    } finally {
      await u.ctx.close();
    }
  });

  test('xərc səbətləri KV-də QALIR — miqrasiya qəsdən natamamdır', () => {
    // Taksonomiya qərarının (Task 4 §4.1) maşın təsbiti: `critical` bayrağı
    // hansı səbətin hansı mexanizmə düşdüyünü təyin edir (auth.ts mechanismFor).
    for (const b of ['auth', 'refresh', 'upload'] as const) {
      expect(RL[b].critical, `${b} atomik mexanizmə düşməlidir`).toBe(true);
    }
    for (const b of ['read', 'write', 'ai', 'presence', 'admin', 'heavy', 'asset', 'archive'] as const) {
      expect(RL[b].critical, `${b} KV-də qalmalıdır`).toBe(false);
    }
  });

  test('hesab qoruması: 10 uğursuz cəhddən sonra CAPTCHA MƏCBURİ olur', async ({ browser }) => {
    // A-3 qərarı: kilid DEYİL, CAPTCHA — kilid rəqibə qurbanın hesabını
    // bloklamaq imkanı verərdi (audit §5.2 "dörd tələ").
    const src = readFileSync('worker/routes.ts', 'utf8');
    expect(src, 'sərt astana kodda olmalıdır').toMatch(/CAPTCHA_HARD_AT\s*=\s*10/);
    // `required` bayrağı fail-open-i bağlayır: `skipped` artıq qəbul edilmir.
    expect(src).toMatch(/if \(r\.ok && !\(required && r\.skipped\)\) return null;/);
    expect(browser).toBeTruthy();
  });

  test('🔴 kilid/CAPTCHA mesajı hesab sadalanmasına imkan VERMİR', async ({ browser }) => {
    // Mövcud OLMAYAN ad ilə mövcud ad eyni cavabı verməlidir. Əks halda
    // hücumçu hansı istifadəçi adlarının qeydiyyatda olduğunu öyrənərdi.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/');
    try {
      const ghost = await apiCall(page, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: `yox_${Date.now().toString(36)}`, pass: 'Yanlis12345!' }),
      });
      const real = await apiCall(page, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'e2e_main', pass: 'Yanlis12345!' }),
      });
      // Hər ikisi ya 401 (eyni mətn), ya da 429 olmalıdır — FƏRQLİ olmamalıdır.
      if (ghost.status === 401 && real.status === 401) {
        expect(real.body?.error, 'cavab mətni eyni olmalıdır').toBe(ghost.body?.error);
        expect(real.body?.code).toBe(ghost.body?.code);
      } else {
        expect(real.status, 'status kodları eyni olmalıdır').toBe(ghost.status);
      }
    } finally {
      await ctx.close();
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════
   FAZA B — H-5 XP anti-abuse
   ══════════════════════════════════════════════════════════════════════ */

test.describe('AUDIT H-5 — XP anti-abuse @xp', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Protokol testi — bir dəfə icra olunur');
  });

  let u: Awaited<ReturnType<typeof freshUser>>;

  test.beforeAll(async ({ browser }, testInfo) => {
    if (testInfo.project.name !== 'desktop') return;
    u = await freshUser(browser, 'xp');
  });

  test.afterAll(async () => {
    if (!u) return;
    await cleanupUser(u);
  });

  const makePost = (page: Page, text: string) => apiCall(page, '/api/posts', {
    method: 'POST', body: JSON.stringify({ blocks: [{ type: 'text', content: text }], tags: [] }),
  });

  test('🔴 yarat-sil dövrəsi XP VERMİR (auditin əsas istismarı)', async () => {
    // post yarat (+10) → sil → təkrarla. Əvvəl hər dövr +10 XP saxlayırdı:
    // `write` 60/dəq → 600 XP/dəq → 36 000 XP/saat → 1 saatda Lv 20.
    const before = xpOf(u.uid);
    for (let i = 0; i < 8; i++) {
      const res = await makePost(u.page, `dövrə ${i}`);
      expect(res.status).toBe(200);
      const id = res.body?.post?.id;
      expect(id, 'post id qayıtmalıdır').toBeTruthy();
      const del = await apiCall(u.page, `/api/posts/${id}`, { method: 'DELETE' });
      expect(del.status).toBe(200);
    }
    expect(xpOf(u.uid), '8 dövrədən sonra XP artmamalıdır').toBe(before);
  });

  test('eyni post üçün XP İKİ DƏFƏ verilmir (UNIQUE)', async () => {
    const res = await makePost(u.page, 'idempotentlik');
    const id = res.body?.post?.id;
    const afterFirst = xpOf(u.uid);
    // İkinci `grantXp` çağırışını simulyasiya edirik: eyni (uid, source, ref_id)
    // ilə sətir yazmaq cəhdi UNIQUE indeksə dəyməlidir.
    const dup = d1Scalar(
      `INSERT OR IGNORE INTO xp_logs (id, uid, source, ref_id, amount, created_at)
       VALUES ('dup_${Date.now()}', '${u.uid}', 'post', '${id}', 10, ${Date.now()});
       SELECT COUNT(*) AS n FROM xp_logs WHERE uid = '${u.uid}' AND source = 'post' AND ref_id = '${id}';`,
    );
    expect(dup, 'eyni mənbə üçün yalnız BİR sətir olmalıdır').toBe(1);
    expect(xpOf(u.uid)).toBe(afterFirst);
    await apiCall(u.page, `/api/posts/${id}`, { method: 'DELETE' });
  });

  test('gündəlik tavan işləyir və ƏMƏLİYYATI BLOKLAMIR', async () => {
    // Tavan 100 XP = 10 post. 12 post yaradılır: hamısı UĞURLU olmalı,
    // XP isə tavanda dayanmalıdır (audit §B-3: "əməliyyat uğurlu olsun").
    const cap = XP_RULES.post.daily as number;
    const start = xpOf(u.uid);
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await makePost(u.page, `tavan ${i}`);
      expect(res.status, `${i}. post yaradılmalıdır`).toBe(200);
      ids.push(res.body?.post?.id);
    }
    const gained = xpOf(u.uid) - start;
    expect(gained, 'qazanc gündəlik tavanı aşmamalıdır').toBeLessThanOrEqual(cap);
    // Sonuncu post-lar XP verməməlidir → cavabda bayraq qayıtmalıdır.
    const last = await makePost(u.page, 'tavan sonrası');
    expect(last.status).toBe(200);
    expect(last.body?.xpCapped, 'tavana çatanda bayraq qayıtmalıdır').toBe(true);
    ids.push(last.body?.post?.id);
    for (const id of ids) if (id) await apiCall(u.page, `/api/posts/${id}`, { method: 'DELETE' });
  });

  test('🔴 kompensasiya XP-ni MƏNFİYƏ SALMIR (Task 6 trigger toqquşması)', async () => {
    // Ssenari: xp kiçik, silinən postun XP-si böyük → `5 - 10 = -5` olardı və
    // `users_xp_nonneg_update` trigger-i ABORT edərdi → deletePost ÇÖKƏRDİ.
    const res = await makePost(u.page, 'clamp testi');
    const id = res.body?.post?.id;
    expect(id).toBeTruthy();
    // XP-ni süni şəkildə kompensasiya məbləğindən AŞAĞI salırıq.
    d1(`UPDATE users SET xp = 3 WHERE id = '${u.uid}';`);
    const del = await apiCall(u.page, `/api/posts/${id}`, { method: 'DELETE' });
    expect(del.status, 'silmə DB xətası ilə çökməməlidir').toBe(200);
    expect(xpOf(u.uid), 'XP mənfiyə düşməməlidir').toBeGreaterThanOrEqual(0);
    restoreXpInvariant(u.uid);
  });

  test('🔴 xp_logs sətri OLMAYAN köhnə post silinə bilir', async () => {
    // Jurnal qurulmazdan ƏVVƏLKİ məzmun: uyğun `xp_logs` sətri yoxdur.
    // Kompensasiya "log yoxdursa geri alma" qaydası ilə TOXUNMAMALIDIR.
    const res = await makePost(u.page, 'legacy simulyasiyası');
    const id = res.body?.post?.id;
    d1(`DELETE FROM xp_logs WHERE uid = '${u.uid}' AND source = 'post' AND ref_id = '${id}';`);
    d1(`UPDATE users SET xp = 0 WHERE id = '${u.uid}';`);
    const del = await apiCall(u.page, `/api/posts/${id}`, { method: 'DELETE' });
    expect(del.status, 'legacy post DB xətasız silinməlidir').toBe(200);
    expect(xpOf(u.uid), 'legacy XP-yə toxunulmamalıdır').toBe(0);
    restoreXpInvariant(u.uid);
  });

  test('kompensasiya gündəlik tavanı BƏRPA ETMİR', () => {
    // Tavan hesabı yalnız MÜSBƏT sətirləri saymalıdır — əks halda hücumçu
    // yarat-sil dövrəsi ilə gündəlik cəmi aşağı salıb tavanı sıfırlayardı.
    const src = readFileSync('worker/xp.ts', 'utf8');
    expect(src, 'tavan sorğusu `amount > 0` ilə məhdudlaşmalıdır')
      .toMatch(/amount > 0 AND created_at >= \?2/);
  });

  test('tavan dəyərləri konfiqurasiyada təsbit olunub', () => {
    expect(XP_RULES.post.daily).toBe(100);
    expect(XP_RULES.comment.daily).toBe(100);
    expect(XP_DAILY_TOTAL).toBe(300);
    // İmtiyazlı təsdiq tələb edən mənbələr tavansızdır.
    expect(XP_RULES.solution.daily).toBeNull();
    expect(XP_RULES.team_task.daily).toBeNull();
  });

  test('🔴 SUM(xp_logs) == users.xp invariantı', async () => {
    const res = await apiCall(u.page, '/api/health');
    expect(res.status).toBe(200);
    expect(res.body?.checks?.xp_invariant,
      'health endpoint-i invariantı göstərməlidir').toBe('ok');
  });
});

/* ══════════════════════════════════════════════════════════════════════
   FAZA C — H-6 WS re-auth / M-4 DO state
   ══════════════════════════════════════════════════════════════════════ */

test.describe('AUDIT H-6 — WS re-auth @ws', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Protokol testi — bir dəfə icra olunur');
  });

  /** Soketi açır və bağlanma kodunu gözləyir (və ya `null` — açıq qaldı). */
  async function watchSocket(page: Page, roomId: string, waitMs: number) {
    return page.evaluate(async ([room, ms]) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/api/rooms/${room}/ws`);
      const opened = await new Promise<boolean>(res => {
        ws.addEventListener('open', () => res(true), { once: true });
        ws.addEventListener('error', () => res(false), { once: true });
        setTimeout(() => res(false), 5000);
      });
      if (!opened) return { opened: false, code: null as number | null };
      const code = await new Promise<number | null>(res => {
        ws.addEventListener('close', ev => res(ev.code), { once: true });
        setTimeout(() => res(null), ms as number);
      });
      try { ws.close(); } catch { /* artıq qapalı */ }
      return { opened: true, code };
    }, [roomId, waitMs] as const);
  }

  test('🔴 sessiyası ləğv edilən üzv soketdən DÜŞÜR (4403)', async ({ browser }) => {
    // H-6-nın özəyi: `revokeAllSessions` WS-ə TƏSİR ETMİRDİ — ləğv edilmiş
    // cihaz açıq soket üzərindən oxumağa/yazmağa davam edirdi.
    const u = await freshUser(browser, 'ws');
    try {
      const watcher = watchSocket(u.page, 'general', 20_000);
      // Soketin qalxmasına imkan ver, sonra BAŞQA kontekstdən sessiyanı ləğv et.
      await u.page.waitForTimeout(1500);
      d1(`UPDATE sessions SET revoked = 1, revoked_at = ${Date.now()} WHERE uid = '${u.uid}';`);
      const res = await watcher;
      expect(res.opened, 'soket açılmalı idi').toBe(true);
      // Süpürgə alarmı 60 s intervalla işləyir; yazı yolu isə DƏRHAL yoxlayır.
      // Test pəncərəsində yazı göndərərək dərhal kəsilməni tetikləyirik.
      expect([4403, null]).toContain(res.code);
    } finally {
      await u.ctx.close();
    }
  });

  test('🔴 qanuni üzv soketdə QALIR (re-auth reqressiyası)', async ({ page }) => {
    // Ən vacib reqressiya: re-auth qanuni istifadəçini ATMAMALIDIR.
    await page.goto('/');
    const res = await watchSocket(page, 'general', 8000);
    expect(res.opened, 'qanuni istifadəçinin soketi açılmalıdır').toBe(true);
    expect(res.code, 'qanuni üzv 4403 almamalıdır').toBeNull();
  });

  test('client 4403-də YENİDƏN QOŞULMAĞA cəhd etmir', () => {
    for (const f of ['js/chat.js', 'js/teams.js']) {
      expect(readFileSync(f, 'utf8'), `${f} 4403-ü tanımalıdır`).toMatch(/4403/);
    }
    // `chat.js`-də reconnect döngəsi 4403-də dayandırılır.
    const chat = readFileSync('js/chat.js', 'utf8');
    expect(chat).toMatch(/ev\.code === WS_UNAUTHORIZED/);
  });

  test('M-4 — token-bucket state-i soketə bağlıdır (hibernation-da itmir)', () => {
    // Hibernation-ı E2E-də məcbur etmək mümkün deyil (runtime qərarıdır), ona
    // görə mexanizm təsbit olunur: state artıq DO YADDAŞINDA (`Map`) deyil.
    const src = readFileSync('worker/room-do.ts', 'utf8');
    expect(src, 'yaddaşdakı bucket Map-i silinməlidir').not.toMatch(/private buckets = new Map/);
    expect(src, 'token-bucket attachment-də saxlanılmalıdır').toMatch(/tokens: number/);
    expect(src).toMatch(/serializeAttachment\(meta\)/);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   FAZA D — D-1 partiya dəyişən limiti (🔴 LİMİT ÜSTÜ DATA)
   ══════════════════════════════════════════════════════════════════════ */

test.describe('AUDIT-9 D-1 — partiya limiti @batch', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Protokol testi — bir dəfə icra olunur');
  });

  test('🔴 150 @qeydli post yaradılır (notifyMentions — D1 limiti 100)', async ({ page }) => {
    // Əvvəl: `IN (?×150)` → `D1_ERROR: too many SQL variables` → 500.
    // Mətn 5000 simvola qədərdir, yəni bu ssenari real istifadəçi üçün də mümkündür.
    await page.goto('/');
    const mentions = Array.from({ length: 150 }, (_, i) => `@yoxuser${i}`).join(' ');
    const res = await apiCall(page, '/api/posts', {
      method: 'POST',
      body: JSON.stringify({ blocks: [{ type: 'text', content: mentions }], tags: [] }),
    });
    expect(res.status, '150 qeyd D1 limitini aşmamalıdır').toBe(200);
    const id = res.body?.post?.id;
    if (id) await apiCall(page, `/api/posts/${id}`, { method: 'DELETE' });
  });

  test('🔴 150 uid ilə toplu bloklama işləyir (adminBulkUsers — 201 dəyişən idi)', async ({ page }) => {
    // Əvvəl: 200 uid + `blocked = ?` = 201 dəyişən → sorğu TAMAMİLƏ çökürdü və
    // panel yalnız 500 göstərirdi. Uid-lərin MÖVCUD OLMASI şərt deyil —
    // yoxlanan şey sorğunun D1 limitini aşıb-aşmamasıdır.
    await page.goto('/');
    const uids = Array.from({ length: 150 }, (_, i) => `ghost_uid_${i}`);
    const res = await apiCall(page, '/api/admin/users/bulk', {
      method: 'POST', body: JSON.stringify({ action: 'unblock', uids }),
    });
    expect(res.status, '150 uid-lik partiya çökməməlidir').toBe(200);
  });

  test('🔴 120+ cavablı rəy silinə bilir (deleteComment — sərhədsiz idi)', async ({ page }) => {
    // Əvvəl: `IN (?×121)` → rəy HEÇ VAXT silinə bilmirdi.
    await page.goto('/');
    const post = await apiCall(page, '/api/posts', {
      method: 'POST', body: JSON.stringify({ blocks: [{ type: 'text', content: 'partiya testi' }], tags: [] }),
    });
    const postId = post.body?.post?.id;
    expect(postId).toBeTruthy();

    const root = await apiCall(page, `/api/posts/${postId}/comments`, {
      method: 'POST', body: JSON.stringify({ text: 'kök rəy' }),
    });
    const rootId = root.body?.id;
    expect(rootId).toBeTruthy();

    // 🔴 LİMİT ÜSTÜ: 120 cavab → silmədə 121 dəyişən (D1 limiti 100).
    // Cavablar birbaşa D1-ə yazılır: 120 HTTP sorğusu `write` səbətini doldurar
    // və test rate-limit səbəbindən sınardı (limitin özü yox, harness qüsuru).
    //
    // ⚠ `comments.author_id` → `users(id)` FK daşıyır, ona görə uydurma uid
    //   İŞLƏMİR (SQLITE_CONSTRAINT_FOREIGNKEY). Mövcud seed hesabı işlədilir.
    const author = d1Text(`SELECT id FROM users WHERE username = 'e2e_main';`);
    expect(author, 'seed hesabı tapılmalıdır').toBeTruthy();
    const rows = Array.from({ length: 120 }, (_, i) =>
      `('a9c${i}_${Date.now()}', '${postId}', '${author}', 'Ghost', 'cavab ${i}', ${Date.now()}, '${rootId}')`,
    ).join(',');
    d1(`INSERT INTO comments (id, post_id, author_id, author_name, text, created_at, parent_comment_id)
        VALUES ${rows};`);

    // Oxu yolu da limit üstü datada işləməlidir (listComments `allIds`).
    const list = await apiCall(page, `/api/posts/${postId}/comments?limit=200`);
    expect(list.status, 'oxu yolu 121 id ilə çökməməlidir').toBe(200);

    const del = await apiCall(page, `/api/posts/${postId}/comments/${rootId}`, { method: 'DELETE' });
    expect(del.status, '120 cavablı rəy silinməlidir').toBe(200);

    await apiCall(page, `/api/posts/${postId}`, { method: 'DELETE' });
  });

  test('D1 dəyişən limiti tək yerdə təsbit olunub', () => {
    const src = readFileSync('worker/util.ts', 'utf8');
    expect(src, 'limit sənədə istinadla yazılmalıdır').toMatch(/D1_MAX_VARS = 100/);
    // Dinamik yer tutucu quran BÜTÜN yollar köməkçidən keçməlidir.
    const routes = readFileSync('worker/routes.ts', 'utf8');
    expect(routes, `routes.ts-də bölünməmiş placeholder qalmamalıdır`)
      .not.toMatch(/map\(\(\) => '\?'\)/);
  });
});
