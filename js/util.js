// Ümumi yardımçılar. Bütün DOM qurulması `el()` ilə edilir —
// innerHTML + string birləşdirmə YOXDUR (XSS qorunması).
import { getLocaleTag, t, fmtRelTime } from './i18n.js';

export const CATEGORIES = ['Python','JavaScript','C++','Java','Arduino/C','İngilis','Alman','Rus','Fransız'];

// Modullar arası sadə event bus (dm-badge, notif-badge, users-updated ...).
export const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const CODE_LANGS = ['python','javascript','cpp','java','c','html','css','sql','bash'];

// Təhlükəsiz DOM qurucu: atributlar property/setAttribute ilə, mətn textContent ilə.
export function el(tag, attrs = {}, ...children){
  const n = document.createElement(tag);
  for(const [k, v] of Object.entries(attrs)){
    if(v === null || v === undefined) continue;
    if(k === 'class') n.className = v;
    else if(k === 'dataset') Object.assign(n.dataset, v);
    else if(k === 'style') n.style.cssText = v;
    else if(k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if(k in n && typeof v !== 'string') n[k] = v;
    else n.setAttribute(k, v);
  }
  for(const c of children.flat(Infinity)){
    if(c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

export function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }

// HTML escape — `innerHTML` şablonlarına düşən İSTƏNİLƏN istifadəçi mətni
// bundan keçməlidir. (Markdown lazımdırsa `markdownNode()` istifadə olunur;
// o, marked + DOMPurify cütü ilə sanitizasiya edir.)
export function esc(s){
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Username normalizasiyası — az-AZ İ/I bug-ının həlli: yalnız ASCII icazəlidir.
export function normalizeUsername(raw){
  return (raw || '').trim().toLowerCase().normalize('NFKC').replace(/[^a-z0-9._]/g, '');
}
export function validUsername(u){ return /^[a-z0-9._]{3,20}$/.test(u); }

// Şəkil URL-ləri yalnız öz R2 proxy-mizdən (/files/*) qəbul olunur —
// data: URL-lər və ixtiyari domenlər rədd edilir.
//
// ⚠ AUDIT C-1 / TASK-7 §7.7 — ƏVVƏL yalnız `/files/` prefiksi tələb olunurdu və
// bu, istismar zəncirinin 3-cü addımı idi: hücumçu posta
// `/files/teams/<yad-komanda>/documents/<açar>` yerləşdirir, feed onu render
// edir, qlobal feed-i açan HƏR KƏSİN brauzeri məxfi sənədi çəkirdi.
//
// İndi kontekstə görə İKİ funksiya var. Bu, dərinlikdə müdafiədir — əsl qapı
// serverdədir (`worker/files-auth.ts` → canReadKey + createPost yoxlaması);
// buradakı süzgəc həm də sınıq şəkil sorğularının qarşısını alır.
const PUBLIC_IMAGE_PREFIXES = ['/files/posts/', '/files/avatars/'];
const ATTACHMENT_PREFIX = '/files/msgfiles/';

// Feed / post / avatar konteksti: YALNIZ publik prefikslər.
// Bura məxfi prefiks düşməməlidir — feed qlobaldır.
export function isSafeImageURL(url){
  return typeof url === 'string'
    && !url.includes('..')
    && PUBLIC_IMAGE_PREFIXES.some(p => url.startsWith(p));
}

// Söhbət əlavəsi konteksti (DM / otaq): publik prefikslərə ƏLAVƏ olaraq
// `msgfiles/`. Onu `isSafeImageURL`-ə qatsaydıq feed yenidən açılardı; ayrı
// saxlamasaydıq isə DM şəkil önizləmələri sınardı (§5.2/tələ 2).
// Serverdə `canReadKey` bu açarı yalnız sahibinə və söhbət iştirakçılarına verir.
export function isSafeFileURL(url){
  return isSafeImageURL(url)
    || (typeof url === 'string' && !url.includes('..') && url.startsWith(ATTACHMENT_PREFIX));
}

// highlight.js lazy yüklənir (böyük kitabxana — yalnız kod görünəndə).
let hljsPromise = null;
export function highlightEl(codeEl){
  hljsPromise ??= import('highlight.js/lib/common').then(m => m.default);
  hljsPromise.then(hljs => { try{ hljs.highlightElement(codeEl); }catch(e){} });
}

// "Əli Muradov" → "ƏM" (bir sözlüdürsə ilk 2 hərf).
export function initials(name){
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  if(parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Ad/uid-dən determinist HSL fonu — eyni istifadəçi həmişə eyni rəng.
export function hashHue(str){
  let h = 0;
  for(const ch of String(str || '?')) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

// Avatar node-u: photoURL varsa şəkil, yoxsa rəngli initials dairəsi.
export function avatarNode(user, cls = 'avatar', online = false){
  const a = el('div', { class: cls });
  if(user && isSafeImageURL(user.photoURL)){
    const img = document.createElement('img');
    img.src = user.photoURL;
    img.alt = '';
    a.append(img);
  } else {
    const hue = hashHue((user && (user.uid || user.username || user.name)) || '?');
    a.classList.add('avatar-initials');
    // Açıqlıq dəyərləri WCAG AA (4.5:1) üçün seçilib. Əvvəlki 32%/82%
    // cütlüyünün ən pis halı ~60° (sarı) çalarında 4.25 idi — həddin altında.
    // 28%/86% bütün 360 çalar üzrə minimum 5.33 verir; görünüş demək olar eynidir.
    a.style.background = `hsl(${hue} 45% 28%)`;
    a.style.color = `hsl(${hue} 80% 86%)`;
    a.textContent = initials(user ? user.name : '?');
  }
  if(online) a.append(el('span', { class: 'online-dot', title: 'onlayn' }));
  return a;
}

// Ad + verified badge (yalnız verified===true olduqda ✓).
export function nameWithBadge(user, name){
  const frag = document.createDocumentFragment();
  frag.append(document.createTextNode(name ?? ((user && user.name) || '—')));
  if(user && user.verified === true){
    frag.append(el('span', { class: 'verified-badge', title: 'Təsdiqlənmiş', 'aria-label': 'Təsdiqlənmiş' }, '✓'));
  }
  return frag;
}

export function tsToMillis(ts){
  if(!ts) return 0;
  if(typeof ts === 'number') return ts;
  if(typeof ts.toMillis === 'function') return ts.toMillis();
  return 0;
}
export function fmtTime(ts){
  const ms = tsToMillis(ts);
  if(!ms) return t('time.now');
  try{
    return new Date(ms).toLocaleString(getLocaleTag(), { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  }catch(e){ return ''; }
}
export function todayStr(){ return new Date().toISOString().slice(0,10); }
export function daysBetween(a, b){ return Math.round((new Date(b) - new Date(a)) / 86400000); }

// Presence mənbəyi presence.js tərəfindən inyeksiya olunur (dairəvi import olmasın).
let presenceGetter = null;
export function setPresenceSource(fn){ presenceGetter = fn; }
export function isOnline(user){
  if(!user) return false;
  // Məxfilik: istifadəçi onlayn statusunu gizlədibsə heç kimə göstərmə.
  // M-9: `publicSettings` kənar istifadəçilər üçün, `settings` isə özü üçün.
  const pv = (user.publicSettings || user.settings || {}).privacy || {};
  if(pv.showOnlineStatus === false) return false;
  if(presenceGetter){
    const p = presenceGetter(user.uid);
    if(p) return tsToMillis(p.lastSeen) > Date.now() - 60 * 1000;
  }
  return tsToMillis(user.lastActiveAt) > Date.now() - 5 * 60 * 1000;
}
export function lastSeenText(user){
  if(!user) return '';
  if(isOnline(user)) return '🟢 ' + t('pres.online');
  const p = presenceGetter && presenceGetter(user.uid);
  const ms = p ? tsToMillis(p.lastSeen) : tsToMillis(user.lastActiveAt);
  if(!ms) return '';
  return t('pres.last_seen') + ': ' + fmtRelTime(ms);
}

// Client tərəfdə şəkil kiçiltmə → JPEG Blob (Storage-a yüklənmək üçün).
export function resizeImage(file, maxW, quality = 0.75){
  return new Promise((resolve, reject) => {
    if(!file || !file.type.startsWith('image/')) return reject(new Error('Şəkil faylı deyil'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Fayl oxuna bilmədi'));
    reader.onload = ev => {
      const img = new Image();
      img.onerror = () => reject(new Error('Şəkil aça bilmədi'));
      img.onload = () => {
        let w = img.width, h = img.height;
        if(w > maxW){ h = Math.round(h * (maxW / w)); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Şəkil emalı alınmadı')), 'image/jpeg', quality);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Hash marşrutundakı query parametrləri: "#users?skill=python" → URLSearchParams.
// App səhifələri hash-də yaşayır, ona görə location.search yox, hash parse olunur.
export function hashParams(){
  const h = location.hash || '';
  const i = h.indexOf('?');
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '');
}

/* ---------- animasiya helper-ləri (TASK-6) ---------- */

// İstifadəçi hərəkəti azaltmağı seçibmi? Animasiya qurmadan ƏVVƏL yoxlanır ki,
// heç bir transform/rAF döngəsi başlamasın (CSS-dəki reduced-motion bloku
// yalnız artıq işə düşmüş animasiyanı söndürür — JS tərəfi burada dayanır).
export function prefersReducedMotion(){
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Element viewport-a girəndə callback-i BİR DƏFƏ çağırır, sonra observer-i söndürür.
// Reduced-motion və ya IO dəstəklənmirsə dərhal çağırır (məzmun heç vaxt gizli qalmır).
// Geri qaytarılan funksiya observer-i vaxtından əvvəl ləğv edir (unmount üçün).
export function onceInView(node, cb, { threshold = 0.2, rootMargin = '0px 0px -40px 0px' } = {}){
  if(!node) return () => {};
  if(prefersReducedMotion() || typeof IntersectionObserver === 'undefined'){
    cb(node);
    return () => {};
  }
  const io = new IntersectionObserver(entries => {
    for(const e of entries){
      if(!e.isIntersecting) continue;
      io.disconnect();
      cb(node);
      return;
    }
  }, { threshold, rootMargin });
  io.observe(node);
  return () => io.disconnect();
}

// 0 → target sayğac. Locale-aware format (Intl), ease-out kubik, ~1s.
// Reduced-motion → dərhal son dəyər. Görünəndə işə salmaq üçün onceInView ilə birlikdə.
export function countUp(node, target, { duration = 1000 } = {}){
  const fmt = new Intl.NumberFormat(getLocaleTag());
  const end = Number(target) || 0;
  if(prefersReducedMotion()){
    node.textContent = fmt.format(end);
    return;
  }
  const start = performance.now();
  const step = now => {
    const p = Math.min((now - start) / duration, 1);
    node.textContent = fmt.format(Math.round(end * (1 - Math.pow(1 - p, 3))));
    if(p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// XP → level (kvadratik əyri: Lv2=100, Lv3=400, Lv4=900 ...)
export function levelFromXP(xp){ return Math.max(1, Math.floor(Math.sqrt((xp || 0) / 100)) + 1); }

export const BADGES = [
  { id:'first-post',  ic:'✎',  nameKey:'badge.first_post',  test: s => s.posts >= 1 },
  { id:'streak-7',    ic:'🔥', nameKey:'badge.streak_7',   test: s => s.streak >= 7 },
  { id:'streak-30',   ic:'🌋', nameKey:'badge.streak_30',  test: s => s.streak >= 30 },
  { id:'task-1',      ic:'☑',  nameKey:'badge.task_1',   test: s => s.tasksCompleted >= 1 },
  { id:'task-10',     ic:'🏗', nameKey:'badge.task_10',    test: s => s.tasksCompleted >= 10 },
  { id:'xp-500',      ic:'⚡', nameKey:'badge.xp_500',         test: s => s.xp >= 500 },
  { id:'xp-2000',     ic:'💎', nameKey:'badge.xp_2000',        test: s => s.xp >= 2000 },
];

export function authErrMessage(e, t_func){
  if(e && e.code === 'app/bad-username') return t_func ? t_func('dyn.err_uname_fmt') : 'İstifadəçi adı düzgün deyil (3-20 simvol: a-z, 0-9, . _).';
  return (e && e.message) ? e.message : (t_func ? t_func('dyn.err_generic') : 'Xəta baş verdi.');
}

export function updateDynamicSEO(meta) {
  if (meta.title) {
    document.title = meta.title + ' | Collabix';
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);
    if (twTitle) twTitle.setAttribute('content', meta.title);
  }
  if (meta.description) {
    const d1 = document.querySelector('meta[name="description"]');
    const d2 = document.querySelector('meta[property="og:description"]');
    const d3 = document.querySelector('meta[name="twitter:description"]');
    if (d1) d1.setAttribute('content', meta.description);
    if (d2) d2.setAttribute('content', meta.description);
    if (d3) d3.setAttribute('content', meta.description);
  }
  if (meta.url) {
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', meta.url);
  }
  if (meta.schema) {
    let script = document.getElementById('dynamic-seo-schema');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'dynamic-seo-schema';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(meta.schema);
  }
}
