// Bildiriş mərkəzi: vaxt qrupları, tip ikonları, filtrlər, oxunmuş/oxunmamış,
// canlı sağ-üst toast (~1.4s). Avatar yoxdursa initials-avatar.
import { state, watchNotifs, markNotifRead, markAllNotifsRead } from './store.js';
import { el, clear, fmtTime, tsToMillis, avatarNode, bus, emit } from './util.js';
import { toast, notifToast, emptyState } from './ui.js';

let notifs = [];
let unsubGlobal = null;
let mounted = false;
let filter = 'all'; // all | unread | tip
let lastToastMs = 0;
let initialLoad = true;

const ICONS = {
  like: '♥', comment: '💬', dm: '✉', task: '☑',
  follow: '➕', mention: '＠', verified: '✓', admin: '⚑',
  // TASK-11 — komanda bildirişləri.
  team_invite: '✉️', team_role: '🎖', team_kick: '🚪', team_task: '☑',
  team_project: '📁', team_project_request: '🙋', team_announcement: '📢',
  team_onboarding: '🚀',
};

// Komanda bildirişləri hansı səhifəyə aparır.
const TEAM_ROUTES = {
  team_invite: 'teams?scope=invites',
  team_role: 'teams',
  team_kick: 'teams',
  team_task: 'teams',
  team_project: 'teams',
  team_project_request: 'teams',
  team_announcement: 'teams',
  team_onboarding: 'teams',
};

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

// Login boyu aktiv — badge + canlı toast.
export function subscribeNotifs(){
  initialLoad = true;
  unsubGlobal = watchNotifs(items => {
    const prevIds = new Set(notifs.map(n => n.id));
    notifs = items;
    emit('notif-unread', { count: items.filter(n => !n.read).length });
    // Canlı toast: ilk yükləmədən sonra gələn yeni oxunmamışlar üçün
    if(!initialLoad){
      const fresh = items.filter(n => !n.read && !prevIds.has(n.id));
      const now = Date.now();
      if(fresh.length && now - lastToastMs > 1200){
        lastToastMs = now;
        const n = fresh[0];
        const from = state.users.get(n.fromUid);
        notifToast(el('div', { class: 'notif-toast', onclick: () => routeNotif(n) },
          avatarNode(from || { name: n.fromName }, 'avatar'),
          el('span', {}, el('b', {}, (ICONS[n.type] || '🔔') + ' ' + (n.fromName || '')), ' ' + (n.text || '')),
        ));
      }
    }
    initialLoad = false;
    if(mounted) renderList();
  });
  return () => { if(unsubGlobal){ unsubGlobal(); unsubGlobal = null; } notifs = []; };
}

/* ---------- səhifə ---------- */
function groupLabel(ms){
  const d = new Date(ms);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if(d >= today) return 'Bu gün';
  if(d >= yesterday) return 'Dünən';
  return 'Daha əvvəl';
}

function renderFilters(){
  const box = document.getElementById('notifFilters');
  clear(box);
  const mk = (val, lbl) => el('button', {
    class: (filter === val ? 'active' : ''),
    onclick: () => { filter = val; renderFilters(); renderList(); },
  }, lbl);
  box.append(mk('all', 'Hamısı'), mk('unread', '● Oxunmamış'));
  ['like', 'comment', 'dm', 'mention', 'follow', 'task'].forEach(tp => box.append(mk(tp, ICONS[tp])));
  // Komanda bildirişləri tək filtrdə toplanır — 8 ayrı düymə filtri
  // oxunmaz edərdi (TASK-11).
  box.append(mk('team', '👥'));
}

function renderList(){
  const box = document.getElementById('notifList');
  clear(box);
  let list = notifs;
  if(filter === 'unread') list = list.filter(n => !n.read);
  else if(filter === 'team') list = list.filter(n => String(n.type || '').startsWith('team_'));
  else if(filter !== 'all') list = list.filter(n => n.type === filter);
  if(!list.length){ box.append(emptyState('bell', 'Bildiriş yoxdur')); return; }
  let lastGroup = '';
  list.forEach(n => {
    const g = groupLabel(tsToMillis(n.createdAt));
    if(g !== lastGroup){
      lastGroup = g;
      box.append(el('div', { class: 'notif-group-lbl' }, g));
    }
    const from = state.users.get(n.fromUid);
    box.append(el('div', {
      class: 'notif-row' + (n.read ? '' : ' unread'),
      onclick: () => routeNotif(n),
    },
      el('span', { class: 'n-ic' }, ICONS[n.type] || '🔔'),
      avatarNode(from || { name: n.fromName }, 'avatar'),
      el('div', { class: 'n-body' }, el('b', {}, n.fromName || 'Kimsə'), ' ' + (n.text || '')),
      el('span', { class: 'n-when' }, fmtTime(n.createdAt)),
    ));
  });
}

export function initNotifs(){
  document.getElementById('markAllReadBtn').addEventListener('click', async () => {
    // `markAllNotifsRead()` arqument QƏBUL ETMİR — server bütün oxunmamışları
    // özü tapır. Əvvəl ona `notifs` ötürülürdü və sükutla atılırdı (checkJs TS2554).
    try{ await markAllNotifsRead(); toast('Hamısı oxunmuş edildi'); }
    catch(e){ toast('Alınmadı', 'err'); }
  });
}

export function mountNotifs(){
  mounted = true;
  renderFilters();
  renderList();
  return () => { mounted = false; };
}
