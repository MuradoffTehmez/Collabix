// Süni arxiv datası — AUDIT-TASK-8 §8.9.
//
// ⚠ NİYƏ LAZIMDIR: `ARCHIVE_HOT_DAYS = "3650"` (AUDIT-TASK-1 / C-3) olduğu üçün
// Task 1-dən bəri REAL arxivləmə baş verməyib — istehsal R2-sində `archive/`
// prefiksi altında **sıfır obyekt** var (2026-07-28 inventarı). Yəni oxu yolunu
// (§8.1, §8.2) test etmək üçün data süni yaradılmalıdır.
//
// ⚠ ƏL İLƏ JSON QURULMUR. Arxiv obyekti YAZI YOLUNUN ÖZ funksiyası ilə
// (`worker/archive.ts` → `archiveKind`, cron vasitəsilə) yaradılır. Səbəb —
// Task 7 §8/1 dərsi (`photo_url` ikiqat prefiks): əl ilə qurulmuş struktur
// real formatdan gizli fərqlə ayrıla bilər və test YALANÇI YAŞIL verər.
// Burada test etdiyimiz format məhz istehsalda yazılacaq formatdır.
//
// Test mühitində `ARCHIVE_HOT_DAYS:90`-dır (bax playwright.config.ts), ona görə
// "köhnə" mesajlar 90 gündən artıq geridə olmalıdır.
import { d1 } from './seed';

/** Test mühitindəki isti pəncərə (playwright.config.ts → --var ARCHIVE_HOT_DAYS:90). */
export const TEST_HOT_DAYS = 90;

/** Arxivə düşməsi zəmanətli yaş (isti pəncərədən xeyli köhnə). */
export const ARCHIVED_AGE_MS = 200 * 86400000;
/** İsti pəncərədə qalması zəmanətli yaş. */
export const LIVE_AGE_MS = 2 * 86400000;

export interface SeedArchiveOpts {
  /** Otaq id-si (`rooms` + `room_messages`). */
  roomId: string;
  /** Arxivə düşəcək (köhnə) mesaj sayı. */
  oldCount: number;
  /** D1-də qalacaq (yeni) mesaj sayı. */
  newCount: number;
  /** Mesaj müəllifi — `deleted_uids` filtri testləri üçün dəyişdirilir. */
  authorId?: string;
  authorName?: string;
  /** Açar prefiksi — eyni otaqda iki dəst qarışmasın. */
  tag?: string;
  /**
   * Otağın GÖRÜNƏN adı. UI testləri otağı siyahıdan ada görə seçir, ona görə
   * hər test otağının adı UNİKAL olmalıdır — əks halda `getByText(...).first()`
   * səhv otağı açır və test yanlış səbəbdən sınır (məhz belə oldu).
   */
  roomName?: string;
}

export function queryJson(sql: string): any[] {
  const raw = d1(sql, true);
  const start = raw.indexOf('[');
  if (start < 0) return [];
  try { return JSON.parse(raw.slice(start))?.[0]?.results ?? []; } catch { return []; }
}

/**
 * Otaq mesajlarını D1-ə yazır. Cron HƏLƏ İŞLƏDİLMİR — çağıran tərəf
 * `/__scheduled`-i özü tetikləyir (bir cron qaçışı bir neçə scope-u birdən
 * arxivləyə bilsin deyə).
 *
 * İdempotentdir (Task 5 qaydası): eyni otağın əvvəlki sətirləri və katalog
 * qeydləri silinir, yəni test miqrasiya tarixçəsindən və əvvəlki qaçışlardan
 * asılı olmur.
 */
