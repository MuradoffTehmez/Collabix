#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Reset
// ═══════════════════════════════════════════════════════════════════════════
//
//   node seed/reset.mjs             → lokal D1-dən demo datanı silir
//   node seed/reset.mjs --remote    → remote D1-dən silir (təsdiq tələb edir)
//
// 🔴 YALNIZ DEMO DATA SİLİNİR. Ayırıcı əlamətlər:
//     users.username LIKE 'demo_%'
//     teams.slug     LIKE 'demo_%'
//     invites.code   LIKE 'DEMO-%'
//     team_files.path LIKE 'demo/%'
//   E2E datası (`e2e_*`) və real hesablar TOXUNULMUR.
//
// ⚠ SİLMƏ SIRASI FK ASILILIĞINA GÖRƏDİR (uşaq → valideyn). `PRAGMA
//   foreign_keys = ON` aktivdir, ona görə səhv sıra FOREIGN KEY constraint
//   səhvi verir — bu, sükutla yarımçıq silinmədən YAXŞIDIR.
//
// ⚠ ƏVVƏLKİ SÜRÜMDƏ YEDDİ SÜTUN ADI SƏHV İDİ (`presence.uid`,
//   `warnings.user_id`, …). Bu fayl artıq sxemi ÇALIŞMADAN ƏVVƏL yoxlayır:
//   uyğunsuz sütun varsa skript heç nə silmədən dayanır.

import { openDb } from './db.mjs';
import { DEMO_PREFIX } from './config.mjs';

const REMOTE = process.argv.includes('--remote');

