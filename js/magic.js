// Magic link — parolsuz giriş və parol bərpası (TASK-8 / FAZA 2 / Bənd 4).
//
// Eyni mexanizm hər iki işi görür: link ilə daxil olursan, sonra Parametrlərdən
// şifrə təyin edirsən. Ayrıca "parol sıfırlama token-i" saxlamağa ehtiyac yoxdur.
//
// GRACEFUL DEGRADATION: email göndərmə qurulmayıbsa (`/api/config` → magicLink:false)
// bu axın UI-da ÜMUMİYYƏTLƏ görünmür; köhnə "admin ilə əlaqə saxla" mətni qalır.
import { api } from './api.js';
import { siteConfig, tokenFor, ensureWidget, resetWidget } from './turnstile.js';
import { el } from './util.js';
import { showModal, closeModal, toast } from './ui.js';
import { t } from './i18n.js';

export async function openMagicLinkModal(){
  const cfg = await siteConfig();
  if(!cfg.magicLink) return false;   // çağıran tərəf köhnə mətni göstərsin

  const input = el('input', {
    type: 'email', placeholder: 'sen@example.com', autocomplete: 'email',
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px 12px; border-radius:9px;',
  });
  const status = el('div', { class: 'form-err' });
  const tsSlot = el('div', { class: 'turnstile-slot', id: 'magicTurnstile' });

  const submit = async e => {
    const email = input.value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      status.textContent = t('magic.err_email');
      return;
    }
    e.target.disabled = true;
    status.textContent = '';
    try{
      await api('/auth/magic-link', {
        method: 'POST',
        body: { email, turnstileToken: await tokenFor('magic') },
      });
      // Server QƏSDƏN neytral cavab verir (hesab var/yox bilinmir), ona görə
      // UI da "göndərdik" deyil, "əgər hesab varsa göndərildi" deyir —
      // əks halda mesajın özü istifadəçi sadalanması siqnalı olardı.
      closeModal();
      toast(t('magic.sent'));
    }catch(ex){
      resetWidget('magic');   // token birdəfəlikdir
      status.textContent = ex.message;
      e.target.disabled = false;
    }
  };

  showModal([
    el('div', { class: 'section-title' }, t('magic.title')),
    el('p', { style: 'color:var(--muted); font-size:.84rem; line-height:1.6; margin-bottom:14px;' }, t('magic.sub')),
    el('div', { style: 'margin-bottom:10px;' }, input),
    tsSlot, status,
    el('button', { class: 'btn-primary', style: 'width:100%;', onclick: submit }, t('magic.send')),
  ]);

  // Widget modal DOM-a girəndən sonra qoşulur (əvvəl konteyner mövcud deyil).
  ensureWidget('magic', tsSlot, 'magic-link');
  input.focus();
  return true;
}

// Linkə klik nəticəsi `?magic=...` kimi qayıdır (bax worker/routes.ts appRedirect).
const RESULT = {
  ok: 'magic.res_ok',
  expired: 'magic.res_expired',
  blocked: 'magic.res_blocked',
};

export function handleMagicReturn(){
  const q = new URLSearchParams(location.search);
  const r = q.get('magic');
  if(!r) return;
  // Parametri ünvandan təmizlə — yenilənmədə təkrar toast çıxmasın.
  history.replaceState(null, '', location.pathname + location.hash);
  if(RESULT[r]) toast(t(RESULT[r]));
}
