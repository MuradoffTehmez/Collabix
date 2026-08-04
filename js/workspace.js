// İş sahəsi (Tapşırıqlar) — başlıq, idarə paneli, axtarış, filtrlər, görünüşlər.
//
// ════════════════════════════════════════════════════════════════════════════
// 🔴 BU SƏHİFƏ ÖYRƏNMƏ ÇALIŞMALARI DEYİL
// ════════════════════════════════════════════════════════════════════════════
//
// Repoda iki ayrı "tapşırıq" var:
//   `js/drills.js`  → öyrənmə çalışması (kateqoriya, həll göndər, admin təsdiqi)
//   BU FAYL         → komanda layihə tapşırığı (Kanban, sprint, təyinat)
// Onları qarışdırmaq ən böyük risk idi; sxem izahı `migrations/0054`-dədir.
//
// ⚠ VƏZİYYƏT TƏK MƏNBƏDƏDİR (`S`). Altı görünüş eyni datanı fərqli çəkir —
//   hər görünüş öz nüsxəsini saxlasaydı, filtr dəyişəndə biri köhnə qalardı.
//   Görünüşlər YALNIZ `S.tasks` / `S.columns` oxuyur, sorğunu ÖZLƏRİ etmir.
import { api } from './api.js';
import { el, clear, debounce, emit, bus, countUp, onceInView } from './util.js';
import { t } from './i18n.js';
import { toast, emptyState, confirmDialog, openPopover, closePopover } from './ui.js';
import { paintIcons } from './icon-set.js';
import { renderView, VIEWS } from './workspace-views.js';
import { openTaskDetail, closeTaskDetail, openCreateModal, setDetailMeta } from './workspace-detail.js';

/* ═══════════════════════ VƏZİYYƏT ═══════════════════════ */

const VIEW_KEY = 'collabix_ws_view';

export const S = {
  view: 'kanban',
  /** Filtr vəziyyəti — birbaşa sorğu parametrlərinə çevrilir. */
  f: {
    q: '', status: [], priority: [], team: '', project: '', sprint: '',
    assignee: '', labels: [], due: '', mine: false, unassigned: false,
    archived: '', sort: 'manual',
  },
  meta: { teams: [], projects: [], members: [], sprints: [], labels: [], savedViews: [], board: [], statuses: [], priorities: [] },
  tasks: [],
  columns: [],
  totals: {},
  sel: new Set(),
  /* Görünüş mühərriki `workspace.js`-i import ETMİR (dövr) — lazım olan
     əməliyyatlar buradan geri-çağırış kimi verilir. */
  onSelect: (id, on) => toggleSelect(id, on),
  onOpen: id => openTaskDetail(id),
  onCreate: preset => openCreate(preset),
  onMore: () => loadMore(),
  /* Cədvəl sütun başlığı sıralamanı dəyişir → SERVERƏ yeni sorğu.
     Client-də sıralasaydıq yalnız yüklənmiş səhifə sıralanardı. */
  onSort: () => { syncFilterUI(); reload(); },
  /* Təqvim ayı / Gantt zoom-u dəyişəndə YALNIZ yenidən çəkim lazımdır —
     data eynidir, ona görə şəbəkəyə getmirik. */
  onRedraw: () => renderView($('wsBody'), S, false),
  loading: false,
  hasMore: false,
  nextOffset: null,
  timer: null,
};

/** Filtr → `URLSearchParams`. Boş dəyərlər GÖNDƏRİLMİR (URL qısa qalsın). */
export function queryOf(extra = {}){
  const p = new URLSearchParams();
  const f = S.f;
  if(f.q) p.set('q', f.q);
  if(f.status.length) p.set('status', f.status.join(','));
  if(f.priority.length) p.set('priority', f.priority.join(','));
  if(f.labels.length) p.set('labels', f.labels.join(','));
  ['team', 'project', 'sprint', 'assignee', 'due', 'archived'].forEach(k => {
    if(f[k]) p.set(k, f[k]);
  });
  if(f.mine) p.set('mine', '1');
  if(f.unassigned) p.set('unassigned', '1');
  if(f.sort && f.sort !== 'manual') p.set('sort', f.sort);
  Object.entries(extra).forEach(([k, v]) => { if(v !== null && v !== undefined) p.set(k, String(v)); });
  return p;
}

