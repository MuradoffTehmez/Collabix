// Qlobal rol və icazə sistemi — AUDIT-TASK-10 / FAZA A2 (PRD §4–6).
//
// ════════════════════════════════════════════════════════════════════════════
// NƏYİ ƏVƏZ EDİR
// ════════════════════════════════════════════════════════════════════════════
//
// ƏVVƏL: avtorizasiya BİNAR idi — `SELECT 1 FROM admins WHERE user_id = ?`.
// Yəni HƏR ADMIN TAM SƏLAHİYYƏTLİ idi: yeni moderator təyin etmək üçün ona
// bütün sistem üzərində hakimiyyət vermək lazım gəlirdi. `users.role` sütunu
// mövcud idi, lakin heç bir qərarda oxunmurdu (Task 10 ölçməsi: cəmi 2 yer —
// CSV sütunu və `mapUser`).
//
// İNDİ: PRD §5-in tələbi — *"Backend hər əməliyyatda Permission yoxlamalıdır.
// Role yalnız default permission təyin edir."*
//
// ⚠ KOMANDA RBAC-INDAN AYRIDIR. `services/team/permissions.ts` komanda daxili
//   icazələri idarə edir (Task 3 / H-1). Bir istifadəçi qlobal `USER`, lakin
//   öz komandasında `Owner` ola bilər — iki sahə kəsişmir.
//
// ⚠ TASK 3-ÜN DƏRSİ TƏTBİQ OLUNUB: orada `hasPermission` wildcard-ı QƏBUL
//   edir, `sanitizePermissions` isə RƏDD edir (giriş yolu ≠ qiymətləndirmə
//   yolu). Burada eyni ayrım var: `can()` bazadakı matrisi oxuyur,
//   `assertCanAssignRole` isə İSTİFADƏÇİ girişini yoxlayır.
import type { Env, Ctx } from './util';
import { err, now } from './util';

/** PRD §4 rol enum-u — `roles` cədvəlindəki adlarla HƏRFİ eyni. */
export type RoleName =
  | 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'SENIOR_MODERATOR' | 'MODERATOR'
  | 'HELPER' | 'PREMIUM' | 'VERIFIED' | 'USER' | 'GUEST';

/** Runtime yoxlaması üçün — tip birləşməsi kompilyasiyadan sonra itir. */
export const ROLE_NAMES: readonly RoleName[] = [
  'OWNER', 'SUPER_ADMIN', 'ADMIN', 'SENIOR_MODERATOR', 'MODERATOR',
  'HELPER', 'PREMIUM', 'VERIFIED', 'USER', 'GUEST',
];

/**
 * 🔴 FAIL-SAFE rol normallaşdırması — istehsal qüsurundan sonra əlavə olundu
 *    (bax `migrations/0038_fix_user_role_default.sql`).
 *
 * `users.role` sütununun DEFAULT-u `'user'`-dir (kiçik hərf, 0001-dən), `roles`
 * cədvəlindəki ad isə `'USER'`. Qeydiyyat sütunu açıq təyin etmədiyi üçün hər
 * yeni hesab etibarsız dəyər alırdı və `role_permissions` sorğusu SIFIR sətir
 * qaytarırdı — yəni istifadəçinin HEÇ BİR icazəsi olmurdu.
 *
 * ⚠ NİYƏ `USER`-Ə DÜŞÜR, XƏTA ATMIR: bu, ən AŞAĞI real roldur və yalnız baza
 *   məzmun icazələrini verir. Xəta atsaydıq bir pozuq sətir istifadəçini
 *   tamamilə bloklayardı; daha yuxarı rola düşsəydik bu, eskalasiya olardı.
 *
 * ⚠ `toUpperCase()` KİFAYƏT DEYİL — ağ siyahı da yoxlanılır: silinmiş və ya
 *   səhv yazılmış rol adı sükutla keçməməlidir.
 */
export function normalizeRole(v: unknown): RoleName {
  const s = String(v ?? '').trim().toUpperCase();
  return (ROLE_NAMES as readonly string[]).includes(s) ? (s as RoleName) : 'USER';
}

