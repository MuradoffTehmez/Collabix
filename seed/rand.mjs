// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Determinist təsadüfilik + zaman xətti
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 NİYƏ `Math.random()` DEYİL: seed təkrar qaçırılanda tamam başqa data
//    çıxsaydı, "dünən gördüyüm qüsur bu gün yoxdur" vəziyyəti yaranardı və
//    audit nəticələrini müqayisə etmək mümkün olmazdı. `SEED_RANDOM` dəyişəni
//    ilə eyni giriş HƏMİŞƏ eyni bazanı verir.
//
//    Fərqli data lazımdırsa: `SEED_RANDOM=<başqa ədəd> npm run seed:demo`

import { TIMELINE_DAYS } from './config.mjs';

const SEED = Number(process.env.SEED_RANDOM || 20260812);

/** mulberry32 — kiçik, sürətli, keyfiyyətli 32-bit PRNG. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(SEED);

/** [0, 1) */
export const rnd = () => rng();

/** Generatoru sıfırlayır (test üçün). */
export const reseed = (n = SEED) => { rng = mulberry32(n); };

/** Tam ədəd [min, max] — hər iki uc daxildir. */
export function randInt(min, max) {
  if (max < min) [min, max] = [max, min];
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Massivdən bir element. */
export function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Massivdən N UNİKAL element.
 *
 * ⚠ Partial Fisher-Yates işlədilir, `sort(() => rnd() - 0.5)` YOX: sort ilə
 *   qarışdırma həm qərəzlidir, həm də O(n log n) — 600 elementlik hovuzdan
 *   milyon dəfə seçəndə bu, generatorun ən bahalı yeri olurdu.
 */
export function pickN(arr, n) {
  const k = Math.min(n, arr.length);
  if (k <= 0) return [];
  if (k === arr.length) return [...arr];
  const a = [...arr];
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

/** Yerində qarışdırma. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** `chance(0.3)` → 30% ehtimalla true. */
export const chance = p => rng() < p;

/**
 * Çəkili seçim. `items` = [{...,  w|weight|share }]
 * Sahə adı avtomatik tapılır ki, config-dəki müxtəlif cədvəllər eyni funksiya
 * ilə işlənsin.
 */
export function weighted(items) {
  let total = 0;
  const w = items.map(it => {
    const v = it.w ?? it.weight ?? it.share ?? 1;
    total += v;
    return v;
  });
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Obyekt formasında çəkili seçim: { key: share } → key */
export function weightedKey(obj) {
  const entries = Object.entries(obj);
  let total = 0;
  for (const [, v] of entries) total += v;
  let r = rng() * total;
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

/**
 * Uzun quyruqlu (Pareto-vari) ədəd — [min, max] aralığında, kiçik dəyərlərə
 * meyilli. Engagement və izləyici sayı kimi göstəricilər üçün.
 */
export function longTail(min, max, exponent = 2.2) {
  const u = rng();
  return Math.round(min + (max - min) * Math.pow(u, exponent));
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAMAN XƏTTİ
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ Sənəd §8: tarixlər SABİT YAZILMAMALIDIR — hər qaçışda "bu gün"dən geriyə
//   hesablanır. `NOW` bir dəfə tutulur ki, generatorun gedişində gün sərhədi
//   keçilsə belə bütün fazalar eyni zaman xəttini görsün.

export const NOW = Date.now();

/** Bu günün UTC gecəyarısı. */
const TODAY_UTC = (() => {
  const d = new Date(NOW);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
})();

/** `daysAgo` gün əvvəlin UTC gecəyarısı. 0 = bu gün. */
export const dayStart = daysAgo => TODAY_UTC - daysAgo * 86_400_000;

/** Zaman xətti günləri: index 0 = ən köhnə gün, sonuncu = bu gün. */
export const TIMELINE = Array.from({ length: TIMELINE_DAYS }, (_, i) => {
  const daysAgo = TIMELINE_DAYS - 1 - i;
  const start = dayStart(daysAgo);
  const d = new Date(start);
  const dow = d.getUTCDay();                 // 0 = bazar
  return {
    index: i,
    dayNo: i + 1,
    daysAgo,
    start,
    date: d.toISOString().slice(0, 10),
    weekend: dow === 0 || dow === 6,
  };
});

/**
 * Gün daxilində realistik saat paylanması.
 *
 * ⚠ Bərabər paylanma (`06:00–23:00` arasında düz random) qüsurlu görünürdü:
 *   real platformada aktivlik iki zirvəyə yığılır — səhər iş başı və axşam.
 *   Heatmap və "son aktivlik" siyahıları bərabər paylanmada süni görünür.
 */
export function timeInDay(dayStartMs) {
  const bucket = rnd();
  let hour;
  if (bucket < 0.10) hour = randInt(7, 8);        // erkən səhər
  else if (bucket < 0.32) hour = randInt(9, 12);  // iş başı zirvəsi
  else if (bucket < 0.50) hour = randInt(13, 16); // günorta
  else if (bucket < 0.85) hour = randInt(17, 22); // axşam zirvəsi
  else hour = randInt(23, 25) % 24;               // gecə quyruğu
  return dayStartMs + hour * 3_600_000 + randInt(0, 3_599_000);
}

/**
 * `base`-dən sonra, `NOW`-dan əvvəl təsadüfi an. Uyğun aralıq yoxdursa `null`.
 *
 * 🔴 NİYƏ `Math.min(base + randInt(a, b), NOW)` YARAMIR: sıxma aralıqdan kənara
 *    düşən HƏR anı eyni nöqtəyə — bugünə — yığır. İlk qaçışda nəticə göz
 *    qabağında idi: 15-ci gündə 1 677 post (digər günlərdə ~600) və 26 308
 *    bəyənmə (digər günlərdə ~6 000). Demo "son gün hamı oyandı" kimi görünürdü.
 *
 *    Düzgün davranış: aralığın ÜST HƏDDİNİ kəsmək və qalan aralıqda BƏRABƏR
 *    paylamaq. Onda gec yaradılmış obyektlərin sadəcə daha dar pəncərəsi olur,
 *    yığılma isə yaranmır.
 */
export function timeAfter(base, minGap, maxGap, latest = NOW - 60_000) {
  const lo = base + minGap;
  const hi = Math.min(base + maxGap, latest);
  if (hi <= lo) return null;
  return randInt(lo, hi);
}

/** UTC tarix sətri (YYYY-MM-DD). */
export const dateStr = ms => new Date(ms).toISOString().slice(0, 10);

/** 32 simvollu heks id — uuid() ilə eyni məqsəd, PRNG-ə bağlı (determinist). */
export function id() {
  let s = '';
  for (let i = 0; i < 32; i++) s += ((rng() * 16) | 0).toString(16);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