/** Aktiv filtr sayı — düymədəki nişan üçün. */
function activeCount(){
  const f = S.f;
  return (f.status.length ? 1 : 0) + (f.priority.length ? 1 : 0) + (f.labels.length ? 1 : 0)
    + ['team', 'project', 'sprint', 'assignee', 'due', 'archived'].filter(k => f[k]).length
    + (f.mine ? 1 : 0) + (f.unassigned ? 1 : 0);
}

const ico = (n, s = 15) => el('span', { class: 'ic', 'data-icon': n, 'data-icon-size': String(s) });
const $ = id => document.getElementById(id);

/* ═══════════════════════ İDARƏ PANELİ ═══════════════════════
 *
 * ⚠ HƏR KARTIN ÖZ TONU VAR — spesifikasiyanın "kartlar eyni görünməsin"
 *   tələbi. Ton məna daşıyır: mavi = həcm, bənövşəyi = gediş, kəhrəba =
 *   diqqət, qırmızı = risk, yaşıl = nəticə.
 *
 * ⚠ `hero` kartlar mini qrafik daşıyır; qalanları yığcamdır. Fərq ölçüdə
 *   deyil, MƏZMUNDA — hər kart eyni ölçüdə olsaydı ierarxiya olmazdı.
 */
const CARDS = [
  { key: 'total', icon: 'tasks', tone: 'blue', lbl: 'ws.c_total', hero: true },
  { key: 'progress', icon: 'zap', tone: 'violet', lbl: 'ws.c_progress', hero: true, filter: { status: ['In Progress'] } },
  { key: 'overdue', icon: 'flame', tone: 'rose', lbl: 'ws.c_overdue', hero: true, filter: { due: 'overdue' } },
  { key: 'done', icon: 'checkAll', tone: 'green', lbl: 'ws.c_done', hero: true, filter: { status: ['Done'] } },
  { key: 'mine', icon: 'profile', tone: 'blue', lbl: 'ws.c_mine', filter: { mine: true } },
  { key: 'high', icon: 'flag', tone: 'amber', lbl: 'ws.c_high', filter: { priority: ['Critical', 'Urgent', 'High'] } },
  { key: 'review', icon: 'eye', tone: 'cyan', lbl: 'ws.c_review', filter: { status: ['Review', 'Testing'] } },
  { key: 'blocked', icon: 'lock', tone: 'rose', lbl: 'ws.c_blocked', filter: { status: ['Blocked'] } },
  { key: 'createdToday', icon: 'calendar', tone: 'teal', lbl: 'ws.c_new' },
  { key: 'doneToday', icon: 'trophy', tone: 'green', lbl: 'ws.c_done_today' },
  { key: 'completionRate', icon: 'chart', tone: 'violet', lbl: 'ws.c_rate', pct: true },
  { key: 'spentMinutes', icon: 'clock', tone: 'amber', lbl: 'ws.c_spent', time: true },
];

function renderDash(stats, trend){
  const box = $('wsDash');
  clear(box);
  // ⚠ Qısaltmalar İ18N-DƏN: sabit 's'/'d' azərbaycancadır və EN/RU-da
  //   mənasız görünürdü ("0d Затрачено").
  const fmtTime = m => (m >= 60 ? Math.round(m / 60) + t('ws.h') : m + t('ws.m'));

  CARDS.forEach(def => {
    const valNode = el('b', { class: 'ws-card__n' }, '0');
    const node = el(def.filter ? 'button' : 'div', {
      class: 'ws-card' + (def.hero ? ' ws-card--hero' : '') + ' ws-t--' + def.tone,
      type: def.filter ? 'button' : null,
      // Kart TIKLANIR və filtri tətbiq edir — "48 gecikmiş" görüb onları
      // tapmaq üçün ayrıca filtr açmaq lazım deyil.
      onclick: def.filter ? () => applyCardFilter(def.filter) : null,
      title: def.filter ? t('ws.card_filter') : null,
    },
      el('span', { class: 'ws-card__ic' }, ico(def.icon, def.hero ? 17 : 14)),
      el('span', { class: 'ws-card__b' },
        valNode,
        el('span', { class: 'ws-card__l' }, t(def.lbl)),
      ),
      def.hero && trend ? sparkline(trend, def.key) : null,
    );
    const raw = Number(stats[def.key]) || 0;
    if(def.time) valNode.textContent = fmtTime(raw);
    else if(def.pct) onceInView(node, () => countUp(valNode, raw, { duration: 500 }));
    else onceInView(node, () => countUp(valNode, raw, { duration: 500 }));
    if(def.pct) valNode.dataset.suffix = '%';
    box.append(node);
  });
  paintIcons(box);
}

