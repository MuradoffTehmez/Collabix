// İş sahəsinin görünüş mühərrikləri — Kanban, Siyahı, Cədvəl, Təqvim,
// Timeline, Gantt.
//
// 🔴 GÖRÜNÜŞLƏR SORĞU ETMİR. Hamısı `S.tasks` / `S.columns` oxuyur və yalnız
//    ÇƏKİR. Səbəb: altı görünüş öz sorğusunu etsəydi, filtr məntiqi altı yerdə
//    təkrarlanardı və biri unudulanda həmin görünüş BAŞQA nəticə göstərərdi.
//    Data qatı `workspace.js` → `reload()`-dadır.
//
// ⚠ KART ŞABLONU TƏKDİR (`taskCard`): Kanban, siyahı və təqvim eyni kartı
//   işlədir, yalnız `variant` fərqlənir. Üç ayrı şablon saxlasaydıq, yeni
//   sahə (məsələn təxmini vaxt) əlavə edəndə ikisi unudulardı.
import { el, clear, avatarNode, emit } from './util.js';
import { t, fmtMonthYear } from './i18n.js';
import { toast, emptyState } from './ui.js';
import { paintIcons } from './icon-set.js';
import { api } from './api.js';

/** Görünüş kataloqu — keçid düymələri və klaviatura qısayolları buradan. */
export const VIEWS = [
  { id: 'kanban', icon: 'squareCheck', lbl: 'ws.v_kanban' },
  { id: 'list', icon: 'rows', lbl: 'ws.v_list' },
  { id: 'table', icon: 'grid', lbl: 'ws.v_table' },
  { id: 'calendar', icon: 'calendar', lbl: 'ws.v_calendar' },
  { id: 'timeline', icon: 'chart', lbl: 'ws.v_timeline' },
  { id: 'gantt', icon: 'menu', lbl: 'ws.v_gantt' },
];

/**
 * Prioritet → ton + ikon.
 *
 * ⚠ RƏNG TƏK SİQNAL DEYİL: hər prioritetin öz İKONU var (WCAG
 *   `color-not-only`). Yalnız rəngə güvənsəydik, rəng görmə fərqi olan
 *   istifadəçi «Kritik» ilə «Aşağı»nı ayırd edə bilməzdi.
 */
export const PRIO = {
  Critical: { tone: 'crit', icon: 'flame' },
  Urgent: { tone: 'urgent', icon: 'zap' },
  High: { tone: 'high', icon: 'flag' },
  Medium: { tone: 'med', icon: 'chevron' },
  Low: { tone: 'low', icon: 'chevron' },
};

/** Status → ton. Kanban sütun başlığı və kart nişanı eyni tondan qidalanır. */
export const ST_TONE = {
  'Backlog': 'slate', 'To Do': 'blue', 'Planning': 'cyan', 'In Progress': 'violet',
  'Review': 'amber', 'Testing': 'teal', 'Done': 'green', 'Blocked': 'rose',
  'Cancelled': 'slate',
};

const ico = (n, s = 13) => el('span', { class: 'ic', 'data-icon': n, 'data-icon-size': String(s) });
const slug = v => String(v).toLowerCase().replace(/\s+/g, '_');
const DAY = 86400000;

/** Son tarix vəziyyəti: gecikib / bu gün / yaxın / uzaq. */
export function dueState(ts, status){
  if(!ts) return '';
  if(status === 'Done') return 'done';
  const d = ts - Date.now();
  if(d < 0) return 'over';
  if(d < DAY) return 'today';
  if(d < 3 * DAY) return 'soon';
  return '';
}

const fmtDue = ts => {
  if(!ts) return '';
  const d = new Date(ts);
  return d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0');
};
const fmtMin = m => (m >= 60 ? Math.round(m / 60 * 10) / 10 + t('ws.h') : m + t('ws.m'));

/* ═══════════════════════ TAPŞIRIQ KARTI ═══════════════════════ */

/**
 * @param {object} x tapşırıq
 * @param {'board'|'list'|'mini'} variant
 * @param {object} ctx `{ labels: Map, onSelect(id, on), onOpen(id) }`
 *
 * 🔴 KONTEKST PARAMETRDİR, KART İÇİNDƏ `import()` DEYİL. Əvvəlki variantda
 *    hər kart etiket rəngi üçün `import('./workspace.js')` çağırırdı — 150
 *    kartlıq lövhədə bu, 150 promise və 150 mikro-tapşırıq deməkdir.
 */
