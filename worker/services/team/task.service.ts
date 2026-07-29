import { Env, uuid, now, clampStr } from '../../util';
import { taskXpFor, USER_TASK_XP } from './xp';
import { grantXp, compensateXp } from '../../xp';

export const TASK_STATUSES = ['To Do', 'In Progress', 'Review', 'Done'] as const;
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

function normStatus(v: unknown, fallback = 'To Do'): string {
  const s = String(v || '').trim().toLowerCase();
  return (TASK_STATUSES as readonly string[]).find(x => x.toLowerCase() === s) || fallback;
}
function normPriority(v: unknown, fallback = 'Medium'): string {
  const s = String(v || '').trim().toLowerCase();
  return (TASK_PRIORITIES as readonly string[]).find(x => x.toLowerCase() === s) || fallback;
}

export interface TaskUpdateResult {
  task: any;
  statusChanged: boolean;
  justCompleted: boolean;
  reopened: boolean;
  /** Bu keçiddə komandaya yazılacaq XP (0 = XP yoxdur). */
  teamXp: number;
  assigneeId: string | null;
}

export class TeamTaskService {
  constructor(private env: Env) {}

  async createTask(
    projectId: string, title: string, description?: string,
    assigneeId?: string, priority: string = 'Medium',
    estimatedHours?: number, deadline?: number,
  ) {
    const id = uuid();
    await this.env.DB.prepare(
      `INSERT INTO team_tasks (id, project_id, assignee_id, title, description, priority, status, deadline, estimated_hours, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'To Do', ?, ?, ?)`
    ).bind(
      id, projectId, assigneeId || null, clampStr(title, 200), clampStr(description || '', 5000),
      normPriority(priority), deadline || null, estimatedHours || null, now(),
    ).run();
    return id;
  }

  async getTasks(teamId: string, filters: { projectId?: string; status?: string; assigneeId?: string } = {}) {
    const { results } = await this.env.DB.prepare(
      `SELECT t.*, p.name AS project_name, p.team_id,
              u.username AS assignee_username, u.name AS assignee_name, u.photo_url AS assignee_photo
         FROM team_tasks t
         JOIN team_projects p ON t.project_id = p.id
         LEFT JOIN users u ON t.assignee_id = u.id
        WHERE p.team_id = ? AND t.status != 'Deleted' AND p.status != 'deleted'
          AND (? IS NULL OR t.project_id = ?)
          AND (? IS NULL OR t.status = ?)
          AND (? IS NULL OR t.assignee_id = ?)
        ORDER BY t.created_at DESC`
    ).bind(
      teamId,
      filters.projectId ?? null, filters.projectId ?? null,
      filters.status ?? null, filters.status ?? null,
      filters.assigneeId ?? null, filters.assigneeId ?? null,
    ).all<any>();
    return results;
  }

  async getTask(taskId: string) {
    return this.env.DB.prepare(
      `SELECT t.*, p.team_id FROM team_tasks t
         JOIN team_projects p ON t.project_id = p.id
        WHERE t.id = ?`
    ).bind(taskId).first<any>();
  }

  /**
   * Tapşırığın yenilənməsi.
   *
   * XP yalnız "Done OLMAYAN → Done" KEÇİDİNDƏ verilir. Əvvəl hər `status=Done`
   * PATCH-i XP əlavə edirdi — eyni tapşırığı təkrar-təkrar "Done" etməklə
   * limitsiz XP toplamaq mümkün idi.
   */
  async updateTask(
    taskId: string,
    updates: {
      title?: string; description?: string; priority?: string; status?: string;
      assigneeId?: string | null; estimatedHours?: number; deadline?: number;
    },
  ): Promise<TaskUpdateResult | null> {
    const before = await this.getTask(taskId);
    if (!before) return null;

    const sets: string[] = [];
    const values: any[] = [];
    if (updates.title !== undefined) { sets.push('title = ?'); values.push(clampStr(updates.title, 200)); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(clampStr(updates.description, 5000)); }
    if (updates.priority !== undefined) { sets.push('priority = ?'); values.push(normPriority(updates.priority, before.priority)); }
    if (updates.status !== undefined) { sets.push('status = ?'); values.push(normStatus(updates.status, before.status)); }
    if (updates.assigneeId !== undefined) { sets.push('assignee_id = ?'); values.push(updates.assigneeId || null); }
    if (updates.estimatedHours !== undefined) { sets.push('estimated_hours = ?'); values.push(updates.estimatedHours); }
    if (updates.deadline !== undefined) { sets.push('deadline = ?'); values.push(updates.deadline || null); }

    if (!sets.length) {
      return { task: before, statusChanged: false, justCompleted: false, reopened: false, teamXp: 0, assigneeId: before.assignee_id || null };
    }

    // D-1: audit sütunu. `teams.updated_at` ilə eyni naxış — hər
    // uğurlu UPDATE-də yenilənir, əks halda sütun boş qalar və
    // "nə vaxt dəyişdi" sualına cavab verməz.
    sets.push('updated_at = ?');
    values.push(now(), taskId);
    await this.env.DB.prepare(`UPDATE team_tasks SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

    const after = await this.getTask(taskId);
    const wasDone = before.status === 'Done';
    const isDone = after?.status === 'Done';
    const justCompleted = !wasDone && isDone;
    const reopened = wasDone && !isDone;

    // 🔴 AUDIT-TASK-9 / 9.0-Sual 3: audit XP verilən 4 yer sadalayırdı, faktiki
    // say 7-dir — BU İKİSİ SADALANMAMIŞDI. Task 2 §5.2 və Task 3 §8/6 dərsi
    // ("öz sayğacınla təsdiqlə") burada da özünü doğrultdu.
    if (justCompleted && after?.assignee_id) {
      await grantXp(this.env, String(after.assignee_id), 'team_task', taskId, USER_TASK_XP,
        { alsoCompletedTask: true });
    } else if (reopened && before.assignee_id) {
      // "Done → To Do → Done" dövrü XP fabrikinə çevrilməsin.
      //
      // ⚠ `compensateXp` kompensasiya sətrini `UNIQUE(uid,'compensation',taskId)`
      //   ilə yazır. Yəni bir tapşırıq üzrə XP yalnız BİR DƏFƏ geri alına bilər,
      //   `grantXp` isə `UNIQUE(uid,'team_task',taskId)` ilə yalnız bir dəfə
      //   verə bilər → dövrə hər iki istiqamətdə bağlıdır.
      const back = await compensateXp(this.env, String(before.assignee_id), 'team_task', taskId);
      if (back > 0) {
        await this.env.DB.prepare(
          'UPDATE users SET tasks_completed = MAX(0, tasks_completed - 1) WHERE id = ?'
        ).bind(before.assignee_id).run();
      }
    }

    return {
      task: after,
      statusChanged: before.status !== after?.status,
      justCompleted,
      reopened,
      teamXp: justCompleted ? taskXpFor(after) : (reopened ? -taskXpFor(before) : 0),
      assigneeId: after?.assignee_id || null,
    };
  }

  async deleteTask(taskId: string) {
    const task = await this.getTask(taskId);
    if (!task) return null;
    await this.env.DB.prepare("UPDATE team_tasks SET status = 'Deleted' WHERE id = ?").bind(taskId).run();
    return task;
  }
}
