// Admin panel: şikayətlər, istifadəçi blok/blokdan çıxarma, otaq yaratma, admin idarəsi.
// Client tərəf yalnız UI-dır — əsl qoruma Worker API-nin admin yoxlamasındadır.
import {
  state, watchOpenReports, resolveReport, setBlocked,
  createRoom, addAdminByUid, removeAdmin, watchAdmins,
  fetchAllFaqs, saveFaq, deleteFaq,
  fetchAllTestimonials, saveTestimonial, deleteTestimonial,
  watchContactMessages, markContactRead, seedPublicContent,
  adminUpdateUser, watchAdminLogs,
} from './store.js';
import { DEFAULT_FAQS, DEFAULT_TESTIMONIALS } from './legal.js';
/* 🔴 2026-08-09 auditi: `openRoleEditor` `js/governance.js`-də YAZILIB və
 *   ixrac olunub, lakin HEÇ BİR YERDƏN çağırılmırdı — yəni platforma rolunu
 *   dəyişən modalın açarı yox idi. Server yolu (`PUT /api/users/:uid/role` →
 *   `setUserRole`) tam işlək olsa da, admin paneldə bu bölmə "işləmirdi",
 *   çünki UI-da giriş nöqtəsi mövcud deyildi. Düymə aşağıda sətrə bağlanır. */
import { openRoleEditor } from './governance.js';
import { adminTempPassword } from './store.js';
import {
  fetchAdminUsers, fetchAdminLogs, bulkSetBlocked, fetchStatsDaily,
  reorderTaxonomy, exportCsvUrl, listRooms, hasPerm,
} from './store.js';
import { el, clear, avatarNode, nameWithBadge, fmtTime, levelFromXP, normalizeUsername, bus, emit, debounce, esc as escHtml } from './util.js';
import { api } from './api.js';
import { toast, undoToast, confirmDialog, emptyState, showModal, closeModal, skeletons } from './ui.js';
import { tax, saveTaxItem, deactivateTaxItem, seedTaxonomies } from './taxonomy.js';
import { sparklineBlock } from './sparkline.js';
import { mountThreatPanel } from './threat.js';
import { t } from './i18n.js';
import { iconTrash, iconEdit, iconLock, iconCopy } from './icons.js';

let unsubReports = null, unsubAdmins = null;
let adminSet = new Set();
let reports = [];
let pendingCount = 0; // app.js-dəki qlobal watcher 'admin-pending' ilə göndərir

/* ---------- Admin#1 (rəng kodlaması) + #8 (sparkline) ---------- */
// Semantik ton → CSS sinfi. Rənglər yalnız bəzək deyil: hər kart öz statusunu
// bildirir. Rəng TƏK siqnal deyil — etiket mətni də var (rəng korluğu üçün).
let statsSeries = null;   // {date, users, posts, complaints, blocked}[] — fetchStatsDaily-dən
// Serverdən gələn DƏQİQ saylar (real COUNT(*)). `state.users` keşi /api/users-dən
// gəlir və LIMIT 500-lə kəsilir — 500-dən çox istifadəçi olduqda "ümumi istifadəçi"
// kartı yalan rəqəm göstərirdi. Server sayı varsa həmişə ona üstünlük verilir.
let statsToday = null;    // { users, posts, complaints, blocked }

function statCard(num, lbl, tone, sparkKey){
  const card = el('div', { class: 'stat-card adm-stat tone-' + tone },
    el('div', { class: 'num' }, num),
    el('div', { class: 'lbl' }, lbl));
  if(statsSeries?.length > 1 && sparkKey){
    card.append(sparklineBlock(
      statsSeries.map(d => d[sparkKey]),
      { labels: statsSeries.map(d => d.date), tone },
    ));
  }
  return card;
}

function renderStats(){
  const cached = [...state.users.values()];
  const row = document.getElementById('adminStatRow');
  clear(row);
  row.append(
    statCard(statsToday?.users ?? cached.length, t('adm.st_users'), 'info', 'users'),
    statCard(statsToday?.complaints ?? reports.length, t('adm.st_reports'), 'danger', 'complaints'),
    statCard(pendingCount, '⏳ ' + t('adm.st_pending'), 'warn', null),
    statCard(statsToday?.blocked ?? cached.filter(u => u.blocked).length, t('adm.st_blocked'), 'alert', 'blocked'),
    statCard(adminSet.size, t('adm.st_admins'), 'ok', null),
  );
}

async function loadStatsSummary(){
  try{
    const d = await fetchStatsDaily(30);
    statsSeries = d.series || [];
    statsToday = d.today || null;
    renderStats();
  }catch(e){ /* sparkline+dəqiq say bəzəkdir — alınmasa keş rəqəmləri qalır */ }
}

function renderReports(){
  const box = document.getElementById('reportList');
  clear(box);
  if(!reports.length){ box.append(emptyState('shield', t('adm.rep_empty'))); return; }
  reports.forEach(r => {
    box.append(el('div', { class: 'report-row' },
      avatarNode(state.users.get(r.targetUid) || { name: r.targetUsername }, 'avatar'),
      el('div', { class: 'txt' },
        el('b', {}, '@' + (r.targetUsername || '?')),
        el('p', {}, (r.reason || '') + ' — ' + t('adm.rep_by') + ': @' + (r.reporterName || '?') + ' · ' + fmtTime(r.createdAt)),
      ),
      el('div', { class: 'actions' },
        el('button', { class: 'btn-mini dismiss', onclick: (e) => {
          // Şikayət silmə də geri alına bilər (Bənd 17). Sətir dərhal gizlədilir,
          // commit toast bitəndə işə düşür.
          const card = e.target.closest('.report-card, .admin-card, li, div');
          if(card) card.style.display = 'none';
          undoToast(t('adm.rep_rejected'),
            async () => { await resolveReport(r.id, 'dismissed'); },
            { undoLabel: t('adm.undo'), onUndo: () => { if(card) card.style.display = ''; } });
        } }, t('adm.rep_reject')),
        el('button', { class: 'btn-mini block', onclick: async () => {
          if(!await confirmDialog('@' + r.targetUsername + ' bloklanacaq və şikayət bağlanacaq.')) return;
          try{
            await setBlocked(r.targetUid, true);
            await resolveReport(r.id, 'blocked');
            toast('İstifadəçi bloklandı');
          }catch(e){ toast(t('adm.fail'), 'err'); }
        } }, 'Blokla'),
      ),
    ));
  });
}

