// Parol bərpası axını — AUDIT-TASK-10 / Faza 5/#5.
//
// Audit: *"Parol bərpası (unutma) axını YOXDUR — yalnız admin `temp-password`
// verir."* Sənəd bunu "real boşluq" adlandırır: parolunu unudan istifadəçi
// admin müdaxiləsi olmadan hesabına qayıda bilmirdi.
//
// ⚠ MAGIC LINK BUNU ƏVƏZ ETMİR: o, sessiya verir, lakin parolu DƏYİŞMİR —
//   istifadəçi növbəti cihazda yenə bloklanır (`changePassword` cari parolu
//   tələb edir). İki axın YAN-YANA mövcuddur və fərqli problemləri həll edir.
import { api } from './api.js';
import { el } from './util.js';
import { showModal, closeModal, toast } from './ui.js';
import { t } from './i18n.js';
import { siteConfig, tokenFor, ensureWidget, resetWidget } from './turnstile.js';

// Modal sahələri eyni görünüşü paylaşır. `el()` `style`-ı CSSOM ilə qoyur,
// yəni CSP inline-stil qadağası buna aid deyil (bax `js/util.js`).
const FIELD_CSS = 'width:100%; background:var(--surface-2); border:1px solid var(--border); '
  + 'color:var(--text); padding:10px 12px; border-radius:9px;';
const modalInput = (attrs) => el('input', { style: FIELD_CSS, ...attrs });
const labelled = (text, node) => el('div', { style: 'margin-bottom:10px;' },
  el('label', { style: 'display:block; font-size:.78rem; color:var(--muted); margin-bottom:4px;' }, text),
  node);

/**
 * 2-ci addım: e-poçta gələn 6 rəqəmli kod + yeni parol.
 *
 * 🔵 NİYƏ KOD, TƏK LİNK DEYİL:
 *   Bəzi poçt client-ləri və korporativ skanerlər məktubdakı linkləri
 *   ÖN-YÜKLƏYİR. Bərpa tokeni birdəfəlikdir, ona görə istifadəçi klikləməmiş
 *   "istifadə olunmuş" sayılır və axın ölür. Kod bu halda yeganə çıxışdır.
 *   İki yol PARALEL işləyir — link hələ də etibarlıdır.
 *
 * ⚠ Server hesabın mövcudluğunu AÇMIR. Kod səhv olanda ümumi xəta qayıdır,
 *   yəni bu ekran "belə hesab yoxdur" deyə bilməz — bu, qəsdli qorumadır
 *   (hesab sadalanmasının qarşısını alır).
 */
function showCodeStep(email) {
  const code = modalInput({
    type: 'text', inputMode: 'numeric', autocomplete: 'one-time-code',
    maxLength: 6, placeholder: '000000',
  });
  // Yalnız rəqəm: istifadəçi kopyalayanda boşluq/defis gələ bilər.
  code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); });

  const pass = modalInput({ type: 'password', autocomplete: 'new-password', placeholder: '••••••••' });
  const again = modalInput({ type: 'password', autocomplete: 'new-password', placeholder: '••••••••' });
  const status = el('div', { class: 'form-err', role: 'alert' });

  const submit = async e => {
    if (code.value.length !== 6) { status.textContent = t('reset.err_code'); code.focus(); return; }
    if (pass.value !== again.value) { status.textContent = t('reset.err_match'); return; }
    e.target.disabled = true;
    status.textContent = '';
    try {
      await api('/auth/password-reset/confirm', {
        method: 'POST', body: { email, code: code.value, password: pass.value },
      });
      closeModal();
      toast(t('reset.done'));
      location.reload();   // server yeni sessiya verdi
    } catch (ex) {
      status.textContent = ex.message;
      e.target.disabled = false;
    }
  };

  const form = el('form', { onsubmit: 'return false;' },
    labelled(t('reset.code_lbl'), code),
    el('p', { style: 'color:var(--warn, #f7bf06); font-size:.8rem; line-height:1.5; margin:2px 0 12px;' },
      t('reset.revoke_warn')),
    labelled(t('reset.new_pass'), pass),
    labelled(t('reset.new_pass2'), again),
    status,
    el('button', { class: 'btn-primary', style: 'width:100%;', type: 'submit', onclick: submit }, t('reset.save')),
    el('button', { class: 'link-btn', type: 'button', onclick: () => openPasswordResetModal() },
      t('reset.resend'))
  );

  showModal([
    el('div', { class: 'section-title' }, t('reset.code_title')),
    el('p', { style: 'color:var(--muted); font-size:.84rem; line-height:1.6; margin-bottom:14px;' },
      t('reset.code_sub')),
    form
  ]);
  code.focus();
}

