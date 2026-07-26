import { Ctx, err } from '../util';
import { hasPermission, parsePermissions } from '../services/team/permissions';

export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  role_id: string;
  status: string;
  role_name: string;
  permissions: string[];
}

/** Üzvlük + rol icazələri. Üzv deyilsə `null`. */
export async function getMembership(c: Ctx, teamId: string): Promise<TeamMembership | null> {
  if (!c.user) return null;
  const row = await c.env.DB.prepare(
    `SELECT m.*, r.name AS role_name, r.permissions
       FROM team_members m
       JOIN team_roles r ON m.role_id = r.id
      WHERE m.team_id = ? AND m.user_id = ? AND m.status = 'active'`
  ).bind(teamId, c.user.id).first<any>();
  if (!row) return null;
  return { ...row, permissions: parsePermissions(row.permissions) } as TeamMembership;
}

/** Konkret icazə tələb edir. Uğurda `null`, əks halda hazır error cavabı. */
export async function requireTeamPermission(c: Ctx, teamId: string, requiredPermission: string) {
  if (!c.user) return err('Unauthorized', 401);

  // Sayt administratoru bütün komandalarda idarəetmə hüququna malikdir
  // (admin paneli komandaları moderasiya edə bilməlidir).
  if (c.isAdmin) return null;

  const member = await getMembership(c, teamId);
  if (!member) return err('You are not a member of this team', 403);

  if (!hasPermission(member.permissions, requiredPermission)) {
    return err('Missing required team permission: ' + requiredPermission, 403);
  }
  return null;
}

/**
 * Yazma əməliyyatları üçün: sadəcə komanda üzvü olmaq kifayətdir
 * (məs. öz postunu paylaşmaq, öz postunu silmək).
 */
export async function requireTeamMember(c: Ctx, teamId: string) {
  if (!c.user) return err('Unauthorized', 401);
  if (c.isAdmin) return null;
  const member = await getMembership(c, teamId);
  if (!member) return err('You are not a member of this team', 403);
  return null;
}

/**
 * Oxuma əməliyyatları üçün görünürlük qapısı.
 * Public komandanı hər kəs oxuya bilər; Private/Invite Only yalnız üzvlərə.
 *
 * Bundan əvvəl feed, fayllar, üzv siyahısı, aktivlik jurnalı və statistika
 * heç bir yoxlama olmadan verilirdi — bax docs/TASK-11-REPORT.md K3–K5.
 */
export async function requireTeamRead(c: Ctx, team: { id: string; visibility?: string }) {
  if (!c.user) return err('Unauthorized', 401);
  if (c.isAdmin) return null;
  if (String(team.visibility || '').toLowerCase() === 'public') return null;
  const member = await getMembership(c, team.id);
  if (!member) return err('This team is private', 403);
  return null;
}

/** Müəllif özü, yoxsa moderasiya icazəsi? (post/fayl silmə üçün) */
export async function canModerate(c: Ctx, teamId: string, authorId: string | null, permission: string) {
  if (!c.user) return false;
  if (c.isAdmin) return true;
  if (authorId && authorId === c.user.id) {
    // Müəllif olsa belə komandadan çıxarılıbsa artıq toxuna bilməz.
    return !!(await getMembership(c, teamId));
  }
  const member = await getMembership(c, teamId);
  return hasPermission(member?.permissions, permission);
}
