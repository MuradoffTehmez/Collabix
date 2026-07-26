import { test, expect, type Page } from '@playwright/test';
import { AUTH_FILE, TEST_PASS, E2E_TURNSTILE, d1 } from './seed';

// TASK-8 / FAZA 5 / Bənd 13 — mesaj birbaşa WS → DO → broadcast → asinxron D1.
//
// Yoxlanan invariantlar:
//   1. Mesaj D1 yazısını GÖZLƏMƏDƏN yayımlanır (fan-out ani);
//   2. arxada D1-ə DÜŞÜR (persistence itmir);
//   3. eyni `cid` təkrar göndərilsə İKİNCİ nüsxə yaranmır (idempotentlik);
//   4. `seq` monoton artır (sıralama zəmanəti);
//   5. müəllif kimliyini client SAXTALAŞDIRA BİLMİR.
test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Protokol testi — viewport-dan asılı deyil, bir dəfə icra olunur');
});
test.use({ storageState: AUTH_FILE });

const ROOM = 'general';

async function openApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#chat', { waitUntil: 'networkidle' });
}

function countInD1(text: string): number {
  const safe = text.split("'").join("''");
  const raw = d1(`SELECT COUNT(*) AS n FROM room_messages WHERE text = '${safe}';`, true);
  const i = raw.indexOf('[');
  if (i < 0) return -1;
  try { return Number(JSON.parse(raw.slice(i))?.[0]?.results?.[0]?.n ?? -1); } catch { return -1; }
}

