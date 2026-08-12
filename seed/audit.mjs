#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Post-seed audit (sənəd §43)
// ═══════════════════════════════════════════════════════════════════════════
//
//   node seed/audit.mjs
//
// Yoxlanılanlar: sınıq xarici açarlar, yetim sətirlər, dublikatlar, etibarsız
// tarixlər, mənfi sayğaclar, XP invariantı, statistika uyğunluğu.
//
// 🔴 AUDİT MƏLUMATI DÜZƏLTMİR. Tapıntı olarsa səbəbi göstərilir və çıxış kodu
//    1 olur — sənəd §45: "sadəcə data əlavə etməklə buqu gizlətmə".

import { openDb } from './db.mjs';
import { DEMO_PREFIX, TIMELINE_DAYS } from './config.mjs';

const db = openDb({ remote: false });
const NOW = Date.now();
const U = `(SELECT id FROM users WHERE username LIKE '${DEMO_PREFIX}%')`;

let pass = 0, fail = 0, warn = 0;
const failures = [];

/** Sıfır olmalı sorğu — nəticə varsa qüsurdur. */
function mustBeEmpty(name, sql, hint = '') {
  const rows = db.query(sql + ' LIMIT 5');
  if (!rows.length) { console.log(`  ✅ ${name}`); pass++; return; }
  console.log(`  ❌ ${name}`);
  for (const r of rows) console.log(`       ${JSON.stringify(r)}`);
  if (hint) console.log(`       ↳ ${hint}`);
  fail++;
  failures.push(name);
}

/** Say hədəf aralığında olmalıdır. */
function inRange(name, value, min, max) {
  const ok = value >= min && (max == null || value <= max);
  console.log(`  ${ok ? '✅' : '⚠️ '} ${name}: ${value.toLocaleString('az-AZ')}` +
    ` (hədəf ${min.toLocaleString('az-AZ')}${max != null ? '–' + max.toLocaleString('az-AZ') : '+'})`);
  if (ok) pass++; else warn++;
}

