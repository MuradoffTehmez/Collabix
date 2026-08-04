// İş sahəsi — tapşırıq üzərində əməliyyatlar (yaratma, redaktə, detal).
//
// ⚠ OXU YOLU `routes/workspace.ts`-dədir. Bölünmə səbəbi: orada filtr/sorğu
//   məntiqi, burada mutasiyalar və detal panelinin blokları var — ikisi bir
//   faylda 1200 sətri keçirdi (`AUDIT-TASK-10 / Faza 3.1` naxışı).
//
// 🔴 STATUS/TƏYİNAT DƏYİŞİKLİYİ BURADA HESABLANMIR — `TeamTaskService`-ə
//    ÖTÜRÜLÜR. Orada XP müqaviləsi var: "Done OLMAYAN → Done" keçidində XP
//    verilir, geri açılanda `compensateXp` ilə alınır və `UNIQUE` indekslər
//    dövrəni bağlayır (AUDIT-TASK-9 / 9.0). Bu məntiqi burada TƏKRARLASAYDIQ,
//    iki yol ayrılan kimi "Done → To Do → Done" XP fabrikinə çevrilərdi.
import { Ctx, json, err, readJson, clampStr, uuid, now } from '../util';
import { D, badReq, notify } from './shared';
import { requireTeamPermission, requireTeamMember } from '../middleware/team-auth';
import { scopedWhere, WS_STATUSES, WS_PRIORITIES } from './workspace';

const num = (v: unknown) => Number(v) || 0;
const pick = (v: unknown, list: readonly string[], fb: string) => {
  const s = String(v ?? '').trim().toLowerCase();
  return list.find(x => x.toLowerCase() === s) || fb;
};

/* ═══════════════════════ GÖRÜNÜRLÜK + İCAZƏ ═══════════════════════ */

/** Tapşırıq + komanda konteksti — GÖRÜNÜRLÜK QAPISINDAN keçir. */
export async function taskFor(c: Ctx, taskId: string) {
  return D(c).prepare(
    `SELECT t.*, p.name AS project_name, p.team_id,
            tm.slug AS team_slug, tm.name AS team_name
       FROM team_tasks t
       JOIN team_projects p ON p.id = t.project_id
       JOIN teams tm ON tm.id = p.team_id
      WHERE t.id = ?1 AND ${scopedWhere('t', 2)}`,
  ).bind(taskId, c.user!.id).first<any>();
}

/**
 * Yazma icazəsi.
 *
 * 🔴 İKİ SƏVİYYƏ, QƏSDƏN:
 *    • `own`    — İŞİN GEDİŞİ: status, sıra, yoxlama siyahısı, şərh, vaxt.
 *                 KOMANDA ÜZVLÜYÜ kifayətdir.
 *    • `manage` — PLANLAMA: başlıq, təyinat, prioritet, sprint, son tarix,
 *                 arxiv, silinmə. `manage_tasks` icazəsi tələb olunur.
 *
 * 🔴 DÜZƏLİŞ — `own` ƏVVƏL YALNIZ TƏYİN OLUNANA/YARADANA icazə verirdi və
 *    əks halda `manage_tasks`-a düşürdü. Nəticə: LÖVHƏ İŞLƏMİRDİ. Təyin
 *    olunmamış kart (`assignee_id IS NULL`) və miqrasiyadan əvvəlki kartlar
 *    (`created_by IS NULL`) sıravi üzv üçün SÜRÜŞDÜRÜLƏ BİLMİRDİ — hər
 *    buraxma 403 verirdi. Kanban-ın bütün mənası kartı hərəkət etdirməkdir;
 *    Linear/Jira-da da bunun üçün ayrıca icazə tələb olunmur.
 *
 *    Planlama sahələri isə `manage_tasks`-da QALIR: kimin nə üzərində
 *    işlədiyini təyin etmək idarəetmə qərarıdır.
 */
async function canWrite(c: Ctx, task: any, level: 'own' | 'manage') {
  if (level === 'own') return requireTeamMember(c, String(task.team_id));
  return requireTeamPermission(c, String(task.team_id), 'manage_tasks');
}

