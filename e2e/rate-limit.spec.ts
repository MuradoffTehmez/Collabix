// AUDIT-TASK-4 / H-4 — rate limit əhatəsi və xəta kodu ardıcıllığı.
//
// ⚠ İZOLYASİYA (AUDIT-TASK-4 §4.8 / AUDIT-TASK-3-REPORT §8/1):
// Rate limit testi paylaşılan `AUTH_FILE` uid-ini limitə salsaydı, EYNİ uid ilə
// işləyən bütün digər spec-lər 429 alardı və dəst kütləvi şəkildə sınardı.
// Ona görə limiti dolduran testlər HƏR DƏFƏ YENİ hesab qeydiyyatdan keçirir —
// açar `uid` üzrə olduğuna görə (§4.5) sayğac yalnız həmin hesaba aiddir.
//
// Testlər `@ratelimit` teqi ilə işarələnib: `--grep @ratelimit` /
// `--grep-invert @ratelimit` ilə əsas dəstdən təcrid oluna bilər.
import { test, expect, type Page, type Browser } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_PASS, E2E_TURNSTILE } from './seed';
import { RL } from '../worker/auth';

test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Protokol/konfiq testi — viewport-dan asılı deyil, bir dəfə icra olunur');
});

/* ══════════════ A. Konfiqurasiya və əhatə invariantları ══════════════ */

