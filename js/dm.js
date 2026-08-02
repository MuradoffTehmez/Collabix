// Şəxsi mesajlar: thread siyahısı, real-time mesajlar, redaktə/silmə, unread badge.
import {
  state, watchThreads, watchDMMessages, sendDM, editDM, deleteDM,
  markThreadRead, pairIdFor, fetchOlderDMMessages,
} from './store.js';
import { createHistory, historyBar, loadOlder } from './history.js';
import { el, clear, avatarNode, nameWithBadge, fmtTime, tsToMillis, isOnline, lastSeenText, bus, emit } from './util.js';
import { toast, confirmDialog, showModal, closeModal, emptyState } from './ui.js';
import { openProfileModal } from './users.js';
import { mentionify, attachMentionAutocomplete } from './mention.js';
import { richContent, attachRichControls, renderGroupedMessages } from './richmsg.js';
import { t } from './i18n.js';
import { iconEdit, iconTrash } from './icons.js';

let threads = [];
let currentPeerUid = null;
let unsubThreadsGlobal = null;
let unsubMsgs = null;
let mounted = false;

const otherUid = t => (t.users || []).find(u => u !== state.authUser.uid);
function isUnread(t){
  const readAt = t.readAt && t.readAt[state.authUser.uid];
  return t.lastFrom && t.lastFrom !== state.authUser.uid && tsToMillis(t.lastAt) > tsToMillis(readAt);
}

// Login boyu aktiv qlobal listener — sidebar badge üçün.
export function subscribeThreads(){
  unsubThreadsGlobal = watchThreads(list => {
    threads = list;
    const unread = threads.filter(isUnread).length;
    emit('dm-unread', { count: unread });
    if(mounted) renderThreadList();
  });
  return () => { if(unsubThreadsGlobal){ unsubThreadsGlobal(); unsubThreadsGlobal = null; } };
}

// Mobil master-detail: söhbətdən istifadəçi siyahısına qayıt.
function closeDmDetail(){
  document.querySelector('#page-dm .chat-wrap')?.classList.remove('detail-open');
}

function renderThreadList(){
  if(!state.authUser) return; // logout keçidində gec gələn event-lərə qarşı
  const list = document.getElementById('dmList');
  clear(list);
  // Thread-i olmayan istifadəçilər də görünsün (yeni söhbət başlatmaq üçün).
  const threadPeers = new Set(threads.map(otherUid));
  const items = [];
  threads.forEach(t => {
    const uid = otherUid(t);
    const u = state.users.get(uid);
    if(!u || u.blocked) return;
    items.push({ u, t, at: tsToMillis(t.lastAt) });
  });
  [...state.users.values()]
    .filter(u => u.uid !== state.authUser.uid && !u.blocked && !threadPeers.has(u.uid))
    .forEach(u => items.push({ u, t: null, at: 0 }));
  items.sort((a, b) => b.at - a.at);

  if(!items.length){ list.append(emptyState('mail', t('chat.empty_dm_users'))); return; }
  items.forEach(({ u, t }) => {
    const item = el('div', { class: 'ch-item' + (currentPeerUid === u.uid ? ' active' : ''), onclick: () => selectPeer(u.uid, true) },
      avatarNode(u, 'avatar', isOnline(u)),
      el('div', { class: 'meta' },
        el('b', {}, u.name),
        el('span', {}, t ? (t.lastFrom === state.authUser.uid ? 'sən: ' : '') + (t.lastMsg || '') : '@' + u.username),
      ),
      t && isUnread(t) ? el('span', { class: 'unread' }, '●') : null,
    );
    list.append(item);
  });
}

// Bubble (ad/avatar/vaxt QRUP başında — renderGroupedMessages); hover-də tam tarix.
function msgBubble(m, pairId){
  const mine = m.fromUid === state.authUser.uid;
  const node = el('div', { class: 'msg ' + (mine ? 'out' : 'in'), title: fmtTime(m.createdAt) },
    richContent(m),
    m.editedAt ? el('span', { class: 'edited-mark' }, ' ' + t('feed.edited')) : null,
  );
  if(mine){
    /* AUDIT-UI: üç qüsur bir yerdə idi —
     *   1) '✎' / '🗑' EMOJİ ikon kimi (`no-emoji-icons`): platformadan asılı
     *      görünür, `currentColor`-a tabe olmur, tema ilə dəyişmir.
     *      Layihədə onsuz da SVG ikon qatı var (`icons.js` §21 şərhi məhz bu
     *      köçürmədən danışır — DM bölməsi qaçırılmışdı).
     *   2) `title` SABİT AZƏRBAYCANCA idi — rus/ingilis dildə tərcümə olunmurdu.
     *   3) Əlçatan ad məzmundan (emoji) gəlirdi → oxucu "✎" deyirdi.
     *      `aria-label` hər üçünü həll edir. */
    node.append(el('div', { class: 'msg-tools' },
      (!m.type || m.type === 'text')
        ? el('button', { type: 'button', title: t('a11y.edit'), 'aria-label': t('a11y.edit'),
            onclick: () => openDMEdit(pairId, m) }, iconEdit())
        : null,
      el('button', { type: 'button', title: t('a11y.delete'), 'aria-label': t('a11y.delete'), onclick: async () => {
        if(await confirmDialog(t('dyn.msg_del_conf'))){
          try{ await deleteDM(pairId, m.id); }catch(e){ toast(t('dyn.del_fail'), 'err'); }
        }
      } }, iconTrash()),
    ));
  }
  return node;
}

