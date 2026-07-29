-- 0032_schema_debt.sql
--
-- AUDIT-TASK-10 / FAZA 4 — sxem borcu: YAŞIL + SARI qrup.
-- İstifadəçi qərarı (Faza 0 / Qərar C): "Yeşil + bütün sarı".
--
-- Qırmızı qrup (UUIDv7, `profiles`/`user_emails`/`user_socials` ayrılması,
-- `post_blocks`, tam soft-delete) QƏSDƏN İCRA OLUNMUR — `docs/SCHEMA-ROADMAP.md`.

-- ════════════════════════════════════════════════════════════════════════════
-- YAŞIL 1 — `contact_messages.uid` (Task 8 §9/5)
-- ════════════════════════════════════════════════════════════════════════════
--
-- PROBLEM: əlaqə forması yalnız `email` saxlayır. İstifadəçi e-poçtunu
-- dəyişsə köhnə müraciətləri GDPR ixracında İTİR — ixrac `contact_messages`-i
-- məhz e-poçt üzrə tapır (`routes/export.ts`).
--
-- ⚠ FK ƏLAVƏ EDİLMİR: forma QONAQ tərəfindən də doldurula bilər (uid NULL) və
--   SQLite-də mövcud cədvələ FK əlavə etmək onu YENİDƏN QURMAQ deməkdir.
ALTER TABLE contact_messages ADD COLUMN uid TEXT;

CREATE INDEX IF NOT EXISTS ix_contact_uid ON contact_messages(uid);

-- Geriyə dönük doldurma: e-poçtu üst-üstə düşən hesabları bağla.
--
-- ⚠ `lower()` müqayisəsi: e-poçt reqistrsizdir, lakin sütunlar xam saxlanılır.
UPDATE contact_messages
   SET uid = (SELECT u.id FROM users u
               WHERE lower(u.contact_email) = lower(contact_messages.email)
               LIMIT 1)
 WHERE uid IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- SARI 1 — `daily_stats` rollup (audit: `adminStatsDaily` 4 × TAM SKAN)
