-- Re-post / Quote: post növü, sitat mətni, orijinal-silinib bayrağı + idempotent paylaşım cədvəli.
-- shared_post_id (0003) və share_count (0004) artıq mövcuddur.

ALTER TABLE posts ADD COLUMN post_type TEXT DEFAULT 'original';      -- original | repost | quote
ALTER TABLE posts ADD COLUMN quote_text TEXT;                        -- yalnız quote üçün istifadəçinin öz mətni
ALTER TABLE posts ADD COLUMN original_deleted INTEGER DEFAULT 0;     -- orijinal silinibsə 1 → "silinib" göstər

-- Toggle/idempotentlik: bir istifadəçi bir orijinalı yalnız 1 dəfə birbaşa re-post edə bilər.
-- (likes cədvəlindəki kompozit-PK nümunəsi ilə eyni məntiq.)
CREATE TABLE post_shares (
  user_id   TEXT NOT NULL,
  post_id   TEXT NOT NULL,   -- flatten sonrası KÖK orijinal post
  repost_id TEXT NOT NULL,   -- bu re-post üçün posts cədvəlində yaradılan sətrin id-si
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX idx_post_shares_post ON post_shares(post_id);
CREATE INDEX idx_post_shares_repost ON post_shares(repost_id);

-- Köhnə sətrlərin backfill-i: mövcud "empty-blocks + shared_post_id" = repost, mətnli = quote.
UPDATE posts SET post_type = 'repost' WHERE shared_post_id IS NOT NULL AND (blocks IS NULL OR blocks = '[]' OR blocks = '');
UPDATE posts SET post_type = 'quote'  WHERE shared_post_id IS NOT NULL AND post_type = 'original';
