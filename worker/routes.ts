// Bütün /api marşrutları. Dispatch cədvəli index.ts-dədir.
import {
  Ctx, json, err, readJson, uuid, now, 
  normalizeUsername, clampStr, toJSON, fromJSON, likePattern, searchNormalize,
  pairIdFor, chunkForD1, placeholders,
  mapUser, mapPost, mapMsg, mapTask, mapSubmission, fileUrl,
} from './util';
import { logAdmin } from './admin-log';
import { grantXp, compensateXp, xpInvariant } from './xp';
import { alert } from './alerts';
import { rateLimit } from './auth';
import { QueueService } from './services/queue';
import { emailEnabled } from './email';
import { configuredProviders } from './oauth';
import { sanitizeMsg } from './msg';
import { readArchive, deletedUidSet, exportArchivedMessages } from './archive';


/* ================= köməkçilər — `routes/shared.ts`-ə köçürüldü ================= */
// AUDIT-TASK-10 / Faza 3.1. Onlar İNDİ bir neçə domen modulu tərəfindən
// işlədilir (auth, upload, post…), ona görə paylaşılan qatdadır.
import {
  D, badReq, notify, notifyMentions, bumpActivity, bumpProgress,
  roomBroadcast, userPush, deleteR2Keys, csvRow,
  POST_BLOCKS_MAX_BYTES, POST_XP, COMMENT_XP, SOLUTION_XP,
} from './routes/shared';
export type { LogLevel } from './admin-log';

/* ================= USERS / PROFİL ================= */
export async function listUsers(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM users ORDER BY joined_at DESC LIMIT 500').all<any>();
  return json({ users: rows.results.map(r => mapUser(r)) });
}

/* ---------- İstifadəçi kataloqu (TASK-6 / İstifadəçilər#5) ----------
   listUsers() qlobal identifikasiya keşidir (post müəllifi, DM, mention) və
   OLDUĞU KİMİ qalır. Bu isə İstifadəçilər səhifəsinin sorğusudur: D1-də
   sıralama + filtr + keyset pagination (0006-dakı kompozit index-lər).      */

// sort açarı → [SQL sütunu, istiqamət]. Ağ siyahı: dəyər birbaşa SQL-ə düşdüyü
// üçün istifadəçi girişi HEÇ VAXT buraya keçmir (injection qapısı bağlıdır).
const DIR_SORTS: Record<string, [string, 'ASC' | 'DESC']> = {
  recent: ['joined_at', 'DESC'],      // default — ən yeni qoşulanlar
  xp: ['xp', 'DESC'],
  active: ['last_active_at', 'DESC'],
  alpha: ['username', 'ASC'],
};
const DIR_PAGE = 24;

export async function usersDirectory(c: Ctx) {
  const u = new URL(c.req.url).searchParams;
  const sortKey = u.get('sort') || 'recent';
  const [col, dir] = DIR_SORTS[sortKey] || DIR_SORTS.recent;

  const where: string[] = ['blocked = 0', 'id != ?'];
  const vals: unknown[] = [c.user!.id];

  // Mətn axtarışı — ad / istifadəçi adı üzrə.
  // ⚠ Hər `LIKE`-da `ESCAPE '\'` MƏCBURİDİR — dəyərlərdə `_`/`%` escape olunur,
  // amma ESCAPE bəyan edilməsə SQLite `\_`-i "\ + istənilən simvol" sayır və
  // `_` olan adlar (bütün `e2e_*` hesablar) tapılmır (adminUsersList-dəki eyni buq).
  const q = (u.get('q') || '').trim().toLowerCase();
  if (q) {
    // D-3: `search_name` normallaşdırılmış sütundur — `Təhməz` sorğusu
    // `Tehmez` yazılışını (və əksini) tapır. Sorğu tərəfi YAZI tərəfi ilə
    // eyni funksiyadan keçir (`searchNormalize`), əks halda heç nə tapılmaz.
    // ⚠ YALNIZ anonim `?` işlədilir. Nömrəli (`?1`) placeholder-lər bu sorğuda
    // TƏHLÜKƏLİDİR: `where`/`vals` cütü dinamik yığılır və siyahının əvvəlində
    // artıq `id != ?` parametri var — `?1` həmin istifadəçi id-sinə düşərdi,
    // axtarış mətninə yox. (Məhz bu səhv D-3 testini sındırmışdı.)
    where.push("(lower(name) LIKE ? ESCAPE '\\' OR lower(username) LIKE ? ESCAPE '\\'"
      + " OR search_name LIKE ? ESCAPE '\\')");
    const likeRaw = likePattern(q);
    vals.push(likeRaw, likeRaw, likePattern(searchNormalize(q)));
  }

  // Skill/səviyyə/məqsəd JSON sütunlarındadır (prog_levels, lang_levels,
  // looking_for). D1-də json_extract var, amma açar adı dinamikdir → LIKE ilə
  // ilkin daraltma edib dəqiq yoxlamanı JS-də aparırıq (aşağıda).
  const skill = (u.get('skill') || '').trim();
  if (skill) {
    where.push("(prog_levels LIKE ? ESCAPE '\\' OR lang_levels LIKE ? ESCAPE '\\')");
    const key = '%"' + skill.replace(/[%_\\]/g, ch => '\\' + ch) + '"%';
    vals.push(key, key);
  }
  const looking = (u.get('looking') || '').trim();
  if (looking) {
    where.push("looking_for LIKE ? ESCAPE '\\'");
    vals.push('%"' + looking.replace(/[%_\\]/g, ch => '\\' + ch) + '"%');
  }
  if (u.get('extra') === 'verified') where.push('verified = 1');

  // Keyset (cursor): "<sortDəyəri>|<id>". OFFSET-dən fərqli olaraq dərin
  // səhifələrdə də sabit sürətlidir və sətir sürüşməsi baş vermir.
  // `username` mətn, qalan sıra sütunları INTEGER-dir — cursor dəyəri URL-dən
  // həmişə string gəldiyi üçün rəqəm sütunlarında Number-ə çevrilir, əks halda
  // SQLite mətn müqayisəsi edərdi ("9" > "10").
  const numericSort = col !== 'username';
  const cursor = u.get('cursor');
  if (cursor) {
    const i = cursor.lastIndexOf('|');
    if (i > 0) {
      const rawVal = cursor.slice(0, i);
      const cid = cursor.slice(i + 1);
      const cv: string | number = numericSort ? Number(rawVal) : rawVal;
      if (!(numericSort && Number.isNaN(cv as number))) {
        const cmp = dir === 'DESC' ? '<' : '>';
        where.push(`(${col} ${cmp} ? OR (${col} = ? AND id > ?))`);
        vals.push(cv, cv, cid);
      }
    }
  }

  const limit = Math.min(Math.max(parseInt(u.get('limit') || '', 10) || DIR_PAGE, 1), 60);
  // limit+1 çəkirik: əlavə sətir gəlirsə daha səhifə var deməkdir.
  const sql =
    `SELECT * FROM users WHERE ${where.join(' AND ')} ` +
    `ORDER BY ${col} ${dir}, id ASC LIMIT ?`;
  const rows = await D(c).prepare(sql).bind(...vals, limit + 1).all<any>();

  // Cursor SQL nəticəsindən hesablanır — aşağıdakı JS süzgəcindən ƏVVƏL.
  // Əks halda süzgəcin atdığı sətrlər növbəti səhifədə təkrar sorğulanardı.
  const hasMore = rows.results.length > limit;
  const pageRows = hasMore ? rows.results.slice(0, limit) : rows.results;
  const lastRow = pageRows[pageRows.length - 1] as any;
  const nextCursor = hasMore && lastRow ? `${lastRow[col]}|${lastRow.id}` : null;

  let list = pageRows.map(r => mapUser(r));

  // Dəqiq skill/səviyyə süzgəci: LIKE yalnız açarın mətndə olmasını yoxlayır
  // (məs. "Java" sorğusu "JavaScript"-ə də uyğun gəlir), burada isə həqiqətən
  // həmin skill-in — və istənilirsə səviyyəsinin — olması təsdiqlənir.
  // ⚠ Nəticədə səhifə `limit`-dən az element qaytara bilər; müştəri
  // `nextCursor` null olana qədər yükləməyə davam edir.
  const level = (u.get('level') || '').trim();
  if (skill || level) {
    list = list.filter((x: any) => {
      const all = { ...(x.progLevels || {}), ...(x.langLevels || {}) };
      if (skill && !(skill in all)) return false;
      if (level) {
        if (skill) return all[skill] === level;
        return Object.values(all).includes(level);
      }
      return true;
    });
  }

  return json({ users: list, nextCursor });
}

const SELF_FIELDS: Record<string, [string, number]> = {
  name: ['name', 60], bio: ['bio', 400], birthDate: ['birth_date', 10], gender: ['gender', 10],
  country: ['country', 40], city: ['city', 40], goals: ['goals', 300],
  instagram: ['instagram', 40], github: ['github', 40], linkedin: ['linkedin', 60],
  telegram: ['telegram', 40], website: ['website', 100], contactEmail: ['contact_email', 120],
  photoURL: ['photo_url', 300], lastActiveDay: ['last_active_day', 10],
  activeProjectId: ['active_project_id', 36],
};
export async function patchMe(c: Ctx) {
  const b = await readJson(c.req);
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, [col, max]] of Object.entries(SELF_FIELDS)) {
    if (k in b) { sets.push(`${col} = ?`); vals.push(b[k] === null ? null : clampStr(b[k], max)); }
  }
  if ('showProjectOnProfile' in b) {
    sets.push('show_project_on_profile = ?');
    vals.push(b.showProjectOnProfile ? 1 : 0);
  }
  for (const k of ['progLevels', 'langLevels', 'lookingFor', 'activityDays'] as const) {
    if (k in b) {
      const col = { progLevels: 'prog_levels', langLevels: 'lang_levels', lookingFor: 'looking_for', activityDays: 'activity_days' }[k];
      sets.push(`${col} = ?`);
      vals.push(toJSON(b[k], k === 'lookingFor' ? '[]' : '{}'));
    }
  }
  if ('age' in b) { sets.push('age = ?'); vals.push(parseInt(b.age, 10) || 18); }
  if ('streak' in b) { sets.push('streak = ?'); vals.push(parseInt(b.streak, 10) || 0); }
  if ('mustResetPassword' in b && b.mustResetPassword === false) sets.push('must_reset_password = 0');
  // D-3: ad dəyişəndə axtarış sütunu da yenilənməlidir — əks halda profil
  // redaktəsindən sonra istifadəçi öz yeni adı ilə tapılmazdı.
  if ('name' in b) {
    sets.push('search_name = ?');
    vals.push(searchNormalize(clampStr(b.name, 60) + ' ' + c.user!.username));
  }
  if (!sets.length) return badReq('Dəyişiklik yoxdur.');
  vals.push(c.user!.id);
  await D(c).prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  let fresh = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(c.user!.id).first<any>();

  // TASK-8 / Bənd 6 — profil tamamlama bonusu (bir dəfə, +20 XP).
  //
  // Tamlıq SERVERDƏ hesablanır: client-ə güvənsək istifadəçi öz-özünə XP
  // "hədiyyə" edə bilərdi. Verildi-verilmədi `settings.profileBonusGiven`
  // bayrağı ilə izlənilir — idempotent, təkrar verilmir.
  const gaveBonus = await maybeProfileBonus(c, fresh);
  if (gaveBonus) fresh = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(c.user!.id).first<any>();

  return json({ user: mapUser(fresh, true), bonusGiven: gaveBonus });
}

