// D1 → R2 arxivləmə (TASK-8 / FAZA 4 / Bənd 12).
//
// Cron Trigger ilə gündəlik işləyir. Məqsəd: D1-in baza həcm limitinə dəyməmək.
// `room_messages` və `dm_messages` ən sürətlə böyüyən cədvəllərdir; D1-də yalnız
// "isti pəncərə" saxlanılır, köhnəsi sıxılmış JSON kimi R2-yə (soyuq yaddaş) köçür.
//
// ⚠ TƏHLÜKƏSİZLİK QAYDASI: sətir D1-dən YALNIZ R2 yazısı UĞURLA bitdikdən sonra
// silinir. Əks sıra data itkisi riski yaradardı — R2 yazısı sınsa mesajlar
// həm D1-də, həm R2-də olmazdı.
import { Env, uuid, now } from './util';

// İsti pəncərə (gün). `vars` ilə konfiqurativ — istifadəçi saxlama siyasətini
// deploy etmədən dəyişə bilsin.
const DEFAULT_HOT_DAYS = 90;
// Bir işləmədə arxivləşən maksimum mesaj. Cron-un CPU/vaxt limitinə dəyməmək
// üçün partiyalarla gedirik; qalanı növbəti gün götürülür.
const BATCH = 2000;
// Bir `DELETE ... IN (…)` ifadəsində bağlanan maksimum id sayı.
// D1 bir ifadədəki dəyişən sayını məhdudlaşdırır (aşıldıqda
// `D1_ERROR: too many SQL variables`). 50 həm limitin xeyli altındadır,
// həm də 2000 mesaj üçün cəmi 40 ifadə deməkdir — batch üçün ucuzdur.
const DELETE_CHUNK = 50;

