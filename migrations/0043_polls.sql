-- Sorğular (poll) — posta bağlı səsvermə.
--
-- MODEL: sorğu POSTUN bir hissəsidir, ayrıca varlıq deyil. Bir postda ƏN ÇOX
-- BİR sorğu olur (`polls.post_id` UNIQUE) — çoxlu sorğu render və səsvermə
-- məntiqini iki qat mürəkkəbləşdirər, real ehtiyac isə yoxdur.
--
-- ⚠ Variant mətni AYRI cədvəldədir, JSON blob DEYİL. Səbəb: səs sayı variant
--   üzrə aqreqasiya tələb edir (`GROUP BY option_id`); JSON-da bu, hər oxuda
--   tam blobun parse edilməsi və klientdə sayılması demək olardı.

CREATE TABLE IF NOT EXISTS polls (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  -- NULL = müddətsiz. Epoch ms — bitmiş sorğuda səs qəbul olunmur.
  closes_at   INTEGER,
  -- 1 = nəticələr yalnız səs verəndən sonra görünür (spoiler qarşısı).
  hide_results INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_options (
  id       TEXT PRIMARY KEY,
  poll_id  TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  -- Göstərilmə sırası. `created_at` kifayət etmir: variantlar eyni ms-də
  -- yaradılır və sıra qeyri-müəyyən olardı.
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id, position);

-- Bir istifadəçi bir sorğuda BİR səs verir (PK). Fikrini dəyişsə UPDATE olur,
-- ikinci sətir yaranmır — "seçimi dəyiş" davranışı buradan gəlir.
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id   TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL,
  option_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (poll_id, user_id)
);
-- Nəticə aqreqasiyası: "hansı variant neçə səs" (GROUP BY option_id).
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);
