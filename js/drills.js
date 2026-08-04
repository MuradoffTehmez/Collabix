// ÇALIŞMALAR (öyrənmə tapşırıqları) — kateqoriya, həll göndərmə, admin yoxlaması.
//
// 🔴 BU, KOMANDA TAPŞIRIQLARI DEYİL. Repoda iki ayrı sistem var:
//   BU FAYL           → `tasks` + `submissions`, öyrənmə çalışması
//   `js/workspace.js` → `team_tasks`, layihə idarəetməsi (Kanban, sprint)
// Modul əvvəl `js/tasks.js` adlanırdı və «Tapşırıqlar» səhifəsini tuturdu;
// iş sahəsi qurulanda ad qarışıqlıq yaradırdı, ona görə `drills` oldu.
// Səhifə: `#page-drills`, marşrut: `#drills`.
//
// ⚠ DATA QATI TOXUNULMAYIB: `store.js` çağırışları (watch/create/review)
//   olduğu kimidir. Dəyişən yalnız ÇƏKİM qatıdır — səhifə köhnə xam
//   markup-dan `dr-*` dizayn qatına keçirilib (iş sahəsi ilə eyni dil).
import {
  state, watchTasks, createTask, deleteTask, reviewTask,
  watchMyPendingTasks, watchPendingTasks,
  submitSolution, watchMySubmissions, watchPendingSubmissions, reviewSubmission,
} from './store.js';
import { el, clear, fmtTime, bus, debounce, countUp, onceInView } from './util.js';
import { allCategoryLabels } from './taxonomy.js';
import { t } from './i18n.js';
import { toast, confirmDialog, showModal, closeModal, emptyState } from './ui.js';
import { paintIcons } from './icon-set.js';
import { skillCatClass } from './profile-kit.js';

let tasks = [];
let mySubs = new Map();          // taskId → mənim həllim
let pendingSubs = [];
let pendingTasks = [];
let unsubTasks = null, unsubMine = null, unsubPending = null;
let unsubMyTasks = null, unsubPendingTasks = null;

/** Filtr vəziyyəti — səhifə daxilində, sorğuya çevrilmir (data lokaldır). */
const F = { q: '', cat: 'all', status: 'all' };

const ico = (n, s = 14) => el('span', { class: 'ic', 'data-icon': n, 'data-icon-size': String(s) });
const $ = id => document.getElementById(id);

/**
 * Həllin vəziyyəti → nişan.
 *
 * ⚠ RƏNG TƏK SİQNAL DEYİL: hər vəziyyətin öz ikonu və mətni var (WCAG).
 *   Əvvəl bunlar emoji ilə yazılırdı ('⏳ yoxlanılır') — emoji platformalar
 *   arasında fərqli görünür və ekran oxuyucusu onu təsvir kimi oxuyur.
 */
const SUB_STATE = {
  pending: { tone: 'amber', icon: 'clock', lbl: 'dr.s_pending' },
  approved: { tone: 'green', icon: 'check', lbl: 'dr.s_approved' },
  rejected: { tone: 'rose', icon: 'x', lbl: 'dr.s_rejected' },
};

/* ═══════════════════════ BAŞLIQ ═══════════════════════ */

function buildHead(){
  const head = $('drHead');
  clear(head);
  head.append(
    el('div', { class: 'dr-head__t' },
      el('h1', { class: 'dr-title' }, t('nav.drills')),
      el('p', { class: 'dr-sub' }, t('dr.sub')),
    ),
    el('div', { class: 'dr-head__a' },
      el('button', {
        class: 'c-btn c-btn--primary c-btn--sm', type: 'button',
        onclick: () => toggleForm(),
      }, ico('edit', 15), t(state.isAdmin ? 'dr.create' : 'dr.propose')),
    ),
  );
  paintIcons(head);
}

