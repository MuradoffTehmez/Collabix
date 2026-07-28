// `/files/*` OXU AVTORİZASİYASI — AUDIT-2026-07-26 / C-1 (auditin 1 nömrəli tapıntısı).
//
// ƏVVƏL: `serveFile()` yalnız "giriş edilibmi?" soruşurdu (`index.ts` 401 qapısı).
// İstənilən giriş etmiş istifadəçi `teams/<yad-komanda>/documents/<açar>`,
// `msgfiles/<başqası>/<açar>` və ya `archive/<otaq>/dump.json.gz` oxuya bilirdi.
// İstismar üç sorğuluq idi: hücumçu `createPost` ilə məxfi açarı qlobal feed-ə
// yerləşdirir, feed-i açan HƏR KƏSİN brauzeri sənədi yükləyirdi.
//
// PRİNSİP: DEFAULT DENY. Sadalanmayan hər prefiks bloklanır (admin istisna).
// Fail-closed: yoxlama xəta versə → rədd.
//
// ⚠ RƏDD CAVABI 404-dür, 403 DEYİL (§5.4). `403` faylın MÖVCUDLUĞUNU təsdiqləyər
// və hücumçu açar sadalaması ilə komanda strukturunu öyrənə bilərdi.
//
// ⚠ TASK 8 SƏRHƏDİ (§7.9): arxiv OXU yolu bu endpoint-dən KEÇMƏMƏLİDİR.
// `archive/` burada `c.isAdmin` ilə bağlıdır və elə qalmalıdır. İstifadəçiyə
// köhnə mesaj lazımdırsa DÜZGÜN yol ayrıca API endpoint-idir
// (`GET /api/rooms/:id/messages?before=…`): o, öz avtorizasiyasını edir,
// R2-dən SERVER TƏRƏFDƏ oxuyur (`readArchive`) və JSON qaytarır — R2 açarını
// client-ə heç vaxt vermir. Bu qaydanı zəiflətmək C-1-i qismən yenidən açar.
import { Ctx, Env } from './util';

/* ================= keş siyasəti ================= */

/**
 * 🔴 CDN KEŞİ AVTORİZASİYANI KEÇİR — bu, düzəlişin ən kritik hissəsidir və
 * mənbə auditdə QEYD OLUNMAYIB.
 *
 * Cloudflare edge keşi cavabı `Cache-Control`-a görə saxlayır. Əvvəl `serveFile`
 * HƏR obyektə `public, max-age=31536000, immutable` qoyurdu. Yəni:
 *   1) Qanuni üzv `teams/<id>/secret.pdf` açır → yoxlama ✅ → edge keşləyir.
 *   2) Yad istifadəçi eyni URL-i açır → sorğu Worker-ə HEÇ ÇATMIR.
 *   3) Avtorizasiya tamamilə keçilir.
 * Yəni keş siyasəti olmadan `canReadKey` MƏNASIZ olardı.
 *
 * `public` YALNIZ onsuz da publik olan prefikslər üçün saxlanılır: feed 20+
 * şəkil çəkir, onları keşdən çıxarmaq gecikməni və R2 sorğu xərcini artırardı.
 */
export type CachePolicy = 'public' | 'private' | 'no-store';

export const CACHE_HEADER: Record<CachePolicy, string> = {
  // Publik məzmun — keşlənməsi ARZUOLUNANDIR (performans reqressiyasının qarşısı).
  public: 'public, max-age=31536000, immutable',
  // Məxfi məzmun — edge KEŞLƏMƏMƏLİDİR, yalnız brauzer nüsxəsi və o da revalidate ilə.
  private: 'private, max-age=0, must-revalidate',
  // Heç yerdə qalmasın (arxiv, rədd cavabları, naməlum prefikslər).
  'no-store': 'no-store',
};