/**
 * Mini qrafik — son 7 günün tamamlanma bölgüsü.
 *
 * ⚠ YALNIZ `done` kartında məna daşıyır, lakin hər hero kartda göstərilir:
 *   forma eynidir, ona görə ayrı-ayrı seriya çəkmək əvəzinə eyni tendensiya
 *   fon kimi verilir və rəngi kartın tonundan gəlir.
 */
function sparkline(days, key){
  if(!days || !days.length) return null;
  const vals = days.map(d => d.n);
  const max = Math.max(1, ...vals);
  const wrap = el('span', { class: 'ws-spark', 'aria-hidden': 'true' });
  vals.forEach(v => {
    const bar = el('i');
    bar.style.setProperty('--h', Math.round((v / max) * 100) + '%');
    wrap.append(bar);
  });
  wrap.dataset.key = key;
  return wrap;
}

function applyCardFilter(f){
  // Kart filtri ƏVƏZ EDİR, əlavə etmir — istifadəçi "gecikmişlər"ə klikləyəndə
  // əvvəlki status seçimi qalsaydı nəticə boş görünə bilərdi.
  resetFilters(false);
  Object.assign(S.f, f);
  syncFilterUI();
  reload();
}

/* ═══════════════════════ BAŞLIQ ═══════════════════════ */

function buildHeader(){
  const head = $('wsHead');
  clear(head);
  head.append(
    el('div', { class: 'ws-head__t' },
      el('h1', { class: 'ws-title' }, t('nav.tasks')),
      el('p', { class: 'ws-sub' }, t('ws.sub')),
    ),
    el('div', { class: 'ws-head__a' },
      el('button', { class: 'c-btn c-btn--primary c-btn--sm', id: 'wsCreateBtn', onclick: () => openCreate() },
        ico('edit', 15), t('ws.create')),
      el('button', {
        class: 'c-btn c-btn--ghost c-btn--sm', type: 'button',
        onclick: e => openExtras(e.currentTarget),
      }, ico('more', 15), t('ws.more')),
    ),
  );
  paintIcons(head);
}

/** İdxal / ixrac / avtomatlaşdırma / sprint — başlığı şişirtməmək üçün menyuda. */
function openExtras(anchor){
  const item = (icon, lbl, run) => el('button', {
    class: 'ws-menu__i', type: 'button', onclick: () => { closePopover(); run(); },
  }, ico(icon, 14), t(lbl));
  openPopover(anchor, el('div', { class: 'ws-menu' },
    item('download', 'ws.export', exportCsv),
    item('refresh', 'ws.sprints', openSprints),
    item('bot', 'ws.automation', openAutomation),
    item('settings', 'ws.labels', openLabels),
  ));
}

/* ═══════════════════════ AXTARIŞ + FİLTRLƏR ═══════════════════════ */

function buildControls(){
  const box = $('wsControls');
  clear(box);

  const search = el('input', {
    type: 'search', id: 'wsSearch', placeholder: t('ws.search_ph'),
    'aria-label': t('ws.search_ph'), value: S.f.q,
  });
  search.addEventListener('input', debounce(() => { S.f.q = search.value.trim(); reload(); }, 260));

  const filterBtn = el('button', {
    class: 'c-btn c-btn--ghost c-btn--sm ws-filterbtn', type: 'button',
    'aria-expanded': 'false',
    onclick: () => toggleFilters(),
  }, ico('filter', 15), t('ws.filters'), el('span', { class: 'ws-fbadge', id: 'wsFBadge' }));

  box.append(
    el('div', { class: 'ws-searchrow' },
      el('div', { class: 'c-search ws-search' },
        ico('search', 16), search,
        el('kbd', { class: 'ws-kbd' }, 'Ctrl K'),
      ),
      filterBtn,
      viewSwitcher(),
    ),
    filterPanel(),
    el('div', { class: 'ws-chips', id: 'wsChips' }),
  );
  paintIcons(box);
  updateFilterBadge();
}

/** Görünüş keçidi — seçim `localStorage`-də yadda qalır. */
function viewSwitcher(){
  const wrap = el('div', { class: 'ws-views', role: 'tablist', 'aria-label': t('ws.views') });
  VIEWS.forEach(v => wrap.append(el('button', {
    class: 'ws-view' + (S.view === v.id ? ' is-on' : ''),
    type: 'button', role: 'tab', 'aria-selected': String(S.view === v.id),
    title: t(v.lbl), 'aria-label': t(v.lbl),
    dataset: { view: v.id },
    onclick: () => setView(v.id),
  }, ico(v.icon, 15))));
  return wrap;
}