const PROFILE_BONUS_XP = 20;
// Bənd 6-dakı tamlıq sahələri — `js/completeness.js` ilə EYNİ məntiq.
// İki tərəf ayrılsa client bir faiz, server başqa faiz göstərər.
function isProfileComplete(u: any): boolean {
  const prog = fromJSON<Record<string, unknown>>(u.prog_levels, {});
  const langs = fromJSON<Record<string, unknown>>(u.lang_levels, {});
  const looking = fromJSON<unknown[]>(u.looking_for, []);
  return !!u.photo_url
    && (u.bio || '').trim().length >= 10
    && (u.goals || '').trim().length >= 5
    && Object.keys(prog).length > 0
    && Object.keys(langs).length > 0
    && looking.length > 0
    && !!(u.city || '').trim()
    && !!(u.github || u.linkedin || u.instagram || u.telegram || u.website);
}

async function maybeProfileBonus(c: Ctx, u: any): Promise<boolean> {
  const settings = fromJSON<any>(u.settings, {});
  if (settings.profileBonusGiven) return false;
  if (!isProfileComplete(u)) return false;

  settings.profileBonusGiven = true;
  await D(c).prepare('UPDATE users SET settings = ? WHERE id = ?')
    .bind(JSON.stringify(settings), u.id).run();
  // H-5: XP artıq birbaşa yazılmır. `refId = 'profile'` sabitdir → UNIQUE
  // indeksi bonusu hesab başına BİR DƏFƏYƏ bağlayır. `settings` bayrağı ilə
  // ikiqat qoruma: bayraq JSON birləşdirməsində itsə belə XP təkrar verilmir.
  const g = await grantXp(c.env, u.id, 'profile_bonus', 'profile', PROFILE_BONUS_XP);
  return g.granted;
}

export async function patchSettings(c: Ctx) {
  const b = await readJson(c.req);
  const cur = fromJSON<any>(c.user!.settings as any, {});
  const merged = {
    ...cur, ...b,
    privacy: { ...(cur.privacy || {}), ...(b.privacy || {}) },
    notifications: { ...(cur.notifications || {}), ...(b.notifications || {}) },
  };
  await D(c).prepare('UPDATE users SET settings = ? WHERE id = ?')
    .bind(JSON.stringify(merged), c.user!.id).run();
  return json({ settings: merged });
}

export async function mySocial(c: Ctx) {
  const uid = c.user!.id;
  const [likes, bms, fing, fers, shares] = await D(c).batch([
    D(c).prepare('SELECT post_id FROM likes WHERE user_id = ?').bind(uid),
    D(c).prepare('SELECT post_id FROM bookmarks WHERE user_id = ?').bind(uid),
    D(c).prepare('SELECT target_id FROM follows WHERE follower_id = ?').bind(uid),
    D(c).prepare('SELECT follower_id FROM follows WHERE target_id = ?').bind(uid),
    // Re-post toggle vəziyyəti: müştəri əvvəl bunu yalnız feed pəncərəsindən
    // çıxarırdı və pəncərədən kənar re-post-lar itirdi (TASK-7 / Bənd 4).
    D(c).prepare('SELECT post_id FROM post_shares WHERE user_id = ?').bind(uid),
  ]);
  return json({
    likes: (likes.results as any[]).map(r => r.post_id),
    bookmarks: (bms.results as any[]).map(r => r.post_id),
    following: (fing.results as any[]).map(r => r.target_id),
    followers: (fers.results as any[]).map(r => r.follower_id),
    reposts: (shares.results as any[]).map(r => r.post_id),
  });
}

export async function followLists(c: Ctx, uid: string) {
  const kind = c.url.searchParams.get('kind') === 'followers' ? 'followers' : 'following';
  if (uid !== c.user!.id && !c.isAdmin && kind === 'following') {
    const target = await D(c).prepare('SELECT settings FROM users WHERE id = ?').bind(uid).first<any>();
    const priv = fromJSON<any>(target?.settings, {})?.privacy || {};
    if (priv.showFollowing === false) return err('Bu siyahı gizlidir.', 403, 'forbidden');
  }
  const q = kind === 'followers'
    ? 'SELECT follower_id AS u FROM follows WHERE target_id = ?'
    : 'SELECT target_id AS u FROM follows WHERE follower_id = ?';
  const rows = await D(c).prepare(q).bind(uid).all<any>();
  return json({ uids: rows.results.map(r => r.u) });
}

export async function followPut(c: Ctx, uid: string) {
  if (uid === c.user!.id) return badReq('Özünü izləyə bilməzsən.');
  await D(c).prepare('INSERT OR IGNORE INTO follows (follower_id, target_id, created_at) VALUES (?,?,?)')
    .bind(c.user!.id, uid, now()).run();
  await notify(c, uid, 'follow', 'səni izləməyə başladı');
  return json({ ok: true });
}
export async function followDelete(c: Ctx, uid: string) {
  await D(c).prepare('DELETE FROM follows WHERE follower_id = ? AND target_id = ?').bind(c.user!.id, uid).run();
  return json({ ok: true });
}

export async function progressOf(c: Ctx, uid: string) {
  const rows = await D(c).prepare('SELECT * FROM progress WHERE user_id = ?').bind(uid).all<any>();
  const out: Record<string, any> = {};
  rows.results.forEach(r => { out[r.field] = { posts: r.posts, tasks: r.tasks, xp: r.xp }; });
  return json({ progress: out });
}

/* ================= POSTS ================= */

/**
 * Post şəkil istinadının normallaşdırılması — AUDIT C-1 / zəncirin 1-ci addımı.
 *
 * Eyni R2 açarı client-dən üç formada gələ bilər:
 *   `/files/posts/x/y`, `posts/x/y`, `https://<domen>/files/posts/x/y`
 * Yoxlama xam sətrə baxsaydı, hücumçu sadəcə formanı dəyişib yan keçərdi.
 * Tanınmayan forma (data:, xarici domen) boş sətrə düşür və yoxlamada rədd olunur.
 */
function normalizeFileRef(raw: unknown, ownHost: string): string {
  let v = String(raw ?? '').trim();
  if (!v) return '';
  // Mütləq URL → yalnız ÖZ host-umuz qəbul olunur (sorğunun gəldiyi host).
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (u.host !== ownHost) return '';
      v = u.pathname;
    } catch { return ''; }
  }
  if (v.startsWith('/files/')) v = v.slice('/files/'.length);
  // Traversal və protokol-nisbi (`//evil.com/...`) formalar birbaşa rədd.
  if (!v || v.startsWith('/') || v.includes('..') || v.includes('//')) return '';
  return v;
}

/**
 * Post şəkil mənbələrinin sahiblik yoxlaması — AUDIT C-1 / zəncirin 1-ci addımı.
 *
 * ƏVVƏL: `blocks` verbatim, `imageKeys` isə `toJSON(b.imageKeys, '[]')` ilə XAM
 * saxlanılırdı. Hücumçu `blocks:[{type:'image',urls:['/files/teams/<yad>/…']}]`
 * göndərib QLOBAL FEED-də yad komandanın məxfi sənədini göstərə bilirdi — feed-i
 * açan hər kəsin brauzeri faylı çəkirdi.
 *
 * ⚠ Bu, `canReadKey`-in ƏVƏZİ deyil, ONA ƏLAVƏDİR (dərinlikdə müdafiə):
 * `canReadKey` oxunu bağlayır, bu yoxlama isə istinadın ilk növbədə
 * yaradılmasının qarşısını alır (feed-də sınıq şəkil görünməsin).
 *
 * Qayda: post yalnız MÜƏLLİFİN öz yüklədiyi şəkilləri göstərə bilər →
 * `posts/{uid}/…`. Xarici URL-lərə icazə verilmir; CSP `img-src 'self'` onsuz da
 * bloklayırdı, indi server də aydın xəta ilə rədd edir.
 */
function collectImageRefs(blocks: any[], imageKeys: unknown): string[] {
  const refs: string[] = [];
  // Bütün blok növləri gəzilir, yalnız `image` deyil: gələcəkdə `video`/`file`
  // bloku əlavə edilsə də URL sahələri bu siyahıya avtomatik düşsün.
  //
  // ⚠ BURADA KƏSMƏ YOXDUR — girişlər `clampBlockRefs`/`clampImageKeys` ilə
  // ARTIQ kəsilmiş gəlir. Bax həmin funksiyaların şərhi (AUDIT-TASK-9 / D-1).
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (!b || typeof b !== 'object') continue;
    if (Array.isArray(b.urls)) refs.push(...b.urls.map(String));
    if (typeof b.url === 'string') refs.push(b.url);
    if (typeof b.src === 'string') refs.push(b.src);
  }
  if (Array.isArray(imageKeys)) refs.push(...imageKeys.map(String));
  return refs;
}

/**
 * 🔴 AUDIT-TASK-9 / D-1 — YOXLANILAN sərhəd = SAXLANILAN sərhəd.
 *
 * Əvvəl `collectImageRefs` yalnız ilk 30 `imageKeys`-i və blok başına ilk 20
 * `urls`-i yoxlayırdı, `createPost` isə `toJSON(b.imageKeys)` ilə XAM massivi
 * saxlayırdı. Nəticə: 31-ci açardan sonrakı istinadlar `assertOwnedImageRefs`
 * yoxlamasından TAMAMİLƏ yan keçib bazaya düşürdü — yəni AUDIT C-1-in bağladığı
 * zəncirin 1-ci addımı 30-dan çox şəkilli postda yenidən açıq idi.
 *
 * Bu, Task 8 §7.b ilə eyni sinifdir: sərhəd bir yerdə var, digərində yoxdur və
 * fərq yalnız limit ÜSTÜ data ilə görünür. Kəsmə indi saxlamadan ƏVVƏL edilir.
 */
const REF_URLS_PER_BLOCK = 20;
const REF_IMAGE_KEYS = 30;

const clampBlockRefs = (blocks: any[]): any[] => blocks.map(blk => (
  blk && typeof blk === 'object' && Array.isArray(blk.urls)
    ? { ...blk, urls: blk.urls.slice(0, REF_URLS_PER_BLOCK).map(String) }
    : blk
));

const clampImageKeys = (v: unknown): string[] =>
  Array.isArray(v) ? v.slice(0, REF_IMAGE_KEYS).map(String) : [];

/**
 * `ownerUid` = postun MÜƏLLİFİ, redaktə edən şəxs yox. Admin başqasının postunu
 * redaktə edəndə (`patchPost`) müəllifin öz şəkilləri qanunidir — yoxlamanı
 * redaktorun uid-inə bağlasaq admin hər redaktəsində postun şəkillərini sındırardı.
 */
