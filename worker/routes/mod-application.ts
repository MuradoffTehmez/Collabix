// Moderator namizədliyi — PRD §12.
//
// ════════════════════════════════════════════════════════════════════════════
// PRD §12-nin ƏSAS PRİNSİPİ
// ════════════════════════════════════════════════════════════════════════════
//
//   "İstifadəçi moderator OLMUR. Müraciət edir."
//
// Yəni moderatorluq XP və ya səviyyə ilə AVTOMATİK gəlmir (PRD §4:
// "Level heç vaxt Moderator və ya Admin etmir"). Uyğunluq yalnız MÜRACİƏT
// HÜQUQU verir; qərarı admin verir.
//
// ⚠ "XP dəyişmir" (§12) — təsdiq XP mükafatı DEYİL. `grantXp` burada
//   ÇAĞIRILMIR və çağırılmamalıdır: əks halda rol təyini XP fermalamanın
//   hədəfinə çevrilərdi.
//
// ⚠ ASTANALAR KODDA SABİT DEYİL — `moderator_requirements` cədvəlindən
//   oxunur (miqrasiya 0036). `levels` cədvəli ilə eyni fəlsəfə: tələbi
//   dəyişmək üçün deploy lazım olmamalıdır.
import { Ctx, json, err, readJson, uuid, now, clampStr } from '../util';
import { requirePermission, roleOf, invalidateRbac } from '../rbac';
import { levelFromXp } from '../level';
import { logAdmin } from '../admin-log';
import { D, badReq } from './shared';

const DAY_MS = 86_400_000;

interface Requirements {
  minAccountDays: number;
  minLevel: number;
  minReputation: number;
  warningFreeDays: number;
  requireVerified: boolean;
  reapplyDays: number;
}

/**
 * Tələblər — cədvəldən, çatışmayan açar üçün PRD default-u ilə.
 *
 * ⚠ FALLBACK QƏSDƏNDİR: cədvəl boş olsa (miqrasiya yarımçıq tətbiq olunubsa)
 *   funksiya çökmək əvəzinə PRD dəyərləri ilə işləyir — namizədlik axını
 *   konfiqurasiya qüsuruna görə tamamilə bağlanmamalıdır.
 */
async function requirements(c: Ctx): Promise<Requirements> {
  const rows = await D(c).prepare('SELECT key, value FROM moderator_requirements')
    .all<any>().catch(() => ({ results: [] as any[] }));
  const m = new Map<string, number>();
  for (const r of rows.results || []) m.set(String(r.key), Number(r.value));
  return {
    minAccountDays:  m.get('min_account_days')  ?? 90,
    minLevel:        m.get('min_level')         ?? 10,
    minReputation:   m.get('min_reputation')    ?? 500,
    warningFreeDays: m.get('warning_free_days') ?? 30,
    requireVerified: (m.get('require_verified') ?? 1) === 1,
    reapplyDays:     m.get('reapply_days')      ?? 30,
  };
}

export interface EligibilityCheck {
  key: string;
  label: string;
  ok: boolean;
  /** Cari dəyər — UI "500-dən 320" kimi göstərir. */
  current: number;
  required: number;
}

export interface Eligibility {
  eligible: boolean;
  checks: EligibilityCheck[];
  /** Açıq müraciəti varsa onun id-si. */
  pendingId: string | null;
  /** Rədddən sonra təkrar müraciətə qalan gün (0 = maneə yoxdur). */
  cooldownDays: number;
  snapshot: {
    level: number; reputation: number; accountDays: number;
    warnings30d: number; verified: boolean;
  };
}

/**
 * Uyğunluğun hesablanması — HƏM istifadəçiyə göstərmək, HƏM də müraciət
 * anında qapı kimi işlədilir.
 *
 * 🔴 TƏK MƏNBƏ OLMASI VACİBDİR: yoxlamanı iki yerdə (UI üçün və qapı üçün)
 *   ayrı yazsaydıq, biri dəyişəndə istifadəçi "uyğunsan" görüb 403 alardı.
 */