/** Fəaliyyət jurnalına sətir — fail-soft. */
async function logAct(c: Ctx, taskId: string, kind: string, detail = '') {
  try {
    await D(c).prepare(
      `INSERT INTO task_activity (id, task_id, actor_id, kind, detail, created_at)
       VALUES (?,?,?,?,?,?)`,
    ).bind(uuid(), taskId, c.user!.id, kind, clampStr(detail, 300), now()).run();
  } catch { /* jurnal bəzəkdir — əməliyyatı çökdürməməlidir */ }
}

/* ═══════════════════════ YARATMA ═══════════════════════ */

/** Layihə açarından tapşırıq açarı: "Mobil App" → "MOB-7". */
async function nextKey(c: Ctx, projectId: string, projectName: string): Promise<string> {
  const prefix = String(projectName || 'TSK').replace(/[^A-Za-zƏÖÜÇŞĞıİ]/g, '')
    .slice(0, 3).toUpperCase() || 'TSK';
  const row = await D(c).prepare(
    'SELECT COUNT(*) AS n FROM team_tasks WHERE project_id = ?',
  ).bind(projectId).first<any>();
  return `${prefix}-${num(row?.n) + 1}`;
}

export async function wsCreate(c: Ctx) {
  const b = await readJson(c.req);
  const projectId = clampStr(b.projectId, 40).trim();
  const title = clampStr(b.title, 200).trim();
  if (!projectId || !title) return badReq('Layihə və başlıq məcburidir.');

  // Layihə mənim komandamdadırmı? (görünürlük qapısının yaratma variantı)
  const proj = await D(c).prepare(
    `SELECT p.id, p.name, p.team_id FROM team_projects p
       JOIN team_members m ON m.team_id = p.team_id
      WHERE p.id = ?1 AND m.user_id = ?2 AND m.status = 'active' AND p.status != 'deleted'`,
  ).bind(projectId, c.user!.id).first<any>();
  if (!proj) return err('Layihə tapılmadı.', 404, 'project_not_found');

  const denied = await requireTeamMember(c, String(proj.team_id));
  if (denied) return denied;

  const id = uuid();
  const status = pick(b.status, WS_STATUSES, 'To Do');
  const priority = pick(b.priority, WS_PRIORITIES, 'Medium');
  // ⚠ Yeni kart sütunun BAŞINA düşür: `MIN(position) - 1`. Sona qoysaydıq
  //   istifadəçi hər dəfə aşağı sürüşməli olardı.
  const posRow = await D(c).prepare(
    'SELECT COALESCE(MIN(position), 0) AS p FROM team_tasks WHERE project_id = ? AND status = ?',
  ).bind(projectId, status).first<any>();

  await D(c).prepare(
    `INSERT INTO team_tasks
       (id, project_id, assignee_id, title, description, priority, status, deadline,
        estimated_minutes, start_date, sprint_id, parent_id, task_key, position,
        created_by, created_at, recurrence)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)`,
  ).bind(
    id, projectId, clampStr(b.assigneeId, 40) || null, title,
    clampStr(b.description || '', 5000), priority, status,
    num(b.deadline) || null, num(b.estimatedMinutes) || null,
    num(b.startDate) || null, clampStr(b.sprintId, 40) || null,
    clampStr(b.parentId, 40) || null, await nextKey(c, projectId, proj.name),
    Number(posRow?.p || 0) - 1, c.user!.id, now(), clampStr(b.recurrence || '', 40),
  ).run();

  // Yaradan avtomatik izləyicidir — öz tapşırığının hərəkətini görməlidir.
  await D(c).prepare(
    'INSERT OR IGNORE INTO task_watchers (task_id, user_id, created_at) VALUES (?,?,?)',
  ).bind(id, c.user!.id, now()).run();
  await logAct(c, id, 'created', title);

  if (b.assigneeId && String(b.assigneeId) !== c.user!.id) {
    await notify(c, String(b.assigneeId), 'team_task', 'sənə tapşırıq təyin etdi: ' + title);
  }
  const row = await taskFor(c, id);
  return json({ task: row ? { id: row.id, key: row.task_key } : { id } });
}

/* ═══════════════════════ REDAKTƏ ═══════════════════════ */