test.describe('AUDIT H-4 — səbət konfiqurasiyası', () => {
  test('BÜTÜN route-lar açıq rl bayrağı daşıyır (limitsiz route qalmayıb)', () => {
    // Meyar 3. Bu, `grep`-lə əl ilə yoxlanan şərtin maşın təsbitidir: audit
    // 171 route-dan 107-sinin limitsiz olduğunu tapmışdı.
    const src = readFileSync('worker/index.ts', 'utf8').split('\n');
    const routes = src.filter(l => l.includes('pattern:') && l.includes('handler:'));
    const withoutRl = routes.filter(l => !l.includes('rl:'));

    expect(routes.length, 'route cədvəli boşalmamalıdır').toBeGreaterThan(150);
    expect(withoutRl, `rl-siz route:\n${withoutRl.join('\n')}`).toHaveLength(0);
  });

  test('istisna yalnız AÇIQ ola bilər — sükutla limitsiz route yoxdur', () => {
    // `rl: 'none'` istisnası kod baxışında görünməlidir. Hazırda heç bir route
    // istisna deyil; əlavə olunarsa yanında əsaslandırma şərhi tələb olunur.
    const src = readFileSync('worker/index.ts', 'utf8').split('\n');
    const exceptions = src.filter(
      l => l.includes('pattern:') && l.includes('handler:') && l.includes("rl: 'none'"),
    );
    expect(exceptions).toHaveLength(0);
  });

  test('🔴 AI endpoint saatda 20 çağırışla məhdudlaşır', () => {
    // DONE şərti. Workers AI çağırışı REAL PUL olduğu üçün limit protokol
    // testi ilə DOLDURULMUR (21 çağırış = 21 ödənişli sorğu) — əvəzində
    // konfiqurasiya və route təsnifatı təsbit olunur.
    expect(RL.ai.limit).toBe(20);
    expect(RL.ai.windowSec).toBe(3600);

    const src = readFileSync('worker/index.ts', 'utf8');
    const aiRoutes = src.split('\n').filter(l => l.includes('pattern:') && /\\\/ai\\\//.test(l));
    expect(aiRoutes.length, 'AI route-ları tapılmalıdır').toBeGreaterThan(0);
    for (const line of aiRoutes) expect(line, line.trim()).toContain("rl: 'ai'");
  });

  test('Vectorize/embedding yolları ayrıca `search` səbətindədir', () => {
    const src = readFileSync('worker/index.ts', 'utf8');
    expect(src).toMatch(/search\\\/semantic\$\/[^\n]*rl: 'search'/);
    expect(RL.search.windowSec).toBe(3600);
  });

  test('presence limiti normal polling tezliyini KƏSMİR', () => {
    // Ölçmə (§4.0/Sual 6): heartbeat POST 30s + izləmə GET 30s
    // = 5 dəqiqəlik pəncərədə 20 sorğu. Auditin təklifi 60 idi — cəmi 3 tab.
    const pollsPerWindow = (RL.presence.windowSec / 30) * 2;
    expect(pollsPerWindow).toBe(20);
    expect(RL.presence.limit).toBeGreaterThanOrEqual(pollsPerWindow * 5);   // ≥5 tab
  });

  test('read limiti ən yüklü real profilin üstündədir', () => {
    // Ən yüklü TƏK tab ≈ 44 sorğu/dəq; 4 tab ≈ 180. Auditin təklifi 300 idi.
    expect(RL.read.limit).toBeGreaterThanOrEqual(500);
    expect(RL.read.windowSec).toBe(60);
  });

  test('səbət taksonomiyası: təhlükəsizlik vs xərc sinfi işarələnib', () => {
    // §4.1 — H-3 (atomik olmayan limiter) hansı səbətlərə TOXUNUR sualının
    // cavabı koddan oxunmalıdır, şərhdən deyil.
    for (const b of ['auth', 'refresh', 'upload'] as const) {
      expect(RL[b].critical, `${b} təhlükəsizlik kontroludur`).toBe(true);
    }
    for (const b of ['read', 'write', 'ai', 'presence', 'admin', 'heavy', 'asset'] as const) {
      expect(RL[b].critical, `${b} xərc qoruyucusudur`).toBe(false);
    }
  });

  test('login/qeydiyyat açarı IP üzrədir, qalanları uid üzrə', () => {
    // §4.5 — login zamanı uid HƏLƏ MƏLUM DEYİL; uid üzrə açarlamaq həmin
    // səbətdə brute-force qorumasını tamamilə söndürərdi.
    expect(RL.auth.key).toBe('ip');
    expect(RL.refresh.key).toBe('ip');
    expect(RL.form.key).toBe('ip');
    // NAT arxasındakı istifadəçilər bir-birini bloklamamalıdır.
    for (const b of ['read', 'write', 'ai', 'presence', 'admin', 'heavy', 'asset'] as const) {
      expect(RL[b].key, `${b} uid üzrə açarlanmalıdır`).toBe('auto');
    }
  });
});

/* ══════════════ B. Protokol testləri ══════════════ */

async function apiCall(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(async ([p, i]) => {
    const opts = i as RequestInit;
    if (opts.body) opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const r = await fetch(p as string, opts);
    let body: any = null;
    try { body = await r.json(); } catch { /* gövdəsiz cavab */ }
    return { status: r.status, ok: r.ok, body, retryAfter: r.headers.get('Retry-After') };
  }, [path, init] as const);
}

/** N ardıcıl sorğu göndərir və YALNIZ status kodlarını qaytarır (gövdə oxunmur). */
async function burst(page: Page, path: string, count: number): Promise<number[]> {
  return page.evaluate(async ([p, n]) => {
    const out: number[] = [];
    for (let i = 0; i < (n as number); i++) {
      const r = await fetch(p as string);
      // Axın cavabları (məs. /me/export) gövdəsi oxunmasa asılı qalır.
      try { await r.body?.cancel(); } catch { /* gövdəsiz cavab */ }
      out.push(r.status);
    }
    return out;
  }, [path, count] as const);
}

/**
 * HƏR ÇAĞIRIŞDA yeni hesab yaradır — limit sayğacı yalnız bu hesaba aid olur.
 * Paylaşılan `AUTH_FILE` sessiyası QƏSDƏN istifadə edilmir (§4.8/1).
 */
async function freshUser(browser: Browser, label: string) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/');

  const username = `rl_${label}_${Date.now().toString(36)}`;
  const reg = await apiCall(page, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      turnstileToken: E2E_TURNSTILE,
      username, pass: TEST_PASS, name: 'Rate Limit Tester', age: 25,
      birthDate: '2000-01-01', gender: 'k', country: 'Azərbaycan', city: 'Bakı',
      bio: 'AUDIT-TASK-4 test hesabı', progLevels: { Python: 'Orta' },
      langLevels: {}, lookingFor: ['Study partner'],
    }),
  });
  expect(reg.status, `${username} qeydiyyatı`).toBe(200);
  return { ctx, page, username };
}

