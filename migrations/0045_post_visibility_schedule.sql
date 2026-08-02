-- Post görünürlüyü + planlaşdırma.
--
-- ⚠ HƏR İKİSİ FEED FİLTRİNƏ TƏSİR EDİR. Sütunları əlavə edib filtri
--   yeniləməmək TƏHLÜKƏSİZLİK QÜSURU olardı: "private" post hamıya görünərdi.
--   Filtr `worker/routes/post.ts` → `feed`/`getPost` içindədir.

-- 'public'    — hamı görür (default; mövcud postların hamısı belədir)
-- 'followers' — yalnız müəllifi izləyənlər
-- 'private'   — yalnız müəllif (qaralama/şəxsi qeyd)
ALTER TABLE posts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';

-- NULL = dərhal yayımlanıb. Epoch ms = həmin ana qədər GİZLİ qalır.
-- ⚠ Cron LAZIM DEYİL: feed sorğusu `scheduled_at <= now()` şərtini yoxlayır,
--   yəni post vaxtı çatan kimi öz-özünə görünür. Ayrıca planlayıcı işə
--   salmaq lazımsız hərəkət hissəsi olardı.
ALTER TABLE posts ADD COLUMN scheduled_at INTEGER;

-- Feed sorğusu hər ikisinə görə filtrləyir → birləşmiş indeks.
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at)
  WHERE scheduled_at IS NOT NULL;
