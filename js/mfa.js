// İki mərhələli təsdiq — TOTP (TASK-8 / FAZA 2 / Bənd 2).
//
// İki ayrı iş görür:
//   1. Girişin ikinci addımı (`promptMfaCode`) — parol düz olsa da sessiya
//      verilmir, əvvəlcə authenticator kodu istənilir.
//   2. Parametrlərdə qurma/söndürmə + ehtiyat kodlar.

import { api } from './api.js';
import { el, clear } from './util.js';
import { showModal, closeModal, toast, confirmDialog } from './ui.js';
import { t } from './i18n.js';
import { ensureWidget, tokenFor, resetWidget } from './turnstile.js';

/* ---------- QR ---------- */
// SVG kimi render olunur, <img src="data:..."> kimi YOX: CSP `img-src`-də
// data: icazəlidir, amma SVG element həm daha kəskin görünür, həm də temaya
// uyğun rənglənə bilir. Kodlaşdırma sınanmış kitabxanadadır — QR-ın Reed-Solomon
// hissəsini əl ilə yazmaq səhv riski deməkdir və səhv QR = qeydiyyat mümkünsüz.
async function qrSvg(text, size = 190){
  const qrcode = (await import('qrcode-generator')).default;
  const qr = qrcode(0, 'M');       // 0 = avtomatik versiya, 'M' = orta düzəliş səviyyəsi
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = size / n;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t('mfa.qr_alt'));
  // Ağ fon MƏCBURİDİR: tünd temada şəffaf fonlu QR skan olunmur.
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(n));
  bg.setAttribute('height', String(n));
  bg.setAttribute('fill', '#fff');
  svg.appendChild(bg);

  // Modulları tək `path` kimi birləşdiririk — n² ayrı <rect> DOM-u şişirdərdi.
  let d = '';
  for(let r = 0; r < n; r++){
    for(let col = 0; col < n; col++){
      if(qr.isDark(r, col)) d += `M${col} ${r}h1v1h-1z`;
    }
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', '#000');
  svg.appendChild(path);
  void cell;
  return svg;
}

