-- 0033_fts_full_body.sql
--
-- AUDIT-TASK-10 / Faza 5/#4 — *"`posts_fts` yalnız ilk 300 simvol; post
-- gövdəsi axtarılmır."*
--
-- ════════════════════════════════════════════════════════════════════════════
-- PROBLEM
-- ════════════════════════════════════════════════════════════════════════════
--
-- `posts.text` ÖNİZLƏMƏDİR: `createPost` onu `clampStr(firstText, 300)` ilə
-- yazır və UI feed kartında həmin sətri göstərir. Post gövdəsinin ÖZÜ isə
-- `blocks` JSON sütunundadır.
--
-- `posts_fts` məhz `text` sütununu indeksləyirdi → 300-cü simvoldan sonrakı
-- HEÇ BİR söz axtarışda tapılmırdı. İstifadəçi üçün bu, "axtarış işləmir"
-- kimi görünürdü, halbuki indeks öz işini görürdü — sadəcə yanlış sütunu.
--
-- ⚠ NİYƏ `text` SÜTUNUNU GENİŞLƏNDİRMİRİK: o, feed önizləməsidir və 30+ yerdə
--   belə işlədilir. Uzatsaq feed kartları bütöv postu göstərərdi.
--
-- HƏLL: ayrıca `search_text` sütunu — TAM gövdə, YALNIZ indeks üçün.

ALTER TABLE posts ADD COLUMN search_text TEXT DEFAULT '';

-- ════════════════════════════════════════════════════════════════════════════
-- Geriyə dönük doldurma
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ SQLite-də JSON-dan mətn çıxarmaq üçün `json_each` lazımdır. Blok
--   strukturu `[{type,content}, {type,urls}, …]` formasındadır və yalnız
--   `content` sahəsi mətn daşıyır.
--
-- ⚠ `json_extract` NULL qaytaranda `COALESCE` boş sətrə çevirir — əks halda
--   bir bloku mətnsiz olan post üçün BÜTÜN nəticə NULL olardı.
UPDATE posts SET search_text = COALESCE((
  SELECT group_concat(COALESCE(json_extract(b.value, '$.content'), ''), ' ')
    FROM json_each(posts.blocks) AS b
), '')
WHERE json_valid(blocks);

-- Bloklar bozuksa ən azı önizləmə mətni indekslənsin.
UPDATE posts SET search_text = text WHERE search_text IS NULL OR search_text = '';

-- ════════════════════════════════════════════════════════════════════════════
-- FTS cədvəlinin yenidən qurulması
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ External-content FTS5 cədvəlinə sütun ƏLAVƏ EDİLƏ BİLMƏZ — o, yenidən
--   yaradılmalıdır. Trigger-lər də köhnə sütun dəstinə bağlıdır, ona görə
--   onlar da yenilənir.
--
-- ⚠ SIRA VACİBDİR: əvvəlcə trigger-lər silinir. Əks halda `DROP TABLE`
--   sonrası qalan trigger mövcud olmayan cədvələ yazmağa çalışar və HƏR post
--   yaradılışı çökərdi.
DROP TRIGGER IF EXISTS posts_fts_ai;
DROP TRIGGER IF EXISTS posts_fts_ad;
DROP TRIGGER IF EXISTS posts_fts_au;
DROP TABLE IF EXISTS posts_fts;

CREATE VIRTUAL TABLE posts_fts USING fts5(
  text, tags, search_text,
  content='posts', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER posts_fts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, text, tags, search_text)
  VALUES (new.rowid, new.text, new.tags, new.search_text);
END;

CREATE TRIGGER posts_fts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, text, tags, search_text)
  VALUES ('delete', old.rowid, old.text, old.tags, old.search_text);
END;

-- ⚠ UPDATE trigger-i əvvəlcə köhnə sətri indeksdən ÇIXARIR, sonra yenisini
--   yazır. Yalnız INSERT etsək redaktə olunmuş post indeksdə İKİ DƏFƏ
--   görünərdi (köhnə və yeni mətnlə).
CREATE TRIGGER posts_fts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, text, tags, search_text)
  VALUES ('delete', old.rowid, old.text, old.tags, old.search_text);
  INSERT INTO posts_fts(rowid, text, tags, search_text)
  VALUES (new.rowid, new.text, new.tags, new.search_text);
END;

-- Mövcud sətirləri indeksə yığ.
INSERT INTO posts_fts(posts_fts) VALUES ('rebuild');

ANALYZE;
