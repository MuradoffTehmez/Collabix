// Bildiriş mərkəzi — statistika kartları, pill filtrlər, axtarış,
// qruplaşdırma, tarix bölmələri, sürətli əməliyyatlar, toplu seçim,
// sonsuz sürüşmə və parametrlər paneli.
//
// ⚠ İKİ AYRI DATA YOLU VAR və onları qarışdırmaq olmaz:
//   • `subscribeNotifs()` — LOGIN BOYU işləyən yüngül dövrə. Yalnız nişan
//     sayğacı, canlı toast və masaüstü bildirişi üçündür (`limit=20`).
//   • `load()` — YALNIZ səhifə açıq olanda. Filtr/axtarış/kursor daşıyır.
//   Əvvəl hər ikisi eyni massivdən qidalanırdı, ona görə filtr tətbiq edəndə
//   qlobal sayğac da dəyişirdi (nişan "0" göstərirdi, halbuki oxunmamış var idi).
import {
  state, watchNotifs, markNotifRead, markAllNotifsRead,
  fetchNotifs, fetchNotifStats, fetchNotifPreviews,
  deleteNotif, bulkNotifs, fetchNotifMutes, toggleNotifMute, updateMySettings,
} from './store.js';
import {
  el, clear, tsToMillis, avatarNode, emit, debounce, prefersReducedMotion, countUp,
} from './util.js';
import { toast, undoToast, showModal, closeModal, notifToast, openPopover, closePopover } from './ui.js';
import { paintIcons } from './icon-set.js';
import { lsGet, lsSet } from './storage.js';
import { t, fmtRelTime, fmtDate } from './i18n.js';

/* ═══════════════════════ TAKSONOMİYA ═══════════════════════
 *
 * 🔴 SƏBƏT ADLARI SERVERLƏ EYNİ OLMALIDIR
 *    (`worker/services/notification/taxonomy.ts`). Server `bucket` sahəsini
 *    hər sətirlə birlikdə göndərir, ona görə client tipi YENİDƏN təsnif
 *    etmir — burada yalnız GÖRÜNÜŞ (ikon, rəng, sıra) təyin olunur.
 *    Əvvəlki qüsur məhz bundan yaranmışdı: tip siyahısı client-də əl ilə
 *    yazılmışdı və səkkiz komanda tipi ora heç vaxt əlavə edilməmişdi.
 */
const BUCKETS = [
  { key: 'all', icon: 'inbox' },
  { key: 'unread', icon: 'bell' },
  { key: 'messages', icon: 'mail' },
  { key: 'likes', icon: 'heart' },
  { key: 'comments', icon: 'message' },
  { key: 'mentions', icon: 'at' },
  { key: 'follows', icon: 'userPlus' },
  { key: 'tasks', icon: 'tasks' },
  { key: 'teams', icon: 'users' },
  { key: 'projects', icon: 'folder' },
  { key: 'system', icon: 'info' },
];

/** İdarə paneli kartlarında görünən səbətlər — `all`/`unread` başlıqdadır. */
const STAT_CARDS = ['messages', 'likes', 'comments', 'mentions', 'tasks', 'teams', 'projects', 'system'];

/**
 * Tip → ikon + rəng tonu.
 *
 * ⚠ `tone` CSS sinif şəkilçisidir (`nc-t--like`), sabit hex DEYİL: rənglər
 *   `88-notifications.css`-də nişanlarla təyin olunur ki, dörd temanın
 *   (dark/light/matrix/cyberpunk) hər birində kontrast qorunsun.
 */
const TYPE_META = {
  like: { icon: 'heart', tone: 'like' },
  repost: { icon: 'refresh', tone: 'like' },
  comment: { icon: 'message', tone: 'comment' },
  dm: { icon: 'mail', tone: 'message' },
  mention: { icon: 'at', tone: 'mention' },
  follow: { icon: 'userPlus', tone: 'follow' },
  task: { icon: 'tasks', tone: 'task' },
  verified: { icon: 'award', tone: 'system' },
  admin: { icon: 'shield', tone: 'system' },
  team_invite: { icon: 'mail', tone: 'team' },
  team_role: { icon: 'award', tone: 'team' },
  team_kick: { icon: 'doorOpen', tone: 'team' },
  team_task: { icon: 'tasks', tone: 'task' },
  team_project: { icon: 'folder', tone: 'project' },
  team_project_request: { icon: 'handRaised', tone: 'project' },
  team_announcement: { icon: 'megaphone', tone: 'team' },
  team_onboarding: { icon: 'rocket', tone: 'team' },
};
const metaOf = n => TYPE_META[n.type] || { icon: 'bell', tone: 'system' };

// Komanda bildirişləri hansı səhifəyə aparır.
const TEAM_ROUTES = {
  team_invite: 'teams?scope=invites',
  team_role: 'teams', team_kick: 'teams', team_task: 'teams',
  team_project: 'teams', team_project_request: 'teams',
  team_announcement: 'teams', team_onboarding: 'teams',
};

/* ═══════════════════════ VƏZİYYƏT ═══════════════════════ */

let notifs = [];              // qlobal dövrənin son nəticəsi (nişan + toast)
let unsubGlobal = null;
let mounted = false;
let lastToastMs = 0;
let initialLoad = true;

/** Səhifə vəziyyəti — filtr, yüklənmiş sətirlər, kursor. */
const page = {
  items: [], pinned: [], cursor: null, hasMore: false,
  loading: false, ready: false, syncedAt: 0,
};
/** Görünüş filtri. `state` adı `store.js`-dəki qlobal `state` ilə toqquşmasın deyə `view`. */
const view = { bucket: 'all', unread: false, box: 'inbox', q: '' };

let stats = null;
let selectMode = false;
const selection = new Set();
const expanded = new Set();      // açılmış qruplar (groupKey|bucket)
const previews = new Map();      // postId -> { excerpt, image } | null
let observer = null;

/** Yüklənmiş sətirlərin tavanı — bax `trimIfNeeded()`. */
const MAX_LOADED = 400;

/* ═══════════════════════ QLOBAL ABUNƏ ═══════════════════════ */

const DESKTOP_KEY = 'collabix_notif_desktop';
const desktopEnabled = () => lsGet(DESKTOP_KEY) === '1';

/**
 * Masaüstü bildirişi — YALNIZ tab fonda olanda.
 *
 * ⚠ Tab görünəndə göstərilmir: istifadəçi onsuz da səhifədə toast görür,
 *   ikisi birlikdə eyni hadisəni İKİ dəfə elan edərdi.
 */
function desktopNotify(n){
  if(!desktopEnabled() || !('Notification' in window)) return;
  if(Notification.permission !== 'granted' || !document.hidden) return;
  try{
    const note = new Notification(n.fromName || 'Collabix', {
      body: n.text || '', tag: n.id, icon: '/icon-192.png',
    });
    note.onclick = () => { window.focus(); routeNotif(n); note.close(); };
  }catch(e){ /* bəzi brauzerlər konstruktoru bloklayır — bildiriş opsionaldır */ }
}

