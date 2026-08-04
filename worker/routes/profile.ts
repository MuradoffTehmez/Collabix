// Profil domeni — xülasə, nişanlar, taymlayn, sancaq, baxış sayğacı.
//
// ⚠ NİYƏ `directory.ts`-DƏN AYRIDIR: kataloq ÇOX istifadəçinin AZ sahəsini
//   oxuyur (siyahı, keyset, filtr); profil isə BİR istifadəçinin ÇOX sahəsini
//   (nişan, XP tarixçəsi, layihə, taymlayn). İkisi eyni faylda olsaydı,
//   kataloqun "yüngül sorğu" müqaviləsi profilin ağır sorğuları ilə qarışardı.
//   `publicProfile` (başlıq datası) QƏSDƏN kataloqda qalır — kart və profil
//   eyni `mapUser` + `enrichSocial` yolundan qidalanmalıdır.
//
// 🔴 YÜKLƏMƏ MODELİ — ÜÇ MƏRHƏLƏ, BİR NƏHƏNG CAVAB YOX:
//    1. `/profile`  → başlıq (ad, avatar, XP, saylar)     — dərhal çəkilir
//    2. `/overview` → statistika, nişan, layihə, sancaq   — başlıqdan sonra
//    3. `/timeline` → səhifələnən hadisə axını            — görünəndə
//    Hamısı tək cavabda gəlsəydi, başlıq ən yavaş sorğunu gözləyərdi.
import { Ctx, json, err, clampStr, now } from '../util';
import { D } from './shared';

/** Profildə göstərilən maksimum sancaq / layihə. */
const PIN_MAX = 3;
const PROJECT_MAX = 6;

/* ═══════════════════════ ÖRTÜK NAXIŞLARI ═══════════════════════
 *
 * Açar → CSS sinfi (`css/91-profile.css` → `.pf-cover--<açar>`).
 *
 * ⚠ SERVER AĞ SİYAHISI MƏCBURİDİR: sütun sərbəst mətndir (miqrasiya 0052-də
 *   `CHECK` qoyula bilmirdi — SQLite `ALTER TABLE` ilə CHECK əlavə etmir).
 *   Ağ siyahı olmasaydı istifadəçi ora istənilən sətir yaza bilərdi və o,
 *   sinif adı kimi DOM-a düşərdi.
 */
export const PROFILE_COVERS = new Set([
  '', 'aurora', 'mesh', 'grid', 'dusk', 'forest', 'ember', 'ocean', 'mono',
]);

/* ═══════════════════════ BACARIQ META-SI ═══════════════════════ */

/** Bir bacarığa yazıla bilən maksimum təcrübə ili — real hədd, UI-da slider. */
const SKILL_YEARS_MAX = 30;
/** Meta saxlanılan maksimum bacarıq sayı — `progLevels` onsuz da bu qədərdir. */
const SKILL_META_MAX = 60;

/**
 * `{"Python":{"y":3,"c":1}}` formasını təmizləyir.
 *
 * 🔴 NİYƏ SERVERDƏ: `patchMe` JSON-u OLDUĞU KİMİ sütuna yazır. Təmizləmə
 *    olmasaydı istifadəçi ora istənilən dərinlikdə obyekt qoyub sətri
 *    şişirdə bilərdi (D1 sətir həddi) və oxu yolu `y`-nin rəqəm olduğuna
 *    arxalandığı üçün UI-da `NaN il` görünərdi.
 *
 * ⚠ Naməlum açarlar SÜKUTLA ATILIR, xəta qaytarılmır: bu sahə köməkçidir,
 *   profil yaddaşa yazılması ona görə uğursuz olmamalıdır.
 */
export function sanitizeSkillMeta(raw: unknown): Record<string, { y: number; c: 0 | 1 }> {
  const out: Record<string, { y: number; c: 0 | 1 }> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= SKILL_META_MAX) break;
    const key = clampStr(k, 40).trim();
    if (!key || !v || typeof v !== 'object') continue;
    const src = v as Record<string, unknown>;
    const years = Math.max(0, Math.min(SKILL_YEARS_MAX, Math.floor(Number(src.y) || 0)));
    const cert: 0 | 1 = src.c ? 1 : 0;
    // Hər ikisi boşdursa sətir saxlamaq mənasızdır — JSON-u kiçik saxlayır.
    if (!years && !cert) continue;
    out[key] = { y: years, c: cert };
    n++;
  }
  return out;
}

