// Admin domeni — AUDIT-TASK-10 / Faza 3.1.
//
// Dörd bölmə birləşdirilib: TAKSONOMİYA, ADMIN (istifadəçi/hesabat idarəsi),
// ADMIN PANELİ (TASK-6 / Bölmə 3) və TƏHLÜKƏ MONİTORİNQİ (TASK-8 / Bənd 1).
// Hamısı `admin: true` marşrutlarıdır və eyni jurnal qatını (`admin-log.ts`)
// işlədir.
//
// 🔴 SAF REFAKTOR: gövdə və şərhlər olduğu kimi köçürülüb (§11.2, §11.5).
import {
  Ctx, json, err, readJson, uuid, now, todayStr, clampStr, fromJSON, toJSON,
  mapUser, chunkForD1, placeholders,
} from '../util';
import { hashPassword, destroyAllSessions } from '../auth';
import { logAdmin, isAdminLogAction, invalidAdminAction } from '../admin-log';
import { kickEverywhere } from '../ws-kick';
import { D, badReq, csvRow, VERIFIED_XP } from './shared';
import { grantXp } from '../xp';
import { levelFromXp } from '../level';

/* ================= TAXONOMY ================= */
export async function listTaxonomies(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM taxonomies WHERE active = 1 ORDER BY sort_order ASC').all<any>();
  const out: Record<string, any[]> = { prog: [], spoken: [] };
  rows.results.forEach(r => {
    (out[r.type] = out[r.type] || []).push({
      id: r.id, label: r.label, color: r.color, icon: r.icon, flag: r.flag,
      highlightId: r.highlight_id, order: r.sort_order, active: !!r.active,
      // Miqrasiya 0050 — kataloqda skill nişanının rəng qrupu.
      // ⚠ `?? ''` : miqrasiyadan əvvəlki keşlənmiş cavablarda sütun yoxdur.
      category: r.category ?? '',
    });
  });
  return json({ taxonomies: out });
}
export async function saveTaxItem(c: Ctx, type: string) {
  const b = await readJson(c.req);
  const id = clampStr(b.id, 30) || clampStr(b.label, 30).toLowerCase().replace(/[^a-z0-9]/g, '') || uuid().slice(0, 8);
  await D(c).prepare(
    `INSERT INTO taxonomies (type, id, label, color, icon, flag, highlight_id, sort_order, active)
     VALUES (?,?,?,?,?,?,?,?,1)
     ON CONFLICT(type, id) DO UPDATE SET label=?, color=?, icon=?, flag=?, highlight_id=?, sort_order=?, active=1`,
  ).bind(type, id, clampStr(b.label, 40), b.color || null, b.icon || null, b.flag || null,
    b.highlightId || null, parseInt(b.order, 10) || 99,
    clampStr(b.label, 40), b.color || null, b.icon || null, b.flag || null,
    b.highlightId || null, parseInt(b.order, 10) || 99).run();
  return json({ ok: true });
}
export async function deactivateTaxItem(c: Ctx, type: string, id: string) {
  await D(c).prepare('UPDATE taxonomies SET active = 0 WHERE type = ? AND id = ?').bind(type, id).run();
  return json({ ok: true });
}


