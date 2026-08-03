// Alternativ giriş üsulları — AUDIT-TASK-10 / Faza 3.1.
//
// 2FA/TOTP (girişin ikinci addımı), magic link (parolsuz giriş) və OAuth.
// `auth.ts`-dən ayrılıb, çünki o, 46 KB ilə "heç bir fayl > 30 KB" meyarını
// pozurdu. Paylaşılan hesab qoruması `auth-guard.ts`-dədir.
import {
  Ctx, json, err, readJson, now, b64uRandom, fromJSON, 
  mapUser, withCookies,
} from '../util';
import {
  createSession, sessionCookies, readCookie, hashPassword, revokeAllSessions,
} from '../auth';
import { logSecurityEvent, recentFailures } from '../security';
import {
  isConfigured, configuredProviders, createState, consumeState, clearStateCookie,
  exchangeCode, fetchProfile, authorizeUrl, STATE_COOKIE,
  createPending, readPending, resolveAccount, suggestUsername,
} from '../oauth';
import {
  generateSecret, otpauthUri, verifyTotp, generateBackupCodes,
  hashBackupCode, mfaEnabled,
} from '../totp';
import { emailEnabled, sendEmail, magicLinkMail, passwordResetMail, mailLang } from '../email';
import { D, badReq, withSession, checkPasswordStrength, grantDailyLogin } from './shared';
import { kickEverywhere } from '../ws-kick';
import { CAPTCHA_SOFT_AT, CAPTCHA_HARD_AT, turnstileGate, alertAccountOwner } from './auth-guard';

/* ================= 2FA / TOTP (Bənd 2) ================= */

const MFA_CHALLENGE_TTL = 300;   // 5 dəqiqə — kodu tapıb yazmağa kifayətdir

// Parol doğrulandı, amma sessiya HƏLƏ verilmir: ikinci addım gözlənilir.
// Challenge KV-də saxlanılır və "parolu bilirəm" faktını daşıyır — client
// sadəcə uid göndərib bu addımı ata bilməsin.
/**
 * ⚠ İXRAC OLUNUR, çünki `auth.ts`-dəki `login` MFA aktiv olanda challenge
 *   yaradır. Asılılıq TƏK İSTİQAMƏTLİDİR (`auth.ts` → `auth-methods.ts`);
 *   bu modul `auth.ts`-dən heç nə idxal etmir, yəni dairə yoxdur.
 */
export async function issueMfaChallenge(c: Ctx, uid: string): Promise<string> {
  const token = b64uRandom(32);
  await c.env.SESSIONS.put(`mfachal:${await sha256Hex(token)}`, uid, { expirationTtl: MFA_CHALLENGE_TTL });
  return token;
}

// TOTP kodunu VƏ YA ehtiyat kodu yoxlayır. Uğurda replay qoruması yenilənir.
async function consumeMfaCode(c: Ctx, uid: string, code: string): Promise<boolean> {
  const row = await D(c).prepare(
    'SELECT totp_secret, last_step FROM user_mfa WHERE uid = ? AND confirmed = 1',
  ).bind(uid).first<any>();
  if (!row) return false;

  const step = await verifyTotp(row.totp_secret, code, Number(row.last_step) || 0);
  if (step !== null) {
    // İstifadə olunmuş addım yazılır → eyni kod ikinci dəfə keçmir.
    await D(c).prepare('UPDATE user_mfa SET last_step = ? WHERE uid = ?').bind(step, uid).run();
    return true;
  }

  // TOTP tutmadı — ehtiyat kod ola bilər (telefon itib).
  const hash = await hashBackupCode(code);
  const bc = await D(c).prepare(
    'SELECT used_at FROM mfa_backup_codes WHERE uid = ? AND code_hash = ?',
  ).bind(uid, hash).first<any>();
  if (!bc || bc.used_at) return false;      // yoxdur və ya artıq işlədilib
  await D(c).prepare('UPDATE mfa_backup_codes SET used_at = ? WHERE uid = ? AND code_hash = ?')
    .bind(now(), uid, hash).run();
  await logSecurityEvent(c.env, c.req, {
    type: 'login_ok', uid, severity: 'warning', meta: { flow: 'mfa_backup_code' },
  });
  return true;
}