-- ════════════════════════════════════════════════════════════════════════════
--
-- PROBLEM: admin paneli hər açılışda dörd `COUNT(*)` işlədir — `users`,
-- `posts`, `reports`, bloklananlar. Cədvəllər böyüdükcə bu, tam skanadır və
-- panel 9 paralel poll etdiyi üçün yük çoxalır.
--
-- ⚠ `stats_daily` ARTIQ MÖVCUDDUR (0012), lakin o, GÜNLÜK SERİYA saxlayır
--   (sparkline üçün). Bu cədvəl isə CARİ ANI saxlayır — fərqli məqsəd, ona
--   görə ayrıdır və `stats_daily`-ni əvəz etmir.
CREATE TABLE IF NOT EXISTS stats_rollup (
  metric      TEXT PRIMARY KEY,
  value       INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Başlanğıc dəyərlər — cron ilk dəfə işləyənə qədər panel boş qalmasın.
INSERT OR REPLACE INTO stats_rollup (metric, value, updated_at)
  SELECT 'users_total',   COUNT(*), 0 FROM users;
INSERT OR REPLACE INTO stats_rollup (metric, value, updated_at)
  SELECT 'posts_total',   COUNT(*), 0 FROM posts;
INSERT OR REPLACE INTO stats_rollup (metric, value, updated_at)
  SELECT 'reports_open',  COUNT(*), 0 FROM reports WHERE status = 'open';
INSERT OR REPLACE INTO stats_rollup (metric, value, updated_at)
  SELECT 'users_blocked', COUNT(*), 0 FROM users WHERE blocked = 1;

-- ════════════════════════════════════════════════════════════════════════════
-- SARI 2 — `media` (yüklənmiş faylların kataloqu)
-- ════════════════════════════════════════════════════════════════════════════
--
-- PROBLEM: R2 obyektləri yalnız `posts.image_keys` JSON-unda və mesaj
-- sətirlərində izlənilir. Nəticələr:
--   • "bu istifadəçi nə qədər yer tutur?" sualı cavabsızdır (kvota mümkünsüz)
--   • yetim obyektləri tapmaq üçün BÜTÜN R2-ni sadalamaq lazımdır
--   • AUDIT-TASK-10 Faza 3-də tapılan `slice(0, 100)` yetimləri məhz buna görə
--     görünməz idi
--
-- ⚠ Bu cədvəl YENİ yükləmələri izləyir; geriyə dönük doldurma YOXDUR —
--   mövcud obyektlərin sahibini JSON-lardan çıxarmaq etibarsızdır (blok
--   strukturu dəyişkəndir). Yetim təmizliyi Task 11-ə qalır.
CREATE TABLE IF NOT EXISTS media (
  key         TEXT PRIMARY KEY,      -- R2 açarı
  uid         TEXT NOT NULL,
  kind        TEXT NOT NULL,         -- 'avatar' | 'post' | 'msg' | 'team'
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_media_uid ON media(uid, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- SARI 3 — qlobal `activities` (audit izi)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ `team_activities` ARTIQ VAR (komanda daxili), `admin_logs` isə YALNIZ
--   admin əməliyyatlarını yazır. PRD §17 "Audit Log" isə daha genişdir:
--   "Role Changed, Permission Added, XP Added, Warning, Mute, Ban, Login…"
--
-- ⚠ NİYƏ AYRICA CƏDVƏL, NİYƏ `admin_logs` GENİŞLƏNMİR: `admin_logs` "kim nə
--   etdi" (inzibatçı auditi), bu isə "sistemdə nə baş verdi" (hadisə axını).
--   Fərqli saxlama müddəti, fərqli oxucu, fərqli həcm — `security_events`-in
--   `admin_logs`-dan ayrılma səbəbi ilə eynidir (0009 şərhi).
CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY,
  uid         TEXT,                  -- hadisənin AİD OLDUĞU istifadəçi
  actor_id    TEXT,                  -- hadisəni TÖRƏDƏN (fərqli ola bilər)
  kind        TEXT NOT NULL,         -- 'role_change' | 'xp' | 'warn' | 'ban' | 'badge' | …
  ref_id      TEXT,
  detail      TEXT DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_activities_uid  ON activities(uid, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_activities_kind ON activities(kind, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- YAŞIL 2 — çatışmayan indekslər (FK əvəzinə)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 NİYƏ FK DEYİL, İNDEKS:
--   Audit "bir sıra sosial cədvəldə FK yox" deyir. SQLite-də MÖVCUD cədvələ
--   FK əlavə etmək cədvəlin YENİDƏN QURULMASINI tələb edir
--   (CREATE new → INSERT SELECT → DROP → RENAME) — canlı bazada data itkisi
--   riski daşıyır və Task 6 §Faza D bunu məhz bu səbəbdən təxirə salmışdı.
--
--   Üstəlik D1-də `PRAGMA foreign_keys` zəmanətli DEYİL (mövcud kod bunu
--   `deletePost`/`deleteAccount` şərhlərində qeyd edir və asılıları AÇIQ
--   təmizləyir). Yəni FK əlavə etsək belə o, icra olunmaya bilər.
--
--   FK-nın verdiyi İKİ faydadan biri (bütövlük) tətbiq qatında artıq var;
--   ikincisi (JOIN sürəti) isə İNDEKSDƏN gəlir. Ona görə burada indekslər
--   əlavə olunur — faydanın ölçülə bilən hissəsi, riski sıfır.
--
-- ⚠ Cədvəlin yenidən qurulması ilə əsl FK əlavəsi `docs/SCHEMA-ROADMAP.md`-də
--   qeydə alınıb və STAGING mövcud olandan sonra edilməlidir (Faza 1.7).
CREATE INDEX IF NOT EXISTS ix_likes_user         ON likes(user_id);
CREATE INDEX IF NOT EXISTS ix_bookmarks_user     ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS ix_comments_author    ON comments(author_id);
CREATE INDEX IF NOT EXISTS ix_posts_author       ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_notifications_from ON notifications(from_id);
CREATE INDEX IF NOT EXISTS ix_reports_target     ON reports(target_id);

-- ⚠ `ANALYZE` YENİDƏN işlədilir: yeni indekslər əlavə olundu və planlayıcının
--   statistikası köhnəlib (0024-ün eyni səbəbi).
ANALYZE;
