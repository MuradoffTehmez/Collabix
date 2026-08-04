// İş sahəsi domeni — istifadəçinin BÜTÜN komandalarındakı tapşırıqlar.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 İCAZƏ SƏRHƏDİ — BU FAYLIN ƏN VACİB HİSSƏSİ
// ════════════════════════════════════════════════════════════════════════════
//
// Komanda endpoint-ləri `requireTeamPermission(c, teamId, …)` işlədir, çünki
// orada teamId URL-dədir. Burada isə sorğu BİR komandaya aid deyil — "mənim
// bütün tapşırıqlarım" sualıdır. Yəni hər sətir üçün ayrıca icazə yoxlaması
// mümkün deyil (N+1) və unudulması sızma deməkdir.
//
// HƏLL: BÜTÜN sorğular `visibleScope` alt-sorğusundan keçir —
//
//   t.project_id IN (SELECT p.id FROM team_projects p
//                      JOIN team_members m ON m.team_id = p.team_id
//                     WHERE m.user_id = ?me AND m.status = 'active')
//
// Bu, filtr DEYİL, TƏHLÜKƏSİZLİK QAPISIDIR. Yeni sorğu yazan hər kəs onu
// əlavə etməlidir; `scopedWhere()` köməkçisi məhz bunun unudulmaması üçündür.
//
// ⚠ SAYT ADMİNİ İSTİSNA DEYİL: admin paneli komandaları ayrıca moderasiya
//   edir. İş sahəsi ŞƏXSİ ekrandır — admin burada da yalnız öz komandalarını
//   görür, əks halda "mənim tapşırıqlarım" 40 min sətir olardı.
import { Ctx, json, clampStr, now } from '../../util';
import { D } from '../shared';

/* ═══════════════════════ TAKSONOMİYA ═══════════════════════
 *
 * ⚠ SERVER AĞ SİYAHISI: status və prioritet birbaşa SQL-ə düşmür, lakin
 *   CSS sinif adına çevrilir və Kanban sütununu təyin edir. Naməlum dəyər
 *   kartı görünməz sütuna atardı.
 *
 * ⚠ MÖVCUD DƏYƏRLƏR SAXLANILIR: `To Do`, `In Progress`, `Review`, `Done`
 *   köhnə `TeamTaskService`-dəndir və bazada mövcud sətirlərdədir. Yenilər
 *   ONLARIN ÜSTÜNƏ əlavədir — köçürmə lazım deyil.
 */
export const WS_STATUSES = [
  'Backlog', 'To Do', 'Planning', 'In Progress', 'Review',
  'Testing', 'Done', 'Blocked', 'Cancelled',
] as const;

/** Kanban sütunları — `Cancelled` qəsdən yoxdur (arxiv kimi davranır). */
export const WS_BOARD = [
  'Backlog', 'To Do', 'In Progress', 'Review', 'Testing', 'Done',
] as const;

export const WS_PRIORITIES = ['Critical', 'Urgent', 'High', 'Medium', 'Low'] as const;

/** Etiket rəngləri — nişan açarı, xam hex YOX (4 temada uyğunluq). */
export const WS_LABEL_COLORS = [
  'slate', 'blue', 'violet', 'green', 'amber', 'rose', 'teal', 'cyan', 'lime', 'orange',
] as const;

const num = (v: unknown) => Number(v) || 0;

/* ═══════════════════════ GÖRÜNÜRLÜK QAPISI ═══════════════════════ */

/**
 * Tapşırıq sətrinin görünürlük şərti.
 *
 * 🔴 HƏR SORĞUDA OLMALIDIR. Ayrıca funksiya kimi saxlanılır ki, mətn
 *    təkrarlanmasın və biri unudulanda fərq gözə çarpsın.
 *
 * @param alias `team_tasks` cədvəlinin aliası
 * @param pn    `?n` — cari istifadəçinin yer tutucu nömrəsi
 */
