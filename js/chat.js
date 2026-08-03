// Otaqlar (ümumi + mövzu otaqları): real-time mesajlar, redaktə/silmə.
import {
  state, watchRooms, watchRoomMessages, sendRoomMessage, editRoomMessage, deleteRoomMessage, deleteRoom,
  fetchOlderRoomMessages, fetchRoomPins, setRoomPin,
  setMessageReaction, setMessageBookmark, forwardMessage, convPrefs, setConvPref,
  setRoomIcon,
} from './store.js';
import { createHistory, historyBar, loadOlder } from './history.js';
import { el, clear, emit, isOnline, avatarNode } from './util.js';
import { toast, confirmDialog, showModal, closeModal, emptyState } from './ui.js';
import { openProfileModal } from './users.js';
import { attachMentionAutocomplete } from './mention.js';
import { attachRichControls, sendFiles } from './richmsg.js';
import { renderMessageList, bindMessagePopClosers, previewText } from './chat-message.js';
import { t } from './i18n.js';
import { iconTrash } from './icons.js';
import { paintIcons } from './icons.js';
import {
  conversationRow, buildChatHead, detailsToggleButton, setDetailsOpen,
  enhanceComposer, renderDetailsPanel, askAI, headerActions, bindListKeyboardNav,
  pinBanner,
} from './chat-ui.js';

let rooms = [];
let currentRoomId = 'general';
let unsubRooms = null;
let unsubMsgs = null;

/* ---------- realtime (RoomDO / WebSocket) ---------- */
// WS yalnız "siqnal" daşıyır: 'refresh' → dərhal refetch (məzmun D1-dən, polling
// fallback qalır); 'typing' → göstərici. WS düşsə backoff ilə yenidən qoşulur.
let roomWs = null;
let roomWsFor = null;
let lastTypingSent = 0;
let typingHideTimer = null;
const wsProto = () => (location.protocol === 'https:' ? 'wss:' : 'ws:');

// Server tərəfli avtorizasiya rəddi — `worker/room-do.ts` CLOSE_UNAUTHORIZED.
// 4000-4999 diapazonu tətbiqə aiddir və brauzer onu olduğu kimi ötürür.
const WS_UNAUTHORIZED = 4403;

function closeRoomWs(){
  const ws = roomWs;
  roomWs = null;
  if(ws){ try{ ws.onclose = null; ws.close(); }catch(e){} }
}
function connectRoomWs(roomId){
  closeRoomWs();
  roomWsFor = roomId;
  let ws;
  try{ ws = new WebSocket(`${wsProto()}//${location.host}/api/rooms/${roomId}/ws`); }
  catch(e){ return; }   // WS mümkün deyilsə poll fallback işini görür
  roomWs = ws;
  ws.addEventListener('message', ev => {
    if(roomWsFor !== roomId) return;
    let d; try{ d = JSON.parse(ev.data); }catch(e){ return; }

    if(d.t === 'msg'){
      // TASK-8 / Bənd 13 — mesaj birbaşa DO-dan gəlir, D1 yazısını GÖZLƏMİR.
      // `ack` gözləyən optimistik sətir varsa təsdiqlənir; yoxsa (başqasının
      // mesajı) sadəcə refetch tetiklənir və D1-dən tam sətir gəlir.
      if(d.cid) settle(d.cid, true);
      emit('refresh-msgs-' + roomId);
    }
    else if(d.t === 'ack'){
      // Təkrar göndərişin idempotent cavabı — mesaj serverdə artıq var.
      settle(d.cid, true);
    }
    else if(d.t === 'error'){
      // Server mesajı AÇIQ ŞƏKİLDƏ rədd etdi (limit / boş / D1 yazısı sınıb).
      // `true` ilə bağlanır: REST-ə düşmək ya dublikat yaradar, ya da DO-nun
      // rate-limit-ini yan keçərdi.
      if(d.cid) settle(d.cid, true);
      if(d.code === 'rate_limit') toast(t('chat.rate_limit'));
      emit('refresh-msgs-' + roomId);
    }
    else if(d.t === 'refresh') emit('refresh-msgs-' + roomId);
    else if(d.t === 'typing') showTyping(d.name);
  });
  ws.addEventListener('close', ev => {
    if(roomWs !== ws) return;                 // artıq başqa bağlantı aktivdir
    roomWs = null;
    // 🔴 AUDIT-TASK-9 / C-2 client tərəfi: 4403 = server avtorizasiyanı ləğv
    // etdi (komandadan çıxarıldın / bloklandın / sessiya ləğv olundu).
    // Yenidən qoşulmaq MƏNASIZDIR — upgrade onsuz da 403 verəcək — və hər
    // 3 saniyədə bir DO-ya yük, mobil cihazda isə batareya sərfi yaradar.
    // Bu, Task 4 §7/1-dəki dərslə eyni sinifdir (polling 429-da dayanmalıdır).
    if(ev.code === WS_UNAUTHORIZED){
      roomWsFor = null;                       // reconnect döngəsini dayandır
      toast(t('chat.ws_unauthorized'), 'warn');
      emit('refresh-msgs-' + roomId);         // REST oxusu da 403 verib UI-ı düzəldəcək
      return;
    }
    setTimeout(() => { if(roomWsFor === roomId && !roomWs) connectRoomWs(roomId); }, 3000);
  });
  ws.addEventListener('error', () => { try{ ws.close(); }catch(e){} });
}
function getTypingEl(){
  let n = document.getElementById('chatTyping');
  if(!n){
    const box = document.getElementById('chatMessages');
    n = el('div', { id: 'chatTyping', class: 'typing-indicator' });
    box.insertAdjacentElement('afterend', n);
  }
  return n;
}
function showTyping(name){
  const n = getTypingEl();
  n.textContent = (name || t('chat.someone')) + ' ' + t('chat.typing');
  n.classList.add('show');
  clearTimeout(typingHideTimer);
  typingHideTimer = setTimeout(() => n.classList.remove('show'), 3500);
}
function maybeSendTyping(){
  const nowMs = Date.now();
  if(roomWs && roomWs.readyState === 1 && nowMs - lastTypingSent > 2000){
    lastTypingSent = nowMs;
    try{ roomWs.send(JSON.stringify({ t: 'typing' })); }catch(e){}
  }
}

