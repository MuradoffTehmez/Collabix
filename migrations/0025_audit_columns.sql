-- 0025_audit_columns.sql
--
-- AUDIT-TASK-6 §D-1 (sxem siyahısı #1) — audit sütunları
--
-- MÖVCUD VƏZİYYƏT ÖLÇÜLDÜ (təxmin edilmədi). `pragma_table_info` ilə
-- 12 əsas cədvəl yoxlanıldı:
--
--   teams .................. created_at ✓  updated_at ✓   → toxunulmur
--   posts, comments ........ created_at ✓  edited_at ✓    → toxunulmur
--     (`edited_at` funksional olaraq `updated_at`-in EYNİSİDİR; ikinci sütun
--      əlavə etmək iki həqiqət mənbəyi yaradar və hansının doldurulduğu
--      qeyri-müəyyən qalar)
--   team_projects, team_tasks, team_roles, reports ....... YOXDUR → əlavə olunur
--
-- ⚠ NULLABLE saxlanılır. `NOT NULL DEFAULT <indiki vaxt>` köhnə sətirlərə
-- YANLIŞ tarix yazardı — sanki hamısı miqrasiya anında redaktə olunub.
-- NULL dürüst mənadadır: "heç vaxt redaktə olunmayıb".
--
-- ⚠ `deleted_at` QƏSDƏN ƏLAVƏ EDİLMİR (§D-1). Sütun mövcud olub oxu sorğuları
-- onu filtrləmirsə, "silinmiş" sətirlər UI-da görünməyə davam edər — bu,
-- mövcud vəziyyətdən PİSDİR, çünki developer soft delete-in işlədiyini zənn
-- edər. Bütöv layihə kimi Task 10-dadır.
--
-- ⚠ `created_by`/`updated_by` da əlavə edilmir: `team_projects.created_by`
-- onsuz da var, `team_tasks` isə `assignee_id` daşıyır. Redaktə edəni ayrıca
-- saxlamaq üçün tam audit cədvəli lazımdır (Task 10, sxem #22).
--
-- Sütunlar KODDA DOLDURULUR — boş qalan sütun mənasızdır:
--   project.service.ts  → updateProject
--   task.service.ts     → updateTask
--   role.service.ts     → updateRole
--   routes.ts           → resolveReport

ALTER TABLE team_projects ADD COLUMN updated_at INTEGER;
ALTER TABLE team_tasks    ADD COLUMN updated_at INTEGER;
ALTER TABLE team_roles    ADD COLUMN updated_at INTEGER;
ALTER TABLE reports       ADD COLUMN updated_at INTEGER;