export const scopedWhere = (alias: string, pn: number) =>
  `${alias}.project_id IN (
     SELECT p.id FROM team_projects p
       JOIN team_members m ON m.team_id = p.team_id
      WHERE m.user_id = ?${pn} AND m.status = 'active'
        AND p.status != 'deleted')`;

/* ⚠ Tək tapşırığı gətirən `taskFor()` BU FAYLDA DEYİL —
   `routes/workspace-task.ts`. Səbəb: onu işlədən bütün əməliyyatlar
   (redaktə, detal, sürüşdürmə) oradadır və qapı öz istifadəçilərinin
   yanında dursun deyə. Görünürlük şərtinin ÖZÜ (`scopedWhere`) burada
   qalır və hər iki fayl ondan qidalanır. */

/* ═══════════════════════ SƏTİR → OBYEKT ═══════════════════════ */

const mapTask = (r: any) => ({
  id: r.id,
  key: r.task_key || '',
  title: r.title,
  description: r.description || '',
  status: r.status,
  priority: r.priority || 'Medium',
  projectId: r.project_id,
  projectName: r.project_name || '',
  teamId: r.team_id || '',
  teamSlug: r.team_slug || '',
  teamName: r.team_name || '',
  sprintId: r.sprint_id || null,
  sprintName: r.sprint_name || '',
  parentId: r.parent_id || null,
  assigneeId: r.assignee_id || null,
  assigneeName: r.assignee_name || '',
  assigneeUsername: r.assignee_username || '',
  assigneePhoto: r.assignee_photo || '',
  createdBy: r.created_by || null,
  startDate: r.start_date || null,
  deadline: r.deadline || null,
  estimatedMinutes: r.estimated_minutes ?? (r.estimated_hours ? r.estimated_hours * 60 : null),
  spentMinutes: num(r.spent_minutes),
  position: Number(r.position) || 0,
  recurrence: r.recurrence || '',
  commentCount: num(r.comment_count),
  attachCount: num(r.attach_count),
  checkTotal: num(r.check_total),
  checkDone: num(r.check_done),
  subtaskCount: num(r.subtask_count),
  createdAt: num(r.created_at),
  updatedAt: r.updated_at || null,
  completedAt: r.completed_at || null,
  archivedAt: r.archived_at || null,
  labels: r.label_ids ? String(r.label_ids).split(',').filter(Boolean) : [],
});

/* ═══════════════════════ FİLTRLƏR ═══════════════════════ */

/**
 * Sorğu parametrlərindən `WHERE` fraqmenti + bind dəyərləri qurur.
 *
 * ⚠ SÜTUN ADLARI SABİTDİR, istifadəçi girişi YALNIZ yer tutucuya düşür —
 *   sıralama açarı da ağ siyahıdan keçir (injection qapısı).
 */
const SORTS: Record<string, string> = {
  manual: 't.position ASC, t.created_at DESC',
  created: 't.created_at DESC',
  updated: 'COALESCE(t.updated_at, t.created_at) DESC',
  due: '(t.deadline IS NULL), t.deadline ASC',
  priority: `CASE t.priority WHEN 'Critical' THEN 0 WHEN 'Urgent' THEN 1
              WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, t.created_at DESC`,
  title: 't.title COLLATE NOCASE ASC',
};