const hotDays = (env: Env) => {
  const n = parseInt(String(env.ARCHIVE_HOT_DAYS ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HOT_DAYS;
};

async function gzipJson(data: unknown): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  // CompressionStream Workers runtime-ında var — xarici kitabxana lazım deyil.
  // Söhbət mətni çox təkrarlıdır, gzip adətən 5-10x qazandırır.
  const cs = new CompressionStream('gzip');
  const stream = new Blob([bytes as BufferSource]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipJson<T>(body: ReadableStream): Promise<T> {
  const ds = new DecompressionStream('gzip');
  return new Response(body.pipeThrough(ds)).json<T>();
}

interface ArchiveStat { kind: string; scopes: number; messages: number; bytes: number }

// Bir növ (otaq / DM) üçün arxivləmə.
// Mesajlar SCOPE (otaq və ya söhbət) üzrə qruplaşdırılır: sonradan oxumaq
// lazım olanda bütün arxivi deyil, yalnız bir söhbətin faylını çəkirik.
async function archiveKind(
  env: Env, kind: 'room' | 'dm', table: string, scopeCol: string, cutoff: number,
): Promise<ArchiveStat> {
  const stat: ArchiveStat = { kind, scopes: 0, messages: 0, bytes: 0 };

  const scopes = await env.DB.prepare(
    `SELECT ${scopeCol} AS scope, COUNT(*) AS n FROM ${table}
      WHERE created_at < ?1 GROUP BY ${scopeCol} ORDER BY n DESC LIMIT 50`,
  ).bind(cutoff).all<any>();

  for (const s of scopes.results) {
    const rows = await env.DB.prepare(
      `SELECT * FROM ${table} WHERE ${scopeCol} = ?1 AND created_at < ?2
        ORDER BY created_at LIMIT ?3`,
    ).bind(s.scope, cutoff, BATCH).all<any>();
    if (!rows.results.length) continue;

    const msgs = rows.results;
    const fromTs = msgs[0].created_at;
    const toTs = msgs[msgs.length - 1].created_at;
    // Açar tarixlə başlayır → R2 konsolunda xronoloji sıralanır və
    // prefiks üzrə siyahılama (məs. "2026-01-*") ucuz olur.
    const key = `archive/${kind}/${s.scope}/${new Date(fromTs).toISOString().slice(0, 10)}-${uuid().slice(0, 8)}.json.gz`;

    const gz = await gzipJson({ kind, scope: s.scope, fromTs, toTs, count: msgs.length, messages: msgs });

    // 1) ƏVVƏLCƏ R2 (uğursuz olsa D1-ə toxunmuruq — data itmir)
    await env.FILES.put(key, gz as BufferSource, {
      httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' },
    });

    // 2) SONRA katalog + D1-dən silmə (tək batch = atomar)
    //
    // 🔴 AUDIT-TASK-8 §8.8 — GİZLİ QÜSUR, ilk dəfə burada aşkarlandı.
    // Əvvəl silmə TƏK ifadə idi: `DELETE ... WHERE id IN (?,?,… ×msgs.length)`.
    // `BATCH` 2000-dir, D1 isə bir ifadədə bağlana bilən dəyişən sayını
    // məhdudlaşdırır → 100-dən çox mesajı olan hər scope-da sorğu
    // `D1_ERROR: too many SQL variables` atırdı və BÜTÜN arxiv işi çökürdü.
    //
    // Nəticəsi sükutlu və davamlı olardı: R2 yazısı ARTIQ uğurla bitdiyi üçün
    // hər gecə yeni YETİM obyekt yaranar, katalog sətri yazılmaz, D1-dən isə
    // heç nə silinməzdi. Bu, `ARCHIVE_HOT_DAYS=3650` səbəbindən Task 1-dən
    // bəri heç vaxt işə düşməyib — məhz ona görə indiyədək görünməyib.
    const ids = msgs.map((m: any) => m.id);
    const stmts = [
      env.DB.prepare(
        `INSERT INTO message_archives (id, kind, scope_id, from_ts, to_ts, r2_key, msg_count, bytes, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).bind(uuid(), kind, s.scope, fromTs, toTs, key, msgs.length, gz.byteLength, now()),
    ];
    for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
      const chunk = ids.slice(i, i + DELETE_CHUNK);
      stmts.push(env.DB.prepare(
        `DELETE FROM ${table} WHERE id IN (${chunk.map(() => '?').join(',')})`,
      ).bind(...chunk));
    }
    // Hamısı BİR batch-dədir → katalog sətri və silmələr atomar qalır
    // (yarımçıq silmə dublikat yaradardı; oxu yolu onu dedupe edir, lakin
    // etibar etmək əvəzinə atomikliyi qorumaq düzgündür).
    await env.DB.batch(stmts);

    stat.scopes++;
    stat.messages += msgs.length;
    stat.bytes += gz.byteLength;
  }
  return stat;
}

// Vaxtı bitmiş sessiyaların təmizlənməsi — eyni cron-da, ucuz iş.
// `revoked` sətrlər reuse aşkarlaması üçün bir müddət saxlanılır, amma
// əbədi qalmamalıdır.
async function pruneSessions(env: Env): Promise<number> {
  const res = await env.DB.prepare(
    'DELETE FROM sessions WHERE expires_at < ?',
  ).bind(now() - 7 * 86400000).run();
  return res.meta?.changes ?? 0;
}

// Təhlükəsizlik jurnalının saxlama müddəti — 90 gün.
async function pruneSecurityEvents(env: Env): Promise<number> {
  const res = await env.DB.prepare(
    'DELETE FROM security_events WHERE created_at < ?',
  ).bind(now() - 90 * 86400000).run();
  return res.meta?.changes ?? 0;
}

/**
 * Silinmiş hesabların mesajlarının arxivdən FİZİKİ silinməsi — §8.6 variant (c).
 *
 * Oxu yolundakı filtr (variant b) mesajları dərhal ƏLÇATMAZ edir, lakin bayt
 * səviyyəsində onlar dump-ın içində qalır. GDPR Art. 17 fiziki silmə tələb edir,
 * ona görə gecə cron-u dump-ları yenidən yazır.
 *
 * ⚠ HƏCM BAĞLIDIR: hər qaçışda ən çoxu `PURGE_BATCH` obyekt açılır. Bütün
 * arxivi bir gecədə emal etmək cron-un CPU limitinə dəyə bilər (bir obyekt ən
 * pis halda ~16 MB-a açılır — §8.3 ölçməsi). Qalan obyektlər növbəti gecə
 * götürülür; `message_archives.purged_at` irəliləyişi saxlayır.
 *
 * ⚠ YAZI SIRASI: əvvəlcə YENİ obyekt R2-yə yazılır (eyni açar üzərinə), sonra
 * D1 metadatası yenilənir. Ardıcıllıq `archiveKind`-dakı ilə eynidir — R2
 * yazısı sınarsa D1-ə toxunulmur və iş növbəti gecə təkrarlanır.
 */
const PURGE_BATCH = 10;

interface PurgeStat { scanned: number; rewritten: number; removedMessages: number; uidsCompleted: number }

async function purgeDeletedFromArchives(env: Env): Promise<PurgeStat> {
  const stat: PurgeStat = { scanned: 0, rewritten: 0, removedMessages: 0, uidsCompleted: 0 };

  const pending = await env.DB.prepare(
    'SELECT uid, deleted_at FROM deleted_uids WHERE purged_at IS NULL',
  ).all<any>();
  if (!pending.results.length) return stat;

  const uids = new Set(pending.results.map((r: any) => String(r.uid)));
  // Ən köhnə tombstone: ondan SONRA təmizlənmiş obyektlərə toxunmağa ehtiyac yoxdur.
  const oldest = Math.min(...pending.results.map((r: any) => Number(r.deleted_at) || 0));

  const rows = await env.DB.prepare(
    `SELECT id, kind, r2_key FROM message_archives
      WHERE purged_at IS NULL OR purged_at < ?1
      ORDER BY created_at LIMIT ?2`,
  ).bind(oldest, PURGE_BATCH).all<any>();

  for (const row of rows.results) {
    stat.scanned++;
    const authorCol = row.kind === 'dm' ? 'from_id' : 'author_id';
    try {
      const obj = await env.FILES.get(row.r2_key);
      if (!obj) {
        // Obyekt yoxdur — təmizləyəcək bir şey yoxdur, irəliləyişi qeyd et.
        await env.DB.prepare('UPDATE message_archives SET purged_at = ? WHERE id = ?')
          .bind(now(), row.id).run();
        continue;
      }
      const data = await gunzipJson<any>(obj.body as ReadableStream);
      const before = (data.messages || []).length;
      const kept = (data.messages || []).filter((m: any) => !uids.has(String(m[authorCol])));

      if (kept.length !== before) {
        const gz = await gzipJson({ ...data, count: kept.length, messages: kept });
        await env.FILES.put(row.r2_key, gz as BufferSource, {
          httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' },
        });
        await env.DB.prepare(
          'UPDATE message_archives SET msg_count = ?, bytes = ?, purged_at = ? WHERE id = ?',
        ).bind(kept.length, gz.byteLength, now(), row.id).run();
        stat.rewritten++;
        stat.removedMessages += before - kept.length;
      } else {
        await env.DB.prepare('UPDATE message_archives SET purged_at = ? WHERE id = ?')
          .bind(now(), row.id).run();
      }
    } catch (e: any) {
      // Bir obyektin sınması bütün işi dayandırmasın — `purged_at` yenilənmir,
      // yəni növbəti gecə təkrar cəhd edilir.
      console.error('arxiv təmizlənmədi', row.r2_key, e?.message || e);
    }
  }

  // Təmizlənməmiş obyekt qalmayıbsa tombstone-ları tamamlanmış işarələ.
  const left = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM message_archives WHERE purged_at IS NULL OR purged_at < ?',
  ).bind(oldest).first<any>();
  if (!Number(left?.n || 0)) {
    const res = await env.DB.prepare(
      'UPDATE deleted_uids SET purged_at = ? WHERE purged_at IS NULL',
    ).bind(now()).run();
    stat.uidsCompleted = res.meta?.changes ?? 0;
  }
  return stat;
}

export async function runArchiveJob(env: Env): Promise<Record<string, unknown>> {
  const cutoff = now() - hotDays(env) * 86400000;
  const rooms = await archiveKind(env, 'room', 'room_messages', 'room_id', cutoff);
  const dms = await archiveKind(env, 'dm', 'dm_messages', 'pair_id', cutoff);
  const sessions = await pruneSessions(env);
  const events = await pruneSecurityEvents(env);
  // §8.6/(c) — arxivləmədən SONRA işləyir: bu gecə yazılan yeni dump-da da
  // silinmiş hesabın mesajı ola bilər (mesaj D1-də qalmışdı, çünki
  // `deleteAccount` `room_messages`/`dm_messages` sətirlərinə toxunmur).
  const purge = await purgeDeletedFromArchives(env);

  const summary = {
    hotDays: hotDays(env), rooms, dms,
    prunedSessions: sessions, prunedEvents: events, purge,
  };
  console.log('arxiv işi tamamlandı', JSON.stringify(summary));
  return summary;
}

/* ---------- GDPR ixracı (§8.5) ---------- */

// Bir ixracda açılan maksimum arxiv obyekti. Sonsuz buraxsaq, arxiv böyüdükcə
// ixrac Worker-in CPU/yaddaş limitinə dəyər və İSTİFADƏÇİ HEÇ NƏ ALA BİLMƏZ.
// Kəsilmə baş verirsə cavabda AÇIQ bildirilir — sükutla natamam fayl vermək
// GDPR ixracında ən pis nəticədir.
const EXPORT_MAX_OBJECTS = 50;

export interface ArchiveExport {
  messages: any[];
  /** Limit səbəbindən bütün arxivlər açılmadı — istifadəçi bunu BİLMƏLİDİR. */
  truncated: boolean;
  objectsScanned: number;
}

/**
 * İstifadəçinin ARXİVLƏNMİŞ mesajları — GDPR ixracı üçün (hüquqi risk #13).
 *
 * ⚠ YALNIZ İSTİFADƏÇİNİN ÖZ MESAJLARI. Arxiv dump-ı BÜTÜN otağın/söhbətin
 * mesajlarını saxlayır; hamısını ixraca qoysaq ixracın özü data sızmasına
 * çevrilərdi (başqa şəxslərin yazışması istifadəçinin faylına düşərdi).
 *
 * DM scope-u (`pair_id`) `a_b` formasındadır → uid-i ehtiva edən cütlüklər
 * SQL-də süzülür. Otaq arxivləri isə istənilən otağa aid ola bilər, ona görə
 * onlar açılıb `author_id` üzrə filtrlənir (obyekt sayı yuxarıdakı limitlə bağlı).
 */
export async function exportArchivedMessages(env: Env, uid: string): Promise<ArchiveExport> {
  const out: any[] = [];
  let scanned = 0;
  let truncated = false;

  try {
    const rows = await env.DB.prepare(
      `SELECT kind, scope_id, r2_key FROM message_archives
        WHERE kind = 'room'
           OR (kind = 'dm' AND (scope_id LIKE ?1 || '\\_%' ESCAPE '\\'
                             OR scope_id LIKE '%\\_' || ?1 ESCAPE '\\'))
        ORDER BY to_ts DESC LIMIT ?2`,
    ).bind(uid, EXPORT_MAX_OBJECTS + 1).all<any>();

    truncated = rows.results.length > EXPORT_MAX_OBJECTS;
    for (const row of rows.results.slice(0, EXPORT_MAX_OBJECTS)) {
      const authorCol = row.kind === 'dm' ? 'from_id' : 'author_id';
      try {
        const obj = await env.FILES.get(row.r2_key);
        if (!obj) continue;
        const data = await gunzipJson<any>(obj.body as ReadableStream);
        scanned++;
        for (const m of data.messages || []) {
          if (String(m[authorCol]) === uid) out.push({ ...m, _archiveKind: row.kind, _scope: row.scope_id });
        }
      } catch (e: any) {
        // Bir dump açılmadı — ixrac dayanmır, lakin natamamlıq gizlədilmir.
        console.error('ixrac üçün arxiv açılmadı', row.r2_key, e?.message || e);
        truncated = true;
      }
    }
  } catch (e: any) {
    console.error('arxiv ixracı uğursuz', e?.message || e);
    truncated = true;
  }

  out.sort((a, b) => Number(a.created_at) - Number(b.created_at));
  return { messages: out, truncated, objectsScanned: scanned };
}

/* ---------- unudulmaq hüququ (§8.6) ---------- */

/**
 * Silinmiş hesabların uid dəsti — arxiv oxusunda filtrlənir (GDPR Art. 17).
 *
 * ⚠ Bu sorğu HƏR arxiv oxusunda edilir, lakin cədvəl kiçikdir (silinmiş hesab
 * sayı qədər sətir) və sorğu indeksli PRIMARY KEY skanıdır. Keşləmirik: silmə
 * DƏRHAL təsirli olmalıdır — "60 saniyə də olsa görünməyə davam etsin" GDPR
 * kontekstində müdafiə oluna bilməz.
 *
 * Fail-closed DEYİL, fail-open: sorğu sınarsa boş dəst qaytarılır və mesajlar
 * görünür. Səbəb — alternativ bütün arxivi gizlətməkdir, bu isə data itkisi
 * qavrayışı yaradar. Xəta loglanır.
 */
export async function deletedUidSet(env: Env): Promise<Set<string>> {
  try {
    const rows = await env.DB.prepare('SELECT uid FROM deleted_uids').all<any>();
    return new Set(rows.results.map((r: any) => String(r.uid)));
  } catch (e: any) {
    console.error('deleted_uids oxunmadı', e?.message || e);
    return new Set();
  }
}

/** `deleteAccount` çağırır — hesab silinən kimi tombstone qoyulur. */
export async function markUidDeleted(env: Env, uid: string): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO deleted_uids (uid, deleted_at, purged_at) VALUES (?, ?, NULL)',
    ).bind(uid, now()).run();
  } catch (e: any) {
    // Hesab silmə əməliyyatı bu səbəbdən ÇÖKMƏMƏLİDİR — istifadəçi silinməni
    // tamamlaya bilməsə vəziyyət daha pisdir. Xəta loglanır, cron sonra tutur.
    console.error('deleted_uids yazılmadı', uid, e?.message || e);
  }
}

/* ---------- arxivdən oxuma ---------- */

/**
 * Arxiv oxusunun nəticəsi — AUDIT-TASK-8 §5.3.
 *
 * ⚠ "BOŞ" İLƏ "XƏTA" QARIŞDIRILMAMALIDIR. Üç fərqli hal var və onları eyni
 * cavaba yığmaq məhz C-3-ün özünün səbəbini təkrarlayardı (istifadəçi datanın
 * itdiyini düşünür):
 *   1. Arxiv obyekti yoxdur      → `messages: []`, `failed: false` → "söhbətin başlanğıcı"
 *   2. Var, lakin `before`-dan köhnəsi yoxdur → eyni
 *   3. R2 xətası / pozulmuş gzip → `failed: true` → çağıran tərəf 5xx qaytarır
 */
export interface ArchiveReadResult {
  messages: any[];
  /** Ən azı bir obyekt oxunmadı/açılmadı — nəticə NATAMAMDIR. */
  failed: boolean;
  /** Diaqnostika: neçə R2 obyekti açıldı. */
  objectsRead: number;
}

// Bir sorğuda açılan maksimum R2 obyekti. Hər obyekt ən pis halda ~16 MB-a
// açılır (2000 mesaj × 8 KB mətn — ölçüldü §8.3), ona görə say bağlıdır:
// yaddaş limiti 128 MB-dır və parse olunmuş JS obyektləri xam JSON-dan
// bir neçə dəfə böyükdür.
const MAX_OBJECTS_PER_READ = 3;

/**
 * Bir söhbətin arxivləşmiş mesajlarını R2-dən oxuyur.
 * UI "daha köhnə mesajları yüklə" dedikdə çağırılır — isti pəncərə bitəndə.
 *
 * ⚠ TASK 7 SƏRHƏDİ: bu funksiya SERVER TƏRƏFDƏ işləyir və R2 açarı çağırana
 * qaytarılmır. `/files/archive/…` `canReadKey`-də `isAdmin()` ilə bağlıdır və
 * ELƏ QALIR — arxiv oxusu ondan KEÇMİR (bax worker/files-auth.ts başlığı).
 *
 * ⚠ Avtorizasiya BURADA edilmir — çağıran endpoint onu ARXİVƏ MÜRACİƏTDƏN
 * ƏVVƏL etməlidir (routes.ts `roomMessages` / `dmMessages`).
 */
export async function readArchive(
  env: Env, kind: 'room' | 'dm', scopeId: string, beforeTs: number, limit = 50,
  opts: { excludeUids?: Set<string> } = {},
): Promise<ArchiveReadResult> {
  const meta = await env.DB.prepare(
    `SELECT r2_key FROM message_archives
      WHERE kind = ? AND scope_id = ? AND from_ts < ?
      ORDER BY to_ts DESC LIMIT ?`,
  ).bind(kind, scopeId, beforeTs, MAX_OBJECTS_PER_READ).all<any>();

  const authorOf = (m: any) => String(kind === 'dm' ? m.from_id : m.author_id);
  const out: any[] = [];
  let failed = false;
  let objectsRead = 0;

  for (const m of meta.results) {
    let obj: R2ObjectBody | null = null;
    try {
      obj = await env.FILES.get(m.r2_key) as R2ObjectBody | null;
    } catch (e: any) {
      // R2 əlçatmazdır — bu, "data yoxdur" DEYİL. Sükutla boş qaytarmaq
      // istifadəçidə data itkisi qavrayışı yaradar (§5.3).
      console.error('arxiv obyekti çəkilmədi', m.r2_key, e?.message || e);
      failed = true;
      continue;
    }
    if (!obj) continue;   // arxiv əl ilə silinib — mövcud olanlarla davam

    try {
      const data = await gunzipJson<any>(obj.body as ReadableStream);
      // ⚠ Obyekt daxilində DƏRHAL kəsilir. Əvvəl bütün uyğun mesajlar `out`-a
      // yığılırdı: 3 obyekt × 2000 mesaj = 6000 obyekt yaddaşda qalırdı.
      // Bizə hər obyektdən ən çoxu `limit` ədəd lazımdır.
      const page = (data.messages || [])
        .filter((x: any) => x.created_at < beforeTs
          // 8.6 — silinmiş hesabın mesajları oxu yolunda GÖRÜNMÜR (GDPR Art. 17).
          && !(opts.excludeUids?.size && opts.excludeUids.has(authorOf(x))))
        .sort((a: any, b: any) => b.created_at - a.created_at)
        .slice(0, limit);
      out.push(...page);
      objectsRead++;
    } catch (e: any) {
      // Pozulmuş gzip — yenə "boş" deyil, XƏTA.
      console.error('arxiv açılmadı', m.r2_key, e?.message || e);
      failed = true;
    }
    if (out.length >= limit) break;
  }
  // Ən yenidən köhnəyə — UI "yuxarı sürüşdür" davranışına uyğun.
  return {
    messages: out.sort((a, b) => b.created_at - a.created_at).slice(0, limit),
    failed,
    objectsRead,
  };
}
