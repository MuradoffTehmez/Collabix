// Şəxsi mesajlar: thread siyahısı, real-time mesajlar, redaktə/silmə, unread badge.
import {
  state, watchThreads, watchDMMessages, sendDM, editDM, deleteDM,
  markThreadRead, pairIdFor, fetchOlderDMMessages, fetchDMPins, setDMPin,
} from './store.js';
import { createHistory, historyBar, loadOlder } from './history.js';
import { el, clear, avatarNode, nameWithBadge, fmtTime, tsToMillis, isOnline, lastSeenText, bus, emit } from './util.js';
import { toast, confirmDialog, showModal, closeModal, emptyState } from './ui.js';
import { openProfileModal } from './users.js';
import { mentionify, attachMentionAutocomplete } from './mention.js';
import { richContent, attachRichControls, renderGroupedMessages } from './richmsg.js';
import { t } from './i18n.js';
import { iconEdit, iconTrash, paintIcons } from './icons.js';
import {
  conversationRow, buildChatHead, detailsToggleButton, setDetailsOpen,
  enhanceComposer, renderDetailsPanel, previewOf, shortTime, askAI,
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
  items.forEach(({ u, t: th }) => {
    const unread = th && isUnread(th);
    const preview = th
      ? (th.lastFrom === state.authUser.uid ? t('chat.you') : '') + (th.lastMsg || '')
      : '@' + u.username;
    list.append(conversationRow({
      avatar: avatarNode(u, 'avatar', isOnline(u)),
      name: u.name,
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

// Bubble (ad/avatar/vaxt QRUP başında — renderGroupedMessages); hover-də tam tarix.
function msgBubble(m, pairId){
  const mine = m.fromUid === state.authUser.uid;
  const node = el('div', {
    class: 'msg ' + (mine ? 'out' : 'in') + (m.pinnedAt ? ' pinned' : ''),
    title: fmtTime(m.createdAt),
    dataset: { mid: m.id },        // paneldəki axtarışdan tullanmaq üçün lövbər
  },
    richContent(m),
    m.editedAt ? el('span', { class: 'edited-mark' }, ' ' + t('feed.edited')) : null,
  );
  /* Sabitləmə DM-də HƏR İKİ tərəf üçündür (şəxsi söhbətdə moderasiya yoxdur),
   * ona görə `mine` şərtindən KƏNARDA — qarşı tərəfin mesajını da sabitləmək
   * mümkündür (əslində ən çox lazım olan hal budur). */
  const pinBtn = el('button', {
    type: 'button',
    title: m.pinnedAt ? t('chat.unpin') : t('chat.pin'),
    'aria-label': m.pinnedAt ? t('chat.unpin') : t('chat.pin'),
    'aria-pressed': String(!!m.pinnedAt),
    onclick: async () => {
      try{ await setDMPin(pairId, m.id, !m.pinnedAt); await loadPins(pairId); }
      catch(e){ toast(e?.message || t('chat.pin_fail'), 'err'); }
    },
  }, el('span', { class: 'ic', 'data-icon': 'pin', 'data-icon-size': '13' }));

  if(!mine){
    const tools = el('div', { class: 'msg-tools' }, pinBtn);
    node.append(tools);
    paintIcons(tools);
  }
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
  strip.append(
    el('span', { class: 'ic', 'data-icon': 'pin', 'data-icon-size': '14' }),
    el('span', { class: 'pin-text' }, previewOf(pins[0])),
    el('button', {
      type: 'button', class: 'cmp-btn',
      onclick: () => setDetailsOpen(document.getElementById('dmWrap'), true),
    }, pins.length > 1 ? `+${pins.length - 1}` : t('cd.pins')),
  );
  paintIcons(strip);
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
    onSearch: q => lastMsgs
      .filter(m => (m.text || '').toLowerCase().includes(q.toLowerCase()))
      .map(m => ({ who: (state.users.get(m.fromUid) || {}).name || '', text: m.text, id: m.id })),
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
        aiSummary = await askAI(`Aşağıdakı söhbəti 3-5 cümlə ilə xülasə et. Kim nə dedi — qısa və konkret:\n\n${ctx}`);
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
  const actions = el('span', { class: 'ch-head-actions' });
  if(u){
    actions.append(el('button', {
      type: 'button', class: 'ch-icon-btn', 'aria-label': t('usr.view'), title: t('usr.view'),
      onclick: () => openProfileModal(uid),
    }, el('span', { class: 'ic', 'data-icon': 'profile', 'data-icon-size': '18' })));
  }
  actions.append(detailsToggleButton(wrap, 'dmDetails'));
  buildChatHead(document.getElementById('dmHead'), {
    title: u ? (u.name || u.username) : '',
    sub: u ? (on ? t('cd.online') : (lastSeenText(u) || '@' + u.username)) : '',
    subOnline: on,
    onBack: closeDmDetail,
    detailsBtn: actions,
  });
  // Söhbət dəyişdi → əvvəlkinin sabitlənmişləri/xülasəsi qalmamalıdır.
  pins = [];
  aiSummary = null;
  loadPins(pairId);
  if(openDetail) document.querySelector('#page-dm .chat-wrap')?.classList.add('detail-open');
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
    lastMsgs = all;                       // paneldəki lokal axtarış üçün
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
  /* ⚠ SIRA VACİBDİR (chat.js ilə eyni): `enhanceComposer` girişi yeni
   *   `.cmp-shell` qabığına köçürür, ona görə rich-control düymələri
   *   ONDAN SONRA və alət sətrinə əlavə olunmalıdır. */
  const enhanced = enhanceComposer(document.getElementById('dmComposer'), {
    getContext: () => lastMsgs.slice(-40)
      .map(m => `${(state.users.get(m.fromUid) || {}).name || ''}: ${m.text || ''}`).join('\n'),
    onSummary: s => { aiSummary = s; paintDetails(); setDetailsOpen(document.getElementById('dmWrap'), true); },
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
