// UI yardımçıları: toast, təsdiq dialoqu, modal, skeleton, tema.
import { el, clear } from './util.js';
import { t } from './i18n.js';
// Saf ikon qatı — `icons.js` DEYİL: o, buradan `toast` alır və dövr yaranardı.
import { paintIcons } from './icon-set.js';

/* ---------- toast ---------- */
export function toast(msg, type = 'ok'){
  const wrap = document.getElementById('toastWrap');
  const t = el('div', { class: 'toast ' + type }, type === 'err' ? '⚠ ' : '✓ ', msg);
  wrap.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
}

/**
 * "Geri al" toast-u (TASK-8 / Bənd 17) — destruktiv admin əməliyyatları üçün.
 *
 * STRATEGİYA: mutasiya DƏRHAL icra OLUNMUR, toast müddəti boyu TƏXİRƏ salınır.
 * İstifadəçi "Geri al"-a basarsa `commit` heç vaxt çağırılmır — yəni səhv
 * əməliyyat serverə çatmır. Alternativ (dərhal icra + inverse çağırış) audit
 * jurnalını iki sətrlə (blok + blokdan-çıxar) çirkləndirərdi; təxirə salma isə
 * təmiz qalır.
 *
 * @param {string} msg      göstəriləcək mətn ("İstifadəçi bloklandı")
 * @param {Function} commit toast bitəndə (geri alınmasa) çağırılan async funksiya
 * @param {object} [opts]   { undoLabel, seconds, onUndo }
 * @returns {{ flush: Function }} flush() — gözləməni bitirib dərhal commit edir
 */
export function undoToast(msg, commit, opts = {}){
  const seconds = opts.seconds || 6;
  const wrap = document.getElementById('toastWrap');
  let done = false;          // commit və ya undo — biri olub
  let remaining = seconds;

  const bar = el('div', { class: 'toast-undo-bar' });
  const counter = el('span', { class: 'toast-undo-count' }, String(remaining));
  const node = el('div', { class: 'toast toast-undo' },
    el('div', { class: 'toast-undo-row' },
      el('span', {}, '✓ ' + msg),
      el('button', { class: 'toast-undo-btn', onclick: () => finish(false) },
        (opts.undoLabel || 'Geri al'), ' ', counter),
    ),
    bar,
  );
  wrap.append(node);
  requestAnimationFrame(() => { bar.style.transitionDuration = seconds + 's'; bar.classList.add('run'); });

  const tick = setInterval(() => {
    remaining -= 1;
    counter.textContent = String(Math.max(0, remaining));
    if(remaining <= 0) finish(true);
  }, 1000);

  async function finish(shouldCommit){
    if(done) return;
    done = true;
    clearInterval(tick);
    clearTimeout(timer);
    node.classList.add('out');
    setTimeout(() => node.remove(), 300);
    if(shouldCommit){
      try{ await commit(); }
      catch(e){ toast((e && e.message) || 'Əməliyyat alınmadı', 'err'); }
    }else{
      if(opts.onUndo) opts.onUndo();
      toast(opts.undoneMsg || 'Ləğv edildi');
    }
  }

  // setInterval-a əlavə təhlükəsizlik: tab fonda olsa interval yavaşlaya bilər,
  // ona görə sərt taymer də qoyulur.
  const timer = setTimeout(() => finish(true), seconds * 1000 + 400);

  // Yeni undo-toast əvvəlkini DƏRHAL commit edir — iki təxirə salınmış əməliyyat
  // eyni anda "asılı" qalıb qarışmasın.
  wrap.querySelectorAll('.toast-undo').forEach(n => {
    if(n !== node && n._flush) n._flush();
  });
  node._flush = () => finish(true);

  return { flush: () => finish(true) };
}

/* ---------- modal ---------- */
const modalBg = () => document.getElementById('modalBg');
const modalCard = () => document.getElementById('modalCard');

// Modal bağlananda çağırılacaq callback (TASK-8 / Bənd 2).
// Promise qaytaran modallar üçün lazımdır: istifadəçi ✕ və ya fon klikləyib
// çıxsa, gözləyən promise BAĞLANMALIDIR — əks halda çağıran axın (məs. 2FA
// kod istəyi) əbədi asılı qalar.
let onCloseCb = null;

/* Modalı açmazdan ƏVVƏL fokusda olan element (AUDIT-UI / §1 escape-routes).
   Modal bağlananda fokus BURAYA qaytarılır — klaviatura istifadəçisi
   siyahının başına atılmır, işlədiyi yerdə qalır. */
let lastFocused = null;

// Fokus tələsi üçün: modalın içindəki fokuslana bilən elementlər.
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

const focusables = card =>
  [...card.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null || n === document.activeElement);