function assertOwnedImageRefs(c: Ctx, refs: string[], ownerUid: string): Response | null {
  const own = `posts/${ownerUid}/`;
  for (const raw of refs) {
    const key = normalizeFileRef(raw, c.url.host);
    if (!key || !key.startsWith(own)) {
      return err('Post yalnız öz yüklədiyiniz şəkilləri göstərə bilər.', 400, 'invalid_image_ref');
    }
  }
  return null;
}
/**
 * AUDIT M-10 — bloklanmış istifadəçinin postları feed-də QALIRDI, halbuki
 * `publicGetPost` onları 404 ilə gizlədirdi. Daxili ziddiyyət: eyni post
 * birbaşa linkdə "yoxdur", feed-də isə görünürdü.
 * `JOIN users … WHERE blocked = 0` hər iki yolu eyniləşdirir.
 * (İndeks: `idx_users_blocked` — bax D-4.)
 */
export async function feed(c: Ctx) {
  const query = `
    SELECT p.*,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    JOIN users u ON p.author_id = u.id
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE u.blocked = 0
    ORDER BY p.created_at DESC LIMIT 60
  `;
  const rows = await D(c).prepare(query).all<any>();
  return json({ posts: rows.results.map(mapPost) });
}

export async function getPost(c: Ctx, id: string) {
  const query = `
    SELECT p.*,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE p.id = ?
  `;
  const row = await D(c).prepare(query).bind(id).first();
  if (!row) return err('Post tapılmadı.', 404);
  return json({ post: mapPost(row) });
}

export async function createPost(c: Ctx) {
  const b = await readJson(c.req);
  // AUDIT M-5 — `blocks` JSON-u ölçü limiti OLMADAN saxlanılırdı: blok sayı
  // 20-yə kəsilirdi, lakin BİR blokun məzmunu istənilən uzunluqda ola bilərdi
  // → D1 sətrinin şişməsi, storage DoS.
  //
  // İki qatlı tavan: hər blok üçün 5000 simvol, sonra ÜMUMİ JSON üçün 64 KB.
  // Ümumi tavan blok sayına deyil, `JSON.stringify(...).length`-ə baxır —
  // 20 × 5000 = 100 KB hələ də D1 sətri üçün çoxdur.
  const blocks = Array.isArray(b.blocks)
    ? clampBlockRefs(b.blocks.slice(0, 20).map((blk: any) => (
      blk && typeof blk === 'object' && typeof blk.content === 'string'
        ? { ...blk, content: clampStr(blk.content, 5000) }
        : blk
    )))
    : [];
  // D-1: yoxlanılan massivin EYNİSİ saxlanılır (bax `clampImageKeys`).
  const imageKeys = clampImageKeys(b.imageKeys);
  if (JSON.stringify(blocks).length > POST_BLOCKS_MAX_BYTES) {
    return err('Post həddindən artıq böyükdür.', 400, 'payload_too_large');
  }
  // AUDIT C-1 — istismar zəncirinin 1-ci addımı burada kəsilir (bax
  // `assertOwnedImageRefs`). `imageKeys` VƏ `blocks[].urls` birlikdə yoxlanılır:
  // birini qoruyub digərini açıq qoymaq zənciri bağlamazdı.
  const refDenied = assertOwnedImageRefs(c, collectImageRefs(blocks, imageKeys), c.user!.id);
  if (refDenied) return refDenied;
  let sharedPostId = b.sharedPostId ? clampStr(b.sharedPostId, 50) : null;
  if (sharedPostId) {
    // İçiçə re-postların qarşısını al: hədəf özü də re-post-dursa, ən orijinal posta düzəlt (flatten-to-root).
    const target = await D(c).prepare('SELECT shared_post_id FROM posts WHERE id = ?').bind(sharedPostId).first<any>();
    if (!target) return err('Orijinal post tapılmadı.', 404);
    if (target?.shared_post_id) sharedPostId = target.shared_post_id;
  }
  // Birbaşa re-post (mətnsiz) artıq toggle endpoint-dən keçir → burada yalnız quote (öz mətni ilə).
  if (sharedPostId && !blocks.length) return badReq('Birbaşa re-post üçün /repost istifadə edin.');
  if (!blocks.length && !sharedPostId) return badReq('Post boş ola bilməz.');
  const postType = sharedPostId ? 'quote' : 'original';
  const tags: string[] = Array.isArray(b.tags) ? b.tags.slice(0, 12).map((t: unknown) => clampStr(t, 30)) : [];
  const firstText = (blocks.find((x: any) => x.type === 'text') || {}).content || '';
  const quoteText = postType === 'quote' ? clampStr(firstText, 500) : null;
  const id = uuid();
  await D(c).prepare(
    'INSERT INTO posts (id, author_id, author_name, blocks, image_keys, text, tags, created_at, shared_post_id, post_type, quote_text) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
  ).bind(id, c.user!.id, c.user!.name, JSON.stringify(blocks),
    JSON.stringify(imageKeys), clampStr(firstText, 300), JSON.stringify(tags), now(), sharedPostId, postType, quoteText).run();
  // H-5: XP idempotent + gündəlik tavanlı verilir. Tavana çatanda post YENƏ DƏ
  // yaradılır — yalnız XP verilmir (audit §B-3: "əməliyyat uğurlu olsun").
  const xpGrant = await grantXp(c.env, c.user!.id, 'post', id, POST_XP);
  await bumpActivity(c);
  for (const t of tags) await bumpProgress(c, c.user!.id, t, 'posts');
  // ⚡ FAN-OUT NÖVBƏYƏ (TASK-8 / Bənd 18).
  //
  // Əvvəl @mention bildirişləri MƏHZ BURADA, sorğunun içində göndərilirdi:
  // 20 nəfər qeyd edilmiş postda 20+ ardıcıl D1 yazısı — istifadəçi "Paylaş"
  // düyməsindən sonra hamısını gözləyirdi. İndi post yazılan kimi cavab
  // qayıdır, bildirişlər isə arxada işlənir.
  //
  // `enqueue` növbə yoxdursa işi SİNXRON icra edir → funksionallıq itmir.
  const mentionText = blocks.map((x: any) => x.content || '').join(' ');
  const queueService = new QueueService(c.env);
  c.ctx.waitUntil(Promise.all([
    queueService.publish({
      type: 'MentionFanout', fromId: c.user!.id, fromName: c.user!.name,
      text: mentionText, label: 'səni paylaşımda qeyd etdi', postId: id,
    }),
    queueService.publish({
      type: 'PostCreated', postId: id, authorId: c.user!.id,
      authorName: c.user!.name, text: clampStr(mentionText, 120),
    }),
  ]));

  if (sharedPostId) {
    await D(c).prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').bind(sharedPostId).run();
    const orig = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(sharedPostId).first<any>();
    if (orig) await notify(c, orig.author_id, 'repost', 'paylaşımını sitat gətirdi', sharedPostId);
  }

  const query = `
    SELECT p.*,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE p.id = ?
  `;
  const row = await D(c).prepare(query).bind(id).first();
  // `xpCapped` — UI "Bugünkü XP limitinə çatdınız" bildirişi üçün (3 dildə).
  return json({ post: mapPost(row), xpCapped: xpGrant.reason === 'daily_cap' });
}