export function setView(id){
  if(!VIEWS.some(v => v.id === id)) return;
  S.view = id;
  try{ localStorage.setItem(VIEW_KEY, id); }catch(e){ /* private rejim */ }
  document.querySelectorAll('.ws-view').forEach(b => {
    const on = b.dataset.view === id;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  });
  // Kanban sütun-sütun, digərləri düz siyahı çəkir — sorğu forması dəyişir.
  reload();
}

/* ── Filtr paneli ────────────────────────────────────────────────── */

function filterPanel(){
  const p = el('div', { class: 'ws-filters', id: 'wsFilters', hidden: true });

  const group = (lblKey, node) => el('div', { class: 'ws-fg' },
    el('label', { class: 'ws-fg__l' }, t(lblKey)), node);

  const multi = (key, items, labelOf) => {
    const box = el('div', { class: 'ws-pills' });
    items.forEach(v => box.append(el('button', {
      class: 'ws-pill' + (S.f[key].includes(v) ? ' is-on' : ''),
      type: 'button', dataset: { k: key, v },
      onclick: e => {
        const arr = S.f[key];
        const i = arr.indexOf(v);
        if(i >= 0) arr.splice(i, 1); else arr.push(v);
        e.currentTarget.classList.toggle('is-on');
        updateFilterBadge(); reload();
      },
    }, labelOf ? labelOf(v) : v)));
    return box;
  };

  const select = (key, opts, phKey) => {
    const s = el('select', { onchange: () => { S.f[key] = s.value; updateFilterBadge(); reload(); } });
    s.append(el('option', { value: '' }, t(phKey)));
    opts.forEach(o => s.append(el('option', { value: o.v }, o.l)));
    s.value = S.f[key] || '';
    s.dataset.k = key;
    return s;
  };

  p.append(
    group('ws.f_status', multi('status', S.meta.statuses, v => t('ws.st_' + slug(v)))),
    group('ws.f_priority', multi('priority', S.meta.priorities, v => t('ws.pr_' + v.toLowerCase()))),
    group('ws.f_team', select('team', S.meta.teams.map(x => ({ v: x.id, l: x.name })), 'ws.all_teams')),
    group('ws.f_project', select('project', S.meta.projects.map(x => ({ v: x.id, l: x.name })), 'ws.all_projects')),
    group('ws.f_sprint', select('sprint', S.meta.sprints.map(x => ({ v: x.id, l: x.name })), 'ws.all_sprints')),
    group('ws.f_assignee', select('assignee', S.meta.members.map(x => ({ v: x.uid, l: x.name || x.username })), 'ws.all_assignees')),
    group('ws.f_due', select('due', [
      { v: 'overdue', l: t('ws.due_overdue') }, { v: 'today', l: t('ws.due_today') },
      { v: 'week', l: t('ws.due_week') }, { v: 'none', l: t('ws.due_none') },
    ], 'ws.all_due')),
    group('ws.f_sort', select('sort', [
      { v: 'manual', l: t('ws.sort_manual') }, { v: 'created', l: t('ws.sort_created') },
      { v: 'updated', l: t('ws.sort_updated') }, { v: 'due', l: t('ws.sort_due') },
      { v: 'priority', l: t('ws.sort_priority') }, { v: 'title', l: t('ws.sort_title') },
    ], 'ws.sort_manual')),
    S.meta.labels.length ? group('ws.f_labels',
      multi('labels', S.meta.labels.map(l => l.id), id => (S.meta.labels.find(l => l.id === id) || {}).name || id)) : null,
    el('div', { class: 'ws-fg ws-fg--toggles' },
      toggle('mine', 'ws.f_mine'),
      toggle('unassigned', 'ws.f_unassigned'),
      el('label', { class: 'ws-check' },
        el('input', {
          type: 'checkbox', checked: S.f.archived === 'all',
          onchange: e => { S.f.archived = e.target.checked ? 'all' : ''; updateFilterBadge(); reload(); },
        }), t('ws.f_archived')),
    ),
    el('div', { class: 'ws-filters__foot' },
      el('button', { class: 'c-btn c-btn--ghost c-btn--sm', type: 'button', onclick: () => { resetFilters(true); } },
        t('ws.reset')),
      el('button', { class: 'c-btn c-btn--sm', type: 'button', onclick: saveCurrentView }, ico('bookmark', 14), t('ws.save_view')),
      el('button', { class: 'c-btn c-btn--primary c-btn--sm', type: 'button', onclick: () => toggleFilters(false) },
        t('ws.apply')),
    ),
  );
  return p;
}

