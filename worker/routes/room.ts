// Otaq, DM və presence domeni — AUDIT-TASK-10 / Faza 3.1.
//
// ⚠ PRESENCE bölməsi burada qalır: onun D1 yolu otaq/DM axını ilə eyni
//   polling modelinə bağlıdır (bax həmin bölmənin şərhi — iki presence
//   sisteminin izahı).
import {
  Ctx, json, err, readJson, uuid, now, clampStr, fromJSON,
  pairIdFor, mapMsg, fileUrl,
} from '../util';
import { sanitizeMsg } from '../msg';
import { readArchive, deletedUidSet } from '../archive';
import { rateLimit } from '../auth';
import {
  D, badReq, notify, notifyMentions, roomBroadcast, userPush, bumpActivity,
} from './shared';

/* ================= ROOMS ================= */
export async function listRooms(c: Ctx) {
  // TASK-11: komanda otaqları (`team_chat_rooms`) qlobal `rooms` cədvəlini
  // paylaşır — RoomDO və mesaj API-si tək modeldən işləsin deyə. Amma onlar
  // QLOBAL söhbət siyahısında görünməməlidir: hər komanda 5 otaqla gəlir və
  // siyahı tanımadığı otaqlarla dolardı (üstəlik ad sızıntısı olardı).
  const rows = await D(c).prepare(
    `SELECT r.* FROM rooms r
      WHERE NOT EXISTS (SELECT 1 FROM team_chat_rooms t WHERE t.id = r.id)
      ORDER BY r.created_at ASC`
  ).all<any>();
  // `icon_key` R2 açarıdır; URL serverdə qurulur (bax miqrasiya 0048).
  return json({ rooms: rows.results.map(r => ({
    id: r.id, name: r.name, createdAt: r.created_at,
    iconUrl: r.icon_key ? fileUrl(r.icon_key) : null,
  })) });
}

/**
 * Otaq ikonunu dəyişir (yalnız `MANAGE_ROOMS` icazəsi olanlar — marşrutda).
 *
 * ⚠ Açar CLIENT-DƏN gəlir, ona görə FORMAT MƏCBURİ yoxlanılır: yalnız
 *   `avatars/…` prefiksi qəbul edilir. Əks halda istifadəçi ixtiyari R2
 *   açarını (məs. `archive/…` və ya başqasının `msgfiles/…` faylını) otaq
 *   ikonu kimi yazıb onu PUBLİK oxunan yerə bağlaya bilərdi — `avatars/`
 *   `canReadKey`-də publik sürətli yoldur.
 * ⚠ `null` göndərmək ikonu SİLİR (inisial avatarına qayıdır).
 */