/**
 * "Şifrəni unutmusan?" — e-poçt istəyən modal.
 *
 * @returns {Promise<boolean>} axın açıldımı (email qurulmayıbsa `false`)
 */
export async function openPasswordResetModal() {
  const cfg = await siteConfig();
  // Email qurulmayıbsa axın İŞLƏMİR — istifadəçini ölü yola salmırıq.
  if (!cfg.magicLink) return false;

  const input = el('input', {
    type: 'email', placeholder: 'sen@example.com', autocomplete: 'email',
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px 12px; border-radius:9px;',
  });
  const status = el('div', { class: 'form-err' });
  const tsSlot = el('div', { class: 'turnstile-slot', id: 'resetTurnstile' });

  const submit = async e => {
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = t('reset.err_email');
      return;
    }
    e.target.disabled = true;
    status.textContent = '';
    try {
      await api('/auth/password-reset', {
        method: 'POST',
        body: { email, turnstileToken: await tokenFor('reset') },
      });
      // ⚠ Server QƏSDƏN neytral cavab verir (hesab var/yox bilinmir), ona görə
      //   UI da "göndərdik" deyil, "əgər hesab varsa göndərildi" deyir —
      //   əks halda mesajın özü hesab sadalanması siqnalı olardı.
      //
      // Kod addımına keçirik. Modal BAĞLANMIR: istifadəçi eyni pəncərədə
      // kodu daxil edir — poçtdan qayıdıb yenidən axını başlatmaq lazım
      // gəlmir (linki klikləmək də hələ mümkündür, ikisi paraleldir).
      showCodeStep(email);
    } catch (ex) {
      resetWidget('reset');   // token birdəfəlikdir
      status.textContent = ex.message;
      e.target.disabled = false;
    }
  };

  showModal([
    el('div', { class: 'section-title' }, t('reset.title')),
    el('p', { style: 'color:var(--muted); font-size:.84rem; line-height:1.6; margin-bottom:14px;' },
      t('reset.sub')),
    el('div', { style: 'margin-bottom:10px;' }, input),
    tsSlot, status,
    el('button', { class: 'btn-primary', style: 'width:100%;', onclick: submit }, t('reset.send')),
  ]);
  ensureWidget('reset', tsSlot, 'reset');
  input.focus();
  return true;
}

/**
 * `?reset=<token>` ilə qayıdış — yeni parol formu.
 *
 * ⚠ Token URL-dən DƏRHAL TƏMİZLƏNİR: brauzer tarixçəsində, `Referer`
 *   başlığında və paylaşılan linkdə qalmamalıdır.
 */
export async function handlePasswordResetReturn() {
  const params = new URLSearchParams(location.search);
  const token = params.get('reset');
  if (!token) return;

  params.delete('reset');
  const clean = location.pathname + (params.toString() ? '?' + params : '') + location.hash;
  history.replaceState(null, '', clean);

  const pass = el('input', {
    type: 'password', autocomplete: 'new-password', placeholder: '••••••••',
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px 12px; border-radius:9px;',
  });
  const again = el('input', {
    type: 'password', autocomplete: 'new-password', placeholder: '••••••••',
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px 12px; border-radius:9px;',
  });
  const status = el('div', { class: 'form-err' });

  const submit = async e => {
    if (pass.value !== again.value) {
      status.textContent = t('reset.err_match');
      return;
    }
    e.target.disabled = true;
    status.textContent = '';
    try {
      await api('/auth/password-reset/confirm', {
        method: 'POST', body: { token, password: pass.value },
      });
      closeModal();
      toast(t('reset.done'));
      // Server yeni sessiya verdi → tətbiqi yenidən qur.
      location.reload();
    } catch (ex) {
      status.textContent = ex.message;
      e.target.disabled = false;
    }
  };

  showModal([
    el('div', { class: 'section-title' }, t('reset.new_title')),
    el('p', { style: 'color:var(--muted); font-size:.84rem; line-height:1.6; margin-bottom:6px;' },
      t('reset.new_sub')),
    // Sessiya ləğvi AÇIQ xəbərdarlıqdır — istifadəçi digər cihazlarından
    // çıxarılmasını sürpriz kimi görməməlidir.
    el('p', { style: 'color:var(--warn, #f7bf06); font-size:.8rem; line-height:1.5; margin-bottom:12px;' },
      t('reset.revoke_warn')),
    el('div', { style: 'margin-bottom:8px;' }, pass),
    el('div', { style: 'margin-bottom:10px;' }, again),
    status,
    el('button', { class: 'btn-primary', style: 'width:100%;', onclick: submit }, t('reset.save')),
  ]);
  pass.focus();
}
