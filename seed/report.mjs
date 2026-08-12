#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Yekun hesabat (sənəd §48 və §23)
// ═══════════════════════════════════════════════════════════════════════════
//
//   node seed/report.mjs            → terminala yazır
//   node seed/report.mjs --md       → seed/SEED-REPORT.md faylına da yazır
//
// 🔴 BÜTÜN RƏQƏMLƏR SORĞU İLƏ HESABLANIR. Sənəd §19 sabit yazılmış statistikanı
//    qadağan edir: burada heç bir dəyər əl ilə verilmir, hamısı `COUNT`/`SUM`
//    nəticəsidir. Data dəyişəndə hesabat avtomatik dəyişir.
//
// ⚠ BU GÖSTƏRİCİLƏR REAL İSTİFADƏÇİ STATİSTİKASI DEYİL (sənəd §24 qadağası).
//    Hesabatın başlığı bunu açıq yazır və mətn hər yerdə "sintetik demo"
//    ifadəsini saxlayır.

import { openDb } from './db.mjs';
import { DEMO_PREFIX, TIMELINE_DAYS, LEVEL } from './config.mjs';
import { writeFileSync } from 'node:fs';

const db = openDb({ remote: false });
const NOW = Date.now();
const U = `(SELECT id FROM users WHERE username LIKE '${DEMO_PREFIX}%')`;
const WRITE_MD = process.argv.includes('--md');

const out = [];
const say = s => { out.push(s); console.log(s); };
const num = v => Number(v || 0).toLocaleString('az-AZ');
const one = sql => Number(db.one(sql)?.c ?? 0);

const todayUtc = (() => { const d = new Date(NOW); d.setUTCHours(0, 0, 0, 0); return d.getTime(); })();
const days = Array.from({ length: TIMELINE_DAYS }, (_, i) => {
  const start = todayUtc - (TIMELINE_DAYS - 1 - i) * 86_400_000;
  return { start, end: start + 86_400_000, date: new Date(start).toISOString().slice(0, 10), no: i + 1 };
});

say('# Collabix — demo seed hesabatı');
say('');
say('> ⚠️ **Bu göstəricilər demo mühitində sintetik məlumatlar əsasında hazırlanmış');
say('> simulyasiya nəticələridir.** Real istifadəçi statistikası, real müştəri sayı,');
say('> real platforma aktivliyi və ya real gəlir kimi təqdim edilə bilməz.');
say('');
say(`- Hesabat tarixi: **${new Date(NOW).toISOString().replace('T', ' ').slice(0, 19)} UTC**`);
say(`- Miqyas səviyyəsi: **${LEVEL.label}**`);
say(`- Zaman pəncərəsi: **${days[0].date} … ${days[days.length - 1].date}** (${TIMELINE_DAYS} gün)`);
say('');

// ═══════════════════════════════════════════════════════════════════════════
say('## 1. Ümumi həcm');
say('');
say('| Obyekt | Say |');
say('|---|---:|');

