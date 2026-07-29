// XP mühasibatı — AUDIT-2026-07-26 / H-5 (AUDIT-TASK-9 / FAZA B).
//
// ════════════════════════════════════════════════════════════════════════════
// NƏ ÜÇÜN İKİ AYRI MEXANİZM LAZIMDIR
// ════════════════════════════════════════════════════════════════════════════
//
// `UNIQUE(uid, source, ref_id)` TƏKRAR verilməni bağlayır (eyni post üçün XP
// iki dəfə verilmir), lakin SİL-YENİDƏN-YARAT dövrəsini bağlamır — hücumçu
// hər dəfə YENİ `ref_id` alır. Auditin əsas istismarı məhz budur:
//   post yarat (+10) → sil (XP qalırdı) → təkrarla → 36 000 XP/saat.
// Dövrəni GÜNDƏLİK TAVAN bağlayır. İkisi birlikdə lazımdır:
//   • UNIQUE      → retry/təkrar-təsdiq idempotentliyi
//   • gündəlik tavan → yarat-sil dövrəsi
//   • kompensasiya   → silinən məzmunun XP-si geri alınır
import { Env, uuid, now } from './util';

export type XpSource =
  | 'post' | 'comment' | 'solution' | 'team_task' | 'profile_bonus'
  | 'admin' | 'compensation';

interface XpRule {
  /**
   * Gündəlik tavan (XP). `null` = tavansız VƏ ümumi tavana da daxil deyil.
   *
   * ⚠ `null` yalnız İMTİYAZLI TƏSDİQ tələb edən mənbələr üçündür: orada
   *   sui-istifadə modeli tamam başqadır (istifadəçi özü XP yarada bilmir,
   *   admin/komanda təsdiqi lazımdır). Tavan qoysaydıq, çoxlu həll təsdiqləyən
   *   admin qanuni istifadəçiləri XP-siz qoyardı.
   */
  daily: number | null;
}

/**
 * ⚠ TAVAN DƏYƏRLƏRİ NECƏ SEÇİLDİ (audit §B-3: "kor-koranə qəbul etmə").
 *
 * Auditin tələbi ortalama gündəlik qazancı ÖLÇMƏK idi. 9.0/Sual 4 ölçməsi
 * göstərdi ki, istehsalda organik XP YOXDUR (XP-si olan cəmi 1 hesab, dəyər
 * əl ilə qoyulub) — yəni ölçüləcək paylanma mövcud deyil. Ona görə tavanlar
 * ƏMƏLİYYAT sayından çıxarılıb və hesabatda bu açıq yazılıb:
 *
 *   post    100 XP = 10 post/gün   (çox aktiv istifadəçi gündə 3-5 post yazır)
 *   comment 100 XP = 20 rəy/gün    (simmetrik tavan, ikiqat əməliyyat sayı)
 *   ümumi   300 XP                 — son müdafiə xətti
 *
 * 🔴 ÖHDƏLİK: real trafik yığıldıqdan sonra bu dəyərlər ÖLÇÜLMƏLİ və
 *    lazım gələrsə artırılmalıdır. Task 4 §4.2-də auditin `presence` limiti
 *    məhz ölçülmədiyi üçün səhv çıxmışdı.
 */
export const XP_RULES: Record<XpSource, XpRule> = {
  post:          { daily: 100 },
  comment:       { daily: 100 },
  solution:      { daily: null },   // admin təsdiqi tələb edir
  team_task:     { daily: null },   // komanda iş axını təsdiqi tələb edir
  profile_bonus: { daily: null },   // birdəfəlik (settings bayrağı ilə qorunur)
  admin:         { daily: null },   // admin əl ilə düzəlişi — audit izi üçün loglanır
  compensation:  { daily: null },   // mənfi məbləğ; tavana ONSUZ DA daxil deyil
};

/** Ümumi gündəlik tavan — yalnız tavanlı (`daily !== null`) mənbələri sayır. */
export const XP_DAILY_TOTAL = 300;

/**
 * Gün sərhədi UTC-dir.
 *
 * Alternativ (istifadəçinin saat qurşağı) manipulyasiyaya açıqdır: client
 * qurşağı elan edir və hücumçu onu dəyişməklə eyni gündə iki tavan ala bilər.
 */
export const utcDayStart = (ts: number = now()): number =>
  Math.floor(ts / 86_400_000) * 86_400_000;

export interface GrantResult {
  granted: boolean;
  /** Verilmədisə səbəb — çağıran tərəf istifadəçiyə bildiriş göstərə bilər. */
  reason?: 'duplicate' | 'daily_cap' | 'invalid';
  /** Tavana çatıbsa, həmin mənbənin bugünkü qalığı (0). */
  remaining?: number;
}

