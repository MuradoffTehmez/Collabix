-- 0035 — Platforma RBAC-ının tamamlanması
--
-- İki problemi həll edir:
--   (1) 35 admin route-u binar `admins` yoxlaması ilə qorunurdu — PRD §5
--       "Backend hər əməliyyatda Permission yoxlamalıdır" tələbi pozulurdu.
--       Bəzi domenlərin (otaq, tapşırıq, FAQ, kontakt, komanda) icazəsi
--       ümumiyyətlə yox idi → 5 yeni icazə əlavə olunur.
--   (2) 🔴 GİZLİ QÜSUR: `MANAGE_ROLES` heç kimdə yoxdur.
--
-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 (2) NİYƏ KRİTİKDİR
-- ════════════════════════════════════════════════════════════════════════════
--
-- 0031 `admins` cədvəlindəki hər kəsi `ADMIN` roluna qoydu, lakin `ADMIN`
-- rolunda `MANAGE_ROLES` YOXDUR (o, SUPER_ADMIN-dən başlayır). `OWNER` isə
-- heç kimə verilmədi — 0031 yalnız ARTIQ mövcud olan 'OWNER' dəyərini
-- qoruyurdu, halbuki köhnə `users.role` sütununun default-u 'user' idi.
--
-- Nəticə: `MANAGE_ROLES`, `MANAGE_PERMISSIONS`, `MANAGE_LEVELS`, `MANAGE_ADS`
-- icazələri **HEÇ KİMDƏ** yoxdur. Yəni `setUserRole` / `setUserPermission`
-- endpoint-ləri yazılıb, lakin **çağırıla bilməz** — rol sistemi ətalətdədir.
-- Route-ları icazə modelinə köçürməzdən ƏVVƏL bu bağlanmalıdır, əks halda
-- admin idarəsi HAMI üçün bağlanardı (M-14-ün eyni sinfi).
--
-- ⚠ SEÇİM QAYDASI DETERMİNİSTİKDİR: adminlər arasında ƏN ERKƏN qoşulan hesab
--   (`joined_at ASC`) — yəni saytın qurucusu. Təsadüfi seçim və ya "hamısı
--   OWNER" təhlükəsiz deyil: OWNER bütün icazələri daşıyır.
--
-- ⚠ İDEMPOTENT: artıq OWNER varsa heç nə etmir.

-- ── 1. Çatışmayan domen icazələri ─────────────────────────────────────────
-- PRD §5-in 30 icazəsi məhsulun bütün domenlərini örtmür. Bunları mövcud
-- icazələrə "sıxışdırmaq" (məsələn hamısını MANAGE_SETTINGS etmək) icazə
-- modelini mənasızlaşdırardı — ayrıca ad daha dürüstdür.
INSERT OR IGNORE INTO permissions (name, category, label_az, created_at) VALUES
  ('MANAGE_ROOMS',    'admin',      'Söhbət otaqlarını idarə et',     0),
  ('MANAGE_TASKS',    'moderation', 'Tapşırıqları təsdiqlə/sil',      0),
  ('MANAGE_CONTENT',  'admin',      'FAQ və rəyləri idarə et',        0),
  ('MANAGE_CONTACTS', 'admin',      'Əlaqə müraciətlərini oxu',       0),
  ('MANAGE_TEAMS',    'admin',      'Komandalara admin müdaxiləsi',   0);

-- ── 2. Rol matrisinə əlavə ────────────────────────────────────────────────
-- ⚠ 0031-dəki kaskad (`SELECT ... FROM role_permissions WHERE role_name = X`)
--   BURADA TƏKRARLANA BİLMƏZ: o, bir dəfəlik idi və indi hər rol üçün açıq
--   yazılmalıdır. Əks halda MODERATOR-a verilən icazə ADMIN-ə keçməzdi.

-- Tapşırıq moderasiyası MODERATOR-dan başlayır (məzmun moderasiyasıdır).
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT r.name, 'MANAGE_TASKS' FROM roles r
 WHERE r.name IN ('MODERATOR','SENIOR_MODERATOR','ADMIN','SUPER_ADMIN','OWNER');

-- Qalan dördü inzibati domendir → ADMIN-dən başlayır.
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT r.name, p.name FROM roles r, permissions p
 WHERE r.name IN ('ADMIN','SUPER_ADMIN','OWNER')
   AND p.name IN ('MANAGE_ROOMS','MANAGE_CONTENT','MANAGE_CONTACTS','MANAGE_TEAMS');

-- ── 3. 🔴 Bootstrap OWNER ─────────────────────────────────────────────────
-- Sistemdə heç bir OWNER yoxdursa, adminlər arasında ən erkən qoşulan hesab
-- OWNER olur. Bu, `MANAGE_ROLES` zəncirini açan yeganə addımdır.
UPDATE users SET role = 'OWNER'
 WHERE id = (
   SELECT u.id FROM users u
     JOIN admins a ON a.user_id = u.id
    ORDER BY u.joined_at ASC, u.id ASC
    LIMIT 1
 )
   AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'OWNER');

-- ── 4. Audit izi ──────────────────────────────────────────────────────────
-- PRD §14 "Role Change audit log-a yazılmalıdır". Miqrasiya ilə edilən
-- dəyişiklik də izsiz qalmamalıdır.
INSERT INTO admin_logs (id, action, target_id, by_id, by_name, detail, level, created_at)
SELECT
  'mig0035-' || u.id, 'user-role-change', u.id, 'system', 'migration 0035',
  'bootstrap OWNER — MANAGE_ROLES zəncirini açmaq üçün', 'warning',
  CAST(strftime('%s','now') AS INTEGER) * 1000
FROM users u WHERE u.role = 'OWNER';
