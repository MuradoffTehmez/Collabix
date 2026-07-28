import { test, expect } from '@playwright/test';
import { d1 } from './seed';

// TASK-8 / FAZA 4 / Bənd 12 — D1 → R2 arxivləmə (Cron Trigger).
//
// ⚠ NİYƏ BU TEST VACİBDİR: arxiv işi D1-dən mesaj SİLİR və canlıda hər gecə
// avtomatik işləyir. Testsiz deploy etmək istifadəçi datasını sınanmamış
// silmə kodunun ixtiyarına buraxmaq deməkdir. Burada əsas invariant yoxlanılır:
// «mesaj D1-dən YALNIZ R2-yə yazıldıqdan sonra silinir».
//
// Cron handler-i `--test-scheduled` bayrağı ilə `GET /__scheduled` kimi açılır
// (bax playwright.config.ts).
test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop',
    'Fon işi — viewport-dan asılı deyil, bir dəfə icra olunur');
});

const ROOM = 'e2e-arxiv-otaq';
// İsti pəncərə 90 gündür → 200 gün əvvəlki mesajlar mütləq arxivə düşməlidir.
const OLD_TS = Date.now() - 200 * 86400000;
const NEW_TS = Date.now() - 2 * 86400000;

function seedMessages() {
  const rows: string[] = [
    `INSERT OR IGNORE INTO rooms (id, name, created_by, created_at) VALUES ('${ROOM}', 'Arxiv testi', 'system', ${OLD_TS});`,
    `DELETE FROM room_messages WHERE room_id = '${ROOM}';`,
    `DELETE FROM message_archives WHERE scope_id = '${ROOM}';`,
  ];
  // 5 KÖHNƏ (arxivlənməli) + 2 YENİ (qalmalı) mesaj.
  for (let i = 0; i < 5; i++) {
    rows.push(
      `INSERT INTO room_messages (id, room_id, author_id, author_name, type, text, created_at) ` +
      `VALUES ('arx-old-${i}', '${ROOM}', 'u1', 'Test', 'text', 'köhnə mesaj ${i}', ${OLD_TS + i * 1000});`);
  }
  for (let i = 0; i < 2; i++) {
    rows.push(
      `INSERT INTO room_messages (id, room_id, author_id, author_name, type, text, created_at) ` +
      `VALUES ('arx-new-${i}', '${ROOM}', 'u1', 'Test', 'text', 'yeni mesaj ${i}', ${NEW_TS + i * 1000});`);
  }
  d1(rows.join('\n'));
}

function queryJson(sql: string): any[] {
  const raw = d1(sql, true);
  const start = raw.indexOf('[');
  if (start < 0) return [];
  try { return JSON.parse(raw.slice(start))?.[0]?.results ?? []; } catch { return []; }
}