export function showModal(nodes, { wide = false, onClose = null, label = null } = {}){
  // Əvvəlki modal açıqdırsa onun callback-i indi işə düşür — üstünə yeni modal
  // açmaq da "bağlandı" sayılır, yoxsa köhnə promise itərdi.
  if(onCloseCb){ const cb = onCloseCb; onCloseCb = null; cb(); }
  const bg = modalBg();
  const card = modalCard();
  // ZƏNCİRVARİ MODAL: artıq açıqdırsa `lastFocused` ÜSTÜNƏ YAZILMIR — köhnə
  // dəyər modalın içindəki (indi silinən) elementi göstərərdi və fokus
  // qaytarma detached node-a düşüb itərdi.
  if(!bg.classList.contains('active')) lastFocused = document.activeElement;

  clear(card);
  card.classList.toggle('wide', wide);
  card.append(el('button', {
    class: 'modal-close', 'aria-label': t('a11y.closeModal'), onclick: closeModal,
  }, '✕'));
  for(const n of [].concat(nodes)) if(n) card.append(n);

  // Əlçatan ad: ilk başlıq/section-title `aria-labelledby` hədəfi olur.
  // Başlıq yoxdursa geri-dönüş kimi `aria-label` qoyulur — əks halda
  // `aria-labelledby` mövcud olmayan id-yə işarə edib adı TAMAM itirərdi.
  const heading = card.querySelector('.section-title, h1, h2, h3');
  if(heading){
    heading.id = 'modalTitle';
    card.setAttribute('aria-labelledby', 'modalTitle');
    card.removeAttribute('aria-label');
  } else {
    card.removeAttribute('aria-labelledby');
    card.setAttribute('aria-label', label || t('a11y.dialog'));
  }

  bg.classList.add('active');
  onCloseCb = onClose;

  // Fokus modalın İÇİNƏ keçir: ilk interaktiv element, yoxdursa kartın özü
  // (`tabindex="-1"` index.html-də var).
  const first = focusables(card).find(n => !n.classList.contains('modal-close'));
  (first || card).focus();
}

export function closeModal(){
  const wasActive = modalBg().classList.contains('active');
  modalBg().classList.remove('active');
  // Fokus çağıran düyməyə qayıdır. Element artıq DOM-da yoxdursa (səhifə
  // dəyişib) sükutla ötürülür.
  if(wasActive && lastFocused && document.contains(lastFocused)){
    try{ lastFocused.focus(); }catch{ /* fokuslana bilməyən node — əhəmiyyətsiz */ }
  }
  lastFocused = null;
  // Callback ƏVVƏLCƏ sıfırlanır, sonra çağırılır: callback-in özü showModal
  // çağırsa (zəncirvari modallar) sonsuz döngü yaranmasın.
  if(onCloseCb){ const cb = onCloseCb; onCloseCb = null; cb(); }
}

document.addEventListener('DOMContentLoaded', () => {
  modalBg().addEventListener('click', e => { if(e.target.id === 'modalBg') closeModal(); });
});

/* Escape = bağla, Tab = modalın içində dövr et (fokus tələsi).
   Sənəd səviyyəsində, `capture` fazasında: modal açıqkən altdakı səhifənin
   Tab sırasına düşmək mümkün olmamalıdır. */
