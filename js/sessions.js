// Aktiv sessiyalar / cihazlar (TASK-8 / Bənd 3).
// İstifadəçi hansı cihazlardan giriş etdiyini görür və şübhəlisini tək kliklə
// çıxarır. Cihaz/OS/brauzer parse-ı SERVERDƏ edilir (routes.ts `parseUA`) —
// burada yalnız göstərilir.
import { api } from './api.js';
import { el } from './util.js';
import { toast, confirmDialog } from './ui.js';
import { t, fmtRelTime } from './i18n.js';
import { paintIcons } from './icon-set.js';

// AUDIT-UI: əvvəl rəngli emoji idi (📱 📲 💻). ICONS reyestrindəki adlar —
// `paintIcons` SVG ilə doldurur və rəng `currentColor`-dan gəlir.
const DEVICE_ICON = { 'mobil': 'smartphone', 'planşet': 'smartphone', 'masaüstü': 'monitor' };

function sessionRow(s, onRevoke){
  const meta = [s.browser, s.os].filter(Boolean).join(' · ');
  // Şəhər/ölkə boş ola bilər (lokal dev, və ya CF geo verməyib) — o halda
  // yalnız IP göstərilir, "undefined, undefined" kimi zibil yox.
  const place = [s.city, s.country].filter(Boolean).join(', ');
  const where = [place, s.ip].filter(Boolean).join(' · ') || t('set.sess_unknown');

  return el('div', { class: 'session-row' + (s.current ? ' session-current' : '') }, [
    el('span', { class: 'session-icon ic', 'aria-hidden': 'true',
      'data-icon': DEVICE_ICON[s.device] || 'monitor', 'data-icon-size': '18' }),
    el('div', { class: 'session-info' }, [
      el('div', { class: 'session-title' }, [
        meta || t('set.sess_unknown'),
        s.current ? el('span', { class: 'session-badge' }, t('set.sess_this')) : null,
      ].filter(Boolean)),
      el('div', { class: 'session-meta' }, where),
      el('div', { class: 'session-meta' }, t('set.sess_last') + ' ' + fmtRelTime(s.lastSeen)),
    ]),
    // Cari cihaz üçün "çıxart" göstərilmir — istifadəçi öz-özünü təsadüfən
    // çıxarmasın. Çıxış üçün onsuz da adi "Çıxış" düyməsi var.
    // `.block` — mövcud danger variantı (styles.css), yeni sinif yaratmırıq.
    s.current ? null : el('button', {
      class: 'btn-mini block',
      onclick: () => onRevoke(s),
    }, t('set.sess_revoke')),
  ].filter(Boolean));
}

export async function loadSessions(){
  const box = document.getElementById('sessionList');
  if(!box) return;
  box.textContent = t('set.sess_loading');
  let data;
  try{
    data = await api('/auth/sessions');
  }catch(e){
    box.textContent = t('set.sess_err');
    return;
  }
  box.innerHTML = '';
  if(!data.sessions.length){ box.textContent = t('set.sess_none'); return; }

  const revoke = async s => {
    const sure = await confirmDialog(t('set.sess_confirm'), { okLabel: t('set.sess_revoke') });
    if(!sure) return;
    await api('/auth/sessions/' + s.id, { method: 'DELETE' });
    toast(t('set.sess_done'));
    loadSessions();
  };
  data.sessions.forEach(s => box.appendChild(sessionRow(s, revoke)));
  paintIcons(box);   // sətirlər dinamikdir → cihaz ikonları burada boyanır

  // "Digərlərini çıxart" yalnız çıxarılacaq cihaz varsa mənalıdır.
  const btn = document.getElementById('revokeOthersBtn');
  if(btn) btn.classList.toggle('hidden', data.sessions.length < 2);
}

export function initSessions(){
  const btn = document.getElementById('revokeOthersBtn');
  if(!btn) return;
  btn.addEventListener('click', async () => {
    const sure = await confirmDialog(t('set.sess_confirm_all'), { okLabel: t('set.sess_revoke_all') });
    if(!sure) return;
    btn.disabled = true;
    try{
      await api('/auth/sessions/others', { method: 'DELETE' });
      toast(t('set.sess_done_all'));
      loadSessions();
    }catch(e){ toast(t('set.sess_err')); }
    btn.disabled = false;
  });
}
