// Moderasiya endpointləri — AUDIT-TASK-10 / FAZA A2 (PRD §4, §16).
//
// Xəbərdarlıq / susdurma / bloklama / bərpa + rol və icazə idarəsi.
//
// ⚠ HƏR ENDPOINT `requirePermission` İLƏ QORUNUR, `route.admin` bayrağı ilə
//   YOX. Fərq mühümdür: `admin` bayrağı BİNARdır (admin/deyil), icazə isə
//   rol ierarxiyasını nəzərə alır — MODERATOR xəbərdarlıq verə bilər, lakin
//   bloklaya bilməz (PRD §6).
//
// ⚠ ESKALASİYA: hər cəza `assertCanModerate` -dən keçir — moderator özündən
//   yüksək rollu istifadəçiyə toxuna bilməz. Task 3 / H-1-in qlobal qarşılığı.
import { Ctx, json, err, readJson, uuid, now, clampStr } from '../util';
import {
  requirePermission, can, roleOf, priorityOf, invalidateRbac,
  moderationState, assertCanAssignRole, permissionsOf, type RoleName,
} from '../rbac';
import { grantReputation } from '../progression';
import { logAdmin } from '../admin-log';
import { kickEverywhere } from '../ws-kick';
import { destroyAllSessions } from '../auth';
import { D, badReq } from './shared';

/**
 * Hədəfin çağırandan AŞAĞI rolda olduğunu təsdiqləyir.
 *
 * ⚠ Bu yoxlama olmasa iki moderator bir-birini bloklaya bilərdi (qarşılıqlı
 *   məhv) və daha pisi — moderator OWNER-i susdura bilərdi.
 */
async function assertCanModerate(c: Ctx, targetUid: string): Promise<Response | null> {
  if (targetUid === c.user!.id) {
    return err('Özünüzə cəza tətbiq edə bilməzsiniz.', 400, 'self_moderation');
  }
  const [callerRole, targetRole] = await Promise.all([
    roleOf(c.env, c.user!.id), roleOf(c.env, targetUid),
  ]);
  const [cp, tp] = await Promise.all([
    priorityOf(c.env, callerRole), priorityOf(c.env, targetRole),
  ]);
  if (tp >= cp) return err('Bu istifadəçiyə təsir edə bilməzsiniz.', 403, 'target_outranks');
  return null;
}

/** Hədəfin mövcudluğu + cəza parametrləri. */
async function readTarget(c: Ctx, uid: string) {
  const b = await readJson(c.req);
  const row = await D(c).prepare('SELECT id FROM users WHERE id = ?').bind(uid).first<any>();
  const reason = clampStr(b.reason, 500).trim();
  // `durationMin` verilməzsə cəza DAİMİDİR (`expires_at = NULL`).
  const minutes = Number.isFinite(Number(b.durationMin)) ? Number(b.durationMin) : 0;
  return {
    exists: !!row,
    reason,
    expiresAt: minutes > 0 ? now() + minutes * 60_000 : null,
  };
}

/* ═══════════════════════ XƏBƏRDARLIQ ═══════════════════════ */

export async function warnUser(c: Ctx, uid: string) {
  const denied = await requirePermission(c, 'WARN_USER');
  if (denied) return denied;
  const rank = await assertCanModerate(c, uid);
  if (rank) return rank;

  const { exists, reason } = await readTarget(c, uid);
  if (!exists) return err('İstifadəçi tapılmadı.', 404);
  if (!reason) return badReq('Səbəb yazılmalıdır.');

  const id = uuid();
  await D(c).prepare(
    'INSERT INTO warnings (id, uid, by_uid, reason, created_at) VALUES (?,?,?,?,?)',
  ).bind(id, uid, c.user!.id, reason, now()).run();

  // PRD §8: xəbərdarlıq reputasiyanı AZALDIR.
  c.ctx.waitUntil(grantReputation(c.env, uid, 'warning', id).then(() => {}));
  await logAdmin(c, 'user-warn', uid, reason.slice(0, 120), 'warning');
  return json({ ok: true, id });
}

