// İş sahəsi — tapşırığın alt-resursları: yoxlama siyahısı, şərh, asılılıq,
// izləyici, vaxt jurnalı, etiket, sprint, saxlanılmış görünüş, avtomatlaşdırma.
//
// ⚠ ÜÇÜNCÜ FAYL: `workspace.ts` (oxu) və `workspace-task.ts` (mutasiya)
//   onsuz da böyükdür. Bölünmə meyarı RESURSDUR, təsadüfi deyil — burada
//   hamısı "tapşırığa BAĞLI" obyektlərdir və hamısı eyni icazə qapısından
//   keçir (`taskFor` → görünürlük, `canEdit` → yazma).
import { Ctx, json, err, readJson, clampStr, uuid, now } from '../util';
import { D, badReq, notify } from './shared';
import { requireTeamPermission, requireTeamMember } from '../middleware/team-auth';
import { WS_LABEL_COLORS } from './workspace';
import { taskFor } from './workspace-task';

const num = (v: unknown) => Number(v) || 0;

/** Tapşırıq üzərində "işin gedişi" səviyyəli yazma icazəsi. */
async function canEdit(c: Ctx, task: any) {
  const me = c.user!.id;
  if (String(task.assignee_id || '') === me || String(task.created_by || '') === me) {
    return requireTeamMember(c, String(task.team_id));
  }
  return requireTeamMember(c, String(task.team_id));
}

/** Görünən tapşırıq + icazə — hər alt-resurs eyni giriş yolundan keçir. */
async function gate(c: Ctx, taskId: string) {
  const task = await taskFor(c, taskId);
  if (!task) return { task: null, resp: err('Tapşırıq tapılmadı.', 404, 'task_not_found') };
  const denied = await canEdit(c, task);
  return { task, resp: denied };
}

async function logAct(c: Ctx, taskId: string, kind: string, detail = '') {
  try {
    await D(c).prepare(
      'INSERT INTO task_activity (id, task_id, actor_id, kind, detail, created_at) VALUES (?,?,?,?,?,?)',
    ).bind(uuid(), taskId, c.user!.id, kind, clampStr(detail, 300), now()).run();
  } catch { /* jurnal bəzəkdir */ }
}

/* ═══════════════════════ YOXLAMA SİYAHISI ═══════════════════════ */

/**
 * Sayğacları yenidən hesablayır.
 *
 * ⚠ HƏR DƏYİŞİKLİKDƏN SONRA ÇAĞIRILIR. Artımlı (+1/−1) saysaydıq, silinmə
 *   və toplu əməliyyatlarda sürüşmə yaranardı; siyahı kiçikdir (onlarla
 *   bənd), ona görə tam sayma ucuzdur və HƏMİŞƏ doğrudur.
 */
async function syncChecklist(c: Ctx, taskId: string) {
  await D(c).prepare(
    `UPDATE team_tasks SET
       check_total = (SELECT COUNT(*) FROM task_checklist WHERE task_id = ?1),
       check_done  = (SELECT COUNT(*) FROM task_checklist WHERE task_id = ?1 AND done = 1)
     WHERE id = ?1`,
  ).bind(taskId).run();
}

export async function wsCheckAdd(c: Ctx, taskId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const b = await readJson(c.req);
  const text = clampStr(b.text, 300).trim();
  if (!text) return badReq('Mətn boşdur.');
  const row = await D(c).prepare(
    'SELECT COALESCE(MAX(position), 0) AS p FROM task_checklist WHERE task_id = ?',
  ).bind(taskId).first<any>();
  const id = uuid();
  await D(c).prepare(
    `INSERT INTO task_checklist (id, task_id, parent_id, text, done, position, created_at)
     VALUES (?,?,?,?,0,?,?)`,
  ).bind(id, taskId, clampStr(b.parentId, 40) || null, text, Number(row?.p || 0) + 1, now()).run();
  await syncChecklist(c, taskId);
  return json({ id });
}