const slug = v => String(v).toLowerCase().replace(/\s+/g, '_');

function toggle(key, lblKey){
  return el('label', { class: 'ws-check' },
    el('input', {
      type: 'checkbox', checked: !!S.f[key],
      onchange: e => { S.f[key] = e.target.checked; updateFilterBadge(); reload(); },
    }), t(lblKey));
}

function toggleFilters(force){
  const p = $('wsFilters');
  const btn = document.querySelector('.ws-filterbtn');
  const show = force === undefined ? p.hidden : force;
  p.hidden = !show;
  if(btn) btn.setAttribute('aria-expanded', String(show));
}

function updateFilterBadge(){
  const n = activeCount();
  const b = $('wsFBadge');
  if(b){ b.textContent = n ? String(n) : ''; b.hidden = !n; }
  renderChips();
}

/** Aktiv filtrlərin çipləri — nə süzüldüyü HƏMİŞƏ görünsün. */
function renderChips(){
  const box = $('wsChips');
  if(!box) return;
  clear(box);
  const chip = (label, clear_) => el('button', {
    class: 'ws-chip', type: 'button', onclick: () => { clear_(); syncFilterUI(); reload(); },
  }, label, ico('x', 11));

  S.f.status.forEach(v => box.append(chip(t('ws.st_' + slug(v)), () => {
    S.f.status = S.f.status.filter(x => x !== v);
  })));
  S.f.priority.forEach(v => box.append(chip(t('ws.pr_' + v.toLowerCase()), () => {
    S.f.priority = S.f.priority.filter(x => x !== v);
  })));
  S.f.labels.forEach(id => {
    const l = S.meta.labels.find(x => x.id === id);
    box.append(chip(l ? l.name : id, () => { S.f.labels = S.f.labels.filter(x => x !== id); }));
  });
  /* ⚠ Obyekt massivi, kortej YOX: `[key, list, idk]` formasında TS elementləri
     birləşmə tipi kimi görür (`string | any[]`) və `list.find` xəta verir. */
  const named = [
    { key: 'team', list: S.meta.teams, idk: 'id' },
    { key: 'project', list: S.meta.projects, idk: 'id' },
    { key: 'sprint', list: S.meta.sprints, idk: 'id' },
    { key: 'assignee', list: S.meta.members, idk: 'uid' },
  ];
  named.forEach(n => {
    const val = S.f[n.key];
    if(!val) return;
    const found = n.list.find(x => x[n.idk] === val);
    box.append(chip(found ? (found.name || found.username) : val, () => { S.f[n.key] = ''; }));
  });
  if(S.f.due) box.append(chip(t('ws.due_' + S.f.due), () => { S.f.due = ''; }));
  if(S.f.mine) box.append(chip(t('ws.f_mine'), () => { S.f.mine = false; }));
  if(S.f.unassigned) box.append(chip(t('ws.f_unassigned'), () => { S.f.unassigned = false; }));
  if(S.f.archived) box.append(chip(t('ws.f_archived'), () => { S.f.archived = ''; }));

  // Saxlanılmış görünüşlər — çiplərin sonunda.
  S.meta.savedViews.forEach(v => box.append(el('button', {
    class: 'ws-chip ws-chip--saved', type: 'button', title: t('ws.saved_apply'),
    onclick: () => applySavedView(v),
  }, ico('bookmark', 11), v.name)));
  paintIcons(box);
}

function resetFilters(doReload = true){
  S.f = {
    q: S.f.q, status: [], priority: [], team: '', project: '', sprint: '',
    assignee: '', labels: [], due: '', mine: false, unassigned: false,
    archived: '', sort: 'manual',
  };
  syncFilterUI();
  if(doReload) reload();
}

/** Filtr panelinin idarəedicilərini `S.f`-ə uyğunlaşdırır. */
function syncFilterUI(){
  document.querySelectorAll('#wsFilters .ws-pill').forEach(b => {
    const arr = S.f[b.dataset.k] || [];
    b.classList.toggle('is-on', arr.includes(b.dataset.v));
  });
  document.querySelectorAll('#wsFilters select').forEach(s => {
    if(s.dataset.k) s.value = S.f[s.dataset.k] || '';
  });
  document.querySelectorAll('#wsFilters .ws-check input').forEach((cb, i) => {
    cb.checked = [!!S.f.mine, !!S.f.unassigned, S.f.archived === 'all'][i] || false;
  });
  updateFilterBadge();
}