/** Login boyu aktiv — nişan sayğacı + canlı toast + masaüstü bildirişi. */
export function subscribeNotifs(){
  initialLoad = true;
  unsubGlobal = watchNotifs(items => {
    const prevIds = new Set(notifs.map(n => n.id));
    notifs = items;
    emit('notif-unread', { count: items.filter(n => !n.read).length });

    if(!initialLoad){
      const fresh = items.filter(n => !n.read && !prevIds.has(n.id));
      const nowMs = Date.now();
      if(fresh.length && nowMs - lastToastMs > 1200){
        lastToastMs = nowMs;
        const n = fresh[0];
        const from = state.users.get(n.fromUid);
        const m = metaOf(n);
        notifToast(el('div', { class: 'notif-toast nc-t--' + m.tone, onclick: () => routeNotif(n) },
          avatarNode(from || { name: n.fromName }, 'avatar'),
          el('span', { class: 'notif-toast__ic ic', 'data-icon': m.icon, 'data-icon-size': '14' }),
          el('span', {}, el('b', {}, n.fromName || ''), ' ' + (n.text || '')),
        ));
        desktopNotify(n);
      }
      // Səhifə açıqdırsa yeni sətir siyahıya da düşməlidir.
      if(mounted && fresh.length) reload({ silent: true });
    }
    initialLoad = false;
  });
  return () => { if(unsubGlobal){ unsubGlobal(); unsubGlobal = null; } notifs = []; };
}

function routeNotif(n){
  if(!n.read) markNotifRead(n.id).catch(() => {});
  if(n.type === 'dm' && n.fromUid) emit('open-dm', { uid: n.fromUid });
  else if(n.type === 'task') emit('nav', { page: 'tasks' });
  else if(TEAM_ROUTES[n.type]) emit('nav', { page: TEAM_ROUTES[n.type] });
  else if(n.type === 'follow' && n.fromUid){
    const u = state.users.get(n.fromUid);
    emit('nav', { page: u ? 'u/' + u.username : 'users' });
  }
  else if(n.postId) emit('nav', { page: 'post/' + n.postId });
  else emit('nav', { page: 'home' });
}

/* ═══════════════════════ VAXT VƏ QRUPLAŞDIRMA ═══════════════════════ */

const DAY = 86400000;

/**
 * Nisbi vaxt — "indicə", "5 dəqiqə əvvəl", "Dünən", "3 gün əvvəl".
 *
 * ⚠ `fmtRelTime()`-a DELEQASİYA edilir, nərdivan burada TƏKRAR YAZILMIR:
 *   iki nisbi-vaxt sistemi olsaydı biri `Intl`-dən, digəri əl ilə gələrdi və
 *   vaxtla ayrılardılar. Yalnız "dünən" halı örtülür (AZ budağı
 *   `numeric:'auto'` işlətmir və "1 gün əvvəl" deyir).
 */
function relTime(ts){
  const ms = tsToMillis(ts);
  if(!ms) return '';
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const yStart = start.getTime() - DAY;
  if(ms >= yStart && ms < start.getTime()) return t('notifs.t.yesterday');
  return fmtRelTime(ms);
}