/* ---------- ehtiyat kodların göstərilməsi ---------- */
// Kodlar YALNIZ BİR DƏFƏ görünür (serverdə yalnız heşləri var), ona görə
// bağlamazdan əvvəl istifadəçidən açıq təsdiq alınır.
function showBackupCodes(codes){
  const pre = el('div', { class: 'mfa-codes' },
    codes.map(c => el('code', {}, c)));

  const copy = el('button', { class: 'btn-mini', onclick: async () => {
    try{
      await navigator.clipboard.writeText(codes.join('\n'));
      toast(t('mfa.copied'));
    }catch(e){ toast(t('mfa.copy_err')); }
  } }, t('mfa.copy'));

  const download = el('button', { class: 'btn-mini', onclick: () => {
    const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'collabix-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  } }, t('mfa.download'));

  showModal([
    el('div', { class: 'section-title' }, t('mfa.codes_title')),
    el('p', { class: 'mfa-warn' }, t('mfa.codes_warn')),
    pre,
    el('div', { style: 'display:flex; gap:8px; margin:14px 0;' }, copy, download),
    el('button', { class: 'btn-primary', style: 'width:100%;', onclick: closeModal }, t('mfa.codes_done')),
  ]);
}

/* ---------- girişin ikinci addımı ---------- */

/**
 * Kod istəyən modal açır və uğurda sessiya cavabını qaytarır.
 * @param {string} challenge  serverin login cavabında verdiyi birdəfəlik token
 * @returns {Promise<object|null>} `/auth/mfa` cavabı, imtina edilsə null
 */
export function promptMfaCode(challenge){
  return new Promise(resolve => {
    const input = el('input', {
      inputMode: 'numeric', autocomplete: 'one-time-code', maxLength: 9,
      placeholder: '123456',
      style: 'width:100%; text-align:center; letter-spacing:.35em; font-size:1.25rem; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:12px; border-radius:9px;',
    });
    const status = el('div', { class: 'form-err' });
    // AUDIT-TASK-9 / A-3 — MFA addımı da hesab səviyyəsində qorunur: 3 uğursuz
    // cəhddən sonra server Turnstile tələb edir, 10-dan sonra isə onu MƏCBURİ
    // edir (fail-closed). Widget həmişə qurulur, çünki client neçə uğursuzluq
    // olduğunu bilmir; qoruma söndürülübsə `tokenFor` boş sətir qaytarır və
    // slot görünmür — yəni normal istifadəçi heç nə görmür.
    const tsSlot = el('div', { class: 'turnstile-slot', id: 'mfaTurnstile' });
    let done = false;

    const submit = async e => {
      const code = input.value.trim();
      if(code.length < 6){ status.textContent = t('mfa.err_short'); return; }
      if(e?.target) e.target.disabled = true;
      status.textContent = '';
      try{
        const res = await api('/auth/mfa', {
          method: 'POST',
          body: { challenge, code, turnstileToken: await tokenFor('mfa') },
        });
        done = true;
        closeModal();
        resolve(res);
      }catch(ex){
        resetWidget('mfa');   // token birdəfəlikdir
        status.textContent = ex.message;
        input.value = '';
        input.focus();
        if(e?.target) e.target.disabled = false;
      }
    };

    input.addEventListener('keydown', ev => { if(ev.key === 'Enter') submit({ target: null }); });

    showModal([
      el('div', { class: 'section-title' }, t('mfa.step_title')),
      el('p', { style: 'color:var(--muted); font-size:.84rem; line-height:1.6; margin-bottom:14px;' },
        t('mfa.step_sub')),
      input, tsSlot, status,
      el('button', { class: 'btn-primary', style: 'width:100%; margin-top:12px;', onclick: submit },
        t('mfa.step_btn')),
    ], {
      // Modal bağlanarsa (Esc / fon klik) axın ləğv olunmuş sayılır —
      // `resolve(null)` olmasa `login()` əbədi gözləyərdi.
      onClose: () => { if(!done) resolve(null); },
    });
    // Modal DOM-a düşəndən sonra qoşulur — `mountTurnstile` konteynerin
    // sənəddə olmasını tələb edir.
    ensureWidget('mfa', tsSlot, 'mfa');
    input.focus();
  });
}

/* ---------- Parametrlər: qurma / söndürmə ---------- */

async function startSetup(){
  let d;
  try{ d = await api('/me/mfa/setup', { method: 'POST' }); }
  catch(e){ toast(e.message); return; }

  const input = el('input', {
    inputMode: 'numeric', maxLength: 6, placeholder: '123456',
    style: 'width:100%; text-align:center; letter-spacing:.3em; font-size:1.1rem; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px; border-radius:9px;',
  });
  const status = el('div', { class: 'form-err' });

  showModal([
    el('div', { class: 'section-title' }, t('mfa.setup_title')),
    el('p', { style: 'color:var(--muted); font-size:.84rem; line-height:1.6;' }, t('mfa.setup_1')),
    el('div', { class: 'mfa-qr' }, await qrSvg(d.uri)),
    el('p', { style: 'color:var(--muted); font-size:.78rem; margin:10px 0 4px;' }, t('mfa.setup_manual')),
    el('code', { class: 'mfa-secret' }, d.secret),
    el('p', { style: 'color:var(--muted); font-size:.84rem; margin:16px 0 8px;' }, t('mfa.setup_2')),
    input, status,
    el('button', { class: 'btn-primary', style: 'width:100%; margin-top:12px;', onclick: async e => {
      e.target.disabled = true;
      status.textContent = '';
      try{
        const res = await api('/me/mfa/confirm', { method: 'POST', body: { code: input.value.trim() } });
        closeModal();
        showBackupCodes(res.backupCodes);
        loadMfaPanel();
      }catch(ex){
        status.textContent = ex.message;
        e.target.disabled = false;
      }
    } }, t('mfa.setup_confirm')),
  ]);
  input.focus();
}

// Söndürmə və ehtiyat kod yeniləmə — hər ikisi CARİ kod tələb edir.
function askCode(titleKey, onCode){
  const input = el('input', {
    inputMode: 'numeric', maxLength: 9, placeholder: '123456',
    style: 'width:100%; text-align:center; letter-spacing:.3em; font-size:1.1rem; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px; border-radius:9px;',
  });
  const status = el('div', { class: 'form-err' });
  showModal([
    el('div', { class: 'section-title' }, t(titleKey)),
    el('p', { style: 'color:var(--muted); font-size:.84rem; margin-bottom:12px;' }, t('mfa.ask_code')),
    input, status,
    el('button', { class: 'btn-primary', style: 'width:100%; margin-top:12px;', onclick: async e => {
      e.target.disabled = true;
      status.textContent = '';
      try{
        await onCode(input.value.trim());
      }catch(ex){
        status.textContent = ex.message;
        e.target.disabled = false;
      }
    } }, t('mfa.confirm')),
  ]);
  input.focus();
}

export async function loadMfaPanel(){
  const box = document.getElementById('mfaPanel');
  if(!box) return;
  let s;
  try{ s = await api('/me/mfa'); }
  catch(e){ box.textContent = t('mfa.err'); return; }

  clear(box);
  const badge = el('span', { class: 'mfa-badge ' + (s.enabled ? 'on' : 'off') },
    s.enabled ? t('mfa.on') : t('mfa.off'));

  box.append(el('div', { class: 'mfa-row' }, [
    el('div', { class: 'mfa-info' }, [
      el('div', { class: 'mfa-title' }, [t('mfa.app_name'), badge]),
      el('div', { class: 'mfa-meta' },
        s.enabled ? t('mfa.remaining').replace('{n}', s.backupRemaining) : t('mfa.app_hint')),
    ]),
    s.enabled
      ? el('button', { class: 'btn-mini block', onclick: () => askCode('mfa.disable_title', async code => {
          await api('/me/mfa', { method: 'DELETE', body: { code } });
          closeModal();
          toast(t('mfa.disabled'));
          loadMfaPanel();
        }) }, t('mfa.disable'))
      : el('button', { class: 'btn-mini', onclick: startSetup }, t('mfa.enable')),
  ]));

  // Ehtiyat kodlar bitməyə yaxınlaşırsa xəbərdarlıq — telefon itəndə yeganə yol budur.
  if(s.enabled){
    box.append(el('div', { class: 'mfa-row' }, [
      el('div', { class: 'mfa-info' }, [
        el('div', { class: 'mfa-title' }, t('mfa.backup_title')),
        el('div', { class: 'mfa-meta' + (s.backupRemaining <= 2 ? ' mfa-low' : '') },
          s.backupRemaining <= 2 ? t('mfa.backup_low') : t('mfa.backup_hint')),
      ]),
      el('button', { class: 'btn-mini', onclick: () => askCode('mfa.regen_title', async code => {
        const res = await api('/me/mfa/backup-codes', { method: 'POST', body: { code } });
        closeModal();
        showBackupCodes(res.backupCodes);
        loadMfaPanel();
      }) }, t('mfa.regen')),
    ]));
  }
}
