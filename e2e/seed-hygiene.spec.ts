// AUDIT-TASK-5 / H-7 — demo seed təmizliyi və BOOTSTRAP datasının qorunması.
//
// İki əks istiqamətli invariant birlikdə testlənir, çünki səhv istiqamətə
// düşmək asandır (AUDIT-TASK-5 §2.b):
//   🔴 DEMO data istehsalda GÖRÜNMƏMƏLİDİR  — saxta "Team Owner", "Alpha Team"
//   🟢 BOOTSTRAP data İŞLƏMƏLİDİR           — `general` otağı, taksonomiyalar
//
// İkinci qrup daha vacibdir: demo data qalsa sayt çirkli görünür, bootstrap
// data silinsə sayt ÇÖKÜR. Faktiki hal: `general` otağı həm lokal, həm
// İSTEHSAL bazasında silinmişdi və qlobal çat sınıq idi (§1).
import { test, expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { AUTH_FILE } from './seed';
import { E2E_TEAM, E2E_OWNER, GENERAL_ROOM_ID } from './fixtures';

test.use({ storageState: AUTH_FILE });

test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Data/konfiq testi — viewport-dan asılı deyil, bir dəfə icra olunur');
});

async function api(page: Page, path: string) {
  return page.evaluate(async p => {
    const r = await fetch(p as string);
    let body: any = null;
    try { body = await r.json(); } catch { /* gövdəsiz cavab */ }
    return { status: r.status, ok: r.ok, body };
  }, path);
}

async function openApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#home', { waitUntil: 'networkidle' });
}

/* ══════════ 🔴 Demo data görünmür ══════════ */

test.describe('AUDIT H-7 — demo seed təmizliyi @seed', () => {
  test('saxta "Team Owner" istifadəçisi heç bir siyahıda yoxdur', async ({ page }) => {
    await openApp(page);
    // Auditin sadaladığı görünmə yerləri: istifadəçi siyahısı, kataloq, təklif.
    for (const path of ['/api/users', '/api/users/directory?limit=200', '/api/users/suggestions']) {
      const res = await api(page, path);
      expect(res.ok, path).toBeTruthy();
      const blob = JSON.stringify(res.body);
      expect(blob, `${path} — saxta istifadəçi adı`).not.toContain('teamowner_123');
      expect(blob, `${path} — saxta istifadəçi adı`).not.toContain('team_owner_123');
    }
  });

  test('axtarışda demo istifadəçi və komanda çıxmır (FTS indeksi təmizdir)', async ({ page }) => {
    await openApp(page);
    // FTS indeksi əl ilə təmizlənmir — 0012-dəki `users_fts_ad` trigger-i
    // `users` sətri silinəndə indeksdən də çıxarır. Bu test həmin trigger-in
    // işlədiyinin sübutudur: işləməsəydi axtarış FANTOM nəticə qaytarardı.
    const res = await api(page, '/api/search?q=teamowner_123');
    expect(res.ok).toBeTruthy();
    // ⚠ Bütün gövdəyə baxmaq OLMAZ: cavab `query` sahəsində axtarış mətnini
    // ÖZÜNÜ əks etdirir — nəticə boş olsa belə sətir orada görünür.
    // Yoxlanan şey NƏTİCƏ massivləridir.
    expect(res.body.users, 'FTS-də saxta istifadəçi qalıb').toEqual([]);
    expect(res.body.posts).toEqual([]);
    expect(res.body.comments).toEqual([]);

    const teams = await api(page, '/api/teams/discover?q=Alpha');
    expect(teams.ok).toBeTruthy();
    // Miqrasiya ilə gələn demo komandanın slug-ı; E2E-nin öz komandası
    // `e2e-alpha-team`-dir və o QALMALIDIR (aşağıdakı testə bax).
    expect(JSON.stringify(teams.body)).not.toContain('"alpha-team"');
  });

  test('demo komanda id-si ilə birbaşa müraciət 404 verir', async ({ page }) => {
    await openApp(page);
    for (const slug of ['alpha-team', 'beta-team', 'gamma-team']) {
      const res = await api(page, `/api/teams/${slug}`);
      expect(res.status, slug).toBe(404);
    }
  });
});