// Girişin ikinci addımı.
export async function mfaVerify(c: Ctx) {
  const b = await readJson(c.req);
  const key = `mfachal:${await sha256Hex(String(b.challenge || ''))}`;
  const uid = await c.env.SESSIONS.get(key);
  if (!uid) return err('Təsdiq müddəti bitib. Yenidən daxil olun.', 401, 'mfa_challenge_expired');

  // 🔴 AUDIT-TASK-9 / A-3: audit qeyd edirdi ki, MFA kodu hücumu YALNIZ `auth`
  // səbətinə güvənir. Səbət indi atomikdir (Faza A), lakin o, IP üzrə sayır —
  // paylanmış hücum 6 rəqəmlik fəzanı yenə də gəzə bilər. Login ilə EYNİ
  // hesab-səviyyəli qapı buraya da qoyulur.
  //
  // `username` MƏHZ ONA GÖRƏ oxunur ki, uğursuz MFA cəhdi jurnala adla düşsün:
  // `recentFailures` istifadəçi adı üzrə saymasa, bütün MFA nasazlıqları
  // `username = ''` altında qarışar və sayğac mənasızlaşardı.
  const acct = await D(c).prepare('SELECT username FROM users WHERE id = ?').bind(uid).first<any>();
  const uname = String(acct?.username || '');
  const mfaFails = await recentFailures(c.env, c.req, uname);
  if (uname && mfaFails >= CAPTCHA_SOFT_AT) {
    const gate = await turnstileGate(c, b.turnstileToken, uname, mfaFails >= CAPTCHA_HARD_AT);
    if (gate) {
      if (mfaFails >= CAPTCHA_HARD_AT) c.ctx.waitUntil(alertAccountOwner(c, uname, mfaFails));
      return gate;
    }
  }

  if (!(await consumeMfaCode(c, uid, String(b.code || '')))) {
    await logSecurityEvent(c.env, c.req, {
      type: 'login_failed', uid, username: uname, severity: 'warning',
      meta: { flow: 'mfa', reason: 'bad_code' },
    });
    // Challenge SİLİNMİR: istifadəçi kodu səhv yazmış ola bilər, yenidən
    // parol daxil etməyə məcbur etmək lazım deyil. Cəhdlərin sayı rate-limit
    // ilə məhdudlaşır (`auth` səbəti).
    return err('Kod yanlışdır.', 401, 'mfa_bad_code');
  }

  await c.env.SESSIONS.delete(key);   // birdəfəlik
  const row = await D(c).prepare('SELECT * FROM users WHERE id = ?').bind(uid).first<any>();
  if (!row || row.blocked) return err('Hesabınız bloklanıb.', 403, 'account_blocked');

  await logSecurityEvent(c.env, c.req, { type: 'login_ok', uid, username: row.username, meta: { flow: 'mfa' } });
  await grantDailyLogin(c, uid);   // PRD §6 (D-6.b) — 2FA yolu da girişdir
  const pair = await createSession(c.env, c.req, uid);
  return withSession({ user: mapUser(row, true) }, pair);
}

/* ---------- MFA idarəetməsi (Parametrlər) ---------- */

export async function mfaStatus(c: Ctx) {
  const row = await D(c).prepare('SELECT confirmed, enabled_at FROM user_mfa WHERE uid = ?')
    .bind(c.user!.id).first<any>();
  const left = await D(c).prepare(
    'SELECT COUNT(*) AS n FROM mfa_backup_codes WHERE uid = ? AND used_at IS NULL',
  ).bind(c.user!.id).first<any>();
  return json({
    enabled: !!row && row.confirmed === 1,
    pending: !!row && row.confirmed === 0,
    enabledAt: row?.enabled_at || null,
    backupRemaining: Number(left?.n || 0),
  });
}

// Sirr yaradır (HƏLƏ aktiv deyil) və QR üçün otpauth URI qaytarır.
export async function mfaSetup(c: Ctx) {
  if (await mfaEnabled(c.env, c.user!.id)) return badReq('2FA artıq aktivdir.');
  const secret = generateSecret();
  // `INSERT OR REPLACE`: təsdiqlənməmiş köhnə cəhd varsa üzərinə yazılır —
  // istifadəçi QR-ı yenidən skan etmək istəyəndə köhnə sirr ilişib qalmasın.
  await D(c).prepare(
    'INSERT OR REPLACE INTO user_mfa (uid, totp_secret, confirmed, last_step, created_at) VALUES (?,?,0,0,?)',
  ).bind(c.user!.id, secret, now()).run();
  return json({
    secret,   // əl ilə daxil etmək üçün (QR skan edilə bilmirsə)
    uri: otpauthUri(secret, c.user!.username, c.env.APP_NAME || 'Collabix'),
  });
}

