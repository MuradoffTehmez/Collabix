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
import { t } from './i18n.js';
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

/* ═══════════════════════ QALAN GÖRÜNÜŞLƏR ═══════════════════════
 *
 * Cədvəl, təqvim, timeline və Gantt Faza 3-dədir. Burada AÇIQ yer tutucu
 * qoyulur — sükutla boş ekran göstərmək istifadəçiyə "sınıb" kimi gələrdi.
 */
function placeholder(host, key){
  host.append(el('div', { class: 'ws-soon' },
    ico('clock', 28), el('h3', {}, t(key)), el('p', {}, t('ws.soon'))));
}
function renderTable(host){ placeholder(host, 'ws.v_table'); }
function renderCalendar(host){ placeholder(host, 'ws.v_calendar'); }
function renderTimeline(host){ placeholder(host, 'ws.v_timeline'); }
function renderGantt(host){ placeholder(host, 'ws.v_gantt'); }