/** Mütləq vaxt — `title` atributunda (nisbi vaxt dəqiqliyi gizlədir). */
const absTime = ts => fmtDate(tsToMillis(ts), {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** Tarix bölməsi açarı: today | yesterday | week | lastweek | earlier. */
function dateBucket(ms){
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  if(ms >= today) return 'today';
  if(ms >= today - DAY) return 'yesterday';
  if(ms >= today - 7 * DAY) return 'week';
  if(ms >= today - 14 * DAY) return 'lastweek';
  return 'earlier';
}

/**
 * Sətirləri qruplara yığır.
 *
 * ⚠ QRUP AÇARINA TARİX BÖLMƏSİ DƏ DAXİLDİR (`groupKey|bucket`). Onsuz üç ay
 *   əvvəlki bəyənmə bugünkü ilə birləşib "Bu gün" bölməsinə düşərdi — yəni
 *   tarix başlıqları yalan danışardı.
 *
 * ⚠ QRUPLAŞDIRMA BÜTÜN YÜKLƏNMİŞ MASSİV ÜZRƏ hər render-də yenidən aparılır,
 *   səhifə-səhifə YOX. Səbəb: sonsuz sürüşmədə qrupun bir hissəsi 1-ci,
 *   qalanı 2-ci səhifədə gələ bilər; səhifə daxilində qruplaşdırsaydıq eyni
 *   mövzu iki dəfə görünərdi.
 */
function buildGroups(items){
  const out = [];
  const idx = new Map();
  for(const n of items){
    const ms = tsToMillis(n.createdAt);
    const db = dateBucket(ms);
    const key = (n.groupKey || n.type) + '|' + db;
    let g = idx.get(key);
    if(!g){
      g = { key, date: db, items: [], actors: new Map(), unread: 0, newest: ms };
      idx.set(key, g); out.push(g);
    }
    g.items.push(n);
    if(!n.read) g.unread++;
    g.newest = Math.max(g.newest, ms);
    const actorKey = n.fromUid || n.fromName || '?';
    if(!g.actors.has(actorKey)) g.actors.set(actorKey, n.fromName || '');
  }
  return out;
}

/** Qrup başlığı: "Ayşə paylaşımını bəyəndi 8 dəfə" / "Ayşə və daha 7 nəfər ...". */
function groupHeadline(g){
  const first = g.items[0];
  const name = first.fromName || 'Kimsə';
  const frag = document.createDocumentFragment();
  if(g.actors.size > 1){
    frag.append(
      el('b', {}, name), ' ',
      el('span', { class: 'nc-card__more-actors' },
        t('notifs.grp.others').replace('{name}', '').replace('{n}', String(g.actors.size - 1)).trim()),
      ' ' + (first.text || ''),
    );
  } else {
    frag.append(el('b', {}, name), ' ' + (first.text || ''));
    if(g.items.length > 1){
      frag.append(' ', el('span', { class: 'nc-card__repeat' },
        t('notifs.grp.repeat').replace('{n}', String(g.items.length))));
    }
  }
  return frag;
}

/* ═══════════════════════ SERVER ÇAĞIRIŞLARI ═══════════════════════ */

async function load({ append = false } = {}){
  if(page.loading) return;
  page.loading = true;
  setBusy(true);
  try{
    const d = await fetchNotifs({
      state: view.box, bucket: view.bucket, unread: view.unread,
      q: view.q, cursor: append ? page.cursor : null, limit: 40,
    });
    page.items = append ? page.items.concat(d.notifications) : d.notifications;
    if(!append) page.pinned = d.pinned || [];
    page.cursor = d.nextCursor;
    page.hasMore = !!d.hasMore;
    page.syncedAt = d.syncedAt || Date.now();
    page.ready = true;
    trimIfNeeded();
    renderList();
    renderHead();
    loadPreviews();
  }catch(e){
    if(!append) renderError();
  }finally{
    page.loading = false;
    setBusy(false);
  }
}

/**
 * Yüklənmiş sətir tavanı.
 *
 * ⚠ Sonsuz sürüşmə HƏQİQƏTƏN sonsuzdur: istifadəçi 10 000 sətir yükləyə
 *   bilər və hər render onların hamısını yenidən qruplaşdırıb DOM-a yazardı.
 *   Tavan `hasMore`-u sıfırlamır — sadəcə köhnə uc kəsilir və kursor yerində
 *   qalır, yəni davam etmək mümkündür.
 */
function trimIfNeeded(){
  if(page.items.length > MAX_LOADED) page.items = page.items.slice(0, MAX_LOADED);
}

async function reload({ silent = false } = {}){
  if(!silent) skeleton();
  page.cursor = null;
  await Promise.all([load(), refreshStats()]);
}

async function refreshStats(){
  try{
    stats = await fetchNotifStats();
    renderStats();
    renderFilters();
    renderHead();
  }catch(e){ /* sayğaclar opsionaldır — siyahı onsuz da işləyir */ }
}

/** Önizləmələr — yalnız hələ çəkilməmiş postId-lər üçün, TOPLU. */
async function loadPreviews(){
  const need = [...new Set(
    page.items.concat(page.pinned).map(n => n.postId).filter(id => id && !previews.has(id)),
  )].slice(0, 40);
  if(!need.length) return;
  // Təkrar sorğunu dayandırmaq üçün ƏVVƏLCƏ `null` yazılır: eyni id iki
  // paralel render-dən iki dəfə istənilməsin.
  need.forEach(id => previews.set(id, null));
  try{
    const got = await fetchNotifPreviews(need);
    for(const [id, p] of Object.entries(got)) previews.set(id, p);
    renderList();
  }catch(e){ /* önizləmə bəzəkdir — uğursuzluq siyahını pozmamalıdır */ }
}

/* ═══════════════════════ BAŞLIQ ═══════════════════════ */

function renderHead(){
  const unreadLine = document.getElementById('notifUnreadLine');
  const syncLine = document.getElementById('notifSyncLine');
  if(!unreadLine || !syncLine) return;

  const n = stats ? stats.all.unread : notifs.filter(x => !x.read).length;
  unreadLine.textContent = n > 0
    ? t('notifs.unread_n').replace('{n}', String(n))
    : t('notifs.unread_0');
  unreadLine.classList.toggle('is-zero', n === 0);

  syncLine.textContent = page.syncedAt
    ? t('notifs.synced').replace('{t}', fmtRelTime(page.syncedAt))
    : '';

  const markBtn = document.getElementById('markAllReadBtn');
  if(markBtn) markBtn.disabled = n === 0;
}

/* ═══════════════════════ STATİSTİKA KARTLARI ═══════════════════════ */

function renderStats(){
  const box = document.getElementById('notifStats');
  if(!box || !stats) return;
  clear(box);

  // ⚠ Hər obyekt EYNİ açar dəstini daşıyır (`accent`/`total` daxil): qarışıq
  //   formalı massiv `checkJs` altında birləşmə tipi verir və `c.accent`
  //   oxunuşu TS2339 ilə düşür.
  const cards = [
    { key: 'unread', icon: 'bell', count: stats.all.unread, total: stats.all.total, recent: stats.all.recent, accent: true },
    ...STAT_CARDS.map(k => ({
      key: k,
      icon: (BUCKETS.find(b => b.key === k) || {}).icon || 'bell',
      count: (stats.buckets[k] || {}).unread || 0,
      total: (stats.buckets[k] || {}).total || 0,
      recent: (stats.buckets[k] || {}).recent || 0,
      accent: false,
    })),
  ];

  for(const c of cards){
    const active = c.key === 'unread' ? view.unread : view.bucket === c.key;
    const numNode = el('span', { class: 'nc-stat__num' }, '0');
    const card = el('button', {
      class: 'nc-stat' + (c.accent ? ' nc-stat--accent' : '') + (active ? ' is-active' : ''),
      type: 'button',
      'aria-pressed': String(active),
      onclick: () => {
        if(c.key === 'unread'){ view.unread = !view.unread; }
        else { view.bucket = view.bucket === c.key ? 'all' : c.key; }
        applyFilter();
      },
    },
      el('span', { class: 'nc-stat__ic ic nc-t--' + toneForBucket(c.key), 'data-icon': c.icon, 'data-icon-size': '16' }),
      el('span', { class: 'nc-stat__body' },
        numNode,
        el('span', { class: 'nc-stat__lbl' }, t('notifs.b.' + c.key)),
        el('span', { class: 'nc-stat__trend' }, trendText(c)),
      ),
    );
    box.append(card);
    // Yumşaq sayğac — `prefers-reduced-motion` `countUp` daxilində yoxlanılır.
    countUp(numNode, c.count, { duration: 420 });
  }
  paintIcons(box);
}

function trendText(c){
  if(c.recent > 0) return '+' + c.recent + ' / 24s';
  if(c.total !== undefined && c.total > 0) return String(c.total) + ' ' + t('notifs.b.all').toLowerCase();
  return '—';
}

/** Səbət → rəng tonu (kart ikonu və pill nöqtəsi üçün). */
function toneForBucket(key){
  return ({
    unread: 'accent', messages: 'message', likes: 'like', comments: 'comment',
    mentions: 'mention', follows: 'follow', tasks: 'task', teams: 'team',
    projects: 'project', system: 'system',
  })[key] || 'system';
}

/* ═══════════════════════ FİLTR PİLLƏRİ ═══════════════════════ */

function renderFilters(){
  const box = document.getElementById('notifFilters');
  if(!box) return;
  clear(box);

  const mk = (key, icon, count, active, onclick) => {
    const b = el('button', {
      class: 'nc-pill' + (active ? ' is-active' : ''),
      type: 'button', role: 'tab', 'aria-selected': String(active), onclick,
    },
      el('span', { class: 'nc-pill__ic ic nc-t--' + toneForBucket(key), 'data-icon': icon, 'data-icon-size': '15' }),
      el('span', { class: 'nc-pill__lbl' }, t('notifs.b.' + key)),
    );
    if(count > 0) b.append(el('span', { class: 'nc-pill__count' }, String(count > 99 ? '99+' : count)));
    return b;
  };

  const cnt = k => (stats && stats.buckets[k] ? stats.buckets[k].unread : 0);

  box.append(mk('all', 'inbox', stats ? stats.all.total : 0,
    view.bucket === 'all' && !view.unread && view.box === 'inbox',
    () => { view.bucket = 'all'; view.unread = false; view.box = 'inbox'; applyFilter(); }));

  box.append(mk('unread', 'bell', stats ? stats.all.unread : 0, view.unread,
    () => { view.unread = !view.unread; view.box = 'inbox'; applyFilter(); }));

  for(const b of BUCKETS.slice(2)){
    box.append(mk(b.key, b.icon, cnt(b.key), view.bucket === b.key && view.box === 'inbox',
      () => { view.bucket = view.bucket === b.key ? 'all' : b.key; view.box = 'inbox'; applyFilter(); }));
  }

  // Arxiv ayrıca qutudur — səbət filtri deyil, ona görə sonda və vizual ayrılıqda.
  box.append(mk('archived', 'archive', stats ? stats.archived : 0, view.box === 'archived',
    () => { view.box = view.box === 'archived' ? 'inbox' : 'archived'; view.unread = false; applyFilter(); }));

  paintIcons(box);
}

function applyFilter(){
  expanded.clear();
  clearSelection();
  renderFilters();
  renderStats();
  skeleton();
  page.cursor = null;
  load();
}

/* ═══════════════════════ SİYAHI ═══════════════════════ */

const listBox = () => document.getElementById('notifList');

function setBusy(on){
  const b = listBox();
  if(b) b.setAttribute('aria-busy', on ? 'true' : 'false');
}

/**
 * Skeleton — spinner YOX.
 * ⚠ Ölçülər real karta yaxındır (`c-skeleton` şərhi): yaxın olmasa skeleton
 *   sıçrayışı gizlədib sonra geri qaytarar (CLS).
 */
function skeleton(){
  const box = listBox();
  if(!box) return;
  clear(box);
  box.append(el('div', { class: 'nc-group-lbl nc-group-lbl--ghost' }, el('span', { class: 'c-skeleton c-skeleton--title' })));
  for(let i = 0; i < 6; i++){
    box.append(el('div', { class: 'nc-card nc-card--skeleton' },
      el('div', { class: 'c-skeleton nc-sk-avatar' }),
      el('div', { class: 'nc-sk-body' },
        el('div', { class: 'c-skeleton c-skeleton--line nc-sk-line1' }),
        el('div', { class: 'c-skeleton c-skeleton--line nc-sk-line2' }),
      ),
    ));
  }
}

function renderError(){
  const box = listBox();
  if(!box) return;
  clear(box);
  box.append(el('div', { class: 'c-empty nc-empty' },
    el('div', { class: 'c-empty__icon ic', 'data-icon': 'bell-off', 'data-icon-size': '28' }),
    el('div', { class: 'c-empty__title' }, t('notifs.err')),
    el('button', { class: 'c-btn c-btn--ghost c-btn--sm', onclick: () => reload() }, t('notifs.refresh')),
  ));
  paintIcons(box);
}

function renderEmpty(box){
  const filtered = view.q || view.unread || view.bucket !== 'all';
  const archive = view.box === 'archived';
  const icon = archive ? 'archive' : (filtered ? 'search' : 'inbox');
  const title = archive ? 'notifs.empty.archive_title' : (filtered ? 'notifs.empty.filtered_title' : 'notifs.empty.title');
  const text = archive ? 'notifs.empty.archive_text' : (filtered ? 'notifs.empty.filtered_text' : 'notifs.empty.text');

  const cta = filtered
    ? el('button', {
      class: 'c-btn c-btn--ghost c-btn--sm',
      onclick: () => {
        view.q = ''; view.unread = false; view.bucket = 'all'; view.box = 'inbox';
        const s = document.getElementById('notifSearch');
        if(s) s.value = '';
        applyFilter();
      },
    }, t('notifs.empty.reset'))
    : (archive ? null : el('button', {
      class: 'c-btn c-btn--primary c-btn--sm',
      onclick: () => emit('nav', { page: 'home' }),
    }, t('notifs.empty.cta')));

  box.append(el('div', { class: 'c-empty nc-empty' },
    el('div', { class: 'nc-empty__art' },
      el('span', { class: 'ic', 'data-icon': icon, 'data-icon-size': '32' })),
    el('div', { class: 'c-empty__title' }, t(title)),
    el('div', { class: 'c-empty__text' }, t(text)),
    cta,
  ));
  paintIcons(box);
}

function renderList(){
  const box = listBox();
  if(!box) return;
  clear(box);

  const hasAny = page.items.length || page.pinned.length;
  if(!page.ready){ skeleton(); return; }
  if(!hasAny){ renderEmpty(box); return; }

  // ── Sabitlənmişlər (yalnız birinci səhifədə gəlir, tarixdən asılı deyil).
  if(page.pinned.length){
    box.append(sectionLabel('pinned', page.pinned.length, 'pin'));
    for(const g of buildGroups(page.pinned)) box.append(renderGroup(g));
  }

  // ── Tarix bölmələri.
  const groups = buildGroups(page.items);
  let lastDate = '';
  for(const g of groups){
    if(g.date !== lastDate){
      lastDate = g.date;
      const count = groups.filter(x => x.date === g.date).reduce((s, x) => s + x.items.length, 0);
      box.append(sectionLabel(g.date, count));
    }
    box.append(renderGroup(g));
  }

  if(page.hasMore){
    box.append(el('div', { class: 'nc-more' },
      el('button', { class: 'c-btn c-btn--ghost c-btn--sm', onclick: () => load({ append: true }) },
        t('notifs.grp.expand'))));
  }
  paintIcons(box);
}

function sectionLabel(key, count, icon){
  return el('div', { class: 'nc-group-lbl' },
    icon ? el('span', { class: 'ic nc-group-lbl__ic', 'data-icon': icon, 'data-icon-size': '13' }) : null,
    el('span', {}, t('notifs.g.' + key)),
    el('span', { class: 'nc-group-lbl__n' }, String(count)),
  );
}

/**
 * Qrup render-i.
 *
 * Bir sətirlik qrup adi kart kimi çıxır; çox sətirli qrup "yığılmış" kart
 * verir və açılanda alt sətirlər görünür. Açıq/bağlı vəziyyət `expanded`-dədir
 * ki, render-lər arası (poll, önizləmə gəlişi) İTMƏSİN.
 */
function renderGroup(g){
  if(g.items.length === 1) return renderCard(g.items[0], g);

  const isOpen = expanded.has(g.key);
  const wrap = el('div', { class: 'nc-group' + (isOpen ? ' is-open' : '') });
  wrap.append(renderCard(g.items[0], g, { grouped: true, open: isOpen }));
  if(isOpen){
    const rest = el('div', { class: 'nc-group__rest' });
    for(const n of g.items.slice(1)) rest.append(renderCard(n, null, { child: true }));
    wrap.append(rest);
  }
  return wrap;
}

function renderCard(n, group, opts = {}){
  const m = metaOf(n);
  const from = state.users.get(n.fromUid);
  const selected = selection.has(n.id);
  const isGroupHead = !!group && group.items.length > 1;
  const unread = isGroupHead ? group.unread > 0 : !n.read;

  const card = el('article', {
    class: [
      'nc-card',
      unread ? 'is-unread' : '',
      selected ? 'is-selected' : '',
      opts.child ? 'nc-card--child' : '',
      n.pinnedAt ? 'is-pinned' : '',
      n.priority ? 'is-priority' : '',
      'nc-t--' + m.tone,
    ].filter(Boolean).join(' '),
    dataset: { id: n.id, group: group ? group.key : '' },
    tabindex: '0',
    role: 'button',
    'aria-label': (n.fromName || '') + ' ' + (n.text || ''),
    onclick: e => {
      if(e.target.closest('.nc-actions, .nc-card__pick, .nc-menu')) return;
      if(selectMode){ toggleSelect(n.id); return; }
      if(isGroupHead){ toggleGroup(group.key); return; }
      routeNotif(n);
    },
    onkeydown: e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); card.click(); }
      else if(e.key === 'x' || e.key === 'X'){ e.preventDefault(); toggleSelect(n.id); }
      else if(e.key === 'ArrowDown' || e.key === 'j'){ e.preventDefault(); focusSibling(card, 1); }
      else if(e.key === 'ArrowUp' || e.key === 'k'){ e.preventDefault(); focusSibling(card, -1); }
    },
  });

  // Seçim qutusu — yalnız seçim rejimində sıraya girir (CSS gizlədir).
  card.append(el('span', {
    class: 'nc-card__pick',
    role: 'checkbox',
    tabindex: selectMode ? '0' : '-1',
    'aria-checked': String(selected),
    'aria-label': t('notifs.select'),
    onclick: () => toggleSelect(n.id),
    onkeydown: e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleSelect(n.id); } },
  }, el('span', { class: 'ic', 'data-icon': selected ? 'squareCheck' : 'square', 'data-icon-size': '18' })));

  // Avatar + tip nişanı.
  const av = el('div', { class: 'nc-card__avatar' });
  if(group && group.actors.size > 1){
    // Yığılmış avatarlar — ən çox üç nəfər.
    const stack = el('div', { class: 'nc-avstack' });
    group.items.slice(0, 3).forEach(item => {
      stack.append(avatarNode(state.users.get(item.fromUid) || { name: item.fromName }, 'avatar'));
    });
    av.append(stack);
  } else {
    av.append(avatarNode(from || { name: n.fromName }, 'avatar'));
  }
  av.append(el('span', { class: 'nc-card__type ic', 'data-icon': m.icon, 'data-icon-size': '12' }));
  card.append(av);

  // Gövdə.
  const body = el('div', { class: 'nc-card__body' });
  body.append(el('p', { class: 'nc-card__title' }, isGroupHead ? groupHeadline(group) : (() => {
    const f = document.createDocumentFragment();
    f.append(el('b', {}, n.fromName || 'Kimsə'), ' ' + (n.text || ''));
    return f;
  })()));

  const pv = n.postId ? previews.get(n.postId) : null;
  if(pv) body.append(renderPreview(pv));
  else if(n.postId) body.append(el('div', { class: 'nc-preview nc-preview--ghost' },
    el('span', { class: 'c-skeleton c-skeleton--line' })));

  const meta = el('div', { class: 'nc-card__meta' });
  meta.append(el('time', { class: 'nc-card__time', datetime: new Date(tsToMillis(n.createdAt)).toISOString(), title: absTime(n.createdAt) }, relTime(n.createdAt)));
  if(n.priority) meta.append(el('span', { class: 'nc-flag' },
    el('span', { class: 'ic', 'data-icon': 'zap', 'data-icon-size': '11' }), t('notifs.a.priority')));
  if(n.pinnedAt) meta.append(el('span', { class: 'nc-flag nc-flag--pin' },
    el('span', { class: 'ic', 'data-icon': 'pin', 'data-icon-size': '11' }), t('notifs.g.pinned')));
  if(isGroupHead) meta.append(el('button', {
    class: 'nc-card__toggle', type: 'button',
    'aria-expanded': String(opts.open),
    onclick: e => { e.stopPropagation(); toggleGroup(group.key); },
  }, opts.open ? t('notifs.grp.collapse') : t('notifs.grp.expand')));
  body.append(meta);
  card.append(body);

  // Sağ tərəf: oxunmamış nöqtəsi + sürətli əməliyyatlar.
  const side = el('div', { class: 'nc-card__side' });
  if(unread) side.append(el('span', { class: 'nc-dot', 'aria-label': t('notifs.b.unread') }));
  if(!opts.child) side.append(quickActions(n, group));
  card.append(side);

  attachSwipe(card, n);
  return card;
}

