// i18n: AZ / EN / RU. Statik UI mətnləri açarla (t), baza məzmunu çoxdilli field-lə.
// Dil localStorage-da yadda qalır; dəyişəndə data-i18n elementləri yenidən yazılır.
//
// 🔴 LÜĞƏT ARTIQ BU FAYLDA DEYİL (2026-08-09 perf fazası).
//
//   Əvvəl 1498 açarın hər üç dili BİR obyektdə idi və bu fayl 197 KB mənbə
//   tuturdu — bütün frontend JS-in ~15%-i. Fayl praktiki olaraq hər moduldan
//   import olunduğu üçün üç dilin hamısı ƏSAS paketə düşürdü. Default dil
//   AZ-dır, yəni tipik ziyarətçi işlətmədiyi iki dilin mətnini də endirirdi.
//
//   İndi:
//     • `i18n.dict.az.js` — STATİK import. Həm default dil, həm də bütün
//       digər dillər üçün geri düşmə mənbəyi, ona görə həmişə paketdədir.
//     • `i18n.dict.en.js` / `i18n.dict.ru.js` — `import()` ilə YALNIZ
//       həmin dil seçiləndə (və ya yadda saxlanılanda) yüklənir.
//
// ⚠ EN/RU İSTİFADƏÇİSİ ÜÇÜN QİYMƏT: ilk açılışda paket bir gediş-gəliş
//   gecikir. O anda `t()` AZ-a düşür və mətn AZ görünür — sonra paket gələn
//   kimi `applyI18n()` bir dəfə də işləyib əvəzləyir. Bu, YENİ davranış
//   deyil: `index.html` onsuz da build vaxtı AZ mətni ilə doldurulur
//   (vite.config.ts) və EN/RU istifadəçi əvvəllər də əsas JS icra olunana
//   qədər AZ görürdü. Fərq yalnız gözləmənin bir kiçik chunk qədər
//   uzanmasıdır; chunk isə `immutable` keşlənir, yəni yalnız ilk dəfə.
//
// ⚠ AÇAR DƏSTİ ÜÇ PAKETDƏ EYNİ OLMALIDIR — `test/i18n-packs.test.ts` bunu
//   yoxlayır. Uyğunsuzluq SƏSSİZDİR: çatışmayan açar AZ mətnlə görünər.
import AZ from './i18n.dict.az.js';
import { lsGet, lsSet } from './storage.js';

export const LANGS = ['az', 'en', 'ru'];
const KEY = 'collabix_lang';
let current = lsGet(KEY, 'az');

// Yüklənmiş paketlər. AZ həmişə buradadır (statik import).
const PACKS = { az: AZ };
// Cari dilin paketi. Paket hələ gəlməyibsə AZ-dır — `t()` heç vaxt boş qalmır.
let active = AZ;

const LOADERS = {
  en: () => import('./i18n.dict.en.js'),
  ru: () => import('./i18n.dict.ru.js'),
};

// ⚠ Xəta UDULUR və AZ qaytarılır: şəbəkə qüsuru saytı dilsiz qoymamalıdır.
//   Konsola yazılır ki, qüsur tamamilə görünməz olmasın.
function ensurePack(lang){
  if(PACKS[lang]) return Promise.resolve(PACKS[lang]);
  const load = LOADERS[lang];
  if(!load) return Promise.resolve(AZ);
  return load()
    .then(m => (PACKS[lang] = m.default))
    .catch(e => { console.error('[i18n] dil paketi yüklənmədi:', lang, e); return AZ; });
}

// Boot: yadda saxlanılmış dil AZ deyilsə paketi MODUL YÜKLƏNƏN KİMİ çəkməyə
// başla — sorğu boot-un qalanı ilə paralel getsin.
//
// ⚠ `bootLang` snapshot-dur: paket gələnə qədər `setLang()` başqa dilə
//   keçmiş ola bilər və onda bu nəticə ATILMALIDIR, əks halda istifadəçinin
//   seçdiyi dili köhnə cavab basardı.
const bootLang = current;
const bootReady = bootLang === 'az'
  ? Promise.resolve()
  : ensurePack(bootLang).then(() => { if(current === bootLang) active = PACKS[bootLang] || AZ; });