export function taskCard(x, variant = 'board', ctx = {}){
  const p = PRIO[x.priority] || PRIO.Medium;
  const ds = dueState(x.deadline, x.status);
  const pct = x.checkTotal ? Math.round((x.checkDone / x.checkTotal) * 100) : 0;

  const sel = el('input', {
    type: 'checkbox', class: 'ws-selbox', 'aria-label': t('ws.select'),
    onclick: e => {
      e.stopPropagation();
      if(ctx.onSelect) ctx.onSelect(x.id, e.target.checked);
      card.classList.toggle('is-sel', e.target.checked);
    },
  });

  const card = el('article', {
    class: 'ws-card-t ws-card-t--' + variant + ' ws-p--' + p.tone,
    tabindex: '0', dataset: { id: x.id, status: x.status, pos: String(x.position) },
    draggable: variant === 'board' ? 'true' : null,
    'aria-label': x.key + ' ' + x.title,
    onclick: () => ctx.onOpen && ctx.onOpen(x.id),
    onkeydown: e => {
      if((e.key === 'Enter' || e.key === ' ') && ctx.onOpen){
        e.preventDefault();
        ctx.onOpen(x.id);
      }
    },
  },
    el('div', { class: 'ws-card-t__top' },
      sel,
      el('span', { class: 'ws-key' }, x.key || '—'),
      el('span', { class: 'ws-prio ws-p--' + p.tone, title: t('ws.pr_' + x.priority.toLowerCase()) },
        ico(p.icon, 11), variant === 'list' ? t('ws.pr_' + x.priority.toLowerCase()) : null),
      variant === 'list' ? el('span', { class: 'ws-stat ws-s--' + (ST_TONE[x.status] || 'slate') },
        t('ws.st_' + slug(x.status))) : null,
    ),
    el('h3', { class: 'ws-card-t__h' }, x.title),
    /* Etiketlər — yalnız varsa. Boş sətir kartı hündürləndirərdi. */
    x.labels.length ? el('div', { class: 'ws-labels' }, x.labels.slice(0, 4).map(id => {
      const lab = ctx.labels && ctx.labels.get(id);
      return el('span', { class: 'ws-label ws-l--' + (lab ? lab.color : 'slate') }, lab ? lab.name : '•');
    })) : null,
    /* Yoxlama siyahısı irəliləyişi — zolaq YALNIZ bənd varsa. */
    x.checkTotal ? el('div', { class: 'ws-prog', title: x.checkDone + '/' + x.checkTotal },
      el('i', {}), el('span', {}, x.checkDone + '/' + x.checkTotal)) : null,
    el('div', { class: 'ws-card-t__foot' },
      x.projectName ? el('span', { class: 'ws-meta__i', title: x.teamName },
        ico('folder', 11), x.projectName) : null,
      x.deadline ? el('span', { class: 'ws-due ws-due--' + ds, title: new Date(x.deadline).toLocaleDateString() },
        ico('calendar', 11), fmtDue(x.deadline)) : null,
      x.estimatedMinutes ? el('span', { class: 'ws-meta__i' }, ico('clock', 11), fmtMin(x.estimatedMinutes)) : null,
      x.commentCount ? el('span', { class: 'ws-meta__i' }, ico('message', 11), String(x.commentCount)) : null,
      x.attachCount ? el('span', { class: 'ws-meta__i' }, ico('paperclip', 11), String(x.attachCount)) : null,
      x.subtaskCount ? el('span', { class: 'ws-meta__i' }, ico('checkAll', 11), String(x.subtaskCount)) : null,
      el('span', { class: 'ws-card-t__sp' }),
      x.assigneeId
        ? avatarNode({ name: x.assigneeName, photoURL: x.assigneePhoto, username: x.assigneeUsername }, 'avatar ws-av')
        : el('span', { class: 'ws-av ws-av--none', title: t('ws.unassigned') }, ico('profile', 11)),
    ),
  );

  // Yoxlama zolağının doluluğu — CSSOM (CSP inline `style=` atributunu bloklayır).
  const bar = card.querySelector('.ws-prog i');
  if(bar) bar.style.setProperty('--p', pct + '%');
  return card;
}