// İlk kodu təsdiqləyir → 2FA aktivləşir + ehtiyat kodlar verilir.
export async function mfaConfirm(c: Ctx) {
  const b = await readJson(c.req);
  const row = await D(c).prepare('SELECT totp_secret, confirmed FROM user_mfa WHERE uid = ?')
    .bind(c.user!.id).first<any>();
  if (!row) return badReq('Əvvəlcə 2FA qurulmalıdır.');
  if (row.confirmed) return badReq('2FA artıq aktivdir.');

  const step = await verifyTotp(row.totp_secret, String(b.code || ''));
  if (step === null) return err('Kod yanlışdır. Telefonun saatının düzgün olduğunu yoxla.', 400, 'mfa_bad_code');

  const codes = generateBackupCodes();
  const hashes = await Promise.all(codes.map(hashBackupCode));
  await D(c).batch([
    D(c).prepare('UPDATE user_mfa SET confirmed = 1, enabled_at = ?, last_step = ? WHERE uid = ?')
      .bind(now(), step, c.user!.id),
    // Köhnə kodlar (təkrar qurulmadırsa) təmizlənir.
    D(c).prepare('DELETE FROM mfa_backup_codes WHERE uid = ?').bind(c.user!.id),
    ...hashes.map(h => D(c).prepare(
      'INSERT INTO mfa_backup_codes (uid, code_hash, created_at) VALUES (?,?,?)',
    ).bind(c.user!.id, h, now())),
  ]);

  await logSecurityEvent(c.env, c.req, {
    type: 'password_changed', uid: c.user!.id, username: c.user!.username,
    severity: 'warning', meta: { change: 'mfa_enabled' },
  });
  // Kodlar YALNIZ BU DƏFƏ göstərilir — bazada yalnız heşləri var.
  return json({ ok: true, backupCodes: codes });
}

export async function mfaDisable(c: Ctx) {
  const b = await readJson(c.req);
  // Söndürmə üçün CARİ kod tələb olunur: kimsə açıq qalmış sessiyaya çatsa
  // 2FA-nı bir kliklə söndürüb qorumanı çıxara bilməsin.
  if (!(await consumeMfaCode(c, c.user!.id, String(b.code || '')))) {
    return err('Kod yanlışdır.', 403, 'mfa_bad_code');
  }
  await D(c).batch([
    D(c).prepare('DELETE FROM user_mfa WHERE uid = ?').bind(c.user!.id),
    D(c).prepare('DELETE FROM mfa_backup_codes WHERE uid = ?').bind(c.user!.id),
  ]);
  await logSecurityEvent(c.env, c.req, {
    type: 'password_changed', uid: c.user!.id, username: c.user!.username,
    severity: 'critical', meta: { change: 'mfa_disabled' },
  });
  return json({ ok: true });
}

export async function mfaRegenerateBackup(c: Ctx) {
  const b = await readJson(c.req);
  if (!(await consumeMfaCode(c, c.user!.id, String(b.code || '')))) {
    return err('Kod yanlışdır.', 403, 'mfa_bad_code');
  }
  const codes = generateBackupCodes();
  const hashes = await Promise.all(codes.map(hashBackupCode));
  await D(c).batch([
    D(c).prepare('DELETE FROM mfa_backup_codes WHERE uid = ?').bind(c.user!.id),
    ...hashes.map(h => D(c).prepare(
      'INSERT INTO mfa_backup_codes (uid, code_hash, created_at) VALUES (?,?,?)',
    ).bind(c.user!.id, h, now())),
  ]);
  return json({ ok: true, backupCodes: codes });
}

/* ================= MAGIC LINK (Bənd 4) ================= */

const MAGIC_TTL = 600;   // 10 dəqiqə

const sha256Hex = async (s: string) => {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
};

