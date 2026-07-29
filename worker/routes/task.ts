// Tapşırıq və şikayət domeni — AUDIT-TASK-10 / Faza 3.1.
import { Ctx, json, err, readJson, uuid, now, clampStr, mapTask, mapSubmission } from '../util';
import { grantXp } from '../xp';
import { grantReputation, evaluateProgression } from '../progression';
import { logAdmin } from '../admin-log';
import { D, badReq, notify, bumpActivity, bumpProgress, SOLUTION_XP } from './shared';

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
    // FAZA A2 / PRD §8 — təsdiqlənmiş həll "Accepted Answer" mənbəyidir.
    c.ctx.waitUntil((async () => {
      await grantReputation(c.env, uid, 'accepted_answer', `${taskId}:${uid}`);
      await evaluateProgression(c.env, uid);
    })());
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