export function seedRoomMessages(o: SeedArchiveOpts): { oldIds: string[]; newIds: string[] } {
  const tag = o.tag || 'a8';
  const uid = o.authorId || 'e2e_arch_author';
  const name = o.authorName || 'Arxiv Müəllifi';
  const oldTs = Date.now() - ARCHIVED_AGE_MS;
  const newTs = Date.now() - LIVE_AGE_MS;

  const oldIds: string[] = [];
  const newIds: string[] = [];
  const sql: string[] = [
    `INSERT OR IGNORE INTO rooms (id, name, created_by, created_at) ` +
    `VALUES ('${o.roomId}', '${o.roomName || 'Arxiv oxu testi'}', 'system', ${oldTs});`,
    // Ad dəyişə bilər (otaq artıq mövcuddursa `INSERT OR IGNORE` toxunmur).
    `UPDATE rooms SET name = '${o.roomName || 'Arxiv oxu testi'}' WHERE id = '${o.roomId}';`,
    `DELETE FROM room_messages WHERE room_id = '${o.roomId}';`,
    `DELETE FROM message_archives WHERE scope_id = '${o.roomId}';`,
  ];

  // ⚠ `created_at` ARDICIL və UNİKAL olmalıdır: sərhəd testi (§8.10) mesajların
  // sırasını və dublikatsızlığını məhz bu zaman möhürlərinə görə yoxlayır.
  for (let i = 0; i < o.oldCount; i++) {
    const id = `${tag}-old-${i}`;
    oldIds.push(id);
    sql.push(
      `INSERT INTO room_messages (id, room_id, author_id, author_name, type, text, created_at) ` +
      `VALUES ('${id}', '${o.roomId}', '${uid}', '${name}', 'text', 'arxiv mesajı ${i}', ${oldTs + i * 1000});`);
  }
  for (let i = 0; i < o.newCount; i++) {
    const id = `${tag}-new-${i}`;
    newIds.push(id);
    sql.push(
      `INSERT INTO room_messages (id, room_id, author_id, author_name, type, text, created_at) ` +
      `VALUES ('${id}', '${o.roomId}', '${uid}', '${name}', 'text', 'canlı mesaj ${i}', ${newTs + i * 1000});`);
  }
  d1(sql.join('\n'));
  return { oldIds, newIds };
}

/** DM variantı — `dm_threads` + `dm_messages`, scope = `pair_id`. */
export function seedDmMessages(pairId: string, opts: {
  oldCount: number; newCount: number; fromId: string; toId: string; tag?: string;
}): { oldIds: string[]; newIds: string[] } {
  const tag = opts.tag || 'a8dm';
  const oldTs = Date.now() - ARCHIVED_AGE_MS;
  const newTs = Date.now() - LIVE_AGE_MS;
  const [a, b] = pairId.split('_');

  const oldIds: string[] = [];
  const newIds: string[] = [];
  const sql: string[] = [
    `INSERT OR IGNORE INTO dm_threads (pair_id, user_a, user_b, last_at) ` +
    `VALUES ('${pairId}', '${a}', '${b}', ${newTs});`,
    `DELETE FROM dm_messages WHERE pair_id = '${pairId}';`,
    `DELETE FROM message_archives WHERE scope_id = '${pairId}';`,
  ];
  for (let i = 0; i < opts.oldCount; i++) {
    const id = `${tag}-old-${i}`;
    oldIds.push(id);
    sql.push(
      `INSERT INTO dm_messages (id, pair_id, from_id, to_id, type, text, created_at) ` +
      `VALUES ('${id}', '${pairId}', '${opts.fromId}', '${opts.toId}', 'text', 'arxiv dm ${i}', ${oldTs + i * 1000});`);
  }
  for (let i = 0; i < opts.newCount; i++) {
    const id = `${tag}-new-${i}`;
    newIds.push(id);
    sql.push(
      `INSERT INTO dm_messages (id, pair_id, from_id, to_id, type, text, created_at) ` +
      `VALUES ('${id}', '${pairId}', '${opts.fromId}', '${opts.toId}', 'text', 'canlı dm ${i}', ${newTs + i * 1000});`);
  }
  d1(sql.join('\n'));
  return { oldIds, newIds };
}

/** Verilən scope üçün arxiv kataloq sətri yarandımı? (cron-un nəticəsi) */
export function archiveMetaFor(scopeId: string): any[] {
  return queryJson(
    `SELECT kind, scope_id, msg_count, bytes, r2_key, from_ts, to_ts ` +
    `FROM message_archives WHERE scope_id = '${scopeId}';`);
}