/* ---------- mesaj göndərmə: WS → DO (TASK-8 / Bənd 13) ----------
   Köhnə axın: REST → Worker → D1 yazısı → RPC → DO → WS. İstifadəçi öz
   mesajını görmək üçün D1 yazısını gözləyirdi.
   Yeni axın: WS → DO → dərhal broadcast → arxada asinxron D1.

   REST yolu SİLİNMİR: WS qapalıdırsa (qoşulur, düşüb, brauzer bloklayıb)
   avtomatik ona düşürük — mesaj heç vaxt "yoxa çıxmır". */
// cid → { resolve, timer }. `resolve(true)` = "server cavab verdi, REST-ə
// düşmə"; `resolve(false)` = "heç bir cavab yoxdur, fallback et".
const pending = new Map();
const ACK_TIMEOUT = 4000;

function settle(cid, handled){
  const p = pending.get(cid);
  if(!p) return;
  clearTimeout(p.timer);
  pending.delete(cid);
  p.resolve(handled);
}

async function sendViaSocket(payload){
  if(!roomWs || roomWs.readyState !== 1) return false;
  const cid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random())
    .replace(/[^a-z0-9]/gi, '').slice(0, 32);
  const body = typeof payload === 'string' ? { type: 'text', text: payload } : payload;
  try{
    roomWs.send(JSON.stringify({ t: 'send', cid, ...body }));
  }catch(e){ return false; }

  return new Promise(resolve => {
    // Taymer YALNIZ "heç bir cavab gəlmədi" halını tutur: WS açıq görünür,
    // amma paket itib. Onsuz mesaj səssizcə yox olardı.
    const timer = setTimeout(() => {
      pending.delete(cid);
      resolve(false);
    }, ACK_TIMEOUT);
    pending.set(cid, { resolve, timer });
  });
}

// Mobil master-detail: mesaj sahəsindən otaq siyahısına qayıt.
function closeRoomDetail(){
  document.querySelector('#page-chat .chat-wrap')?.classList.remove('detail-open');
}

/* Siyahı filtri — `.cl-search` sahəsindən. Debounce LAZIM DEYİL: otaq sayı
   onlarladır və filtr sinxron massiv əməliyyatıdır. */
let roomFilter = '';

