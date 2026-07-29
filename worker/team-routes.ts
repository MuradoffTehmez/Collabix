import { Ctx, err, json, readJson, fileUrl, uuid, now, likePattern } from './util';
import { kickFromTeam, kickTeamRooms } from './ws-kick';
import { TeamService, reputationFor, normalizeVisibility } from './services/team/team.service';
import { TeamMemberService } from './services/team/member.service';
import { TeamProjectService } from './services/team/project.service';
import { TeamTaskService } from './services/team/task.service';
import { TeamInviteService } from './services/team/invite.service';
import { TeamRoleService } from './services/team/role.service';
import { TeamFeedService } from './services/team/feed.service';
import { TeamFileService, FILE_CATEGORIES } from './services/team/file.service';
import { TeamActivityService } from './services/team/activity.service';
import { TeamStatisticsService } from './services/team/statistics.service';
import { TeamNotifyService } from './services/team/notify.service';
import {
  requireTeamPermission, requireTeamMember, requireTeamRead, getMembership, canModerate,
  getTeamAuthority, type TeamAuthority,
} from './middleware/team-auth';
import {
  TEAM_PERMISSIONS, STANDARD_ROLES, hasPermission,
  sanitizePermissions, expandPermissions, findEscalatedPermissions,
} from './services/team/permissions';
import { TEAM_XP } from './services/team/xp';
import { logAdmin } from './admin-log';
import { QueueService } from './services/queue';
import { SystemEvent } from './events';

/* ---------- ortaq köməkçilər ---------- */

/** Komandanı id və ya slug ilə tapır. Tapılmasa hazır 404 cavabı qaytarır. */
async function loadTeam(c: Ctx, idOrSlug: string): Promise<{ team: any } | { res: Response }> {
  const team = await new TeamService(c.env).getTeam(idOrSlug);
  if (!team) return { res: err('Team not found', 404) };
  return { team };
}

/** Event-i növbəyə atır — cavabı gecikdirmir. */
function emit(c: Ctx, event: SystemEvent) {
  const q = new QueueService(c.env);
  c.ctx.waitUntil(q.publish(event).catch(e => console.error('event publish failed', event.type, e)));
}

const actorName = (c: Ctx) => c.user?.name || c.user?.username || 'İstifadəçi';

/**
 * Tapşırıq təyinatının üzvlük yoxlaması — AUDIT M-15.
 *
 * `assigneeId` verilməyibsə (təyinatsız tapşırıq) yoxlama aparılmır.
 * Verilibsə, həmin şəxs komandanın AKTİV üzvü olmalıdır.
 */
async function denyNonMemberAssignee(
  c: Ctx, teamId: string, assigneeId: unknown,
): Promise<Response | null> {
  if (!assigneeId) return null;
  const row = await c.env.DB.prepare(
    "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'",
  ).bind(teamId, String(assigneeId)).first();
  if (row) return null;
  return err('Tapşırıq yalnız komanda üzvünə təyin edilə bilər', 400, 'not_a_member');
}

/* ---------- rol iyerarxiyası qoruyucuları — AUDIT-2026-07-26 / H-1 ---------- */
//
// `requireTeamPermission` yalnız "manage_roles var/yox" sualına baxırdı. Bu,
// `manage_roles` daşıyan Admin-ə 3 sorğuluq eskalasiya zənciri açırdı:
//   1) permissions:['*'] ilə rol yarat  2) özünü ora keçir  3) komandanı sil.
// Aşağıdakı üç qoruyucu zəncirin hər halqasını AYRICA bağlayır — biri
// silinsə də qalanları müstəqil müdafiə kimi qalır (defense in depth).

/** Çağıranın effektiv səlahiyyəti; müəyyən edilə bilmirsə hazır 403 (fail-closed). */
async function loadAuthority(
  c: Ctx, team: { id: string; owner_id?: unknown },
): Promise<{ authority: TeamAuthority } | { res: Response }> {
  const authority = await getTeamAuthority(c, team);
  if (!authority) {
    return { res: err('Komandadakı səlahiyyətiniz müəyyən edilə bilmədi', 403, 'forbidden') };
  }
  return { authority };
}

/**
 * Altçoxluq qaydası: verilən icazə dəsti çağıranın öz dəstindən kənara çıxa bilməz.
 *
 * `sanitizePermissions` wildcard-ı kəsdikdən sonra da Admin açıq şəkildə
 * `['manage_team']` yaza bilərdi — bu, həmin AYRI hücumu bağlayır.
 *
 * ⚠ `requested` NORMALLAŞDIRILMIŞ gəlməlidir və mənbəyə görə fərqli normallaşdırma
 * lazımdır: istifadəçi girişi üçün `sanitizePermissions` (orada `'*'` uydurma
 * dəyərdir və atılır), BAZADAKI rol üçün isə `expandPermissions` (orada `'*'`
 * ƏSL səlahiyyətdir və açılmalıdır). Səhv seçim köhnə wildcard rolun
 * yoxlamadan yalançı keçməsinə səbəb olar.
 */
function denyEscalation(authority: TeamAuthority, requested: string[]): Response | null {
  const escalated = findEscalatedPermissions(authority.permissions, requested);
  if (!escalated.length) return null;
  return err(`Özünüzdə olmayan səlahiyyəti verə bilməzsiniz: ${escalated.join(', ')}`,
    403, 'forbidden');
}

/**
 * Prioritet qaydası: çağıran özündən GÜCLÜ rola toxuna və belə rol yarada bilməz.
 * (`STANDARD_ROLES`: böyük rəqəm = güclü — Owner 100, Admin 90, Viewer 10.)
 *
 * Ad əsaslı `'Owner'` qorumasından fərqli olaraq bu, rolun yenidən
 * adlandırılması ilə yayınmağa imkan vermir. Sayt admini/komanda sahibi üçün
 * `authority.priority === Infinity` → qayda heç vaxt onları bloklamır.
 */
function denyHigherPriority(
  authority: TeamAuthority, priority: unknown, message: string,
): Response | null {
  const value = priority == null ? NaN : Number(priority);
  if (!Number.isFinite(value)) return err('Rolun prioriteti oxunmadı', 403, 'forbidden');
  if (value > authority.priority) return err(message, 403, 'forbidden');
  return null;
}

/* ================= Teams ================= */