export async function listWarnings(c: Ctx, uid: string) {
  const denied = await requirePermission(c, 'VIEW_REPORTS');
  if (denied) return denied;
  const rows = await D(c).prepare(
    'SELECT id, by_uid, reason, created_at FROM warnings WHERE uid = ? ORDER BY created_at DESC LIMIT 50',
  ).bind(uid).all<any>();
  return json({ warnings: rows.results });
}

/* ═══════════════════════ SUSDURMA / BLOKLAMA ═══════════════════════ */

/**
 * Susdurma və bloklama EYNİ formadadır, ona görə tək köməkçi.
 *
 * ⚠ BLOKLAMA sessiyaları da ləğv edir və WS soketlərini kəsir (AUDIT-TASK-9 /
 *   H-6): əks halda bloklanan istifadəçi açıq soket üzərindən yazmağa davam
 *   edərdi. SUSDURMA sessiyanı ləğv ETMİR — istifadəçi oxuya bilər, yaza bilməz.
 */
async function applyPenalty(
  c: Ctx, uid: string, table: 'bans' | 'mutes', perm: string, action: string,
) {
  const denied = await requirePermission(c, perm);
  if (denied) return denied;
  const rank = await assertCanModerate(c, uid);
  if (rank) return rank;

  const { exists, reason, expiresAt } = await readTarget(c, uid);
  if (!exists) return err('İstifadəçi tapılmadı.', 404);
  if (!reason) return badReq('Səbəb yazılmalıdır.');

  const id = uuid();
  await D(c).prepare(
    `INSERT INTO ${table} (id, uid, by_uid, reason, expires_at, created_at) VALUES (?,?,?,?,?,?)`,
  ).bind(id, uid, c.user!.id, reason, expiresAt, now()).run();

  if (table === 'bans') {
    // Köhnə `users.blocked` bayrağı da qaldırılır: mövcud yoxlamalar
    // (`resolveUser`, `serveFile`) ona baxır — iki mənbəni uzlaşdırmasaq
    // ban yalnız yeni kodda təsir edərdi.
    await D(c).prepare('UPDATE users SET blocked = 1 WHERE id = ?').bind(uid).run();
    await destroyAllSessions(c.env, uid);
    c.ctx.waitUntil(kickEverywhere(c.env, uid));
  }
  invalidateRbac(uid);
  await logAdmin(c, action, uid, reason.slice(0, 120), 'error');
  return json({ ok: true, id, expiresAt });
}

export const banUser = (c: Ctx, uid: string) => applyPenalty(c, uid, 'bans', 'BAN_USER', 'user-ban');
export const muteUser = (c: Ctx, uid: string) => applyPenalty(c, uid, 'mutes', 'MUTE_USER', 'user-mute');

/**
 * Cəzanı geri götürür (PRD §4: `RESTORE_USER`).
 *
 * ⚠ `revoked_at` doldurulur, sətir SİLİNMİR — audit izi qalmalıdır
 *   ("kim, nə vaxt, niyə geri götürdü" sualı cavabsız qalmamalıdır).
 */
export async function restoreUser(c: Ctx, uid: string) {
  const denied = await requirePermission(c, 'RESTORE_USER');
  if (denied) return denied;

  const ts = now();
  await D(c).batch([
    D(c).prepare('UPDATE bans  SET revoked_at = ?, revoked_by = ? WHERE uid = ? AND revoked_at IS NULL')
      .bind(ts, c.user!.id, uid),
    D(c).prepare('UPDATE mutes SET revoked_at = ?, revoked_by = ? WHERE uid = ? AND revoked_at IS NULL')
      .bind(ts, c.user!.id, uid),
    D(c).prepare('UPDATE users SET blocked = 0 WHERE id = ?').bind(uid),
  ]);
  invalidateRbac(uid);
  await logAdmin(c, 'user-restore', uid, '', 'success');
  return json({ ok: true });
}