/**
 * Tapşırığın yenilənməsi.
 *
 * ⚠ İKİ HİSSƏYƏ BÖLÜNÜR:
 *   1. KÖHNƏ sahələr (`title`, `status`, `priority`, `assignee`, `deadline`,
 *      `estimatedHours`) → `TeamTaskService.updateTask` — XP müqaviləsi orada.
 *   2. YENİ sahələr (sprint, position, parent, start_date, arxiv, dəqiqə
 *      təxmini) → burada, çünki servis onları tanımır.
 */
export async function wsUpdate(c: Ctx, taskId: string) {
  const task = await taskFor(c, taskId);
  if (!task) return err('Tapşırıq tapılmadı.', 404, 'task_not_found');
  const b = await readJson(c.req);

  // Planlama sahələri daha yüksək icazə tələb edir.
  const planFields = ['title', 'assigneeId', 'priority', 'sprintId', 'parentId', 'deadline', 'startDate', 'archived'];
  const level: 'own' | 'manage' = planFields.some(k => k in b) ? 'manage' : 'own';
  const denied = await canWrite(c, task, level);
  if (denied) return denied;

  /* ── 1. Köhnə yol (XP müqaviləsi) ───────────────────────────────── */
  const legacy: Record<string, unknown> = {};
  if ('title' in b) legacy.title = clampStr(b.title, 200);
  if ('description' in b) legacy.description = clampStr(b.description, 5000);
  if ('priority' in b) legacy.priority = pick(b.priority, WS_PRIORITIES, task.priority);
  if ('assigneeId' in b) legacy.assigneeId = clampStr(b.assigneeId, 40) || null;
  if ('deadline' in b) legacy.deadline = num(b.deadline) || null;
  if ('status' in b) legacy.status = pick(b.status, WS_STATUSES, task.status);

  let statusChanged = false;
  if (Object.keys(legacy).length) {
    const { TeamTaskService } = await import('../services/team/task.service');
    const svc = new TeamTaskService(c.env);
    // ⚠ Servis yalnız 4 statusu tanıyır (`To Do`…`Done`); yeni statuslar onun
    //   `normStatus` süzgəcindən keçməz və SÜKUTLA köhnə dəyərə qayıdardı.
    //   Ona görə status YALNIZ köhnə çoxluqdadırsa servisə verilir, əks halda
    //   birbaşa yazılır (XP yalnız `Done` keçidinə bağlıdır və o, köhnə
    //   çoxluqdadır — yəni müqavilə pozulmur).
    const LEGACY_ST = ['To Do', 'In Progress', 'Review', 'Done'];
    const st = legacy.status as string | undefined;
    if (st && !LEGACY_ST.includes(st)) {
      delete legacy.status;
      await D(c).prepare('UPDATE team_tasks SET status = ?, updated_at = ? WHERE id = ?')
        .bind(st, now(), taskId).run();
      statusChanged = st !== task.status;
    }
    if (Object.keys(legacy).length) {
      const res = await svc.updateTask(taskId, legacy as any);
      statusChanged = statusChanged || !!res?.statusChanged;
    }
    if (st) {
      // `completed_at` servisin bilmədiyi sütundur.
      await D(c).prepare(
        `UPDATE team_tasks SET completed_at = CASE WHEN status = 'Done' THEN COALESCE(completed_at, ?1) ELSE NULL END
          WHERE id = ?2`,
      ).bind(now(), taskId).run();
    }
  }

  /* ── 2. Yeni sahələr ────────────────────────────────────────────── */
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { sets.push(`${col} = ?${vals.length + 1}`); vals.push(v); };
  if ('sprintId' in b) set('sprint_id', clampStr(b.sprintId, 40) || null);
  if ('startDate' in b) set('start_date', num(b.startDate) || null);
  if ('estimatedMinutes' in b) set('estimated_minutes', num(b.estimatedMinutes) || null);
  if ('recurrence' in b) set('recurrence', clampStr(b.recurrence || '', 40));
  if ('position' in b) set('position', Number(b.position) || 0);
  if ('archived' in b) set('archived_at', b.archived ? now() : null);
  if ('parentId' in b) {
    const pid = clampStr(b.parentId, 40) || null;
    // 🔴 ÖZ-ÖZÜNƏ VALİDEYNLİK BAĞLANIR: `parent_id = id` alt-tapşırıq ağacını
    //    sonsuz döngüyə salardı (detal paneli rekursiv açır).
    if (pid && pid === taskId) return badReq('Tapşırıq öz valideyni ola bilməz.');
    set('parent_id', pid);
  }
  if (sets.length) {
    vals.push(now(), taskId);
    await D(c).prepare(
      `UPDATE team_tasks SET ${sets.join(', ')}, updated_at = ?${vals.length - 1} WHERE id = ?${vals.length}`,
    ).bind(...vals).run();
  }

  if (statusChanged) await logAct(c, taskId, 'status', String(b.status || ''));
  if ('assigneeId' in b) {
    await logAct(c, taskId, 'assignee', String(b.assigneeId || ''));
    if (b.assigneeId && String(b.assigneeId) !== c.user!.id) {
      await notify(c, String(b.assigneeId), 'team_task', 'sənə tapşırıq təyin etdi: ' + task.title);
    }
  }

  // İzləyicilərə bildiriş — status dəyişikliyi işin gedişidir.
  if (statusChanged) await notifyWatchers(c, taskId, task.title, String(b.status || ''));
  return json({ ok: true });
}