/**
 * Bugünkü MÜSBƏT XP cəmi.
 *
 * 🔴 `amount > 0` ŞƏRTİ KRİTİKDİR (audit §B-4). Kompensasiya sətirləri mənfidir;
 * onları da saysaq, hücumçu yarat-sil dövrəsi ilə gündəlik cəmi AŞAĞI SALIB
 * tavanı bərpa edərdi — yəni tavan dövrəni bağlamaqdan çıxardı.
 */
async function positiveToday(env: Env, uid: string, source?: XpSource): Promise<number> {
  const since = utcDayStart();
  const row = source
    ? await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM xp_logs
        WHERE uid = ?1 AND amount > 0 AND created_at >= ?2 AND source = ?3`,
    ).bind(uid, since, source).first<any>()
    : await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM xp_logs
        WHERE uid = ?1 AND amount > 0 AND created_at >= ?2
          AND source NOT IN ('solution', 'team_task', 'profile_bonus', 'admin')`,
    ).bind(uid, since).first<any>();
  return Number(row?.s || 0);
}

/**
 * XP verilməsi — İDEMPOTENT.
 *
 * ⚠ ATOMİKLİK: `xp_logs` INSERT-i və `users.xp` UPDATE-i EYNİ `batch()`-dədir
 *   (D1 batch = tranzaksiya). Ayrı olsalar biri uğurlu, digəri uğursuz olduqda
 *   `SUM(xp_logs) == users.xp` invariantı pozulardı.
 *
 * ⚠ TƏKRAR ÇAĞIRIŞ SÜKUTLA no-op olur, xəta ATMIR — təkrar çağırış qanuni
 *   retry ola bilər (şəbəkə qopub, client yenidən göndərib).
 *
 * 🔴 İDEMPOTENTLİYİN İŞLƏMƏ MEXANİZMİ (incə, dəyişdirməzdən əvvəl oxu):
 *   `INSERT OR IGNORE` təkrarda sətir yazmır. UPDATE isə `EXISTS (SELECT 1
 *   FROM xp_logs WHERE id = ?logId)` şərtinə bağlıdır və `logId` MƏHZ İNDİ
 *   yaradılmış təsadüfi UUID-dir. Yəni həmin id-li sətir YALNIZ bizim INSERT
 *   işləyibsə mövcuddur → təkrarda UPDATE 0 sətrə toxunur.
 *   Sadəcə `INSERT OR IGNORE` + şərtsiz UPDATE yazsaydıq, təkrar çağırışda
 *   log yazılmadan XP VERİLƏRDİ — yəni idempotentlik heç olmazdı.
 */
export async function grantXp(
  env: Env,
  uid: string,
  source: XpSource,
  refId: string | null,
  amount: number,
  opts: { alsoCompletedTask?: boolean } = {},
): Promise<GrantResult> {
  if (!uid || !Number.isFinite(amount) || amount <= 0) return { granted: false, reason: 'invalid' };

  const rule = XP_RULES[source];
  if (rule.daily !== null) {
    // ⚠ Tavan yoxlaması batch-dən KƏNARDIR, yəni tam paralel iki sorğu tavanı
    //   bir əməliyyat qədər aşa bilər. Bu QƏBUL EDİLİB: tavan təhlükəsizlik
    //   kontrolu deyil, sui-istifadə qapısıdır — 100 əvəzinə 110 XP keçməsi
    //   modeli pozmur, dövrəni isə yenə bağlayır.
    const [bySource, total] = await Promise.all([
      positiveToday(env, uid, source),
      positiveToday(env, uid),
    ]);
    if (bySource + amount > rule.daily || total + amount > XP_DAILY_TOTAL) {
      return { granted: false, reason: 'daily_cap', remaining: 0 };
    }
  }

  const logId = uuid();
  const stmts = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO xp_logs (id, uid, source, ref_id, amount, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(logId, uid, source, refId, amount, now()),
    env.DB.prepare(
      `UPDATE users SET xp = xp + ?2 WHERE id = ?1
        AND EXISTS (SELECT 1 FROM xp_logs WHERE id = ?3)`,
    ).bind(uid, amount, logId),
  ];
  if (opts.alsoCompletedTask) {
    // `tasks_completed` XP ilə BİRLİKDƏ artır → EYNİ idempotentlik şərti.
    // Ayrı yazsaydıq təkrar-təsdiq XP verməzdi, amma sayğacı yenə şişirdərdi.
    stmts.push(env.DB.prepare(
      `UPDATE users SET tasks_completed = tasks_completed + 1 WHERE id = ?1
        AND EXISTS (SELECT 1 FROM xp_logs WHERE id = ?2)`,
    ).bind(uid, logId));
  }

  const res = await env.DB.batch(stmts);
  const changed = Number(res[1]?.meta?.changes || 0) > 0;
  return changed ? { granted: true } : { granted: false, reason: 'duplicate' };
}

