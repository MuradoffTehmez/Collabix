// Parametrlər: tema, şifrə dəyişmə, data ixracı, hesab silmə.
import { changePassword, deleteAccount } from './auth.js';
import { state } from './store.js';
import { toggleTheme, toast, confirmDialog, showModal, closeModal } from './ui.js';
import { el } from './util.js';
import { authErrMessage } from './util.js';
import { t } from './i18n.js';

export function initSettings(){
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

  // Data ixracı (TASK-8 / Bənd 10) — SERVERDƏN, tam əhatə ilə.
  //
  // Köhnə həll client-dəki keşi yazırdı: yalnız yüklənmiş postlar, mesajlar
  // ümumiyyətlə yox idi. GDQ "portativlik" tələbi TAM tarixçə deməkdir, ona
  // görə ixrac server tərəfdə stream olunur (worker/routes.ts exportMyData).
  //
  // Yükləmə brauzer naviqasiyası ilə gedir (fetch+Blob yox): fayl onlarla
  // meqabayt ola bilər və hamısını yaddaşa yığmaq mənasızdır — brauzer özü
  // birbaşa diskə axıdır.
  const startExport = format => {
    const a = document.createElement('a');
    a.href = '/api/me/export?format=' + format;
    a.download = '';   // Content-Disposition serverdən gəlir
    a.click();
    toast(t('set.export_started'));
  };
  document.getElementById('exportDataBtn').addEventListener('click', () => startExport('json'));
  const csvBtn = document.getElementById('exportCsvBtn');
  if(csvBtn) csvBtn.addEventListener('click', () => startExport('csv'));

  document.getElementById('changePassBtn').addEventListener('click', async e => {
    const cur = document.getElementById('curPassInput').value;
    const next = document.getElementById('newPassInput').value;
    const err = document.getElementById('passErr');
    err.textContent = '';
    if(!cur || !next){ err.textContent = t('prof.err_pass_fld'); return; }
    if(next.length < 6){ err.textContent = t('set.err_len'); return; }
    e.target.disabled = true;
    try{
      await changePassword(cur, next);
      document.getElementById('curPassInput').value = '';
      document.getElementById('newPassInput').value = '';
      toast(t('dyn.pass_upd'));
    }catch(ex){ err.textContent = authErrMessage(ex); }
    e.target.disabled = false;
  });

  document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
    const sure = await confirmDialog(
      t('set.del_warn'),
      { okLabel: 'Bəli, hesabı sil' },
    );
    if(!sure) return;
    // Silmə üçün şifrə təsdiqi (reauthentication) tələb olunur.
    const passIn = el('input', { type: 'password', placeholder: t('set.ph_pass'),
      style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px 12px; border-radius:9px; margin-bottom:12px;' });
    const errEl = el('div', { class: 'form-err' });
    showModal([
      el('div', { class: 'section-title' }, '⚠ Son təsdiq'),
      el('p', { style: 'color:var(--muted); font-size:.85rem; margin-bottom:12px;' }, t('set.del_hint')),
      passIn, errEl,
      el('button', { class: 'btn-danger', onclick: async e => {
        if(!passIn.value) return;
        e.target.disabled = true;
        try{
          await deleteAccount(passIn.value);
          closeModal();
          toast('Hesab silindi. Sağ ol, Collabix!');
        }catch(ex){
          errEl.textContent = authErrMessage(ex);
          e.target.disabled = false;
        }
      } }, 'Hesabı birdəfəlik sil'),
    ]);
  });
}
