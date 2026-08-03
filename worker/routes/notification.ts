// Bildiriş mərkəzi domeni — siyahı, statistika, toplu əməliyyat, susdurma.
//
// ⚠ NİYƏ AYRICA MODUL: `routes.ts`-dəki üç funksiya (`listNotifs`,
//   `readNotif`, `readAllNotifs`) yalnız oxu/oxundu idi. Bildiriş mərkəzi
//   (miqrasiya 0049) arxiv, sabitləmə, prioritet, qruplaşdırma və susdurma
//   gətirir — bu, `routes.ts`-i yenidən şişirdərdi. AUDIT-TASK-10 / Faza 3.1
//   bölünmə naxışı izlənilir: domen modulu + `routes.ts`-dən re-export.
//
// 🔴 `listNotifs` GERİYƏ UYĞUNDUR: parametrsiz çağırışda (köhnə client)
//    əvvəlki cavab formasını verir — `notifications`, `hasMore`, `nextCursor`.
//    Yeni sahələr yalnız ƏLAVƏDİR.
import { Ctx, json, err, readJson, now, clampStr, fromJSON, fileUrl, placeholders } from '../util';
import { D } from './shared';
// Taksonomiya SAF moduldadır — bu fayl `shared.ts`-i, o isə
// `services/notification`-u import etdiyi üçün qaydalar burada qalsaydı dövr
// yaranardı (bax həmin faylın başlıq şərhi).
import { TYPE_BUCKETS, KNOWN_TYPES, bucketOf, groupKeyFor } from '../services/notification/taxonomy';

/* ═══════════════════════ SİYAHI ═══════════════════════ */

/** `LIKE` naxışında xüsusi simvolların neytrallaşdırılması. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m);

const mapRow = (r: any) => ({
  id: r.id,
  type: r.type,
  bucket: bucketOf(r.type),
  fromUid: r.from_id,
  fromName: r.from_name,
  postId: r.post_id,
  text: r.text,
  read: !!r.read,
  archived: !!r.archived,
  pinnedAt: r.pinned_at ?? null,
  priority: r.priority || 0,
  groupKey: r.group_key || groupKeyFor(r.type, r.from_id, r.post_id),
  createdAt: r.created_at,
});

/**
 * Bildiriş siyahısı — filtr + axtarış + kursor səhifələmə.
 *
 * Sorğu parametrləri (hamısı opsional):
 *   state=inbox|archived|all   arxiv görünüşü        (default: inbox)
 *   bucket=<səbət>             `TYPE_BUCKETS` açarı  (default: hamısı)
 *   unread=1                   yalnız oxunmamışlar
 *   q=<mətn>                   mətn/göndərən axtarışı
 *   cursor=<epoch ms>          səhifələmə
 *   limit=5..100               (default 40)
 *
 * ⚠ SABİTLƏNMİŞLƏR AXINDAN ÇIXARILIR və yalnız BİRİNCİ səhifədə ayrıca
 *   `pinned` massivində qayıdır. Səbəb: kursor `created_at`-a bağlıdır,
 *   sabitlənmişləri isə tarixdən ASILI OLMAYARAQ yuxarıda göstərmək lazımdır.
 *   Onları eyni axına qatsaydıq ya sıralama kursoru pozardı, ya da sabitlənmiş
 *   köhnə bildiriş yalnız 5-ci səhifədə görünərdi — yəni sabitləmə mənasız olardı.
 */
