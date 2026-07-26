// OAuth 2.0 client qatı (TASK-8 / FAZA 2 / Bənd 5).
//
// Bütün əsl iş serverdədir (`worker/oauth.ts`) — burada yalnız:
//   • konfiqurasiya olunmuş provayderlərin düymələri,
//   • provayderdən qayıdışın (`?oauth=...`) emalı,
//   • Parametrlərdə bağlı hesabların idarəsi.
//
// GRACEFUL DEGRADATION: `/api/config` boş `oauthProviders` qaytarırsa heç bir
// düymə render olunmur — istifadəçi işləməyən seçim görmür.
import { api } from './api.js';
import { siteConfig } from './turnstile.js';
import { el, clear } from './util.js';
import { toast, confirmDialog } from './ui.js';
import { t } from './i18n.js';

// Provayder → (etiket, marka rəngi, SVG yol məlumatı).
// Loqolar inline SVG-dir: CSP xarici şəkil mənbəyinə icazə vermir və
// onsuz da `simple-icons` paketi build-də mövcuddur.
const BRAND = {
  github: {
    label: 'GitHub', color: '#24292f',
    path: 'M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0C17.3 4.6 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .3z',
  },
  google: {
    label: 'Google', color: '#4285F4',
    path: 'M12.24 10.29v3.63h5.1a4.4 4.4 0 01-1.9 2.87l3.06 2.37c1.79-1.65 2.82-4.08 2.82-6.97 0-.67-.06-1.32-.17-1.94zM5.3 14.29l-.69.53-2.44 1.9A9.99 9.99 0 0012.24 22c2.7 0 4.96-.89 6.61-2.41l-3.06-2.37c-.84.57-1.92.91-3.55.91-2.72 0-5.03-1.83-5.86-4.3zM2.17 7.28A9.96 9.96 0 002.24 12c0 1.61.39 3.13 1.07 4.72l3.13-2.43a5.99 5.99 0 010-3.82zM12.24 5.8c1.53 0 2.9.53 3.99 1.56l2.71-2.71C17.19 3.14 14.94 2 12.24 2a9.99 9.99 0 00-8.94 5.5l3.13 2.43c.83-2.47 3.14-4.13 5.81-4.13z',
  },
  linkedin: {
    label: 'LinkedIn', color: '#0A66C2',
    path: 'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 013.37-1.85c3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.55V9h3.57zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z',
  },
};

const brandIcon = p => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', BRAND[p].path);
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
};

/* ---------- giriş/qeydiyyat düymələri ---------- */

// Provayderə keçid ADİ NAVİQASİYADIR (fetch deyil): OAuth axını brauzerin
// ünvan sətrində getməlidir ki, istifadəçi provayderin əsl domenini görsün
// və `state` cookie-si top-level sorğuda daşınsın.
const startFlow = provider => { location.href = `/api/auth/oauth/${provider}/start`; };

export async function mountOAuthButtons(container){
  if(!container) return;
  const cfg = await siteConfig();
  const providers = cfg.oauthProviders || [];
  clear(container);
  if(!providers.length) return;    // heç biri qurulmayıb → bölmə görünmür

  container.append(el('div', { class: 'oauth-divider' }, el('span', {}, t('oauth.or'))));
  const row = el('div', { class: 'oauth-row' });
  providers.forEach(p => {
    if(!BRAND[p]) return;          // serverdə yeni provayder var, client hələ tanımır
    row.append(el('button', {
      type: 'button', class: 'oauth-btn', 'data-provider': p,
      style: `--brand:${BRAND[p].color}`,
      onclick: () => startFlow(p),
    }, [brandIcon(p), el('span', {}, t('oauth.with') + ' ' + BRAND[p].label)]));
  });
  container.append(row);
}

/* ---------- provayderdən qayıdış ---------- */

// Callback nəticəsi query-dədir (`?oauth=...`), hash marşrutu isə toxunulmaz
// qalır — bax `worker/routes.ts` → `appRedirect` izahı.
const RESULT_MSG = {
  linked: 'oauth.msg_linked',
  already_linked: 'oauth.msg_already',
  cancelled: 'oauth.msg_cancelled',
  state_error: 'oauth.msg_state_err',
  provider_error: 'oauth.msg_provider_err',
  blocked: 'oauth.msg_blocked',
};

/**
 * Boot-da bir dəfə çağırılır.
 * @returns {Promise<string|null>} yeni qeydiyyat bileti (varsa) — sihirbaz onu doldurur.
 */
export async function handleOAuthReturn(){
  const q = new URLSearchParams(location.search);
  const result = q.get('oauth');
  const ticket = q.get('oauth_ticket');
  if(!result && !ticket) return null;

  // Parametrləri ünvandan TƏMİZLƏ: istifadəçi səhifəni yeniləsə bilet təkrar
  // işlənməsin və link paylaşılsa başqasına düşməsin.
  const clean = location.pathname + location.hash;
  history.replaceState(null, '', clean);

  if(result && RESULT_MSG[result]) toast(t(RESULT_MSG[result]));
  return ticket || null;
}

/* ---------- Parametrlər: bağlı hesablar ---------- */

export async function loadLinkedAccounts(){
  const box = document.getElementById('oauthAccounts');
  if(!box) return;
  let d;
  try{ d = await api('/me/oauth'); }
  catch(e){ box.textContent = t('oauth.err'); return; }

  clear(box);
  if(!d.available.length){ box.textContent = t('oauth.none_available'); return; }

  const linked = new Map(d.accounts.map(a => [a.provider, a]));

  d.available.forEach(p => {
    if(!BRAND[p]) return;
    const acc = linked.get(p);
    // Son giriş üsulunu ayırmaq hesabı kilidləyər — server bunu rədd edir,
    // UI isə düyməni əvvəlcədən söndürüb səbəbini izah edir.
    const isLastMethod = !d.hasPassword && d.accounts.length <= 1;

    box.append(el('div', { class: 'oauth-acc-row' }, [
      el('span', { class: 'oauth-acc-icon', style: `color:${BRAND[p].color}` }, brandIcon(p)),
      el('div', { class: 'oauth-acc-info' }, [
        el('div', { class: 'oauth-acc-name' }, BRAND[p].label),
        el('div', { class: 'oauth-acc-meta' },
          acc ? (acc.login || acc.email || t('oauth.connected')) : t('oauth.not_connected')),
      ]),
      acc
        ? el('button', {
            class: 'btn-mini block',
            disabled: isLastMethod || undefined,
            title: isLastMethod ? t('oauth.last_method') : '',
            onclick: async e => {
              const sure = await confirmDialog(t('oauth.confirm_unlink'), { okLabel: t('oauth.unlink') });
              if(!sure) return;
              e.target.disabled = true;
              try{
                await api('/me/oauth/' + p, { method: 'DELETE' });
                toast(t('oauth.msg_unlinked'));
                loadLinkedAccounts();
              }catch(ex){ toast(ex.message); e.target.disabled = false; }
            },
          }, t('oauth.unlink'))
        : el('button', { class: 'btn-mini', onclick: () => startFlow(p) }, t('oauth.connect')),
    ]));
  });
}