export async function wsCheckPatch(c: Ctx, taskId: string, itemId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const b = await readJson(c.req);
  if ('done' in b) {
    await D(c).prepare('UPDATE task_checklist SET done = ? WHERE id = ? AND task_id = ?')
      .bind(b.done ? 1 : 0, itemId, taskId).run();
  }
  if ('text' in b) {
    await D(c).prepare('UPDATE task_checklist SET text = ? WHERE id = ? AND task_id = ?')
      .bind(clampStr(b.text, 300), itemId, taskId).run();
  }
  await syncChecklist(c, taskId);
  return json({ ok: true });
}

export async function wsCheckDelete(c: Ctx, taskId: string, itemId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  // ⚠ Uşaq bəndlər də silinir — FK yoxdur (SQLite ALTER məhdudiyyəti),
  //   ona görə təmizləmə açıq yazılır. Əks halda onlar YETİM qalardı.
  await D(c).prepare('DELETE FROM task_checklist WHERE task_id = ? AND (id = ? OR parent_id = ?)')
    .bind(taskId, itemId, itemId).run();
  await syncChecklist(c, taskId);
  return json({ ok: true });
}

/* ═══════════════════════ ŞƏRHLƏR ═══════════════════════ */

const syncComments = (c: Ctx, taskId: string) => D(c).prepare(
  'UPDATE team_tasks SET comment_count = (SELECT COUNT(*) FROM task_comments WHERE task_id = ?1) WHERE id = ?1',
).bind(taskId).run();

export async function wsCommentAdd(c: Ctx, taskId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const b = await readJson(c.req);
  const text = clampStr(b.text, 4000).trim();
  if (!text) return badReq('Şərh boşdur.');
  const id = uuid();
  await D(c).prepare(
    'INSERT INTO task_comments (id, task_id, author_id, parent_id, text, created_at) VALUES (?,?,?,?,?,?)',
  ).bind(id, taskId, c.user!.id, clampStr(b.parentId, 40) || null, text, now()).run();
  await syncComments(c, taskId);
  await logAct(c, taskId, 'comment', text.slice(0, 80));

  // Şərh yazan avtomatik izləyiciyə çevrilir — söhbətin davamını görməlidir.
  await D(c).prepare('INSERT OR IGNORE INTO task_watchers (task_id, user_id, created_at) VALUES (?,?,?)')
    .bind(taskId, c.user!.id, now()).run();

  const rows = await D(c).prepare(
    'SELECT user_id FROM task_watchers WHERE task_id = ? AND user_id != ? LIMIT 20',
  ).bind(taskId, c.user!.id).all<any>();
  for (const r of rows.results) {
    await notify(c, String(r.user_id), 'team_task', `«${g.task.title}» şərh: ` + text.slice(0, 60));
  }
  return json({ id });
}

export async function wsCommentPatch(c: Ctx, taskId: string, cid: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const b = await readJson(c.req);
  // 🔴 YALNIZ MÜƏLLİF: `task_id` şərti kifayət etmir — komandadakı hər kəs
  //    başqasının şərhini redaktə edə bilərdi.
  const res = await D(c).prepare(
    'UPDATE task_comments SET text = ?, edited_at = ? WHERE id = ? AND task_id = ? AND author_id = ?',
  ).bind(clampStr(b.text, 4000), now(), cid, taskId, c.user!.id).run();
  if (!(res.meta?.changes ?? 0)) return err('Yalnız müəllif redaktə edə bilər.', 403, 'not_author');
  return json({ ok: true });
}

export async function wsCommentDelete(c: Ctx, taskId: string, cid: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  // Müəllif, yaxud `manage_tasks` icazəsi olan (moderasiya).
  const own = await D(c).prepare('SELECT author_id FROM task_comments WHERE id = ? AND task_id = ?')
    .bind(cid, taskId).first<any>();
  if (!own) return err('Şərh tapılmadı.', 404, 'comment_not_found');
  if (String(own.author_id) !== c.user!.id) {
    const denied = await requireTeamPermission(c, String(g.task.team_id), 'manage_tasks');
    if (denied) return denied;
  }
  await D(c).prepare('DELETE FROM task_comments WHERE id = ? AND task_id = ?').bind(cid, taskId).run();
  await syncComments(c, taskId);
  return json({ ok: true });
}

/* ═══════════════════════ ASILILIQLAR ═══════════════════════ */

