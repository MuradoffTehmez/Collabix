import { test, expect, type Page } from '@playwright/test';
import { collectConsoleErrors, assertConsoleClean } from './helpers';
import { AUTH_FILE, TEST_PASS, E2E_TURNSTILE } from './seed';

// TASK-7 / Realtime — Mərhələ 3: bildiriş fan-out + canlı DM.
// İki ayrı sessiya lazımdır (notify() öz-özünə bildiriş göndərmir), ona görə
// ikinci kontekst `e2e_zara` kimi giriş edir və qlobal PresenceDO-ya qoşulur.
// Yoxlanılan yol: primary DM göndərir → worker userPush → zara-nın soketi
// {t:'dm'} + {t:'notif'} alır.
test.use({ storageState: AUTH_FILE });

const RECIPIENT = 'e2e_zara';

async function bootApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toHaveClass(/active/);
}

test.describe('Realtime DM + bildiriş fan-out', () => {

  test('DM göndərişi alıcının soketinə dm + notif siqnalı çatdırır', async ({ page, browser, baseURL }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);

    // --- Alıcı sessiyası (ayrı kontekst, öz cookie-si) ---
    const rcvCtx = await browser.newContext({ baseURL });
    const rcvPage = await rcvCtx.newPage();
    await rcvPage.goto('/', { waitUntil: 'domcontentloaded' });
    const loggedIn = await rcvPage.evaluate(async ([user, pass, tsToken]) => {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, pass, turnstileToken: tsToken }),
      });
      return r.ok;
    }, [RECIPIENT, TEST_PASS, E2E_TURNSTILE]);
    expect(loggedIn, 'alıcı hesaba giriş alınmadı').toBeTruthy();

    try {
      // Alıcı presence WS açır və siqnalları yığmağa başlayır.
      const collecting = rcvPage.evaluate(async () => {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${location.host}/api/presence/ws`);
        await new Promise<void>((res, rej) => {
          const to = setTimeout(() => rej(new Error('WS open timeout')), 8000);
          ws.onopen = () => { clearTimeout(to); res(); };
          ws.onerror = () => { clearTimeout(to); rej(new Error('WS error')); };
        });
        const seen: string[] = [];
        ws.onmessage = ev => seen.push(String(ev.data));
        await new Promise(r => setTimeout(r, 6000));
        ws.close();
        return seen;
      });

      // Soket qalxsın deyə qısa gözləmə, sonra primary DM göndərir.
      await page.waitForTimeout(1500);
      const sent = await page.evaluate(async (uname) => {
        const list = await (await fetch('/api/users')).json() as any;
        const target = list.users.find((u: any) => u.username === uname);
        if (!target) return { ok: false, why: 'alıcı tapılmadı' };
        const r = await fetch('/api/dms/to/' + target.uid, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'text', text: 'Realtime DM ' + Date.now() }),
        });
        return { ok: r.ok, why: String(r.status) };
      }, RECIPIENT);
      expect(sent.ok, 'DM göndərilmədi: ' + sent.why).toBeTruthy();

      const seen = await collecting;
      const types = seen.map(m => { try { return JSON.parse(m).t; } catch { return 'bad'; } });
      expect(types, 'alıcı dm siqnalı almadı: ' + JSON.stringify(seen)).toContain('dm');
      expect(types, 'alıcı notif siqnalı almadı: ' + JSON.stringify(seen)).toContain('notif');

      // dm siqnalı hər iki tərəfin gördüyü pairId-ni daşımalıdır.
      const dmSig = seen.map(m => { try { return JSON.parse(m); } catch { return null; } })
        .find(d => d && d.t === 'dm');
      expect(dmSig.pairId, 'pairId siqnalda yoxdur').toBeTruthy();
      expect(String(dmSig.pairId)).toContain('_');
    } finally {
      await rcvCtx.close();
    }

    assertConsoleClean(errors);
  });

  test('göndərənin öz tabları da dm siqnalı alır (çox-tab sinxronu)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);

    const seen = await page.evaluate(async (uname) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/api/presence/ws`);
      await new Promise<void>((res, rej) => {
        const to = setTimeout(() => rej(new Error('WS open timeout')), 8000);
        ws.onopen = () => { clearTimeout(to); res(); };
        ws.onerror = () => { clearTimeout(to); rej(new Error('WS error')); };
      });
      const out: string[] = [];
      ws.onmessage = ev => out.push(String(ev.data));

      const list = await (await fetch('/api/users')).json() as any;
      const target = list.users.find((u: any) => u.username === uname);
      await fetch('/api/dms/to/' + target.uid, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', text: 'Öz-tab sinxron ' + Date.now() }),
      });
      await new Promise(r => setTimeout(r, 2500));
      ws.close();
      return out;
    }, RECIPIENT);

    const types = seen.map(m => { try { return JSON.parse(m).t; } catch { return 'bad'; } });
    expect(types, 'göndərən öz dm siqnalını almadı: ' + JSON.stringify(seen)).toContain('dm');
    // Öz-özünə bildiriş YARANMAMALIDIR (notify() göndərəni istisna edir).
    expect(types, 'göndərən özünə notif almamalıdır').not.toContain('notif');
    assertConsoleClean(errors);
  });
});