function buildFilters(c: Ctx, u: URLSearchParams) {
  const me = c.user!.id;
  // ?1 HƏMİŞƏ cari istifadəçidir (görünürlük qapısı).
  const vals: unknown[] = [me];
  const cond: string[] = [scopedWhere('t', 1)];
  /** Növbəti yer tutucu — dəyər `vals`-a ƏLAVƏ OLUNDUQDAN sonra çağırılır. */
  const P = (v: unknown) => { vals.push(v); return '?' + vals.length; };

  // Arxiv: default GİZLİ. "Hər şey" filtri açıq seçim tələb edir.
  const archived = u.get('archived') || '';
  if (archived === 'only') cond.push('t.archived_at IS NOT NULL');
  else if (archived !== 'all') cond.push('t.archived_at IS NULL');

  /**
   * `col IN (?,?,?)` — dəyərləri ağ siyahıdan keçirib bind edir.
   *
   * ⚠ AYRICA KÖMƏKÇİ: sətir-içi yazılanda yer tutucu nömrəsi ilə bind sırası
   *   asanlıqla ayrılır (D1 bind sayını DƏQİQ tələb edir — `post.ts` dərsi).
   *   Burada ikisi eyni yerdə artır, ona görə sürüşmə mümkün deyil.
   */
  const inList = (col: string, raw: string | null, allow: readonly string[], max = 12) => {
    const picked = String(raw || '').split(',').map(x => x.trim())
      .filter(x => allow.includes(x)).slice(0, max);
    if (!picked.length) return;
    const ph = picked.map(v => { vals.push(v); return '?' + vals.length; });
    cond.push(`${col} IN (${ph.join(',')})`);
  };
  inList('t.status', u.get('status'), WS_STATUSES);
  inList('t.priority', u.get('priority'), WS_PRIORITIES);

  const one = (key: string, sql: string) => {
    const v = clampStr(u.get(key) || '', 60).trim();
    if (v) { vals.push(v); cond.push(sql.replace('%P%', '?' + vals.length)); }
  };
  one('team', 'p.team_id = %P%');
  one('project', 't.project_id = %P%');
  one('sprint', 't.sprint_id = %P%');
  one('assignee', 't.assignee_id = %P%');
  one('creator', 't.created_by = %P%');
  one('parent', 't.parent_id = %P%');

  // "Mənim tapşırıqlarım" — təyinat VƏ YA izləyici.
  if (u.get('mine') === '1') {
    cond.push(`(t.assignee_id = ?1 OR EXISTS (
                 SELECT 1 FROM task_watchers w WHERE w.task_id = t.id AND w.user_id = ?1))`);
  }
  if (u.get('unassigned') === '1') cond.push('t.assignee_id IS NULL');

  // Etiket — HƏR HANSI biri (HAMISI deyil): filtr daraldıcı yox, genişləndirici.
  const labels = String(u.get('labels') || '').split(',').map(x => x.trim())
    .filter(Boolean).slice(0, 10);
  if (labels.length) {
    const ph = labels.map(v => { vals.push(v); return '?' + vals.length; });
    cond.push(`EXISTS (SELECT 1 FROM task_label_links l
                        WHERE l.task_id = t.id AND l.label_id IN (${ph.join(',')}))`);
  }

  // Son tarix aralığı.
  const dueFrom = num(u.get('dueFrom'));
  const dueTo = num(u.get('dueTo'));
  if (dueFrom) cond.push(`t.deadline >= ${P(dueFrom)}`);
  if (dueTo) cond.push(`t.deadline <= ${P(dueTo)}`);

  // Hazır aralıqlar.
  const due = u.get('due') || '';
  const DAY = 86_400_000;
  if (due === 'overdue') cond.push(`t.deadline IS NOT NULL AND t.deadline < ${P(now())} AND t.status != 'Done'`);
  else if (due === 'today') cond.push(`t.deadline BETWEEN ${P(now() - DAY)} AND ${P(now() + DAY)}`);
  else if (due === 'week') cond.push(`t.deadline BETWEEN ${P(now())} AND ${P(now() + 7 * DAY)}`);
  else if (due === 'none') cond.push('t.deadline IS NULL');

  // Son yenilənmə.
  const upd = num(u.get('updatedSince'));
  if (upd) cond.push(`COALESCE(t.updated_at, t.created_at) >= ${P(upd)}`);

  // Axtarış — başlıq, təsvir, açar.
  const q = clampStr(u.get('q') || '', 80).trim();
  if (q) {
    const like = '%' + q.toLowerCase() + '%';
    cond.push(`(LOWER(t.title) LIKE ${P(like)} OR LOWER(COALESCE(t.description,'')) LIKE ${P(like)}
                OR LOWER(COALESCE(t.task_key,'')) LIKE ${P(like)})`);
  }

  const sort = SORTS[u.get('sort') || ''] ? String(u.get('sort')) : 'manual';
  return { where: cond.join(' AND '), vals, order: SORTS[sort], sort };
}

