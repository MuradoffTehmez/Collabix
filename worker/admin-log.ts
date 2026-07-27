// Admin jurnalı — AUDIT-TASK-6 §B-3 (M-11, M-13).
//
// NİYƏ AYRICA MODUL: `logAdmin` əvvəl `routes.ts` daxilində qapalı funksiya idi.
// M-11 onu `team-routes.ts`-dən də çağırmağı tələb edir, lakin oradan
// `routes.ts`-i import etmək komanda route-larının LAZY yüklənməsini
// mənasızlaşdırardı (bax index.ts-dəki `TR` köməkçisi). Ortaq kiçik modul
// hər iki tərəfin ehtiyacını əlavə yük olmadan ödəyir.
import { Ctx, uuid, now, err } from './util';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * Admin jurnalına yazıla bilən əməliyyatların AĞ SİYAHISI — AUDIT M-13.
 *
 * Əvvəl `adminLogAction` client-dən gələn İXTİYARİ `action` sətrini olduğu
 * kimi `admin_logs`-a yazırdı. Nəticə: admin öz izini saxtalaşdıra bilirdi
 * (log forging) — məsələn real "user-block" əməliyyatını gizlədib uydurma
 * "export-users" sətri yaza bilərdi. Jurnal audit üçün mövcuddursa, onun
 * məzmunu client tərəfindən sərbəst təyin edilə bilməz.
 *
 * Naxış `TEAM_PERMISSIONS` ilə eynidir: tək mənbə, `as const`, TypeScript
 * birləşmə tipi. Yeni əməliyyat əlavə edən developer onu BURAYA yazmalıdır.
 */
export const ADMIN_LOG_ACTIONS = [
  'user-edit', 'user-block', 'user-unblock', 'user-verify', 'user-unverify',
  'user-delete', 'temp-password', 'xp-edit', 'level-edit',
  'admin-add', 'admin-remove',
  'task-approve', 'task-reject', 'task-delete',
  'submission-approve', 'submission-reject',
  'report-resolve', 'report-reject',
  'taxonomy-add', 'taxonomy-remove', 'taxonomy-reorder',
  'faq-add', 'faq-remove', 'testimonial-add', 'testimonial-remove',
  'contact-read', 'export-users', 'export-logs',
  'team-delete', 'team-restore', 'team-visibility',
] as const;

export type AdminLogAction = (typeof ADMIN_LOG_ACTIONS)[number];

export function isAdminLogAction(v: unknown): v is AdminLogAction {
  return typeof v === 'string' && (ADMIN_LOG_ACTIONS as readonly string[]).includes(v);
}

// Səviyyə açıq verilmirsə əməliyyat adından çıxarılır — belədə köhnə çağırış
// yerləri dəyişmədən düzgün rəng alır.
//
// ⚠ Sıra vacibdir: "geri alma" formaları ƏVVƏL yoxlanır. Əks halda "unblock"
// içindəki "block", "unverify" içindəki "verify" tutulur və əməliyyat öz əksi
// kimi işarələnir.
export function deriveLevel(action: string): LogLevel {
  const a = action.toLowerCase();
  if (/(unblock|unverify|restore)/.test(a)) return a.includes('unverify') ? 'warning' : 'success';
  if (/(remove|delete|block|reject|ban)/.test(a)) return 'error';
  if (/(temp-password|edit|deactivate)/.test(a)) return 'warning';
  if (/(add|create|approve|verify)/.test(a)) return 'success';
  return 'info';
}

export async function logAdmin(
  c: Ctx, action: string, targetId: string, detail = '', level?: LogLevel,
) {
  await c.env.DB.prepare(
    'INSERT INTO admin_logs (id, action, target_id, by_id, by_name, detail, created_at, level) VALUES (?,?,?,?,?,?,?,?)',
  ).bind(uuid(), action, targetId, c.user!.id, c.user!.username, detail, now(), level || deriveLevel(action)).run();
}

/** Ağ siyahıdan kənar əməliyyat üçün hazır 400 cavabı (M-13). */
export const invalidAdminAction = () =>
  err('Naməlum admin əməliyyatı.', 400, 'invalid_action');
