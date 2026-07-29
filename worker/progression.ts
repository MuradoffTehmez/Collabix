// Reputasiya / nişan / nailiyyət mühərrikləri — AUDIT-TASK-10 / FAZA A2.
//
// PRD §8 (Reputation), "Badge engine (server)", "Achievement / unlock engine".
//
// ════════════════════════════════════════════════════════════════════════════
// AUDIT TAPINTISI
// ════════════════════════════════════════════════════════════════════════════
//
// > Badge engine (server) → kodda: CLIENT-SIDE STATİK MASSİV
// > Achievement / unlock / reputation engine → YOXDUR
//
// Badge-lərin client-də olması yalnız arxitektura qüsuru deyil: istifadəçi
// öz brauzerində massivi dəyişib istənilən nişanı "qazana" bilirdi. PRD §19
// bunu açıq qadağan edir: *"Server Side Only — XP, Role, Permission,
// Reputation, Level, Badges, Achievements. Client yalnız oxuya bilər."*
//
// ⚠ NAXIŞ AUDIT-TASK-9-DAN GÖTÜRÜLÜB, yenisi icad edilmir:
//   `grantXp` idempotentliyi `INSERT OR IGNORE` + `EXISTS(logId)` şərti ilə
//   qurulmuşdu. Burada eyni mexanizm işlədilir — belədə "eyni hadisə iki dəfə
//   sayılmasın" qaydası bütün mühərriklərdə EYNİ davranır.
import type { Env } from './util';
import { uuid, now } from './util';
import { log } from './request-context';

/* ═══════════════════════════ REPUTASİYA ═══════════════════════════ */

/**
 * PRD §8 mənbələri.
 *
 * ⚠ `users.reputation` üçün `>= 0` MƏCBURİYYƏTİ YOXDUR (miqrasiya 0031-də
 *   izah olunub): PRD mənfi mənbələri (spam, warning) açıq sadalayır. Bu,
 *   `xp`-dən fərqlidir — orada `users_xp_nonneg` trigger-i var.
 */
export type RepSource =
  | 'like' | 'accepted_answer' | 'verified_report' | 'helpful_answer'
  | 'community_vote' | 'spam' | 'warning' | 'admin';

/** PRD §8 dəyərləri — müsbət və mənfi. */
export const REP_VALUES: Record<RepSource, number> = {
  like:            1,
  accepted_answer: 15,
  helpful_answer:  10,
  verified_report: 5,
  community_vote:  2,
  spam:           -25,
  warning:        -50,
  admin:           0,   // məbləğ çağıranda verilir
};

/**
 * Reputasiya dəyişikliyi — İDEMPOTENT.
 *
 * `grantXp` ilə eyni mexanizm: `logId` məhz indi yaradılmış UUID-dir, ona görə
 * həmin id-li sətir YALNIZ bizim INSERT işləyibsə mövcuddur → təkrar çağırışda
 * UPDATE 0 sətrə toxunur.
 *
 * @returns dəyişiklik tətbiq olundumu
 */
export async function grantReputation(
  env: Env, uid: string, source: RepSource, refId: string | null, amount?: number,
): Promise<boolean> {
  const delta = amount ?? REP_VALUES[source];
  if (!uid || !Number.isFinite(delta) || delta === 0) return false;

  const logId = uuid();
  const res = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO reputation_logs (id, uid, source, ref_id, amount, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(logId, uid, source, refId, delta, now()),
    env.DB.prepare(
      `UPDATE users SET reputation = reputation + ?2 WHERE id = ?1
        AND EXISTS (SELECT 1 FROM reputation_logs WHERE id = ?3)`,
    ).bind(uid, delta, logId),
  ]);
  return Number(res[1]?.meta?.changes || 0) > 0;
}

/* ═════════════════════ NİŞAN VƏ NAİLİYYƏT ═════════════════════ */

/** Kataloqdakı qayda növləri — `badges.rule_kind` / `achievements.rule_kind`. */
type RuleKind = 'xp' | 'posts' | 'comments' | 'tasks' | 'streak' | 'reputation';

/**
 * İstifadəçinin cari göstəriciləri — kataloq qaydaları ilə müqayisə üçün.
 *
 * ⚠ TƏK SORĞU: hər qayda üçün ayrıca `COUNT(*)` etsək 11 nişan × 2 sorğu
 *   olardı. Alt-sorğular bir gedişdə yığılır.
 */