/**
 * 🔴 XP KOMPENSASİYASI — AUDIT H-5 #3 və auditin QEYD ETMƏDİYİ tələ.
 *
 * AUDIT-TASK-6 §D-2 `users_xp_nonneg_update` trigger-i əlavə edib:
 *   BEFORE UPDATE OF xp ON users WHEN NEW.xp < 0 → RAISE(ABORT)
 *
 * Toqquşma ssenarisi: istifadəçinin XP-si 5, silinən post 10 XP verib →
 * `5 - 10 = -5` → trigger ABORT → `deletePost` DB xətası ilə ÇÖKÜR, yəni
 * istifadəçi öz postunu SİLƏ BİLMİR. Bu, funksional çökmədir.
 *
 * ÜÇ QAT MÜDAFİƏ:
 *   1. Yalnız UYĞUN `xp_logs` sətri varsa kompensasiya edilir. Jurnal
 *      qurulmazdan ƏVVƏLKİ məzmun (miqrasiyadan köhnə postlar) toxunulmur —
 *      onların nə qədər XP verdiyi BİLİNMİR, təxmin etmək isə yanlış olardı.
 *   2. Məbləğ mövcud XP ilə clamp olunur — heç vaxt mənfiyə düşülmür.
 *   3. Kompensasiya `xp_logs`-a MƏNFİ məbləğlə yazılır → invariant qorunur
 *      və istismar geriyə dönük görünür.
 *
 * 🔴 CLAMP VƏ JURNAL EYNİ İFADƏDƏN GƏLİR (incə, dəyişdirmə):
 *   INSERT `-MIN(?amount, u.xp)` yazır; UPDATE isə həmin YAZILMIŞ dəyəri
 *   `xp_logs`-dan geri oxuyub tətbiq edir. Ona görə jurnal ilə faktiki
 *   çıxılma HƏMİŞƏ eynidir. Əvvəlcə JS-də oxuyub sonra `MAX(0, xp - n)`
 *   yazsaydıq, paralel silmələrdə jurnal ilə real XP ARALANARDI (drift) —
 *   məhz `/api/health`-in aşkarladığı hal.
 *
 * @returns geri alınan XP (0 = kompensasiya edilmədi)
 */
export async function compensateXp(
  env: Env, uid: string, source: XpSource, refId: string,
): Promise<number> {
  if (!uid || !refId) return 0;

  // Qat 1 — uyğun jurnal sətri varmı?
  const log = await env.DB.prepare(
    `SELECT amount FROM xp_logs
      WHERE uid = ?1 AND source = ?2 AND ref_id = ?3 AND amount > 0 LIMIT 1`,
  ).bind(uid, source, refId).first<any>();
  const earned = Number(log?.amount || 0);
  if (earned <= 0) return 0;   // legacy / XP verilməyib → toxunma

  const logId = uuid();
  const res = await env.DB.batch([
    // Qat 2+3 — clamp jurnal sətrinin İÇİNDƏ hesablanır.
    // `u.xp > 0` şərti: XP-si sıfır olan istifadəçi üçün ümumiyyətlə sətir
    // yazılmır (mənasız `-0` sətri jurnalı çirkləndirərdi).
    env.DB.prepare(
      `INSERT OR IGNORE INTO xp_logs (id, uid, source, ref_id, amount, created_at)
       SELECT ?1, ?2, 'compensation', ?3, -MIN(?4, u.xp), ?5
         FROM users u WHERE u.id = ?2 AND u.xp > 0`,
    ).bind(logId, uid, refId, earned, now()),
    // `amount` mənfidir → `xp + amount` = çıxılma. `-MIN(?, u.xp)` sayəsində
    // nəticə heç vaxt 0-dan kiçik olmur → trigger TETİKLƏNMİR.
    env.DB.prepare(
      `UPDATE users
          SET xp = xp + (SELECT amount FROM xp_logs WHERE id = ?2)
        WHERE id = ?1 AND EXISTS (SELECT 1 FROM xp_logs WHERE id = ?2)`,
    ).bind(uid, logId),
  ]);

  if (!Number(res[1]?.meta?.changes || 0)) return 0;
  const written = await env.DB.prepare('SELECT amount FROM xp_logs WHERE id = ?')
    .bind(logId).first<any>();
  return Math.abs(Number(written?.amount || 0));
}

/**
 * Sağlamlıq göstəricisi — AUDIT-TASK-9 §5.4.
 *
 * `SUM(xp_logs.amount) == users.xp` invariantı. Fərq varsa nəyisə jurnaldan
 * KƏNARDA XP dəyişdirir (əl ilə SQL, sadalanmamış route, yarım batch).
 * `/api/health` bunu `xp_invariant: 'ok' | 'drift'` kimi göstərir.
 */
export async function xpInvariant(env: Env): Promise<{ ok: boolean; users: number; logs: number }> {
  const row = await env.DB.prepare(
    `SELECT (SELECT COALESCE(SUM(xp), 0)     FROM users)   AS u,
            (SELECT COALESCE(SUM(amount), 0) FROM xp_logs) AS l`,
  ).first<any>();
  const users = Number(row?.u || 0);
  const logs = Number(row?.l || 0);
  return { ok: users === logs, users, logs };
}