export async function patchRoom(c: Ctx, roomId: string) {
  const b = await readJson(c.req);
  const raw = b?.iconKey;
  if (raw !== null && typeof raw !== 'string') return badReq('iconKey sətir və ya null olmalıdır.');
  const iconKey = raw === null ? null : String(raw);
  if (iconKey !== null && !/^avatars\/[\w-]+\/[\w.-]+$/.test(iconKey)) {
    return badReq('Yalnız `avatars/` açarı qəbul olunur.');
  }
  const room = await D(c).prepare('SELECT id FROM rooms WHERE id = ?').bind(roomId).first<any>();
  if (!room) return err('Tapılmadı.', 404);
  await D(c).prepare('UPDATE rooms SET icon_key = ? WHERE id = ?').bind(iconKey, roomId).run();
  return json({ ok: true, iconUrl: iconKey ? fileUrl(iconKey) : null });
}
export async function createRoom(c: Ctx) {
  const b = await readJson(c.req);
  const name = clampStr(b.name, 40).trim();
  if (!name) return badReq('Ad boşdur.');
  await D(c).prepare('INSERT INTO rooms (id, name, created_by, created_at) VALUES (?,?,?,?)')
    .bind(uuid(), name, c.user!.id, now()).run();
  return json({ ok: true });
}
export async function deleteRoom(c: Ctx, id: string) {
  if (id === 'general') return badReq('Ümumi otaq silinə bilməz.');
  await D(c).prepare('DELETE FROM rooms WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ⚠ `room-do.ts`-dəki `INSERT_SQL` ilə SIRA ÜZRƏ EYNİ olmalıdır — mesajın iki
//   yazma yolu var (REST və WS/DO) və onlar ayrılsa sütunlar sürüşər.
const MSG_COLS = '(id, room_id, author_id, author_name, type, text, file_key, file_name, file_size, mime_type, language, created_at, reply_to)';

/**
 * TASK-11 — komanda otağı qapısı.
 *
 * `team_chat_rooms` qlobal `rooms` cədvəlini paylaşır, ona görə otaq id-si
 * bilinən hər kəs komandanın MƏXFİ söhbətini oxuya/yaza bilərdi. Otaq hansısa
 * komandaya aiddirsə, sorğu sahibi həmin komandanın aktiv üzvü olmalıdır.
 * Komandaya aid olmayan otaqlar (qlobal söhbət) toxunulmaz qalır.
 */
export async function guardTeamRoom(c: Ctx, roomId: string): Promise<Response | null> {
  const room = await D(c).prepare('SELECT team_id FROM team_chat_rooms WHERE id = ?').bind(roomId).first<any>();
  if (!room) return null;                       // qlobal otaq
  if (c.isAdmin) return null;
  const member = await D(c).prepare(
    "SELECT 1 AS x FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'",
  ).bind(room.team_id, c.user!.id).first<any>();
  return member ? null : err('Bu otaq komandaya aiddir — üzv deyilsiniz.', 403, 'forbidden');
}

/* ---------- D1 + arxiv birləşdirilmiş mesaj oxusu (AUDIT-TASK-8 §8.1/§8.2) ---------- */

const MSG_PAGE_DEFAULT = 120;
const MSG_PAGE_MAX = 200;

const pageSize = (c: Ctx, dflt = MSG_PAGE_DEFAULT) => {
  const n = parseInt(c.url.searchParams.get('limit') || '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MSG_PAGE_MAX) : dflt;
};
/** `?before=<ms>` — keyset paginasiya kursoru. Yoxdursa "ən son səhifə". */
const beforeCursor = (c: Ctx): number | null => {
  const raw = c.url.searchParams.get('before');
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Mesaj səhifəsini D1-dən, çatmazsa arxivdən oxuyur — AUDIT C-3.
 *
 * ⚠ NİYƏ BU FUNKSİYA VAR: `readArchive()` Task 8-ə qədər yazılmışdı, lakin
 * HEÇ YERDƏN ÇAĞIRILMIRDI. Yəni `ARCHIVE_HOT_DAYS` geri qaytarılan kimi
 * istifadəçilər 90 gündən köhnə tarixçəni İTİRMİŞ görəcəkdilər — data R2-də
 * qalır, məhsul vasitəsilə isə bərpa edilə bilmirdi.
 *
 * ⚠ TASK 7 SƏRHƏDİ: arxiv SERVER TƏRƏFDƏ oxunur və R2 açarı cavaba DÜŞMÜR.
 * `/files/archive/…` `canReadKey`-də admin ilə bağlı qalır (files-auth.ts).
 *
 * ⚠ AVTORİZASİYA ÇAĞIRAN TƏRƏFDƏDİR və arxivə müraciətdən ƏVVƏL edilmiş olmalıdır.
 *
 * Axın: D1 (n+1) → az gəlibsə arxiv (qalan+1) → birləşdir → dedupe → sırala → kəs.
 */
async function readMessagePage(
  c: Ctx,
  opts: {
    kind: 'room' | 'dm';
    scopeId: string;
    limit: number;
    before: number | null;
    /** D1 sorğusu — `before` tətbiq olunmuş halda. */
    sql: string;
    binds: unknown[];
    map: (r: any) => any;
  },
): Promise<{ messages: any[]; hasMore: boolean; source: string; failed: boolean } | Response> {
  const { kind, scopeId, limit, before } = opts;
  // Bir artıq çəkirik: "daha köhnəsi varmı?" sualına ƏLAVƏ sorğu olmadan cavab.
  const probe = limit + 1;

  const live = await D(c).prepare(opts.sql).bind(...opts.binds, probe).all<any>();
  const liveRows = live.results;

  let archived: any[] = [];
  let failed = false;
  let usedArchive = false;

  // Arxiv kursoru: D1-in ƏN KÖHNƏ sətrindən geri. D1 boşdursa `before`
  // (yoxdursa "indi") götürülür.
  const oldestLive = liveRows.length ? Number(liveRows[liveRows.length - 1].created_at) : null;
  const cursor = oldestLive ?? before ?? Date.now();

  // D1 səhifəni doldura bilmədisə arxivdə davamı ola bilər.
  let archiveHasMore = false;
  if (liveRows.length < probe) {
    // ⚠ ƏVVƏLCƏ UCUZ YOXLAMA: bu scope üçün ümumiyyətlə arxiv varmı?
    // İndeksli D1 sorğusudur (`idx_archives_scope`) — nə R2-yə dəyir,
    // nə də rate limit yeyir.
    archiveHasMore = !!(await D(c).prepare(
      'SELECT 1 AS x FROM message_archives WHERE kind = ? AND scope_id = ? AND from_ts < ? LIMIT 1',
    ).bind(kind, scopeId, cursor).first<any>());
  }

  // 🔴 ARXİVƏ YALNIZ AÇIQ `before` İLƏ GEDİLİR.
  //
  // Əvvəlki versiya `liveRows.length < probe` şərti ilə kifayətlənirdi və bu,
  // ciddi qüsur idi: az mesajlı otaqda (D1-də `limit`-dən az sətir) HƏR 3
  // saniyəlik poll arxiv yoluna girirdi. Nəticə — hər poll bir R2 sorğusu +
  // gzip açılması, üstəlik `archive` səbəti (120/saat) 6 dəqiqəyə dolur və
  // istifadəçi ADİ söhbətdə 429 alırdı.
  //
  // İndi: ən son səhifə (`before` yoxdur) TAM ucuzdur — yalnız D1. Arxivin
  // mövcudluğu `hasMore` ilə bildirilir, client "Daha köhnə mesajlar"a
  // basanda `before` göndərir və məhz onda arxiv oxunur.
  if (archiveHasMore && before !== null) {
    // Arxiv oxusu bahalıdır (R2 sorğusu + gzip) → ayrıca səbət. Adi mesaj
    // oxusu (bu budağa girməyən) `read` səbətində qalır və toxunulmur.
    const rl = await rateLimit(c.env, c.req, 'archive', c.user!.id);
    if (!rl.ok) {
      const res = err('Arxivdən oxu limiti aşıldı.', 429, 'rate_limited');
      res.headers.set('Retry-After', String(rl.retryAfter));
      return res;
    }
    usedArchive = true;
    const need = probe - liveRows.length;
    const res = await readArchive(c.env, kind, scopeId, cursor, need, {
      // §8.6 — silinmiş hesabın mesajları oxu yolunda görünmür (GDPR Art. 17).
      excludeUids: await deletedUidSet(c.env),
    });
    archived = res.messages;
    failed = res.failed;
  }

  // ⚠ DEDUPE MƏCBURİDİR: cron R2-yə yazıb D1 silməsi yarımçıq qalarsa eyni
  // mesaj hər iki mənbədə olur (`archive.ts` qəsdən əvvəl R2-yə yazır — əks
  // sıra data itkisi riski yaradardı). Dublikat UI-da ikiqat mesaj göstərərdi.
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const r of [...liveRows, ...archived]) {
    const id = String(r.id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(r);
  }
  merged.sort((a, b) => Number(b.created_at) - Number(a.created_at));

  // `hasMore`: ya əlimizdə artıq sətir var, ya da arxivdə davamı var.
  // İkinci şərt ən son səhifə üçün vacibdir — orada arxivə getmirik, lakin
  // "Daha köhnə mesajlar" düyməsi göstərilməlidir.
  let hasMore = merged.length > limit || (archiveHasMore && !usedArchive);
  const page = merged.slice(0, limit);

  // ⚠ KƏNAR HAL: `readArchive` bir sorğuda ən çoxu 3 obyekt açır (yaddaş
  // qorunması). Həmin 3 obyekt səhifəni doldura bilməsə, DAHA KÖHNƏ 4-cü
  // obyekt hələ də mövcud ola bilər — bu halda `hasMore: false` demək
  // tarixçəni səhvən kəsərdi. Ucuz, indeksli yoxlama ilə təsdiqləyirik.
  if (usedArchive && !hasMore && page.length) {
    const oldest = Number(page[page.length - 1].created_at);
    hasMore = !!(await D(c).prepare(
      'SELECT 1 AS x FROM message_archives WHERE kind = ? AND scope_id = ? AND from_ts < ? LIMIT 1',
    ).bind(kind, scopeId, oldest).first<any>());
  }

  // Boşluq diaqnostikası: arxivə getdik, lakin heç nə tapmadıq və D1 də
  // dolmadı → ya həqiqətən söhbətin başlanğıcıdır, ya da cron D1-dən silib
  // R2-yə yazmayıb. İkincisi data itkisidir və SÜKUTLA keçməməlidir (§8.1).
  if (usedArchive && !failed && !archived.length && liveRows.length < limit) {
    console.log('arxiv boşluğu?', JSON.stringify({
      kind, scope: scopeId, live: liveRows.length, limit,
    }));
  }

  return {
    // Client ASC gözləyir (mövcud davranış) — sıra dəyişdirilmir.
    messages: page.slice().reverse().map(opts.map),
    hasMore,
    // ⚠ YALNIZ diaqnostika/telemetriya üçün. Client məntiqi buna GÜVƏNMƏSİN —
    // sərhəd səhifəsi hər iki mənbədən gəlir və dəyər 'mixed' olur.
    source: !usedArchive ? 'live' : (liveRows.length ? 'mixed' : 'archive'),
    failed,
  };
}

export async function roomMessages(c: Ctx, roomId: string) {
  const denied = await guardTeamRoom(c, roomId);
  if (denied) return denied;

  const limit = pageSize(c);
  const before = beforeCursor(c);
  const res = await readMessagePage(c, {
    kind: 'room', scopeId: roomId, limit, before,
    sql: before
      ? 'SELECT * FROM room_messages WHERE room_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM room_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?',
    binds: before ? [roomId, before] : [roomId],
    map: r => mapMsg(r),
  });
  if (res instanceof Response) return res;
  // §5.3 — R2 xətası "boş"dan AYRILIR: boş qaytarsaydıq UI "söhbətin
  // başlanğıcı" göstərər və istifadəçi datanın itdiyini düşünərdi.
  if (res.failed) return err('Arxiv oxunmadı, yenidən cəhd edin.', 502, 'archive_unavailable');
  await attachReactions(c, 'room', res.messages);
  return json({ messages: res.messages, hasMore: res.hasMore, source: res.source });
}
export async function sendRoomMessage(c: Ctx, roomId: string) {
  const denied = await guardTeamRoom(c, roomId);
  if (denied) return denied;

  const b = await readJson(c.req);
  const m = sanitizeMsg(b, c.user!.id);
  if (!m) return badReq('Mesaj boşdur.');
  await D(c).prepare(`INSERT INTO room_messages ${MSG_COLS} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uuid(), roomId, c.user!.id, c.user!.name, m.type, m.text, m.fileKey, m.fileName, m.fileSize, m.mimeType, m.language, now(), m.replyTo).run();
  await bumpActivity(c);
  if (m.text) await notifyMentions(c, m.text, 'səni otaqda qeyd etdi');
  await roomBroadcast(c, roomId, { t: 'refresh' });
  return json({ ok: true });
}
export async function editRoomMessage(c: Ctx, roomId: string, mid: string) {
  const b = await readJson(c.req);
  const row = await D(c).prepare('SELECT author_id FROM room_messages WHERE id = ?').bind(mid).first<any>();
  if (!row) return err('Tapılmadı.', 404);
  if (row.author_id !== c.user!.id) return err('İcazə yoxdur.', 403, 'forbidden');
  await D(c).prepare('UPDATE room_messages SET text = ?, edited_at = ? WHERE id = ?')
    .bind(clampStr(b.text, 8000), now(), mid).run();
  await roomBroadcast(c, roomId, { t: 'refresh' });
  return json({ ok: true });
}
export async function deleteRoomMessage(c: Ctx, roomId: string, mid: string) {
  const row = await D(c).prepare('SELECT author_id, file_key FROM room_messages WHERE id = ?').bind(mid).first<any>();
  if (!row) return json({ ok: true });
  if (row.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  if (row.file_key) await c.env.FILES.delete(row.file_key).catch(() => {});
  await D(c).prepare('DELETE FROM room_messages WHERE id = ?').bind(mid).run();
  await roomBroadcast(c, roomId, { t: 'refresh' });
  return json({ ok: true });
}

// `sanitizeMsg` PAYLAŞILAN `./msg` modulundadır — REST və WebSocket (RoomDO)
// yolları eyni qaydaları işlətməlidir. Bax msg.ts-dəki izah.

/* ================= DM ================= */
export async function listThreads(c: Ctx) {
  const uid = c.user!.id;
  const rows = await D(c).prepare(
    'SELECT * FROM dm_threads WHERE user_a = ? OR user_b = ? ORDER BY last_at DESC LIMIT 100',
  ).bind(uid, uid).all<any>();
  return json({
    threads: rows.results.map(r => ({
      id: r.pair_id, users: [r.user_a, r.user_b],
      lastMsg: r.last_msg, lastFrom: r.last_from, lastAt: r.last_at,
      readAt: { [r.user_a]: r.read_a, [r.user_b]: r.read_b },
    })),
  });
}

export async function dmMessages(c: Ctx, pairId: string) {
  // ⚠ AVTORİZASİYA ARXİVDƏN ƏVVƏL. `pairId` `pairIdFor()` ilə normallaşdırılmış
  // `min_max` cütlüyüdür; iştirakçı olmayan onu təxmin etsə belə keçə bilməz.
  if (!pairId.split('_').includes(c.user!.id)) return err('İcazə yoxdur.', 403, 'forbidden');

  const limit = pageSize(c, 150);
  const before = beforeCursor(c);
  const res = await readMessagePage(c, {
    kind: 'dm', scopeId: pairId, limit, before,
    sql: before
      ? 'SELECT * FROM dm_messages WHERE pair_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM dm_messages WHERE pair_id = ? ORDER BY created_at DESC LIMIT ?',
    binds: before ? [pairId, before] : [pairId],
    // Bloklanmış istifadəçi siyasəti: mövcud `dmMessages` davranışı TƏKRARLANIR
    // (DM iki nəfərlik söhbətdir və filtr yox idi) — yenisi icad edilmir.
    map: r => mapMsg(r, true),
  });
  if (res instanceof Response) return res;
  if (res.failed) return err('Arxiv oxunmadı, yenidən cəhd edin.', 502, 'archive_unavailable');
  await attachReactions(c, 'dm', res.messages);
  return json({ messages: res.messages, hasMore: res.hasMore, source: res.source });
}

export async function sendDM(c: Ctx, toUid: string) {
  const me = c.user!;
  if (toUid === me.id) return badReq('Özünə DM göndərə bilməzsən.');
  const target = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(toUid).first<any>();
  if (!target || target.blocked) return err('İstifadəçi tapılmadı.', 404);

  // whoCanMessage siyasəti (server tərəfdə məcburi)
  const pol = fromJSON<any>(target.settings, {})?.privacy?.whoCanMessage || 'everyone';
  if (pol !== 'everyone' && !c.isAdmin) {
    const theyFollowMe = await D(c).prepare('SELECT 1 FROM follows WHERE follower_id = ? AND target_id = ?')
      .bind(toUid, me.id).first();
    if (!theyFollowMe) return err('Bu istifadəçi yalnız izlədiyi şəxslərdən mesaj qəbul edir.', 403, 'forbidden');
    if (pol === 'mutual') {
      const iFollow = await D(c).prepare('SELECT 1 FROM follows WHERE follower_id = ? AND target_id = ?')
        .bind(me.id, toUid).first();
      if (!iFollow) return err('Bu istifadəçi yalnız qarşılıqlı izləyənlərdən mesaj qəbul edir.', 403, 'forbidden');
    }
  }

  const b = await readJson(c.req);
  const m = sanitizeMsg(b, me.id);
  if (!m) return badReq('Mesaj boşdur.');
  const pairId = pairIdFor(me.id, toUid);
  const [a, bUid] = pairId.split('_');
  const preview = m.type === 'text' ? m.text.slice(0, 80)
    : m.type === 'image' ? '🖼 şəkil' : m.type === 'code' ? '</> kod' : '📎 ' + (m.fileName || 'fayl');
  const readCol = me.id === a ? 'read_a' : 'read_b';
  await D(c).batch([
    D(c).prepare(
      `INSERT INTO dm_threads (pair_id, user_a, user_b, last_msg, last_from, last_at, ${readCol}) VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(pair_id) DO UPDATE SET last_msg = ?, last_from = ?, last_at = ?, ${readCol} = ?`,
    ).bind(pairId, a, bUid, preview, me.id, now(), now(), preview, me.id, now(), now()),
    D(c).prepare(
      'INSERT INTO dm_messages (id, pair_id, from_id, to_id, type, text, file_key, file_name, file_size, mime_type, language, created_at, reply_to) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ).bind(uuid(), pairId, me.id, toUid, m.type, m.text, m.fileKey, m.fileName, m.fileSize, m.mimeType, m.language, now(), m.replyTo),
  ]);
  await notify(c, toUid, 'dm', 'sənə mesaj yazdı');
  await dmPush(c, pairId);
  await bumpActivity(c);
  return json({ ok: true });
}

// DM dəyişikliyində (yeni / redaktə / sil) hər iki tərəfin açıq tablarına siqnal.
// Göndərənin özünə də gedir ki, digər tabları sinxron qalsın.
async function dmPush(c: Ctx, pairId: string): Promise<void> {
  for (const uid of pairId.split('_')) await userPush(c, uid, { t: 'dm', pairId });
}

export async function editDM(c: Ctx, _pairId: string, mid: string) {
  const b = await readJson(c.req);
  // pair_id sətirdən oxunur (marşrut parametri client-dəndir — ona güvənmirik).
  const row = await D(c).prepare('SELECT from_id, pair_id FROM dm_messages WHERE id = ?').bind(mid).first<any>();
  if (!row) return err('Tapılmadı.', 404);
  if (row.from_id !== c.user!.id) return err('İcazə yoxdur.', 403, 'forbidden');
  await D(c).prepare('UPDATE dm_messages SET text = ?, edited_at = ? WHERE id = ?')
    .bind(clampStr(b.text, 8000), now(), mid).run();
  await dmPush(c, row.pair_id);
  return json({ ok: true });
}
export async function deleteDMMsg(c: Ctx, _pairId: string, mid: string) {
  const row = await D(c).prepare('SELECT from_id, file_key, pair_id FROM dm_messages WHERE id = ?').bind(mid).first<any>();
  if (!row) return json({ ok: true });
  if (row.from_id !== c.user!.id) return err('İcazə yoxdur.', 403, 'forbidden');
  if (row.file_key) await c.env.FILES.delete(row.file_key).catch(() => {});
  await D(c).prepare('DELETE FROM dm_messages WHERE id = ?').bind(mid).run();
  await dmPush(c, row.pair_id);
  return json({ ok: true });
}
export async function markThreadRead(c: Ctx, pairId: string) {
  const [a] = pairId.split('_');
  if (!pairId.split('_').includes(c.user!.id)) return err('İcazə yoxdur.', 403, 'forbidden');
  const col = c.user!.id === a ? 'read_a' : 'read_b';
  await D(c).prepare(`UPDATE dm_threads SET ${col} = ? WHERE pair_id = ?`).bind(now(), pairId).run();
  return json({ ok: true });
}

/* ================= SABİTLƏNMİŞ (PINNED) MESAJLAR — miqrasiya 0046 =================
 *
 * 🔴 İCAZƏ MODELİ QƏSDƏN ASİMMETRİKDİR — otaq ilə DM eyni şey deyil:
 *
 *   OTAQ  → yalnız `c.isAdmin`. Sabitlənmiş mesaj BÜTÜN otağa göstərilir, yəni
 *           bu, moderasiya əməliyyatıdır. Hər müəllif öz mesajını sabitləyə
 *           bilsəydi, panel spam kanalına çevrilərdi.
 *           ⚠ Komanda otaqlarında sahib/admin-in sabitləməsi HƏLƏ YOXDUR:
 *             bunun üçün komanda RBAC-ı (`hasPermission`) bu modula gətirmək
 *             lazımdır, o isə AYRI rol sistemidir (platforma rolları ilə
 *             qarışdırmaq eskalasiya riski yaradır). Ayrıca iş kimi qeyd edilib.
 *
 *   DM    → hər iki iştirakçı. İki nəfərlik şəxsi söhbətdir; "moderasiya"
 *           anlayışı yoxdur, tərəflər öz söhbətlərinin sahibidir.
 *
 * ⚠ HƏDD: `PIN_MAX`. Sabitlənmiş mesaj panelin YUXARISINDA durur — limitsiz
 *   olsaydı panel ikinci bir mesaj axınına çevrilər və mənasını itirərdi. */
const PIN_MAX = 20;

/** Sabitlənmişlərin sayı həddi keçibsə xəta, yoxsa `null`. */
async function pinLimitGuard(c: Ctx, table: 'room_messages' | 'dm_messages', col: 'room_id' | 'pair_id', scopeId: string) {
  const row = await D(c).prepare(
    `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ? AND pinned_at IS NOT NULL`,
  ).bind(scopeId).first<any>();
  return (row?.n ?? 0) >= PIN_MAX
    ? err(`Ən çox ${PIN_MAX} mesaj sabitlənə bilər — əvvəlcə birini çıxarın.`, 409, 'pin_limit')
    : null;
}

export async function listRoomPins(c: Ctx, roomId: string) {
  const denied = await guardTeamRoom(c, roomId);
  if (denied) return denied;
  const rows = await D(c).prepare(
    'SELECT * FROM room_messages WHERE room_id = ? AND pinned_at IS NOT NULL ORDER BY pinned_at DESC LIMIT ?',
  ).bind(roomId, PIN_MAX).all<any>();
  return json({ pins: rows.results.map(r => mapMsg(r)) });
}

export async function pinRoomMessage(c: Ctx, roomId: string, mid: string) {
  const denied = await guardTeamRoom(c, roomId);
  if (denied) return denied;
  if (!c.isAdmin) return err('Otaqda mesaj sabitləmək üçün admin olmalısınız.', 403, 'forbidden');
  // `room_id` MESAJIN ÖZÜNDƏN yoxlanılır: marşrut parametri client-dəndir,
  // başqa otağın mesajını bu otağa "sabitləmək" mümkün olmamalıdır.
  const row = await D(c).prepare('SELECT room_id, pinned_at FROM room_messages WHERE id = ?').bind(mid).first<any>();
  if (!row || row.room_id !== roomId) return err('Tapılmadı.', 404);
  if (!row.pinned_at) {
    const over = await pinLimitGuard(c, 'room_messages', 'room_id', roomId);
    if (over) return over;
  }
  await D(c).prepare('UPDATE room_messages SET pinned_at = ?, pinned_by = ? WHERE id = ?')
    .bind(now(), c.user!.id, mid).run();
  await roomBroadcast(c, roomId, { t: 'refresh' });
  return json({ ok: true });
}

export async function unpinRoomMessage(c: Ctx, roomId: string, mid: string) {
  const denied = await guardTeamRoom(c, roomId);
  if (denied) return denied;
  if (!c.isAdmin) return err('Otaqda mesaj sabitləmək üçün admin olmalısınız.', 403, 'forbidden');
  await D(c).prepare('UPDATE room_messages SET pinned_at = NULL, pinned_by = NULL WHERE id = ? AND room_id = ?')
    .bind(mid, roomId).run();
  await roomBroadcast(c, roomId, { t: 'refresh' });
  return json({ ok: true });
}

/** DM-də iştirakçılıq yoxlaması — `dmMessages` ilə eyni qayda. */
const dmMember = (c: Ctx, pairId: string) => pairId.split('_').includes(c.user!.id);

export async function listDMPins(c: Ctx, pairId: string) {
  if (!dmMember(c, pairId)) return err('İcazə yoxdur.', 403, 'forbidden');
  const rows = await D(c).prepare(
    'SELECT * FROM dm_messages WHERE pair_id = ? AND pinned_at IS NOT NULL ORDER BY pinned_at DESC LIMIT ?',
  ).bind(pairId, PIN_MAX).all<any>();
  return json({ pins: rows.results.map(r => mapMsg(r, true)) });
}

export async function pinDMMessage(c: Ctx, pairId: string, mid: string) {
  if (!dmMember(c, pairId)) return err('İcazə yoxdur.', 403, 'forbidden');
  const row = await D(c).prepare('SELECT pair_id, pinned_at FROM dm_messages WHERE id = ?').bind(mid).first<any>();
  if (!row || row.pair_id !== pairId) return err('Tapılmadı.', 404);
  if (!row.pinned_at) {
    const over = await pinLimitGuard(c, 'dm_messages', 'pair_id', pairId);
    if (over) return over;
  }
  await D(c).prepare('UPDATE dm_messages SET pinned_at = ?, pinned_by = ? WHERE id = ?')
    .bind(now(), c.user!.id, mid).run();
  await dmPush(c, pairId);
  return json({ ok: true });
}

export async function unpinDMMessage(c: Ctx, pairId: string, mid: string) {
  if (!dmMember(c, pairId)) return err('İcazə yoxdur.', 403, 'forbidden');
  await D(c).prepare('UPDATE dm_messages SET pinned_at = NULL, pinned_by = NULL WHERE id = ? AND pair_id = ?')
    .bind(mid, pairId).run();
  await dmPush(c, pairId);
  return json({ ok: true });
}

/* ═══════════ REAKSİYA · ƏLFƏCİN · FORWARD (miqrasiya 0047) ═══════════════
 *
 * ⚠ ORTAQ QAPI: hər üç əməliyyat əvvəlcə "bu istifadəçi bu mesajı OXUYA
 *   BİLİRMİ?" sualına cavab verməlidir. Otaqda bu `guardTeamRoom`, DM-də isə
 *   cüt üzvlüyüdür. Aşağıdakı `msgScopeGuard` hər iki halı bir yerdə yığır ki,
 *   yeni əməliyyat əlavə edəndə qapı unudulmasın. */

const REACTION_TYPES = ['like', 'love', 'laugh', 'wow', 'fire', 'clap', 'party', 'rocket'];

/** Mesaja çıxışı yoxlayır və mesajın sətrini qaytarır. Xəta → `Response`. */
async function msgScopeGuard(c: Ctx, scope: 'room' | 'dm', scopeId: string, mid: string) {
  if (scope === 'room') {
    const denied = await guardTeamRoom(c, scopeId);
    if (denied) return denied;
    const row = await D(c).prepare('SELECT id, room_id AS sid, author_id AS uid, file_key, type, text, file_name, file_size, mime_type, language FROM room_messages WHERE id = ?')
      .bind(mid).first<any>();
    // Marşrut parametrinə güvənilmir: mesaj HƏQİQƏTƏN bu otaqda olmalıdır.
    if (!row || row.sid !== scopeId) return err('Tapılmadı.', 404);
    return row;
  }
  if (!dmMember(c, scopeId)) return err('İcazə yoxdur.', 403, 'forbidden');
  const row = await D(c).prepare('SELECT id, pair_id AS sid, from_id AS uid, file_key, type, text, file_name, file_size, mime_type, language FROM dm_messages WHERE id = ?')
    .bind(mid).first<any>();
  if (!row || row.sid !== scopeId) return err('Tapılmadı.', 404);
  return row;
}

/** Dəyişiklikdən sonra hər iki nəqliyyat üçün "yenilə" siqnalı. */
async function scopePush(c: Ctx, scope: 'room' | 'dm', scopeId: string) {
  if (scope === 'room') await roomBroadcast(c, scopeId, { t: 'refresh' });
  else await dmPush(c, scopeId);
}

async function setReaction(c: Ctx, scope: 'room' | 'dm', scopeId: string, mid: string, on: boolean) {
  const row = await msgScopeGuard(c, scope, scopeId, mid);
  if (row instanceof Response) return row;
  const b = await readJson(c.req);
  const type = String(b?.type || '');
  if (!REACTION_TYPES.includes(type)) return badReq('Naməlum reaksiya tipi.');
  if (on) {
    // `OR IGNORE`: təkrar klik xəta vermir, sadəcə mövcud sətri saxlayır.
    await D(c).prepare('INSERT OR IGNORE INTO message_reactions (scope, message_id, user_id, type, created_at) VALUES (?,?,?,?,?)')
      .bind(scope, mid, c.user!.id, type, now()).run();
  } else {
    await D(c).prepare('DELETE FROM message_reactions WHERE scope = ? AND message_id = ? AND user_id = ? AND type = ?')
      .bind(scope, mid, c.user!.id, type).run();
  }
  await scopePush(c, scope, scopeId);
  return json({ ok: true });
}

export const roomReactionPut = (c: Ctx, rid: string, mid: string) => setReaction(c, 'room', rid, mid, true);
export const roomReactionDelete = (c: Ctx, rid: string, mid: string) => setReaction(c, 'room', rid, mid, false);
export const dmReactionPut = (c: Ctx, pid: string, mid: string) => setReaction(c, 'dm', pid, mid, true);
export const dmReactionDelete = (c: Ctx, pid: string, mid: string) => setReaction(c, 'dm', pid, mid, false);

async function setBookmark(c: Ctx, scope: 'room' | 'dm', scopeId: string, mid: string, on: boolean) {
  const row = await msgScopeGuard(c, scope, scopeId, mid);
  if (row instanceof Response) return row;
  if (on) {
    await D(c).prepare('INSERT OR IGNORE INTO message_bookmarks (scope, message_id, user_id, created_at) VALUES (?,?,?,?)')
      .bind(scope, mid, c.user!.id, now()).run();
  } else {
    await D(c).prepare('DELETE FROM message_bookmarks WHERE scope = ? AND message_id = ? AND user_id = ?')
      .bind(scope, mid, c.user!.id).run();
  }
  // ⚠ Yayım YOXDUR: əlfəcin ŞƏXSİdir, başqa iştirakçılara görünmür.
  return json({ ok: true });
}

export const roomBookmarkPut = (c: Ctx, rid: string, mid: string) => setBookmark(c, 'room', rid, mid, true);
export const roomBookmarkDelete = (c: Ctx, rid: string, mid: string) => setBookmark(c, 'room', rid, mid, false);
export const dmBookmarkPut = (c: Ctx, pid: string, mid: string) => setBookmark(c, 'dm', pid, mid, true);
export const dmBookmarkDelete = (c: Ctx, pid: string, mid: string) => setBookmark(c, 'dm', pid, mid, false);

/**
 * Mesajın başqa söhbətə yönləndirilməsi.
 *
 * 🔴 FAYL AÇARI KÖÇÜRÜLÜR, TƏKRAR İSTİFADƏ EDİLMİR.
 *    `worker/msg.ts` şərhi bunu açıq tələb edir: `sanitizeMsg` fayl açarının
 *    GÖNDƏRƏNƏ aid olmasını yoxlayır (`msgfiles/{uid}/…`). Yönləndirmədə
 *    mənbə fayl BAŞQASININ açarındadır. İki yanlış yol var idi:
 *      (a) yoxlamanı zəiflətmək → hücumçu yad faylı öz söhbətinə bağlayardı;
 *      (b) açarı olduğu kimi yazmaq → `canReadKey` sahiblik seqmentinə baxdığı
 *          üçün fayl yeni söhbətin iştirakçılarına AÇILMAZDI (sınıq əlavə).
 *    Ona görə R2 obyekti YENİ `msgfiles/{yönləndirənin uid-i}/…` açarına
 *    fiziki olaraq köçürülür.
 *
 * ⚠ Yönləndirən mənbəni OXUYA bilməlidir — `msgScopeGuard` bunu təmin edir.
 */
export async function forwardMessage(c: Ctx) {
  const b = await readJson(c.req);
  const fromScope = b?.fromScope === 'dm' ? 'dm' : 'room';
  const toScope = b?.toScope === 'dm' ? 'dm' : 'room';
  const fromId = String(b?.fromId || '');
  const toId = String(b?.toId || '');
  const mid = String(b?.messageId || '');
  if (!fromId || !toId || !mid) return badReq('Natamam sorğu.');

  const src = await msgScopeGuard(c, fromScope, fromId, mid);
  if (src instanceof Response) return src;

  // HƏDƏF söhbətə YAZMA hüququ ayrıca yoxlanılır — mənbəni oxumaq hədəfə
  // yazmaq demək deyil.
  if (toScope === 'room') {
    const denied = await guardTeamRoom(c, toId);
    if (denied) return denied;
  } else if (!dmMember(c, toId)) {
    return err('İcazə yoxdur.', 403, 'forbidden');
  }

  let fileKey: string | null = null;
  if (src.file_key) {
    const obj = await c.env.FILES.get(src.file_key);
    if (obj) {
      const ext = String(src.file_key).split('.').pop() || 'bin';
      fileKey = `msgfiles/${c.user!.id}/${uuid()}.${ext}`;
      await c.env.FILES.put(fileKey, obj.body, {
        httpMetadata: { contentType: src.mime_type || 'application/octet-stream' },
      });
    }
  }

  const created = now();
  const fwdText = String(src.text || '');
  if (toScope === 'room') {
    await D(c).prepare(`INSERT INTO room_messages ${MSG_COLS} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(uuid(), toId, c.user!.id, c.user!.name, src.type, fwdText, fileKey,
        src.file_name, src.file_size, src.mime_type, src.language, created, null).run();
  } else {
    const [a, bUid] = toId.split('_');
    const toUid = a === c.user!.id ? bUid : a;
    const preview = src.type === 'text' ? fwdText.slice(0, 80) : `[${src.type}]`;
    const readCol = c.user!.id === a ? 'read_a' : 'read_b';
    await D(c).batch([
      D(c).prepare(
        `INSERT INTO dm_threads (pair_id, user_a, user_b, last_msg, last_from, last_at, ${readCol}) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(pair_id) DO UPDATE SET last_msg = ?, last_from = ?, last_at = ?, ${readCol} = ?`,
      ).bind(toId, a, bUid, preview, c.user!.id, created, created, preview, c.user!.id, created, created),
      D(c).prepare(
        'INSERT INTO dm_messages (id, pair_id, from_id, to_id, type, text, file_key, file_name, file_size, mime_type, language, created_at, reply_to) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ).bind(uuid(), toId, c.user!.id, toUid, src.type, fwdText, fileKey,
        src.file_name, src.file_size, src.mime_type, src.language, created, null),
    ]);
  }
  await scopePush(c, toScope, toId);
  return json({ ok: true });
}

/**
 * Mesaj səhifəsinə reaksiyaları və şəxsi əlfəcin bayrağını bağlayır.
 *
 * ⚠ TƏK TOPLU SORĞU (N+1 YOX): 120 mesajlıq səhifə üçün mesaj başına sorğu
 *   atmaq D1-də fəlakət olardı. `IN (…)` ilə bir dəfə oxunur və yaddaşda
 *   qruplaşdırılır.
 * ⚠ Nəticə formatı UI üçün HAZIR gəlir: `[{type, count, mine}]` — client
 *   sayğac hesablamamalıdır.
 */
/* 🔴 SQLITE DƏYİŞƏN HƏDDİ — `IN (…)` PARÇALANMALIDIR.
 *
 * İlk versiya bütün səhifəni TƏK `IN (?,?,…)` sorğusuna yığırdı və istehsalda
 * dərhal sındı:
 *   `D1_ERROR: too many SQL variables at offset 289: SQLITE_ERROR`
 * Səbəb: mesaj səhifəsi 120 (default) – 200 (maks) elementdir, SQLite-ın
 * `SQLITE_MAX_VARIABLE_NUMBER` həddi isə 100-dür. Yəni qüsur BOŞ otaqda
 * görünmür, yalnız real söhbətdə çıxır — məhz ona görə burada açıq yazılır.
 *
 * `CHUNK` 90-dır: hər sorğuda əlavə bağlanan parametrlər var (`scope`, əlfəcin
 * sorğusunda həm də `user_id`), ona görə 100-ə qədər ehtiyat pay saxlanılır. */
const IN_CHUNK = 90;
const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

async function attachReactions(c: Ctx, scope: 'room' | 'dm', msgs: any[]) {
  if (!msgs.length) return msgs;
  const ids = msgs.map(m => m.id);
  const parts = chunk(ids, IN_CHUNK);
  const [reactChunks, bmChunks] = await Promise.all([
    Promise.all(parts.map(p => D(c)
      .prepare(`SELECT message_id, type, user_id FROM message_reactions WHERE scope = ? AND message_id IN (${p.map(() => '?').join(',')})`)
      .bind(scope, ...p).all<any>())),
    Promise.all(parts.map(p => D(c)
      .prepare(`SELECT message_id FROM message_bookmarks WHERE scope = ? AND user_id = ? AND message_id IN (${p.map(() => '?').join(',')})`)
      .bind(scope, c.user!.id, ...p).all<any>())),
  ]);
  const reacts = { results: reactChunks.flatMap(r => r.results) };
  const bms = { results: bmChunks.flatMap(r => r.results) };
  const byMsg = new Map<string, Map<string, { type: string; count: number; mine: boolean }>>();
  for (const r of reacts.results) {
    if (!byMsg.has(r.message_id)) byMsg.set(r.message_id, new Map());
    const m = byMsg.get(r.message_id)!;
    const cur = m.get(r.type) || { type: r.type, count: 0, mine: false };
    cur.count++;
    if (r.user_id === c.user!.id) cur.mine = true;
    m.set(r.type, cur);
  }
  const bookmarked = new Set(bms.results.map((r: any) => r.message_id));
  for (const m of msgs) {
    m.reactions = byMsg.has(m.id) ? [...byMsg.get(m.id)!.values()] : [];
    m.bookmarked = bookmarked.has(m.id);
  }
  return msgs;
}

/* ================= PRESENCE =================
 *
 * 🔴 AUDIT-TASK-10 / Faza 3.2 (audit struktur borcu #5) — "İKİ PRESENCE SİSTEMİ".
 *
 * Audit haqlı olaraq iki mexanizm gördü, lakin onlar DUBLİKAT DEYİL — fərqli
 * suallara cavab verir və biri digərini əvəz edə bilmir:
 *
 * ┌────────────────────┬──────────────────────────┬─────────────────────────┐
 * │                    │ D1 `presence` (bu blok)  │ `PresenceDO` (WS)       │
 * ├────────────────────┼──────────────────────────┼─────────────────────────┤
 * │ Sual               │ "kim son 2 dəqiqədə      │ "kim MƏHZ İNDİ          │
 * │                    │  aktiv olub?"            │  qoşulub?"              │
 * │ Nəqliyyat          │ HTTP polling (30 s)      │ WebSocket (anlıq)       │
 * │ WS olmayanda       │ ✅ işləyir (fallback)     │ ❌ heç nə               │
 * │ DO təmizlənəndə    │ ✅ sağ qalır (D1)         │ ❌ state itir           │
 * │ Əlavə vəzifə       │ `users.last_active_at`   │ `push(uid, …)` — bildiriş│
 * │                    │ tarixçəsi                │  siqnallarının marşrutu │
 * └────────────────────┴──────────────────────────┴─────────────────────────┘
 *
 * Yəni `PresenceDO` yalnız online statusu deyil, HƏM DƏ istifadəçiyə real-time
 * siqnal göndərmə kanalıdır (`userPush` → `NotificationService.pushSignal`).
 * Onu silsək bildirişlər polling-ə qayıdardı.
 *
 * ⚠ REDUNDANTLIQ HARADADIR: "kim onlaydır" sualına HƏR İKİSİ cavab verir —
 *   client WS ilə qoşulubsa D1 polling-i BOŞ İŞDİR. Bu, presence-in özündə
 *   deyil, POLLING MODELİNDƏDİR və `AUDIT-TASK-10` Faza 5/#3 (polling → WS)
 *   ilə bağlanır. Ora qədər D1 yolu fallback kimi SAXLANILIR — silmək
 *   WS-siz client-ləri (köhnə brauzer, proxy) statussuz qoyardı.
 *
 * ⚠ Task 4 §4.2 `presence` rate-limitini məhz polling tezliyinə görə
 *   qaldırmışdı — polling silinəndə limit YENİDƏN AŞAĞI salına bilər.
 */
export async function heartbeat(c: Ctx) {
  const priv = fromJSON<any>(c.user!.settings as any, {})?.privacy || {};
  if (priv.showOnlineStatus === false) {
    await D(c).prepare('DELETE FROM presence WHERE user_id = ?').bind(c.user!.id).run();
    return json({ ok: true });
  }
  await D(c).prepare(
    'INSERT INTO presence (user_id, last_seen) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen = ?',
  ).bind(c.user!.id, now(), now()).run();
  await D(c).prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(now(), c.user!.id).run();
  return json({ ok: true });
}
export async function presenceMap(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM presence WHERE last_seen > ?').bind(now() - 120000).all<any>();
  const out: Record<string, number> = {};
  rows.results.forEach(r => { out[r.user_id] = r.last_seen; });
  return json({ presence: out });
}