export async function patchPost(c: Ctx, id: string) {
  const row = await D(c).prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>();
  if (!row) return err('Post tapılmadı.', 404);
  if (row.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const b = await readJson(c.req);
  const blocks = Array.isArray(b.blocks)
    ? clampBlockRefs(b.blocks.slice(0, 20))   // D-1: yoxlanılan = saxlanılan
    : fromJSON<any[]>(row.blocks, []);
  // AUDIT C-1 — redaktə yolu da yoxlanılır. Yalnız `createPost`-u qorusaydıq
  // hücumçu boş post yaradıb dərhal PATCH ilə məxfi açarı yerləşdirərdi.
  // Yoxlama YALNIZ client yeni bloklar göndərəndə işləyir: mövcud sətrin öz
  // blokları (`fromJSON(row.blocks)`) müəllifin köhnə, qanuni məzmunudur.
  if (Array.isArray(b.blocks)) {
    const refDenied = assertOwnedImageRefs(c, collectImageRefs(blocks, null), String(row.author_id));
    if (refDenied) return refDenied;
  }
  const firstText = (blocks.find((x: any) => x.type === 'text') || {}).content || b.text || '';
  await D(c).prepare('UPDATE posts SET blocks = ?, text = ?, edited_at = ? WHERE id = ?')
    .bind(JSON.stringify(blocks), clampStr(firstText, 300), now(), id).run();
  return json({ ok: true });
}

export async function deletePost(c: Ctx, id: string) {
  const row = await D(c).prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>();
  // ⚠ Tapılmayanda 404 qaytarılır, `{ok:true}` DEYİL. Səssiz 200 real bir bug-ı
  // gizlədirdi: müştəri `/api/posts/undefined`-ə sorğu göndərirdi, server "oldu"
  // deyirdi, UI "silindi" toast-ı göstərirdi, post isə yerində qalırdı
  // (TASK-7 / Bənd 1). İdempotentlik müştəri tərəfdə saxlanılır: 404 = "artıq yoxdur".
  if (!row) return err('Post tapılmadı.', 404);
  if (row.author_id !== c.user!.id && !c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const keys = fromJSON<string[]>(row.image_keys, []);
  await deleteR2Keys(c, keys);
  // Cascade (Cloud-Function trigger ekvivalenti), atomik batch. D1-də
  // `PRAGMA foreign_keys` zəmanətli deyil, `bookmarks`/`notifications`-da isə
  // FK ümumiyyətlə yoxdur — ona görə asılılar burada AÇIQ təmizlənir.
  const stmts = [
    D(c).prepare('DELETE FROM posts WHERE id = ?').bind(id),
    // orijinal müəllifin öz postu → ona istinad edən repost/quote-lar "silinib"
    // soft-mark olunur (quote öz mətnini saxlayır).
    D(c).prepare('UPDATE posts SET original_deleted = 1 WHERE shared_post_id = ?').bind(id),
    D(c).prepare('DELETE FROM post_shares WHERE post_id = ? OR repost_id = ?').bind(id, id),
    D(c).prepare('DELETE FROM comments WHERE post_id = ?').bind(id),
    D(c).prepare('DELETE FROM likes WHERE post_id = ?').bind(id),
    D(c).prepare('DELETE FROM bookmarks WHERE post_id = ?').bind(id),
    D(c).prepare('DELETE FROM notifications WHERE post_id = ?').bind(id),
  ];
  if (row.shared_post_id) {
    stmts.push(D(c).prepare('UPDATE posts SET share_count = MAX(0, share_count - 1) WHERE id = ?').bind(row.shared_post_id));
  }
  await D(c).batch(stmts);
  // 🔴 H-5 #3 — istismarın ƏSAS dövrəsi burada bağlanır: yarat (+10) → sil →
  // təkrarla. Kompensasiya YALNIZ uyğun `xp_logs` sətri varsa işləyir və
  // məbləği mövcud XP ilə clamp edir → Task 6-nın `users_xp_nonneg` trigger-i
  // TETİKLƏNMİR (bax xp.ts `compensateXp` üç qatlı müdafiə).
  //
  // ⚠ Batch-dən SONRA və `waitUntil`-siz: XP geri alınmadan cavab qaytarsaq,
  //   sürətli yarat-sil dövrəsi kompensasiyanı qabaqlaya bilərdi.
  await compensateXp(c.env, String(row.author_id), 'post', id);
  return json({ ok: true });
}

// Birbaşa re-post — idempotent toggle (repost / undo-repost). Cloud-Function trigger yerinə
// share_count-u atomik batch-də saxlayır; post_shares kompozit-PK ilə dublikat qarşılanmır.
export async function toggleRepost(c: Ctx, id: string) {
  const target = await D(c).prepare('SELECT id, author_id, shared_post_id FROM posts WHERE id = ?').bind(id).first<any>();
  if (!target) return err('Post tapılmadı.', 404);
  // flatten-to-root: re-post-un re-post-u həmişə kök orijinala istinad edir
  const rootId = target.shared_post_id || id;
  const root = target.shared_post_id
    ? await D(c).prepare('SELECT id, author_id FROM posts WHERE id = ?').bind(rootId).first<any>()
    : target;
  if (!root) return err('Post tapılmadı.', 404);
  if (root.author_id === c.user!.id) return err('Öz paylaşımını re-post edə bilməzsən.', 400);

  const existing = await D(c).prepare('SELECT repost_id FROM post_shares WHERE user_id = ? AND post_id = ?')
    .bind(c.user!.id, rootId).first<any>();
  if (existing) {
    // undo-repost
    await D(c).batch([
      D(c).prepare('DELETE FROM posts WHERE id = ?').bind(existing.repost_id),
      D(c).prepare('DELETE FROM post_shares WHERE user_id = ? AND post_id = ?').bind(c.user!.id, rootId),
      D(c).prepare('UPDATE posts SET share_count = MAX(0, share_count - 1) WHERE id = ?').bind(rootId),
    ]);
    return json({ reposted: false });
  }
  const newId = uuid();
  await D(c).batch([
    D(c).prepare('INSERT INTO posts (id, author_id, author_name, blocks, image_keys, text, tags, created_at, shared_post_id, post_type) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(newId, c.user!.id, c.user!.name, '[]', '[]', '', '[]', now(), rootId, 'repost'),
    D(c).prepare('INSERT INTO post_shares (user_id, post_id, repost_id, created_at) VALUES (?,?,?,?)')
      .bind(c.user!.id, rootId, newId, now()),
    D(c).prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').bind(rootId),
  ]);
  await notify(c, root.author_id, 'repost', 'paylaşımını re-post etdi', rootId);
  return json({ reposted: true, id: newId });
}

export async function likePut(c: Ctx, id: string) {
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(id).first<any>();
  if (!post) return err('Post tapılmadı.', 404);
  const r = await D(c).prepare('INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?,?,?)')
    .bind(id, c.user!.id, now()).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').bind(id).run();
    await notify(c, post.author_id, 'like', 'paylaşımını bəyəndi', id);
  }
  return json({ ok: true });
}
export async function likeDelete(c: Ctx, id: string) {
  const r = await D(c).prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').bind(id, c.user!.id).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(id).run();
  }
  return json({ ok: true });
}

export async function bookmarkPut(c: Ctx, id: string) {
  await D(c).prepare('INSERT OR IGNORE INTO bookmarks (user_id, post_id, created_at) VALUES (?,?,?)')
    .bind(c.user!.id, id, now()).run();
  return json({ ok: true });
}
export async function bookmarkDelete(c: Ctx, id: string) {
  await D(c).prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').bind(c.user!.id, id).run();
  return json({ ok: true });
}

// LinkedIn üslublu rəylər (TASK-7 / Bənd 8): üst səviyyə rəylər + bir səviyyəli
// cavablar (thread), rəyə bəyənmə, sıralama (ən yeni / ən çox bəyənilən), limit ilə
// "daha çox yüklə". Polling ilə uzlaşsın deyə səhifələmə `limit`-lə aparılır: müştəri
// cari limit-i saxlayır, "daha çox" onu artırır, hər poll cari limit-i gətirir.
const mapComment = (r: any, myLikes: Set<string>) => ({
  id: r.id, postId: r.post_id, parentId: r.parent_comment_id || null,
  authorUid: r.author_id, authorName: r.author_name, text: r.text,
  createdAt: r.created_at, editedAt: r.edited_at || null,
  likeCount: r.like_count || 0, likedByMe: myLikes.has(r.id),
});
export async function listComments(c: Ctx, postId: string) {
  const sort = c.url.searchParams.get('sort') === 'top' ? 'top' : 'new';
  const limit = Math.min(Math.max(parseInt(c.url.searchParams.get('limit') || '20', 10) || 20, 5), 200);
  // JOIN əlavə olunduğu üçün sütunlar açıq prefiksli olmalıdır (M-10).
  const order = sort === 'top' ? 'cm.like_count DESC, cm.created_at DESC' : 'cm.created_at DESC';
  // Üst səviyyə rəylər (limit+1 → daha çoxu var?).
  // M-10: bloklanmış müəllifin rəyləri gizlədilir (feed ilə eyni qayda).
  const topRows = await D(c).prepare(
    `SELECT cm.* FROM comments cm JOIN users u ON cm.author_id = u.id
      WHERE cm.post_id = ? AND cm.parent_comment_id IS NULL AND u.blocked = 0
      ORDER BY ${order} LIMIT ?`,
  ).bind(postId, limit + 1).all<any>();
  const hasMore = topRows.results.length > limit;
  const top = topRows.results.slice(0, limit);
  const topIds = top.map(r => r.id);
  // Yalnız yüklənmiş üst rəylərin cavabları (xronoloji).
  // D-1: `limit` 200-ə qədər ola bilər → bölünmədən `IN (?×200)` D1 limitini
  // (100) aşırdı. Hissələmə SIRALAMANI POZMUR: bölgü VALİDEYN id-ləri üzrədir,
  // yəni bir valideynin bütün cavabları eyni hissədədir və aşağıdakı
  // `replies[parent]` qruplaşdırması xronoloji sıranı olduğu kimi saxlayır.
  const replyRows: any[] = [];
  for (const chunk of chunkForD1(topIds)) {
    const rr = await D(c).prepare(
      `SELECT cm.* FROM comments cm JOIN users u ON cm.author_id = u.id
        WHERE cm.parent_comment_id IN (${placeholders(chunk.length)}) AND u.blocked = 0
        ORDER BY cm.created_at ASC`,
    ).bind(...chunk).all<any>();
    replyRows.push(...rr.results);
  }
  // Mənim bəyəndiyim rəylər. D-1: `allIds` = üst rəylər + BÜTÜN cavabları →
  // praktikada sərhədsiz (200 rəyin hər birinin 50 cavabı = 10 000 dəyişən).
  // `reserved: 1` — `user_id = ?` sorğuda IN siyahısından ƏLAVƏ bağlanır.
  const allIds = [...topIds, ...replyRows.map(r => r.id as string)];
  const myLikes = new Set<string>();
  for (const chunk of chunkForD1(allIds, 1)) {
    const lr = await D(c).prepare(
      `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders(chunk.length)})`,
    ).bind(c.user!.id, ...chunk).all<any>();
    for (const r of lr.results) myLikes.add(r.comment_id as string);
  }
  const replies: Record<string, any[]> = {};
  for (const r of replyRows) (replies[r.parent_comment_id] ||= []).push(mapComment(r, myLikes));
  const cnt = await D(c).prepare(
    'SELECT COUNT(*) AS n FROM comments WHERE post_id = ? AND parent_comment_id IS NULL',
  ).bind(postId).first<any>();
  return json({ comments: top.map(r => mapComment(r, myLikes)), replies, total: cnt?.n || 0, hasMore });
}
export async function addComment(c: Ctx, postId: string) {
  const b = await readJson(c.req);
  const text = clampStr(b.text, 1000).trim();
  if (!text) return badReq('Şərh boş ola bilməz.');
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first<any>();
  if (!post) return err('Post tapılmadı.', 404);

  // Bir səviyyə qaydası: cavaba cavab yazılırsa, kök üst rəyə düzlənir
  // (dərin cavablar eyni thread-də @mention ilə). replyToAuthor → cavab bildirişi.
  let parentId: string | null = null;
  let replyToAuthor: string | null = null;
  if (b.parentId) {
    const parent = await D(c).prepare('SELECT id, author_id, parent_comment_id FROM comments WHERE id = ? AND post_id = ?')
      .bind(clampStr(b.parentId, 40), postId).first<any>();
    if (parent) {
      parentId = parent.parent_comment_id || parent.id;   // flatten-to-root
      replyToAuthor = parent.author_id;
    }
  }
  const id = uuid();
  const ts = now();
  await D(c).prepare('INSERT INTO comments (id, post_id, author_id, author_name, text, created_at, parent_comment_id) VALUES (?,?,?,?,?,?,?)')
    .bind(id, postId, c.user!.id, c.user!.name, text, ts, parentId).run();
  await D(c).prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').bind(postId).run();
  // H-5: XP idempotent + tavanlı. Tavana çatanda rəy YENƏ yazılır.
  const cXp = await grantXp(c.env, c.user!.id, 'comment', id, COMMENT_XP);
  if (parentId && replyToAuthor) await notify(c, replyToAuthor, 'comment', 'şərhinə cavab yazdı', postId);
  else await notify(c, post.author_id, 'comment', 'paylaşımına şərh yazdı', postId);
  await notifyMentions(c, text, 'səni şərhdə qeyd etdi', postId);
  return json({ ok: true, id, createdAt: ts, parentId, xpCapped: cXp.reason === 'daily_cap' });
}
export async function editComment(c: Ctx, postId: string, cid: string) {
  const b = await readJson(c.req);
  const text = clampStr(b.text, 1000).trim();
  if (!text) return badReq('Şərh boş ola bilməz.');
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return err('Şərh tapılmadı.', 404);
  if (row.author_id !== c.user!.id) return err('İcazə yoxdur.', 403, 'forbidden');   // redaktə yalnız müəllif
  await D(c).prepare('UPDATE comments SET text = ?, edited_at = ? WHERE id = ?').bind(text, now(), cid).run();
  return json({ ok: true });
}
export async function deleteComment(c: Ctx, postId: string, cid: string) {
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return json({ ok: true });
  const post = await D(c).prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first<any>();
  const allowed = row.author_id === c.user!.id || c.isAdmin || post?.author_id === c.user!.id;
  if (!allowed) return err('İcazə yoxdur.', 403, 'forbidden');
  // Cascade sil: rəy + bütün cavabları (dərinlik 1 olduğu üçün birbaşa uşaqlar tamdır) + reaksiyalar.
  // `author_id` də oxunur: cascade silinən cavabların müəllifi BAŞQA
  // istifadəçilər ola bilər və XP kompensasiyası hər sətrin ÖZ müəllifinə
  // tətbiq edilməlidir (yanlış uid ilə `xp_logs` sətri tapılmazdı və dövrə
  // sükutla açıq qalardı).
  const kids = await D(c).prepare('SELECT id, author_id FROM comments WHERE parent_comment_id = ?')
    .bind(cid).all<any>();
  const owners: Array<{ id: string; uid: string }> = [
    { id: cid, uid: String(row.author_id) },
    ...kids.results.map(r => ({ id: String(r.id), uid: String(r.author_id) })),
  ];
  const ids = owners.map(o => o.id);
  // D-1: cavabların sayı SƏRHƏDSİZDİR — populyar rəyin 500 cavabı olsa
  // `IN (?×501)` D1-i çökdürür və rəy HEÇ VAXT silinə bilmirdi.
  // Silmələr hissələnir, lakin hamısı EYNİ `batch()`-də qalır → atomiklik
  // qorunur (yarımçıq silmə yetim `comment_likes` sətirləri buraxardı).
  const stmts = [];
  for (const chunk of chunkForD1(ids)) {
    const ph = placeholders(chunk.length);
    stmts.push(D(c).prepare(`DELETE FROM comments WHERE id IN (${ph})`).bind(...chunk));
    stmts.push(D(c).prepare(`DELETE FROM comment_likes WHERE comment_id IN (${ph})`).bind(...chunk));
  }
  stmts.push(D(c).prepare('UPDATE posts SET comment_count = MAX(0, comment_count - ?) WHERE id = ?').bind(ids.length, postId));
  await D(c).batch(stmts);
  // H-5 #3 — rəy dövrəsi də bağlanır. Cascade silinən CAVABLARIN XP-si də geri
  // alınır: yalnız kök rəyi kompensasiya etsək, hücumçu cavab yazıb valideyni
  // silməklə cavabların XP-sini saxlayardı.
  //
  // ⚠ D-1 intizamı: hər cavab üçün ayrıca `compensateXp` çağırsaq, 120 cavablı
  //   rəydə ən azı 120 SELECT olardı. Əvvəlcə HİSSƏLƏNMİŞ tək sorğu ilə hansı
  //   sətirlərin ümumiyyətlə XP qazandığı tapılır — gündəlik tavan səbəbindən
  //   bu siyahı praktikada xeyli qısadır.
  const earned = new Set<string>();
  for (const chunk of chunkForD1(ids)) {
    const rs = await D(c).prepare(
      `SELECT ref_id FROM xp_logs
        WHERE source = 'comment' AND amount > 0 AND ref_id IN (${placeholders(chunk.length)})`,
    ).bind(...chunk).all<any>();
    for (const r of rs.results) earned.add(String(r.ref_id));
  }
  for (const o of owners) {
    if (earned.has(o.id)) await compensateXp(c.env, o.uid, 'comment', o.id);
  }
  return json({ ok: true });
}
export async function commentLikePut(c: Ctx, postId: string, cid: string) {
  const row = await D(c).prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?').bind(cid, postId).first<any>();
  if (!row) return err('Şərh tapılmadı.', 404);
  const r = await D(c).prepare('INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at) VALUES (?,?,?)')
    .bind(cid, c.user!.id, now()).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE comments SET like_count = like_count + 1 WHERE id = ?').bind(cid).run();
    await notify(c, row.author_id, 'like', 'şərhini bəyəndi', postId);
  }
  return json({ ok: true });
}
export async function commentLikeDelete(c: Ctx, _postId: string, cid: string) {
  const r = await D(c).prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').bind(cid, c.user!.id).run();
  if (r.meta.changes > 0) {
    await D(c).prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(cid).run();
  }
  return json({ ok: true });
}

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
  return json({ rooms: rows.results.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at })) });
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