// Parolsuz giriş linki istəyi.
//
// ⚠ CAVAB HƏMİŞƏ EYNİDİR (`{ ok: true }`) — email mövcuddur, yoxdur, göndərmə
// alındı, alınmadı: fərq etməz. Fərqli cavab versəydik, bu endpoint "hansı
// email Collabix-də qeydiyyatdadır?" sualına cavab verən pulsuz alətə çevrilərdi
// (istifadəçi sadalanması). Əsl nəticə yalnız poçt qutusunda görünür.
export async function magicLinkRequest(c: Ctx) {
  const b = await readJson(c.req);
  const gate = await turnstileGate(c, b.turnstileToken);
  if (gate) return gate;

  const neutral = json({ ok: true });
  if (!emailEnabled(c.env)) return neutral;

  const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return neutral;

  // Ünvan başına limit — IP limiti tək başına kifayət etmir: botnet fərqli
  // IP-lərdən eyni qurbanın qutusunu doldura bilərdi.
  const perAddr = `mlrate:${await sha256Hex(email)}`;
  const sent = parseInt((await c.env.SESSIONS.get(perAddr)) || '0', 10);
  if (sent >= 3) return neutral;
  await c.env.SESSIONS.put(perAddr, String(sent + 1), { expirationTtl: 900 });

  // Doğrulanmış `email` VƏ YA istifadəçinin özünün yazdığı `contact_email`.
  // İkincisi doğrulanmayıb, amma linkə klik məhz o qutuya çıxışı SÜBUT edir —
  // ona görə uğurlu istifadədən sonra ünvan doğrulanmış kimi işarələnir.
  const row = await D(c).prepare(
    `SELECT id, name, blocked, settings FROM users
      WHERE (email = ?1 AND email != '') OR lower(contact_email) = ?1 LIMIT 1`,
  ).bind(email).first<any>();
  if (!row || row.blocked) return neutral;

  const token = b64uRandom(32);
  await c.env.SESSIONS.put(
    `magic:${await sha256Hex(token)}`,
    JSON.stringify({ uid: row.id, email }),
    { expirationTtl: MAGIC_TTL },
  );

  const lang = mailLang(fromJSON<any>(row.settings, {})?.lang);
  const url = `${c.url.origin}/api/auth/magic/${token}`;
  const mail = magicLinkMail(row.name || '', url, lang);
  await sendEmail(c.env, { ...mail, to: email });
  return neutral;
}

// Linkə klik — brauzer naviqasiyasıdır, ona görə cavab 302-dir.
export async function magicLinkConsume(c: Ctx, token: string) {
  const key = `magic:${await sha256Hex(token)}`;
  const raw = await c.env.SESSIONS.get(key);
  if (!raw) {
    await logSecurityEvent(c.env, c.req, {
      type: 'login_failed', severity: 'warning', meta: { flow: 'magic_link', reason: 'invalid_or_used' },
    });
    return appRedirect(c, '/?magic=expired');
  }
  // BİRDƏFƏLİK: oxunan kimi silinir. Email-dəki link forward edilsə, keşlənsə
  // və ya skaner tərəfindən açılsa belə ikinci dəfə işləmir.
  await c.env.SESSIONS.delete(key);

  const { uid, email } = JSON.parse(raw) as { uid: string; email: string };
  const row = await D(c).prepare('SELECT id, blocked FROM users WHERE id = ?').bind(uid).first<any>();
  if (!row || row.blocked) return appRedirect(c, '/?magic=blocked');

  // Klik qutuya çıxışı sübut etdi → ünvanı doğrulanmış kimi qeyd et.
  // Bu, gələcək OAuth hesab birləşdirməsi üçün də etibarlı açar yaradır.
  await D(c).prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?').bind(email, uid).run();
  await logSecurityEvent(c.env, c.req, { type: 'login_ok', uid, meta: { flow: 'magic_link' } });

  await grantDailyLogin(c, uid);   // PRD §6 (D-6.b) — sehrli link də girişdir
  const pair = await createSession(c.env, c.req, uid);
  return appRedirect(c, '/?magic=ok#home', sessionCookies(pair));
}

/* ================= OAUTH (Bənd 5) ================= */

