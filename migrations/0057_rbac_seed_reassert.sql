-- 0057_rbac_seed_reassert.sql
--
-- BACKEND AUDIT / BE-006 — RBAC seed-i YENİDƏN TƏSDİQ EDİLƏN hala gətirir.
--
-- ════════════════════════════════════════════════════════════════════════════
-- ÖLÇÜLƏN QÜSUR
-- ════════════════════════════════════════════════════════════════════════════
--
-- Lokal bazada `role_permissions` = 127, istehsalda = 144. Fərq DƏQİQ 17-dir və
-- hamısı `0035_rbac_completion.sql`-in əlavələridir:
--
--   permissions:      MANAGE_ROOMS, MANAGE_TASKS, MANAGE_CONTENT,
--                     MANAGE_CONTACTS, MANAGE_TEAMS   (lokalda 29, olmalı 34)
--   role_permissions: MODERATOR +1, SENIOR_MODERATOR +1, ADMIN +5,
--                     SUPER_ADMIN +5, OWNER +5        = 17
--
-- `0035` `d1_migrations`-də TƏTBİQ OLUNMUŞ kimi qeyd olunub, effektləri isə
-- yoxdur. Yəni səbəb ifadənin sınması deyil — baza bir nöqtədə miqrasiya
-- jurnalından ayrı düşüb (bərpa, surət, əl ilə müdaxilə). Səbəb nə olursa
-- olsun, NƏTİCƏ eynidir və auditin BE-006-da təsvir etdiyi sinifdir:
--
--   🔴 SEED YENİDƏN TƏSDİQ EDİLƏ BİLMİR.
--
-- Bir dəfə itsə, onu geri qaytaran heç nə yoxdur. Nəticə səssizdir: rollar
-- mövcuddur, icazələr yarımçıqdır, OWNER hesab bəzi admin endpoint-lərində
-- 403 alır və bu, "kod sınıb" kimi görünür. Auditi bir müddət yanlış izə
-- saldı, çünki heç bir xəta, log və ya test bunu göstərmir.
--
-- ════════════════════════════════════════════════════════════════════════════
-- HƏLL — TAM MATRİS, AÇIQ VƏ İDEMPOTENT
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ TƏTBİQ OLUNMUŞ MİQRASİYALAR REDAKTƏ EDİLMİR. `0031` və `0035` tarixdir;
--   onları dəyişmək artıq icra olunmuş bazalarla fərq yaradar. Bu fayl onların
--   NƏTİCƏSİNİ yenidən təsdiq edir, özlərini əvəz etmir.
--
-- ⚠ HEÇ NƏ SİLİNMİR VƏ DƏYİŞDİRİLMİR. Yalnız `INSERT OR IGNORE` var:
--   mövcud sətir toxunulmaz qalır, çatışmayan sətir yaranır. Ona görə bu fayl
--   istehsalda 0 sətir dəyişəcək (orada matris onsuz da tamdır) və lokalda
--   17 sətir bərpa edəcək. Təsdiq: hər iki mühitdə say 144 olmalıdır.
--
-- ⚠ `UPDATE users SET role = …` QƏSDƏN YOXDUR. `0031`/`0035`-dəki rol təyinləri
--   BİRDƏFƏLİK data miqrasiyası idi. Onları təkrarlasaydıq, sonradan əl ilə
--   dəyişdirilmiş rollar (məsələn ADMIN-dən MODERATOR-a endirilmiş hesab)
--   səssizcə geri qaytarılardı — yəni fayl bərpa əvəzinə data itkisi edərdi.
--
-- ⚠ KASKAD OXUMA YOXDUR. `0031` matrisi `SELECT … FROM role_permissions WHERE
--   role_name = 'USER'` kimi zəncirlə qururdu. Bu, MÖVCUD vəziyyətdən oxuyur —
--   yəni pozuq bazada pozuq nəticə verir və məhz düzəltmək istədiyimiz halda
--   işləməzdi. Burada hər rol öz icazələrini AÇIQ sadalayır.
--
-- Gözlənilən yekun (istehsalla ölçülüb): USER 5 · VERIFIED 5 · PREMIUM 5 ·
-- HELPER 6 · MODERATOR 13 · SENIOR_MODERATOR 16 · ADMIN 28 · SUPER_ADMIN 32 ·
-- OWNER 34  =  144.

