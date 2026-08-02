-- AUDIT-UI / postlarda da şərhlərdəki sistem: çoxlu reaksiya + moderasiya.
--
-- ⚠ 0039 (şərhlər) ilə EYNİ MODEL. Fərqləri qəsdən minimuma endirilib ki,
--   server və klient kodu bir naxışı təkrarlasın, iki ayrı məntiq olmasın.
--
-- MÖVCUD: posts(..., like_count, share_count, comment_count, post_type, ...)
--         likes(post_id, user_id, created_at)   -- TƏK tip: "bəyəndim"
--
-- `likes` və `posts.like_count` SİLİNMİR — feed, profil, statistika və e2e
-- onlara bağlıdır. `post_reactions` üstünə gəlir; `like` tipi hər ikisində
-- saxlanılır (routes ikisini sinxron yazır), qalan tiplər yalnız yenidə.

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('like','love','laugh','wow','fire','clap')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions(post_id, type);

-- Mövcud bəyənmələr 'like' tipi kimi köçürülür — sayğaclar sıçramasın.
INSERT OR IGNORE INTO post_reactions (post_id, user_id, type, created_at)
  SELECT post_id, user_id, 'like', created_at FROM likes;

-- ── Moderasiya ─────────────────────────────────────────────────────────────
-- Şərhlərdəki (0039) ilə eyni semantika: NULL = tətbiq olunmayıb, epoch ms =
-- nə vaxt. Gizlətmə SİLMƏ DEYİL → "Bərpa et" mümkündür.
ALTER TABLE posts ADD COLUMN pinned_at INTEGER;
ALTER TABLE posts ADD COLUMN hidden_at INTEGER;
ALTER TABLE posts ADD COLUMN hidden_by TEXT;

-- Sancaqlanmış post feed-in ƏN BAŞINDA gəlir (qlobal, bütün feed üzrə).
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts(pinned_at)
  WHERE pinned_at IS NOT NULL;

-- ── Şikayət ────────────────────────────────────────────────────────────────
-- ⚠ Yenə AYRI cədvəl: `reports` istifadəçi, `comment_reports` şərh üçündür.
--   Üçünü birləşdirmək `target_id`-ni üç mənalı edərdi.
CREATE TABLE IF NOT EXISTS post_reports (
  id            TEXT PRIMARY KEY,
  post_id       TEXT NOT NULL,
  reporter_id   TEXT NOT NULL,
  reporter_name TEXT DEFAULT '',
  reason        TEXT NOT NULL,
  status        TEXT DEFAULT 'open',
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_post_reports_status ON post_reports(status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_reports_uniq
  ON post_reports(post_id, reporter_id);
