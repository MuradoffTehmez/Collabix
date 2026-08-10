// Şəxsi mesajlar: thread siyahısı, real-time mesajlar, redaktə/silmə, unread badge.
import {
  state, watchThreads, watchDMMessages, sendDM, editDM, deleteDM,
  markThreadRead, pairIdFor, fetchOlderDMMessages, fetchDMPins, setDMPin,
  setMessageReaction, setMessageBookmark, forwardMessage, convPrefs, setConvPref,
} from './store.js';
import { createHistory, historyBar, loadOlder } from './history.js';
import { el, clear, avatarNode, tsToMillis, isOnline, lastSeenText, bus, emit } from './util.js';
import { toast, confirmDialog, showModal, closeModal, emptyState } from './ui.js';

import { attachMentionAutocomplete } from './mention.js';
import { attachRichControls, sendFiles } from './richmsg.js';
import { renderMessageList, bindMessagePopClosers, previewText } from './chat-message.js';
import { t } from './i18n.js';
import { paintIcons } from './icons.js';
import {
  conversationRow, buildChatHead, detailsToggleButton, setDetailsOpen,
  enhanceComposer, renderDetailsPanel, shortTime, askAI, headerActions, bindListKeyboardNav,
  // ⚠ `previewText` BURADAN alınmır — o, `chat-message.js`-dədir (yuxarıda
  //   idxal olunub). Buradakı analoq `previewOf`-dur; ikisini qarışdırmaq
  //   təkrar bəyan xətası verirdi.
  pinBanner, matchesFilter, collectShared, listSkeleton, messagesSkeleton,
} from './chat-ui.js';

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

  /* ⚠ Bu `forEach`-də parametr adı QƏSDƏN `th`-dir, `t` DEYİL: modulun
   *   yuxarısında `t` TƏRCÜMƏ funksiyasıdır və köhnə kodda `({ u, t })`
   *   destrukturu onu bu blok daxilində KÖLGƏLƏYİRDİ — ona görə burada
   *   tərcümə çağırmaq mümkün deyildi və "sən: " sabit azərbaycanca qalmışdı. */
  bindListKeyboardNav(list);
  // Bax `chat.js`-dəki eyni şərh: ilk yüklənmədə skeleton, boş ekran yox.
  if(!items.length && !threads.length){ list.append(listSkeleton(5)); return; }
  const prefs = convPrefs();
  // Sabitlənmişlər yuxarıda (otaq siyahısı ilə eyni qayda).
  items.sort((a, b) => {
    const pa = prefs.pinned.includes(pairIdFor(state.authUser.uid, a.u.uid)) ? 1 : 0;
    const pb = prefs.pinned.includes(pairIdFor(state.authUser.uid, b.u.uid)) ? 1 : 0;
    return pb - pa;
  });
  items.forEach(({ u, t: th }) => {
    const unread = th && isUnread(th);
    const pairId = pairIdFor(state.authUser.uid, u.uid);
    const preview = th
      ? (th.lastFrom === state.authUser.uid ? t('chat.you') : '') + (th.lastMsg || '')
      : t('chat.no_messages_yet');
    const on = isOnline(u);
    list.append(conversationRow({
      avatar: avatarNode(u, 'avatar', on),
      name: u.name,
      username: u.username,
      status: on ? t('cd.online') : (lastSeenText(u) || ''),
      online: on,
      pinned: prefs.pinned.includes(pairId),
      muted: prefs.muted.includes(pairId),
      preview,
      time: th ? shortTime(tsToMillis(th.lastAt)) : '',
      // Server oxunmamış SAYINI vermir (yalnız `readAt` damğası) — ona görə
      // nişan rəqəmsiz NÖQTƏdir. Say üçün ayrıca aqreqat sorğusu lazımdır.
      badge: unread ? true : 0,
      unread,
      active: currentPeerUid === u.uid,
      ariaLabel: u.name + (unread ? ' — ' + t('chat.unread_any') : ''),
      onSelect: () => selectPeer(u.uid, true),
    }));
  });
}

/* REDİZAYN: DM-in öz balon nüsxəsi SİLİNDİ — balon, alət paneli, reaksiya
 * sətri və cavab sitatı artıq `chat-message.js`-dədir və otaq ilə ORTAQDIR.
 * Əvvəl iki nüsxə vardı və düzəlişlər birində unudulurdu (audit bunu DM-də
 * emoji ikonlar və tərcümə olunmayan `title`-lar şəklində tapmışdı). */
