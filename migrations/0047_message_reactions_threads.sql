-- Mesaj reaksiyaları, thread (nested cavab) və mesaj əlfəcinləri.
--
-- ⚠ MÖVCUD SXEM DƏYİŞDİRİLMİR — yalnız ƏLAVƏ olunur. `posts`/`comments`
--   reaksiya cədvəlləri, `bookmarks`, `likes` olduğu kimi qalır.

-- ── 1. REAKSİYALAR ─────────────────────────────────────────────────────────
--
-- 🔴 BU CƏDVƏL `post_reactions`/`comment_reactions`-dan BİR YERDƏ QƏSDƏN
--    AYRILIR: orada `PRIMARY KEY (post_id, user_id)`-dir, yəni istifadəçi
--    posta YALNIZ BİR reaksiya verə bilir. Mesajlarda isə açar
--    `(scope, message_id, user_id, type)`-dır — bir istifadəçi eyni mesaja
--    HƏM 👍 HƏM 🎉 qoya bilər.
--    Səbəb: istinad məhsulları (Discord, Slack, Telegram) məhz belə işləyir və
--    çatda bu, postdakından fərqli olaraq normal davranışdır. Fərq
--    sənədləşdirilir ki, sonradan "niyə iki naxış var?" sualı yaranmasın.
--
-- ⚠ `scope` sütunu: otaq və DM mesajları AYRI cədvəllərdədir və id fəzaları
--   ayrıdır. UUID toqquşması praktiki olaraq mümkün olmasa da, `scope` niyyəti
--   açıq edir və indeksi selektiv saxlayır.
CREATE TABLE IF NOT EXISTS message_reactions (
  scope      TEXT NOT NULL CHECK (scope IN ('room','dm')),
  message_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('like','love','laugh','wow','fire','clap','party','rocket')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (scope, message_id, user_id, type)
);
CREATE INDEX IF NOT EXISTS idx_msgreact_msg ON message_reactions(scope, message_id);
CREATE INDEX IF NOT EXISTS idx_msgreact_user ON message_reactions(user_id);

-- ── 2. THREAD (nested cavab) ───────────────────────────────────────────────
--
-- NULL = kök mesaj. Dolu = hansı mesaja cavabdır.
-- ⚠ Cavabın özü də cavablana bilər (ağac). Dərinlik SERVERDƏ məhdudlaşdırılmır:
--   məhdudiyyət təqdimat qərarıdır və UI-də tətbiq olunur (girinti oxunaqlılığı).
--   Sxemə sabit dərinlik yazmaq sonrakı dizayn dəyişikliyini miqrasiyaya bağlardı.
-- ⚠ FOREIGN KEY QOYULMUR: arxivləmə işi (`worker/archive.ts`) köhnə mesajları
--   D1-dən SİLİB R2-yə köçürür. FK olsaydı, arxivlənmiş valideyni olan cavab
--   ya silinərdi (məzmun itkisi), ya da arxivləmə bloklanardı.
--   Sahibsiz qalan `reply_to` UI-də "silinmiş mesaja cavab" kimi göstərilir.
ALTER TABLE room_messages ADD COLUMN reply_to TEXT;
ALTER TABLE dm_messages   ADD COLUMN reply_to TEXT;

CREATE INDEX IF NOT EXISTS idx_roommsg_reply ON room_messages(room_id, reply_to)
  WHERE reply_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dmmsg_reply ON dm_messages(pair_id, reply_to)
  WHERE reply_to IS NOT NULL;

-- ── 3. ƏLFƏCİN (bookmark) ──────────────────────────────────────────────────
--
-- ⚠ Mövcud `bookmarks` cədvəli POST-a bağlıdır (`post_id`). Onu "target_id"
--   edib iki mənalı etmək saxlanılanlar səhifəsini və mövcud sorğuları
--   sındırardı — 0040-dakı eyni mülahizə (`post_reports` ayrı cədvəl).
CREATE TABLE IF NOT EXISTS message_bookmarks (
  scope      TEXT NOT NULL CHECK (scope IN ('room','dm')),
  message_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (scope, message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_msgbm_user ON message_bookmarks(user_id, created_at);