/* ══════════ 🟢 REQRESSİYA — bootstrap data qorunub ══════════ */

test.describe('AUDIT H-7 — bootstrap data qorunur @seed', () => {
  test('🔴 general otağı İŞLƏYİR', async ({ page }) => {
    await openApp(page);
    // Ən vacib test. `general` `0002_seed.sql`-dədir və DEMO DEYİL — o
    // silinsə `room_messages.room_id` FK-sı pozulur və qlobal çat tamamilə
    // sınır (faktiki olaraq baş vermişdi — bax 0021_restore_bootstrap_rooms.sql).
    const res = await api(page, `/api/rooms/${GENERAL_ROOM_ID}/messages`);
    expect(res.status, 'general otağı oxunmalıdır').toBeLessThan(400);
  });

  test('general otağına mesaj YAZILA bilir (FK sağlamdır)', async ({ page }) => {
    await openApp(page);
    const sent = await page.evaluate(async () => {
      const r = await fetch('/api/rooms/general/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', text: `AUDIT-5 bootstrap yoxlaması ${Date.now()}` }),
      });
      return r.status;
    });
    // FK pozulsaydı yazı sükutla itərdi və ya 500 qaytarardı.
    expect(sent, 'general otağına yazı').toBeLessThan(400);
  });

  test('otaq siyahısı boş deyil', async ({ page }) => {
    await openApp(page);
    const res = await api(page, '/api/rooms');
    expect(res.ok).toBeTruthy();
    expect((res.body.rooms || []).length, 'ən azı `general` olmalıdır').toBeGreaterThan(0);
  });

  test('0002-nin digər bootstrap datası yerindədir', async ({ page }) => {
    await openApp(page);
    const tax = await api(page, '/api/taxonomies');
    expect(JSON.stringify(tax.body)).toContain('python');

    const faqs = await api(page, '/api/public/faqs');
    expect((faqs.body.faqs || []).length).toBeGreaterThan(0);
  });
});

/* ══════════ E2E seed müstəqilliyi (§5.4) ══════════ */

test.describe('AUDIT H-7 — E2E seed müstəqilliyi @seed', () => {
  test('E2E öz komandası mövcuddur və miqrasiyadan asılı deyil', async ({ page }) => {
    await openApp(page);
    const res = await api(page, `/api/teams/${E2E_TEAM.slug}`);
    expect(res.ok, 'E2E komandası e2e/seed.ts tərəfindən yaradılır').toBeTruthy();
    expect(res.body.team.name).toBe(E2E_TEAM.name);
  });

  test('E2E identifikatorları e2e_ prefiksi daşıyır', () => {
    // §5.4/3 — istehsal ID-ləri ilə qarışmasın deyə prefiks MƏCBURİDİR.
    for (const id of [E2E_TEAM.id, E2E_TEAM.roleId, E2E_TEAM.roomId, E2E_OWNER.id]) {
      expect(id, `${id} — e2e_ prefiksi olmalıdır`).toMatch(/^e2e_/);
    }
  });

  test('miqrasiya qovluğunda YENİ demo seed yoxdur', () => {
    // migrations/README.md §3 — demo data miqrasiyaya YAZILMIR.
    // Tarixi fayllar (0015–0018) qayda §2-yə görə saxlanılır, lakin onların
    // yazdığı sətirlər 0020 ilə silinir. Bu test YENİ pozuntunu tutur.
    const HISTORIC = new Set([
      '0015_seed_teams.sql', '0016_seed_chat_room.sql',
      '0017_seed_chat_room_fk_fix.sql', '0018_seed_fix_admin_permissions.sql',
    ]);
    const offenders: string[] = [];
    for (const f of readdirSync('migrations').filter(f => f.endsWith('.sql'))) {
      if (HISTORIC.has(f)) continue;
      const sql = readFileSync(`migrations/${f}`, 'utf8');
      // Demo naxışları: uydurma ID-lər və adlar.
      if (/INSERT[^;]*\b(team_owner_123|'team_1'|'role_1'|'tcr_1'|Alpha Team)\b/i.test(sql)) {
        offenders.push(f);
      }
    }
    expect(offenders, `demo data miqrasiyaya yazılıb:\n${offenders.join('\n')}`).toHaveLength(0);
  });
});