export async function createTeam(c: Ctx) {
  const b = await readJson(c.req);
  const name = String(b.name || '').trim();
  if (name.length < 2) return err('Komanda adı ən azı 2 simvol olmalıdır', 400);

  const teamService = new TeamService(c.env);
  const id = await teamService.createTeam(c.user!.id, name, b.description, b.visibility);

  emit(c, { type: 'TeamCreated', teamId: id, ownerId: c.user!.id });
  return json({ id });
}

export async function getTeams(c: Ctx) {
  const scope = c.url.searchParams.get('scope') || 'mine';
  const q = c.url.searchParams.get('q') || '';
  const teamService = new TeamService(c.env);

  if (scope === 'discover' || scope === 'public' || q) {
    const teams = await teamService.discoverTeams(c.user!.id, q);
    return json({ teams, scope: 'discover' });
  }
  const teams = await teamService.getTeamsForUser(c.user!.id);
  return json({ teams, scope: 'mine' });
}

/** Public komandaların kəşfiyyat siyahısı (+ axtarış). */
export async function discoverTeams(c: Ctx) {
  const q = c.url.searchParams.get('q') || '';
  const teams = await new TeamService(c.env).discoverTeams(c.user!.id, q);
  return json({ teams });
}

export async function listAllTeams(c: Ctx) {
  const includeDeleted = c.url.searchParams.get('deleted') === '1';
  const teams = await new TeamService(c.env).getAllTeams(includeDeleted);
  return json({ teams });
}

export async function getTeam(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;
  const { team } = r;

  const member = await getMembership(c, team.id);
  const isMember = !!member;

  // Private komandanın detalları yalnız üzvlərə (və sayt admininə).
  if (!isMember && !c.isAdmin && normalizeVisibility(team.visibility) !== 'Public') {
    return err('This team is private', 403, 'forbidden');
  }

  const rep = reputationFor(Number(team.xp || 0));
  return json({
    team: {
      ...team,
      total_xp: Number(team.xp || 0),
      reputation: rep.tier,
      reputationNext: rep.nextTier,
      reputationProgress: rep.progress,
      isMember,
      isOwner: String(team.owner_id) === c.user!.id,
      myRole: member?.role_name || null,
      permissions: member?.permissions || (c.isAdmin ? ['*'] : []),
      // `isAdmin` idarəetmə paneli düymələri üçündür. Əvvəl `'*'` wildcard-ı
      // nəzərə alınmırdı və komanda SAHİBİ Settings tab-ını görmürdü.
      isAdmin: c.isAdmin || hasPermission(member?.permissions, 'manage_team') ||
               hasPermission(member?.permissions, 'manage_settings'),
    },
  });
}

export async function updateTeam(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_settings');
  if (denied) return denied;

  const b = await readJson(c.req);
  await new TeamService(c.env).updateTeam(r.team.id, b);

  emit(c, { type: 'TeamUpdated', teamId: r.team.id, userId: c.user!.id } as any);
  return json({ success: true });
}

export async function deleteTeam(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  // Silmək yalnız `manage_team` (Owner) səlahiyyətidir — Admin silə bilməz.
  const denied = await requireTeamPermission(c, r.team.id, 'manage_team');
  if (denied) return denied;

  await new TeamService(c.env).deleteTeam(r.team.id);
  // 🔴 H-6 / C-2: `deleteTeam` SOFT-DELETE-dir (Task 7 §8/3) — `team_members`
  // sətirləri qalır, yəni üzvlük yoxlaması otağı BAĞLAMIR. Açıq soketlər
  // burada açıq kəsilməsə, silinmiş komandanın çatı işləməyə davam edərdi.
  c.ctx.waitUntil(kickTeamRooms(c.env, r.team.id));
  emit(c, { type: 'TeamDeleted', teamId: r.team.id, userId: c.user!.id } as any);
  return json({ success: true });
}

/** Public komandaya birbaşa qoşulma. */
export async function joinTeam(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;
  const { team } = r;

  if (normalizeVisibility(team.visibility) !== 'Public') {
    return err('Bu komandaya yalnız dəvətlə qoşulmaq olar', 403, 'forbidden');
  }
  try {
    const roleId = await new TeamMemberService(c.env).joinTeam(team.id, c.user!.id);
    emit(c, { type: 'MemberJoined', teamId: team.id, userId: c.user!.id, roleId });
    return json({ success: true });
  } catch (e: any) {
    return err(e.message, 400);
  }
}

export async function leaveTeam(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;
  try {
    await new TeamMemberService(c.env).leaveTeam(r.team.id, c.user!.id);
    // H-6 / C-2 — istifadəçi özü çıxır, açıq soketi qalmamalıdır.
    c.ctx.waitUntil(kickFromTeam(c.env, c.user!.id, r.team.id));
    emit(c, { type: 'MemberLeft', teamId: r.team.id, userId: c.user!.id });
    return json({ success: true });
  } catch (e: any) {
    return err(e.message, 400);
  }
}

export async function transferOwnership(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  if (String(r.team.owner_id) !== c.user!.id && !c.isAdmin) {
    return err('Yalnız komanda sahibi sahibliyi köçürə bilər', 403, 'forbidden');
  }
  const b = await readJson(c.req);
  if (!b.userId) return err('userId tələb olunur', 400);

  try {
    await new TeamService(c.env).transferOwnership(r.team.id, String(r.team.owner_id), String(b.userId));
    const notify = new TeamNotifyService(c.env);
    c.ctx.waitUntil(notify.toUser(String(b.userId), c.user!.id, actorName(c), 'team_role',
      `${r.team.name} komandasının sahibliyi sizə keçdi`));
    emit(c, { type: 'RoleChanged', teamId: r.team.id, userId: String(b.userId), roleId: 'owner' });
    return json({ success: true });
  } catch (e: any) {
    return err(e.message, 400);
  }
}

/* ================= Members ================= */

export async function getTeamMembers(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamRead(c, r.team);
  if (denied) return denied;

  const members = await new TeamMemberService(c.env).getMembers(r.team.id);
  return json({ members });
}