function renderRoomList(){
  const list = document.getElementById('roomList');
  clear(list);

  // Axtarış sahəsi HƏR render-də yenidən qurulur, ona görə dəyəri
  // `roomFilter`-dən bərpa olunur (əks halda yazarkən itərdi).
  const search = el('input', {
    class: 'cl-search', type: 'search', value: roomFilter,
    placeholder: t('chat.search_conv'), 'aria-label': t('chat.search_conv'),
  });
  search.addEventListener('input', () => {
    roomFilter = search.value;
    renderRoomList();
    // Fokus yenidən qurulmuş sahəyə qaytarılır — yazmaq kəsilməsin.
    const nx = document.querySelector('#roomList .cl-search');
    if(nx){ nx.focus(); nx.setSelectionRange(nx.value.length, nx.value.length); }
  });
  list.append(el('div', { class: 'cl-head' }, search));

  bindListKeyboardNav(list);
  const prefs = convPrefs();
  const q = roomFilter.trim().toLowerCase();
  const shown = rooms
    .filter(r => !q || (r.name || '').toLowerCase().includes(q))
    // Sabitlənmiş söhbətlər HƏMİŞƏ yuxarıda — göstərici tək başına kifayət
    // etmir, istifadəçi onları siyahının başında gözləyir.
    .slice()
    .sort((a, b) => (prefs.pinned.includes(b.id) ? 1 : 0) - (prefs.pinned.includes(a.id) ? 1 : 0));
  if(!shown.length){ list.append(el('div', { class: 'cd-empty' }, t('cd.no_hits'))); return; }

  shown.forEach(r => {
    /* ⚠ Sətir artıq `<button>`-dur (klaviatura ilə seçim üçün), ona görə
     *   silmə düyməsi ONUN İÇİNDƏ ola BİLMƏZ — iç-içə `<button>` etibarsız
     *   HTML-dir və brauzerlər onu gözlənilməz şəkildə düzəldir.
     *   Həll: `.ch-row` sarğısı, silmə düyməsi QARDAŞ element kimi. */
    const row = el('div', { class: 'ch-row' });
    row.append(conversationRow({
      /* Otaq avatarı: yüklənmiş ikon varsa o, yoxsa otaq adından DETERMİNİST
       * inisial avatarı (`avatarNode` psevdo-istifadəçi obyekti ilə işləyir).
       * `uid: r.id` — çalar otağa bağlı sabit qalsın deyə. */
      avatar: avatarNode({ uid: r.id, name: r.name, photoURL: r.iconUrl }, 'avatar'),
      name: r.name,
      username: r.id,                    // otaqda "username" rolunu slug oynayır
      preview: r.id === 'general' ? t('chat.room_sub') : '',
      time: '',
      pinned: prefs.pinned.includes(r.id),
      muted: prefs.muted.includes(r.id),
      active: r.id === currentRoomId,
      onSelect: () => selectRoom(r.id, true),
    }));
    if(state.isAdmin && r.id !== 'general'){
      row.append(el('button', {
        type: 'button', class: 'ch-del',
        'aria-label': t('a11y.delete') + ' — ' + r.name, title: t('a11y.delete'),
        onclick: async e => {
          e.stopPropagation();
          if(await confirmDialog(t('dyn.room_del_conf').replace('"${r.name}"', `"${r.name}"`))){
            try{ await deleteRoom(r.id); toast(t('dyn.room_del')); }catch(err){ toast(t('dyn.del_fail'), 'err'); }
          }
        },
      }, iconTrash()));
    }
    list.append(row);
  });
}

/* AUDIT/REDİZAYN: `msgBubble` SİLİNDİ — balon, alət paneli, reaksiya sətri və
 * cavab sitatı artıq `chat-message.js`-dədir və otaq/DM ORTAQ işlədir.
 * Əvvəl hər iki fayl öz nüsxəsini saxlayırdı və düzəlişlər birində unudulurdu. */

/* ── Cavab zolağı (kompozitorun üstündə) ─────────────────────────────────
 * Hansı mesaja cavab yazıldığını GÖSTƏRİR — əks halda istifadəçi göndərəndən
 * sonra kontekstin bağlandığını yalnız nəticədə görərdi. */
function paintReplyBar(){
  const host = document.getElementById('chatReplyBar');
  if(!host) return;
  clear(host);
  if(!replyTarget){ host.hidden = true; return; }
  host.hidden = false;
  host.append(
    el('span', { class: 'ic', 'data-icon': 'message', 'data-icon-size': '14' }),
    el('div', { class: 'rb-body' },
      el('span', { class: 'rb-who' }, t('msg.replying_to') + ' ' + (replyTarget.authorName || '')),
      el('span', { class: 'rb-txt' }, previewText(replyTarget)),
    ),
    el('button', {
      type: 'button', class: 'ch-icon-btn', 'aria-label': t('msg.cancel_reply'), title: t('msg.cancel_reply'),
      onclick: () => { replyTarget = null; paintReplyBar(); },
    }, el('span', { class: 'ic', 'data-icon': 'x', 'data-icon-size': '14' })),
  );
  paintIcons(host);
}

