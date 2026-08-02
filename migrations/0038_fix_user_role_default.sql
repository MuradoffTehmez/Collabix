-- 0038 — 🔴 İSTEHSAL QÜSURU: yeni hesablarda ETİBARSIZ `users.role`
--
-- ════════════════════════════════════════════════════════════════════════════
-- QÜSUR (2026-08-02-də istehsalda aşkarlandı)
-- ════════════════════════════════════════════════════════════════════════════
--
-- `0001_init.sql:34` → `role TEXT DEFAULT 'user'`  (KİÇİK hərf)
-- `roles` cədvəlindəki ad → `'USER'`               (BÖYÜK hərf)
--
-- `routes/auth.ts` qeydiyyatda `role` sütununu AÇIQ TƏYİN ETMİR, yəni hər
-- yeni hesab sütun default-unu — `'user'` — alır. Bu dəyər `roles`
-- cədvəlində YOXDUR.
--
-- 0031 mövcud sətirləri bir dəfə normallaşdırmışdı:
--     UPDATE users SET role = 'USER' WHERE role NOT IN (SELECT name FROM roles);
-- LAKİN sütunun DEFAULT-u dəyişmədi → 0031-dən SONRA qeydiyyatdan keçən
-- hər kəs yenidən `'user'` aldı. İstehsalda 3 belə hesab tapıldı.
--
-- 🔴 TƏSİRİ: `rbac.ts` → `resolve()` `role_permissions`-dan həmin rol üçün
--    SIFIR sətir tapır, yəni istifadəçinin HEÇ BİR İCAZƏSİ olmur. Bu, indiyə
--    qədər gizli qalmışdı, çünki məzmun marşrutları icazə ilə qorunmurdu —
--    lakin AUDIT / Faza A 34 marşrutu icazə modelinə köçürdü və artıq
--    hər yeni `perm:` qapısı belə hesabları BLOKLAYARDI.
--
-- ⚠ NİYƏ SÜTUN DEFAULT-U DƏYİŞMİR: SQLite `ALTER COLUMN ... SET DEFAULT`
--   dəstəkləmir; yeganə yol cədvəli yenidən qurmaqdır. `users` 40+ cədvəl
--   tərəfindən FK ilə istinad olunur → yenidənqurma canlı bazada yüksək
--   riskdir. Ona görə həll ÜÇ QATLIDIR və hamısı eyni commit-dədir:
--     1. bu miqrasiya — mövcud pozuq sətirlər
--     2. `routes/auth.ts`  — qeydiyyat artıq `role`-u AÇIQ yazır
--     3. `rbac.ts resolve()` — naməlum rol oxunanda `USER`-ə düşür (fail-safe)
--
-- ⚠ İDEMPOTENT: pozuq sətir yoxdursa heç nə etmir.

-- Bütün etibarsız rol dəyərləri (kiçik hərf, boş, silinmiş rol adı) → 'USER'.
--
-- ⚠ `OWNER` və digər DÜZGÜN rollara TOXUNMUR: şərt yalnız `roles` cədvəlində
--   OLMAYAN dəyərləri tutur. 0035-in bootstrap OWNER-i qorunur.
UPDATE users
   SET role = 'USER'
 WHERE role IS NULL
    OR role NOT IN (SELECT name FROM roles);
