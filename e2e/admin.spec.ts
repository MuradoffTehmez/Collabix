import { type Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { collectConsoleErrors, assertConsoleClean, apiGet } from './helpers';
import { AUTH_FILE } from './seed';

// TASK-6 / BÖLMƏ 3 — Admin paneli (11 bənd; #12 real-time DO fazasındadır).

async function openAdmin(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#admin', { waitUntil: 'networkidle' });
  await expect(page.locator('#page-admin')).toHaveClass(/active/);
  await expect(page.locator('#adminStatRow .stat-card').first()).toBeVisible();
}

/**
 * Admin paneli SIDEBAR TAB-larına bölünüb (`index.html` → `.admin-sidebar-btn`
 * + `.admin-tab-pane`). Yalnız `#tab-dashboard` açılışda aktivdir; qalan
 * panellərin məzmunu DOM-dadır, lakin `.active` sinfi olmadan GÖRÜNMÜR.
 *
 * ⚠ Bu testlər əvvəl tək-səhifəlik admin dizaynına yazılmışdı və panel
 * yenidən qurulduqdan sonra yenilənməmişdi — 40-a yaxın test məhz buna görə
 * "element var, amma hidden" xətası ilə sınırdı (tətbiqdə qüsur YOX idi).
 */
async function openTab(page: Page, tab: 'tab-dashboard' | 'tab-threats' | 'tab-content'
  | 'tab-teams' | 'tab-users' | 'tab-logs') {
  await page.locator(`.admin-sidebar-btn[data-tab="${tab}"]`).click();
  await expect(page.locator('#' + tab)).toHaveClass(/active/);
}

/**
 * Taksonomiya `#tab-content` daxilində AYRICA `<details class="admin-accordion">`
 * blokundadır və default olaraq BAĞLIDIR — tab açmaq kifayət etmir.
 */
async function openTaxonomyAccordion(page: Page) {
  const acc = page.locator('details.admin-accordion').filter({ has: page.locator('#taxList') });
  if (!(await acc.evaluate((d: HTMLDetailsElement) => d.open))) {
    await acc.locator('summary').click();
  }
  await expect(page.locator('#taxList')).toBeVisible();
}

test.describe('Admin paneli', () => {

  test('yüklənir, sıfır konsol xətası', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await openAdmin(page);
    await openTab(page, 'tab-users');
    await expect(page.locator('#adminUserList .admin-user-row').first()).toBeVisible();
    assertConsoleClean(errors);
  });

  // #1 — semantik rəng kodlaması.
  test('#1 xülasə kartları semantik rənglidir', async ({ page }) => {
    await openAdmin(page);
    const cards = page.locator('#adminStatRow .adm-stat');
    await expect(cards).toHaveCount(5);
    // hər kart öz tonunu daşıyır
    for (const tone of ['info', 'danger', 'warn', 'alert', 'ok']) {
      await expect(page.locator(`#adminStatRow .tone-${tone}`)).toHaveCount(1);
    }
    // rəng TƏK siqnal olmamalıdır — hər kartda mətn etiketi var
    for (let i = 0; i < 5; i++) {
      await expect(cards.nth(i).locator('.lbl')).not.toBeEmpty();
    }
    // sol kənar rəngi həqiqətən fərqlidir
    const colors = await cards.evaluateAll(els =>
      els.map(e => getComputedStyle(e).borderLeftColor));
    expect(new Set(colors).size).toBeGreaterThan(3);
  });

  // #2 — ripple.
  test('#2 quick-action düymələrində ripple var', async ({ page }) => {
    await openAdmin(page);
    const btn = page.locator('#quickRoomsBtn');
    await expect(btn).toHaveClass(/has-ripple/);

    // Dalğa elementi animasiya bitəndə silinir — klikdən dərhal sonra
    // yaranmasını mutasiya müşahidəsi ilə tuturuq (yarışa düşməmək üçün).
    const appeared = await page.evaluate(() => new Promise<boolean>(resolve => {
      const b = document.getElementById('quickRoomsBtn')!;
      const mo = new MutationObserver(() => {
        if (b.querySelector('.ripple-ink')) { mo.disconnect(); resolve(true); }
      });
      mo.observe(b, { childList: true });
      b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
      setTimeout(() => { mo.disconnect(); resolve(false); }, 1000);
    }));
    expect(appeared, 'klikdə ripple elementi yaranmadı').toBeTruthy();

    // #9 — otaqlar MODAL-da açılır, səhifə dəyişmir
    await expect(page.locator('#modalBg')).toHaveClass(/active/);
    await expect(page.locator('#page-admin')).toHaveClass(/active/);
  });

  // #3 — taksonomiya sıralaması: klaviatura alternativi (DnD-nin accessible qarşılığı).
  test('#3 taksonomiya ↑/↓ ilə sıralanır və serverdə saxlanılır', async ({ page }) => {
    await openAdmin(page);
    await openTab(page, 'tab-content');
    await openTaxonomyAccordion(page);
    const rows = page.locator('#taxList .tax-row');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toHaveAttribute('draggable', 'true');

    const before = await rows.evaluateAll(els => els.map(e => (e as HTMLElement).dataset.id));
    expect(before.length).toBeGreaterThan(2);

    const req = page.waitForRequest(r =>
      r.url().includes('/reorder') && r.method() === 'POST');
    await rows.nth(1).locator('.tax-move-up').click();
    await req;

    const after = await rows.evaluateAll(els => els.map(e => (e as HTMLElement).dataset.id));
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);

    // yenidən açanda sıra qorunur (serverdə yazılıb)
    await page.reload({ waitUntil: 'networkidle' });
    await openTab(page, 'tab-content');
    await openTaxonomyAccordion(page);
    await expect(page.locator('#taxList .tax-row').first()).toBeVisible();
    const persisted = await page.locator('#taxList .tax-row')
      .evaluateAll(els => els.map(e => (e as HTMLElement).dataset.id));
    expect(persisted[0]).toBe(before[1]);
  });

  // #4 — siyahı filtri (serverdə WHERE).
  test('#4 istifadəçi filtri serverə gedir', async ({ page }) => {
    await openAdmin(page);
    await openTab(page, 'tab-users');
    const req = page.waitForRequest(r =>
      r.url().includes('/api/admin/users') && r.url().includes('filter=blocked'));
    await page.locator('#adminUserFilter').selectOption('blocked');
    await req;

    // axtarış da serverə gedir
    const req2 = page.waitForRequest(r =>
      r.url().includes('/api/admin/users') && r.url().includes('q=zara'));
    await page.locator('#adminUserFilter').selectOption('');
    await page.locator('#adminUserSearch').fill('zara');
    await req2;
    await expect(page.locator('#adminUserList .admin-user-row')).toHaveCount(1);
  });

  // #5 — toplu əməliyyatlar.
  test('#5 bulk blok/blokdan çıxarma işləyir', async ({ page }) => {
    await openAdmin(page);
    await openTab(page, 'tab-users');
    await page.locator('#adminUserSearch').fill('dilara');
    await expect(page.locator('#adminUserList .admin-user-row')).toHaveCount(1);

    const bar = page.locator('#adminBulkBar');
    await expect(bar).toBeHidden();
    await page.locator('#adminUserList .row-check').first().check();
    await expect(bar).toBeVisible();
    await expect(page.locator('#adminBulkCount')).toContainText('1');

    // blokla → təsdiq dialoqu
    await page.locator('#adminBulkBlock').click();
    await expect(page.locator('#modalBg')).toHaveClass(/active/);
    await page.locator('#modalCard .btn-danger').click();

    await expect(page.locator('#adminUserList .admin-user-row.is-blocked')).toHaveCount(1);

    // geri qaytar (test təkrar işləyə bilsin)
    await page.locator('#adminUserList .row-check').first().check();
    await page.locator('#adminBulkUnblock').click();
    await page.locator('#modalCard button').filter({ hasText: /Blokdan|Bəli/ }).first().click();
    await expect(page.locator('#adminUserList .admin-user-row.is-blocked')).toHaveCount(0);
  });

  test('#5 admin özünü seçə bilmir', async ({ page }) => {
    await openAdmin(page);
    await openTab(page, 'tab-users');
    await page.locator('#adminUserSearch').fill('e2e_main');
    const row = page.locator('#adminUserList .admin-user-row').first();
    await expect(row).toBeVisible();
    // öz sətrində checkbox olmamalıdır
    await expect(row.locator('.row-check')).toHaveCount(0);
  });

  // #6 — jurnal.
  //
  // ⚠ UI DƏYİŞİB: jurnal əvvəl "terminal" görünüşü idi (`#adminLogTerm`,
  // `.term-head`, `.log-line`, `.lvl-*`, `.tl-lvl`, monospace şrift). İndi
  // `<table class="admin-table">` daxilində sətirlərdir və səviyyə `<span
  // class="badge badge-{lvl}">` nişanı ilə göstərilir (`js/admin.js` → `logLine`).
  // Testin NİYYƏTİ dəyişmir: hər səviyyə öz sinfi ilə render olunur, rənglər
  // bir-birindən fərqlidir və filtr serverdə işləyir.
  test('#6 jurnal cədvəldə səviyyəyə görə nişanlanır', async ({ page }) => {
    await openAdmin(page);
    await openTab(page, 'tab-logs');

    const body = page.locator('#adminLogList');
    await expect(body.locator('tr').first()).toBeVisible();

    // Hər səviyyə öz sinfi ilə render olunur. Filtrdən keçirik, çünki jurnal
    // səhifələnir və testlərin özü yeni sətrlər yaradır — seed sətrləri ilk
    // səhifədə qalacağına arxalanmaq olmaz (test sırasından asılı olardı).
    const colors: Record<string, string> = {};
    for (const lvl of ['error', 'warning', 'success', 'info']) {
      const res = page.waitForResponse(r =>
        r.url().includes('/api/admin/logs') && r.url().includes('level=' + lvl) && r.status() === 200);
      await page.locator('#adminLogLevel').selectOption(lvl);
      await res;
      await expect(body.locator(`.badge-${lvl}`).first()).toBeVisible();
      // seçilmiş səviyyədən başqa nişan qalmır
      await expect.poll(() => body.locator(`.badge:not(.badge-${lvl})`).count()).toBe(0);
      colors[lvl] = await body.locator(`.badge-${lvl}`).first()
        .evaluate(e => getComputedStyle(e).color);
    }
    // error / warning / success bir-birindən fərqli rəngdədir (semantik kodlama)
    expect(new Set([colors.error, colors.warning, colors.success]).size).toBe(3);
  });

  test('#6 səviyyə filtri serverdə işləyir', async ({ page }) => {
    await openAdmin(page);
    await openTab(page, 'tab-logs');
    // Cavabı gözləyirik, sorğunu yox: waitForRequest sorğu GÖNDƏRİLƏNDƏ həll olur,
    // DOM isə yalnız cavab gəldikdən sonra yenilənir.
    const res = page.waitForResponse(r =>
      r.url().includes('/api/admin/logs') && r.url().includes('level=error') && r.status() === 200);
    await page.locator('#adminLogLevel').selectOption('error');
    await res;

    await expect(page.locator('#adminLogList .badge-error').first()).toBeVisible();
    // yalnız error sətrləri qalır (render tamamlanana qədər poll)
    await expect
      .poll(() => page.locator('#adminLogList .badge:not(.badge-error)').count())
      .toBe(0);
  });

  test('#6 jurnal kopyalanır', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard icazəsi yalnız chromium-da');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openAdmin(page);
    await openTab(page, 'tab-logs');
    await expect(page.locator('#adminLogList tr').first()).toBeVisible();
    await page.locator('#adminLogCopy').click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/ERROR|WARNING|SUCCESS|INFO/);
  });

  // #7 — açılışda skeleton (spinner/boş ekran yerinə).
  test('#7 yüklənmə zamanı skeleton göstərilir', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
      localStorage.setItem('collabix_onboarded', '1');
    });
    // Siyahı sorğusunu ləngidirik ki, aralıq vəziyyət tutula bilsin.
    await page.route('**/api/admin/users*', async route => {
      await new Promise(r => setTimeout(r, 1200));
      await route.continue();
    });
    await page.goto('/#admin');
    // Skeleton `#adminUserList`-dədir → tab dərhal açılmalıdır ki, aralıq
    // vəziyyət (1200 ms ləngimə pəncərəsi) tutula bilsin.
    await page.locator('.admin-sidebar-btn[data-tab="tab-users"]').click();
    await expect(page.locator('#adminUserList .skeleton').first()).toBeVisible();
    // sonra əsl məzmun gəlir və skeleton yox olur
    await expect(page.locator('#adminUserList .admin-user-row').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#adminUserList .skeleton')).toHaveCount(0);
  });

  // #8 — sparkline.
  test('#8 xülasə kartlarında sparkline var', async ({ page }) => {
    await openAdmin(page);
    // stats-daily bugünkü sətri yazır; ən azı 2 gün lazımdır ki, xətt çəkilsin.
    // Tək günlük bazada sparkline olmaya bilər — endpoint-in işlədiyini yoxlayırıq.
    const res = await apiGet(page, '/api/admin/stats-daily?days=30');
    expect(res.ok, res.body).toBeTruthy();
    const d = JSON.parse(res.body);
    expect(d).toHaveProperty('series');
    expect(d).toHaveProperty('today.users');
    expect(Array.isArray(d.series)).toBeTruthy();
    // bugünkü sətir upsert olunub
    expect(d.series.some((s: any) => s.date === new Date().toISOString().slice(0, 10))).toBeTruthy();
  });

  // #10 — pagination (server cursor).
  test('#10 istifadəçi siyahısı serverdən səhifələnir', async ({ page }) => {
    await openAdmin(page);
    const res = await apiGet(page, '/api/admin/users?limit=2');
    expect(res.ok, res.body).toBeTruthy();
    const d = JSON.parse(res.body);
    expect(d.users.length).toBeLessThanOrEqual(2);
    expect(d).toHaveProperty('nextCursor');
    expect(d.nextCursor, 'seed 7 istifadəçi yaradır — 2-lik səhifədə davamı olmalıdır').toBeTruthy();

    const p2 = await apiGet(page, '/api/admin/users?limit=2&cursor=' + encodeURIComponent(d.nextCursor));
    const d2 = JSON.parse(p2.body);
    // ikinci səhifə birinci ilə kəsişmir (keyset — sətir sürüşməsi yoxdur)
    const ids1 = d.users.map((u: any) => u.uid);
    const ids2 = d2.users.map((u: any) => u.uid);
    expect(ids2.some((x: string) => ids1.includes(x))).toBeFalsy();
  });

  test('#10 jurnal serverdən səhifələnir', async ({ page }) => {
    await openAdmin(page);
    const res = await apiGet(page, '/api/admin/logs?limit=2');
    const d = JSON.parse(res.body);
    expect(d.logs.length).toBeLessThanOrEqual(2);
    expect(d).toHaveProperty('nextCursor');
    expect(d.nextCursor).toBeTruthy();

    const p2 = await apiGet(page, '/api/admin/logs?limit=2&cursor=' + encodeURIComponent(d.nextCursor));
    const d2 = JSON.parse(p2.body);
    const ids1 = d.logs.map((l: any) => l.id);
    expect(d2.logs.some((l: any) => ids1.includes(l.id))).toBeFalsy();
  });

  // #11 — CSV ixracı.
  test('#11 CSV ixracı düzgün başlıq və məzmunla gəlir', async ({ page }) => {
    await openAdmin(page);
    const res = await apiGet(page, '/api/admin/export/users.csv');
    expect(res.ok, res.body.slice(0, 200)).toBeTruthy();
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toMatch(/collabix-users-\d{4}-\d{2}-\d{2}\.csv/);

    // BOM-u BAYT səviyyəsində yoxlayırıq: fetch().text() UTF-8 dekoderi
    // spesifikasiya üzrə baş BOM-u silir, ona görə mətndə görünmür.
    const head = await page.evaluate(async () => {
      const buf = await (await fetch('/api/admin/export/users.csv')).arrayBuffer();
      return [...new Uint8Array(buf).slice(0, 3)];
    });
    expect(head, 'UTF-8 BOM yoxdur — Excel Azərbaycan hərflərini pozar').toEqual([0xEF, 0xBB, 0xBF]);

    const lines = res.body.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('username,name,email,xp,streak,tasks_completed,verified,blocked,role,joined_at,last_active_at');
    expect(lines.length).toBeGreaterThan(1);
    expect(res.body).toContain('e2e_zara');
  });

  test('#11 jurnal CSV-si də işləyir', async ({ page }) => {
    await openAdmin(page);
    const res = await apiGet(page, '/api/admin/export/logs.csv');
    expect(res.ok, res.body.slice(0, 200)).toBeTruthy();
    const body = res.body.replace(/^﻿/, '');
    expect(body.split('\r\n')[0]).toBe('created_at,level,action,by_name,target_id,detail');
  });

  test('#11 CSV formula injection-dan qorunur', async ({ page }) => {
    await openAdmin(page);
    // "=" / "+" / "@" ilə başlayan xana Excel-də formul kimi icra oluna bilər —
    // ixracda apostrofla neytrallaşdırılmalıdır.
    const res = await apiGet(page, '/api/admin/export/users.csv');
    for (const line of res.body.split('\r\n').slice(1)) {
      for (const cell of line.split(',')) {
        expect(cell.replace(/^"/, '')).not.toMatch(/^[=+@]/);
      }
    }
  });

  // Tema uyğunluğu: yeni toolbar elementləri hər 3 temada oxunaqlı olmalıdır.
  for (const theme of ['dark', 'light', 'matrix']) {
    test(`${theme} temasında admin toolbar oxunaqlıdır`, async ({ page }) => {
      await page.addInitScript(th => {
        localStorage.setItem('collabix_theme', th as string);
        localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
        localStorage.setItem('collabix_onboarded', '1');
      }, theme);
      await page.goto('/#admin', { waitUntil: 'networkidle' });
      await expect(page.locator('#adminStatRow .stat-card').first()).toBeVisible();
      // Jurnal toolbar-ı `#tab-logs` panelindədir — ölçü götürmək üçün açılmalıdır
      // (gizli elementin `boundingBox()`-u `null` olur).
      await openTab(page, 'tab-logs');

      // Avto-sürüşmə checkbox-u uzanmamalıdır (flex:1 `input` seçicisi onu da tuturdu).
      const cb = await page.locator('#adminLogAuto').boundingBox();
      expect(cb!.width, 'checkbox uzanıb — flex qaydası onu da tutur').toBeLessThan(30);

      // Checkbox və etiketi bitişik olmalıdır (ayrı-ayrı uclarda deyil).
      const lbl = await page.locator('.log-autoscroll span').boundingBox();
      expect(lbl!.x - (cb!.x + cb!.width), 'etiket checkbox-dan uzaq düşüb').toBeLessThan(20);

      // Aksent fonlu elementlərdə mətn kontrastı WCAG AA (4.5:1) olmalıdır.
      const ratio = await page.evaluate(() => {
        const lum = (s: string) => {
          const [r, g, b] = s.match(/\d+/g)!.slice(0, 3).map(Number).map(v => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const probe = document.createElement('button');
        probe.className = 'view-toggle-probe';
        probe.style.cssText = 'background: var(--coral); color: var(--on-accent);';
        document.body.appendChild(probe);
        const cs = getComputedStyle(probe);
        const [l1, l2] = [lum(cs.color), lum(cs.backgroundColor)].sort((a, b) => b - a);
        probe.remove();
        return (l1 + 0.05) / (l2 + 0.05);
      });
      expect(ratio, `aksent fonunda mətn kontrastı zəif (${theme})`).toBeGreaterThanOrEqual(4.5);
    });
  }

  // qeyri-admin qorunması — sessiyasız kontekst.
  // Burada page.request yox, ayrıca kontekst işlədilir: cookie ONSUZ DA yoxdur,
  // ona görə `Secure` məhdudiyyəti nəticəyə təsir etmir.
  test('admin endpointləri auth tələb edir', async ({ browser }) => {
    const ctx = await browser.newContext();
    for (const p of ['/api/admin/users', '/api/admin/logs', '/api/admin/stats-daily',
                     '/api/admin/export/users.csv']) {
      const r = await ctx.request.get('http://127.0.0.1:8788' + p);
      expect(r.status(), p).toBe(401);
    }
    await ctx.close();
  });
});
