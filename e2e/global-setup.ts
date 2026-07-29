// Playwright globalSetup — AUDIT-TASK-10 / Faza 1.2.
//
// İKİ İŞ GÖRÜR:
//   1. Test istifadəçilərini hazırlayır (seed).
//   2. 🔴 ƏVVƏLKİ QAÇIŞIN QALIQLARINI TƏMİZLƏYİR.
//
// ⚠ PRİNSİP (sənəd §1.2): "Test dəsti ƏVVƏLKİ QAÇIŞIN VƏZİYYƏTİNDƏN ASILI
//   OLMAMALIDIR." Bu, Task 5-in E2E seed müstəqilliyi qaydasının davamıdır.
//
// 🔴 NİYƏ LAZIM OLDU — Task 9 §R-3b və Task 10 baseline ölçməsi:
//   Task 9-da eyni dəst onlarla dəfə işlədildi və İKİ müstəqil zəhərlənmə
//   ortaya çıxdı. Hər ikisi "reqressiya varmı?" sualına YALANÇI cavab verdi və
//   saatlarla səhv diaqnoza apardı:
//
//   (a) Qalıq test hesabları — yarımçıq kəsilmiş qaçışlar `a9_*` / `rl_*`
//       hesablarını silmədən buraxır. 24 belə hesab yığılmışdı və istifadəçi
//       kataloqunun İLK SƏHİFƏSİNİ doldurub `users.spec`-in 5 testini sındırdı.
//       (`rate-limit.spec.ts` şərhi bu haqda xəbərdarlıq edirdi.)
//
//   (b) `rl:*` KV sayğacları — `heavy` səbəti saatda 20 (testdə ×5 = 100/uid).
//       Bir saat ərzində 10+ qaçış büdcəni yeyir və 6 GDPR ixrac testi 429 alır.
//
//   Əlavə: `admin.spec` bulk testi sınsa istifadəçini BLOKLU qoyub gedir;
//   sabit id-li seed sətirləri (`e2e_tp_csv`) `UNIQUE` xətası verir.
//
// ⚠ SESSİYA BURADA YARADILMIR — bax `auth-fixture.ts`. Səbəb: `globalSetup`
//   t = 0-da işləyir, `mobile` layihəsi isə ~20 dəqiqə sonra başlayır və
//   `ACCESS_TTL` 15 dəqiqədir. Sessiya İSTİFADƏ ANINDA yaradılır.
import { type FullConfig } from '@playwright/test';
import { seedTestUsers, d1 } from './seed';
import { execFileSync } from 'node:child_process';

/** Qalıq test hesablarının prefiksləri — hər biri bir spec-in `freshUser`-i. */
const THROWAWAY_PREFIXES = ['a9\\_', 'rl\\_', 'probe\\_'];

/**
 * D1-dəki qalıqları silir.
 *
 * ⚠ `ESCAPE '\'` MƏCBURİDİR: `_` LIKE-da JOKER simvoldur. Onsuz `'a9_%'`
 *   naxışı `a9X...` kimi adları da tutardı — və teorik olaraq qanuni hesabı
 *   silərdi.
 */
function cleanLeftoverRows() {
  const like = THROWAWAY_PREFIXES
    .map(p => `username LIKE '${p}%' ESCAPE '\\'`).join(' OR ');
  const uids = `(SELECT id FROM users WHERE ${like})`;

  d1([
    // Sıra vacibdir: asılı sətirlər hesabdan ƏVVƏL silinir (FK).
    `DELETE FROM xp_logs  WHERE uid       IN ${uids};`,
    `DELETE FROM posts    WHERE author_id IN ${uids};`,
    `DELETE FROM sessions WHERE uid       IN ${uids};`,
    `DELETE FROM users    WHERE ${like};`,
    // `admin.spec` #5 sınsa istifadəçi BLOKLU qalır → növbəti qaçış da sınır.
    'UPDATE users SET blocked = 0 WHERE blocked = 1;',
    // Sabit id-li seed sətirləri (idempotentlik).
    "DELETE FROM team_posts   WHERE id  = 'e2e_tp_csv';",
    "DELETE FROM deleted_uids WHERE uid = 'e2e_ghost_uid';",
    // Arxiv testlərinin öz otaqları — hər qaçış onları yenidən qurur.
    "DELETE FROM message_archives WHERE scope_id LIKE 'e2e-arch-%';",
    "DELETE FROM room_messages    WHERE room_id  LIKE 'e2e-arch-%';",
  ].join('\n'));
}

/**
 * `rl:*` rate-limit sayğaclarını silir.
 *
 * ⚠ `heavy` səbəti SAATLIQ pəncərədədir (20/saat). Ardıcıl qaçışlar eyni
 *   pəncərəyə düşür və GDPR ixrac testləri 429 alır — məhsulda qüsur olmadığı
 *   halda. Sayğacları silmək dəstin öz büdcəsini hər qaçışda sıfırlayır.
 *
 * ⚠ Xəta BASDIRILIR: KV əlçatmaz olsa da dəst işləməlidir; ən pis halda
 *   `heavy` testləri 429 alır və bu, təmizliyin özündən daha az zərərlidir.
 */
function cleanRateLimitKeys() {
  const run = (args: string[]) => execFileSync('npx', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    encoding: 'utf8',
  });
  try {
    const raw = run(['wrangler', 'kv', 'key', 'list', '--binding', 'SESSIONS',
      '--local', '--persist-to', '.wrangler/state']);
    const keys = [...raw.matchAll(/"name":\s*"(rl:[^"]+)"/g)].map(m => m[1]);
    for (const k of keys) {
      try {
        run(['wrangler', 'kv', 'key', 'delete', k, '--binding', 'SESSIONS',
          '--local', '--persist-to', '.wrangler/state']);
      } catch { /* tək açar silinməsə də qalanlar silinsin */ }
    }
    if (keys.length) console.log(`[globalSetup] ${keys.length} rate-limit açarı silindi`);
  } catch (e: any) {
    console.warn('[globalSetup] rate-limit açarları təmizlənmədi:', e?.message || e);
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;

  // ⚠ Təmizlik seed-dən ƏVVƏL: seed `INSERT OR IGNORE` işlədir və qalıq
  //   sətirlər onun nəticəsini dəyişə bilər (bax `e2e_teamowner` halı).
  cleanLeftoverRows();
  cleanRateLimitKeys();

  await seedTestUsers(baseURL);
}