/* ---------- admin: istifadəçi redaktəsi + müvəqqəti şifrə ---------- */
function openUserEditor(u){
  const inpS = 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:9px 11px; border-radius:8px; margin-bottom:8px;';
  const nameIn = el('input', { value: u.name || '', maxLength: 60, style: inpS });
  const bioIn = el('textarea', { maxLength: 400, style: inpS });
  bioIn.value = u.bio || '';
  const instaIn = el('input', { value: u.instagram || '', maxLength: 40, style: inpS });
  const ghIn = el('input', { value: u.github || '', maxLength: 40, style: inpS });
  const verIn = el('input', { type: 'checkbox', checked: u.verified === true });
  // TASK-7 / Bənd 6: XP redaktəsi (Lv XP-dən törənir → canlı Lv önizləmə).
  const xpIn = el('input', { type: 'number', min: 0, value: String(u.xp || 0), style: inpS });
  const lvlPreview = el('span', { class: 'role-badge', style: 'margin-left:8px;' }, 'Lv ' + levelFromXP(u.xp));
  xpIn.addEventListener('input', () => { lvlPreview.textContent = 'Lv ' + levelFromXP(parseInt(xpIn.value, 10) || 0); });
  showModal([
    el('div', { class: 'section-title' }, '✎ İstifadəçini redaktə et — @' + u.username),
    el('div', { class: 'field' }, el('label', {}, 'Ad'), nameIn),
    el('div', { class: 'field' }, el('label', {}, 'Bio'), bioIn),
    el('div', { class: 'row2' },
      el('div', { class: 'field' }, el('label', {}, 'Instagram'), instaIn),
      el('div', { class: 'field' }, el('label', {}, 'GitHub'), ghIn)),
    el('div', { class: 'field' },
      el('label', {}, 'XP', lvlPreview, el('span', { style: 'color:var(--muted); font-size:.7rem; margin-left:6px;' }, '(Level XP-dən hesablanır)')),
      xpIn),
    el('label', { class: 'remember-row' }, verIn, ' ✓ Verified (təsdiqlənmiş hesab)'),
    el('button', { class: 'btn-small', onclick: async e => {
      e.target.disabled = true;
      try{
        const nextXp = Math.max(0, parseInt(xpIn.value, 10) || 0);
        const fields = {
          name: nameIn.value.trim() || u.name, bio: bioIn.value.trim(),
          instagram: instaIn.value.trim(), github: ghIn.value.trim(),
          verified: verIn.checked,
        };
        // XP yalnız dəyişəndə göndər → jurnalda 'user-level-edit' yalnız real dəyişiklikdə.
        if(nextXp !== (u.xp || 0)) fields.xp = nextXp;
        await adminUpdateUser(u.uid, fields);
        // Jurnal yazısı SERVERDƏ (adminPatchUser) atılır — burada təkrar
        // logAdmin() çağırışı hər redaktə üçün ikinci, dublikat sətir yaradırdı.
        closeModal(); toast(t('adm.updated'));
      }catch(ex){ console.error(ex); toast(t('adm.fail'), 'err'); }
      e.target.disabled = false;
    } }, 'Yadda saxla'),
  ], { wide: true });
}

