-- AUDIT-TASK-8 §8.6 — unudulmaq hüququ (GDPR Art. 17) arxiv üçün.
--
-- PROBLEM: `deleteAccount` (worker/routes.ts) D1 sətirlərini silir, LAKİN
-- R2-dəki gzip arxiv dump-ları istifadəçinin mesajlarını saxlamağa davam edir.
-- Dump-ı hər silmədə yenidən yazmaq bahadır (obyekt açılıb-yığılmalıdır), ona
-- görə iki qatlı həll seçildi:
--   (b) OXU YOLUNDA FİLTR  → dərhal təsirli, mesajlar artıq görünmür
--   (c) ASİNXRON FİZİKİ TƏMİZLİK → gecə cron-u dump-ları yenidən yazır
--
-- ⚠ (b) "silinib" DEMƏK DEYİL, "əlçatmazdır" deməkdir. Fiziki silmə (c) ilə
-- tamamlanır. Privacy mətni bu fərqi dəqiq ifadə etməlidir (§8.7).
CREATE TABLE IF NOT EXISTS deleted_uids (
  uid        TEXT PRIMARY KEY,
  deleted_at INTEGER NOT NULL,
  -- Bu uid üzrə bütün arxiv dump-ları yenidən yazılıb bitdikdə doldurulur.
  -- NULL = fiziki təmizlik hələ gözləyir.
  purged_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_deleted_uids_pending
  ON deleted_uids(deleted_at) WHERE purged_at IS NULL;

-- Hansı arxiv obyektinin sonuncu dəfə nə vaxt təmizləndiyi. Cron yalnız
-- tombstone-dan KÖHNƏ təmizlənmiş (və ya heç təmizlənməmiş) obyektlərə toxunur
-- → hər gecə bütün arxivi açmaq lazım gəlmir.
ALTER TABLE message_archives ADD COLUMN purged_at INTEGER;

-- ⚠ BACKFILL YOXDUR — QƏSDƏN.
-- Keçmişdə silinmiş hesabların uid-lərini bərpa etmək MÜMKÜN DEYİL: `deleteAccount`
-- `users` sətrini tamamilə silir və heç bir iz saxlamır (`security_events`-də isə
-- uid NULL-lanır). Orphan mesaj müəlliflərindən çıxarmaq da SƏHV olardı — sistem
-- və seed müəllifləri (`system`, e2e hesabları) yanlışlıqla "silinmiş" sayılardı.
--
-- Praktikada bu boşluq BOŞDUR: R2 inventarı (2026-07-28) `archive/` prefiksi
-- altında SIFIR obyekt göstərir — `ARCHIVE_HOT_DAYS=3650` səbəbindən Task 1-dən
-- bəri heç bir arxivləmə baş verməyib. Yəni silinmiş hesabın arxivdə qalmış
-- mesajı fiziki olaraq mövcud deyil; qoruma yalnız BUNDAN SONRAKI silmələr üçün
-- lazımdır və məhz onları əhatə edir.