async function metricsOf(env: Env, uid: string): Promise<Record<RuleKind, number>> {
  const r = await env.DB.prepare(
    `SELECT
       u.xp                                                        AS xp,
       u.streak                                                    AS streak,
       u.reputation                                                AS reputation,
       u.tasks_completed                                           AS tasks,
       (SELECT COUNT(*) FROM posts    WHERE author_id = u.id)      AS posts,
       (SELECT COUNT(*) FROM comments WHERE author_id = u.id)      AS comments
     FROM users u WHERE u.id = ?`,
  ).bind(uid).first<any>();
  return {
    xp: Number(r?.xp || 0),
    streak: Number(r?.streak || 0),
    reputation: Number(r?.reputation || 0),
    tasks: Number(r?.tasks || 0),
    posts: Number(r?.posts || 0),
    comments: Number(r?.comments || 0),
  };
}

export interface ProgressionResult {
  badges: string[];        // MƏHZ İNDİ qazanılanlar
  achievements: string[];
  unlocks: string[];
}

/**
 * Nişan və nailiyyətləri yenidən qiymətləndirir və YENİ qazanılanları verir.
 *
 * ⚠ ÇAĞIRIŞ YERİ: XP/reputasiya dəyişən hər əməliyyatdan SONRA, `waitUntil`
 *   içində. Sinxron çağırmaq post yaratma cavabını gecikdirərdi.
 *
 * ⚠ İDEMPOTENT: `ux_badge_logs` / `ux_achievement_logs` unikal indeksləri eyni
 *   nişanın iki dəfə verilməsini bağlayır. Təkrar çağırış BOŞ nəticə qaytarır,
 *   xəta atmır — bu, qanuni haldır (hər əməliyyatdan sonra çağırılır).
 */
export async function evaluateProgression(env: Env, uid: string): Promise<ProgressionResult> {
  const out: ProgressionResult = { badges: [], achievements: [], unlocks: [] };
  if (!uid) return out;

  try {
    const m = await metricsOf(env, uid);
    const [badges, achievements] = await Promise.all([
      env.DB.prepare(
        `SELECT code, rule_kind, rule_value FROM badges
          WHERE code NOT IN (SELECT badge_code FROM badge_logs WHERE uid = ?)`,
      ).bind(uid).all<any>(),
      env.DB.prepare(
        `SELECT code, rule_kind, rule_value, unlocks FROM achievements
          WHERE code NOT IN (SELECT achievement_code FROM achievement_logs WHERE uid = ?)`,
      ).bind(uid).all<any>(),
    ]);

    const met = (kind: string, value: number) =>
      (m[kind as RuleKind] ?? 0) >= value;

    const stmts = [];
    for (const b of badges.results) {
      if (!met(String(b.rule_kind), Number(b.rule_value))) continue;
      out.badges.push(String(b.code));
      stmts.push(env.DB.prepare(
        `INSERT OR IGNORE INTO badge_logs (id, uid, badge_code, created_at) VALUES (?,?,?,?)`,
      ).bind(uuid(), uid, b.code, now()));
    }
    for (const a of achievements.results) {
      if (!met(String(a.rule_kind), Number(a.rule_value))) continue;
      out.achievements.push(String(a.code));
      if (a.unlocks) out.unlocks.push(String(a.unlocks));
      stmts.push(env.DB.prepare(
        `INSERT OR IGNORE INTO achievement_logs (id, uid, achievement_code, created_at) VALUES (?,?,?,?)`,
      ).bind(uuid(), uid, a.code, now()));
    }
    if (stmts.length) await env.DB.batch(stmts);
  } catch (e: any) {
    // ⚠ FAIL-SOFT: nişan hesablaması ƏSAS əməliyyatı (post yaratma) çökdürməməlidir.
    log('error', 'progression_failed', { uid, message: e?.message || String(e) });
  }
  return out;
}

/** İstifadəçinin qazandığı nişanlar — profil göstərişi üçün. */
export async function badgesOf(env: Env, uid: string): Promise<Array<Record<string, unknown>>> {
  const rows = await env.DB.prepare(
    `SELECT b.code, b.label_az, b.icon, l.created_at
       FROM badge_logs l JOIN badges b ON b.code = l.badge_code
      WHERE l.uid = ? ORDER BY l.created_at DESC`,
  ).bind(uid).all<any>();
  return rows.results;
}

export async function achievementsOf(env: Env, uid: string): Promise<Array<Record<string, unknown>>> {
  const rows = await env.DB.prepare(
    `SELECT a.code, a.label_az, a.unlocks, l.created_at
       FROM achievement_logs l JOIN achievements a ON a.code = l.achievement_code
      WHERE l.uid = ? ORDER BY l.created_at DESC`,
  ).bind(uid).all<any>();
  return rows.results;
}
