import { Env, uuid, now, clampStr } from '../../util';
import { normalizeVisibility } from './team.service';

export const PROJECT_STATUSES = ['active', 'paused', 'completed', 'deleted'] as const;

function normProjectStatus(v: unknown, fallback = 'active'): string {
  const s = String(v || '').trim().toLowerCase();
  return (PROJECT_STATUSES as readonly string[]).includes(s) ? s : fallback;
}

export class TeamProjectService {
  constructor(private env: Env) {}

  async createProject(teamId: string, createdBy: string, name: string, description?: string, visibility = 'Private') {
    const id = uuid();
    const roomId = uuid();
    const roomName = `project-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`.slice(0, 60);

    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO team_projects (id, team_id, name, description, status, visibility, created_by, created_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
      ).bind(id, teamId, clampStr(name, 120), clampStr(description || '', 2000), normalizeVisibility(visibility), createdBy, now()),
      this.env.DB.prepare(
        'INSERT INTO team_project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
      ).bind(id, createdBy, 'Admin', now()),
      // `rooms` sətri OLMADAN `team_chat_rooms` yazılırsa mesaj API-si həmin
      // otaq üçün 404 verir — əvvəl layihə otaqları məhz belə yaradılırdı.
      this.env.DB.prepare('INSERT INTO rooms (id, name, created_by, created_at) VALUES (?, ?, ?, ?)')
        .bind(roomId, roomName, createdBy, now()),
      this.env.DB.prepare(
        "INSERT INTO team_chat_rooms (id, team_id, name, type, created_at) VALUES (?, ?, ?, 'Project', ?)"
      ).bind(roomId, teamId, roomName, now()),
    ]);
    return id;
  }

  /**
   * Layihə siyahısı — üzvlük və admin bayraqları TƏK sorğuda hesablanır.
   * Əvvəl hər layihə üçün ayrıca `getProjectMembers` çağırılırdı (N+1).
   */
  async getProjectsFor(teamId: string, userId: string) {
    const { results } = await this.env.DB.prepare(
      `SELECT p.*,
              (SELECT COUNT(*) FROM team_project_members pm WHERE pm.project_id = p.id) AS members_count,
              (SELECT COUNT(*) FROM team_tasks t WHERE t.project_id = p.id AND t.status != 'Deleted') AS tasks_count,
              (SELECT COUNT(*) FROM team_tasks t WHERE t.project_id = p.id AND t.status = 'Done') AS tasks_done,
              (SELECT COUNT(*) FROM team_project_requests r WHERE r.project_id = p.id AND r.status = 'Pending') AS pending_requests,
              EXISTS(SELECT 1 FROM team_project_members m WHERE m.project_id = p.id AND m.user_id = ?) AS is_member,
              EXISTS(SELECT 1 FROM team_project_members m WHERE m.project_id = p.id AND m.user_id = ? AND m.role = 'Admin') AS is_project_admin,
              EXISTS(SELECT 1 FROM team_project_requests r WHERE r.project_id = p.id AND r.user_id = ? AND r.status = 'Pending') AS has_pending_request
         FROM team_projects p
        WHERE p.team_id = ? AND p.status != 'deleted'
        ORDER BY p.created_at DESC`
    ).bind(userId, userId, userId, teamId).all<any>();
    return results;
  }

  async getProjects(teamId: string) {
    const { results } = await this.env.DB
      .prepare("SELECT * FROM team_projects WHERE team_id = ? AND status != 'deleted' ORDER BY created_at DESC")
      .bind(teamId).all<any>();
    return results;
  }

  async getProject(projectId: string) {
    return this.env.DB
      .prepare("SELECT * FROM team_projects WHERE id = ? AND status != 'deleted'")
      .bind(projectId).first<any>();
  }

  /** `justCompleted` → komandaya +100 XP (PDR: Project Finished). */
  async updateProject(
    projectId: string,
    updates: { name?: string; description?: string; visibility?: string; status?: string },
  ) {
    const before = await this.getProject(projectId);
    if (!before) return null;

    const sets: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) { sets.push('name = ?'); values.push(clampStr(updates.name, 120)); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(clampStr(updates.description, 2000)); }
    if (updates.visibility !== undefined) { sets.push('visibility = ?'); values.push(normalizeVisibility(updates.visibility)); }
    if (updates.status !== undefined) { sets.push('status = ?'); values.push(normProjectStatus(updates.status, before.status)); }
    if (!sets.length) return { project: before, justCompleted: false };

    // D-1: audit sütunu. `teams.updated_at` ilə eyni naxış — hər
    // uğurlu UPDATE-də yenilənir, əks halda sütun boş qalar və
    // "nə vaxt dəyişdi" sualına cavab verməz.
    sets.push('updated_at = ?');
    values.push(now(), projectId);
    await this.env.DB.prepare(`UPDATE team_projects SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

    const after = await this.getProject(projectId);
    return {
      project: after,
      justCompleted: before.status !== 'completed' && after?.status === 'completed',
    };
  }

  async deleteProject(projectId: string) {
    const project = await this.getProject(projectId);
    if (!project) return null;
    await this.env.DB.batch([
      this.env.DB.prepare("UPDATE team_projects SET status = 'deleted' WHERE id = ?").bind(projectId),
      // Layihə silinəndə açıq tapşırıqlar da arxivə düşməlidir, əks halda
      // komanda tapşırıq siyahısında "yetim" sətirlər qalır.
      this.env.DB.prepare("UPDATE team_tasks SET status = 'Deleted' WHERE project_id = ? AND status != 'Deleted'").bind(projectId),
    ]);
    return project;
  }

  async applyToProject(projectId: string, userId: string) {
    const existing = await this.env.DB
      .prepare("SELECT id FROM team_project_requests WHERE project_id = ? AND user_id = ? AND status = 'Pending'")
      .bind(projectId, userId).first<any>();
    if (existing) throw new Error('Sorğunuz artıq göndərilib');

    const member = await this.env.DB
      .prepare('SELECT 1 AS x FROM team_project_members WHERE project_id = ? AND user_id = ?')
      .bind(projectId, userId).first<any>();
    if (member) throw new Error('Siz artıq bu layihənin üzvüsünüz');

    const id = uuid();
    await this.env.DB.prepare(
      "INSERT INTO team_project_requests (id, project_id, user_id, status, created_at) VALUES (?, ?, ?, 'Pending', ?)"
    ).bind(id, projectId, userId, now()).run();
    return id;
  }

  async getProjectRequests(projectId: string) {
    const { results } = await this.env.DB.prepare(
      `SELECT r.*, u.username, u.name, u.photo_url
         FROM team_project_requests r
         JOIN users u ON r.user_id = u.id
        WHERE r.project_id = ? AND r.status = 'Pending'
        ORDER BY r.created_at ASC`
    ).bind(projectId).all<any>();
    return results;
  }

  async approveRequest(requestId: string) {
    const req = await this.env.DB.prepare('SELECT * FROM team_project_requests WHERE id = ?').bind(requestId).first<any>();
    if (!req || req.status !== 'Pending') return null;

    await this.env.DB.batch([
      this.env.DB.prepare("UPDATE team_project_requests SET status = 'Approved' WHERE id = ?").bind(requestId),
      this.env.DB.prepare(
        "INSERT OR IGNORE INTO team_project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'Member', ?)"
      ).bind(req.project_id, req.user_id, now()),
    ]);
    return req;
  }

  async rejectRequest(requestId: string) {
    const req = await this.env.DB.prepare('SELECT * FROM team_project_requests WHERE id = ?').bind(requestId).first<any>();
    if (!req || req.status !== 'Pending') return null;
    await this.env.DB.prepare("UPDATE team_project_requests SET status = 'Rejected' WHERE id = ?").bind(requestId).run();
    return req;
  }

  async getProjectMembers(projectId: string) {
    const { results } = await this.env.DB.prepare(
      `SELECT m.*, u.username, u.name, u.photo_url
         FROM team_project_members m
         JOIN users u ON m.user_id = u.id
        WHERE m.project_id = ?`
    ).bind(projectId).all<any>();
    return results;
  }
}
