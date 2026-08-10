// Data qatı — Cloudflare Workers REST API + ağıllı polling.
// Export adları köhnə Firestore versiyası ilə eynidir — UI modulları dəyişmədən qalır.
import { api, startPoll } from './api.js';
import { emit } from './util.js';
import { toast } from './ui.js';
import { t } from './i18n.js';

/**
 * AUDIT-TASK-9 / B-3 — gündəlik XP tavanı bildirişi.
 *
 * Server tavana çatanda əməliyyatı RƏDD ETMİR (post/rəy yaranır), sadəcə
 * `xpCapped: true` qaytarır. İstifadəçiyə bunu deməsək, o, XP-nin artmadığını
 * görüb sistemi sınıq sanacaq — və ya daha pisi, təkrar-təkrar göndərəcək.
 *
 * ⚠ `ui.js`/`i18n.js` `store.js`-i import ETMİR → dairəvi asılılıq yoxdur.
 */
function notifyXpCap(res){
  if(res && res.xpCapped) toast(t('xp.daily_cap'), 'warn');
}

export const state = {
  authUser: null,     // { uid } — sessiya sahibi
  me: null,           // profil (server formatında)
  isAdmin: false,
  /* Çağıranın ÖZ icazələri (`/api/auth/me` cavabındakı `perms`).
   * ⚠ AVTORİZASİYA DEYİL, yalnız UI qərarı üçündür: server hər endpoint-də
   *   `perm` qapısını yenə də işlədir. Məqsəd bilə-bilə 403 alacaq sorğunu
   *   ÜMUMİYYƏTLƏ göndərməməkdir (bax `js/governance.js`). */
  perms: [],
  users: new Map(),   // uid -> user
  myLikes: new Set(),
  myBookmarks: new Set(),
  myFollowing: new Set(),
  myFollowers: new Set(),
  myReposts: new Set(),  // birbaşa re-post etdiyim orijinal post-ların kök id-ləri (toggle vəziyyəti)
};

/* ================= users ================= */
export function watchUsers(cb){
  return startPoll({
    fetcher: () => api('/users'),
    interval: 15000,
    events: ['refresh-users'],
    onData: d => {
      state.users.clear();
      d.users.forEach(u => state.users.set(u.uid, u));
      if(state.authUser && state.users.has(state.authUser.uid)){
        state.me = { ...state.me, ...state.users.get(state.authUser.uid) };
      }
      cb(state.users);
    },
  });
}

export async function getUser(uid){
  return state.users.get(uid) || null;
}

// İstifadəçi kataloqu (TASK-6 / İstifadəçilər#5): sıralama + filtr + keyset
// pagination D1-də aparılır. Yuxarıdakı watchUsers() qlobal identifikasiya
// keşidir (post müəllifi, DM, mention) və toxunulmur — bu, ondan ayrıca sorğudur.
// Gələn sətrləri keşə də yazırıq ki, profil/DM keçidləri dərhal işləsin.
/**
 * @param {{ q?: string, skill?: string, level?: string, looking?: string,
 *           extra?: string, sort?: string, cursor?: string, limit?: number }} [opts]
 */
/**
 * Kataloq sorğu parametrləri — siyahı və CSV ixracı EYNİ funksiyadan keçir.
 * ⚠ JSDoc tipi MƏCBURİDİR: `checkJs` boş default obyektdən (`= {}`) sahələri
 *   çıxara bilmir və hər yeni filtr TS2339 verir.
 * @param {{q?:string, skill?:string, level?:string, looking?:string, extra?:string,
 *          sort?:string, company?:string, loc?:string, status?:string,
 *          cursor?:string|null, limit?:number}} [o]
 */
export function directoryParams(o = {}){
  const { q, skill, level, looking, extra, sort, company, loc, status, cursor, limit } = o;
  const p = new URLSearchParams();
  if(q) p.set('q', q);
  if(skill) p.set('skill', skill);
  if(level) p.set('level', level);
  if(looking) p.set('looking', looking);
  if(extra) p.set('extra', extra);
  if(sort) p.set('sort', sort);
  if(company) p.set('company', company);
  if(loc) p.set('loc', loc);
  if(status) p.set('status', status);
  if(cursor) p.set('cursor', cursor);
  if(limit) p.set('limit', String(limit));
  return p;
}

export async function fetchUserDirectory(opts = {}){
  const d = await api('/users/directory?' + directoryParams(opts).toString());
  // ⚠ `set` ŞƏRTSİZ DEYİL: `state.users` qlobal identifikasiya keşidir və
  //   feed/DM/mention ondan oxuyur. Kataloq cavabı zənginləşdirilmiş
  //   sahələr daşıyır (`teamsCount`, `iFollow` …) — köhnə sətri əvəzləmək
  //   təhlükəsizdir, lakin `listUsers`-dan gələn tam sətri kataloq
  //   nüsxəsi ilə ƏZMƏK olmaz, çünki orada `settings` kimi sahələr var.
  //   Ona görə yalnız YOX olan sətirlər yazılır (mövcud davranış qorunur).
  d.users.forEach(u => { if(!state.users.has(u.uid)) state.users.set(u.uid, u); });
  return d;
}

/** Başlıq kartları — BÜTÜN baza üzrə, yüklənmiş səhifə üzrə YOX. */
export async function fetchDirectoryStats(){ return api('/users/dir-stats'); }

/** Sağ paneldəki dörd tövsiyə siyahısı. */
export async function fetchSuggestedUsers(){ return api('/users/suggested'); }

