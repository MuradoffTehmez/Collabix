// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Database driver
// ═══════════════════════════════════════════════════════════════════════════
//
// İKİ REJİM, BİR API
//
//   local  → `.wrangler/state` içindəki miniflare SQLite faylına BİRBAŞA yazır
//            (node:sqlite, hazırlanmış ifadələr, tək tranzaksiya).
//   remote → EYNİ ifadələri həm lokal fayla yazır, həm də mətn kimi yığıb
//            `wrangler d1 execute --remote --file` ilə göndərir (İKİQAT YAZMA).
//
// 🔴 NİYƏ REMOTE REJİM DƏ LOKALA YAZIR (2026-08-12):
//    Generator yazdığı sətirləri geri OXUYUR — komanda üzvlükləri, `user_stats`
//    aqreqatları, nişan qaydaları və gündəlik statistika məhz həmin oxulardan
//    hesablanır (`db.query`). Əvvəlki remote rejimi yalnız SQL yığırdı, oxu isə
//    lokal fayla gedirdi; yəni generator ÖZ yazdığını görmür, ƏVVƏLKİ qaçışın
//    lokal sətirlərini görürdü. Nəticədə remote-a mövcud olmayan ID-lərə
//    istinad edən törəmə data gedərdi. İkiqat yazma bunu kökündən həll edir və
//    əlavə olaraq lokal bazanı remote-un güzgüsü kimi saxlayır (audit skripti
//    lokal oxuyur — yəni audit faktiki olaraq remote datanı yoxlayır).
//
// ⚠ Ona görə remote qaçışdan ƏVVƏL lokal demo data təmizlənməlidir
//   (`npm run seed:reset`), əks halda lokal fayl iki qaçışın cəmini saxlayar.
//
// 🔴 NİYƏ BİRBAŞA SQLite: əvvəlki sürüm hər 80 ifadə üçün ayrıca `npx wrangler`
//    prosesi açırdı (~2-4 s). Bu miqyasda (≈150 000 sətir) həmin yol saatlarla
//    çəkir və qaçış yarımçıq kəsilirdi. Ölçmə: birbaşa yazma 100 000 sətir =
//    153 ms. Fərq ~4 tərtibdir, ona görə lokal yol wrangler-i tamamilə keçir.
//
// ⚠ LOKAL REJİM `wrangler dev` İŞLƏYƏRKƏN QAÇIRILMAMALIDIR — workerd faylı
//   tutur və yazma `SQLITE_BUSY` verir. Generator başlamazdan əvvəl serveri
//   dayandırın.
//
// ⚠ SÜTUN YOXLAMASI: `insert()` hər sətri canlı sxemlə tutuşdurur. Əvvəlki
//   generator `notifications.ref_id`, `presence.uid`, `warnings.user_id` kimi
//   MÖVCUD OLMAYAN sütunlara yazırdı və səhv yalnız icra vaxtı, faza 4-də üzə
//   çıxırdı. İndi uyğunsuzluq DƏRHAL, sətir yaradılan anda atılır.

import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const DB_NAME = 'collabix-db';

/** Lokal miniflare SQLite faylının yolu. */
export function localDbPath() {
  if (!existsSync(D1_DIR)) {
    throw new Error(
      `Lokal D1 tapılmadı: ${D1_DIR}\n` +
      'Əvvəlcə `npm run db:migrate:local` qaçırın.',
    );
  }
  const f = readdirSync(D1_DIR).find(
    x => x.endsWith('.sqlite') && x !== 'metadata.sqlite',
  );
  if (!f) throw new Error(`Lokal D1 faylı tapılmadı: ${D1_DIR}`);
  return join(D1_DIR, f);
}

/** SQL string literal — tək dırnaqlar ikiləşir. */
export function sqlLit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`SQL-ə sonsuz/NaN ədəd verilə bilməz: ${v}`);
    return String(v);
  }
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Driver
// ═══════════════════════════════════════════════════════════════════════════