/* ═══════════════════════ KÖMƏKÇİLƏR ═══════════════════════ */

/** `username` → istifadəçi sətri (bloklanmış hesab tapılmır). */
async function userByName(c: Ctx, username: string) {
  return D(c).prepare('SELECT * FROM users WHERE username = ? AND blocked = 0')
    .bind(String(username || '').toLowerCase()).first<any>();
}

const DAY = 86_400_000;
/** UTC gün açarı — `user_activity` ilə eyni format. */
const dayKey = (ts: number = now()) => new Date(ts).toISOString().slice(0, 10);

const num = (v: unknown) => Number(v) || 0;

/* ═══════════════════════ XÜLASƏ ═══════════════════════ */

/**
 * Profilin ikinci mərhələsi: statistika, nişanlar, layihələr, sancaqlar.
 *
 * 🔴 BEŞ SORĞU, `batch()` İLƏ BİR GEDİŞDƏ. Sadəlövh variant hər blok üçün
 *    ayrıca çağırış olardı (11 nişan × qayda yoxlaması, hər layihə üçün
 *    komanda adı…) — kataloqdakı N+1 ilə eyni sinif qüsur.
 *
 * ⚠ INSIGHTS YALNIZ SAHİBİNƏ: profil baxışları, izləyici artımı və töhfə
 *   bölgüsü kənar şəxsə göndərilmir. Bu, gizlilik qərarıdır — "kim baxdı"
 *   saxlanılmır, "neçə nəfər baxdı" isə yalnız sahibinə aiddir.
 */
