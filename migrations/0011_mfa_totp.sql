-- TASK-8 / FAZA 2 / Bənd 2 — İki mərhələli təsdiq (TOTP).
--
-- Əhatə qərarı: ƏVVƏL TOTP (Google Authenticator və s.), WebAuthn/Passkeys
-- sonrakı alt-fazada. TOTP-nin xarici asılılığı yoxdur — HMAC-SHA1 WebCrypto-da
-- var, yəni tam Worker-daxili həll olunur.

CREATE TABLE IF NOT EXISTS user_mfa (
  uid          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Base32 TOTP sirri. ⚠ ŞİFRƏLƏNMİR və şifrələnə də bilməz: TOTP kodunu
  -- yoxlamaq üçün server sirri AÇIQ şəkildə bilməlidir (heş yaramaz — hər
  -- 30 saniyədə ondan yeni kod hesablanır). Qoruma D1-in özündədir.
  totp_secret  TEXT NOT NULL,
  -- 0 = sirr yaradılıb, amma istifadəçi hələ ilk kodu təsdiqləməyib.
  -- Təsdiqlənməmiş sirr girişdə TƏLƏB OLUNMUR — əks halda QR-ı skan etməyi
  -- yarımçıq qoyan istifadəçi öz hesabından birdəfəlik kilidlənərdi.
  confirmed    INTEGER NOT NULL DEFAULT 0,
  -- Təkrar-oynatma (replay) qoruması: istifadə olunmuş zaman addımı.
  -- Eyni 30 saniyəlik pəncərədə kod İKİNCİ DƏFƏ qəbul edilmir — çiynindən
  -- oxunan və ya şəbəkədən tutulan kod dərhal işlədilə bilməsin.
  last_step    INTEGER NOT NULL DEFAULT 0,
  enabled_at   INTEGER,
  created_at   INTEGER NOT NULL
);

-- Ehtiyat kodlar — telefon itəndə yeganə çıxış yolu.
-- ⚠ Parol kimi HEŞLƏNİR (SHA-256): baza sızsa kodlar bərpa oluna bilməsin.
-- Hər kod BİRDƏFƏLİKDİR — istifadə olunanda `used_at` dolur, sətir silinmir
-- ki, istifadəçi neçəsinin qaldığını görsün.
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  uid        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  used_at    INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (uid, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_uid ON mfa_backup_codes(uid, used_at);