/**
 * Yönləndirmə seçicisi — hədəf söhbəti seçdirir.
 * ⚠ Fayl köçürməsi SERVERDƏDİR (`forwardMessage`, routes/room.ts): client
 *   yalnız hədəfi göstərir, açarı özü YAZMIR.
 */
function openForwardPicker(m, fromScope, fromId){
  const box = el('div', { class: 'fwd-list' });
  rooms.forEach(r => box.append(el('button', {
    type: 'button', class: 'fwd-item',
    onclick: async () => {
      try{
        await forwardMessage({ fromScope, fromId, toScope: 'room', toId: r.id, messageId: m.id });
        closeModal(); toast(t('msg.forwarded'));
      }catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
    },
  }, el('span', { class: 'ic', 'data-icon': 'hash', 'data-icon-size': '15' }), el('span', {}, r.name))));
  showModal([
    el('div', { class: 'section-title' }, t('msg.forward_to')),
    el('p', { class: 'c-report-quote' }, previewText(m)),
    box,
  ]);
  paintIcons(box);
}

function openMsgEdit(m){
  const ta = el('textarea', { maxLength: 2000 });
  ta.value = m.text;
  showModal([
    el('div', { class: 'section-title' }, t('dyn.edit_msg')),
    ta,
    el('button', { class: 'btn-small', onclick: async () => {
      const v = ta.value.trim();
      if(!v) return;
      try{ await editRoomMessage(currentRoomId, m.id, v); closeModal(); toast(t('dyn.msg_upd')); }
      catch(e){ toast(t('dyn.upd_fail'), 'err'); }
    } }, t('dyn.save')),
  ]);
}

/* ══ Otaq ikonu (miqrasiya 0048) ══════════════════════════════════════════
 * ⚠ Şəkil `kind=avatar` ilə yüklənir — server orada 1 MB həddi və yalnız-şəkil
 *   yoxlaması tətbiq edir, prefiks isə `canReadKey`-də onsuz da publikdir. */
