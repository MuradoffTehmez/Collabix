#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — BİRDƏFƏLİK YAMAQ: repost/sitat engagement-i
// ═══════════════════════════════════════════════════════════════════════════
//
//   node seed/patch-repost-engagement.mjs            → lokal D1
//   SEED_CONFIRM_REMOTE=yes node seed/patch-repost-engagement.mjs --remote
//
// 🔴 NƏYİ DÜZƏLDİR: generatorun əvvəlki sürümündə repost/sitat sətirləri
//    bəyənmə/şərh fazalarından SONRA yaradılırdı, ona görə heç vaxt reaksiya
//    almırdılar — canlı lentin başı tamamilə 0 bəyənmə / 0 şərh olan repost
//    divarı kimi açılırdı (sənəd §45-in qadağan etdiyi "ölü demo" görüntüsü).
//    Generator artıq düzəldilib (repost bloku şərh/bəyənmədən ƏVVƏLƏ keçdi);
//    bu skript isə BAZADA MÖVCUD datanı yenidən yaratmadan düzəldir.
//
// ⚠ İDEMPOTENT: yalnız `like_count = 0 AND comment_count = 0` olan repost/sitat
//   sətirlərinə toxunur. İkinci qaçış heç nə etmir.
//
// ⚠ TÖRƏMƏ DATA DA YAZILIR — bildiriş, XP jurnalı, sayğaclar. Yalnız bəyənmə
//   sətirləri əlavə etsəydik, profil statistikası və XP baza ilə ziddiyyətə
//   düşərdi (sənəd §31 consistency tələbi).

import { openDb } from './db.mjs';
import { DEMO_PREFIX, XP, ENGAGEMENT, REACTION_TYPES } from './config.mjs';
import { NOW, id, pick, pickN, randInt, chance, weighted, timeAfter, dateStr, reseed } from './rand.mjs';
import { makeComment, makeReply, makeMention } from './content/comments.mjs';
import { makePost, pickTopic, TOPICS } from './content/posts.mjs';

const REMOTE = process.argv.includes('--remote');

if (process.env.COLLABIX_ENV === 'production') {
  console.error('❌ Yamaq production mühitində işlədilə bilməz (COLLABIX_ENV=production).');
  process.exit(1);
}
if (REMOTE && process.env.SEED_CONFIRM_REMOTE !== 'yes') {
  console.error('❌ `--remote` canlı D1-ə yazır.');
  console.error('   Davam etmək üçün: SEED_CONFIRM_REMOTE=yes node seed/patch-repost-engagement.mjs --remote');
  process.exit(1);
}

/* 🔴 PRNG AXINI DƏYİŞDİRİLİR. `rand.mjs` determinist mulberry32-dir və eyni
 *    toxumdan başlayır; bu skript generatorla EYNİ toxumdan qaçsaydı `id()`
 *    ARDICILLIĞINI TƏKRARLAYARDI. Ölçülmüş nəticə: yaradılan şərhlərin bir
 *    hissəsi mövcud sətirlərlə eyni id aldı, `INSERT OR IGNORE` onları səssizcə
 *    atdı və cavablar KÖHNƏ (daha gec yazılmış) şərhlərə bağlandı — audit
 *    "Cavab valideyn şərhdən sonradır" ilə kəsildi. Ayrı toxum bunu aradan
 *    qaldırır və yamaq öz-özlüyündə determinist qalır. */
reseed(20260812 ^ 0x9E3779B1);

const db = openDb({ remote: REMOTE });
const U = `(SELECT id FROM users WHERE username LIKE '${DEMO_PREFIX}%')`;
const ENG = Object.fromEntries(ENGAGEMENT.map(e => [e.name, e]));

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  COLLABIX — repost/sitat engagement yamağı                ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log(`   Hədəf: ${REMOTE ? '☁️  REMOTE D1 (+ lokal güzgü)' : '💻 lokal D1'}\n`);

// ── 1. İstifadəçi hovuzu (temporal consistency üçün qoşulma vaxtı ilə) ─────
// ⚠ `users` cədvəlində `profession` sütunu YOXDUR (peşə `skill_meta`/`status`
//   içindədir) — `makePost` isə yalnız `author.profession` sahəsinə baxır, ona
//   görə mətn kontekstinə sabit dəyər ötürülür.
const people = db.query(
  `SELECT id, name, username, joined_at FROM users
    WHERE username LIKE '${DEMO_PREFIX}%' ORDER BY joined_at ASC`,
);
const byId = new Map(people.map(p => [p.id, p]));
const joinTimes = people.map(p => Number(p.joined_at));