/** CSV ixracı — brauzer endirməni özü aparır (admin ixracı ilə eyni naxış). */
export function directoryExportUrl(opts = {}){
  return '/api/users/export.csv?' + directoryParams(opts).toString();
}

export async function updateMyProfile(fields){
  const d = await api('/me', { method: 'PATCH', body: fields });
  state.me = d.user;
  if(state.users.has(d.user.uid)) state.users.set(d.user.uid, d.user);
  emit('refresh-users');
  // TASK-8 / Bənd 6 — profil 100% olduqda server +20 XP verir və bunu bir dəfə
  // bildirir. `bus` hadisəsi ilə UI qatına ötürülür (store toast bilmir).
  if(d.bonusGiven) emit('profile-bonus');
  return d;
}

export async function updateMySettings(patch){
  const d = await api('/me/settings', { method: 'PATCH', body: patch });
  if(state.me) state.me.settings = d.settings;
}

// Gündəlik aktivlik server tərəfdə (login + post/mesaj) hesablanır.
export async function touchActivity(){
  await api('/presence', { method: 'POST' }).catch(() => {});
}
export async function bumpActivityDay(){ /* server tərəfdə avtomatik */ }

/* ================= sosial vəziyyət (likes/bookmarks/follows) ================= */
export function watchMySocial(cb){
  return startPoll({
    fetcher: () => api('/me/social'),
    interval: 30000,
    events: ['refresh-social'],
    onData: d => {
      state.myLikes = new Set(d.likes);
      state.myBookmarks = new Set(d.bookmarks);
      state.myFollowing = new Set(d.following);
      state.myFollowers = new Set(d.followers);
      // Repost toggle vəziyyəti serverdən gəlir. Əvvəl yalnız 60-postluq feed
      // pəncərəsindən çıxarılırdı — pəncərədən kənarda qalan re-post-lar
      // "edilməmiş" görünürdü (TASK-7 / Bənd 4).
      if(Array.isArray(d.reposts)) state.myReposts = new Set(d.reposts);
      cb(d);
    },
  });
}

/* ================= posts ================= */
// Cari feed sıralaması — `setFeedSort` dəyişir, poll onu oxuyur.
// ⚠ Modul səviyyəsində saxlanılır ki, `watchFeed` yenidən abunə olmadan
//   sıralamanı dəyişə bilsin (abunə yenidən qurulsa poll sayğacları sıfırlanar).
let feedSort = 'new';
export function setFeedSort(v){ feedSort = v || 'new'; }
export function getFeedSort(){ return feedSort; }

export function watchFeed(cb){
  return startPoll({
    fetcher: () => api('/feed?sort=' + encodeURIComponent(feedSort)),
    interval: 10000,
    events: ['refresh-feed'],
    onData: d => cb(d.posts),
  });
}

export async function getPostById(postId){
  const d = await api('/posts/' + postId);
  return d.post;
}

// Block-based post: şəkil blokları əvvəl R2-yə yüklənir.
export async function createPost({ blocks, tags, sharedPostId, poll, visibility, scheduledAt }){
  const outBlocks = [];
  const imageKeys = [];
  for(const b of blocks){
    if(b.type === 'image'){
      const urls = [];
      for(const im of b.images){
        const up = await uploadFile(im.blob, 'post', 'post.jpg');
        urls.push(up.url);
        imageKeys.push(up.key);
      }
      if(urls.length) outBlocks.push({ type: 'image', urls, caption: b.caption || '' });
    } else if(b.type === 'code'){
      outBlocks.push({ type: 'code', language: b.language || '', content: b.content });
    } else {
      outBlocks.push({ type: 'text', content: b.content });
    }
  }
  const d = await api('/posts', { method: 'POST', body: { blocks: outBlocks, tags, imageKeys, sharedPostId, poll, visibility, scheduledAt } });
  notifyXpCap(d);
  emit('refresh-feed');
  emit('refresh-users');
  return d.post.id;
}

export async function updatePost(postId, fields){
  await api('/posts/' + postId, { method: 'PATCH', body: fields });
  emit('refresh-feed');
}

// Birbaşa re-post toggle. `rootPostId` = flatten sonrası kök orijinal.
// Server də flatten edir; nəticəni (`reposted`) qaytarır.
export async function toggleRepost(rootPostId){
  const d = await api('/posts/' + rootPostId + '/repost', { method: 'POST' });
  if(d.reposted) state.myReposts.add(rootPostId);
  else state.myReposts.delete(rootPostId);
  emit('refresh-feed');
  return d.reposted;
}

// Feed yüklənəndə görünən post-lardan toggle vəziyyətini tamamla.
// ƏLAVƏ edir, əvəz ETMİR: feed yalnız son 60 postu görür, ona görə burada
// silmək pəncərədən kənarda qalan re-post-ları "edilməmiş" göstərərdi.
// Səlahiyyətli mənbə `/me/social`-dır (watchMySocial), silmə isə toggle-dadır.
export function deriveMyReposts(posts){
  if(!state.authUser) return;
  posts.forEach(p => {
    if(p.authorUid === state.authUser.uid && p.postType === 'repost' && p.sharedPostId){
      state.myReposts.add(p.sharedPostId);
    }
  });
}