const VOLUME = [
  ['Sintetik istifadəçilər', `SELECT COUNT(*) c FROM users WHERE username LIKE '${DEMO_PREFIX}%'`],
  ['— aktiv (son 15 gün)', `SELECT COUNT(DISTINCT uid) c FROM user_activity WHERE uid IN ${U}`],
  ['— təsdiqlənmiş', `SELECT COUNT(*) c FROM users WHERE username LIKE '${DEMO_PREFIX}%' AND verified = 1`],
  ['Postlar (cəmi)', `SELECT COUNT(*) c FROM posts WHERE author_id IN ${U}`],
  ['— orijinal', `SELECT COUNT(*) c FROM posts WHERE author_id IN ${U} AND post_type = 'original'`],
  ['— repost', `SELECT COUNT(*) c FROM posts WHERE author_id IN ${U} AND post_type = 'repost'`],
  ['— sitat', `SELECT COUNT(*) c FROM posts WHERE author_id IN ${U} AND post_type = 'quote'`],
  ['Şərhlər (kök)', `SELECT COUNT(*) c FROM comments WHERE author_id IN ${U} AND parent_comment_id IS NULL`],
  ['Cavablar', `SELECT COUNT(*) c FROM comments WHERE author_id IN ${U} AND parent_comment_id IS NOT NULL`],
  ['Bəyənmələr (post)', 'SELECT COUNT(*) c FROM likes'],
  ['Bəyənmələr (şərh)', 'SELECT COUNT(*) c FROM comment_likes'],
  ['Reaksiyalar', 'SELECT COUNT(*) c FROM post_reactions'],
  ['Saxlamalar', 'SELECT COUNT(*) c FROM bookmarks'],
  ['Paylaşımlar (repost qeydi)', 'SELECT COUNT(*) c FROM post_shares'],
  ['İzləmə əlaqələri', 'SELECT COUNT(*) c FROM follows'],
  ['Bildirişlər', 'SELECT COUNT(*) c FROM notifications'],
  ['— oxunmamış', 'SELECT COUNT(*) c FROM notifications WHERE read = 0'],
  ['DM söhbətləri', 'SELECT COUNT(*) c FROM dm_threads'],
  ['DM mesajları', 'SELECT COUNT(*) c FROM dm_messages'],
  ['Komandalar', `SELECT COUNT(*) c FROM teams WHERE slug LIKE '${DEMO_PREFIX}%'`],
  ['Komanda üzvlükləri', 'SELECT COUNT(*) c FROM team_members'],
  ['Layihələr', 'SELECT COUNT(*) c FROM team_projects'],
  ['Komanda tapşırıqları', 'SELECT COUNT(*) c FROM team_tasks'],
  ['Sprintlər', 'SELECT COUNT(*) c FROM sprints'],
  ['Tapşırıq şərhləri', 'SELECT COUNT(*) c FROM task_comments'],
  ['Öyrənmə çalışmaları', 'SELECT COUNT(*) c FROM tasks'],
  ['Çalışma təqdimatları', 'SELECT COUNT(*) c FROM submissions'],
  ['Otaq mesajları', 'SELECT COUNT(*) c FROM room_messages'],
  ['Fayllar', 'SELECT COUNT(*) c FROM team_files'],
  ['Sorğular', 'SELECT COUNT(*) c FROM polls'],
  ['Sorğu səsləri', 'SELECT COUNT(*) c FROM poll_votes'],
  ['XP jurnal sətirləri', 'SELECT COUNT(*) c FROM xp_logs'],
  ['Nişan verilmələri', 'SELECT COUNT(*) c FROM badge_logs'],
  ['Nailiyyətlər', 'SELECT COUNT(*) c FROM achievement_logs'],
  ['Şikayətlər (istifadəçi)', 'SELECT COUNT(*) c FROM reports'],
  ['Şikayətlər (post)', 'SELECT COUNT(*) c FROM post_reports'],
  ['Şikayətlər (şərh)', 'SELECT COUNT(*) c FROM comment_reports'],
  ['Admin audit sətirləri', 'SELECT COUNT(*) c FROM admin_logs'],
  ['Təhlükəsizlik hadisələri', 'SELECT COUNT(*) c FROM security_events'],
  ['Sessiyalar', 'SELECT COUNT(*) c FROM sessions'],
  ['Aktivlik günləri (heatmap)', 'SELECT COUNT(*) c FROM user_activity'],
];
for (const [label, sql] of VOLUME) say(`| ${label} | ${num(one(sql))} |`);
say('');

// Tag statistikası — `posts.tags` JSON massivdir, ona görə LIKE ilə sayılır.
const tagRows = db.query(`
  SELECT value AS tag, COUNT(*) c FROM posts, json_each(posts.tags)
   WHERE posts.author_id IN ${U}
   GROUP BY value ORDER BY c DESC LIMIT 15
`);
if (tagRows.length) {
  say('### Ən çox işlədilən teqlər');
  say('');
  say('| Teq | Post sayı |');
  say('|---|---:|');
  for (const r of tagRows) say(`| \`#${r.tag}\` | ${num(r.c)} |`);
  say('');
  say(`Fərqli teq sayı: **${num(one(`SELECT COUNT(DISTINCT value) c FROM posts, json_each(posts.tags) WHERE posts.author_id IN ${U}`))}**`);
  say('');
}