export interface AccessDecision {
  allow: boolean;
  /** Keş siyasəti qərarın AYRILMAZ hissəsidir — sadə `boolean` kifayət etməzdi. */
  cache: CachePolicy;
  /** Jurnal üçün maşın oxunaqlı səbəb. */
  reason: string;
  /** Jurnal üçün açarın YALNIZ prefiksi — tam açar həssas ola bilər (§5.3). */
  prefix: string;
}

const deny = (reason: string, prefix: string, cache: CachePolicy = 'no-store'): AccessDecision =>
  ({ allow: false, cache, reason, prefix });
const allow = (cache: CachePolicy, reason: string, prefix: string): AccessDecision =>
  ({ allow: true, cache, reason, prefix });

/** Açarın yalnız birinci seqmenti — jurnalda tam açar getməsin. */
export function keyPrefix(key: string): string {
  const i = key.indexOf('/');
  return i > 0 ? key.slice(0, i) + '/' : '(root)';
}

/* ================= komanda üzvlüyü keşi ================= */

/**
 * Komanda üzvlüyü keşi — AUDIT-TASK-7 §7.3.
 *
 * Komanda fayl səhifəsi eyni komanda üçün onlarla `/files/` sorğusu edir; hər
 * birində D1 sorğusu lazımsızdır. Keş oxu-ağırdır (yazı yalnız cache miss-də),
 * ona görə Task 4 §5.2-də ölçülən KV yazı amplifikasiyası riski burada azdır.
 *
 * ⚠ TTL QƏSDƏN QISADIR (60 s = KV-nin minimumu). C-1-in mətnindəki əsas ssenari
 * "komandadan çıxarılmış üzv gördüyü hər fayla ƏBƏDİ çıxış saxlayır"-dır; uzun
 * TTL həmin ssenarini kiçildilmiş formada saxlayardı.
 *
 * ⚠ TTL TƏK BAŞINA KİFAYƏT DEYİL — üzvlük dəyişəndə keş AÇIQ invalidasiya olunur
 * (`invalidateTeamMembership`, `member.service.ts`). TTL yalnız fallback-dır.
 */
const TM_TTL_SEC = 60;
const tmKey = (teamId: string, uid: string) => `tm:${teamId}:${uid}`;

export async function isTeamMemberCached(
  env: Env, teamId: string, uid: string,
): Promise<boolean> {
  const k = tmKey(teamId, uid);
  try {
    const hit = await env.SESSIONS.get(k);
    if (hit === '1') return true;
    if (hit === '0') return false;
  } catch (e: any) {
    // KV oxunmadı → keşsiz davam et (D1 həqiqətin mənbəyidir), rədd etmə.
    console.error('üzvlük keşi oxunmadı', e?.message || e);
  }

  let member = false;
  try {
    member = !!(await env.DB.prepare(
      "SELECT 1 AS x FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'",
    ).bind(teamId, uid).first<any>());
  } catch (e: any) {
    // FAIL-CLOSED: yoxlama xəta verirsə çıxış VERİLMİR (§7.2).
    console.error('üzvlük sorğusu uğursuz', e?.message || e);
    return false;
  }

  // Mənfi nəticə də keşlənir: hücumçunun sadalama cəhdi hər sorğuda D1-ə dəyməsin.
  try {
    await env.SESSIONS.put(k, member ? '1' : '0', { expirationTtl: TM_TTL_SEC });
  } catch (e: any) {
    console.error('üzvlük keşi yazılmadı', e?.message || e);
  }
  return member;
}

/**
 * Üzvlük dəyişdikdə keşin AÇIQ invalidasiyası (§7.3).
 * `removeMember` (həm çıxarılma, həm könüllü çıxış) və `joinTeam` çağırır.
 * Heç vaxt throw etmir — keş təmizliyi əsas əməliyyatı çökdürməməlidir.
 */