// Həm post obyektini, həm də düz id-ni qəbul edir. (Əvvəl yalnız obyekt
// gözlənilirdi, amma çağıran yerlərdən biri id ötürürdü → `undefined.id` →
// `/api/posts/undefined`; Worker isə tapılmayan sətir üçün 200 qaytardığından
// silmə səssizcə uğursuz olurdu — TASK-7 / Bənd 1.)
export async function deletePost(post){
  const id = typeof post === 'string' ? post : post?.id;
  if(!id) throw new Error('deletePost: post id yoxdur');
  await api('/posts/' + id, { method: 'DELETE' });
  if (state.feed && state.feed.has(id)) {
    state.feed.delete(id);
    emit('feed-updated');
  }
  emit('refresh-feed');
  emit('refresh-users');
}

/* ---------- likes / bookmarks ---------- */
export function watchMyLikes(cb){
  // watchMySocial ilə birlikdə işləyir — ayrıca poll açmır
  const h = () => cb(state.myLikes);
  window.addEventListener('cx-social', h);
  return () => window.removeEventListener('cx-social', h);
}

// Optimistic toggle: lokal vəziyyət dərhal dəyişir, xətada geri qaytarılır.
// `refresh-feed` QƏSDƏN emit edilmir — əks halda poll dərhal işə düşüb bütün
// feed-i yenidən qururdu və çağıranın optimistic DOM yeniləməsi silinirdi
// (TASK-7 / Bənd 2). Sayğaclar növbəti planlı poll-da səssizcə uzlaşır.
export async function toggleLike(post){
  const id = typeof post === 'string' ? post : post.id;
  const had = state.myLikes.has(id);
  if(had) state.myLikes.delete(id); else state.myLikes.add(id);
  try{
    await api(`/posts/${id}/like`, { method: had ? 'DELETE' : 'PUT' });
  }catch(e){
    if(had) state.myLikes.add(id); else state.myLikes.delete(id);
    throw e;
  }
  return !had;
}

export function watchMyBookmarks(cb){
  const h = () => cb(state.myBookmarks);
  window.addEventListener('cx-social', h);
  return () => window.removeEventListener('cx-social', h);
}

export async function toggleBookmark(postId){
  const had = state.myBookmarks.has(postId);
  if(had) state.myBookmarks.delete(postId); else state.myBookmarks.add(postId);
  try{
    await api('/bookmarks/' + postId, { method: had ? 'DELETE' : 'PUT' });
  }catch(e){
    if(had) state.myBookmarks.add(postId); else state.myBookmarks.delete(postId);
    throw e;
  }
  emit('bookmarks-changed');   // yalnız Saxlanılanlar siyahısı üçün — poll işə salmır
  return !had;
}

