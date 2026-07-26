-- TASK-6 / BÖLMƏ 2 (İstifadəçilər#5 sıralama) + BÖLMƏ 3 (Admin#4/#8/#10).
-- Sxem dəyişmir — yalnız index + sparkline üçün yeni cədvəl.

-- ⚠ TASK-6 sənədi `users.last_seen` sütunu istəyir. ƏLAVƏ EDİLMİR:
--    * `users.last_active_at` (0001) artıq eyni məlumatı saxlayır,
--    * canlı presence isə ayrıca `presence` cədvəlindədir (0001).
--    Üçüncü sütun eyni faktın üç mənbəyi olardı və sinxrondan çıxardı.
--    Sıralama/filtr `last_active_at` üzərindən gedir.

-- Kataloq sorğuları HƏMİŞƏ `blocked = 0` ilə süzülür, sonra sıralanır.
-- Kompozit index (blocked + sıra sütunu) SQLite-a həm filtri, həm sıralamanı
-- ayrıca sort addımı olmadan verir. `id` sonda — keyset (cursor) üçün
-- stabil tiebreaker; eyni xp/tarixli sətrlər səhifələr arasında təkrarlanmasın.
CREATE INDEX IF NOT EXISTS idx_users_dir_xp       ON users(blocked, xp DESC, id);
CREATE INDEX IF NOT EXISTS idx_users_dir_active   ON users(blocked, last_active_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_users_dir_username ON users(blocked, username ASC);
CREATE INDEX IF NOT EXISTS idx_users_dir_joined   ON users(blocked, joined_at DESC, id);

-- Admin siyahı filtrləri (Admin#4): yalnız bloklanmış / admin / verified.
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);

-- Taksonomiya sıralaması (Admin#3 drag-and-drop) — `sort_order` sütunu 0001-də var.
CREATE INDEX IF NOT EXISTS idx_tax_order ON taxonomies(type, sort_order);

-- Admin xülasə kartlarındakı sparkline üçün gündəlik zaman-seriyası (Admin#8).
-- Bir sətir = bir gün; `date` ISO 'YYYY-MM-DD' formatında PK.
CREATE TABLE IF NOT EXISTS stats_daily (
  date        TEXT PRIMARY KEY,
  users       INTEGER NOT NULL DEFAULT 0,   -- həmin günün sonuna ümumi istifadəçi
  posts       INTEGER NOT NULL DEFAULT 0,
  complaints  INTEGER NOT NULL DEFAULT 0,   -- həmin gün açılan şikayət sayı
  blocked     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT 0
);