/**
 * İzləyicilərə status bildirişi.
 *
 * ⚠ DƏYİŞİKLİYİ EDƏN İSTİSNA OLUNUR: öz hərəkətindən bildiriş almaq
 *   bildiriş mərkəzini mənasız doldurur.
 */
async function notifyWatchers(c: Ctx, taskId: string, title: string, status: string) {
  const rows = await D(c).prepare(
    'SELECT user_id FROM task_watchers WHERE task_id = ? AND user_id != ? LIMIT 20',
  ).bind(taskId, c.user!.id).all<any>();
  for (const r of rows.results) {
    await notify(c, String(r.user_id), 'team_task', `«${title}» → ${status}`);
  }
}

/* ═══════════════════════ TOPLU ƏMƏLİYYAT ═══════════════════════ */

/** Bir sorğuda toxunula bilən maksimum tapşırıq. */
const BULK_MAX = 100;

/**
 * Toplu status/prioritet/təyinat/arxiv/silinmə.
 *
 * 🔴 HƏR SƏTİR AYRICA İCAZƏ YOXLAMASINDAN KEÇİR. "Seçilmişlərin hamısı mənim
 *    komandamdadır" fərziyyəsi YANLIŞ olardı: id-lər client-dən gəlir və
 *    hücumçu ora yad tapşırıq qoya bilər.
 */
export async function wsBulk(c: Ctx) {
  const b = await readJson(c.req);
  const ids = Array.isArray(b.ids) ? b.ids.slice(0, BULK_MAX).map((x: unknown) => String(x)) : [];
  const op = String(b.op || '');
  if (!ids.length) return badReq('Tapşırıq seçilməyib.');

  let ok = 0;
  for (const id of ids) {
    const task = await taskFor(c, id);
    if (!task) continue;
    const level: 'own' | 'manage' = op === 'status' ? 'own' : 'manage';
    if (await canWrite(c, task, level)) continue;   // icazəsiz sətir SÜKUTLA atlanır

    if (op === 'status') {
      const st = pick(b.value, WS_STATUSES, task.status);
      await D(c).prepare(
        `UPDATE team_tasks SET status = ?1, updated_at = ?2,
           completed_at = CASE WHEN ?1 = 'Done' THEN COALESCE(completed_at, ?2) ELSE NULL END
         WHERE id = ?3`,
      ).bind(st, now(), id).run();
      await logAct(c, id, 'status', st);
    } else if (op === 'priority') {
      await D(c).prepare('UPDATE team_tasks SET priority = ?, updated_at = ? WHERE id = ?')
        .bind(pick(b.value, WS_PRIORITIES, task.priority), now(), id).run();
    } else if (op === 'assign') {
      await D(c).prepare('UPDATE team_tasks SET assignee_id = ?, updated_at = ? WHERE id = ?')
        .bind(clampStr(b.value, 40) || null, now(), id).run();
    } else if (op === 'sprint') {
      await D(c).prepare('UPDATE team_tasks SET sprint_id = ?, updated_at = ? WHERE id = ?')
        .bind(clampStr(b.value, 40) || null, now(), id).run();
    } else if (op === 'archive') {
      await D(c).prepare('UPDATE team_tasks SET archived_at = ?, updated_at = ? WHERE id = ?')
        .bind(b.value ? now() : null, now(), id).run();
    } else if (op === 'delete') {
      await D(c).prepare("UPDATE team_tasks SET status = 'Deleted', updated_at = ? WHERE id = ?")
        .bind(now(), id).run();
    } else {
      return badReq('Naməlum əməliyyat.');
    }
    ok++;
  }
  return json({ ok: true, affected: ok });
}