export async function invalidateTeamMembership(
  env: Env, teamId: string, uid: string,
): Promise<void> {
  try {
    await env.SESSIONS.delete(tmKey(teamId, uid));
  } catch (e: any) {
    console.error('üzvlük keşi silinmədi', e?.message || e);
  }
}

/* ================= rədd jurnalının tənzimlənməsi ================= */

/**
 * Rədd hadisəsi jurnala yazılsınmı? — hadisə başına bir dəfə / dəqiqədə.
 *
 * ⚠ NİYƏ LAZIMDIR: §5.3 hər rəddin loglanmasını tələb edir, lakin `/files/*`
 * `asset` səbətindədir — dəqiqədə **1200 sorğu**. Filtrsiz hər rədd bir
 * `security_events` sətri yazsaydı, bir hücumçu dəqiqədə 1200 D1 YAZISI
 * yaradardı: jurnal öz-özünə DoS vektoruna çevrilər, real hadisələr isə səs-küydə
 * itərdi. Açar `uid + prefiks + səbəb` üzrədir — yəni HƏR fərqli hücum növü
 * görünür, təkrarları isə birləşir.
 *
 * KV yazısı D1 yazısından ucuzdur və açar sayı məhduddur (prefiks + səbəb sonlu
 * çoxluqdur). Xəta halında `true` qaytarılır — jurnal itməkdənsə təkrarlansın.
 */
const DENY_LOG_TTL_SEC = 60;

export async function shouldLogDenial(
  env: Env, uid: string | null, prefix: string, reason: string,
): Promise<boolean> {
  const k = `fd:${uid || 'anon'}:${prefix}:${reason}`;
  try {
    if (await env.SESSIONS.get(k)) return false;
    await env.SESSIONS.put(k, '1', { expirationTtl: DENY_LOG_TTL_SEC });
    return true;
  } catch (e: any) {
    console.error('rədd jurnalı tənzimlənmədi', e?.message || e);
    return true;
  }
}

/* ================= söhbət iştirakçılığı ================= */

/**
 * `msgfiles/{uid}/…` açarı SAHİBİNDƏN BAŞQASI üçün oxuna bilərmi?
 *
 * ⚠ Açarın özündə söhbət ID-si YOXDUR (`msgfiles/{uid}/{ts}-{rand}-{ad}`), ona
 * görə iştirakçılığı açardan çıxarmaq mümkün deyil. LAKİN açar mesaj sətrində
 * (`room_messages.file_key` / `dm_messages.file_key`) saxlanılır — yəni istinad
 * onsuz da bazadadır və ayrıca `msg_attachments` cədvəli LAZIM DEYİL.
 * (AUDIT-TASK-7 §7.2 variant (b)-nin miqrasiyasız ekvivalenti.)
 *
 * Sorğu `idx_room_messages_file_key` / `idx_dm_messages_file_key` indekslərindən
 * istifadə edir (migration 0028) — onsuz tam cədvəl skanı olardı.
 *
 * Fail-closed: xəta → false.
 */
export async function sharesThreadWith(c: Ctx, key: string, uid: string): Promise<boolean> {
  try {
    // 1) DM: göndərən və ya alan mənəmsə oxuya bilərəm.
    const dm = await c.env.DB.prepare(
      'SELECT 1 AS x FROM dm_messages WHERE file_key = ?1 AND (from_id = ?2 OR to_id = ?2) LIMIT 1',
    ).bind(key, uid).first<any>();
    if (dm) return true;

    // 2) Otaq: fayl hansı otaq(lar)a göndərilib? Qlobal otaq → hər giriş etmiş
    //    istifadəçi; komanda otağı → yalnız həmin komandanın aktiv üzvü
    //    (`guardTeamRoom` ilə eyni qayda).
    const rooms = await c.env.DB.prepare(
      'SELECT DISTINCT room_id FROM room_messages WHERE file_key = ? LIMIT 5',
    ).bind(key).all<any>();

    for (const r of rooms.results) {
      const teamRoom = await c.env.DB.prepare(
        'SELECT team_id FROM team_chat_rooms WHERE id = ?',
      ).bind(r.room_id).first<any>();
      if (!teamRoom) return true;                       // qlobal otaq
      if (await isTeamMemberCached(c.env, String(teamRoom.team_id), uid)) return true;
    }
    return false;
  } catch (e: any) {
    console.error('iştirakçılıq yoxlaması uğursuz', e?.message || e);
    return false;   // FAIL-CLOSED
  }
}