export async function updateMemberRole(c: Ctx, idOrSlug: string, userId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_members');
  if (denied) return denied;

  const b = await readJson(c.req);
  if (!b.roleId) return err('Role ID required', 400);

  // H-1 / zəncirin 2-ci halqası: Admin özünü (və ya başqasını) güclü rola
  // keçirməklə `manage_team` alırdı. Mövcud ad əsaslı qoruma ("Owner" adı)
  // yeni yaradılmış "Ops" rolunu tutmurdu — prioritet + altçoxluq tutur.
  const auth = await loadAuthority(c, r.team);
  if ('res' in auth) return auth.res;

  const target = await new TeamRoleService(c.env).getRole(String(b.roleId));
  if (target && String(target.team_id) === String(r.team.id)) {
    const denyRank = denyHigherPriority(auth.authority, target.priority,
      'Özünüzdən yüksək prioritetli rolu təyin edə bilməzsiniz');
    if (denyRank) return denyRank;
    // Köhnə məlumat müdafiəsi: prioriteti aşağı, lakin güclü icazə daşıyan rol
    // (məs. demo `role_1` — priority 10 + manage_team) təyinatla verilə bilməz.
    // `expandPermissions` — çünki BAZADAKI `'*'` əsl səlahiyyətdir: sanitizasiya
    // onu atsaydı, köhnə wildcard rol yoxlamadan boş dəst kimi keçərdi.
    const denyGrant = denyEscalation(auth.authority, expandPermissions(target.permissions));
    if (denyGrant) return denyGrant;
  }

  try {
    await new TeamMemberService(c.env).updateMemberRole(r.team.id, userId, String(b.roleId));
  } catch (e: any) {
    return err(e.message, 400);
  }
  // H-6 / C-2: rol dəyişikliyi otaq çıxışını DARALDA bilər. Hansı icazənin
  // hansı otağa təsir etdiyini burada hesablamaq əvəzinə soket sadəcə kəsilir —
  // client dərhal yenidən qoşulur və `index.ts` yeni rolla avtorizasiya edir.
  // Bu, "hansı hallarda kəsmək lazımdır" sualını tamamilə aradan qaldırır.
  c.ctx.waitUntil(kickFromTeam(c.env, userId, r.team.id));

  const notify = new TeamNotifyService(c.env);
  c.ctx.waitUntil(notify.toUser(userId, c.user!.id, actorName(c), 'team_role',
    `${r.team.name} komandasında rolunuz dəyişdirildi`));
  emit(c, { type: 'RoleChanged', teamId: r.team.id, userId, roleId: String(b.roleId) });
  return json({ success: true });
}

export async function removeTeamMember(c: Ctx, idOrSlug: string, userId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  // Öz-özünü çıxarmaq = komandadan çıxmaq (ayrıca icazə tələb etmir).
  if (userId === c.user!.id) return leaveTeam(c, idOrSlug);

  const denied = await requireTeamPermission(c, r.team.id, 'manage_members');
  if (denied) return denied;

  if (String(r.team.owner_id) === userId) {
    return err('Komanda sahibi kənarlaşdırıla bilməz', 400);
  }

  await new TeamMemberService(c.env).removeMember(r.team.id, userId);
  // 🔴 H-6-nın ƏSAS SSENARİSİ: Task 3 `removeMember`-i düzəltdi, lakin WS-ə
  // TƏSİR ETMİRDİ — çıxarılan üzv açıq soket üzərindən məxfi otağı oxumağa və
  // yazmağa davam edirdi.
  c.ctx.waitUntil(kickFromTeam(c.env, userId, r.team.id));
  const notify = new TeamNotifyService(c.env);
  c.ctx.waitUntil(notify.toUser(userId, c.user!.id, actorName(c), 'team_kick',
    `${r.team.name} komandasından çıxarıldınız`));
  emit(c, { type: 'MemberLeft', teamId: r.team.id, userId });
  return json({ success: true });
}

/* ================= Roles ================= */

export async function getTeamRoles(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamRead(c, r.team);
  if (denied) return denied;

  const roleService = new TeamRoleService(c.env);
  let roles = await roleService.getRoles(r.team.id);

  // Köhnə komandalarda yalnız "Owner" rolu var idi — ilk baxışda standart
  // rollar avtomatik yaradılır ki, rol seçimi boş qalmasın.
  if (roles.length < STANDARD_ROLES.length) {
    const denyWrite = await requireTeamPermission(c, r.team.id, 'manage_roles');
    if (!denyWrite) {
      await roleService.ensureStandardRoles(r.team.id);
      roles = await roleService.getRoles(r.team.id);
    }
  }
  return json({ roles, available: TEAM_PERMISSIONS });
}

export async function createTeamRole(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_roles');
  if (denied) return denied;

  const b = await readJson(c.req);
  const name = String(b.name || '').trim();
  if (!name) return err('Rol adı tələb olunur', 400);

  const roleService = new TeamRoleService(c.env);
  if (await roleService.getRoleByName(r.team.id, name)) return err('Bu adda rol artıq var', 400);

  // H-1 / zəncirin 1-ci halqası. `'*'` artıq `sanitizePermissions`-də süzülür;
  // burada AÇIQ eskalasiya (`['manage_team']`) və özündən güclü rol yaratmaq
  // bağlanır.
  const auth = await loadAuthority(c, r.team);
  if ('res' in auth) return auth.res;

  const priority = Number(b.priority) || 0;
  const denyRank = denyHigherPriority(auth.authority, priority,
    'Özünüzdən yüksək prioritetli rol yarada bilməzsiniz');
  if (denyRank) return denyRank;

  const denyGrant = denyEscalation(auth.authority, sanitizePermissions(b.permissions));
  if (denyGrant) return denyGrant;

  const id = await roleService.createRole(r.team.id, name, b.permissions || [], priority);
  return json({ id });
}