// Provayderdən qayıdanda istifadəçini tətbiqə qaytaran 302.
//
// Nəticə QUERY sətrində daşınır (`?oauth=...`), fraqmentdə YOX: marşrutlaşdırıcı
// `location.hash`-i səhifə adı kimi oxuyur (`js/app.js` route()), ona görə
// `#auth?oauth=...` formasında hash tanınmayan səhifəyə çevrilib istifadəçini
// vitrinə atardı. Query isə `URLSearchParams` ilə təmiz oxunur və hash öz
// marşrut vəzifəsində qalır.
const appRedirect = (c: Ctx, target: string, cookies: string[] = []) =>
  withCookies(new Response(null, {
    status: 302,
    headers: { Location: new URL(target, c.url.origin).toString() },
  }), [clearStateCookie(), ...cookies]);

export async function oauthStart(c: Ctx, provider: string) {
  if (!isConfigured(c.env, provider)) return err('Bu provayder aktiv deyil.', 404, 'provider_off');

  // Giriş etmiş istifadəçi üçün bu, hesab BAĞLAMA axınıdır (yeni giriş yox).
  const linkUid = c.user?.id;
  const { state, cookie } = await createState(c.env, {
    provider,
    linkUid,
    returnTo: linkUid ? '/#settings' : '/#home',
  });
  return withCookies(new Response(null, {
    status: 302,
    headers: { Location: authorizeUrl(c.env, c.url, provider, state) },
  }), [cookie]);
}

export async function oauthCallback(c: Ctx, provider: string) {
  if (!isConfigured(c.env, provider)) return err('Bu provayder aktiv deyil.', 404, 'provider_off');

  const q = c.url.searchParams;
  // İstifadəçi provayderdə "imtina" seçə bilər — bu xəta deyil, sakit qayıdış.
  if (q.get('error')) return appRedirect(c, '/?oauth=cancelled');

  const st = await consumeState(c.env, q.get('state') || '', readCookie(c.req, STATE_COOKIE));
  if (!st || st.provider !== provider) {
    await logSecurityEvent(c.env, c.req, {
      type: 'login_failed', severity: 'warning',
      meta: { flow: 'oauth', provider, reason: 'bad_state' },
    });
    return appRedirect(c, '/?oauth=state_error');
  }

  let profile;
  try {
    profile = await fetchProfile(provider, await exchangeCode(c.env, c.url, provider, q.get('code') || ''));
  } catch (e: any) {
    console.error('oauth exchange', provider, e?.message || e);
    return appRedirect(c, '/?oauth=provider_error');
  }

  // --- Bağlama rejimi: mövcud hesaba əlavə provayder qoşulur ---
  if (st.linkUid) {
    const taken = await D(c).prepare(
      'SELECT uid FROM oauth_accounts WHERE provider = ? AND provider_id = ?',
    ).bind(provider, profile.providerId).first<any>();
    // Eyni provayder hesabı başqa istifadəçidə varsa bağlamırıq — əks halda
    // bir GitHub hesabı iki Collabix profilinə giriş verərdi.
    if (taken && taken.uid !== st.linkUid) return appRedirect(c, '/?oauth=already_linked#settings');

    await D(c).prepare(
      'INSERT OR IGNORE INTO oauth_accounts (provider, provider_id, uid, email, login, linked_at) VALUES (?,?,?,?,?,?)',
    ).bind(provider, profile.providerId, st.linkUid, (profile.email || '').toLowerCase(), profile.login, now()).run();
    return appRedirect(c, '/?oauth=linked#settings');
  }

  // --- Giriş / qeydiyyat rejimi ---
  const outcome = await resolveAccount(c.env, provider, profile);

  if (outcome.kind === 'signup') {
    // Hesab HƏLƏ yaradılmır — 18+ qapısı sihirbazdadır (bax oauth.ts izahı).
    const ticket = await createPending(c.env, outcome.profile);
    return appRedirect(c, `/?oauth_ticket=${ticket}`);
  }

  const uid = outcome.uid;
  const row = await D(c).prepare('SELECT blocked FROM users WHERE id = ?').bind(uid).first<any>();
  if (!row || row.blocked) return appRedirect(c, '/?oauth=blocked');

  await logSecurityEvent(c.env, c.req, {
    type: 'login_ok', uid, severity: 'info', meta: { flow: 'oauth', provider, linked: outcome.kind === 'linked' },
  });
  await grantDailyLogin(c, uid);   // PRD §6 (D-6.b) — OAuth callback də girişdir
  const pair = await createSession(c.env, c.req, uid);
  return appRedirect(c, st.returnTo, sessionCookies(pair));
}