const MSG_COLS = '(id, room_id, author_id, author_name, type, text, file_key, file_name, file_size, mime_type, language, created_at)';

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
  return json({ messages: res.messages, hasMore: res.hasMore, source: res.source });
}
export async function sendRoomMessage(c: Ctx, roomId: string) {
  const denied = await guardTeamRoom(c, roomId);
  if (denied) return denied;

  const b = await readJson(c.req);
  const m = sanitizeMsg(b, c.user!.id);
  if (!m) return badReq('Mesaj boşdur.');
  await D(c).prepare(`INSERT INTO room_messages ${MSG_COLS} VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uuid(), roomId, c.user!.id, c.user!.name, m.type, m.text, m.fileKey, m.fileName, m.fileSize, m.mimeType, m.language, now()).run();
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
      'INSERT INTO dm_messages (id, pair_id, from_id, to_id, type, text, file_key, file_name, file_size, mime_type, language, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    ).bind(uuid(), pairId, me.id, toUid, m.type, m.text, m.fileKey, m.fileName, m.fileSize, m.mimeType, m.language, now()),
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

/* ================= NOTIFICATIONS ================= */
export async function listNotifs(c: Ctx) {
  const rows = await D(c).prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60',
  ).bind(c.user!.id).all<any>();
  return json({
    notifications: rows.results.map(r => ({
      id: r.id, type: r.type, fromUid: r.from_id, fromName: r.from_name,
      postId: r.post_id, text: r.text, read: !!r.read, createdAt: r.created_at,
    })),
  });
}
export async function readNotif(c: Ctx, id: string) {
  await D(c).prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').bind(id, c.user!.id).run();
  return json({ ok: true });
}
export async function readAllNotifs(c: Ctx) {
  await D(c).prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(c.user!.id).run();
  return json({ ok: true });
}

/* ================= TASKS ================= */
export async function listTasks(c: Ctx) {
  const scope = c.url.searchParams.get('scope') || 'approved';
  if (scope === 'pending') {
    if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
    const rows = await D(c).prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at DESC").all<any>();
    return json({ tasks: rows.results.map(mapTask) });
  }
  if (scope === 'mine') {
    const rows = await D(c).prepare("SELECT * FROM tasks WHERE created_by = ? AND status != 'approved' ORDER BY created_at DESC")
      .bind(c.user!.id).all<any>();
    return json({ tasks: rows.results.map(mapTask) });
  }

  // Global approved tasks
  const rows = await D(c).prepare("SELECT * FROM tasks WHERE status = 'approved' ORDER BY created_at DESC LIMIT 200").all<any>();
  let allTasks = rows.results.map(mapTask);

  // Sync team tasks assigned to user from Public projects
  if (c.user) {
    const teamTasks = await D(c).prepare(`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.created_at, p.name as project_name 
      FROM team_tasks t 
      JOIN team_projects p ON t.project_id = p.id 
      WHERE t.assignee_id = ? AND p.visibility = 'Public' AND t.status != 'Done'
    `).bind(c.user.id).all<any>();
    
    if (teamTasks.results.length > 0) {
      const mappedTeamTasks = teamTasks.results.map(t => ({
        id: t.id,
        title: t.title,
        desc: t.description,
        category: 'Team Task',
        status: t.status,
        author: { name: t.project_name || 'Komanda Layihəsi' },
        createdAt: t.created_at,
        xp: 0, // Team tasks don't have global XP logic currently
        isTeamTask: true
      }));
      allTasks = [...mappedTeamTasks, ...allTasks];
      // Sort globally
      allTasks.sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  return json({ tasks: allTasks });
}
export async function createTask(c: Ctx) {
  const b = await readJson(c.req);
  const title = clampStr(b.title, 120).trim();
  const desc = clampStr(b.desc, 3000).trim();
  const category = clampStr(b.category, 30);
  if (!title || !desc) return badReq('Başlıq və təsvir doldurulmalıdır.');
  const status = c.isAdmin ? 'approved' : 'pending';
  await D(c).prepare(
    'INSERT INTO tasks (id, title, descr, category, created_by, created_by_name, status, created_at, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
  ).bind(uuid(), title, desc, category, c.user!.id, c.user!.username, status, now(),
    c.isAdmin ? c.user!.id : null, c.isAdmin ? now() : null).run();
  return json({ ok: true, status });
}
export async function reviewTask(c: Ctx, id: string) {
  const b = await readJson(c.req);
  const row = await D(c).prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<any>();
  if (!row) return err('Tapılmadı.', 404);
  const status = b.approve ? 'approved' : 'rejected';
  await D(c).prepare('UPDATE tasks SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?')
    .bind(status, c.user!.id, now(), id).run();
  await notify(c, row.created_by, 'task',
    b.approve ? `"${row.title}" tapşırıq təklifin təsdiqləndi 🎉` : `"${row.title}" təklifin rədd edildi`);
  await logAdmin(c, 'task-' + status, row.created_by, row.title);
  return json({ ok: true });
}
export async function deleteTask(c: Ctx, id: string) {
  await D(c).prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

export async function submitSolution(c: Ctx, taskId: string) {
  const b = await readJson(c.req);
  const task = await D(c).prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first<any>();
  if (!task) return err('Tapşırıq tapılmadı.', 404);
  const text = clampStr(b.text, 5000).trim();
  const link = clampStr(b.link, 300).trim();
  if (!text && !link) return badReq('Həll boş ola bilməz.');
  if (link && !/^https:\/\//.test(link)) return badReq('Link https:// ilə başlamalıdır.');
  await D(c).prepare(
    `INSERT INTO submissions (task_id, user_id, username, name, task_title, category, text, link, status, submitted_at)
     VALUES (?,?,?,?,?,?,?,?, 'pending', ?)
     ON CONFLICT(task_id, user_id) DO UPDATE SET
       text = excluded.text,
       link = excluded.link,
       -- 🔴 B-5 / AUDIT H-5 istismar 2: TƏSDİQLƏNMİŞ həll yenidən 'pending'-ə
       -- DÜŞMÜR. Əvvəl düşürdü və reviewSubmission-dakı
       -- "approved və row.status !== approved" şərti YENİDƏN doğru olurdu →
       -- hər təkrar təsdiqdə +50 XP və tasks_completed+1 verilirdi.
       status = CASE WHEN submissions.status = 'approved'
                     THEN 'approved' ELSE 'pending' END,
       submitted_at = excluded.submitted_at`,
  ).bind(taskId, c.user!.id, c.user!.username, c.user!.name, task.title, task.category,
    text, link, now()).run();
  await bumpActivity(c);
  return json({ ok: true });
}
export async function listSubmissions(c: Ctx) {
  const scope = c.url.searchParams.get('scope') || 'mine';
  if (scope === 'pending') {
    if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
    const rows = await D(c).prepare("SELECT * FROM submissions WHERE status = 'pending' ORDER BY submitted_at ASC").all<any>();
    return json({ submissions: rows.results.map(mapSubmission) });
  }
  const rows = await D(c).prepare('SELECT * FROM submissions WHERE user_id = ?').bind(c.user!.id).all<any>();
  return json({ submissions: rows.results.map(mapSubmission) });
}
export async function reviewSubmission(c: Ctx, taskId: string, uid: string) {
  const b = await readJson(c.req);
  const status = b.status === 'approved' ? 'approved' : 'rejected';
  const row = await D(c).prepare('SELECT * FROM submissions WHERE task_id = ? AND user_id = ?')
    .bind(taskId, uid).first<any>();
  if (!row) return err('Tapılmadı.', 404);
  await D(c).prepare('UPDATE submissions SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE task_id = ? AND user_id = ?')
    .bind(status, now(), c.user!.id, taskId, uid).run();
  if (status === 'approved' && row.status !== 'approved') {
    // ⚠ İKİNCİ MÜDAFİƏ XƏTTİ (audit §B-5): status məntiqi sınsa belə
    // `UNIQUE(uid, 'solution', refId)` XP-ni təkrar verməyə qoymur.
    // `refId` = tapşırıq + istifadəçi cütü — `submissions`-un kompozit açarı ilə
    // eynidir, yəni bir istifadəçi bir tapşırıqdan yalnız bir dəfə XP alır.
    await grantXp(c.env, uid, 'solution', `${taskId}:${uid}`, SOLUTION_XP,
      { alsoCompletedTask: true });
    if (row.category) await bumpProgress(c, uid, row.category, 'tasks');
  }
  await notify(c, uid, 'task',
    status === 'approved' ? `"${row.task_title}" həllin təsdiqləndi 🎉 +50 XP` : `"${row.task_title}" həllin rədd edildi`);
  return json({ ok: true });
}

/* ================= REPORTS ================= */
export async function createReport(c: Ctx) {
  const b = await readJson(c.req);
  const reason = clampStr(b.reason, 1000).trim();
  if (!reason) return badReq('Səbəb boşdur.');
  // AUDIT L-4 — hədəfin MÖVCUDLUĞU yoxlanmırdı: uydurma uid ilə şikayət
  // yaradıla bilirdi və admin paneli heç vaxt açıla bilməyən sətirlərlə
  // dolurdu. Ad da bazadan götürülür — client-in göndərdiyi ada güvənmirik.
  const target = await D(c).prepare('SELECT id, username FROM users WHERE id = ?')
    .bind(clampStr(b.targetUid, 40)).first<any>();
  if (!target) return err('Şikayət edilən istifadəçi tapılmadı.', 404);
  await D(c).prepare(
    'INSERT INTO reports (id, reporter_id, reporter_name, target_id, target_username, reason, created_at) VALUES (?,?,?,?,?,?,?)',
  ).bind(uuid(), c.user!.id, c.user!.username, target.id, target.username, reason, now()).run();
  return json({ ok: true });
}
export async function listReports(c: Ctx) {
  const rows = await D(c).prepare("SELECT * FROM reports WHERE status = 'open' ORDER BY created_at DESC").all<any>();
  return json({
    reports: rows.results.map(r => ({
      id: r.id, reporterUid: r.reporter_id, reporterName: r.reporter_name,
      targetUid: r.target_id, targetUsername: r.target_username,
      reason: r.reason, status: r.status, createdAt: r.created_at,
    })),
  });
}
/**
 * AUDIT L-5 — `status` İXTİYARİ 20 simvolluq sətir ola bilirdi. `listReports`
 * yalnız `status = 'open'` sətirlərini göstərir, yəni uydurma status
 * (məs. "opened") şikayəti həm açıq siyahıdan, həm həll olunmuşlardan
 * çıxarırdı — sətir sükutla itirdi. Ağ siyahı bunu bağlayır.
 */
const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;

export async function resolveReport(c: Ctx, id: string) {
  const b = await readJson(c.req);
  const status = String(b.status ?? 'dismissed');
  if (!(REPORT_STATUSES as readonly string[]).includes(status)) {
    return err('Naməlum şikayət statusu.', 400, 'invalid_status');
  }
  // D-1: audit sütunu — şikayətin nə vaxt həll olunduğu.
  await D(c).prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, now(), id).run();
  return json({ ok: true });
}

/* ================= PUBLIC ================= */
export async function publicFaqs(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM faqs WHERE active = 1 ORDER BY sort_order ASC').all<any>();
  return json({
    faqs: rows.results.map(r => ({
      id: r.id, q: fromJSON(r.q, {}), a: fromJSON(r.a, {}),
      category: r.category, order: r.sort_order, active: !!r.active,
    })),
  });
}
export async function publicTestimonials(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM testimonials WHERE approved = 1 AND featured = 1 LIMIT 12').all<any>();
  return json({
    testimonials: rows.results.map(r => ({
      id: r.id, authorName: r.author_name, authorTitle: fromJSON(r.author_title, {}),
      text: fromJSON(r.text, {}), rating: r.rating, featured: !!r.featured, approved: !!r.approved,
    })),
  });
}
export async function publicStats(c: Ctx) {
  const [u, p] = await D(c).batch([
    D(c).prepare('SELECT COUNT(*) AS n FROM users'),
    D(c).prepare('SELECT COUNT(*) AS n FROM posts'),
  ]);
  return json({ users: (u.results[0] as any).n, posts: (p.results[0] as any).n });
}

// Auth-suz tək-post oxuması — SSR meta + OG şəkil üçün. Yalnız public-safe sahələr;
// müəllif bloklanıbsa 404. (Feed-dəki eyni JOIN forması.)
export async function publicGetPost(c: Ctx, id: string) {
  const row = await D(c).prepare(`
    SELECT p.*, u.blocked AS author_blocked, u.username AS author_username,
           u.photo_url AS author_photo, u.verified AS author_verified,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE p.id = ?
  `).bind(id).first<any>();
  if (!row || row.author_blocked) return err('Post tapılmadı.', 404);
  const post = mapPost(row);
  post.authorUsername = row.author_username;
  post.authorPhoto = fileUrl(row.author_photo);
  post.authorVerified = !!row.author_verified;
  return json({ post });
}

// Auth-suz username→profil oxuması — SSR meta + OG şəkil üçün. Şifrə/sessiya sahələri yox.
export async function publicGetUser(c: Ctx, username: string) {
  const uname = normalizeUsername(username);
  const row = await D(c).prepare(
    'SELECT id, username, name, bio, photo_url, verified, xp, streak, tasks_completed, joined_at, prog_levels, lang_levels FROM users WHERE username = ? AND blocked = 0',
  ).bind(uname).first<any>();
  if (!row) return err('İstifadəçi tapılmadı.', 404);
  return json({
    user: {
      uid: row.id, username: row.username, name: row.name, bio: row.bio,
      photoURL: fileUrl(row.photo_url), verified: !!row.verified,
      xp: row.xp, streak: row.streak, tasksCompleted: row.tasks_completed, joinedAt: row.joined_at,
      prog: Object.keys(fromJSON(row.prog_levels, {})), langs: Object.keys(fromJSON(row.lang_levels, {})),
    },
  });
}
export async function newsletterSubscribe(c: Ctx) {
  const b = await readJson(c.req);
  const email = clampStr(b.email, 120).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badReq('Email formatı düzgün deyil.');
  const lang = ['az', 'en', 'ru'].includes(b.lang) ? b.lang : 'az';
  const r = await D(c).prepare('INSERT OR IGNORE INTO newsletter (email, lang, created_at) VALUES (?,?,?)')
    .bind(email, lang, now()).run();
  if (!r.meta.changes) return badReq('Bu e-poçt artıq abunədir.');
  return json({ ok: true });
}
export async function contactSubmit(c: Ctx) {
  const b = await readJson(c.req);
  const name = clampStr(b.name, 80).trim();
  const email = clampStr(b.email, 120).trim();
  const message = clampStr(b.message, 2000).trim();
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badReq('Sahələri düzgün doldurun.');
  await D(c).prepare('INSERT INTO contact_messages (id, name, email, message, created_at) VALUES (?,?,?,?,?)')
    .bind(uuid(), name, email, message, now()).run();
  return json({ ok: true });
}

/* ================= GDPR — DATA İXRACI (Bənd 10) ================= */

// CSV formatlaması üçün yuxarıdakı `csvCell` / `csvRow` TƏKRAR-İSTİFADƏ olunur
// (TASK-6 admin ixracı ilə eyni funksiyalar). Orada formula-injection qoruması
// artıq var: `=`, `+`, `-`, `@` ilə başlayan xana apostrofla neytrallaşdırılır,
// yəni Excel onu düstur kimi İCRA ETMİR.
//
// İkinci nüsxə yazsaydıq qaydalar vaxtla ayrılar və bir ixrac qorunub, o biri
// qorunmamış qalardı — məhz belə fərqlər real təhlükəsizlik boşluqları yaradır.

// İstifadəçinin BÜTÜN datasını toplayan sorğular. Hər biri ayrıca "bölmə"dir —
// stream-də bir-bir yazılır ki, yaddaşda tam nüsxə yığılmasın.
const EXPORT_SECTIONS: Array<{ name: string; sql: string; binds: (uid: string) => unknown[] }> = [
  { name: 'profile', sql: 'SELECT * FROM users WHERE id = ?', binds: u => [u] },
  { name: 'posts', sql: 'SELECT * FROM posts WHERE author_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'comments', sql: 'SELECT * FROM comments WHERE author_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'likes', sql: 'SELECT * FROM likes WHERE user_id = ?', binds: u => [u] },
  { name: 'bookmarks', sql: 'SELECT * FROM bookmarks WHERE user_id = ?', binds: u => [u] },
  { name: 'follows', sql: 'SELECT * FROM follows WHERE follower_id = ? OR target_id = ?', binds: u => [u, u] },
  { name: 'room_messages', sql: 'SELECT * FROM room_messages WHERE author_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'direct_messages', sql: 'SELECT * FROM dm_messages WHERE from_id = ? OR to_id = ? ORDER BY created_at', binds: u => [u, u] },
  { name: 'tasks_created', sql: 'SELECT * FROM tasks WHERE created_by = ?', binds: u => [u] },
  { name: 'submissions', sql: 'SELECT * FROM submissions WHERE user_id = ?', binds: u => [u] },
  { name: 'notifications', sql: 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at', binds: u => [u] },
  { name: 'activity', sql: 'SELECT date, count FROM user_activity WHERE uid = ? ORDER BY date', binds: u => [u] },
  { name: 'sessions', sql: 'SELECT id, ua, ip, city, country, created_at, last_seen, revoked FROM sessions WHERE uid = ?', binds: u => [u] },
  { name: 'oauth_accounts', sql: 'SELECT provider, login, email, linked_at FROM oauth_accounts WHERE uid = ?', binds: u => [u] },
  { name: 'reports_filed', sql: 'SELECT * FROM reports WHERE reporter_id = ?', binds: u => [u] },

  // ── AUDIT-TASK-8 §8.5 — hüquqi risk #13: ixrac natamam idi ──
  //
  // ⚠ HƏR SORĞU YALNIZ İSTİFADƏÇİNİN ÖZ SƏTİRLƏRİNİ QAYTARIR. Komanda
  // cədvəlləri başqa üzvlərin datasını da daşıyır (`team_posts` bütün
  // komandanın feed-idir) — filtrsiz ixrac GDPR sənədini data sızmasına
  // çevirərdi: istifadəçi öz faylında başqalarının yazılarını alardı.
  //
  // `contact_messages`-də `uid` sütunu YOXDUR (yalnız `email`), ona görə
  // uyğunluq istifadəçinin qeydiyyat VƏ əlaqə e-poçtu üzrə qurulur.
  // Alt-sorğu işlədilir ki, bölmə imzası (`binds: uid`) dəyişməsin.
  {
    name: 'contact_messages',
    sql: `SELECT * FROM contact_messages
           WHERE lower(email) IN (SELECT lower(email) FROM users WHERE id = ?1)
              OR lower(email) IN (SELECT lower(contact_email) FROM users WHERE id = ?1)
           ORDER BY created_at`,
    binds: u => [u],
  },
  {
    name: 'team_memberships',
    sql: `SELECT m.id, m.team_id, t.name AS team_name, m.role_id, r.name AS role_name,
                 m.status, m.joined_at
            FROM team_members m
            LEFT JOIN teams t ON t.id = m.team_id
            LEFT JOIN team_roles r ON r.id = m.role_id
           WHERE m.user_id = ? ORDER BY m.joined_at`,
    binds: u => [u],
  },
  {
    // Yalnız İSTİFADƏÇİYƏ TƏYİN EDİLMİŞ tapşırıqlar — `team_tasks`-də
    // `created_by` sütunu yoxdur, müəlliflik saxlanılmır.
    name: 'team_tasks_assigned',
    sql: `SELECT * FROM team_tasks WHERE assignee_id = ? ORDER BY created_at`,
    binds: u => [u],
  },
  {
    name: 'team_posts',
    sql: 'SELECT * FROM team_posts WHERE author_id = ? ORDER BY created_at',
    binds: u => [u],
  },
  {
    // Fayl METADATASI — məzmun DEYİL. Fayl baytları R2-dədir və ixraca
    // qoyulsaydı fayl həcmi ixracı praktiki olaraq yararsız edərdi.
    name: 'team_files',
    sql: 'SELECT * FROM team_files WHERE uploaded_by = ? ORDER BY created_at',
    binds: u => [u],
  },
];

// Parol heşi və TOTP sirri ixracdan ÇIXARILIR: onlar istifadəçinin "şəxsi
// datası" deyil, autentifikasiya sirridir. İxrac faylı email ilə paylaşıla,
// buludda saxlanıla bilər — sirri ora qoymaq hesabı riskə atmaqdır.
const EXPORT_OMIT = new Set(['pass_hash', 'pass_salt', 'totp_secret', 'refresh_hash', 'prev_refresh_hash']);
const scrub = (row: any) => {
  const out: any = {};
  for (const [k, v] of Object.entries(row)) if (!EXPORT_OMIT.has(k)) out[k] = v;
  return out;
};

// Tam data ixracı — STREAM ilə.
//
// Nə üçün stream: aktiv istifadəçinin mesaj+bildiriş tarixçəsi meqabaytlarla
// ola bilər. Hamısını sətirdə yığıb sonda qaytarsaq Worker-in yaddaş limitinə
// dəyərdi. Burada hər bölmə hazır olan kimi ötürülür.
export async function exportMyData(c: Ctx) {
  const uid = c.user!.id;
  const format = c.url.searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `collabix-data-${c.user!.username}-${stamp}.${format}`;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const write = (s: string) => writer.write(encoder.encode(s));

  // Yazma fon işidir: cavab başlıqları DƏRHAL qaytarılır, gövdə axır.
  // `waitUntil` işlədilmir — cavab gövdəsi hələ oxunur, Worker onsuz da diridir.
  (async () => {
    try {
      if (format === 'csv') {
        // CSV-də bir neçə cədvəl var → hər bölmə öz başlığı ilə ardıcıl yazılır.
        // Excel UTF-8-i tanısın deyə BOM əlavə olunur (Azərbaycan hərfləri!).
        await write('﻿');
        for (const sec of EXPORT_SECTIONS) {
          const rows = await c.env.DB.prepare(sec.sql).bind(...sec.binds(uid)).all<any>();
          await write(`\r\n### ${sec.name}\r\n`);
          if (!rows.results.length) { await write('(boş)\r\n'); continue; }
          const cols = Object.keys(scrub(rows.results[0]));
          await write(csvRow(cols));
          for (const r of rows.results) {
            const clean = scrub(r);
            await write(csvRow(cols.map(k => clean[k])));
          }
        }
        // AUDIT-TASK-8 §8.5 — arxivlənmiş mesajlar (mənbə: R2, D1 deyil).
        // ⚠ `csvRow` EYNİ funksiyadır → formula-injection qoruması bu bölməyə
        // də tətbiq olunur (ikinci nüsxə yazsaydıq qoruma burada olmazdı).
        const arch = await exportArchivedMessages(c.env, uid);
        await write(`\r\n### archived_messages\r\n`);
        if (arch.truncated) {
          await write(csvRow(['QEYD', 'Arxivin bir hissəsi açıla bilmədi və ya limit aşıldı — ixrac NATAMAMDIR']));
        }
        if (!arch.messages.length) { await write('(boş)\r\n'); }
        else {
          const acols = Object.keys(scrub(arch.messages[0]));
          await write(csvRow(acols));
          for (const m of arch.messages) {
            const clean = scrub(m);
            await write(csvRow(acols.map(k => clean[k])));
          }
        }
      } else {
        await write(`{\n  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n`);
        await write(`  "username": ${JSON.stringify(c.user!.username)},\n`);
        for (const sec of EXPORT_SECTIONS) {
          const rows = await c.env.DB.prepare(sec.sql).bind(...sec.binds(uid)).all<any>();
          const data = rows.results.map(scrub);
          // Arxiv bölməsi sonuncudur → hər D1 bölməsindən sonra vergül qoyulur.
          await write(`  ${JSON.stringify(sec.name)}: ${JSON.stringify(data)},\n`);
        }
        // AUDIT-TASK-8 §8.5 — arxivlənmiş mesajlar (mənbə: R2).
        const arch = await exportArchivedMessages(c.env, uid);
        await write(`  "archived_messages": ${JSON.stringify(arch.messages.map(scrub))},\n`);
        // ⚠ Natamamlıq SÜKUTLA keçilmir: GDPR ixracında "bu qədərdir" ilə
        // "bu qədərini verə bildik" fərqi hüquqi əhəmiyyət daşıyır.
        await write(`  "archived_messages_meta": ${JSON.stringify({
          truncated: arch.truncated, objectsScanned: arch.objectsScanned,
        })}\n`);
        await write('}\n');
      }
    } catch (e: any) {
      console.error('export', e?.message || e);
      // Başlıqlar artıq göndərilib — status kodu dəyişdirmək mümkün deyil.
      // Ona görə xəta faylın İÇİNƏ yazılır: istifadəçi natamam faylı sükutla
      // "tam" sanmasın.
      await write(`\n/* İXRAC YARIMÇIQ QALDI: ${String(e?.message || e)} */\n`);
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',   // şəxsi data keşlənməməlidir
    },
  });
}

