// SAF profil qatı — rank, XP tərəqqisi, status və bacarıq kateqoriyaları.
//
// 🔴 NİYƏ AYRICA MODUL: bu qaydalar ÜÇ ekranda lazımdır — istifadəçi kataloqu
//    (`users.js`), publik profil və öz profil (`profile.js`). Kataloqda
//    qalsaydı `profile.js → users.js` asılılığı yaranırdı və `users.js` onsuz
//    da `openFollowList`-i `profile.js`-ə verirdi — yəni dövr riski.
//    Bu modulun YALNIZ `util.js`/`i18n.js`/`taxonomy.js` asılılığı var.
//    (`js/icon-set.js`-in `ui.js ↔ icons.js` dövrünü qırması ilə eyni naxış.)
//
// 🔴 ƏSAS QAYDA: eyni istifadəçi kataloqda və profil səhifəsində EYNİ
//    görünməlidir. Rank rəngi və ya status etiketi iki yerdə fərqli
//    hesablansaydı, istifadəçi onları müqayisə edən kimi fərqi görərdi.
import { levelFromXP, LEVEL_THRESHOLDS, isOnline } from './util.js';
import { t } from './i18n.js';
import { tax } from './taxonomy.js';

/* ═══════════════════════ RANK VƏ XP ═══════════════════════
 *
 * ⚠ RANK YENİ MƏLUMAT DEYİL — mövcud səviyyədən (`levelFromXP`) törəyir.
 *   Ayrıca sütun əlavə etsəydik iki həqiqət mənbəyi olardı və XP dəyişəndə
 *   onlar ayrıla bilərdi. Astanalar `util.js`-dədir (orada üç nüsxə
 *   xəbərdarlığı var — dördüncüsünü yaratmaq QADAĞANDIR).
 */
const RANKS = [
  { max: 2,  key: 'bronze',  tone: 'bronze' },
  { max: 4,  key: 'silver',  tone: 'silver' },
  { max: 6,  key: 'gold',    tone: 'gold' },
  { max: 8,  key: 'diamond', tone: 'diamond' },
  { max: 9,  key: 'master',  tone: 'master' },
  { max: 99, key: 'legend',  tone: 'legend' },
];

export function rankOf(xp){
  const lvl = levelFromXP(xp);
  const r = RANKS.find(x => lvl <= x.max) || RANKS[RANKS.length - 1];
  return { lvl, key: r.key, tone: r.tone, label: t('users.rk_' + r.key) };
}

/** Cari səviyyə daxilində irəliləyiş — `{ pct, remaining, isMax }`. */
export function xpProgress(xp){
  const x = Math.max(0, xp || 0);
  const lvl = levelFromXP(x);
  const base = LEVEL_THRESHOLDS[lvl - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[lvl];
  if(next === undefined) return { pct: 100, remaining: 0, isMax: true };
  const span = next - base;
  return {
    // `span` sıfır ola bilməz (astanalar artandır), amma müdafiə ucuzdur.
    pct: span > 0 ? Math.min(100, Math.round(((x - base) / span) * 100)) : 100,
    remaining: Math.max(0, next - x),
    isMax: false,
  };
}

/* ═══════════════════════ STATUS ═══════════════════════
 *
 * 🔴 İKİ MƏNBƏ BİRLƏŞİR:
 *    • presence (`isOnline`) — ÖLÇÜLÜR, "bağlıdırmı"
 *    • `u.status`            — istifadəçi ÖZÜ qoyur, "nə demək istəyir"
 *
 *    Oflayn istifadəçinin `busy` statusu GÖSTƏRİLMİR: əl ilə qoyulmuş etiket
 *    bağlantı faktını əvəz etmir və "Məşğul" yazısı onlayn olduğu təəssüratı
 *    yaradardı. YEGANƏ istisna `hiring`-dir — o, bağlantıdan asılı olmayan
 *    uzunmüddətli niyyətdir (LinkedIn "Open to work" ilə eyni məntiq).
 */
const STATUS_META = {
  online:  { tone: 'online',  key: 'users.st_online' },
  offline: { tone: 'offline', key: 'users.st_offline' },
  away:    { tone: 'away',    key: 'users.st_away' },
  busy:    { tone: 'busy',    key: 'users.st_busy' },
  dnd:     { tone: 'dnd',     key: 'users.st_dnd' },
  hiring:  { tone: 'hiring',  key: 'users.st_hiring' },
};

export function statusOf(u){
  const online = isOnline(u);
  const manual = (u && u.status) || '';
  if(manual === 'hiring') return { ...STATUS_META.hiring, online };
  if(online && manual && STATUS_META[manual]) return { ...STATUS_META[manual], online };
  return { ...(online ? STATUS_META.online : STATUS_META.offline), online };
}

/* ═══════════════════════ BACARIQ KATEQORİYALARI ═══════════════════════
 *
 * ⚠ KATEQORİYA SERVERDƏN GƏLİR (`taxonomies.category`, miqrasiya 0050).
 *   Client-də sabit cədvəl yazsaydıq, admin yeni skill əlavə edən kimi o,
 *   kateqoriyasız qalardı — məlumat bir yerdə, görünüş başqa yerdə idarə
 *   olunardı. Burada YALNIZ kateqoriya → rəng sinfi uyğunluğu var.
 */
const SKILL_CATS = {
  lang:     'cat-lang',
  web:      'cat-web',
  db:       'cat-db',
  devops:   'cat-devops',
  cloud:    'cat-cloud',
  design:   'cat-design',
  security: 'cat-security',
  embedded: 'cat-embedded',
  spoken:   'cat-spoken',
};

/** label → kateqoriya sinfi. Taksonomiya bir dəfə indekslənir. */
let catIndex = null;

export function rebuildCatIndex(){
  catIndex = new Map();
  for(const item of [...tax.prog, ...tax.spoken]){
    catIndex.set(item.label, SKILL_CATS[item.category] || 'cat-other');
  }
}

export function skillCatClass(label){
  if(!catIndex) rebuildCatIndex();
  return catIndex.get(label) || 'cat-other';
}
