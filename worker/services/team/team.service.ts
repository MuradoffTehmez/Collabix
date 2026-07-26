import { Env, uuid, now } from '../../util';
import { TeamRoleService } from './role.service';
import { OWNER_ROLE } from './permissions';

/** PDR: Team Reputation səviyyələri. */
export const REPUTATION_TIERS = [
  { name: 'Legend', min: 10000 },
  { name: 'Diamond', min: 5000 },
  { name: 'Gold', min: 2000 },
  { name: 'Silver', min: 500 },
  { name: 'Bronze', min: 0 },
];

export function reputationFor(xp: number) {
  const tier = REPUTATION_TIERS.find(t => (xp || 0) >= t.min) || REPUTATION_TIERS[REPUTATION_TIERS.length - 1];
  const idx = REPUTATION_TIERS.indexOf(tier);
  const next = idx > 0 ? REPUTATION_TIERS[idx - 1] : null;
  return {
    tier: tier.name,
    nextTier: next?.name || null,
    nextAt: next?.min ?? null,
    progress: next ? Math.min(1, ((xp || 0) - tier.min) / (next.min - tier.min)) : 1,
  };
}

/** PDR-dəki standart otaqlar — komanda yaradılanda hazır gəlir. */
const DEFAULT_ROOMS = ['General', 'Development', 'Design', 'QA', 'Random'];

const VISIBILITIES = ['Public', 'Private', 'Invite'];
export function normalizeVisibility(v: unknown): string {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'public') return 'Public';
  if (s === 'invite' || s === 'invite only' || s === 'invite_only') return 'Invite';
  return 'Private';
}

export class TeamService {
  constructor(private env: Env) {}