export async function updateTeamRole(c: Ctx, idOrSlug: string, roleId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_roles');
  if (denied) return denied;

  const roleService = new TeamRoleService(c.env);
  const role = await roleService.getRole(roleId);
  if (!role || String(role.team_id) !== String(r.team.id)) return err('Rol tapılmadı', 404);

  // ⚠ SIRA VACİBDİR: prioritet yoxlaması ad yoxlamasından ƏVVƏL gəlir.
  // Admin üçün Owner rolu artıq bu mərhələdə 403 alır; sahib/sayt admini üçün
  // isə (priority = Infinity) keçir və aşağıdakı köhnə 400 davranışı qorunur.
  const auth = await loadAuthority(c, r.team);
  if ('res' in auth) return auth.res;

  // 3.3.b — Admin Owner rolunun icazələrini azalda/prioritetini endirə bilirdi.
  // Altçoxluq qaydası bunu TUTMUR: burada icazə verilmir, ALINIR.
  const denyTarget = denyHigherPriority(auth.authority, role.priority,
    'Özünüzdən yüksək prioritetli rolu dəyişdirə bilməzsiniz');
  if (denyTarget) return denyTarget;

  if (role.name === 'Owner') return err('Owner rolu dəyişdirilə bilməz', 400);

  const b = await readJson(c.req);

  // 3.3.c — rolun prioritetini öz səviyyəsindən yuxarı qaldırmaq da eskalasiyadır.
  if (b.priority !== undefined) {
    const denyRank = denyHigherPriority(auth.authority, b.priority,
      'Rolun prioritetini öz səviyyənizdən yuxarı qaldıra bilməzsiniz');
    if (denyRank) return denyRank;
  }
  if (b.permissions !== undefined) {
    const denyGrant = denyEscalation(auth.authority, sanitizePermissions(b.permissions));
    if (denyGrant) return denyGrant;
  }

  await roleService.updateRole(roleId, b);
  return json({ success: true });
}

export async function deleteTeamRole(c: Ctx, idOrSlug: string, roleId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_roles');
  if (denied) return denied;

  const roleService = new TeamRoleService(c.env);
  const role = await roleService.getRole(roleId);
  if (!role || String(role.team_id) !== String(r.team.id)) return err('Rol tapılmadı', 404);

  // 3.3.b — silmə də "yuxarı rola müdaxilə"dir: `deleteRole` həmin roldakı
  // üzvləri default rola köçürür, yəni Owner-i praktiki olaraq devirmək olardı.
  // Yoxlama ad yoxlamasından ƏVVƏL — bax `updateTeamRole`-dakı izah.
  const auth = await loadAuthority(c, r.team);
  if ('res' in auth) return auth.res;

  const denyTarget = denyHigherPriority(auth.authority, role.priority,
    'Özünüzdən yüksək prioritetli rolu silə bilməzsiniz');
  if (denyTarget) return denyTarget;

  if (role.name === 'Owner') return err('Owner rolu silinə bilməz', 400);

  await roleService.deleteRole(r.team.id, roleId);
  return json({ success: true });
}

/* ================= Invites ================= */

export async function createTeamInvite(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;
  const { team } = r;

  const denied = await requireTeamPermission(c, team.id, 'manage_invites');
  if (denied) return denied;

  const b = await readJson(c.req);
  const rawEmail = String(b.email || '').trim();
  let targetUserId: string | null = b.userId ? String(b.userId) : null;
  let email: string | null = rawEmail || null;

  // Email daxil edilibsə və sistemdə belə istifadəçi varsa dəvəti birbaşa
  // ona bağlayırıq — beləcə "Mənim dəvətlərim" siyahısında dərhal görünür.
  if (!targetUserId && email) {
    const u = await c.env.DB
      .prepare('SELECT id FROM users WHERE lower(email) = ? OR lower(contact_email) = ? OR username = ?')
      .bind(email.toLowerCase(), email.toLowerCase(), email.toLowerCase()).first<any>();
    if (u) targetUserId = String(u.id);
  }
  if (!targetUserId && !email) return err('Email və ya istifadəçi seçin', 400);

  if (targetUserId) {
    const already = await c.env.DB.prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(team.id, targetUserId).first<any>();
    if (already) return err('Bu istifadəçi artıq komandanın üzvüdür', 400);
  }

  const inviteService = new TeamInviteService(c.env);

  // H-1-in eyni qaydası dəvət yoluna da aiddir: dəvətə rol bağlamaq da
  // SƏLAHİYYƏT VERMƏKDİR. `invite.service.ts` yalnız `name === 'Owner'`
  // yoxlayır — özündən güclü, lakin başqa adlı rol (məs. köhnə seed rolu)
  // dəvətlə ötürülə bilərdi. Altçoxluq + prioritet burada da tətbiq olunur.
  if (b.roleId) {
    const auth = await loadAuthority(c, team);
    if ('res' in auth) return auth.res;

    const target = await new TeamRoleService(c.env).getRole(String(b.roleId));
    if (target && String(target.team_id) === String(team.id)) {
      const denyRank = denyHigherPriority(auth.authority, target.priority,
        'Özünüzdən yüksək prioritetli rola dəvət göndərə bilməzsiniz');
      if (denyRank) return denyRank;
      const denyGrant = denyEscalation(auth.authority, expandPermissions(target.permissions));
      if (denyGrant) return denyGrant;
    }
  }

  const invite = await inviteService.createInvite(team.id, c.user!.id, email || undefined, targetUserId || undefined, b.roleId);

  // Daxili bildiriş — dərhal, email isə növbədən (queue) gedir.
  if (targetUserId) {
    const notify = new TeamNotifyService(c.env);
    c.ctx.waitUntil(notify.toUser(targetUserId, c.user!.id, actorName(c), 'team_invite',
      `${team.name} komandasına dəvət aldınız`));
  }

  emit(c, {
    type: 'InvitationSent',
    teamId: team.id,
    inviteId: invite.id,
    email: invite.email || '',
    invitedBy: c.user!.id,
    userId: targetUserId || '',
  } as any);

  return json({ id: invite.id });
}

export async function getTeamInvites(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_invites');
  if (denied) return denied;

  const invites = await new TeamInviteService(c.env).listInvites(r.team.id);
  return json({ invites });
}

/** Cari istifadəçiyə gələn dəvətlər. */
export async function getMyInvites(c: Ctx) {
  const email = (c.user as any)?.email || (c.user as any)?.contact_email || null;
  const invites = await new TeamInviteService(c.env).listInvitesForUser(c.user!.id, email);
  return json({ invites });
}

export async function acceptTeamInvite(c: Ctx, inviteId: string) {
  const email = (c.user as any)?.email || (c.user as any)?.contact_email || null;
  const inviteService = new TeamInviteService(c.env);
  try {
    const res = await inviteService.acceptInvite(inviteId, c.user!.id, email);
    emit(c, { type: 'MemberJoined', teamId: res.teamId, userId: c.user!.id, roleId: res.roleId });

    const team = await new TeamService(c.env).getTeam(res.teamId);
    return json({ success: true, teamId: res.teamId, slug: team?.slug || null });
  } catch (e: any) {
    return err(e.message, 400);
  }
}