document.addEventListener('keydown', e => {
  const bg = modalBg();
  if(!bg || !bg.classList.contains('active')) return;

  // Command palette (Ctrl+K) modalın üstündədir və Escape-i ÖZÜ idarə edir.
  // Guard olmasa bir Escape hər ikisini bağlayardı.
  const pal = document.getElementById('paletteBg');
  if(pal && !pal.hidden) return;

  if(e.key === 'Escape'){ e.preventDefault(); closeModal(); return; }
  if(e.key !== 'Tab') return;

  const items = focusables(modalCard());
  if(!items.length){ e.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  // Kənara çıxmaq istəyəndə əks uca sarı.
  if(e.shiftKey && (document.activeElement === first || !modalCard().contains(document.activeElement))){
    e.preventDefault(); last.focus();
  } else if(!e.shiftKey && document.activeElement === last){
    e.preventDefault(); first.focus();
  }
}, true);

/* ---------- təsdiq dialoqu ---------- */
export function confirmDialog(message, { okLabel = 'Bəli, davam et', danger = true } = {}){
  return new Promise(resolve => {
    const ok = el('button', { class: danger ? 'btn-danger' : 'btn-small', onclick: () => { closeModal(); resolve(true); } }, okLabel);
    const cancel = el('button', { class: 'btn-mini', onclick: () => { closeModal(); resolve(false); } }, 'İmtina');
    showModal([
      el('div', { class: 'section-title' }, danger ? '⚠ Təsdiq lazımdır' : 'Təsdiq'),
      el('p', { style: 'color:var(--muted); font-size:.88rem; margin-bottom:18px; line-height:1.5;' }, message),
      el('div', { style: 'display:flex; gap:10px; justify-content:flex-end;' }, cancel, ok),
    ]);
  });
}

/* ---------- skeleton ---------- */
export function skeletons(container, count = 3, small = false){
  clear(container);
  for(let i = 0; i < count; i++) container.append(el('div', { class: 'skeleton' + (small ? ' sm' : '') }));
}
/**
 * Boş vəziyyət bloku.
 *
 * @param {string} icon ICONS reyestrindəki ad (icon-set.js). Əvvəl bura xam
 *   qlif verilirdi ('⚑' '◎' '#' '✉' '✎' '★') — hər ekran fərqli simvol
 *   ailəsindən idi. Tanınmayan ad verilsə `paintIcons` onu ötürür və blok
 *   ikonsuz (amma pozulmadan) render olunur.
 * @param {string} text izah mətni
 */
export function emptyState(icon, text){
  const node = el('div', { class: 'empty-state' },
    el('div', { class: 'ic', 'data-icon': icon, 'data-icon-size': '28' }), text);
  // Blok hələ DOM-da deyil → dərhal, yerində boyanır (hadisə gözlənilmir).
  paintIcons(node);
  return node;
}

/* ---------- tema (dark → light → matrix) ---------- */
const THEME_KEY = 'collabix_theme';
export const THEMES = ['dark', 'light', 'matrix', 'cyberpunk'];
// Qliflər deyil, ICONS reyestrindəki (icons.js) SVG adları.
const THEME_ICONS = { dark: 'moon', light: 'sun', matrix: 'monitor', cyberpunk: 'bot' };
let onThemeChangeCb = null;
export function onThemeChange(fn){ onThemeChangeCb = fn; }
export function getTheme(){ return document.documentElement.dataset.theme || 'dark'; }

export function initTheme(){
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
}
export function setTheme(t){
  if(!THEMES.includes(t)) t = 'dark';
  localStorage.setItem(THEME_KEY, t);
  applyTheme(t);
  if(onThemeChangeCb) onThemeChangeCb(t);
}
export function toggleTheme(){
  const cur = getTheme();
  setTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
}
// Orbitron YALNIZ cyberpunk temasında işlənir (`css/75-touch.css`), amma əvvəl
// ilkin şrift sorğusunun içində idi — yəni BÜTÜN istifadəçilər onu hər açılışda
// endirirdi, halbuki default tema `dark`-dır. Ölçülüb: 11.5 KiB + kritik yolda
// ayrıca fayl. İndi yalnız tema həqiqətən seçiləndə, bir dəfə əlavə olunur.
//
// ⚠ CSP: `style-src` və `font-src` `fonts.googleapis.com`/`gstatic.com`-a artıq
//   icazə verir (bax `worker/index.ts`), ona görə runtime `<link>` bloklanmır.
let cyberFontLink = null;
function ensureCyberpunkFont(){
  if(cyberFontLink) return;
  cyberFontLink = document.createElement('link');
  cyberFontLink.rel = 'stylesheet';
  cyberFontLink.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400..800&display=swap';
  document.head.append(cyberFontLink);
}

// ⚠ Parametr QƏSDƏN `theme` adlanır, `t` YOX: `t` bu modulda i18n tərcümə
//   funksiyasıdır və parametr onu kölgələyərdi.
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  if(theme === 'cyberpunk') ensureCyberpunkFont();
  for(const id of ['appThemeBtn', 'pubThemeBtn', 'themeToggleBtn']){
    const btn = document.getElementById(id);
    const slot = btn?.querySelector('.ic');
    if(!slot) continue;
    slot.dataset.icon = THEME_ICONS[theme] || 'moon';
    slot.querySelector('svg')?.remove();

    // Parametrlərdəki düymənin MƏTN etiketi də var və əvvəl STATİK idi
    // (`data-i18n="set.theme.dark"`) — tema dəyişsə belə HƏMİŞƏ "Tünd" yazırdı.
    // İndi cari temaya görə yenilənir. Açar `data-i18n`-ə də YAZILIR ki, dil
    // dəyişəndə `applyI18n` onu öz mexanizmi ilə təzələsin.
    const lbl = btn.querySelector('.lbl');
    if(lbl){
      lbl.dataset.i18n = 'set.theme.' + theme;
      lbl.textContent = t('set.theme.' + theme);
    }
  }
  paintIcons(document);

  // Ümumi animasiya keçidi (bütün temalar üçün)
  document.body.classList.remove('theme-transitioning');
  void document.body.offsetWidth; // Force reflow to restart animation
  document.body.classList.add('theme-transitioning');
  setTimeout(() => {
    document.body.classList.remove('theme-transitioning');
  }, 500); // 500ms animasyon bitdikdən sonra class-ı silirik
}

/* ---------- canlı bildiriş toast-u (sağ üst, ~1s) ---------- */
export function notifToast(node){
  let wrap = document.getElementById('notifToastWrap');
  if(!wrap){
    wrap = el('div', { class: 'notif-toast-wrap', id: 'notifToastWrap' });
    document.body.append(wrap);
  }
  wrap.append(node);
  setTimeout(() => { node.classList.add('out'); setTimeout(() => node.remove(), 300); }, 1400);
}