// Sihirbaz gözləyən OAuth profilini oxuyur (ad/email/avatar ilkin doldurma).
export async function oauthPending(c: Ctx) {
  const p = await readPending(c.env, c.url.searchParams.get('ticket') || '');
  if (!p) return err('Bilet etibarsız və ya vaxtı bitib.', 404, 'ticket_invalid');
  return json({
    provider: p.provider, name: p.name, email: p.email, avatar: p.avatar,
    // İstifadəçi adı təklifi serverdə yoxlanılır ki, sihirbaz boş olanı göstərsin.
    username: await suggestUsername(c.env, p.login, p.email),
  });
}

/* ---------- bağlı hesablar (Parametrlər) ---------- */
export async function listOAuthAccounts(c: Ctx) {
  const rows = await D(c).prepare(
    'SELECT provider, login, email, linked_at FROM oauth_accounts WHERE uid = ?',
  ).bind(c.user!.id).all<any>();
  return json({
    accounts: rows.results.map(r => ({
      provider: r.provider, login: r.login, email: r.email, linkedAt: r.linked_at,
    })),
    available: configuredProviders(c.env),
    hasPassword: c.user!.has_password !== 0,
  });
}

export async function unlinkOAuth(c: Ctx, provider: string) {
  const rows = await D(c).prepare('SELECT provider FROM oauth_accounts WHERE uid = ?').bind(c.user!.id).all<any>();
  const hasPassword = c.user!.has_password !== 0;
  // Son giriş üsulunu silməyə İCAZƏ VERİLMİR — istifadəçi öz hesabından
  // birdəfəlik kilidlənərdi (parol yoxdur, bağlı provayder qalmır).
  if (!hasPassword && rows.results.length <= 1) {
    return err('Bu yeganə giriş üsulunuzdur. Əvvəlcə şifrə təyin edin.', 400, 'last_method');
  }
  await D(c).prepare('DELETE FROM oauth_accounts WHERE uid = ? AND provider = ?')
    .bind(c.user!.id, provider).run();
  // AUDIT M-12 — bu, İSTİFADƏÇİ əməliyyatıdır, admin əməliyyatı deyil.
  // `admin_logs`-a yazılması admin jurnalını çirkləndirirdi: panel "admin
  // nə etdi" sualına cavab verməli ikən istifadəçi hərəkətləri ilə dolurdu.
  // Doğru yer `security_events`-dir — giriş üsulunun dəyişməsi təhlükəsizlik
  // hadisəsidir və `sessions` ilə eyni panelə düşür.
  c.ctx.waitUntil(logSecurityEvent(c.env, c.req, {
    type: 'session_revoked', severity: 'warning',
    uid: c.user!.id, username: c.user!.username,
    meta: { action: 'oauth_unlink', provider },
  }));
  return json({ ok: true });
}

/* ═══════════ PAROL BƏRPASI — AUDIT-TASK-10 / Faza 5/#5 ═══════════ */

/**
 * Audit: *"Parol bərpası (unutma) axını YOXDUR — yalnız admin `temp-password`
 * verir."* Sənəd bunu belə qiymətləndirir: *"real boşluqdur: parolunu unudan
 * istifadəçi hazırda ADMİN MÜDAXİLƏSİ OLMADAN hesabına qayıda bilmir."*
 *
 * ⚠ NİYƏ MAGIC LINK KİFAYƏT ETMİR: o, SESSİYA verir, lakin parolu DƏYİŞMİR.
 *   İstifadəçi girə bilir, amma parolunu bilmədiyi üçün növbəti cihazda yenə
 *   bloklanır. Üstəlik `changePassword` CARİ parolu tələb edir.
 *
 * ⚠ TOKEN AXINI magic link ilə EYNİ NAXIŞDADIR (yenisi icad edilmir):
 *   • token KV-də YALNIZ HEŞ kimi saxlanılır — KV oxunsa belə token bərpa
 *     oluna bilməz
 *   • birdəfəlikdir: istifadə anında silinir
 *   • ünvan başına limit — botnet fərqli IP-lərdən eyni qutunu doldura bilməsin
 *
 * 🔴 HESAB SADALANMASI: cavab HƏMİŞƏ eynidir (`{ok:true}`) — e-poçtun
 *   qeydiyyatda olub-olmaması BİLİNMİR. Bu, magic link ilə eyni qaydadır.
 */