function openTempPassword(u){
  const passIn = el('input', { type: 'text', placeholder: 'Müvəqqəti şifrə (min 6)', maxLength: 40,
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px 12px; border-radius:9px; margin-bottom:10px;' });
  passIn.value = 'Cx' + Math.random().toString(36).slice(2, 8) + '!';
  const errEl = el('div', { class: 'form-err' });
  showModal([
    el('div', { class: 'section-title' }, t('adm.temp_pass') + ' — @' + u.username),
    el('p', { style: 'color:var(--muted); font-size:.82rem; margin-bottom:10px; line-height:1.5;' },
      t('adm.temp_pass_desc')),
    passIn, errEl,
    el('button', { class: 'btn-small', onclick: async e => {
      if(passIn.value.length < 6){ errEl.textContent = 'Minimum 6 simvol.'; return; }
      e.target.disabled = true;
      try{
        await adminTempPassword(u.uid, passIn.value);
        closeModal();
        toast(t('adm.temp_pass_set'));
      }catch(ex){
        console.error(ex);
        errEl.textContent = 'Alınmadı: ' + (ex.message || t('adm.server_err'));
      }
      e.target.disabled = false;
    } }, t('adm.set')),
  ]);
}

/* ---------- Admin#4/#5/#10: filtrlənən, səhifələnən siyahı + bulk ---------- */
// Siyahı artıq `state.users`-dən deyil, D1-dən səhifə-səhifə gəlir (0006 index-ləri).
const au = { cursor: null, loading: false, done: false, reqId: 0, count: 0 };
const selected = new Set();   // seçilmiş uid-lər (bulk üçün)

function auQuery(){
  return {
    q: (document.getElementById('adminUserSearch').value || '').trim(),
    filter: document.getElementById('adminUserFilter').value,
  };
}

function syncBulkBar(){
  const bar = document.getElementById('adminBulkBar');
  const n = selected.size;
  bar.hidden = n === 0;
  document.getElementById('adminBulkCount').textContent = t('adm.selected').replace('{0}', n);
  const rows = [...document.querySelectorAll('#adminUserList .admin-user-row')];
  const boxes = rows.map(r => r.querySelector('.row-check')).filter(Boolean);
  const all = document.getElementById('adminSelectAll');
  all.checked = boxes.length > 0 && boxes.every(b => b.checked);
  all.indeterminate = !all.checked && boxes.some(b => b.checked);
}

function adminUserRow(u){
  const isAdminUser = u.isAdmin ?? adminSet.has(u.uid);
  const self = u.uid === state.authUser.uid;

  // Özünü seçmək olmaz — toplu blok paneldən çıxış yolunu bağlamamalıdır.
  const check = self ? null : el('input', {
    type: 'checkbox', class: 'row-check',
    'aria-label': '@' + u.username,
    checked: selected.has(u.uid),
    onchange: e => {
      e.target.checked ? selected.add(u.uid) : selected.delete(u.uid);
      syncBulkBar();
    },
  });

  const row = el('div', {
    class: 'admin-user-row' + (u.blocked ? ' is-blocked' : ''),
    dataset: { uid: u.uid },
  },
    check,
    avatarNode(u, 'avatar'),
    el('div', { class: 'name' }, nameWithBadge(u), ' ',
      el('span', { class: 'sub' }, '@' + u.username
        + (isAdminUser ? ' · ⚑ admin' : '')
        + (u.blocked ? ' · ⛔ bloklu' : ''))),
    el('button', { class: 'btn-mini', title: t('a11y.edit'), 'aria-label': t('a11y.edit') + ' — @' + u.username,
      onclick: () => openUserEditor(u) }, iconEdit()),
    /* AUDIT-UI: bir sətir YUXARIDAKI redaktə düyməsi artıq SVG ikon + `t()` +
     * `aria-label` işlədir — bu düymə köçürmədən kənarda qalmışdı: '🔑' emoji,
     * sabit azərbaycanca `title`, əlçatan ad isə emojidən gəlirdi. */
    el('button', { class: 'btn-mini', title: t('adm.temp_pass'),
      'aria-label': t('adm.temp_pass') + ' — @' + u.username,
      onclick: () => openTempPassword(u) }, iconLock()),
    /* Platforma rolu (`roles` cədvəli) — komanda rolundan AYRIDIR.
       ⚠ Düymə `self` yoxlamasından KƏNARDADIR, çünki serverdəki
         `assertCanAssignRole` onsuz da özündən yüksək/bərabər rol təyinini və
         öz rolunu dəyişməyi rədd edir. UI variantları gizlətmir — rədd səbəbi
         toast-da görünür (bax `openRoleEditor` başlığı). */
    el('button', { class: 'btn-mini', title: t('gov.role_btn'),
      'aria-label': t('gov.role_btn') + ' — @' + u.username,
      onclick: () => openRoleEditor(u) }, u.role || '—'),
  );

  if(!self){
    // TASK-8 / Bənd 17 — blok/blokdan-çıxar "Geri al" toast-u ilə.
    // Təsdiq dialoqu ƏVƏZLƏNDİ: undo daha az sürtünmə yaradır (dialoqda "təsdiq"
    // vərdişlə basılır), amma səhvi 6 saniyə ərzində geri almaq imkanı verir.
    // Mutasiya toast bitənə qədər TƏXİRƏ salınır — geri alınsa serverə çatmır.
    const blockAction = (block) => {
      // Sətir dərhal optimistik yenilənir ki, istifadəçi nəticəni görsün.
      u.blocked = block;
      reloadAdminUsers();
      undoToast(
        block ? ('@' + u.username +  ' ' + t('adm.blocked')) : ('@' + u.username +  ' ' + t('adm.unblocked')),
        async () => { await setBlocked(u.uid, block); reloadAdminUsers(); },
        { undoLabel: t('adm.undo'), onUndo: () => { u.blocked = !block; reloadAdminUsers(); } },
      );
    };
    row.append(u.blocked
      ? el('button', { class: 'btn-mini dismiss', onclick: () => blockAction(false) }, t('adm.unblock'))
      : el('button', { class: 'btn-mini block', onclick: () => blockAction(true) }, 'Blokla'));
    if(isAdminUser){
      row.append(el('button', { class: 'btn-mini block', onclick: async () => {
        if(await confirmDialog('@' + u.username + ' adminlikdən çıxarılsın?')){
          try{ await removeAdmin(u.uid); toast(t('adm.removed_admin')); reloadAdminUsers(); }
          catch(e){ toast(t('adm.fail'), 'err'); }
        }
      } }, t('adm.remove_admin')));
    }
  }
  return row;
}

async function loadAdminUsers({ reset = false } = {}){
  if(!state.isAdmin) return;
  if(au.loading || (au.done && !reset)) return;
  const box = document.getElementById('adminUserList');
  if(!box) return;

  if(reset){
    au.cursor = null; au.done = false; au.count = 0;
    selected.clear();
    syncBulkBar();
    skeletons(box, 4, true);      // Admin#7 — spinner yerinə skeleton
  }
  au.loading = true;
  const my = ++au.reqId;
  const status = document.getElementById('adminUserStatus');
  status.textContent = t('users.loading');

  try{
    const d = await fetchAdminUsers({ ...auQuery(), cursor: au.cursor });
    if(my !== au.reqId) return;
    if(reset) clear(box);
    d.users.forEach(u => box.append(adminUserRow(u)));
    au.count += d.users.length;
    au.cursor = d.nextCursor;
    au.done = !d.nextCursor;
    // (əvvəl burada `au.done ? (au.count ? '' : '') : ''` vardı — hər halda ''
    //  qaytaran ölü ifadə; status sahəsi heç vaxt məlumat vermirdi.)
    if(au.done && !au.count){
      clear(box);
      box.append(emptyState('userSearch', t('adm.u_none')));
      status.textContent = '';
    } else {
      status.textContent = au.done ? t('users.end') : '';
    }
    syncBulkBar();
  }catch(e){
    if(my !== au.reqId) return;
    console.error('admin siyahısı yüklənmədi', e);
    if(reset) clear(box);
    status.textContent = t('users.err');
  }finally{
    if(my === au.reqId) au.loading = false;
  }
}
const reloadAdminUsers = () => loadAdminUsers({ reset: true });

async function runBulk(blocked){
  const uids = [...selected];
  if(!uids.length) return;
  const label = blocked ? t('adm.bulk_block') : t('adm.bulk_unblock');
  const msg = t('adm.bulk_confirm').replace('{0}', uids.length).replace('{1}', label);
  if(!await confirmDialog(msg, { danger: blocked })) return;
  try{
    const n = await bulkSetBlocked(uids, blocked);
    toast(t('adm.bulk_done').replace('{0}', n));
    selected.clear();
    reloadAdminUsers();
  }catch(e){ console.error(e); toast(t('adm.fail'), 'err'); }
}

/* ---------- taksonomiya CRUD ---------- */
let taxType = 'prog';

/* ---------- Admin#3: sürüşdür-burax sıralama ----------
   "sıra: N" əl ilə yazmaq əvəzinə DnD. Native HTML5 drag-and-drop (lib yoxdur).
   ⚠ DnD toxunma ekranlarında və klaviaturada işləmir — ona görə HƏR sətirdə
   ↑/↓ düymələri var (accessible alternativ, eyni məntiqi çağırır).            */
let dragId = null;

async function persistOrder(){
  const box = document.getElementById('taxList');
  const ids = [...box.querySelectorAll('.tax-row')].map(r => r.dataset.id);
  if(!ids.length) return;
  try{
    await reorderTaxonomy(taxType, ids);   // serverdə tək D1 batch()
    toast(t('adm.tax_saved'));
  }catch(e){ console.error(e); toast(t('adm.fail'), 'err'); }
}

// Elementi bir addım yuxarı/aşağı daşıyır (klaviatura alternativi).
function moveRow(row, dir){
  const box = row.parentElement;
  const sibling = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
  if(!sibling || !sibling.classList.contains('tax-row')) return;
  dir < 0 ? box.insertBefore(row, sibling) : box.insertBefore(sibling, row);
  row.querySelector('.tax-move-' + (dir < 0 ? 'up' : 'down'))?.focus();
  persistOrder();
}

function renderTaxList(){
  const box = document.getElementById('taxList');
  clear(box);
  const items = tax[taxType];
  if(!items.length){ box.append(el('p', { style: 'color:var(--muted); font-size:.8rem;' }, t('adm.empty_seed'))); return; }

  box.append(el('p', { class: 'tax-hint' }, t('adm.tax_hint')));

  items.forEach(item => {
    const row = el('div', {
      class: 'admin-user-row tax-row',
      draggable: 'true',
      dataset: { id: item.id },
      ondragstart: e => {
        dragId = item.id;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Firefox sürükləməni yalnız data təyin olunanda başladır.
        e.dataTransfer.setData('text/plain', item.id);
      },
      ondragend: () => { dragId = null; row.classList.remove('dragging'); },
      ondragover: e => {
        e.preventDefault();
        if(!dragId || dragId === item.id) return;
        const dragged = box.querySelector(`.tax-row[data-id="${CSS.escape(dragId)}"]`);
        if(!dragged) return;
        // Kursor sətrin yuxarı yarısındadırsa üstünə, aşağı yarısındadırsa altına.
        const r = row.getBoundingClientRect();
        const after = (e.clientY - r.top) > r.height / 2;
        box.insertBefore(dragged, after ? row.nextSibling : row);
      },
      ondrop: e => { e.preventDefault(); persistOrder(); },
    },
      el('span', { class: 'drag-handle', title: t('adm.tax_drag'), 'aria-hidden': 'true' }, '⠿'),
      el('span', { style: 'font-size:1.1rem; width:26px; text-align:center;' }, item.icon || item.flag || '🏷'),
      el('div', { class: 'name' }, item.label + ' ',
        el('span', { class: 'sub' },
          taxType === 'prog' ? 'highlight: ' + (item.highlightId || '—') : ''),
      ),
      taxType === 'prog' && item.color
        ? el('span', { style: `width:14px;height:14px;border-radius:4px;background:${/^#[0-9a-fA-F]{3,8}$/.test(item.color) ? item.color : 'transparent'};border:1px solid var(--border);` })
        : null,
      el('button', { class: 'btn-mini tax-move-up', 'aria-label': t('adm.tax_up') + ' — ' + item.label,
        onclick: e => moveRow(e.currentTarget.closest('.tax-row'), -1) }, '↑'),
      el('button', { class: 'btn-mini tax-move-down', 'aria-label': t('adm.tax_down') + ' — ' + item.label,
        onclick: e => moveRow(e.currentTarget.closest('.tax-row'), 1) }, '↓'),
      el('button', { class: 'btn-mini', 'aria-label': t('a11y.edit') + ' — ' + item.label,
        onclick: () => openTaxEditor(item) }, iconEdit()),
      el('button', { class: 'btn-mini block', onclick: async () => {
        if(await confirmDialog(`"${item.label}" deaktiv ediləcək — yeni seçimlərdə görünməyəcək (mövcud istifadəçilərdə qalır).`)){
          try{ await deactivateTaxItem(taxType, item.id); toast(t('adm.deactivated')); }catch(e){ toast(t('adm.fail'), 'err'); }
        }
      } }, 'Deaktiv'),
    );
    box.append(row);
  });
}

function openTaxEditor(item = null){
  const isProg = taxType === 'prog';
  const inp = (ph, val = '', max = 40) => el('input', { placeholder: ph, value: val, maxLength: max,
    style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:9px 11px; border-radius:8px; font-size:.85rem; margin-bottom:8px;' });
  const labelIn = inp('Ad (məs. Python)', item?.label || '');
  const iconIn = inp(isProg ? 'İkon (emoji)' : 'Bayraq (emoji)', item ? (item.icon || item.flag || '') : '', 4);
  const colorIn = isProg ? inp('Rəng (#hex)', item?.color || '#4a8fff', 9) : null;
  const hlIn = isProg ? inp('highlight.js id (python, cpp, sql...)', item?.highlightId || '', 20) : null;
  // Sıra sahəsi YOXDUR — sıralama siyahıda sürüşdür-burax ilə edilir (Admin#3).
  // Yeni element siyahının sonuna əlavə olunur.
  showModal([
    el('div', { class: 'section-title' }, (item ? t('adm.edit') + ': ' : '+ Yeni: ') + (isProg ? t('adm.prog_lang') : t('adm.spok_lang'))),
    labelIn, iconIn, colorIn, hlIn,
    el('button', { class: 'btn-small', onclick: async () => {
      const label = labelIn.value.trim();
      if(!label){ toast(t('adm.name_required'), 'err'); return; }
      try{
        await saveTaxItem(taxType, {
          id: item?.id, label,
          order: item?.order ?? (tax[taxType].length + 1),
          ...(isProg
            ? { icon: iconIn.value.trim(), color: colorIn.value.trim(), highlightId: hlIn.value.trim() }
            : { flag: iconIn.value.trim() }),
        });
        closeModal();
        toast(item ? t('adm.updated') : t('adm.added'));
      }catch(e){ console.error(e); toast(t('adm.save_failed'), 'err'); }
    } }, 'Yadda saxla'),
  ]);
}

/* ---------- public məzmun: FAQ / Rəylər / Əlaqə mesajları ---------- */
let pcTab = 'faq';
let unsubContacts = null;
let unsubLogs = null;
let contactCache = [];

const mlInput = (label, obj = {}, tag = 'input') => {
  const wrap = el('div', { class: 'field' }, el('label', {}, label));
  const inputs = {};
  ['az', 'en', 'ru'].forEach(l => {
    const i = el(tag, { placeholder: l.toUpperCase(),
      style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:8px 10px; border-radius:8px; font-size:.82rem; margin-bottom:6px;' + (tag === 'textarea' ? ' min-height:56px;' : '') });
    i.value = obj[l] || '';
    inputs[l] = i;
    wrap.append(i);
  });
  wrap.getValue = () => ({ az: inputs.az.value.trim(), en: inputs.en.value.trim(), ru: inputs.ru.value.trim() });
  return wrap;
};

async function renderPubContent(){
  const box = document.getElementById('pubContentList');
  clear(box);
  document.getElementById('pubContentAddBtn').classList.toggle('hidden', pcTab === 'contact');
  if(pcTab === 'faq'){
    const faqs = await fetchAllFaqs().catch(() => []);
    if(!faqs.length){ box.append(el('p', { style: 'color:var(--muted); font-size:.8rem;' }, 'Boşdur — seed düyməsini bas.')); return; }
    faqs.forEach(f => box.append(el('div', { class: 'admin-user-row' },
      el('div', { class: 'name' }, (f.q?.az || '—') + ' ', el('span', { class: 'sub' }, (f.category || '') + ' · sıra ' + (f.order ?? '—') + (f.active === false ?  ' · ' + t('adm.inactive') : ''))),
      el('button', { class: 'btn-mini', 'aria-label': t('a11y.edit') + ' — FAQ',
        onclick: () => openFaqEditor(f) }, iconEdit()),
      el('button', { class: 'btn-mini block', 'aria-label': t('a11y.delete') + ' — FAQ', onclick: async () => {
        if(await confirmDialog('FAQ silinsin?')){ await deleteFaq(f.id).catch(() => toast(t('adm.fail'), 'err')); renderPubContent(); }
      } }, iconTrash()),
    )));
  } else if(pcTab === 'testi'){
    const items = await fetchAllTestimonials().catch(() => []);
    if(!items.length){ box.append(el('p', { style: 'color:var(--muted); font-size:.8rem;' }, 'Boşdur — seed düyməsini bas.')); return; }
    items.forEach(x => box.append(el('div', { class: 'admin-user-row' },
      el('div', { class: 'name' }, (x.authorName || '—') + ' ',
        el('span', { class: 'sub' }, '★' + (x.rating || 5) + ' · ' + t(x.approved ? 'adm.rev_approved' : 'adm.rev_pending') + (x.featured ? ' · ' + t('adm.rev_featured') : ''))),
      el('button', { class: 'btn-mini', 'aria-label': t('a11y.edit') + ' — ' + (x.authorName || ''),
        onclick: () => openTestiEditor(x) }, iconEdit()),
      el('button', { class: 'btn-mini block', 'aria-label': t('a11y.delete') + ' — ' + (x.authorName || ''),
        onclick: async () => {
          if(await confirmDialog('Rəy silinsin?')){ await deleteTestimonial(x.id).catch(() => toast(t('adm.fail'), 'err')); renderPubContent(); }
        } }, iconTrash()),
    )));
  } else {
    if(!contactCache.length){ box.append(el('p', { style: 'color:var(--muted); font-size:.8rem;' }, t('adm.no_contact_msgs'))); return; }
    contactCache.forEach(m => box.append(el('div', { class: 'submission-row' + (m.read ? '' : ' '), style: m.read ? 'opacity:.6;' : '' },
      el('div', { class: 'txt' },
        el('b', {}, (m.name || '?') + ' — ' + (m.email || '')),
        el('p', {}, m.message || ''),
        el('span', { style: 'font-size:.7rem; color:var(--muted);' }, fmtTime(m.createdAt)),
      ),
      m.read ? null : el('button', { class: 'btn-mini dismiss', onclick: async () => {
        await markContactRead(m.id).catch(() => {});
      } }, '✓ Oxundu'),
    )));
  }
}

function openFaqEditor(f = null){
  const qIn = mlInput('Sual (AZ/EN/RU)', f?.q);
  const aIn = mlInput('Cavab (AZ/EN/RU)', f?.a, 'textarea');
  const catIn = el('input', { value: f?.category || 'usage', maxLength: 30, style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:8px 10px; border-radius:8px; margin-bottom:8px;' });
  const orderIn = el('input', { type: 'number', value: f?.order ?? 99, style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:8px 10px; border-radius:8px; margin-bottom:8px;' });
  const activeIn = el('input', { type: 'checkbox', checked: f ? f.active !== false : true });
  showModal([
    el('div', { class: 'section-title' }, f ? t('adm.faq_edit') : '+ Yeni FAQ'),
    qIn, aIn,
    el('div', { class: 'field' }, el('label', {}, 'Kateqoriya'), catIn),
    el('div', { class: 'field' }, el('label', {}, t('adm.order')), orderIn),
    el('label', { class: 'remember-row' }, activeIn, ' Aktiv (public görünür)'),
    el('button', { class: 'btn-small', onclick: async () => {
      const q = qIn.getValue(), a = aIn.getValue();
      if(!q.az || !a.az){ toast(t('adm.faq_required'), 'err'); return; }
      try{
        await saveFaq(f?.id, { q, a, category: catIn.value.trim(), order: parseInt(orderIn.value, 10) || 99, active: activeIn.checked });
        closeModal(); toast(t('adm.saved')); renderPubContent();
      }catch(e){ toast(t('adm.fail'), 'err'); }
    } }, 'Yadda saxla'),
  ], { wide: true });
}

function openTestiEditor(x = null){
  const nameIn = el('input', { value: x?.authorName || '', maxLength: 60, placeholder: 'Ad', style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:8px 10px; border-radius:8px; margin-bottom:8px;' });
  const titleIn = mlInput(t('adm.author_title'), x?.authorTitle);
  const textIn = mlInput('Rəy mətni (AZ/EN/RU)', x?.text, 'textarea');
  const ratingIn = el('input', { type: 'number', min: 1, max: 5, value: x?.rating || 5, style: 'width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:8px 10px; border-radius:8px; margin-bottom:8px;' });
  const apprIn = el('input', { type: 'checkbox', checked: x ? !!x.approved : true });
  const featIn = el('input', { type: 'checkbox', checked: x ? !!x.featured : true });
  showModal([
    el('div', { class: 'section-title' }, x ? t('adm.testi_edit') : '+ Yeni rəy'),
    el('div', { class: 'field' }, el('label', {}, t('adm.author_name')), nameIn),
    titleIn, textIn,
    el('div', { class: 'field' }, el('label', {}, 'Reytinq (1-5)'), ratingIn),
    el('label', { class: 'remember-row' }, apprIn, ' ' + t('adm.approved_cb')),
    el('label', { class: 'remember-row' }, featIn, ' Seçilmiş (homepage-də görünür)'),
    el('button', { class: 'btn-small', onclick: async () => {
      const text = textIn.getValue();
      if(!nameIn.value.trim() || !text.az){ toast(t('adm.name_az_req'), 'err'); return; }
      try{
        await saveTestimonial(x?.id, {
          authorName: nameIn.value.trim(), authorTitle: titleIn.getValue(), text,
          rating: Math.min(5, Math.max(1, parseInt(ratingIn.value, 10) || 5)),
          approved: apprIn.checked, featured: featIn.checked,
        });
        closeModal(); toast(t('adm.saved')); renderPubContent();
      }catch(e){ toast(t('adm.fail'), 'err'); }
    } }, 'Yadda saxla'),
  ], { wide: true });
}

/* ---------- Admin#6: terminal-tipli jurnal ---------- */
// Monospace + matrix estetikası, səviyyəyə görə rəngləmə, filtr, auto-scroll, kopyala.
// Səviyyə serverdən gəlir (admin_logs.level, migration 0007) — client-də ad
// üzrə təxmin edilsəydi səviyyə filtri pagination-la uzlaşmazdı.
const logState = { cursor: null, loading: false, lines: [] };

function logLine(lg){
  const ts = fmtTime(lg.createdAt);
  const lvl = ['info', 'success', 'warning', 'error'].includes(lg.level) ? lg.level : 'info';
  const badgeClass = 'badge badge-' + lvl;

  let detailTxt = lg.detail || lg.targetUid || '';
  let detailEl;
  if (detailTxt && detailTxt.length > 20) {
    const truncated = detailTxt.substring(0, 4) + '...' + detailTxt.substring(detailTxt.length - 4);
    detailEl = el('span', { class: 'uuid-truncate' },
      truncated,
      /* AUDIT-UI: '📋' emoji + sabit azərbaycanca `title` + əlçatan ad yox idi.
       * Həm də `writeText` PROMİSDİR: `await` olmadan çağırılırdı, ona görə
       * icazə rədd edilsə belə "Kopyalandı" yazılırdı (yalançı uğur bildirişi).
       * `window.toast` yoxlaması da mənasız idi — `toast` onsuz da import olunub. */
      el('button', {
        title: t('adm.copy_id'),
        'aria-label': t('adm.copy_id'),
        onclick: async () => {
          try{
            await navigator.clipboard.writeText(detailTxt);
            toast(t('dyn.copied'));
          }catch(e){
            toast(t('dyn.copy_fail'), 'err');
          }
        }
      }, iconCopy())
    );
  } else {
    detailEl = detailTxt || '—';
  }

  // AUDIT-UI: burada "..." menyusu var idi — "Detallar" və "Sil" bəndləri
  // YALNIZ `console.log` çağırırdı. İşləməyən, üstəlik DESTRUKTİV görünən
  // ("Sil") menyu göstərmək onu heç göstərməməkdən pisdir: istifadəçi audit
  // jurnalı sətrinin silinə biləcəyini düşünür. Jurnal onsuz da yalnız-oxunur
  // qeyddir. Menyu silindi; sütun da götürüldü (başlığı aşağıda uyğunlaşdı).
  return el('tr', {},
    el('td', {}, el('span', { class: badgeClass }, lvl.toUpperCase())),
    el('td', {}, ts),
    el('td', {}, lg.action || '—'),
    el('td', {}, '@' + (lg.byName || '?')),
    el('td', {}, detailEl),
  );
}

// Kopyalama üçün düz mətn (DOM-dan deyil, mənbə datadan — format sabit qalır).
function logPlainText(){
  return logState.lines.map(lg =>
    `[${fmtTime(lg.createdAt)}] ${(lg.level || 'info').toUpperCase().padEnd(7)} @${lg.byName || '?'} → ${lg.action}` +
    (lg.detail || lg.targetUid ? ' ' + (lg.detail || lg.targetUid) : '')).join('\n');
}

function renderLogLines({ append = false } = {}){
  const box = document.getElementById('adminLogList');
  if(!box) return;
  if(!append) clear(box);
  const items = append ? logState.lines.slice(box.querySelectorAll('tr').length) : logState.lines;
  if(!logState.lines.length){
    box.append(el('tr', {}, el('td', { colspan: '6', style: 'text-align:center; padding:20px; color:var(--text-sec);' }, t('adm.log_empty') || 'Jurnal boşdur')));
  } else {
    items.forEach(lg => box.append(logLine(lg)));
  }
  document.getElementById('adminLogMore').hidden = !logState.cursor;
  // Auto-scroll: yalnız istifadəçi onu söndürməyibsə.
  if(document.getElementById('adminLogAuto')?.checked && !append){
    box.scrollTop = box.scrollHeight;
  }
}

async function loadMoreLogs(){
  if(logState.loading || !logState.cursor) return;
  logState.loading = true;
  try{
    const level = document.getElementById('adminLogLevel').value;
    const d = await fetchAdminLogs({ level, cursor: logState.cursor });
    logState.lines.push(...d.logs);
    logState.cursor = d.nextCursor;
    renderLogLines({ append: true });
  }catch(e){ console.error('jurnal yüklənmədi', e); }
  finally{ logState.loading = false; }
}

/* ---------- Admin#9: otaqlar modalı ---------- */
// Tam səhifəyə keçmək əvəzinə mərkəzdə modal — iş axını qırılmır.
async function openRoomsModal(){
  const list = el('div', {});
  showModal([el('div', { class: 'section-title' }, t('adm.rooms_title')), list], { wide: true });
  skeletons(list, 3, true);
  try{
    const rooms = await listRooms();
    clear(list);
    if(!rooms.length){ list.append(emptyState('hash', t('adm.rooms_none'))); return; }
    rooms.forEach(r => list.append(el('div', { class: 'admin-user-row' },
      el('span', { style: 'width:26px; text-align:center; color:var(--muted);' }, '#'),
      el('div', { class: 'name' }, r.name || r.id),
      el('button', { class: 'btn-mini', onclick: () => { closeModal(); emit('nav', { page: 'chat' }); } },
        t('adm.room_open')),
    )));
  }catch(e){
    clear(list);
    list.append(emptyState('hash', t('users.err')));
  }
}

/* ---------- Admin#2: ripple effekti ---------- */
// Klik nöqtəsindən yayılan dalğa. Yalnız transform/opacity (GPU) işlədilir.
// Reduced-motion-da CSS animasiyanı söndürür → sadəcə görünmür.
function attachRipple(btn){
  btn.classList.add('has-ripple');
  btn.addEventListener('click', e => {
    const r = btn.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    const ink = el('span', { class: 'ripple-ink' });
    ink.style.width = ink.style.height = d + 'px';
    ink.style.left = (e.clientX - r.left - d / 2) + 'px';
    ink.style.top = (e.clientY - r.top - d / 2) + 'px';
    btn.append(ink);
    ink.addEventListener('animationend', () => ink.remove(), { once: true });
  });
}

export function initAdmin(){
  // Admin Sidebar Tab Navigation
  document.querySelectorAll('.admin-sidebar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.dataset.tab;
      document.querySelectorAll('.admin-sidebar-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));
      
      e.currentTarget.classList.add('active');
      const pane = document.getElementById(targetId);
      if(pane) pane.classList.add('active');
    });
  });

  document.getElementById('pubContentTabs').addEventListener('click', e => {
    const btn = e.target.closest('button[data-pc]');
    if(!btn) return;
    pcTab = btn.dataset.pc;
    document.querySelectorAll('#pubContentTabs button').forEach(b => b.classList.toggle('active', b === btn));
    renderPubContent();
  });
  document.getElementById('pubContentAddBtn').addEventListener('click', () => {
    if(pcTab === 'faq') openFaqEditor();
    else if(pcTab === 'testi') openTestiEditor();
  });
  document.getElementById('seedPubBtn').addEventListener('click', async e => {
    e.target.disabled = true;
    try{
      const n = await seedPublicContent(DEFAULT_FAQS, DEFAULT_TESTIMONIALS);
      toast(n ? n +  ' ' + t('adm.items_loaded') : t('adm.all_in_db'));
      renderPubContent();
    }catch(ex){ console.error(ex); toast(t('adm.fail_load'), 'err'); }
    e.target.disabled = false;
  });

  document.getElementById('taxTypeTabs').addEventListener('click', e => {
    const btn = e.target.closest('button[data-tax]');
    if(!btn) return;
    taxType = btn.dataset.tax;
    document.querySelectorAll('#taxTypeTabs button').forEach(b => b.classList.toggle('active', b === btn));
    renderTaxList();
  });
  document.getElementById('taxAddBtn').addEventListener('click', () => openTaxEditor());
  document.getElementById('seedTaxBtn').addEventListener('click', async e => {
    e.target.disabled = true;
    try{
      const n = await seedTaxonomies();
      toast(n ? n +  ' ' + t('adm.items_loaded') : t('adm.all_in_db'));
    }catch(ex){ console.error(ex); toast(t('adm.fail_load'), 'err'); }
    e.target.disabled = false;
  });
  bus.addEventListener('taxonomy-updated', () => {
    if(document.getElementById('page-admin').classList.contains('active')) renderTaxList();
  });

  // Tez keçidlər — admin işlərinə bir klik. (Admin#2: hover + ripple)
  document.getElementById('quickPendingBtn').addEventListener('click', () => emit('nav', { page: 'tasks' }));
  document.getElementById('quickTaskBtn').addEventListener('click', () => {
    emit('nav', { page: 'tasks' });
    setTimeout(() => {
      const form = document.getElementById('taskForm');
      if(form){ form.scrollIntoView({ behavior: 'smooth' }); const t = document.getElementById('taskTitle'); if(t) t.focus(); }
    }, 150);
  });
  // Admin#9 — otaqlar modal-da açılır (səhifə dəyişmir).
  document.getElementById('quickRoomsBtn').addEventListener('click', openRoomsModal);
  ['quickPendingBtn', 'quickTaskBtn', 'quickRoomsBtn'].forEach(id => attachRipple(document.getElementById(id)));
  bus.addEventListener('admin-pending', e => { pendingCount = e.detail.count; });

  /* ---------- Admin#4/#5/#10/#11: istifadəçi siyahısı ---------- */
  const uSearch = document.getElementById('adminUserSearch');
  uSearch.addEventListener('input', debounce(reloadAdminUsers, 250));
  document.getElementById('adminUserFilter').addEventListener('change', reloadAdminUsers);

  document.getElementById('adminSelectAll').addEventListener('change', e => {
    document.querySelectorAll('#adminUserList .row-check').forEach(b => {
      b.checked = e.target.checked;
      const row = b.closest('.admin-user-row');
      const uid = row?.dataset.uid;
      if(uid) e.target.checked ? selected.add(uid) : selected.delete(uid);
    });
    syncBulkBar();
  });
  document.getElementById('adminBulkBlock').addEventListener('click', () => runBulk(true));
  document.getElementById('adminBulkUnblock').addEventListener('click', () => runBulk(false));

  /* Admin#11 — CSV: Worker stream göndərir, brauzer endirir.
   *
   * ⚠ İXRAC `SYSTEM_BACKUP` TƏLƏB EDİR — kütləvi data çıxarışıdır və qapı
   *   qəsdən adi ADMIN-dən yuxarıdadır. Düymələr indi icazəyə görə gizlənir:
   *   əvvəl hər admin onları görürdü, klikləyəndə isə brauzer 403 səhifəsinə
   *   yönləndirilirdi — yəni funksiya "sınıq" görünürdü, halbuki qadağa
   *   qəsdən idi. Gizlətmək qapını zəiflətmir, sadəcə yalan vəd vermir. */
  const canExport = hasPerm('SYSTEM_BACKUP');
  for (const [id, kind] of [['adminExportUsers', 'users'], ['adminExportLogs', 'logs']]) {
    const btn = document.getElementById(id);
    if(!btn) continue;
    if(!canExport){ btn.classList.add('hidden'); continue; }
    btn.addEventListener('click', () => { window.location.href = exportCsvUrl(kind); });
  }

  /* ---------- Admin#6: terminal jurnalı ---------- */
  document.getElementById('adminLogLevel').addEventListener('change', () => emit('refresh-logs'));
  document.getElementById('adminLogMore').addEventListener('click', loadMoreLogs);
  document.getElementById('adminLogCopy').addEventListener('click', async () => {
    try{
      await navigator.clipboard.writeText(logPlainText());
      toast(t('adm.log_copied'));
    }catch(e){ toast(t('dyn.copy_fail'), 'err'); }
  });

  const btnCreateRoom = document.getElementById('btnShowCreateRoomModal');
  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
      const input = el('input', { placeholder: t('adm.room_ph') || 'Otaq adı', maxlength: '40', style: 'width:100%; height:40px; margin-bottom:16px; padding:8px 12px; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--text); box-sizing:border-box;' });
      const btn = el('button', { class: 'btn-primary', style: 'width:100%;' }, t('adm.room_btn') || 'Yarat');
      btn.onclick = async () => {
        const name = input.value.trim();
        if(!name) return;
        try{ await createRoom(name); toast(t('adm.room_created')); closeModal(); }
        catch(e){ toast(t('adm.room_create_failed'), 'err'); }
      };
      showModal([
        el('h2', { class: 'section-title', style: 'margin-top:0; font-size:1.3rem;' }, t('adm.room_new') || 'Yeni Otaq'),
        input, btn
      ]);
    });
  }

  const btnAddAdmin = document.getElementById('btnShowAddAdminModal');
  if (btnAddAdmin) {
    btnAddAdmin.addEventListener('click', () => {
      const input = el('input', { placeholder: t('adm.adm_ph') || 'İstifadəçi adı', autocapitalize: 'none', style: 'width:100%; height:40px; margin-bottom:16px; padding:8px 12px; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--text); box-sizing:border-box;' });
      const btn = el('button', { class: 'btn-primary', style: 'width:100%;' }, t('adm.adm_btn') || 'Əlavə Et');
      btn.onclick = async () => {
        const uname = normalizeUsername(input.value);
        if(!uname) return;
        const found = [...state.users.values()].find(u => u.username === uname);
        if(!found){ toast(t('adm.user_not_found'), 'err'); return; }
        const uid = found.uid;
        if(!await confirmDialog('@' + uname +  ' ' + t('adm.make_admin_desc'), { danger: false, okLabel: t('adm.make_admin') })) return;
        try{ await addAdminByUid(uid); toast('@' + uname +  ' ' + t('adm.now_admin')); closeModal(); }
        catch(e){ toast(t('adm.fail'), 'err'); }
      };
      showModal([
        el('h2', { class: 'section-title', style: 'margin-top:0; font-size:1.3rem;' }, t('adm.add_adm') || 'Admin Əlavə Et'),
        input, btn
      ]);
    });
  }
}

// İstifadəçi siyahısı artıq buradan render OLUNMUR — o, öz serverdən gələn
// səhifələnən axınına malikdir (loadAdminUsers) və hər poll-da sıfırlanmamalıdır.
function renderAll(){ renderStats(); renderReports(); renderTaxList(); }

// TASK-11 — Komandalar İdarəsi. Əvvəl yalnız ad/slug/status göstərən oxu
// siyahısı idi; indi sayğaclar, detal görünüşü və moderasiya əməliyyatları var.
let adminTeamsShowDeleted = false;
let adminTeamsQuery = '';

async function loadAdminTeams() {
  const container = document.getElementById('adminTeamsList');
  if(!container) return;
  container.innerHTML = `<div class="empty-state">Yüklənir...</div>`;
  try {
    const res = await api('/admin/teams' + (adminTeamsShowDeleted ? '?deleted=1' : ''));
    let teams = res.teams || [];
    if (adminTeamsQuery) {
      const q = adminTeamsQuery.toLowerCase();
      teams = teams.filter(t =>
        String(t.name || '').toLowerCase().includes(q) ||
        String(t.slug || '').toLowerCase().includes(q));
    }

    container.innerHTML = '';

    const bar = el('div', { style: 'display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:6px;' });
    const search = el('input', {
      type: 'search', class: 'auth-input', placeholder: 'Komanda axtar…',
      value: adminTeamsQuery, style: 'flex:1; min-width:160px;',
    });
    search.oninput = debounce(() => { adminTeamsQuery = search.value.trim(); loadAdminTeams(); }, 300);

    const toggle = el('label', { style: 'display:flex; align-items:center; gap:6px; font-size:13px;' });
    const cb = el('input', { type: 'checkbox' });
    cb.checked = adminTeamsShowDeleted;
    cb.onchange = () => { adminTeamsShowDeleted = cb.checked; loadAdminTeams(); };
    toggle.append(cb, document.createTextNode(t('adm.show_del')));

    bar.append(search, toggle);
    container.appendChild(bar);

    if (!teams.length) {
      container.appendChild(el('div', { class: 'empty-state' }, t('adm.no_team')));
      return;
    }

    teams.forEach(team => {
      const row = el('div', {
        style: 'padding:15px; background:var(--bg-card); border-radius:8px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;',
      });
      const owner = team.owner_name || team.username || team.owner_id;
      const info = el('div');
      info.innerHTML = `
        <div class="u-font-weight-bold">${escHtml(team.name)}
          <span class="u-color-text-sec u-font-size-12px">(@${escHtml(team.slug)})</span>
          ${team.status !== 'active' ? '<span class="u-color-danger u-font-size-12px">· silinib</span>' : ''}
        </div>
        <div class="u-font-size-12px u-color-text-sec u-margin-top-4px">
          Qurucu: ${escHtml(owner)} · ${Number(team.members_count || 0)} üzv ·
          ${Number(team.projects_count || 0)} layihə · ${Number(team.tasks_count || 0)} tapşırıq ·
          XP: ${Number(team.xp || 0)} · ${escHtml(team.visibility || '')}
        </div>
      `;

      const actions = el('div', { style: 'display:flex; gap:6px; flex-wrap:wrap;' });
      const detail = el('button', { class: 'btn-text btn-mini' }, 'Detallar');
      detail.onclick = () => openAdminTeamDetail(team.id);
      actions.appendChild(detail);

      if (team.status === 'active') {
        const del = el('button', { class: 'btn-text btn-mini', style: 'color:var(--danger);' }, 'Sil');
        del.onclick = async () => {
          if (!(await confirmDialog(`"${team.name}" komandası silinsin? (soft delete)`))) return;
          try {
            await api(`/admin/teams/${team.id}/action`, { method: 'POST', body: { action: 'delete' } });
            toast('Komanda silindi');
            loadAdminTeams();
          } catch (e) { toast(e.message, 'err'); }
        };
        actions.appendChild(del);
      } else {
        const restore = el('button', { class: 'btn-text btn-mini' }, t('adm.restore'));
        restore.onclick = async () => {
          try {
            await api(`/admin/teams/${team.id}/action`, { method: 'POST', body: { action: 'restore' } });
            toast(t('adm.team_restored'));
            loadAdminTeams();
          } catch (e) { toast(e.message, 'err'); }
        };
        actions.appendChild(restore);
      }

      row.append(info, actions);
      container.appendChild(row);
    });
  } catch(e) {
    container.innerHTML = `<div class="empty-state u-color-danger">Xəta: ${escHtml(e.message)}</div>`;
  }
}

async function openAdminTeamDetail(teamId) {
  const box = el('div');
  box.innerHTML = `<div class="empty-state">Yüklənir...</div>`;
  showModal([el('h2', { style: 'margin:0 0 15px;' }, t('adm.team_details')), box], { wide: true });

  try {
    const res = await api(`/admin/teams/${teamId}`);
    const { team, members = [], projects = [], stats = {} } = res;
    box.innerHTML = `
      <div class="u-margin-bottom-14px">
        <div class="u-font-size-18px u-font-weight-700">${escHtml(team.name)}</div>
        <div class="u-font-size-13px u-color-text-sec">@${escHtml(team.slug)} ·
          ${escHtml(team.visibility || '')} · ${escHtml(team.status)}</div>
        <div class="u-font-size-13px u-margin-top-6px">${escHtml(team.description || '')}</div>
      </div>
      <div class="u-display-flex u-gap-14px u-flex-wrap-wrap u-font-size-13px u-margin-bottom-14px">
        <span><strong>${Number(stats.membersCount || 0)}</strong> ${escHtml(t('adm.tm_members'))}</span>
        <span><strong>${Number(stats.projectsCount || 0)}</strong> ${escHtml(t('adm.tm_projects'))}</span>
        <span><strong>${Number(stats.tasksCount || 0)}</strong> ${escHtml(t('adm.tm_tasks'))}</span>
        <span><strong>${Number(stats.completedTasksCount || 0)}</strong> ${escHtml(t('adm.tm_done'))}</span>
        <span><strong>${Number(stats.xp || 0)}</strong> XP (${escHtml(stats.reputation || '')})</span>
        <span><strong>${Number(stats.filesCount || 0)}</strong> ${escHtml(t('adm.tm_files'))}</span>
      </div>
      <h4 class="u-margin-0-0-8px">${escHtml(t('adm.tm_members_h'))}</h4>
      <div class="u-max-height-180px u-overflow-auto u-font-size-13px">
        ${members.map(m => `<div class="u-display-flex u-justify-content-space-between u-padding-4px-0 u-border-bottom-1px-solid-border">
          <span>${escHtml(m.name || m.username)}</span><span class="u-color-text-sec">${escHtml(m.role_name || '')}</span>
        </div>`).join('') || `<div class="empty-state">${escHtml(t('adm.tm_no_members'))}</div>`}
      </div>
      <h4 class="u-margin-14px-0-8px">${escHtml(t('adm.tm_projects_h'))}</h4>
      <div class="u-max-height-180px u-overflow-auto u-font-size-13px">
        ${projects.map(p => `<div class="u-display-flex u-justify-content-space-between u-padding-4px-0 u-border-bottom-1px-solid-border">
          <span>${escHtml(p.name)}</span><span class="u-color-text-sec">${escHtml(p.status)}</span>
        </div>`).join('') || `<div class="empty-state">${escHtml(t('adm.tm_no_projects'))}</div>`}
      </div>
    `;
  } catch (e) {
    box.innerHTML = `<div class="empty-state u-color-danger">Xəta: ${escHtml(e.message)}</div>`;
  }
}

export function mountAdmin(){
  if(!state.isAdmin) return () => {};

  // Admin#7 — açılışda skeleton (boş ekran yerinə).
  skeletons(document.getElementById('reportList'), 2, true);

  unsubReports = watchOpenReports(list => { reports = list; renderAll(); });
  /* ⚠ ADMİN SİYAHISI `MANAGE_ROLES` TƏLƏB EDİR (miqrasiya 0035) və o icazə
   *   ADMIN rolunda QƏSDƏN YOXDUR — SUPER_ADMIN-dən başlayır. Qapısız
   *   abunə hər 30 saniyədə bir 403 yaradırdı: istifadəçi üçün görünməz,
   *   konsol üçün daimi qırmızı fon. Statistika kartı `adminSet.size`
   *   göstərir — icazəsiz hesab üçün sadəcə boş qalır, xəta vermir. */
  if(hasPerm('MANAGE_ROLES')){
    unsubAdmins = watchAdmins(set => { adminSet = set; renderAll(); });
  }
  unsubContacts = watchContactMessages(list => {
    contactCache = list;
    if(pcTab === 'contact') renderPubContent();
  });

  // Admin#6 — jurnal seçilmiş səviyyə ilə pollanır; ilk səhifə cursor-u saxlanılır.
  const startLogWatch = () => {
    if(unsubLogs) unsubLogs();
    const level = document.getElementById('adminLogLevel').value;
    unsubLogs = watchAdminLogs((list, nextCursor) => {
      logState.lines = list;
      logState.cursor = nextCursor;
      renderLogLines();
    }, { level });
  };
  startLogWatch();
  const onLogFilter = () => startLogWatch();
  bus.addEventListener('refresh-logs', onLogFilter);

  renderPubContent();
  loadStatsSummary();        // Admin#8 + dəqiq saylar
  reloadAdminUsers();        // Admin#4/#10
  loadAdminTeams();          // Teams
  const stopThreat = mountThreatPanel();   // TASK-8 / Bənd 1

  // Admin#10 — istifadəçi siyahısı üçün infinite scroll.
  const sentinel = document.getElementById('adminUserSentinel');
  const io = new IntersectionObserver(entries => {
    if(entries.some(e => e.isIntersecting)) loadAdminUsers();
  }, { rootMargin: '260px' });
  io.observe(sentinel);

  const onUsers = () => renderStats();     // yalnız xülasə; siyahı öz axınındadır
  const onPending = () => renderStats();
  bus.addEventListener('users-updated', onUsers);
  bus.addEventListener('admin-pending', onPending);
  renderAll();

  return () => {
    io.disconnect();
    stopThreat();
    au.reqId++;                            // uçuşdakı cavablar DOM-a toxunmasın
    au.loading = false;
    if(unsubReports){ unsubReports(); unsubReports = null; }
    if(unsubAdmins){ unsubAdmins(); unsubAdmins = null; }
    if(unsubContacts){ unsubContacts(); unsubContacts = null; }
    if(unsubLogs){ unsubLogs(); unsubLogs = null; }
    bus.removeEventListener('users-updated', onUsers);
    bus.removeEventListener('admin-pending', onPending);
    bus.removeEventListener('refresh-logs', onLogFilter);
  };
}