// ═══════════════════════════════════════════════════════════════════════════
say('## 2. 15 günlük aktivlik xətti');
say('');
say('| Gün | Tarix | DAU | Yeni | Post | Şərh | Bəyənmə | DM | Tapşırıq | Təqdimat |');
say('|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|');

const daily = [];
for (const d of days) {
  const row = {
    date: d.date,
    no: d.no,
    dau: one(`SELECT COUNT(DISTINCT uid) c FROM user_activity WHERE date = '${d.date}' AND uid IN ${U}`),
    newUsers: one(`SELECT COUNT(*) c FROM users WHERE username LIKE '${DEMO_PREFIX}%' AND joined_at >= ${d.start} AND joined_at < ${d.end}`),
    posts: one(`SELECT COUNT(*) c FROM posts WHERE author_id IN ${U} AND created_at >= ${d.start} AND created_at < ${d.end}`),
    comments: one(`SELECT COUNT(*) c FROM comments WHERE author_id IN ${U} AND created_at >= ${d.start} AND created_at < ${d.end}`),
    likes: one(`SELECT COUNT(*) c FROM likes WHERE created_at >= ${d.start} AND created_at < ${d.end}`),
    dms: one(`SELECT COUNT(*) c FROM dm_messages WHERE created_at >= ${d.start} AND created_at < ${d.end}`),
    tasks: one(`SELECT COUNT(*) c FROM team_tasks WHERE created_at >= ${d.start} AND created_at < ${d.end}`),
    subs: one(`SELECT COUNT(*) c FROM submissions WHERE submitted_at >= ${d.start} AND submitted_at < ${d.end}`),
  };
  daily.push(row);
  say(`| ${row.no} | ${row.date} | ${num(row.dau)} | ${num(row.newUsers)} | ${num(row.posts)} `
    + `| ${num(row.comments)} | ${num(row.likes)} | ${num(row.dms)} | ${num(row.tasks)} | ${num(row.subs)} |`);
}
say('');

// ASCII qrafik — hesabat mətn faylında da oxunaqlı olsun.
const maxPosts = Math.max(...daily.map(d => d.posts), 1);
say('```');
say('Gündəlik post həcmi');
for (const d of daily) {
  const bar = '█'.repeat(Math.max(1, Math.round(d.posts / maxPosts * 44)));
  say(`${d.date}  ${String(d.posts).padStart(4)}  ${bar}`);
}
say('```');
say('');

// ═══════════════════════════════════════════════════════════════════════════
say('## 3. DAU / WAU / MAU və engagement');
say('');

const totalUsers = one(`SELECT COUNT(*) c FROM users WHERE username LIKE '${DEMO_PREFIX}%'`);
const dauAvg = daily.reduce((a, d) => a + d.dau, 0) / daily.length;
const last7 = days.slice(-7);
const wau = one(`SELECT COUNT(DISTINCT uid) c FROM user_activity WHERE uid IN ${U} AND date >= '${last7[0].date}'`);
const mau = one(`SELECT COUNT(DISTINCT uid) c FROM user_activity WHERE uid IN ${U}`);
const newInWindow = one(`SELECT COUNT(*) c FROM users WHERE username LIKE '${DEMO_PREFIX}%' AND joined_at >= ${days[0].start}`);
const returning = mau - newInWindow;
const totalPosts = one(`SELECT COUNT(*) c FROM posts WHERE author_id IN ${U}`);
const totalComments = one(`SELECT COUNT(*) c FROM comments WHERE author_id IN ${U}`);
const totalLikes = one('SELECT COUNT(*) c FROM likes');
const interactions = totalLikes + totalComments + one('SELECT COUNT(*) c FROM post_shares');