/** `ts` anında artıq qeydiyyatdan keçmiş istifadəçilər (sənəd §32). */
function existingAt(ts) {
  let lo = 0, hi = joinTimes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (joinTimes[mid] <= ts) lo = mid + 1; else hi = mid;
  }
  return people.slice(0, lo);
}

// ── 2. Yamaqlanacaq repost/sitatlar + orijinalın mövzusu ──────────────────
const targets = db.query(`
  SELECT r.id, r.author_id, r.created_at, r.post_type,
         o.id AS orig_id, o.author_id AS orig_author, o.tags AS orig_tags, o.text AS orig_text
    FROM posts r
    JOIN posts o ON o.id = r.shared_post_id
   WHERE r.post_type IN ('repost','quote')
     AND r.author_id IN ${U}
     AND r.like_count = 0 AND r.comment_count = 0
   ORDER BY r.created_at ASC
`);
console.log(`  📌 yamaqlanacaq repost/sitat: ${targets.length.toLocaleString('az-AZ')}`);
if (!targets.length) { console.log('\n✅ Yamağa ehtiyac yoxdur.'); db.close(); process.exit(0); }

/* Repostun engagement sinfi — generatordakı `REPOST_ENGAGEMENT` ilə EYNİ.
   İki yerdə saxlamaq istənilən deyil, lakin bu skript birdəfəlikdir və
   generatorun içindəki siyahı ixrac olunmur. */
const REPOST_ENGAGEMENT = [
  { name: 'none',    w: 30 },
  { name: 'low',     w: 45 },
  { name: 'normal',  w: 20 },
  { name: 'popular', w:  5 },
];

const ACCRUAL_MS = 4 * 86_400_000;
const maturityOf = at => Math.min(1, Math.max(0.05, (NOW - at) / ACCRUAL_MS));

/** Azərbaycan hərfləri → şərh dili orijinalla uyğun olsun. */
const isAz = t => /[əğıöşçüĞÜÖŞÇİƏ]/.test(String(t || ''));

/** Orijinalın teqindən mövzu açarı — tapılmasa təsadüfi mövzu. */
const TOPIC_KEYS = Object.keys(TOPICS);
function topicOf(tagsJson) {
  try {
    for (const t of JSON.parse(tagsJson || '[]')) {
      const k = String(t).toLowerCase();
      if (TOPIC_KEYS.includes(k)) return k;
    }
  } catch { /* boş */ }
  return pickTopic();
}

// ── 3. XP tavanları — MÖVCUD jurnaldan oxunur ─────────────────────────────
//
// ⚠ Tavanı sıfırdan saymaq olmaz: istifadəçinin həmin gün onsuz da XP-si var.
//   Cari istifadəni bazadan yükləyib üstünə əlavə edirik, əks halda demo XP
//   real sistemin verə bilməyəcəyi dəyərə çıxardı (sənəd §24).
const dailyUsed = new Map();       // uid|date|source → xp
const dailyTotalUsed = new Map();  // uid|date        → xp
for (const r of db.query(
  `SELECT uid, source, date(created_at/1000,'unixepoch') AS d, SUM(amount) AS a
     FROM xp_logs WHERE uid IN ${U} GROUP BY uid, source, d`,
)) {
  dailyUsed.set(`${r.uid}|${r.d}|${r.source}`, Number(r.a));
  const tk = `${r.uid}|${r.d}`;
  dailyTotalUsed.set(tk, (dailyTotalUsed.get(tk) || 0) + Number(r.a));
}

let xpRows = 0;
function grantXp(uid, source, refId, amount, at) {
  const date = dateStr(at);
  const capKey = `${uid}|${date}|${source}`;
  const totalKey = `${uid}|${date}`;
  const cap = XP.daily[source];
  if (cap != null) {
    const used = dailyUsed.get(capKey) || 0;
    if (used + amount > cap) return false;
    const total = dailyTotalUsed.get(totalKey) || 0;
    if (total + amount > XP.dailyTotal) return false;
    dailyUsed.set(capKey, used + amount);
    dailyTotalUsed.set(totalKey, total + amount);
  }
  db.insert('xp_logs', { id: id(), uid, source, ref_id: refId, amount, created_at: at });
  xpRows++;
  return true;
}

