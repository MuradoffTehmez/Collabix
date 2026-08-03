// İstifadəçi kataloqu domeni — süzgəc, sıralama, zənginləşdirmə, tövsiyələr.
//
// ⚠ NİYƏ `user.ts`-DƏN AYRILDI: `usersDirectory` orada 100 sətirlik tək
//   funksiya idi və profil oxu/redaktə ilə eyni faylı paylaşırdı. Kataloq
//   indi öz filtr taksonomiyasını, sosial zənginləşdirməsini və tövsiyə
//   endpoint-ini daşıyır — `user.ts` yenidən şişərdi. AUDIT-TASK-10 / Faza
//   3.1 bölünmə naxışı: domen modulu + `routes.ts`-dən re-export.
//
// 🔴 GERİYƏ UYĞUNLUQ: `usersDirectory` parametrsiz çağırışda əvvəlki cavab
//    formasını verir — `users`, `nextCursor`. Yeni sahələr yalnız ƏLAVƏDİR.
import {
  Ctx, json, err, clampStr, likePattern, searchNormalize, mapUser, placeholders,
} from '../util';
import { D } from './shared';

/* ═══════════════════════ SIRALAMA ═══════════════════════
 *
 * sort açarı → [SQL sütunu, istiqamət]. AĞ SİYAHI: dəyər birbaşa SQL-ə
 * düşdüyü üçün istifadəçi girişi HEÇ VAXT buraya keçmir (injection qapısı).
 *
 * ⚠ "Ən çox layihə" sıralaması QƏSDƏN YOXDUR. O, `team_project_members`
 *   üzərində üçüncü denormallaşdırılmış sayğac tələb edir və həmin sayğac
 *   TASK-11 komanda servisindəki bir neçə yazı yolunda saxlanılmalıdır.
 *   Layihə sayı kartda GÖSTƏRİLİR (toplu sorğu ilə), lakin sıralanmır —
 *   yarımçıq saxlanılan sayğac səssizcə yalan sıra verərdi.
 */
const DIR_SORTS: Record<string, [string, 'ASC' | 'DESC']> = {
  recent: ['joined_at', 'DESC'],           // default — ən yeni qoşulanlar
  xp: ['xp', 'DESC'],
  active: ['last_active_at', 'DESC'],
  alpha: ['username', 'ASC'],
  // Denormallaşdırılmış sütun (miqrasiya 0051) — korrelyasiyalı alt-sorğu
  // keyset kursorunu sındırırdı, bax həmin faylın şərhi.
  followers: ['followers_count', 'DESC'],
};
const DIR_PAGE = 24;

/**
 * Əl ilə təyin olunan status — ağ siyahı.
 *
 * 🔴 PRESENCE-DAN AYRIDIR: presence "bağlıdırmı" sualına cavab verir
 *    (ölçülür), bu isə "nə demək istəyir" sualına (niyyət). UI ikisini
 *    birləşdirir; oflayn istifadəçinin `busy` statusu göstərilmir.
 */
export const USER_STATUSES = new Set(['', 'away', 'busy', 'dnd', 'hiring']);

/* ═══════════════════════ ZƏNGİNLƏŞDİRMƏ ═══════════════════════ */

/**
 * Səhifədəki istifadəçilərə sosial kontekst əlavə edir.
 *
 * 🔴 TOPLU SORĞU, SƏTİR-SƏTİR YOX. 24 nəfərlik səhifə üçün hər istifadəçiyə
 *    ayrıca sorğu 24 × 4 = 96 D1 gediş-gəlişi olardı (N+1). Burada CƏMİ DÖRD
 *    sorğu var və hamısı `IN (...)` ilə işləyir.
 *
 * ⚠ İzləyici/izlənilən sayı BURADA HESABLANMIR — o, `users.followers_count`
 *   sütunundan gəlir (miqrasiya 0051). Beşinci sorğuya ehtiyac qalmır.
 *
 * @param ids səhifədəki uid-lər
 * @param me  sorğunu edən istifadəçi (ortaqlıqlar onun üçün hesablanır)
 */