export async function listNotifs(c: Ctx) {
  const uid = c.user!.id;
  const p = c.url.searchParams;
  const limit = Math.min(Math.max(parseInt(p.get('limit') || '40', 10) || 40, 5), 100);
  const cursorRaw = p.get('cursor');
  const before = cursorRaw && Number.isFinite(Number(cursorRaw)) ? Number(cursorRaw) : null;

  const where: string[] = ['user_id = ?'];
  const binds: unknown[] = [uid];

  const state = p.get('state') || 'inbox';
  if (state === 'inbox') where.push('archived = 0');
  else if (state === 'archived') where.push('archived = 1');
  // `all` → arxiv filtri yoxdur (axtarış hər yerdə işləsin deyə).

  const bucket = p.get('bucket');
  if (bucket && bucket !== 'all') {
    const types = TYPE_BUCKETS[bucket];
    if (!types) return err('Naməlum bildiriş səbəti.', 400, 'bad_bucket');
    where.push(`type IN (${types.map(() => '?').join(',')})`);
    binds.push(...types);
  }

  if (p.get('unread') === '1') where.push('read = 0');

  const q = clampStr(p.get('q'), 80).trim();
  if (q) {
    // ⚠ `ESCAPE '\'` MƏCBURİDİR: istifadəçi `%` yazsa onsuz sorğu BÜTÜN
    //   sətirləri qaytarardı (naxış "hər şey" mənasına gələrdi).
    where.push("(text LIKE ? ESCAPE '\\' OR from_name LIKE ? ESCAPE '\\')");
    const pat = '%' + likeEscape(q) + '%';
    binds.push(pat, pat);
  }

  // Axın: sabitlənmişlər çıxılır (aşağıdakı ayrıca sorğuya bax).
  const streamWhere = [...where, 'pinned_at IS NULL'];
  const streamBinds = [...binds];
  if (before !== null) { streamWhere.push('created_at < ?'); streamBinds.push(before); }

  const rows = await D(c).prepare(
    `SELECT * FROM notifications WHERE ${streamWhere.join(' AND ')}
      ORDER BY created_at DESC LIMIT ?`,
  ).bind(...streamBinds, limit + 1).all<any>();

  const hasMore = rows.results.length > limit;
  const page = rows.results.slice(0, limit);

  // Sabitlənmişlər yalnız birinci səhifədə — sonrakı səhifələrdə təkrarlanmasın.
  let pinned: any[] = [];
  if (before === null) {
    const pr = await D(c).prepare(
      `SELECT * FROM notifications WHERE ${where.join(' AND ')} AND pinned_at IS NOT NULL
        ORDER BY pinned_at DESC LIMIT 20`,
    ).bind(...binds).all<any>();
    pinned = pr.results.map(mapRow);
  }

  return json({
    hasMore,
    nextCursor: hasMore && page.length ? String(page[page.length - 1].created_at) : null,
    pinned,
    // 🔴 Açar adı `notifications` OLARAQ QALIR — köhnə client onu oxuyur.
    notifications: page.map(mapRow),
    syncedAt: now(),
  });
}

/* ═══════════════════════ STATİSTİKA ═══════════════════════ */

/**
 * Başlıq sayğacları və idarə paneli kartları üçün toplu saylar.
 *
 * ⚠ NİYƏ AYRICA ENDPOINT: kartlar BÜTÜN bildirişləri saymalıdır, yüklənmiş
 *   səhifəni yox. Client-də saysaydıq "3 oxunmamış" yazardı, halbuki 240
 *   oxunmamış ola bilər — yəni sayğac sonsuz sürüşmə ilə DƏYİŞƏRDİ.
 *
 * ⚠ TƏK `GROUP BY` sorğusu, tip başına ayrı `COUNT(*)` YOX: doqquz səbət
 *   doqquz tam skan demək olardı (AUDIT-TASK-10 / Faza 4-dəki
 *   `adminStatsDaily` ilə eyni sinif qüsur).
 */
export async function notifStats(c: Ctx) {
  const uid = c.user!.id;
  const dayAgo = now() - 86400000;

  const [byType, extra] = await D(c).batch<any>([
    D(c).prepare(
      `SELECT type,
              COUNT(*)                                        AS total,
              SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END)       AS unread,
              SUM(CASE WHEN created_at >= ?2 THEN 1 ELSE 0 END) AS recent
         FROM notifications
        WHERE user_id = ?1 AND archived = 0
        GROUP BY type`,
    ).bind(uid, dayAgo),
    D(c).prepare(
      `SELECT SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END)                       AS archived,
              SUM(CASE WHEN pinned_at IS NOT NULL AND archived = 0 THEN 1 ELSE 0 END) AS pinned,
              SUM(CASE WHEN priority = 1 AND read = 0 AND archived = 0 THEN 1 ELSE 0 END) AS priority
         FROM notifications WHERE user_id = ?1`,
    ).bind(uid),
  ]);

  const buckets: Record<string, { total: number; unread: number; recent: number }> = {};
  for (const key of Object.keys(TYPE_BUCKETS)) buckets[key] = { total: 0, unread: 0, recent: 0 };
  const all = { total: 0, unread: 0, recent: 0 };

  for (const r of byType.results) {
    const b = buckets[bucketOf(r.type)];
    const total = Number(r.total) || 0;
    const unread = Number(r.unread) || 0;
    const recent = Number(r.recent) || 0;
    b.total += total; b.unread += unread; b.recent += recent;
    all.total += total; all.unread += unread; all.recent += recent;
  }

  const ex = extra.results[0] || {};
  return json({
    all,
    buckets,
    archived: Number(ex.archived) || 0,
    pinned: Number(ex.pinned) || 0,
    priority: Number(ex.priority) || 0,
    // Naməlum tip varsa client "system" kartında görəcək — sükutla itmir.
    unknownTypes: byType.results.filter(r => !KNOWN_TYPES.has(r.type)).map(r => r.type),
    syncedAt: now(),
  });
}

