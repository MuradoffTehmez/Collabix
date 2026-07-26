// TOTP (RFC 6238) — Worker-daxili, xarici kitabxanasız (TASK-8 / Bənd 2).
//
// Alqoritm HMAC-SHA1-dir (RFC 4226/6238 default-u). SHA-1 burada HEŞ FUNKSİYASI
// KİMİ İSTİFADƏ OLUNMUR — HMAC konstruksiyasının içindədir və SHA-1-in toqquşma
// zəiflikləri HMAC-SHA1-in təhlükəsizliyinə təsir etmir. Daha vacibi: Google
// Authenticator, Authy, 1Password və s. YALNIZ bunu dəstəkləyir; SHA-256-ya
// keçsək istifadəçilərin authenticator tətbiqi kodu qəbul etməzdi.
import { Env } from './util';

const enc = new TextEncoder();

export const STEP_SEC = 30;   // kod ömrü
export const DIGITS = 6;
// Qonşu pəncərələrə tolerantlıq: telefon saatı bir neçə saniyə sürüşə bilər.
// ±1 addım (±30 s) sənaye standartıdır — daha geniş pəncərə oğurlanmış kodun
// istifadə müddətini uzadar.
export const WINDOW = 1;

/* ---------- base32 (RFC 4648, authenticator tətbiqlərinin gözlədiyi format) ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;   // padding ('=') qəsdən yoxdur — otpauth URI-də lazım deyil
}

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;   // tanınmayan simvol atlanır (istifadəçi əl ilə yazıbsa)
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/* ---------- sirr ---------- */
// 20 bayt = 160 bit — RFC 4226-nın tövsiyə etdiyi minimum.
export const generateSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

// Authenticator tətbiqinin QR-dan oxuduğu standart URI.
// `issuer` həm parametrdə, həm label prefiksində olmalıdır — bəzi tətbiqlər
// birini, bəziləri o birini oxuyur.
export function otpauthUri(secret: string, account: string, issuer = 'Collabix'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({
    secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SEC),
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}

/* ---------- kod hesablama ---------- */
export const currentStep = (atMs = Date.now()) => Math.floor(atMs / 1000 / STEP_SEC);

async function hotp(secretB32: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', base32Decode(secretB32) as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  // Sayğac 8 baytlıq big-endian. JS bit əməliyyatları 32 bitlik olduğu üçün
  // yuxarı və aşağı yarım ayrıca yazılır (Math.floor bölmə ilə).
  const msg = new Uint8Array(8);
  let hi = Math.floor(counter / 0x100000000);
  let lo = counter >>> 0;
  for (let i = 3; i >= 0; i--) { msg[i] = hi & 255; hi >>>= 8; }
  for (let i = 7; i >= 4; i--) { msg[i] = lo & 255; lo >>>= 8; }

  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg as BufferSource));
  // Dinamik kəsmə (RFC 4226 §5.4)
  const offset = sig[sig.length - 1] & 0x0f;
  const bin = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16)
            | (sig[offset + 2] << 8) | sig[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * Kodu yoxlayır.
 * @param minStep bu addımdan BÖYÜK olmalıdır — replay qoruması (`user_mfa.last_step`).
 * @returns uğurlu olduqda istifadə edilmiş addım, əks halda null.
 */
export async function verifyTotp(
  secretB32: string, code: string, minStep = 0, atMs = Date.now(),
): Promise<number | null> {
  const clean = (code || '').replace(/\D/g, '');
  if (clean.length !== DIGITS) return null;

  const now = currentStep(atMs);
  for (let d = -WINDOW; d <= WINDOW; d++) {
    const step = now + d;
    // Artıq istifadə olunmuş (və ya ondan köhnə) addım qəbul edilmir.
    if (step <= minStep) continue;
    const expected = await hotp(secretB32, step);
    // Sabit vaxtlı müqayisə — kod qısadır, amma vaxt sızması ilə rəqəm-rəqəm
    // təxmin etməyə imkan verməyək.
    if (timingSafeEqual(expected, clean)) return step;
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/* ---------- ehtiyat kodlar ---------- */
// Oxunaqlı format: 10 ədəd, hər biri `xxxx-xxxx`. Qarışdırıla bilən simvollar
// (0/O, 1/I/l) əlifbadan ÇIXARILIB — istifadəçi kodu kağızdan köçürəcək.
const BC_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const BACKUP_COUNT = 10;

export function generateBackupCodes(n = BACKUP_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = crypto.getRandomValues(new Uint8Array(8));
    const s = [...r].map(b => BC_ALPHABET[b % BC_ALPHABET.length]).join('');
    codes.push(`${s.slice(0, 4)}-${s.slice(4, 8)}`);
  }
  return codes;
}

// Müqayisədən əvvəl normallaşdırma: istifadəçi defissiz və ya böyük hərflə yaza bilər.
export const normalizeBackupCode = (c: string) =>
  (c || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export async function hashBackupCode(code: string): Promise<string> {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(normalizeBackupCode(code))));
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- MFA vəziyyəti ---------- */
export async function mfaEnabled(env: Env, uid: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT confirmed FROM user_mfa WHERE uid = ?').bind(uid).first<any>();
  return !!row && row.confirmed === 1;
}