-- ── 1. İcazə kataloqu (0031-in 29-u + 0035-in 5-i = 34) ───────────────────
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
  ('SYSTEM_BACKUP',      'system',     'Sistem ehtiyat nüsxəsi',      0),
  ('MANAGE_ROOMS',       'admin',      'Söhbət otaqlarını idarə et',  0),
  ('MANAGE_TASKS',       'moderation', 'Tapşırıqları təsdiqlə/sil',   0),
  ('MANAGE_CONTENT',     'admin',      'FAQ və rəyləri idarə et',     0),
  ('MANAGE_CONTACTS',    'admin',      'Əlaqə müraciətlərini oxu',    0),
  ('MANAGE_TEAMS',       'admin',      'Komandalara admin müdaxiləsi',0);

-- ── 2. Rol matrisi — hər qat AÇIQ ─────────────────────────────────────────
-- GUEST: sətir yoxdur (default DENY) — qəsdən.

-- Baza məzmun icazələri: USER və ondan yuxarı HƏR rol.
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT r.name, p.name FROM roles r, permissions p
 WHERE r.name IN ('USER','VERIFIED','PREMIUM','HELPER','MODERATOR',
                  'SENIOR_MODERATOR','ADMIN','SUPER_ADMIN')
   AND p.name IN ('CREATE_POST','CREATE_COMMENT','EDIT_POST',
                  'DELETE_OWN_POST','DELETE_COMMENT');

-- HELPER+ — PRD §4: "Report cavablandıra bilər."
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT r.name, p.name FROM roles r, permissions p
 WHERE r.name IN ('HELPER','MODERATOR','SENIOR_MODERATOR','ADMIN','SUPER_ADMIN')
   AND p.name IN ('VIEW_REPORTS');

-- MODERATOR+ — məzmun moderasiyası (`MANAGE_TASKS` 0035-də bura qoşuldu).
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT r.name, p.name FROM roles r, permissions p
 WHERE r.name IN ('MODERATOR','SENIOR_MODERATOR','ADMIN','SUPER_ADMIN')
   AND p.name IN ('DELETE_ANY_POST','DELETE_ANY_COMMENT','WARN_USER',
                  'MANAGE_REPORTS','PIN_POST','LOCK_POST','MANAGE_TASKS');

-- SENIOR_MODERATOR+ — hesaba qarşı sanksiyalar.
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT r.name, p.name FROM roles r, permissions p
 WHERE r.name IN ('SENIOR_MODERATOR','ADMIN','SUPER_ADMIN')
   AND p.name IN ('MUTE_USER','BAN_USER','RESTORE_USER');

-- ADMIN+ — inzibati domenlər.
-- ⚠ MANAGE_ROLES / MANAGE_PERMISSIONS / SYSTEM_BACKUP BURADA YOXDUR və bu,
--   qəsdəndir: onlar SUPER_ADMIN-dən başlayır. `test/route-permissions.test.ts`
--   ADMIN-də olmamalarını AÇIQ yoxlayır — auditin "hər admin = tam səlahiyyət"
--   tapıntısının bağlanması budur.
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT r.name, p.name FROM roles r, permissions p
 WHERE r.name IN ('ADMIN','SUPER_ADMIN')
   AND p.name IN ('MANAGE_USERS','MANAGE_SETTINGS','MANAGE_TAGS','MANAGE_CATEGORIES',
                  'VERIFY_ACCOUNT','VIEW_ANALYTICS','VIEW_AUDIT_LOG','MANAGE_BADGES',
                  'MANAGE_ROOMS','MANAGE_CONTENT','MANAGE_CONTACTS','MANAGE_TEAMS');

-- SUPER_ADMIN — rol/icazə idarəsi.
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT r.name, p.name FROM roles r, permissions p
 WHERE r.name IN ('SUPER_ADMIN')
   AND p.name IN ('MANAGE_ROLES','MANAGE_PERMISSIONS','MANAGE_LEVELS','MANAGE_ADS');

-- OWNER — PRD §6: "ALL".
-- ⚠ Bu, yeganə yerdir ki, siyahı sabitlənmir: gələcəkdə əlavə olunan hər icazə
--   OWNER-ə avtomatik düşməlidir, əks halda sahib öz platformasının bir hissəsinə
--   giriş itirər.
INSERT OR IGNORE INTO role_permissions (role_name, permission_name)
SELECT 'OWNER', name FROM permissions;
