-- 0030_xp_logs.sql
--
-- AUDIT-2026-07-26 / H-5 — XP anti-abuse (AUDIT-TASK-9 / FAZA B).
--
-- PROBLEM: XP mühasibatı YOX idi. İki istismar açıq idi:
--   1. post yarat (+10 XP) → postu sil (XP QALIR) → təkrarla.
--      `write` səbəti 60/dəq → 600 XP/dəq = 36 000 XP/saat.
--      `levelFromXP = sqrt(xp/100)+1` → bir saatda Lv 20.
--   2. təsdiqlənmiş həlli yenidən göndər → status `pending`-ə düşür →
--      admin təkrar təsdiqləyəndə +50 XP və tasks_completed TƏKRAR verilir.
-- Jurnal olmadığı üçün istismarı geriyə dönük AŞKARLAMAQ da mümkün deyildi.

CREATE TABLE IF NOT EXISTS xp_logs (
  id         TEXT PRIMARY KEY,
  uid        TEXT NOT NULL,
  -- 'post' | 'comment' | 'solution' | 'team_task' | 'profile_bonus'
  -- | 'admin' | 'compensation'
  source     TEXT NOT NULL,
  ref_id     TEXT,                   -- post/comment/submission/task id
  amount     INTEGER NOT NULL,       -- müsbət = qazanc, mənfi = kompensasiya
  created_at INTEGER NOT NULL
);

-- İDEMPOTENTLİYİN ÖZƏYİ: eyni (uid, source, ref_id) üçün XP BİR DƏFƏ verilir.
--
-- ⚠ QİSMİ indeks (`WHERE ref_id IS NOT NULL`): bəzi mənbələrdə ref yoxdur
--   (profil bonusu, admin düzəlişi). NULL-lar SQLite-da bir-birinə bərabər
--   sayılmır, ona görə onlar bu indekslə ONSUZ DA məhdudlaşmır — qismi indeks
--   niyyəti AÇIQ edir və indeksi kiçildir. Onları gündəlik tavan idarə edir.
--
-- ⚠ `compensation` sətirləri də bu indeksə düşür: eyni post üçün kompensasiya
--   yalnız BİR DƏFƏ yazıla bilər — təkrar `deletePost` çağırışı (404-dən əvvəl
--   yarış) XP-ni iki dəfə geri ala bilməz.
CREATE UNIQUE INDEX IF NOT EXISTS ux_xp_logs_source
  ON xp_logs(uid, source, ref_id) WHERE ref_id IS NOT NULL;

-- Gündəlik tavan sorğusu üçün: WHERE uid = ? AND created_at >= ?
CREATE INDEX IF NOT EXISTS ix_xp_logs_uid_created ON xp_logs(uid, created_at);

-- ============================================================
-- BACKFILL — 9.0/Sual 4 ölçməsi + istifadəçi qərarı
-- ============================================================
--
-- ÖLÇMƏ (istehsal, 2026-07-29):
--   XP-si olan istifadəçi sayı: 1
--   ümumi XP / maksimum:        1 000 060
-- Yəni istehsalda ORGANİK XP praktiki olaraq yoxdur; tək dəyər admin
-- panelindən əl ilə qoyulmuş görünür (Lv ~101).
--
-- QƏRAR (istifadəçi, AUDIT-TASK-9 / Addım 3): sıfırla və yenidən başla.
-- Auditin təklif etdiyi sintetik 'legacy' sətri BU SƏBƏBDƏN YAZILMIR —
-- saxlanacaq organik XP yoxdur və 1 000 060-lıq süni sətir invariantı
-- mənasız dəyərlə doldurardı.
--
-- İnvariant `SUM(xp_logs.amount) == users.xp` yenə də qurulur: hər iki tərəf
-- SIFIRDIR. Bundan sonra hər XP hərəkəti jurnala düşür.
--
-- ⚠ `tasks_completed` TOXUNULMUR: o, XP deyil, tamamlanmış tapşırıq sayğacıdır
--   və qərar yalnız XP-yə aiddir.
--
-- ⚠ Bu, `users_xp_nonneg_update` trigger-ini TETİKLƏMİR (0 >= 0).
UPDATE users SET xp = 0 WHERE xp <> 0;
