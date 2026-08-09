// İstifadəçi silinməsi siyasətinin TAMLIĞI — BACKEND AUDIT / BE-001.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 NİYƏ BU TEST VAR
// ════════════════════════════════════════════════════════════════════════════
//
// İstehsalda `PRAGMA foreign_keys = 1`, lakin 91 cədvəldən yalnız 47-sində FK
// bəyan olunub. SQLite `ALTER TABLE` ilə mövcud cədvələ FK əlavə edə bilmir —
// cədvəl yenidən qurulmalıdır — ona görə 55 cədvəl qorunmamış qalır və audit
// də onların yenidən qurulmasını TÖVSİYƏ ETMƏDİ (bahalı və riskli).
//
// Bu test FK-nın verə bilmədiyi zəmanətin əvəzidir: sxemi OXUYUR və istifadəçi
// sütunu olan hər cədvəlin `USER_REFS`-də AÇIQ siyasəti olmasını tələb edir.
// Yeni cədvəl siyasətsiz əlavə olunsa test sınır — yəni "unutmaq" mümkün deyil.
//
// ⚠ SXEM MİQRASİYALARDAN OXUNUR, canlı bazadan yox: test CI-də bazasız işləməli
//   və nəticəsi determinist olmalıdır. Lokal baza sürüşə bilər (BE-006 məhz
//   bunun nümunəsidir), miqrasiya faylları isə repo-dadır.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { USER_REFS, scannableColumns } from '../worker/services/cascade';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * İstifadəçi sətrinə istinad edən sütun adları.
 *
 * ⚠ AD ƏSASLI SİYAHIDIR və bu, məhdudiyyətdir: `sqlite_master` FK bəyan etməyən
 *   sütunun nəyə istinad etdiyini BİLMİR, yəni maşınla çıxarmaq mümkün deyil.
 *   Siyahı DAR saxlanılır — şübhəli ad əlavə etmək testi yalançı qırmızıya
 *   salar və nəticədə hamı ona baxmağı dayandırar.
 */
const USER_COLUMNS = new Set([
  'user_id', 'uid', 'author_id', 'from_id', 'to_id', 'follower_id', 'target_id',
  'owner_id', 'by_id', 'actor_id', 'assignee_id', 'created_by', 'reviewed_by',
  'reporter_id', 'invited_by', 'granted_by', 'user_a', 'user_b',
]);

/** Miqrasiyalardan `CREATE TABLE` bəyanlarını yığır (sonuncu qalib gəlir). */
function schemaTables(): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  const dir = join(root, 'migrations');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8');
    for (const m of sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\n\s*\)\s*;/gi,
    )) {
      const name = m[1];
      // FTS kölgə cədvəlləri və miqrasiya jurnalı istifadəçi saxlamır.
      if (/_fts|^d1_|^sqlite_/.test(name)) continue;
      const cols = [...m[2].matchAll(/^\s*["`]?(\w+)["`]?\s+(TEXT|INTEGER|REAL|BLOB)/gmi)]
        .map(c => c[1]);
      tables.set(name, cols);
    }
    // `ALTER TABLE … ADD COLUMN` da sütun gətirir.
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/gi)) {
      const cur = tables.get(m[1]);
      if (cur && !cur.includes(m[2])) cur.push(m[2]);
    }
    /* ⚠ CƏDVƏLİN YENİDƏN QURULMASI NAXIŞI İZLƏNMƏLİDİR.
     *   SQLite-da sütun tipini/məhdudiyyətini dəyişmək üçün yeganə yol
     *   `CREATE TABLE x_new` → `INSERT SELECT` → `DROP TABLE x` →
     *   `ALTER TABLE x_new RENAME TO x`-dir. İzləmədən `x_new` sxemdə DAİMİ
     *   cədvəl kimi görünür və test mövcud olmayan cədvəl üçün siyasət tələb
     *   edir — ölçüldü: `comment_reactions_new`, `post_reactions_new`,
     *   `poll_votes_new` məhz belə yalançı siqnal verdi. */
    for (const m of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/gi)) {
      tables.delete(m[1]);
    }
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+["`]?(\w+)["`]?\s+RENAME\s+TO\s+["`]?(\w+)["`]?/gi)) {
      const cols = tables.get(m[1]);
      if (cols) { tables.delete(m[1]); tables.set(m[2], cols); }
    }
  }
  return tables;
}