async function enrichSocial(c: Ctx, ids: string[], me: string) {
  const empty = {
    teams: new Map<string, number>(),
    projects: new Map<string, number>(),
    mutualTeams: new Map<string, number>(),
    mutualProjects: new Map<string, number>(),
    followingMe: new Set<string>(),
    iFollow: new Set<string>(),
  };
  if (!ids.length) return empty;

  const ph = placeholders(ids.length);
  const [teams, projects, mutT, mutP, follows] = await D(c).batch<any>([
    // Komanda sayı — yalnız aktiv üzvlük.
    D(c).prepare(
      `SELECT user_id, COUNT(*) AS n FROM team_members
        WHERE user_id IN (${ph}) AND status = 'active' GROUP BY user_id`,
    ).bind(...ids),
    D(c).prepare(
      `SELECT user_id, COUNT(*) AS n FROM team_project_members
        WHERE user_id IN (${ph}) GROUP BY user_id`,
    ).bind(...ids),
    // ORTAQ komanda: alt-sorğu "mənim komandalarım" dəstini verir.
    // ⚠ `IN (SELECT …)` qəsdən JOIN-dan üstün tutulur — mənim komandalarımın
    //   sayı azdır və SQLite alt-sorğunu bir dəfə materiallaşdırır.
    D(c).prepare(
      `SELECT user_id, COUNT(*) AS n FROM team_members
        WHERE user_id IN (${ph}) AND status = 'active'
          AND team_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active')
        GROUP BY user_id`,
    ).bind(...ids, me),
    D(c).prepare(
      `SELECT user_id, COUNT(*) AS n FROM team_project_members
        WHERE user_id IN (${ph})
          AND project_id IN (SELECT project_id FROM team_project_members WHERE user_id = ?)
        GROUP BY user_id`,
    ).bind(...ids, me),
    // İzləmə istiqamətləri — TƏK sorğuda hər iki tərəf.
    D(c).prepare(
      `SELECT follower_id, target_id FROM follows
        WHERE (follower_id = ? AND target_id IN (${ph}))
           OR (target_id = ? AND follower_id IN (${ph}))`,
    ).bind(me, ...ids, me, ...ids),
  ]);

  const toMap = (res: any) => {
    const m = new Map<string, number>();
    for (const r of res.results) m.set(r.user_id, Number(r.n) || 0);
    return m;
  };

  const out = {
    teams: toMap(teams),
    projects: toMap(projects),
    mutualTeams: toMap(mutT),
    mutualProjects: toMap(mutP),
    followingMe: new Set<string>(),
    iFollow: new Set<string>(),
  };
  for (const r of follows.results) {
    if (r.follower_id === me) out.iFollow.add(r.target_id);
    if (r.target_id === me) out.followingMe.add(r.follower_id);
  }
  return out;
}

/* ═══════════════════════ KATALOQ ═══════════════════════ */

/**
 * İstifadəçi kataloqu — D1-də sıralama + filtr + keyset səhifələmə.
 *
 * Sorğu parametrləri (hamısı opsional):
 *   q        ad / istifadəçi adı (normallaşdırılmış axtarış daxil)
 *   skill    konkret bacarıq · level  səviyyə · looking  məqsəd
 *   company  iş yeri (LIKE) · loc  ölkə/şəhər (LIKE) · status  əl ilə status
 *   extra    verified | online | mutual | following | followers
 *   sort     recent | xp | active | alpha | followers
 *   cursor   "<sortDəyəri>|<id>" · limit  1..60
 */
export async function usersDirectory(c: Ctx) {
  const u = new URL(c.req.url).searchParams;
  const { users, nextCursor } = await queryDirectory(c, u);
  return json({ users, nextCursor });
}

/**
 * Kataloq sorğusunun ÖZƏYİ — HTTP cavabından ayrıdır.
 *
 * ⚠ NİYƏ AYRILDI: CSV ixracı eyni filtrləri işlətməlidir. Əvvəlki variantda
 *   `usersDirectory`-ni saxta `Ctx` ilə çağırmaq lazım gəlirdi
 *   (`{ ...c, req: new Request(...) }`) — `Ctx` obyektinin getter-ləri və
 *   prototipi olduğu üçün bu, səssizcə yanlış davrana bilərdi. Parametrləri
 *   AÇIQ ötürmək həmin kövrəkliyi tamamilə aradan qaldırır.
 */