/** Cari dilin paketi hazır olanda həll olur. Boot ardıcıllığı lazım olan yerlər üçün. */
export const i18nReady = bootReady;

// ⚠ `in` YOX, `hasOwnProperty`: paketlər adi obyekt literalıdır, yəni
//   `'toString' in AZ` DOĞRUDUR və qoruyucusuz yoxlama açar əvəzinə funksiya
//   qaytarardı.
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);


// ⚠ `export const DICT` SİLİNDİ (2026-08-09). Onun YEGANƏ istifadəçisi
//   `vite.config.ts`-dəki i18n ön-doldurma plagini idi və o, artıq birbaşa
//   `js/i18n.dict.az.js`-i import edir.
//
//   Səbəb: `DICT` bütün dilləri bir obyektdə tələb edirdi, yəni onu saxlamaq
//   üçün EN/RU paketlərini də statik import etmək lazım gələrdi — bölmənin
//   bütün qazancı itərdi.
//
//   Plagin niyə `t()` işlətmir: `t()` açar tapılmasa açarı "oxunaqlı mətnə"
//   çevirir ("nav.home" → "Home"), yəni build vaxtı İNGİLİS fallback-ını AZ
//   səhifəyə yapışdırardı. Plagin açar yoxdursa elementi toxunulmaz qoymalıdır,
//   ona görə ona xam AZ xəritəsi lazımdır.

export function getLang(){ return current; }

// Dev-də çatışmayan açarları yığırıq (prod-da səssiz). window.__i18nMissing() → missing-i18n JSON.
const DEV = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) || false;
const _missing = new Set();
function reportMissing(key){
  if(!DEV || _missing.has(key)) return;
  _missing.add(key);
  console.warn('[i18n] çatışmayan açar:', key);
}
if(typeof window !== 'undefined'){
  window.__i18nMissing = () => JSON.stringify([...(_missing)].sort(), null, 2);
}

// Açar tapılmasa: xam açarı yox, oxunaqlı mətn qaytar ("nav.home" → "Home").
function humanize(key){
  const tail = String(key).split('.').pop().replace(/[_-]+/g, ' ').trim();
  return tail ? tail.charAt(0).toUpperCase() + tail.slice(1) : String(key);
}

// ⚠ GERİ DÜŞMƏ ZƏNCİRİ DƏYİŞMƏYİB: əvvəl `e[current] || e.az || humanize(key)`
//   idi, indi `active[key] || AZ[key] || humanize(key)`. `active` cari dilin
//   paketidir (hələ gəlməyibsə AZ), `AZ` isə baza dilidir — nəticə eynidir.
//   Açarın MÖVCUDLUĞU həmişə AZ üzrə yoxlanılır, çünki AZ tam dəstdir.
export function t(key){
  if(!has(AZ, key)){ reportMissing(key); return humanize(key); }
  return (has(active, key) && active[key]) || AZ[key] || humanize(key);
}
/**
 * Açar varsa tərcümə, yoxdursa VERİLƏN GERİ DÜŞMƏ.
 *
 * 🔴 NİYƏ `t()` KİFAYƏT ETMİR: `t()` naməlum açarı "oxunaqlı mətnə" çevirir
 *    ("bdg.first_post" → "First post") və `reportMissing` ilə xəbərdarlıq
 *    yazır. Serverdən gələn etiketlər üçün bu YANLIŞ davranışdır — orada
 *    real mətn var və o, açar adından daha yaxşıdır.
 *
 * İstifadə: nişan/nailiyyət adları serverdə YALNIZ Azərbaycanca saxlanılır
 * (`badges.label_az`). Client `code` üzrə tərcümə tapırsa onu, tapmırsa
 * server mətnini göstərir — yəni admin yeni nişan əlavə edəndə o, tərcüməsiz
 * olsa belə DÜZGÜN adla görünür.
 */