const RESET_TTL = 900;   // 15 dəqiqə — magic link-dən uzun, çünki istifadəçi
                         // yeni parol düşünməlidir.

export async function passwordResetRequest(c: Ctx) {
  const b = await readJson(c.req);
  const gate = await turnstileGate(c, b.turnstileToken);
  if (gate) return gate;

  const neutral = json({ ok: true });
  if (!emailEnabled(c.env)) return neutral;

  const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return neutral;

  const perAddr = `pwrate:${await sha256Hex(email)}`;
  const sent = parseInt((await c.env.SESSIONS.get(perAddr)) || '0', 10);
  if (sent >= 3) return neutral;
  await c.env.SESSIONS.put(perAddr, String(sent + 1), { expirationTtl: 900 });

  const row = await D(c).prepare(
    `SELECT id, name, blocked, settings FROM users
      WHERE (email = ?1 AND email != '') OR lower(contact_email) = ?1 LIMIT 1`,
  ).bind(email).first<any>();
  if (!row || row.blocked) return neutral;

  const token = b64uRandom(32);
  await c.env.SESSIONS.put(
    `pwreset:${await sha256Hex(token)}`,
    JSON.stringify({ uid: row.id, email }),
    { expirationTtl: RESET_TTL },
  );

  /* 6 rəqəmli təsdiq kodu — LİNKƏ ƏLAVƏ, əvəz DEYİL.
   *
   * ⚠ NİYƏ LAZIMDIR: bəzi poçt client-ləri və korporativ skanerlər məktubdakı
   *   linkləri ön-yükləyir; birdəfəlik token istifadəçi klikləməmiş yanır.
   *   Kod bu halda yeganə çıxış yoludur.
   *
   * ⚠ Açar KODUN ÖZÜ deyil, `sha256(email + ':' + kod)`-dur: KV-də düz kod
   *   saxlanmır və açar yalnız DÜZGÜN e-poçtu bilən tərəfindən hesablana
   *   bilər — yəni kodu təsadüfi sınayan üçün e-poçt da lazımdır.
   *
   * ⚠ `crypto.getRandomValues` işlədilir, `Math.random` YOX: sonuncu
   *   kriptoqrafik deyil və təxmin edilə bilər.
   */
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = String(buf[0] % 1_000_000).padStart(6, '0');
  await c.env.SESSIONS.put(
    `pwcode:${await sha256Hex(email + ':' + code)}`,
    JSON.stringify({ uid: row.id, email }),
    { expirationTtl: RESET_TTL },
  );
  // Kod cəhdlərinin sayğacı sıfırlanır (yeni kod = yeni 5 cəhd).
  await c.env.SESSIONS.delete(`pwtry:${await sha256Hex(email)}`);

  const lang = mailLang(fromJSON<any>(row.settings, {})?.lang);
  const url = `${c.url.origin}/?reset=${token}`;
  const mail = passwordResetMail(row.name || '', url, code, lang);
  await sendEmail(c.env, { ...mail, to: email });

  await logSecurityEvent(c.env, c.req, {
    type: 'password_changed', uid: row.id, severity: 'warning',
    meta: { flow: 'reset_requested' },
  });
  return neutral;
}

/**
 * Yeni parolun təyini.
 *
 * ⚠ BÜTÜN SESSİYALAR LƏĞV EDİLİR: parol bərpası çox vaxt "hesabım ələ
 *   keçirilib" ssenarisidir. Hücumçunun açıq sessiyası qalsaydı bərpa mənasız
 *   olardı. Eyni səbəbdən WS soketləri də kəsilir (AUDIT-TASK-9 / H-6).
 */
