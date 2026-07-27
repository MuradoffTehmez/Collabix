-- 0021_restore_bootstrap_rooms.sql
--
-- AUDIT-TASK-5 §5.4 / §1 — İTMİŞ BOOTSTRAP DATASININ BƏRPASI
--
-- TAPINTI (2026-07-27, auditdə YOXDUR):
-- `0002_seed.sql` qlobal `general` söhbət otağını yaradır və həmin miqrasiya
-- `d1_migrations`-də "tətbiq olunub" kimi qeydə alınıb (21 miqrasiya, sonuncu
-- 0019). Buna baxmayaraq otaq sətri HƏM LOKAL, HƏM İSTEHSAL bazasında YOX idi:
--
--   SELECT COUNT(*) FROM rooms WHERE id='general';   →  0   (hər iki mühitdə)
--
-- Yəni 0002-nin digər sətirləri (23 taksonomiya, 6 FAQ, 3 testimonial) yerində
-- ikən yalnız `rooms` cədvəli boşalmışdı — kimsə təmizlik apararkən DEMO
-- otaqla birlikdə BOOTSTRAP otağını da silmişdi. Məhz AUDIT-TASK-5 §2.b-də
-- xəbərdarlıq edilən səhv.
--
-- TƏSİRİ: qlobal çat sınırdı. `room_messages.room_id` → `rooms(id)` FK-dır,
-- ona görə `general` otağına yazılan hər mesaj belə uğursuz olurdu:
--   X [ERROR] otaq mesajı D1-ə yazılmadı general … FOREIGN KEY constraint failed
-- (`ws-flow.spec.ts`-in 2 testi məhz bu səbəbdən sınırdı.)
--
-- ⚠ NİYƏ 0002-ni TƏKRAR İŞLƏTMİRİK: `wrangler` tətbiq tarixçəsini fayl adı ilə
-- izləyir; 0002 artıq "tətbiq olunub" sayılır və bir daha icra edilmir. Faylın
-- adını dəyişmək isə QADAĞANDIR (migrations/README.md §2) — o, yeni miqrasiya
-- sayılıb bütün məzmunu ilə təkrar tətbiq olunardı. Düzgün yol: YENİ miqrasiya.
--
-- İdempotent: `INSERT OR IGNORE` — otaq mövcuddursa heç nə dəyişmir.

INSERT OR IGNORE INTO rooms (id, name, created_by, created_at)
VALUES ('general', 'ümumi', 'system', 0);