/* ── Saxlanılmış görünüşlər ──────────────────────────────────────── */

async function saveCurrentView(){
  const name = prompt(t('ws.save_view_q'));   // eslint-disable-line no-alert
  if(!name || !name.trim()) return;
  try{
    const v = await api('/ws/views', { method: 'POST', body: { name: name.trim(), query: queryOf().toString() } });
    S.meta.savedViews.unshift(v);
    renderChips();
    toast(t('ws.saved_ok'));
  }catch(e){ toast(t('dyn.err_generic'), 'err'); }
}

function applySavedView(v){
  const p = new URLSearchParams(v.query || '');
  resetFilters(false);
  S.f.q = p.get('q') || '';
  S.f.status = (p.get('status') || '').split(',').filter(Boolean);
  S.f.priority = (p.get('priority') || '').split(',').filter(Boolean);
  S.f.labels = (p.get('labels') || '').split(',').filter(Boolean);
  ['team', 'project', 'sprint', 'assignee', 'due', 'archived', 'sort'].forEach(k => {
    S.f[k] = p.get(k) || (k === 'sort' ? 'manual' : '');
  });
  S.f.mine = p.get('mine') === '1';
  S.f.unassigned = p.get('unassigned') === '1';
  const search = $('wsSearch');
  if(search) search.value = S.f.q;
  syncFilterUI();
  reload();
}

/* ═══════════════════════ TOPLU ƏMƏLİYYAT ═══════════════════════ */

export function toggleSelect(id, on){
  if(on) S.sel.add(id); else S.sel.delete(id);
  renderBulkBar();
}
export function clearSelection(){
  S.sel.clear();
  document.querySelectorAll('.ws-card-t.is-sel').forEach(n => n.classList.remove('is-sel'));
  document.querySelectorAll('.ws-selbox').forEach(n => { n.checked = false; });
  renderBulkBar();
}

function renderBulkBar(){
  const bar = $('wsBulk');
  if(!bar) return;
  const n = S.sel.size;
  // ⚠ `hidden` atributu `display` qaydasına uduzur — CSS-də açıq
  //   `.ws-bulk[hidden]{display:none}` var (layihə qeydi).
  bar.hidden = !n;
  if(!n) return;
  clear(bar);
  const act = (icon, lbl, run) => el('button', { class: 'c-btn c-btn--ghost c-btn--sm', type: 'button', onclick: run },
    ico(icon, 14), t(lbl));
  bar.append(
    el('span', { class: 'ws-bulk__n' }, t('ws.selected').replace('{n}', String(n))),
    act('checkAll', 'ws.bulk_done', () => bulk('status', 'Done')),
    act('zap', 'ws.bulk_progress', () => bulk('status', 'In Progress')),
    act('flag', 'ws.bulk_high', () => bulk('priority', 'High')),
    act('archive', 'ws.bulk_archive', () => bulk('archive', true)),
    act('trash', 'ws.bulk_delete', async () => {
      if(!await confirmDialog(t('ws.bulk_delete_q').replace('{n}', String(n)))) return;
      bulk('delete', null);
    }),
    el('button', { class: 'c-icon-btn', type: 'button', 'aria-label': t('ws.clear_sel'), onclick: clearSelection },
      ico('x', 15)),
  );
  paintIcons(bar);
}

async function bulk(op, value){
  const ids = [...S.sel];
  try{
    const r = await api('/ws/bulk', { method: 'POST', body: { ids, op, value } });
    toast(t('ws.bulk_ok').replace('{n}', String(r.affected)));
    clearSelection();
    reload();
  }catch(e){ toast(t('dyn.err_generic'), 'err'); }
}

/* ═══════════════════════ YÜKLƏMƏ ═══════════════════════ */

let reqSeq = 0;

/**
 * Datanı çəkir və aktiv görünüşü yenidən çəkir.
 *
 * 🔴 SIRA MÜHAFİZƏSİ (`reqSeq`): istifadəçi sürətlə yazanda köhnə cavab
 *    yenisindən SONRA gələ bilər və ekran köhnə nəticəni göstərərdi.
 *    Yalnız ƏN SON sorğunun cavabı tətbiq olunur.
 */