/* ═══════════════════════ ÇƏKİM GİRİŞİ ═══════════════════════ */

/**
 * @param {HTMLElement} host
 * @param {object} S vəziyyət — `workspace.js`-dən AÇIQ ötürülür
 * @param {boolean} skeleton
 *
 * ⚠ `S` PARAMETRDİR, import DEYİL: `workspace.js` bu modulu import edir,
 *   tərs istiqamət dövr yaradardı. Qlobal dəyişən (`window.__ws`) də
 *   işlərdi, amma o, gizli asılılıqdır — parametr müqaviləni açıq saxlayır.
 */
export function renderView(host, S, skeleton){
  if(skeleton || !S) return renderSkeleton(host, S ? S.view : 'kanban');
  clear(host);
  host.className = 'ws-body ws-body--' + S.view;

  // Etiketlər bir dəfə indekslənir — hər kartda `find()` O(n²) olardı.
  const ctx = {
    labels: new Map((S.meta.labels || []).map(l => [l.id, l])),
    onSelect: S.onSelect, onOpen: S.onOpen,
  };
  const map = {
    kanban: renderKanban, list: renderList, table: renderTable,
    calendar: renderCalendar, timeline: renderTimeline, gantt: renderGantt,
  };
  (map[S.view] || renderList)(host, S, ctx);
  paintIcons(host);
}

function renderSkeleton(host, view){
  clear(host);
  host.className = 'ws-body ws-body--' + view;
  if(view === 'kanban'){
    for(let i = 0; i < 5; i++){
      host.append(el('div', { class: 'ws-col' },
        el('div', { class: 'ws-sk ws-sk--head' }),
        ...Array.from({ length: 3 }, () => el('div', { class: 'ws-sk ws-sk--card' })),
      ));
    }
  } else {
    host.append(el('div', { class: 'ws-sklist' },
      ...Array.from({ length: 8 }, () => el('div', { class: 'ws-sk ws-sk--row' }))));
  }
}

/* ═══════════════════════ KANBAN ═══════════════════════ */

/**
 * ⚠ SÜRÜŞDÜRMƏ NATIVE HTML5 DRAG&DROP İLƏDİR, kitabxanasız.
 *   Səbəb: layihədə kənar asılılıq minimaldır və `dragover` + `drop`
 *   kifayət edir. Toxunuş cihazlarında native DnD işləmir — orada kartın
 *   menyusundan "Statusu dəyiş" işlədilir (mobil axın onsuz da başqadır).
 */
let dragId = null;

function renderKanban(host, S, ctx){
  if(!S.columns.length){
    host.append(emptyState('tasks', t('ws.empty')));
    return;
  }
  S.columns.forEach(col => {
    const tone = ST_TONE[col.status] || 'slate';
    const body = el('div', { class: 'ws-col__b' });

    col.tasks.forEach(x => body.append(taskCard(x, 'board', ctx)));
    if(!col.tasks.length) body.append(el('div', { class: 'ws-col__empty' }, t('ws.col_empty')));
    if(col.hasMore) body.append(el('button', {
      class: 'ws-col__more', type: 'button',
      onclick: () => toast(t('ws.col_more_hint')),
    }, t('ws.col_more')));

    const column = el('section', {
      class: 'ws-col ws-s--' + tone, dataset: { status: col.status },
      // ── Buraxma zonası ──
      ondragover: e => { e.preventDefault(); column.classList.add('is-over'); },
      ondragleave: () => column.classList.remove('is-over'),
      ondrop: e => { e.preventDefault(); column.classList.remove('is-over'); onDrop(col.status, e); },
    },
      el('header', { class: 'ws-col__h' },
        el('span', { class: 'ws-col__dot' }),
        el('h2', {}, t('ws.st_' + slug(col.status))),
        el('span', { class: 'ws-col__n' }, String(S.totals[col.status] || col.tasks.length)),
        el('button', {
          class: 'c-icon-btn ws-col__add', type: 'button',
          'aria-label': t('ws.create'), title: t('ws.create'),
          onclick: () => S.onCreate && S.onCreate({ status: col.status }),
        }, ico('edit', 14)),
      ),
      body,
    );
    host.append(column);
  });

  // Sürüşdürmə hadisələri — kartlar hər çəkimdə yenidən yaranır, ona görə
  // dinləyici KONTEYNERƏ bağlanır (delegasiya).
  host.addEventListener('dragstart', e => {
    const card = e.target.closest('.ws-card-t');
    if(!card) return;
    dragId = card.dataset.id;
    card.classList.add('is-drag');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox `setData` olmadan sürüşdürməni başlatmır.
    try{ e.dataTransfer.setData('text/plain', dragId); }catch(err){ /* köhnə brauzer */ }
  });
  host.addEventListener('dragend', e => {
    const card = e.target.closest('.ws-card-t');
    if(card) card.classList.remove('is-drag');
    dragId = null;
  });
}