  async createTeam(ownerId: string, name: string, description?: string, visibility = 'Private'): Promise<string> {
    const id = uuid();
    const base = String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'team';
    const slug = `${base}-${Math.random().toString(36).substring(2, 8)}`;

    await this.env.DB.prepare(
      `INSERT INTO teams (id, slug, name, description, visibility, owner_id, status, xp, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`
    ).bind(id, slug, name, description || '', normalizeVisibility(visibility), ownerId, now(), now()).run();

    // PDR-dəki 10 standart rolun hamısı yaradılır. Əvvəl yalnız "Owner" var idi
    // və nəticədə dəvət qəbul edən istifadəçi Owner olurdu (K1).
    const roles = new TeamRoleService(this.env);
    const roleMap = await roles.ensureStandardRoles(id);

    await this.env.DB.prepare(
      'INSERT INTO team_members (id, team_id, user_id, role_id, status, joined_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(uuid(), id, ownerId, roleMap[OWNER_ROLE], 'active', now()).run();

    // Standart söhbət otaqları. Hər `team_chat_rooms` sətri qlobal `rooms`
    // cədvəlindəki eyni id-li otağa bağlıdır — RoomDO/mesaj API-si onu işlədir.
    const stmts: D1PreparedStatement[] = [];
    for (const room of DEFAULT_ROOMS) {
      const roomId = uuid();
      stmts.push(
        this.env.DB.prepare('INSERT INTO rooms (id, name, created_by, created_at) VALUES (?, ?, ?, ?)')
          .bind(roomId, `${name} ${room}`, 'system', now()),
        this.env.DB.prepare('INSERT INTO team_chat_rooms (id, team_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(roomId, id, room, room, now())
      );
    }
    await this.env.DB.batch(stmts);

    return id;
  }

  async getTeam(teamIdOrSlug: string) {
    return this.env.DB
      .prepare("SELECT * FROM teams WHERE (id = ? OR slug = ?) AND status = 'active'")
      .bind(teamIdOrSlug, teamIdOrSlug).first<any>();
  }

  async getTeamsForUser(userId: string) {
    const { results } = await this.env.DB.prepare(
      `SELECT t.*, r.name AS my_role,
              (SELECT COUNT(*) FROM team_members mm WHERE mm.team_id = t.id) AS members_count
         FROM teams t
         JOIN team_members m ON t.id = m.team_id
         LEFT JOIN team_roles r ON m.role_id = r.id
        WHERE m.user_id = ? AND t.status = 'active'
        ORDER BY t.updated_at DESC`
    ).bind(userId).all<any>();
    return results;
  }

  /** Kəşfiyyat siyahısı: yalnız Public komandalar (+ axtarış). */
  async discoverTeams(userId: string, query?: string) {
    const q = `%${String(query || '').trim()}%`;
    const useQuery = String(query || '').trim().length > 0;
    const { results } = await this.env.DB.prepare(
      `SELECT t.*,
              (SELECT COUNT(*) FROM team_members mm WHERE mm.team_id = t.id) AS members_count,
              EXISTS(SELECT 1 FROM team_members m2 WHERE m2.team_id = t.id AND m2.user_id = ?) AS is_member
         FROM teams t
        WHERE t.status = 'active'
          AND t.visibility = 'Public'
          AND (? = 0 OR t.name LIKE ? OR t.description LIKE ?)
        ORDER BY t.xp DESC, t.updated_at DESC
        LIMIT 50`
    ).bind(userId, useQuery ? 1 : 0, q, q).all<any>();
    return results;
  }

  async searchTeams(userId: string, query: string) {
    return this.discoverTeams(userId, query);
  }

  /** Admin paneli — sahib adı və sayğaclarla birlikdə. */
  async getAllTeams(includeDeleted = false) {
    const { results } = await this.env.DB.prepare(
      `SELECT t.*,
              u.username, u.name AS owner_name,
              (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id) AS members_count,
              (SELECT COUNT(*) FROM team_projects p WHERE p.team_id = t.id AND p.status != 'deleted') AS projects_count,
              (SELECT COUNT(*) FROM team_tasks k JOIN team_projects p2 ON k.project_id = p2.id
                WHERE p2.team_id = t.id AND k.status != 'Deleted') AS tasks_count
         FROM teams t
         LEFT JOIN users u ON t.owner_id = u.id
        WHERE (? = 1 OR t.status = 'active')
        ORDER BY t.created_at DESC`
    ).bind(includeDeleted ? 1 : 0).all<any>();
    return results;
  }

  async updateTeam(
    teamId: string,
    updates: { name?: string; description?: string; visibility?: string; avatar?: string; banner?: string },
  ) {
    const sets: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) { sets.push('name = ?'); values.push(String(updates.name).slice(0, 80)); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(String(updates.description).slice(0, 2000)); }
    if (updates.visibility !== undefined) { sets.push('visibility = ?'); values.push(normalizeVisibility(updates.visibility)); }
    if (updates.avatar !== undefined) { sets.push('avatar = ?'); values.push(updates.avatar); }
    if (updates.banner !== undefined) { sets.push('banner = ?'); values.push(updates.banner); }
    if (!sets.length) return;

    sets.push('updated_at = ?');
    values.push(now(), teamId);
    await this.env.DB.prepare(`UPDATE teams SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  async deleteTeam(teamId: string) {
    await this.env.DB.prepare("UPDATE teams SET status = 'deleted', updated_at = ? WHERE id = ?")
      .bind(now(), teamId).run();
  }

  async restoreTeam(teamId: string) {
    await this.env.DB.prepare("UPDATE teams SET status = 'active', updated_at = ? WHERE id = ?")
      .bind(now(), teamId).run();
  }

  /** Komanda XP-si (PDR: Task +20, Bug +30, Project +100, Hackathon +500). */
  async addXp(teamId: string, amount: number) {
    if (!amount) return;
    await this.env.DB.prepare('UPDATE teams SET xp = MAX(0, xp + ?), updated_at = ? WHERE id = ?')
      .bind(amount, now(), teamId).run();
  }

  async getXp(teamId: string): Promise<number> {
    const row = await this.env.DB.prepare('SELECT xp FROM teams WHERE id = ?').bind(teamId).first<any>();
    return Number(row?.xp || 0);
  }

  /**
   * Sahibliyin köçürülməsi: yeni sahib Owner rolunu alır, köhnə sahib Admin olur.
   * Komanda sahibsiz qalmasın deyə hər iki addım eyni batch-dədir.
   */
  async transferOwnership(teamId: string, currentOwnerId: string, newOwnerId: string) {
    const target = await this.env.DB
      .prepare("SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'")
      .bind(teamId, newOwnerId).first<any>();
    if (!target) throw new Error('Yeni sahib komandanın aktiv üzvü olmalıdır');

    const roles = new TeamRoleService(this.env);
    const ownerRole = await roles.getOwnerRoleId(teamId);
    const adminRole = await roles.ensureRole(teamId, 'Admin');

    await this.env.DB.batch([
      this.env.DB.prepare('UPDATE team_members SET role_id = ? WHERE team_id = ? AND user_id = ?')
        .bind(ownerRole, teamId, newOwnerId),
      this.env.DB.prepare('UPDATE team_members SET role_id = ? WHERE team_id = ? AND user_id = ?')
        .bind(adminRole, teamId, currentOwnerId),
      this.env.DB.prepare('UPDATE teams SET owner_id = ?, updated_at = ? WHERE id = ?')
        .bind(newOwnerId, now(), teamId),
    ]);
  }

  static visibilities() {
    return VISIBILITIES;
  }
}