say('| Göstərici | Dəyər | İzah |');
say('|---|---:|---|');
say(`| DAU (ortalama) | ${dauAvg.toFixed(1)} | 15 günün ortalaması |`);
say(`| DAU (ən yüksək) | ${num(Math.max(...daily.map(d => d.dau)))} | ${daily.find(d => d.dau === Math.max(...daily.map(x => x.dau))).date} |`);
say(`| DAU (ən aşağı) | ${num(Math.min(...daily.map(d => d.dau)))} | ${daily.find(d => d.dau === Math.min(...daily.map(x => x.dau))).date} |`);
say(`| WAU (son 7 gün) | ${num(wau)} | fərqli aktiv istifadəçi |`);
say(`| MAU (pəncərə) | ${num(mau)} | 15 gün ərzində ən azı bir dəfə aktiv |`);
say(`| Stickiness (DAU/MAU) | ${(dauAvg / Math.max(1, mau) * 100).toFixed(1)}% | gündəlik/aylıq nisbət |`);
say(`| Yeni istifadəçilər | ${num(newInWindow)} | pəncərə daxilində qoşulanlar |`);
say(`| Qayıdan istifadəçilər | ${num(returning)} | pəncərədən əvvəl qoşulub aktiv olanlar |`);
say(`| Aktivləşmə nisbəti | ${(mau / Math.max(1, totalUsers) * 100).toFixed(1)}% | aktiv / cəmi |`);
say(`| Post / gün | ${(totalPosts / TIMELINE_DAYS).toFixed(1)} | |`);
say(`| Şərh / gün | ${(totalComments / TIMELINE_DAYS).toFixed(1)} | |`);
say(`| Şərh / post | ${(totalComments / Math.max(1, totalPosts)).toFixed(2)} | |`);
say(`| Bəyənmə / post | ${(totalLikes / Math.max(1, totalPosts)).toFixed(2)} | |`);
say(`| Engagement / post | ${(interactions / Math.max(1, totalPosts)).toFixed(2)} | bəyənmə + şərh + paylaşım |`);
say('');

// ═══════════════════════════════════════════════════════════════════════════
say('## 4. Paylanmalar');
say('');

say('### Engagement sinifləri (sənəd §6)');
say('');
say('| Sinif | Post sayı | Pay |');
say('|---|---:|---:|');
const engRows = db.query(`
  SELECT CASE
    WHEN like_count >= 90 THEN 'Viral (90+)'
    WHEN like_count >= 35 THEN 'Populyar (35–89)'
    WHEN like_count >= 9  THEN 'Normal (9–34)'
    WHEN like_count >= 1  THEN 'Aşağı (1–8)'
    ELSE 'Reaksiyasız' END AS bucket, COUNT(*) c
  FROM posts WHERE author_id IN ${U} AND post_type = 'original'
  GROUP BY bucket ORDER BY c DESC`);
const engTotal = engRows.reduce((a, r) => a + Number(r.c), 0);
for (const r of engRows) say(`| ${r.bucket} | ${num(r.c)} | ${(r.c / engTotal * 100).toFixed(1)}% |`);
say('');

say('### Tapşırıq statusları (sənəd §17)');
say('');
say('| Status | Say | Pay |');
say('|---|---:|---:|');
const taskRows = db.query('SELECT status, COUNT(*) c FROM team_tasks GROUP BY status ORDER BY c DESC');
const taskTotal = taskRows.reduce((a, r) => a + Number(r.c), 0);
for (const r of taskRows) say(`| ${r.status} | ${num(r.c)} | ${(r.c / taskTotal * 100).toFixed(1)}% |`);
say('');

say('### Bildiriş tipləri (sənəd §19)');
say('');
say('| Tip | Say | Oxunmamış |');
say('|---|---:|---:|');
for (const r of db.query(`
  SELECT type, COUNT(*) c, SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) unread
    FROM notifications GROUP BY type ORDER BY c DESC`)) {
  say(`| ${r.type} | ${num(r.c)} | ${num(r.unread)} |`);
}
say('');

say('### XP mənbələri (sənəd §24)');
say('');
say('| Mənbə | Sətir | Cəmi XP |');
say('|---|---:|---:|');
for (const r of db.query(`
  SELECT source, COUNT(*) c, SUM(amount) total FROM xp_logs
   WHERE uid IN ${U} GROUP BY source ORDER BY total DESC`)) {
  say(`| ${r.source} | ${num(r.c)} | ${num(r.total)} |`);
}
say('');

say('### İstifadəçi aktivlik paylanması (sənəd §2 Pareto)');
say('');
say('| Post sayı aralığı | İstifadəçi | Pay |');
say('|---|---:|---:|');
const distRows = db.query(`
  SELECT CASE
    WHEN posts = 0 THEN 'post yazmayıb'
    WHEN posts <= 5 THEN '1–5'
    WHEN posts <= 15 THEN '6–15'
    WHEN posts <= 40 THEN '16–40'
    WHEN posts <= 100 THEN '41–100'
    ELSE '100+' END AS bucket, COUNT(*) c
  FROM user_stats WHERE uid IN ${U} GROUP BY bucket`);
