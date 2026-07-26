-- TASK-8 / FAZA 4 — data, axtarış və miqyaslanma.
--   Bənd 11 — qlobal full-text search (FTS5)
--   Bənd 8  — precomputed statistika (aggregate cədvəl + TRIGGER)
--   Bənd 9  — fəaliyyət qrafiki üçün normalized storage

-- ============================================================
-- Bənd 11 — FTS5 virtual cədvəllər
-- ============================================================
-- `content=` (external content) rejimi seçilib: FTS mətnin NÜSXƏSİNİ saxlamır,
-- yalnız indeksi saxlayır və sətri lazım olanda mənbə cədvəldən oxuyur.
-- Nəticə: D1 həcmi təxminən yarıya enir (D1-in baza limiti var — Bənd 12).
-- Qarşılığı: mənbə dəyişəndə indeks ƏL İLƏ sinxronlaşdırılmalıdır → trigger-lər.
--
-- `tokenize='unicode61 remove_diacritics 2'`:
--   * unicode61 — Azərbaycan/rus əlifbasını düzgün tokenləşdirir (ascii tokenizer
--     'ə', 'ş', 'ğ', kiril hərflərini söz sərhədi sayardı və axtarış işləməzdi);
--   * remove_diacritics 2 — birləşən işarələri normallaşdırır: "Hüseyn" yazılışı
--     "huseyn" ilə də tapılır (ü → u + diakritik).
--
-- ⚠ MƏHDUDİYYƏT: 'ə' (U+0259) bu qaydaya DÜŞMÜR. O, 'e'-nin diakritik forması
--    deyil, ayrıca hərfdir və Unicode dekompozisiyası yoxdur — yəni "Məmmədli"
--    yazılışı "memmedli" ilə TAPILMIR. Bunu həll etmək üçün ayrıca normallaşdırma
--    qatı (ə→e, ı→i xəritəsi ilə köməkçi indeks sütunu) lazımdır; hazırda əhatədə
--    deyil və istifadəçi tam yazılışla axtarmalıdır.

CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  text, tags,
  content='posts', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS comments_fts USING fts5(
  text,
  content='comments', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS users_fts USING fts5(
  username, name, bio, goals,
  content='users', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- ---------- sinxron trigger-ləri ----------
-- External-content FTS-də silmə/yeniləmə üçün xüsusi 'delete' komandası lazımdır:
-- köhnə dəyərlər indeksdən çıxarılmalıdır, əks halda silinmiş post axtarışda
-- "qaralama" (orphan) kimi qalar və snippet oxumaq cəhdi xəta verər.

CREATE TRIGGER IF NOT EXISTS posts_fts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, text, tags) VALUES (new.rowid, new.text, new.tags);
END;
CREATE TRIGGER IF NOT EXISTS posts_fts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, text, tags) VALUES ('delete', old.rowid, old.text, old.tags);
END;
CREATE TRIGGER IF NOT EXISTS posts_fts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, text, tags) VALUES ('delete', old.rowid, old.text, old.tags);
  INSERT INTO posts_fts(rowid, text, tags) VALUES (new.rowid, new.text, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS comments_fts_ai AFTER INSERT ON comments BEGIN
  INSERT INTO comments_fts(rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TRIGGER IF NOT EXISTS comments_fts_ad AFTER DELETE ON comments BEGIN
  INSERT INTO comments_fts(comments_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
CREATE TRIGGER IF NOT EXISTS comments_fts_au AFTER UPDATE ON comments BEGIN
  INSERT INTO comments_fts(comments_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO comments_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER IF NOT EXISTS users_fts_ai AFTER INSERT ON users BEGIN
  INSERT INTO users_fts(rowid, username, name, bio, goals)
    VALUES (new.rowid, new.username, new.name, new.bio, new.goals);
END;
CREATE TRIGGER IF NOT EXISTS users_fts_ad AFTER DELETE ON users BEGIN
  INSERT INTO users_fts(users_fts, rowid, username, name, bio, goals)
    VALUES ('delete', old.rowid, old.username, old.name, old.bio, old.goals);
END;
-- ⚠ `users` cədvəli hər girişdə yenilənir (streak, last_active_at, activity_days).
-- Trigger şərtsiz olsaydı, axtarışla ƏLAQƏSİ OLMAYAN hər yeniləmə FTS indeksini
-- yenidən yazardı — girişin ən isti yolunda mənasız yazı yükü.
-- `WHEN` şərti indeksi yalnız axtarılan sahələr dəyişəndə toxundurur.
CREATE TRIGGER IF NOT EXISTS users_fts_au AFTER UPDATE ON users
WHEN old.username IS NOT new.username OR old.name IS NOT new.name
  OR old.bio IS NOT new.bio OR old.goals IS NOT new.goals
BEGIN
  INSERT INTO users_fts(users_fts, rowid, username, name, bio, goals)
    VALUES ('delete', old.rowid, old.username, old.name, old.bio, old.goals);
  INSERT INTO users_fts(rowid, username, name, bio, goals)
    VALUES (new.rowid, new.username, new.name, new.bio, new.goals);
END;

-- ---------- mövcud sətrlərin indekslənməsi ----------
-- 'rebuild' bütün indeksi mənbə cədvəldən sıfırdan qurur — migration anındakı
-- köhnə məzmun da axtarışa düşsün.
INSERT INTO posts_fts(posts_fts) VALUES ('rebuild');
INSERT INTO comments_fts(comments_fts) VALUES ('rebuild');
INSERT INTO users_fts(users_fts) VALUES ('rebuild');

-- ============================================================
-- Bənd 8 — precomputed statistika
-- ============================================================
-- Profil açılanda post/rəy/bəyənmə saylarını COUNT(*) ilə hesablamaq cədvəl
-- böyüdükcə xətti yavaşlayır. Burada saylar YAZI anında artımlı yenilənir:
-- oxu O(1) tək sətir olur.
--
-- VIEW deyil, AGGREGATE CƏDVƏL seçilib: D1-də VIEW hər oxunuşda alt sorğuları
-- yenidən icra edir, yəni oxu-yükünü azaltmır — sadəcə SQL-i gizlədir.
-- Trigger-li cədvəl isə oxunu həqiqətən sabit vaxta salır.
CREATE TABLE IF NOT EXISTS user_stats (
  uid            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  posts          INTEGER NOT NULL DEFAULT 0,
  comments       INTEGER NOT NULL DEFAULT 0,
  likes_given    INTEGER NOT NULL DEFAULT 0,
  likes_received INTEGER NOT NULL DEFAULT 0,
  followers      INTEGER NOT NULL DEFAULT 0,
  following      INTEGER NOT NULL DEFAULT 0,
  updated_at     INTEGER NOT NULL DEFAULT 0
);

-- Sətir yoxdursa yaradan, varsa artıran naxış (UPSERT) hər trigger-də təkrarlanır.
CREATE TRIGGER IF NOT EXISTS stats_post_ai AFTER INSERT ON posts BEGIN
  INSERT INTO user_stats (uid, posts, updated_at) VALUES (new.author_id, 1, new.created_at)
    ON CONFLICT(uid) DO UPDATE SET posts = posts + 1, updated_at = new.created_at;
END;
CREATE TRIGGER IF NOT EXISTS stats_post_ad AFTER DELETE ON posts BEGIN
  -- MAX(0, ...) qoruması: sayğac mənfiyə düşməsin (köhnə data, əl ilə silmə).
  UPDATE user_stats SET posts = MAX(0, posts - 1) WHERE uid = old.author_id;
END;

CREATE TRIGGER IF NOT EXISTS stats_comment_ai AFTER INSERT ON comments BEGIN
  INSERT INTO user_stats (uid, comments, updated_at) VALUES (new.author_id, 1, new.created_at)
    ON CONFLICT(uid) DO UPDATE SET comments = comments + 1, updated_at = new.created_at;
END;
CREATE TRIGGER IF NOT EXISTS stats_comment_ad AFTER DELETE ON comments BEGIN
  UPDATE user_stats SET comments = MAX(0, comments - 1) WHERE uid = old.author_id;
END;

-- Bəyənmə İKİ sayğaca təsir edir: bəyənəndə (likes_given) və müəllifdə (likes_received).
CREATE TRIGGER IF NOT EXISTS stats_like_ai AFTER INSERT ON likes BEGIN
  INSERT INTO user_stats (uid, likes_given, updated_at) VALUES (new.user_id, 1, new.created_at)
    ON CONFLICT(uid) DO UPDATE SET likes_given = likes_given + 1, updated_at = new.created_at;
  INSERT INTO user_stats (uid, likes_received, updated_at)
    SELECT author_id, 1, new.created_at FROM posts WHERE id = new.post_id
    ON CONFLICT(uid) DO UPDATE SET likes_received = likes_received + 1, updated_at = new.created_at;
END;
CREATE TRIGGER IF NOT EXISTS stats_like_ad AFTER DELETE ON likes BEGIN
  UPDATE user_stats SET likes_given = MAX(0, likes_given - 1) WHERE uid = old.user_id;
  UPDATE user_stats SET likes_received = MAX(0, likes_received - 1)
    WHERE uid = (SELECT author_id FROM posts WHERE id = old.post_id);
END;

CREATE TRIGGER IF NOT EXISTS stats_follow_ai AFTER INSERT ON follows BEGIN
  INSERT INTO user_stats (uid, following, updated_at) VALUES (new.follower_id, 1, new.created_at)
    ON CONFLICT(uid) DO UPDATE SET following = following + 1, updated_at = new.created_at;
  INSERT INTO user_stats (uid, followers, updated_at) VALUES (new.target_id, 1, new.created_at)
    ON CONFLICT(uid) DO UPDATE SET followers = followers + 1, updated_at = new.created_at;
END;
CREATE TRIGGER IF NOT EXISTS stats_follow_ad AFTER DELETE ON follows BEGIN
  UPDATE user_stats SET following = MAX(0, following - 1) WHERE uid = old.follower_id;
  UPDATE user_stats SET followers  = MAX(0, followers  - 1) WHERE uid = old.target_id;
END;

-- Mövcud data üçün ilkin hesablama (bir dəfəlik tam skan — migration anında ucuzdur).
INSERT INTO user_stats (uid, posts, comments, likes_given, likes_received, followers, following, updated_at)
SELECT u.id,
  (SELECT COUNT(*) FROM posts    p WHERE p.author_id = u.id),
  (SELECT COUNT(*) FROM comments c WHERE c.author_id = u.id),
  (SELECT COUNT(*) FROM likes    l WHERE l.user_id   = u.id),
  (SELECT COUNT(*) FROM likes    l JOIN posts p ON p.id = l.post_id WHERE p.author_id = u.id),
  (SELECT COUNT(*) FROM follows  f WHERE f.target_id   = u.id),
  (SELECT COUNT(*) FROM follows  f WHERE f.follower_id = u.id),
  0
FROM users u
WHERE true
ON CONFLICT(uid) DO NOTHING;

-- ============================================================
-- Bənd 9 — fəaliyyət qrafiki (heatmap) storage
-- ============================================================
-- Mövcud həll `users.activity_days` JSON blob-udur. Problemləri:
--   * hər fəaliyyətdə BÜTÜN JSON oxunub yenidən yazılır (illər keçdikcə böyüyür),
--   * "son 30 gündə ən aktiv istifadəçilər" kimi aqreqasiya SQL ilə mümkün deyil,
--   * eyni anda iki yazı olsa biri o birini üstələyir (lost update).
-- Normalized cədvəl hər üçünü həll edir.
--
-- ⚠ `activity_days` sütunu SİLİNMİR: köhnə client-lər hələ onu oxuyur və
--    geriyə uyğunluq saxlanılır. Yeni yol əsas mənbədir, köhnəsi paralel yazılır.
CREATE TABLE IF NOT EXISTS user_activity (
  uid   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date  TEXT NOT NULL,               -- ISO 'YYYY-MM-DD'
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, date)
);

-- Heatmap sorğusu: bir istifadəçi + tarix aralığı. PK (uid, date) bunu tam örtür.
-- Bu index isə əks istiqamət üçün: "filan gün kimlər aktiv idi" (admin analitikası).
CREATE INDEX IF NOT EXISTS idx_activity_date ON user_activity(date, uid);

-- Mövcud JSON blob-larının köçürülməsi D1 SQL-i ilə mümkün deyil (json_each
-- açar-dəyər cütlərini verir, amma `INSERT ... SELECT json_each` D1-də
-- etibarsızdır). Köçürmə TƏTBİQ QATINDA, tənbəl şəkildə edilir: istifadəçinin
-- heatmap-ı ilk dəfə açılanda JSON-dan cədvələ yazılır (bax routes.ts
-- `activityFor`). Belədə migration ani qalır və heç bir data itmir.
