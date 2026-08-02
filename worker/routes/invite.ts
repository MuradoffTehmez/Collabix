// Dəvət axını — PRD §6 "Dost dəvəti +50".
//
// ⚠ NİYƏ AYRICA MODUL: dəvət qeydiyyat axınına toxunur (`routes/auth.ts`),
//   lakin öz idarəetmə endpointləri var. `auth.ts`-ə qoysaydıq artıq 24 KB
//   olan fayl daha da böyüyərdi (Faza 3.1-in qaydası).
import { Ctx, json, err, now, clampStr } from '../util';
import { grantXp } from '../xp';
import { D, INVITE_XP } from './shared';

/**
 * Kod əlifbası — oxşar simvollar (0/O, 1/I/l) QƏSDƏN YOXDUR.
 *
 * ⚠ Dəvət kodu ƏLLƏ köçürülür və şifahi deyilir. `0` ilə `O`-nu qarışdıran
 *   istifadəçi "kod işləmir" deyə şikayət edərdi.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;

function generateCode(): string {
  const buf = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(buf);
  let out = '';
  // ⚠ `% ALPHABET.length` cüzi meyl yaradır (256 % 31 ≠ 0), lakin kod
  //   təhlükəsizlik sirri deyil — təsadüfilik yalnız toqquşmanı azaltmaq
  //   üçündür və 31^8 ≈ 8,5×10^11 fəza kifayətdir.
  for (const b of buf) out += ALPHABET[b % ALPHABET.length];
  return out;
}

const normalizeCode = (v: unknown) =>
  clampStr(v, 16).toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ═══════════════════════ İSTİFADƏÇİ TƏRƏFİ ═══════════════════════ */

/** Öz dəvət kodlarım + statistika. */
export async function myInvites(c: Ctx) {
  const rows = await D(c).prepare(
    `SELECT code, max_uses, uses, expires_at, active, created_at
       FROM invites WHERE inviter_uid = ? ORDER BY created_at DESC LIMIT 20`,
  ).bind(c.user!.id).all<any>();

  const stat = await D(c).prepare(
    'SELECT COUNT(*) AS n FROM invite_redemptions WHERE inviter_uid = ?',
  ).bind(c.user!.id).first<any>();

  return json({
    invites: (rows.results || []).map((r: any) => ({
      code: r.code, maxUses: r.max_uses, uses: r.uses,
      expiresAt: r.expires_at, active: !!r.active, createdAt: r.created_at,
    })),
    totalInvited: Number(stat?.n || 0),
    xpPerInvite: INVITE_XP,
  });
}

/**
 * Yeni kod.
 *
 * ⚠ AÇIQ KOD SAYI MƏHDUDDUR (5): limitsiz kod yaratmaq bazanı şişirdərdi və
 *   fermalama üçün paralel kanal açardı. Köhnə kodu deaktiv edib yenisini
 *   almaq mümkündür.
 */
export async function createInvite(c: Ctx) {
  const openRow = await D(c).prepare(
    'SELECT COUNT(*) AS n FROM invites WHERE inviter_uid = ? AND active = 1',
  ).bind(c.user!.id).first<any>();
  if (Number(openRow?.n || 0) >= 5) {
    return err('Ən çoxu 5 aktiv dəvət kodunuz ola bilər.', 409, 'invite_limit');
  }

  // Toqquşma ehtimalı yox dərəcəsindədir, lakin `PRIMARY KEY` pozuntusu
  // istifadəçiyə 500 kimi görünərdi — üç cəhd bunu praktiki olaraq sıfırlayır.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    const res = await D(c).prepare(
      `INSERT OR IGNORE INTO invites (code, inviter_uid, created_at) VALUES (?,?,?)`,
    ).bind(code, c.user!.id, now()).run();
    if (res.meta.changes > 0) return json({ ok: true, code });
  }
  return err('Kod yaradıla bilmədi, yenidən cəhd edin.', 503, 'code_collision');
}

export async function revokeInvite(c: Ctx, code: string) {
  const res = await D(c).prepare(
    'UPDATE invites SET active = 0 WHERE code = ? AND inviter_uid = ?',
  ).bind(normalizeCode(code), c.user!.id).run();
  if (!res.meta.changes) return err('Kod tapılmadı.', 404);
  return json({ ok: true });
}