export async function evaluateEligibility(c: Ctx, uid: string): Promise<Eligibility | null> {
  const req = await requirements(c);
  const u = await D(c).prepare(
    'SELECT id, xp, reputation, verified, joined_at, role FROM users WHERE id = ?',
  ).bind(uid).first<any>();
  if (!u) return null;

  const t = now();
  const accountDays = Math.floor((t - Number(u.joined_at || t)) / DAY_MS);
  const level = await levelFromXp(c.env, Number(u.xp || 0));
  const reputation = Number(u.reputation || 0);
  const verified = !!u.verified;

  const warnRow = await D(c).prepare(
    'SELECT COUNT(*) AS n FROM warnings WHERE uid = ? AND created_at >= ?',
  ).bind(uid, t - req.warningFreeDays * DAY_MS).first<any>();
  const warnings30d = Number(warnRow?.n || 0);

  const checks: EligibilityCheck[] = [
    { key: 'account_age', label: `Hesab yaşı ≥ ${req.minAccountDays} gün`,
      ok: accountDays >= req.minAccountDays, current: accountDays, required: req.minAccountDays },
    { key: 'level', label: `Səviyyə ≥ ${req.minLevel}`,
      ok: level >= req.minLevel, current: level, required: req.minLevel },
    { key: 'reputation', label: `Reputasiya ≥ ${req.minReputation}`,
      ok: reputation >= req.minReputation, current: reputation, required: req.minReputation },
    { key: 'warning_free', label: `Son ${req.warningFreeDays} gündə xəbərdarlıq yoxdur`,
      ok: warnings30d === 0, current: warnings30d, required: 0 },
  ];
  if (req.requireVerified) {
    checks.push({ key: 'verified', label: 'Təsdiqlənmiş hesab',
      ok: verified, current: verified ? 1 : 0, required: 1 });
  }

  const pending = await D(c).prepare(
    "SELECT id FROM moderator_applications WHERE uid = ? AND status = 'pending'",
  ).bind(uid).first<any>();

  // Son RƏDD tarixindən bəri keçən müddət.
  const lastRej = await D(c).prepare(
    `SELECT reviewed_at FROM moderator_applications
      WHERE uid = ? AND status = 'rejected'
      ORDER BY reviewed_at DESC LIMIT 1`,
  ).bind(uid).first<any>();
  let cooldownDays = 0;
  if (lastRej?.reviewed_at) {
    const passed = Math.floor((t - Number(lastRej.reviewed_at)) / DAY_MS);
    cooldownDays = Math.max(0, req.reapplyDays - passed);
  }

  return {
    eligible: checks.every(x => x.ok) && !pending && cooldownDays === 0,
    checks,
    pendingId: pending?.id || null,
    cooldownDays,
    snapshot: { level, reputation, accountDays, warnings30d, verified },
  };
}

/* ═══════════════════════ İSTİFADƏÇİ TƏRƏFİ ═══════════════════════ */