// ── 4. Bildiriş köməkçisi — generatorun formatı ilə eyni ──────────────────
let notifCount = 0;
const PRIORITY_SET = new Set(['mention', 'team_invite', 'team_project_request', 'admin']);
const groupKeyFor = (type, fromId, postId) =>
  (type === 'dm' ? 'dm:' + (fromId || '') : type === 'follow' ? 'follow'
    : postId ? type + ':' + postId : type + ':' + (fromId || ''));

function notify(toId, fromId, type, text, postId, createdAt) {
  if (!toId || toId === fromId) return;
  const from = byId.get(fromId);
  db.insert('notifications', {
    id: id(), user_id: toId, type, from_id: fromId, from_name: from ? from.name : '',
    post_id: postId ?? null, text,
    read: (NOW - createdAt) > 3 * 86_400_000 ? (chance(0.88) ? 1 : 0) : (chance(0.35) ? 1 : 0),
    archived: chance(0.05) ? 1 : 0,
    priority: PRIORITY_SET.has(type) ? 1 : 0,
    group_key: groupKeyFor(type, fromId, postId),
    event_key: null,
    created_at: createdAt,
  });
  notifCount++;
}

// ── 5. Əsas dövr ──────────────────────────────────────────────────────────
let likeCount = 0, reactionCount = 0, commentCount = 0, replyCount = 0, bookmarkCount = 0;

for (const t of targets) {
  const at = Number(t.created_at);
  const cfg = ENG[weighted(REPOST_ENGAGEMENT).name];
  const mat = maturityOf(at);
  const candidates = existingAt(at).filter(p => p.id !== t.author_id);
  if (candidates.length < 3) continue;

  // Şərh mətni üçün kontekst: orijinalın mövzusundan qurulur, dili isə
  // orijinalın öz mətnindən götürülür (qarışıq dil süni görünərdi).
  const content = makePost(topicOf(t.orig_tags), { profession: 'Developer' });
  content.lang = isAz(t.orig_text) ? 'az' : 'en';

  // ── bəyənmələr ──
  const wanted = Math.min(Math.round(randInt(...cfg.likes) * mat), candidates.length);
  const likers = [];
  for (const liker of pickN(candidates, wanted)) {
    const lat = timeAfter(at, 30_000, 5 * 86_400_000);
    if (lat === null) continue;
    db.insert('likes', { post_id: t.id, user_id: liker.id, created_at: lat });
    likers.push({ id: liker.id, at: lat });
    likeCount++;
    /* ⚠ `ref_id` MÜTLƏQ `<postId>:<likerUid>` olmalıdır — `xp_logs`-da
       UNIQUE(uid, source, ref_id) var və generator da məhz bu açarı işlədir.
       Yalnız post id-si yazsaq bir postun bütün bəyənmələri TƏK XP sətrinə
       yığılardı (ölçüldü: 34 055 sətirdən yalnız 11 877-si yazıldı). */
    grantXp(t.author_id, 'like_received', `${t.id}:${liker.id}`, XP.values.like_received, lat);
  }
  for (const l of pickN(likers, randInt(0, Math.min(4, likers.length)))) {
    db.insert('post_reactions', { post_id: t.id, user_id: l.id, type: pick(REACTION_TYPES), created_at: l.at });
    reactionCount++;
  }
  for (const l of pickN(likers, Math.min(likers.length, randInt(1, 3)))) {
    notify(t.author_id, l.id, 'like', 'paylaşımını bəyəndi', t.id, l.at);
  }

  // ── şərhlər + cavablar ──
  const n = Math.round(randInt(...cfg.comments) * mat);
  const roots = [];
  for (let i = 0; i < n; i++) {
    const cAuthor = pick(candidates);
    const cat = timeAfter(at, 120_000, 4 * 86_400_000);
    if (cat === null) continue;
    const mention = chance(0.06) ? pick(candidates) : null;
    const text = mention && mention.id !== cAuthor.id
      ? makeMention(content, mention.username)
      : makeComment(content);
    const cid = id();
    db.insert('comments', {
      id: cid, post_id: t.id, author_id: cAuthor.id, author_name: cAuthor.name,
      text, like_count: 0, parent_comment_id: null, created_at: cat,
    });
    roots.push({ id: cid, authorId: cAuthor.id, createdAt: cat });
    commentCount++;
    grantXp(cAuthor.id, 'comment', cid, XP.values.comment, cat);
    if (mention && mention.id !== cAuthor.id) notify(mention.id, cAuthor.id, 'mention', 'səni qeyd etdi', t.id, cat);
    else if (chance(0.8)) notify(t.author_id, cAuthor.id, 'comment', 'paylaşımına şərh yazdı', t.id, cat);
  }
  for (const parent of roots) {
    if (!chance(0.28)) continue;
    let lastAt = parent.createdAt;
    for (let d = 0, depth = randInt(1, 2); d < depth; d++) {
      const rAuthor = pick(candidates);
      const rat = timeAfter(lastAt, 60_000, 86_400_000);
      if (rat === null) break;
      const rid = id();
      db.insert('comments', {
        id: rid, post_id: t.id, author_id: rAuthor.id, author_name: rAuthor.name,
        text: makeReply(content), like_count: 0, parent_comment_id: parent.id, created_at: rat,
      });
      replyCount++;
      grantXp(rAuthor.id, 'comment', rid, XP.values.comment, rat);
      notify(parent.authorId, rAuthor.id, 'comment', 'şərhinə cavab yazdı', t.id, rat);
      lastAt = rat;
    }
  }

  // ── saxlama — yaxşı sitatlar saxlanılır ──
  if (t.post_type === 'quote' && chance(0.25)) {
    for (const u of pickN(candidates, Math.max(1, Math.round(randInt(1, 6) * mat)))) {
      db.insert('bookmarks', {
        user_id: u.id, post_id: t.id,
        created_at: timeAfter(at, 60_000, 6 * 86_400_000) ?? at + 60_000,
      });
      bookmarkCount++;
    }
  }
}
db.flush();

