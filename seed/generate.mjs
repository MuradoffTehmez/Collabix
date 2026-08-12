#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Əsas generator
// ═══════════════════════════════════════════════════════════════════════════
//
//   node seed/generate.mjs              → lokal D1, SEED_LEVEL=2 (600 istifadəçi)
//   SEED_LEVEL=1 node seed/generate.mjs → kiçik demo
//   node seed/generate.mjs --remote     → remote (istehsal) D1
//
// ARDICILLIQ: istifadəçi → sosial qraf → məzmun → komanda → öyrənmə → mesaj
//             → törəmə (bildiriş, XP, statistika) → aqreqat
//
// 🔴 TÖRƏMƏ DATA UYDURULMUR. Bildirişlər real bəyənmə/şərh/izləmə sətirlərindən,
//    XP real əməliyyatlardan, profil statistikası isə baza triggerlərindən
//    (`user_stats`) gəlir. Sənəd §19/§26/§31 bunu tələb edir: göstərici ilə
//    baza arasında fərq olmamalıdır.

import { openDb } from './db.mjs';
import {
  SCALE, LEVEL, SEED_LEVEL, DEMO_PASS, DEMO_PREFIX, TIMELINE_DAYS,
  XP, ENGAGEMENT, TASK_STATUS_MIX, TASK_PRIORITIES, REACTION_TYPES,
  LEARNING_CATEGORIES, REPORT_REASONS, POST_TYPES,
} from './config.mjs';
import {
  NOW, TIMELINE, dayStart, timeInDay, dateStr, id, rnd,
  pick, pickN, randInt, chance, shuffle, weighted, longTail, timeAfter,
} from './rand.mjs';
import { buildPeople } from './content/people.mjs';
import { makePost, makeQuote, pickTopic } from './content/posts.mjs';
import {
  makeComment, makeReply, makeMention, makeRoomMessage,
  makeTaskComment, makeSubmission,
} from './content/comments.mjs';
import {
  buildTeams, buildProjects, taskTitle, taskDescription,
  sprintName, checklistItems, buildLabels, makeFile, makeTeamPost, TEAM_EVENTS,
} from './content/workspace.mjs';
import { makeDrill, drillVariant } from './content/learning.mjs';
import {
  scenarioKeyFor, makeConversation, conversationLength,
} from './content/conversations.mjs';
import { hashPassword } from './hash.mjs';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTION GUARD (sənəd §38)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ İKİ AYRI QAPI: `COLLABIX_ENV=production` seed-i tamamilə bağlayır;
//   `--remote` isə ayrıca, AÇIQ təsdiq tələb edir. Yalnız birincisi olsaydı
//   dəyişən qoyulmayan maşında `--remote` səhvən qaça bilərdi.
const REMOTE = process.argv.includes('--remote');

if (process.env.COLLABIX_ENV === 'production') {
  console.error('❌ Demo seed production mühitində işlədilə bilməz (COLLABIX_ENV=production).');
  process.exit(1);
}
if (REMOTE && process.env.SEED_CONFIRM_REMOTE !== 'yes') {
  console.error('❌ `--remote` canlı D1-ə yazır.');
  console.error('   Davam etmək üçün: SEED_CONFIRM_REMOTE=yes node seed/generate.mjs --remote');
  process.exit(1);
}

const T0 = performance.now();
const db = openDb({ remote: REMOTE });

const step = n => console.log(`\n📦 ${n}`);
const done = (label, n) => console.log(`   ✅ ${label}: ${n.toLocaleString('az-AZ')}`);

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  COLLABIX — 15 günlük sintetik demo mühiti                ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log(`   Səviyyə : ${LEVEL.label} (SEED_LEVEL=${SEED_LEVEL})`);
console.log(`   Hədəf   : ${REMOTE ? '☁️  REMOTE D1' : '💻 lokal D1'}`);
console.log(`   Pəncərə : ${TIMELINE[0].date} … ${TIMELINE[TIMELINE.length - 1].date}`);

// Azərbaycan hərflərini axtarış üçün qatlayır — worker/util.ts SEARCH_FOLD güzgüsü.
const FOLD = { 'ə': 'e', 'ı': 'i', 'ö': 'o', 'ü': 'u', 'ç': 'c', 'ş': 's', 'ğ': 'g', 'İ': 'i', 'Ə': 'e', 'I': 'i' };
const searchNormalize = v => {
  let out = '';
  for (const ch of String(v ?? '').trim().toLowerCase()) out += FOLD[ch] ?? ch;
  return out.normalize('NFD').replace(/[̀-ͯ]/g, '');
};

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 1 — İSTİFADƏÇİLƏR
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 1 — İstifadəçilər');

const people = buildPeople();

/**
 * Qoşulma tarixi.
 *
 * ⚠ HAMISI 15 GÜN ƏVVƏL QOŞULA BİLMƏZ: analitika "yeni istifadəçi" və
 *   "qayıdan istifadəçi" göstəricilərini məhz `joined_at`-dan hesablayır
 *   (sənəd §4). Hamısı eyni gün qoşulsa qrafik düz xətt olar. Ona görə:
 *     70% — pəncərədən ƏVVƏL (platforma artıq mövcud idi)
 *     30% — pəncərə DAXİLİNDƏ (yeni istifadəçi axını)
 */
function joinTime() {
  const t = chance(0.7)
    ? timeInDay(dayStart(randInt(TIMELINE_DAYS, TIMELINE_DAYS + 150)))
    : timeInDay(dayStart(randInt(0, TIMELINE_DAYS - 1)));
  /* ⚠ SIXMA MƏCBURİDİR: `timeInDay()` gün DAXİLİNDƏ təsadüfi saat seçir, yəni
     "bu gün" üçün nəticə hazırkı andan SONRA ola bilər. Sıxmasaq gələcək
     tarixli qoşulma yaranır və bütün temporal yoxlamalar (post > joined_at)
     həmin hesab üçün mənasız olur. */
  return Math.min(t, NOW - randInt(60_000, 3_600_000));
}

console.log(`   🔐 ${people.length} parol hash-lanır (PBKDF2, 100k iterasiya)...`);
const hashT0 = performance.now();

people.forEach((p, i) => {
  p.id = id();
  p.joinedAt = joinTime();
  // Qoşulma günündən sonrakı zaman xətti günləri — məzmun yalnız burada yaranır.
  p.joinDayIndex = TIMELINE.findIndex(d => d.start + 86_400_000 > p.joinedAt);
  if (p.joinDayIndex < 0) p.joinDayIndex = TIMELINE.length;   // pəncərənin sonunda qoşulub

  /* Sənəd §40: "bütün demo istifadəçilər üçün eyni sadə parol istifadə etmə".
     Hər hesab ÖZ parolunu alır; demo hesabların parolu sonda ayrıca sənədə
     yazılır. Parol determinist qurulur ki, sənəd və baza həmişə uyğun olsun. */
  p.password = `${DEMO_PASS}${p.username.replace(/[^a-z0-9]/gi, '').slice(0, 6)}`;
  const h = hashPassword(p.password);
  p.passHash = h.hash;
  p.passSalt = h.salt;
  p.passIter = h.iterations;

  if ((i + 1) % 50 === 0) {
    process.stdout.write(`\r   🔐 ${i + 1}/${people.length}`);
  }
});
process.stdout.write(`\r   🔐 ${people.length}/${people.length} (${((performance.now() - hashT0) / 1000).toFixed(1)}s)\n`);

// Rol təyinatı: 1 sayt admini + 2 moderator. Qalanı 'USER'.
//
// ⚠ `users.role` sütununun DEFAULT-u hələ də kiçik hərfli 'user'-dir; açıq
//   'USER' yazılmasa hesab SIFIR icazə alır (miqrasiya 0038 izahı).
const sorted = [...people].sort((a, b) => b.behaviour.weight - a.behaviour.weight);
const adminUser = sorted[0];
const moderators = [sorted[1], sorted[2]];
adminUser.role = 'ADMIN';
moderators.forEach(m => { m.role = 'MODERATOR'; });
for (const p of people) p.role = p.role || 'USER';

for (const p of people) {
  const username = DEMO_PREFIX + p.username;
  p.dbUsername = username;
  db.insert('users', {
    id: p.id,
    username,
    name: p.name,
    age: p.age,
    birth_date: `${new Date().getUTCFullYear() - p.age}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`,
    gender: p.gender,
    country: p.country,
    city: p.city,
    bio: p.bio,
    // Sənəd §39: yalnız RFC 2606 ilə qorunan test domeni.
    contact_email: `${p.username}@example.com`,
    email: `${p.username}@example.com`,
    email_verified: chance(0.8) ? 1 : 0,
    /* Sənəd §7: avatar real şəkil OLMAMALIDIR — və burada NULL-dır.
     *
     * 🔴 XARİCİ AVATAR XİDMƏTİ (DiceBear və s.) İŞLƏMİR, iki müstəqil səbəbə
     *    görə: (1) CSP `img-src 'self' data: blob:` xarici şəkli bloklayır;
     *    (2) `js/util.js → isSafeImageURL` yalnız `/files/posts/` və
     *    `/files/avatars/` prefikslərini qəbul edir. Yəni belə URL ekranda
     *    HEÇ VAXT görünməzdi, amma bazada "avatarı var" kimi qalardı və OG
     *    kartı onu çəkməyə çalışardı — iki fərqli həqiqət.
     *
     *    NULL olduqda tətbiq öz determinist hərf avatarını çəkir
     *    (`avatarNode` → `avatar-initials`, WCAG AA üçün seçilmiş çalarlar) —
     *    sənədin "generated/placeholder avatar" tələbi məhz budur. Real şəkil
     *    istəyirsə, fayllar R2-yə `avatars/…` açarı ilə yüklənməli və
     *    `photo_url` `/files/avatars/…` olmalıdır. */
    photo_url: null,
    cover: '',
    prog_levels: JSON.stringify(p.progLevels),
    lang_levels: JSON.stringify(p.langLevels),
    skill_meta: JSON.stringify(p.skillMeta),
    goals: p.goals,
    looking_for: JSON.stringify(p.lookingFor),
    github: p.github,
    linkedin: p.linkedin,
    telegram: p.telegram,
    website: p.website,
    company: p.company,
    status: p.status,
    streak: 0,
    xp: 0,                       // FAZA 9-da jurnaldan hesablanır
    reputation: 0,
    tasks_completed: 0,
    last_active_day: '',
    last_active_at: p.joinedAt,
    activity_days: '{}',
    joined_at: p.joinedAt,
    blocked: 0,
    verified: p.behaviour.weight >= 8 && chance(0.55) ? 1 : 0,
    role: p.role,
    settings: '{}',
    must_reset_password: 0,
    has_password: 1,
    pass_hash: p.passHash,
    pass_salt: p.passSalt,
    pass_iter: p.passIter,
    search_name: searchNormalize(`${p.name} ${username}`),
    show_project_on_profile: 1,
  });
}

db.insert('admins', { user_id: adminUser.id, added_at: adminUser.joinedAt, added_by: 'seed' });
db.flush();
done('istifadəçi', people.length);
console.log(`   👑 admin: ${DEMO_PREFIX}${adminUser.username} · moderator: ${moderators.map(m => DEMO_PREFIX + m.username).join(', ')}`);

const byId = new Map(people.map(p => [p.id, p]));
const userIds = people.map(p => p.id);

/** Qoşulma vaxtına görə sıralanmış siyahı — "həmin an mövcud olan istifadəçilər". */
const byJoin = [...people].sort((a, b) => a.joinedAt - b.joinedAt);
const joinTimes = byJoin.map(p => p.joinedAt);

/** `ts` anında artıq qeydiyyatdan keçmiş istifadəçilər (temporal consistency, §32). */
function existingAt(ts) {
  let lo = 0, hi = joinTimes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (joinTimes[mid] <= ts) lo = mid + 1; else hi = mid;
  }
  return byJoin.slice(0, lo);
}

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 2 — SOSİAL QRAF (icma klasterləri, sənəd §8)
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 2 — İzləmə qrafı');

// Mövzuya görə klasterlər. Təsadüfi qraf sənəd §8-i pozardı: real şəbəkədə
// backend developer daha çox backend developer izləyir.
const clusters = new Map();
for (const p of people) {
  if (!clusters.has(p.topic)) clusters.set(p.topic, []);
  clusters.get(p.topic).push(p);
}

