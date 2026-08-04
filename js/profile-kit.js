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
import { levelFromXP, LEVEL_THRESHOLDS, isOnline, bus } from './util.js';
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

/* 🔴 İNDEKS TAKSONOMİYA GƏLƏNDƏ AVTOMATİK SIFIRLANIR.
 *
 * PROBLEM: `taxonomy.js`-dəki DEFAULT siyahılarda `category` sahəsi YOXDUR —
 * kateqoriya YALNIZ serverdən gəlir (`taxonomies.category`, miqrasiya 0050).
 * İndeks server cavabından ƏVVƏL qurulsa, HƏR bacarıq `cat-other` olur və
 * profildə hamısı "Digər" qrupuna düşür.
 *
 * ƏVVƏL bunu `users.js` özü həll edirdi (`mountUsers` daxilində
 * `rebuildCatIndex()`). Yəni qayda "hər ekran özü yadda saxlamalıdır" idi və
 * profil ekranı əlavə olunan kimi pozuldu — məhz belə də oldu.
 * İndi bilik SAHİBİNDƏDİR: indeks öz etibarsızlaşmasını özü idarə edir.
 *
 * ⚠ `bus` `util.js`-dədir və bu modul onu onsuz da import edir — yeni asılılıq
 *   yaranmır. */
bus.addEventListener('taxonomy-updated', () => { catIndex = null; });

export function skillCatClass(label){
  if(!catIndex) rebuildCatIndex();
  return catIndex.get(label) || 'cat-other';
}

/**
 * label → kateqoriya AÇARI (`lang`, `web`, …).
 *
 * ⚠ `skillCatClass`-dan törəyir, PARALEL CƏDVƏL DEYİL: profil bacarıqları
 *   kateqoriyaya görə QRUPLAŞDIRIR, kataloq isə yalnız rəngləyir. İki ayrı
 *   uyğunluq cədvəli saxlasaydıq, biri yenilənəndə digəri köhnə qalardı.
 */
export function skillCatOf(label){
  return skillCatClass(label).replace(/^cat-/, '');
}

/** Kateqoriya sırası — profil bölmələrinin GÖRÜNMƏ sırası. */
export const SKILL_CAT_ORDER = [
  'lang', 'web', 'db', 'cloud', 'devops', 'security', 'embedded', 'design', 'spoken', 'other',
];

/* ═══════════════════════ ÖRTÜK NAXIŞLARI ═══════════════════════
 *
 * ⚠ SİYAHI SERVERDƏKİ `PROFILE_COVERS` İLƏ EYNİ OLMALIDIR
 *   (`worker/routes/profile.ts`). Server ağ siyahısı təhlükəsizlik qapısıdır,
 *   bu isə seçim UI-ıdır — burada olmayan açar seçilə bilməz, serverdə
 *   olmayan açar isə rədd edilir.
 */
export const COVERS = ['', 'aurora', 'mesh', 'grid', 'dusk', 'forest', 'ember', 'ocean', 'mono'];

/** Naxış açarı → CSS sinfi. Naməlum açar default-a düşür (səssiz, sınmır). */
export function coverClass(key){
  return COVERS.includes(key || '') ? ('pf-cover--' + (key || 'aurora')) : 'pf-cover--aurora';
}

/* ═══════════════════════ AKTİVLİK STATİSTİKASI ═══════════════════════
 *
 * 🔴 CLIENT-DƏ HESABLANIR, SERVERDƏ YOX — çünki datası ONSUZ DA gəlir:
 *    `/api/users/:u/activity` bütün günlərin xəritəsini qaytarır və heatmap
 *    onu çəkir. Server tərəfdə ayrıca "seriya" sorğusu eyni sətirləri İKİNCİ
 *    dəfə oxumaq olardı.
 *
 * ⚠ GÜN AÇARI UTC-DİR (`user_activity.date` ISO 'YYYY-MM-DD'). Yerli vaxtla
 *   hesablasaydıq, gecə yarısına yaxın istifadəçidə seriya bir gün sürüşərdi.
 */
export function activityStats(days = {}){
  const keys = Object.keys(days).filter(k => (days[k] || 0) > 0).sort();
  const total = keys.reduce((s, k) => s + (days[k] || 0), 0);
  if(!keys.length) return { total: 0, current: 0, longest: 0, bestDay: null, bestCount: 0, topWeekday: -1 };

  const dayMs = 86400000;
  const asTs = k => Date.parse(k + 'T00:00:00Z');

  // Ən uzun seriya — ardıcıl günlərin sayı.
  let longest = 1, run = 1;
  for(let i = 1; i < keys.length; i++){
    run = (asTs(keys[i]) - asTs(keys[i - 1]) === dayMs) ? run + 1 : 1;
    if(run > longest) longest = run;
  }

  // Cari seriya — bu gündən (və ya dünəndən) geriyə.
  // ⚠ DÜNƏN DƏ QƏBUL OLUNUR: istifadəçi hələ bu gün heç nə etməyibsə, dünənki
  //   seriya SIFIRLANMIŞ sayılmamalıdır — gün hələ bitməyib.
  const todayKey = new Date().toISOString().slice(0, 10);
  const set = new Set(keys);
  let cursor = asTs(todayKey);
  if(!set.has(todayKey)) cursor -= dayMs;
  let current = 0;
  while(set.has(new Date(cursor).toISOString().slice(0, 10))){
    current++;
    cursor -= dayMs;
  }

  // Ən məhsuldar gün + ən aktiv həftə günü.
  let bestDay = keys[0], bestCount = days[keys[0]] || 0;
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  for(const k of keys){
    const c = days[k] || 0;
    if(c > bestCount){ bestCount = c; bestDay = k; }
    weekdays[new Date(asTs(k)).getUTCDay()] += c;
  }
  const topWeekday = weekdays.indexOf(Math.max(...weekdays));

  return { total, current, longest, bestDay, bestCount, topWeekday };
}