console.log(`  ✅ bəyənmə: ${likeCount.toLocaleString('az-AZ')}`);
console.log(`  ✅ reaksiya: ${reactionCount.toLocaleString('az-AZ')}`);
console.log(`  ✅ şərh: ${commentCount.toLocaleString('az-AZ')} · cavab: ${replyCount.toLocaleString('az-AZ')}`);
console.log(`  ✅ saxlama: ${bookmarkCount.toLocaleString('az-AZ')}`);
console.log(`  ✅ bildiriş: ${notifCount.toLocaleString('az-AZ')} · XP sətri: ${xpRows.toLocaleString('az-AZ')}`);

// ── 6. Sayğaclar YENİDƏN HESABLANIR (yazılmır — sənəd §31) ────────────────
console.log('\n  🔄 sayğaclar mənbədən yenidən hesablanır…');
db.exec(`UPDATE posts SET like_count = (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) WHERE author_id IN ${U}`);
db.exec(`UPDATE posts SET comment_count = (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) WHERE author_id IN ${U}`);
db.exec(`UPDATE posts SET share_count = (SELECT COUNT(*) FROM post_shares WHERE post_shares.post_id = posts.id) WHERE author_id IN ${U}`);
db.exec(`UPDATE users SET xp = (SELECT COALESCE(SUM(amount),0) FROM xp_logs WHERE xp_logs.uid = users.id) WHERE username LIKE '${DEMO_PREFIX}%'`);
db.exec(`
  INSERT INTO user_stats (uid, posts, comments, likes_given, likes_received, followers, following, updated_at)
  SELECT u.id,
    (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id),
    (SELECT COUNT(*) FROM comments c WHERE c.author_id = u.id),
    (SELECT COUNT(*) FROM likes l WHERE l.user_id = u.id),
    (SELECT COUNT(*) FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author_id = u.id),
    (SELECT COUNT(*) FROM follows f WHERE f.target_id = u.id),
    (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id),
    ${NOW}
  FROM users u WHERE u.username LIKE '${DEMO_PREFIX}%'
  ON CONFLICT(uid) DO UPDATE SET
    posts = excluded.posts, comments = excluded.comments,
    likes_given = excluded.likes_given, likes_received = excluded.likes_received,
    followers = excluded.followers, following = excluded.following,
    updated_at = excluded.updated_at
`);
db.close();

console.log('\n✅ Yamaq tamamlandı. Yoxlama: npm run seed:audit');
