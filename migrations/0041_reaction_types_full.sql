-- Reaksiya dəstini tam spesifikasiyaya çatdırır: 6 → 9 tip.
-- Əlavələr: 'tada' (🎉), 'hundred' (💯), 'rocket' (🚀).
--
-- ⚠ SQLite CHECK məhdudiyyətini ALTER ilə dəyişmək MÜMKÜN DEYİL — cədvəli
--   yenidən yaratmaq lazımdır. Ona görə: yeni cədvəl → data köçürmə →
--   köhnəni sil → adını dəyiş. İndekslər də yenidən qurulur.
--
-- ⚠ SIRA VACİBDİR: köhnə cədvəl silinməzdən ƏVVƏL data köçürülür, yoxsa
--   mövcud reaksiyalar itər.

/* ── comment_reactions ──────────────────────────────────────────────────── */
CREATE TABLE comment_reactions_new (
  comment_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('like','love','laugh','wow','fire','clap','tada','hundred','rocket')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
INSERT INTO comment_reactions_new (comment_id, user_id, type, created_at)
  SELECT comment_id, user_id, type, created_at FROM comment_reactions;
DROP TABLE comment_reactions;
ALTER TABLE comment_reactions_new RENAME TO comment_reactions;
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON comment_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_cmt ON comment_reactions(comment_id, type);

/* ── post_reactions ─────────────────────────────────────────────────────── */
CREATE TABLE post_reactions_new (
  post_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('like','love','laugh','wow','fire','clap','tada','hundred','rocket')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
INSERT INTO post_reactions_new (post_id, user_id, type, created_at)
  SELECT post_id, user_id, type, created_at FROM post_reactions;
DROP TABLE post_reactions;
ALTER TABLE post_reactions_new RENAME TO post_reactions;
CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions(post_id, type);