// Nüfuz çəkisi: bir neçə istifadəçi hamı tərəfindən izlənir (Pareto).
const influenceWeight = new Map(
  people.map(p => [p.id, Math.max(1, p.behaviour.weight) * (chance(0.08) ? 6 : 1)]),
);
const influencePool = [];
for (const p of people) {
  const w = Math.min(40, influenceWeight.get(p.id));
  for (let i = 0; i < w; i++) influencePool.push(p);
}

let followCount = 0;
for (const p of people) {
  const cluster = clusters.get(p.topic) || [];
  // Aktivlik nə qədər yüksəkdirsə, o qədər çox izləyir.
  const target = Math.round(
    longTail(SCALE.followsPerUser[0], SCALE.followsPerUser[1], 1.6)
    * (0.4 + p.behaviour.weight / 20),
  );
  const wanted = Math.max(2, Math.min(target, people.length - 1));

  const picks = new Set();
  // ~60% eyni klasterdən, qalanı nüfuz hovuzundan (kəsişən icmalar).
  const sameCluster = pickN(cluster.filter(x => x.id !== p.id), Math.ceil(wanted * 0.6));
  for (const x of sameCluster) picks.add(x.id);
  while (picks.size < wanted) {
    const cand = pick(influencePool);
    if (cand.id !== p.id) picks.add(cand.id);
  }

  for (const targetId of picks) {
    const other = byId.get(targetId);
    // ⚠ İzləmə HƏR İKİ tərəfin qoşulmasından SONRA baş verməlidir.
    const earliest = Math.max(p.joinedAt, other.joinedAt);
    if (earliest >= NOW) continue;
    db.insert('follows', {
      follower_id: p.id,
      target_id: targetId,
      created_at: randInt(earliest, NOW),
    });
    followCount++;
  }
}
db.flush();
done('izləmə əlaqəsi', db.count('follows'));

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 3 — GÜNDƏLİK AKTİVLİK PLANI
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 3 — 15 günlük aktivlik planı');

/**
 * Hər istifadəçi üçün aktiv gün dəsti.
 * ⚠ Yalnız QOŞULDUQDAN SONRAKI günlər seçilir (sənəd §32).
 */
for (const p of people) {
  const available = TIMELINE.filter(d => d.index >= p.joinDayIndex);
  const wanted = Math.min(randInt(...p.behaviour.days), available.length);
  /* ⚠ BƏRABƏR SEÇİM DEYİL: `pickN` ilə seçsək həftəsonu və iş günü eyni
     ehtimalla düşür və DAU qrafiki düz xətt olur. Sənəd §9 iş günü/həftəsonu
     fərqini tələb edir, ona görə həftəsonu günləri 0,55 çəki ilə seçilir. */
  const chosen = new Set();
  let guard = 0;
  while (chosen.size < wanted && guard++ < available.length * 8) {
    const d = pick(available);
    if (chosen.has(d.index)) continue;
    if (d.weekend && !chance(0.55)) continue;
    chosen.add(d.index);
  }
  // Qoruyucu tükənsə qalan yerlər bərabər doldurulur — istifadəçi aktivliyi
  // gözlənilən sayın altına düşməsin.
  for (const d of pickN(available, wanted)) {
    if (chosen.size >= wanted) break;
    chosen.add(d.index);
  }
  p.activeDays = chosen;
}

/** Gün üzrə aktiv istifadəçilər. */
const dailyActive = TIMELINE.map(d => people.filter(p => p.activeDays.has(d.index)));

/**
 * Gündəlik post həcmi (sənəd §5).
 * Həftəsonu azalır, gün-günə təsadüfi dalğalanma var, cəm SCALE.posts-a
 * normallaşdırılır — səviyyə dəyişəndə nisbət saxlanılsın.
 */
const rawCurve = TIMELINE.map(d => {
  const base = d.weekend ? 0.55 : 1.0;
  const wave = 0.65 + rnd() * 0.9;          // 0.65 … 1.55
  return base * wave * dailyActive[d.index].length;
});
const curveSum = rawCurve.reduce((a, b) => a + b, 0);
const dailyPosts = rawCurve.map(v => Math.max(4, Math.round(v / curveSum * SCALE.posts)));

