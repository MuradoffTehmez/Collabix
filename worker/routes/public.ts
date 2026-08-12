// Publik (autentifikasiyasız) endpointlər — AUDIT-TASK-10 / Faza 3.1.
//
// Publik profil, FAQ/testimonial, əlaqə forması, newsletter və `publicConfig`
// (frontend-in feature bayraqları).
import {
  Ctx, json, err, readJson, uuid, now, clampStr, fromJSON,
  normalizeUsername, mapPost, avatarUrl,
} from '../util';
import { xpInvariant } from '../xp';
import { alert } from '../alerts';
import { emailEnabled } from '../email';
import { configuredProviders } from '../oauth';
import { D, badReq } from './shared';

/* ================= PUBLIC ================= */
export async function publicFaqs(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM faqs WHERE active = 1 ORDER BY sort_order ASC').all<any>();
  return json({
    faqs: rows.results.map(r => ({
      id: r.id, q: fromJSON(r.q, {}), a: fromJSON(r.a, {}),
      category: r.category, order: r.sort_order, active: !!r.active,
    })),
  });
}
export async function publicTestimonials(c: Ctx) {
  const rows = await D(c).prepare('SELECT * FROM testimonials WHERE approved = 1 AND featured = 1 LIMIT 12').all<any>();
  return json({
    testimonials: rows.results.map(r => ({
      id: r.id, authorName: r.author_name, authorTitle: fromJSON(r.author_title, {}),
      text: fromJSON(r.text, {}), rating: r.rating, featured: !!r.featured, approved: !!r.approved,
    })),
  });
}
export async function publicStats(c: Ctx) {
  const [u, p] = await D(c).batch([
    D(c).prepare('SELECT COUNT(*) AS n FROM users'),
    D(c).prepare('SELECT COUNT(*) AS n FROM posts'),
  ]);
  return json({ users: (u.results[0] as any).n, posts: (p.results[0] as any).n });
}

/**
 * Gündəlik aktivlik seriyası — statistika ekranındakı sütun qrafiki üçün.
 *
 * 🔴 NİYƏ SERVER TƏRƏFDƏ: `js/stats.js` bu qrafiki YÜKLƏNMİŞ lent keşindən
 *    (`getPosts()`) qururdu. Keşdə isə yalnız son səhifə var, ona görə baza
 *    dolu olsa belə qrafik "bugün 60, qalan günlər 0" göstərirdi — səhv rəqəm,
 *    boş ekran təəssüratı. Say mənbədən (COUNT + GROUP BY) gəlməlidir.
 *
 * ⚠ `idx_posts_created` (created_at DESC) sorğunu aralıqla məhdudlaşdırır;
 *   `days` 1…90 arasına kəsilir ki, tam skan mümkün olmasın.
 */
export async function activitySeries(c: Ctx) {
  const days = Math.min(Math.max(parseInt(new URL(c.req.url).searchParams.get('days') || '', 10) || 7, 1), 90);
  const from = Date.now() - days * 86_400_000;
  const [posts, comments] = await D(c).batch([
    D(c).prepare(
      `SELECT date(created_at/1000, 'unixepoch') AS d, COUNT(*) AS n
         FROM posts WHERE created_at >= ? GROUP BY d ORDER BY d`,
    ).bind(from),
    D(c).prepare(
      `SELECT date(created_at/1000, 'unixepoch') AS d, COUNT(*) AS n
         FROM comments WHERE created_at >= ? GROUP BY d ORDER BY d`,
    ).bind(from),
  ]);
  const map = new Map<string, { date: string; posts: number; comments: number }>();
  const row = (d: string) => {
    let r = map.get(d);
    if (!r) { r = { date: d, posts: 0, comments: 0 }; map.set(d, r); }
    return r;
  };
  for (const r of posts.results as any[]) row(String(r.d)).posts = Number(r.n);
  for (const r of comments.results as any[]) row(String(r.d)).comments = Number(r.n);
  return json({ days, series: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)) });
}