function openDMEdit(pairId, m){
  const ta = el('textarea', { maxLength: 2000 });
  ta.value = m.text;
  showModal([
    el('div', { class: 'section-title' }, t('dyn.edit_msg')),
    ta,
    el('button', { class: 'btn-small', onclick: async () => {
      const v = ta.value.trim();
      if(!v) return;
      try{ await editDM(pairId, m.id, v); closeModal(); toast(t('dyn.msg_upd')); }
      catch(e){ toast(t('dyn.upd_fail'), 'err'); }
    } }, t('dyn.save')),
  ]);
}

function selectPeer(uid, openDetail = false){  // openDetail: yalnız klikdən (mobil master-detail)
  currentPeerUid = uid;
  renderThreadList();
  const u = state.users.get(uid);
  const head = document.getElementById('dmHead');
  clear(head);
  // TASK-8 mobil master-detail (chat.js ilə eyni məntiq).
  const back = el('button', { class: 'chat-back', 'aria-label': t('chat.back'), onclick: closeDmDetail }, '‹');
  if(u){
    head.append(
      back,
      nameWithBadge(u), ' ',
      el('span', { class: 'sub' }, '@' + u.username + ' · ' + (lastSeenText(u) || '')),
      el('button', { class: 'view-link', onclick: () => openProfileModal(uid) }, t('usr.view')),
    );
  } else {
    head.append(back);
  }
  if(openDetail) document.querySelector('#page-dm .chat-wrap')?.classList.add('detail-open');
  const pairId = pairIdFor(state.authUser.uid, uid);
  const box = document.getElementById('dmMessages');
  clear(box);
  if(unsubMsgs) unsubMsgs();

  // AUDIT-TASK-8 §8.4 — arxiv tarixçəsi (chat.js ilə EYNİ modul, `js/history.js`).
  // Hər söhbət seçimində sıfırlanır ki, əvvəlki söhbətin mesajları sızmasın.
  const hist = createHistory();
  let liveMsgs = [];

  const paint = () => {
    clear(box);
    box.append(historyBar(hist, doLoad));
    const all = [...hist.older, ...liveMsgs];
    if(!all.length){ box.append(emptyState('mail', t('chat.empty_dm_msgs'))); return; }
    renderGroupedMessages(box, all, {
      uidOf: m => m.fromUid,
      mineOf: m => m.fromUid === state.authUser.uid,
      userOf: m => state.users.get(m.fromUid),
      nameOf: m => (state.users.get(m.fromUid) || {}).name || '',
      onName: uid => openProfileModal(uid),
      bubbleOf: m => msgBubble(m, pairId),
    });
  };
  const doLoad = () => loadOlder(hist, box, ts => fetchOlderDMMessages(pairId, ts), paint);

  unsubMsgs = watchDMMessages(pairId, (msgs, meta) => {
    const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    liveMsgs = msgs;
    hist.liveOldestTs = msgs.length ? msgs[0].createdAt : null;
    if(!hist.older.length && meta && meta.hasMore === false) hist.hasMore = false;
    paint();
    if(wasAtBottom) box.scrollTop = box.scrollHeight;
    markThreadRead(pairId).catch(() => {});
  });
}

/* AUDIT-UI: `chat.js`-dəki ilə eyni qüsur — gedişdə qorunma yox idi, sürətli
 * Enter/klik mesajı iki dəfə göndərirdi (`loading-buttons`). */
let sending = false;
async function send(){
  if(sending || !currentPeerUid) return;
  const input = document.getElementById('dmInput');
  const btn = document.getElementById('dmSendBtn');
  const text = input.value.trim();
  if(!text) return;
  sending = true;
  if(btn) btn.disabled = true;
  input.value = '';
  try{ await sendDM(currentPeerUid, text); }
  catch(e){ console.error(e); toast(t('dyn.msg_send_fail'), 'err'); input.value = text; }
  finally{
    sending = false;
    if(btn) btn.disabled = false;
  }
}

export function initDM(){
  document.getElementById('dmSendBtn').addEventListener('click', send);
  const input = document.getElementById('dmInput');
  input.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.defaultPrevented) send(); });
  attachMentionAutocomplete(input);
  attachRichControls(input.parentElement, payload => {
    if(!currentPeerUid) return Promise.reject(new Error('Söhbət seçilməyib'));
    return sendDM(currentPeerUid, payload);
  });
  // Başqa səhifələrdən "Mesaj yaz" düymələri.
  bus.addEventListener('open-dm', e => {
    currentPeerUid = e.detail.uid;
    emit('nav', { page: 'dm' });
  });
}

export function mountDM(){
  mounted = true;
  closeDmDetail();   // mobildə həmişə söhbət SİYAHISI ilə başla
  renderThreadList();
  const onUsers = () => renderThreadList();
  bus.addEventListener('users-updated', onUsers);
  if(currentPeerUid) selectPeer(currentPeerUid);
  return () => {
    mounted = false;
    bus.removeEventListener('users-updated', onUsers);
    if(unsubMsgs){ unsubMsgs(); unsubMsgs = null; }
  };
}