export async function reload(){
  const seq = ++reqSeq;
  S.loading = true;
  const host = $('wsBody');
  if(!S.tasks.length && !S.columns.length) renderView(host, S, true);

  const isBoard = S.view === 'kanban';
  /* ⚠ TARİX ƏSASLI GÖRÜNÜŞLƏR DAHA ÇOX SƏTİR İSTƏYİR: təqvim bir ayı,
     Gantt isə bütün aralığı göstərir. 60 sətirlik səhifə ilə ayın yarısı
     boş görünərdi və istifadəçi bunu «tapşırıq yoxdur» kimi oxuyardı. */
  const wide = ['calendar', 'timeline', 'gantt'].includes(S.view);
  const q = queryOf(isBoard ? { group: 'status' } : { limit: wide ? 200 : 60, offset: 0 });
  try{
    const d = await api('/ws/tasks?' + q.toString());
    if(seq !== reqSeq) return;              // köhnəlmiş cavab — atılır
    if(isBoard){
      S.columns = d.columns || [];
      S.totals = d.totals || {};
      S.tasks = S.columns.flatMap(c => c.tasks);
    } else {
      S.tasks = d.tasks || [];
      S.columns = [];
      S.hasMore = !!d.hasMore;
      S.nextOffset = d.nextOffset;
    }
    S.loading = false;
    renderView(host, S, false);
  }catch(e){
    if(seq !== reqSeq) return;
    S.loading = false;
    clear(host);
    host.append(emptyState('info', t('users.err')));
  }
  refreshStats();
}

/** Növbəti səhifə — siyahı/cədvəl görünüşlərində sonsuz sürüşmə. */
export async function loadMore(){
  if(!S.hasMore || S.loading || S.nextOffset === null) return;
  S.loading = true;
  try{
    const d = await api('/ws/tasks?' + queryOf({ limit: 60, offset: S.nextOffset }).toString());
    S.tasks = S.tasks.concat(d.tasks || []);
    S.hasMore = !!d.hasMore;
    S.nextOffset = d.nextOffset;
    renderView($('wsBody'), S, false);
  }catch(e){ S.hasMore = false; }
  S.loading = false;
}

async function refreshStats(){
  try{
    const [stats, trend] = await Promise.all([api('/ws/stats'), api('/ws/trend')]);
    renderDash(stats, trend.days);
  }catch(e){ /* panel bəzəkdir */ }
}

/* ═══════════════════════ YARATMA ═══════════════════════ */

export function openCreate(preset = {}){ openCreateModal(preset); }

/* ═══════════════════════ ƏLAVƏ PANELLƏR ═══════════════════════ */