async function queryDirectory(c: Ctx, u: URLSearchParams) {
  const me = c.user!.id;
  const sortKey = u.get('sort') || 'recent';
  const [col, dir] = DIR_SORTS[sortKey] || DIR_SORTS.recent;

  const where: string[] = ['blocked = 0', 'id != ?'];
  const vals: unknown[] = [me];

  // Mətn axtarışı — ad / istifadəçi adı üzrə.
  // ⚠ Hər `LIKE`-da `ESCAPE '\'` MƏCBURİDİR — dəyərlərdə `_`/`%` escape olunur,
  // amma ESCAPE bəyan edilməsə SQLite `\_`-i "\ + istənilən simvol" sayır və
  // `_` olan adlar (bütün `e2e_*` hesablar) tapılmır.
  const q = (u.get('q') || '').trim().toLowerCase();
  if (q) {
    // D-3: `search_name` normallaşdırılmış sütundur — `Təhməz` sorğusu
    // `Tehmez` yazılışını (və əksini) tapır.
    // ⚠ YALNIZ anonim `?` işlədilir. Nömrəli (`?1`) placeholder-lər bu sorğuda
    // TƏHLÜKƏLİDİR: `where`/`vals` cütü dinamik yığılır və siyahının əvvəlində
    // artıq `id != ?` parametri var — `?1` həmin istifadəçi id-sinə düşərdi.
    where.push("(lower(name) LIKE ? ESCAPE '\\' OR lower(username) LIKE ? ESCAPE '\\'"
      + " OR search_name LIKE ? ESCAPE '\\')");
    const likeRaw = likePattern(q);
    vals.push(likeRaw, likeRaw, likePattern(searchNormalize(q)));
  }

  // Skill/səviyyə/məqsəd JSON sütunlarındadır (prog_levels, lang_levels,
  // looking_for). Açar adı dinamik olduğu üçün LIKE ilə ilkin daraltma edilir,
  // dəqiq yoxlama aşağıda JS-dədir.
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

  // İş yeri (miqrasiya 0050).
  const company = clampStr(u.get('company'), 60).trim().toLowerCase();
  if (company) {
    where.push("lower(company) LIKE ? ESCAPE '\\'");
    vals.push(likePattern(company));
  }

  // Yer — ölkə VƏ YA şəhər. İkisi ayrı sütundur, istifadəçi isə tək sahəyə yazır.
  const loc = clampStr(u.get('loc'), 40).trim().toLowerCase();
  if (loc) {
    where.push("(lower(country) LIKE ? ESCAPE '\\' OR lower(city) LIKE ? ESCAPE '\\')");
    const p = likePattern(loc);
    vals.push(p, p);
  }

  // Əl ilə status — ağ siyahıdan kənar dəyər SÜKUTLA ATILIR (xəta yox):
  // filtr köməkçi vasitədir, səhv parametr səhifəni çökdürməməlidir.
  const status = clampStr(u.get('status'), 10).trim();
  if (status && USER_STATUSES.has(status) && status !== '') {
    where.push('status = ?');
    vals.push(status);
  }

  const extra = u.get('extra') || '';
  if (extra === 'verified') where.push('verified = 1');
  // 🔴 `mutual`/`following` ARTIQ SERVERDƏDİR (əvvəl client-də süzülürdü).
  //    Səbəb: client süzgəci bütöv səhifəni boşalda bilirdi və `users.js`
  //    "5 boş səhifə" zənciri ilə bunu kompensasiya edirdi — yəni bir filtr
  //    üçün beş sorğu gedirdi. `online` isə client-də QALIR: presence ayrı
  //    sistemdir və bu sorğuya qoşulması onu presence yazılarına bağlayardı.
  if (extra === 'following') {
    where.push('EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND target_id = users.id)');
    vals.push(me);
  } else if (extra === 'followers') {
    where.push('EXISTS (SELECT 1 FROM follows WHERE target_id = ? AND follower_id = users.id)');
    vals.push(me);
  } else if (extra === 'mutual') {
    where.push('EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND target_id = users.id)');
    where.push('EXISTS (SELECT 1 FROM follows WHERE target_id = ? AND follower_id = users.id)');
    vals.push(me, me);
  }

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
  // ⚠ `users.id` AÇIQ yazılır: `EXISTS` alt-sorğularında `users` adı ilə
  //   istinad edilir və cədvəl adı olmadan SQLite alt-sorğunun öz sahəsini
  //   axtarardı.
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

  // Sosial kontekst — YALNIZ süzgəcdən keçən sətirlər üçün.
  const social = await enrichSocial(c, list.map((x: any) => x.uid), me);
  for (const x of list as any[]) {
    x.teamsCount = social.teams.get(x.uid) || 0;
    x.projectsCount = social.projects.get(x.uid) || 0;
    x.mutualTeams = social.mutualTeams.get(x.uid) || 0;
    x.mutualProjects = social.mutualProjects.get(x.uid) || 0;
    x.iFollow = social.iFollow.has(x.uid);
    x.followsMe = social.followingMe.has(x.uid);
  }

  return { users: list, nextCursor };
}

