import { test, expect, type Page } from '@playwright/test';
import { collectConsoleErrors, assertConsoleClean } from './helpers';
import { AUTH_FILE } from './seed';

// TASK-7 / Realtime (RoomDO + WebSocket) — Mərhələ 1: canlı otaq mesajı + typing.
// wrangler dev DO-nu lokal işlədir → tam yol (upgrade → broadcast) yoxlanılır.
test.use({ storageState: AUTH_FILE });

async function bootApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toHaveClass(/active/);
}

test.describe('Realtime otaq (RoomDO)', () => {

  test('WS qoşulur, otağa mesaj → refresh broadcast gəlir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);

    const got = await page.evaluate(async () => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/api/rooms/general/ws`);
      await new Promise<void>((res, rej) => {
        const to = setTimeout(() => rej(new Error('WS open timeout')), 8000);
        ws.onopen = () => { clearTimeout(to); res(); };
        ws.onerror = () => { clearTimeout(to); rej(new Error('WS error')); };
      });
      const received: string[] = [];
      ws.onmessage = ev => received.push(String(ev.data));
      // Mesaj göndər → server DO-ya 'refresh' broadcast etməlidir.
      await fetch('/api/rooms/general/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', text: 'WS realtime ' + Date.now() }),
      });
      await new Promise(r => setTimeout(r, 2500));
      ws.close();
      return received;
    });

    expect(got.some(m => { try { return JSON.parse(m).t === 'refresh'; } catch { return false; } }),
      'refresh broadcast gəlmədi: ' + JSON.stringify(got)).toBeTruthy();
    assertConsoleClean(errors);
  });

  test('typing broadcast göndərəni istisna edib başqalarına çatır', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);

    const got = await page.evaluate(async () => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${location.host}/api/rooms/general/ws`;
      const ws1 = new WebSocket(url);
      const ws2 = new WebSocket(url);
      await Promise.all([ws1, ws2].map(ws => new Promise<void>((res, rej) => {
        const to = setTimeout(() => rej(new Error('open timeout')), 8000);
        ws.onopen = () => { clearTimeout(to); res(); };
        ws.onerror = () => { clearTimeout(to); rej(new Error('err')); };
      })));
      const on1: string[] = []; const on2: string[] = [];
      ws1.onmessage = ev => on1.push(String(ev.data));
      ws2.onmessage = ev => on2.push(String(ev.data));
      ws1.send(JSON.stringify({ t: 'typing' }));
      await new Promise(r => setTimeout(r, 1500));
      ws1.close(); ws2.close();
      return { on1, on2 };
    });

    const isTyping = (m: string) => { try { return JSON.parse(m).t === 'typing'; } catch { return false; } };
    expect(got.on2.some(isTyping), 'ws2 typing almadı: ' + JSON.stringify(got.on2)).toBeTruthy();
    expect(got.on1.some(isTyping), 'göndərən ws1 öz typing-ini almamalıdır').toBeFalsy();
    assertConsoleClean(errors);
  });
});
