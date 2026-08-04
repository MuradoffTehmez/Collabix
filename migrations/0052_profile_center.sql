-- Profil mərkəzi — örtük, profil sancağı, bacarıq meta-sı, baxış sayğacı.
--
-- ⚠ AYRICA FAYL (README qayda 2): 0050/0051 tətbiq olunub, onlara toxunulmur.
--
-- ════════════════════════════════════════════════════════════════════════════
-- 1. ÖRTÜK (cover)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Dəyər ŞƏKİL DEYİL, HAZIR NAXIŞIN AÇARIDIR ('aurora', 'mesh', 'grid' …).
--
-- 🔴 NİYƏ FAYL DEYİL: yüklənən örtük yeni moderasiya səthi açır (hər profil
--    başlığında istənilən şəkil), R2 xərci gətirir və 4 temanın hamısında
--    kontrastı pozur. Açar sətri isə CSS qradiyentinə bağlanır — tema
--    nişanlarından qidalandığı üçün tünd/açıq/matrix/cyberpunk-da avtomatik
--    düzgün görünür.
--
-- ⚠ Naxış açarı SERVERDƏ ağ siyahıdan keçir (`worker/routes/user.ts`).
--    Sütun sərbəst mətndir, ona görə tək müdafiə tətbiq qatındadır.
ALTER TABLE users ADD COLUMN cover TEXT NOT NULL DEFAULT '';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. BACARIQ META-SI (təcrübə ili + sertifikat)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Forma: {"Python":{"y":3,"c":1}, "Go":{"y":1,"c":0}} — açar bacarıq adıdır.
--
-- 🔴 NİYƏ `prog_levels` GENİŞLƏNMİR: həmin sütun {"Python":"Orta"} formasındadır
--    və HƏM server (`mapUser`), HƏM üç ekran, HƏM redaktor onu sətir kimi oxuyur.
--    Formanı obyektə çevirmək geriyə uyğunluq üçün hər oxu yolunda ikili
--    şaxələnmə tələb edərdi. Additiv sütun isə köhnə yolları TOXUNMADAN saxlayır:
--    meta yoxdursa bacarıq sadəcə ilsiz göstərilir.
ALTER TABLE users ADD COLUMN skill_meta TEXT NOT NULL DEFAULT '{}';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PROFİL SANCAĞI
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 NİYƏ `posts.pinned_at` İŞLƏDİLƏ BİLMİR: o, QLOBAL lent sancağıdır və
--    admin əməliyyatıdır — `routes/post.ts` sancaq qoymazdan əvvəl
--    `UPDATE posts SET pinned_at = NULL WHERE pinned_at IS NOT NULL` icra edir,
--    yəni BÜTÜN digər sancaqları silir. Müəllif öz profilində post sancasaydı,
--    növbəti admin sancağı onu səssizcə silərdi.
ALTER TABLE posts ADD COLUMN profile_pinned_at INTEGER;

-- Qismi indeks: sancılmış postlar bütün lentin kiçik hissəsidir.
CREATE INDEX IF NOT EXISTS ix_posts_profile_pin
  ON posts(author_id, profile_pinned_at DESC)
  WHERE profile_pinned_at IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. PROFİL BAXIŞLARI — YALNIZ TOPLU SAY
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ KİM baxdığı SAXLANILMIR. Sətir yalnız (profil sahibi, gün, say) daşıyır.
--   Bu, qərar nəticəsidir: "son ziyarətçilər" siyahısı yeni şəxsi məlumat
--   toplusu açardı (gizlilik parametri, saxlama müddəti, hesab silinəndə
--   təmizləmə). Toplu say heç birini tələb etmir.
--
-- ⚠ FORMA `user_activity` İLƏ EYNİDİR (uid, date, count) — heatmap ilə eyni
--   naxış, eyni prune yolu, eyni oxu sorğusu. Yeni model icad edilmir.
CREATE TABLE IF NOT EXISTS profile_views (
  uid   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date  TEXT NOT NULL,                  -- ISO 'YYYY-MM-DD' (UTC)
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, date)
);

-- Köhnə sətirlərin təmizlənməsi üçün (arxiv işi tarix üzrə silir).
CREATE INDEX IF NOT EXISTS ix_profile_views_date ON profile_views(date);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. TAYMLAYN ÜÇÜN İNDEKSLƏR
-- ════════════════════════════════════════════════════════════════════════════
--
-- Taymlayn altı mənbənin UNION-udur və hamısı `created_at DESC` sırasındadır.
-- `activities`, `posts`, `team_members` onsuz da indekslidir; `badge_logs` və
-- `achievement_logs`-da isə YALNIZ unikal (uid, code) indeksi var — tarix üzrə
-- sıralama tam skan olardı.
CREATE INDEX IF NOT EXISTS ix_badge_logs_uid_time       ON badge_logs(uid, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_achievement_logs_uid_time ON achievement_logs(uid, created_at DESC);

-- İzləyici artımı (insights) `follows.created_at` üzrə aralıq sorğusudur.
CREATE INDEX IF NOT EXISTS ix_follows_target_time ON follows(target_id, created_at);