export async function declineTeamInvite(c: Ctx, inviteId: string) {
  const email = (c.user as any)?.email || (c.user as any)?.contact_email || null;
  try {
    await new TeamInviteService(c.env).declineInvite(inviteId, c.user!.id, email);
    return json({ success: true });
  } catch (e: any) {
    return err(e.message, 400);
  }
}

export async function deleteTeamInvite(c: Ctx, idOrSlug: string, inviteId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_invites');
  if (denied) return denied;

  const invite = await new TeamInviteService(c.env).getInvite(inviteId);
  if (!invite || String(invite.team_id) !== String(r.team.id)) return err('Dəvət tapılmadı', 404);

  await new TeamInviteService(c.env).deleteInvite(inviteId);
  return json({ success: true });
}

/* ================= Projects ================= */

export async function getTeamProjects(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;
  const { team } = r;

  const denied = await requireTeamRead(c, team);
  if (denied) return denied;

  const member = await getMembership(c, team.id);
  const isTeamAdmin = c.isAdmin || hasPermission(member?.permissions, 'manage_projects');

  const rows = await new TeamProjectService(c.env).getProjectsFor(team.id, c.user!.id);

  const projects = rows
    .filter(p => isTeamAdmin || p.is_member || normalizeVisibility(p.visibility) === 'Public')
    .map(p => ({
      ...p,
      isMember: !!p.is_member,
      isAdmin: !!p.is_project_admin || isTeamAdmin,
      hasPendingRequest: !!p.has_pending_request,
    }));

  return json({ projects });
}

export async function createTeamProject(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_projects');
  if (denied) return denied;

  const b = await readJson(c.req);
  const name = String(b.name || '').trim();
  if (!name) return err('Layihə adı tələb olunur', 400);

  const id = await new TeamProjectService(c.env)
    .createProject(r.team.id, c.user!.id, name, b.description, b.visibility);

  const notify = new TeamNotifyService(c.env);
  c.ctx.waitUntil(notify.broadcast(r.team.id, c.user!.id, actorName(c), 'team_project',
    `${r.team.name}: yeni layihə — ${name}`));

  emit(c, { type: 'ProjectCreated', teamId: r.team.id, projectId: id, createdBy: c.user!.id });
  return json({ id });
}

export async function updateTeamProject(c: Ctx, idOrSlug: string, projectId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_projects');
  if (denied) return denied;

  const projectService = new TeamProjectService(c.env);
  const project = await projectService.getProject(projectId);
  if (!project || String(project.team_id) !== String(r.team.id)) return err('Layihə tapılmadı', 404);

  const b = await readJson(c.req);
  const res = await projectService.updateProject(projectId, b);

  if (res?.justCompleted) {
    await new TeamService(c.env).addXp(r.team.id, TEAM_XP.PROJECT_FINISHED);
    emit(c, {
      type: 'ProjectCompleted', teamId: r.team.id, projectId,
      completedBy: c.user!.id, xp: TEAM_XP.PROJECT_FINISHED,
    } as any);
  }
  return json({ success: true });
}

export async function deleteTeamProject(c: Ctx, idOrSlug: string, projectId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_projects');
  if (denied) return denied;

  const projectService = new TeamProjectService(c.env);
  const project = await projectService.getProject(projectId);
  if (!project || String(project.team_id) !== String(r.team.id)) return err('Layihə tapılmadı', 404);

  await projectService.deleteProject(projectId);
  emit(c, { type: 'ProjectDeleted', teamId: r.team.id, projectId, userId: c.user!.id } as any);
  return json({ success: true });
}

export async function joinTeamProject(c: Ctx, idOrSlug: string, projectId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamRead(c, r.team);
  if (denied) return denied;

  const projectService = new TeamProjectService(c.env);
  const project = await projectService.getProject(projectId);
  if (!project || String(project.team_id) !== String(r.team.id)) return err('Layihə tapılmadı', 404);
  if (normalizeVisibility(project.visibility) !== 'Public') return err('Layihə açıq deyil', 403, 'forbidden');

  try {
    const reqId = await projectService.applyToProject(project.id, c.user!.id);
    const notify = new TeamNotifyService(c.env);
    c.ctx.waitUntil(notify.toManagers(r.team.id, c.user!.id, actorName(c), 'team_project_request',
      `${project.name} layihəsinə qoşulma sorğusu`));
    return json({ reqId });
  } catch (e: any) {
    return err(e.message, 400);
  }
}

export async function getProjectRequests(c: Ctx, idOrSlug: string, projectId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_projects');
  if (denied) return denied;

  const requests = await new TeamProjectService(c.env).getProjectRequests(projectId);
  return json({ requests });
}

export async function approveProjectRequest(c: Ctx, idOrSlug: string, _projectId: string, reqId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_projects');
  if (denied) return denied;

  const req = await new TeamProjectService(c.env).approveRequest(reqId);
  if (!req) return err('Sorğu tapılmadı', 404);

  const notify = new TeamNotifyService(c.env);
  c.ctx.waitUntil(notify.toUser(String(req.user_id), c.user!.id, actorName(c), 'team_project',
    'Layihəyə qoşulma sorğunuz təsdiqləndi'));
  return json({ success: true });
}

export async function rejectProjectRequest(c: Ctx, idOrSlug: string, _projectId: string, reqId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_projects');
  if (denied) return denied;

  const req = await new TeamProjectService(c.env).rejectRequest(reqId);
  if (!req) return err('Sorğu tapılmadı', 404);
  return json({ success: true });
}

/* ================= Tasks ================= */

export async function getTeamTasks(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamRead(c, r.team);
  if (denied) return denied;

  const tasks = await new TeamTaskService(c.env).getTasks(r.team.id, {
    projectId: c.url.searchParams.get('projectId') || undefined,
    status: c.url.searchParams.get('status') || undefined,
    assigneeId: c.url.searchParams.get('assigneeId') || undefined,
  });
  return json({ tasks });
}