/* ═══════════════════════ STATİSTİKA ═══════════════════════
 *
 * ⚠ SAYLAR LOKAL DATADAN HESABLANIR: çalışmalar onsuz da tam siyahı kimi
 *   gəlir (`watchTasks`), ona görə ayrıca statistika endpoint-i yazmaq
 *   şəbəkəyə əlavə gediş olardı. İş sahəsində vəziyyət başqadır — orada
 *   minlərlə sətir var və say serverdə hesablanır.
 */
const CARDS = [
  { key: 'total', icon: 'tasks', tone: 'blue', lbl: 'dr.c_total' },
  { key: 'solved', icon: 'checkAll', tone: 'green', lbl: 'dr.c_solved' },
  { key: 'waiting', icon: 'clock', tone: 'amber', lbl: 'dr.c_waiting' },
  { key: 'open', icon: 'zap', tone: 'violet', lbl: 'dr.c_open' },
  { key: 'cats', icon: 'grid', tone: 'teal', lbl: 'dr.c_cats' },
];

function renderDash(){
  const box = $('drDash');
  clear(box);
  const subs = [...mySubs.values()];
  const stats = {
    total: tasks.length,
    solved: subs.filter(s => s.status === 'approved').length,
    waiting: subs.filter(s => s.status === 'pending').length,
    open: tasks.filter(x => !mySubs.has(x.id)).length,
    cats: new Set(tasks.map(x => x.category)).size,
  };
  CARDS.forEach(def => {
    const n = el('b', { class: 'dr-card__n' }, '0');
    const node = el('div', { class: 'dr-card dr-t--' + def.tone },
      el('span', { class: 'dr-card__ic' }, ico(def.icon, 16)),
      el('span', { class: 'dr-card__b' }, n, el('span', { class: 'dr-card__l' }, t(def.lbl))),
    );
    onceInView(node, () => countUp(n, stats[def.key], { duration: 500 }));
    box.append(node);
  });
  paintIcons(box);
}

/* ═══════════════════════ AXTARIŞ + FİLTR ═══════════════════════ */

function buildControls(){
  const box = $('drControls');
  clear(box);

  const search = el('input', {
    type: 'search', class: 'dr-in', id: 'drSearch',
    placeholder: t('dr.search_ph'), 'aria-label': t('dr.search_ph'), value: F.q,
  });
  search.addEventListener('input', debounce(() => { F.q = search.value.trim().toLowerCase(); renderList(); }, 220));

  const statusSel = el('select', { class: 'dr-in dr-in--sel', onchange: () => { F.status = statusSel.value; renderList(); } },
    el('option', { value: 'all' }, t('dr.f_all')),
    el('option', { value: 'open' }, t('dr.f_open')),
    el('option', { value: 'pending' }, t('dr.s_pending')),
    el('option', { value: 'approved' }, t('dr.s_approved')),
    el('option', { value: 'rejected' }, t('dr.s_rejected')),
  );
  statusSel.value = F.status;

  const cats = el('div', { class: 'dr-cats' });
  const mk = (val, label) => el('button', {
    class: 'dr-cat' + (F.cat === val ? ' is-on' : '') + (val === 'all' ? '' : ' ' + skillCatClass(val)),
    type: 'button',
    onclick: () => { F.cat = val; buildControls(); renderList(); },
  }, val === 'all' ? null : el('i', { class: 'dr-dot' }), label);
  cats.append(mk('all', t('dr.f_all_cats')));
  allCategoryLabels().forEach(c => cats.append(mk(c, c)));

  box.append(
    el('div', { class: 'dr-searchrow' },
      el('div', { class: 'c-search dr-search' }, ico('search', 16), search),
      statusSel,
    ),
    cats,
  );
  paintIcons(box);
}

/* ═══════════════════════ TƏKLİF FORMU ═══════════════════════ */

function toggleForm(force){
  const form = $('drForm');
  const show = force === undefined ? form.hidden : force;
  form.hidden = !show;
  if(!show) return;
  buildForm();
  const ti = form.querySelector('[data-f="title"]');
  if(ti) ti.focus();
}

