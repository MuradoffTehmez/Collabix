-- 0034 — PRD §7 səviyyə astanalarının doldurulması
-- AUDIT-TASK-10 / D-6.a · İSTİFADƏÇİ QƏRARI ilə (variant: "Kodu PRD-yə tam uyğunlaşdır")
--
-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 BU, GÖRÜNƏN MƏHSUL DƏYİŞİKLİYİDİR — saf refaktor DEYİL
-- ════════════════════════════════════════════════════════════════════════════
--
-- 0031 bu cədvəli QƏSDƏN boş yaratmışdı: `worker/level.ts` astanaları buradan
-- oxuyur və cədvəl boş olduqda köhnə formulaya (`floor(sqrt(xp/100))+1`)
-- qayıdır. Yəni 0031 tətbiq olunanda davranış dəyişmirdi.
--
-- Bu miqrasiya həmin açarı ÇEVİRİR. Nəticə:
--
--   XP      Köhnə formula   PRD §7    Fərq
--   ------  --------------  --------  ---------------------------
--      100  Lv2             Lv1       ↓ bir səviyyə
--      500  Lv3             Lv2       ↓ bir səviyyə
--    1 500  Lv4             Lv3       ↓ bir səviyyə
--    8 100  Lv10            Lv6       ↓ DÖRD səviyyə
--   50 000  Lv23            Lv10      ↓ on üç səviyyə
--
-- ⚠ SƏVİYYƏ HEÇ BİR YERDƏ SAXLANILMIR — `users` cədvəlində `level` sütunu
--   yoxdur, hər yerdə XP-dən törənir. Ona görə bu miqrasiya HEÇ BİR SƏTRİ
--   YENİLƏMİR: dəyişən yalnız hesablama astanalarıdır. Data itkisi riski YOXDUR.
--
-- ⚠ TƏSİR SAHƏSİ (səviyyəyə baxan hər yer avtomatik yenilənir):
--     • profil kartı və publik profil
--     • admin paneli (`user-level-edit` jurnalı da `level.ts`-ə bağlandı)
--     • liderlik cədvəli
--     • nişan/achievement qaydaları (`rule_kind = 'level'`)
--
-- 🔴 GERİ QAYTARMA (data itkisiz, bir əmr):
--     DELETE FROM levels;
--   Cədvəl boşalan kimi `level.ts` köhnə formulaya qayıdır. Keş TTL-i 5 dəqiqədir
--   (`level.ts` `CACHE_TTL_MS`), yəni dəyişiklik ən geci 5 dəqiqəyə yayılır.
--
-- ⚠ İDEMPOTENT: `INSERT OR REPLACE` — miqrasiya təkrar tətbiq olunsa astanalar
--   eyni qalır, dublikat sətir yaranmır (`level` PRIMARY KEY-dir).

INSERT OR REPLACE INTO levels (level, min_xp, created_at) VALUES
  ( 1,     0, 0),
  ( 2,   500, 0),
  ( 3,  1500, 0),
  ( 4,  3500, 0),
  ( 5,  7000, 0),
  ( 6, 12000, 0),
  ( 7, 18000, 0),
  ( 8, 26000, 0),
  ( 9, 36000, 0),
  (10, 50000, 0);