export async function createTeamTask(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_tasks');
  if (denied) return denied;

  const b = await readJson(c.req);
  if (!b.projectId) return err('Layihə seçilməlidir', 400);
  const title = String(b.title || '').trim();
  if (!title) return err('Başlıq tələb olunur', 400);

  const project = await new TeamProjectService(c.env).getProject(String(b.projectId));
  if (!project || String(project.team_id) !== String(r.team.id)) return err('Layihə tapılmadı', 404);

  // AUDIT M-15 — `assigneeId` üzvlük yoxlaması OLMADAN qəbul olunurdu: komanda
  // idarəçisi PLATFORMANIN İSTƏNİLƏN istifadəçisinə tapşırıq təyin edib ona
  // bildiriş göndərə bilirdi (bildiriş spam vektoru + yad komandanın işi
  // istifadəçinin siyahısında görünürdü).
  const denyAssignee = await denyNonMemberAssignee(c, r.team.id, b.assigneeId);
  if (denyAssignee) return denyAssignee;

  const id = await new TeamTaskService(c.env).createTask(
    String(b.projectId), title, b.description, b.assigneeId, b.priority, b.estimatedHours, b.deadline,
  );

  if (b.assigneeId) {
    const notify = new TeamNotifyService(c.env);
    c.ctx.waitUntil(notify.toUser(String(b.assigneeId), c.user!.id, actorName(c), 'team_task',
      `Sizə yeni tapşırıq təyin edildi: ${title}`));
  }

  emit(c, { type: 'TaskAssigned', teamId: r.team.id, taskId: id, assigneeId: b.assigneeId || '' });
  return json({ id });
}

export async function updateTeamTask(c: Ctx, idOrSlug: string, taskId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const taskService = new TeamTaskService(c.env);
  const existing = await taskService.getTask(taskId);
  if (!existing || String(existing.team_id) !== String(r.team.id)) return err('Tapşırıq tapılmadı', 404);

  const b = await readJson(c.req);

  // Yalnız statusu dəyişmək öz tapşırığın üçün icazə tələb etmir; qalan
  // sahələr (başlıq, təyinat, silinmə) `manage_tasks` istəyir.
  const onlyStatus = Object.keys(b).every(k => k === 'status');
  const isAssignee = existing.assignee_id && String(existing.assignee_id) === c.user!.id;
  const denied = onlyStatus && isAssignee
    ? await requireTeamMember(c, r.team.id)
    : await requireTeamPermission(c, r.team.id, 'manage_tasks');
  if (denied) return denied;

  // M-15 — yaratma yolu ilə eyni qayda: təyinat REDAKTƏ ilə də dəyişdirilə
  // bilir, yəni yoxlama yalnız `createTeamTask`-da olsaydı boşluq qalardı.
  if (b.assigneeId !== undefined && b.assigneeId !== null) {
    const denyAssignee = await denyNonMemberAssignee(c, r.team.id, b.assigneeId);
    if (denyAssignee) return denyAssignee;
  }

  const res = await taskService.updateTask(taskId, b);
  if (!res) return err('Tapşırıq tapılmadı', 404);

  if (res.teamXp) await new TeamService(c.env).addXp(r.team.id, res.teamXp);

  if (res.justCompleted) {
    emit(c, {
      type: 'TeamTaskCompleted', teamId: r.team.id, taskId, completedBy: c.user!.id,
    });
    const notify = new TeamNotifyService(c.env);
    c.ctx.waitUntil(notify.broadcast(r.team.id, c.user!.id, actorName(c), 'team_task',
      `Tapşırıq tamamlandı: ${res.task?.title || ''}`));
  } else if (b.assigneeId && b.assigneeId !== existing.assignee_id) {
    emit(c, { type: 'TaskAssigned', teamId: r.team.id, taskId, assigneeId: String(b.assigneeId) });
    const notify = new TeamNotifyService(c.env);
    c.ctx.waitUntil(notify.toUser(String(b.assigneeId), c.user!.id, actorName(c), 'team_task',
      `Sizə tapşırıq təyin edildi: ${res.task?.title || ''}`));
  }

  return json({ success: true, status: res.task?.status, teamXp: res.teamXp });
}

export async function deleteTeamTask(c: Ctx, idOrSlug: string, taskId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_tasks');
  if (denied) return denied;

  const taskService = new TeamTaskService(c.env);
  const existing = await taskService.getTask(taskId);
  if (!existing || String(existing.team_id) !== String(r.team.id)) return err('Tapşırıq tapılmadı', 404);

  await taskService.deleteTask(taskId);
  return json({ success: true });
}

/* ================= Feed ================= */

export async function getTeamFeed(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  // Komanda feed-i YALNIZ üzvlərə görünür (PDR: "yalnız komanda üzvlərinə").
  const denied = await requireTeamMember(c, r.team.id);
  if (denied) return denied;

  const feed = await new TeamFeedService(c.env).getFeed(r.team.id);
  const me = c.user!.id;
  const member = await getMembership(c, r.team.id);
  const canManage = c.isAdmin || hasPermission(member?.permissions, 'manage_feed');

  return json({
    feed: feed.map(p => ({ ...p, kind: p.visibility, canDelete: canManage || String(p.author_id) === me })),
  });
}

export async function createTeamPost(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamMember(c, r.team.id);
  if (denied) return denied;

  const b = await readJson(c.req);
  const content = String(b.content || '').trim();
  if (!content) return err('Content required', 400);

  // Elan (announcement) yalnız `manage_feed` icazəsi olanlara.
  const kind = String(b.kind || b.visibility || 'post');
  if (kind === 'announcement') {
    const denyAnnounce = await requireTeamPermission(c, r.team.id, 'manage_feed');
    if (denyAnnounce) return denyAnnounce;
  }

  const id = await new TeamFeedService(c.env).createPost(r.team.id, c.user!.id, content, kind);
  await new TeamService(c.env).addXp(r.team.id, TEAM_XP.POST_CREATED);

  if (kind === 'announcement') {
    const notify = new TeamNotifyService(c.env);
    c.ctx.waitUntil(notify.broadcast(r.team.id, c.user!.id, actorName(c), 'team_announcement',
      `${r.team.name}: yeni elan`));
  }

  emit(c, { type: 'TeamPostCreated', teamId: r.team.id, postId: id, authorId: c.user!.id });
  return json({ id });
}