/**
 * Asılılıq əlavəsi — DÖVR YOXLAMASI İLƏ.
 *
 * 🔴 A→B→A dövrü Gantt-ın kritik yol hesablamasını sonsuz döngüyə salır və
 *    "nə vaxt bitər?" sualını cavabsız qoyur. SQLite `CHECK` ilə rekursiv
 *    yoxlama mümkün olmadığı üçün qapı BURADADIR.
 *
 * ⚠ Dərinlik həddi (`MAX_DEPTH`) var: pozulmuş data (əl ilə yazılmış dövr)
 *   halında belə axtarış dayanır.
 */
const MAX_DEPTH = 40;

async function createsCycle(c: Ctx, taskId: string, dependsOn: string): Promise<boolean> {
  if (taskId === dependsOn) return true;
  // `dependsOn`-dan başlayıb onun asılılıqlarını gəzirik: `taskId`-yə
  // çatırıqsa, yeni kənar dövrə bağlayır.
  let frontier = [dependsOn];
  const seen = new Set<string>([dependsOn]);
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const ph = frontier.map((_, i) => '?' + (i + 1)).join(',');
    const rows = await D(c).prepare(
      `SELECT depends_on_id FROM task_dependencies WHERE task_id IN (${ph})`,
    ).bind(...frontier).all<any>();
    const next: string[] = [];
    for (const r of rows.results) {
      const id = String(r.depends_on_id);
      if (id === taskId) return true;
      if (!seen.has(id)) { seen.add(id); next.push(id); }
    }
    frontier = next.slice(0, 100);
  }
  return false;
}

export async function wsDepAdd(c: Ctx, taskId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const b = await readJson(c.req);
  const dep = clampStr(b.dependsOnId, 40).trim();
  if (!dep) return badReq('Asılılıq seçilməyib.');
  // Hədəf də GÖRÜNƏN olmalıdır — əks halda yad tapşırığın mövcudluğu sızardı.
  const other = await taskFor(c, dep);
  if (!other) return err('Tapşırıq tapılmadı.', 404, 'task_not_found');
  if (await createsCycle(c, taskId, dep)) return badReq('Bu asılılıq dövrə yaradır.');

  await D(c).prepare(
    'INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id, kind, created_at) VALUES (?,?,?,?)',
  ).bind(taskId, dep, clampStr(b.kind || 'blocks', 20), now()).run();
  await logAct(c, taskId, 'dependency', other.title);
  return json({ ok: true });
}

export async function wsDepDelete(c: Ctx, taskId: string, depId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  await D(c).prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
    .bind(taskId, depId).run();
  return json({ ok: true });
}

/* ═══════════════════════ İZLƏYİCİLƏR ═══════════════════════ */

export async function wsWatch(c: Ctx, taskId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const me = c.user!.id;
  const has = await D(c).prepare('SELECT 1 AS x FROM task_watchers WHERE task_id = ? AND user_id = ?')
    .bind(taskId, me).first<any>();
  if (has) {
    await D(c).prepare('DELETE FROM task_watchers WHERE task_id = ? AND user_id = ?').bind(taskId, me).run();
    return json({ watching: false });
  }
  await D(c).prepare('INSERT OR IGNORE INTO task_watchers (task_id, user_id, created_at) VALUES (?,?,?)')
    .bind(taskId, me, now()).run();
  return json({ watching: true });
}

/* ═══════════════════════ VAXT İZLƏMƏ ═══════════════════════ */

const syncSpent = (c: Ctx, taskId: string) => D(c).prepare(
  `UPDATE team_tasks SET spent_minutes =
     (SELECT COALESCE(SUM(minutes), 0) FROM task_time_logs WHERE task_id = ?1) WHERE id = ?1`,
).bind(taskId).run();

/**
 * Taymeri başladır.
 *
 * 🔴 İSTİFADƏÇİ BAŞINA BİR AÇIQ SESSİYA (`ux_timelog_open` qismi unikal
 *    indeksi). İki tapşırıqda eyni anda taymer işləsəydi, eyni dəqiqələr iki
 *    yerə yazılardı və "sərf olunan vaxt" cəmi real günü aşardı.
 *    Ona görə yeni taymer əvvəlkini AVTOMATİK bağlayır.
 */