/* ═══════════════════════ TƏK SƏTİR ═══════════════════════ */

export async function readNotif(c: Ctx, id: string) {
  await D(c).prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .bind(id, c.user!.id).run();
  return json({ ok: true });
}

/**
 * ⚠ `read-all` YALNIZ ARXİVLƏNMƏMİŞLƏRƏ toxunur. Arxiv "işi bitmiş" qutudur;
 *   oradakı oxunmamışları da oxunmuş etsəydik istifadəçinin qəsdən arxivə
 *   atıb sonra oxumaq istədiyi bildirişlər səssizcə itərdi.
 */
export async function readAllNotifs(c: Ctx) {
  const res = await D(c).prepare(
    'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0 AND archived = 0',
  ).bind(c.user!.id).run();
  return json({ ok: true, changed: res.meta?.changes ?? 0 });
}

export async function deleteNotif(c: Ctx, id: string) {
  const res = await D(c).prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
    .bind(id, c.user!.id).run();
  return json({ ok: true, deleted: res.meta?.changes ?? 0 });
}

/* ═══════════════════════ TOPLU ƏMƏLİYYAT ═══════════════════════ */

/**
 * SQL yükü — hər əməliyyat üçün `SET` hissəsi.
 * ⚠ Sabit cədvəl, client sətri YOX: `action` birbaşa SQL-ə keçsəydi bu,
 *   inyeksiya vektoru olardı.
 */
const BULK_SQL: Record<string, string> = {
  read: 'UPDATE notifications SET read = 1',
  unread: 'UPDATE notifications SET read = 0',
  archive: 'UPDATE notifications SET archived = 1, pinned_at = NULL',
  unarchive: 'UPDATE notifications SET archived = 0',
  pin: 'UPDATE notifications SET pinned_at = ?BULKNOW, archived = 0',
  unpin: 'UPDATE notifications SET pinned_at = NULL',
  delete: 'DELETE FROM notifications',
};

/** Bir sorğuda emal edilən maksimum sətir — D1 parametr tavanı + DoS həddi. */
const BULK_MAX = 200;

/**
 * Toplu əməliyyat: seçim rejimi (`ids`) və ya bütöv qrup (`groupKey`).
 *
 * Gövdə: `{ action, ids?: string[], groupKey?: string }`
 *
 * ⚠ `user_id = ?` HƏR sorğuda var — `ids` client-dən gəlir və başqasının
 *   bildirişinin id-si göndərilə bilər (IDOR). Sahiblik yoxlaması filtrdədir,
 *   ayrıca SELECT ilə deyil: iki addım yarış şəraiti yaradardı.
 */
