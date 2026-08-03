-- Denormallaşdırılmış izləyici sayğacları — kataloq sıralaması üçün.
--
-- ⚠ NİYƏ AYRICA MİQRASİYA, 0050-yə ƏLAVƏ YOX: 0050 artıq tətbiq olunub.
--   `migrations/README.md` qayda 2 — tətbiq olunmuş miqrasiya dəyişməz;
--   səhv/çatışmazlıq varsa YENİ fayl yazılır. (Bu, "yalnız lokalda tətbiq
--   olunub" mülahizəsindən asılı olmamalıdır: həmin mülahizə səhv olan gün
--   `ALTER TABLE` təkrar icra edilib xəta verir.)
--
-- 🔴 PROBLEM: "Ən çox izləyici" sıralaması korrelyasiyalı alt-sorğu tələb
--    edirdi — `ORDER BY (SELECT COUNT(*) FROM follows WHERE target_id = users.id)`.
--    Bu, hər sətir üçün ayrıca sayma deməkdir və ƏSAS OLARAQ keyset
--    səhifələməni SINDIRIR: kursor müqayisəsi indekslənmiş sütun tələb edir,
--    hesablanan ifadə isə indekslənə bilmir.
--
-- ⚠ NAXIŞ YENİ DEYİL: `posts.like_count`, `posts.comment_count`,
--   `posts.share_count` eyni səbəblə denormallaşdırılıb. Burada da eyni
--   müqavilə qüvvədədir — sayğac YALNIZ `followPut`/`followDelete` yollarında
--   dəyişir və `follows` cədvəli həqiqət mənbəyi olaraq qalır.
--
-- ⚠ ƏLAVƏ FAYDA: kart üçün izləyici sayı da bu sütundan gəlir, yəni hər
--   səhifədə ayrıca toplu `GROUP BY` sorğusu LAZIM DEYİL.

ALTER TABLE users ADD COLUMN followers_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INTEGER NOT NULL DEFAULT 0;

-- Geriyə doldurma — mövcud `follows` sətirlərindən.
-- ⚠ `COALESCE` MƏCBURİDİR: heç kimi izləməyən istifadəçi üçün alt-sorğu NULL
--   qaytarır və sütun `NOT NULL` olduğu üçün UPDATE çökərdi.
UPDATE users SET followers_count =
  COALESCE((SELECT COUNT(*) FROM follows WHERE target_id = users.id), 0);

UPDATE users SET following_count =
  COALESCE((SELECT COUNT(*) FROM follows WHERE follower_id = users.id), 0);

-- Kataloq sıralaması: `blocked` süzgəci ORDER BY ilə eyni indeksdən oxunsun.
CREATE INDEX IF NOT EXISTS ix_users_dir_followers
  ON users(blocked, followers_count DESC, id);