export async function wsTimerStart(c: Ctx, taskId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const me = c.user!.id;

  const open = await D(c).prepare(
    'SELECT id, task_id, started_at FROM task_time_logs WHERE user_id = ? AND ended_at IS NULL',
  ).bind(me).first<any>();
  if (open) {
    const mins = Math.max(0, Math.round((now() - num(open.started_at)) / 60000));
    await D(c).prepare('UPDATE task_time_logs SET ended_at = ?, minutes = ? WHERE id = ?')
      .bind(now(), mins, open.id).run();
    await syncSpent(c, String(open.task_id));
    if (String(open.task_id) === taskId) return json({ running: false, minutes: mins });
  }

  const id = uuid();
  await D(c).prepare(
    'INSERT INTO task_time_logs (id, task_id, user_id, minutes, started_at, note) VALUES (?,?,?,0,?,?)',
  ).bind(id, taskId, me, now(), '').run();
  return json({ running: true, id });
}

export async function wsTimerStop(c: Ctx, taskId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const open = await D(c).prepare(
    'SELECT id, started_at FROM task_time_logs WHERE user_id = ? AND task_id = ? AND ended_at IS NULL',
  ).bind(c.user!.id, taskId).first<any>();
  if (!open) return json({ running: false, minutes: 0 });
  const mins = Math.max(0, Math.round((now() - num(open.started_at)) / 60000));
  await D(c).prepare('UPDATE task_time_logs SET ended_at = ?, minutes = ? WHERE id = ?')
    .bind(now(), mins, open.id).run();
  await syncSpent(c, taskId);
  await logAct(c, taskId, 'time', mins + ' dəq');
  return json({ running: false, minutes: mins });
}

/** Əl ilə vaxt yazılışı — taymer unudulanda lazımdır. */
export async function wsTimeAdd(c: Ctx, taskId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const b = await readJson(c.req);
  const mins = Math.max(1, Math.min(24 * 60, num(b.minutes)));
  await D(c).prepare(
    'INSERT INTO task_time_logs (id, task_id, user_id, minutes, started_at, ended_at, note) VALUES (?,?,?,?,?,?,?)',
  ).bind(uuid(), taskId, c.user!.id, mins, now(), now(), clampStr(b.note || '', 200)).run();
  await syncSpent(c, taskId);
  await logAct(c, taskId, 'time', mins + ' dəq');
  return json({ ok: true });
}

/** İşləyən taymer — səhifə açılışında bərpa üçün. */
export async function wsTimerActive(c: Ctx) {
  const row = await D(c).prepare(
    `SELECT l.id, l.task_id, l.started_at, t.title, t.task_key
       FROM task_time_logs l JOIN team_tasks t ON t.id = l.task_id
      WHERE l.user_id = ? AND l.ended_at IS NULL`,
  ).bind(c.user!.id).first<any>();
  return json(row
    ? { running: true, taskId: row.task_id, title: row.title, key: row.task_key, startedAt: num(row.started_at) }
    : { running: false });
}

/* ═══════════════════════ ETİKETLƏR ═══════════════════════ */

export async function wsLabelCreate(c: Ctx) {
  const b = await readJson(c.req);
  const teamId = clampStr(b.teamId, 40).trim();
  const name = clampStr(b.name, 40).trim();
  if (!teamId || !name) return badReq('Komanda və ad məcburidir.');
  const denied = await requireTeamPermission(c, teamId, 'manage_tasks');
  if (denied) return denied;
  const color = (WS_LABEL_COLORS as readonly string[]).includes(String(b.color)) ? String(b.color) : 'slate';
  const id = uuid();
  try {
    await D(c).prepare('INSERT INTO task_labels (id, team_id, name, color, created_at) VALUES (?,?,?,?,?)')
      .bind(id, teamId, name, color, now()).run();
  } catch {
    // `ux_task_labels` (team_id, name) — eyni ad təkrarlana bilməz.
    return badReq('Bu adda etiket artıq var.');
  }
  return json({ id, name, color, teamId });
}

