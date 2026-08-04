-- «Profil tamamlandı» nailiyyəti — etiketi ilə qaydası UYĞUNLAŞDIRILIR.
--
-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 QÜSUR
-- ════════════════════════════════════════════════════════════════════════════
--
-- Miqrasiya 0031 bu sətri seed etmişdi:
--   ('profile_master', 'Profil tamamlandı', 'xp', 20, '', 0)
--
-- Yəni nailiyyət PROFİL TAMLIĞI ilə deyil, **20 XP** ilə verilirdi. 20 XP isə
-- praktik olaraq hər aktiv hesabda var (bir post +15). Nəticə istifadəçi
-- tərəfindən bildirildi: profil 50% dolu ikən yuxarıda "Profilini tamamla"
-- nudge-i, aşağıda isə "Profil tamamlandı" nişanı GÖRÜNÜRDÜ — eyni səhifədə
-- bir-birini təkzib edən iki mesaj.
--
-- Etiket yalan danışırdı; düzəliş etiketi deyil, QAYDANI dəyişir — çünki
-- istifadəçinin gözlədiyi məna etiketdəkidir.
--
-- ⚠ `rule_kind = 'profile'` YENİ metrikadır və `worker/progression.ts` →
--   `metricsOf` onu `isProfileComplete()`-dən hesablayır (0 və ya 1).
--   Həmin funksiya `maybeProfileBonus` (+100 XP) ilə EYNİ mənbədir — bonus
--   və nişan eyni tərifə baxmalıdır.

UPDATE achievements
   SET rule_kind = 'profile', rule_value = 1
 WHERE code = 'profile_master';

-- 🔴 SƏHV VERİLMİŞ NİŞANLAR GERİ ALINIR.
--
-- Jurnal sətirləri qalsaydı, qüsurdan əvvəl nişanı almış hesablar onu ƏBƏDİ
-- saxlayardı — yəni düzəliş yalnız YENİ istifadəçilərə işləyərdi və ekranda
-- eyni ziddiyyət qalardı.
--
-- ⚠ İTKİ DEYİL: profili həqiqətən tam olan hesab nişanı DƏRHAL geri alır —
--   `evaluateProgression` profil açılışında (və hər XP hadisəsində) işləyir
--   və `INSERT OR IGNORE` idempotentdir.
DELETE FROM achievement_logs WHERE achievement_code = 'profile_master';
