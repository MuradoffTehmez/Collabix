-- Reaksiya cədvəllərini köhnə bəyənmə yolu ilə UYĞUNLAŞDIRIR.
--
-- PROBLEM: 0040/0039 miqrasiyaları mövcud bəyənmələri köçürdü, LAKİN köhnə
-- `likePut`/`commentLikePut` endpointləri bundan sonra da YALNIZ `likes` /
-- `comment_likes` cədvəlinə yazmağa davam edirdi (indi düzəldildi). Aradakı
-- müddətdə yaranan bəyənmələr reaksiya cədvəllərinə DÜŞMƏDİ.
--
-- Nəticə istifadəçiyə belə görünürdü: kartda `likeCount: 1`, amma
-- `reactions: {}` — yəni "1 bəyənmə var" yazılır, heç bir reaksiya ikonu isə
-- aktiv deyil.
--
-- ⚠ `INSERT OR IGNORE`: artıq reaksiyası olan istifadəçinin tipini ƏZMİR.
--   Kimsə 'fire' seçibsə və köhnə `likes` sətri də qalıbsa, 'fire' saxlanılır
--   (daha yeni və daha dəqiq niyyətdir).

INSERT OR IGNORE INTO post_reactions (post_id, user_id, type, created_at)
  SELECT post_id, user_id, 'like', created_at FROM likes;

INSERT OR IGNORE INTO comment_reactions (comment_id, user_id, type, created_at)
  SELECT comment_id, user_id, 'like', created_at FROM comment_likes;

-- Əks istiqamət: `post_reactions`-da 'like' var, `likes`-da yoxdursa bərpa et.
-- Bu, `like_count` sayğacının doğruluğunu qoruyur.
INSERT OR IGNORE INTO likes (post_id, user_id, created_at)
  SELECT post_id, user_id, created_at FROM post_reactions WHERE type = 'like';

INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at)
  SELECT comment_id, user_id, created_at FROM comment_reactions WHERE type = 'like';

-- Sayğacları HƏQİQİ sətir sayına görə yenidən hesabla — əvvəlki sürüşmələr
-- (artım/azalma cütünün pozulması) burada təmizlənir.
UPDATE posts SET like_count = (
  SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id
);

UPDATE comments SET like_count = (
  SELECT COUNT(*) FROM comment_likes WHERE comment_likes.comment_id = comments.id
);