export async function wsLabelDelete(c: Ctx, labelId: string) {
  const row = await D(c).prepare('SELECT team_id FROM task_labels WHERE id = ?').bind(labelId).first<any>();
  if (!row) return err('Etiket tapılmadı.', 404, 'label_not_found');
  const denied = await requireTeamPermission(c, String(row.team_id), 'manage_tasks');
  if (denied) return denied;
  await D(c).batch([
    D(c).prepare('DELETE FROM task_label_links WHERE label_id = ?').bind(labelId),
    D(c).prepare('DELETE FROM task_labels WHERE id = ?').bind(labelId),
  ]);
  return json({ ok: true });
}

/** Tapşırığa etiket bağla/ayır. */
export async function wsLabelToggle(c: Ctx, taskId: string) {
  const g = await gate(c, taskId);
  if (g.resp) return g.resp;
  const b = await readJson(c.req);
  const labelId = clampStr(b.labelId, 40).trim();
  // ⚠ Etiket EYNİ komandadan olmalıdır — başqa komandanın etiketi burada
  //   görünməz nişan kimi qalardı və filtr onu tapmazdı.
  const lab = await D(c).prepare('SELECT id FROM task_labels WHERE id = ? AND team_id = ?')
    .bind(labelId, g.task.team_id).first<any>();
  if (!lab) return err('Etiket tapılmadı.', 404, 'label_not_found');

  const has = await D(c).prepare('SELECT 1 AS x FROM task_label_links WHERE task_id = ? AND label_id = ?')
    .bind(taskId, labelId).first<any>();
  if (has) {
    await D(c).prepare('DELETE FROM task_label_links WHERE task_id = ? AND label_id = ?')
      .bind(taskId, labelId).run();
    return json({ attached: false });
  }
  await D(c).prepare('INSERT OR IGNORE INTO task_label_links (task_id, label_id) VALUES (?,?)')
    .bind(taskId, labelId).run();
  return json({ attached: true });
}

/* ═══════════════════════ SPRINTLƏR ═══════════════════════ */