export async function deleteTeamPost(c: Ctx, idOrSlug: string, postId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const feedService = new TeamFeedService(c.env);
  const post = await feedService.getPost(postId);
  if (!post || String(post.team_id) !== String(r.team.id)) return err('Post tapılmadı', 404);

  // Əvvəl heç bir yoxlama yox idi — istənilən istifadəçi istənilən postu silirdi.
  const allowed = await canModerate(c, r.team.id, String(post.author_id), 'manage_feed');
  if (!allowed) return err('Bu postu silmək üçün icazəniz yoxdur', 403, 'forbidden');

  await feedService.deletePost(r.team.id, postId);
  return json({ success: true });
}

/* ================= Files ================= */

export async function getTeamFiles(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamMember(c, r.team.id);
  if (denied) return denied;

  const fileService = new TeamFileService(c.env);
  const category = c.url.searchParams.get('category') || undefined;
  const files = await fileService.getFiles(r.team.id, category);
  const usage = await fileService.getUsage(r.team.id);

  const member = await getMembership(c, r.team.id);
  const canManage = c.isAdmin || hasPermission(member?.permissions, 'manage_files');
  const me = c.user!.id;

  return json({
    files: files.map(f => ({
      ...f,
      url: fileUrl(String(f.path)),
      canDelete: canManage || String(f.uploaded_by) === me,
    })),
    usage,
    categories: FILE_CATEGORIES,
  });
}

export async function recordTeamFile(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_files');
  if (denied) return denied;

  const b = await readJson(c.req);
  const path = String(b.path || '');
  if (!path) return err('File path required', 400);

  // Yükləmə `/api/upload?kind=team&teamId=...` ilə gedir və açar
  // `teams/{teamId}/{category}/...` formasındadır. Başqa komandanın açarını
  // öz siyahısına yazmağın qarşısı burada alınır.
  if (!path.startsWith(`teams/${r.team.id}/`)) {
    return err('Fayl açarı bu komandaya aid deyil', 400);
  }

  const id = await new TeamFileService(c.env)
    .recordFile(r.team.id, c.user!.id, path, b.type || 'unknown', Number(b.size) || 0, b.category);
  await new TeamService(c.env).addXp(r.team.id, TEAM_XP.FILE_UPLOADED);

  emit(c, { type: 'FileUploaded', teamId: r.team.id, fileId: id, uploadedBy: c.user!.id });
  return json({ id });
}

export async function deleteTeamFile(c: Ctx, idOrSlug: string, fileId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const fileService = new TeamFileService(c.env);
  const file = await fileService.getFile(fileId);
  if (!file || String(file.team_id) !== String(r.team.id)) return err('Fayl tapılmadı', 404);

  const allowed = await canModerate(c, r.team.id, String(file.uploaded_by), 'manage_files');
  if (!allowed) return err('Bu faylı silmək üçün icazəniz yoxdur', 403, 'forbidden');

  await fileService.deleteFile(r.team.id, fileId);
  return json({ success: true });
}

/* ================= Chat rooms ================= */

export async function getTeamRooms(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamMember(c, r.team.id);
  if (denied) return denied;

  const { results } = await c.env.DB
    .prepare('SELECT * FROM team_chat_rooms WHERE team_id = ? ORDER BY created_at ASC')
    .bind(r.team.id).all<any>();

  const member = await getMembership(c, r.team.id);
  return json({
    rooms: results,
    canManage: c.isAdmin || hasPermission(member?.permissions, 'manage_chat'),
  });
}

export async function createTeamRoom(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_chat');
  if (denied) return denied;

  const b = await readJson(c.req);
  const name = String(b.name || '').trim().slice(0, 40);
  if (!name) return err('Otaq adı tələb olunur', 400);

  const roomId = uuid();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO rooms (id, name, created_by, created_at) VALUES (?, ?, ?, ?)')
      .bind(roomId, `${r.team.name} ${name}`, c.user!.id, now()),
    c.env.DB.prepare("INSERT INTO team_chat_rooms (id, team_id, name, type, created_at) VALUES (?, ?, ?, 'Custom', ?)")
      .bind(roomId, r.team.id, name, now()),
  ]);
  return json({ id: roomId });
}

export async function deleteTeamRoom(c: Ctx, idOrSlug: string, roomId: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamPermission(c, r.team.id, 'manage_chat');
  if (denied) return denied;

  const room = await c.env.DB.prepare('SELECT * FROM team_chat_rooms WHERE id = ? AND team_id = ?')
    .bind(roomId, r.team.id).first<any>();
  if (!room) return err('Otaq tapılmadı', 404);
  if (room.type === 'General') return err('General otağı silinə bilməz', 400);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM team_chat_rooms WHERE id = ?').bind(roomId),
    c.env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId),
  ]);
  return json({ success: true });
}

/* ================= Activity & Stats ================= */

export async function getTeamActivity(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamRead(c, r.team);
  if (denied) return denied;

  // AUDIT L-6 — `before=abc` → `Number('abc')` = NaN → SQL-ə NaN gedir və
  // müqayisə HEÇ VAXT doğru olmur: siyahı səbəbsiz boş qayıdır. `limit`
  // onsuz da clamp olunurdu; eyni naxış `before`-a da tətbiq edilir.
  // ⚠ `searchParams.get()` PARAMETR YOXDURSA `null` qaytarır və `Number(null)`
  // sıfırdır — sıfır isə `Number.isFinite`-dan KEÇİR. Yəni birbaşa
  // `Number(...)` yazsaq parametrsiz sorğuda limit 1-ə düşərdi (siyahı bir
  // sətirlə qayıdardı). Ona görə əvvəlcə sətrin özü yoxlanılır.
  const limitParam = c.url.searchParams.get('limit');
  const rawLimit = limitParam === null || limitParam === '' ? NaN : Number(limitParam);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

  const beforeParam = c.url.searchParams.get('before');
  const rawBefore = beforeParam === null || beforeParam === '' ? NaN : Number(beforeParam);
  const before = Number.isFinite(rawBefore) && rawBefore > 0 ? rawBefore : null;
  const activities = await new TeamActivityService(c.env)
    .getActivities(r.team.id, limit, before);
  return json({ activities });
}

export async function getTeamStats(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamRead(c, r.team);
  if (denied) return denied;

  const stats = await new TeamStatisticsService(c.env).getStatistics(r.team.id);
  return json({ stats });
}

/* ================= Search helpers ================= */