/* ═══════════════════════ TÖVSİYƏLƏR ═══════════════════════ */

/** Hər tövsiyə zolağında neçə nəfər — bir ekran dolusu. */
const SUGGEST_N = 6;

/**
 * Sağ paneldəki tövsiyələr — dörd siyahı, TƏK sorğu dəsti.
 *
 * ⚠ NİYƏ AYRICA ENDPOINT: kataloq sorğusu filtrlə dəyişir, tövsiyələr isə
 *   dəyişmir. Eyni cavaba yığsaydıq hər filtr dəyişikliyində tövsiyələr də
 *   yenidən hesablanardı (dörd əlavə sorğu, hər dəfə).
 *
 * 🔴 «Tanış ola bilərsən» SADƏ HEURİSTİKADIR, qraf analizi deyil: mənim
 *    izlədiklərimin izlədikləri, məni izləməyənlər. Bu, real "ikinci dərəcə
 *    əlaqə" siqnalıdır və TƏK sorğuda alınır. Daha ağır model (ortaq
 *    komanda + skill oxşarlığı çəkiləri) ölçülməmiş mürəkkəblik olardı.
 */
export async function suggestedUsers(c: Ctx) {
  const me = c.user!.id;

  const [known, topXp, fresh, active] = await D(c).batch<any>([
    D(c).prepare(
      `SELECT u.* FROM users u
        WHERE u.blocked = 0 AND u.id != ?1
          AND u.id IN (
            SELECT f2.target_id FROM follows f1
              JOIN follows f2 ON f2.follower_id = f1.target_id
             WHERE f1.follower_id = ?1
          )
          AND NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = ?1 AND target_id = u.id)
        ORDER BY u.followers_count DESC, u.id ASC LIMIT ?2`,
    ).bind(me, SUGGEST_N),
    D(c).prepare(
      `SELECT * FROM users WHERE blocked = 0 AND id != ?1
        ORDER BY xp DESC, id ASC LIMIT ?2`,
    ).bind(me, SUGGEST_N),
    D(c).prepare(
      `SELECT * FROM users WHERE blocked = 0 AND id != ?1
        ORDER BY joined_at DESC, id ASC LIMIT ?2`,
    ).bind(me, SUGGEST_N),
    D(c).prepare(
      `SELECT * FROM users WHERE blocked = 0 AND id != ?1 AND last_active_at > 0
        ORDER BY last_active_at DESC, id ASC LIMIT ?2`,
    ).bind(me, SUGGEST_N),
  ]);

  const slim = (res: any) => res.results.map((r: any) => {
    const m = mapUser(r);
    // ⚠ Tövsiyə kartı kiçikdir — tam profil obyekti göndərmək cavabı
    //   dörd dəfə şişirdərdi. Yalnız göstərilən sahələr qalır.
    return {
      uid: m.uid, username: m.username, name: m.name, photoURL: m.photoURL,
      verified: m.verified, xp: m.xp, company: m.company, status: m.status,
      country: m.country, city: m.city, followersCount: m.followersCount,
      lastActiveAt: m.lastActiveAt, joinedAt: m.joinedAt,
    };
  });

  return json({
    known: slim(known),
    topXp: slim(topXp),
    fresh: slim(fresh),
    active: slim(active),
  });
}

/* ═══════════════════════ KATALOQ XÜLASƏSİ ═══════════════════════ */