for (const d of TIMELINE) {
  console.log(
    `   ${d.date}${d.weekend ? ' (həftəsonu)' : '           '}` +
    ` · aktiv: ${String(dailyActive[d.index].length).padStart(4)}` +
    ` · post: ${String(dailyPosts[d.index]).padStart(4)}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 4 — POSTLAR, ŞƏRHLƏR, REAKSİYALAR
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 4 — Postlar, şərhlər, bəyənmələr');

const posts = [];          // { id, authorId, createdAt, topic, kind, engagement }
const commentsMeta = [];   // { id, postId, authorId, createdAt, postAuthorId }
let commentCount = 0, replyCount = 0, likeCount = 0, reactionCount = 0;
let bookmarkCount = 0, repostCount = 0, commentLikeCount = 0, mentionCount = 0;

/** Aktiv istifadəçilər arasından çəkiyə görə müəllif seçir. */
function authorPool(dayIndex) {
  const pool = [];
  for (const p of dailyActive[dayIndex]) {
    const w = p.behaviour.weight;
    if (w <= 0) continue;                  // PASSIVE_USER post yazmır
    for (let i = 0; i < w; i++) pool.push(p);
  }
  return pool;
}

for (const day of TIMELINE) {
  const pool = authorPool(day.index);
  if (!pool.length) continue;

  for (let i = 0; i < dailyPosts[day.index]; i++) {
    const author = pick(pool);
    const createdAt = Math.max(timeInDay(day.start), author.joinedAt + 60_000);
    if (createdAt >= NOW) continue;

    // Müəllif öz mövzusunda daha çox yazır, amma yalnız onda deyil.
    const topic = chance(0.62) ? author.topic : pickTopic();
    const content = makePost(topic, author);
    const postId = id();
    const eng = weighted(ENGAGEMENT);

    posts.push({
      id: postId, authorId: author.id, createdAt, topic,
      kind: content.kind, engagement: eng.name, content,
    });

    db.insert('posts', {
      id: postId,
      author_id: author.id,
      author_name: author.name,
      blocks: JSON.stringify(content.blocks),
      image_keys: '[]',
      text: content.text,
      tags: JSON.stringify(content.tags),
      search_text: content.searchText,
      like_count: 0,        // FAZA 11-də real sətirlərdən hesablanır
      comment_count: 0,
      share_count: 0,
      post_type: POST_TYPES.ORIGINAL,
      /* Sənəd görünürlük tələb etmir, amma ekranda filtr var: hamısı 'public'
         olsa "yalnız izləyicilər"/"şəxsi" nişanları demo-da heç görünməzdi. */
      visibility: chance(0.93) ? 'public' : (chance(0.7) ? 'followers' : 'private'),
      created_at: createdAt,
      edited_at: chance(0.06) ? createdAt + randInt(60_000, 3_600_000) : null,
      profile_pinned_at: null,
    });
  }
}
db.flush();
done('orijinal post', posts.length);

// ── Şərhlər və cavablar ───────────────────────────────────────────────────
//
// ⚠ Şərh sayı postun ENGAGEMENT sinfindən gəlir, təsadüfi deyil — sənəd §6
//   "postların hamısı viral olmamalıdır" tələbi məhz budur.

const ENG = Object.fromEntries(ENGAGEMENT.map(e => [e.name, e]));

/**
 * Postun ENGAGEMENT YETKİNLİYİ — 0…1.
 *
 * 🔴 NİYƏ LAZIMDIR: yetkinliksiz model hər posta yaşından asılı olmayaraq tam
 *    engagement verirdi. Nəticə hesabatda göründü — son gün 6 399 şərh və
 *    21 038 bəyənmə (digər günlərdə ~2 000 və ~7 000), çünki BUGÜNKÜ postların
 *    bütün şərhləri məcburən bugünə sığışırdı.
 *
 *    Real lentdə iki saatlıq post hələ öz bəyənmələrini toplamayıb (sənəd §15:
 *    "New post → 2 likes"). Ona görə say postun yaşı ilə mütənasib artır və
 *    dörd gündən sonra tam dəyərə çatır.
 */
const ACCRUAL_MS = 4 * 86_400_000;
const maturityOf = post => Math.min(1, Math.max(0.05, (NOW - post.createdAt) / ACCRUAL_MS));

// ── Repost / sitat (sənəd §17) ────────────────────────────────────────────
//
// ⚠ REPOST ÜÇÜN İKİ SƏTİR LAZIMDIR: `posts` cədvəlində `shared_post_id` ilə
//   YENİ sətir + `post_shares` sətri. Yalnız `post_shares` yazsaq lentdə heç
//   nə görünməzdi (feed `posts`-dan oxuyur); yalnız `posts` yazsaq "re-post
//   etdim" vəziyyəti UI-da işarələnməzdi.
//
// 🔴 BU BLOK ŞƏRH/BƏYƏNMƏ FAZALARINDAN ƏVVƏLDƏDİR (2026-08-12). Əvvəl onlardan
//    SONRA idi və nəticə canlı mühitdə göründü: repost/sitat sətirləri HEÇ VAXT
//    bəyənmə və şərh almırdı (3 623 postun hamısı 0/0), lent isə tarixə görə
//    sıralandığı üçün BAŞDAN AŞAĞI reaksiyasız repost divarı kimi açılırdı —
//    yəni sənədin §45-də qadağan etdiyi "ölü demo" görüntüsü. İndi repostlar
//    `posts` massivinə şərh/bəyənmə döngələrindən əvvəl əlavə olunur və
//    ümumi engagement modelinə TAM daxil olur.
const lastOriginalAt = posts.reduce((mx, p) => Math.max(mx, p.createdAt), 0);

// ⚠ Hədəf seçimi yetkinliyə görə çəkilidir: təzə post hələ re-post
//   olunmayıb, ona görə bərabər seçim bütün re-postları son günə yığırdı.
const repostPool = [];
for (const p of posts) {
  const w = Math.max(1, Math.round(maturityOf(p) * 10));
  for (let i = 0; i < w; i++) repostPool.push(p);
}
const repostTargets = pickN(repostPool, Math.round(posts.length * SCALE.perPost.reposts));

/* Repostun ÖZ engagement sinfi — orijinaldan zəif, amma sıfır deyil.
   Paylar ENGAGEMENT-dən götürülüb və aşağı siniflərə sürüşdürülüb: repost
   adətən orijinaldan az reaksiya alır, lakin bəziləri (yaxşı sitat) yayılır. */
const REPOST_ENGAGEMENT = [
  { name: 'none',    w: 30 },
  { name: 'low',     w: 45 },
  { name: 'normal',  w: 20 },
  { name: 'popular', w:  5 },
];

/* ⚠ `post_shares` PK = (user_id, post_id). Cütü izləmədən `posts`-a repost
   sətri yazsaq, `post_shares` INSERT OR IGNORE ilə atılar və `posts`-da
   qarşılığı olmayan repost sətri qalardı — lentdə "boş" kart. */
const sharedPairs = new Set();
for (const post of repostTargets) {
  const candidates = existingAt(post.createdAt).filter(p => p.id !== post.authorId);
  if (!candidates.length) continue;
  const sharer = pick(candidates);
  const pairKey = `${sharer.id}|${post.id}`;
  if (sharedPairs.has(pairKey)) continue;
  sharedPairs.add(pairKey);
  /* ⚠ Üst sərhəd `lastOriginalAt`-dır, `NOW` DEYİL: orijinallar günün aktivlik
     əyrisinə görə yerləşir və sonuncusu adətən indidən bir neçə saat əvvəldir.
     `NOW`-a qədər uzatsaq lentin ƏN BAŞI yalnız repostlardan ibarət olardı. */
  const createdAt = timeAfter(post.createdAt, 600_000, 6 * 86_400_000, lastOriginalAt);
  if (createdAt === null) continue;

  const repostId = id();
  const isQuote = chance(0.35);
  const quoteText = isQuote ? makeQuote(post.content) : null;

  db.insert('posts', {
    id: repostId,
    author_id: sharer.id,
    author_name: sharer.name,
    blocks: isQuote ? JSON.stringify([{ type: 'text', content: quoteText }]) : '[]',
    image_keys: '[]',
    text: isQuote ? quoteText : '',
    tags: '[]',
    search_text: isQuote ? quoteText : '',
    shared_post_id: post.id,
    post_type: isQuote ? POST_TYPES.QUOTE : POST_TYPES.REPOST,
    quote_text: quoteText,
    visibility: 'public',
    created_at: createdAt,
  });
  db.insert('post_shares', {
    user_id: sharer.id, post_id: post.id, repost_id: repostId, created_at: createdAt,
  });
  posts.push({
    id: repostId, authorId: sharer.id, createdAt, topic: post.topic,
    kind: 'repost', engagement: weighted(REPOST_ENGAGEMENT).name,
    content: post.content, sharedFrom: post,
  });
  repostCount++;
}
db.flush();
done('repost/sitat', repostCount);

for (const post of posts) {
  const cfg = ENG[post.engagement];
  const n = Math.round(randInt(...cfg.comments) * maturityOf(post));
  if (!n) continue;

  const candidates = existingAt(post.createdAt);
  if (candidates.length < 3) continue;

  const threadComments = [];
  for (let i = 0; i < n; i++) {
    const author = pick(candidates);
    // ⚠ Şərh postdan SONRA yazılmalıdır (§32) və indidən əvvəl olmalıdır.
    const createdAt = timeAfter(post.createdAt, 120_000, 4 * 86_400_000);
    if (createdAt === null) continue;

    const commentId = id();
    // Şərhlərin kiçik hissəsi @mention-dur — bildiriş axını üçün lazımdır.
    const mentionTarget = chance(0.06) ? pick(candidates) : null;
    const text = mentionTarget && mentionTarget.id !== author.id
      ? makeMention(post.content, mentionTarget.dbUsername)
      : makeComment(post.content);
    if (mentionTarget && mentionTarget.id !== author.id) mentionCount++;

    db.insert('comments', {
      id: commentId,
      post_id: post.id,
      author_id: author.id,
      author_name: author.name,
      text,
      like_count: 0,
      parent_comment_id: null,
      created_at: createdAt,
    });
    threadComments.push({ id: commentId, authorId: author.id, createdAt });
    commentsMeta.push({
      id: commentId, postId: post.id, authorId: author.id,
      createdAt, postAuthorId: post.authorId,
      mentionedId: mentionTarget && mentionTarget.id !== author.id ? mentionTarget.id : null,
    });
    commentCount++;
  }

  // Cavablar — mövcud şərhlərə bağlanır.
  for (const parent of threadComments) {
    if (!chance(0.28)) continue;
    const depth = randInt(1, 3);
    let lastAt = parent.createdAt;
    for (let d = 0; d < depth; d++) {
      const author = pick(candidates);
      const createdAt = timeAfter(lastAt, 60_000, 86_400_000);
      if (createdAt === null) break;
      const replyId = id();
      db.insert('comments', {
        id: replyId,
        post_id: post.id,
        author_id: author.id,
        author_name: author.name,
        text: makeReply(post.content),
        like_count: 0,
        // ⚠ Cavab HƏMİŞƏ kök şərhə bağlanır (bir səviyyə): `js/feed.js` daha
        //   dərin iyerarxiyanı göstərmir, yazsaq cavablar görünməz qalardı.
        parent_comment_id: parent.id,
        created_at: createdAt,
      });
      commentsMeta.push({
        id: replyId, postId: post.id, authorId: author.id,
        createdAt, postAuthorId: post.authorId, parentAuthorId: parent.authorId,
      });
      replyCount++;
      lastAt = createdAt;
    }
  }
}
db.flush();
done('şərh', commentCount);
done('cavab', replyCount);

// ── Bəyənmə, reaksiya, saxlama, repost ────────────────────────────────────

const likesByPost = new Map();

for (const post of posts) {
  const cfg = ENG[post.engagement];
  const candidates = existingAt(post.createdAt).filter(p => p.id !== post.authorId);
  if (!candidates.length) continue;

  // Bəyənmə də yaşla toplanır (bax `maturityOf` izahı).
  const wanted = Math.min(Math.round(randInt(...cfg.likes) * maturityOf(post)), candidates.length);
  const likers = pickN(candidates, wanted);
  const likerIds = [];

  for (const liker of likers) {
    const createdAt = timeAfter(post.createdAt, 30_000, 5 * 86_400_000);
    if (createdAt === null) continue;
    db.insert('likes', { post_id: post.id, user_id: liker.id, created_at: createdAt });
    likerIds.push({ id: liker.id, at: createdAt });
    likeCount++;
  }
  likesByPost.set(post.id, likerIds);

  // Reaksiyalar — bəyənənlərin alt çoxluğu (real davranış: reaksiya verən
  // adətən onsuz da bəyənəndir).
  for (const l of pickN(likerIds, randInt(0, Math.min(6, likerIds.length)))) {
    db.insert('post_reactions', {
      post_id: post.id, user_id: l.id,
      type: pick(REACTION_TYPES), created_at: l.at,
    });
    reactionCount++;
  }

  // Saxlama (sənəd §16) — faydalı janrlarda daha çox.
  const saveBias = ['tutorial', 'tip', 'problem', 'retro'].includes(post.kind) ? 0.68 : 0.22;
  if (chance(saveBias)) {
    for (const u of pickN(candidates, Math.max(1, Math.round(randInt(1, 12) * maturityOf(post))))) {
      db.insert('bookmarks', {
        user_id: u.id, post_id: post.id,
        created_at: timeAfter(post.createdAt, 60_000, 6 * 86_400_000) ?? post.createdAt + 60_000,
      });
      bookmarkCount++;
    }
  }
}
db.flush();
done('bəyənmə', likeCount);
done('reaksiya', reactionCount);
done('saxlama', bookmarkCount);

/* Repost/sitat sətirləri ARTIQ YARADILIB — şərh və bəyənmə fazalarından ƏVVƏL
   (yuxarıda, `posts` massivinə əlavə olunurlar). Səbəb həmin blokun başındadır. */

// ── Şərh bəyənmələri və reaksiyaları ──────────────────────────────────────
for (const c of commentsMeta) {
  if (!chance(0.42)) continue;
  const candidates = existingAt(c.createdAt).filter(p => p.id !== c.authorId);
  if (!candidates.length) continue;
  for (const u of pickN(candidates, longTail(1, 12, 2.4))) {
    const at = timeAfter(c.createdAt, 60_000, 3 * 86_400_000);
    if (at === null) continue;
    db.insert('comment_likes', { comment_id: c.id, user_id: u.id, created_at: at });
    commentLikeCount++;
    if (chance(0.15)) {
      db.insert('comment_reactions', {
        comment_id: c.id, user_id: u.id, type: pick(REACTION_TYPES), created_at: at,
      });
    }
  }
}
db.flush();
done('şərh bəyənməsi', commentLikeCount);

// ── Sorğular (polls) ──────────────────────────────────────────────────────
const POLL_QUESTIONS = [
  ['Hansı frontend framework-u üstün tutursunuz?', ['React', 'Vue', 'Svelte', 'Angular']],
  ['Backend üçün hansı dili seçərdiniz?', ['Python', 'Go', 'TypeScript', 'Java', 'C#']],
  ['Ən çox işlətdiyiniz redaktor?', ['VS Code', 'JetBrains', 'Neovim', 'Zed']],
  ['CI/CD aləti?', ['GitHub Actions', 'GitLab CI', 'Jenkins', 'CircleCI']],
  ['Verilənlər bazası seçimi?', ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB']],
  ['Bulud provayderi?', ['AWS', 'GCP', 'Azure', 'Cloudflare']],
  ['İş formatı?', ['Tam uzaqdan', 'Hibrid', 'Ofis']],
  ['Ən vacib soft skill?', ['Kommunikasiya', 'Problem həlli', 'Komanda işi', 'Vaxt idarəsi']],
  ['Test yazma vərdişiniz?', ['TDD', 'Kod sonrası test', 'Yalnız kritik hissələr', 'Nadir hallarda']],
  ['Kod review-a nə qədər vaxt ayırırsınız?', ['Gündə 1 saatdan çox', '30-60 dəqiqə', '30 dəqiqədən az']],
  ['Hansı mövzuda daha çox məzmun istərdiniz?', ['Sistem dizaynı', 'Təhlükəsizlik', 'AI', 'Karyera']],
  ['Sənədləşdirməni nə vaxt yazırsınız?', ['Koddan əvvəl', 'Kodla birlikdə', 'Sonda', 'Heç vaxt']],
];

const pollHosts = pickN(posts.filter(p => p.kind !== 'repost'), POLL_QUESTIONS.length * 2);
let pollCount = 0, pollVoteCount = 0;
for (let i = 0; i < pollHosts.length; i++) {
  const post = pollHosts[i];
  const [question, options] = POLL_QUESTIONS[i % POLL_QUESTIONS.length];
  const pollId = id();

  db.insert('polls', {
    id: pollId, post_id: post.id, question,
    multi_choice: chance(0.2) ? 1 : 0,
    anonymous: chance(0.3) ? 1 : 0,
    hide_results: 0,
    closes_at: chance(0.4) ? post.createdAt + randInt(2, 7) * 86_400_000 : null,
    created_at: post.createdAt,
  });

  const optionIds = options.map((text, position) => {
    const optId = id();
    db.insert('poll_options', { id: optId, poll_id: pollId, text, position });
    return optId;
  });

  // ⚠ Səslər bərabər paylanmır: real sorğuda 1-2 variant üstünlük təşkil edir.
  const bias = shuffle([...optionIds]);
  const voters = pickN(existingAt(post.createdAt), randInt(18, 90));
  for (const voter of voters) {
    const r = rnd();
    const choice = r < 0.45 ? bias[0] : r < 0.75 ? bias[1] : pick(bias);
    db.insert('poll_votes', {
      poll_id: pollId, user_id: voter.id, option_id: choice,
      created_at: timeAfter(post.createdAt, 60_000, 4 * 86_400_000) ?? post.createdAt + 60_000,
    });
    pollVoteCount++;
  }
  pollCount++;
}
db.flush();
done('sorğu', pollCount);
done('sorğu səsi', pollVoteCount);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 5 — KOMANDALAR, LAYİHƏLƏR, TASKLAR
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 5 — Komandalar, layihələr, tapşırıqlar');

const teamDefs = buildTeams(SCALE.teams);
const teams = [];
const allTasks = [];
let projectCount = 0, taskCount = 0, teamMemberCount = 0, fileCount = 0;
let roomMessageCount = 0, taskCommentCount = 0, teamActivityCount = 0;

const leaders = people.filter(p => p.behaviour.weight >= 6);

for (const def of teamDefs) {
  const owner = pick(leaders.length ? leaders : people);
  const createdAt = Math.max(
    owner.joinedAt + 3_600_000,
    timeInDay(dayStart(randInt(TIMELINE_DAYS - 1, TIMELINE_DAYS + 60))),
  );
  if (createdAt >= NOW) continue;

  const teamId = id();
  db.insert('teams', {
    id: teamId,
    slug: DEMO_PREFIX + def.slug,
    name: def.name,
    description: def.description,
    visibility: def.visibility,
    owner_id: owner.id,
    // Sənəd §16: bəziləri aktiv, bəziləri tamamlanmış, bəziləri gözləmədə.
    status: weighted([
      { value: 'active', w: 72 }, { value: 'completed', w: 18 }, { value: 'archived', w: 10 },
    ]).value,
    xp: 0,
    created_at: createdAt,
    updated_at: createdAt + randInt(0, 10 * 86_400_000),
  });

  /* Rollar. ⚠ Owner icazəsi bazada `["*"]`-dır — komanda RBAC-ında wildcard
     QANUNİ invariantdır (platforma rolları ilə qarışdırma). */
  const roleIds = {};
  const roleDefs = [
    ['Owner', '["*"]', 100],
    ['Admin', '["manage_projects","manage_tasks","manage_members","manage_invites","manage_files"]', 60],
    ['Maintainer', '["manage_projects","manage_tasks","manage_files"]', 40],
    ['Member', '["manage_tasks"]', 10],
    ['Viewer', '[]', 1],
  ];
  for (const [name, permissions, priority] of roleDefs) {
    const rid = id();
    roleIds[name] = rid;
    db.insert('team_roles', {
      id: rid, team_id: teamId, name, permissions, priority, updated_at: createdAt,
    });
  }

  // Üzvlər — sahib + 4…24 nəfər, mövzu klasterindən üstünlüklə.
  const cluster = clusters.get(owner.topic) || people;
  const wanted = randInt(4, 24);
  const memberPool = new Set(pickN(cluster.filter(p => p.id !== owner.id), Math.ceil(wanted * 0.7)).map(p => p.id));
  while (memberPool.size < wanted) {
    const cand = pick(people);
    if (cand.id !== owner.id && cand.joinedAt < createdAt) memberPool.add(cand.id);
  }

  db.insert('team_members', {
    id: id(), team_id: teamId, user_id: owner.id,
    role_id: roleIds.Owner, status: 'active', joined_at: createdAt,
  });
  teamMemberCount++;

  const members = [owner];
  for (const mid of memberPool) {
    const m = byId.get(mid);
    const joinedAt = Math.max(createdAt, m.joinedAt) + randInt(0, 12 * 86_400_000);
    if (joinedAt >= NOW) continue;
    const roleName = weighted([
      { value: 'Admin', w: 10 }, { value: 'Maintainer', w: 14 },
      { value: 'Member', w: 66 }, { value: 'Viewer', w: 10 },
    ]).value;
    db.insert('team_members', {
      id: id(), team_id: teamId, user_id: mid,
      role_id: roleIds[roleName], status: chance(0.96) ? 'active' : 'pending',
      joined_at: joinedAt,
    });
    members.push(m);
    teamMemberCount++;
  }

  // Etiketlər — `ux_task_labels(team_id, name)` unikaldır, təkrar yoxdur.
  const labelIds = [];
  for (const l of buildLabels()) {
    const lid = id();
    labelIds.push(lid);
    db.insert('task_labels', {
      id: lid, team_id: teamId, name: l.name, color: l.color, created_at: createdAt,
    });
  }

  // Çat otağı. ⚠ `rooms` sətri OLMADAN `room_messages` FK ilə sınır.
  const roomId = id();
  db.insert('rooms', { id: roomId, name: `${def.name} — General`, created_by: owner.id, created_at: createdAt });
  db.insert('team_chat_rooms', { id: roomId, team_id: teamId, name: 'General', type: 'General', created_at: createdAt });

  for (let m = 0; m < randInt(4, 26); m++) {
    const sender = pick(members);
    const at = timeAfter(createdAt, 60_000, 14 * 86_400_000);
    if (at === null) continue;
    db.insert('room_messages', {
      id: id(), room_id: roomId, author_id: sender.id, author_name: sender.name,
      type: 'text', text: makeRoomMessage(), created_at: at,
    });
    roomMessageCount++;
  }

  // Layihələr
  const projectDefs = buildProjects(def.slug, def.name, randInt(...SCALE.projectsPerTeam));
  const teamTaskIds = [];
  const projectIds = [];

  for (const proj of projectDefs) {
    const projId = id();
    const projCreated = createdAt + randInt(0, 5 * 86_400_000);
    db.insert('team_projects', {
      id: projId, team_id: teamId, name: proj.name, description: proj.description,
      status: weighted([
        { value: 'active', w: 62 }, { value: 'completed', w: 24 }, { value: 'on_hold', w: 14 },
      ]).value,
      visibility: def.visibility,
      created_by: owner.id, created_at: projCreated, updated_at: projCreated,
    });
    projectCount++;
    projectIds.push(projId);

    for (const m of pickN(members, randInt(2, Math.min(10, members.length)))) {
      db.insert('team_project_members', {
        project_id: projId, user_id: m.id,
        role: m.id === owner.id ? 'Owner' : pick(['Member', 'Member', 'Maintainer']),
        joined_at: Math.max(projCreated, m.joinedAt),
      });
    }

    // Sprint
    const sprintId = id();
    db.insert('sprints', {
      id: sprintId, team_id: teamId, name: sprintName(),
      goal: pick([
        'Əsas axını sabitləşdirmək', 'Performans problemlərini bağlamaq',
        'Yeni funksiyanı çıxarmaq', 'Texniki borcu azaltmaq', 'Test əhatəsini artırmaq',
      ]),
      starts_at: dayStart(TIMELINE_DAYS - 1),
      ends_at: dayStart(-7),
      status: 'active',
      created_by: owner.id, created_at: projCreated,
    });

    const keyPrefix = def.slug.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3) || 'TSK';
    for (let tk = 0; tk < randInt(...SCALE.tasksPerProject); tk++) {
      const taskId = id();
      const assignee = chance(0.85) ? pick(members) : null;
      const status = weighted(TASK_STATUS_MIX).value;
      const priority = weighted(TASK_PRIORITIES).value;
      const createdTask = timeAfter(projCreated, 0, 12 * 86_400_000) ?? projCreated;
      const isDone = status === 'Done';
      const checklist = chance(0.35) ? checklistItems(randInt(2, 5)) : [];
      const checkDone = checklist.filter(() => isDone || chance(0.4)).length;

      db.insert('team_tasks', {
        id: taskId,
        project_id: projId,
        sprint_id: sprintId,
        assignee_id: assignee?.id ?? null,
        title: taskTitle(),
        description: taskDescription(),
        priority,
        status,
        // Sənəd §22: deadline keçmiş, bugünkü və gələcək ola bilər.
        deadline: chance(0.72)
          ? dayStart(randInt(-14, TIMELINE_DAYS - 2))
          : null,
        estimated_minutes: chance(0.6) ? randInt(2, 24) * 30 : null,
        spent_minutes: isDone ? randInt(30, 900) : (status === 'In Progress' ? randInt(15, 420) : 0),
        start_date: chance(0.5) ? createdTask : null,
        completed_at: isDone ? timeAfter(createdTask, 3_600_000, 10 * 86_400_000) : null,
        archived_at: status === 'Cancelled' ? createdTask + randInt(86_400_000, 5 * 86_400_000) : null,
        task_key: `${keyPrefix}-${tk + 1}`,
        position: tk,
        created_by: owner.id,
        created_at: createdTask,
        updated_at: createdTask + randInt(0, 5 * 86_400_000),
        recurrence: '',
        comment_count: 0,
        attach_count: 0,
        check_total: checklist.length,
        check_done: checkDone,
      });
      taskCount++;
      teamTaskIds.push(taskId);
      allTasks.push({ id: taskId, teamId, projId, assigneeId: assignee?.id ?? null, status, createdAt: createdTask });

      checklist.forEach((text, ci) => {
        db.insert('task_checklist', {
          id: id(), task_id: taskId, text,
          done: ci < checkDone ? 1 : 0, position: ci, created_at: createdTask,
        });
      });

      for (const lid of pickN(labelIds, randInt(0, 3))) {
        db.insert('task_label_links', { task_id: taskId, label_id: lid });
      }

      // Task şərhləri + fəaliyyət izi
      for (let ci = 0; ci < randInt(0, 4); ci++) {
        const at = timeAfter(createdTask, 3_600_000, 8 * 86_400_000);
        if (at === null) break;
        db.insert('task_comments', {
          id: id(), task_id: taskId, author_id: pick(members).id,
          text: makeTaskComment(), created_at: at,
        });
        taskCommentCount++;
      }
      if (assignee) {
        db.insert('task_watchers', { task_id: taskId, user_id: assignee.id, created_at: createdTask });
        db.insert('task_activity', {
          id: id(), task_id: taskId, actor_id: owner.id,
          kind: 'assigned', detail: assignee.name, created_at: createdTask,
        });
        if (isDone) {
          db.insert('task_activity', {
            id: id(), task_id: taskId, actor_id: assignee.id,
            kind: 'status', detail: 'Done', created_at: createdTask + randInt(3_600_000, 6 * 86_400_000),
          });
          /* ⚠ `ux_timelog_open` — istifadəçi başına YALNIZ BİR açıq (ended_at
             NULL) qeyd ola bilər. Ona görə bütün demo qeydləri BAĞLIDIR. */
          db.insert('task_time_logs', {
            id: id(), task_id: taskId, user_id: assignee.id,
            minutes: randInt(30, 480),
            started_at: createdTask,
            ended_at: createdTask + randInt(3_600_000, 3 * 86_400_000),
            note: '',
          });
        }
      }
    }
  }

  // Task asılılıqları — lövhədə "bloklanıb" göstəricisi üçün.
  for (const t of pickN(teamTaskIds, Math.floor(teamTaskIds.length * 0.08))) {
    const other = pick(teamTaskIds);
    if (other === t) continue;
    db.insert('task_dependencies', {
      task_id: t, depends_on_id: other, kind: 'blocks', created_at: createdAt,
    });
  }

  // Fayllar
  for (let f = 0; f < randInt(2, 12); f++) {
    const uploader = pick(members);
    const meta = makeFile(teamId);
    db.insert('team_files', {
      id: id(), team_id: teamId, uploaded_by: uploader.id,
      path: meta.path, type: meta.type, size: meta.size, category: meta.category,
      created_at: timeAfter(createdAt, 0, 14 * 86_400_000) ?? createdAt,
    });
    fileCount++;
  }

  // Komanda lenti
  for (let tp = 0; tp < randInt(1, 5); tp++) {
    db.insert('team_posts', {
      id: id(), team_id: teamId, author_id: pick(members).id,
      content: makeTeamPost(), visibility: 'Team',
      created_at: timeAfter(createdAt, 0, 14 * 86_400_000) ?? createdAt,
    });
  }

  // Aktivlik lenti
  for (let a = 0; a < randInt(5, 25); a++) {
    db.insert('team_activity', {
      id: id(), team_id: teamId, actor_id: pick(members).id,
      event_type: pick(TEAM_EVENTS), metadata: '{}',
      created_at: timeAfter(createdAt, 0, 14 * 86_400_000) ?? createdAt,
    });
    teamActivityCount++;
  }

  teams.push({ id: teamId, ownerId: owner.id, members, createdAt, slug: def.slug, roleIds, projects: projectIds });
}
db.flush();
done('komanda', teams.length);
done('layihə', projectCount);
done('tapşırıq', taskCount);
done('komanda üzvlüyü', teamMemberCount);
done('fayl', fileCount);
done('otaq mesajı', roomMessageCount);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 6 — ÖYRƏNMƏ ÇALIŞMALARI (`tasks` + `submissions`)
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 6 — Öyrənmə çalışmaları');

const drills = [];
const variantCount = new Map();
for (let i = 0; i < SCALE.learningTasks; i++) {
  const category = pick(LEARNING_CATEGORIES);
  const drill = makeDrill(category);
  const key = drill.title;
  const n = (variantCount.get(key) || 0) + 1;
  variantCount.set(key, n);

  const creator = pick(people.filter(p => p.behaviour.weight >= 4));
  const createdAt = Math.min(
    Math.max(creator.joinedAt + 3_600_000, timeInDay(dayStart(randInt(0, TIMELINE_DAYS + 30)))),
    NOW - 3_600_000,
  );
  // Sənəd §23: statuslar qarışıq olmalıdır — hamısı 'approved' olsa
  // moderasiya növbəsi boş görünərdi.
  const status = weighted([
    { value: 'approved', w: 78 }, { value: 'pending', w: 17 }, { value: 'rejected', w: 5 },
  ]).value;
  const drillId = id();

  db.insert('tasks', {
    id: drillId,
    title: drillVariant(drill.title, n),
    descr: drill.descr,
    category,
    created_by: creator.id,
    created_by_name: creator.dbUsername,
    status,
    created_at: createdAt,
    approved_by: status === 'approved' ? adminUser.id : null,
    approved_at: status === 'approved' ? createdAt + randInt(3_600_000, 3 * 86_400_000) : null,
  });
  if (status === 'approved') {
    drills.push({ id: drillId, title: drillVariant(drill.title, n), category, createdAt });
  }
}
done('öyrənmə çalışması', SCALE.learningTasks);

let submissionCount = 0;
const solvedBy = new Map();     // uid → təsdiqlənmiş həll sayı
// ⚠ `submissions` PK = (task_id, user_id): eyni istifadəçi eyni çalışmaya
//   yalnız bir dəfə təqdimat verir. Cütlər dəstlə izlənir ki, INSERT OR IGNORE
//   səssizcə sətir udmasın və say hesabatda şişməsin.
const submitted = new Set();
const learners = people.filter(p => p.behaviour.weight > 0);

for (let i = 0; i < SCALE.submissions && drills.length; i++) {
  const drill = pick(drills);
  const user = pick(learners);
  const key = `${drill.id}|${user.id}`;
  if (submitted.has(key)) continue;
  submitted.add(key);

  const submittedAt = Math.min(
    Math.max(drill.createdAt + 3_600_000, user.joinedAt + 3_600_000, timeInDay(dayStart(randInt(0, TIMELINE_DAYS - 1)))),
    NOW - 600_000,
  );
  if (submittedAt <= drill.createdAt) continue;

  const status = weighted([
    { value: 'approved', w: 55 }, { value: 'pending', w: 32 }, { value: 'rejected', w: 13 },
  ]).value;

  db.insert('submissions', {
    task_id: drill.id,
    user_id: user.id,
    username: user.dbUsername,
    name: user.name,
    task_title: drill.title,
    category: drill.category,
    text: makeSubmission(),
    link: chance(0.45) ? `https://github.com/${user.username.replace(/[^a-z0-9]/gi, '')}/collabix-drill-${randInt(1, 99)}` : '',
    status,
    submitted_at: submittedAt,
    reviewed_at: status === 'pending' ? null : submittedAt + randInt(3_600_000, 4 * 86_400_000),
    reviewed_by: status === 'pending' ? null : pick([adminUser, ...moderators]).id,
  });
  submissionCount++;
  if (status === 'approved') solvedBy.set(user.id, (solvedBy.get(user.id) || 0) + 1);
}
db.flush();
done('təqdimat', submissionCount);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 7 — BİRBAŞA MESAJLAR
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 7 — Birbaşa mesajlar');