/** Öz uyğunluğum — UI müraciət düyməsini buna görə aktivləşdirir. */
export async function myModeratorEligibility(c: Ctx) {
  const e = await evaluateEligibility(c, c.user!.id);
  if (!e) return err('İstifadəçi tapılmadı.', 404);
  const role = await roleOf(c.env, c.user!.id);
  // Artıq moderator və ya daha yuxarıdırsa müraciətin mənası yoxdur.
  const already = ['MODERATOR', 'SENIOR_MODERATOR', 'ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(role);
  return json({ ...e, eligible: e.eligible && !already, alreadyModerator: already, role });
}

export async function applyForModerator(c: Ctx) {
  const b = await readJson(c.req);
  const message = clampStr(b.message, 1000).trim();
  if (message.length < 30) {
    return badReq('Motivasiya mətni ən azı 30 simvol olmalıdır.');
  }

  const e = await evaluateEligibility(c, c.user!.id);
  if (!e) return err('İstifadəçi tapılmadı.', 404);

  // 🔴 QAPI SERVERDƏDİR. Client `eligible: false` görsə düyməni gizlədir,
  //   lakin sorğunu birbaşa göndərmək həmişə mümkündür (PRD §13:
  //   "Permission yalnız serverdə yoxlanmalıdır").
  if (e.pendingId) return err('Artıq baxılmamış müraciətiniz var.', 409, 'application_pending');
  if (e.cooldownDays > 0) {
    return err(`Yenidən müraciət üçün ${e.cooldownDays} gün gözləyin.`, 429, 'application_cooldown');
  }
  const failed = e.checks.filter(x => !x.ok);
  if (failed.length) {
    return err('Şərtlərə uyğun deyilsiniz.', 403, 'not_eligible');
  }
  const role = await roleOf(c.env, c.user!.id);
  if (['MODERATOR', 'SENIOR_MODERATOR', 'ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(role)) {
    return err('Artıq moderatorsunuz.', 409, 'already_moderator');
  }

  const id = uuid();
  const s = e.snapshot;
  await D(c).prepare(
    `INSERT INTO moderator_applications
       (id, uid, status, message, snap_level, snap_reputation, snap_account_days,
        snap_warnings_30d, snap_verified, created_at)
     VALUES (?1,?2,'pending',?3,?4,?5,?6,?7,?8,?9)`,
  ).bind(id, c.user!.id, message, s.level, s.reputation, s.accountDays,
    s.warnings30d, s.verified ? 1 : 0, now()).run();

  await logAdmin(c, 'mod-apply', c.user!.id, `Lv${s.level} · ${s.reputation} rep`, 'info');
  return json({ ok: true, id });
}

/** Müraciəti geri götürmək — baxılmamışsa. */
export async function withdrawModeratorApplication(c: Ctx) {
  const res = await D(c).prepare(
    `UPDATE moderator_applications SET status = 'withdrawn', reviewed_at = ?
      WHERE uid = ? AND status = 'pending'`,
  ).bind(now(), c.user!.id).run();
  if (!res.meta.changes) return err('Açıq müraciət yoxdur.', 404);
  return json({ ok: true });
}

/* ═══════════════════════ ADMİN TƏRƏFİ ═══════════════════════ */

const mapApp = (r: any) => ({
  id: r.id,
  uid: r.uid,
  username: r.username,
  name: r.name,
  photoURL: r.photo_url,
  status: r.status,
  message: r.message,
  snapshot: {
    level: r.snap_level, reputation: r.snap_reputation,
    accountDays: r.snap_account_days, warnings30d: r.snap_warnings_30d,
    verified: !!r.snap_verified,
  },
  reviewedBy: r.reviewed_by,
  reviewedAt: r.reviewed_at,
  reviewNote: r.review_note,
  createdAt: r.created_at,
});

export async function listModeratorApplications(c: Ctx) {
  // ⚠ `MANAGE_ROLES` tələb olunur, `VIEW_REPORTS` yox: bu siyahıya baxmaq
  //   rol təyini prosesinin bir hissəsidir və moderatorun özü namizədləri
  //   görməməlidir (maraqlar toqquşması).
  const denied = await requirePermission(c, 'MANAGE_ROLES');
  if (denied) return denied;

  const status = clampStr(c.url.searchParams.get('status') || 'pending', 20);
  const valid = ['pending', 'approved', 'rejected', 'withdrawn', 'all'];
  if (!valid.includes(status)) return badReq('Naməlum status.');

  const where = status === 'all' ? '' : 'WHERE a.status = ?1';
  const binds = status === 'all' ? [] : [status];
  const rows = await D(c).prepare(
    `SELECT a.*, u.username, u.name, u.photo_url
       FROM moderator_applications a
       JOIN users u ON u.id = a.uid
       ${where}
      ORDER BY a.created_at ASC
      LIMIT 100`,
  ).bind(...binds).all<any>();

  return json({ applications: (rows.results || []).map(mapApp) });
}

/**
 * Təsdiq — PRD §12: "Admin təsdiqləyir. Role dəyişir. XP dəyişmir."
 *
 * ⚠ ROL DƏYİŞİKLİYİ `assertCanAssignRole`-dan KEÇMİR və bu QƏSDƏNDİR:
 *   hədəf rol həmişə sabit `MODERATOR`-dur (client seçmir), çağıranda isə
 *   `MANAGE_ROLES` var. Eskalasiya vektoru yoxdur — istifadəçi özündən
 *   yüksək rol ala bilmir, çünki rolu o seçmir.
 */
export async function reviewModeratorApplication(c: Ctx, id: string) {
  const denied = await requirePermission(c, 'MANAGE_ROLES');
  if (denied) return denied;

  const b = await readJson(c.req);
  const approve = b.approve === true;
  const note = clampStr(b.note, 500);

  const app = await D(c).prepare(
    "SELECT * FROM moderator_applications WHERE id = ? AND status = 'pending'",
  ).bind(id).first<any>();
  if (!app) return err('Baxılmamış müraciət tapılmadı.', 404);

  const stmts = [
    D(c).prepare(
      `UPDATE moderator_applications
          SET status = ?1, reviewed_by = ?2, reviewed_at = ?3, review_note = ?4
        WHERE id = ?5 AND status = 'pending'`,
    ).bind(approve ? 'approved' : 'rejected', c.user!.id, now(), note, id),
  ];
  if (approve) {
    // ⚠ Yalnız hazırkı rolu MODERATOR-dan AŞAĞI olanlar yüksəldilir.
    //   Aralıqda admin olmuş istifadəçinin rolu geri salınmamalıdır.
    stmts.push(D(c).prepare(
      `UPDATE users SET role = 'MODERATOR'
        WHERE id = ?1
          AND (SELECT priority FROM roles WHERE name = users.role)
              < (SELECT priority FROM roles WHERE name = 'MODERATOR')`,
    ).bind(app.uid));
  }
  await D(c).batch(stmts);

  if (approve) invalidateRbac(String(app.uid));
  await logAdmin(c, approve ? 'mod-approve' : 'mod-reject', String(app.uid),
    note.slice(0, 120), approve ? 'success' : 'warning');

  return json({ ok: true, status: approve ? 'approved' : 'rejected' });
}