/* ═══════════════════════ SİYAHI ═══════════════════════ */

const PAGE = 60;
/** Kanban sütunu başına gətirilən maksimum kart. */
const COL_PAGE = 25;

const SELECT_TASK = `
  SELECT t.*, p.name AS project_name, p.team_id,
         tm.slug AS team_slug, tm.name AS team_name,
         s.name AS sprint_name,
         u.username AS assignee_username, u.name AS assignee_name, u.photo_url AS assignee_photo,
         (SELECT COUNT(*) FROM team_tasks c2 WHERE c2.parent_id = t.id) AS subtask_count,
         (SELECT GROUP_CONCAT(l.label_id) FROM task_label_links l WHERE l.task_id = t.id) AS label_ids
    FROM team_tasks t
    JOIN team_projects p ON p.id = t.project_id
    JOIN teams tm ON tm.id = p.team_id
    LEFT JOIN sprints s ON s.id = t.sprint_id
    LEFT JOIN users u ON u.id = t.assignee_id`;

/**
 * Tapşırıq siyahısı — bütün görünüşlərin ORTAQ mənbəyi.
 *
 * ⚠ NİYƏ TƏK ENDPOINT: Kanban, siyahı, cədvəl, təqvim, timeline və Gantt
 *   EYNİ datanı fərqli çəkir. Altı ayrı endpoint yazsaydıq, filtr məntiqi
 *   altı yerdə təkrarlanardı və biri unudulanda həmin görünüş başqasının
 *   tapşırığını göstərə bilərdi (görünürlük qapısı!).
 *
 * `group=status` verildikdə cavab Kanban üçün sütunlara bölünür və HƏR
 * sütun ayrıca limitlə gəlir — 2000 tapşırıqlı komandada tək siyahı
 * brauzeri dondurardı.
 */
export async function wsTasks(c: Ctx) {
  const u = c.url.searchParams;
  const f = buildFilters(c, u);
  const limit = Math.min(Math.max(parseInt(u.get('limit') || '', 10) || PAGE, 5), 200);

  if (u.get('group') === 'status') {
    // Sütun-sütun: hər status üçün ayrıca limit.
    const cols = await Promise.all(WS_BOARD.map(async st => {
      const r = await D(c).prepare(
        `${SELECT_TASK} WHERE ${f.where} AND t.status = ?${f.vals.length + 1}
          ORDER BY ${f.order} LIMIT ${COL_PAGE + 1}`,
      ).bind(...f.vals, st).all<any>();
      const rows = r.results;
      const hasMore = rows.length > COL_PAGE;
      return { status: st, tasks: rows.slice(0, COL_PAGE).map(mapTask), hasMore };
    }));
    // Sütun başlıqlarındakı TAM say — səhifələnmiş sayla qarışdırılmamalıdır.
    const counts = await D(c).prepare(
      `SELECT t.status AS st, COUNT(*) AS n FROM team_tasks t
         JOIN team_projects p ON p.id = t.project_id
        WHERE ${f.where} GROUP BY t.status`,
    ).bind(...f.vals).all<any>();
    const total: Record<string, number> = {};
    counts.results.forEach((x: any) => { total[String(x.st)] = num(x.n); });
    return json({ columns: cols, totals: total, sort: f.sort });
  }

  const offset = Math.max(0, parseInt(u.get('offset') || '0', 10) || 0);
  const rows = await D(c).prepare(
    `${SELECT_TASK} WHERE ${f.where} ORDER BY ${f.order} LIMIT ${limit + 1} OFFSET ${offset}`,
  ).bind(...f.vals).all<any>();
  const hasMore = rows.results.length > limit;
  return json({
    tasks: rows.results.slice(0, limit).map(mapTask),
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
    sort: f.sort,
  });
}

