-- TASK-8 / FAZA 4 / Bənd 12 — D1 storage limiti → R2 arxivləmə.
--
-- D1-in hər baza üçün həcm limiti var, `room_messages` və `dm_messages` isə
-- ən sürətlə böyüyən cədvəllərdir. Strategiya: D1-də yalnız "isti pəncərə"
-- (default son 90 gün) qalır, ondan köhnəsi sıxılmış JSON kimi R2-yə köçür.
--
-- Bu cədvəl arxivin KATALOQUDUR: hansı aralıq hansı R2 açarındadır.
-- Onsuz köhnə mesajı tapmaq üçün bütün bucket-i skan etmək lazım gələrdi.
CREATE TABLE IF NOT EXISTS message_archives (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,        -- 'room' | 'dm'
  scope_id   TEXT NOT NULL,        -- room_id və ya pair_id
  from_ts    INTEGER NOT NULL,     -- arxivdəki ƏN KÖHNƏ mesajın vaxtı (daxil)
  to_ts      INTEGER NOT NULL,     -- ƏN YENİ mesajın vaxtı (daxil)
  r2_key     TEXT NOT NULL,
  msg_count  INTEGER NOT NULL,
  bytes      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- "Bu otağın filan tarixdən əvvəlki mesajları hansı arxivdədir?" sorğusu.
CREATE INDEX IF NOT EXISTS idx_archives_scope ON message_archives(kind, scope_id, to_ts DESC);
CREATE INDEX IF NOT EXISTS idx_archives_time  ON message_archives(created_at DESC);