function buildForm(){
  const form = $('drForm');
  clear(form);
  const cat = el('select', { class: 'dr-in dr-in--sel', dataset: { f: 'cat' } });
  allCategoryLabels().forEach(c => cat.append(el('option', { value: c }, c)));
  const title = el('input', { class: 'dr-in', maxLength: 120, placeholder: t('tasks.lbl_title'), dataset: { f: 'title' } });
  const desc = el('textarea', { class: 'dr-in dr-in--ta', maxLength: 3000, placeholder: t('tasks.lbl_desc') });
  const err = el('div', { class: 'form-err' });

  const send = el('button', { class: 'c-btn c-btn--primary c-btn--sm', type: 'button', onclick: async () => {
    err.textContent = '';
    if(!title.value.trim() || !desc.value.trim()){ err.textContent = t('dr.err_fields'); return; }
    send.disabled = true;
    try{
      await createTask({ title: title.value.trim(), desc: desc.value.trim(), category: cat.value });
      toggleForm(false);
      toast(t(state.isAdmin ? 'dr.published' : 'task.proposed'));
    }catch(e){ err.textContent = t('dyn.err_generic'); }
    send.disabled = false;
  } }, t('chat.send'));

  form.append(
    el('div', { class: 'dr-form__h' },
      ico('edit', 15),
      t(state.isAdmin ? 'dr.form_admin' : 'dr.form_user'),
      el('button', {
        class: 'c-icon-btn dr-form__x', type: 'button', 'aria-label': t('ws.close'),
        onclick: () => toggleForm(false),
      }, ico('x', 15)),
    ),
    el('div', { class: 'dr-form__b' }, cat, title, desc, err, send),
  );
  paintIcons(form);
}

/* ═══════════════════════ ÇALIŞMA KARTI ═══════════════════════ */

function drillCard(x){
  const sub = mySubs.get(x.id);
  const st = sub ? SUB_STATE[sub.status] : null;
  const canSubmit = !sub || sub.status === 'rejected';

  /* ⚠ SİNİF `dr-item`, `dr-card` DEYİL: `dr-card` statistika kartıdır və
     `align-items: center` daşıyır — sütun flex-də bu, BÜTÜN məzmunu üfüqi
     mərkəzə yığırdı (başlıq, təsvir, alt sətir hamısı ortada). İki fərqli
     komponent eyni adı paylaşa bilməz. */
  return el('article', { class: 'dr-item' + (st ? ' dr-item--' + st.tone : '') },
    el('div', { class: 'dr-card__top' },
      el('span', { class: 'dr-chip ' + skillCatClass(x.category) }, el('i', { class: 'dr-dot' }), x.category),
      st ? el('span', { class: 'dr-state dr-t--' + st.tone }, ico(st.icon, 11), t(st.lbl)) : null,
      state.isAdmin ? el('button', {
        class: 'c-icon-btn dr-card__del', type: 'button', 'aria-label': t('ws.delete'), title: t('ws.delete'),
        onclick: async e => {
          e.stopPropagation();
          if(!await confirmDialog(t('dr.del_q').replace('{n}', x.title))) return;
          try{ await deleteTask(x.id); toast(t('dr.deleted')); }
          catch(err){ toast(t('dyn.err_generic'), 'err'); }
        },
      }, ico('trash', 14)) : null,
    ),
    el('h3', { class: 'dr-card__h' }, x.title),
    el('p', { class: 'dr-card__d' }, x.desc),
    el('div', { class: 'dr-card__foot' },
      el('span', { class: 'dr-meta' }, ico('clock', 11), fmtTime(x.createdAt)),
      x.createdByName ? el('span', { class: 'dr-meta' }, ico('profile', 11), x.createdByName) : null,
      el('span', { class: 'dr-card__sp' }),
      canSubmit
        ? el('button', { class: 'c-btn c-btn--primary c-btn--sm', type: 'button', onclick: () => openSubmit(x) },
          t(sub ? 'dr.resubmit' : 'dr.submit'))
        : el('span', { class: 'dr-done' }, ico('check', 12), t('dr.submitted')),
    ),
  );
}