const order = ['post yazmayıb', '1–5', '6–15', '16–40', '41–100', '100+'];
const distTotal = distRows.reduce((a, r) => a + Number(r.c), 0);
for (const key of order) {
  const r = distRows.find(x => x.bucket === key);
  if (r) say(`| ${key} | ${num(r.c)} | ${(r.c / distTotal * 100).toFixed(1)}% |`);
}
const topShare = db.query(`
  SELECT posts FROM user_stats WHERE uid IN ${U} ORDER BY posts DESC`).map(r => Number(r.posts));
const top5pct = topShare.slice(0, Math.ceil(topShare.length * 0.05)).reduce((a, b) => a + b, 0);
const allPosts = topShare.reduce((a, b) => a + b, 0) || 1;
say('');
say(`Ən aktiv **5%** istifadəçi bütün postların **${(top5pct / allPosts * 100).toFixed(1)}%**-ni yazıb.`);
say('');

// ═══════════════════════════════════════════════════════════════════════════
say('## 5. Leaderboard (ilk 15)');
say('');
say('| # | İstifadəçi | Ad | XP | Post | Şərh | Alınan bəyənmə | İzləyici |');
say('|---:|---|---|---:|---:|---:|---:|---:|');
let rank = 0;
for (const r of db.query(`
  SELECT u.username, u.name, u.xp, s.posts, s.comments, s.likes_received, s.followers
    FROM users u LEFT JOIN user_stats s ON s.uid = u.id
   WHERE u.username LIKE '${DEMO_PREFIX}%'
   ORDER BY u.xp DESC LIMIT 15`)) {
  say(`| ${++rank} | \`${r.username}\` | ${r.name} | ${num(r.xp)} | ${num(r.posts)} `
    + `| ${num(r.comments)} | ${num(r.likes_received)} | ${num(r.followers)} |`);
}
say('');

// ═══════════════════════════════════════════════════════════════════════════
say('## 6. Məzmun keyfiyyəti');
say('');
const uniquePosts = one(`SELECT COUNT(DISTINCT text) c FROM posts WHERE author_id IN ${U} AND post_type = 'original' AND text != ''`);
const totalOriginal = one(`SELECT COUNT(*) c FROM posts WHERE author_id IN ${U} AND post_type = 'original' AND text != ''`);
const uniqueComments = one(`SELECT COUNT(DISTINCT text) c FROM comments WHERE author_id IN ${U}`);
say('| Göstərici | Dəyər |');
say('|---|---:|');
say(`| Unikal post mətni | ${num(uniquePosts)} / ${num(totalOriginal)} (${(uniquePosts / Math.max(1, totalOriginal) * 100).toFixed(1)}%) |`);
say(`| Unikal şərh mətni | ${num(uniqueComments)} / ${num(totalComments)} (${(uniqueComments / Math.max(1, totalComments) * 100).toFixed(1)}%) |`);
say(`| Kod bloku olan post | ${num(one(`SELECT COUNT(*) c FROM posts WHERE author_id IN ${U} AND blocks LIKE '%"code"%'`))} |`);
say(`| Ortalama post uzunluğu (simvol) | ${Math.round(Number(db.one(`SELECT AVG(LENGTH(search_text)) a FROM posts WHERE author_id IN ${U} AND post_type = 'original'`)?.a || 0))} |`);
say(`| Fərqli peşə | ${num(one(`SELECT COUNT(DISTINCT company) c FROM users WHERE username LIKE '${DEMO_PREFIX}%'`))} |`);
say(`| Fərqli ölkə | ${num(one(`SELECT COUNT(DISTINCT country) c FROM users WHERE username LIKE '${DEMO_PREFIX}%'`))} |`);
say('');

db.close();

if (WRITE_MD) {
  writeFileSync('seed/SEED-REPORT.md', out.join('\n') + '\n', 'utf8');
  console.log('\n📄 seed/SEED-REPORT.md yazıldı.');
}
