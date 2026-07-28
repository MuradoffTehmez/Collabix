import { Env, uuid, now, b64uRandom } from '../../util';
import { TeamRoleService } from './role.service';
import { OWNER_ROLE } from './permissions';
import { invalidateTeamMembership } from '../../files-auth';

export interface AcceptResult {
  teamId: string;
  roleId: string;
}

export class TeamInviteService {
  constructor(private env: Env) {}

  async createInvite(teamId: string, invitedBy: string, email?: string, userId?: string, roleId?: string) {
    const id = uuid();
    const token = b64uRandom(24);
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 gün

    const roles = new TeamRoleService(this.env);
    let finalRole = roleId || null;
    if (finalRole) {
      // Dəvətlə Owner rolu paylamaq olmaz — sahiblik yalnız transfer ilə keçir.
      const role = await roles.getRole(finalRole);
      if (!role || String(role.team_id) !== teamId || role.name === OWNER_ROLE) finalRole = null;
    }
    if (!finalRole) finalRole = await roles.getDefaultMemberRoleId(teamId);

    const normEmail = email ? String(email).trim().toLowerCase() : null;

    await this.env.DB.prepare(
      `INSERT INTO team_invites (id, team_id, email, user_id, invited_by, status, expires_at, role_id, created_at, token)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
    ).bind(id, teamId, normEmail, userId || null, invitedBy, expiresAt, finalRole, now(), token).run();

    return { id, token, roleId: finalRole, email: normEmail };
  }

  async getInvite(inviteId: string) {
    return this.env.DB.prepare('SELECT * FROM team_invites WHERE id = ?').bind(inviteId).first<any>();
  }

  async listInvites(teamId: string) {
    const { results } = await this.env.DB.prepare(
      `SELECT i.*, u.username AS invited_by_name, r.name AS role_name
         FROM team_invites i
         JOIN users u ON i.invited_by = u.id
         LEFT JOIN team_roles r ON i.role_id = r.id
        WHERE i.team_id = ? AND i.status = 'pending'
        ORDER BY i.expires_at DESC`
    ).bind(teamId).all<any>();
    return results;
  }

  /** Cari istifadəçiyə ünvanlanmış gözləyən dəvətlər ("Mənim dəvətlərim"). */
  async listInvitesForUser(userId: string, email?: string | null) {
    const norm = email ? String(email).trim().toLowerCase() : null;
    const { results } = await this.env.DB.prepare(
      `SELECT i.id, i.team_id, i.email, i.expires_at, i.created_at,
              t.name AS team_name, t.slug AS team_slug, t.description AS team_description,
              u.username AS invited_by_name, u.name AS invited_by_display,
              r.name AS role_name
         FROM team_invites i
         JOIN teams t ON i.team_id = t.id AND t.status = 'active'
         JOIN users u ON i.invited_by = u.id
         LEFT JOIN team_roles r ON i.role_id = r.id
        WHERE i.status = 'pending'
          AND i.expires_at > ?
          AND (i.user_id = ? OR (? IS NOT NULL AND lower(i.email) = ?))
          AND NOT EXISTS (
            SELECT 1 FROM team_members m WHERE m.team_id = i.team_id AND m.user_id = ?
          )
        ORDER BY i.created_at DESC`
    ).bind(Math.floor(Date.now() / 1000), userId, norm, norm, userId).all<any>();
    return results;
  }

  /**
   * Dəvəti qəbul edir.
   *
   * İKİ TƏHLÜKƏSİZLİK YOXLAMASI (əvvəl heç biri yox idi):
   *  1. Dəvət konkret şəxsə ünvanlanıbsa (`user_id` və ya `email`), yalnız
   *     həmin şəxs qəbul edə bilər — əks halda invite id-sini bilən hər kəs
   *     komandaya girirdi (K2).
   *  2. Rol dəvətdə yazılan roldur, "ən aşağı prioritetli rol" DEYİL — köhnə
   *     məntiq yeni komandada Owner qaytarırdı (K1).
   */
  async acceptInvite(inviteId: string, userId: string, userEmail?: string | null): Promise<AcceptResult> {
    const invite = await this.env.DB
      .prepare("SELECT * FROM team_invites WHERE id = ? AND status = 'pending'")
      .bind(inviteId).first<any>();
    if (!invite) throw new Error('Dəvət tapılmadı və ya artıq istifadə olunub');

    if (invite.expires_at < Math.floor(Date.now() / 1000)) {
      await this.env.DB.prepare("UPDATE team_invites SET status = 'expired' WHERE id = ?").bind(inviteId).run();
      throw new Error('Dəvətin vaxtı bitib');
    }

    const targetUser = invite.user_id ? String(invite.user_id) : null;
    const targetEmail = invite.email ? String(invite.email).trim().toLowerCase() : null;
    if (targetUser || targetEmail) {
      const myEmail = userEmail ? String(userEmail).trim().toLowerCase() : null;
      const matches =
        (targetUser && targetUser === userId) ||
        (targetEmail && myEmail && targetEmail === myEmail);
      if (!matches) throw new Error('Bu dəvət başqa istifadəçi üçündür');
    }

    const already = await this.env.DB
      .prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(invite.team_id, userId).first<any>();
    if (already) {
      await this.env.DB.prepare("UPDATE team_invites SET status = 'accepted' WHERE id = ?").bind(inviteId).run();
      throw new Error('Siz artıq bu komandanın üzvüsünüz');
    }

    const roles = new TeamRoleService(this.env);
    let roleId = invite.role_id ? String(invite.role_id) : '';
    if (roleId) {
      const role = await roles.getRole(roleId);
      if (!role || String(role.team_id) !== String(invite.team_id) || role.name === OWNER_ROLE) roleId = '';
    }
    if (!roleId) roleId = await roles.getDefaultMemberRoleId(String(invite.team_id));

    await this.env.DB.batch([
      this.env.DB.prepare("UPDATE team_invites SET status = 'accepted' WHERE id = ?").bind(inviteId),
      this.env.DB.prepare(
        'INSERT INTO team_members (id, team_id, user_id, role_id, status, joined_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(uuid(), invite.team_id, userId, roleId, 'active', now()),
    ]);

    // Üzvlük keşində MƏNFİ sətir qalmış ola bilər → yeni üzv 60 s komandanın
    // fayllarını görməzdi (AUDIT-TASK-7 §7.3, files-auth.ts).
    await invalidateTeamMembership(this.env, String(invite.team_id), userId);
    return { teamId: String(invite.team_id), roleId };
  }

  async declineInvite(inviteId: string, userId: string, userEmail?: string | null) {
    const invite = await this.getInvite(inviteId);
    if (!invite || invite.status !== 'pending') throw new Error('Dəvət tapılmadı');
    const targetUser = invite.user_id ? String(invite.user_id) : null;
    const targetEmail = invite.email ? String(invite.email).trim().toLowerCase() : null;
    const myEmail = userEmail ? String(userEmail).trim().toLowerCase() : null;
    const mine =
      (targetUser && targetUser === userId) ||
      (targetEmail && myEmail && targetEmail === myEmail);
    if ((targetUser || targetEmail) && !mine) throw new Error('Bu dəvət başqa istifadəçi üçündür');
    await this.env.DB.prepare("UPDATE team_invites SET status = 'declined' WHERE id = ?").bind(inviteId).run();
  }

  async deleteInvite(inviteId: string) {
    await this.env.DB.prepare('DELETE FROM team_invites WHERE id = ?').bind(inviteId).run();
  }
}