/**
 * Kodun etibarlılığı — qeydiyyat formu yazarkən canlı yoxlama üçün.
 *
 * ⚠ QONAQ ÜÇÜNDÜR (`auth` yoxdur). Cavab dəvət edənin ADINI qaytarır ki,
 *   istifadəçi "kimin dəvəti ilə qoşulduğunu" görsün — lakin BAŞQA HEÇ NƏ
 *   (uid, e-poçt yox): kod sadalayan hücumçu istifadəçi kataloqu çıxara
 *   bilməməlidir.
 */
export async function checkInvite(c: Ctx, code: string) {
  const row = await lookupInvite(c, normalizeCode(code));
  if (!row) return json({ valid: false });
  return json({ valid: true, inviterName: row.inviter_name });
}

async function lookupInvite(c: Ctx, code: string): Promise<any | null> {
  if (!code) return null;
  const row = await D(c).prepare(
    `SELECT i.code, i.inviter_uid, i.max_uses, i.uses, i.expires_at, i.active,
            u.name AS inviter_name, u.blocked AS inviter_blocked
       FROM invites i JOIN users u ON u.id = i.inviter_uid
      WHERE i.code = ?`,
  ).bind(code).first<any>();
  if (!row) return null;
  if (!row.active) return null;
  if (row.inviter_blocked) return null;                       // bloklu hesab dəvət edə bilməz
  if (row.expires_at && Number(row.expires_at) < now()) return null;
  if (Number(row.max_uses) > 0 && Number(row.uses) >= Number(row.max_uses)) return null;
  return row;
}

/* ═══════════════════════ QEYDİYYAT QOŞULMASI ═══════════════════════ */

/**
 * Qeydiyyat anında dəvət kodunun işlədilməsi — `routes/auth.ts`-dən çağırılır.
 *
 * 🔴 SƏSSİZ UDULUR: dəvət kodu səhv olsa QEYDİYYAT DAYANMAMALIDIR. Kod
 *   marketinq mexanizmidir, autentifikasiya şərti deyil — səhv koda görə
 *   hesab yaratmamaq istifadəçini itirmək deməkdir.
 *
 * 🔴 ÖZ-ÖZÜNÜ DƏVƏT MÜMKÜN DEYİL: `invitee === inviter` yoxlanılır. Yeni
 *   hesab olduğu üçün praktiki risk aşağıdır, lakin gələcəkdə bu funksiya
 *   başqa yerdən çağırıla bilər.
 *
 * ⚠ XP DƏVƏT EDƏNƏ verilir, dəvət olunana YOX (PRD §6 "Dost dəvəti").
 *   `refId = invitee uid` → `ux_xp_logs_source` UNIQUE indeksi eyni dəvət
 *   üçün təkrar XP-ni bağlayır.
 */
export async function redeemInvite(c: Ctx, rawCode: unknown, inviteeUid: string): Promise<void> {
  try {
    const code = normalizeCode(rawCode);
    if (!code) return;
    const row = await lookupInvite(c, code);
    if (!row) return;
    if (String(row.inviter_uid) === inviteeUid) return;

    // `INSERT OR IGNORE` + PRIMARY KEY(invitee_uid) → hesab başına bir dəfə.
    const res = await D(c).prepare(
      `INSERT OR IGNORE INTO invite_redemptions
         (invitee_uid, code, inviter_uid, created_at) VALUES (?,?,?,?)`,
    ).bind(inviteeUid, code, row.inviter_uid, now()).run();
    if (!res.meta.changes) return;      // artıq dəvətlə qoşulub

    await D(c).prepare('UPDATE invites SET uses = uses + 1 WHERE code = ?').bind(code).run();
    await grantXp(c.env, String(row.inviter_uid), 'invite', inviteeUid, INVITE_XP);
  } catch (e) {
    // Qeydiyyatı bloklamamaq üçün udulur, lakin İZSİZ QALMIR.
    console.error('dəvət kodu işlənmədi', e);
  }
}

/* ═══════════════════════ ADMİN ═══════════════════════ */

/** Dəvət statistikası — fermalama şübhəsini görmək üçün. */
export async function adminInviteStats(c: Ctx) {
  const rows = await D(c).prepare(
    `SELECT r.inviter_uid, u.username, u.name, COUNT(*) AS n
       FROM invite_redemptions r JOIN users u ON u.id = r.inviter_uid
      GROUP BY r.inviter_uid
      ORDER BY n DESC LIMIT 50`,
  ).all<any>();
  return json({
    top: (rows.results || []).map((r: any) => ({
      uid: r.inviter_uid, username: r.username, name: r.name, invited: Number(r.n),
    })),
  });
}
