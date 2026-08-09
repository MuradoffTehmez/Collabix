-- 0056_notification_event_index.sql
--
-- BACKEND AUDIT / BE-003 + BE-004 — bildiriş idempotentlik indeksi (2/2).
-- Sütunun özü `0055`-də əlavə olunur (orada: niyə iki ayrı fayl).
--
-- ⚠ ŞƏRTİ İNDEKS QƏSDƏNDİR (`WHERE event_key IS NOT NULL`).
--   Bildirişlərin çoxu təkrarlana BİLƏR və bu, düzgün davranışdır: eyni adam
--   eyni posta iki fərqli şərh yazsa, iki bildiriş gəlməlidir. Ona görə açar
--   MƏCBURİ deyil — onu yalnız təkrarı arzuolunmaz olan yollar doldurur
--   (məsələn "bu istifadəçi bu posta reaksiya verdi" — bir dəfə).
--   Şərtsiz UNIQUE qoysaydıq, açarsız BÜTÜN sətirlər bir-biri ilə toqquşardı
--   və bildiriş sistemi tamamilə dayanardı.
--
-- ⚠ Kod tərəfi: `NotificationService.notify()` açar veriləndə
--   `INSERT OR IGNORE` işlədir və `changes === 0` olanda `false` qaytarır —
--   belədə təkrar halda realtime "yenilə" siqnalı da göndərilmir.

CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_event
  ON notifications(event_key) WHERE event_key IS NOT NULL;