function dmCtx(pairId){
  return {
    uidOf: m => m.fromUid,
    isMine: m => m.fromUid === state.authUser.uid,
    userOf: m => state.users.get(m.fromUid),
    nameOf: m => (state.users.get(m.fromUid) || {}).name || '',
    onName: uid => import('./users.js').then(m => m.openProfileModal(uid)),
    isAdmin: state.isAdmin,
    // ⚠ DM-də sabitləmə HƏR İKİ tərəf üçündür — şəxsi söhbətdə moderasiya
    //   anlayışı yoxdur (server də eyni qaydadadır).
    canPin: true,
    toast,
    onReact: async (m, type, on) => {
      try{ await setMessageReaction('dm', pairId, m.id, type, on); }
      catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
    },
    onReply: m => { replyTarget = m; paintReplyBar(); },
    onEdit: m => openDMEdit(pairId, m),
    onDelete: async m => {
      if(await confirmDialog(t('dyn.msg_del_conf'))){
        try{ await deleteDM(pairId, m.id); }catch(e){ toast(t('dyn.del_fail'), 'err'); }
      }
    },
    onPin: async (m, on) => {
      try{ await setDMPin(pairId, m.id, on); await loadPins(pairId); }
      catch(e){ toast(e?.message || t('chat.pin_fail'), 'err'); }
    },
    onBookmark: async (m, on) => {
      try{ await setMessageBookmark('dm', pairId, m.id, on); m.bookmarked = on; paintNow(); }
      catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
    },
    onCopyLink: async m => {
      const url = `${location.origin}/#dm?peer=${encodeURIComponent(currentPeerUid)}&m=${encodeURIComponent(m.id)}`;
      try{ await navigator.clipboard.writeText(url); toast(t('msg.link_copied')); }
      catch(e){ toast(t('dyn.copy_fail'), 'err'); }
    },
    onForward: m => openForwardPicker(m, 'dm', pairId),
    onJump: id => {
      const node = document.querySelector(`[data-mid="${id}"]`);
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      node?.classList.add('msg-flash');
      setTimeout(() => node?.classList.remove('msg-flash'), 1200);
    },
  };
}

let replyTarget = null;
let paintNow = () => {};

function paintReplyBar(){
  const host = document.getElementById('dmReplyBar');
  if(!host) return;
  clear(host);
  if(!replyTarget){ host.hidden = true; return; }
  host.hidden = false;
  host.append(
    el('span', { class: 'ic', 'data-icon': 'message', 'data-icon-size': '14' }),
    el('div', { class: 'rb-body' },
      el('span', { class: 'rb-who' },
        t('msg.replying_to') + ' ' + ((state.users.get(replyTarget.fromUid) || {}).name || '')),
      el('span', { class: 'rb-txt' }, previewText(replyTarget)),
    ),
    el('button', {
      type: 'button', class: 'ch-icon-btn', 'aria-label': t('msg.cancel_reply'), title: t('msg.cancel_reply'),
      onclick: () => { replyTarget = null; paintReplyBar(); },
    }, el('span', { class: 'ic', 'data-icon': 'x', 'data-icon-size': '14' })),
  );
  paintIcons(host);
}