test.describe('D1 → R2 arxivləmə (Bənd 12)', () => {

  test('köhnə mesajlar R2-yə köçür, isti pəncərə D1-də qalır', async ({ page }) => {
    seedMessages();

    const before = queryJson(`SELECT COUNT(*) AS n FROM room_messages WHERE room_id = '${ROOM}';`);
    expect(Number(before[0].n), 'seed 7 mesaj qoymalıdır').toBe(7);

    // Cron-u işə sal.
    const res = await page.request.get('/__scheduled');
    expect(res.status()).toBe(200);

    // Arxivləmə `waitUntil` içindədir — cavab işin bitməsini gözləmir.
    await expect.poll(() => {
      const rows = queryJson(`SELECT COUNT(*) AS n FROM room_messages WHERE room_id = '${ROOM}';`);
      return Number(rows[0]?.n ?? -1);
    }, { timeout: 20_000, message: 'köhnə mesajlar D1-dən çıxmalıdır' }).toBe(2);

    // Qalanlar MƏHZ yeni olanlardır — arxiv kəsiyi düzgün işləyib.
    const left = queryJson(`SELECT id FROM room_messages WHERE room_id = '${ROOM}' ORDER BY id;`);
    expect(left.map(r => r.id)).toEqual(['arx-new-0', 'arx-new-1']);

    // Katalog sətri yazılmalıdır — onsuz arxivi tapmaq mümkün olmazdı.
    const meta = queryJson(
      `SELECT kind, msg_count, r2_key, bytes FROM message_archives WHERE scope_id = '${ROOM}';`);
    expect(meta).toHaveLength(1);
    expect(meta[0].kind).toBe('room');
    expect(Number(meta[0].msg_count), 'beş köhnə mesaj arxivlənməlidir').toBe(5);
    expect(Number(meta[0].bytes)).toBeGreaterThan(0);
    expect(String(meta[0].r2_key)).toMatch(/^archive\/room\/.+\.json\.gz$/);
  });

  test('təkrar işləmə arxivləşmiş mesajı ikinci dəfə yazmır (idempotent)', async ({ page }) => {
    // Əvvəlki test artıq arxivləyib; yenidən işlətmək yeni katalog sətri
    // yaratmamalıdır, çünki D1-də arxivlənəcək köhnə mesaj qalmayıb.
    const beforeCount = queryJson(
      `SELECT COUNT(*) AS n FROM message_archives WHERE scope_id = '${ROOM}';`);

    await page.request.get('/__scheduled');
    await page.waitForTimeout(3000);

    const afterCount = queryJson(
      `SELECT COUNT(*) AS n FROM message_archives WHERE scope_id = '${ROOM}';`);
    expect(Number(afterCount[0].n)).toBe(Number(beforeCount[0].n));
  });

  // 🔴 REQRESSİYA — AUDIT-TASK-8 §8.8-də aşkarlanan GİZLİ qüsur.
  //
  // Silmə ifadəsi əvvəl mesaj başına bir `?` bağlayırdı (`WHERE id IN (?,?,…)`)
  // və `BATCH` 2000-dir. D1 bir ifadədəki dəyişən sayını məhdudlaşdırır, yəni
  // 100-dən çox mesajı olan scope-da sorğu `too many SQL variables` atır və
  // BÜTÜN arxiv işi çökürdü. `ARCHIVE_HOT_DAYS=3650` səbəbindən bu kod yolu
  // Task 1-dən bəri heç vaxt işə düşməmişdi — ona görə qüsur gizli qalmışdı.
  //
  // ⚠ Nasazlıq SÜKUTLU idi: R2 yazısı silmədən ƏVVƏL bitir, yəni hər gecə
  // yetim obyekt yaranar, katalog yazılmaz, D1 isə sonsuz böyüyərdi.
  test('100-dən ÇOX mesajı olan otaq da arxivlənir (SQL dəyişən limiti)', async ({ page }) => {
    const BIG = 'e2e-arxiv-boyuk-otaq';
    const rows: string[] = [
      `INSERT OR IGNORE INTO rooms (id, name, created_by, created_at) VALUES ('${BIG}', 'Böyük arxiv', 'system', ${OLD_TS});`,
      `DELETE FROM room_messages WHERE room_id = '${BIG}';`,
      `DELETE FROM message_archives WHERE scope_id = '${BIG}';`,
    ];
    const N = 150;   // D1 dəyişən limitindən (100) xeyli çox
    for (let i = 0; i < N; i++) {
      rows.push(
        `INSERT INTO room_messages (id, room_id, author_id, author_name, type, text, created_at) ` +
        `VALUES ('big-${i}', '${BIG}', 'u1', 'Test', 'text', 'mesaj ${i}', ${OLD_TS + i * 1000});`);
    }
    d1(rows.join('\n'));

    const res = await page.request.get('/__scheduled');
    expect(res.status()).toBe(200);

    await expect.poll(() => {
      const m = queryJson(`SELECT msg_count FROM message_archives WHERE scope_id = '${BIG}';`);
      return Number(m[0]?.msg_count ?? -1);
    }, { timeout: 25_000, message: '150 mesajın hamısı arxivlənməlidir' }).toBe(N);

    // D1-dən TAM silinməlidir — yarımçıq silmə dublikat mənbəyidir.
    const left = queryJson(`SELECT COUNT(*) AS n FROM room_messages WHERE room_id = '${BIG}';`);
    expect(Number(left[0].n), 'arxivlənən mesajlar D1-də qalmamalıdır').toBe(0);
  });

  test('vaxtı bitmiş sessiyalar təmizlənir', async ({ page }) => {
    // 30 gün əvvəl bitmiş sessiya — saxlama həddi (7 gün) keçib.
    const uid = queryJson("SELECT id FROM users WHERE username = 'e2e_main';")[0]?.id;
    expect(uid).toBeTruthy();
    d1(`INSERT OR REPLACE INTO sessions (id, uid, refresh_hash, ua, ip, city, country, created_at, last_seen, expires_at, revoked)
        VALUES ('arx-stale-sess', '${uid}', 'kohnehash', '', '', '', '', ${Date.now() - 40 * 86400000},
                ${Date.now() - 40 * 86400000}, ${Date.now() - 30 * 86400000}, 1);`);

    await page.request.get('/__scheduled');

    await expect.poll(() => queryJson(
      "SELECT COUNT(*) AS n FROM sessions WHERE id = 'arx-stale-sess';")[0]?.n,
      { timeout: 20_000, message: 'köhnə sessiya silinməlidir' }).toBe(0);
  });
});