// Auth-suz tək-post oxuması — SSR meta + OG şəkil üçün. Yalnız public-safe sahələr;
// müəllif bloklanıbsa 404. (Feed-dəki eyni JOIN forması.)
export async function publicGetPost(c: Ctx, id: string) {
  const row = await D(c).prepare(`
    SELECT p.*, u.blocked AS author_blocked, u.username AS author_username,
           u.photo_url AS author_photo, u.verified AS author_verified,
           s.id AS s_id, s.author_id AS s_author_id, s.author_name AS s_author_name,
           s.blocks AS s_blocks, s.image_keys AS s_image_keys,
           s.text AS s_text, s.tags AS s_tags, s.created_at AS s_created_at
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    LEFT JOIN posts s ON p.shared_post_id = s.id
    WHERE p.id = ?
  `).bind(id).first<any>();
  if (!row || row.author_blocked) return err('Post tapılmadı.', 404);
  const post = mapPost(row);
  post.authorUsername = row.author_username;
  // Faza 3.5: `photo_url` ARTIQ `/files/…` daşıyır — `fileUrl()` ikiqat prefiks verirdi.
  post.authorPhoto = avatarUrl(row.author_photo);
  post.authorVerified = !!row.author_verified;
  return json({ post });
}

// Auth-suz username→profil oxuması — SSR meta + OG şəkil üçün. Şifrə/sessiya sahələri yox.
export async function publicGetUser(c: Ctx, username: string) {
  const uname = normalizeUsername(username);
  const row = await D(c).prepare(
    'SELECT id, username, name, bio, photo_url, verified, xp, streak, tasks_completed, joined_at, prog_levels, lang_levels FROM users WHERE username = ? AND blocked = 0',
  ).bind(uname).first<any>();
  if (!row) return err('İstifadəçi tapılmadı.', 404);
  return json({
    user: {
      uid: row.id, username: row.username, name: row.name, bio: row.bio,
      photoURL: avatarUrl(row.photo_url), verified: !!row.verified,
      xp: row.xp, streak: row.streak, tasksCompleted: row.tasks_completed, joinedAt: row.joined_at,
      prog: Object.keys(fromJSON(row.prog_levels, {})), langs: Object.keys(fromJSON(row.lang_levels, {})),
    },
  });
}
export async function newsletterSubscribe(c: Ctx) {
  const b = await readJson(c.req);
  const email = clampStr(b.email, 120).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badReq('Email formatı düzgün deyil.');
  const lang = ['az', 'en', 'ru'].includes(b.lang) ? b.lang : 'az';
  const r = await D(c).prepare('INSERT OR IGNORE INTO newsletter (email, lang, created_at) VALUES (?,?,?)')
    .bind(email, lang, now()).run();
  if (!r.meta.changes) return badReq('Bu e-poçt artıq abunədir.');
  return json({ ok: true });
}
export async function contactSubmit(c: Ctx) {
  const b = await readJson(c.req);
  const name = clampStr(b.name, 80).trim();
  const email = clampStr(b.email, 120).trim();
  const message = clampStr(b.message, 2000).trim();
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badReq('Sahələri düzgün doldurun.');
  // AUDIT-TASK-10 / Faza 4 — Task 8 §9/5: `uid` saxlanılır.
  //
  // Əvvəl yalnız `email` yazılırdı. İstifadəçi e-poçtunu dəyişsə köhnə
  // müraciətləri GDPR ixracında İTİRİRDİ (ixrac onları məhz e-poçt üzrə
  // tapır). ⚠ Qonaq da forma doldura bilər → `uid` NULL ola bilər.
  await D(c).prepare(
    'INSERT INTO contact_messages (id, uid, name, email, message, created_at) VALUES (?,?,?,?,?,?)',
  ).bind(uuid(), c.user?.id ?? null, name, email, message, now()).run();
  return json({ ok: true });
}