function renderPreview(pv){
  const box = el('div', { class: 'nc-preview' });
  if(pv.image){
    const img = el('img', {
      class: 'nc-preview__img', src: pv.image, alt: '',
      loading: 'lazy', decoding: 'async', width: '44', height: '44',
    });
    box.append(img);
  } else {
    box.append(el('span', { class: 'nc-preview__ic ic', 'data-icon': 'type', 'data-icon-size': '14' }));
  }
  box.append(el('span', { class: 'nc-preview__txt' }, pv.excerpt || '—'));
  return box;
}

/* ═══════════════════════ SÜRƏTLİ ƏMƏLİYYATLAR ═══════════════════════ */

function quickActions(n, group){
  const ids = group && group.items.length > 1 ? group.items.map(x => x.id) : [n.id];
  const box = el('div', { class: 'nc-actions' });

  const btn = (icon, label, fn) => el('button', {
    class: 'nc-act', type: 'button', title: label, 'aria-label': label,
    onclick: e => { e.stopPropagation(); fn(); },
  }, el('span', { class: 'ic', 'data-icon': icon, 'data-icon-size': '15' }));

  const anyUnread = ids.some(id => {
    const item = page.items.concat(page.pinned).find(x => x.id === id);
    return item && !item.read;
  });

  box.append(btn(anyUnread ? 'check' : 'eyeOff', t(anyUnread ? 'notifs.a.read' : 'notifs.a.unread'),
    () => act(anyUnread ? 'read' : 'unread', ids)));

  if(view.box === 'archived'){
    box.append(btn('inbox', t('notifs.a.unarchive'), () => act('unarchive', ids)));
  } else {
    box.append(btn('archive', t('notifs.a.archive'), () => act('archive', ids)));
  }

  box.append(btn('trash', t('notifs.a.delete'), () => removeWithUndo(ids)));
  box.append(btn('more', t('notifs.a.more'), function(){ openMoreMenu(this, n, ids); }));
  return box;
}