export async function searchUsers(c: Ctx) {
  const q = (c.url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ users: [] });
  // L-3: `%`/`_` escape olunur — əks halda `%` bütün cədvəli qaytarır və
  // `_` "istənilən simvol" kimi oxunub yalançı nəticə verir.
  const like = likePattern(q);
  const rows = await c.env.DB.prepare(
    `SELECT id, username, name, photo_url, xp FROM users
      WHERE blocked = 0 AND (name LIKE ? ESCAPE '\\' OR username LIKE ? ESCAPE '\\')
      ORDER BY xp DESC LIMIT 10`
  ).bind(like, like).all<any>();
  return json({ users: rows.results });
}

export async function suggestUsers(c: Ctx) {
  const teamId = c.url.searchParams.get('teamId');
  if (teamId) {
    // Komanda kontekstində artıq üzv olanları təklif etməyin mənası yoxdur.
    const rows = await c.env.DB.prepare(
      `SELECT u.id, u.username, u.name, u.photo_url, u.xp FROM users u
        WHERE u.blocked = 0
          AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.team_id = ? AND m.user_id = u.id)
        ORDER BY u.xp DESC LIMIT 5`
    ).bind(teamId).all<any>();
    return json({ users: rows.results });
  }
  const rows = await c.env.DB
    .prepare('SELECT id, username, name, photo_url, xp FROM users WHERE blocked = 0 ORDER BY xp DESC LIMIT 5')
    .all<any>();
  return json({ users: rows.results });
}

/**
 * Komanda daxili birləşdirilmiş axtarış (PDR "Search": Teams, Members,
 * Projects, Tasks, Files).
 */
export async function searchTeamWorkspace(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamMember(c, r.team.id);
  if (denied) return denied;

  const q = (c.url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ members: [], projects: [], tasks: [], files: [], posts: [] });
  const like = likePattern(q);   // L-3
  const D = c.env.DB;

  const res = await D.batch([
    D.prepare(
      `SELECT u.id, u.username, u.name, r.name AS role_name
         FROM team_members m JOIN users u ON m.user_id = u.id
         JOIN team_roles r ON m.role_id = r.id
        WHERE m.team_id = ? AND (u.name LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\') LIMIT 10`
    ).bind(r.team.id, like, like),
    D.prepare(
      `SELECT id, name, description, status, visibility FROM team_projects
        WHERE team_id = ? AND status != 'deleted' AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\') LIMIT 10`
    ).bind(r.team.id, like, like),
    D.prepare(
      `SELECT t.id, t.title, t.status, t.priority, p.name AS project_name
         FROM team_tasks t JOIN team_projects p ON t.project_id = p.id
        WHERE p.team_id = ? AND t.status != 'Deleted' AND (t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\') LIMIT 10`
    ).bind(r.team.id, like, like),
    D.prepare(
      `SELECT id, path, type, size, category FROM team_files
        WHERE team_id = ? AND path LIKE ? ESCAPE '\\' LIMIT 10`
    ).bind(r.team.id, like),
    D.prepare(
      `SELECT p.id, p.content, p.created_at, u.username FROM team_posts p
         JOIN users u ON p.author_id = u.id
        WHERE p.team_id = ? AND p.content LIKE ? ESCAPE '\\' LIMIT 10`
    ).bind(r.team.id, like),
  ]);

  // Vectorize qurulubsa açar-söz nəticələrinə semantik uyğunluqlar da əlavə
  // olunur; qurulmayıbsa `semantic: null` gedir və UI onu sadəcə göstərmir.
  const { TeamAIService } = await import('./services/team/ai.service');
  const semantic = await new TeamAIService(c.env).semanticSearch(r.team.id, q);

  return json({
    members: res[0].results,
    projects: res[1].results,
    tasks: res[2].results,
    files: (res[3].results as any[]).map(f => ({ ...f, url: fileUrl(String(f.path)) })),
    posts: res[4].results,
    semantic,
  });
}

/** AI xülasəsi — komanda tapşırıqları (PDR "Task Summary"). */
export async function getTeamAISummary(c: Ctx, idOrSlug: string) {
  const r = await loadTeam(c, idOrSlug);
  if ('res' in r) return r.res;

  const denied = await requireTeamMember(c, r.team.id);
  if (denied) return denied;

  const tasks = await new TeamTaskService(c.env).getTasks(r.team.id);
  const { TeamAIService } = await import('./services/team/ai.service');
  const summary = await new TeamAIService(c.env).summarizeTasks(tasks as any);

  return json({ summary, available: summary !== null });
}

/* ================= Admin ================= */

export async function adminTeamAction(c: Ctx, teamId: string) {
  const b = await readJson(c.req);
  const teamService = new TeamService(c.env);
  const team = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(teamId).first<any>();
  if (!team) return err('Team not found', 404);

  const action = String(b.action);
  switch (action) {
    case 'delete':
      await teamService.deleteTeam(teamId);
      break;
    case 'restore':
      await teamService.restoreTeam(teamId);
      break;
    case 'visibility':
      await teamService.updateTeam(teamId, { visibility: b.visibility });
      break;
    default:
      return err('Naməlum əməliyyat', 400, 'invalid_action');
  }

  // AUDIT M-11 — bu yol audit jurnalına HEÇ NƏ yazmırdı: sayt admini komandanı
  // silə, bərpa edə və görünürlüyünü dəyişə bilirdi və əməliyyat İZSİZ qalırdı.
  // ⚠ Yalnız AUDİT YAZISI əlavə olunur — avtorizasiya məntiqinə toxunulmur
  // (AUDIT-TASK-3 §8/5 bu yolun ayrı olduğunu qeyd etmişdi).
  await logAdmin(c, 'team-' + action, teamId,
    action === 'visibility' ? String(b.visibility ?? '') : String(team.name ?? ''));
  return json({ success: true });
}

export async function adminTeamDetail(c: Ctx, teamId: string) {
  const team = await c.env.DB.prepare(
    `SELECT t.*, u.username, u.name AS owner_name FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id WHERE t.id = ?`
  ).bind(teamId).first<any>();
  if (!team) return err('Team not found', 404);

  const [members, projects, stats] = await Promise.all([
    new TeamMemberService(c.env).getMembers(teamId),
    new TeamProjectService(c.env).getProjects(teamId),
    new TeamStatisticsService(c.env).getStatistics(teamId),
  ]);
  return json({ team, members, projects, stats });
}
