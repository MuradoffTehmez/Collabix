// Siqnallar (alerting) — AUDIT-TASK-10 / Faza 2.3.
//
// ════════════════════════════════════════════════════════════════════════════
// NİYƏ "ALERT" = STRUKTURLU LOG SƏTRİ
// ════════════════════════════════════════════════════════════════════════════
//
// Layihədə xarici alerting xidməti (PagerDuty, Sentry) YOXDUR və onu qurmaq
// hesab sahibinin qərarıdır. Faza 2.1-də Cloudflare Workers Logs AÇILDI
// (`observability.enabled: true`), o isə JSON sahələri üzrə **Logpush filtri**
// və **dashboard alarmı** qurmağa imkan verir.
//
// Ona görə burada hər siqnal SABİT formatlı bir sətir yazır:
//     {"level":"error","event":"alert","alert":"<ad>", ...}
// Dashboard-da qurulacaq qayda: `event = "alert"` → bildiriş.
//
// ⚠ BU, ÖZ-ÖZÜNƏ BİLDİRİŞ GÖNDƏRMİR. Cloudflare tərəfdə qayda qurulmalıdır —
//   `docs/TASK-10-SCOPE.md` §5-də xarici öhdəlik kimi qeyd olunub.
//
// ⚠ SÜKUT ≠ SAĞLAMLIQ: siqnal yalnız hadisə BAŞ VERƏNDƏ yazılır. "Heç nə
//   gəlmirsə hər şey yaxşıdır" nəticəsi SƏHVDİR — sistem ölübsə də sükut olur.
//   Canlılıq üçün `/api/health` ayrıca yoxlanmalıdır.
import type { Env } from './util';
import { log } from './request-context';

export type AlertName =
  /** Bir uid-dən qısa müddətdə çoxlu `/files/*` rəddi → açar sadalama cəhdi. */
  | 'file_access_enumeration'
  /** `SUM(xp_logs) != users.xp` → jurnaldan kənarda XP dəyişir. */
  | 'xp_invariant_drift'
  /** `Origin` yad olduğu üçün bloklanan sorğu. */
  | 'csrf_blocked';

/**
 * Siqnal yazır.
 *
 * ⚠ `detail` içinə TOKEN, TAM FAYL AÇARI və ya istifadəçi mətni QOYULMAMALIDIR:
 *   loglar saxlanılır və ixrac oluna bilər (Task 7-nin `file_access_denied`
 *   qaydası ilə eyni: yalnız prefiks + səbəb).
 */
export function alert(name: AlertName, detail: Record<string, unknown> = {}): void {
  log('error', 'alert', { alert: name, ...detail });
}

/* ═══════════════ 1. `/files/*` açar sadalama aşkarlaması ═══════════════ */

/**
 * Task 7 §8/5 açıq öhdəliyi:
 * > "bir uid-dən dəqiqədə onlarla rədd = açar sadalama. Avtomatik reaksiya yoxdur."
 *
 * Sayğac KV-dədir və DƏQİQ OLMAQ MƏCBURİYYƏTİNDƏ DEYİL — bu, təhlükəsizlik
 * kontrolu deyil, MÜŞAHİDƏ siqnalıdır. Ona görə atomik DO (Task 9 / H-3)
 * lazım deyil: 30 əvəzinə 28 rədd sayılsa siqnalın mənası dəyişmir.
 *
 * ⚠ Siqnal pəncərədə BİR DƏFƏ verilir (`fired:` açarı): hücum davam edərsə
 *   hər rədd üçün ayrıca sətir yazmaq logu doldurar və əsl siqnalı boğardı.
 */
const DENY_WINDOW_SEC = 60;
const DENY_THRESHOLD = 20;

export async function noteFileAccessDenied(env: Env, uid: string, prefix: string): Promise<void> {
  if (!uid) return;
  const win = Math.floor(Date.now() / 1000 / DENY_WINDOW_SEC);
  const key = `denies:${uid}:${win}`;
  try {
    const n = parseInt((await env.SESSIONS.get(key)) || '0', 10) + 1;
    await env.SESSIONS.put(key, String(n), { expirationTtl: DENY_WINDOW_SEC * 2 });
    if (n !== DENY_THRESHOLD) return;   // yalnız astananı KEÇDİYİ an
    alert('file_access_enumeration', { uid, prefix, denies: n, windowSec: DENY_WINDOW_SEC });
  } catch {
    // KV nasazlığı fayl oxusunu ÇÖKDÜRMƏMƏLİDİR — siqnal köməkçi qatdır.
  }
}