let dmThreadCount = 0, dmMessageCount = 0;
const dmPairs = new Set();
// Söhbətlər sosial qrafla bağlıdır (sənəd §15): eyni komandada və ya eyni
// mövzu klasterində olanlar daha çox yazışır.
const dmCandidates = [];
for (const team of teams) {
  for (let i = 0; i < team.members.length; i++) {
    for (let j = i + 1; j < team.members.length; j++) {
      if (chance(0.14)) dmCandidates.push([team.members[i], team.members[j]]);
    }
  }
}
for (const [, cluster] of clusters) {
  for (let i = 0; i < cluster.length; i++) {
    if (chance(0.5)) {
      const other = pick(cluster);
      if (other.id !== cluster[i].id) dmCandidates.push([cluster[i], other]);
    }
  }
}
/*
 * ⚠ EHTİYAT HOVUZ: komanda + klaster cütləri tək başına hədəfi doldurmur —
 *   ilk qaçışda 15 000 hədəfə qarşı 9 994 mesaj çıxdı, çünki namizədlər
 *   tükəndi. İzləmə qrafından əlavə cütlər əlavə olunur: real platformada da
 *   yazışma əsasən qarşılıqlı izləyənlər arasındadır.
 */
for (const row of db.query(
  `SELECT f1.follower_id AS a, f1.target_id AS b
     FROM follows f1
     JOIN follows f2 ON f2.follower_id = f1.target_id AND f2.target_id = f1.follower_id
    WHERE f1.follower_id < f1.target_id
    LIMIT 8000`,
)) {
  const a = byId.get(row.a); const b = byId.get(row.b);
  if (a && b) dmCandidates.push([a, b]);
}
shuffle(dmCandidates);

