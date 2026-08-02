-- Sorğu genişlənməsi: çoxlu seçim + anonimlik.
-- (Müddət `closes_at` 0043-də ARTIQ var — yalnız UI-da açılır, sxem dəyişmir.)

-- ── Bayraqlar ──────────────────────────────────────────────────────────────
-- `multi_choice`: 1 = istifadəçi bir neçə variant seçə bilər.
-- `anonymous`   : 1 = kim səs verdiyi HEÇ VAXT açılmır.
--   ⚠ Server onsuz da səs verənlərin siyahısını qaytarmır, lakin bayraq
--     İKİ işi görür: (a) UI-da istifadəçiyə açıq zəmanət verir, (b) gələcəkdə
--     "kim səs verdi" funksiyası əlavə olunarsa, bu sorğular kənarda qalır.
ALTER TABLE polls ADD COLUMN multi_choice INTEGER NOT NULL DEFAULT 0;
ALTER TABLE polls ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0;

-- ── poll_votes: PK dəyişir ─────────────────────────────────────────────────
-- ⚠ ƏVVƏLKİ PK `(poll_id, user_id)` idi — yəni bir istifadəçi FİZİKİ olaraq
--   yalnız bir sətir saxlaya bilirdi və çoxlu seçim MÜMKÜN DEYİLDİ.
--   Yeni PK `(poll_id, user_id, option_id)`: hər seçim ayrı sətirdir.
--
--   Tək seçimli sorğularda "bir səs" qaydası indi SERVERDƏ təmin olunur
--   (yeni səs yazılmazdan əvvəl köhnələr silinir) — sxem artıq onu
--   məcburlaşdırmır. Bu, şüurlu güzəştdir: tək cədvəldə hər iki rejimi
--   saxlamaq iki ayrı cədvəldən sadədir.
--
-- SQLite PK-nı ALTER ilə dəyişmir → cədvəl yenidən qurulur.
CREATE TABLE poll_votes_new (
  poll_id    TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  option_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (poll_id, user_id, option_id)
);
INSERT INTO poll_votes_new (poll_id, user_id, option_id, created_at)
  SELECT poll_id, user_id, option_id, created_at FROM poll_votes;
DROP TABLE poll_votes;
ALTER TABLE poll_votes_new RENAME TO poll_votes;

CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);
-- "Bu istifadəçi bu sorğuda nə seçib" sorğusu üçün.
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(poll_id, user_id);