/**
 * İcazə keşi — uid → {icazələr, bitmə anı}.
 *
 * ⚠ NİYƏ KEŞ: `can()` hər qorunan əməliyyatda çağırılır. Keşsiz hər sorğu
 *   `role_permissions` + `user_permissions` üzrə iki D1 sorğusu deməkdir.
 *
 * ⚠ NİYƏ QISA TTL (30 s): rol dəyişikliyi DƏRHAL təsir etməlidir. Task 7-nin
 *   üzvlük keşi (60 s) ilə eyni naxış, lakin daha qısa — rol dəyişməsi nadir,
 *   lakin təsiri böyükdür. Açıq invalidasiya da var (`invalidateRbac`).
 *
 * ⚠ Modul səviyyəsində Map: bir isolate bir neçə sorğu emal edir, LAKİN keş
 *   uid ilə açarlanır və dəyər istifadəçiyə xasdır — qarışma yoxdur
 *   (request-context.ts-dəki qlobal dəyişən probleminə BƏNZƏMİR).
 */
const cache = new Map<string, { perms: Set<string>; role: RoleName; until: number }>();
const CACHE_TTL_MS = 30_000;

export function invalidateRbac(uid: string): void {
  cache.delete(uid);
}

interface Resolved { role: RoleName; perms: Set<string> }

/**
 * İstifadəçinin EFFEKTİV icazələri: rol matrisi + fərdi istisnalar.
 *
 * Hesablama sırası MƏNALIDIR:
 *   1. `role_permissions` — rolun verdiyi baza dəst
 *   2. `user_permissions` — fərdi əlavə (`granted = 1`) və ÇIXARMA (`granted = 0`)
 * Fərdi çıxarma rolu üstələyir: spam-a görə `CREATE_POST` alınmış istifadəçi
 * rolunu saxlasa da yaza bilmir.
 *
 * ⚠ Vaxtı bitmiş fərdi icazə NƏZƏRƏ ALINMIR (`expires_at`).
 */
async function resolve(env: Env, uid: string): Promise<Resolved> {
  const hit = cache.get(uid);
  if (hit && hit.until > Date.now()) return { role: hit.role, perms: hit.perms };

  const row = await env.DB.prepare('SELECT role FROM users WHERE id = ?')
    .bind(uid).first<any>();
  const role = normalizeRole(row?.role);

  const [base, overrides] = await Promise.all([
    env.DB.prepare('SELECT permission_name FROM role_permissions WHERE role_name = ?')
      .bind(role).all<any>(),
    env.DB.prepare(
      `SELECT permission_name, granted FROM user_permissions
        WHERE uid = ?1 AND (expires_at IS NULL OR expires_at > ?2)`,
    ).bind(uid, now()).all<any>(),
  ]);

  const perms = new Set<string>(base.results.map(r => String(r.permission_name)));
  for (const o of overrides.results) {
    if (Number(o.granted) === 1) perms.add(String(o.permission_name));
    else perms.delete(String(o.permission_name));
  }

  cache.set(uid, { perms, role, until: Date.now() + CACHE_TTL_MS });
  return { role, perms };
}

/** Konkret icazənin olub-olmaması. Qonaq (uid yoxdur) HƏMİŞƏ `false`. */
export async function can(env: Env, uid: string | null | undefined, perm: string): Promise<boolean> {
  if (!uid) return false;
  const { perms } = await resolve(env, uid);
  return perms.has(perm);
}

export async function roleOf(env: Env, uid: string): Promise<RoleName> {
  return (await resolve(env, uid)).role;
}

export async function permissionsOf(env: Env, uid: string): Promise<string[]> {
  return [...(await resolve(env, uid)).perms].sort();
}

/** Rolun prioriteti — "kim kimə təsir edə bilər" müqayisəsi üçün. */
export async function priorityOf(env: Env, role: RoleName): Promise<number> {
  const r = await env.DB.prepare('SELECT priority FROM roles WHERE name = ?')
    .bind(role).first<any>();
  return Number(r?.priority ?? 0);
}