/* ================= QLOBAL AXTARIŞ — FTS5 (Bənd 11) ================= */

// İstifadəçi girişini TƏHLÜKƏSİZ FTS5 sorğusuna çevirir.
//
// ⚠ Xam mətni birbaşa MATCH-ə vermək OLMAZ: FTS5-in öz sintaksisi var
// (`"`, `*`, `NEAR`, `AND/OR/NOT`, `:`, `^`). İstifadəçi «C++ "test"» yazsa
// sorğu sintaksis xətası verib 500 qaytarardı — yəni adi axtarış sözü
// endpoint-i sındıra bilərdi. Ona görə hər söz ayrıca sitat içinə alınır
// (sitat daxilində operatorlar adi mətn sayılır).
function ftsQuery(raw: string): string | null {
  const terms = String(raw || '')
    .toLowerCase()
    // `-` simvol sinfinin SONUNDADIR → qaçırılmağa ehtiyacı yoxdur.
    .replace(/["*():^-]/g, ' ')       // FTS operator simvolları söz ayırıcıya çevrilir
    .split(/\s+/)
    .filter(t => t.length >= 2)       // tək hərf indeksdə mənalı deyil, hər şeyi qaytarır
    .slice(0, 8);                     // sorğu uzunluğu limiti (DoS qapısı)
  if (!terms.length) return null;
  // Son söz PREFİKS kimi axtarılır ("prog" → "proqramlaşdırma") — yazarkən
  // axtarış (as-you-type) üçün. Qalanları tam söz.
  return terms.map((t, i) => (i === terms.length - 1 ? `"${t}"*` : `"${t}"`)).join(' AND ');
}

const SEARCH_LIMIT = 8;

export async function globalSearch(c: Ctx) {
  const q = ftsQuery(c.url.searchParams.get('q') || '');
  if (!q) return json({ posts: [], users: [], comments: [], query: '' });

  const scope = c.url.searchParams.get('scope') || 'all';
  const want = (s: string) => scope === 'all' || scope === s;

  // Üç indeks paralel sorğulanır — `batch` tək D1 gedişində icra edir.
  // `bm25()` FTS5-in daxili reytinq funksiyasıdır (kiçik = daha uyğun);
  // sütun çəkiləri ilə ad/başlıq mətndən üstün tutulur.
  const stmts: D1PreparedStatement[] = [];
  const kinds: string[] = [];

  if (want('posts')) {
    kinds.push('posts');
    stmts.push(D(c).prepare(
      `SELECT p.id, p.author_id, p.author_name, p.created_at, p.tags,
              snippet(posts_fts, 0, '<mark>', '</mark>', '…', 18) AS snip
         FROM posts_fts
         JOIN posts p ON p.rowid = posts_fts.rowid
        WHERE posts_fts MATCH ?1
        ORDER BY bm25(posts_fts, 1.0, 2.0), p.created_at DESC
        LIMIT ?2`,
    ).bind(q, SEARCH_LIMIT));
  }
  if (want('users')) {
    kinds.push('users');
    stmts.push(D(c).prepare(
      `SELECT u.id, u.username, u.name, u.photo_url, u.xp,
              snippet(users_fts, 2, '<mark>', '</mark>', '…', 14) AS snip
         FROM users_fts
         JOIN users u ON u.rowid = users_fts.rowid
        WHERE users_fts MATCH ?1 AND u.blocked = 0
        ORDER BY bm25(users_fts, 4.0, 3.0, 1.0, 1.0), u.xp DESC
        LIMIT ?2`,
    ).bind(q, SEARCH_LIMIT));
  }
  if (want('comments')) {
    kinds.push('comments');
    stmts.push(D(c).prepare(
      `SELECT cm.id, cm.post_id, cm.author_name, cm.created_at,
              snippet(comments_fts, 0, '<mark>', '</mark>', '…', 16) AS snip
         FROM comments_fts
         JOIN comments cm ON cm.rowid = comments_fts.rowid
        WHERE comments_fts MATCH ?1
        ORDER BY bm25(comments_fts), cm.created_at DESC
        LIMIT ?2`,
    ).bind(q, SEARCH_LIMIT));
  }

  let results: any[];
  try {
    results = await D(c).batch<any>(stmts);
  } catch (e: any) {
    // FTS sintaksis xətası buraya düşməməlidir (`ftsQuery` təmizləyir),
    // amma düşsə istifadəçi 500 yox, boş nəticə görsün.
    console.error('fts search', e?.message || e);
    return json({ posts: [], users: [], comments: [], query: '' });
  }

  const out: Record<string, any[]> = { posts: [], users: [], comments: [] };
  kinds.forEach((kind, i) => {
    const rows = results[i]?.results || [];
    if (kind === 'posts') {
      out.posts = rows.map((r: any) => ({
        id: r.id, authorUid: r.author_id, authorName: r.author_name,
        createdAt: r.created_at, tags: fromJSON(r.tags, []), snippet: r.snip,
      }));
    } else if (kind === 'users') {
      out.users = rows.map((r: any) => ({
        uid: r.id, username: r.username, name: r.name,
        photoURL: r.photo_url, xp: r.xp, snippet: r.snip,
      }));
    } else {
      out.comments = rows.map((r: any) => ({
        id: r.id, postId: r.post_id, authorName: r.author_name,
        createdAt: r.created_at, snippet: r.snip,
      }));
    }
  });

  return json({ ...out, query: c.url.searchParams.get('q') || '' });
}

/* ================= PRECOMPUTED STATİSTİKA (Bənd 8) ================= */

// Profil statistikası — TRIGGER-lərlə artımlı saxlanılan tək sətir.
// Əvvəl hər açılışda 6 ayrı COUNT(*) icra olunurdu.
export async function userStats(c: Ctx, username: string) {
  const row = await D(c).prepare(
    `SELECT u.id, u.xp, u.streak, u.tasks_completed,
            COALESCE(s.posts, 0)          AS posts,
            COALESCE(s.comments, 0)       AS comments,
            COALESCE(s.likes_given, 0)    AS likes_given,
            COALESCE(s.likes_received, 0) AS likes_received,
            COALESCE(s.followers, 0)      AS followers,
            COALESCE(s.following, 0)      AS following
       FROM users u LEFT JOIN user_stats s ON s.uid = u.id
      WHERE u.username = ?`,
  ).bind(normalizeUsername(username)).first<any>();
  if (!row) return err('İstifadəçi tapılmadı.', 404);
  return json({
    stats: {
      posts: row.posts, comments: row.comments,
      likesGiven: row.likes_given, likesReceived: row.likes_received,
      followers: row.followers, following: row.following,
      xp: row.xp, streak: row.streak, tasksCompleted: row.tasks_completed,
    },
  });
}

/* ================= FƏALİYYƏT QRAFİKİ (Bənd 9) ================= */

// Heatmap datası — normalized `user_activity` cədvəlindən.
//
// TƏNBƏL MİQRASİYA: köhnə `users.activity_days` JSON blob-u hələ də mövcuddur.
// İstifadəçinin cədvəldə heç bir sətri yoxdursa, JSON bir dəfə köçürülür.
// Belədə migration ani qalır, data itmir və köçürmə yükü zamana yayılır.
export async function activityFor(c: Ctx, username: string) {
  const u = await D(c).prepare('SELECT id, activity_days FROM users WHERE username = ?')
    .bind(normalizeUsername(username)).first<any>();
  if (!u) return err('İstifadəçi tapılmadı.', 404);

  const has = await D(c).prepare('SELECT 1 FROM user_activity WHERE uid = ? LIMIT 1').bind(u.id).first();
  if (!has) {
    const legacy = fromJSON<Record<string, number>>(u.activity_days, {});
    const entries = Object.entries(legacy)
      .filter(([d, n]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(n) > 0)
      .slice(0, 800);   // ~2 il — heatmap onsuz da bir ildən çoxunu göstərmir
    if (entries.length) {
      await D(c).batch(entries.map(([d, n]) => D(c).prepare(
        'INSERT OR IGNORE INTO user_activity (uid, date, count) VALUES (?,?,?)',
      ).bind(u.id, d, Number(n))));
    }
  }

  // Heatmap son 1 ili göstərir — bütün tarixçəni çəkmək mənasızdır.
  const since = new Date(Date.now() - 371 * 86400000).toISOString().slice(0, 10);
  const rows = await D(c).prepare(
    'SELECT date, count FROM user_activity WHERE uid = ? AND date >= ? ORDER BY date',
  ).bind(u.id, since).all<any>();

  const days: Record<string, number> = {};
  for (const r of rows.results) days[r.date] = r.count;
  return json({ activityDays: days });
}

/* ================= PUBLIC KONFİQ ================= */
// Frontend-in build zamanı BİLƏ BİLMƏDİYİ public dəyərlər.
// Turnstile site key public-dir (secret deyil) — amma `wrangler.jsonc` var-ından
// gəldiyi üçün statik JS bundle-a hardcode edilə bilməz. Boş qayıdırsa
// frontend widget-i ümumiyyətlə render etmir (graceful degradation).
export async function publicConfig(c: Ctx) {
  return json({
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || '',
    // Magic link yalnız email göndərilə bildikdə UI-da görünür (Bənd 4).
    magicLink: emailEnabled(c.env),
    // Yalnız TAM konfiqurasiya olunmuş provayderlər — frontend işləməyən
    // düymə göstərməsin.
    oauthProviders: configuredProviders(c.env),
  });
}

/**
 * Sağlamlıq yoxlaması — AUDIT-TASK-5 §10/2 → AUDIT-TASK-6 §A-3.
 *
 * NİYƏ VAR: `0021_restore_bootstrap_rooms.sql` itmiş `general` otağını bərpa
 * etdi, lakin heç nə TƏKRARIN qarşısını almır. `e2e/seed-hygiene.spec.ts`
 * bunu yalnız LOKAL mühitdə tutur — istehsalda tutmur. Otaq silinsə
 * `room_messages.room_id` FK-sı pozulur və qlobal çat sükutla çökür.
 *
 * ⚠ MƏLUMAT SIZDIRMIR: sətir sayı, istifadəçi adı, versiya, xəta mətni
 * qaytarılmır — yalnız 'ok' / 'fail' / 'missing'. Endpoint autentifikasiyasız
 * olduğu üçün bu, məcburi şərtdir.
 */
export async function health(c: Ctx) {
  let db: 'ok' | 'fail' = 'ok';
  let bootstrapGeneralRoom: 'ok' | 'missing' = 'missing';
  let migrationsApplied = 0;

  try {
    const row = await D(c).prepare(
      `SELECT (SELECT COUNT(*) FROM rooms WHERE id = 'general') AS room,
              (SELECT COUNT(*) FROM d1_migrations)              AS migs`,
    ).first<any>();
    bootstrapGeneralRoom = Number(row?.room || 0) > 0 ? 'ok' : 'missing';
    migrationsApplied = Number(row?.migs || 0);
  } catch {
    // Səbəb QAYTARILMIR — xəta mətni sxem detalı sızdıra bilər.
    db = 'fail';
  }

  // AUDIT-TASK-9 §5.4 — XP invariantı yoxlanıla bilən sağlamlıq göstəricisidir.
  // 'drift' o deməkdir ki, nəyisə `xp_logs`-dan KƏNARDA `users.xp`-ni dəyişir
  // (əl ilə SQL, sadalanmamış route, yarımçıq batch). Bu, H-5-in yenidən
  // açılmasının ilk əlamətidir və sükutla baş verir — ona görə ölçülür.
  let xpInv: 'ok' | 'drift' | 'unknown' = 'unknown';
  try {
    const inv = await xpInvariant(c.env);
    xpInv = inv.ok ? 'ok' : 'drift';
    // 🔴 AUDIT-TASK-10 / Faza 2.3 — Task 9 §5.4 öhdəliyi: invariant yalnız
    // GÖSTƏRİLİRDİ, heç bir siqnala bağlı deyildi. Drift H-5-in yenidən
    // açılmasının ilk əlamətidir və sükutla baş verir.
    if (!inv.ok) alert('xp_invariant_drift', { users: inv.users, logs: inv.logs });
  } catch { /* sxem hələ migrate olunmayıb — 'unknown' qalır */ }

  const checks = {
    db, bootstrap_general_room: bootstrapGeneralRoom,
    migrations_applied: migrationsApplied, xp_invariant: xpInv,
  };
  // ⚠ `drift` `ok`-u AŞAĞI SALMIR: bu, məlumat bütövlüyü siqnalıdır, xidmət
  //   nasazlığı deyil — 503 vermək sağlam saytı monitorinqdə "ölü" göstərərdi.
  const ok = db === 'ok' && bootstrapGeneralRoom === 'ok';
  // 503: monitorinq alətləri status kodundan da oxuya bilsin.
  return json({ ok, checks }, ok ? 200 : 503);
}

/* ================= UPLOAD — `routes/upload.ts`-ə köçürüldü ================= */
// AUDIT-TASK-10 / Faza 3.1. `index.ts` marşrut cədvəli `R.upload` /
// `R.serveFile` adlarını işlədir, ona görə burada RE-EXPORT saxlanılır —
// belədə bölünmə `index.ts`-ə TOXUNMUR (sənədin tələb etdiyi barrel naxışı).
export { upload, serveFile } from './routes/upload';


/* ============ AUTH / 2FA / MAGIC LINK / OAUTH — `routes/auth.ts`-ə köçürüldü ============ */
// AUDIT-TASK-10 / Faza 3.1. `index.ts` marşrut cədvəli bu adları işlədir,
// ona görə RE-EXPORT saxlanılır — bölünmə `index.ts`-ə TOXUNMUR.
export {
  register, login, refresh, logout, me, listSessions, revokeOneSession,
  revokeOtherSessions, usernameAvailable, changePassword, changeUsername,
  deleteAccount,
  mfaStatus, mfaSetup, mfaConfirm, mfaDisable, mfaRegenerateBackup, mfaVerify,
  magicLinkRequest, magicLinkConsume,
  oauthStart, oauthCallback, oauthPending, listOAuthAccounts, unlinkOAuth,
} from './routes/auth';


/* ================= ADMIN — `routes/admin.ts`-ə köçürüldü ================= */
// AUDIT-TASK-10 / Faza 3.1 — `index.ts` marşrut cədvəli üçün RE-EXPORT.
export {
  listTaxonomies, saveTaxItem, deactivateTaxItem, reorderTaxonomy,
  adminUsersList, adminPatchUser, adminTempPassword, adminBulkUsers,
  adminStatsDaily, adminLogs, adminLogAction, adminExportCsv,
  adminListFaqs, adminSaveFaq, adminDeleteFaq,
  adminListTestimonials, adminSaveTestimonial, adminDeleteTestimonial,
  adminContacts, adminContactRead,
  adminListAdmins, adminAddAdmin, adminRemoveAdmin,
  securityEvents, securitySummary,
} from './routes/admin';
