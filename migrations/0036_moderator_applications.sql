-- 0036 — Moderator namizədliyi (PRD §12)
--
-- PRD §12: "İstifadəçi moderator OLMUR. Müraciət edir." Şərtlər:
--   90 gün hesab · LV15+ · 500 Reputation · son 30 gündə Warning yox · Verified
--   Admin təsdiqləyir → Role dəyişir → XP DƏYİŞMİR.
--
-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 PRD-NİN DAXİLİ ZİDDİYYƏTİ — qərar sənədləşdirilir
-- ════════════════════════════════════════════════════════════════════════════
--
-- §12 "LV15+" tələb edir, lakin §7-nin səviyyə cədvəli **Lv10-da bitir**
-- (50 000 XP). Yəni LV15 ƏLÇATMAZDIR — şərt hərfi tətbiq olunsa heç kim
-- heç vaxt müraciət edə bilməzdi.
--
-- QƏRAR: astana **mövcud ƏN YÜKSƏK səviyyə** (Lv10 = 50 000 XP) kimi
-- oxunur. Bu, §12-nin NİYYƏTİNİ (çox yüksək bar) qoruyur və §7 ilə
-- ziddiyyəti aradan qaldırır.
--
-- ⚠ Astanalar KODDA SABİT DEYİL, bu cədvəldədir — `levels` cədvəli kimi
--   konfiqurasiya olunandır. Səbəb eynidir: tələbi dəyişmək üçün deploy
--   lazım olmamalıdır (PRD §7: "Formula sonradan dəyişdirilə bilməlidir").

CREATE TABLE IF NOT EXISTS moderator_requirements (
  key        TEXT PRIMARY KEY,
  value      INTEGER NOT NULL,
  label_az   TEXT NOT NULL
);

INSERT OR IGNORE INTO moderator_requirements (key, value, label_az) VALUES
  ('min_account_days', 90,    'Hesab yaşı (gün)'),
  ('min_level',        10,    'Minimum səviyyə'),
  ('min_reputation',   500,   'Minimum reputasiya'),
  ('warning_free_days',30,    'Xəbərdarlıqsız dövr (gün)'),
  ('require_verified', 1,     'Təsdiqlənmiş hesab tələb olunur'),
  -- PRD-də yoxdur, lakin rədd edilən namizədin dərhal təkrar müraciəti
  -- moderasiya növbəsini spam-a çevirərdi.
  ('reapply_days',     30,    'Rədddən sonra gözləmə (gün)');

-- ── Müraciətlər ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moderator_applications (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  -- 'pending' | 'approved' | 'rejected' | 'withdrawn'
  status      TEXT NOT NULL DEFAULT 'pending',
  -- İstifadəçinin motivasiya mətni.
  message     TEXT NOT NULL DEFAULT '',

  -- 🔴 UYĞUNLUQ ANLIQ GÖRÜNTÜSÜ (snapshot).
  --
  -- ⚠ NİYƏ SAXLANILIR: admin müraciətə bir həftə sonra baxa bilər və o vaxta
  --   qədər istifadəçinin XP-si, reputasiyası, xəbərdarlıqları dəyişmiş olur.
  --   Snapshot olmasa "niyə bu qəbul olundu?" sualına sonradan cavab vermək
  --   MÜMKÜN OLMAZDI — audit dəyəri itərdi (PRD §14 ruhu).
  snap_level      INTEGER NOT NULL DEFAULT 0,
  snap_reputation INTEGER NOT NULL DEFAULT 0,
  snap_account_days INTEGER NOT NULL DEFAULT 0,
  snap_warnings_30d INTEGER NOT NULL DEFAULT 0,
  snap_verified   INTEGER NOT NULL DEFAULT 0,

  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_note TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,

  FOREIGN KEY (uid) REFERENCES users(id) ON DELETE CASCADE
);

-- ⚠ Hesab başına EYNİ ANDA yalnız BİR açıq müraciət.
--   Qismən (partial) indeks: bağlanmış müraciətlər tarixçə kimi qalır.
CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_app_pending
  ON moderator_applications(uid) WHERE status = 'pending';

-- Admin növbəsi: əvvəlcə gözləyənlər, ən köhnə birinci (ədalətli sıra).
CREATE INDEX IF NOT EXISTS ix_mod_app_queue
  ON moderator_applications(status, created_at);

-- İstifadəçinin öz tarixçəsi + `reapply_days` yoxlaması üçün.
CREATE INDEX IF NOT EXISTS ix_mod_app_uid
  ON moderator_applications(uid, created_at DESC);
