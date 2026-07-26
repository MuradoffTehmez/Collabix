import { Env, uuid, now } from '../../util';
import { parsePermissions, OWNER_ROLE } from './permissions';
import { TeamRoleService } from './role.service';

export class TeamMemberService {
  constructor(private env: Env) {}

  async getMembers(teamId: string) {
    const { results } = await this.env.DB.prepare(
      `SELECT m.id, m.team_id, m.user_id, m.role_id, m.status, m.joined_at,
              u.username, u.name, u.photo_url, u.xp,
              r.name AS role_name, r.priority AS role_priority, r.permissions
         FROM team_members m
         JOIN users u ON m.user_id = u.id
         JOIN team_roles r ON m.role_id = r.id
        WHERE m.team_id = ?
        ORDER BY r.priority DESC, m.joined_at ASC`
    ).bind(teamId).all<any>();
    return results.map(r => ({ ...r, permissions: parsePermissions(r.permissions) }));
  }

  async getMember(teamId: string, userId: string) {
    const row = await this.env.DB.prepare(
      `SELECT m.*, u.username, u.name, r.name AS role_name, r.permissions
         FROM team_members m
         JOIN users u ON m.user_id = u.id
         JOIN team_roles r ON m.role_id = r.id
        WHERE m.team_id = ? AND m.user_id = ? LIMIT 1`
    ).bind(teamId, userId).first<any>();
    if (!row) return null;
    const permissions = parsePermissions(row.permissions);
    return { ...row, permissions, role: { name: row.role_name, permissions } };
  }

  async countMembers(teamId: string): Promise<number> {
    const row = await this.env.DB.prepare('SELECT COUNT(*) AS c FROM team_members WHERE team_id = ?')
      .bind(teamId).first<any>();
    return Number(row?.c || 0);
  }

  /** Public komandaya birbaşa qoşulma (PDR: POST /api/teams/:id/join). */
  async joinTeam(teamId: string, userId: string): Promise<string> {
    const existing = await this.env.DB
      .prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamId, userId).first<any>();
    if (existing) throw new Error('Siz artıq bu komandanın üzvüsünüz');

    const roleId = await new TeamRoleService(this.env).getDefaultMemberRoleId(teamId);
    await this.env.DB.prepare(
      'INSERT INTO team_members (id, team_id, user_id, role_id, status, joined_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(uuid(), teamId, userId, roleId, 'active', now()).run();
    return roleId;
  }

  /**
   * Komandadan çıxmaq. Sahib çıxa bilməz — əvvəlcə sahibliyi köçürməlidir,
   * əks halda komanda sahibsiz qalar və `manage_team` icazəsi olan heç kim
   * qalmaya bilər.
   */
  async leaveTeam(teamId: string, userId: string) {
    const team = await this.env.DB.prepare('SELECT owner_id FROM teams WHERE id = ?').bind(teamId).first<any>();
    if (team && String(team.owner_id) === userId) {
      throw new Error('Komanda sahibi çıxa bilməz — əvvəlcə sahibliyi başqa üzvə köçürün');
    }
    const member = await this.env.DB
      .prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamId, userId).first<any>();
    if (!member) throw new Error('Siz bu komandanın üzvü deyilsiniz');

    await this.removeMember(teamId, userId);
  }

  /** Üzvün komandadan çıxarılması + layihə üzvlüklərinin təmizlənməsi. */
  async removeMember(teamId: string, userId: string) {
    await this.env.DB.batch([
      this.env.DB.prepare(
        `DELETE FROM team_project_members
          WHERE user_id = ? AND project_id IN (SELECT id FROM team_projects WHERE team_id = ?)`
      ).bind(userId, teamId),
      this.env.DB.prepare(
        `UPDATE team_tasks SET assignee_id = NULL
          WHERE assignee_id = ? AND project_id IN (SELECT id FROM team_projects WHERE team_id = ?)`
      ).bind(userId, teamId),
      this.env.DB.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').bind(teamId, userId),
    ]);
  }

  /**
   * Rol təyinatı. Owner rolu bu yolla verilə/alına bilməz — sahiblik yalnız
   * `TeamService.transferOwnership` ilə dəyişir.
   */
  async updateMemberRole(teamId: string, userId: string, roleId: string) {
    const roles = new TeamRoleService(this.env);
    const role = await roles.getRole(roleId);
    if (!role || String(role.team_id) !== teamId) throw new Error('Rol tapılmadı');
    if (role.name === OWNER_ROLE) throw new Error('Owner rolu yalnız sahiblik köçürülməsi ilə verilir');

    const team = await this.env.DB.prepare('SELECT owner_id FROM teams WHERE id = ?').bind(teamId).first<any>();
    if (team && String(team.owner_id) === userId) {
      throw new Error('Komanda sahibinin rolu dəyişdirilə bilməz');
    }

    const res = await this.env.DB
      .prepare('UPDATE team_members SET role_id = ? WHERE team_id = ? AND user_id = ?')
      .bind(roleId, teamId, userId).run();
    if (!res.meta.changes) throw new Error('Üzv tapılmadı');
  }
}
