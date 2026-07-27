// Komanda icazə modeli — TASK-11.
//
// Bir yerdə saxlanılır ki, həm rol seed-i, həm middleware, həm də UI eyni
// siyahını görsün. Əvvəllər icazə adları kodun içində səpələnmişdi və
// `createTeam` yalnız "Owner" rolu yaradırdı — nəticədə dəvət qəbul edən
// istifadəçi (ən aşağı prioritetli rol = yeganə rol = Owner) tam səlahiyyət
// alırdı. Bax: docs/TASK-11-REPORT.md K1.

export const TEAM_PERMISSIONS = [
  'manage_team',      // ad/açıqlama/görünürlük, komandanı silmək
  'manage_settings',  // parametrlər
  'manage_roles',     // rol yaratmaq/dəyişmək/silmək
  'manage_members',   // rol təyinatı, kənarlaşdırma
  'manage_invites',   // dəvət yaratmaq/ləğv etmək
  'manage_projects',  // layihə CRUD + qoşulma sorğuları
  'manage_tasks',     // tapşırıq CRUD + status
  'manage_files',     // fayl yükləmək/silmək
  'manage_feed',      // elan/post silmək (öz postunu hər üzv silə bilir)
  'manage_chat',      // otaq yaratmaq/silmək
] as const;

export type TeamPermission = (typeof TEAM_PERMISSIONS)[number];

export interface RoleTemplate {
  name: string;
  permissions: string[];
  priority: number;
}

/** PDR-dəki 10 standart rol. `priority` böyükdürsə səlahiyyət yüksəkdir. */
export const STANDARD_ROLES: RoleTemplate[] = [
  { name: 'Owner', permissions: ['*'], priority: 100 },
  {
    name: 'Admin',
    // Owner-dən fərqi: komandanı silə/sahibliyi köçürə bilmir (`manage_team`).
    permissions: [
      'manage_settings', 'manage_roles', 'manage_members', 'manage_invites',
      'manage_projects', 'manage_tasks', 'manage_files', 'manage_feed', 'manage_chat',
    ],
    priority: 90,
  },
  {
    name: 'Manager',
    permissions: ['manage_projects', 'manage_tasks', 'manage_invites', 'manage_files', 'manage_feed'],
    priority: 70,
  },
  { name: 'Mentor', permissions: ['manage_tasks', 'manage_feed'], priority: 60 },
  { name: 'Moderator', permissions: ['manage_feed', 'manage_chat'], priority: 55 },
  { name: 'DevOps', permissions: ['manage_tasks', 'manage_files'], priority: 50 },
  { name: 'Developer', permissions: ['manage_tasks', 'manage_files'], priority: 45 },
  { name: 'Designer', permissions: ['manage_tasks', 'manage_files'], priority: 40 },
  { name: 'QA', permissions: ['manage_tasks'], priority: 35 },
  { name: 'Viewer', permissions: [], priority: 10 },
];

/**
 * Dəvət qəbul edildikdə verilən rol. QƏSDƏN "Developer"-dir:
 * — "Viewer" olsaydı yeni üzv heç nə edə bilməzdi (məhsul baxımından sınıq),
 * — prioritetə görə seçim (köhnə davranış) Owner qaytarırdı (təhlükəsizlik buqu).
 * Dəvət yaradarkən konkret rol göstərilə bilər (`team_invites.role_id`).
 */
export const DEFAULT_MEMBER_ROLE = 'Developer';

/** Yalnız komanda sahibinin daşıya biləcəyi rol. */
export const OWNER_ROLE = 'Owner';

/**
 * QİYMƏTLƏNDİRMƏ yolu — bazadakı dəyəri oxuyub qərar verir.
 *
 * ⚠ AUDIT-TASK-3 / §5.2: `'*'` dəstəyi BURADAN ÇIXARILA BİLMƏZ. Owner rolu həm
 * `STANDARD_ROLES`-də, həm də E2E seed-ində `permissions = '["*"]'` kimi
 * saxlanılır — wildcard qiymətləndirməsi silinsə HƏR komandanın Owner-i öz
 * komandasından kilidlənər. Eskalasiya GİRİŞ yolunda bağlanır
 * (`sanitizePermissions` + `team-routes.ts`-dəki altçoxluq/prioritet qaydaları).
 */
export function hasPermission(permissions: string[] | null | undefined, required: string): boolean {
  if (!permissions) return false;
  return permissions.includes('*') || permissions.includes(required);
}

/**
 * `'*'` daşıyan dəsti tam kataloqa açır — müqayisə üçün.
 *
 * Altçoxluq qaydası (AUDIT-TASK-3 §3.2) çağıranın dəstini `Set` kimi
 * müqayisə edir; Owner-in `['*']` dəsti açılmasa Owner HEÇ BİR rol yarada
 * bilməzdi (funksional çökmə). Bax: qəbul meyarı 6.
 */
export function expandPermissions(permissions: string[] | null | undefined): string[] {
  if (!permissions || !permissions.length) return [];
  if (permissions.includes('*')) return [...TEAM_PERMISSIONS];
  return permissions.filter(p => (TEAM_PERMISSIONS as readonly string[]).includes(p));
}

/**
 * Çağıranın özündə OLMAYAN, lakin verməyə çalışdığı icazələr.
 *
 * AUDIT-2026-07-26 / H-1: `sanitizePermissions` düzəlişi tək başına kifayət
 * deyil — `manage_roles` daşıyan Admin wildcard olmadan, açıq şəkildə
 * `permissions: ['manage_team']` yazmaqla eyni nəticəyə çatırdı.
 */
export function findEscalatedPermissions(callerPermissions: string[], requested: string[]): string[] {
  const owned = new Set(expandPermissions(callerPermissions));
  return [...new Set(requested.filter(p => !owned.has(p)))];
}

export function parsePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  try {
    const v = JSON.parse(String(raw || '[]'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * İSTİFADƏÇİ girişindən gələn icazə siyahısını təmizləyir — rol CRUD validasiyası.
 *
 * AUDIT-2026-07-26 / H-1: bu funksiya əvvəllər `'*'` qəbul edirdi
 * (`if (list.includes('*')) return ['*']`). `manage_roles` daşıyan Admin
 * `permissions: ['*']` ilə rol yaradıb özünü ora keçirməklə `manage_team`
 * (Owner) səlahiyyətini ələ keçirə bilirdi — 3 sorğuluq zəncir.
 *
 * `TEAM_PERMISSIONS` yeganə ağ siyahıdır: `'*'` orada olmadığı üçün filtr onu
 * özü atır — xüsusi `if` lazım deyil, yeni icazə əlavə olunanda avtomatik axır.
 *
 * ⚠ Bu funksiya YALNIZ istifadəçi girişi üçündür. Sistem seed-i (`STANDARD_ROLES`
 * → `TeamRoleService.insertRole`) bu yoldan KEÇMİR — Owner-in `['*']` dəyəri
 * olduğu kimi yazılır.
 * ⚠ Bu, QİYMƏTLƏNDİRMƏ (`hasPermission`) yolu deyil — bax oradakı xəbərdarlıq.
 */
export function sanitizePermissions(input: unknown): string[] {
  const list = Array.isArray(input) ? input.map(String) : [];
  return [...new Set(list.filter(p => (TEAM_PERMISSIONS as readonly string[]).includes(p)))];
}
