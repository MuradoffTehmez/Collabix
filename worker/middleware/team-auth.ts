import { Ctx, err } from '../util';
import {
  TEAM_PERMISSIONS, hasPermission, parsePermissions, expandPermissions,
} from '../services/team/permissions';

export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  role_id: string;
  status: string;
  role_name: string;
  /** Rolun prioriteti — BÖYÜK rəqəm = güclü (bax `STANDARD_ROLES`). */
  role_priority: number | null;
  permissions: string[];
}

/** Üzvlük + rol icazələri. Üzv deyilsə `null`. */
export async function getMembership(c: Ctx, teamId: string): Promise<TeamMembership | null> {
  if (!c.user) return null;
  const row = await c.env.DB.prepare(
    `SELECT m.*, r.name AS role_name, r.permissions, r.priority AS role_priority
       FROM team_members m
       JOIN team_roles r ON m.role_id = r.id
      WHERE m.team_id = ? AND m.user_id = ? AND m.status = 'active'`
  ).bind(teamId, c.user.id).first<any>();
  if (!row) return null;
  return { ...row, permissions: parsePermissions(row.permissions) } as TeamMembership;
}

/**
 * Çağıranın komanda daxilindəki EFFEKTİV səlahiyyəti — rol idarəetməsi üçün.
 *
 * AUDIT-2026-07-26 / H-1 (AUDIT-TASK-3 §3.2, §3.3). `requireTeamPermission`
 * yalnız "bu icazə var/yox" sualına cavab verir; rol yaratmaq/dəyişmək üçün
 * bundan artığı lazımdır: çağıran nəyi VERƏ bilər və hansı rollara TOXUNA bilər.
 *
 * `priority` = `Infinity` o deməkdir ki, çağıran rol iyerarxiyasından kənar
 * tam səlahiyyətlidir (sayt admini və ya komanda sahibi).
 *
 * Fail-closed (§5.3): üzvlük tapılmasa və ya prioritet oxunmasa `null` qaytarır —
 * çağıran tərəf bunu 403 kimi emal etməlidir, "yoxdur = sərbəstdir" kimi YOX.
 */
export interface TeamAuthority {
  /** `'*'` genişləndirilmiş formada — Owner tam kataloqu alır. */
  permissions: string[];
  priority: number;
  /** Rol sistemindən kənar tam səlahiyyət (sayt admini / komanda sahibi). */
  unrestricted: boolean;
}

export async function getTeamAuthority(
  c: Ctx,
  team: { id: string; owner_id?: unknown },
): Promise<TeamAuthority | null> {
  if (!c.user) return null;

  // Sayt administratoru komandaları moderasiya edir, komanda sahibi isə
  // `transferOwnership`-dən asılı olmayan struktur sahibdir — hər ikisi rol
  // iyerarxiyasının fövqündədir. (Demo `team_1`-də sahibin rolu "Admin"
  // adlanır və prioriteti 10-dur — prioritetə güvənmək onu öz komandasından
  // kilidləyərdi.)
  if (c.isAdmin || (team.owner_id != null && String(team.owner_id) === c.user.id)) {
    return { permissions: [...TEAM_PERMISSIONS], priority: Infinity, unrestricted: true };
  }

  const member = await getMembership(c, team.id);
  if (!member) return null;

  const raw = member.role_priority;
  const priority = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(priority)) return null;   // pozulmuş rol sətri → rədd

  return { permissions: expandPermissions(member.permissions), priority, unrestricted: false };
}

/** Konkret icazə tələb edir. Uğurda `null`, əks halda hazır error cavabı. */
export async function requireTeamPermission(c: Ctx, teamId: string, requiredPermission: string) {
  if (!c.user) return err('Unauthorized', 401, 'auth_required');

  // Sayt administratoru bütün komandalarda idarəetmə hüququna malikdir
  // (admin paneli komandaları moderasiya edə bilməlidir).
  if (c.isAdmin) return null;

  const member = await getMembership(c, teamId);
  if (!member) return err('You are not a member of this team', 403, 'forbidden');

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
  if (!c.user) return err('Unauthorized', 401, 'auth_required');
  if (c.isAdmin) return null;
  const member = await getMembership(c, teamId);
  if (!member) return err('You are not a member of this team', 403, 'forbidden');
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
  if (!c.user) return err('Unauthorized', 401, 'auth_required');
  if (c.isAdmin) return null;
  if (String(team.visibility || '').toLowerCase() === 'public') return null;
  const member = await getMembership(c, team.id);
  if (!member) return err('This team is private', 403, 'forbidden');
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