export async function profileOverview(c: Ctx, username: string) {
  const row = await userByName(c, username);
  if (!row) return err('İstifadəçi tapılmadı.', 404, 'user_not_found');
  const uid = String(row.id);
  const isSelf = uid === c.user!.id;

  const weekAgo = now() - 7 * DAY;
  const monthAgo = now() - 30 * DAY;

  const [statsRes, xpRes, badgeRes, achRes, pinRes, projRes] = await D(c).batch<any>([
    // 1. Töhfə göstəriciləri.
    //    ⚠ `user_stats` trigger ilə saxlanılır (miqrasiya 0012) — post/şərh/
    //      bəyənmə sayları oradan gəlir. İzləyici sayları isə `users`
    //      sütunlarındandır (0051): iki mənbə arasında sürüşmə olsa,
    //      HƏQİQƏT MƏNBƏYİ yazı yolunun saxladığı sütundur.
    D(c).prepare(
      `SELECT COALESCE(s.posts, 0)          AS posts,
              COALESCE(s.comments, 0)       AS comments,
              COALESCE(s.likes_received, 0) AS likesReceived,
              COALESCE(s.likes_given, 0)    AS likesGiven,
              u.xp, u.streak, u.reputation, u.tasks_completed AS tasks,
              u.followers_count AS followers, u.following_count AS following
         FROM users u LEFT JOIN user_stats s ON s.uid = u.id
        WHERE u.id = ?1`,
    ).bind(uid),
    // 2. XP pəncərələri — TƏK sorğuda şərti toplama (iki `SUM` üçün iki
    //    gediş etməyə dəyməz).
    D(c).prepare(
      `SELECT COALESCE(SUM(CASE WHEN created_at >= ?2 THEN amount END), 0) AS week,
              COALESCE(SUM(CASE WHEN created_at >= ?3 THEN amount END), 0) AS month
         FROM xp_logs WHERE uid = ?1 AND amount > 0`,
    ).bind(uid, weekAgo, monthAgo),
    // 3. Nişanlar — QAZANILAN + QAZANILMAYAN bir sorğuda.
    //    ⚠ `LEFT JOIN`: kilidli nişanlar da qayıdır, çünki UI onları solğun
    //      göstərib "nə qalıb" irəliləyişini çəkir. İki ayrı sorğu (qazanılan
    //      / kataloq) eyni datanı iki dəfə gətirərdi.
    D(c).prepare(
      `SELECT b.code, b.label_az, b.icon, b.rule_kind, b.rule_value, l.created_at AS earnedAt
         FROM badges b LEFT JOIN badge_logs l ON l.badge_code = b.code AND l.uid = ?1
        ORDER BY (l.created_at IS NULL), l.created_at DESC, b.rule_value ASC`,
    ).bind(uid),
    D(c).prepare(
      `SELECT a.code, a.label_az, a.rule_kind, a.rule_value, a.unlocks, l.created_at AS earnedAt
         FROM achievements a LEFT JOIN achievement_logs l ON l.achievement_code = a.code AND l.uid = ?1
        ORDER BY (l.created_at IS NULL), l.created_at DESC, a.rule_value ASC`,
    ).bind(uid),
    // 4. Sancılmış postlar — YIĞCAM forma (tam post obyekti deyil).
    //    ⚠ Görünürlük: kənar şəxsə yalnız `public` sancaq göstərilir.
    //      Sahibi öz `private`/`followers` postunu da sancaqlaya bilər.
    D(c).prepare(
      `SELECT id, text, blocks, image_keys, tags, like_count, comment_count,
              created_at, visibility, profile_pinned_at
         FROM posts
        WHERE author_id = ?1 AND profile_pinned_at IS NOT NULL
          AND hidden_at IS NULL
          AND (?2 = 1 OR visibility = 'public')
        ORDER BY profile_pinned_at DESC LIMIT ${PIN_MAX}`,
    ).bind(uid, isSelf ? 1 : 0),
    // 5. Layihə vitrini.
    //    ⚠ Yalnız `Public` layihələr kənar şəxsə — komanda daxili layihənin
    //      ADI BELƏ sızmamalıdır (TASK-11 komanda görünürlük qaydası).
    D(c).prepare(
      `SELECT p.id, p.name, p.description, p.status, p.visibility, p.created_at,
              p.updated_at, p.created_by, t.name AS teamName, t.slug AS teamSlug,
              (SELECT COUNT(*) FROM team_project_members m2 WHERE m2.project_id = p.id) AS members
         FROM team_project_members m
         JOIN team_projects p ON p.id = m.project_id
         JOIN teams t ON t.id = p.team_id
        WHERE m.user_id = ?1 AND t.status = 'active'
          AND (?2 = 1 OR p.visibility = 'Public')
        ORDER BY COALESCE(p.updated_at, p.created_at) DESC LIMIT ${PROJECT_MAX}`,
    ).bind(uid, isSelf ? 1 : 0),
  ]);

  const s = statsRes.results[0] || {};
  const xpWin = xpRes.results[0] || {};

  /* ── Qayda irəliləyişi ───────────────────────────────────────────────
   * `progression.ts` ilə EYNİ metrik adları (`rule_kind`). Onlar ayrılsa,
   * UI-da "9/10" yazılan nişan serverdə hələ qazanılmamış sayılardı. */
  const metrics: Record<string, number> = {
    xp: num(s.xp), streak: num(s.streak), reputation: num(s.reputation),
    tasks: num(s.tasks), posts: num(s.posts), comments: num(s.comments),
  };
  const mapRule = (r: any) => ({
    code: String(r.code), label: String(r.label_az), icon: r.icon || '',
    ruleKind: String(r.rule_kind), ruleValue: num(r.rule_value),
    have: metrics[String(r.rule_kind)] ?? 0,
    earnedAt: r.earnedAt ? num(r.earnedAt) : null,
    unlocks: r.unlocks || '',
  });

  const out: Record<string, unknown> = {
    stats: {
      posts: num(s.posts), comments: num(s.comments),
      likesReceived: num(s.likesReceived), likesGiven: num(s.likesGiven),
      followers: num(s.followers), following: num(s.following),
      xp: num(s.xp), streak: num(s.streak), reputation: num(s.reputation),
      tasks: num(s.tasks),
      xpWeek: num(xpWin.week), xpMonth: num(xpWin.month),
      contribution: contributionScore(metrics, num(s.likesReceived)),
    },
    badges: badgeRes.results.map(mapRule),
    achievements: achRes.results.map(mapRule),
    pinned: pinRes.results.map((p: any) => ({
      id: p.id, text: String(p.text || '').slice(0, 280),
      imageCount: safeLen(p.image_keys), tags: safeArr(p.tags),
      likeCount: num(p.like_count), commentCount: num(p.comment_count),
      createdAt: num(p.created_at), visibility: p.visibility || 'public',
      pinnedAt: num(p.profile_pinned_at),
    })),
    projects: projRes.results.map((p: any) => ({
      id: p.id, name: p.name, description: String(p.description || '').slice(0, 200),
      status: p.status || 'active', visibility: p.visibility || 'Private',
      teamName: p.teamName, teamSlug: p.teamSlug, members: num(p.members),
      isOwner: p.created_by === uid,
      updatedAt: num(p.updated_at) || num(p.created_at),
      createdAt: num(p.created_at),
    })),
    isSelf,
  };

  if (isSelf) out.insights = await ownerInsights(c, uid);

  /* 🔴 SAHİB ÖZ PROFİLİNƏ BAXANDA NİŞANLAR YENİDƏN QİYMƏTLƏNDİRİLİR.
   *
   * PROBLEM: `evaluateProgression` YALNIZ XP/task hadisələrindən sonra
   * çağırılır. Yəni qaydası ÇOXDAN ödənmiş nişan (məsələn 300 XP-si olan
   * hesabda "20 XP" nailiyyəti) növbəti XP hadisəsinə qədər KİLİDLİ qalırdı
   * və profil "300 / 20 — qazanılmayıb" kimi mənasız cüt göstərirdi.
   *
   * ⚠ `waitUntil` — cavabı GÖZLƏTMİR. Nişan bu açılışda deyil, növbəti
   *   açılışda görünür; alternativ (sinxron gözləmə) hər profil açılışına
   *   iki sorğu əlavə edərdi.
   * ⚠ YALNIZ SAHİBİNƏ: kənar şəxsin baxışı başqasının hesabına yazı
   *   əməliyyatı tetikləməməlidir.
   * ⚠ İDEMPOTENT: `ux_badge_logs` / `ux_achievement_logs` unikal indeksləri
   *   təkrar verilməni bağlayır (bax `progression.ts`).
   */
  if (isSelf) {
    const { evaluateProgression } = await import('../progression');
    c.ctx.waitUntil(evaluateProgression(c.env, uid).then(() => {}));
  }
  return json(out);
}