/* ---------- comments (LinkedIn üslubu: thread + reaksiya + sort + limit) ---------- */
// opts: { sort:'new'|'top', limit:Number }. Poll cari limit-i gətirir — "daha çox"
// düyməsi limit-i artırıb yeni poll qurur (feed.js). onData(d) — bütün cavabı verir:
// { comments, replies:{parentId:[...]}, total, hasMore }.
export function watchComments(postId, opts, cb){
  const sort = (opts && opts.sort) || 'new';
  const limit = (opts && opts.limit) || 20;
  return startPoll({
    fetcher: () => api(`/posts/${postId}/comments?sort=${sort}&limit=${limit}`),
    interval: 4000,
    events: ['refresh-comments-' + postId],
    onData: d => cb(d),
  });
}
// parentId verilsə cavabdır (server bir səviyyəyə flatten edir). Yaradılan rəyi qaytarır.
export async function addComment(post, text, parentId){
  const d = await api(`/posts/${post.id}/comments`, { method: 'POST', body: { text, parentId: parentId || undefined } });
  notifyXpCap(d);
  emit('refresh-comments-' + post.id);
  emit('refresh-feed');
  emit('refresh-users');
  return d;
}
export async function editComment(postId, commentId, text){
  await api(`/posts/${postId}/comments/${commentId}`, { method: 'PATCH', body: { text } });
  emit('refresh-comments-' + postId);
}
export async function deleteComment(postId, commentId){
  await api(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
  emit('refresh-comments-' + postId);
  emit('refresh-feed');
  emit('refresh-users');
}
// Optimistic rəy-bəyənmə: çağıran UI-ni dərhal yeniləyir, xətada geri qaytarır.
// `refresh-comments` QƏSDƏN emit edilmir (poll optimistic dəyişikliyi silməsin).
export async function toggleCommentLike(postId, commentId, currentlyLiked){
  await api(`/posts/${postId}/comments/${commentId}/like`, { method: currentlyLiked ? 'DELETE' : 'PUT' });
  return !currentlyLiked;
}

/* ---------- post: reaksiya / moderasiya / şikayət (miqrasiya 0040) ---------- */
// Şərhlərdəki (0039) API-nin eynisi — yalnız yol fərqlidir.

export async function setPostReaction(postId, type){
  const path = `/posts/${postId}/reaction`;
  if(!type){ await api(path, { method: 'DELETE' }); return null; }
  const d = await api(path, { method: 'PUT', body: { type } });
  return d.type || type;
}

export async function setPostPinned(postId, pinned){
  await api(`/posts/${postId}/pin`, { method: pinned ? 'PUT' : 'DELETE' });
  return pinned;
}

export async function setPostHidden(postId, hidden){
  await api(`/posts/${postId}/hide`, { method: hidden ? 'PUT' : 'DELETE' });
  return hidden;
}

export async function reportPost(postId, reason){
  return api(`/posts/${postId}/report`, { method: 'POST', body: { reason } });
}

/* ---------- şərh: reaksiya / moderasiya / şikayət (miqrasiya 0039) ---------- */

/**
 * Reaksiya qoyur, dəyişir və ya götürür.
 * @param {string|null} type ICONS-dakı tip ('like'|'love'|'laugh'|'wow'|'fire'|'clap');
 *   `null` verilsə reaksiya SİLİNİR.
 *
 * ⚠ Server `like` tipini köhnə `comment_likes` cədvəli ilə sinxron saxlayır,
 *   ona görə burada ayrıca `toggleCommentLike` çağırmaq LAZIM DEYİL — iki
 *   yerdən yazsaq sayğac ikiqat sürüşərdi.
 */
export async function setCommentReaction(postId, commentId, type){
  const path = `/posts/${postId}/comments/${commentId}/reaction`;
  if(!type){ await api(path, { method: 'DELETE' }); return null; }
  const d = await api(path, { method: 'PUT', body: { type } });
  return d.type || type;
}

export async function setCommentPinned(postId, commentId, pinned){
  await api(`/posts/${postId}/comments/${commentId}/pin`, { method: pinned ? 'PUT' : 'DELETE' });
  return pinned;
}

export async function setCommentHidden(postId, commentId, hidden){
  await api(`/posts/${postId}/comments/${commentId}/hide`, { method: hidden ? 'PUT' : 'DELETE' });
  return hidden;
}

export async function reportComment(postId, commentId, reason){
  return api(`/posts/${postId}/comments/${commentId}/report`, { method: 'POST', body: { reason } });
}

/* ================= otaqlar ================= */
export function watchRooms(cb){
  return startPoll({
    fetcher: () => api('/rooms'),
    interval: 30000,
    events: ['refresh-rooms'],
    onData: d => cb(d.rooms),
  });
}
// Tək dəfəlik oxuma (Admin#9 modalı üçün — poll qurmağa ehtiyac yoxdur).
export async function listRooms(){ return (await api('/rooms')).rooms; }

export async function createRoom(name){
  await api('/rooms', { method: 'POST', body: { name } });
  emit('refresh-rooms');
}
export async function deleteRoom(roomId){
  await api('/rooms/' + roomId, { method: 'DELETE' });
  emit('refresh-rooms');
}
// `cb(messages, meta)` — `meta.hasMore` arxivdə/D1-də daha köhnə mesajın olub
// olmadığını bildirir (AUDIT-TASK-8 §8.1). Köhnə çağırış forması pozulmur:
// ikinci arqument əlavədir, ona baxmayan çağıranlar əvvəlki kimi işləyir.
export function watchRoomMessages(roomId, cb){
  return startPoll({
    fetcher: () => api(`/rooms/${roomId}/messages`),
    interval: 3000,
    events: ['refresh-msgs-' + roomId],
    onData: d => cb(d.messages, d),
  });
}

// Bir səhifə KÖHNƏ otaq mesajı — D1 bitəndə server arxivə keçir (§8.1).
// `beforeTs` yoxdursa server ən son səhifəni qaytarır.
export function fetchOlderRoomMessages(roomId, beforeTs){
  const q = beforeTs ? `?before=${encodeURIComponent(beforeTs)}` : '';
  return api(`/rooms/${roomId}/messages${q}`);
}
export async function sendRoomMessage(roomId, payload){
  const body = typeof payload === 'string' ? { type: 'text', text: payload } : payload;
  await api(`/rooms/${roomId}/messages`, { method: 'POST', body });
  emit('refresh-msgs-' + roomId);
}
export async function editRoomMessage(roomId, msgId, text){
  await api(`/rooms/${roomId}/messages/${msgId}`, { method: 'PATCH', body: { text } });
  emit('refresh-msgs-' + roomId);
}
export async function deleteRoomMessage(roomId, msgId){
  await api(`/rooms/${roomId}/messages/${msgId}`, { method: 'DELETE' });
  emit('refresh-msgs-' + roomId);
}

/**
 * Otaq ikonunu təyin edir / silir (miqrasiya 0048).
 *
 * ⚠ Şəkil `kind=avatar` ilə yüklənir: server o prefiksi PUBLİK oxunan kimi
 *   tanıyır (`canReadKey` sürətli yolu) və 1 MB + yalnız-şəkil məhdudiyyəti
 *   tətbiq edir. Yeni prefiks açmaq təhlükəsizlik yolunu genişləndirərdi.
 * @param {string} roomId
 * @param {File|null} file  `null` → ikonu silir
 */
export async function setRoomIcon(roomId, file){
  let iconKey = null;
  if(file){
    const d = await uploadFile(file, 'avatar', file.name);
    iconKey = d.key;
  }
  await api(`/rooms/${roomId}`, { method: 'PATCH', body: { iconKey } });
  emit('rooms-updated');
  return iconKey;
}

/* ---- Sabitlənmiş mesajlar (miqrasiya 0046) ----
 * ⚠ Otaqda sabitləmə YALNIZ admin üçündür (server məcbur edir) — UI düyməni
 *   də yalnız adminə göstərir, amma qərar serverdədir. */
export function fetchRoomPins(roomId){
  return api(`/rooms/${roomId}/pins`);
}
export async function setRoomPin(roomId, msgId, pinned){
  await api(`/rooms/${roomId}/messages/${msgId}/pin`, { method: pinned ? 'PUT' : 'DELETE' });
  emit('refresh-msgs-' + roomId);
}

/* ================= DM ================= */
export function pairIdFor(a, b){ return [a, b].sort().join('_'); }

export function watchThreads(cb){
  return startPoll({
    fetcher: () => api('/dms'),
    interval: 5000,
    events: ['refresh-threads'],
    onData: d => cb(d.threads),
  });
}
export function watchDMMessages(pairId, cb){
  return startPoll({
    fetcher: () => api(`/dms/${pairId}/messages`),
    interval: 3000,
    events: ['refresh-dm-' + pairId],
    onData: d => cb(d.messages, d),
  });
}

// Bir səhifə KÖHNƏ DM mesajı — otaq variantı ilə eyni müqavilə (§8.2).
export function fetchOlderDMMessages(pairId, beforeTs){
  const q = beforeTs ? `?before=${encodeURIComponent(beforeTs)}` : '';
  return api(`/dms/${pairId}/messages${q}`);
}
export async function sendDM(toUid, payload){
  const body = typeof payload === 'string' ? { type: 'text', text: payload } : payload;
  await api('/dms/to/' + toUid, { method: 'POST', body });
  emit('refresh-dm-' + pairIdFor(state.authUser.uid, toUid));
  emit('refresh-threads');
}
export async function editDM(pairId, msgId, text){
  await api(`/dms/${pairId}/messages/${msgId}`, { method: 'PATCH', body: { text } });
  emit('refresh-dm-' + pairId);
}
export async function deleteDM(pairId, msgId){
  await api(`/dms/${pairId}/messages/${msgId}`, { method: 'DELETE' });
  emit('refresh-dm-' + pairId);
}
export async function markThreadRead(pairId){
  await api(`/dms/${pairId}/read`, { method: 'POST' });
}

/* ══ Reaksiya · əlfəcin · forward (miqrasiya 0047) ═══════════════════════════
 * ⚠ `scope` ('room' | 'dm') marşrutu seçir. Otaq və DM üçün AYRI funksiya
 *   yazmaq əvəzinə tək funksiya işlədilir: çağıran tərəflər (chat.js / dm.js)
 *   eyni UI komponentini paylaşır və onun iki variantı olmamalıdır. */
const scopePath = (scope, id) => scope === 'dm' ? `/dms/${id}` : `/rooms/${id}`;

export async function setMessageReaction(scope, scopeId, msgId, type, on){
  await api(`${scopePath(scope, scopeId)}/messages/${msgId}/reaction`, {
    method: on ? 'PUT' : 'DELETE', body: { type },
  });
  emit(scope === 'dm' ? 'refresh-dm-' + scopeId : 'refresh-msgs-' + scopeId);
}

export async function setMessageBookmark(scope, scopeId, msgId, on){
  await api(`${scopePath(scope, scopeId)}/messages/${msgId}/bookmark`, { method: on ? 'PUT' : 'DELETE' });
  // Yayım YOXDUR — əlfəcin şəxsidir, server də siqnal göndərmir.
}

/** Mesajı başqa söhbətə yönləndirir. Fayl SERVERDƏ köçürülür (bax routes/room.ts). */
export async function forwardMessage({ fromScope, fromId, toScope, toId, messageId }){
  await api('/messages/forward', {
    method: 'POST', body: { fromScope, fromId, toScope, toId, messageId },
  });
  emit(toScope === 'dm' ? 'refresh-dm-' + toId : 'refresh-msgs-' + toId);
}

/* ── Söhbətin sabitlənməsi / susdurulması ────────────────────────────────
 * ⚠ SXEM DƏYİŞMİR: bunlar `users.settings` JSON blobunda saxlanılır və
 *   MÖVCUD `PATCH /api/me/settings` endpoint-i ilə yazılır (o, açarları
 *   birləşdirir). Yeni cədvəl/sütun lazım deyil, çünki bu, tamamilə ŞƏXSİ
 *   tərcihdir — başqa istifadəçi onu görmür və sorğu ilə filtrlənmir. */
export function convPrefs(){
  const s = state.me?.settings || {};
  return { pinned: s.pinnedConvs || [], muted: s.mutedConvs || [] };
}

export async function setConvPref(key, id, on){
  const cur = convPrefs();
  const list = key === 'pinned' ? [...cur.pinned] : [...cur.muted];
  const i = list.indexOf(id);
  if(on && i < 0) list.push(id);
  if(!on && i >= 0) list.splice(i, 1);
  const field = key === 'pinned' ? 'pinnedConvs' : 'mutedConvs';
  // Lokal vəziyyət DƏRHAL yenilənir ki, UI serveri gözləməsin (optimistik).
  if(state.me) state.me.settings = { ...(state.me.settings || {}), [field]: list };
  await api('/me/settings', { method: 'PATCH', body: { [field]: list } });
  emit('conv-prefs-changed');
}

/* DM-də hər iki iştirakçı sabitləyə bilər — şəxsi söhbətdə "moderasiya" yoxdur. */
export function fetchDMPins(pairId){
  return api(`/dms/${pairId}/pins`);
}
export async function setDMPin(pairId, msgId, pinned){
  await api(`/dms/${pairId}/messages/${msgId}/pin`, { method: pinned ? 'PUT' : 'DELETE' });
  emit('refresh-dm-' + pairId);
}

/* ================= follows ================= */
export function watchMyFollowing(cb){
  return watchMySocial(() => {
    window.dispatchEvent(new Event('cx-social'));
    cb(state.myFollowing);
  });
}
export function watchMyFollowers(cb){
  const h = () => cb(state.myFollowers);
  window.addEventListener('cx-social', h);
  return () => window.removeEventListener('cx-social', h);
}

export async function fetchFollowingOf(uid){
  const d = await api(`/users/${uid}/follow-lists?kind=following`);
  return d.uids;
}
export async function fetchFollowersOf(uid){
  const d = await api(`/users/${uid}/follow-lists?kind=followers`);
  return d.uids;
}

export async function toggleFollow(targetUid){
  if(state.myFollowing.has(targetUid)){
    state.myFollowing.delete(targetUid);
    await api('/follows/' + targetUid, { method: 'DELETE' });
    emit('refresh-social');
    return false;
  }
  state.myFollowing.add(targetUid);
  await api('/follows/' + targetUid, { method: 'PUT' });
  emit('refresh-social');
  return true;
}
export const isMutual = uid => state.myFollowing.has(uid) && state.myFollowers.has(uid);

export function canMessage(target){
  // M-9: başqasının TAM `settings`-i artıq yayımlanmır — yalnız ağ siyahı
  // (`publicSettings`). Öz profilimizdə hər ikisi mövcuddur.
  const pol = (target?.publicSettings ?? target?.settings)?.privacy?.whoCanMessage || 'everyone';
  if(pol === 'everyone' || state.isAdmin) return true;
  const theyFollowMe = state.myFollowers.has(target.uid);
  if(pol === 'following') return theyFollowMe;
  if(pol === 'mutual') return theyFollowMe && state.myFollowing.has(target.uid);
  return true;
}

/* ================= progress ================= */
export async function bumpProgress(){ /* server tərəfdə avtomatik */ }
export async function fetchProgressOf(uid){
  const d = await api(`/users/${uid}/progress`);
  return d.progress;
}

/* ================= tasks ================= */
export function watchTasks(cb){
  return startPoll({
    fetcher: () => api('/tasks?scope=approved'),
    interval: 20000,
    events: ['refresh-tasks'],
    onData: d => cb(d.tasks),
  });
}
export function watchMyPendingTasks(cb){
  return startPoll({
    fetcher: () => api('/tasks?scope=mine'),
    interval: 20000,
    events: ['refresh-tasks'],
    onData: d => cb(d.tasks),
  });
}
export function watchPendingTasks(cb){
  return startPoll({
    fetcher: () => api('/tasks?scope=pending'),
    interval: 15000,
    events: ['refresh-tasks'],
    onData: d => cb(d.tasks),
  });
}
export async function createTask({ title, desc, category }){
  await api('/tasks', { method: 'POST', body: { title, desc, category } });
  emit('refresh-tasks');
  emit('refresh-users');
}
export async function reviewTask(task, approve){
  await api(`/tasks/${task.id}/review`, { method: 'POST', body: { approve } });
  emit('refresh-tasks');
}
export async function deleteTask(taskId){
  await api('/tasks/' + taskId, { method: 'DELETE' });
  emit('refresh-tasks');
  emit('refresh-users');
}

export async function submitSolution(task, { text, link }){
  await api(`/tasks/${task.id}/submission`, { method: 'PUT', body: { text, link } });
  emit('refresh-subs');
}
export function watchMySubmissions(cb){
  return startPoll({
    fetcher: () => api('/submissions?scope=mine'),
    interval: 20000,
    events: ['refresh-subs'],
    onData: d => cb(d.submissions),
  });
}
export function watchPendingSubmissions(cb){
  return startPoll({
    fetcher: () => api('/submissions?scope=pending'),
    interval: 15000,
    events: ['refresh-subs'],
    onData: d => cb(d.submissions),
  });
}
export async function reviewSubmission(sub, status){
  await api(`/submissions/${sub.taskId}/${sub.uid}/review`, { method: 'POST', body: { status } });
  emit('refresh-subs');
}

/* ================= reports ================= */
export async function createReport(targetUid, targetUsername, reason){
  await api('/reports', { method: 'POST', body: { targetUid, targetUsername, reason } });
}
export function watchOpenReports(cb){
  return startPoll({
    fetcher: () => api('/reports'),
    interval: 20000,
    events: ['refresh-reports'],
    onData: d => cb(d.reports),
  });
}
export async function resolveReport(reportId, status){
  await api('/reports/' + reportId, { method: 'PATCH', body: { status } });
  emit('refresh-reports');
}

/* ================= admin ================= */
export async function checkIsAdmin(){ return state.isAdmin; }
export async function setBlocked(uid, blocked){
  await api('/admin/users/' + uid, { method: 'PATCH', body: { blocked } });
  emit('refresh-users');
}
export async function adminUpdateUser(uid, fields){
  await api('/admin/users/' + uid, { method: 'PATCH', body: fields });
  emit('refresh-users');
}
export async function addAdminByUid(uid){
  await api('/admin/admins/' + uid, { method: 'PUT' });
  emit('refresh-admins');
}
export async function removeAdmin(uid){
  await api('/admin/admins/' + uid, { method: 'DELETE' });
  emit('refresh-admins');
}
/**
 * Çağıranın icazəsi varmı? — YALNIZ UI qərarı üçün.
 *
 * ⚠ BU AVTORİZASİYA DEYİL. Server hər endpoint-də `perm` qapısını işlədir və
 *   bu funksiya onu ƏVƏZ ETMİR. Məqsəd nəticəsi əvvəlcədən məlum olan sorğunu
 *   göndərməmək və istifadəçiyə həmişə 403 verəcək düyməni göstərməməkdir.
 *
 * ⚠ `perms` BOŞDURSA `true` QAYTARIR. Siyahı `/api/auth/me`-dən gəlir; hələ
 *   yüklənməyibsə və ya köhnə server cavab verirsə, davranış ƏVVƏLKİ KİMİ
 *   qalmalıdır. Əks halda bu yoxlama işləyən funksiyaları səssizcə bağlayardı —
 *   qapı client-də möhkəmlənməməlidir, yalnız səs-küy azalmalıdır.
 */
export function hasPerm(name){
  return !state.perms?.length || state.perms.includes(name);
}
export function watchAdmins(cb){
  return startPoll({
    fetcher: () => api('/admin/admins'),
    interval: 30000,
    events: ['refresh-admins'],
    onData: d => cb(new Set(d.admins)),
  });
}
export async function logAdmin(action, targetUid, detail = ''){
  await api('/admin/log', { method: 'POST', body: { action, targetUid, detail } }).catch(() => {});
}
export function watchAdminLogs(cb, { level = '' } = {}){
  return startPoll({
    fetcher: () => api('/admin/logs' + (level ? '?level=' + encodeURIComponent(level) : '')),
    interval: 20000,
    events: ['refresh-admins', 'refresh-logs'],
    onData: d => cb(d.logs, d.nextCursor),
  });
}

/* ---------- TASK-6 / BÖLMƏ 3 — admin paneli ---------- */

// Admin#6/#10 — jurnalın növbəti səhifəsi (keyset cursor).
/** @param {{ level?: string, cursor?: string, limit?: number }} [opts] */
export async function fetchAdminLogs({ level, cursor, limit } = {}){
  const p = new URLSearchParams();
  if(level) p.set('level', level);
  if(cursor) p.set('cursor', cursor);
  if(limit) p.set('limit', String(limit));
  return api('/admin/logs?' + p.toString());
}

// Admin#4/#10 — filtrlənən, səhifələnən istifadəçi siyahısı.
/** @param {{ q?: string, filter?: string, cursor?: string, limit?: number }} [opts] */
export async function fetchAdminUsers({ q, filter, cursor, limit } = {}){
  const p = new URLSearchParams();
  if(q) p.set('q', q);
  if(filter) p.set('filter', filter);
  if(cursor) p.set('cursor', cursor);
  if(limit) p.set('limit', String(limit));
  return api('/admin/users?' + p.toString());
}

// Admin#5 — toplu blok/blokdan çıxarma (serverdə D1 batch()).
export async function bulkSetBlocked(uids, blocked){
  const d = await api('/admin/users/bulk', {
    method: 'POST',
    body: { action: blocked ? 'block' : 'unblock', uids },
  });
  emit('refresh-users');
  emit('refresh-logs');
  return d.affected;
}

// Admin#8 — sparkline zaman-seriyası.
export async function fetchStatsDaily(days = 30){
  return api('/admin/stats-daily?days=' + days);
}

// Admin#3 — taksonomiya sırasının toplu yenilənməsi.
export async function reorderTaxonomy(typeKey, ids){
  await api(`/taxonomies/${typeKey}/reorder`, { method: 'POST', body: { ids } });
  emit('refresh-logs');
}

// Admin#11 — CSV ixracı. Fayl Worker-dən stream gəlir; brauzer endirməni özü aparır.
export function exportCsvUrl(kind){ return `/api/admin/export/${kind}.csv`; }
export async function adminTempPassword(uid, password){
  await api(`/admin/users/${uid}/temp-password`, { method: 'POST', body: { password } });
}

/* ================= notifications ================= */

/**
 * QLOBAL abunə — nişan sayğacı və canlı toast üçün. Login boyu işləyir.
 *
 * ⚠ `limit=20`: bu dövrə SƏHİFƏ üçün deyil, yalnız "yeni nə var?" sualı
 *   üçündür. Əvvəl serverin 60-lıq default-u çəkilirdi — 8 saniyədə bir 60
 *   sətir, yəni bildiriş səhifəsi AÇIQ OLMASA BELƏ. Sayğac üçün 20 kifayətdir;
 *   səhifənin öz siyahısı ayrıca `fetchNotifs()` ilə gəlir.
 */
export function watchNotifs(cb){
  return startPoll({
    fetcher: () => api('/notifications?limit=20'),
    interval: 8000,
    events: ['refresh-notifs'],
    // 🔴 `pinned` DƏ ƏLAVƏ OLUNUR. Server sabitlənmiş sətirləri əsas axından
    //    ÇIXARIR (bax `listNotifs` şərhi) — yalnız `notifications` oxunsaydı
    //    sabitlənmiş oxunmamış bildiriş nişan sayğacına DÜŞMƏZDİ və rəqəm
    //    səhifədəki saydan az görünərdi (ölçüldü: nişan 11, səhifə 12).
    onData: d => cb((d.notifications || []).concat(d.pinned || [])),
  });
}

/**
 * Səhifə siyahısı — filtr, axtarış və kursor səhifələmə.
 * @param {{state?:string, bucket?:string, unread?:boolean, q?:string, cursor?:string|null, limit?:number}} o
 */
export async function fetchNotifs(o = {}){
  const p = new URLSearchParams();
  if(o.state) p.set('state', o.state);
  if(o.bucket && o.bucket !== 'all') p.set('bucket', o.bucket);
  if(o.unread) p.set('unread', '1');
  if(o.q) p.set('q', o.q);
  if(o.cursor) p.set('cursor', o.cursor);
  p.set('limit', String(o.limit || 40));
  return api('/notifications?' + p.toString());
}

/** Kart sayğacları — BÜTÜN bildirişlər üzrə, yüklənmiş səhifə üzrə YOX. */
export async function fetchNotifStats(){ return api('/notifications/stats'); }

/**
 * Paylaşım önizləmələri — `{ [postId]: { excerpt, image } }`.
 * ⚠ TOPLU çağırışdır: sətir-sətir çağırsaq bir ekran 40 sorğu edərdi (N+1).
 */
export async function fetchNotifPreviews(ids){
  if(!ids || !ids.length) return {};
  return (await api('/notifications/previews?ids=' + encodeURIComponent(ids.join(',')))).previews;
}

export async function markNotifRead(id){
  await api(`/notifications/${id}/read`, { method: 'POST' });
  emit('refresh-notifs');
}
export async function markAllNotifsRead(){
  await api('/notifications/read-all', { method: 'POST' });
  emit('refresh-notifs');
}
export async function deleteNotif(id){
  await api(`/notifications/${id}`, { method: 'DELETE' });
  emit('refresh-notifs');
}

/**
 * Toplu əməliyyat: `ids` (seçim rejimi) və ya `groupKey` (bütöv mövzu).
 * @param {string} action read|unread|delete|archive|unarchive|pin|unpin
 */
export async function bulkNotifs(action, { ids = null, groupKey = null } = {}){
  const body = { action };
  if(groupKey) body.groupKey = groupKey;
  else body.ids = ids || [];
  const r = await api('/notifications/bulk', { method: 'POST', body });
  emit('refresh-notifs');
  return r;
}

export async function fetchNotifMutes(){ return (await api('/notifications/mutes')).mutes; }
export async function toggleNotifMute(scope, target, muted){
  await api('/notifications/mutes', { method: 'POST', body: { scope, target, muted } });
  emit('refresh-notifs');
}

/* ================= public kolleksiyalar ================= */
export async function fetchPublicFaqs(){ return (await api('/public/faqs')).faqs; }
export async function fetchPublicTestimonials(){ return (await api('/public/testimonials')).testimonials; }
export async function fetchPublicStats(){ return api('/public/stats'); }
export async function subscribeNewsletter(email, lang){
  await api('/public/newsletter', { method: 'POST', body: { email, lang } });
}
export async function sendContactMessage({ name, email, message }){
  await api('/public/contact', { method: 'POST', body: { name, email, message } });
}

/* ---------- admin: public məzmun ---------- */
export async function fetchAllFaqs(){ return (await api('/admin/faqs')).faqs; }
export async function saveFaq(id, data){
  await api('/admin/faqs', { method: 'POST', body: { id, ...data } });
}
export async function deleteFaq(id){
  await api('/admin/faqs/' + id, { method: 'DELETE' });
}
export async function fetchAllTestimonials(){ return (await api('/admin/testimonials')).testimonials; }
export async function saveTestimonial(id, data){
  await api('/admin/testimonials', { method: 'POST', body: { id, ...data } });
}
export async function deleteTestimonial(id){
  await api('/admin/testimonials/' + id, { method: 'DELETE' });
}
export function watchContactMessages(cb){
  return startPoll({
    fetcher: () => api('/admin/contacts'),
    interval: 20000,
    events: ['refresh-contacts'],
    onData: d => cb(d.contacts),
  });
}
export async function markContactRead(id){
  await api(`/admin/contacts/${id}/read`, { method: 'POST' });
  emit('refresh-contacts');
}
export async function seedPublicContent(faqs, testimonials){
  let n = 0;
  for(const f of faqs){ await saveFaq(f.id, f); n++; }
  for(const t of testimonials){ await saveTestimonial(t.id, t); n++; }
  return n;
}

/* ================= fayllar (R2) ================= */
export const MSG_FILE_MAX = 2 * 1024 * 1024;

async function uploadFile(blobOrFile, kind, fallbackName){
  const form = new FormData();
  const name = (blobOrFile && blobOrFile.name) || fallbackName || 'file';
  form.append('file', blobOrFile, name);
  return api('/upload?kind=' + kind, { method: 'POST', form });
}

export async function uploadAvatar(blob){
  const d = await uploadFile(blob, 'avatar', 'avatar.jpg');
  return d.url;
}
// TASK-11 — komanda fayl arxivi. `kind=team` server tərəfdə sənəd formatlarını
// da qəbul edir (10 MB) və açarı `teams/{teamId}/{category}/...` kimi qurur.
export const TEAM_FILE_MAX = 10 * 1024 * 1024;
export async function uploadTeamFile(file, teamId, category = 'documents'){
  if(file.size > TEAM_FILE_MAX) throw new Error(t('dyn.file_too_big_10'));
  const form = new FormData();
  form.append('file', file, file.name || 'file');
  return api(`/upload?kind=team&teamId=${encodeURIComponent(teamId)}&category=${encodeURIComponent(category)}`, {
    method: 'POST', form,
  });
}

export async function uploadMessageFile(file){
  if(file.size > MSG_FILE_MAX) throw new Error(t('dyn.file_too_big_2'));
  const d = await uploadFile(file, 'msg', file.name);
  return {
    fileUrl: d.url, fileName: d.fileName, fileSize: d.fileSize, mimeType: d.mimeType,
    type: d.mimeType.startsWith('image/') ? 'image' : 'file',
  };
}
export async function deleteMyAvatar(){
  await updateMyProfile({ photoURL: null }).catch(() => {});
}