export async function bulkNotifs(c: Ctx) {
  const b = await readJson(c.req);
  const action = String(b?.action || '');
  const tpl = BULK_SQL[action];
  if (!tpl) return err('Naməlum əməliyyat.', 400, 'bad_action');

  const uid = c.user!.id;
  const set = tpl.replace('?BULKNOW', String(now()));

  const groupKey = clampStr(b?.groupKey, 200);
  if (groupKey) {
    const res = await D(c).prepare(`${set} WHERE user_id = ? AND group_key = ?`)
      .bind(uid, groupKey).run();
    return json({ ok: true, changed: res.meta?.changes ?? 0 });
  }

  const ids = Array.isArray(b?.ids) ? b.ids.filter((x: unknown) => typeof x === 'string').slice(0, BULK_MAX) : [];
  if (!ids.length) return err('Seçim boşdur.', 400, 'empty_selection');

  const res = await D(c).prepare(
    `${set} WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
  ).bind(uid, ...ids).run();
  return json({ ok: true, changed: res.meta?.changes ?? 0 });
}

/* ═══════════════════════ ÖNİZLƏMƏ ═══════════════════════ */

/** Bir sorğuda ən çox neçə paylaşımın önizləməsi — bir ekran dolusu qədər. */
const PREVIEW_MAX = 40;

/**
 * Bildirişlərin bağlı olduğu paylaşımların ÖNİZLƏMƏSİ (mətn parçası + şəkil).
 *
 * ⚠ NİYƏ TOPLU ENDPOINT: bildiriş sətri yalnız feli ifadə saxlayır
 *   ("paylaşımını bəyəndi") — hansı paylaşım olduğu görünmür. Hər sətir üçün
 *   ayrıca `/posts/:id` çağırsaydıq bir ekran 40 sorğu deməkdir (N+1).
 *   Bu endpoint eyni ekranı BİR sorğuya yığır və client onu tənbəl çağırır.
 *
 * 🔴 GÖRÜNÜŞ YOXLAMASI MƏCBURİDİR: `post_id` bildiriş sətrindən gəlir, amma
 *    paylaşım sonradan GİZLİ (`visibility`) və ya moderasiya ilə gizlədilmiş
 *    (`hidden_at`) ola bilər. Yoxlamasız bu endpoint gizlədilmiş məzmunun
 *    mətnini sızdıran yan qapı olardı. Öz paylaşımın həmişə görünür — bildiriş
 *    onsuz da sənin paylaşımın haqqındadır.
 */
export async function notifPreviews(c: Ctx) {
  const raw = clampStr(c.url.searchParams.get('ids'), 2000);
  const ids = [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))].slice(0, PREVIEW_MAX);
  if (!ids.length) return json({ previews: {} });

  const rows = await D(c).prepare(
    `SELECT id, author_id, text, image_keys, visibility, hidden_at
       FROM posts WHERE id IN (${placeholders(ids.length)})`,
  ).bind(...ids).all<any>();

  const previews: Record<string, { excerpt: string; image: string | null }> = {};
  for (const r of rows.results) {
    const visible = r.author_id === c.user!.id || (r.visibility === 'public' && !r.hidden_at);
    if (!visible) continue;
    const keys = fromJSON<string[]>(r.image_keys, []);
    previews[r.id] = {
      // 160 simvol: iki sətir mətn kifayətdir, daha çoxu kartı şişirdərdi.
      excerpt: clampStr(r.text, 160),
      image: Array.isArray(keys) && keys.length ? fileUrl(keys[0]) : null,
    };
  }
  return json({ previews });
}

/* ═══════════════════════ SUSDURMA ═══════════════════════ */

const MUTE_SCOPES = new Set(['type', 'user', 'thread', 'team', 'project']);

export async function listMutes(c: Ctx) {
  const rows = await D(c).prepare(
    'SELECT scope, target, created_at FROM notification_mutes WHERE user_id = ? ORDER BY created_at DESC',
  ).bind(c.user!.id).all<any>();
  return json({ mutes: rows.results.map(r => ({ scope: r.scope, target: r.target, createdAt: r.created_at })) });
}

/**
 * Susdurma açarı — `{ scope, target, muted }`.
 *
 * ⚠ TOGGLE, ayrı `DELETE` marşrutu YOX: `DELETE` gövdə ilə göndərilməli
 *   olardı (scope+target birlikdə açardır) və bəzi proxy-lər gövdəli DELETE-i
 *   kəsir. Tək POST hər iki istiqaməti daşıyır.
 */
export async function toggleMute(c: Ctx) {
  const b = await readJson(c.req);
  const scope = String(b?.scope || '');
  const target = clampStr(b?.target, 200);
  if (!MUTE_SCOPES.has(scope)) return err('Naməlum susdurma sahəsi.', 400, 'bad_scope');
  if (!target) return err('Hədəf boşdur.', 400, 'empty_target');

  if (b?.muted === false) {
    await D(c).prepare('DELETE FROM notification_mutes WHERE user_id = ? AND scope = ? AND target = ?')
      .bind(c.user!.id, scope, target).run();
    return json({ ok: true, muted: false });
  }

  await D(c).prepare(
    `INSERT INTO notification_mutes (user_id, scope, target, created_at) VALUES (?,?,?,?)
     ON CONFLICT(user_id, scope, target) DO NOTHING`,
  ).bind(c.user!.id, scope, target, now()).run();
  return json({ ok: true, muted: true });
}
