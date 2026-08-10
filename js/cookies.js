// Cookie razılığı (GDPR — TASK-6 / Ana#13). `/cookies` səhifəsi artıq mövcuddur;
// bura yalnız razılıq banneri + qərarın saxlanmasıdır.
//
// Niyə localStorage, KV yox: razılıq brauzer-səviyyəli faktdır (eyni istifadəçi
// başqa cihazda yenidən soruşulmalıdır) və qonaq istifadəçinin sessiyası yoxdur.
// Serverdə saxlamaq üçün əvvəlcə cookie qoymaq lazım gələrdi — yəni razılıqdan
// əvvəl cookie, ki bu da elə qadağanın özüdür.
import { el, clear, emit, prefersReducedMotion } from './util.js';
import { t } from './i18n.js';
import { lsGetJSON, lsSetJSON } from './storage.js';

const KEY = 'collabix_cookie_consent';
const VERSION = 1; // siyasət dəyişəndə artır → razılıq təkrar soruşulur

export function getConsent(){
  const raw = lsGetJSON(KEY, null);
  if(!raw || raw.v !== VERSION) return null;
  return raw;
}

// Analitika yalnız açıq razılıqla. Çağıran tərəf (gələcək analytics kodu) bunu yoxlamalıdır.
export function analyticsAllowed(){
  return getConsent()?.analytics === true;
}

function save(analytics){
  // Uğursuzluq gizli rejimdir — banner hər sessiyada görünəcək, funksionallıq pozulmur.
  lsSetJSON(KEY, { v: VERSION, analytics, ts: Date.now() });
  emit('cookie-consent', { analytics });
}

function dismiss(banner, analytics){
  save(analytics);
  if(prefersReducedMotion()){ banner.remove(); return; }
  banner.classList.add('out');
  banner.addEventListener('transitionend', () => banner.remove(), { once: true });
}

export function initCookieBanner(){
  if(getConsent()) return;            // artıq qərar verilib
  if(document.getElementById('cookieBanner')) return;

  const banner = el('div', {
    class: 'cookie-banner',
    id: 'cookieBanner',
    role: 'dialog',
    'aria-modal': 'false',            // saytı bloklamır — yalnız məlumatlandırır
    'aria-label': t('cookie.banner'),
  });

  const moreLink = el('a', {
    class: 'cb-more',
    href: '/cookies',
    onclick: e => { e.preventDefault(); emit('pub-nav', { page: 'cookies' }); },
  }, t('cookie.more'));

  banner.append(
    el('div', { class: 'cb-text' },
      el('b', {}, t('cookie.title')),
      el('p', {}, t('cookie.text'), ' ', moreLink),
    ),
    el('div', { class: 'cb-actions' },
      el('button', { class: 'btn-mini dismiss', type: 'button',
        onclick: () => dismiss(banner, false) }, t('cookie.reject')),
      el('button', { class: 'btn-small', type: 'button',
        onclick: () => dismiss(banner, true) }, t('cookie.accept')),
    ),
  );

  document.body.append(banner);
  // Növbəti frame-də `.in` → CSS keçidi işə düşsün (reduced-motion-da CSS özü söndürür).
  requestAnimationFrame(() => banner.classList.add('in'));

  // Sürüşmə bitəndə klikləri aç (`.ready`). Hərəkət edən düymə səhv-toxunmaya
  // səbəb olur, ona görə banner yerinə oturana qədər pointer-events: none.
  // transitionend gəlməzsə (reduced-motion, arxa fon tab, keçid ləğv olunub)
  // taymer eyni işi görür — banner heç vaxt "ölü" qalmır.
  const ready = () => banner.classList.add('ready');
  banner.addEventListener('transitionend', ready, { once: true });
  setTimeout(ready, 500);

  // Dil dəyişəndə banner mətni də dəyişsin.
  document.addEventListener('lang-changed', () => {
    if(!document.body.contains(banner)) return;
    clear(banner);
    banner.remove();
    initCookieBanner();
  }, { once: true });
}