/* ═══════════════════════ XÜLASƏ KARTLARI ═══════════════════════ */

/**
 * İdarə paneli göstəriciləri — TƏK sorğuda şərti toplama.
 *
 * ⚠ 13 ayrı `COUNT(*)` 13 tam skan olardı (kataloq və profil ilə eyni dərs).
 */
export async function wsStats(c: Ctx) {
  const me = c.user!.id;
  const DAY = 86_400_000;
  const dayStart = Math.floor(now() / DAY) * DAY;
  const weekAgo = now() - 7 * DAY;

  const row = await D(c).prepare(
    `SELECT
       COUNT(*)                                                            AS total,
       SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END)                  AS done,
       SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END)           AS progress,
       SUM(CASE WHEN t.status IN ('Review','Testing') THEN 1 ELSE 0 END)   AS review,
       SUM(CASE WHEN t.status = 'Blocked' THEN 1 ELSE 0 END)               AS blocked,
       SUM(CASE WHEN t.deadline IS NOT NULL AND t.deadline < ?2
                 AND t.status != 'Done' THEN 1 ELSE 0 END)                 AS overdue,
       SUM(CASE WHEN t.priority IN ('Critical','Urgent','High')
                 AND t.status != 'Done' THEN 1 ELSE 0 END)                 AS high,
       SUM(CASE WHEN t.assignee_id = ?1 AND t.status != 'Done' THEN 1 ELSE 0 END) AS mine,
       SUM(CASE WHEN t.created_at >= ?3 THEN 1 ELSE 0 END)                 AS createdToday,
       SUM(CASE WHEN t.completed_at >= ?3 THEN 1 ELSE 0 END)               AS doneToday,
       SUM(CASE WHEN t.completed_at >= ?4 THEN 1 ELSE 0 END)               AS doneWeek,
       COALESCE(SUM(t.spent_minutes), 0)                                   AS spent
     FROM team_tasks t
     JOIN team_projects p ON p.id = t.project_id
    WHERE ${scopedWhere('t', 1)} AND t.archived_at IS NULL`,
  ).bind(me, now(), dayStart, weekAgo).first<any>();

  const total = num(row?.total);
  const done = num(row?.done);
  return json({
    total, done,
    progress: num(row?.progress), review: num(row?.review), blocked: num(row?.blocked),
    overdue: num(row?.overdue), high: num(row?.high), mine: num(row?.mine),
    createdToday: num(row?.createdToday), doneToday: num(row?.doneToday),
    doneWeek: num(row?.doneWeek), spentMinutes: num(row?.spent),
    // ⚠ Faiz SERVERDƏ hesablanır: client-də təkrarlansaydı yuvarlaqlaşdırma
    //   fərqi ilə kartda 67%, qrafikdə 66% görünə bilərdi.
    completionRate: total ? Math.round((done / total) * 100) : 0,
  });
}

/**
 * Son 7 günün gündəlik bölgüsü — kartlardakı mini qrafik üçün.
 *
 * ⚠ Boş günlər SERVERDƏ doldurulur: SQL yalnız mövcud günləri qaytarır və
 *   client onları sıra ilə çəksəydi, fəaliyyətsiz gün sadəcə YOX olardı və
 *   qrafik yalan tendensiya göstərərdi.
 */