export function tOr(key, fallback){
  if(!has(AZ, key)) return fallback;
  return (has(active, key) && active[key]) || AZ[key] || fallback;
}

// Çoxdilli field ({az,en,ru}) üçün oxuyucu.
export function tf(obj){
  if(!obj) return '';
  if(typeof obj === 'string') return obj;
  return obj[current] || obj.az || Object.values(obj)[0] || '';
}

/* ---------- Locale-aware formatlama (Intl) ---------- */
const _localeTag = { az: 'az-AZ', en: 'en-US', ru: 'ru-RU' };
function localeTag(){ return _localeTag[current] || 'az-AZ'; }
export function getLocaleTag(){ return localeTag(); }

/* ⚠ AZ AY ADLARI ƏL İLƏ: brauzerin `az-AZ` ICU məlumatı natamam ola bilər və
   `month:'long'` üçün "M07" kimi xam nişan qaytarır (Chrome-da ölçüldü; Node
   eyni çağırışda "avqust" verir). Profil kartında "Qoşulub 2026 M07" çıxırdı.
   Cədvəl yalnız GERİ DÜŞMƏ yoludur — nəticə düzgün görünürsə ona toxunulmur. */
const AZ_MONTHS = ['yanvar','fevral','mart','aprel','may','iyun',
  'iyul','avqust','sentyabr','oktyabr','noyabr','dekabr'];

/**
 * "iyul 2026" / "July 2026" / "июль 2026".
 * @param {number|Date} ts
 */
export function fmtMonthYear(ts){
  const d = ts instanceof Date ? ts : new Date(Number(ts));
  if(isNaN(d.getTime())) return '';
  let month = '';
  try{ month = new Intl.DateTimeFormat(localeTag(), { month: 'long' }).format(d); }catch(e){}
  // ICU nişanı (`M07`, `L07`) və ya boş nəticə → əl ilə cədvəl.
  if(!month || /^[ML]\d{1,2}$/.test(month)) month = AZ_MONTHS[d.getMonth()] || String(d.getMonth() + 1);
  return month + ' ' + d.getFullYear();
}