/**
 * Buraxma — status + sıra serverə göndərilir.
 *
 * ⚠ OPTİMİST: kart DƏRHAL yeni sütuna keçir, sorğu arxada gedir. Uğursuz
 *   olsa tam yenidən yükləmə vəziyyəti bərpa edir — "geri qaytar"
 *   animasiyası yazmaqdansa həqiqət mənbəyindən oxumaq sadə və doğrudur.
 */
async function onDrop(status, e){
  const id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
  if(!id) return;
  const col = e.currentTarget.querySelector('.ws-col__b');
  const cards = [...col.querySelectorAll('.ws-card-t')];
  // Buraxılan nöqtəyə görə qonşuları tap.
  const y = e.clientY;
  let prev = null, next = null;
  for(const c of cards){
    if(c.dataset.id === id) continue;
    const r = c.getBoundingClientRect();
    if(r.top + r.height / 2 < y) prev = c; else { next = c; break; }
  }
  const card = document.querySelector(`.ws-card-t[data-id="${id}"]`);
  if(card){
    if(next) col.insertBefore(card, next); else col.append(card);
    card.dataset.status = status;
  }
  try{
    const r = await api('/ws/tasks/' + id + '/move', {
      method: 'POST',
      body: {
        status,
        prevPos: prev ? Number(prev.dataset.pos) : null,
        nextPos: next ? Number(next.dataset.pos) : null,
      },
    });
    if(card) card.dataset.pos = String(r.position);
    emit('ws-changed');
  }catch(err){
    toast(t('dyn.err_generic'), 'err');
    emit('ws-changed');       // həqiqət mənbəyindən bərpa
  }
}

/* ═══════════════════════ SİYAHI ═══════════════════════ */

/**
 * ⚠ QRUPLAŞDIRMA STATUS ÜZRƏDİR: düz siyahı 300 sətirdə oxunmaz olur.
 *   Başlıqlar yapışqandır — sürüşərkən hansı blokda olduğun görünür.
 */
function renderList(host, S, ctx){
  if(!S.tasks.length){ host.append(emptyState('tasks', t('ws.empty'))); return; }
  const groups = new Map();
  S.tasks.forEach(x => {
    if(!groups.has(x.status)) groups.set(x.status, []);
    groups.get(x.status).push(x);
  });
  const order = S.meta.statuses.filter(s => groups.has(s));
  order.forEach(st => {
    const list = groups.get(st);
    host.append(el('div', { class: 'ws-group' },
      el('div', { class: 'ws-group__h ws-s--' + (ST_TONE[st] || 'slate') },
        el('span', { class: 'ws-col__dot' }),
        t('ws.st_' + slug(st)),
        el('b', {}, String(list.length)),
      ),
      el('div', { class: 'ws-group__b' }, list.map(x => taskCard(x, 'list', ctx))),
    ));
  });
  appendSentinel(host, S);
}

/** Sonsuz sürüşmə nöqtəsi — siyahı/cədvəl görünüşlərində. */
function appendSentinel(host, S){
  if(!S.hasMore) return;
  const sent = el('div', { class: 'ws-sentinel' });
  host.append(sent);
  if(typeof IntersectionObserver === 'undefined') return;
  const io = new IntersectionObserver(es => {
    if(es.some(x => x.isIntersecting)){
      io.disconnect();
      if(S.onMore) S.onMore();
    }
  }, { rootMargin: '400px 0px' });
  io.observe(sent);
}