/** "Daha çox" menyusu — sabitləmə, susdurma, aç, linki kopyala. */
function openMoreMenu(anchorBtn, n, ids){
  closeMenu();
  // ⚠ OBYEKT massivi, kortej YOX: `[key, icon, fn]` formasında `checkJs`
  //   elementləri `string | (() => void)` birləşməsi kimi oxuyur və `fn()`
  //   çağırışı TS2349 verir (birləşmənin hər üzvü çağırıla bilmir).
  /** @type {Array<{key: string, icon: string, run: () => void}>} */
  const items = [];

  items.push({ key: n.pinnedAt ? 'notifs.a.unpin' : 'notifs.a.pin', icon: 'pin',
    run: () => act(n.pinnedAt ? 'unpin' : 'pin', ids) });
  items.push({ key: 'notifs.a.open', icon: 'link', run: () => routeNotif(n) });
  if(n.postId) items.push({ key: 'notifs.a.copy', icon: 'copy', run: () => copyLink(n) });
  items.push({ key: 'notifs.a.mute_thread', icon: 'bell-off', run: () => mute('thread', n.groupKey) });
  if(n.fromUid) items.push({ key: 'notifs.a.mute_user', icon: 'bell-off', run: () => mute('user', n.fromUid) });
  items.push({ key: 'notifs.a.mute_type', icon: 'bell-off', run: () => mute('type', n.type) });

  const menu = el('div', { class: 'nc-menu', role: 'menu' },
    items.map(it => el('button', {
      class: 'nc-menu__item', role: 'menuitem', type: 'button',
      onclick: e => { e.stopPropagation(); closeMenu(); it.run(); },
    },
      el('span', { class: 'ic', 'data-icon': it.icon, 'data-icon-size': '15' }),
      el('span', {}, t(it.key)),
    )),
  );
  // 🔴 BODY-yə portal. `.nc-card` `content-visibility: auto` işlədir və o,
  //    HƏMİŞƏ `contain: paint` tətbiq edir — kartdan kənara çıxan `absolute`
  //    panel KƏSİLİR (kataloq menyusunda ölçülmüş eyni qüsur).
  paintIcons(menu);
  openPopover(anchorBtn, menu);
}