const safeArr = (v: unknown): string[] => {
  try { const a = JSON.parse(String(v || '[]')); return Array.isArray(a) ? a.slice(0, 6) : []; }
  catch { return []; }
};
const safeLen = (v: unknown): number => safeArr(v).length;

/**
 * Töhfə balı — profil "reputasiya" göstəricisinin tək düsturu.
 *
 * ⚠ TƏK MƏNBƏ: client-də təkrarlansaydı iki tərəf müxtəlif rəqəm göstərərdi
 *   (`level-thresholds-three-copies` dərsi). Client YALNIZ hazır balı oxuyur.
 *
 * Çəkilər PRD §8 reputasiya mənbələri ilə uyğundur: tapşırıq > paylaşım >
 * şərh > alınan bəyənmə.
 */
function contributionScore(m: Record<string, number>, likesReceived: number): number {
  return Math.round(
    m.posts * 3 + m.comments * 1 + m.tasks * 5
    + likesReceived * 0.5 + Math.max(0, m.reputation) * 0.5,
  );
}

/**
 * Sahibə xas göstəricilər: baxış, izləyici artımı, aktivlik.
 *
 * ⚠ Baxış sətirləri KİMLİK DAŞIMIR (miqrasiya 0052) — burada da yalnız
 *   toplama var, siyahı yoxdur.
 */
async function ownerInsights(c: Ctx, uid: string) {
  const d7 = dayKey(now() - 7 * DAY);
  const d30 = dayKey(now() - 30 * DAY);
  const [views, follows] = await D(c).batch<any>([
    D(c).prepare(
      `SELECT COALESCE(SUM(count), 0)                                  AS total,
              COALESCE(SUM(CASE WHEN date >= ?2 THEN count END), 0)    AS week,
              COALESCE(SUM(CASE WHEN date >= ?3 THEN count END), 0)    AS month
         FROM profile_views WHERE uid = ?1`,
    ).bind(uid, d7, d30),
    D(c).prepare(
      `SELECT COALESCE(SUM(CASE WHEN created_at >= ?2 THEN 1 END), 0) AS week,
              COALESCE(SUM(CASE WHEN created_at >= ?3 THEN 1 END), 0) AS month
         FROM follows WHERE target_id = ?1`,
    ).bind(uid, now() - 7 * DAY, now() - 30 * DAY),
  ]);
  const v = views.results[0] || {};
  const f = follows.results[0] || {};
  return {
    views: num(v.total), viewsWeek: num(v.week), viewsMonth: num(v.month),
    followersWeek: num(f.week), followersMonth: num(f.month),
  };
}