/* ================= PUBLIC KONFİQ ================= */
// Frontend-in build zamanı BİLƏ BİLMƏDİYİ public dəyərlər.
// Turnstile site key public-dir (secret deyil) — amma `wrangler.jsonc` var-ından
// gəldiyi üçün statik JS bundle-a hardcode edilə bilməz. Boş qayıdırsa
// frontend widget-i ümumiyyətlə render etmir (graceful degradation).
export async function publicConfig(c: Ctx) {
  return json({
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || '',
    // Magic link yalnız email göndərilə bildikdə UI-da görünür (Bənd 4).
    magicLink: emailEnabled(c.env),
    // Yalnız TAM konfiqurasiya olunmuş provayderlər — frontend işləməyən
    // düymə göstərməsin.
    oauthProviders: configuredProviders(c.env),
  });
}

/**
 * Sağlamlıq yoxlaması — AUDIT-TASK-5 §10/2 → AUDIT-TASK-6 §A-3.
 *
 * NİYƏ VAR: `0021_restore_bootstrap_rooms.sql` itmiş `general` otağını bərpa
 * etdi, lakin heç nə TƏKRARIN qarşısını almır. `e2e/seed-hygiene.spec.ts`
 * bunu yalnız LOKAL mühitdə tutur — istehsalda tutmur. Otaq silinsə
 * `room_messages.room_id` FK-sı pozulur və qlobal çat sükutla çökür.
 *
 * ⚠ MƏLUMAT SIZDIRMIR: sətir sayı, istifadəçi adı, versiya, xəta mətni
 * qaytarılmır — yalnız 'ok' / 'fail' / 'missing'. Endpoint autentifikasiyasız
 * olduğu üçün bu, məcburi şərtdir.
 */
export async function health(c: Ctx) {
  let db: 'ok' | 'fail' = 'ok';
  let bootstrapGeneralRoom: 'ok' | 'missing' = 'missing';
  let migrationsApplied = 0;

  try {
    const row = await D(c).prepare(
      `SELECT (SELECT COUNT(*) FROM rooms WHERE id = 'general') AS room,
              (SELECT COUNT(*) FROM d1_migrations)              AS migs`,
    ).first<any>();
    bootstrapGeneralRoom = Number(row?.room || 0) > 0 ? 'ok' : 'missing';
    migrationsApplied = Number(row?.migs || 0);
  } catch {
    // Səbəb QAYTARILMIR — xəta mətni sxem detalı sızdıra bilər.
    db = 'fail';
  }

  // AUDIT-TASK-9 §5.4 — XP invariantı yoxlanıla bilən sağlamlıq göstəricisidir.
  // 'drift' o deməkdir ki, nəyisə `xp_logs`-dan KƏNARDA `users.xp`-ni dəyişir
  // (əl ilə SQL, sadalanmamış route, yarımçıq batch). Bu, H-5-in yenidən
  // açılmasının ilk əlamətidir və sükutla baş verir — ona görə ölçülür.
  let xpInv: 'ok' | 'drift' | 'unknown' = 'unknown';
  try {
    const inv = await xpInvariant(c.env);
    xpInv = inv.ok ? 'ok' : 'drift';
    // 🔴 AUDIT-TASK-10 / Faza 2.3 — Task 9 §5.4 öhdəliyi: invariant yalnız
    // GÖSTƏRİLİRDİ, heç bir siqnala bağlı deyildi. Drift H-5-in yenidən
    // açılmasının ilk əlamətidir və sükutla baş verir.
    if (!inv.ok) alert('xp_invariant_drift', { users: inv.users, logs: inv.logs });
  } catch { /* sxem hələ migrate olunmayıb — 'unknown' qalır */ }

  const checks = {
    db, bootstrap_general_room: bootstrapGeneralRoom,
    migrations_applied: migrationsApplied, xp_invariant: xpInv,
  };
  // ⚠ `drift` `ok`-u AŞAĞI SALMIR: bu, məlumat bütövlüyü siqnalıdır, xidmət
  //   nasazlığı deyil — 503 vermək sağlam saytı monitorinqdə "ölü" göstərərdi.
  const ok = db === 'ok' && bootstrapGeneralRoom === 'ok';
  // 503: monitorinq alətləri status kodundan da oxuya bilsin.
  return json({ ok, checks }, ok ? 200 : 503);
}

