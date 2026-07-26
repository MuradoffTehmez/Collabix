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
    const ids = msgs.map((m: any) => m.id);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO message_archives (id, kind, scope_id, from_ts, to_ts, r2_key, msg_count, bytes, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).bind(uuid(), kind, s.scope, fromTs, toTs, key, msgs.length, gz.byteLength, now()),
      env.DB.prepare(
        `DELETE FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`,
      ).bind(...ids),
    ]);

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

export async function runArchiveJob(env: Env): Promise<Record<string, unknown>> {
  const cutoff = now() - hotDays(env) * 86400000;
  const rooms = await archiveKind(env, 'room', 'room_messages', 'room_id', cutoff);
  const dms = await archiveKind(env, 'dm', 'dm_messages', 'pair_id', cutoff);
  const sessions = await pruneSessions(env);
  const events = await pruneSecurityEvents(env);

  const summary = { hotDays: hotDays(env), rooms, dms, prunedSessions: sessions, prunedEvents: events };
  console.log('arxiv işi tamamlandı', JSON.stringify(summary));
  return summary;
}

/* ---------- arxivdən oxuma ---------- */

// Bir söhbətin arxivləşmiş mesajlarını R2-dən oxuyur.
// UI "daha köhnə mesajları yüklə" dedikdə çağırılır — isti pəncərə bitəndə.
export async function readArchive(
  env: Env, kind: 'room' | 'dm', scopeId: string, beforeTs: number, limit = 50,
): Promise<any[]> {
  const meta = await env.DB.prepare(
    `SELECT r2_key FROM message_archives
      WHERE kind = ? AND scope_id = ? AND from_ts < ?
      ORDER BY to_ts DESC LIMIT 3`,
  ).bind(kind, scopeId, beforeTs).all<any>();

  const out: any[] = [];
  for (const m of meta.results) {
    const obj = await env.FILES.get(m.r2_key);
    if (!obj) continue;   // arxiv əl ilə silinib — mövcud olanlarla davam
    try {
      const data = await gunzipJson<any>(obj.body as ReadableStream);
      out.push(...(data.messages || []).filter((x: any) => x.created_at < beforeTs));
    } catch (e: any) {
      console.error('arxiv oxunmadı', m.r2_key, e?.message || e);
    }
    if (out.length >= limit) break;
  }
  // Ən yenidən köhnəyə — UI "yuxarı sürüşdür" davranışına uyğun.
  return out.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}