// Açıq panelin vəziyyətini `ui.js` portalı saxlayır — yerli dəyişən yox.
function closeMenu(){ closePopover(); }

async function copyLink(n){
  const url = location.origin + '/#post/' + n.postId;
  try{
    await navigator.clipboard.writeText(url);
    toast(t('notifs.ok.copied'));
  }catch(e){ toast(t('notifs.err'), 'err'); }
}

/**
 * Ümumi əməliyyat icraçısı — OPTİMİSTİK.
 *
 * ⚠ Yerli vəziyyət ƏVVƏLCƏ dəyişir, sonra server çağırılır: 200-400 ms
 *   gözləmə "düymə işləmir" hissi verirdi. Uğursuzluqda `reload()` serverin
 *   həqiqətini geri qaytarır — yəni optimizm YALAN qalmır.
 */
async function act(action, ids){
  applyLocal(action, ids);
  renderList();
  try{
    await bulkNotifs(action, { ids });
    await refreshStats();
    const msg = {
      read: 'notifs.ok.read', unread: 'notifs.ok.read',
      archive: 'notifs.ok.archived', unarchive: 'notifs.ok.unarchived',
      pin: 'notifs.ok.pinned', unpin: 'notifs.ok.unpinned',
    }[action];
    if(msg) toast(t(msg));
    // Arxiv/sabitləmə siyahının TƏRKİBİNİ dəyişir (sətir başqa qutuya keçir) —
    // yerli süzgəc kifayət etmir, serverdən yenidən çəkilir.
    if(action === 'archive' || action === 'unarchive' || action === 'pin' || action === 'unpin'){
      page.cursor = null;
      await load();
    }
  }catch(e){
    toast(t('notifs.err'), 'err');
    reload({ silent: true });
  }
}

function applyLocal(action, ids){
  const set = new Set(ids);
  const touch = arr => arr.forEach(x => {
    if(!set.has(x.id)) return;
    if(action === 'read') x.read = true;
    else if(action === 'unread') x.read = false;
  });
  touch(page.items); touch(page.pinned);
  if(action === 'archive' || action === 'unarchive'){
    page.items = page.items.filter(x => !set.has(x.id));
    page.pinned = page.pinned.filter(x => !set.has(x.id));
  }
}

/**
 * Silmə — GERİ ALINA BİLƏN.
 *
 * ⚠ `undoToast` mutasiyanı TƏXİRƏ SALIR (bax onun şərhi): "Geri al" basılsa
 *   DELETE serverə heç vaxt getmir. Ona görə burada server tərəfli bərpa
 *   məntiqi lazım deyil — silinmiş bildirişi geri yaratmaq mümkün olmazdı.
 */
function removeWithUndo(ids){
  const removed = page.items.filter(x => ids.includes(x.id))
    .concat(page.pinned.filter(x => ids.includes(x.id)));
  page.items = page.items.filter(x => !ids.includes(x.id));
  page.pinned = page.pinned.filter(x => !ids.includes(x.id));
  renderList();

  const msg = ids.length > 1
    ? t('notifs.ok.deleted_n').replace('{n}', String(ids.length))
    : t('notifs.ok.deleted');

  undoToast(msg, async () => {
    try{
      if(ids.length === 1) await deleteNotif(ids[0]);
      else await bulkNotifs('delete', { ids });
      await refreshStats();
    }catch(e){ toast(t('notifs.err'), 'err'); reload({ silent: true }); }
  }, {
    onUndo: () => {
      // Sıra pozulmasın deyə tam yenidən sıralama — sadə `unshift` köhnə
      // sətri siyahının başına atardı.
      page.items = page.items.concat(removed).sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
      renderList();
    },
  });
}

async function mute(scope, target){
  try{
    await toggleNotifMute(scope, target, true);
    toast(t('notifs.ok.muted'));
    reload({ silent: true });
  }catch(e){ toast(t('notifs.err'), 'err'); }
}

function toggleGroup(key){
  if(expanded.has(key)) expanded.delete(key); else expanded.add(key);
  renderList();
}

function focusSibling(card, dir){
  const all = [...listBox().querySelectorAll('.nc-card')];
  const i = all.indexOf(card);
  const next = all[i + dir];
  if(next) next.focus();
}

/* ═══════════════════════ SEÇİM REJİMİ ═══════════════════════ */

function toggleSelect(id){
  if(selection.has(id)) selection.delete(id); else selection.add(id);
  if(selection.size && !selectMode) setSelectMode(true);
  renderList();
  renderBulkBar();
}

function clearSelection(){
  selection.clear();
  renderBulkBar();
}

function setSelectMode(on){
  selectMode = on;
  document.getElementById('page-notifs').classList.toggle('is-selecting', on);
  const btn = document.getElementById('notifSelectBtn');
  if(btn){
    const lbl = btn.querySelector('span:last-child');
    if(lbl) lbl.textContent = t(on ? 'notifs.select_done' : 'notifs.select');
    btn.setAttribute('aria-pressed', String(on));
  }
  if(!on) selection.clear();
  renderBulkBar();
  renderList();
  // Toplu zolaq sıraya girib-çıxdığı üçün tarix başlığının ofseti dəyişir.
  syncStickyOffsets();
}

