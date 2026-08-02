-- 0037 — Dəvət axını (PRD §6 "Dost dəvəti +50")
--
-- `INVITE_XP` sabiti və `invite` XP mənbəyi AUDIT-10 / D-6-da quruldu, lakin
-- məhsulda dəvət axını yox idi — yəni XP heç vaxt verilə bilmirdi. Bu
-- miqrasiya həmin son bəndi bağlayır.

-- ── Dəvət kodları ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  code        TEXT PRIMARY KEY,
  inviter_uid TEXT NOT NULL,
  -- 0 = limitsiz. Default 25: real dəvət üçün bol, fermalama üçün dar.
  max_uses    INTEGER NOT NULL DEFAULT 25,
  uses        INTEGER NOT NULL DEFAULT 0,
  -- NULL = müddətsiz.
  expires_at  INTEGER,
  -- Ləğv edilmiş kod silinmir (tarixçə qalsın), deaktiv olunur.
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,

  FOREIGN KEY (inviter_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_invites_inviter ON invites(inviter_uid, created_at DESC);

-- ── İstifadə qeydləri ─────────────────────────────────────────────────────
--
-- 🔴 `invitee_uid` PRIMARY KEY-dir — hesab başına BİR dəfə.
--    Əks halda bir istifadəçi bir neçə kodu "istifadə edib" hər dəfə
--    dəvət edənə XP qazandıra bilərdi.
--
-- ⚠ `inviter_uid` burada TƏKRARLANIR (koddan da çıxarıla bilərdi): kod
--   sonradan silinsə belə "kim kimi dəvət etdi" izi qalmalıdır.
CREATE TABLE IF NOT EXISTS invite_redemptions (
  invitee_uid TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  inviter_uid TEXT NOT NULL,
  created_at  INTEGER NOT NULL,

  FOREIGN KEY (invitee_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_invite_redemptions_inviter
  ON invite_redemptions(inviter_uid, created_at DESC);