class SeedDb {
  /**
   * @param {object} opts
   * @param {boolean} [opts.remote]  remote D1-ə yaz
   * @param {number}  [opts.chunk]   tranzaksiya başına sətir (lokal)
   */
  constructor({ remote = false, chunk = 50_000 } = {}) {
    this.remote = remote;
    this.chunk = chunk;
    this.stats = new Map();       // table → yazılmış sətir sayı
    this._schema = new Map();     // table → Set<column>
    this._stmt = new Map();       // cacheKey → prepared statement
    this._pending = 0;
    this._inTx = false;
    this._remoteSql = [];         // remote rejimdə yığılan SQL sətirləri
    this._remoteFlushed = 0;

    // Sxem introspeksiyası HƏR İKİ rejimdə lokal fayldan gedir: miqrasiyalar
    // eynidir, ona görə lokal sxem remote üçün də etibarlı doğrulama mənbəyidir
    // (və remote-a səhv sütunla getməkdən qoruyur).
    this._intro = new DatabaseSync(localDbPath());

    this.db = this._intro;
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = OFF');
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  /** Cədvəlin sütun adları (canlı sxemdən). */
  columns(table) {
    let cols = this._schema.get(table);
    if (!cols) {
      const rows = this._intro.prepare(`PRAGMA table_info("${table}")`).all();
      if (!rows.length) throw new Error(`Cədvəl tapılmadı: ${table}`);
      cols = new Set(rows.map(r => r.name));
      this._schema.set(table, cols);
    }
    return cols;
  }

  /**
   * Bir sətir yazır. `row` açarları sütun adları olmalıdır.
   *
   * ⚠ `INSERT OR IGNORE` qəsdən seçilib: kompozit açarlı cədvəllərdə
   *   (likes, follows, bookmarks…) generator təsadüfi cütlər seçir və
   *   təkrar qaçılmazdır. Təkrarın SƏSSİZ atılması istənilən davranışdır,
   *   ona görə yazılan sətir sayı ayrıca `stats`-dan yox, sonda SELECT
   *   COUNT ilə təsdiqlənir.
   */
  insert(table, row) {
    const cols = this.columns(table);
    const keys = Object.keys(row);
    for (const k of keys) {
      if (!cols.has(k)) {
        throw new Error(
          `Sxem uyğunsuzluğu — "${table}" cədvəlində "${k}" sütunu yoxdur.\n` +
          `Mövcud sütunlar: ${[...cols].join(', ')}`,
        );
      }
    }

    this.stats.set(table, (this.stats.get(table) || 0) + 1);

    if (this.remote) {
      const vals = keys.map(k => sqlLit(row[k])).join(',');
      this._remoteSql.push(
        `INSERT OR IGNORE INTO "${table}" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${vals});`,
      );
      // ...və eyni sətir lokala da yazılır (yuxarıdakı izaha bax).
    }

    const cacheKey = table + '|' + keys.join(',');
    let stmt = this._stmt.get(cacheKey);
    if (!stmt) {
      const sql =
        `INSERT OR IGNORE INTO "${table}" (${keys.map(k => `"${k}"`).join(',')}) ` +
        `VALUES (${keys.map(() => '?').join(',')})`;
      stmt = this.db.prepare(sql);
      this._stmt.set(cacheKey, stmt);
    }

    this._begin();
    stmt.run(...keys.map(k => normalize(row[k])));
    if (++this._pending >= this.chunk) this._commit();

    // Remote növbəsi böyüyəndə aralıq göndəriş: həm yaddaşı məhdudlaşdırır,
    // həm də icazə/şəbəkə səhvini generatorun ƏVVƏLİNDƏ üzə çıxarır (sonda
    // çıxsaydı, ~150 000 ifadəlik iş boşa gedərdi).
    if (this.remote && this._remoteSql.length >= 20_000) this._flushRemote();
  }

  /** Xam SQL icra edir (UPDATE, DELETE, aggregate). */
  exec(sql) {
    if (this.remote) this._remoteSql.push(sql.trim().endsWith(';') ? sql : sql + ';');
    this._begin();
    this.db.exec(sql);
  }

  /**
   * SELECT — HƏMİŞƏ lokal fayldan oxuyur.
   * Remote rejimdə lokal fayl eyni ifadələri aldığı üçün bu, remote-un
   * güzgüsüdür; oxu-yaz ardıcıllığı pozulmur.
   */
  query(sql) {
    if (this._inTx) this._commit();
    return this._intro.prepare(sql).all();
  }

  /** Tək sətir/tək dəyər. */
  one(sql) {
    const r = this.query(sql);
    return r[0] ?? null;
  }

  count(table, where = '') {
    const r = this.one(`SELECT COUNT(*) AS c FROM "${table}" ${where}`);
    return Number(r?.c ?? 0);
  }

  _begin() {
    if (this._inTx) return;
    this.db.exec('BEGIN');
    this._inTx = true;
  }

  _commit() {
    if (!this._inTx) return;
    this.db.exec('COMMIT');
    this._inTx = false;
    this._pending = 0;
  }

  /** Yığılmış işi bazaya yazır. */
  flush() {
    this._commit();
    if (this.remote) this._flushRemote();
  }

  _flushRemote() {
    if (!this._remoteSql.length) return;
    const dir = join('.wrangler', 'seed-remote');
    mkdirSync(dir, { recursive: true });

    // ⚠ Remote D1 tək faylda çox böyük import qəbul etmir; ona görə paylara
    //   bölünür. Hər pay ayrıca `wrangler d1 execute` çağırışıdır.
    const PER_FILE = 5_000;
    const total = this._remoteSql.length;
    for (let i = 0; i < total; i += PER_FILE) {
      const part = this._remoteSql.slice(i, i + PER_FILE);
      const file = join(dir, `part-${String(i / PER_FILE).padStart(4, '0')}.sql`);
      writeFileSync(file, part.join('\n'), 'utf8');
      try {
        // ⚠ TƏKRAR CƏHD: `wrangler d1 execute --file` bulk import API-sini
        //   işlədir və o, keçici olaraq "Not currently importing anything."
        //   qaytara bilir (ölçüldü: 2026-08-12, ~85 000 ifadəlik qaçışın
        //   sonunda). İfadələr `INSERT OR IGNORE` olduğu üçün təkrar göndəriş
        //   təhlükəsizdir — dublikat sətir yaranmır.
        let lastErr = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            execFileSync('npx', [
              'wrangler', 'd1', 'execute', DB_NAME, '--remote', '--yes', '--file', file,
            ], {
              stdio: ['ignore', 'ignore', 'pipe'],
              shell: process.platform === 'win32',
              encoding: 'utf8',
            });
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            if (attempt < 3) {
              console.log(`  ⏳ remote cəhd ${attempt} uğursuz — təkrar edilir…`);
              execFileSync(process.execPath, ['-e', 'setTimeout(()=>{}, 5000)']);
            }
          }
        }
        if (lastErr) {
          const detail = [lastErr?.stderr, lastErr?.stdout].filter(Boolean).join('\n').slice(0, 3000);
          throw new Error(`Remote D1 yazma uğursuz (${file}):\n${detail}`, { cause: lastErr });
        }
      } finally {
        rmSync(file, { force: true });
      }
      this._remoteFlushed += part.length;
      console.log(`  ☁️  remote: +${part.length} (cəmi ${this._remoteFlushed.toLocaleString('az-AZ')} ifadə)`);
    }
    this._remoteSql = [];
  }

  close() {
    this.flush();
    // WAL-ı əsas fayla köçür: əks halda `.sqlite-wal` onlarla MB qalır və
    // növbəti oxucu (wrangler dev) onu replay etməli olur.
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* boş */ }
    this.db.close();
  }
}

/** JS dəyərini SQLite-ın qəbul etdiyi tipə çevirir. */
function normalize(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`SQLite-a sonsuz/NaN ədəd verilə bilməz: ${v}`);
    return Number.isInteger(v) ? v : v;
  }
  return v;
}

/**
 * Driver yaradır.
 *
 * ⚠ PRODUCTION GUARD burada DEYİL, çağıran skriptlərdədir (`generate.mjs`,
 *   `reset.mjs`) — guard-ı driver-ə salsaq audit/hesabat skriptləri də
 *   bloklanardı, halbuki onlar yalnız OXUYUR.
 */
export function openDb(opts) {
  return new SeedDb(opts);
}