function exportCsv(){
  // ⚠ Server ixracı YOXDUR — cari görünüşün datası onsuz da yaddadadır.
  //   Ayrıca endpoint yazsaydıq, filtr məntiqi ikinci dəfə təkrarlanardı.
  const rows = [['key', 'title', 'status', 'priority', 'project', 'assignee', 'due']];
  S.tasks.forEach(x => rows.push([
    x.key, x.title, x.status, x.priority, x.projectName,
    x.assigneeName || '', x.deadline ? new Date(x.deadline).toISOString().slice(0, 10) : '',
  ]));
  const csv = rows.map(r => r.map(v => {
    const s = String(v ?? '');
    // Excel formul injeksiyası — admin ixracı ilə eyni müdafiə.
    const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = el('a', { href: url, download: 'collabix-tasks.csv' });
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function openSprints(){ import('./workspace-detail.js').then(m => m.openSprintPanel()); }
function openAutomation(){ import('./workspace-detail.js').then(m => m.openAutomationPanel()); }
function openLabels(){ import('./workspace-detail.js').then(m => m.openLabelPanel()); }

/* ═══════════════════════ KLAVİATURA ═══════════════════════ */

function onKey(e){
  if(!$('page-tasks').classList.contains('active')) return;
  // Ctrl/Cmd + K → axtarış.
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    const s = $('wsSearch');
    if(s){ s.focus(); s.select(); }
    return;
  }
  const tag = (e.target.tagName || '').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
  /* ⚠ Modal və ya detal paneli açıqkən hərf/rəqəm qısayolları İŞLƏMİR:
     əks halda «3» basmaq modalın ARXASINDA görünüşü dəyişirdi və istifadəçi
     modalı bağlayanda tamam başqa ekran görürdü. */
  const overlay = document.getElementById('modalBg');
  if((overlay && overlay.classList.contains('active')) || document.querySelector('.ws-panel')){
    if(e.key === 'Escape'){ clearSelection(); closeTaskDetail(); }
    return;
  }
  // `c` → yeni tapşırıq, `1…6` → görünüş, Esc → seçimi təmizlə.
  if(e.key === 'c'){ e.preventDefault(); openCreate(); }
  else if(e.key === 'Escape'){ clearSelection(); closeTaskDetail(); }
  else if(/^[1-6]$/.test(e.key)){
    const v = VIEWS[Number(e.key) - 1];
    if(v) setView(v.id);
  }
}

/* ═══════════════════════ MOUNT ═══════════════════════ */

export function initWorkspace(){ /* marşrut cədvəli `mountWorkspace` çağırır */ }

export function mountWorkspace(){
  try{
    const saved = localStorage.getItem(VIEW_KEY);
    if(saved && VIEWS.some(v => v.id === saved)) S.view = saved;
  }catch(e){ /* private rejim */ }

  buildHeader();
  const body = $('wsBody');
  clear(body);
  renderView(body, S, true);   // skelet

  // Meta ƏVVƏLCƏ gəlir: filtr paneli onsuz qurula bilməz (komanda/layihə
  // siyahıları oradan gəlir). Tapşırıqlar isə paralel çəkilir.
  api('/ws/meta')
    .then(m => {
      S.meta = { ...S.meta, ...m };
      // Detal paneli meta-nı ÖZÜ çəkmir — eyni cavabı ikinci dəfə almaq
      // mənasız olardı. Panel `workspace.js`-i import etmir (dövr), ona görə
      // meta ona AÇIQ ötürülür.
      setDetailMeta(m);
      buildControls();
      reload();
    })
    .catch(() => {
      buildControls();
      clear(body);
      body.append(emptyState('info', t('users.err')));
    });

  api('/ws/timer').then(r => { S.timer = r.running ? r : null; renderTimerBar(); }).catch(() => {});
  document.addEventListener('keydown', onKey);
  bus.addEventListener('ws-changed', reload);

  return () => {
    if(timerTick){ clearInterval(timerTick); timerTick = null; }
    document.removeEventListener('keydown', onKey);
    bus.removeEventListener('ws-changed', reload);
    closePopover();
    closeTaskDetail();
    S.sel.clear();
  };
}

/* Taymer sayğacının yenilənmə intervalı — dəqiqə dəyişəndə görünsün deyə. */
let timerTick = null;

/** İşləyən taymer zolağı — səhifə açılışında bərpa olunur. */
export function renderTimerBar(){
  const bar = $('wsTimer');
  if(!bar) return;
  bar.hidden = !S.timer;
  // ⚠ İnterval HƏR çəkimdə təmizlənir: əks halda hər yenilənmə bir dənə də
  //   əlavə edərdi və zolaq saniyədə bir neçə dəfə yenilənərdi (sızma).
  if(timerTick){ clearInterval(timerTick); timerTick = null; }
  if(!S.timer) return;
  clear(bar);
  const mins = () => Math.max(0, Math.round((Date.now() - S.timer.startedAt) / 60000));
  bar.append(
    ico('clock', 14),
    el('span', { class: 'ws-timer__t' }, S.timer.key + ' · ' + S.timer.title),
    el('b', { class: 'ws-timer__m' }, mins() + ' ' + t('ws.min')),
    el('button', {
      class: 'c-btn c-btn--sm', type: 'button',
      onclick: async () => {
        try{
          await api('/ws/tasks/' + S.timer.taskId + '/timer/stop', { method: 'POST' });
          S.timer = null; renderTimerBar(); emit('ws-changed');
        }catch(e){ toast(t('dyn.err_generic'), 'err'); }
      },
    }, t('ws.stop')),
  );
  paintIcons(bar);
  /* 🔴 SAYĞAC İRƏLİLƏMİRDİ: dəyər YALNIZ çəkim anında hesablanırdı, yəni
     taymer 40 dəqiqə işləsə də zolaqda «0 dəq» qalırdı. */
  const numNode = bar.querySelector('.ws-timer__m');
  timerTick = setInterval(() => {
    if(!S.timer || !numNode.isConnected){ clearInterval(timerTick); timerTick = null; return; }
    numNode.textContent = mins() + ' ' + t('ws.min');
  }, 20000);
}