for (const [a, b] of dmCandidates) {
  if (dmMessageCount >= SCALE.dmMessages) break;
  const pairId = [a.id, b.id].sort().join('_');
  if (dmPairs.has(pairId)) continue;
  dmPairs.add(pairId);

  const [ua, ub] = [a.id, b.id].sort();
  const convo = makeConversation(scenarioKeyFor(a.profile, b.profile), conversationLength());
  /* ⚠ Söhbətin BAŞLANĞICI seçilir, sonu yox: replikalar bir-birinin üstünə
     əlavə olunur, ona görə son mesajın `NOW`-u keçməməsi üçün başlanğıc yuxarı
     həddi replika sayına görə geri çəkilir. */
  let at = timeAfter(
    Math.max(a.joinedAt, b.joinedAt), 3_600_000, 20 * 86_400_000,
    NOW - convo.length * 900_000 - 60_000,
  );
  if (at === null) continue;

  const first = ua === a.id ? a : b;
  const second = first.id === a.id ? b : a;

  /* ⚠ MESAJLAR ƏVVƏL HESABLANIR, SONRA YAZILIR: `dm_messages.pair_id`
     `dm_threads(pair_id)`-ə XARİCİ AÇARDIR, yəni söhbət sətri OLMADAN mesaj
     yazmaq `FOREIGN KEY constraint failed` verir. Ardıcıllıq: hesabla →
     söhbəti yaz → mesajları yaz. */
  const planned = [];
  for (let m = 0; m < convo.length; m++) {
    at += randInt(45_000, 900_000);
    if (at >= NOW) break;
    planned.push({
      sender: m % 2 === 0 ? first : second,
      receiver: m % 2 === 0 ? second : first,
      text: convo[m],
      at,
    });
  }
  if (!planned.length) continue;

  const last = planned[planned.length - 1];
  /* Oxunma vəziyyəti (sənəd §19: oxunmuş/oxunmamış qarışıq olsun).
     `read_a`/`read_b` — istifadəçinin OXUDUĞU son an. Göndərən üçün həmişə
     son mesaj anı; qarşı tərəf üçün bəzən daha erkən → oxunmamış qalır. */
  const senderIsA = last.sender.id === ua;
  const stale = () => last.at - randInt(60_000, 3 * 86_400_000);
  db.insert('dm_threads', {
    pair_id: pairId, user_a: ua, user_b: ub,
    last_msg: last.text.slice(0, 200), last_from: last.sender.id, last_at: last.at,
    read_a: senderIsA ? last.at : (chance(0.55) ? last.at : stale()),
    read_b: senderIsA ? (chance(0.55) ? last.at : stale()) : last.at,
  });
  dmThreadCount++;

  for (const m of planned) {
    db.insert('dm_messages', {
      id: id(), pair_id: pairId, from_id: m.sender.id, to_id: m.receiver.id,
      type: 'text', text: m.text, created_at: m.at,
    });
    dmMessageCount++;
  }
}
db.flush();
done('DM söhbəti', dmThreadCount);
done('DM mesajı', dmMessageCount);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 7.5 — ƏHATƏ ZƏMANƏTİ (sənəd §45)
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 NİYƏ AYRICA FAZA: statistik paylanma özlüyündə DOĞRUDUR, lakin demo
//    mühitində NƏTİCƏSİ pisdir. Ölçmə: 600 hesabın 199-u heç bir komandaya
//    üzv deyildi, yəni həmin hesabla girən adam iş sahəsini BOŞ görürdü —
//    sənəd §45-in qadağan etdiyi vəziyyət.
//
// ⚠ PARETO POZULMUR: burada yalnız MİNİMUM verilir (bir komanda, bir söhbət,
//   bir neçə saxlama). Aktivlik fərqi əvvəlki fazalarda qurulub və toxunulmur.
//
// ⚠ PASSİV İSTİFADƏÇİLƏR QƏSDƏN İSTİSNADIR: onların post yazmaması real
//   davranışdır (sənəd §4 "Group D — Low Activity") və profilin boş olması
//   qüsur deyil. Onlara yalnız OXUMA ekranları (komanda, mesaj) doldurulur.
step('FAZA 7.5 — Əhatə zəmanəti');

let fixedTeams = 0, fixedDm = 0, fixedBookmarks = 0, fixedTasks = 0;

// ── Komanda üzvlüyü ───────────────────────────────────────────────────────
const inTeam = new Set(db.query('SELECT DISTINCT user_id AS u FROM team_members').map(r => r.u));
for (const p of people) {
  if (inTeam.has(p.id)) continue;
  // Yalnız istifadəçinin qoşulmasından SONRA yaranmış komandaya girə bilər?
  // Xeyr — əksinə: komanda ƏVVƏL yaranmalıdır ki, üzvlük tarixi məntiqli olsun.
  const eligible = teams.filter(t => t.createdAt > p.joinedAt || t.createdAt < NOW - 86_400_000);
  const team = pick(eligible.length ? eligible : teams);
  if (!team) break;
  /* ⚠ `timeAfter` `null` qaytara bilər (istifadəçi çox yaxında qoşulub və ya
     komanda təzədir). ƏHATƏ FAZASINDA BUNA GÖRƏ ATLAMAQ OLMAZ — məqsəd məhz
     boşluğu bağlamaqdır. Ölçmə: `continue` variantında 193 hesabdan 2-si
     yenə komandasız qalırdı. Ehtiyat dəyər: hər iki tarixdən sonrakı ilk an. */
  const earliest = Math.max(team.createdAt, p.joinedAt);
  const joinedAt = timeAfter(earliest, 3_600_000, 14 * 86_400_000)
    ?? Math.min(earliest + 60_000, NOW - 60_000);
  db.insert('team_members', {
    id: id(), team_id: team.id, user_id: p.id,
    role_id: team.roleIds.Member, status: 'active', joined_at: joinedAt,
  });
  team.members.push(p);
  db.insert('team_activity', {
    id: id(), team_id: team.id, actor_id: p.id,
    event_type: 'MemberJoined', metadata: '{}', created_at: joinedAt,
  });
  fixedTeams++;
}
db.flush();

// ── Layihə üzvlüyü + təyin olunmuş tapşırıq ───────────────────────────────
//
// ⚠ `team_tasks.assignee_id` boş qalsa Kanban "mənim tapşırıqlarım" filtri boş
//   olur. Ona görə tapşırıqsız üzvə HƏMİN komandanın təyinatsız tapşırığı
//   verilir — yenisi yaradılmır, paylanma dəyişmir.
const unassigned = db.query(`
  SELECT tt.id, tp.team_id FROM team_tasks tt
    JOIN team_projects tp ON tt.project_id = tp.id
    JOIN teams t ON tp.team_id = t.id
   WHERE tt.assignee_id IS NULL AND t.slug LIKE '${DEMO_PREFIX}%'`);
const freeByTeam = new Map();
for (const r of unassigned) {
  if (!freeByTeam.has(r.team_id)) freeByTeam.set(r.team_id, []);
  freeByTeam.get(r.team_id).push(r.id);
}

const membershipRows = db.query('SELECT user_id AS u, team_id AS t FROM team_members');
const teamsOf = new Map();
for (const r of membershipRows) {
  if (!teamsOf.has(r.u)) teamsOf.set(r.u, []);
  teamsOf.get(r.u).push(r.t);
}
const hasTask = new Set(
  db.query('SELECT DISTINCT assignee_id AS u FROM team_tasks WHERE assignee_id IS NOT NULL').map(r => r.u),
);
const inProject = new Set(db.query('SELECT DISTINCT user_id AS u FROM team_project_members').map(r => r.u));

for (const p of people) {
  const myTeams = teamsOf.get(p.id) || [];
  if (!myTeams.length) continue;

  if (!inProject.has(p.id)) {
    const team = teams.find(t => t.id === myTeams[0]);
    if (team?.projects?.length) {
      db.exec(
        `INSERT OR IGNORE INTO team_project_members (project_id, user_id, role, joined_at) ` +
        `VALUES ('${pick(team.projects)}', '${p.id}', 'Member', ${Math.max(p.joinedAt, team.createdAt) + 3_600_000})`,
      );
    }
  }

  if (hasTask.has(p.id)) continue;
  for (const tid of myTeams) {
    const free = freeByTeam.get(tid);
    if (free?.length) {
      db.exec(`UPDATE team_tasks SET assignee_id = '${p.id}' WHERE id = '${free.pop()}'`);
      fixedTasks++;
      break;
    }
  }
}
db.flush();

