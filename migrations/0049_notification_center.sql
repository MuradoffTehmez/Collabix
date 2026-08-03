-- Bildiriş mərkəzi — arxiv, sabitləmə, prioritet, qruplaşdırma açarı və susdurma.
--
-- ⚠ MÖVCUD SXEM DƏYİŞDİRİLMİR — yalnız ƏLAVƏ olunur. `notifications`-ın
--   mövcud sütunları (id, user_id, type, from_id, from_name, post_id, text,
--   read, created_at) və `idx_notif_user` indeksi olduğu kimi qalır, ona görə
--   köhnə `listNotifs` sorğusu miqrasiyadan sonra da dəyişmədən işləyir.
--
-- 🔴 SQLite-də `ALTER TABLE … ADD COLUMN` üçün `IF NOT EXISTS` YOXDUR
--    (0046_pinned_messages.sql ilə eyni məhdudiyyət). Qayda 4 (idempotentlik)
--    burada CƏDVƏL/İNDEKS səviyyəsində təmin olunur; sütun əlavəsi təkrar
--    icrada "duplicate column name" verər. Bu, layihədə qəbul edilmiş
--    kompromisdir — miqrasiya bir dəfə tətbiq olunur (README qayda 2).

-- ── 1. ARXİV ────────────────────────────────────────────────────────────────
--
-- ⚠ NİYƏ AYRICA CƏDVƏL YOX, SÜTUN: bildiriş ya gələnlər qutusundadır, ya
--   arxivdə — çoxa-çox əlaqə yoxdur. Ayrıca cədvəl hər siyahı sorğusuna
--   `LEFT JOIN` əlavə edərdi; sütun isə mövcud `WHERE user_id = ?`-ə sərbəst
--   qoşulur (bax aşağıdakı kompozit indeks).
--
-- 0 = gələnlər qutusu, 1 = arxiv. `read` ilə QARIŞDIRMA: oxunmuş bildiriş
-- siyahıda qalır, arxivlənmiş isə ayrı görünüşə keçir (Gmail modeli).
ALTER TABLE notifications ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;

-- ── 2. SABİTLƏMƏ ────────────────────────────────────────────────────────────
--
-- NULL = sabitlənməyib, epoch ms = sabitlənmə anı. 0046-dakı `pinned_at`
-- naxışı ilə EYNİDİR (boolean yox, vaxt damğası) — siyahıda sabitlənmiş
-- bildirişlər ən son sabitlənən üstdə olmaqla sıralanır.
ALTER TABLE notifications ADD COLUMN pinned_at INTEGER;

-- ── 3. PRİORİTET ────────────────────────────────────────────────────────────
--
-- 0 = adi, 1 = yüksək. Dəyər YAZI anında `NotificationService`-in tip
-- cədvəlindən gəlir (bax `PRIORITY_TYPES`), istifadəçi əli ilə təyin etmir.
--
-- ⚠ `INTEGER`, `BOOLEAN` yox: gələcəkdə "kritik" (2) səviyyəsi əlavə etmək
--   yeni sütun tələb etməsin.
ALTER TABLE notifications ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;

-- ── 4. QRUPLAŞDIRMA AÇARI ───────────────────────────────────────────────────
--
-- "Ayşə paylaşımını 8 dəfə bəyəndi" / "Ayşə və daha 7 nəfər bəyəndi" —
-- hər ikisi EYNİ açarla həll olunur.
--
-- ⚠ NİYƏ SÜTUN, HESABLANAN İFADƏ YOX: qruplaşdırma həm oxu yolunda (siyahı),
--   həm də susdurma yolunda (bir mövzunu bütövlükdə sussuz etmək) lazımdır.
--   Hər iki yerdə eyni `CASE` ifadəsini təkrarlamaq onların VAXTLA
--   AYRILMASI deməkdir (bax `shared.ts`-dəki iki `notify()` tarixçəsi).
--
-- QAYDALAR:
--   dm      → `dm:<göndərən>`   — hər həmsöhbət ayrı qrup
--   follow  → `follow`          — bütün izləmələr TƏK qrupda ("N nəfər izlədi")
--   post-a bağlı → `<tip>:<post>` — eyni postdakı reaksiyalar birləşir
--   qalan   → `<tip>:<göndərən>`
ALTER TABLE notifications ADD COLUMN group_key TEXT;

-- Mövcud sətirlərin doldurulması. Yeni sətirlərdə açarı servis yazır —
-- burada YALNIZ geriyə doldurma var.
UPDATE notifications SET group_key = CASE
  WHEN type = 'dm'     THEN 'dm:' || COALESCE(from_id, '')
  WHEN type = 'follow' THEN 'follow'
  WHEN post_id IS NOT NULL AND post_id <> '' THEN type || ':' || post_id
  ELSE type || ':' || COALESCE(from_id, '')
END
WHERE group_key IS NULL;

-- ── 5. SUSDURMA ─────────────────────────────────────────────────────────────
--
-- ⚠ NİYƏ `users.settings` JSON-una YAZILMIR: mövcud tərcihlər
--   (`settings.notifications.likes/comments/follows`) SABİT açar dəstidir və
--   `patchSettings` onları bütöv obyekt kimi birləşdirir. Susdurma isə
--   AÇIQ SONLU çoxluqdur (istənilən istifadəçi, post, komanda) — JSON blob-a
--   yazsaydıq hər yeni susdurma bütün obyekti oxu-dəyiş-yaz edərdi (eyni
--   "lost update" sinfi ki, `users.activity_days` üçün AUDIT M-8-də
--   `user_activity` cədvəli ilə həll olunub).
--
-- `scope` dəyərləri:
--   type    — bildiriş tipi bütövlükdə ('like', 'comment', …)
--   user    — konkret göndərən (uid)
--   thread  — konkret `group_key` (bir post/mövzu)
--   team    — komanda id-si
--   project — layihə id-si
CREATE TABLE IF NOT EXISTS notification_mutes (
  user_id    TEXT NOT NULL,
  scope      TEXT NOT NULL CHECK (scope IN ('type','user','thread','team','project')),
  target     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, scope, target)
);

-- ── 6. İNDEKSLƏR ────────────────────────────────────────────────────────────
--
-- ⚠ `idx_notif_user` (user_id, created_at DESC) SAXLANILIR — köhnə sorğu onu
--   işlədir. Yeni indeks `archived`-i ARADAKI sütun kimi daşıyır, çünki hər
--   siyahı sorğusu artıq `AND archived = ?` ilə gəlir: onsuz SQLite indeksdən
--   yalnız `user_id` prefiksini götürüb qalanını sətir-sətir süzərdi.
CREATE INDEX IF NOT EXISTS idx_notif_user_state
  ON notifications(user_id, archived, created_at DESC);

-- Qismən indeks: sabitlənmiş bildiriş cəmi bir neçə dənədir, tam indeks
-- yaddaşı boş yerə tutardı (0046-dakı eyni mülahizə).
CREATE INDEX IF NOT EXISTS idx_notif_pinned
  ON notifications(user_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;

-- Qrup açarı ilə toplu əməliyyat (mövzunu bütövlükdə oxunmuş et / sil).
CREATE INDEX IF NOT EXISTS idx_notif_group
  ON notifications(user_id, group_key);
