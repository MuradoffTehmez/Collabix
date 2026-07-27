// E2E test datasının SABİT identifikatorları — AUDIT-TASK-5 §5.4.
//
// ⚠ NİYƏ AYRICA FAYL: əvvəl testlər miqrasiya ilə yaradılan demo sətirlərə
// (`team_1`, `role_1`, `tcr_1`, `alpha-team`, `teamowner_123`) BİRBAŞA istinad
// edirdi. Nəticədə iki problem yaranırdı:
//
//   1. Demo data İSTEHSAL bazasına düşürdü (AUDIT-2026-07-26 / H-7) — saxta
//      "Team Owner" canlı saytda istifadəçi siyahısında və XP liderliyində
//      görünürdü. Onu silmək testləri sındırırdı, ona görə silinmirdi.
//   2. Test datası miqrasiya TARİXÇƏSİNDƏN asılı idi: `d1_migrations` cədvəli
//      miqrasiyanı "tətbiq olunub" saydıqda wrangler onu bir daha işlətmir —
//      sətirlər bazadan yoxa çıxsa belə (AUDIT-TASK-3 §8/2, AUDIT-TASK-4 §8).
//
// ⚠ `e2e_` PREFİKSİ MƏCBURİDİR: E2E identifikatorları istehsal ID-lərindən
// birmənalı fərqlənməlidir ki, eyni qarışıqlıq təkrarlanmasın.
export const E2E_OWNER = {
  id: 'e2e_team_owner',
  username: 'e2e_teamowner',
  name: 'E2E Team Owner',
} as const;

/** Əsas test komandası — UI testləri (`teams.spec.ts`) bunun üzərində işləyir. */
export const E2E_TEAM = {
  id: 'e2e_team_alpha',
  slug: 'e2e-alpha-team',
  name: 'E2E Alpha Team',
  /** Admin rolu: `manage_team` daşıyır — RBAC testlərində "güclü köhnə rol" nümunəsi. */
  roleId: 'e2e_role_alpha_admin',
  projectId: 'e2e_proj_alpha',
  taskId: 'e2e_task_alpha',
  /** Komanda söhbət otağı (həm `team_chat_rooms`, həm `rooms` sətri). */
  roomId: 'e2e_room_alpha',
} as const;

/** RBAC testləri üçün Private komanda (əsas hesab ÜZV DEYİL). */
export const E2E_TEAM_PRIVATE = {
  id: 'e2e_team_beta',
  slug: 'e2e-beta-team',
  name: 'E2E Beta Team',
  ownerRoleId: 'e2e_role_beta_owner',
} as const;

/** Kəşfiyyat testləri üçün Public komanda. */
export const E2E_TEAM_PUBLIC = {
  id: 'e2e_team_gamma',
  slug: 'e2e-gamma-team',
  name: 'E2E Gamma Team',
  ownerRoleId: 'e2e_role_gamma_owner',
  devRoleId: 'e2e_role_gamma_dev',
} as const;

/**
 * 🟢 BOOTSTRAP data — `0002_seed.sql`-dəki qlobal söhbət otağı.
 *
 * DEMO deyil: tətbiqin işləməsi üçün lazımdır və HEÇ VAXT silinmir
 * (AUDIT-TASK-5 §2.b). E2E seed-i onu `INSERT OR IGNORE` ilə təmin edir ki,
 * test mühiti `0002_seed.sql`-in tətbiq olunub-olunmamasından asılı olmasın.
 */
export const GENERAL_ROOM_ID = 'general';