// ── DM söhbəti ────────────────────────────────────────────────────────────
const inDm = new Set([
  ...db.query('SELECT DISTINCT user_a AS u FROM dm_threads').map(r => r.u),
  ...db.query('SELECT DISTINCT user_b AS u FROM dm_threads').map(r => r.u),
]);
for (const p of people) {
  if (inDm.has(p.id)) continue;
  /* ⚠ ÜÇ CƏHD: ilk variantda tərəf seçimi `joinedAt < p.joinedAt` şərti ilə
     məhdud idi və ən erkən qoşulan hesab üçün namizəd qalmırdı — 3 hesab
     söhbətsiz qalmışdı. İndi şərt yumşalır və cüt təkrarlanarsa yeni tərəf
     seçilir. */
  let other = null, pairId = null;
  for (let attempt = 0; attempt < 12 && !other; attempt++) {
    const cand = pick(people.filter(x => x.id !== p.id));
    if (!cand) break;
    const key = [p.id, cand.id].sort().join('_');
    if (dmPairs.has(key)) continue;
    other = cand; pairId = key;
  }
  if (!other) continue;
  dmPairs.add(pairId);
  const [ua, ub] = [p.id, other.id].sort();
  const convo = makeConversation(scenarioKeyFor(p.profile, other.profile), 2);
  const base = Math.max(p.joinedAt, other.joinedAt);
  let at = timeAfter(base, 3_600_000, 12 * 86_400_000, NOW - convo.length * 900_000 - 60_000)
    ?? Math.max(base + 60_000, NOW - convo.length * 600_000 - 120_000);

  const planned = convo.map((text, m) => {
    at += randInt(45_000, 600_000);
    return { text, at, from: m % 2 === 0 ? p : other, to: m % 2 === 0 ? other : p };
  }).filter(m => m.at < NOW);
  if (!planned.length) continue;

  const last = planned[planned.length - 1];
  db.insert('dm_threads', {
    pair_id: pairId, user_a: ua, user_b: ub,
    last_msg: last.text.slice(0, 200), last_from: last.from.id, last_at: last.at,
    read_a: last.from.id === ua ? last.at : last.at - randInt(60_000, 86_400_000),
    read_b: last.from.id === ub ? last.at : last.at - randInt(60_000, 86_400_000),
  });
  for (const m of planned) {
    db.insert('dm_messages', {
      id: id(), pair_id: pairId, from_id: m.from.id, to_id: m.to.id,
      type: 'text', text: m.text, created_at: m.at,
    });
    dmMessageCount++;
  }
  dmThreadCount++;
  inDm.add(p.id); inDm.add(other.id);
  fixedDm++;
}
db.flush();

// ── Saxlanılan postlar ────────────────────────────────────────────────────
const hasBookmark = new Set(db.query('SELECT DISTINCT user_id AS u FROM bookmarks').map(r => r.u));
for (const p of people) {
  if (hasBookmark.has(p.id)) continue;
  for (const post of pickN(posts.filter(x => x.authorId !== p.id && x.createdAt > p.joinedAt), randInt(2, 6))) {
    const at = timeAfter(post.createdAt, 60_000, 6 * 86_400_000);
    if (at === null) continue;
    db.insert('bookmarks', { user_id: p.id, post_id: post.id, created_at: at });
    fixedBookmarks++;
  }
}
db.flush();

done('komandasız hesab bağlandı', fixedTeams);
done('tapşırıq təyin edildi', fixedTasks);
done('söhbətsiz hesab bağlandı', fixedDm);
done('saxlama əlavə edildi', fixedBookmarks);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 8 — BİLDİRİŞLƏR (real aktivlikdən törəyir, sənəd §14)
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 8 — Bildirişlər');

let notifCount = 0;
const PRIORITY_SET = new Set(['mention', 'team_invite', 'team_project_request', 'admin']);

/**
 * ⚠ `group_key` FORMATI SERVERDƏN GƏLİR (taxonomy.js `groupKeyFor`):
 *     dm    → 'dm:<fromId>'
 *     follow→ 'follow'
 *     digər → '<type>:<postId>'  (postId varsa), yoxsa '<type>:<fromId>'
 *   Fərqli format yazsaq susdurma (`notification_mutes`) və qruplaşdırma
 *   demo datada işləməzdi.
 */
function groupKeyFor(type, fromId, postId) {
  if (type === 'dm') return 'dm:' + (fromId || '');
  if (type === 'follow') return 'follow';
  if (postId) return type + ':' + postId;
  return type + ':' + (fromId || '');
}

function notify(toId, fromId, type, text, postId, createdAt) {
  if (toId === fromId) return;
  const from = byId.get(fromId);
  db.insert('notifications', {
    id: id(),
    user_id: toId,
    type,
    from_id: fromId,
    from_name: from ? from.name : '',
    post_id: postId ?? null,
    text,
    // Köhnə bildirişlər daha çox oxunub — real davranış.
    read: (NOW - createdAt) > 3 * 86_400_000 ? (chance(0.88) ? 1 : 0) : (chance(0.35) ? 1 : 0),
    archived: chance(0.05) ? 1 : 0,
    priority: PRIORITY_SET.has(type) ? 1 : 0,
    group_key: groupKeyFor(type, fromId, postId),
    event_key: null,
    created_at: createdAt,
  });
  notifCount++;
}

/* ⚠ Xətti axtarış (`posts.find`) BURADA OLMAMALIDIR: `likesByPost` ~4 500
   girişlidir, `posts` isə ~8 500 — cüt dövr 38 milyon müqayisə deməkdir və
   generator bu fazada dəqiqələrlə ilişirdi. Map ilə axtarış sabit vaxtdır. */
const postById = new Map(posts.map(p => [p.id, p]));

// Bəyənmə bildirişləri — hər bəyənmə üçün deyil (real sistemdə qruplaşır).
for (const [postId, likers] of likesByPost) {
  const post = postById.get(postId);
  if (!post || !likers.length) continue;
  for (const l of pickN(likers, Math.min(likers.length, randInt(1, 4)))) {
    notify(post.authorId, l.id, 'like', 'paylaşımını bəyəndi', postId, l.at);
  }
}

// Şərh / cavab / qeyd bildirişləri
for (const c of commentsMeta) {
  if (c.mentionedId) {
    notify(c.mentionedId, c.authorId, 'mention', 'səni qeyd etdi', c.postId, c.createdAt);
  }
  if (c.parentAuthorId) {
    notify(c.parentAuthorId, c.authorId, 'comment', 'şərhinə cavab yazdı', c.postId, c.createdAt);
  } else if (chance(0.8)) {
    notify(c.postAuthorId, c.authorId, 'comment', 'paylaşımına şərh yazdı', c.postId, c.createdAt);
  }
}

// Repost bildirişləri
for (const p of posts) {
  if (p.kind !== 'repost' || !p.sharedFrom) continue;
  notify(p.sharedFrom.authorId, p.authorId, 'repost', 'paylaşımını re-post etdi', p.sharedFrom.id, p.createdAt);
}

// İzləmə bildirişləri — mövcud `follows` sətirlərindən (uydurma deyil).
for (const row of db.query(
  `SELECT follower_id, target_id, created_at FROM follows
     WHERE follower_id IN (SELECT id FROM users WHERE username LIKE '${DEMO_PREFIX}%')
     ORDER BY created_at DESC LIMIT ${Math.round(SCALE.users * 12)}`,
)) {
  if (chance(0.55)) {
    notify(row.target_id, row.follower_id, 'follow', 'səni izləməyə başladı', null, Number(row.created_at));
  }
}

// Komanda bildirişləri
for (const team of teams) {
  for (const m of pickN(team.members, Math.min(6, team.members.length))) {
    if (m.id === team.ownerId) continue;
    notify(m.id, team.ownerId, pick(['team_invite', 'team_announcement', 'team_role']),
      'komanda yeniliyi', null,
      timeAfter(team.createdAt, 3_600_000, 10 * 86_400_000) ?? team.createdAt);
  }
}

// Task bildirişləri
const teamById = new Map(teams.map(t => [t.id, t]));
for (const t of pickN(allTasks, Math.min(allTasks.length, Math.round(SCALE.users * 3)))) {
  if (!t.assigneeId) continue;
  const team = teamById.get(t.teamId);
  if (!team) continue;
  notify(t.assigneeId, team.ownerId, 'team_task', 'sənə tapşırıq təyin etdi', null,
    timeAfter(t.createdAt, 60_000, 3 * 86_400_000) ?? t.createdAt);
}

// DM bildirişləri
for (const row of db.query(
  `SELECT to_id, from_id, created_at FROM dm_messages ORDER BY created_at DESC LIMIT ${Math.round(SCALE.users * 2)}`,
)) {
  notify(row.to_id, row.from_id, 'dm', 'sənə mesaj göndərdi', null, Number(row.created_at));
}

// Sistem bildirişləri
for (const p of pickN(people, Math.round(people.length * 0.25))) {
  notify(p.id, adminUser.id, 'admin', pick([
    'Platformada yeni funksiya əlavə edildi.',
    'Təhlükəsizlik parametrlərinizi yoxlayın.',
    'Profilinizi tamamlayın və bonus XP qazanın.',
  ]), null, timeInDay(dayStart(randInt(0, TIMELINE_DAYS - 1))));
}
for (const p of people.filter(x => x.verified)) {
  notify(p.id, adminUser.id, 'verified', 'hesabınız təsdiqləndi', null,
    timeAfter(p.joinedAt, 86_400_000, 20 * 86_400_000) ?? p.joinedAt);
}
db.flush();
done('bildiriş', notifCount);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 9 — XP (real əməliyyatlardan, invariant-safe)
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 9 — XP və reputasiya');

/*
 * 🔴 İNVARİANT: `users.xp == SUM(xp_logs.amount)`. Worker `assertXpInvariant()`
 *    ilə bunu yoxlayır və admin panelində fərq göstərir.
 *
 * ⚠ GÜNDƏLİK TAVAN TƏTBİQ OLUNUR (worker/xp.ts XP_RULES): tavansız yazsaq
 *    demo istifadəçilər real sistemin HEÇ VAXT verə bilməyəcəyi XP-yə çatardı
 *    və leaderboard yalançı olardı.
 *
 * ⚠ `ux_xp_logs_source(uid, source, ref_id)` UNİKALDIR — `ref_id` istehsalla
 *    eyni formatda qurulur (post id, `<postId>:<likerUid>`, tarix sətri).
 */
const xpTotals = new Map();
const dailyUsed = new Map();      // `${uid}|${date}|${source}` → istifadə olunmuş XP
const dailyTotalUsed = new Map(); // `${uid}|${date}` → ümumi

function grantXp(uid, source, refId, amount, at) {
  const date = dateStr(at);
  const capKey = `${uid}|${date}|${source}`;
  const totalKey = `${uid}|${date}`;
  const cap = XP.daily[source];

  if (cap != null) {
    const used = dailyUsed.get(capKey) || 0;
    if (used + amount > cap) return false;
    const total = dailyTotalUsed.get(totalKey) || 0;
    if (total + amount > XP.dailyTotal) return false;
    dailyUsed.set(capKey, used + amount);
    dailyTotalUsed.set(totalKey, total + amount);
  }

  db.insert('xp_logs', {
    id: id(), uid, source, ref_id: refId, amount, created_at: at,
  });
  xpTotals.set(uid, (xpTotals.get(uid) || 0) + amount);
  return true;
}

// Qeydiyyat XP-si — hesab başına bir dəfə (`ref_id = uid`).
for (const p of people) grantXp(p.id, 'signup', p.id, XP.values.signup, p.joinedAt);

// Post XP-si
for (const p of posts) {
  const isOriginal = !p.sharedFrom;
  grantXp(p.authorId, 'post', p.id,
    isOriginal ? XP.values.post : XP.values.shared_post, p.createdAt);
  if (!isOriginal) grantXp(p.authorId, 'repost', p.sharedFrom.id, XP.values.repost, p.createdAt);
}

// Şərh XP-si
for (const c of commentsMeta) grantXp(c.authorId, 'comment', c.id, XP.values.comment, c.createdAt);

// Bəyənmə XP-si — MÜƏLLİFƏ verilir, `ref_id = '<postId>:<likerUid>'`
// (istehsaldakı sockpuppet müdafiəsi ilə eyni açar).
for (const [postId, likers] of likesByPost) {
  const post = postById.get(postId);
  if (!post) continue;
  for (const l of likers) {
    grantXp(post.authorId, 'like_received', `${postId}:${l.id}`, XP.values.like_received, l.at);
  }
}