/* ═══════════════════════ CƏDVƏL ═══════════════════════
 *
 * ⚠ SIRALAMA SERVERDƏDİR: sütun başlığına klik `S.f.sort`-u dəyişib yenidən
 *   sorğu göndərir. Client-də sıralasaydıq, YALNIZ yüklənmiş sətirlər
 *   sıralanardı və istifadəçi «ən yüksək prioritet» deyəndə əslində
 *   «yüklənmişlərin ən yüksəyi»ni görərdi — səssiz yalan.
 */
const COLS = [
  { lbl: 'ws.key', w: '78px', sort: null, cell: x => el('span', { class: 'ws-key' }, x.key || '—') },
  { lbl: 'ws.title', sort: 'title', cell: x => el('span', { class: 'ws-tb__t' }, x.title) },
  { lbl: 'ws.f_status', w: '112px', sort: null,
    cell: x => el('span', { class: 'ws-stat ws-s--' + (ST_TONE[x.status] || 'slate') }, t('ws.st_' + slug(x.status))) },
  { lbl: 'ws.f_priority', w: '104px', sort: 'priority', cell: x => {
    const p = PRIO[x.priority] || PRIO.Medium;
    return el('span', { class: 'ws-prio ws-p--' + p.tone }, ico(p.icon, 11), t('ws.pr_' + x.priority.toLowerCase()));
  } },
  { lbl: 'ws.f_assignee', w: '160px', sort: null, cell: x => (x.assigneeId
    ? el('span', { class: 'ws-tb__u' },
      avatarNode({ name: x.assigneeName, photoURL: x.assigneePhoto, username: x.assigneeUsername }, 'avatar ws-av'),
      x.assigneeName || x.assigneeUsername)
    : el('span', { class: 'ws-tb__muted' }, t('ws.unassigned'))) },
  { lbl: 'ws.f_project', w: '150px', sort: null,
    cell: x => el('span', { class: 'ws-tb__muted' }, x.projectName) },
  { lbl: 'ws.f_due', w: '112px', sort: 'due', cell: x => (x.deadline
    ? el('span', { class: 'ws-due ws-due--' + dueState(x.deadline, x.status) },
      ico('calendar', 11), new Date(x.deadline).toLocaleDateString())
    : el('span', { class: 'ws-tb__muted' }, '—')) },
  { lbl: 'ws.estimate', w: '92px', sort: null, cell: x => el('span', { class: 'ws-tb__muted' },
    x.estimatedMinutes ? fmtMin(x.estimatedMinutes) : '—') },
];

function renderTable(host, S, ctx){
  if(!S.tasks.length){ host.append(emptyState('tasks', t('ws.empty'))); return; }
  const head = el('tr', {}, COLS.map(c => {
    const on = c.sort && S.f.sort === c.sort;
    const th = el('th', {
      class: (c.sort ? 'is-sortable ' : '') + (on ? 'is-on' : ''),
      onclick: c.sort ? () => { S.f.sort = c.sort; if(S.onSort) S.onSort(); } : null,
      /* ⚠ İkon YALNIZ aktiv sıralamada: sıralanmayan sütunlarda göstərsək,
         başlıq sətri mənasız nişanlarla dolardı və hansının aktiv olduğu
         itərdi. Sıralana bilən sütun `cursor: pointer` + hover ilə bilinir. */
    }, t(c.lbl), on ? ico('chevron', 10) : null);
    // CSSOM — CSP inline `style=` atributunu bloklayır (layihə qeydi).
    if(c.w) th.style.setProperty('width', c.w);
    return th;
  }));
  const body = el('tbody', {}, S.tasks.map(x => el('tr', {
    class: 'ws-tb__r', tabindex: '0',
    onclick: () => ctx.onOpen && ctx.onOpen(x.id),
    onkeydown: e => { if(e.key === 'Enter' && ctx.onOpen){ e.preventDefault(); ctx.onOpen(x.id); } },
  }, COLS.map(c => el('td', { dataset: { l: t(c.lbl) } }, c.cell(x))))));
  host.append(el('div', { class: 'ws-tbwrap' },
    el('table', { class: 'ws-tb' }, el('thead', {}, head), body)));
  appendSentinel(host, S);
}

/* ═══════════════════════ TƏQVİM ═══════════════════════
 *
 * ⚠ AY VƏZİYYƏTİ MODULDADIR, `S`-də YOX: o, filtr deyil. `S`-ə qoysaydıq
 *   sorğu parametrinə çevrilmək riski yaranardı və "hansı ay" server sorğusuna
 *   sızardı.
 */
