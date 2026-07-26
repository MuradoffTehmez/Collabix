-- TASK-7 / Bənd 8: LinkedIn üslublu rəylər — bir səviyyəli thread cavablar,
-- rəyə bəyənmə (reaksiya) + sayğac, redaktə vaxtı.
-- Mövcud `comments` cədvəli (0001): id, post_id, author_id, author_name, text, created_at.

ALTER TABLE comments ADD COLUMN parent_comment_id TEXT;    -- NULL = üst səviyyə; dolu = cavab (yalnız 1 səviyyə)
ALTER TABLE comments ADD COLUMN edited_at INTEGER;         -- redaktə olunubsa epoch ms
ALTER TABLE comments ADD COLUMN like_count INTEGER DEFAULT 0;

-- Cavabları parent üzrə cəld tapmaq üçün (idx_comments_post (post_id, created_at) 0001-də var).
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);

-- Rəyə bəyənmə: bir istifadəçi bir rəyi yalnız 1 dəfə bəyənir (kompozit PK — post likes ilə eyni məntiq).
CREATE TABLE comment_likes (
  comment_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX idx_comment_likes_user ON comment_likes(user_id);
