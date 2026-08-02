-- Sabitlənmiş (pinned) mesajlar — otaq çatı və DM üçün.
--
-- ⚠ NİYƏ AYRICA `pins` CƏDVƏLİ YOX, SÜTUN:
--   Bir mesaj ya sabitlənib, ya yox — çoxa-çox əlaqə yoxdur. Ayrıca cədvəl
--   hər mesaj sorğusuna JOIN əlavə edərdi; sütun isə mövcud SELECT-lərə
--   sərbəst qoşulur və `WHERE pinned_at IS NOT NULL` ilə qismən indeksdən
--   istifadə edir.
--
-- ⚠ `pinned_by` SAXLANILIR, çünki "kim sabitlədi" moderasiya sualıdır:
--   otaqda istənilən istifadəçi sabitləyə bilsə, sui-istifadəni izləmək üçün
--   müəllif lazımdır. Panel də "N sabitlədi" göstərir.

-- NULL = sabitlənməyib. Epoch ms = sabitlənmə anı (panel bu sıra ilə düzür).
ALTER TABLE room_messages ADD COLUMN pinned_at INTEGER;
ALTER TABLE room_messages ADD COLUMN pinned_by TEXT;

ALTER TABLE dm_messages ADD COLUMN pinned_at INTEGER;
ALTER TABLE dm_messages ADD COLUMN pinned_by TEXT;

-- Qismən indeks: sabitlənmiş mesajlar cəmi bir neçə dənədir, tam indeks
-- yaddaşı boş yerə tutardı. Panel sorğusu məhz bu şərtlə gəlir.
CREATE INDEX IF NOT EXISTS idx_roommsg_pinned ON room_messages(room_id, pinned_at)
  WHERE pinned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dmmsg_pinned ON dm_messages(pair_id, pinned_at)
  WHERE pinned_at IS NOT NULL;
