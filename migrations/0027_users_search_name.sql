-- 0027_users_search_name.sql
--
-- AUDIT-TASK-6 §D-3 (sxem siyahısı #4 + audit sətir 625)
--
-- PROBLEM (auditin öz sözləri ilə): "`ə` hərfi normalizasiya olunmur —
-- Azərbaycan dilli platforma üçün CİDDİ". `Təhməz` axtarışı `Tehmez`
-- yazılışını tapmır və əksinə; istifadəçilər bir-birini tapa bilmir.
--
-- `search_name` normallaşdırılmış formanı saxlayır: kiçik hərf + diakritiksiz
-- + Azərbaycan hərflərinin latın qarşılığı.
--
-- ⚠ ƏVƏZLƏMƏ CƏDVƏLİ `worker/util.ts` → `searchNormalize` ilə EYNİ OLMALIDIR.
-- Yazı tərəfi TypeScript funksiyasını, backfill isə aşağıdakı `replace()`
-- zəncirini işlədir — ikisi fərqlənsə köhnə sətirlər tapılmaz.
--
-- ⚠ `users_fts` YENİDƏN QURULMUR (§D-3 xəbərdarlığı): FTS cədvəlinin yenidən
-- qurulması indeks itkisi riskidir. `search_name` LIKE əsaslı axtarış
-- yollarında işlədilir (`usersDirectory`, komanda üzv axtarışı). FTS-ə
-- inteqrasiya `users_fts`-in yenidən qurulmasını tələb edir → Task 10.
--
-- İdempotent deyil (`ADD COLUMN`), lakin miqrasiya tarixçəsi bir dəfə tətbiq
-- edir. `UPDATE` hissəsi idempotentdir.

ALTER TABLE users ADD COLUMN search_name TEXT;

-- Mövcud sətirlərin backfill-i: ad + istifadəçi adı birlikdə indekslənir ki,
-- hər ikisi üzrə axtarış işləsin.
UPDATE users SET search_name =
  replace(replace(replace(replace(replace(replace(replace(
    lower(COALESCE(name, '') || ' ' || COALESCE(username, '')),
    'ə', 'e'), 'ı', 'i'), 'ö', 'o'), 'ü', 'u'), 'ç', 'c'), 'ş', 's'), 'ğ', 'g');

CREATE INDEX IF NOT EXISTS idx_users_search_name ON users(search_name);
