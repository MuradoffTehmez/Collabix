-- 0020_drop_demo_seed.sql
--
-- AUDIT-2026-07-26 / H-7 → AUDIT-TASK-5 §5.3
--
-- PROBLEM: demo seed datası İSTEHSAL miqrasiyalarına yerləşdirilmişdi
-- (0015_seed_teams, 0016_seed_chat_room, 0017_seed_chat_room_fk_fix,
-- 0018_seed_fix_admin_permissions). Saxta "Team Owner" istifadəçisi canlı
-- saytda istifadəçi siyahısında, kataloqda, axtarışda, publicStats
-- sayğacında və XP liderliyində görünürdü. 0018 isə demo `role_1` rolunu
-- `manage_team` ilə eskalasiya edirdi (AUDIT-TASK-3 §5-də qeyd olundu).
--
-- ⚠ BU MİQRASİYA SƏTİR SİLİR VƏ GERİ DÖNMƏZDİR.
--
-- Silmədən əvvəl AUDIT-TASK-5 §5.1 real-data bağlılığı yoxlaması aparıldı
-- (2026-07-27, həm --local, həm --remote):
--   • demo komandalarda REAL istifadəçi üzvlüyü ...... 0
--   • demo otaqda (tcr_1) mesaj ...................... 0
--   • saxta istifadəçinin izləyici/post/şərh/DM/like .. 0
--   • saxta istifadəçinin SESSİYALARI ................ 0  ← hadisə yoxdur
-- Lokal bazadakı yeganə bağlılıq E2E hesablarıdır (e2e_main, e2e_zara) və
-- onlar 0020-dən sonra `e2e/seed.ts`-in ÖZ komandalarına keçir (§5.4).
-- İxrac: silmədən əvvəl bütün demo sətirlər repo-dan KƏNAR arxivə yazıldı.
--
-- ⚠ QƏSDƏN SİLİNMİR — 0002_seed.sql-in BOOTSTRAP datası:
--     rooms('general')  ← qlobal söhbət otağı, tətbiqin işləməsi üçün lazımdır
--     taxonomies, faqs, testimonials
--   Bunlar demo deyil: onlarsız tətbiq ÇÖKÜR (AUDIT-TASK-5 §2.b).
--   Bax həmçinin 0021_restore_bootstrap_rooms.sql.
--
-- Silmə sırası FK asılılığına görədir: YARPAQDAN KÖKƏ.
-- `teams`/`users` üzərində ON DELETE CASCADE var, lakin bir sıra sosial cədvəldə
-- FK YOXDUR (follows, bookmarks, notifications, presence, progress, ...) —
-- onlar kaskadla təmizlənmir və AÇIQ şəkildə silinməlidir, əks halda orphan qalır.
--
-- Hər ifadə idempotentdir (`DELETE ... WHERE`) — təkrar icra zərərsizdir.
-- Silmə HƏMİŞƏ ID üzrədir, AD üzrə DEYİL: real istifadəçi eyniadlı komanda
-- yaratmış ola bilər (AUDIT-TASK-5 §5.3).

-- ─── 1. Komanda alt obyektləri (team_id → teams) ───
DELETE FROM team_files            WHERE team_id IN ('team_1','team_2','team_3');
DELETE FROM team_posts            WHERE team_id IN ('team_1','team_2','team_3');
DELETE FROM team_invites          WHERE team_id IN ('team_1','team_2','team_3');
DELETE FROM team_activity         WHERE team_id IN ('team_1','team_2','team_3');
DELETE FROM team_chat_rooms       WHERE team_id IN ('team_1','team_2','team_3');

-- Layihə alt obyektləri (project_id → team_projects) — layihələrdən ƏVVƏL.
DELETE FROM team_project_members  WHERE project_id IN (SELECT id FROM team_projects WHERE team_id IN ('team_1','team_2','team_3'));
DELETE FROM team_project_requests WHERE project_id IN (SELECT id FROM team_projects WHERE team_id IN ('team_1','team_2','team_3'));
DELETE FROM team_tasks            WHERE project_id IN (SELECT id FROM team_projects WHERE team_id IN ('team_1','team_2','team_3'));
DELETE FROM team_projects         WHERE team_id IN ('team_1','team_2','team_3');

-- ─── 2. Üzvlüklər və rollar ───
DELETE FROM team_members WHERE team_id IN ('team_1','team_2','team_3');
DELETE FROM team_roles   WHERE team_id IN ('team_1','team_2','team_3');

-- ─── 3. Komandalar ───
DELETE FROM teams WHERE id IN ('team_1','team_2','team_3');

-- ─── 4. Demo söhbət otağı ───
-- ⚠ YALNIZ 'tcr_1'. 'general' otağı BURADA YOXDUR və olmamalıdır.
DELETE FROM room_messages WHERE room_id = 'tcr_1';
DELETE FROM rooms         WHERE id = 'tcr_1';

-- ─── 5. Saxta istifadəçiyə bağlı FK-SIZ sətirlər ───
-- Bu cədvəllərdə FOREIGN KEY yoxdur → `users` sətri silinsə kaskad İŞLƏMİR
-- və orphan qalar (audit: "bir sıra sosial cədvəldə FK yox").
DELETE FROM follows       WHERE follower_id = 'team_owner_123' OR target_id   = 'team_owner_123';
DELETE FROM bookmarks     WHERE user_id     = 'team_owner_123';
DELETE FROM comment_likes WHERE user_id     = 'team_owner_123';
DELETE FROM post_shares   WHERE user_id     = 'team_owner_123';
DELETE FROM notifications WHERE user_id     = 'team_owner_123' OR from_id     = 'team_owner_123';
DELETE FROM presence      WHERE user_id     = 'team_owner_123';
DELETE FROM progress      WHERE user_id     = 'team_owner_123';
DELETE FROM reports       WHERE reporter_id = 'team_owner_123' OR target_id   = 'team_owner_123';
DELETE FROM admins        WHERE user_id     = 'team_owner_123';
DELETE FROM tasks         WHERE created_by  = 'team_owner_123';
DELETE FROM dm_threads    WHERE user_a      = 'team_owner_123' OR user_b      = 'team_owner_123';

-- ─── 6. Saxta istifadəçi ───
-- `posts`, `comments`, `sessions`, `likes`, `submissions`, `user_stats`,
-- `user_activity`, `oauth_accounts`, `user_mfa`, `mfa_backup_codes` cədvəllərində
-- FK CASCADE var → bu sətirlə birlikdə avtomatik təmizlənir.
-- FTS indeksləri əl ilə təmizlənmir: 0012-dəki `users_fts_ad` (AFTER DELETE ON
-- users), `posts_fts_ad` və `comments_fts_ad` trigger-ləri indeksi sinxron
-- saxlayır. Yəni silinən istifadəçi axtarışda FANTOM nəticə vermir.
-- Aggregate sayğac da düzəliş tələb etmir: `publicStats` canlı `COUNT(*)`
-- işlədir (routes.ts), ayrıca saxlanılan sayğac cədvəli yoxdur.
DELETE FROM users WHERE id = 'team_owner_123';