/* ═══════════════════════ BAXIŞ SAYĞACI ═══════════════════════ */

/**
 * Profil baxışını qeyd edir — GÜN ÜZRƏ TOPLU.
 *
 * ⚠ NİYƏ AYRICA ENDPOINT, `publicProfile` İÇİNDƏ YOX: həmin endpoint
 *   səhifə yeniləndikcə, bildirişdən qayıdanda, hətta DM açılanda çağırılır.
 *   Hər çağırışda sayğacı artırsaq rəqəm "neçə dəfə səhifə yükləndi"
 *   göstərərdi. Client bunu sessiya başına BİR DƏFƏ göndərir
 *   (`sessionStorage` mühafizəsi).
 *
 * ⚠ MÜHAFİZƏNİN HƏDDİ AÇIQ ELAN OLUNUR: client tərəfli mühafizə keçilə bilər,
 *   yəni bu, TƏHLÜKƏSİZLİK sərhədi deyil, dəqiqlik tədbiridir. Baxış sayı
 *   nüfuz göstəricisidir, icazə qərarına təsir ETMİR — ona görə bu qəbul
 *   ediləndir. Server yalnız ÖZ-ÖZÜNƏ baxışı bağlayır.
 */
export async function recordProfileView(c: Ctx, username: string) {
  const row = await userByName(c, username);
  if (!row) return err('İstifadəçi tapılmadı.', 404, 'user_not_found');
  // Öz profilinə baxış sayılmır — əks halda rəqəm sahibinin öz açılışlarından
  // ibarət olardı və heç nə ifadə etməzdi.
  if (String(row.id) === c.user!.id) return json({ ok: true, counted: false });

  await D(c).prepare(
    `INSERT INTO profile_views (uid, date, count) VALUES (?1, ?2, 1)
       ON CONFLICT(uid, date) DO UPDATE SET count = count + 1`,
  ).bind(row.id, dayKey()).run();
  return json({ ok: true, counted: true });
}

/* ═══════════════════════ SANCAQ ═══════════════════════ */

/**
 * Postu profildə sancaqlayır / sancağı götürür.
 *
 * 🔴 QLOBAL SANCAQDAN (`posts.pinned_at`) TAM AYRIDIR — bax miqrasiya 0052.
 *    Burada admin yoxlaması YOXDUR, MÜƏLLİF yoxlaması var.
 *
 * ⚠ HƏDD SERVERDƏ: UI 3 sancaq göstərir, lakin hədd olmasaydı istifadəçi
 *   API ilə 500 post sancaqlayıb `overview` sorğusunu ağırlaşdıra bilərdi.
 */
export async function toggleProfilePin(c: Ctx, postId: string) {
  const post = await D(c).prepare('SELECT id, author_id, profile_pinned_at FROM posts WHERE id = ?')
    .bind(postId).first<any>();
  if (!post) return err('Paylaşım tapılmadı.', 404, 'post_not_found');
  if (String(post.author_id) !== c.user!.id) return err('Yalnız müəllif sancaqlaya bilər.', 403, 'not_author');

  if (post.profile_pinned_at) {
    await D(c).prepare('UPDATE posts SET profile_pinned_at = NULL WHERE id = ?').bind(postId).run();
    return json({ pinned: false });
  }

  const cnt = await D(c).prepare(
    'SELECT COUNT(*) AS n FROM posts WHERE author_id = ? AND profile_pinned_at IS NOT NULL',
  ).bind(c.user!.id).first<any>();
  if (num(cnt?.n) >= PIN_MAX) {
    return err(`Ən çox ${PIN_MAX} paylaşım sancaqlana bilər.`, 400, 'pin_limit');
  }
  await D(c).prepare('UPDATE posts SET profile_pinned_at = ? WHERE id = ?').bind(now(), postId).run();
  return json({ pinned: true });
}

/* ═══════════════════════ TAYMLAYN ═══════════════════════ */

/** Bir səhifədəki hadisə sayı. */
const TIMELINE_PAGE = 20;