/** Yönləndirmə seçicisi — DM siyahısındakı söhbətlərə. */
function openForwardPicker(m, fromScope, fromId){
  const box = el('div', { class: 'fwd-list' });
  threads.forEach(th => {
    const uid = otherUid(th);
    const u = state.users.get(uid);
    if(!u) return;
    box.append(el('button', {
      type: 'button', class: 'fwd-item',
      onclick: async () => {
        try{
          await forwardMessage({
            fromScope, fromId, toScope: 'dm',
            toId: pairIdFor(state.authUser.uid, uid), messageId: m.id,
          });
          closeModal(); toast(t('msg.forwarded'));
        }catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
      },
    }, avatarNode(u, 'avatar avatar-mini'), el('span', {}, u.name)));
  });
  showModal([
    el('div', { class: 'section-title' }, t('msg.forward_to')),
    el('p', { class: 'c-report-quote' }, previewText(m)),
    box,
  ]);
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

/* AUDIT-UI (chat.js ilə eyni): DM-də yeni mesaj ekran oxuyucusuna elan olunur.
 * `#dmMessages`-in özünə `aria-live` QOYULMUR — `paint()` siyahını hər dəfə
 * tam yenidən qurur və bütün tarixçə təkrar oxunardı. */
let lastAnnouncedId = null;
function announceLatest(msgs){
  const live = document.getElementById('dmLive');
  if(!live || !msgs || !msgs.length) return;
  const m = msgs[msgs.length - 1];
  if(!m || m.id === lastAnnouncedId) return;
  lastAnnouncedId = m.id;
  if(m.fromUid === state.authUser.uid) return;   // öz mesajını bilirsən
  live.textContent = `${(state.users.get(m.fromUid) || {}).name || ''}: ${m.text || ''}`.trim();
}

/* ══ Sabitlənmiş mesajlar + detallar paneli (chat.js ilə eyni model) ══════ */
let pins = [];
let aiSummary = null;
let lastMsgs = [];
// Banner-də göstərilən sabitlənmişin indeksi (söhbət dəyişəndə sıfırlanır).
let pinIndex = 0;

async function loadPins(pairId){
  try{
    const r = await fetchDMPins(pairId);
    // Söhbət bu arada dəyişə bilər — gec gələn cavab yenisini əzməsin.
    if(pairId !== pairIdFor(state.authUser.uid, currentPeerUid)) return;
    pins = r.pins || [];
  }catch(e){ pins = []; }
  paintPinStrip();
  paintDetails();
}

function paintPinStrip(){
  const strip = document.getElementById('dmPinStrip');
  if(!strip) return;
  clear(strip);
  if(!pins.length){ strip.hidden = true; return; }
  strip.hidden = false;
  const pairId = pairIdFor(state.authUser.uid, currentPeerUid);
  strip.append(pinBanner({
    pins,
    index: pinIndex,
    onJump: (cur) => {
      dmCtx(pairId).onJump?.(cur.id);
      pinIndex += 1;                 // növbəti sabitlənmişə keç
      paintPinStrip();
    },
    onShowAll: () => setDetailsOpen(document.getElementById('dmWrap'), true),
  }));
}

function paintDetails(){
  const panel = document.getElementById('dmDetails');
  const wrap = document.getElementById('dmWrap');
  if(!panel || !wrap) return;
  const pairId = pairIdFor(state.authUser.uid, currentPeerUid);
  // DM-də iştirakçılar dəqiq bilinir: iki nəfər.
  const peer = state.users.get(currentPeerUid);
  const people = [state.users.get(state.authUser.uid), peer].filter(Boolean);
  renderDetailsPanel(panel, wrap, {
    titleId: 'dmDetailsTitle',
    people,
    pins,
    summary: aiSummary,
    shared: collectShared(lastMsgs),
    // Bax `chat.js`-dəki eyni şərh: həm mətn, həm tip üzrə süzülür.
    onSearch: (q, filter) => lastMsgs
      .filter(m => matchesFilter(m, filter))
      .filter(m => !q || (m.text || '').toLowerCase().includes(q.toLowerCase())
        || (m.fileName || '').toLowerCase().includes(q.toLowerCase()))
      .map(m => ({
        who: (state.users.get(m.fromUid) || {}).name || '', id: m.id,
        kind: m.type || 'text',
        text: m.text || previewText(m),
      })),
    onJump: h => {
      const node = document.querySelector(`[data-mid="${h.id}"]`);
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      node?.classList.add('msg-flash');
      setTimeout(() => node?.classList.remove('msg-flash'), 1200);
    },
    // DM-də HƏR İKİ tərəf sabitləyə/ləğv edə bilər — şəxsi söhbətdir.
    onUnpin: async p => {
      try{ await setDMPin(pairId, p.id, false); await loadPins(pairId); }
      catch(e){ toast(t('chat.pin_fail'), 'err'); }
    },
    onSummarize: async box => {
      clear(box);
      box.append(el('div', { class: 'cd-empty' }, t('ai.working')));
      try{
        const ctx = lastMsgs.slice(-40)
          .map(m => `${(state.users.get(m.fromUid) || {}).name || ''}: ${m.text || ''}`).join('\n');
        aiSummary = await askAI(t('chat.ai_summary_prompt', { ctx }));
        paintDetails();
      }catch(e){
        clear(box);
        box.append(el('div', { class: 'cd-empty' }, e?.message || t('ai.fail')));
      }
    },
  });
}

function selectPeer(uid, openDetail = false){  // openDetail: yalnız klikdən (mobil master-detail)
  currentPeerUid = uid;
  renderThreadList();
  const u = state.users.get(uid);
  const wrap = document.getElementById('dmWrap');
  const pairId = pairIdFor(state.authUser.uid, uid);
  // TASK-8 mobil master-detail (chat.js ilə eyni məntiq) — indi ortaq
  // `buildChatHead` ilə: başlıq quruluşu iki ekranda fərqlənməsin.
  const on = u ? isOnline(u) : false;
  const prefs = convPrefs();
  const isPinned = prefs.pinned.includes(pairId);
  const isMuted = prefs.muted.includes(pairId);
  buildChatHead(document.getElementById('dmHead'), {
    user: u,                              // zəngin variant: avatar+təsdiq+səviyyə+rol
    title: u ? (u.name || u.username) : '',
    sub: u ? (on ? t('cd.online') : (lastSeenText(u) || '')) : '',
    subOnline: on,
    onBack: closeDmDetail,
    actions: headerActions({
      // Axtarış detallar panelini açıb axtarış sahəsinə fokuslanır —
      // ayrıca axtarış qutusu qurmaq eyni funksiyanı ikiləşdirərdi.
      onSearch: () => {
        setDetailsOpen(wrap, true);
        setTimeout(() => document.querySelector('#dmDetails .cd-search')?.focus(), 60);
      },
      onPin: async () => {
        try{ await setConvPref('pinned', pairId, !isPinned); renderThreadList(); selectPeer(uid); }
        catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
      },
      pinned: isPinned,
      detailsBtn: detailsToggleButton(wrap, 'dmDetails', () => paintDetails()),
      menuItems: [
        { icon: 'profile', label: t('usr.view'), onClick: () => import('./users.js').then(m => m.openProfileModal(uid)) },
        {
          icon: isMuted ? 'bell' : 'bell-off',
          label: isMuted ? t('conv.unmute') : t('conv.mute'),
          onClick: async () => {
            try{ await setConvPref('muted', pairId, !isMuted); renderThreadList(); selectPeer(uid); }
            catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
          },
        },
      ],
    }),
  });
  // Söhbət dəyişdi → əvvəlkinin sabitlənmişləri/xülasəsi qalmamalıdır.
  pins = [];
  pinIndex = 0;
  aiSummary = null;
  loadPins(pairId);
  if(openDetail) document.querySelector('#page-dm .chat-wrap')?.classList.add('detail-open');
  const box = document.getElementById('dmMessages');
  clear(box);
  box.append(messagesSkeleton(6));
  if(unsubMsgs) unsubMsgs();

  // AUDIT-TASK-8 §8.4 — arxiv tarixçəsi (chat.js ilə EYNİ modul, `js/history.js`).
  // Hər söhbət seçimində sıfırlanır ki, əvvəlki söhbətin mesajları sızmasın.
  const hist = createHistory();
  let liveMsgs = [];

  const paint = () => {
    clear(box);
    box.append(historyBar(hist, doLoad));
    const all = [...hist.older, ...liveMsgs];
    lastMsgs = all;                       // paneldəki lokal axtarış üçün
    // Bax `chat.js`-dəki eyni şərh: açıq panel yeni mesajla yenilənməlidir.
    if(document.getElementById('dmWrap')?.dataset.details === 'open') paintDetails();
    if(!all.length){ box.append(emptyState('mail', t('chat.empty_dm_msgs'))); return; }
    // ⚠ `historyBar` yuxarıda əlavə olunub, `renderMessageList` isə `clear(box)`
    //   edir — zolaq render-DƏN SONRA yenidən başa qoyulur.
    const bar = box.firstElementChild;
    renderMessageList(box, all, dmCtx(pairId));
    if(bar) box.prepend(bar);
  };
  paintNow = paint;
  const doLoad = () => loadOlder(hist, box, ts => fetchOlderDMMessages(pairId, ts), paint);

  unsubMsgs = watchDMMessages(pairId, (msgs, meta) => {
    const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    liveMsgs = msgs;
    hist.liveOldestTs = msgs.length ? msgs[0].createdAt : null;
    if(!hist.older.length && meta && meta.hasMore === false) hist.hasMore = false;
    paint();
    announceLatest(msgs);
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
  const payload = replyTarget ? { type: 'text', text, replyTo: replyTarget.id } : text;
  try{
    await sendDM(currentPeerUid, payload);
    replyTarget = null;
    paintReplyBar();
  }
  catch(e){ console.error(e); toast(t('dyn.msg_send_fail'), 'err'); input.value = text; }
  finally{
    sending = false;
    if(btn) btn.disabled = false;
  }
}

export function initDM(){
  document.getElementById('dmSendBtn').addEventListener('click', send);
  const input = document.getElementById('dmInput');
  // Bax `chat.js`-dəki eyni şərh: Enter göndərir, Shift+Enter yeni sətir.
  input.addEventListener('keydown', e => {
    if(e.key !== 'Enter' || e.shiftKey || e.defaultPrevented) return;
    e.preventDefault();
    send();
  });
  attachMentionAutocomplete(input);
  bindMessagePopClosers();
  /* ⚠ SIRA VACİBDİR (chat.js ilə eyni): `enhanceComposer` girişi yeni
   *   `.cmp-shell` qabığına köçürür, ona görə rich-control düymələri
   *   ONDAN SONRA və alət sətrinə əlavə olunmalıdır. */
  const enhanced = enhanceComposer(document.getElementById('dmComposer'), {
    getContext: () => lastMsgs.slice(-40)
      .map(m => `${(state.users.get(m.fromUid) || {}).name || ''}: ${m.text || ''}`).join('\n'),
    onSummary: s => { aiSummary = s; paintDetails(); setDetailsOpen(document.getElementById('dmWrap'), true); },
    onFiles: files => sendFiles(files, payload => {
      if(!currentPeerUid) return Promise.reject(new Error('Söhbət seçilməyib'));
      return sendDM(currentPeerUid, payload);
    }),
  });
  attachRichControls(enhanced ? enhanced.tools : input.parentElement, payload => {
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
