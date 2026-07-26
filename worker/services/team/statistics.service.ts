import { Env, now } from '../../util';
import { reputationFor } from './team.service';

export interface TeamStats {
  membersCount: number;
  projectsCount: number;
  activeProjectsCount: number;
  completedProjectsCount: number;
  tasksCount: number;
  completedTasksCount: number;
  openTasksCount: number;
  postsCount: number;
  filesCount: number;
  filesBytes: number;
  activityCount: number;
  xp: number;
  reputation: string;
  nextTier: string | null;
  nextAt: number | null;
  tierProgress: number;
  growth30d: number;
  newMembers30d: number;
  completionRate: number;
  daily: { day: string; count: number }[];
  topContributors: { user_id: string; username: string; name: string; done: number }[];
}

/**
 * PDR "Team Statistics" bölməsi: Members, Projects, Tasks, Completed Tasks,
 * XP, Activity, Reputation, Growth. (Commits → TASK-12 GitHub inteqrasiyası.)
 *
 * Bütün sayğaclar TƏK `batch()` ilə gedir — əvvəl route içində ayrıca inline
 * SQL var idi və bu servis heç istifadə olunmurdu (iki mənbədən eyni rəqəm).
 */
export class TeamStatisticsService {
  constructor(private env: Env) {}

  async getStatistics(teamId: string): Promise<TeamStats> {
    const since30 = now() - 30 * 86400000;
    const D = this.env.DB;

    const res = await D.batch([
      D.prepare('SELECT COUNT(*) AS c FROM team_members WHERE team_id = ?').bind(teamId),
      D.prepare("SELECT COUNT(*) AS c FROM team_projects WHERE team_id = ? AND status != 'deleted'").bind(teamId),
      D.prepare("SELECT COUNT(*) AS c FROM team_projects WHERE team_id = ? AND status = 'active'").bind(teamId),
      D.prepare("SELECT COUNT(*) AS c FROM team_projects WHERE team_id = ? AND status = 'completed'").bind(teamId),
      D.prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) AS completed
           FROM team_tasks t JOIN team_projects p ON t.project_id = p.id
          WHERE p.team_id = ? AND t.status != 'Deleted'`
      ).bind(teamId),
      D.prepare('SELECT COUNT(*) AS c FROM team_posts WHERE team_id = ?').bind(teamId),
      D.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(size), 0) AS bytes FROM team_files WHERE team_id = ?').bind(teamId),
      D.prepare('SELECT COUNT(*) AS c FROM team_activity WHERE team_id = ?').bind(teamId),
      D.prepare('SELECT COUNT(*) AS c FROM team_activity WHERE team_id = ? AND created_at >= ?').bind(teamId, since30),
      D.prepare('SELECT COUNT(*) AS c FROM team_members WHERE team_id = ? AND joined_at >= ?').bind(teamId, since30),
      D.prepare('SELECT xp FROM teams WHERE id = ?').bind(teamId),
      D.prepare(
        `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS count
           FROM team_activity WHERE team_id = ? AND created_at >= ?
          GROUP BY day ORDER BY day ASC`
      ).bind(teamId, since30),
      D.prepare(
        `SELECT u.id AS user_id, u.username, u.name, COUNT(*) AS done
           FROM team_tasks t
           JOIN team_projects p ON t.project_id = p.id
           JOIN users u ON t.assignee_id = u.id
          WHERE p.team_id = ? AND t.status = 'Done'
          GROUP BY u.id ORDER BY done DESC LIMIT 5`
      ).bind(teamId),
    ]);

    const n = (i: number, key = 'c') => Number((res[i].results[0] as any)?.[key] || 0);
    const tasksRow = res[4].results[0] as any;
    const tasksCount = Number(tasksRow?.total || 0);
    const completedTasksCount = Number(tasksRow?.completed || 0);
    const xp = n(10, 'xp');
    const rep = reputationFor(xp);

    return {
      membersCount: n(0),
      projectsCount: n(1),
      activeProjectsCount: n(2),
      completedProjectsCount: n(3),
      tasksCount,
      completedTasksCount,
      openTasksCount: Math.max(0, tasksCount - completedTasksCount),
      postsCount: n(5),
      filesCount: n(6),
      filesBytes: n(6, 'bytes'),
      activityCount: n(7),
      xp,
      reputation: rep.tier,
      nextTier: rep.nextTier,
      nextAt: rep.nextAt,
      tierProgress: rep.progress,
      growth30d: n(8),
      newMembers30d: n(9),
      completionRate: tasksCount ? Math.round((completedTasksCount / tasksCount) * 100) : 0,
      daily: (res[11].results as any[]).map(r => ({ day: String(r.day), count: Number(r.count) })),
      topContributors: (res[12].results as any[]).map(r => ({
        user_id: String(r.user_id), username: String(r.username),
        name: String(r.name || r.username), done: Number(r.done),
      })),
    };
  }
}
