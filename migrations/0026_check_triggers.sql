-- 0026_check_triggers.sql
--
-- AUDIT-TASK-6 §D-2 (sxem siyahısı #16) — CHECK konstraintlərinin emulyasiyası
--
-- SQLite `ALTER TABLE ... ADD CHECK` DƏSTƏKLƏMİR. Yeganə alternativlər:
--   (a) cədvəlin yenidən qurulması (CREATE new → INSERT SELECT → DROP → RENAME)
--       — canlı bazada, CI olmadan, data itkisi riski ilə → Task 10;
--   (b) `BEFORE` trigger + `RAISE(ABORT)` — bu fayl.
--
-- ⚠ Bu, İKİNCİ müdafiə qatıdır. Əsas müdafiə tətbiq səviyyəsindədir
-- (`clampStr`, `normPriority`, Faza B-dəki validasiyalar). Trigger o hallar
-- üçündür ki, sətir kodun yan yolundan və ya əl ilə D1 müdaxiləsindən keçir.
--
-- ⚠ `age >= 18`, **13 DEYİL**. Sxem siyahısı 13 təklif edirdi, lakin
-- layihənin öz hüquqi mətni (Privacy §6) və `routes.ts`-dəki qeydiyyat qapısı
-- **18+** tələb edir. Baza konstraintini hüquqi mətndən ZƏİF qoymaq ziddiyyət
-- yaradardı: baza 13-ə icazə versə, kod qapısı yan keçildikdə sətir sükutla
-- qəbul olunardı.
--
-- ⚠ PERFORMANS: hər trigger müvafiq `UPDATE`-ə əlavə iş qatır. `users.xp`
-- tez-tez yenilənir, ona görə şərt MÜMKÜN QƏDƏR DARDIR: `BEFORE UPDATE OF xp`
-- yalnız həmin sütun dəyişəndə işə düşür, `WHEN` isə yalnız POZUNTU halında
-- gövdəni icra edir. Yəni normal yolda praktiki xərc sıfıra yaxındır.
--
-- İdempotent: `CREATE TRIGGER IF NOT EXISTS`.

-- ─── users.xp >= 0 ───
-- H-5 (XP anti-abuse) Task 9-dadır; bu, SONUNCU müdafiə xəttidir: mənfi XP
-- liderlik cədvəlini və səviyyə hesabını pozar.
CREATE TRIGGER IF NOT EXISTS users_xp_nonneg_update
BEFORE UPDATE OF xp ON users
WHEN NEW.xp < 0
BEGIN
  SELECT RAISE(ABORT, 'xp mənfi ola bilməz');
END;

CREATE TRIGGER IF NOT EXISTS users_xp_nonneg_insert
BEFORE INSERT ON users
WHEN NEW.xp < 0
BEGIN
  SELECT RAISE(ABORT, 'xp mənfi ola bilməz');
END;

-- ─── users.streak >= 0 ───
CREATE TRIGGER IF NOT EXISTS users_streak_nonneg_update
BEFORE UPDATE OF streak ON users
WHEN NEW.streak < 0
BEGIN
  SELECT RAISE(ABORT, 'streak mənfi ola bilməz');
END;

-- ─── users.age >= 18 (hüquqi mətnə uyğun) ───
-- NULL yaş qəbul olunur: OAuth ilə yaradılan hesabda yaş hələ soruşulmayıb.
CREATE TRIGGER IF NOT EXISTS users_age_min_insert
BEFORE INSERT ON users
WHEN NEW.age IS NOT NULL AND NEW.age < 18
BEGIN
  SELECT RAISE(ABORT, 'yaş 18-dən kiçik ola bilməz');
END;

CREATE TRIGGER IF NOT EXISTS users_age_min_update
BEFORE UPDATE OF age ON users
WHEN NEW.age IS NOT NULL AND NEW.age < 18
BEGIN
  SELECT RAISE(ABORT, 'yaş 18-dən kiçik ola bilməz');
END;

-- ─── team_roles.priority >= 0 ───
-- AUDIT-TASK-3 §8/3: mənfi və ya NULL prioritet `denyHigherPriority`-də
-- fail-closed 403 verir və istifadəçiyə "səbəbsiz rədd" kimi görünür.
-- 0022 mövcud NULL-ları sıfırladı; bu trigger yenilərinin qarşısını alır.
CREATE TRIGGER IF NOT EXISTS team_roles_priority_nonneg_insert
BEFORE INSERT ON team_roles
WHEN NEW.priority IS NULL OR NEW.priority < 0
BEGIN
  SELECT RAISE(ABORT, 'rol prioriteti mənfi və ya NULL ola bilməz');
END;

CREATE TRIGGER IF NOT EXISTS team_roles_priority_nonneg_update
BEFORE UPDATE OF priority ON team_roles
WHEN NEW.priority IS NULL OR NEW.priority < 0
BEGIN
  SELECT RAISE(ABORT, 'rol prioriteti mənfi və ya NULL ola bilməz');
END;