/* ================= əsas qərar funksiyası ================= */

// ID formatı: D1-dəki uid-lər `vbpVokAhLqJA9m0RpqMryroA4S8s` (Firebase mirası) və
// `uuid().replace(/-/g,'')` formalarındadır — hər ikisi `[\w-]+` ilə tutulur.
const OWNER_SEG = /^([\w-]{1,64})\//;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/**
 * Sayt admini yoxlaması — TƏNBƏL (lazy) və sorğu daxilində bir dəfəlik.
 *
 * ⚠ NİYƏ TƏNBƏL: ilk versiyada `c.isAdmin` `/files/` yolunun ƏVVƏLİNDƏ, hər
 * qeyri-publik sorğu üçün hesablanırdı və ölçmə +30 ms p95 göstərdi — halbuki
 * öz DM əlavəsini oxumaq üçün heç bir D1 sorğusu lazım deyil. İndi sorğu YALNIZ
 * qərar həqiqətən admin statusundan asılı olanda edilir: arxiv, yad msgfiles,
 * üzvü olmadığın komanda və sadalanmayan prefiks. Sahib/üzv yolları toxunmur.
 */
export type AdminCheck = () => Promise<boolean>;

/** Sorğu daxilində nəticəni memoizasiya edən resolver qurur. */
export function lazyAdminCheck(env: Env, uid: string | null): AdminCheck {
  // ⚠ Memo DƏYİŞƏNİ FUNKSİYA DAXİLİNDƏDİR — modul səviyyəsində saxlansaydı,
  // isolate təkrar istifadə olunanda bir istifadəçinin admin statusu digərinə
  // sızardı.
  let memo: Promise<boolean> | null = null;
  return () => {
    if (!uid) return Promise.resolve(false);
    memo ??= env.DB.prepare('SELECT 1 AS x FROM admins WHERE user_id = ?').bind(uid)
      .first<any>().then(r => !!r).catch(e => {
        console.error('admin yoxlaması uğursuz', e?.message || e);
        return false;   // FAIL-CLOSED
      });
    return memo;
  };
}

/**
 * R2 açarı üçün oxu avtorizasiyası.
 *
 * ⚠ SIRALAMA TƏSADÜFİ DEYİL: I/O tələb etməyən yollar ƏVVƏL gəlir. Feed səhifəsi
 * 20+ `/files/` sorğusu edir və onların demək olar hamısı `posts/` və `avatars/`
 * prefiksindədir — bunlara bir sorğu belə əlavə etmək gecikməni ölçüləbilən
 * şəkildə artırardı (qəbul həddi: p95 artımı < 30 ms, §7.3).
 */