/**
 * Peşəkar fəaliyyət xətti — ALTI MƏNBƏNİN BİRLƏŞMƏSİ.
 *
 * 🔴 NİYƏ TÖRƏMƏ, NİYƏ AYRICA "EVENTS" CƏDVƏLİ: hadisələrin hamısı ONSUZ DA
 *    bazadadır (nişan jurnalı, post, komanda üzvlüyü, qeydiyyat tarixi).
 *    Ayrıca cədvəl yazsaydıq, o, YALNIZ bu gündən sonrakı hadisələri
 *    daşıyardı — mövcud istifadəçilərin taymlaynı BOŞ açılardı. Törəmə
 *    yanaşma bütün tarixçəni geriyə dönük verir.
 *
 * ⚠ `activities` cədvəli də mənbədir: o, miqrasiya 0032-də yaradılmışdı,
 *   lakin HEÇ NƏ ora yazmırdı. Səviyyə artımı indi ora yazılır
 *   (`worker/xp.ts` → `logLevelUp`) — yəni ölü cədvəl nəhayət mənbəyə çevrilir.
 *
 * 🔴 ALTI SORĞU, `UNION ALL` DEYİL — D1 MƏHDUDİYYƏTİ:
 *    D1 `SQLITE_MAX_COMPOUND_SELECT`-i **5 termə** endirib. Altı termli
 *    `UNION ALL` runtime-da `too many terms in compound SELECT: SQLITE_ERROR`
 *    verir — planlaşdırma vaxtı YOX, İCRA vaxtı, yəni tipli yoxlama və ya
 *    lint bunu tutmur. (Ölçüldü: 5 term işləyir, 6 çökür.)
 *
 *    Ona görə mənbələr AYRI sorğulardır və TƏK `batch()`-də gedir (bir
 *    gediş-gəliş), birləşmə isə JS-də olur. Əlavə fayda: yeni mənbə əlavə
 *    etmək artıq həddə dəymir.
 *
 * ⚠ BİRLƏŞMƏ DÜZGÜNLÜYÜ: hər mənbə `ORDER BY ts DESC LIMIT n+1` ilə gəlir,
 *   yəni hər birinin ƏN YENİ n+1 sətri əlimizdədir. Qlobal sıralamada ilk n
 *   element yalnız bu çoxluqdan gələ bilər — atlanan sətir həmişə daha
 *   köhnədir. (Sadəlövh `LIMIT n` səhv olardı: bir mənbədən n sətir çıxsa,
 *   "daha var?" sualı cavabsız qalardı.)
 */