if (process.env.COLLABIX_ENV === 'production') {
  console.error('❌ Reset production mühitində işlədilə bilməz (COLLABIX_ENV=production).');
  process.exit(1);
}
if (REMOTE && process.env.SEED_CONFIRM_REMOTE !== 'yes') {
  console.error('❌ `--remote` canlı D1-dən silir.');
  console.error('   Davam etmək üçün: SEED_CONFIRM_REMOTE=yes node seed/reset.mjs --remote');
  process.exit(1);
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  COLLABIX — Demo data reset                               ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log(`   Hədəf: ${REMOTE ? '☁️  REMOTE D1' : '💻 lokal D1'}\n`);

const db = openDb({ remote: REMOTE });

const U = `(SELECT id FROM users WHERE username LIKE '${DEMO_PREFIX}%')`;
const T = `(SELECT id FROM teams WHERE slug LIKE '${DEMO_PREFIX}%')`;
const P = `(SELECT id FROM posts WHERE author_id IN ${U})`;
const PROJ = `(SELECT id FROM team_projects WHERE team_id IN ${T})`;
const TT = `(SELECT id FROM team_tasks WHERE project_id IN ${PROJ})`;
const DRILL = `(SELECT id FROM tasks WHERE created_by IN ${U})`;
const ROOMS = `(SELECT id FROM team_chat_rooms WHERE team_id IN ${T})`;

/**
 * Silmə addımları — `[cədvəl, WHERE şərti]`.
 * Sıra dəyişdirilməməlidir.
 */
const STEPS = [
  // ── İş sahəsi: task alt cədvəlləri əvvəl ────────────────────────────────
  ['task_time_logs',        `WHERE task_id IN ${TT}`],
  ['task_watchers',         `WHERE task_id IN ${TT}`],
  ['task_dependencies',     `WHERE task_id IN ${TT} OR depends_on_id IN ${TT}`],
  ['task_activity',         `WHERE task_id IN ${TT}`],
  ['task_comments',         `WHERE task_id IN ${TT}`],
  ['task_checklist',        `WHERE task_id IN ${TT}`],
  ['task_label_links',      `WHERE task_id IN ${TT}`],
  ['task_attachments',      `WHERE task_id IN ${TT}`],
  ['team_tasks',            `WHERE project_id IN ${PROJ}`],
  ['task_labels',           `WHERE team_id IN ${T}`],
  // ⚠ `task_saved_views` komandaya YOX, İSTİFADƏÇİYƏ bağlıdır (`user_id`).
  ['task_saved_views',      `WHERE user_id IN ${U}`],
  ['task_automations',      `WHERE team_id IN ${T}`],
  ['sprints',               `WHERE team_id IN ${T}`],
  ['team_project_members',  `WHERE project_id IN ${PROJ}`],
  ['team_project_requests', `WHERE project_id IN ${PROJ}`],
  ['team_projects',         `WHERE team_id IN ${T}`],
  ['team_files',            `WHERE team_id IN ${T} OR path LIKE 'demo/%'`],
  ['team_posts',            `WHERE team_id IN ${T}`],
  ['team_activity',         `WHERE team_id IN ${T}`],
  ['team_invites',          `WHERE team_id IN ${T}`],
  ['room_messages',         `WHERE room_id IN ${ROOMS} OR author_id IN ${U}`],
  ['message_reactions',     `WHERE user_id IN ${U}`],
  ['message_bookmarks',     `WHERE user_id IN ${U}`],
  // ⚠ `message_archives` otaq id-sini `scope_id` sütununda saxlayır.
  ['message_archives',      `WHERE scope_id IN ${ROOMS}`],
  ['team_chat_rooms',       `WHERE team_id IN ${T}`],
  ['rooms',                 `WHERE id IN ${ROOMS} OR created_by IN ${U}`],
  ['team_members',          `WHERE team_id IN ${T}`],
  ['team_roles',            `WHERE team_id IN ${T}`],
  ['teams',                 `WHERE slug LIKE '${DEMO_PREFIX}%'`],

  // ── Öyrənmə ─────────────────────────────────────────────────────────────
  ['submissions',           `WHERE task_id IN ${DRILL} OR user_id IN ${U}`],
  ['tasks',                 `WHERE created_by IN ${U}`],

  // ── Sosial məzmun ───────────────────────────────────────────────────────
  ['poll_votes',            `WHERE user_id IN ${U} OR poll_id IN (SELECT id FROM polls WHERE post_id IN ${P})`],
  ['poll_options',          `WHERE poll_id IN (SELECT id FROM polls WHERE post_id IN ${P})`],
  ['polls',                 `WHERE post_id IN ${P}`],
  ['comment_reactions',     `WHERE user_id IN ${U} OR comment_id IN (SELECT id FROM comments WHERE post_id IN ${P})`],
  ['comment_likes',         `WHERE user_id IN ${U} OR comment_id IN (SELECT id FROM comments WHERE post_id IN ${P})`],
  ['comment_reports',       `WHERE reporter_id IN ${U} OR post_id IN ${P}`],
  ['comments',              `WHERE author_id IN ${U} OR post_id IN ${P}`],
  ['post_reactions',        `WHERE user_id IN ${U} OR post_id IN ${P}`],
  ['post_reports',          `WHERE reporter_id IN ${U} OR post_id IN ${P}`],
  ['post_shares',           `WHERE user_id IN ${U} OR post_id IN ${P}`],
  ['bookmarks',             `WHERE user_id IN ${U} OR post_id IN ${P}`],
  ['likes',                 `WHERE user_id IN ${U} OR post_id IN ${P}`],
  // ⚠ Repost sətirləri də `posts`-dadır və `shared_post_id` ilə bir-birinə
  //   bağlıdır; müəllif filtri onsuz da hamısını tutur (repost müəllifi də
  //   demo istifadəçidir).
  ['posts',                 `WHERE author_id IN ${U}`],
  ['follows',               `WHERE follower_id IN ${U} OR target_id IN ${U}`],

  // ── Mesajlaşma ──────────────────────────────────────────────────────────
  ['dm_messages',           `WHERE from_id IN ${U} OR to_id IN ${U}`],
  ['dm_threads',            `WHERE user_a IN ${U} OR user_b IN ${U}`],

  // ── İstifadəçiyə bağlı törəmələr ────────────────────────────────────────
  ['notifications',         `WHERE user_id IN ${U} OR from_id IN ${U}`],
  ['notification_mutes',    `WHERE user_id IN ${U}`],
  ['xp_logs',               `WHERE uid IN ${U}`],
  ['reputation_logs',       `WHERE uid IN ${U}`],
  ['badge_logs',            `WHERE uid IN ${U}`],
  ['achievement_logs',      `WHERE uid IN ${U}`],
  ['progress',              `WHERE user_id IN ${U}`],
  ['profile_views',         `WHERE uid IN ${U}`],
  ['user_activity',         `WHERE uid IN ${U}`],
  ['user_stats',            `WHERE uid IN ${U}`],
  // ⚠ `user_permissions` sütunu `uid`-dir, `user_id` DEYİL.
  ['user_permissions',      `WHERE uid IN ${U}`],
  ['presence',              `WHERE user_id IN ${U}`],
  ['sessions',              `WHERE uid IN ${U}`],
  ['user_mfa',              `WHERE uid IN ${U}`],
  ['mfa_backup_codes',      `WHERE uid IN ${U}`],
  ['oauth_accounts',        `WHERE uid IN ${U}`],
  ['security_events',       `WHERE uid IN ${U}`],
  ['activities',            `WHERE uid IN ${U} OR actor_id IN ${U}`],
  ['media',                 `WHERE uid IN ${U}`],
  ['moderator_applications', `WHERE uid IN ${U}`],
  ['invite_redemptions',    `WHERE invitee_uid IN ${U}`],
  ['invites',               `WHERE code LIKE 'DEMO-%' OR inviter_uid IN ${U}`],
  ['warnings',              `WHERE uid IN ${U} OR by_uid IN ${U}`],
  ['bans',                  `WHERE uid IN ${U} OR by_uid IN ${U}`],
  ['mutes',                 `WHERE uid IN ${U} OR by_uid IN ${U}`],
  ['reports',               `WHERE reporter_id IN ${U} OR target_id IN ${U}`],
  ['admin_logs',            `WHERE by_id IN ${U} OR target_id IN ${U}`],
  ['admins',                `WHERE user_id IN ${U}`],

  // ── İstifadəçilər (SON) ─────────────────────────────────────────────────
  ['users',                 `WHERE username LIKE '${DEMO_PREFIX}%'`],
];

// ── Sxem yoxlaması ────────────────────────────────────────────────────────
//
// Cədvəl/sütun adı səhvdirsə skript BURADA dayanır — yarımçıq silmə olmur.
const missing = [];
for (const [table] of STEPS) {
  try { db.columns(table); } catch { missing.push(table); }
}
if (missing.length) {
  console.error(`❌ Bu cədvəllər bazada yoxdur: ${missing.join(', ')}`);
  console.error('   Miqrasiyalar tətbiq edilib? `npm run db:migrate:local`');
  process.exit(1);
}

// ── Silmə ─────────────────────────────────────────────────────────────────
const before = db.count('users', `WHERE username LIKE '${DEMO_PREFIX}%'`);
if (!before && !REMOTE) {
  console.log('ℹ️  Silinəcək demo istifadəçi tapılmadı.\n');
}

let totalDeleted = 0;
for (const [table, where] of STEPS) {
  const n = REMOTE ? 0 : db.count(table, where);
  db.exec(`DELETE FROM "${table}" ${where}`);
  db.flush();
  if (n > 0) {
    console.log(`   🗑  ${table.padEnd(24)} ${n.toLocaleString('az-AZ')}`);
    totalDeleted += n;
  }
}

// Aqreqatları yenilə — silinmiş sətirlər sayğaclarda qalmasın.
for (const [metric, sql] of [
  ['users_total', 'SELECT COUNT(*) AS c FROM users'],
  ['posts_total', 'SELECT COUNT(*) AS c FROM posts'],
  ['comments_total', 'SELECT COUNT(*) AS c FROM comments'],
  ['teams_total', 'SELECT COUNT(*) AS c FROM teams'],
  ['reports_open', "SELECT COUNT(*) AS c FROM reports WHERE status = 'open'"],
  ['users_blocked', 'SELECT COUNT(*) AS c FROM users WHERE blocked = 1'],
]) {
  const v = REMOTE ? 0 : Number(db.one(sql)?.c || 0);
  db.exec(`INSERT OR REPLACE INTO stats_rollup (metric, value, updated_at) VALUES ('${metric}', ${v}, ${Date.now()})`);
}
db.exec(`DELETE FROM stats_daily WHERE date >= '${new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10)}'`);

db.close();

console.log(`\n✅ Reset tamamlandı — ${totalDeleted.toLocaleString('az-AZ')} sətir silindi.`);
console.log('   ℹ️  E2E datası (e2e_*) və real hesablar toxunulmayıb.\n');