let calMonth = null;

const WD = ['pf.wd_mon', 'pf.wd_tue', 'pf.wd_wed', 'pf.wd_thu', 'pf.wd_fri', 'pf.wd_sat', 'pf.wd_sun'];

function renderCalendar(host, S, ctx){
  if(!calMonth) calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  const first = new Date(y, m, 1);
  // Həftə BAZAR ERTƏSİNDƏN başlayır; `getDay()` bazardan saydığı üçün sürüşür.
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();

  const byDay = new Map();
  S.tasks.forEach(x => {
    if(!x.deadline) return;
    const d = new Date(x.deadline);
    if(d.getFullYear() !== y || d.getMonth() !== m) return;
    const k = d.getDate();
    if(!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(x);
  });

  const go = delta => { calMonth = new Date(y, m + delta, 1); if(S.onRedraw) S.onRedraw(); };
  const nav = el('div', { class: 'ws-cal__nav' },
    el('button', { class: 'c-icon-btn ws-cal__prev', type: 'button', 'aria-label': t('ws.prev'), onclick: () => go(-1) },
      ico('chevron', 15)),
    /* 🔴 `toLocaleDateString({month:'long'})` İŞLƏMİR: Chrome-un az-AZ ICU
       məlumatı natamamdır və "M08" kimi xam nişan qaytarır (layihə qeydi —
       profil kartında eyni qüsur olub). `fmtMonthYear` geri-düşmə cədvəli
       ilə düzgün ay adını verir. */
    el('h2', {}, fmtMonthYear(first.getTime())),
    el('button', { class: 'c-icon-btn', type: 'button', 'aria-label': t('ws.next'), onclick: () => go(1) },
      ico('chevron', 15)),
    el('button', { class: 'c-btn c-btn--ghost c-btn--sm', type: 'button',
      onclick: () => { calMonth = null; if(S.onRedraw) S.onRedraw(); } }, t('ws.today')),
  );

  const grid = el('div', { class: 'ws-cal' });
  WD.forEach(k => grid.append(el('div', { class: 'ws-cal__wd' }, t(k))));
  for(let i = 0; i < lead; i++) grid.append(el('div', { class: 'ws-cal__d is-out' }));

  const today = new Date();
  const isToday = d => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  for(let d = 1; d <= days; d++){
    const list = byDay.get(d) || [];
    grid.append(el('div', { class: 'ws-cal__d' + (isToday(d) ? ' is-today' : '') },
      el('div', { class: 'ws-cal__dh' },
        el('span', {}, String(d)),
        // Günə klik → həmin tarixlə yeni tapşırıq (Notion/Asana davranışı).
        el('button', {
          class: 'ws-cal__add', type: 'button', 'aria-label': t('ws.create'),
          onclick: () => S.onCreate && S.onCreate({ deadline: new Date(y, m, d, 12).getTime() }),
        }, ico('edit', 11)),
      ),
      el('div', { class: 'ws-cal__b' },
        list.slice(0, 4).map(x => {
          const p = PRIO[x.priority] || PRIO.Medium;
          return el('button', {
            class: 'ws-cal__t ws-p--' + p.tone + (x.status === 'Done' ? ' is-done' : ''),
            type: 'button', title: x.title,
            onclick: () => ctx.onOpen && ctx.onOpen(x.id),
          }, el('i', {}), x.title);
        }),
        list.length > 4 ? el('span', { class: 'ws-cal__more' }, '+' + (list.length - 4)) : null,
      ),
    ));
  }
  /* Sonuncu həftənin qalan xanaları — olmasa şəbəkənin son sətri yarımçıq
     qalır və fon bir bütöv boş blok kimi görünür. */
  const trail = (7 - ((lead + days) % 7)) % 7;
  for(let i = 0; i < trail; i++) grid.append(el('div', { class: 'ws-cal__d is-out' }));
  host.append(nav, grid);
}

/* ═══════════════════════ ZAMAN XƏTTİ ═══════════════════════
 *
 * ⚠ GANTT DEYİL: burada tapşırıqlar AYLARA görə qruplaşır və sprintlər
 *   başlıqda göstərilir — «nə vaxt nə baş verir» sualına cavabdır. Gantt isə
 *   müddət və üst-üstə düşmə sualına cavab verir.
 */
function renderTimeline(host, S, ctx){
  const dated = S.tasks.filter(x => x.deadline || x.startDate)
    .sort((a, b) => (a.startDate || a.deadline) - (b.startDate || b.deadline));
  if(!dated.length){ host.append(emptyState('calendar', t('ws.no_dated'))); return; }

  const groups = new Map();
  dated.forEach(x => {
    const d = new Date(x.startDate || x.deadline);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if(!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  });

  const nowTs = Date.now();
  groups.forEach((list, key) => {
    const parts = key.split('-');
    const yy = Number(parts[0]);
    const mm = Number(parts[1]);
    // Bax yuxarıdakı az-AZ ICU qeydi — burada da eyni köməkçi işlədilir.
    const label = fmtMonthYear(new Date(yy, mm - 1, 1).getTime());
    const sprints = (S.meta.sprints || []).filter(sp => {
      const a = new Date(sp.startsAt);
      const b = new Date(sp.endsAt);
      return (a.getFullYear() === yy && a.getMonth() === mm - 1)
        || (b.getFullYear() === yy && b.getMonth() === mm - 1);
    });
    host.append(el('section', { class: 'ws-tl__g' },
      el('div', { class: 'ws-tl__h' },
        el('h2', {}, label),
        sprints.map(sp => el('span', { class: 'ws-tl__sp' }, ico('refresh', 11), sp.name)),
      ),
      el('ol', { class: 'ws-tl' }, list.map(x => {
        const p = PRIO[x.priority] || PRIO.Medium;
        const ts = x.startDate || x.deadline;
        const late = x.deadline && x.deadline < nowTs && x.status !== 'Done';
        return el('li', { class: 'ws-tl__i ws-p--' + p.tone + (late ? ' is-late' : '') },
          el('span', { class: 'ws-tl__dot' }),
          el('button', { class: 'ws-tl__c', type: 'button', onclick: () => ctx.onOpen && ctx.onOpen(x.id) },
            el('span', { class: 'ws-tl__t' }, x.title),
            el('span', { class: 'ws-tl__m' },
              el('span', { class: 'ws-key' }, x.key || ''),
              el('span', { class: 'ws-stat ws-s--' + (ST_TONE[x.status] || 'slate') }, t('ws.st_' + slug(x.status))),
              x.projectName ? el('span', { class: 'ws-tb__muted' }, x.projectName) : null,
            ),
          ),
          el('time', { class: 'ws-tl__d' }, new Date(ts).toLocaleDateString()),
        );
      })),
    ));
  });
}

/* ═══════════════════════ GANTT ═══════════════════════
 *
 * ⚠ SVG DEYİL, CSS GRID: zolaqlar `grid-column` ilə yerləşdirilir. SVG
 *   variantı mətn ölçüsünü, tema rənglərini və klik zonalarını əl ilə idarə
 *   etməyi tələb edərdi; grid brauzerin öz layout mühərrikini işlədir və
 *   zolaq üzərindəki mətn avtomatik kəsilir.
 *
 * ⚠ ASILILIQ OXLARI ÇƏKİLMİR — ƏVƏZİNƏ NİŞAN. Kartlar arasında əyri xətt
 *   mütləq mövqe hesablaması tələb edir və hər sürüşmədə yenidən
 *   hesablanmalıdır (sürüşən konteynerdə xüsusilə kövrək). Bloklanmış
 *   tapşırıqda kilid nişanı və `title` göstərilir; tam qraf detal panelindədir.
 */
const ZOOMS = [
  { id: 'day', lbl: 'ws.z_day', unit: DAY },
  { id: 'week', lbl: 'ws.z_week', unit: DAY * 7 },
  { id: 'month', lbl: 'ws.z_month', unit: DAY * 30 },
  { id: 'quarter', lbl: 'ws.z_quarter', unit: DAY * 91 },
];
let ganttZoom = 'week';

function renderGantt(host, S, ctx){
  const rows = S.tasks.filter(x => x.deadline || x.startDate);
  if(!rows.length){ host.append(emptyState('calendar', t('ws.no_dated'))); return; }

  const z = ZOOMS.find(x => x.id === ganttZoom) || ZOOMS[1];
  const starts = rows.map(x => x.startDate || x.deadline);
  const ends = rows.map(x => x.deadline || x.startDate);
  const min = Math.min.apply(null, starts.concat([Date.now()]));
  const max = Math.max.apply(null, ends.concat([Date.now()]));
  const from = Math.floor(min / z.unit) * z.unit;
  // Sütun sayı məhdudlaşdırılır: 5 illik aralıq gündəlik zoom-da 1800 sütun
  // yaradardı və brauzer donardı.
  const cols = Math.max(4, Math.min(60, Math.ceil((max - from) / z.unit) + 1));

  const colOf = ts => Math.max(1, Math.min(cols, Math.floor((ts - from) / z.unit) + 1));
  const fmtCol = i => {
    const d = new Date(from + (i - 1) * z.unit);
    if(z.id === 'month') return d.toLocaleDateString(undefined, { month: 'short' });
    if(z.id === 'quarter') return 'Q' + (Math.floor(d.getMonth() / 3) + 1) + ' ' + String(d.getFullYear()).slice(2);
    return d.getDate() + '.' + (d.getMonth() + 1);
  };

  const zoomBar = el('div', { class: 'ws-gz' }, ZOOMS.map(x => el('button', {
    class: 'ws-pill' + (x.id === ganttZoom ? ' is-on' : ''), type: 'button',
    onclick: () => { ganttZoom = x.id; if(S.onRedraw) S.onRedraw(); },
  }, t(x.lbl))));

  const grid = el('div', { class: 'ws-gantt' });
  grid.style.setProperty('--gc', String(cols));
  grid.style.setProperty('--today', String(colOf(Date.now())));

  grid.append(el('div', { class: 'ws-gantt__corner' }, t('ws.title')));
  for(let i = 1; i <= cols; i++) grid.append(el('div', { class: 'ws-gantt__hc' }, fmtCol(i)));

  rows.forEach((x, i) => {
    const p = PRIO[x.priority] || PRIO.Medium;
    const a = colOf(x.startDate || x.deadline);
    // Bitiş sütunu ən azı bir vahid olmalıdır — eyni günə düşən tapşırıq
    // sıfır enli zolaq kimi görünməməlidir.
    const b = Math.max(a + 1, colOf(x.deadline || x.startDate) + 1);
    const blocked = x.status === 'Blocked';

    /* 🔴 SƏTİR VƏ SÜTUN AÇIQ TƏYİN OLUNUR — hər ikisi vacibdir:
     *
     *  • `grid-row`: yalnız sütun verilsəydi, avtomatik yerləşdirmə zolağı
     *    NÖVBƏTİ sətrə atırdı və hər tapşırıq iki sətir tuturdu (ad ayrı,
     *    zolaq ayrı) — ölçüldü, ekranda məhz belə görünürdü.
     *
     *  • `+1` OFSETİ: birinci sütun AD sütunudur. Ofset olmasaydı, ən erkən
     *    tapşırığın zolağı (a = 1) adın ÜSTÜNƏ düşərdi.
     *
     * Başlıq 1-ci sətirdir, ona görə tapşırıq sətri `i + 2`-dir.
     */
    const row = i + 2;
    const lbl = el('button', {
      class: 'ws-gantt__lbl', type: 'button', title: x.title,
      onclick: () => ctx.onOpen && ctx.onOpen(x.id),
    }, el('span', { class: 'ws-key' }, x.key || ''), el('span', { class: 'ws-gantt__lt' }, x.title));
    lbl.style.setProperty('grid-row', String(row));
    grid.append(lbl);

    const bar = el('button', {
      class: 'ws-gantt__bar ws-p--' + p.tone
        + (x.status === 'Done' ? ' is-done' : '') + (blocked ? ' is-blocked' : ''),
      type: 'button',
      title: x.title + (blocked ? ' · ' + t('ws.st_blocked') : ''),
      onclick: () => ctx.onOpen && ctx.onOpen(x.id),
    }, el('span', {}, x.title), blocked ? ico('lock', 10) : null);
    bar.style.setProperty('grid-row', String(row));
    bar.style.setProperty('grid-column', (a + 1) + ' / ' + (b + 1));
    grid.append(bar);
  });

  host.append(zoomBar, el('div', { class: 'ws-gwrap' }, grid));
}