/** Sxemdə istifadəçiyə istinad edən (cədvəl, sütun) cütləri. */
function schemaUserRefs(): { table: string; column: string }[] {
  const out: { table: string; column: string }[] = [];
  for (const [table, cols] of schemaTables()) {
    // `users` cədvəlinin özü istinad deyil, HƏDƏFDİR.
    if (table === 'users') continue;
    for (const c of cols) if (USER_COLUMNS.has(c)) out.push({ table, column: c });
  }
  return out;
}

describe('kaskad siyasəti — tamlıq (BE-001)', () => {
  it('🔴 istifadəçi sütunu olan HƏR cədvəl-sütunun siyasəti var', () => {
    const missing = schemaUserRefs()
      .filter(r => !USER_REFS[r.table]?.[r.column])
      .map(r => `${r.table}.${r.column}`);
    expect(
      missing,
      'siyasətsiz istinad(lar) — `worker/services/cascade.ts` → USER_REFS-ə əlavə et',
    ).toEqual([]);
  });

  it('🔴 xəritədə sxemdə OLMAYAN cədvəl-sütun yoxdur (köhnəlmə mühafizəsi)', () => {
    // Əks istiqamət: cədvəl silinsə və ya sütun adı dəyişsə, xəritədəki sətir
    // ölü qalar və `cascadeStatements()` icra vaxtı `no such table` ilə SINAR —
    // yəni hesab silinməsi tamamilə işləməz. Statik analiz bunu göstərmir.
    const schema = new Set(schemaUserRefs().map(r => `${r.table}.${r.column}`));
    const stale: string[] = [];
    for (const [table, cols] of Object.entries(USER_REFS)) {
      for (const column of Object.keys(cols)) {
        if (!schema.has(`${table}.${column}`)) stale.push(`${table}.${column}`);
      }
    }
    expect(stale, 'sxemdə olmayan istinad(lar)').toEqual([]);
  });

  it('`keep` və `cascade` siyasəti SƏBƏB daşıyır', () => {
    // Səbəbsiz `keep` "hələ baxmamışam" deməkdir və zamanla qərara çevrilir.
    const silent: string[] = [];
    for (const [table, cols] of Object.entries(USER_REFS)) {
      for (const [column, p] of Object.entries(cols)) {
        if ((p.kind === 'keep' || p.kind === 'cascade') && !p.why?.trim()) {
          silent.push(`${table}.${column}`);
        }
      }
    }
    expect(silent).toEqual([]);
  });

  it('skaner yalnız "yetim qalmamalıdır" vəd edən sütunlara baxır', () => {
    // `keep` sütunlarında yetim sətir GÖZLƏNİLƏNDİR (ban tarixçəsi qəsdən
    // qalır). Onları saysaq siqnal həmişə qırmızı olar və oxunmaz hala düşər.
    const scanned = new Set(scannableColumns().map(c => `${c.table}.${c.column}`));
    const wrong: string[] = [];
    for (const [table, cols] of Object.entries(USER_REFS)) {
      for (const [column, p] of Object.entries(cols)) {
        const should = p.kind === 'delete' || p.kind === 'anonymize' || p.kind === 'null';
        if (should !== scanned.has(`${table}.${column}`)) wrong.push(`${table}.${column}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('reqressiya: örtülən istinad sayı azalmır', () => {
    const total = Object.values(USER_REFS).reduce((n, c) => n + Object.keys(c).length, 0);
    expect(total).toBeGreaterThanOrEqual(60);
  });
});