/**
 * Başlıqdakı statistika kartları — BÜTÜN baza üzrə, yüklənmiş səhifə üzrə YOX.
 *
 * ⚠ TƏK sorğuda şərti toplama. Səkkiz ayrı `COUNT(*)` səkkiz tam skan
 *   olardı (`adminStatsDaily` ilə eyni sinif qüsur, AUDIT-TASK-10 / Faza 4).
 */
export async function directoryStats(c: Ctx) {
  const me = c.user!.id;
  const dayAgo = Date.now() - 86400000;
  const weekAgo = Date.now() - 7 * 86400000;

  const [main, social] = await D(c).batch<any>([
    D(c).prepare(
      `SELECT COUNT(*)                                                   AS total,
              SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END)              AS verified,
              SUM(CASE WHEN status = 'hiring' THEN 1 ELSE 0 END)         AS hiring,
              SUM(CASE WHEN last_active_at >= ?2 THEN 1 ELSE 0 END)      AS activeDay,
              SUM(CASE WHEN joined_at >= ?3 THEN 1 ELSE 0 END)           AS newWeek,
              SUM(CASE WHEN looking_for LIKE '%Mentor%' THEN 1 ELSE 0 END) AS mentors
         FROM users WHERE blocked = 0 AND id != ?1`,
    ).bind(me, dayAgo, weekAgo),
    D(c).prepare(
      `SELECT (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following,
              (SELECT COUNT(*) FROM team_members WHERE user_id = ?1 AND status = 'active') AS teams,
              (SELECT COUNT(*) FROM team_project_members WHERE user_id = ?1) AS projects`,
    ).bind(me),
  ]);

  const m = main.results[0] || {};
  const s = social.results[0] || {};
  const n = (v: unknown) => Number(v) || 0;

  return json({
    total: n(m.total), verified: n(m.verified), hiring: n(m.hiring),
    activeDay: n(m.activeDay), newWeek: n(m.newWeek), mentors: n(m.mentors),
    following: n(s.following), teams: n(s.teams), projects: n(s.projects),
    syncedAt: Date.now(),
  });
}

/* ═══════════════════════ İXRAC ═══════════════════════ */

/** Bir ixracda maksimum sətir — brauzerdə açılan fayl üçün ağlabatan hədd. */
const EXPORT_MAX = 500;

/**
 * Kataloqun CSV ixracı — CARİ FİLTRLƏ.
 *
 * ⚠ NİYƏ `csvCell` işlədilir: `=`, `+`, `-`, `@` ilə başlayan xanalar Excel-də
 *   FORMUL kimi icra olunur (formula injection). `shared.ts`-dəki köməkçi
 *   onları apostrofla neytrallaşdırır — admin ixracı ilə eyni müdafiə.
 *
 * ⚠ Yalnız PUBLİK sahələr: e-poçt, telefon, `settings` YOXDUR. İxrac
 *   kataloqda onsuz da görünən məlumatın maşınoxunan formasıdır, yeni
 *   məlumat açmır.
 */
export async function exportDirectory(c: Ctx) {
  const { csvRow } = await import('./shared');
  const u = new URL(c.req.url).searchParams;
  // Eyni filtrlərlə, lakin ixrac tavanı ilə. Səhifə limiti 60-la məhdud
  // olduğu üçün ixrac səhifə-səhifə yığılır.
  u.set('limit', '60');

  const rows: any[] = [];
  let cursor: string | null = null;
  do {
    if (cursor) u.set('cursor', cursor); else u.delete('cursor');
    const page: { users: any[]; nextCursor: string | null } = await queryDirectory(c, u);
    rows.push(...page.users);
    cursor = page.nextCursor;
  } while (cursor && rows.length < EXPORT_MAX);

  if (!rows.length) return err('İxrac ediləcək istifadəçi yoxdur.', 404, 'empty_export');

  let out = csvRow(['username', 'name', 'company', 'country', 'city', 'xp', 'followers', 'teams', 'projects', 'verified', 'joined_at']);
  for (const x of rows.slice(0, EXPORT_MAX)) {
    out += csvRow([
      x.username, x.name, x.company || '', x.country || '', x.city || '',
      x.xp || 0, x.followersCount || 0, x.teamsCount || 0, x.projectsCount || 0,
      x.verified ? '1' : '0', new Date(x.joinedAt || 0).toISOString(),
    ]);
  }
  return new Response(out, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="collabix-users.csv"',
    },
  });
}