export async function wsSprintCreate(c: Ctx) {
  const b = await readJson(c.req);
  const teamId = clampStr(b.teamId, 40).trim();
  const name = clampStr(b.name, 80).trim();
  if (!teamId || !name) return badReq('Komanda və ad məcburidir.');
  const denied = await requireTeamPermission(c, teamId, 'manage_tasks');
  if (denied) return denied;
  const starts = num(b.startsAt) || now();
  const ends = num(b.endsAt) || (starts + 14 * 86400000);
  if (ends <= starts) return badReq('Bitmə tarixi başlanğıcdan sonra olmalıdır.');
  const id = uuid();
  await D(c).prepare(
    `INSERT INTO sprints (id, team_id, name, goal, starts_at, ends_at, status, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).bind(id, teamId, name, clampStr(b.goal || '', 300), starts, ends,
    ['planned', 'active', 'completed'].includes(String(b.status)) ? String(b.status) : 'planned',
    c.user!.id, now()).run();
  return json({ id });
}

export async function wsSprintPatch(c: Ctx, sprintId: string) {
  const row = await D(c).prepare('SELECT team_id FROM sprints WHERE id = ?').bind(sprintId).first<any>();
  if (!row) return err('Sprint tapılmadı.', 404, 'sprint_not_found');
  const denied = await requireTeamPermission(c, String(row.team_id), 'manage_tasks');
  if (denied) return denied;
  const b = await readJson(c.req);
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { sets.push(`${col} = ?${vals.length + 1}`); vals.push(v); };
  if ('name' in b) set('name', clampStr(b.name, 80));
  if ('goal' in b) set('goal', clampStr(b.goal, 300));
  if ('startsAt' in b) set('starts_at', num(b.startsAt));
  if ('endsAt' in b) set('ends_at', num(b.endsAt));
  if ('status' in b && ['planned', 'active', 'completed'].includes(String(b.status))) set('status', String(b.status));
  if (!sets.length) return badReq('Dəyişiklik yoxdur.');
  vals.push(sprintId);
  await D(c).prepare(`UPDATE sprints SET ${sets.join(', ')} WHERE id = ?${vals.length}`).bind(...vals).run();
  return json({ ok: true });
}

export async function wsSprintDelete(c: Ctx, sprintId: string) {
  const row = await D(c).prepare('SELECT team_id FROM sprints WHERE id = ?').bind(sprintId).first<any>();
  if (!row) return err('Sprint tapılmadı.', 404, 'sprint_not_found');
  const denied = await requireTeamPermission(c, String(row.team_id), 'manage_tasks');
  if (denied) return denied;
  // ⚠ Tapşırıqlar SİLİNMİR, sadəcə sprintdən çıxarılır — sprint planlama
  //   qabıdır, işin özü deyil.
  await D(c).batch([
    D(c).prepare('UPDATE team_tasks SET sprint_id = NULL WHERE sprint_id = ?').bind(sprintId),
    D(c).prepare('DELETE FROM sprints WHERE id = ?').bind(sprintId),
  ]);
  return json({ ok: true });
}

/* ═══════════════════════ SAXLANILMIŞ GÖRÜNÜŞLƏR ═══════════════════════ */

export async function wsViewSave(c: Ctx) {
  const b = await readJson(c.req);
  const name = clampStr(b.name, 60).trim();
  if (!name) return badReq('Ad boşdur.');
  const id = uuid();
  await D(c).prepare(
    'INSERT INTO task_saved_views (id, user_id, name, query, created_at) VALUES (?,?,?,?,?)',
  ).bind(id, c.user!.id, name, clampStr(b.query || '', 600), now()).run();
  return json({ id, name, query: clampStr(b.query || '', 600) });
}

export async function wsViewDelete(c: Ctx, viewId: string) {
  // `user_id` şərti sahiblik yoxlamasıdır — başqasının görünüşü silinə bilməz.
  await D(c).prepare('DELETE FROM task_saved_views WHERE id = ? AND user_id = ?')
    .bind(viewId, c.user!.id).run();
  return json({ ok: true });
}

/* ═══════════════════════ AVTOMATLAŞDIRMA ═══════════════════════ */

const AUTO_TRIGGERS = ['created', 'status_changed', 'due_soon'];

export async function wsAutomationList(c: Ctx) {
  const rows = await D(c).prepare(
    `SELECT a.* FROM task_automations a
       JOIN team_members m ON m.team_id = a.team_id
      WHERE m.user_id = ?1 AND m.status = 'active'
      ORDER BY a.created_at DESC LIMIT 60`,
  ).bind(c.user!.id).all<any>();
  return json({
    rules: rows.results.map((r: any) => ({
      id: r.id, teamId: r.team_id, name: r.name, trigger: r.trigger,
      conditions: r.conditions, actions: r.actions, enabled: !!r.enabled,
    })),
  });
}

export async function wsAutomationCreate(c: Ctx) {
  const b = await readJson(c.req);
  const teamId = clampStr(b.teamId, 40).trim();
  const name = clampStr(b.name, 80).trim();
  if (!teamId || !name) return badReq('Komanda və ad məcburidir.');
  if (!AUTO_TRIGGERS.includes(String(b.trigger))) return badReq('Naməlum tetikləyici.');
  const denied = await requireTeamPermission(c, teamId, 'manage_tasks');
  if (denied) return denied;
  const id = uuid();
  await D(c).prepare(
    `INSERT INTO task_automations (id, team_id, name, trigger, conditions, actions, enabled, created_by, created_at)
     VALUES (?,?,?,?,?,?,1,?,?)`,
  ).bind(id, teamId, name, String(b.trigger),
    clampStr(JSON.stringify(b.conditions || {}), 1000),
    clampStr(JSON.stringify(b.actions || {}), 1000), c.user!.id, now()).run();
  return json({ id });
}

export async function wsAutomationDelete(c: Ctx, ruleId: string) {
  const row = await D(c).prepare('SELECT team_id FROM task_automations WHERE id = ?').bind(ruleId).first<any>();
  if (!row) return err('Qayda tapılmadı.', 404, 'rule_not_found');
  const denied = await requireTeamPermission(c, String(row.team_id), 'manage_tasks');
  if (denied) return denied;
  await D(c).prepare('DELETE FROM task_automations WHERE id = ?').bind(ruleId).run();
  return json({ ok: true });
}
