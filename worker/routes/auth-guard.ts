// Hesab səviyyəli brute-force qoruması — AUDIT-TASK-9 / A-3.
//
// AUDIT-TASK-10 / Faza 3.1: `routes/auth.ts` 46 KB idi və qəbul meyarı 18
// ("heç bir fayl > 30 KB") pozulurdu. Bölünəndə bu köməkçilər HƏR İKİ hissə
// tərəfindən işlədildiyi üçün ayrıca modula çıxarıldı:
//   • `auth.ts`         — parol girişi (`login`)
//   • `auth-methods.ts` — MFA-nın ikinci addımı (`mfaVerify`)
// İkisi də EYNİ astanaları və EYNİ Turnstile qapısını işlətməlidir; iki nüsxə
// saxlasaydıq onlar vaxtla ayrılardı — auditin `notify()` haqqında dediyi hal.
import { Ctx, err, fromJSON } from '../util';
import { logSecurityEvent, verifyTurnstile } from '../security';
import { emailEnabled, sendEmail, attackAlertMail, mailLang } from '../email';
import { D } from './shared';

/* ================= AUTH ================= */

/**
 * 🔴 HESAB BAŞINA QORUMA ASTANALARI — AUDIT-TASK-9 / A-3.
 *
 * IP əsaslı rate limit paylanmış hücumu (hər IP-dən 5 cəhd, 1000 IP) TUTMUR.
 * `recentFailures` isə həm IP, həm İSTİFADƏÇİ ADI üzrə sayır → hədəflənmiş
 * hücum məhz orada görünür.
 *
 * ⚠ NİYƏ KİLİD DEYİL, CAPTCHA: sadə hesab kilidi YENİ hücum vektoru yaradır —
 * rəqib qurbanın hesabını istənilən vaxt bloklaya bilər (audit §5.2 "dörd tələ").
 * Turnstile layihədə artıq qurulub və qurbanı heç vaxt kilidləmir.
 */
export const CAPTCHA_SOFT_AT = 3;    // şübhə → CAPTCHA istənilir, lakin fail-open qalır
export const CAPTCHA_HARD_AT = 10;   // hücum → CAPTCHA MƏCBURİDİR, fail-open BAĞLANIR

/**
 * Hesab sahibinə hücum xəbərdarlığı — AUDIT-TASK-9 / A-3 "Bildiriş".
 *
 * ⚠ HESAB SADALANMASI: funksiya çağırılır, lakin nəticəsi cavaba TƏSİR ETMİR
 *   və `waitUntil` ilə arxada işləyir. Mövcud olmayan hesab üçün sadəcə sətir
 *   tapılmır — cavab və gecikmə eyni qalır.
 *
 * Tıxac qapısı: eyni hesaba pəncərə başına BİR məktub. Olmasaydı hücumçu
 * 11-ci cəhddən sonrakı hər cəhdlə qurbanın poçtunu doldura bilərdi — yəni
 * xəbərdarlığın özü spam vektoruna çevrilərdi.
 */
export async function alertAccountOwner(c: Ctx, username: string, attempts: number): Promise<void> {
  if (!emailEnabled(c.env)) return;
  const throttleKey = `secalert:${username}`;
  if (await c.env.SESSIONS.get(throttleKey)) return;
  const row = await D(c).prepare('SELECT name, contact_email, settings FROM users WHERE username = ?')
    .bind(username).first<any>();
  const to = String(row?.contact_email || '').trim();
  if (!to) return;
  await c.env.SESSIONS.put(throttleKey, '1', { expirationTtl: 3600 });
  const mail = attackAlertMail(String(row.name || username), attempts,
    mailLang(fromJSON<any>(row.settings, {})?.lang));
  await sendEmail(c.env, { ...mail, to });
}

/**
 * Turnstile qapısı (Bənd 7).
 *
 * `required = false` (default): açar qurulmayıbsa və ya Turnstile xidmətinə
 *   çatılmasa axın maneəsiz davam edir (`verifyTurnstile` → `skipped: true`).
 *   Bu, qəsdli fail-open-dır — CAPTCHA əlçatmazlığı bütün saytı bağlamamalıdır.
 *
 * `required = true` (AUDIT-TASK-9 / A-3): FAIL-CLOSED. `CAPTCHA_HARD_AT`-dan
 *   sonra qapı yeganə hesab-səviyyəli müdafiədir; orada "skipped" qəbul etmək
 *   qorumanı tamamilə mənasızlaşdırardı — hücumçu sadəcə Turnstile-ı
 *   əlçatmaz etməyə çalışar (və ya açar konfiqi düşərsə qapı sükutla açılar).
 *
 * ⚠ HESAB SADALANMASI: bu qapı `recentFailures` ilə açılır, istifadəçinin
 *   MÖVCUDLUĞU ilə YOX. Uğursuz girişlər mövcud olmayan ad üçün də jurnala
 *   düşdüyünə görə (bax `login`) sayğac hər iki halda eyni artır və cavab
 *   fərqlənmir → hücumçu hansı adların mövcud olduğunu öyrənə bilmir.
 */
export async function turnstileGate(
  c: Ctx, token: unknown, username = '', required = false,
): Promise<Response | null> {
  const r = await verifyTurnstile(c.env, c.req, token);
  if (r.ok && !(required && r.skipped)) return null;
  await logSecurityEvent(c.env, c.req, {
    type: 'turnstile_failed', username, severity: required ? 'critical' : 'warning',
    meta: { reason: r.reason || (r.skipped ? 'skipped_but_required' : 'failed'), required },
  });
  return err('Bot yoxlaması uğursuz oldu. Səhifəni yeniləyib yenidən cəhd edin.', 403, 'turnstile_failed');
}