export async function profileTimeline(c: Ctx, username: string) {
  const row = await userByName(c, username);
  if (!row) return err('İstifadəçi tapılmadı.', 404, 'user_not_found');
  const uid = String(row.id);
  const isSelf = uid === c.user!.id;

  const cursor = c.url.searchParams.get('cursor');
  let after: { ts: number; id: string } | null = null;
  if (cursor) {
    const i = cursor.lastIndexOf('_');
    const ts = Number(cursor.slice(0, i));
    if (i > 0 && Number.isFinite(ts)) after = { ts, id: cursor.slice(i + 1) };
  }

  // ⚠ Kursor HƏR mənbəyə ayrıca tətbiq olunur — `UNION` variantında xarici
  //   sorğuda bir dəfə yazmaq kifayət edirdi, burada isə unudulan mənbə
  //   səhifələnmədən kənarda qalar və təkrar-təkrar qayıdardı.
  const N = TIMELINE_PAGE + 1;

  /* 🔴 YER TUTUCU İNDEKSİ SORĞUYA GÖRƏ DƏYİŞİR, çünki D1 bind sayının
   *    sorğudakı yer tutucu sayı ilə DƏQİQ üst-üstə düşməsini tələb edir
   *    ("Wrong number of parameter bindings"). Sabit indeks (məsələn həmişə
   *    ?8/?9) + doldurucu `null`-lar İŞLƏMİR — ölçüldü.
   *
   *    Ona görə `cut(…, next)` kursor yer tutucularının BAŞLANĞIC indeksini
   *    parametr kimi alır: mənbənin öz parametrlərindən sonrakı ilk boş yer.
   */
  const cut = (tsCol: string, idCol: string, next: number) => after
    ? ` AND (${tsCol} < ?${next} OR (${tsCol} = ?${next} AND ${idCol} < ?${next + 1}))`
    : '';
  /** Sorğunun öz parametrləri + (varsa) kursor cütü. */
  const args = (...own: unknown[]) => (after ? [...own, after.ts, after.id] : own);

  const [joined, badges, achs, posts, teams, acts] = await D(c).batch<any>([
    D(c).prepare(
      `SELECT 'joined' AS kind, joined_at AS ts, id AS id, '' AS label, '' AS ref
         FROM users WHERE id = ?1${cut('joined_at', 'id', 2)}`,
    ).bind(...args(uid)),
    D(c).prepare(
      `SELECT 'badge' AS kind, l.created_at AS ts, l.id AS id, b.label_az AS label, b.code AS ref
         FROM badge_logs l JOIN badges b ON b.code = l.badge_code
        WHERE l.uid = ?1${cut('l.created_at', 'l.id', 2)}
        ORDER BY l.created_at DESC, l.id DESC LIMIT ${N}`,
    ).bind(...args(uid)),
    D(c).prepare(
      `SELECT 'achievement' AS kind, l.created_at AS ts, l.id AS id, a.label_az AS label, a.code AS ref
         FROM achievement_logs l JOIN achievements a ON a.code = l.achievement_code
        WHERE l.uid = ?1${cut('l.created_at', 'l.id', 2)}
        ORDER BY l.created_at DESC, l.id DESC LIMIT ${N}`,
    ).bind(...args(uid)),
    D(c).prepare(
      // ⚠ Görünürlük: kənar şəxs yalnız `public` postu görür. Filtri buradan
      //   çıxarmaq `private` paylaşımın MƏTNİNİ taymlaynda açardı.
      //   Bu sorğunun İKİ öz parametri var → kursor ?3/?4-dən başlayır.
      `SELECT 'post' AS kind, p.created_at AS ts, p.id AS id,
              substr(COALESCE(p.text, ''), 1, 120) AS label, p.id AS ref
         FROM posts p
        WHERE p.author_id = ?1 AND p.hidden_at IS NULL AND p.scheduled_at IS NULL
          AND (?2 = 1 OR p.visibility = 'public')${cut('p.created_at', 'p.id', 3)}
        ORDER BY p.created_at DESC, p.id DESC LIMIT ${N}`,
    ).bind(...args(uid, isSelf ? 1 : 0)),
    D(c).prepare(
      `SELECT 'team' AS kind, m.joined_at AS ts, t.id AS id, t.name AS label, t.slug AS ref
         FROM team_members m JOIN teams t ON t.id = m.team_id
        WHERE m.user_id = ?1 AND m.status = 'active' AND t.status = 'active'${cut('m.joined_at', 't.id', 2)}
        ORDER BY m.joined_at DESC, t.id DESC LIMIT ${N}`,
    ).bind(...args(uid)),
    D(c).prepare(
      `SELECT kind, created_at AS ts, id AS id, detail AS label, COALESCE(ref_id, '') AS ref
         FROM activities WHERE uid = ?1${cut('created_at', 'id', 2)}
        ORDER BY created_at DESC, id DESC LIMIT ${N}`,
    ).bind(...args(uid)),
  ]);

  const all = [joined, badges, achs, posts, teams, acts]
    .flatMap((r: any) => r.results as any[])
    .map((r: any) => ({
      kind: String(r.kind), ts: num(r.ts), id: String(r.id),
      label: String(r.label || ''), ref: String(r.ref || ''),
    }))
    // Sıra `(ts, id)` cütü üzrədir — eyni millisaniyədə iki hadisə olsa,
    // `id` sabit tie-break verir və kursor onları atlaya/təkrarlaya bilmir.
    .sort((a, b) => (b.ts - a.ts) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  const hasMore = all.length > TIMELINE_PAGE;
  const page = all.slice(0, TIMELINE_PAGE);
  const last = page[page.length - 1];
  return json({
    events: page,
    hasMore,
    nextCursor: !hasMore || !last ? null : `${last.ts}_${last.id}`,
  });
}

/* ⚠ SƏVİYYƏ HADİSƏSİ BURADA DEYİL — `worker/xp.ts` → `logLevelUp`.
 *   Səbəb DÖVR RİSKİDİR: `xp.ts` bu modulu import etsəydi
 *   `xp.ts → routes/profile.ts → routes/shared.ts → xp.ts` halqası yaranardı
 *   (`shared.ts` → `grantDailyLogin` → `grantXp`). Naxış `icon-set.js`
 *   ayrılması ilə eynidir: yazan tərəf öz modulunda qalır, oxuyan tərəf
 *   (taymlayn UNION-u) sadəcə cədvəli oxuyur. */