// Gündəlik giriş XP-si — aktiv günlərdən (`ref_id = tarix`).
for (const p of people) {
  for (const dayIndex of p.activeDays) {
    const d = TIMELINE[dayIndex];
    grantXp(p.id, 'daily_login', d.date, XP.values.daily_login, d.start + 9 * 3_600_000);
  }
}

// Öyrənmə həlli XP-si
for (const [uid, n] of solvedBy) {
  for (let i = 0; i < n; i++) {
    grantXp(uid, 'solution', `${uid}:${i}`, XP.values.solution,
      timeInDay(dayStart(randInt(0, TIMELINE_DAYS - 1))));
  }
}

// Komanda tapşırığı XP-si — yalnız TAMAMLANMIŞ tapşırıqlar.
let teamTaskXpCount = 0;
for (const t of allTasks) {
  if (t.status !== 'Done' || !t.assigneeId) continue;
  if (grantXp(t.assigneeId, 'team_task', t.id, XP.values.team_task, t.createdAt)) teamTaskXpCount++;
}

/* Profil bonusu (+100 XP) QƏSDƏN VERİLMİR.
 *
 * 🔴 Serverdə bonusun yeganə şərti `worker/progression.ts → isProfileComplete`
 *    funksiyasıdır və o, İLK NÖVBƏDƏ `photo_url` tələb edir. Demo hesablarda
 *    avatar faylı yoxdur (yuxarıdakı `photo_url: null` izahına bax), yəni heç
 *    bir demo profil "tam" sayılmır. Bonusu buradan öz şərtimizlə versəydik,
 *    XP jurnalı platformanın öz qaydası ilə ZİDD olardı: istifadəçi bonusu
 *    almış görünər, profil tamlığı göstəricisi isə 100%-ə çatmazdı. Sənəd §24
 *    "XP təsadüfi rəqəm kimi yazılmamalıdır" deyir — bu, həmin tələbin
 *    davamıdır.
 */

// Təsdiqlənmiş hesablar
for (const p of people.filter(x => x.verified)) {
  grantXp(p.id, 'verified', p.id, XP.values.verified, p.joinedAt + 2 * 86_400_000);
}

db.flush();

// users.xp = SUM(xp_logs.amount) — tək mənbədən yazılır.
db.exec(`
  UPDATE users
     SET xp = COALESCE((SELECT SUM(amount) FROM xp_logs WHERE xp_logs.uid = users.id), 0)
   WHERE username LIKE '${DEMO_PREFIX}%'
`);

// Reputasiya — bəyənmə və təsdiqlənmiş həllərdən.
let repCount = 0;
for (const p of people) {
  const amount = Math.round((xpTotals.get(p.id) || 0) / 12) + randInt(0, 8);
  if (amount <= 0) continue;
  db.insert('reputation_logs', {
    id: id(), uid: p.id, source: 'seed', ref_id: p.id, amount,
    created_at: Math.min(p.joinedAt + 86_400_000, NOW - 60_000),
  });
  repCount++;
}
db.flush();
db.exec(`
  UPDATE users
     SET reputation = COALESCE((SELECT SUM(amount) FROM reputation_logs WHERE reputation_logs.uid = users.id), 0)
   WHERE username LIKE '${DEMO_PREFIX}%'
`);
done('XP jurnal sətri', db.count('xp_logs'));
done('reputasiya sətri', repCount);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 10 — AKTİVLİK, SESSİYA, MÖVCUDLUQ
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 10 — Aktivlik, sessiyalar, mövcudluq');

let activityCount = 0, sessionCount = 0, profileViewCount = 0, progressCount = 0;

const UA = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/17.5',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36',
];
const CITIES = [
  ['Bakı', 'AZ'], ['Gəncə', 'AZ'], ['Sumqayıt', 'AZ'], ['İstanbul', 'TR'],
  ['Tbilisi', 'GE'], ['Varşava', 'PL'], ['Berlin', 'DE'], ['Kiyev', 'UA'],
];

for (const p of people) {
  // Heatmap — aktiv günlərdəki əməliyyat sayı.
  for (const dayIndex of p.activeDays) {
    const d = TIMELINE[dayIndex];
    const w = p.behaviour.weight;
    db.insert('user_activity', {
      uid: p.id, date: d.date,
      count: Math.max(1, Math.round(randInt(1, 6) + w / 2)),
    });
    activityCount++;
  }

  // Son aktivlik anı — aktiv günlərin ən sonuncusundan.
  const lastDay = Math.max(...(p.activeDays.size ? [...p.activeDays] : [0]));
  const lastActive = p.activeDays.size
    ? timeInDay(TIMELINE[lastDay].start)
    : p.joinedAt;
  db.exec(
    `UPDATE users SET last_active_at = ${Math.min(lastActive, NOW - 60_000)}, ` +
    `last_active_day = '${TIMELINE[lastDay].date}', ` +
    `streak = ${Math.min(p.activeDays.size, randInt(1, 14))}, ` +
    `tasks_completed = ${solvedBy.get(p.id) || 0} ` +
    `WHERE id = '${p.id}'`,
  );

  // Mövcudluq — son 3 gün ərzində görünənlər "onlayn" siyahısını doldurur.
  db.insert('presence', {
    user_id: p.id,
    last_seen: Math.min(lastActive, NOW - randInt(60_000, 3 * 86_400_000)),
  });

  // Sessiyalar — aktiv istifadəçilərin açıq cihazları.
  //
  // ⚠ `refresh_hash` REAL DEYİL və olmamalıdır: bu, yalnız "aktiv sessiyalar"
  //   ekranını doldurmaq üçün metadatadır. Etibarlı token yazsaq demo bazadan
  //   sessiya oğurlamaq mümkün olardı.
  if (p.behaviour.weight >= 2) {
    for (let s = 0; s < randInt(1, 3); s++) {
      const created = Math.min(lastActive - randInt(0, 20 * 86_400_000), NOW - 3_600_000);
      const [city, country] = pick(CITIES);
      db.insert('sessions', {
        id: id(),
        uid: p.id,
        refresh_hash: `demo-${id()}`,
        prev_refresh_hash: '',
        ua: pick(UA),
        ip: `203.0.113.${randInt(1, 254)}`,     // RFC 5737 — sənəd üçün ayrılmış test bloku
        city, country,
        created_at: created,
        last_seen: Math.min(lastActive, NOW - 60_000),
        expires_at: created + 30 * 86_400_000,
        revoked: chance(0.12) ? 1 : 0,
        revoked_at: null,
        revoked_by: '',
      });
      sessionCount++;
    }
  }

  // Profil baxışları — populyar profillərdə daha çox.
  if (p.behaviour.weight >= 4) {
    for (const d of TIMELINE) {
      if (!chance(0.55)) continue;
      db.insert('profile_views', {
        uid: p.id, date: d.date,
        count: Math.max(1, longTail(1, Math.round(p.behaviour.weight * 2), 1.8)),
      });
      profileViewCount++;
    }
  }

  // Bacarıq üzrə irəliləyiş (`progress`) — profil qrafiklərini doldurur.
  for (const skill of Object.keys(p.progLevels)) {
    db.insert('progress', {
      user_id: p.id, field: skill,
      posts: randInt(0, 12), tasks: randInt(0, 6),
      xp: Math.round((xpTotals.get(p.id) || 0) / Math.max(1, Object.keys(p.progLevels).length)),
    });
    progressCount++;
  }
}
db.flush();
done('aktivlik günü', activityCount);
done('sessiya', sessionCount);
done('profil baxışı', profileViewCount);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 11 — MODERASİYA VƏ ADMİN (sənəd §29)
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 11 — Moderasiya, şikayətlər, audit');

let reportCount = 0, warnCount = 0, adminLogCount = 0;

// ⚠ "Bütün istifadəçiləri problemli göstərmə" (§29): şikayət sayı istifadəçi
//   sayının ~4%-i qədərdir və əksəriyyəti bağlanmışdır.
const reportTargets = pickN(people, Math.max(6, Math.round(people.length * 0.04)));
for (const target of reportTargets) {
  const reporter = pick(people.filter(p => p.id !== target.id));
  const at = timeInDay(dayStart(randInt(0, TIMELINE_DAYS - 1)));
  const status = weighted([
    { value: 'open', w: 25 }, { value: 'resolved', w: 55 }, { value: 'dismissed', w: 20 },
  ]).value;
  db.insert('reports', {
    id: id(), reporter_id: reporter.id, reporter_name: reporter.dbUsername,
    target_id: target.id, target_username: target.dbUsername,
    reason: pick(REPORT_REASONS), status,
    created_at: at, updated_at: status === 'open' ? null : at + randInt(3_600_000, 3 * 86_400_000),
  });
  reportCount++;
}

for (const post of pickN(posts, Math.max(4, Math.round(posts.length * 0.006)))) {
  const reporter = pick(people.filter(p => p.id !== post.authorId));
  db.insert('post_reports', {
    id: id(), post_id: post.id, reporter_id: reporter.id,
    reporter_name: reporter.dbUsername, reason: pick(REPORT_REASONS),
    status: chance(0.6) ? 'resolved' : 'open',
    created_at: timeAfter(post.createdAt, 3_600_000, 5 * 86_400_000) ?? post.createdAt,
  });
  reportCount++;
}

for (const c of pickN(commentsMeta, Math.max(4, Math.round(commentsMeta.length * 0.003)))) {
  const reporter = pick(people.filter(p => p.id !== c.authorId));
  db.insert('comment_reports', {
    id: id(), comment_id: c.id, post_id: c.postId, reporter_id: reporter.id,
    reporter_name: reporter.dbUsername, reason: pick(REPORT_REASONS),
    status: chance(0.55) ? 'resolved' : 'open',
    created_at: timeAfter(c.createdAt, 3_600_000, 4 * 86_400_000) ?? c.createdAt,
  });
  reportCount++;
}

// Xəbərdarlıqlar — çox az sayda, yalnız şikayət edilmişlərdən.
for (const target of pickN(reportTargets, Math.min(5, reportTargets.length))) {
  db.insert('warnings', {
    id: id(), uid: target.id, by_uid: pick(moderators).id,
    reason: pick([
      'Təkrarlanan reklam məzmunu.',
      'İcma qaydalarına uyğun olmayan dil.',
      'Mövzu ilə əlaqəsi olmayan paylaşımlar.',
    ]),
    report_id: null,
    created_at: timeInDay(dayStart(randInt(1, TIMELINE_DAYS - 1))),
  });
  warnCount++;
}

// Susdurulmuş bir hesab — moderasiya ekranı tam boş qalmasın.
const mutedUser = pick(people.filter(p => p.behaviour.weight <= 1));
db.insert('mutes', {
  id: id(), uid: mutedUser.id, by_uid: moderators[0].id,
  reason: 'Spam şübhəsi — müvəqqəti məhdudiyyət.',
  expires_at: NOW + 3 * 86_400_000,
  created_at: NOW - 2 * 86_400_000,
});

// Admin audit izi
const ADMIN_ACTIONS = [
  ['user-edit', 'info'], ['admin-add', 'success'], ['export-users', 'info'],
  ['badge-grant', 'success'], ['post-hide', 'warning'], ['user-warn', 'warning'],
  ['task-approved', 'success'], ['task-rejected', 'warning'], ['report-resolve', 'success'],
  ['role-change', 'info'], ['session-revoke', 'warning'], ['login-failed', 'error'],
];
for (let i = 0; i < Math.max(40, Math.round(people.length / 6)); i++) {
  const [action, level] = pick(ADMIN_ACTIONS);
  const actor = pick([adminUser, ...moderators]);
  const target = pick(people);
  db.insert('admin_logs', {
    id: id(), action, target_id: target.id, by_id: actor.id, by_name: actor.dbUsername,
    detail: `demo · ${target.dbUsername}`,
    created_at: timeInDay(dayStart(randInt(0, TIMELINE_DAYS - 1))),
    level,
  });
  adminLogCount++;
}

