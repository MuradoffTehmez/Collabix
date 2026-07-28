-- AUDIT-TASK-7 §7.3 — `/files/*` avtorizasiyasının tələb etdiyi indekslər.
--
-- `canReadKey` başqasının `msgfiles/{uid}/…` əlavəsini oxumaq istəyəni
-- `sharesThreadWith` ilə yoxlayır: açar hansı söhbətə göndərilib? Açarın özündə
-- söhbət ID-si yoxdur, ona görə istinad mesaj cədvəllərindən tapılır.
--
-- ⚠ İNDEKSSİZ bu, HƏR belə sorğuda `room_messages` və `dm_messages` üzrə TAM
-- CƏDVƏL SKANI olardı — arxivləmə dayandırıldığı üçün (ARCHIVE_HOT_DAYS=3650,
-- bax wrangler.jsonc) bu cədvəllər sonsuz böyüyür və skan getdikcə bahalaşardı.
--
-- Qismən indeks (`WHERE file_key IS NOT NULL`): mesajların böyük əksəriyyəti
-- mətn mesajıdır və `file_key` NULL-dur — onları indeksdən kənarda saxlamaq
-- indeksi kiçik, yazını isə ucuz saxlayır.
CREATE INDEX IF NOT EXISTS idx_room_messages_file_key
  ON room_messages(file_key) WHERE file_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dm_messages_file_key
  ON dm_messages(file_key) WHERE file_key IS NOT NULL;

-- AUDIT-TASK-6 §8/3 dərsi: yeni indeks statistikasız planlayıcıya görünmür —
-- SQLite `sqlite_stat1`-siz səhv plan seçə bilir. Migration-ın sonunda ANALYZE.
ANALYZE;