test.describe('AUDIT H-4 — rate limit davranışı @ratelimit', () => {
  // Serial: testlər eyni iki hesabı ardıcıl istifadə edir — `victim` qəsdən
  // limitə salınır və sonrakı testlər həmin vəziyyətdən istifadə edir.
  test.describe.configure({ mode: 'serial' });

  // Cəmi İKİ qeydiyyat: `auth` səbəti IP üzrədir (§4.5) və bütün E2E trafiki
  // 127.0.0.1-dən gəlir — hər test üçün yeni hesab açsaydıq dəstin qalan
  // hissəsinin giriş/qeydiyyat büdcəsini yeyərdik.
  let clean: Awaited<ReturnType<typeof freshUser>>;    // heç vaxt limitə salınmır
  let victim: Awaited<ReturnType<typeof freshUser>>;   // `heavy` səbəti doldurulur

  test.beforeAll(async ({ browser }, testInfo) => {
    if (testInfo.project.name !== 'desktop') return;
    clean = await freshUser(browser, 'clean');
    victim = await freshUser(browser, 'victim');
  });

  test.afterAll(async () => {
    await clean?.ctx.close();
    await victim?.ctx.close();
  });

  /* ─── 🔴 REQRESSİYA — ən vacib test (meyar 1) ─── */
  test('normal istifadəçi axını 429 ALMIR', async () => {
    const page = clean.page;
    {
      // Ən yüklü real profil ölçüldü: tək tab ≈ 44 sorğu/dəq (§4.0/Sual 6).
      // Burada həmin sorğular BİR DƏFƏYƏ, fasiləsiz göndərilir — yəni real
      // istifadədən qat-qat sıx. 429 çıxarsa limitlər çox aşağıdır.
      const flow = [
        '/api/auth/me', '/api/config', '/api/feed', '/api/users',
        '/api/notifications', '/api/presence', '/api/rooms', '/api/dms',
        '/api/tasks?scope=approved', '/api/teams', '/api/invites',
      ];
      const statuses: number[] = [];
      for (let round = 0; round < 12; round++) {
        for (const p of flow) statuses.push((await apiCall(page, p)).status);
      }

      expect(statuses.length).toBeGreaterThanOrEqual(120);
      expect(statuses.filter(s => s === 429), 'normal axın 429 almamalıdır').toHaveLength(0);
    }
  });

  test('presence heartbeat dövrəsi 429 almır', async () => {
    // 5 dəqiqəlik pəncərədə real dövrə 20 sorğudur; burada 40 göndərilir.
    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) {
      statuses.push((await apiCall(clean.page, '/api/presence', { method: 'POST' })).status);
      statuses.push((await apiCall(clean.page, '/api/presence')).status);
    }
    expect(statuses.filter(s => s === 429)).toHaveLength(0);
  });

  test('/files/* asset axını kəsilmir', async () => {
    // Meyar 9. Bir feed səhifəsi 20+ obyekt çəkir; 50 ardıcıl sorğu
    // `asset` səbətinə (1200/dəq) toxunmamalıdır.
    // Fayl mövcud olmaya bilər (404) — yoxlanan şey LİMİTİN kəsməməsidir.
    const statuses = await burst(clean.page, '/files/audit-task-4-yoxdur.png', 50);
    expect(statuses).toHaveLength(50);
    expect(statuses.filter(s => s === 429), 'asset axını 429 almamalıdır').toHaveLength(0);
  });

  /* ─── 4.7 — admin xətasının maşın kodu (meyar 12) ─── */
  test('admin 403-ü code:forbidden daşıyır', async () => {
    for (const p of ['/api/admin/users', '/api/admin/logs', '/api/admin/teams']) {
      const res = await apiCall(clean.page, p);
      expect(res.status, p).toBe(403);
      expect(res.body?.code, p).toBe('forbidden');
    }
  });

  /* ─── Əhatə: əvvəl limitsiz olan route indi limitlidir ─── */
  test('əvvəl limitsiz olan bahalı route limitə düşür və 429 verir', async () => {
    // `GET /api/me/export` auditdən əvvəl LİMİTSİZ idi. İndi `heavy`
    // səbətindədir (20/saat; test mühitində uid üzrə 5× = 100).
    const statuses = await burst(victim.page, '/api/me/export?format=json', 110);

    expect(statuses.indexOf(429), 'limit hardasa dolmalıdır').toBeGreaterThan(0);
    expect(statuses[statuses.length - 1], 'limitdən sonra 429 davam edir').toBe(429);
    // İlk sorğular keçməlidir — limit sıfırdan bloklamır.
    expect(statuses.slice(0, 20).every(s => s !== 429)).toBeTruthy();
  });

  /* ─── Cavab forması (meyar 10, 11) ─── */
  test('429 cavabı Retry-After başlığı və code:rate_limited daşıyır', async () => {
    // `victim` əvvəlki testdə limitə salınıb (serial rejim sıranı təmin edir).
    const limited = await apiCall(victim.page, '/api/me/export?format=json');

    expect(limited.status).toBe(429);
    expect(limited.body?.code).toBe('rate_limited');
    expect(limited.retryAfter, 'Retry-After başlığı olmalıdır').toBeTruthy();
    const sec = Number(limited.retryAfter);
    expect(Number.isFinite(sec)).toBeTruthy();
    expect(sec).toBeGreaterThan(0);
    expect(sec).toBeLessThanOrEqual(RL.heavy.windowSec);
  });

  /* ─── İzolyasiya (meyar 13) — açar strategiyasının sübutu ─── */
  test('bir istifadəçinin limiti digərini TƏSİR ETMİR', async () => {
    // `victim` limitdədir. `clean` EYNİ IP-dən (127.0.0.1) gəlir — açar IP üzrə
    // olsaydı o da kəsilərdi. Korporativ NAT arxasındakı istifadəçilər üçün
    // eyni ssenaridir (§4.5).
    expect((await apiCall(victim.page, '/api/me/export?format=json')).status).toBe(429);
    expect((await apiCall(clean.page, '/api/me/export?format=json')).status,
      'ikinci istifadəçi normal işləməlidir').not.toBe(429);
  });
});