export function fmtDate(ts, opts){
  const d = ts instanceof Date ? ts : new Date(Number(ts));
  if(isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(localeTag(), opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function fmtNum(n){
  const v = Number(n);
  if(!isFinite(v)) return '0';
  return new Intl.NumberFormat(localeTag()).format(v);
}

// Nisbi vaxt: "5 dəq əvvəl" / "5 min ago" / "5 мин назад".
/* Azərbaycanca nisbi vaxt adları.
 *
 * ⚠ NİYƏ ƏLLƏ: Chrome `Intl.RelativeTimeFormat.supportedLocalesOf(['az'])`
 *   üçün `az` QAYTARIR və `resolvedOptions().locale === 'az'` olur, LAKİN
 *   CLDR-in `az` nisbi-vaxt datası yoxdur → çıxış xam fallback olur:
 *   `format(-5,'hour')` → "-5 h". İstifadəçi feed-də "-5 h", sessiyalarda
 *   "son fəallıq: -27 s" görürdü. Rus/ingilis dilləri düzgün işləyir, ona
 *   görə yalnız `az` üçün öz cədvəlimiz var. */
const REL_AZ = {
  year: 'il', month: 'ay', week: 'həftə', day: 'gün',
  hour: 'saat', minute: 'dəqiqə', second: 'saniyə',
};

export function fmtRelTime(ts){
  const then = ts instanceof Date ? ts.getTime() : Number(ts);
  if(!isFinite(then)) return '';
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  /** @type {Array<[Intl.RelativeTimeFormatUnit, number]>} */
  const units = [
    ['year', 31536e6], ['month', 2592e6], ['week', 6048e5],
    ['day', 864e5], ['hour', 36e5], ['minute', 6e4], ['second', 1e3],
  ];

  if(current === 'az'){
    // 45 saniyədən yaxın — həm keçmiş, həm gələcək "indicə"dir. Bu, saat
    // fərqindən yaranan kiçik MƏNFİ fərqləri də udur.
    if(abs < 45e3) return 'indicə';
    for(const [unit, ms] of units){
      if(abs >= ms){
        const n = Math.round(abs / ms);
        return n + ' ' + REL_AZ[unit] + (diff < 0 ? ' əvvəl' : ' sonra');
      }
    }
    return 'indicə';
  }

  const rtf = new Intl.RelativeTimeFormat(localeTag(), { numeric: 'auto' });
  for(const [unit, ms] of units){
    if(abs >= ms || unit === 'second'){
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return '';
}

/**
 * Dili dəyişir. Paket keşdədirsə TAM SİNXRON işləyir (əvvəlki davranış).
 *
 * ⚠ `current`, `localStorage` və `documentElement.lang` HƏMİŞƏ DƏRHAL yazılır,
 *   paket gözlənilmir. Səbəb: çağıran kod bilavasitə ardınca `getLang()` oxuyur
 *   (məs. dil düymələrinin `active` sinfini yeniləyən `syncLangBtns`). Bunları
 *   gecikdirsək düymə köhnə dili göstərərdi.
 *
 * ⚠ MƏTN isə paket gələndə yenilənir və `lang-changed` MƏHZ ONDA göndərilir —
 *   hadisəni qabaqcadan atsaq dinləyicilər (public.js `renderPage`) səhifəni
 *   HƏLƏ köhnə dildə yenidən qurardı.
 *
 * ⚠ `current !== lang` yoxlaması yarışı bağlayır: istifadəçi paket gələnə qədər
 *   üçüncü dilə keçsə, gecikmiş cavab onun seçimini basmamalıdır.
 *
 * @returns {Promise<void>} paket tətbiq olunanda həll olur (çağırmaq məcburi deyil).
 */
export function setLang(lang){
  if(!LANGS.includes(lang)) return Promise.resolve();
  current = lang;
  lsSet(KEY, lang);
  document.documentElement.lang = lang;
  const apply = () => {
    if(current !== lang) return;
    active = PACKS[lang] || AZ;
    applyI18n();
    document.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang } }));
  };
  if(PACKS[lang]){ apply(); return Promise.resolve(); }
  return ensurePack(lang).then(apply);
}

// data-i18n="key" → textContent; data-i18n-ph="key" → placeholder.
export function applyI18n(root = document){
  root.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(n => { n.innerHTML = t(n.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-ph]').forEach(n => { n.placeholder = t(n.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-aria]').forEach(n => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach(n => { n.title = t(n.dataset.i18nTitle); });
}

/**
 * Boot-da bir dəfə çağırılır.
 *
 * ⚠ AZ üçün DAVRANIŞ EYNİDİR: `applyI18n()` sinxron işləyir, çağıran kodun
 *   ardıcıllığı pozulmur.
 *
 * ⚠ EN/RU üçün paket hələ yolda ola bilər. O halda birinci tətbiq AZ mətnini
 *   yazır (HTML onsuz da build vaxtı AZ ilə doldurulub, yəni GÖRÜNƏN yeni
 *   sıçrayış yaranmır) və paket gələn kimi ikinci tətbiq mətni əvəzləyir.
 *
 * @returns {Promise<void>} dil paketi tətbiq olunanda həll olur.
 */
export function initI18n(){
  document.documentElement.lang = current;
  applyI18n();
  if(current === 'az' || PACKS[current]) return Promise.resolve();
  return bootReady.then(() => { applyI18n(); document.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang: current } })); });
}
