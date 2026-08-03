-- İstifadəçi kataloqu — iş yeri, əl ilə təyin olunan status, skill kateqoriyası.
--
-- ⚠ MÖVCUD SXEM DƏYİŞDİRİLMİR — yalnız ƏLAVƏ olunur. `users`-un mövcud
--   sütunları və `idx_*` indeksləri olduğu kimi qalır; köhnə `usersDirectory`
--   sorğusu miqrasiyadan sonra da dəyişmədən işləyir.
--
-- 🔴 SQLite-də `ALTER TABLE … ADD COLUMN` üçün `IF NOT EXISTS` YOXDUR
--    (0046/0049 ilə eyni məhdudiyyət). İdempotentlik CƏDVƏL/İNDEKS
--    səviyyəsində təmin olunur; sütun əlavəsi təkrar icrada xəta verər.
--    Bu, layihədə qəbul edilmiş kompromisdir (README qayda 2: miqrasiya
--    bir dəfə tətbiq olunur).

-- ── 1. İŞ YERİ ──────────────────────────────────────────────────────────────
--
-- ⚠ NİYƏ SƏRBƏST MƏTN, `companies` CƏDVƏLİ YOX: normallaşdırılmış şirkət
--   kataloqu ad birləşdirmə problemi gətirir ("Google" / "Google LLC" /
--   "google") və onu həll etmək üçün ya moderasiya, ya da xarici məlumat
--   bazası lazımdır. Kataloqda şirkət yalnız GÖSTƏRİLİR və LIKE ilə süzülür —
--   birləşdirmə tələb etmir. Normallaşdırma ehtiyacı yaranarsa `taxonomies`
--   naxışı ilə sonradan əlavə oluna bilər.
--
-- 60 simvol: `name` (60) ilə eyni tavan — UI eyni sətirdə göstərir.
ALTER TABLE users ADD COLUMN company TEXT DEFAULT '';

-- ── 2. ƏL İLƏ TƏYİN OLUNAN STATUS ───────────────────────────────────────────
--
-- 🔴 PRESENCE İLƏ QARIŞDIRMA. İki AYRI anlayışdır:
--    • `presence` cədvəli → istifadəçi HAZIRDA bağlıdırmı (avtomatik, ölçülür)
--    • bu sütun          → istifadəçi NƏ demək istəyir (əl ilə, niyyət)
--    UI ikisini birləşdirir: `busy` seçən onlayn istifadəçi "Məşğul" görünür,
--    offline olan isə "Məşğul" yox, "Oflayn" görünür — çünki əl ilə qoyulmuş
--    status bağlantı faktını əvəz etmir.
--
-- Dəyərlər:
--   ''      → təyin edilməyib (default) — yalnız presence göstərilir
--   away    → uzaqdayam
--   busy    → məşğulam
--   dnd     → narahat etməyin
--   hiring  → iş axtarıram / əməkdaşlığa açığam
--
-- ⚠ `CHECK` QOYULMUR: SQLite-də ALTER ilə əlavə olunan sütuna CHECK əlavə
--   etmək cədvəli yenidən qurmağı tələb edir. Doğrulama serverdədir
--   (`USER_STATUSES` ağ siyahısı) — client-dən gələn naməlum dəyər rədd olunur.
ALTER TABLE users ADD COLUMN status TEXT DEFAULT '';

-- ── 3. SKİLL KATEQORİYASI ───────────────────────────────────────────────────
--
-- ⚠ NİYƏ `taxonomies`-ə SÜTUN, client-də SABİT CƏDVƏL YOX: taksonomiya
--   admin panelindən idarə olunur (yeni skill əlavə edilə bilər). Kateqoriya
--   client-də sabit yazılsaydı, admin yeni skill əlavə edən kimi o, rəngsiz
--   və kateqoriyasız qalardı — yəni məlumat orada, görünüş isə başqa yerdə
--   idarə olunardı. Sütun hər ikisini eyni yerə yığır.
ALTER TABLE taxonomies ADD COLUMN category TEXT DEFAULT '';

-- Mövcud `prog` sətirlərinin kateqoriyalanması.
-- ⚠ Bu, SEED deyil — MÖVCUD sətirlərin doldurulmasıdır (README qayda 3:
--   bootstrap datası olmadan tətbiq çökür; burada isə görünüş zənginləşir).
UPDATE taxonomies SET category = 'lang'
  WHERE type = 'prog' AND category = '' AND label IN
  ('Python','JavaScript','TypeScript','Java','C++','C#','Go','Rust','Kotlin','Swift','PHP');

UPDATE taxonomies SET category = 'web'
  WHERE type = 'prog' AND category = '' AND label = 'HTML/CSS';

UPDATE taxonomies SET category = 'db'
  WHERE type = 'prog' AND category = '' AND label = 'SQL';

UPDATE taxonomies SET category = 'devops'
  WHERE type = 'prog' AND category = '' AND label = 'Bash';

UPDATE taxonomies SET category = 'embedded'
  WHERE type = 'prog' AND category = '' AND label = 'Arduino/C';

-- Danışıq dilləri tək kateqoriyadır.
UPDATE taxonomies SET category = 'spoken' WHERE type = 'spoken' AND category = '';

-- ── 4. İNDEKSLƏR ────────────────────────────────────────────────────────────
--
-- ⚠ `usersDirectory` HƏR sorğuda `blocked = 0` süzgəci ilə gəlir və sıra
--   sütunu üzrə ORDER BY edir. Mövcud tək sütunlu indekslər `blocked`-i
--   daşımadığı üçün SQLite sıralanmış sətirləri sonra sətir-sətir süzürdü.
--   Kompozit indeks hər iki işi bir keçiddə görür.
CREATE INDEX IF NOT EXISTS ix_users_dir_xp     ON users(blocked, xp DESC, id);
CREATE INDEX IF NOT EXISTS ix_users_dir_active ON users(blocked, last_active_at DESC, id);
CREATE INDEX IF NOT EXISTS ix_users_dir_joined ON users(blocked, joined_at DESC, id);

-- Şirkət üzrə süzgəc (LIKE prefiksli olmadığı üçün indeks tam skanı
-- əvəzləmir, lakin ORDER BY-siz sadalama üçün əhəmiyyətli daralma verir).
CREATE INDEX IF NOT EXISTS ix_users_company ON users(company) WHERE company <> '';

-- Status üzrə süzgəc — dəyər təyin edənlər azlıqdır, qismən indeks kifayətdir.
CREATE INDEX IF NOT EXISTS ix_users_status ON users(status) WHERE status <> '';
