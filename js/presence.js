// Presence — real-time PresenceDO (WebSocket) + heartbeat/poll fallback.
//
// İki mənbə var və QƏSDƏN hər ikisi saxlanılır:
//  1) WS (qlobal PresenceDO): ani online/offline. Qoşulu olduqda AVTORİTETDİR —
//     snapshot bütün online uid-ləri verir, ona görə siyahıda olmayan = offline.
//  2) heartbeat + `GET /api/presence` poll: WS mümkün olmayan mühitlərdə (proxy,
//     köhnə brauzer) əvvəlki davranış tam qalır; həm də `users.last_active_at`
//     "son görülmə" mətni üçün D1-də saxlanmalıdır (WS bunu yazmır).
import { api, startPoll } from './api.js';
import { state } from './store.js';
import { setPresenceSource, emit } from './util.js';

const presenceMap = new Map(); // uid -> lastSeen (ms) — poll fallback
const onlineSet = new Set();   // uid — WS avtoritet siyahısı
let wsLive = false;            // snapshot gəlib və soket açıqdır
let ws = null;
let wsAttempt = 0;
let reconnectTimer = null;
let hbTimer = null;
let unsubWatch = null;
let stopped = false;

const wsProto = () => (location.protocol === 'https:' ? 'wss:' : 'ws:');

async function beat(){
  if(!state.authUser) return;
  await api('/presence', { method: 'POST' }).catch(() => {});
}

/* ---------- realtime (PresenceDO / WebSocket) ---------- */
function closeWs(){
  const sock = ws;
  ws = null;
  wsLive = false;
  if(sock){ try{ sock.onclose = null; sock.close(); }catch(e){} }
}

function scheduleReconnect(){
  if(stopped || reconnectTimer) return;
  // 3s → 6s → 12s → 24s → 30s (cap). Sonsuz sıx cəhd yox.
  const delay = Math.min(3000 * Math.pow(2, wsAttempt++), 30000);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if(!stopped && !ws) connectWs();
  }, delay);
}

function connectWs(){
  if(stopped || !state.authUser || ws) return;
  let sock;
  try{ sock = new WebSocket(`${wsProto()}//${location.host}/api/presence/ws`); }
  catch(e){ return; }   // WS mümkün deyil → poll fallback işini görür
  ws = sock;

  sock.addEventListener('open', () => { wsAttempt = 0; });
  sock.addEventListener('message', ev => {
    if(ws !== sock) return;
    let d; try{ d = JSON.parse(ev.data); }catch(e){ return; }
    if(d.t === 'snapshot'){
      onlineSet.clear();
      (d.uids || []).forEach(u => onlineSet.add(u));
      wsLive = true;
    }
    else if(d.t === 'on') onlineSet.add(d.uid);
    else if(d.t === 'off') onlineSet.delete(d.uid);
    // Bildiriş / DM fan-out: siqnal gəlir, məzmunu mövcud poll-lar REST-dən
    // çəkir (`startPoll` events → dərhal tick). Ayrıca render məntiqi yoxdur.
    else if(d.t === 'notif'){ emit('refresh-notifs'); return; }
    else if(d.t === 'dm'){
      emit('refresh-threads');
      if(d.pairId) emit('refresh-dm-' + d.pairId);
      return;
    }
    else return;                       // naməlum tip — səssiz keç
    emit('presence-updated');
  });
  sock.addEventListener('close', () => {
    if(ws !== sock) return;            // artıq başqa bağlantı aktivdir
    ws = null;
    wsLive = false;
    onlineSet.clear();
    emit('presence-updated');          // poll mənbəyinə qayıt
    scheduleReconnect();
  });
  sock.addEventListener('error', () => { try{ sock.close(); }catch(e){} });
}

export function startPresence(){
  stopped = false;
  setPresenceSource(uid => {
    // WS canlıdırsa siyahı tamdır: yoxdursa həqiqətən offline-dır (lastSeen: 0).
    // `isOnline()` truthy nəticədə lastActiveAt fallback-ına KEÇMİR — bu da
    // offline-ın 5 dəqiqə "online" görünməsinin qarşısını alır.
    if(wsLive) return { lastSeen: onlineSet.has(uid) ? Date.now() : 0 };
    const ls = presenceMap.get(uid);
    return ls ? { lastSeen: ls } : null;
  });
  beat();
  hbTimer = setInterval(() => { if(!document.hidden) beat(); }, 30000);
  document.addEventListener('visibilitychange', onVis);
  connectWs();
  unsubWatch = startPoll({
    fetcher: () => api('/presence'),
    interval: 30000,
    events: ['refresh-presence'],
    onData: d => {
      presenceMap.clear();
      Object.entries(d.presence).forEach(([uid, ls]) => presenceMap.set(uid, ls));
      if(!wsLive) emit('presence-updated');   // WS canlıdırsa mənbə odur
    },
  });
  return stopPresence;
}

function onVis(){
  if(document.hidden) return;
  beat();
  // Tab arxa plandan qayıdanda soket ölmüş ola bilər — dərhal bərpa et.
  if(!ws){
    if(reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
    wsAttempt = 0;
    connectWs();
  }
}

export function stopPresence(){
  stopped = true;
  if(hbTimer){ clearInterval(hbTimer); hbTimer = null; }
  if(reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
  if(unsubWatch){ unsubWatch(); unsubWatch = null; }
  document.removeEventListener('visibilitychange', onVis);
  closeWs();
  wsAttempt = 0;
  presenceMap.clear();
  onlineSet.clear();
}
