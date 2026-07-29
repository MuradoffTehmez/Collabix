// İstifadəçi profili domeni — AUDIT-TASK-10 / Faza 3.1.
//
// Profil oxu/redaktə, kataloq, sosial əlaqələr, tərəqqi, statistika və
// fəaliyyət qrafiki. Statistika bölmələri buraya salınıb, çünki onlar
// istifadəçi profilinin göstəricələridir və başqa domendən çağırılmır.
import {
  Ctx, json, err, readJson, now, clampStr, fromJSON, toJSON,
  likePattern, searchNormalize, mapUser, normalizeUsername,
} from '../util';
import { grantXp } from '../xp';
import { D, badReq, notify } from './shared';

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

