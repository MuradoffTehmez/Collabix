-- AUDIT-UI / şərh sistemi — çoxlu reaksiya, moderasiya (pin/gizlət), şikayət.
--
-- MÖVCUD VƏZİYYƏT (0001 + 0008):
--   comments(id, post_id, author_id, author_name, text, created_at,
--            parent_comment_id, edited_at, like_count)
--   comment_likes(comment_id, user_id, created_at)  -- TƏK tip: "bəyəndim"
--
-- ⚠ `comment_likes` SİLİNMİR və `like_count` QALIR.
--   Səbəb: mövcud UI, `listComments` cavabı və e2e testləri onlara bağlıdır;
--   bir miqrasiyada həm sxemi dəyişmək, həm oxu yollarını köçürmək
--   geri-dönüşü çətinləşdirər. `comment_reactions` ONUN ÜSTÜNƏ gəlir:
--   "like" tipi hər iki cədvəldə saxlanılır (routes.ts ikisini birlikdə yazır),
--   qalan tiplər yalnız yeni cədvəldədir. Köhnə sətirlər aşağıda köçürülür.

-- ── Reaksiyalar ────────────────────────────────────────────────────────────
-- Bir istifadəçi bir şərhə YALNIZ BİR tip reaksiya verir (PK comment_id+user_id).
-- Tip dəyişmək = UPDATE, yəni "like → love" ikinci sətir yaratmır.
CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  -- 'like' | 'love' | 'laugh' | 'wow' | 'fire' | 'clap'
  -- ⚠ Sərbəst mətn DEYİL: server `REACTION_TYPES` siyahısına qarşı yoxlayır.
  --   CHECK burada da var ki, birbaşa SQL ilə zibil düşməsin.
  type       TEXT NOT NULL CHECK (type IN ('like','love','laugh','wow','fire','clap')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON comment_reactions(user_id);
-- Sayğac sorğusu: "bu şərhin tip üzrə bölgüsü" (GROUP BY type).
CREATE INDEX IF NOT EXISTS idx_comment_reactions_cmt ON comment_reactions(comment_id, type);

-- Mövcud bəyənmələr itməsin — hamısı 'like' tipi kimi köçürülür.
INSERT OR IGNORE INTO comment_reactions (comment_id, user_id, type, created_at)
  SELECT comment_id, user_id, 'like', created_at FROM comment_likes;

-- ── Moderasiya ─────────────────────────────────────────────────────────────
-- NULL = tətbiq olunmayıb. Epoch ms = nə vaxt tətbiq olunub (audit üçün
-- boolean-dan üstündür: "nə vaxt sancaqlandı?" sualına cavab verir).
ALTER TABLE comments ADD COLUMN pinned_at INTEGER;
ALTER TABLE comments ADD COLUMN hidden_at INTEGER;
ALTER TABLE comments ADD COLUMN hidden_by TEXT;

-- Sancaqlanmış şərh sıralamada ƏN ÜSTDƏ gəlir → partial index.
CREATE INDEX IF NOT EXISTS idx_comments_pinned ON comments(post_id, pinned_at)
  WHERE pinned_at IS NOT NULL;

-- ── Şikayət ────────────────────────────────────────────────────────────────
-- ⚠ Mövcud `reports` cədvəli İSTİFADƏÇİ şikayəti üçündür (target_id = user).
--   Şərh şikayətini ora yığmaq `target_id`-ni iki mənalı edərdi (gah user,
--   gah comment) və admin paneldəki bütün sorğuları qırardı. Ayrı cədvəl.
CREATE TABLE IF NOT EXISTS comment_reports (
  id            TEXT PRIMARY KEY,
  comment_id    TEXT NOT NULL,
  post_id       TEXT NOT NULL,
  reporter_id   TEXT NOT NULL,
  reporter_name TEXT DEFAULT '',
  reason        TEXT NOT NULL,
  status        TEXT DEFAULT 'open',   -- 'open' | 'resolved' | 'dismissed'
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON comment_reports(status, created_at);
-- Eyni istifadəçi eyni şərhi təkrar şikayət etməsin (server 409 qaytarır).
CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_reports_uniq
  ON comment_reports(comment_id, reporter_id);