/** İstifadəçinin cari moderasiya vəziyyəti — admin paneli və öz profili üçün. */
export async function moderationStatus(c: Ctx, uid: string) {
  const self = uid === c.user!.id;
  if (!self && !(await can(c.env, c.user!.id, 'VIEW_REPORTS'))) {
    return err('İcazə yoxdur.', 403, 'forbidden');
  }
  return json({ state: await moderationState(c.env, uid) });
}

/* ═══════════════════════ ROL VƏ İCAZƏ İDARƏSİ ═══════════════════════ */

export async function listRoles(c: Ctx) {
  const denied = await requirePermission(c, 'MANAGE_ROLES');
  if (denied) return denied;
  const [roles, perms] = await Promise.all([
    D(c).prepare('SELECT name, priority, label_az FROM roles ORDER BY priority DESC').all<any>(),
    D(c).prepare(
      `SELECT r.role_name, r.permission_name, p.category, p.label_az
         FROM role_permissions r JOIN permissions p ON p.name = r.permission_name`,
    ).all<any>(),
  ]);
  const matrix: Record<string, string[]> = {};
  for (const row of perms.results) {
    (matrix[String(row.role_name)] ||= []).push(String(row.permission_name));
  }
  return json({ roles: roles.results, matrix });
}

export async function setUserRole(c: Ctx, uid: string) {
  const b = await readJson(c.req);
  const role = String(b.role || '') as RoleName;

  // 🔴 Eskalasiya qapısı — `MANAGE_ROLES` yoxlaması da onun içindədir.
  const denied = await assertCanAssignRole(c, uid, role);
  if (denied) return denied;

  const res = await D(c).prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, uid).run();
  if (!res.meta.changes) return err('İstifadəçi tapılmadı.', 404);

  invalidateRbac(uid);
  await logAdmin(c, 'user-role-change', uid, role, 'warning');
  return json({ ok: true, role });
}

/**
 * Fərdi icazə istisnası (roldan kənar əlavə və ya ÇIXARMA).
 *
 * ⚠ `granted: false` rolun verdiyi icazəni ALIR — spam-a görə `CREATE_POST`
 *   müvəqqəti bağlamaq üçün. Olmasaydı yeganə yol rolu aşağı salmaq olardı və
 *   bu, bütün digər icazələri də itirərdi.
 */
export async function setUserPermission(c: Ctx, uid: string) {
  const denied = await requirePermission(c, 'MANAGE_PERMISSIONS');
  if (denied) return denied;
  const rank = await assertCanModerate(c, uid);
  if (rank) return rank;

  const b = await readJson(c.req);
  const perm = clampStr(b.permission, 60);
  const exists = await D(c).prepare('SELECT 1 AS x FROM permissions WHERE name = ?')
    .bind(perm).first<any>();
  if (!exists) return badReq('Belə icazə yoxdur.');

  const minutes = Number.isFinite(Number(b.durationMin)) ? Number(b.durationMin) : 0;
  await D(c).prepare(
    `INSERT INTO user_permissions (uid, permission_name, granted, granted_by, reason, expires_at, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7)
     ON CONFLICT(uid, permission_name) DO UPDATE SET
       granted = excluded.granted, granted_by = excluded.granted_by,
       reason = excluded.reason, expires_at = excluded.expires_at`,
  ).bind(uid, perm, b.granted === false ? 0 : 1, c.user!.id,
    clampStr(b.reason, 300), minutes > 0 ? now() + minutes * 60_000 : null, now()).run();

  invalidateRbac(uid);
  await logAdmin(c, 'user-permission', uid, `${perm}=${b.granted === false ? 0 : 1}`, 'warning');
  return json({ ok: true });
}

/** Cari istifadəçinin öz icazələri — frontend UI-nı ona görə qurur. */
export async function myPermissions(c: Ctx) {
  return json({
    role: await roleOf(c.env, c.user!.id),
    permissions: await permissionsOf(c.env, c.user!.id),
    moderation: await moderationState(c.env, c.user!.id),
  });
}
