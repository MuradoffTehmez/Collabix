#!/usr/bin/env node
// Collabix driver — Playwright-lə İŞLƏYƏN tətbiqi sürür (test dəsti yox, əsl app).
//
// İstifadə:
//   node .claude/skills/run-collabix/driver.mjs <əmr> [<əmr> ...]
//
// Əmrlər ardıcıl icra olunur, hər biri nəticəsini stdout-a yazır. Sonda
// toplanmış konsol xətaları + uğursuz sorğular çap olunur (çıxış kodu 1 olur
// yalnız bir əmr sınarsa; konsol xətası özü çıxış kodunu dəyişmir — `errors`
// əmri ilə açıq yoxlanılır).
//
// Niyə REPL yox, bir-atımlıq əmr siyahısı: Windows-da tmux yoxdur, agent üçün
// `node driver.mjs a b c` formatı stdin-ə fasiləsiz yazmaqdan sadədir. Sessiya
// əmrlər arasında brauzer kontekstində yaşayır — bir çağırışda login + naviqasiya
// + skrinşot zənciri qurulur.

import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots');

const BASE = process.env.COLLABIX_BASE || 'http://127.0.0.1:8788';
// Test hesabları e2e/seed.ts ilə eynidir — lokal D1 onsuz da onlarla doludur.
const USER = process.env.COLLABIX_USER || 'e2e_main';
const PASS = process.env.COLLABIX_PASS || 'Test12345!';
// Turnstile: server `--var TURNSTILE_SECRET:1x0000...AA` ("həmişə keçir") ilə
// qaldırıldığı üçün dəyər əhəmiyyətsizdir, amma BOŞ ola bilməz — server boş
// token-i siteverify-a çatmadan rədd edir.
const TURNSTILE = 'driver-dummy-token';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const cmds = argv.filter((a) => !a.startsWith('--'));

if (!cmds.length) {
  console.log(`Collabix driver — base=${BASE}

  login[:username]        API ilə giriş (cookie brauzer kontekstinə düşür)
  goto:<path>             naviqasiya; hash route-lar "/#home", "/#chat" ...
  ss:<ad>                 skrinşot → .claude/skills/run-collabix/shots/<ad>.png
  click:<selector>        klik
  fill:<selector>=><mətn> input doldur (ayırıcı "=>", CSS-dəki "=" ilə toqquşmasın)
  text:<selector>         elementin mətnini çap et
  count:<selector>        uyğun element sayı
  eval:<js>               səhifədə JS icra et, nəticəni çap et
  wait:<selector|ms>      selektoru və ya ms gözlə
  api:<METHOD> <path>[ <json>]   sessiya cookie-si ilə API çağırışı
  errors                  indiyə qədərki konsol xətaları + uğursuz sorğular
  quit                    (avtomatik) brauzeri bağla

Bayraqlar: --headed  --mobile  --keep (brauzeri açıq saxla)

Nümunə:
  node .claude/skills/run-collabix/driver.mjs login goto:/#home ss:feed errors`);
  process.exit(0);
}

mkdirSync(SHOTS, { recursive: true });

const consoleErrors = [];
const failedRequests = [];
let failures = 0;

const browser = await chromium.launch({ headless: !flags.has('--headed') });
const context = await browser.newContext({
  ...(flags.has('--mobile') ? devices['Pixel 7'] : devices['Desktop Chrome']),
  baseURL: BASE,
  // `--headed` olmayanda da real viewport lazımdır: responsive CSS breakpoint-ləri
  // skrinşotu tamamilə dəyişir.
  ...(flags.has('--mobile') ? {} : { viewport: { width: 1440, height: 900 } }),
});
// Təmiz brauzer profili HƏR DƏFƏ iki üst-qat alır: onboarding turu (modal,
// 1/5) və cookie banneri. İkisi də arxa fonu blur edir → skrinşot yararsız,
// klik-lər isə overlay-ə düşür. Hər ikisi yalnız localStorage açarına baxır,
// ona görə səhifə skriptlərindən ƏVVƏL onları qoymaq kifayətdir.
// `--tour` bayrağı ilə saxlanıla bilər (turun özünü test etmək üçün).
if (!flags.has('--tour')) {
  await context.addInitScript(() => {
    localStorage.setItem('collabix_onboarded', '1');
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
  });
}

const page = await context.newPage();