/* ================= ADMIN ================= */
export async function adminListFaqs(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM faqs ORDER BY sort_order ASC').all<any>();
  return json({
    faqs: rows.results.map(r => ({
      id: r.id, q: fromJSON(r.q, {}), a: fromJSON(r.a, {}),
      category: r.category, order: r.sort_order, active: !!r.active,
    })),
  });
}
export async function adminSaveFaq(c: Ctx) {
  const b = await readJson(c.req);
  const id = clampStr(b.id, 40) || uuid().slice(0, 10);
  await D(c).prepare(
    `INSERT INTO faqs (id, q, a, category, sort_order, active, created_at) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET q=?, a=?, category=?, sort_order=?, active=?`,
  ).bind(id, toJSON(b.q, '{}'), toJSON(b.a, '{}'), clampStr(b.category, 30),
    parseInt(b.order, 10) || 99, b.active === false ? 0 : 1, now(),
    toJSON(b.q, '{}'), toJSON(b.a, '{}'), clampStr(b.category, 30),
    parseInt(b.order, 10) || 99, b.active === false ? 0 : 1).run();
  return json({ ok: true });
}
export async function adminDeleteFaq(c: Ctx, id: string) {
  await D(c).prepare('DELETE FROM faqs WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
export async function adminListTestimonials(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM testimonials ORDER BY created_at DESC').all<any>();
  return json({
    testimonials: rows.results.map(r => ({
      id: r.id, authorName: r.author_name, authorTitle: fromJSON(r.author_title, {}),
      text: fromJSON(r.text, {}), rating: r.rating, featured: !!r.featured, approved: !!r.approved,
    })),
  });
}
export async function adminSaveTestimonial(c: Ctx) {
  const b = await readJson(c.req);
  const id = clampStr(b.id, 40) || uuid().slice(0, 10);
  await D(c).prepare(
    `INSERT INTO testimonials (id, author_name, author_title, text, rating, featured, approved, created_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET author_name=?, author_title=?, text=?, rating=?, featured=?, approved=?`,
  ).bind(id, clampStr(b.authorName, 60), toJSON(b.authorTitle, '{}'), toJSON(b.text, '{}'),
    Math.min(5, Math.max(1, parseInt(b.rating, 10) || 5)), b.featured ? 1 : 0, b.approved ? 1 : 0, now(),
    clampStr(b.authorName, 60), toJSON(b.authorTitle, '{}'), toJSON(b.text, '{}'),
    Math.min(5, Math.max(1, parseInt(b.rating, 10) || 5)), b.featured ? 1 : 0, b.approved ? 1 : 0).run();
  return json({ ok: true });
}
export async function adminDeleteTestimonial(c: Ctx, id: string) {
  await D(c).prepare('DELETE FROM testimonials WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
export async function adminContacts(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100').all<any>();
  return json({
    contacts: rows.results.map(r => ({
      id: r.id, name: r.name, email: r.email, message: r.message, read: !!r.read, createdAt: r.created_at,
    })),
  });
}
export async function adminContactRead(c: Ctx, id: string) {
  await D(c).prepare('UPDATE contact_messages SET read = 1 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

const ADMIN_FIELDS: Record<string, [string, number]> = {
  name: ['name', 60], bio: ['bio', 400], instagram: ['instagram', 40], github: ['github', 40],
  role: ['role', 20],
};
export async function adminPatchUser(c: Ctx, uid: string) {
  const b = await readJson(c.req);
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, [col, max]] of Object.entries(ADMIN_FIELDS)) {
    if (k in b) { sets.push(`${col} = ?`); vals.push(clampStr(b[k], max)); }
  }
  if ('verified' in b) { sets.push('verified = ?'); vals.push(b.verified ? 1 : 0); }
  if ('blocked' in b) { sets.push('blocked = ?'); vals.push(b.blocked ? 1 : 0); }
  // TASK-7 / Bənd 6: admin XP redaktəsi. Level XP-dən törənir (levelFromXP) —
  // ayrıca stored sütun yoxdur, ona görə "Lv redaktəsi" = XP redaktəsi.
  //
  // ⚠ AUDIT-TASK-9 / B: bu, XP-ni MÜTLƏQ dəyərlə yazan YEGANƏ yoldur (qalan
  //   hamısı `grantXp`-dən keçir). Loglanmasa `SUM(xp_logs) == users.xp`
  //   invariantı hər admin düzəlişində pozulardı və `/api/health` yalançı
  //   "drift" verərdi. Ona görə FƏRQ `xp_logs`-a 'admin' mənbəyi ilə yazılır.
  let xpDelta = 0;
  if ('xp' in b) {
    const next = Math.max(0, parseInt(String(b.xp), 10) || 0);
    const cur = await D(c).prepare('SELECT xp FROM users WHERE id = ?').bind(uid).first<any>();
    xpDelta = next - Number(cur?.xp || 0);
    sets.push('xp = ?'); vals.push(next);
  }
  if (!sets.length) return badReq('Dəyişiklik yoxdur.');
  vals.push(uid);
  await D(c).prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  if (xpDelta !== 0) {
    // `ref_id` NULL — admin eyni istifadəçini dəfələrlə düzəldə bilər, yəni
    // burada idempotentlik İSTƏNMİR; hər düzəliş ayrıca audit sətridir.
    await D(c).prepare(
      `INSERT INTO xp_logs (id, uid, source, ref_id, amount, created_at)
       VALUES (?, ?, 'admin', NULL, ?, ?)`,
    ).bind(uuid(), uid, xpDelta, now()).run();
  }
  // AUDIT-TASK-10 / D-6.b — PRD §6: "Hesabın təsdiqi +100".
  //
  // ⚠ `refId = uid` → hesab başına BİR DƏFƏ. Admin təsdiqi geri alıb yenidən
  //   versə XP TƏKRAR VERİLMİR: əks halda bu, admin əlində sonsuz XP düyməsi
  //   olardı (H-5-in bağladığı istismar sinfi).
  //
  // ⚠ `xpDelta` yolundan AYRIDIR: ora admin-in ƏL İLƏ yazdığı mütləq dəyəri
  //   loglayır və `ref_id` NULL-dur (qəsdən təkrarlana bilən). Bu isə qaydaya
  //   bağlı birdəfəlik bonusdur.
  if ('verified' in b && b.verified) {
    await grantXp(c.env, uid, 'verified', uid, VERIFIED_XP);
  }
  if ('blocked' in b && b.blocked) {
    await destroyAllSessions(c.env, uid);
    c.ctx.waitUntil(kickEverywhere(c.env, uid));   // H-6 / C-2 — bloklanan istifadəçi
  }

  // Jurnal: blok/blokdan-çıxarma AYRICA əməliyyatdır. Əvvəl hamısı 'user-edit'
  // kimi yazılırdı və audit jurnalında "user-edit blocked" sətrləri adi profil
  // redaktəsindən seçilmirdi — kim kimi bloklayıb, izləmək mümkün deyildi.
  const changed = Object.keys(b);
  if ('blocked' in b) {
    const act = b.blocked ? 'user-block' : 'user-unblock';
    await logAdmin(c, act, uid, '', b.blocked ? 'error' : 'success');
    // Eyni sorğuda başqa sahələr də dəyişibsə, onlar ayrıca qeyd olunur.
    const rest = changed.filter(k => k !== 'blocked');
    if (rest.length) await logAdmin(c, 'user-edit', uid, rest.join(','), 'warning');
  } else if ('verified' in b) {
    await logAdmin(c, b.verified ? 'user-verify' : 'user-unverify', uid,
      changed.join(','), b.verified ? 'success' : 'warning');
  } else if ('xp' in b) {
    const xpVal = Math.max(0, parseInt(String(b.xp), 10) || 0);
    // AUDIT-TASK-10 / D-6.a — əvvəl burada `sqrt(xp/100)+1` SABİT KOPYASI var idi.
    // `levels` cədvəli dolduqdan sonra o kopya jurnalda YANLIŞ səviyyə yazardı
    // (admin paneli bir rəqəm, profil başqa rəqəm göstərərdi). İndi tək mənbə
    // `level.ts`-dir: cədvəl boşdursa o da köhnə formulaya qayıdır.
    const lvl = await levelFromXp(c.env, xpVal);
    await logAdmin(c, 'user-level-edit', uid, `Lv${lvl} · ${xpVal} XP`, 'warning');
  } else {
    await logAdmin(c, 'user-edit', uid, changed.join(','), 'warning');
  }
  return json({ ok: true });
}

export async function adminTempPassword(c: Ctx, uid: string) {
  const b = await readJson(c.req);
  if (typeof b.password !== 'string' || b.password.length < 6) return badReq('Şifrə minimum 6 simvol.');
  const { hash, salt, iterations } = await hashPassword(b.password);
  await D(c).prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iter = ?, must_reset_password = 1 WHERE id = ?')
    .bind(hash, salt, iterations, uid).run();
  await destroyAllSessions(c.env, uid);
  c.ctx.waitUntil(kickEverywhere(c.env, uid));   // H-6 / C-2 — müvəqqəti parol
  await logAdmin(c, 'temp-password', uid);
  return json({ ok: true });
}

// ⚠ Qapı İKİ YERDƏ var və bu, ŞÜURLU dublikatdır (AUDIT-2026-07-26 / H-2).
// Marşrut cədvəlindəki `admin: true` bayrağı bir dəfə səhvən buraxılmışdı —
// qonşu 32 admin route-unda vardı, məhz bunda yox idi. Nəticədə giriş etmiş
// İSTƏNİLƏN istifadəçi bütün admin uid-lərini sadalaya bilirdi; `/api/users`
// onsuz da uid→username xəritəsi verdiyi üçün bu, birbaşa "kimi hədəfləməli"
// siyahısı demək idi. Handler səviyyəsindəki bu yoxlama cədvəldəki bayraq
// yenidən itsə də sızmanın qarşısını alır.
export async function adminListAdmins(c: Ctx) {
  if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
  const rows = await D(c).prepare('SELECT user_id FROM admins').all<any>();
  return json({ admins: rows.results.map(r => r.user_id) });
}
/* 🔴 İKİ QEYD SİSTEMİ BİRLİKDƏ YENİLƏNMƏLİDİR — yoxsa admin əlavəsi HEÇ NƏ etmir.
 *
 *   `admins` cədvəli `c.isAdmin`-i (binar bayraq) idarə edir, `users.role` isə
 *   icazə matrisini. Miqrasiya 0035 35 admin marşrutunu `admin: true`-dan
 *   `perm:` qapısına köçürdü — yəni səlahiyyət ARTIQ `admins`-dən deyil,
 *   ROLDAN gəlir.
 *
 *   Bu funksiya yalnız `admins`-ə yazırdı. Ölçüldü: 0035-dən SONRA əlavə
 *   edilən hər admin panelə girə bilir (bayraq var), lakin `perm` daşıyan hər
 *   endpoint ona 403 verir. Qüsur tamamilə səssizdir — istifadəçi "panel
 *   sınıb" deyir, log isə normal 403 fonu göstərir. E2E hesabında da eyni
 *   vəziyyət var idi: `e2e_main` `admins`-dədir, rolu isə `USER`.
 *
 * ⚠ ESKALASİYA YOXDUR: marşrut `perm: 'MANAGE_ROLES'` ilə qorunur, yəni
 *   çağıran ən azı SUPER_ADMIN-dir (prioritet 90) və ADMIN (80) ondan
 *   AŞAĞIDIR.
 *
 * ⚠ YALNIZ ADMIN-DƏN AŞAĞI ROLLAR QALDIRILIR. Şərt `roles.priority` üzərindən
 *   yazılıb, sabit ad siyahısı ilə yox: OWNER və ya SUPER_ADMIN hesabı
 *   `admins`-ə əlavə edilsə onu ADMIN-ə ENDİRMƏK səlahiyyət İTKİSİ olardı.
 */
export async function adminAddAdmin(c: Ctx, uid: string) {
  await D(c).batch([
    D(c).prepare('INSERT OR IGNORE INTO admins (user_id, added_at, added_by) VALUES (?,?,?)')
      .bind(uid, now(), c.user!.id),
    D(c).prepare(
      `UPDATE users SET role = 'ADMIN'
        WHERE id = ?
          AND COALESCE((SELECT priority FROM roles WHERE name = users.role), 0)
              < (SELECT priority FROM roles WHERE name = 'ADMIN')`,
    ).bind(uid),
  ]);
  await logAdmin(c, 'admin-add', uid);
  return json({ ok: true });
}
export async function adminRemoveAdmin(c: Ctx, uid: string) {
  // 🔴 AUDIT M-14 — ən kritik bənd: əvvəl İSTƏNİLƏN admini, o cümlədən
  // SONUNCUNU və ÖZÜNÜ silmək mümkün idi. Bütün adminlər silinsə panelə
  // çıxış BƏRPA OLUNMAZ şəkildə bağlanır ("özünü admin et" endpoint-i yoxdur
  // və olmamalıdır — yeganə yol birbaşa D1 müdaxiləsidir).
  //
  // İki AYRI müdafiə (biri digərini əvəz etmir):
  //   1) sonuncu admin — panel sahibsiz qalmasın;
  //   2) özünü silmə — səhvən öz-özünü çıxarma (ən çox rast gəlinən hal).
  if (uid === c.user!.id) {
    return err('Öz admin hüququnuzu silə bilməzsiniz.', 409, 'self_admin_removal');
  }
  const row = await D(c).prepare('SELECT COUNT(*) AS n FROM admins').first<any>();
  if (Number(row?.n || 0) <= 1) {
    return err('Sonuncu admini silmək olmaz.', 409, 'last_admin');
  }

  /* ⚠ ROL DA GERİ ALINIR — əks halda "silmək" SİLMİRDİ.
   *   Səlahiyyət `users.role`-dan gəlir (bax `adminAddAdmin` şərhi). Yalnız
   *   `admins` sətrini silsəydik, hesab paneldə görünməzdi, lakin `perm`
   *   daşıyan 35 admin endpoint-i onun üçün AÇIQ qalardı — yəni çıxarılmış
   *   admin faktiki olaraq admin olaraq qalırdı.
   *
   * ⚠ ŞƏRT `role = 'ADMIN'`-dir, şərtsiz sıfırlama DEYİL: SUPER_ADMIN və ya
   *   OWNER hesabı `admins`-dən çıxarılsa onun rolunu endirmək səlahiyyət
   *   ITKİSİ olardı və bu funksiyanın işi deyil (bunun üçün rol redaktoru var). */
  await D(c).batch([
    D(c).prepare('DELETE FROM admins WHERE user_id = ?').bind(uid),
    D(c).prepare("UPDATE users SET role = 'USER' WHERE id = ? AND role = 'ADMIN'").bind(uid),
  ]);
  await logAdmin(c, 'admin-remove', uid);
  return json({ ok: true });
}
const mapLog = (r: any) => ({
  id: r.id, action: r.action, targetUid: r.target_id, byUid: r.by_id, byName: r.by_name,
  detail: r.detail, createdAt: r.created_at, level: r.level || 'info',
});

// Admin#6 (səviyyə filtri) + Admin#10 (keyset pagination).
export async function adminLogs(c: Ctx) {
  const u = new URL(c.req.url).searchParams;
  const where: string[] = [];
  const vals: unknown[] = [];

  const level = u.get('level');
  if (level && ['info', 'success', 'warning', 'error'].includes(level)) {
    where.push('level = ?');
    vals.push(level);
  }
  // Cursor: "<created_at>|<id>" — eyni millisaniyəli sətrlər üçün id tiebreaker.
  const cursor = u.get('cursor');
  if (cursor) {
    const i = cursor.lastIndexOf('|');
    if (i > 0) {
      const ts = Number(cursor.slice(0, i));
      if (!Number.isNaN(ts)) {
        where.push('(created_at < ? OR (created_at = ? AND id > ?))');
        vals.push(ts, ts, cursor.slice(i + 1));
      }
    }
  }
  const limit = Math.min(Math.max(parseInt(u.get('limit') || '', 10) || 40, 1), 100);
  const sql = `SELECT * FROM admin_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ` +
    'ORDER BY created_at DESC, id ASC LIMIT ?';
  const rows = await D(c).prepare(sql).bind(...vals, limit + 1).all<any>();

  const hasMore = rows.results.length > limit;
  const page = hasMore ? rows.results.slice(0, limit) : rows.results;
  const last = page[page.length - 1] as any;
  return json({
    logs: page.map(mapLog),
    nextCursor: hasMore && last ? `${last.created_at}|${last.id}` : null,
  });
}
/* ================= TASK-6 / BÖLMƏ 3 — Admin paneli ================= */

/* ---------- Admin#4 + #10: filtrlənən, səhifələnən istifadəçi siyahısı ---------- */
export async function adminUsersList(c: Ctx) {
  const u = new URL(c.req.url).searchParams;
  const where: string[] = [];
  const vals: unknown[] = [];

  const q = (u.get('q') || '').trim().toLowerCase();
  if (q) {
    // ⚠ `ESCAPE '\'` MƏCBURİDİR: aşağıda `_` və `%` `\` ilə escape olunur, amma
    // ESCAPE bəyan edilməsə SQLite `\`-i adi simvol sayır və `\_` = "\ + istənilən
    // simvol" olur. Nəticədə `_` olan İSTƏNİLƏN istifadəçi adı (məs. hər test
    // hesabı `e2e_*`) axtarışda TAPILMIRDI. `_`-siz adlar təsadüfən işləyirdi,
    // ona görə buq uzun müddət gizli qaldı.
    where.push("(lower(u.name) LIKE ? ESCAPE '\\' OR lower(u.username) LIKE ? ESCAPE '\\')");
    const like = '%' + q.replace(/[%_\\]/g, ch => '\\' + ch) + '%';
    vals.push(like, like);
  }
  // Filtrlər 0006-dakı index-lərdən istifadə edir (blocked / role / verified).
  switch (u.get('filter')) {
    case 'blocked':  where.push('u.blocked = 1'); break;
    case 'verified': where.push('u.verified = 1'); break;
    case 'admin':    where.push('a.user_id IS NOT NULL'); break;
  }
  const cursor = u.get('cursor');
  // ⚠ Əvvəl vergül operatoru ilə tək sətirdə idi (`a(), b()`) — işləyirdi,
  // lakin ESLint onu "istifadəsiz ifadə" kimi işarələyirdi və oxunuşda ikinci
  // çağırışın şərtə bağlı olduğu görünmürdü.
  if (cursor) { where.push('u.username > ?'); vals.push(cursor); }

  const limit = Math.min(Math.max(parseInt(u.get('limit') || '', 10) || 30, 1), 100);
  // admins ilə LEFT JOIN — hər sətrin admin olub-olmadığı bir sorğuda gəlir
  // (əvvəl bütün admin siyahısı ayrıca çəkilib client-də uzlaşdırılırdı).
  const sql =
    `SELECT u.*, (a.user_id IS NOT NULL) AS is_admin FROM users u ` +
    `LEFT JOIN admins a ON a.user_id = u.id ` +
    `${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.username ASC LIMIT ?`;
  const rows = await D(c).prepare(sql).bind(...vals, limit + 1).all<any>();

  const hasMore = rows.results.length > limit;
  const page = hasMore ? rows.results.slice(0, limit) : rows.results;
  const last = page[page.length - 1] as any;
  return json({
    users: page.map(r => ({ ...mapUser(r), isAdmin: !!r.is_admin })),
    nextCursor: hasMore && last ? String(last.username) : null,
  });
}

/* ---------- Admin#5: toplu blok / blokdan çıxarma ---------- */
export async function adminBulkUsers(c: Ctx) {
  const b = await readJson(c.req);
  const action = String(b.action || '');
  if (!['block', 'unblock'].includes(action)) return badReq('Naməlum əməliyyat.');
  const uids: string[] = Array.isArray(b.uids) ? b.uids.filter((x: any) => typeof x === 'string').slice(0, 200) : [];
  if (!uids.length) return badReq('İstifadəçi seçilməyib.');
  // Admin özünü bloklaya bilməz — paneldən çıxış yolunu bağlamasın.
  const targets = uids.filter(id => id !== c.user!.id);
  if (!targets.length) return badReq('Özünü bloklaya bilməzsən.');

  const blocked = action === 'block' ? 1 : 0;
  // D-1: `uids` 200-ə qədər qəbul edilir → `blocked = ?` ilə birlikdə 201
  // dəyişən, D1 limiti isə 100. Yəni 100+ istifadəçili toplu bloklama
  // TAMAMİLƏ İŞLƏMİRDİ (`D1_ERROR: too many SQL variables`) — panel isə
  // sadəcə 500 göstərirdi. `reserved: 1` → `blocked = ?` üçün.
  // Hissələr EYNİ batch-dədir: yarımçıq bloklama admin üçün daha pisdir.
  const stmts = chunkForD1(targets, 1).map(chunk =>
    D(c).prepare(`UPDATE users SET blocked = ? WHERE id IN (${placeholders(chunk.length)})`)
      .bind(blocked, ...chunk));
  stmts.push(D(c).prepare(
    'INSERT INTO admin_logs (id, action, target_id, by_id, by_name, detail, created_at, level) VALUES (?,?,?,?,?,?,?,?)',
  ).bind(uuid(), 'bulk-' + action, '', c.user!.id, c.user!.username,
    `${targets.length} istifadəçi`, now(), blocked ? 'error' : 'success'));
  await D(c).batch(stmts);
  // Bloklananların sessiyaları dərhal ləğv olunur (batch-dən kənar — KV işidir).
  if (blocked) {
    for (const id of targets) await destroyAllSessions(c.env, id);
    // H-6 / C-2 — toplu bloklama da soketləri kəsməlidir.
    c.ctx.waitUntil(Promise.all(targets.map(id => kickEverywhere(c.env, id))));
  }

  return json({ ok: true, affected: targets.length });
}

/* ---------- Admin#8: sparkline üçün gündəlik zaman-seriyası ---------- */
// stats_daily bugünkü sətri hər çağırışda yeniləyir (upsert), sonra son N günü
// qaytarır. Ayrıca cron lazım deyil — panel açıldıqca seriya özü dolur.
export async function adminStatsDaily(c: Ctx) {
  const day = todayStr();
  // AUDIT-TASK-10 / Faza 4 — DÖRD TAM SKAN əvəzinə bir rollup oxusu.
  //
  // Audit `adminStatsDaily`-nin 4 × `COUNT(*)` etdiyini qeyd etmişdi; panel
  // 9 paralel poll işlətdiyi üçün bu, tam skanların ən sıx yeri idi.
  // Sayğaclar gecə cron-unda hesablanır (`archive.ts` → `refreshStatsRollup`).
  //
  // ⚠ FALLBACK: rollup sətri yoxdursa (miqrasiya təzə tətbiq olunub, cron hələ
  //   işləməyib) KÖHNƏ yola düşülür — panel boş rəqəm göstərməməlidir.
  const roll = await D(c).prepare('SELECT metric, value FROM stats_rollup').all<any>();
  const cached: Record<string, number> = {};
  for (const r of roll.results) cached[String(r.metric)] = Number(r.value);

  const need = ['users_total', 'posts_total', 'reports_open', 'users_blocked']
    .some(k => cached[k] === undefined);
  if (need) {
    const [u2, p2, r2, b2] = await D(c).batch([
      D(c).prepare('SELECT COUNT(*) AS n FROM users'),
      D(c).prepare('SELECT COUNT(*) AS n FROM posts'),
      D(c).prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
      D(c).prepare('SELECT COUNT(*) AS n FROM users WHERE blocked = 1'),
    ]);
    const pick = (r: any) => Number((r.results[0] as any)?.n || 0);
    cached.users_total = pick(u2); cached.posts_total = pick(p2);
    cached.reports_open = pick(r2); cached.users_blocked = pick(b2);
  }
  const uc = cached.users_total, pc = cached.posts_total;
  const rc = cached.reports_open, bc = cached.users_blocked;
  const g = (n: number) => n;
  await D(c).prepare(
    `INSERT INTO stats_daily (date, users, posts, complaints, blocked, updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(date) DO UPDATE SET users=?, posts=?, complaints=?, blocked=?, updated_at=?`,
  ).bind(day, g(uc), g(pc), g(rc), g(bc), now(),
    g(uc), g(pc), g(rc), g(bc), now()).run();

  const days = Math.min(Math.max(parseInt(new URL(c.req.url).searchParams.get('days') || '', 10) || 30, 2), 90);
  const rows = await D(c).prepare(
    'SELECT * FROM stats_daily ORDER BY date DESC LIMIT ?',
  ).bind(days).all<any>();
  return json({
    // köhnədən yeniyə — qrafik soldan sağa oxunur
    series: rows.results.reverse(),
    today: { users: g(uc), posts: g(pc), complaints: g(rc), blocked: g(bc) },
  });
}

/* ---------- Admin#11: CSV ixracı (stream) ---------- */
// Bütün nəticəni yaddaşda yığmaq əvəzinə D1-dən hissə-hissə oxuyub axına yazırıq —
// Worker-in yaddaş limiti böyük siyahılarda da aşılmır.

const EXPORTS: Record<string, { cols: string[]; sql: string; map: (r: any) => unknown[] }> = {
  users: {
    cols: ['username', 'name', 'email', 'xp', 'streak', 'tasks_completed', 'verified', 'blocked', 'role', 'joined_at', 'last_active_at'],
    sql: 'SELECT * FROM users ORDER BY username ASC LIMIT ? OFFSET ?',
    map: r => [r.username, r.name, r.contact_email, r.xp, r.streak, r.tasks_completed,
      r.verified ? 'yes' : 'no', r.blocked ? 'yes' : 'no', r.role,
      new Date(r.joined_at).toISOString(), r.last_active_at ? new Date(r.last_active_at).toISOString() : ''],
  },
  logs: {
    cols: ['created_at', 'level', 'action', 'by_name', 'target_id', 'detail'],
    sql: 'SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
    map: r => [new Date(r.created_at).toISOString(), r.level || 'info', r.action, r.by_name, r.target_id, r.detail],
  },
};

export async function adminExportCsv(c: Ctx, kind: string) {
  const spec = EXPORTS[kind];
  if (!spec) return err('Naməlum ixrac növü.', 404);

  const CHUNK = 500;
  const enc = new TextEncoder();
  const db = D(c);
  const stream = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      // İlk çağırışda BOM + başlıq: BOM olmadan Excel UTF-8-i tanımır və
      // Azərbaycan hərfləri (ə, ğ, ş) pozulur.
      if (!(this as any)._started) {
        (this as any)._started = true;
        (this as any)._offset = 0;
        ctrl.enqueue(enc.encode('\uFEFF' + csvRow(spec.cols)));
        return;
      }
      const offset = (this as any)._offset as number;
      const rows = await db.prepare(spec.sql).bind(CHUNK, offset).all<any>();
      for (const r of rows.results) ctrl.enqueue(enc.encode(csvRow(spec.map(r))));
      (this as any)._offset = offset + CHUNK;
      if (rows.results.length < CHUNK) ctrl.close();
    },
  });

  await logAdmin(c, 'export-' + kind, '', '', 'info');
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="collabix-${kind}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

/* ---------- Admin#3: taksonomiya sırasının toplu yenilənməsi ---------- */
export async function reorderTaxonomy(c: Ctx, type: string) {
  const b = await readJson(c.req);
  const ids: string[] = Array.isArray(b.ids) ? b.ids.filter((x: any) => typeof x === 'string').slice(0, 300) : [];
  if (!ids.length) return badReq('Sıra boşdur.');
  // Tək batch: N sətrin sort_order-i bir gedişdə yazılır (Admin#3 "batch yenilə").
  await D(c).batch(ids.map((id, i) =>
    D(c).prepare('UPDATE taxonomies SET sort_order = ? WHERE type = ? AND id = ?').bind(i + 1, type, id)));
  await logAdmin(c, 'taxonomy-reorder', type, `${ids.length} element`, 'info');
  return json({ ok: true });
}

export async function adminLogAction(c: Ctx) {
  const b = await readJson(c.req);
  // AUDIT M-13 — əvvəl İXTİYARİ `action` sətri jurnala düşürdü: admin öz izini
  // saxtalaşdıra bilirdi (log forging). Jurnal audit üçündürsə, məzmununu
  // client təyin edə bilməz. Ağ siyahı `admin-log.ts`-dədir (tək mənbə).
  if (!isAdminLogAction(b.action)) return invalidAdminAction();
  await logAdmin(c, b.action, clampStr(b.targetUid, 40), clampStr(b.detail, 120));
  return json({ ok: true });
}


/* ================= TƏHLÜKƏ MONİTORİNQİ (Bənd 1) ================= */

const SEC_TYPES = ['login_failed', 'login_ok', 'geo_change', 'rate_limit', 'token_reuse',
  'turnstile_failed', 'session_revoked', 'upload_rejected', 'password_changed'];
const SEC_SEVERITIES = ['info', 'warning', 'critical'];

// Son hadisələr — tip/səviyyə filtri + keyset pagination.
export async function securityEvents(c: Ctx) {
  const p = c.url.searchParams;
  const where: string[] = [];
  const vals: unknown[] = [];

  // ⚠ Ağ siyahı: dəyərlər SQL-ə birbaşa düşmür, amma filtr açarı yalnız
  // tanınan siyahıdan qəbul edilir ki, gözlənilməz dəyər sorğunu boşaltmasın.
  const type = p.get('type');
  if (type && SEC_TYPES.includes(type)) { where.push('type = ?'); vals.push(type); }
  const sev = p.get('severity');
  if (sev && SEC_SEVERITIES.includes(sev)) { where.push('severity = ?'); vals.push(sev); }
  const ip = p.get('ip');
  if (ip) { where.push('ip = ?'); vals.push(clampStr(ip, 45)); }

  // Keyset kursoru: (created_at, id) — offset-dən fərqli olaraq yeni hadisə
  // gələndə səhifələr sürüşmür.
  const cursor = p.get('cursor');
  if (cursor) {
    const [ts, id] = cursor.split('_');
    where.push('(created_at < ? OR (created_at = ? AND id < ?))');
    vals.push(parseInt(ts, 10) || 0, parseInt(ts, 10) || 0, id || '');
  }

  const limit = Math.min(parseInt(p.get('limit') || '50', 10) || 50, 100);
  const sql = `SELECT id, type, uid, username, ip, country, city, severity, meta, created_at
                 FROM security_events
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY created_at DESC, id DESC LIMIT ?`;
  const rows = await D(c).prepare(sql).bind(...vals, limit + 1).all<any>();

  const list = rows.results.slice(0, limit);
  const last = list[list.length - 1];
  return json({
    events: list.map(r => ({
      id: r.id, type: r.type, uid: r.uid, username: r.username,
      ip: r.ip, country: r.country, city: r.city, severity: r.severity,
      meta: fromJSON(r.meta, {}), createdAt: r.created_at,
    })),
    cursor: rows.results.length > limit && last ? `${last.created_at}_${last.id}` : null,
  });
}

// Dashboard xülasəsi: sayğaclar + trend sparkline + top IP/ölkə.
export async function securitySummary(c: Ctx) {
  const day = 86_400_000;
  const since24 = now() - day;
  const since7d = now() - 7 * day;

  const [counts, trend, topIps, topCountries] = await D(c).batch<any>([
    // Son 24 saatın tip üzrə bölgüsü — kartlar üçün.
    D(c).prepare(
      `SELECT type, severity, COUNT(*) AS n FROM security_events
        WHERE created_at > ? GROUP BY type, severity`,
    ).bind(since24),
    // Uğursuz giriş trendi (saatlıq, son 24 saat) — sparkline üçün.
    // Saat qovşağı epoch-ms-dən bölmə ilə hesablanır; strftime SQLite-da
    // saniyə gözləyir, bizim vaxtlar isə millisaniyədir.
    D(c).prepare(
      `SELECT (created_at / 3600000) AS hour, COUNT(*) AS n FROM security_events
        WHERE type = 'login_failed' AND created_at > ?
        GROUP BY hour ORDER BY hour`,
    ).bind(since24),
    // Ən çox uğursuz giriş göndərən IP-lər (son 7 gün) — auto-blok namizədləri.
    D(c).prepare(
      `SELECT ip, country, city, COUNT(*) AS n,
              COUNT(DISTINCT username) AS targets, MAX(created_at) AS last_at
         FROM security_events
        WHERE type = 'login_failed' AND created_at > ? AND ip != ''
        GROUP BY ip ORDER BY n DESC LIMIT 10`,
    ).bind(since7d),
    // Coğrafi bölgü — xəritə üçün.
    D(c).prepare(
      `SELECT country, COUNT(*) AS n FROM security_events
        WHERE created_at > ? AND country != ''
        GROUP BY country ORDER BY n DESC LIMIT 20`,
    ).bind(since7d),
  ]);

  const byType: Record<string, number> = {};
  let critical = 0, warning = 0;
  for (const r of counts.results) {
    byType[r.type] = (byType[r.type] || 0) + Number(r.n);
    if (r.severity === 'critical') critical += Number(r.n);
    if (r.severity === 'warning') warning += Number(r.n);
  }

  // Sparkline üçün 24 xanalı sıx massiv (boş saatlar 0) — client-də deşik olmasın.
  const nowHour = Math.floor(now() / 3600000);
  const map = new Map(trend.results.map((r: any) => [Number(r.hour), Number(r.n)]));
  const sparkline = Array.from({ length: 24 }, (_, i) => map.get(nowHour - 23 + i) || 0);

  return json({
    window: { hours: 24 },
    byType, critical, warning,
    total24h: Object.values(byType).reduce((a, b) => a + b, 0),
    sparkline,
    topIps: topIps.results.map((r: any) => ({
      ip: r.ip, country: r.country, city: r.city,
      count: Number(r.n), targets: Number(r.targets), lastAt: r.last_at,
    })),
    countries: topCountries.results.map((r: any) => ({ country: r.country, count: Number(r.n) })),
  });
}