/* ═══════════════════════ SÜRÜŞDÜRMƏ (drag & drop) ═══════════════════════ */

/**
 * Kanban sürüşdürməsi — status + sıra bir əməliyyatda.
 *
 * ⚠ SIRA ORTA ƏDƏDLƏ verilir (`(prev + next) / 2`), bütün sütun yenidən
 *   nömrələnmir. 1000 kartlı sütunda yenidən nömrələmə 1000 UPDATE olardı.
 *
 * ⚠ Client `prevPos`/`nextPos` göndərir, çünki sıralamanı O GÖRÜR. Server
 *   onları YOXLAMIR — sıra təhlükəsizlik məsələsi deyil; status isə ağ
 *   siyahıdan keçir.
 */
export async function wsMove(c: Ctx, taskId: string) {
  const task = await taskFor(c, taskId);
  if (!task) return err('Tapşırıq tapılmadı.', 404, 'task_not_found');
  const denied = await canWrite(c, task, 'own');
  if (denied) return denied;

  const b = await readJson(c.req);
  const st = pick(b.status, WS_STATUSES, task.status);
  const prev = b.prevPos === null || b.prevPos === undefined ? null : Number(b.prevPos);
  const next = b.nextPos === null || b.nextPos === undefined ? null : Number(b.nextPos);
  let pos: number;
  if (prev === null && next === null) pos = now();          // boş sütun
  else if (prev === null) pos = (next as number) - 1;        // ən başa
  else if (next === null) pos = (prev as number) + 1;        // ən sona
  else pos = ((prev as number) + (next as number)) / 2;

  await D(c).prepare(
    `UPDATE team_tasks SET status = ?1, position = ?2, updated_at = ?3,
       completed_at = CASE WHEN ?1 = 'Done' THEN COALESCE(completed_at, ?3) ELSE NULL END
     WHERE id = ?4`,
  ).bind(st, pos, now(), taskId).run();

  if (st !== task.status) {
    await logAct(c, taskId, 'status', st);
    await notifyWatchers(c, taskId, task.title, st);
    // XP: yalnız `Done` keçidi. Sürüşdürmə də tamamlanma sayılır.
    if (st === 'Done' && task.status !== 'Done' && task.assignee_id) {
      const { grantXp } = await import('../xp');
      const { USER_TASK_XP } = await import('../services/team/xp');
      await grantXp(c.env, String(task.assignee_id), 'team_task', taskId, USER_TASK_XP,
        { alsoCompletedTask: true });
    }
  }
  return json({ ok: true, position: pos, status: st });
}

/* ═══════════════════════ DETAL ═══════════════════════ */

/**
 * Detal panelinin bütün blokları — TƏK `batch()`.
 *
 * ⚠ Ayrı-ayrı çağırılsaydı panelin açılışı 8 gediş-gəliş olardı və hər blok
 *   müxtəlif anda "sıçrayaraq" görünərdi.
 */