// Səhifə daxilində WS açır, çərçivələri göndərir və gələnləri toplayır.
async function wsSend(page: Page, frames: Array<Record<string, unknown>>, waitMs = 2500) {
  return page.evaluate(async ([roomId, msgs, wait]) => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/rooms/${roomId}/ws`);
    await new Promise<void>((res, rej) => {
      const to = setTimeout(() => rej(new Error('WS acilmadi')), 8000);
      ws.onopen = () => { clearTimeout(to); res(); };
      ws.onerror = () => { clearTimeout(to); rej(new Error('WS xetasi')); };
    });
    const seen: any[] = [];
    ws.onmessage = e => { try { seen.push(JSON.parse(String(e.data))); } catch { /* kec */ } };
    for (const m of msgs as any[]) ws.send(JSON.stringify(m));
    await new Promise(r => setTimeout(r, wait as number));
    ws.close();
    return seen;
  }, [ROOM, frames, waitMs] as const);
}

test.describe('WS → DO mesaj axını (Bənd 13)', () => {

  test('mesaj dərhal yayımlanır və arxada D1-ə yazılır', async ({ page }) => {
    await openApp(page);
    const text = `ws-axin-${Date.now()}`;

    const frames = await wsSend(page, [{ t: 'send', cid: 'cid-' + Date.now(), type: 'text', text }]);

    // 1) Fan-out — `msg` çərçivəsi göndərənin özünə də gəlir (optimistik
    //    sətri əvəz etmək üçün `cid` daşıyır).
    const msg = frames.find((f: any) => f.t === 'msg') as any;
    expect(msg, `msg çərçivəsi gəlmədi: ${JSON.stringify(frames)}`).toBeTruthy();
    expect(msg.text).toBe(text);
    expect(msg.id).toBeTruthy();
    expect(msg.seq).toBeGreaterThan(0);
    expect(msg.authorName).toBeTruthy();

    // 2) Persistence — `waitUntil` arxada işlədiyi üçün gözləyirik.
    await expect.poll(() => countInD1(text),
      { timeout: 15_000, message: 'mesaj D1-ə yazılmalıdır' }).toBe(1);
  });

  test('eyni cid təkrar göndərilsə ikinci nüsxə yaranmır', async ({ page }) => {
    await openApp(page);
    const text = `ws-idem-${Date.now()}`;
    const cid = 'idem-' + Date.now();

    // Eyni cid ilə iki dəfə — client yenidən qoşulub təkrar göndərmiş kimi.
    const frames = await wsSend(page, [
      { t: 'send', cid, type: 'text', text },
      { t: 'send', cid, type: 'text', text },
    ], 3000);

    const msgs = frames.filter((f: any) => f.t === 'msg' && f.text === text);
    const acks = frames.filter((f: any) => f.t === 'ack' && f.cid === cid);
    expect(msgs, 'yalnız BİR broadcast olmalıdır').toHaveLength(1);
    expect(acks.length, 'təkrar göndəriş ack ilə cavablanmalıdır').toBeGreaterThan(0);

    await expect.poll(() => countInD1(text), { timeout: 15_000 }).toBe(1);
  });

  test('seq monoton artır (sıralama zəmanəti)', async ({ page }) => {
    await openApp(page);
    const base = `ws-seq-${Date.now()}`;
    const frames = await wsSend(page, [0, 1, 2].map(i => ({
      t: 'send', cid: `${base}-c${i}`, type: 'text', text: `${base}-${i}`,
    })), 3000);

    const seqs = frames.filter((f: any) => f.t === 'msg' && String(f.text).startsWith(base))
      .map((f: any) => f.seq as number);
    expect(seqs.length).toBe(3);
    // DO tək-axınlıdır → sıra nömrələri artan olmalıdır.
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size, 'seq təkrarlanmamalıdır').toBe(3);
  });

  test('boş mesaj rədd olunur, heç nə yayımlanmır', async ({ page }) => {
    await openApp(page);
    const frames = await wsSend(page,
      [{ t: 'send', cid: 'bos-' + Date.now(), type: 'text', text: '   ' }], 1500);
    // Boş mətn `sanitize`-dan keçmir → `error` gəlir, `msg` gəlmir.
    expect(frames.some((f: any) => f.t === 'msg')).toBe(false);
    expect(frames.some((f: any) => f.t === 'error' && f.code === 'empty')).toBe(true);
  });

  test('kimliyi client SAXTALAŞDIRA BİLMİR (serverdən gəlir)', async ({ page }) => {
    await openApp(page);
    const text = `ws-spoof-${Date.now()}`;
    // Çərçivəyə saxta müəllif qoyuruq — DO onu NƏZƏRƏ ALMAMALIDIR.
    const frames = await wsSend(page, [{
      t: 'send', cid: 'spoof-' + Date.now(), type: 'text', text,
      authorUid: 'saxta-uid', authorName: 'Saxta Adam',
    }]);
    const msg = frames.find((f: any) => f.t === 'msg') as any;
    expect(msg).toBeTruthy();
    expect(msg.authorUid, 'uid soket kimliyindən gəlməlidir').not.toBe('saxta-uid');
    expect(msg.authorName).not.toBe('Saxta Adam');
  });
});

test.describe('Queues fan-out (Bənd 18)', () => {

  test('post yaradılışı izləyiciyə bildiriş göndərir', async ({ page, browser }) => {
    await openApp(page);

    // İkinci istifadəçi PRIMARY-ni izləyir.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p2 = await ctx.newPage();
    await p2.goto('/');
    const login = await p2.evaluate(async ([u, pw, ts]) => {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, pass: pw, turnstileToken: ts }),
      });
      return r.status;
      // ⚠ Follower `e2e_mfa` — SEEDED sıralama siyahısından KƏNAR hesab.
      // `e2e_dilara` (SEEDED) işlətsək, buradakı giriş onun `last_active_at`-ını
      // yeniləyib `users.spec` "son aktiv sıralaması" testini pozardı.
    }, ['e2e_mfa', TEST_PASS, E2E_TURNSTILE] as const);
    expect(login).toBe(200);

    const meUid = await page.evaluate(() =>
      fetch('/api/auth/me').then(r => r.json()).then(d => d.user.uid));
    await p2.evaluate(u => fetch('/api/follows/' + u, { method: 'PUT' }).then(r => r.status), meUid);

    // PRIMARY post yazır → növbə izləyiciyə bildiriş göndərməlidir.
    const marker = `queue-fanout-${Date.now()}`;
    const created = await page.evaluate(async m => {
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: [{ type: 'text', content: m }], tags: [] }),
      });
      return { status: r.status, body: await r.json() };
    }, marker);
    expect(created.status).toBe(200);

    // Fan-out ASİNXRONDUR — bildirişin gəlməsini gözləyirik. Məhz bu gözləmə
    // sübut edir ki, iş sorğu yolundan çıxarılıb.
    await expect.poll(async () => {
      const d = await p2.evaluate(() => fetch('/api/notifications').then(r => r.json()));
      return (d.notifications || []).some((n: any) => n.type === 'post');
    }, { timeout: 25_000, message: 'izləyiciyə "yeni paylaşım" bildirişi çatmalıdır' }).toBe(true);

    // Təmizlik.
    await page.evaluate(id => fetch('/api/posts/' + id, { method: 'DELETE' }), created.body.post.id);
    await p2.evaluate(u => fetch('/api/follows/' + u, { method: 'DELETE' }), meUid);
    await ctx.close();
  });
});
