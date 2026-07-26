-- TASK-8 / FAZA 1: təhlükəsizlik təməli.
--   Bənd 15 — rotated refresh token + qısaömürlü access token
--   Bənd 3  — sessiya/cihaz idarəetməsi (aktiv sessiyalar siyahısı)
--   Bənd 1  — təhlükə monitorinqi (security_events)

-- ============================================================
-- sessions — bir sətir = bir cihaz/brauzer sessiyası
-- ============================================================
-- Refresh token BURADA saxlanılır, amma AÇIQ ŞƏKİLDƏ YOX: yalnız SHA-256 heşi.
-- Baza sızsa belə token-lər bərpa oluna bilməz (parol heşləmə məntiqi ilə eyni).
-- Heş sürətli SHA-256-dır (PBKDF2 deyil) — çünki token 256-bit təsadüfi entropiyadır,
-- lüğət hücumu mümkün deyil; hər sorğuda yavaş KDF isə refresh-i əlverişsiz edərdi.
--
-- ⚠ Access token (JWT) BURADA SAXLANILMIR — o, stateless-dir və 15 dəqiqəyə ölür.
--   Ləğv (revoke) refresh sətri üzərindən işləyir: `resolveUser` hər sorğuda
--   users JOIN sessions edir, `revoked = 1` olan sətir dərhal 401 qaytarır.
--   Belədə "tək kliklə çıxart" ANİ təsir edir, KV negative-cache gecikməsi olmadan.
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,           -- sid — access token JWT-də `sid` claim kimi gedir
  uid           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash  TEXT NOT NULL,              -- SHA-256(cari refresh token), hex
  -- Bir əvvəlki heş — OĞURLANMIŞ TOKEN AŞKARLAMASI üçün.
  -- Rotation zamanı köhnə heş silinmir, bura köçürülür. Əgər kimsə artıq
  -- istifadə olunmuş token-lə gəlirsə, bu o deməkdir ki, token iki nəfərdədir
  -- (qurban + oğru). Cavab: həmin istifadəçinin BÜTÜN sessiyaları ləğv edilir
  -- (RFC 6819 §5.2.2.3 refresh token replay detection).
  prev_refresh_hash TEXT DEFAULT '',
  ua            TEXT DEFAULT '',            -- xam User-Agent (cihaz/OS/brauzer client-də parse olunur)
  ip            TEXT DEFAULT '',            -- CF-Connecting-IP
  city          TEXT DEFAULT '',            -- request.cf.city
  country       TEXT DEFAULT '',            -- request.cf.country (ISO-2)
  created_at    INTEGER NOT NULL,
  last_seen     INTEGER NOT NULL,           -- yalnız refresh-də yenilənir (hər sorğuda YOX — yazı bahalıdır)
  expires_at    INTEGER NOT NULL,           -- mütləq son (rotation bunu uzatmır → sessiya əbədi yaşamır)
  revoked       INTEGER NOT NULL DEFAULT 0,
  revoked_at    INTEGER,
  revoked_by    TEXT DEFAULT ''             -- 'user' | 'logout' | 'reuse' | 'password' | 'admin'
);

-- `resolveUser` hər API sorğusunda sid üzrə oxuyur → PK kifayətdir.
-- Bu index isə "mənim aktiv sessiyalarım" siyahısı üçün (Bənd 3 UI).
CREATE INDEX IF NOT EXISTS idx_sessions_uid ON sessions(uid, revoked, last_seen DESC);
-- Rotation-da token→sətir axtarışı heş üzrə gedir.
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions(refresh_hash);
-- Reuse aşkarlaması `prev_refresh_hash` üzrə AYRICA sorğu ilə gedir.
-- `WHERE refresh_hash = ?1 OR prev_refresh_hash = ?1` yazılmır: SQLite OR-lu
-- şərtdə bir index seçir, o biri sütun tam skan olunardı.
CREATE INDEX IF NOT EXISTS idx_sessions_prev_refresh ON sessions(prev_refresh_hash);
-- Cron təmizləmə (vaxtı bitmiş sətrləri sil) üçün.
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================
-- security_events — təhlükə monitorinqi jurnalı (Bənd 1)
-- ============================================================
-- admin_logs-dan AYRIDIR və qəsdən belədir: admin_logs "kim nə etdi"
-- (inzibatçı auditi), bu isə "sistemə qarşı nə baş verdi" (təhlükəsizlik
-- telemetriyası). Fərqli saxlama müddəti, fərqli oxucu, fərqli həcm —
-- bir cədvəldə qarışsaydı admin auditi bot cəhdləri ilə boğulardı.
CREATE TABLE IF NOT EXISTS security_events (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,        -- login_failed | login_ok | geo_change | rate_limit | token_reuse
                                   -- | turnstile_failed | session_revoked | upload_rejected
  uid        TEXT,                 -- məlumsa (uğursuz girişdə istifadəçi mövcud deyilsə NULL)
  username   TEXT DEFAULT '',      -- cəhd edilən ad (uid NULL olsa da təhlil üçün lazımdır)
  ip         TEXT DEFAULT '',
  country    TEXT DEFAULT '',
  city       TEXT DEFAULT '',
  severity   TEXT NOT NULL DEFAULT 'info',   -- info | warning | critical
  meta       TEXT DEFAULT '{}',    -- hadisəyə xas əlavə (JSON)
  created_at INTEGER NOT NULL
);

-- Dashboard sorğuları: (a) son hadisələr, (b) tip üzrə filtr, (c) IP üzrə sayğac.
CREATE INDEX IF NOT EXISTS idx_secev_time     ON security_events(created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_secev_type     ON security_events(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_ip       ON security_events(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_severity ON security_events(severity, created_at DESC);

-- ============================================================
-- users: sonuncu görülən ölkə (Bənd 1 — coğrafi anomaliya)
-- ============================================================
-- "Qəfil fərqli ölkədən giriş" siqnalı üçün müqayisə bazası lazımdır.
-- sessions.country kifayət etmir: istifadəçi bütün sessiyalarını bağlasa
-- tarixçə itər və növbəti giriş həmişə "yeni ölkə" kimi görünərdi.
ALTER TABLE users ADD COLUMN last_country TEXT DEFAULT '';
