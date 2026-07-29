-- 0031_prd_rbac.sql
--
-- AUDIT-TASK-10 / FAZA A2 — PRD §4–6, §16: rol + permission sistemi.
--
-- ════════════════════════════════════════════════════════════════════════════
-- KONTEKST — NİYƏ BU MİQRASİYA VAR
-- ════════════════════════════════════════════════════════════════════════════
--
-- Audit tapıntısı: PRD 9 rol + permission matrisi vəd edir, kodda isə
-- `users.role` sütunu var və HEÇ BİR avtorizasiya qərarında oxunmur
-- (Task 10 ölçməsi: yalnız CSV sütunu və `mapUser`). Admin yoxlaması binardır:
-- `SELECT 1 FROM admins WHERE user_id = ?` → HƏR ADMIN TAM SƏLAHİYYƏTLİDİR.
--
-- İstifadəçi qərarı (Faza 0 / Qərar A): **A2 — PRD-nin TAM icrası**.
--
-- ⚠ BU, KOMANDA RBAC-INI ƏVƏZ ETMİR. Layihədə İKİ ayrı avtorizasiya sahəsi var
--   və onlar QƏSDƏN ayrıdır:
--     • KOMANDA daxili (`team_roles`, `team_members.role_id`) — Task 3/H-1
--       ilə sərtləşdirilib, komanda sahibinin öz otağına aiddir
--     • QLOBAL sayt rolu (bu miqrasiya) — moderasiya və admin ierarxiyası
--   Bir istifadəçi qlobal `USER`, lakin öz komandasında `Owner` ola bilər.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ROLLAR
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ `priority` ƏDƏDİ MÜQAYİSƏ ÜÇÜNDÜR: "kim kimə təsir edə bilər" sualı
--   `caller.priority > target.priority` ilə cavablanır. Task 3 komanda
--   rollarında EYNİ naxışı işlədir (`team_roles.priority`) — iki fərqli model
--   saxlamaq səhv mənbəyi olardı.
--
-- ⚠ ADLAR PRD §4-dəki ENUM ilə HƏRFİ eynidir. Dəyişdirilməməlidir: kod
--   `worker/rbac.ts`-də həmin sətirlərə görə qərar verir.
CREATE TABLE IF NOT EXISTS roles (
  name        TEXT PRIMARY KEY,
  priority    INTEGER NOT NULL,
  label_az    TEXT NOT NULL,
  -- Sistem rolu silinə/redaktə edilə bilməz (PRD §4: "OWNER silinə bilməz").
  is_system   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. İCAZƏLƏR
-- ════════════════════════════════════════════════════════════════════════════
--
-- PRD §5: *"Permission DB-dən oxunmalıdır. Hardcode edilməməlidir."*
CREATE TABLE IF NOT EXISTS permissions (
  name        TEXT PRIMARY KEY,
  -- Qruplaşdırma yalnız admin panelində göstərmək üçündür.
  category    TEXT NOT NULL,
  label_az    TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Rol → icazə matrisi (PRD §6 "Default Permission Mapping").
CREATE TABLE IF NOT EXISTS role_permissions (
  role_name       TEXT NOT NULL REFERENCES roles(name) ON DELETE CASCADE,
  permission_name TEXT NOT NULL REFERENCES permissions(name) ON DELETE CASCADE,
  PRIMARY KEY (role_name, permission_name)
);

-- İSTİFADƏÇİYƏ BİRBAŞA verilən/alınan icazə (roldan kənar istisna).
--
-- ⚠ `granted` sütunu MƏCBURİDİR: PRD yalnız "əlavə et" haqqında danışır, lakin
--   rolun verdiyi icazəni KONKRET istifadəçidən ALMAQ da lazım ola bilər
--   (məs. spam-a görə `CREATE_POST` müvəqqəti alınır). `granted = 0` bunu
--   ifadə edir; olmasaydı yeganə yol rolu aşağı salmaq olardı və bu, bütün
--   digər icazələri də itirərdi.
CREATE TABLE IF NOT EXISTS user_permissions (
  uid             TEXT NOT NULL,
  permission_name TEXT NOT NULL REFERENCES permissions(name) ON DELETE CASCADE,
  granted         INTEGER NOT NULL DEFAULT 1,
  granted_by      TEXT,
  reason          TEXT DEFAULT '',
  -- NULL = müddətsiz. Müvəqqəti məhdudiyyət üçün vaxt damgası.
  expires_at      INTEGER,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (uid, permission_name)
);

CREATE INDEX IF NOT EXISTS ix_user_perms_uid ON user_permissions(uid);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. MODERASİYA (PRD §16: warnings / bans / mutes)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ Faza 0/C-də sarı qrupdakı `user_bans` bəndi BURAYA birləşdirildi —
--   ayrıca cədvəl yaratmaq dublikat olardı (bax docs/TASK-10-SCOPE.md §1.b).
CREATE TABLE IF NOT EXISTS warnings (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  by_uid      TEXT NOT NULL,
  reason      TEXT NOT NULL,
  -- Şikayətdən yaranıbsa ona bağlanır.
  report_id   TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_warnings_uid ON warnings(uid, created_at DESC);

-- Ban və mute EYNİ formadadır, lakin AYRI cədvəllərdir (PRD §16).
--
-- ⚠ `expires_at IS NULL` = DAİMİ. Aktivlik yoxlaması:
--     revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now)
--   `revoked_at` "vaxtı bitdi" ilə "ləğv edildi" hallarını AYIRIR — audit izi
--   üçün vacibdir (kim, nə vaxt geri götürdü).
CREATE TABLE IF NOT EXISTS bans (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  by_uid      TEXT NOT NULL,
  reason      TEXT NOT NULL,
  expires_at  INTEGER,
  revoked_at  INTEGER,
  revoked_by  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_bans_active ON bans(uid, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS mutes (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  by_uid      TEXT NOT NULL,
  reason      TEXT NOT NULL,
  expires_at  INTEGER,
  revoked_at  INTEGER,
  revoked_by  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_mutes_active ON mutes(uid, revoked_at, expires_at);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. JURNALLAR (PRD §16: reputation_logs / badge_logs / achievement_logs)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ `xp_logs` ARTIQ MÖVCUDDUR (AUDIT-TASK-9 / H-5) və eyni naxışı qurmuşdu:
--   idempotentlik üçün `UNIQUE(uid, source, ref_id)`. Buradakı jurnallar həmin
--   naxışı TƏKRARLAYIR — belədə "eyni hadisə iki dəfə sayılmasın" qaydası
--   bütün engine-lərdə eyni işləyir.
CREATE TABLE IF NOT EXISTS reputation_logs (
  id         TEXT PRIMARY KEY,
  uid        TEXT NOT NULL,
  source     TEXT NOT NULL,      -- 'like' | 'accepted_answer' | 'verified_report' | 'warning' | 'spam' | 'admin'
  ref_id     TEXT,
  amount     INTEGER NOT NULL,   -- müsbət və ya MƏNFİ (PRD §8: spam/warning mənfi)
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rep_logs_source
  ON reputation_logs(uid, source, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_rep_logs_uid ON reputation_logs(uid, created_at);

-- Badge kataloqu — PRD "Badge engine (server)".
-- ⚠ Audit tapıntısı: badge-lər hazırda CLIENT-SIDE STATİK MASSİVDİR, yəni
--   istifadəçi onları öz brauzerində uydura bilər. Kataloq serverə keçir.
CREATE TABLE IF NOT EXISTS badges (
  code        TEXT PRIMARY KEY,
  label_az    TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '',
  -- Qazanma şərti: 'xp' | 'posts' | 'comments' | 'tasks' | 'streak' | 'reputation'
  rule_kind   TEXT NOT NULL,
  rule_value  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS badge_logs (
  id         TEXT PRIMARY KEY,
  uid        TEXT NOT NULL,
  badge_code TEXT NOT NULL REFERENCES badges(code) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
-- Bir badge bir istifadəçiyə BİR DƏFƏ.
CREATE UNIQUE INDEX IF NOT EXISTS ux_badge_logs ON badge_logs(uid, badge_code);

CREATE TABLE IF NOT EXISTS achievements (
  code        TEXT PRIMARY KEY,
  label_az    TEXT NOT NULL,
  rule_kind   TEXT NOT NULL,
  rule_value  INTEGER NOT NULL,
  -- Açılan imkan (PRD "unlock engine"): boş = yalnız nişan.
  unlocks     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS achievement_logs (
  id               TEXT PRIMARY KEY,
  uid              TEXT NOT NULL,
  achievement_code TEXT NOT NULL REFERENCES achievements(code) ON DELETE CASCADE,
  created_at       INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_achievement_logs ON achievement_logs(uid, achievement_code);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. SƏVİYYƏ CƏDVƏLİ (PRD §7)
-- ════════════════════════════════════════════════════════════════════════════
--
-- PRD: *"Formula sonradan dəyişdirilə bilməlidir. Database-də sabit
-- saxlanılmamalıdır."* — yəni SƏVİYYƏ dəyəri istifadəçi sətrində saxlanılmır,
-- ASTANALAR isə konfiqurasiya kimi saxlanılır.
--
-- 🔴 ZİDDİYYƏT (docs/TASK-10-SCOPE.md §3.1):
--   PRD cədvəli  → Lv2 = 500 XP, Lv10 = 50 000 XP
--   Mövcud kod   → floor(sqrt(xp/100)) + 1 → Lv2 = 100 XP, Lv10 = 8 100 XP
--   Formula dəyişsə BÜTÜN mövcud istifadəçilərin səviyyəsi DÜŞƏR.
--
-- QƏRAR: PRD astanaları cədvələ yazılır, LAKİN `levels` boş qaldıqda kod
-- KÖHNƏ formulaya düşür (bax worker/level.ts). Yəni miqrasiya tətbiq olunan
-- kimi davranış dəyişmir; keçid AÇIQ addımdır və geri qaytarıla bilər.
CREATE TABLE IF NOT EXISTS levels (
  level      INTEGER PRIMARY KEY,
  min_xp     INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- ⚠ QƏSDƏN BOŞ BURAXILIR — yuxarıdakı izaha bax. Astanalar `docs/` -də
--   sənədləşdirilib və admin paneli onları doldura bilər.

-- ════════════════════════════════════════════════════════════════════════════
-- 6. users sütunları
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ `users.role` ARTIQ MÖVCUDDUR (default 'user'), lakin oxunmurdu.
--   İndi `roles.name`-ə istinad edir. FK ƏLAVƏ EDİLMİR: SQLite-də mövcud
--   cədvələ FK əlavə etmək onu YENİDƏN QURMAQ deməkdir (Task 6 §Faza D) və
--   canlı bazada data itkisi riski daşıyır. Bütövlük tətbiq qatında
--   (`worker/rbac.ts`) və seed ilə saxlanılır.
ALTER TABLE users ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0;

-- ⚠ `reputation` üçün `>= 0` MƏCBURİYYƏTİ YOXDUR: PRD §8 mənfi mənbələri
--   (spam, warning) açıq sadalayır, yəni reputasiya MƏNFİ ola bilər.
--   Bu, `xp`-dən fərqlidir (orada `users_xp_nonneg` trigger-i var).

-- ════════════════════════════════════════════════════════════════════════════
-- 7. SEED — rollar, icazələr, matris
-- ════════════════════════════════════════════════════════════════════════════
--
-- PRD §4 sırası ilə (yuxarıdan aşağı). `priority` addımı 10-dur ki, gələcəkdə
-- aralığa yeni rol əlavə etmək cədvəli yenidən nömrələməyi tələb etməsin.
INSERT OR IGNORE INTO roles (name, priority, label_az, is_system, created_at) VALUES
  ('OWNER',            100, 'Sahib',              1, 0),
  ('SUPER_ADMIN',       90, 'Super admin',        1, 0),
  ('ADMIN',             80, 'Admin',              1, 0),
  ('SENIOR_MODERATOR',  70, 'Baş moderator',      1, 0),
  ('MODERATOR',         60, 'Moderator',          1, 0),
  ('HELPER',            50, 'Köməkçi',            1, 0),
  ('PREMIUM',           40, 'Premium',            1, 0),
  ('VERIFIED',          30, 'Təsdiqlənmiş',       1, 0),
  ('USER',              20, 'İstifadəçi',         1, 0),
  ('GUEST',             10, 'Qonaq',              1, 0);

-- PRD §5 Permission enum-u (30 icazə).
INSERT OR IGNORE INTO permissions (name, category, label_az, created_at) VALUES
  ('CREATE_POST',        'content',    'Paylaşım yarat',              0),
  ('EDIT_POST',          'content',    'Paylaşımı redaktə et',        0),
  ('DELETE_OWN_POST',    'content',    'Öz paylaşımını sil',          0),
  ('DELETE_ANY_POST',    'moderation', 'İstənilən paylaşımı sil',     0),
  ('PIN_POST',           'moderation', 'Paylaşımı sabitlə',           0),
  ('LOCK_POST',          'moderation', 'Paylaşımı kilidlə',           0),
  ('CREATE_COMMENT',     'content',    'Şərh yaz',                    0),
  ('DELETE_COMMENT',     'content',    'Öz şərhini sil',              0),
  ('DELETE_ANY_COMMENT', 'moderation', 'İstənilən şərhi sil',         0),
  ('MANAGE_REPORTS',     'moderation', 'Şikayətləri idarə et',        0),
  ('VIEW_REPORTS',       'moderation', 'Şikayətləri gör',             0),
  ('WARN_USER',          'moderation', 'Xəbərdarlıq ver',             0),
  ('MUTE_USER',          'moderation', 'Susdur',                      0),
  ('BAN_USER',           'moderation', 'Blokla',                      0),
  ('RESTORE_USER',       'moderation', 'Bərpa et',                    0),
  ('VERIFY_ACCOUNT',     'admin',      'Hesabı təsdiqlə',             0),
  ('MANAGE_BADGES',      'admin',      'Nişanları idarə et',          0),
  ('MANAGE_LEVELS',      'admin',      'Səviyyələri idarə et',        0),
  ('MANAGE_ROLES',       'admin',      'Rolları idarə et',            0),
  ('MANAGE_PERMISSIONS', 'admin',      'İcazələri idarə et',          0),
  ('MANAGE_TAGS',        'admin',      'Teqləri idarə et',            0),
  ('MANAGE_CATEGORIES',  'admin',      'Kateqoriyaları idarə et',     0),
  ('MANAGE_SETTINGS',    'admin',      'Sistem parametrləri',         0),
  ('MANAGE_USERS',       'admin',      'İstifadəçiləri idarə et',     0),
  ('VIEW_ANALYTICS',     'admin',      'Analitikanı gör',             0),
  ('VIEW_AUDIT_LOG',     'admin',      'Audit jurnalını gör',         0),
  ('MANAGE_ADS',         'admin',      'Reklamları idarə et',         0),
  ('MANAGE_API_KEYS',    'system',     'API açarlarını idarə et',     0),
  ('SYSTEM_BACKUP',      'system',     'Sistem ehtiyat nüsxəsi',      0);

-- ── PRD §6 Default Permission Mapping ──────────────────────────────────────
-- GUEST: heç nə (sətir yoxdur — default DENY).

-- USER
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'USER', name FROM permissions
 WHERE name IN ('CREATE_POST','CREATE_COMMENT','EDIT_POST','DELETE_OWN_POST','DELETE_COMMENT');

-- VERIFIED / PREMIUM — USER ilə eyni icazələr (fərq göstərişdədir, səlahiyyətdə yox).
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'VERIFIED', permission_name FROM role_permissions WHERE role_name = 'USER';
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'PREMIUM', permission_name FROM role_permissions WHERE role_name = 'USER';

-- HELPER — PRD §4: "Report cavablandıra bilər."
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'HELPER', permission_name FROM role_permissions WHERE role_name = 'USER';
INSERT OR IGNORE INTO role_permissions (role_name, permission_name) VALUES ('HELPER', 'VIEW_REPORTS');

-- MODERATOR — PRD §6
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'MODERATOR', permission_name FROM role_permissions WHERE role_name = 'HELPER';
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'MODERATOR', name FROM permissions
 WHERE name IN ('DELETE_ANY_POST','DELETE_ANY_COMMENT','WARN_USER','MANAGE_REPORTS','PIN_POST','LOCK_POST');

-- SENIOR_MODERATOR — PRD §4: "Temporary Ban, Appeal baxışı"
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'SENIOR_MODERATOR', permission_name FROM role_permissions WHERE role_name = 'MODERATOR';
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'SENIOR_MODERATOR', name FROM permissions
 WHERE name IN ('MUTE_USER','BAN_USER','RESTORE_USER');

-- ADMIN — PRD §6: "ALL MODERATOR + MANAGE_USERS, MANAGE_SETTINGS, MANAGE_TAGS"
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'ADMIN', permission_name FROM role_permissions WHERE role_name = 'SENIOR_MODERATOR';
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'ADMIN', name FROM permissions
 WHERE name IN ('MANAGE_USERS','MANAGE_SETTINGS','MANAGE_TAGS','MANAGE_CATEGORIES',
                'VERIFY_ACCOUNT','VIEW_ANALYTICS','VIEW_AUDIT_LOG','MANAGE_BADGES');

-- SUPER_ADMIN — admin + rol/icazə idarəsi.
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'SUPER_ADMIN', permission_name FROM role_permissions WHERE role_name = 'ADMIN';
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'SUPER_ADMIN', name FROM permissions
 WHERE name IN ('MANAGE_ROLES','MANAGE_PERMISSIONS','MANAGE_LEVELS','MANAGE_ADS');

-- OWNER — PRD §6: "ALL".
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'OWNER', name FROM permissions;

-- ── Badge kataloqu ────────────────────────────────────────────────────────
-- ⚠ Kodlar client-dəki statik massivlə uyğunlaşdırılıb ki, mövcud UI sınmasın.
INSERT OR IGNORE INTO badges (code, label_az, icon, rule_kind, rule_value, created_at) VALUES
  ('first_post',   'İlk paylaşım',      '📝', 'posts',      1,     0),
  ('poster_10',    '10 paylaşım',       '✍️', 'posts',      10,    0),
  ('poster_50',    '50 paylaşım',       '🖋️', 'posts',      50,    0),
  ('commenter_25', '25 şərh',           '💬', 'comments',   25,    0),
  ('solver_5',     '5 tapşırıq',        '🧩', 'tasks',      5,     0),
  ('solver_25',    '25 tapşırıq',       '🏅', 'tasks',      25,    0),
  ('streak_7',     '7 günlük seriya',   '🔥', 'streak',     7,     0),
  ('streak_30',    '30 günlük seriya',  '⚡', 'streak',     30,    0),
  ('xp_1000',      '1000 XP',           '⭐', 'xp',         1000,  0),
  ('xp_10000',     '10000 XP',          '🌟', 'xp',         10000, 0),
  ('reputable',    'Etibarlı',          '🛡️', 'reputation', 100,   0);

-- ── Achievement / unlock kataloqu (PRD "unlock engine") ───────────────────
INSERT OR IGNORE INTO achievements (code, label_az, rule_kind, rule_value, unlocks, created_at) VALUES
  ('profile_master', 'Profil tamamlandı', 'xp',         20,   '',            0),
  ('community_voice','İcma səsi',         'comments',   100,  'custom_flair',0),
  ('mentor',         'Mentor',            'reputation', 250,  'helper_apply',0),
  ('veteran',        'Veteran',           'streak',     100,  'profile_theme',0);

-- ⚠ Mövcud adminlərə rol: `admins` cədvəlindəki hər kəs ən azı ADMIN olmalıdır,
--   əks halda miqrasiyadan dərhal sonra admin paneli hamı üçün bağlanardı
--   (Task 3-ün "wildcard silinsə bütün Owner-lər kilidlənər" dərsi).
UPDATE users SET role = 'ADMIN'
 WHERE id IN (SELECT user_id FROM admins) AND (role IS NULL OR role <> 'OWNER');

-- Qalan hamı: köhnə default 'user' → PRD enum-una uyğunlaşdırılır.
UPDATE users SET role = 'USER' WHERE role IS NULL OR role NOT IN (SELECT name FROM roles);