export async function wsTrend(c: Ctx) {
  const DAY = 86_400_000;
  const from = Math.floor((now() - 6 * DAY) / DAY) * DAY;
  const rows = await D(c).prepare(
    `SELECT CAST(t.completed_at / ${DAY} AS INTEGER) AS d, COUNT(*) AS n
       FROM team_tasks t JOIN team_projects p ON p.id = t.project_id
      WHERE ${scopedWhere('t', 1)} AND t.completed_at >= ?2
      GROUP BY d ORDER BY d`,
  ).bind(c.user!.id, from).all<any>();

  const map = new Map<number, number>();
  rows.results.forEach((r: any) => map.set(num(r.d), num(r.n)));
  const days: Array<{ ts: number; n: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const ts = Math.floor((now() - i * DAY) / DAY);
    days.push({ ts: ts * DAY, n: map.get(ts) || 0 });
  }
  return json({ days });
}

/* ═══════════════════════ META (filtr mənbələri) ═══════════════════════ */

/**
 * Filtr panelinin bütün seçimləri — TƏK sorğuda.
 *
 * ⚠ Komanda/layihə/sprint/etiket/üzv ayrı-ayrı çağırılsaydı, filtr panelini
 *   açmaq 5 gediş-gəliş olardı.
 */
export async function wsMeta(c: Ctx) {
  const me = c.user!.id;
  const [teams, projects, sprints, labels, members, views] = await D(c).batch<any>([
    D(c).prepare(
      `SELECT t.id, t.name, t.slug FROM teams t
         JOIN team_members m ON m.team_id = t.id
        WHERE m.user_id = ?1 AND m.status = 'active' AND t.status = 'active'
        ORDER BY t.name`,
    ).bind(me),
    D(c).prepare(
      `SELECT p.id, p.name, p.team_id, p.status FROM team_projects p
         JOIN team_members m ON m.team_id = p.team_id
        WHERE m.user_id = ?1 AND m.status = 'active' AND p.status != 'deleted'
        ORDER BY p.name`,
    ).bind(me),
    D(c).prepare(
      `SELECT s.* FROM sprints s
         JOIN team_members m ON m.team_id = s.team_id
        WHERE m.user_id = ?1 AND m.status = 'active'
        ORDER BY s.starts_at DESC LIMIT 40`,
    ).bind(me),
    D(c).prepare(
      `SELECT l.* FROM task_labels l
         JOIN team_members m ON m.team_id = l.team_id
        WHERE m.user_id = ?1 AND m.status = 'active'
        ORDER BY l.name`,
    ).bind(me),
    // ⚠ Üzvlər YALNIZ mənim komandalarımdan — kənar istifadəçi siyahısı
    //   filtr panelində görünməməlidir (məlumat sızması).
    D(c).prepare(
      `SELECT DISTINCT u.id, u.username, u.name, u.photo_url
         FROM team_members m2
         JOIN users u ON u.id = m2.user_id
        WHERE m2.status = 'active' AND m2.team_id IN (
                SELECT team_id FROM team_members WHERE user_id = ?1 AND status = 'active')
        ORDER BY u.name LIMIT 200`,
    ).bind(me),
    D(c).prepare('SELECT * FROM task_saved_views WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 30').bind(me),
  ]);

  return json({
    teams: teams.results,
    projects: projects.results.map((p: any) => ({ id: p.id, name: p.name, teamId: p.team_id, status: p.status })),
    sprints: sprints.results.map((s: any) => ({
      id: s.id, teamId: s.team_id, name: s.name, goal: s.goal,
      startsAt: num(s.starts_at), endsAt: num(s.ends_at), status: s.status,
    })),
    labels: labels.results.map((l: any) => ({ id: l.id, teamId: l.team_id, name: l.name, color: l.color })),
    members: members.results.map((m: any) => ({
      uid: m.id, username: m.username, name: m.name, photoURL: m.photo_url,
    })),
    savedViews: views.results.map((v: any) => ({ id: v.id, name: v.name, query: v.query })),
    statuses: WS_STATUSES, board: WS_BOARD, priorities: WS_PRIORITIES,
    labelColors: WS_LABEL_COLORS,
  });
}