function renderList(){
  const box = $('drList');
  clear(box);
  const list = tasks.filter(x => {
    if(F.cat !== 'all' && x.category !== F.cat) return false;
    if(F.q && !((x.title || '') + ' ' + (x.desc || '')).toLowerCase().includes(F.q)) return false;
    if(F.status === 'open') return !mySubs.has(x.id);
    if(F.status !== 'all'){
      const sub = mySubs.get(x.id);
      return sub && sub.status === F.status;
    }
    return true;
  });
  if(!list.length){
    box.append(emptyState('tasks', t(F.q || F.cat !== 'all' || F.status !== 'all' ? 'dr.no_match' : 'dr.empty')));
    return;
  }
  list.forEach(x => box.append(drillCard(x)));
  paintIcons(box);
}

/* ═══════════════════════ HƏLL GÖNDƏRMƏ ═══════════════════════ */

function openSubmit(x){
  const ta = el('textarea', { class: 'dr-in dr-in--ta', maxLength: 5000, placeholder: t('dr.sol_ph') });
  const link = el('input', { class: 'dr-in', maxLength: 300, placeholder: t('dr.link_ph') });
  const err = el('div', { class: 'form-err' });

  const send = el('button', { class: 'c-btn c-btn--primary', type: 'button', onclick: async () => {
    err.textContent = '';
    const text = ta.value.trim();
    const url = link.value.trim();
    if(!text && !url){ err.textContent = t('dr.err_empty'); return; }
    // ⚠ YALNIZ `https://` — `http://` və `javascript:` bloklanır. Link sonra
    //   admin panelində açılan `<a href>` olur.
    if(url && !/^https:\/\//.test(url)){ err.textContent = t('dr.err_link'); return; }
    send.disabled = true;
    try{
      await submitSolution(x, { text, link: url });
      closeModal();
      toast(t('dr.sent'));
    }catch(e){ err.textContent = t('dyn.err_generic'); }
    send.disabled = false;
  } }, t('chat.send'));

  showModal([
    el('div', { class: 'section-title' }, x.title),
    el('div', { class: 'dr-modal__cat' },
      el('span', { class: 'dr-chip ' + skillCatClass(x.category) }, el('i', { class: 'dr-dot' }), x.category)),
    el('p', { class: 'dr-modal__d' }, x.desc),
    ta, link, err, send,
  ], { wide: true });
}

/* ═══════════════════════ ADMİN / GÖZLƏYƏNLƏR ═══════════════════════
 *
 * ⚠ İKİ SİYAHI BİR PANELDƏ: təsdiq gözləyən ÇALIŞMALAR (təklif axını) və
 *   yoxlama gözləyən HƏLLLƏR. Əvvəl ikisi səhifənin başında iki ayrı blok
 *   idi və adi istifadəçidə boş qalıb yer tuturdu.
 */
function renderAdmin(){
  const box = $('drAdmin');
  clear(box);
  const blocks = [];

  if(pendingTasks.length){
    blocks.push(panel('dr.pending_drills', pendingTasks.length, pendingTasks.map(tk => el('div', { class: 'dr-row' },
      el('div', { class: 'dr-row__b' },
        el('b', {}, tk.title),
        el('p', {}, tk.desc),
        el('span', { class: 'dr-meta' },
          el('span', { class: 'dr-chip ' + skillCatClass(tk.category) }, el('i', { class: 'dr-dot' }), tk.category),
          ' @' + (tk.createdByName || '?') + ' · ' + fmtTime(tk.createdAt)),
      ),
      state.isAdmin && tk.status === 'pending'
        ? el('div', { class: 'dr-row__a' },
          el('button', { class: 'c-btn c-btn--sm', type: 'button', onclick: async () => {
            try{ await reviewTask(tk, true); toast(t('dr.approved')); }catch(e){ toast(t('dyn.err_generic'), 'err'); }
          } }, ico('check', 13), t('dr.approve')),
          el('button', { class: 'c-btn c-btn--ghost c-btn--sm dr-rej', type: 'button', onclick: async () => {
            try{ await reviewTask(tk, false); toast(t('dr.rejected')); }catch(e){ toast(t('dyn.err_generic'), 'err'); }
          } }, ico('x', 13), t('dr.reject')),
        )
        : el('span', { class: 'dr-state dr-t--amber' }, ico('clock', 11), t('dr.s_pending')),
    ))));
  }

  if(state.isAdmin && pendingSubs.length){
    blocks.push(panel('dr.pending_subs', pendingSubs.length, pendingSubs.map(s => el('div', { class: 'dr-row' },
      el('div', { class: 'dr-row__b' },
        el('b', {}, '@' + (s.username || '?') + ' → ' + (s.taskTitle || s.taskId)),
        s.text ? el('p', {}, s.text) : null,
        // ⚠ Link yalnız `https://` olanda göstərilir — mətn serverdən gəlir.
        s.link && /^https:\/\//.test(s.link)
          ? el('a', { class: 'dr-link', href: s.link, target: '_blank', rel: 'noopener noreferrer' },
            ico('link', 11), s.link)
          : null,
      ),
      el('div', { class: 'dr-row__a' },
        el('button', { class: 'c-btn c-btn--sm', type: 'button', onclick: async () => {
          try{ await reviewSubmission(s, 'approved'); toast(t('dr.sub_approved')); }
          catch(e){ toast(t('dyn.err_generic'), 'err'); }
        } }, ico('check', 13), t('dr.approve')),
        el('button', { class: 'c-btn c-btn--ghost c-btn--sm dr-rej', type: 'button', onclick: async () => {
          try{ await reviewSubmission(s, 'rejected'); toast(t('dr.rejected')); }
          catch(e){ toast(t('dyn.err_generic'), 'err'); }
        } }, ico('x', 13), t('dr.reject')),
      ),
    ))));
  }

  blocks.forEach(b => box.append(b));
  paintIcons(box);
}

const panel = (lblKey, n, rows) => el('section', { class: 'dr-panel' },
  el('div', { class: 'dr-panel__h' }, ico('inbox', 15), t(lblKey), el('span', { class: 'dr-panel__n' }, String(n))),
  el('div', { class: 'dr-panel__b' }, rows),
);

/* ═══════════════════════ INIT / MOUNT ═══════════════════════ */

export function initDrills(){
  // ⚠ Taksonomiya gec gələ bilər — kateqoriya çipləri və form seçicisi
  //   onunla yenilənir (profil bacarıqlarındakı eyni dərs).
  bus.addEventListener('taxonomy-updated', () => {
    if($('drControls')) buildControls();
    if($('drForm') && !$('drForm').hidden) buildForm();
  });
}

export function mountDrills(){
  buildHead();
  buildControls();
  renderDash();
  $('drForm').hidden = true;
  clear($('drList'));
  $('drList').append(el('div', { class: 'dr-sk' }), el('div', { class: 'dr-sk' }), el('div', { class: 'dr-sk' }));

  unsubTasks = watchTasks(list => { tasks = list; renderDash(); renderList(); });
  unsubMine = watchMySubmissions(list => {
    mySubs = new Map(list.map(s => [s.taskId, s]));
    renderDash(); renderList();
  });
  if(state.isAdmin){
    unsubPending = watchPendingSubmissions(list => { pendingSubs = list; renderAdmin(); });
    unsubPendingTasks = watchPendingTasks(list => { pendingTasks = list; renderAdmin(); });
  } else {
    unsubMyTasks = watchMyPendingTasks(list => { pendingTasks = list; renderAdmin(); });
  }

  return () => {
    [unsubTasks, unsubMine, unsubPending, unsubMyTasks, unsubPendingTasks]
      .forEach(fn => { if(fn) fn(); });
    unsubTasks = unsubMine = unsubPending = unsubMyTasks = unsubPendingTasks = null;
  };
}