export async function passwordResetConfirm(c: Ctx) {
  const b = await readJson(c.req);
  const token = String(b.token || '');
  const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
  const code = String(b.code || '').replace(/\D/g, '');

  /* İKİ GİRİŞ YOLU: linkdəki `token` VƏ YA `email` + 6 rəqəmli `code`.
   * Hər ikisi eyni nəticəyə gətirir; aşağıdakı məntiq dəyişmir. */
  if (!token && !(email && code.length === 6)) return badReq('Token və ya kod yoxdur.');

  const pw = checkPasswordStrength(b.password);
  if (!pw.ok) return badReq(pw.error!);

  /* 🔴 KOD YOLU ÜÇÜN BRUTE-FORCE QORUMASI.
   *   6 rəqəm = 1 000 000 variant. Marşrutun öz `rl: 'auth'` limiti ilə
   *   yanaşı, HƏR E-POÇT üçün ayrıca cəhd sayğacı saxlanılır: 5 səhv
   *   cəhddən sonra kod yolu bağlanır (link yolu təsirlənmir).
   *   Sayğac yeni kod istənəndə sıfırlanır.
   * ⚠ Sayğac ARTIRILIR, sonra yoxlanılır — əks halda paralel sorğular
   *   həddi keçə bilərdi. */
  let tryKey = '';
  if (!token) {
    tryKey = `pwtry:${await sha256Hex(email)}`;
    const tries = parseInt((await c.env.SESSIONS.get(tryKey)) || '0', 10) + 1;
    await c.env.SESSIONS.put(tryKey, String(tries), { expirationTtl: RESET_TTL });
    if (tries > 5) {
      await logSecurityEvent(c.env, c.req, {
        type: 'login_failed', severity: 'warning',
        meta: { flow: 'password_reset', reason: 'code_attempts_exceeded' },
      });
      return err('Çox sayda səhv cəhd. Yeni kod istəyin.', 429, 'reset_locked');
    }
  }

  // ⚠ Kod açarı `sha256(email + ':' + kod)`-dur — bax `passwordResetRequest`.
  const key = token
    ? `pwreset:${await sha256Hex(token)}`
    : `pwcode:${await sha256Hex(email + ':' + code)}`;
  const raw = await c.env.SESSIONS.get(key);
  if (!raw) {
    await logSecurityEvent(c.env, c.req, {
      type: 'login_failed', severity: 'warning',
      meta: { flow: 'password_reset', reason: 'invalid_or_used' },
    });
    return err(
      token ? 'Bərpa linki etibarsız və ya vaxtı bitib.' : 'Kod səhvdir və ya vaxtı bitib.',
      400, 'reset_invalid',
    );
  }
  // BİRDƏFƏLİK — oxunan kimi silinir (magic link ilə eyni qayda).
  await c.env.SESSIONS.delete(key);
  // Uğurlu təsdiqdən sonra cəhd sayğacı da təmizlənir.
  if (tryKey) await c.env.SESSIONS.delete(tryKey);

  // ⚠ `storedEmail` — yuxarıdakı `email` (istifadəçinin YAZDIĞI) ilə
  //   qarışdırılmamalıdır. Bazaya yazılan həmişə KV-də saxlanılan, yəni
  //   sorğu anında DOĞRULANMIŞ ünvandır.
  const { uid, email: storedEmail } = JSON.parse(raw) as { uid: string; email: string };
  const row = await D(c).prepare('SELECT id, blocked FROM users WHERE id = ?')
    .bind(uid).first<any>();
  if (!row || row.blocked) return err('Hesab əlçatmazdır.', 403, 'account_blocked');

  const { hash, salt, iterations } = await hashPassword(String(b.password));
  await D(c).prepare(
    `UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iter = ?,
            must_reset_password = 0, email = ?, email_verified = 1 WHERE id = ?`,
  ).bind(hash, salt, iterations, storedEmail, uid).run();

  await revokeAllSessions(c.env, uid, 'password');
  c.ctx.waitUntil(kickEverywhere(c.env, uid));
  await logSecurityEvent(c.env, c.req, {
    type: 'password_changed', uid, severity: 'warning', meta: { flow: 'reset_confirmed' },
  });

  // Yeni sessiya DƏRHAL verilir: istifadəçi bir də əl ilə giriş etməməlidir.
  await grantDailyLogin(c, uid);   // PRD §6 (D-6.b) — bərpadan sonrakı avtomatik giriş
  const pair = await createSession(c.env, c.req, uid);
  return withSession({ ok: true }, pair);
}