function renderBulkBar(){
  const bar = document.getElementById('notifBulkBar');
  if(!bar) return;
  clear(bar);
  const n = selection.size;
  bar.hidden = !selectMode;
  if(!selectMode) return;

  const ids = () => [...selection];
  const btn = (icon, key, fn, danger) => el('button', {
    class: 'c-btn c-btn--sm ' + (danger ? 'c-btn--danger' : 'c-btn--ghost'),
    type: 'button', disabled: n === 0,
    onclick: () => { fn(ids()); clearSelection(); },
  }, el('span', { class: 'ic', 'data-icon': icon, 'data-icon-size': '15' }), el('span', {}, t(key)));

  bar.append(
    el('span', { class: 'nc-bulk__count' }, t('notifs.selected_n').replace('{n}', String(n))),
    el('button', {
      class: 'nc-bulk__link', type: 'button',
      onclick: () => {
        const all = page.items.concat(page.pinned);
        if(selection.size === all.length) selection.clear();
        else all.forEach(x => selection.add(x.id));
        renderList(); renderBulkBar();
      },
    }, t(selection.size && selection.size === page.items.length + page.pinned.length
      ? 'notifs.select_none' : 'notifs.select_all')),
    el('span', { class: 'nc-bulk__spacer' }),
    btn('check', 'notifs.a.read', list => act('read', list)),
    view.box === 'archived'
      ? btn('inbox', 'notifs.a.unarchive', list => act('unarchive', list))
      : btn('archive', 'notifs.a.archive', list => act('archive', list)),
    btn('trash', 'notifs.a.delete', list => removeWithUndo(list), true),
    el('button', {
      class: 'c-icon-btn', type: 'button', 'aria-label': t('notifs.select_done'),
      onclick: () => setSelectMode(false),
    }, el('span', { class: 'ic', 'data-icon': 'x', 'data-icon-size': '16' })),
  );
  paintIcons(bar);
}

/* ═══════════════════════ SÜRÜŞDÜRMƏ (MOBİL) ═══════════════════════ */

/**
 * Yan sürüşdürmə: sola → sil, sağa → arxiv.
 *
 * ⚠ ASTANA (`START`) MƏCBURİDİR: onsuz şaquli sürüşmə zamanı barmağın
 *   kiçik yan titrəyişi kartı tutub səhifə sürüşməsini kilidləyirdi
 *   (`drag-threshold` qaydası). Şaquli hərəkət üstünlüklüdürsə jest ləğv olunur.
 */