// Təhlükəsizlik hadisələri — təhdid paneli üçün.
const SEC_EVENTS = [
  ['login_ok', 'info'], ['login_fail', 'warning'], ['rate_limited', 'warning'],
  ['password_change', 'info'], ['session_revoked', 'info'], ['mfa_enabled', 'success'],
];
let secCount = 0;
for (let i = 0; i < Math.max(80, people.length); i++) {
  const [type, severity] = pick(SEC_EVENTS);
  const u = pick(people);
  const [city, country] = pick(CITIES);
  db.insert('security_events', {
    id: id(), type, uid: u.id, username: u.dbUsername,
    ip: `203.0.113.${randInt(1, 254)}`, country, city, severity,
    meta: '{}', created_at: timeInDay(dayStart(randInt(0, TIMELINE_DAYS - 1))),
  });
  secCount++;
}

// Dəvət kodları
for (let i = 0; i < Math.max(6, Math.round(people.length / 60)); i++) {
  const inviter = pick(people.filter(p => p.behaviour.weight >= 8));
  db.insert('invites', {
    code: `DEMO-${String(i + 1).padStart(4, '0')}`,
    inviter_uid: inviter.id,
    max_uses: 25, uses: randInt(0, 14), active: chance(0.8) ? 1 : 0,
    expires_at: NOW + randInt(10, 90) * 86_400_000,
    created_at: Math.min(inviter.joinedAt + 86_400_000, NOW - 86_400_000),
  });
}
db.flush();
done('şikayət', reportCount);
done('xəbərdarlıq', warnCount);
done('admin jurnalı', adminLogCount);
done('təhlükəsizlik hadisəsi', secCount);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 12 — NİŞANLAR VƏ NAİLİYYƏTLƏR
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 12 — Nişanlar və nailiyyətlər');

const badges = db.query('SELECT code, rule_kind, rule_value FROM badges');
const achievements = db.query('SELECT code, rule_kind, rule_value FROM achievements');
let badgeLogCount = 0, achieveLogCount = 0;

/*
 * ⚠ NİŞAN QAYDA ƏSASLIDIR: `badges.rule_kind` + `rule_value` mövcud sətirlərdir
 *   (miqrasiyadan gəlir). Təsadüfi nişan paylasaq istifadəçinin profilində
 *   qazanmadığı nişan görünərdi — sənəd §31 consistency tələbini pozar.
 */
const statsByUid = new Map(
  db.query(`SELECT uid, posts, comments, likes_received, followers FROM user_stats`)
    .map(r => [r.uid, r]),
);

function ruleMet(kind, value, p) {
  const s = statsByUid.get(p.id) || {};
  const xp = xpTotals.get(p.id) || 0;
  switch (kind) {
    case 'xp': return xp >= value;
    case 'posts': return Number(s.posts || 0) >= value;
    case 'comments': return Number(s.comments || 0) >= value;
    case 'likes': case 'likes_received': return Number(s.likes_received || 0) >= value;
    case 'followers': return Number(s.followers || 0) >= value;
    case 'tasks': case 'solutions': return (solvedBy.get(p.id) || 0) >= value;
    case 'streak': return p.activeDays.size >= value;
    default: return xp >= value;
  }
}

for (const p of people) {
  for (const b of badges) {
    if (!ruleMet(b.rule_kind, Number(b.rule_value), p)) continue;
    db.insert('badge_logs', {
      id: id(), uid: p.id, badge_code: b.code,
      created_at: timeAfter(p.joinedAt, 86_400_000, 30 * 86_400_000) ?? p.joinedAt,
    });
    badgeLogCount++;
  }
  for (const a of achievements) {
    if (!ruleMet(a.rule_kind, Number(a.rule_value), p)) continue;
    db.insert('achievement_logs', {
      id: id(), uid: p.id, achievement_code: a.code,
      created_at: timeAfter(p.joinedAt, 86_400_000, 30 * 86_400_000) ?? p.joinedAt,
    });
    achieveLogCount++;
  }
}
db.flush();
done('nişan verilməsi', badgeLogCount);
done('nailiyyət', achieveLogCount);

// ═══════════════════════════════════════════════════════════════════════════
// FAZA 13 — SAYĞACLARIN DENORMALİZASİYASI VƏ AQREQATLAR
// ═══════════════════════════════════════════════════════════════════════════
step('FAZA 13 — Sayğaclar və aqreqatlar');

/*
 * 🔴 SAYĞACLAR HESABLANIR, YAZILMIR (sənəd §19/§26/§31). Hər dəyər öz
 *    mənbə cədvəlindən COUNT ilə gəlir, ona görə profil ekranındakı rəqəm
 *    bazadakı sətir sayı ilə HƏMİŞƏ üst-üstə düşür.
 */
const demoUsers = `(SELECT id FROM users WHERE username LIKE '${DEMO_PREFIX}%')`;

db.exec(`UPDATE posts SET like_count = (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) WHERE author_id IN ${demoUsers}`);
db.exec(`UPDATE posts SET comment_count = (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) WHERE author_id IN ${demoUsers}`);
db.exec(`UPDATE posts SET share_count = (SELECT COUNT(*) FROM post_shares WHERE post_shares.post_id = posts.id) WHERE author_id IN ${demoUsers}`);
db.exec(`UPDATE comments SET like_count = (SELECT COUNT(*) FROM comment_likes WHERE comment_likes.comment_id = comments.id) WHERE author_id IN ${demoUsers}`);
db.exec(`UPDATE users SET followers_count = (SELECT COUNT(*) FROM follows WHERE follows.target_id = users.id) WHERE username LIKE '${DEMO_PREFIX}%'`);
db.exec(`UPDATE users SET following_count = (SELECT COUNT(*) FROM follows WHERE follows.follower_id = users.id) WHERE username LIKE '${DEMO_PREFIX}%'`);
db.exec(`
  UPDATE team_tasks SET comment_count = (SELECT COUNT(*) FROM task_comments WHERE task_comments.task_id = team_tasks.id)
   WHERE project_id IN (SELECT tp.id FROM team_projects tp JOIN teams t ON tp.team_id = t.id WHERE t.slug LIKE '${DEMO_PREFIX}%')
`);
db.exec(`
  UPDATE teams SET xp = COALESCE((
    SELECT SUM(${XP.values.team_task}) FROM team_tasks tt
      JOIN team_projects tp ON tt.project_id = tp.id
     WHERE tp.team_id = teams.id AND tt.status = 'Done'
  ), 0) WHERE slug LIKE '${DEMO_PREFIX}%'
`);

/*
 * `user_stats` — TRIGGERLƏR onsuz da doldurur (stats_post_ai, stats_like_ai,
 * stats_follow_ai, stats_comment_ai). Yenə də sonda mənbədən yenidən
 * hesablanır: `INSERT OR IGNORE` ilə atılan təkrar sətirlər triggerin sayğacına
 * düşmür, ona görə kiçik sürüşmə mümkündür.
 */
db.exec(`
  INSERT INTO user_stats (uid, posts, comments, likes_given, likes_received, followers, following, updated_at)
  SELECT u.id,
    (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id),
    (SELECT COUNT(*) FROM comments c WHERE c.author_id = u.id),
    (SELECT COUNT(*) FROM likes l WHERE l.user_id = u.id),
    (SELECT COUNT(*) FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author_id = u.id),
    (SELECT COUNT(*) FROM follows f WHERE f.target_id = u.id),
    (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id),
    ${NOW}
  FROM users u WHERE u.username LIKE '${DEMO_PREFIX}%'
  ON CONFLICT(uid) DO UPDATE SET
    posts = excluded.posts, comments = excluded.comments,
    likes_given = excluded.likes_given, likes_received = excluded.likes_received,
    followers = excluded.followers, following = excluded.following,
    updated_at = excluded.updated_at
`);

/* Gündəlik statistika (sənəd §4).
 *
 * 🔴 DƏYƏRLƏR KUMULYATİVDİR, GÜNLÜK ARTIM DEYİL. `worker/routes/admin.ts →
 *    adminStatsDaily` bu cədvələ bugünkü sətri `COUNT(*) FROM users`,
 *    `COUNT(*) FROM posts` kimi YAZIR — yəni sütunların mənası "həmin günün
 *    sonuna qədər CƏMİ". Seed günlük artım yazsaydı, admin sparkline-ı 15 gün
 *    ~30 dəyər göstərib bugün birdən 7 600-ə tullanardı: eyni sütunda iki
 *    fərqli ölçü vahidi. Ona görə hər gün üçün "həmin günün sonuna qədər cəmi"
 *    hesablanır. */
for (const d of TIMELINE) {
  const dayEnd = d.start + 86_400_000;
  const users = db.one(`SELECT COUNT(*) AS c FROM users WHERE joined_at < ${dayEnd}`);
  const postsTotal = db.one(`SELECT COUNT(*) AS c FROM posts WHERE created_at < ${dayEnd}`);
  const complaints = db.one(`SELECT COUNT(*) AS c FROM reports WHERE created_at < ${dayEnd}`);
  db.insert('stats_daily', {
    date: d.date,
    users: Number(users?.c || 0),
    posts: Number(postsTotal?.c || 0),
    complaints: Number(complaints?.c || 0),
    blocked: 0,
    updated_at: NOW,
  });
}
db.flush();

for (const [metric, sql] of [
  ['users_total', 'SELECT COUNT(*) AS c FROM users'],
  ['posts_total', 'SELECT COUNT(*) AS c FROM posts'],
  ['comments_total', 'SELECT COUNT(*) AS c FROM comments'],
  ['reports_open', "SELECT COUNT(*) AS c FROM reports WHERE status = 'open'"],
  ['users_blocked', 'SELECT COUNT(*) AS c FROM users WHERE blocked = 1'],
  ['teams_total', 'SELECT COUNT(*) AS c FROM teams'],
]) {
  const v = Number(db.one(sql)?.c || 0);
  db.exec(`INSERT OR REPLACE INTO stats_rollup (metric, value, updated_at) VALUES ('${metric}', ${v}, ${NOW})`);
}
db.flush();
done('gündəlik statistika', TIMELINE.length);

// ═══════════════════════════════════════════════════════════════════════════
// YEKUN
// ═══════════════════════════════════════════════════════════════════════════
db.close();

const elapsed = ((performance.now() - T0) / 1000).toFixed(1);
console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  ✅ DEMO SEED TAMAMLANDI                                  ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log(`   Vaxt: ${elapsed}s\n`);
console.log('   Növbəti addımlar:');
console.log('     npm run seed:audit    → uyğunluq yoxlaması');
console.log('     npm run seed:report   → yekun hesabat + 15 günlük timeline');
console.log('     npm run dev           → mühiti brauzerdə aç\n');

// Demo hesab siyahısı — YALNIZ development üçün (sənəd §41).
const topAccounts = [...people]
  .sort((a, b) => (xpTotals.get(b.id) || 0) - (xpTotals.get(a.id) || 0))
  .slice(0, 10);

const { writeFileSync } = await import('node:fs');
writeFileSync(
  'seed/DEMO-ACCOUNTS.md',
  [
    '# Collabix — demo hesablar',
    '',
    '> ⚠ **YALNIZ DEVELOPMENT/DEMO MÜHİTİ ÜÇÜN.** Bu fayl istehsal mühitinə',
    '> yerləşdirilməməlidir və istifadəçi məlumatları tamamilə sintetikdir.',
    '',
    `Yaradılma: ${new Date(NOW).toISOString()}`,
    `Səviyyə: ${LEVEL.label}`,
    '',
    '| # | İstifadəçi adı | Ad | Rol | XP | Parol |',
    '|---|---|---|---|---|---|',
    ...topAccounts.map((p, i) =>
      `| ${i + 1} | \`${p.dbUsername}\` | ${p.name} | ${p.role} | ${(xpTotals.get(p.id) || 0).toLocaleString('az-AZ')} | \`${p.password}\` |`),
    '',
    '## Parol qaydası',
    '',
    'Hər demo hesabın parolu unikaldır və belə qurulur:',
    '',
    '```',
    '<SEED_PASS><istifadəçi adının ilk 6 hərf/rəqəmi>',
    '```',
    '',
    `Bu qaçışda \`SEED_PASS\` = \`${DEMO_PASS}\`.`,
    '',
    '## Silmək üçün',
    '',
    '```bash',
    'npm run seed:reset',
    '```',
    '',
  ].join('\n'),
  'utf8',
);
console.log('   📄 seed/DEMO-ACCOUNTS.md yazıldı (demo hesab parolları).\n');
