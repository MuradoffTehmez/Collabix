// Səviyyə mühərriki — AUDIT-TASK-10 / FAZA A2 (PRD §7).
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 ZİDDİYYƏT VƏ ONUN İDARƏSİ
// ════════════════════════════════════════════════════════════════════════════
//
// PRD §7 cədvəli:  Lv2 = 500 XP, Lv3 = 1 500, … Lv10 = 50 000
// Mövcud kod:      floor(sqrt(xp / 100)) + 1 → Lv2 = 100, Lv3 = 400, Lv10 = 8 100
//
// Fərq 6 dəfəyə qədərdir. Formulanı bir gecədə dəyişsək BÜTÜN mövcud
// istifadəçilərin səviyyəsi DÜŞƏRDİ — profil, admin paneli, liderlik cədvəli
// və nişanlar səviyyəyə baxır. Bu, texniki deyil, GÖRÜNƏN MƏHSUL dəyişikliyidir.
//
// PRD həm də deyir: *"Formula sonradan dəyişdirilə bilməlidir. Database-də
// sabit saxlanılmamalıdır."*
//
// QƏRAR: astanalar `levels` cədvəlindən oxunur; cədvəl BOŞDURSA köhnə formula
// işləyir. Miqrasiya cədvəli QƏSDƏN boş buraxır, yəni:
//   • miqrasiya tətbiq olunan kimi DAVRANIŞ DƏYİŞMİR (reqressiya yoxdur)
//   • keçid AÇIQ addımdır: admin `levels`-i doldurur və dəyişiklik o an olur
//   • geri qaytarmaq = cədvəli boşaltmaq
//
// ⚠ `docs/TASK-10-SCOPE.md` §3.1-də bu, açıq qərar tələb edən bənd kimi qeyd
//   olunub — burada TEXNİKİ imkan qurulur, SİYASƏT qərarı sahibindir.
import type { Env } from './util';

/**
 * Köhnə kvadratik formula — YALNIZ `levels` cədvəli BOŞ olduqda işləyir.
 *
 * ⚠ AUDIT-TASK-10 / D-6.a-dan sonra istehsalda bu yol AKTİV DEYİL:
 *   `0034_prd_level_thresholds.sql` cədvəli PRD §7 astanaları ilə doldurdu,
 *   `js/util.js`-dəki `levelFromXP` isə eyni astanalara keçirildi.
 *   Bu funksiya geri qaytarma yolu kimi qalır (`DELETE FROM levels;`).
 *
 * ⚠ Client və server EYNİ nəticəni verməlidir: fərq olsa istifadəçi profilində
 *   bir səviyyə, admin panelində başqa səviyyə görünərdi. Astanalar dəyişəndə
 *   `js/util.js` → `LEVEL_THRESHOLDS` EYNİ commit-də yenilənməlidir.
 */
export const legacyLevelFromXp = (xp: number): number =>
  Math.max(1, Math.floor(Math.sqrt((xp || 0) / 100)) + 1);

/** `levels` cədvəlinin keşi — astanalar demək olar heç vaxt dəyişmir. */
let thresholds: Array<{ level: number; minXp: number }> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 300_000;   // 5 dəqiqə

export function invalidateLevels(): void {
  thresholds = null;
}

async function loadThresholds(env: Env): Promise<Array<{ level: number; minXp: number }>> {
  if (thresholds && Date.now() - cachedAt < CACHE_TTL_MS) return thresholds;
  try {
    const rows = await env.DB.prepare(
      'SELECT level, min_xp FROM levels ORDER BY min_xp ASC',
    ).all<any>();
    thresholds = rows.results.map(r => ({ level: Number(r.level), minXp: Number(r.min_xp) }));
  } catch {
    // Cədvəl hələ migrate olunmayıb → köhnə formula.
    thresholds = [];
  }
  cachedAt = Date.now();
  return thresholds;
}

/**
 * XP → səviyyə.
 *
 * `levels` cədvəli doludursa ONDAN, boşdursa köhnə formuladan hesablanır.
 */
export async function levelFromXp(env: Env, xp: number): Promise<number> {
  const t = await loadThresholds(env);
  if (!t.length) return legacyLevelFromXp(xp);
  let level = 1;
  for (const row of t) {
    if (xp >= row.minXp) level = row.level;
    else break;
  }
  return level;
}

/** Növbəti səviyyəyə qalan XP — profil proqres zolağı üçün. */
export async function levelProgress(
  env: Env, xp: number,
): Promise<{ level: number; nextAt: number | null; remaining: number | null }> {
  const t = await loadThresholds(env);
  const level = await levelFromXp(env, xp);

  if (!t.length) {
    // Köhnə formulanın tərsi: növbəti səviyyə üçün lazım olan XP.
    const nextAt = level * level * 100;
    return { level, nextAt, remaining: Math.max(0, nextAt - xp) };
  }
  const next = t.find(r => r.level === level + 1);
  return {
    level,
    nextAt: next ? next.minXp : null,
    remaining: next ? Math.max(0, next.minXp - xp) : null,
  };
}