function attachSwipe(card, n){
  if(!window.matchMedia('(pointer: coarse)').matches) return;
  const START = 12;
  const FIRE = 88;
  let x0 = 0, y0 = 0, dx = 0, active = false, decided = false;

  card.addEventListener('pointerdown', e => {
    if(e.pointerType === 'mouse') return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; active = true; decided = false;
  });
  card.addEventListener('pointermove', e => {
    if(!active) return;
    const ax = e.clientX - x0, ay = e.clientY - y0;
    if(!decided){
      if(Math.abs(ax) < START && Math.abs(ay) < START) return;
      decided = true;
      if(Math.abs(ay) > Math.abs(ax)){ active = false; return; }  // şaquli qalib
      card.setPointerCapture(e.pointerId);
      card.classList.add('is-swiping');
    }
    dx = ax;
    card.style.transform = `translateX(${dx}px)`;
    card.classList.toggle('sw-del', dx < -FIRE / 2);
    card.classList.toggle('sw-arch', dx > FIRE / 2);
  });
  const end = () => {
    if(!active) return;
    active = false;
    card.classList.remove('is-swiping', 'sw-del', 'sw-arch');
    card.style.transform = '';
    if(dx < -FIRE) removeWithUndo([n.id]);
    else if(dx > FIRE) act(view.box === 'archived' ? 'unarchive' : 'archive', [n.id]);
    dx = 0;
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

/* ═══════════════════════ PARAMETRLƏR PANELİ ═══════════════════════ */

async function openSettings(){
  const me = state.me || {};
  const prefs = (me.settings && me.settings.notifications) || {};

  const rows = ['messages', 'likes', 'comments', 'mentions', 'follows', 'tasks', 'teams', 'projects', 'system']
    .map(key => toggleRow(t('notifs.b.' + key), prefs[key] !== false, async v => {
      await updateMySettings({ notifications: { [key]: v } });
    }));

  // Masaüstü bildirişi — SERVERDƏ YOX, cihazda saxlanılır (brauzer icazəsi
  // cihaza bağlıdır; bir cihazda verilən icazə digərində keçərli deyil).
  const deskHint = el('div', { class: 'nc-set__hint' }, t('notifs.set.ch_desktop_hint'));
  const deskRow = toggleRow(t('notifs.set.ch_desktop'), desktopEnabled(), async v => {
    if(!v){ lsSet(DESKTOP_KEY, '0'); return true; }
    if(!('Notification' in window)){ deskHint.textContent = t('notifs.set.ch_desktop_denied'); return false; }
    const perm = Notification.permission === 'granted'
      ? 'granted' : await Notification.requestPermission();
    if(perm !== 'granted'){
      deskHint.textContent = t('notifs.set.ch_desktop_denied');
      return false;
    }
    lsSet(DESKTOP_KEY, '1');
    return true;
  });

  const mutesBox = el('div', { class: 'nc-set__mutes' }, el('span', { class: 'c-skeleton c-skeleton--line' }));

  showModal([
    el('div', { class: 'section-title' }, t('notifs.set.title')),
    el('div', { class: 'nc-set' },
      el('h3', { class: 'nc-set__h' }, t('notifs.set.types')),
      el('p', { class: 'nc-set__hint' }, t('notifs.set.types_hint')),
      el('div', { class: 'nc-set__grid' }, rows),

      el('h3', { class: 'nc-set__h' }, t('notifs.set.channels')),
      toggleRow(t('notifs.set.ch_inapp'), true, null, { locked: true }),
      el('div', { class: 'nc-set__hint' }, t('notifs.set.ch_inapp_hint')),
      deskRow, deskHint,
      toggleRow(t('notifs.set.ch_email'), false, null, { locked: true }),
      el('div', { class: 'nc-set__hint' }, t('notifs.set.ch_email_hint')),

      el('h3', { class: 'nc-set__h' }, t('notifs.set.mutes')),
      mutesBox,
    ),
    el('div', { class: 'nc-set__foot' },
      el('button', { class: 'c-btn c-btn--ghost c-btn--sm', onclick: closeModal }, t('notifs.set.close'))),
  ], { label: t('notifs.set.title') });

  // Sussuz siyahısı ASİNXRON gəlir — modal onu gözləmədən açılır ki,
  // "parametrlər açılmır" hissi yaranmasın.
  try{
    const mutes = await fetchNotifMutes();
    clear(mutesBox);
    if(!mutes.length){ mutesBox.append(el('p', { class: 'nc-set__hint' }, t('notifs.set.mutes_empty'))); return; }
    for(const m of mutes){
      const label = m.scope === 'user'
        ? ((state.users.get(m.target) || {}).name || m.target)
        : m.target;
      mutesBox.append(el('div', { class: 'nc-set__mute' },
        el('span', { class: 'c-badge' }, t('notifs.set.scope_' + m.scope)),
        el('span', { class: 'nc-set__mute-lbl' }, label),
        el('button', {
          class: 'c-btn c-btn--ghost c-btn--sm',
          onclick: async e => {
            e.currentTarget.disabled = true;
            try{
              await toggleNotifMute(m.scope, m.target, false);
              e.currentTarget.closest('.nc-set__mute').remove();
              toast(t('notifs.ok.unmuted'));
            }catch(err){ toast(t('notifs.err'), 'err'); }
          },
        }, t('notifs.set.unmute')),
      ));
    }
  }catch(e){
    clear(mutesBox);
    mutesBox.append(el('p', { class: 'nc-set__hint' }, t('notifs.err')));
  }
}

/**
 * Açar sətri.
 * @param {Function|null} onSet `false` qaytarsa açar GERİ çevrilir (icazə rədd edildi).
 */
function toggleRow(label, on, onSet, opts = {}){
  const input = el('input', {
    type: 'checkbox', checked: on, disabled: !!opts.locked,
    onchange: async e => {
      const v = e.currentTarget.checked;
      if(!onSet) return;
      e.currentTarget.disabled = true;
      try{
        const res = await onSet(v);
        if(res === false) e.currentTarget.checked = !v;
      }catch(err){
        e.currentTarget.checked = !v;
        toast(t('notifs.err'), 'err');
      }finally{
        e.currentTarget.disabled = !!opts.locked;
      }
    },
  });
  return el('label', { class: 'nc-set__row' + (opts.locked ? ' is-locked' : '') },
    el('span', { class: 'nc-set__lbl' }, label),
    el('span', { class: 'nc-switch' }, input, el('span', { class: 'nc-switch__track' })),
  );
}

/* ═══════════════════════ YAPIŞQAN QAT OFSETLƏRİ ═══════════════════════ */

let stickyRO = null;

/**
 * Üç yapışqan qat üst-üstə düzülür: topbar → idarəetmə zolağı → tarix başlığı
 * (seçim rejimində araya toplu zolaq girir). Hər birinin `top` dəyəri
 * özündən ƏVVƏLKİLƏRİN cəmidir.
 *
 * 🔴 DƏYƏRLƏR ÖLÇÜLÜR, CSS-də SABİT YAZILMIR. `.app-topbar` hündürlüyü şrift
 *    ölçüsündən asılıdır, `.nc-controls` isə 480px-dən dar ekranda iki sətrə
 *    çıxır. Sabit `top: 92px` yazılanda mobil sarmada axtarış sahəsi topbar-ın
 *    ALTINDA gizlənirdi — brauzerdə ölçüldü, təxmin deyil.
 *
 * ⚠ `style.setProperty` CSSOM yoluyladır, HTML `style="…"` atributu DEYİL —
 *   CSP `style-src` atribut formasını bloklayır (bax layihə qeydi).
 */
function syncStickyOffsets(){
  const root = document.getElementById('page-notifs');
  const controls = document.getElementById('notifControls');
  if(!root || !controls) return;
  const topbar = document.querySelector('.app-topbar');
  const bulk = document.getElementById('notifBulkBar');
  const h = node => (node ? Math.round(node.getBoundingClientRect().height) : 0);
  // Topbar mobil görünüşdə gizlənə bilər → 0 çıxır və düstur özü uyğunlaşır.
  root.style.setProperty('--nc-topbar', h(topbar) + 'px');
  root.style.setProperty('--nc-controls-h', h(controls) + 'px');
  if(bulk && !bulk.hidden) root.style.setProperty('--nc-bulk-h', (h(bulk) + 8) + 'px');
}

function initStickyWatcher(){
  const controls = document.getElementById('notifControls');
  if(!controls || stickyRO) return;
  syncStickyOffsets();
  // Sarma (mobil), dil dəyişimi və şrift yüklənməsi hündürlüyü dəyişir —
  // `resize` hadisəsi bunların HEÇ BİRİNİ tutmur, ona görə observer.
  stickyRO = new ResizeObserver(syncStickyOffsets);
  stickyRO.observe(controls);
  const topbar = document.querySelector('.app-topbar');
  if(topbar) stickyRO.observe(topbar);
}

/* ═══════════════════════ SONSUZ SÜRÜŞMƏ ═══════════════════════ */

function initObserver(){
  const sentinel = document.getElementById('notifSentinel');
  if(!sentinel || observer) return;
  observer = new IntersectionObserver(entries => {
    if(!mounted) return;
    if(entries.some(e => e.isIntersecting) && page.hasMore && !page.loading) load({ append: true });
  }, { rootMargin: '600px 0px' });   // ekrandan əvvəl yüklə — "boş uç" görünməsin
  observer.observe(sentinel);
}

/* ═══════════════════════ MOUNT ═══════════════════════ */

export function initNotifs(){
  const markBtn = document.getElementById('markAllReadBtn');
  if(markBtn){
    markBtn.addEventListener('click', async () => {
      // `markAllNotifsRead()` arqument QƏBUL ETMİR — server bütün oxunmamışları
      // özü tapır.
      page.items.forEach(x => { x.read = true; });
      page.pinned.forEach(x => { x.read = true; });
      renderList();
      try{ await markAllNotifsRead(); toast(t('notifs.ok.read')); await refreshStats(); }
      catch(e){ toast(t('notifs.err'), 'err'); reload({ silent: true }); }
    });
  }

  const refreshBtn = document.getElementById('notifRefreshBtn');
  if(refreshBtn){
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('is-spinning');
      // Animasiya `prefers-reduced-motion`-da CSS tərəfindən söndürülür;
      // sinif hər halda vaxtında silinməlidir ki, ilişib qalmasın.
      setTimeout(() => refreshBtn.classList.remove('is-spinning'), prefersReducedMotion() ? 0 : 600);
      reload();
    });
  }

  const setBtn = document.getElementById('notifSettingsBtn');
  if(setBtn) setBtn.addEventListener('click', openSettings);

  const selBtn = document.getElementById('notifSelectBtn');
  if(selBtn) selBtn.addEventListener('click', () => setSelectMode(!selectMode));

  const search = document.getElementById('notifSearch');
  if(search){
    // 280 ms: yazı ritmindən yavaş, amma hiss olunacaq gecikmə yaratmır.
    // Debounce olmasa hər hərf bir `read` sorğusu göndərərdi (limit səbətini yeyir).
    search.addEventListener('input', debounce(() => {
      view.q = search.value.trim();
      applyFilter();
    }, 280));
    search.addEventListener('keydown', e => {
      if(e.key === 'Escape'){ search.value = ''; view.q = ''; applyFilter(); }
    });
  }
}

export function mountNotifs(){
  mounted = true;
  page.ready = false;
  skeleton();
  renderFilters();
  renderBulkBar();
  initObserver();
  initStickyWatcher();
  reload();
  return () => {
    mounted = false;
    closeMenu();
    setSelectMode(false);
    if(observer){ observer.disconnect(); observer = null; }
    if(stickyRO){ stickyRO.disconnect(); stickyRO = null; }
  };
}