export async function canReadKey(c: Ctx, key: string, isAdmin: AdminCheck): Promise<AccessDecision> {
  // ─── Sürətli yol 1: normallaşdırma və sanity ───
  // `decodeURIComponent` `index.ts`-də edilir, yəni buraya artıq açılmış açar
  // gəlir. L-7 R2-də path traversal-ın istismar edilə bilməyəcəyini deyir, lakin
  // `..`/`//` prefiks REGEX UYĞUNLUĞUNU poza bilər (`msgfiles/../teams/x`).
  if (!key
    || key.length > 512
    || key.startsWith('/')
    || key.includes('..')
    || key.includes('//')
    || key.includes('\\')
    // Nəzarət simvolları (CR/LF/NUL) — başlıq inyeksiyası və açar saxtakarlığı.
    || CONTROL_CHARS.test(key)) {
    return deny('malformed_key', keyPrefix(key || ''));
  }

  const prefix = keyPrefix(key);

  // ─── Sürətli yol 2: publik prefikslər — DB sorğusu YOX ───
  // Qərar (§7.1/1): prefiks yoxlaması kifayətdir. Bu fayllar onsuz da publik
  // feed-də və profillərdə göstərilirdi; hər şəkilə "müəllif bloklanıbmı"
  // sorğusu əlavə etmək performansı öldürər, qazanc isə minimaldır
  // (bloklanmış istifadəçinin məzmunu M-10 ilə onsuz da feed-dən çıxarılıb).
  if (key.startsWith('avatars/') || key.startsWith('posts/')) {
    return allow('public', 'public_prefix', prefix);
  }

  // ─── Sürətli yol 3: arxiv — YALNIZ admin ───
  // Bir açar bütöv otağın mesaj tarixçəsini verir; ən ağır prefiks budur.
  if (key.startsWith('archive/')) {
    return (await isAdmin())
      ? allow('no-store', 'admin', prefix)
      : deny('archive_admin_only', prefix);
  }

  // `index.ts` onsuz da 401 qaytarır, lakin bu funksiya ÖZ-ÖZÜNƏ də təhlükəsiz
  // olmalıdır — `c.user!` işarəsinə güvənmirik.
  if (!c.user) return deny('no_user', prefix);
  const uid = c.user.id;

  // ─── Sahiblik: msgfiles/{uid}/ ───
  if (key.startsWith('msgfiles/')) {
    const m = OWNER_SEG.exec(key.slice('msgfiles/'.length));
    if (!m) return deny('msgfiles_no_owner', prefix);
    // ⚠ SIRALAMA: sahiblik ƏVVƏL — ən çox rast gəlinən hal budur və heç bir
    // I/O tələb etmir. Admin yoxlaması yalnız sahib olmayan üçün işə düşür.
    if (m[1] === uid) return allow('private', 'own_attachment', prefix);
    if (await sharesThreadWith(c, key, uid)) return allow('private', 'shares_thread', prefix);
    return (await isAdmin())
      ? allow('private', 'admin', prefix)
      : deny('not_thread_participant', prefix);
  }

  // ─── Üzvlük: teams/{teamId}/ ───
  if (key.startsWith('teams/')) {
    const m = OWNER_SEG.exec(key.slice('teams/'.length));
    if (!m) return deny('teams_no_id', prefix);
    // Qərar (§7.1/2): birinci mərhələdə SADƏ üzvlük. Kateqoriya səviyyəsində
    // incə icazələr (`documents/` vs `public/`) Task 10-dur — sadə qayda tez
    // tətbiq olunur və sızmanı dərhal bağlayır.
    //
    // ⚠ SIRALAMA: üzvlük (keşlənmiş KV oxusu) ƏVVƏL, admin (D1) SONRA. Adminlərin
    // əksəriyyəti öz komandalarının faylını oxuyur — o hal keşdə bitir və D1-ə
    // ümumiyyətlə getmir.
    if (await isTeamMemberCached(c.env, m[1], uid)) return allow('private', 'team_member', prefix);
    return (await isAdmin())
      ? allow('private', 'admin', prefix)
      : deny('not_team_member', prefix);
  }

  // ─── DEFAULT DENY ───
  // Sadalanmayan hər prefiks bağlıdır. R2 inventarı (§7.0/Sual 2) hazırda yalnız
  // `avatars/`, `posts/`, `msgfiles/` göstərir; yeni prefiks əlavə edən hər kəs
  // siyasətini də BURADA elan etməlidir, əks halda faylı heç kim oxuya bilməz.
  return c.isAdmin
    ? allow('no-store', 'admin', prefix)
    : deny('unlisted_prefix', prefix);
}