page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => {
  failedRequests.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`);
});
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.request().method()} ${r.url()}`);
});

const split1 = (s, sep) => {
  const i = s.indexOf(sep);
  // sep.length — bir simvol fərz etmək `=>` ayırıcısında dəyərin əvvəlinə
  // ">" buraxırdı.
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + sep.length)];
};

async function login(username) {
  const res = await context.request.post('/api/auth/login', {
    data: { username: username || USER, pass: PASS, turnstileToken: TURNSTILE },
  });
  if (!res.ok()) throw new Error(`login ${res.status()}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  // Cookie-lər artıq context-dədir (request context onu paylaşır). Səhifə
  // açılanda `watchAuthState` /api/auth/me çağırıb sessiyanı götürəcək.
  return `giriş OK: ${body.user?.username} (uid ${body.user?.uid?.slice(0, 8)}…)`;
}

async function run(cmd) {
  const [verb, arg] = split1(cmd, ':');
  switch (verb) {
    case 'login':
      return await login(arg);

    case 'goto': {
      const r = await page.goto(arg || '/', { waitUntil: 'domcontentloaded' });
      // SPA boot + ilk route() requestAnimationFrame-dədir → qısa nəfəs.
      await page.waitForTimeout(1200);
      return `goto ${arg} → ${r?.status()} | title="${await page.title()}"`;
    }

    case 'ss': {
      const file = join(SHOTS, `${arg || 'shot'}.png`);
      await page.screenshot({ path: file, fullPage: flags.has('--fullpage') });
      return `skrinşot → ${file}`;
    }

    case 'click':
      await page.locator(arg).first().click({ timeout: 10_000 });
      await page.waitForTimeout(600);
      return `klik ${arg}`;

    case 'fill': {
      // Ayırıcı `=>`, sadəcə `=` DEYİL: CSS selektorları özləri `=` saxlayır
      // (`[placeholder^="Markdown"]`) və ilk `=`-ə bölmək selektoru ortadan
      // qırırdı ("Unexpected token while parsing css selector").
      const [sel, val] = split1(arg, '=>');
      await page.locator(sel).first().fill(val);
      return `fill ${sel} = ${val}`;
    }

    case 'text':
      return `text ${arg} → ${JSON.stringify((await page.locator(arg).first().innerText()).slice(0, 400))}`;

    case 'count':
      return `count ${arg} → ${await page.locator(arg).count()}`;

    case 'eval':
      return `eval → ${JSON.stringify(await page.evaluate(arg), null, 0)?.slice(0, 800)}`;

    case 'wait':
      if (/^\d+$/.test(arg)) { await page.waitForTimeout(+arg); return `wait ${arg}ms`; }
      await page.locator(arg).first().waitFor({ timeout: 15_000 });
      return `wait ${arg} → göründü`;

    case 'api': {
      const [method, path, ...rest] = arg.split(' ');
      const body = rest.join(' ');
      const res = await context.request.fetch(path, {
        method: method.toUpperCase(),
        ...(body ? { data: JSON.parse(body), headers: { 'content-type': 'application/json' } } : {}),
      });
      return `api ${method} ${path} → ${res.status()} ${(await res.text()).slice(0, 500)}`;
    }

    case 'errors':
      return `konsol xətaları: ${consoleErrors.length}\n${consoleErrors.map((e) => '  ! ' + e).join('\n')}\n`
        + `uğursuz sorğular: ${failedRequests.length}\n${failedRequests.map((e) => '  ! ' + e).join('\n')}`;

    case 'quit':
      return 'quit';

    default:
      throw new Error(`naməlum əmr: ${cmd}`);
  }
}

for (const cmd of cmds) {
  try {
    console.log(`\n▶ ${cmd}`);
    console.log('  ' + String(await run(cmd)).replace(/\n/g, '\n  '));
  } catch (e) {
    failures++;
    console.log(`  ✖ ${e.message.split('\n')[0]}`);
  }
}

console.log(`\n── yekun ── əmr xətası: ${failures} | konsol xətası: ${consoleErrors.length} | uğursuz sorğu: ${failedRequests.length}`);
writeFileSync(join(SHOTS, 'last-run.json'), JSON.stringify({ consoleErrors, failedRequests }, null, 2));

if (!flags.has('--keep')) {
  await context.close();
  await browser.close();
}
process.exit(failures ? 1 : 0);