/**
 * Marşrut qoruyucusu — `Ctx` üçün.
 *
 * `null` qaytarırsa əməliyyat davam edir; `Response` qaytarırsa dayandırılır.
 * `index.ts`-dəki `route.admin` bayrağı ilə EYNİ naxışdır.
 */
export async function requirePermission(c: Ctx, perm: string): Promise<Response | null> {
  if (!c.user) return err('Giriş tələb olunur.', 401, 'auth_required');
  if (await can(c.env, c.user.id, perm)) return null;
  return err('İcazə yoxdur.', 403, 'forbidden');
}

/**
 * 🔴 EskALASİYA QAPISI — Task 3 / H-1-in qlobal qarşılığı.
 *
 * Komanda RBAC-ında audit belə bir zəncir tapmışdı: `manage_roles` daşıyan
 * Admin özündə OLMAYAN icazəni verə bilirdi. Qlobal sistemdə eyni risk var:
 * `MANAGE_ROLES` daşıyan SUPER_ADMIN özündən YUXARI rol (OWNER) təyin edə
 * bilməməlidir.
 *
 * İki qayda:
 *   1. Hədəf rolun prioriteti çağıranınkindən AŞAĞI olmalıdır
 *   2. Çağıran ÖZ rolunu dəyişə bilməz (özünü yüksəltmə)
 */
export async function assertCanAssignRole(
  c: Ctx, targetUid: string, targetRole: RoleName,
): Promise<Response | null> {
  const denied = await requirePermission(c, 'MANAGE_ROLES');
  if (denied) return denied;

  if (targetUid === c.user!.id) {
    return err('Öz rolunuzu dəyişə bilməzsiniz.', 403, 'self_role_change');
  }
  const exists = await c.env.DB.prepare('SELECT 1 AS x FROM roles WHERE name = ?')
    .bind(targetRole).first<any>();
  if (!exists) return err('Belə rol yoxdur.', 400, 'unknown_role');

  const callerRole = await roleOf(c.env, c.user!.id);
  const [callerP, targetP] = await Promise.all([
    priorityOf(c.env, callerRole), priorityOf(c.env, targetRole),
  ]);
  if (targetP >= callerP) {
    return err('Özünüzlə eyni və ya daha yüksək rol təyin edə bilməzsiniz.',
      403, 'role_escalation');
  }
  // Hədəfin CARİ rolu da çağırandan aşağı olmalıdır — əks halda ADMIN
  // OWNER-i aşağı sala bilərdi.
  const cur = await roleOf(c.env, targetUid);
  if ((await priorityOf(c.env, cur)) >= callerP) {
    return err('Bu istifadəçiyə təsir edə bilməzsiniz.', 403, 'target_outranks');
  }
  return null;
}

/* ═══════════════════════ MODERASİYA VƏZİYYƏTİ ═══════════════════════ */

export interface ModerationState { banned: boolean; muted: boolean; until: number | null }

/**
 * Aktiv ban/mute yoxlaması.
 *
 * ⚠ `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now)` —
 *   "vaxtı bitdi" ilə "ləğv edildi" AYRI hallardır və hər ikisi cəzanı
 *   söndürür, lakin audit izində fərqli görünür.
 */
export async function moderationState(env: Env, uid: string): Promise<ModerationState> {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT MAX(COALESCE(expires_at, 9223372036854775807)) FROM bans
         WHERE uid = ?1 AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?2))  AS ban_until,
       (SELECT MAX(COALESCE(expires_at, 9223372036854775807)) FROM mutes
         WHERE uid = ?1 AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?2))  AS mute_until`,
  ).bind(uid, now()).first<any>();

  const ban = row?.ban_until ?? null;
  const mute = row?.mute_until ?? null;
  return {
    banned: ban !== null,
    muted: mute !== null,
    until: ban ?? mute ?? null,
  };
}