function pickRoomIcon(roomId){
  const inp = el('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
  inp.addEventListener('change', async e => {
    const f = e.target.files[0];
    if(!f) return;
    try{
      await setRoomIcon(roomId, f);
      toast(t('room.icon_updated'));
      // Otaq siyahısı abunəsi yeniləməni gətirir; başlıq dərhal yenilənsin.
      selectRoom(roomId);
    }catch(err){ toast(err?.message || t('dyn.fail'), 'err'); }
  });
  inp.click();
}

async function clearRoomIcon(roomId){
  if(!await confirmDialog(t('room.clear_icon_conf'))) return;
  try{
    await setRoomIcon(roomId, null);
    toast(t('room.icon_updated'));
    selectRoom(roomId);
  }catch(err){ toast(err?.message || t('dyn.fail'), 'err'); }
}

/* ══ Mesaj render konteksti ═══════════════════════════════════════════════
 * Bütün əməliyyat davranışı BURADA yığılır və `chat-message.js`-ə ötürülür.
 * Modul çat/DM-dən asılı olmadığı üçün fərqlər yalnız bu obyektdədir. */
let replyTarget = null;      // hansı mesaja cavab yazılır (null = yox)

function chatCtx(){
  return {
    uidOf: m => m.authorUid,
    isMine: m => m.authorUid === state.authUser.uid,
    userOf: m => state.users.get(m.authorUid),
    nameOf: m => m.authorName || (state.users.get(m.authorUid) || {}).name || '',
    onName: uid => openProfileModal(uid),
    isAdmin: state.isAdmin,
    // Otaqda sabitləmə YALNIZ admin üçündür — server də bunu tətbiq edir.
    canPin: state.isAdmin,
    toast,
    onReact: async (m, type, on) => {
      try{ await setMessageReaction('room', currentRoomId, m.id, type, on); }
      catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
    },
    onReply: m => { replyTarget = m; paintReplyBar(); },
    onEdit: m => openMsgEdit(m),
    onDelete: async m => {
      if(await confirmDialog(t('dyn.msg_del_conf'))){
        try{ await deleteRoomMessage(currentRoomId, m.id); }catch(e){ toast(t('dyn.del_fail'), 'err'); }
      }
    },
    onPin: async (m, on) => {
      try{ await setRoomPin(currentRoomId, m.id, on); await loadPins(currentRoomId); }
      catch(e){ toast(e?.message || t('chat.pin_fail'), 'err'); }
    },
    onBookmark: async (m, on) => {
      try{ await setMessageBookmark('room', currentRoomId, m.id, on); m.bookmarked = on; paintNow(); }
      catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
    },
    onCopyLink: async m => {
      // Dərin link: otaq + mesaj id-si. Naviqasiya `#chat` marşrutundadır.
      const url = `${location.origin}/#chat?room=${encodeURIComponent(currentRoomId)}&m=${encodeURIComponent(m.id)}`;
      try{ await navigator.clipboard.writeText(url); toast(t('msg.link_copied')); }
      catch(e){ toast(t('dyn.copy_fail'), 'err'); }
    },
    onForward: m => openForwardPicker(m, 'room', currentRoomId),
    onJump: id => {
      const node = document.querySelector(`[data-mid="${id}"]`);
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      node?.classList.add('msg-flash');
      setTimeout(() => node?.classList.remove('msg-flash'), 1200);
    },
  };
}

/** Cari otağın mesajlarını yenidən çəkir (reaksiya/əlfəcin sonrası). */
let paintNow = () => {};

/* ══ Sabitlənmiş mesajlar + detallar paneli ═══════════════════════════════
 * `lastMsgs` panelin AXTARIŞI üçün saxlanılır: axtarış yüklənmiş mesajlar
 * üzərində LOKAL işləyir. Server tərəfli mesaj axtarışı ayrı endpoint + indeks
 * tələb edərdi; panelin məqsədi isə "bayaq gördüyüm mesajı tap"-dır. */
let pins = [];
let aiSummary = null;
let lastMsgs = [];
/* Banner-də hazırda göstərilən sabitlənmişin indeksi. Otaq dəyişəndə
   sıfırlanır — əks halda yeni otaqda mənasız mövqedən başlayardı. */
let pinIndex = 0;

async function loadPins(roomId){
  try{
    const r = await fetchRoomPins(roomId);
    // Otaq bu arada dəyişmiş ola bilər — gec gələn cavab yenisini əzməsin.
    if(roomId !== currentRoomId) return;
    pins = r.pins || [];
  }catch(e){ pins = []; }
  paintPinStrip();
  paintDetails();
}

function paintPinStrip(){
  const strip = document.getElementById('chatPinStrip');
  if(!strip) return;
  clear(strip);
  if(!pins.length){ strip.hidden = true; return; }
  strip.hidden = false;
  strip.append(pinBanner({
    pins,
    index: pinIndex,
    onJump: (cur) => {
      chatCtx().onJump?.(cur.id);
      // Növbətiyə keç — banner artıq SONRAKI sabitlənmişi göstərir.
      pinIndex += 1;
      paintPinStrip();
    },
    onShowAll: () => setDetailsOpen(document.getElementById('chatWrap'), true),
  }));
}

function paintDetails(){
  const panel = document.getElementById('chatDetails');
  const wrap = document.getElementById('chatWrap');
  if(!panel || !wrap) return;
  // Otaqda "iştirakçı" siyahısı yoxdur (qlobal otaqlar üzvlük saxlamır) —
  // ən mənalı yaxınlaşma HAZIRDA ONLAYN olanlardır.
  const people = [...state.users.values()].filter(u => !u.blocked && isOnline(u)).slice(0, 40);
  renderDetailsPanel(panel, wrap, {
    titleId: 'chatDetailsTitle',
    people,
    pins,
    summary: aiSummary,
    onSearch: q => lastMsgs
      .filter(m => (m.text || '').toLowerCase().includes(q.toLowerCase()))
      .map(m => ({ who: m.authorName, text: m.text, id: m.id })),
    onJump: h => {
      const node = document.querySelector(`[data-mid="${h.id}"]`);
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      node?.classList.add('msg-flash');
      setTimeout(() => node?.classList.remove('msg-flash'), 1200);
    },
    // Sabitləməni ləğv etmək otaqda YALNIZ admin üçündür — server də məcbur edir.
    onUnpin: state.isAdmin ? async p => {
      try{ await setRoomPin(currentRoomId, p.id, false); await loadPins(currentRoomId); }
      catch(e){ toast(t('chat.pin_fail'), 'err'); }
    } : null,
    onSummarize: async box => {
      clear(box);
      box.append(el('div', { class: 'cd-empty' }, t('ai.working')));
      try{
        const ctx = lastMsgs.slice(-40).map(m => `${m.authorName}: ${m.text || ''}`).join('\n');
        aiSummary = await askAI(`Aşağıdakı söhbəti 3-5 cümlə ilə xülasə et. Kim nə dedi — qısa və konkret:\n\n${ctx}`);
        paintDetails();
      }catch(e){
        clear(box);
        box.append(el('div', { class: 'cd-empty' }, e?.message || t('ai.fail')));
      }
    },
  });
}

// `openDetail`: yalnız istifadəçi KLİKindən true. Mount-dakı avtomatik seçim
// false ötürür ki, mobildə chat açılanda əvvəlcə otaq SİYAHISI görünsün, birbaşa
// mesaja tullanmasın (desktop-da fərq yoxdur — detail-open yalnız mobildə işləyir).
/**
 * Otaq başlığını çəkir.
 *
 * ⚠ AYRICA FUNKSİYADIR, çünki İKİ dəfə çağırılır: otaq seçiləndə və otaq
 *   SİYAHISI gələndə. `selectRoom` mount-da siyahıdan ƏVVƏL işləyir, o an
 *   `rooms.find(...)` `undefined` verir və başlıq otağın adı əvəzinə id-sinə
 *   düşür ("general" vs "ümumi"), avatar da yüklənmiş ikonu göstərmir.
 */
function paintRoomHead(roomId){
  const room = rooms.find(r => r.id === roomId);
  const wrap = document.getElementById('chatWrap');
  // TASK-8 mobil master-detail: geri düyməsi siyahıya qaytarır (yalnız mobildə
  // görünür, CSS idarə edir). Otaq seçiləndə mesaj sahəsi tam en sürüşür.
  const prefs = convPrefs();
  const isPinned = prefs.pinned.includes(roomId);
  const isMuted = prefs.muted.includes(roomId);
  buildChatHead(document.getElementById('chatHead'), {
    /* Otaq da başlıqda avatar alır (DM ilə eyni görünüş dili).
     * `verified`/`xp`/`role` YOXDUR → `buildChatHead` onları çəkmir, yalnız
     * avatar + ad + alt sətir görünür. */
    user: { uid: roomId, name: room ? room.name : roomId, photoURL: room ? room.iconUrl : null },
    title: '# ' + (room ? room.name : roomId),
    sub: t('chat.room_sub'),
    onBack: closeRoomDetail,
    actions: headerActions({
      // Axtarış detallar panelindəki sahəni açır — ikinci axtarış qutusu
      // qurmaq eyni funksiyanı ikiləşdirərdi.
      onSearch: () => {
        setDetailsOpen(wrap, true);
        setTimeout(() => document.querySelector('#chatDetails .cd-search')?.focus(), 60);
      },
      onPin: async () => {
        try{ await setConvPref('pinned', roomId, !isPinned); renderRoomList(); selectRoom(roomId); }
        catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
      },
      pinned: isPinned,
      detailsBtn: detailsToggleButton(wrap, 'chatDetails'),
      menuItems: [
        {
          icon: isMuted ? 'bell' : 'bell-off',
          label: isMuted ? t('conv.unmute') : t('conv.mute'),
          onClick: async () => {
            try{ await setConvPref('muted', roomId, !isMuted); renderRoomList(); selectRoom(roomId); }
            catch(e){ toast(e?.message || t('dyn.fail'), 'err'); }
          },
        },
        // Otaq ikonu — YALNIZ admin (server `MANAGE_ROOMS` icazəsini tələb edir).
        ...(state.isAdmin ? [
          { icon: 'image', label: t('room.set_icon'), onClick: () => pickRoomIcon(roomId) },
          ...(room && room.iconUrl
            ? [{ icon: 'trash', label: t('room.clear_icon'), danger: true, onClick: () => clearRoomIcon(roomId) }]
            : []),
        ] : []),
      ],
    }),
  });
}

// `openDetail`: yalnız istifadəçi KLİKindən true. Mount-dakı avtomatik seçim
// false ötürür ki, mobildə chat açılanda əvvəlcə otaq SİYAHISI görünsün.
function selectRoom(roomId, openDetail = false){
  currentRoomId = roomId;
  renderRoomList();
  paintRoomHead(roomId);
  // Otaq dəyişdi → əvvəlki otağın sabitlənmişləri və xülasəsi qalmamalıdır.
  pins = [];
  pinIndex = 0;
  aiSummary = null;
  loadPins(roomId);
  if(openDetail) document.querySelector('#page-chat .chat-wrap')?.classList.add('detail-open');
  const box = document.getElementById('chatMessages');
  clear(box);
  const tp = document.getElementById('chatTyping');
  if(tp) tp.classList.remove('show');           // otaq dəyişdi → köhnə typing gizlət
  connectRoomWs(roomId);                          // realtime siqnal kanalı
  if(unsubMsgs) unsubMsgs();

  // AUDIT-TASK-8 §8.4 — arxiv tarixçəsi. `hist` HƏR otaq seçimində sıfırlanır:
  // əvvəlki otağın köhnə mesajları yenisinə sızmamalıdır.
  const hist = createHistory();
  let liveMsgs = [];

  const paint = () => {
    clear(box);
    // Zolaq HƏMİŞƏ qutunun başındadır: "daha köhnə" düyməsi, spinner,
    // "söhbətin başlanğıcı" və ya xəta — dördü də eyni yerdə.
    box.append(historyBar(hist, doLoad));
    const all = [...hist.older, ...liveMsgs];
    // Panelin lokal axtarışı yüklənmiş mesajlar üzərində işləyir.
    lastMsgs = all;
    if(!all.length){ box.append(emptyState('hash', t('chat.empty_chat'))); return; }
    /* ⚠ `historyBar` yuxarıda `box`-a əlavə olunub, `renderMessageList` isə
     *   `clear(box)` edir — ona görə zolaq render-DƏN SONRA yenidən qoyulur. */
    const bar = box.firstElementChild;
    renderMessageList(box, all, chatCtx());
    if(bar) box.prepend(bar);
  };
  // Reaksiya/əlfəcin dəyişikliyi serverdən siqnal gözləmədən dərhal çəkilsin.
  paintNow = paint;
  const doLoad = () => loadOlder(hist, box, ts => fetchOlderRoomMessages(roomId, ts), paint);

  unsubMsgs = watchRoomMessages(roomId, (msgs, meta) => {
    const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    liveMsgs = msgs;
    // Kursor mənbəyi: canlı səhifənin ƏN KÖHNƏ mesajı (siyahı ASC gəlir).
    hist.liveOldestTs = msgs.length ? msgs[0].createdAt : null;
    // Server ilk səhifədə "daha köhnəsi yoxdur" deyirsə düyməni gizlət —
    // istifadəçi mövcud olmayan tarixçəni axtarmasın.
    if(!hist.older.length && meta && meta.hasMore === false) hist.hasMore = false;
    paint();
    announceLatest(msgs);
    // Avtomatik dibə sürüşmə YALNIZ istifadəçi onsuz da dibdə idisə —
    // köhnə mesaj oxuyarkən yeni mesaj gəlsə yeri itirməsin.
    if(wasAtBottom) box.scrollTop = box.scrollHeight;
  });
}

/* ── AUDIT-UI: yeni mesajın ekran oxuyucusuna elanı ───────────────────────
 * Real-time çat vizual olaraq yenilənir, amma ekran oxuyucusu üçün TAM SƏSSİZ
 * idi: istifadəçi mesaj gəldiyini yalnız siyahını yenidən oxuyaraq bilirdi.
 *
 * ⚠ Niyə `#chatMessages`-in ÖZÜNƏ `aria-live` qoyulmadı: `paint()` hər
 *   yeniləmədə `clear(box)` edib bütün siyahını yenidən qurur. Canlı region
 *   olsaydı, hər mesajda BÜTÜN tarixçə təkrar səsləndirilərdi.
 * ⚠ Yalnız BAŞQASININ mesajı elan olunur — öz göndərdiyini istifadəçi onsuz da bilir.
 * ⚠ Son elan olunan id yadda saxlanılır: `paint()` təkrar çağırılanda
 *   (məs. tarixçə yüklənəndə) eyni mesaj iki dəfə oxunmasın. */
let lastAnnouncedId = null;
function announceLatest(msgs){
  const live = document.getElementById('chatLive');
  if(!live || !msgs || !msgs.length) return;
  const m = msgs[msgs.length - 1];
  if(!m || m.id === lastAnnouncedId) return;
  lastAnnouncedId = m.id;
  if(m.authorUid === state.authUser.uid) return;
  live.textContent = `${m.authorName || ''}: ${m.text || ''}`.trim();
}

// Vahid göndərmə yolu: əvvəlcə WS (sürətli), cavab gəlməzsə REST (etibarlı).
async function deliver(payload){
  if(await sendViaSocket(payload)) return;
  // WS bağlıdır və ya cavab vermədi → REST. `sendViaSocket` yalnız HEÇ BİR
  // cavab gəlmədikdə `false` qaytarır, ona görə burada dublikat riski yoxdur.
  await sendRoomMessage(currentRoomId, payload);
}

/* AUDIT-UI: `send()` heç bir "gedişdə" qoruması OLMADAN çağırılırdı — Enter-i
 * sürətlə basmaq və ya düyməyə iki dəfə klikləmək eyni mətni İKİ DƏFƏ
 * göndərirdi (`loading-buttons`: async əməliyyat boyu düymə söndürülməlidir).
 * Bayraq + düymənin `disabled` vəziyyəti birlikdə işləyir: bayraq klaviatura
 * yolunu, `disabled` isə siçan yolunu bağlayır və görünən əks-əlaqə verir. */
let sending = false;
async function send(){
  if(sending) return;
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');
  const text = input.value.trim();
  if(!text) return;
  sending = true;
  if(btn) btn.disabled = true;
  input.value = '';
  // Cavab hədəfi varsa `replyTo` payload-a qoşulur (thread, miqrasiya 0047).
  const payload = replyTarget ? { type: 'text', text, replyTo: replyTarget.id } : text;
  try{
    await deliver(payload);
    replyTarget = null;
    paintReplyBar();
  }
  catch(e){ toast(t('dyn.msg_send_fail'), 'err'); input.value = text; }
  finally{
    sending = false;
    if(btn) btn.disabled = false;
  }
}

export function initChat(){
  document.getElementById('chatSendBtn').addEventListener('click', send);
  const input = document.getElementById('chatInput');
  /* ⚠ Giriş artıq `<textarea>`-dır: Enter GÖNDƏRİR, Shift+Enter YENİ SƏTİR
   *   yazır (çat konvensiyası). `preventDefault` olmasa Enter həm göndərər,
   *   həm də sahəyə sətir keçidi əlavə edərdi. */
  input.addEventListener('keydown', e => {
    if(e.key !== 'Enter' || e.shiftKey || e.defaultPrevented) return;
    e.preventDefault();
    send();
  });
  input.addEventListener('input', maybeSendTyping);     // "typing…" siqnalı (throttle 2s)
  attachMentionAutocomplete(input);
  // Mesaj pop-larını (reaksiya seçicisi / "daha çox") bayır klik və Escape bağlayır.
  bindMessagePopClosers();
  /* ⚠ SIRA VACİBDİR: `attachRichControls` düymələri `input.parentElement`-ə
   *   əlavə edir. `enhanceComposer` girişi yeni `.cmp-shell` qabığına
   *   KÖÇÜRDÜYÜ üçün əvvəlcə qabıq qurulur, sonra rich-control-lar alət
   *   sətrinə (`tools`) yerləşdirilir — əks halda onlar köhnə valideyndə
   *   qalıb qabığın xaricinə düşərdi. */
  const composer = document.getElementById('chatComposer');
  const enhanced = enhanceComposer(composer, {
    getContext: () => lastMsgs.slice(-40).map(m => `${m.authorName}: ${m.text || ''}`).join('\n'),
    onSummary: s => { aiSummary = s; paintDetails(); setDetailsOpen(document.getElementById('chatWrap'), true); },
    // Sürüklə-burax və şəklin yapışdırılması — əlavə düyməsi ilə eyni yol.
    onFiles: files => sendFiles(files, payload => deliver(payload)),
  });
  attachRichControls(enhanced ? enhanced.tools : input.parentElement, payload => deliver(payload));
}

export function mountChat(){
  closeRoomDetail();   // mobildə həmişə otaq SİYAHISI ilə başla
  unsubRooms = watchRooms(list => {
    rooms = list;
    if(!rooms.find(r => r.id === currentRoomId)) currentRoomId = rooms[0] ? rooms[0].id : 'general';
    renderRoomList();
    /* ⚠ BAŞLIQ DA YENİLƏNİR: `selectRoom` otaq siyahısı GƏLMƏMİŞDƏN əvvəl
     *   işləyir, ona görə `rooms.find(...)` `undefined` qaytarır və başlıq
     *   otağın ADI əvəzinə İD-sinə düşür ("general" vs "ümumi"), avatar da
     *   yüklənmiş ikonu yox, id-dən çıxarılan inisialları göstərir.
     *   Siyahı gələn kimi başlıq düzgün adla yenidən qurulur. */
    if(rooms.length) paintRoomHead(currentRoomId);
  });
  selectRoom(currentRoomId);
  return () => {
    if(unsubRooms){ unsubRooms(); unsubRooms = null; }
    if(unsubMsgs){ unsubMsgs(); unsubMsgs = null; }
    roomWsFor = null;                 // reconnect döngəsini dayandır
    closeRoomWs();
    clearTimeout(typingHideTimer);
  };
}
