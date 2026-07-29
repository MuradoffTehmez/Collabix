import { type Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { collectConsoleErrors, assertConsoleClean } from './helpers';
import { AUTH_FILE } from './seed';

// TASK-7 / Realtime — Mərhələ 2: canlı presence (qlobal PresenceDO).
// Yoxlanılan: WS upgrade + snapshot, çox-tab dublikat qorunması (eyni uid ikinci
// dəfə qoşulanda "on" yayılmır, biri bağlananda "off" yayılmır).

async function bootApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toHaveClass(/active/);
}

test.describe('Realtime presence (PresenceDO)', () => {

  test('WS qoşulur və snapshot öz uid-ini daxil edir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);

    const res = await page.evaluate(async () => {
      const me = await (await fetch('/api/auth/me')).json() as any;
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/api/presence/ws`);
      const first = await new Promise<string>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('snapshot timeout')), 8000);
        ws.onmessage = ev => { clearTimeout(to); resolve(String(ev.data)); };
        ws.onerror = () => { clearTimeout(to); reject(new Error('WS error')); };
      });
      ws.close();
      return { uid: me.user.uid as string, first };
    });

    const snap = JSON.parse(res.first);
    expect(snap.t).toBe('snapshot');
    expect(snap.uids, 'snapshot öz uid-ini daxil etməlidir').toContain(res.uid);
    assertConsoleClean(errors);
  });

  test('eyni uid-in ikinci tabı "on"/"off" dublikatı yaratmır', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);

    const got = await page.evaluate(async () => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${location.host}/api/presence/ws`;
      const open = (ws: WebSocket) => new Promise<void>((res, rej) => {
        const to = setTimeout(() => rej(new Error('open timeout')), 8000);
        ws.onopen = () => { clearTimeout(to); res(); };
        ws.onerror = () => { clearTimeout(to); rej(new Error('err')); };
      });

      const ws1 = new WebSocket(url);
      await open(ws1);
      const seen: string[] = [];
      // snapshot-dan SONRA gələnləri yığırıq (ilk mesaj öz snapshot-ıdır).
      let skippedSnapshot = false;
      ws1.onmessage = ev => {
        if (!skippedSnapshot) { skippedSnapshot = true; return; }
        seen.push(String(ev.data));
      };

      // Eyni istifadəçinin ikinci tabı → "on" YAYILMAMALIDIR.
      const ws2 = new WebSocket(url);
      await open(ws2);
      await new Promise(r => setTimeout(r, 1200));
      // İkinci tab bağlanır, birincisi hələ açıqdır → "off" YAYILMAMALIDIR.
      ws2.close();
      await new Promise(r => setTimeout(r, 1200));
      ws1.close();
      return seen;
    });

    const types = got.map(m => { try { return JSON.parse(m).t; } catch { return 'bad'; } });
    expect(types, 'eyni uid üçün on/off dublikatı yayılmamalıdır: ' + JSON.stringify(got))
      .not.toContain('on');
    expect(types).not.toContain('off');
    assertConsoleClean(errors);
  });
});
