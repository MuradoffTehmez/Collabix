-- TASK-8 / FAZA 2 / Bənd 5 — OAuth 2.0 (GitHub, Google, LinkedIn).
--
-- Hesab bağlama modeli: bir Collabix istifadəçisinə BİR NEÇƏ provayder bağlana
-- bilər (GitHub ilə qeydiyyat, sonra Google əlavə). Əksi qadağandır — eyni
-- provayder hesabı iki Collabix istifadəçisinə bağlanmamalıdır, əks halda
-- "bu GitHub ilə kim girir?" sualının cavabı birmənalı olmazdı.

CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider     TEXT NOT NULL,          -- 'github' | 'google' | 'linkedin'
  provider_id  TEXT NOT NULL,          -- provayderdəki dəyişməz istifadəçi id-si
  uid          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email        TEXT DEFAULT '',        -- bağlanma anındakı email (audit üçün)
  login        TEXT DEFAULT '',        -- provayderdəki istifadəçi adı (UI-da göstərilir)
  linked_at    INTEGER NOT NULL,
  -- (provider, provider_id) PK → eyni GitHub hesabı iki dəfə bağlana bilməz.
  PRIMARY KEY (provider, provider_id)
);

-- "Bu istifadəçinin bağlı hesabları" (Parametrlər UI-ı) + hesab silinməsi.
CREATE INDEX IF NOT EXISTS idx_oauth_uid ON oauth_accounts(uid);

-- ============================================================
-- users: email və parolsuz hesab dəstəyi
-- ============================================================
-- Email OAuth-da hesab BİRLƏŞDİRMƏ açarıdır: eyni email-lə GitHub-dan gələn
-- istifadəçi mövcud hesabına bağlanmalıdır, təkrar hesab yaratmamalıdır.
--
-- ⚠ `contact_email` (0001) BU MƏQSƏD ÜÇÜN YARAMIR: o, istifadəçinin əl ilə
--    yazdığı, doğrulanmamış sahədir. Onunla birləşdirsək, kimsə başqasının
--    email-ini yazıb həmin hesabı ələ keçirə bilərdi. Buradakı sütun YALNIZ
--    provayder tərəfindən doğrulanmış email-lə dolur.
ALTER TABLE users ADD COLUMN email TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;

-- Yalnız OAuth ilə yaradılmış hesabda istifadəyə yararlı parol olmur.
-- Bayraq lazımdır ki, UI "şifrəni dəyiş" əvəzinə "şifrə təyin et" göstərsin
-- və parol tələb edən əməliyyatlar (hesab silmə) düzgün alternativ istəsin.
ALTER TABLE users ADD COLUMN has_password INTEGER DEFAULT 1;

-- Email üzrə axtarış birləşdirmə yolunun isti sorğusudur.
-- UNIQUE DEYİL: boş sətirlər (email verməyən köhnə hesablar) çoxdur və
-- UNIQUE index onların hamısını toqquşdurardı. Təklik tətbiqi kodda,
-- yalnız DOLU email üçün edilir.
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Mövcud hesablar parol ilə yaradılıb.
UPDATE users SET has_password = 1 WHERE has_password IS NULL;