function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`); }

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  COLLABIX — Demo seed audit                               ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

// ═══════════════════════════════════════════════════════════════════════════
section('HƏCM (sənəd §1 miqyas)');

const n = t => db.count(t);
const demoUsers = db.count('users', `WHERE username LIKE '${DEMO_PREFIX}%'`);
const demoPosts = db.count('posts', `WHERE author_id IN ${U}`);
const demoComments = db.count('comments', `WHERE author_id IN ${U}`);
const replies = db.count('comments', `WHERE author_id IN ${U} AND parent_comment_id IS NOT NULL`);
const rootComments = demoComments - replies;

inRange('İstifadəçilər', demoUsers, 100);
inRange('Postlar', demoPosts, 300);
inRange('Şərhlər (kök)', rootComments, 1000);
inRange('Cavablar', replies, 200);
inRange('Bəyənmələr', db.count('likes'), 5000);
inRange('Saxlamalar', db.count('bookmarks'), 500);
inRange('Repostlar', db.count('post_shares'), 200);
inRange('İzləmələr', db.count('follows'), 1000);
inRange('Bildirişlər', db.count('notifications'), 2000);
inRange('DM mesajları', db.count('dm_messages'), 1000);
inRange('Komandalar', db.count('teams', `WHERE slug LIKE '${DEMO_PREFIX}%'`), 10);
inRange('Layihələr', n('team_projects'), 20);
inRange('Tapşırıqlar', n('team_tasks'), 200);
inRange('Öyrənmə çalışmaları', n('tasks'), 30);
inRange('Təqdimatlar', n('submissions'), 200);
inRange('Fayllar', n('team_files'), 30);
inRange('XP jurnalı', n('xp_logs'), 1000);
inRange('Sorğular', n('polls'), 5);

// ═══════════════════════════════════════════════════════════════════════════
section('XARİCİ AÇARLAR VƏ YETİM SƏTİRLƏR');

mustBeEmpty('Post müəllifi mövcuddur',
  'SELECT p.id FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE u.id IS NULL');
mustBeEmpty('Şərh postu mövcuddur',
  'SELECT c.id FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE p.id IS NULL');
mustBeEmpty('Şərh müəllifi mövcuddur',
  'SELECT c.id FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE u.id IS NULL');
mustBeEmpty('Cavabın valideyn şərhi mövcuddur',
  `SELECT c.id FROM comments c WHERE c.author_id IN ${U} AND c.parent_comment_id IS NOT NULL `
  + 'AND c.parent_comment_id NOT IN (SELECT id FROM comments)');
mustBeEmpty('Bəyənmə postu mövcuddur',
  'SELECT l.post_id FROM likes l LEFT JOIN posts p ON l.post_id = p.id WHERE p.id IS NULL');
mustBeEmpty('Bəyənən istifadəçi mövcuddur',
  'SELECT l.user_id FROM likes l LEFT JOIN users u ON l.user_id = u.id WHERE u.id IS NULL');
mustBeEmpty('İzləmə tərəfləri mövcuddur',
  'SELECT f.follower_id FROM follows f LEFT JOIN users a ON f.follower_id = a.id '
  + 'LEFT JOIN users b ON f.target_id = b.id WHERE a.id IS NULL OR b.id IS NULL');
mustBeEmpty('Repost orijinalı mövcuddur',
  'SELECT id FROM posts WHERE shared_post_id IS NOT NULL AND shared_post_id NOT IN (SELECT id FROM posts)');
mustBeEmpty('post_shares → repost sətri mövcuddur',
  'SELECT repost_id FROM post_shares WHERE repost_id NOT IN (SELECT id FROM posts)');
mustBeEmpty('Bildiriş alıcısı mövcuddur',
  'SELECT n.id FROM notifications n LEFT JOIN users u ON n.user_id = u.id WHERE u.id IS NULL');
mustBeEmpty('DM mesajının söhbəti mövcuddur',
  'SELECT m.id FROM dm_messages m LEFT JOIN dm_threads t ON m.pair_id = t.pair_id WHERE t.pair_id IS NULL');
mustBeEmpty('Komanda üzvünün rolu mövcuddur',
  'SELECT m.id FROM team_members m LEFT JOIN team_roles r ON m.role_id = r.id WHERE r.id IS NULL');
mustBeEmpty('Layihənin komandası mövcuddur',
  'SELECT p.id FROM team_projects p LEFT JOIN teams t ON p.team_id = t.id WHERE t.id IS NULL');
mustBeEmpty('Tapşırığın layihəsi mövcuddur',
  'SELECT t.id FROM team_tasks t LEFT JOIN team_projects p ON t.project_id = p.id WHERE p.id IS NULL');
mustBeEmpty('Təyin olunmuş icraçı mövcuddur',
  'SELECT t.id FROM team_tasks t WHERE t.assignee_id IS NOT NULL AND t.assignee_id NOT IN (SELECT id FROM users)');
mustBeEmpty('Təqdimatın çalışması mövcuddur',
  'SELECT s.task_id FROM submissions s LEFT JOIN tasks t ON s.task_id = t.id WHERE t.id IS NULL');
mustBeEmpty('Sorğu variantının sorğusu mövcuddur',
  'SELECT o.id FROM poll_options o LEFT JOIN polls p ON o.poll_id = p.id WHERE p.id IS NULL');
mustBeEmpty('Səsin variantı mövcuddur',
  'SELECT v.poll_id FROM poll_votes v LEFT JOIN poll_options o ON v.option_id = o.id WHERE o.id IS NULL');
mustBeEmpty('Otaq mesajının otağı mövcuddur',
  'SELECT m.id FROM room_messages m LEFT JOIN rooms r ON m.room_id = r.id WHERE r.id IS NULL');
mustBeEmpty('XP jurnalının istifadəçisi mövcuddur',
  'SELECT x.id FROM xp_logs x LEFT JOIN users u ON x.uid = u.id WHERE u.id IS NULL');

// ═══════════════════════════════════════════════════════════════════════════
section('DUBLİKATLAR');

mustBeEmpty('Unikal username',
  'SELECT username, COUNT(*) c FROM users GROUP BY username HAVING c > 1');
mustBeEmpty('Username məhsulun qaydasına uyğundur (3–20, a-z0-9._)',
  `SELECT username FROM users WHERE username LIKE '${DEMO_PREFIX}%' `
  + "AND (LENGTH(username) > 20 OR LENGTH(username) < 3 OR username GLOB '*[^a-z0-9._]*')",
  'worker/util.ts → validUsername: belə hesab real qeydiyyat axını ilə yaradıla bilməzdi.');
mustBeEmpty('Unikal email',
  "SELECT contact_email, COUNT(*) c FROM users WHERE contact_email != '' GROUP BY contact_email HAVING c > 1");
mustBeEmpty('Unikal komanda slug-ı',
  'SELECT slug, COUNT(*) c FROM teams GROUP BY slug HAVING c > 1');
// ⚠ DEMO SAHƏSİNƏ MƏHDUDLAŞIB: `team_tasks.task_key` köhnə e2e sətirlərində
//   NULL-dur və NULL-lar qruplaşanda "dublikat" kimi görünür. Audit YALNIZ
//   seed-in yaratdığı datanı qiymətləndirməlidir; mövcud e2e qalıqları aşağıda
//   ayrıca, məlumat xarakterli bölmədə göstərilir.
mustBeEmpty('Unikal task açarı (layihə daxilində)',
  'SELECT project_id, task_key, COUNT(*) c FROM team_tasks '
  + `WHERE task_key IS NOT NULL AND project_id IN (SELECT tp.id FROM team_projects tp `
  + `JOIN teams t ON tp.team_id = t.id WHERE t.slug LIKE '${DEMO_PREFIX}%') `
  + 'GROUP BY project_id, task_key HAVING c > 1');

// ═══════════════════════════════════════════════════════════════════════════
section('TEMPORAL UYĞUNLUQ (sənəd §32)');

mustBeEmpty('Post müəllifin qoşulmasından sonradır',
  'SELECT p.id FROM posts p JOIN users u ON p.author_id = u.id WHERE p.created_at < u.joined_at',
  'İstifadəçi mövcud olmadan post yaradılıb.');
mustBeEmpty('Şərh postdan sonradır',
  'SELECT c.id FROM comments c JOIN posts p ON c.post_id = p.id WHERE c.created_at < p.created_at');
mustBeEmpty('Cavab valideyn şərhdən sonradır',
  'SELECT c.id FROM comments c JOIN comments p ON c.parent_comment_id = p.id WHERE c.created_at < p.created_at');
mustBeEmpty('Bəyənmə postdan sonradır',
  'SELECT l.post_id FROM likes l JOIN posts p ON l.post_id = p.id WHERE l.created_at < p.created_at');
mustBeEmpty('Gələcək tarixli post yoxdur',
  `SELECT id, created_at FROM posts WHERE created_at > ${NOW}`);
mustBeEmpty('Gələcək tarixli şərh yoxdur',
  `SELECT id FROM comments WHERE created_at > ${NOW}`);
mustBeEmpty('Gələcək tarixli qoşulma yoxdur',
  `SELECT username FROM users WHERE username LIKE '${DEMO_PREFIX}%' AND joined_at > ${NOW}`,
  '`timeInDay()` gün daxilində saat seçir — "bu gün" üçün nəticə indidən sonra düşə bilər.');
mustBeEmpty('Komanda üzvlüyü komandadan sonradır',
  'SELECT m.id FROM team_members m JOIN teams t ON m.team_id = t.id WHERE m.joined_at < t.created_at');
mustBeEmpty('Təqdimat çalışmadan sonradır',
  'SELECT s.task_id FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.submitted_at < t.created_at');
mustBeEmpty('Etibarsız (sıfır/mənfi) tarix yoxdur',
  'SELECT id FROM posts WHERE created_at <= 0');

const windowStart = new Date(NOW - (TIMELINE_DAYS + 1) * 86_400_000).getTime();
const outsideWindow = db.count('posts', `WHERE author_id IN ${U} AND created_at < ${windowStart}`);
console.log(`  ${outsideWindow === 0 ? '✅' : '⚠️ '} Postlar 15 günlük pəncərədədir` +
  ` (kənarda: ${outsideWindow})`);
if (outsideWindow === 0) pass++; else warn++;

// ═══════════════════════════════════════════════════════════════════════════
section('SAYĞAC UYĞUNLUĞU (sənəd §26/§31)');

mustBeEmpty('posts.like_count = COUNT(likes)',
  'SELECT p.id, p.like_count, (SELECT COUNT(*) FROM likes WHERE post_id = p.id) actual '
  + `FROM posts p WHERE p.author_id IN ${U} `
  + 'AND p.like_count != (SELECT COUNT(*) FROM likes WHERE post_id = p.id)');
mustBeEmpty('posts.comment_count = COUNT(comments)',
  'SELECT p.id, p.comment_count, (SELECT COUNT(*) FROM comments WHERE post_id = p.id) actual '
  + `FROM posts p WHERE p.author_id IN ${U} `
  + 'AND p.comment_count != (SELECT COUNT(*) FROM comments WHERE post_id = p.id)');
mustBeEmpty('posts.share_count = COUNT(post_shares)',
  `SELECT p.id FROM posts p WHERE p.author_id IN ${U} `
  + 'AND p.share_count != (SELECT COUNT(*) FROM post_shares WHERE post_id = p.id)');
mustBeEmpty('comments.like_count = COUNT(comment_likes)',
  `SELECT c.id FROM comments c WHERE c.author_id IN ${U} `
  + 'AND c.like_count != (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id)');
mustBeEmpty('users.followers_count = COUNT(follows)',
  `SELECT u.username FROM users u WHERE u.username LIKE '${DEMO_PREFIX}%' `
  + 'AND u.followers_count != (SELECT COUNT(*) FROM follows WHERE target_id = u.id)');
mustBeEmpty('users.following_count = COUNT(follows)',
  `SELECT u.username FROM users u WHERE u.username LIKE '${DEMO_PREFIX}%' `
  + 'AND u.following_count != (SELECT COUNT(*) FROM follows WHERE follower_id = u.id)');
mustBeEmpty('user_stats.posts = COUNT(posts)',
  `SELECT s.uid FROM user_stats s WHERE s.uid IN ${U} `
  + 'AND s.posts != (SELECT COUNT(*) FROM posts WHERE author_id = s.uid)');
mustBeEmpty('user_stats.comments = COUNT(comments)',
  `SELECT s.uid FROM user_stats s WHERE s.uid IN ${U} `
  + 'AND s.comments != (SELECT COUNT(*) FROM comments WHERE author_id = s.uid)');
mustBeEmpty('user_stats.followers = COUNT(follows)',
  `SELECT s.uid FROM user_stats s WHERE s.uid IN ${U} `
  + 'AND s.followers != (SELECT COUNT(*) FROM follows WHERE target_id = s.uid)');
mustBeEmpty('user_stats.likes_received doğrudur',
  `SELECT s.uid FROM user_stats s WHERE s.uid IN ${U} AND s.likes_received != `
  + '(SELECT COUNT(*) FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author_id = s.uid)');
mustBeEmpty('team_tasks.comment_count doğrudur',
  'SELECT t.id FROM team_tasks t WHERE t.project_id IN (SELECT tp.id FROM team_projects tp '
  + `JOIN teams t2 ON tp.team_id = t2.id WHERE t2.slug LIKE '${DEMO_PREFIX}%') `
  + 'AND t.comment_count != (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id)');

// ═══════════════════════════════════════════════════════════════════════════
section('XP VƏ SƏVİYYƏ (sənəd §24/§25)');

mustBeEmpty('users.xp = SUM(xp_logs.amount)',
  'SELECT u.username, u.xp, COALESCE((SELECT SUM(amount) FROM xp_logs WHERE uid = u.id), 0) log_xp '
  + `FROM users u WHERE u.username LIKE '${DEMO_PREFIX}%' `
  + 'AND u.xp != COALESCE((SELECT SUM(amount) FROM xp_logs WHERE uid = u.id), 0)',
  'Worker `assertXpInvariant()` bu fərqi admin panelində göstərir.');
mustBeEmpty('Mənfi XP yoxdur', 'SELECT username, xp FROM users WHERE xp < 0');
mustBeEmpty('Mənfi sayğac yoxdur',
  'SELECT username FROM users WHERE followers_count < 0 OR following_count < 0 OR streak < 0');
mustBeEmpty('Mənfi post sayğacı yoxdur',
  'SELECT id FROM posts WHERE like_count < 0 OR comment_count < 0 OR share_count < 0');
mustBeEmpty('XP mənbələri qanunidir',
  "SELECT DISTINCT source FROM xp_logs WHERE source NOT IN "
  + "('post','comment','solution','profile_bonus','signup','daily_login','repost',"
  + "'like_received','invite','verified','team_task','admin','compensation')",
  'worker/xp.ts XpSource siyahısından kənar mənbə.');

// Leaderboard ardıcıllığı: XP sıralaması aktivliklə uyğun olmalıdır.
const top = db.query(
  `SELECT u.username, u.xp, s.posts, s.comments
     FROM users u JOIN user_stats s ON s.uid = u.id
    WHERE u.username LIKE '${DEMO_PREFIX}%'
    ORDER BY u.xp DESC LIMIT 10`,
);
const topAvgPosts = top.reduce((a, r) => a + Number(r.posts || 0), 0) / Math.max(1, top.length);
const allAvg = Number(db.one(
  `SELECT AVG(posts) a FROM user_stats WHERE uid IN ${U}`,
)?.a || 0);
const leaderOk = topAvgPosts > allAvg;
console.log(`  ${leaderOk ? '✅' : '❌'} Leaderboard aktivliklə uyğundur` +
  ` (top10 ort. post ${topAvgPosts.toFixed(1)} vs ümumi ${allAvg.toFixed(1)})`);
if (leaderOk) pass++; else { fail++; failures.push('Leaderboard uyğunluğu'); }

// ═══════════════════════════════════════════════════════════════════════════
section('MƏZMUN KEYFİYYƏTİ (sənəd §35)');

mustBeEmpty('Boş post gövdəsi yoxdur',
  "SELECT id FROM posts WHERE post_type = 'original' AND (blocks IS NULL OR blocks = '' OR blocks = '[]')",
  'js/feed.js kart gövdəsini `blocks`-dan qurur — boş olsa kart boş görünür.');
mustBeEmpty('Lorem ipsum / test mətni yoxdur',
  "SELECT id FROM posts WHERE lower(text) LIKE '%lorem ipsum%' OR lower(text) LIKE 'test post%' "
  + "OR lower(text) LIKE 'hello world%'");
mustBeEmpty('Boş şərh yoxdur', "SELECT id FROM comments WHERE trim(text) = ''");
mustBeEmpty('Real e-poçt domeni işlədilməyib',
  "SELECT username, contact_email FROM users WHERE contact_email NOT LIKE '%@example.com' "
  + `AND username LIKE '${DEMO_PREFIX}%'`,
  'Sənəd §39: yalnız RFC 2606 test domeni.');

/* ⚠ YALNIZ ORİJİNAL POSTLAR SAYILIR: repost/sitat sətirlərinin mətni qəsdən
   qısadır və təkrarlanan şərh cümlələridir (real platformada da belədir).
   Onları qatsaq unikallıq faizi süni şəkildə aşağı düşür və göstərici
   "məzmun təkrarlanır" kimi yanlış oxunar. */
const distinctPostText = Number(db.one(
  `SELECT COUNT(DISTINCT text) c FROM posts WHERE author_id IN ${U} AND text != '' AND post_type = 'original'`,
)?.c || 0);
const totalPostText = Number(db.one(
  `SELECT COUNT(*) c FROM posts WHERE author_id IN ${U} AND text != '' AND post_type = 'original'`,
)?.c || 0);
const uniqRatio = totalPostText ? distinctPostText / totalPostText : 1;
console.log(`  ${uniqRatio >= 0.9 ? '✅' : uniqRatio >= 0.7 ? '⚠️ ' : '❌'} ` +
  `Post mətni unikallığı: ${(uniqRatio * 100).toFixed(1)}% (${distinctPostText}/${totalPostText})`);
if (uniqRatio >= 0.9) pass++; else if (uniqRatio >= 0.7) warn++; else { fail++; failures.push('Post təkrarı'); }

const distinctComment = Number(db.one(
  `SELECT COUNT(DISTINCT text) c FROM comments WHERE author_id IN ${U}`,
)?.c || 0);
const totalComment = Math.max(1, demoComments);
console.log(`  ℹ️  Şərh mətni unikallığı: ${(distinctComment / totalComment * 100).toFixed(1)}%` +
  ` (${distinctComment} fərqli mətn / ${totalComment} şərh)`);

// ═══════════════════════════════════════════════════════════════════════════
section('PAYLANMA (sənəd §2/§6/§17)');

const engagement = db.query(`
  SELECT CASE
    WHEN like_count >= 90 THEN 'viral (90+)'
    WHEN like_count >= 35 THEN 'populyar (35-89)'
    WHEN like_count >= 9  THEN 'normal (9-34)'
    WHEN like_count >= 1  THEN 'aşağı (1-8)'
    ELSE 'sıfır' END AS bucket,
  COUNT(*) c
  FROM posts WHERE author_id IN ${U} AND post_type = 'original'
  GROUP BY bucket ORDER BY c DESC`);
console.log('  Engagement paylanması:');
for (const r of engagement) console.log(`     ${String(r.bucket).padEnd(18)} ${r.c}`);
const buckets = new Set(engagement.map(r => r.bucket));
console.log(`  ${buckets.size >= 4 ? '✅' : '⚠️ '} Ən azı 4 engagement sinfi var (${buckets.size})`);
if (buckets.size >= 4) pass++; else warn++;

const statuses = db.query('SELECT status, COUNT(*) c FROM team_tasks GROUP BY status ORDER BY c DESC');
console.log('  Task status paylanması:');
for (const r of statuses) console.log(`     ${String(r.status).padEnd(14)} ${r.c}`);
const doneShare = Number(statuses.find(s => s.status === 'Done')?.c || 0) / Math.max(1, db.count('team_tasks'));
console.log(`  ${doneShare < 0.6 ? '✅' : '⚠️ '} Tapşırıqların hamısı 'Done' deyil (${(doneShare * 100).toFixed(0)}%)`);
if (doneShare < 0.6) pass++; else warn++;

const notifTypes = db.query('SELECT type, COUNT(*) c FROM notifications GROUP BY type ORDER BY c DESC');
console.log(`  Bildiriş tipləri: ${notifTypes.length}`);
console.log(`     ${notifTypes.map(r => `${r.type}=${r.c}`).join(', ')}`);
console.log(`  ${notifTypes.length >= 8 ? '✅' : '⚠️ '} Ən azı 8 bildiriş tipi var`);
if (notifTypes.length >= 8) pass++; else warn++;

const unreadShare = db.count('notifications', 'WHERE read = 0') / Math.max(1, db.count('notifications'));
console.log(`  ${unreadShare > 0.05 && unreadShare < 0.8 ? '✅' : '⚠️ '} ` +
  `Oxunmuş/oxunmamış qarışıqdır (oxunmamış ${(unreadShare * 100).toFixed(0)}%)`);
if (unreadShare > 0.05 && unreadShare < 0.8) pass++; else warn++;

const activeDays = db.query(
  `SELECT date, COUNT(DISTINCT uid) c FROM user_activity GROUP BY date ORDER BY date`);
const dauValues = activeDays.map(r => Number(r.c));
const dauSpread = dauValues.length ? Math.max(...dauValues) - Math.min(...dauValues) : 0;
console.log(`  ${dauSpread > 0 ? '✅' : '❌'} Gündəlik aktivlik sabit deyil (fərq: ${dauSpread})`);
if (dauSpread > 0) pass++; else { fail++; failures.push('DAU dəyişkənliyi'); }

// ═══════════════════════════════════════════════════════════════════════════
section('EKRANLARIN DOLULUĞU (sənəd §44/§45)');

const screens = [
  ['Lent (public post)', `SELECT COUNT(*) c FROM posts WHERE visibility = 'public'`, 100],
  ['Kəşf (tag-lı post)', `SELECT COUNT(*) c FROM posts WHERE tags != '[]'`, 100],
  ['Profil (statistikası olan)', 'SELECT COUNT(*) c FROM user_stats WHERE posts > 0', 50],
  ['Bildirişlər', 'SELECT COUNT(*) c FROM notifications', 500],
  ['Mesajlar', 'SELECT COUNT(*) c FROM dm_threads', 50],
  ['Komandalar (açıq)', `SELECT COUNT(*) c FROM teams WHERE visibility = 'Public'`, 5],
  ['Layihələr', 'SELECT COUNT(*) c FROM team_projects', 20],
  ['Tapşırıqlar', 'SELECT COUNT(*) c FROM team_tasks', 100],
  ['Öyrənmə (təsdiqlənmiş)', "SELECT COUNT(*) c FROM tasks WHERE status = 'approved'", 20],
  ['Təqdimatlar (gözləyən)', "SELECT COUNT(*) c FROM submissions WHERE status = 'pending'", 10],
  ['Leaderboard (XP > 0)', 'SELECT COUNT(*) c FROM users WHERE xp > 0', 50],
  ['Axtarış (istifadəçi)', "SELECT COUNT(*) c FROM users WHERE search_name != ''", 50],
  ['Admin — şikayətlər', 'SELECT COUNT(*) c FROM reports', 5],
  ['Admin — audit jurnalı', 'SELECT COUNT(*) c FROM admin_logs', 20],
  ['Admin — təhlükəsizlik', 'SELECT COUNT(*) c FROM security_events', 20],
  ['Fayllar', 'SELECT COUNT(*) c FROM team_files', 20],
  ['Sorğular', 'SELECT COUNT(*) c FROM polls', 3],
  ['Nişanlar', 'SELECT COUNT(*) c FROM badge_logs', 20],
  ['Heatmap', 'SELECT COUNT(*) c FROM user_activity', 200],
  ['Sessiyalar', 'SELECT COUNT(*) c FROM sessions', 20],
];
for (const [name, sql, min] of screens) {
  const v = Number(db.one(sql)?.c || 0);
  const ok = v >= min;
  console.log(`  ${ok ? '✅' : '❌'} ${name.padEnd(28)} ${v.toLocaleString('az-AZ').padStart(8)} (min ${min})`);
  if (ok) pass++; else { fail++; failures.push(`Boş ekran: ${name}`); }
}

// ═══════════════════════════════════════════════════════════════════════════
section('HESAB BAŞINA ƏHATƏ (sənəd §45)');

/*
 * ⚠ ÜMUMİ SAY KİFAYƏT ETMİR. 60 komanda mövcud ola bilər, amma hesabların 33%-i
 *   heç birinə üzv olmasa həmin hesabla girən adam iş sahəsini BOŞ görür.
 *   Aşağıdakı yoxlamalar məhz "təsadüfi demo hesabı ilə gir və ekrana bax"
 *   ssenarisini ölçür.
 */
const coverage = [
  ['Komanda üzvlüyü olmayan', `SELECT COUNT(*) c FROM users WHERE id IN ${U} AND id NOT IN (SELECT user_id FROM team_members)`, 0],
  ['Layihə üzvlüyü olmayan', `SELECT COUNT(*) c FROM users WHERE id IN ${U} AND id NOT IN (SELECT user_id FROM team_project_members)`, 0],
  ['DM söhbəti olmayan', `SELECT COUNT(*) c FROM users WHERE id IN ${U} AND id NOT IN (SELECT user_a FROM dm_threads UNION SELECT user_b FROM dm_threads)`, 0],
  ['Saxlanılan postu olmayan', `SELECT COUNT(*) c FROM users WHERE id IN ${U} AND id NOT IN (SELECT user_id FROM bookmarks)`, 0],
  ['Bildirişi olmayan', `SELECT COUNT(*) c FROM users WHERE id IN ${U} AND id NOT IN (SELECT user_id FROM notifications)`, 0],
  ['İzləyicisi olmayan', `SELECT COUNT(*) c FROM users WHERE id IN ${U} AND followers_count = 0`, 0],
  ['XP-si olmayan', `SELECT COUNT(*) c FROM users WHERE id IN ${U} AND xp = 0`, 0],
];
for (const [name, sql, max] of coverage) {
  const v = Number(db.one(sql)?.c || 0);
  const ok = v <= max;
  console.log(`  ${ok ? '✅' : '❌'} ${name.padEnd(28)} ${String(v).padStart(4)} (icazə ≤ ${max})`);
  if (ok) pass++; else { fail++; failures.push(`Boş ekran riski: ${name} = ${v}`); }
}

// Post yazmayanlar QƏSDƏN var (passiv istifadəçilər) — yalnız məlumat.
console.log(`  ℹ️  Post yazmayan hesab (passiv, gözlənilən): ` +
  `${Number(db.one(`SELECT COUNT(*) c FROM users WHERE id IN ${U} AND id NOT IN (SELECT author_id FROM posts)`)?.c || 0)}`);

// ═══════════════════════════════════════════════════════════════════════════
section('TƏHLÜKƏSİZLİK (sənəd §51)');

mustBeEmpty('Parolsuz hesab yoxdur',
  `SELECT username FROM users WHERE username LIKE '${DEMO_PREFIX}%' AND (pass_hash = '' OR pass_hash IS NULL)`);
mustBeEmpty('Bütün hesablar unikal salt işlədir',
  `SELECT pass_salt, COUNT(*) c FROM users WHERE username LIKE '${DEMO_PREFIX}%' GROUP BY pass_salt HAVING c > 1`,
  'Eyni salt = eyni heş = bir parol açılsa hamısı açılır.');
mustBeEmpty('PBKDF2 iterasiyası düzgündür',
  `SELECT username, pass_iter FROM users WHERE username LIKE '${DEMO_PREFIX}%' AND pass_iter != 100000`);
/*
 * ⚠ Bu yoxlama YALNIZ seed-in yazdığı sətirlərə aiddir.
 *
 *   Demo hesaba sonradan brauzerdən (və ya curl ilə) REAL giriş etmək normal
 *   demo ssenarisidir və həmin sessiyanın `refresh_hash`-i real olmalıdır —
 *   əks halda hesab işləməzdi. Əvvəlki sorğu "demo istifadəçinin demo- prefiksi
 *   olmayan hər sessiyası" deyirdi, ona görə hər real giriş auditi saxta
 *   şəkildə kəsirdi.
 *
 *   Seed sətirlərinin fərqləndirici izi RFC 5737 test IP blokudur (203.0.113.x)
 *   — real girişdə IP ya boş, ya da CF-in verdiyi ünvandır.
 */
mustBeEmpty('Seed sessiyalarında real token yoxdur',
  `SELECT id FROM sessions WHERE uid IN ${U} AND ip LIKE '203.0.113.%' AND refresh_hash NOT LIKE 'demo-%'`,
  'Seed yalnız metadata yazmalıdır; etibarlı token yazsaq demo bazadan sessiya oğurlamaq mümkün olardı.');
console.log(`  ℹ️  Demo hesaba sonrakı real girişlər (gözlənilən): ` +
  `${Number(db.one(`SELECT COUNT(*) c FROM sessions WHERE uid IN ${U} AND ip NOT LIKE '203.0.113.%'`)?.c || 0)}`);
mustBeEmpty('Demo faylları demo/ prefiksindədir',
  "SELECT id, path FROM team_files WHERE path NOT LIKE 'demo/%'");

// ═══════════════════════════════════════════════════════════════════════════
section('MÖVCUD (QEYRİ-DEMO) DATA — yalnız məlumat üçün');

/*
 * ⚠ BU BÖLMƏ AUDİTİ KƏSMİR. Bazada seed-dən ƏVVƏL olan e2e/test sətirləri var
 *   (`e2e_*`, `test-*`). Onlarda uyğunsuzluq varsa bu, demo seed-in qüsuru
 *   DEYİL — lakin gizlətmək də olmaz, çünki ekranda birlikdə görünürlər.
 */
const legacyChecks = [
  ['Yetim cavab (qeyri-demo)',
    `SELECT COUNT(*) c FROM comments c WHERE c.author_id NOT IN ${U} `
    + 'AND c.parent_comment_id IS NOT NULL AND c.parent_comment_id NOT IN (SELECT id FROM comments)'],
  ['task_key = NULL (qeyri-demo)',
    'SELECT COUNT(*) c FROM team_tasks WHERE task_key IS NULL'],
  ['share_count uyğunsuzluğu (qeyri-demo)',
    `SELECT COUNT(*) c FROM posts p WHERE p.author_id NOT IN ${U} `
    + 'AND p.share_count != (SELECT COUNT(*) FROM post_shares WHERE post_id = p.id)'],
  ['Qeyri-demo istifadəçi sayı',
    `SELECT COUNT(*) c FROM users WHERE id NOT IN ${U}`],
];
for (const [name, sql] of legacyChecks) {
  console.log(`  ℹ️  ${name.padEnd(38)} ${Number(db.one(sql)?.c || 0)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
db.close();

console.log(`\n${'═'.repeat(62)}`);
console.log(`  Keçdi: ${pass}   Xəbərdarlıq: ${warn}   Kəsildi: ${fail}`);
console.log(`${'═'.repeat(62)}`);

if (fail > 0) {
  console.log('\n❌ Kəsilən yoxlamalar:');
  for (const f of failures) console.log(`   • ${f}`);
  console.log('\nSənəd §49: səhvi gizlətmə — səbəbi araşdır və yenidən seed et.\n');
  process.exit(1);
}
console.log(warn > 0
  ? '\n✅ Kritik qüsur yoxdur. Xəbərdarlıqlar yalnız həcm hədəfləri ilə bağlıdır.\n'
  : '\n🎉 Bütün yoxlamalar keçdi.\n');