export async function wsDetail(c: Ctx, taskId: string) {
  const task = await taskFor(c, taskId);
  if (!task) return err('Tapşırıq tapılmadı.', 404, 'task_not_found');

  const [checks, comments, attach, deps, blocking, watchers, acts, times, subs] =
    await D(c).batch<any>([
      D(c).prepare('SELECT * FROM task_checklist WHERE task_id = ?1 ORDER BY position, created_at').bind(taskId),
      D(c).prepare(
        `SELECT k.*, u.username, u.name AS author_name, u.photo_url
           FROM task_comments k LEFT JOIN users u ON u.id = k.author_id
          WHERE k.task_id = ?1 ORDER BY k.created_at`,
      ).bind(taskId),
      D(c).prepare('SELECT * FROM task_attachments WHERE task_id = ?1 ORDER BY created_at DESC').bind(taskId),
      D(c).prepare(
        `SELECT d.depends_on_id AS id, d.kind, t.title, t.status, t.task_key
           FROM task_dependencies d JOIN team_tasks t ON t.id = d.depends_on_id
          WHERE d.task_id = ?1`,
      ).bind(taskId),
      D(c).prepare(
        `SELECT d.task_id AS id, d.kind, t.title, t.status, t.task_key
           FROM task_dependencies d JOIN team_tasks t ON t.id = d.task_id
          WHERE d.depends_on_id = ?1`,
      ).bind(taskId),
      D(c).prepare(
        `SELECT w.user_id, u.username, u.name, u.photo_url
           FROM task_watchers w LEFT JOIN users u ON u.id = w.user_id
          WHERE w.task_id = ?1`,
      ).bind(taskId),
      D(c).prepare(
        `SELECT a.*, u.username, u.name AS actor_name
           FROM task_activity a LEFT JOIN users u ON u.id = a.actor_id
          WHERE a.task_id = ?1 ORDER BY a.created_at DESC LIMIT 40`,
      ).bind(taskId),
      D(c).prepare(
        `SELECT l.*, u.username FROM task_time_logs l
           LEFT JOIN users u ON u.id = l.user_id
          WHERE l.task_id = ?1 ORDER BY l.started_at DESC LIMIT 30`,
      ).bind(taskId),
      D(c).prepare(
        `SELECT id, task_key, title, status, priority, assignee_id
           FROM team_tasks WHERE parent_id = ?1 AND status != 'Deleted' ORDER BY position`,
      ).bind(taskId),
    ]);

  const labels = await D(c).prepare(
    `SELECT l.id, l.name, l.color FROM task_label_links k
       JOIN task_labels l ON l.id = k.label_id WHERE k.task_id = ?1`,
  ).bind(taskId).all<any>();

  return json({
    task: {
      id: task.id, key: task.task_key || '', title: task.title,
      description: task.description || '', status: task.status,
      priority: task.priority || 'Medium',
      projectId: task.project_id, projectName: task.project_name,
      teamId: task.team_id, teamSlug: task.team_slug, teamName: task.team_name,
      sprintId: task.sprint_id || null, parentId: task.parent_id || null,
      assigneeId: task.assignee_id || null, createdBy: task.created_by || null,
      startDate: task.start_date || null, deadline: task.deadline || null,
      estimatedMinutes: task.estimated_minutes ?? null,
      spentMinutes: num(task.spent_minutes),
      recurrence: task.recurrence || '',
      createdAt: num(task.created_at), updatedAt: task.updated_at || null,
      completedAt: task.completed_at || null, archivedAt: task.archived_at || null,
    },
    labels: labels.results,
    checklist: checks.results.map((x: any) => ({
      id: x.id, text: x.text, done: !!x.done, parentId: x.parent_id || null,
      position: Number(x.position) || 0,
    })),
    comments: comments.results.map((x: any) => ({
      id: x.id, text: x.text, authorId: x.author_id, authorName: x.author_name || x.username || '',
      username: x.username || '', photoURL: x.photo_url || '', parentId: x.parent_id || null,
      createdAt: num(x.created_at), editedAt: x.edited_at || null,
    })),
    attachments: attach.results.map((x: any) => ({
      id: x.id, name: x.name, size: num(x.size), mime: x.mime,
      url: '/files/' + x.r2_key, createdAt: num(x.created_at),
    })),
    dependsOn: deps.results,
    blocks: blocking.results,
    watchers: watchers.results.map((x: any) => ({
      uid: x.user_id, username: x.username, name: x.name, photoURL: x.photo_url,
    })),
    subtasks: subs.results,
    activity: acts.results.map((x: any) => ({
      id: x.id, kind: x.kind, detail: x.detail, actorName: x.actor_name || x.username || '',
      createdAt: num(x.created_at),
    })),
    timeLogs: times.results.map((x: any) => ({
      id: x.id, minutes: num(x.minutes), startedAt: num(x.started_at),
      endedAt: x.ended_at || null, note: x.note || '', username: x.username || '',
    })),
  });
}
