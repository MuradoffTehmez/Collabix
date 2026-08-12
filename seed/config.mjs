// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Konfiqurasiya
// ═══════════════════════════════════════════════════════════════════════════
//
// Bütün miqyas parametrləri BURADADIR. Generator heç bir rəqəmi öz içində
// sabitləmir — miqyası dəyişmək üçün yalnız `SEED_LEVEL` kifayətdir.

/** Demo hesabların parolu — YALNIZ development/demo mühiti üçün. */
export const DEMO_PASS = process.env.SEED_PASS || 'Demo2026!';

/** Demo obyektlərinin prefiksi — reset bu prefiksə görə silir. */
export const DEMO_PREFIX = 'demo_';

/** Zaman xətti uzunluğu (gün). Sənəd §8: son 15 gün. */
export const TIMELINE_DAYS = 15;

// ═══════════════════════════════════════════════════════════════════════════
// MİQYAS SƏVİYYƏLƏRİ (sənəd §22 SCALE TEST)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ Bütün ikinci dərəcəli həcmlər istifadəçi sayından TÖRƏYİR. Ayrıca sabit
//   yazsaydıq səviyyə dəyişəndə nisbətlər pozulardı (məsələn 1000 user + 300
//   post = ölü platforma görüntüsü).

const LEVELS = {
  1: { users:  250, label: 'L1 — kiçik demo' },
  2: { users:  600, label: 'L2 — standart demo' },
  3: { users: 1000, label: 'L3 — böyük demo' },
  4: { users: 2500, label: 'L4 — benchmark' },
};

export const SEED_LEVEL = Number(process.env.SEED_LEVEL || 2);
if (!LEVELS[SEED_LEVEL]) {
  throw new Error(`Naməlum SEED_LEVEL: ${SEED_LEVEL}. Mümkün: 1, 2, 3, 4`);
}

export const LEVEL = LEVELS[SEED_LEVEL];
export const USER_COUNT = LEVEL.users;

/** İstifadəçi başına ortalama həcm əmsalları. */
const PER_USER = {
  posts:        7.5,    // 600 user → ~4 500 post
  follows:       30,    // 600 user → ~18 000 əlaqə (təkrarlar çıxılandan sonra az)
  dmMessages:    25,    // 600 user → ~15 000 mesaj
};

/** Post başına həcm əmsalları. */
const PER_POST = {
  comments:     4.8,    // 4 500 post → ~21 600 şərh
  replies:      1.1,    // şərhlərin ~22%-i cavabdır
  likes:         13,    // 4 500 post → ~58 500 bəyənmə
  bookmarks:    2.6,    // ~11 700 saxlama
  reposts:      0.9,    // ~4 000 repost
};

export const SCALE = {
  users:        USER_COUNT,
  posts:        Math.round(USER_COUNT * PER_USER.posts),
  followsPerUser: [6, Math.round(PER_USER.follows * 2.6)],
  dmMessages:   Math.round(USER_COUNT * PER_USER.dmMessages),
  dmThreads:    Math.round(USER_COUNT * 0.9),
  teams:        Math.max(10, Math.round(USER_COUNT / 10)),      // 600 → 60 komanda
  projectsPerTeam: [1, 4],                                       // 60 komanda → ~150 layihə
  tasksPerProject: [12, 38],                                     // ~150 layihə → ~3 500 task
  learningTasks: Math.max(40, Math.round(USER_COUNT / 5)),        // 600 → 120 çalışma
  submissions:  Math.round(USER_COUNT * 4),                      // 600 → ~2 400 təqdimat
  perPost:      PER_POST,
};

// ═══════════════════════════════════════════════════════════════════════════
// DAVRANIŞ PROFİLLƏRİ (sənəd §7 USER BEHAVIOR MODEL, §2 Pareto paylanma)
// ═══════════════════════════════════════════════════════════════════════════
//
// `share`   — istifadəçi bazasındakı payı
// `weight`  — məzmun yaratma çəkisi (post/şərh seçim hovuzunda neçə dəfə görünür)
// `days`    — 15 gün ərzində neçə gün aktivdir [min, max]
//
// ⚠ `weight` və `share` AYRI ölçülərdir: 5% POWER_USER bazanın 5%-idir, amma
//   postların ~30%-ni yazır. İkisini birləşdirsək ya hamı eyni aktivlikdə
//   olardı, ya da güclü istifadəçilər sayca çoxalıb Pareto pozulardı.
export const PROFILES = {
  POWER_USER:         { share: 0.05, weight: 26, days: [13, 16], group: 'A' },
  ACTIVE_CONTRIBUTOR: { share: 0.10, weight: 14, days: [10, 14], group: 'A' },
  TECHNICAL_USER:     { share: 0.13, weight:  8, days: [ 7, 12], group: 'B' },
  PROJECT_MANAGER:    { share: 0.06, weight:  6, days: [ 8, 13], group: 'B' },
  DESIGNER:           { share: 0.06, weight:  6, days: [ 6, 11], group: 'B' },
  LEARNER:            { share: 0.15, weight:  4, days: [ 5, 10], group: 'C' },
  CASUAL_USER:        { share: 0.15, weight:  2, days: [ 3,  7], group: 'C' },
  READER:             { share: 0.18, weight:  1, days: [ 2,  6], group: 'D' },
  PASSIVE_USER:       { share: 0.12, weight:  0, days: [ 1,  3], group: 'D' },
};

// ═══════════════════════════════════════════════════════════════════════════
// XP — worker/xp.ts GÜZGÜSÜ
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 Bu dəyərlər `worker/xp.ts`-dəki PRD §6 cədvəli ilə EYNİ olmalıdır.
//    Fərqlənsə leaderboard demo mühitində real qaydalardan başqa şey göstərər.
//    `daily` tavanları da oradan götürülüb — generator gündəlik XP-ni həmin
//    tavanla kəsir, əks halda demo XP real sistemin verə bilməyəcəyi dəyərə
//    çıxardı.
export const XP = {
  values: {
    post:          15,   // ORIGINAL_POST_XP — öz məzmunu
    shared_post:   10,   // POST_XP — sitat/paylaşım
    comment:        2,   // COMMENT_XP
    repost:         3,   // REPOST_XP
    like_received:  1,   // LIKE_RECEIVED_XP
    daily_login:    5,   // DAILY_LOGIN_XP
    signup:        50,   // SIGNUP_XP
    solution:      50,   // SOLUTION_XP
    profile_bonus:100,   // PROFILE_BONUS_XP
    team_task:     50,   // USER_TASK_XP
    invite:        50,   // INVITE_XP
    verified:     100,   // VERIFIED_XP
  },
  daily: {
    post:          100,
    comment:        40,
    repost:         30,
    like_received:  50,
    daily_login:     5,
    invite:        100,
  },
  /** Ümumi gündəlik tavan (xp.ts: son müdafiə xətti). */
  dailyTotal: 300,
};

// ═══════════════════════════════════════════════════════════════════════════
// MƏZMUN
// ═══════════════════════════════════════════════════════════════════════════

/** Sənəd §9: mövzu paylanması. Cəm 1.0 olmalıdır. */
export const TOPIC_MIX = {
  programming: 0.20,
  web:         0.15,
  backend:     0.10,
  frontend:    0.10,
  ai:          0.10,
  security:    0.10,
  database:    0.08,
  cloud:       0.07,
  devops:      0.05,
  design:      0.05,
  career:      0.05,
};

/** Sənəd §34: dil paylanması. */
export const LANG_AZ_RATIO = 0.7;

/** Sənəd §6 ENGAGEMENT: post populyarlıq sinifləri. */
export const ENGAGEMENT = [
  { name: 'viral',   share: 0.03, likes: [90, 240], comments: [12, 30] },
  { name: 'popular', share: 0.12, likes: [35,  89], comments: [ 6, 14] },
  { name: 'normal',  share: 0.35, likes: [ 9,  34], comments: [ 2,  7] },
  { name: 'low',     share: 0.35, likes: [ 1,   8], comments: [ 0,  3] },
  { name: 'none',    share: 0.15, likes: [ 0,   1], comments: [ 0,  1] },
];

/**
 * Sənəd §17: task status paylanması.
 *
 * ⚠ Sənəd yalnız dörd sütun sadalayır, lakin Kanban lövhəsi ALTI sütunludur
 *   (`WS_BOARD`). Yalnız dördünü doldursaq `Backlog` və `Testing` sütunları
 *   demo mühitində BOŞ qalardı — məhz qaçmaq istədiyimiz görüntü. Ona görə
 *   sənədin nisbətləri saxlanılır, qalan iki sütuna kiçik pay ayrılır.
 */
export const TASK_STATUS_MIX = [
  { value: 'Backlog',     share: 0.12 },
  { value: 'To Do',       share: 0.20 },
  { value: 'In Progress', share: 0.18 },
  { value: 'Review',      share: 0.10 },
  { value: 'Testing',     share: 0.07 },
  { value: 'Done',        share: 0.30 },
  { value: 'Blocked',     share: 0.02 },
  { value: 'Cancelled',   share: 0.01 },
];

export const TASK_PRIORITIES = [
  { value: 'Low',      share: 0.20 },
  { value: 'Medium',   share: 0.42 },
  { value: 'High',     share: 0.24 },
  { value: 'Urgent',   share: 0.08 },
  { value: 'Critical', share: 0.06 },
];

/** Postun `post_type` dəyərləri — worker/routes/post.ts ilə eyni. */
export const POST_TYPES = { ORIGINAL: 'original', REPOST: 'repost', QUOTE: 'quote' };

/**
 * Reaksiya tipləri — schema CHECK məhdudiyyəti ilə eyni siyahı.
 * ⚠ Siyahıdan kənar dəyər CHECK constraint pozur və sətir SƏSSİZCƏ atılır
 *   (INSERT OR IGNORE), yəni reaksiyalar səbəbsiz azalardı.
 */
export const REACTION_TYPES = ['like', 'love', 'laugh', 'wow', 'fire', 'clap', 'tada', 'hundred', 'rocket'];

/** Bildiriş tipləri — worker/services/notification/taxonomy.ts ilə eyni. */
export const NOTIFICATION_TYPES = [
  'like', 'comment', 'repost', 'mention', 'follow', 'dm',
  'task', 'team_task', 'team_invite', 'team_role', 'team_announcement',
  'team_project', 'verified', 'admin',
];

/** Yüksək prioritetli tiplər — taxonomy.ts PRIORITY_TYPES güzgüsü. */
export const PRIORITY_TYPES = new Set(['mention', 'team_invite', 'team_project_request', 'admin']);

/**
 * Öyrənmə çalışmalarının kateqoriyaları (sənəd §23).
 *
 * ⚠ SƏRBƏST MƏTN DEYİL: `js/drills.js` kateqoriya seçimini
 *   `allCategoryLabels()`-dən (js/taxonomy.js) qurur və `skillCatClass()` rəngi
 *   məhz həmin etiketlərdən tapır. Sənəddəki "Programming / Algorithms / Cloud"
 *   kimi sərbəst adlar yazsaydıq hər çip `cat-other` boz rəngə düşərdi və
 *   ekran demo mühitində sınıq görünərdi. Ona görə taksonomiya etiketləri
 *   işlədilir — bu, həm də real yaratma axını ilə eynidir.
 */
export const LEARNING_CATEGORIES = [
  'Python', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Java', 'Go', 'Rust',
  'PHP', 'Kotlin', 'Swift', 'SQL', 'HTML/CSS', 'Bash', 'Arduino/C',
];

/** Öyrənmə çalışması statusları — worker/routes/task.ts ilə eyni. */
export const LEARNING_STATUSES = ['pending', 'approved', 'rejected'];

/** İş sahəsi task statusları — worker/routes/workspace/index.ts WS_STATUSES. */
export const WS_STATUSES = [
  'Backlog', 'To Do', 'Planning', 'In Progress', 'Review',
  'Testing', 'Done', 'Blocked', 'Cancelled',
];

/** İş sahəsi prioritetləri — WS_PRIORITIES. */
export const WS_PRIORITIES = ['Critical', 'Urgent', 'High', 'Medium', 'Low'];

/**
 * Etiket rəngləri — NİŞAN AÇARI, xam hex YOX.
 * `worker/routes/workspace/sub.ts` siyahıdan kənar dəyəri 'slate'-ə çevirir,
 * yəni hex yazsaq bütün etiketlər eyni boz rəngdə görünərdi.
 */
export const WS_LABEL_COLORS = [
  'slate', 'blue', 'violet', 'green', 'amber', 'rose', 'teal', 'cyan', 'lime', 'orange',
];

/** Sənəd §28: tag hovuzu — populyarlıq çəkisi ilə. */
export const TAGS = [
  { tag: 'javascript', w: 100 }, { tag: 'typescript', w: 92 }, { tag: 'python', w: 88 },
  { tag: 'react', w: 84 }, { tag: 'nodejs', w: 76 }, { tag: 'csharp', w: 62 },
  { tag: 'dotnet', w: 58 }, { tag: 'sql', w: 70 }, { tag: 'database', w: 66 },
  { tag: 'postgresql', w: 54 }, { tag: 'cloud', w: 60 }, { tag: 'cloudflare', w: 44 },
  { tag: 'aws', w: 48 }, { tag: 'docker', w: 56 }, { tag: 'kubernetes', w: 40 },
  { tag: 'devops', w: 46 }, { tag: 'security', w: 64 }, { tag: 'cybersecurity', w: 52 },
  { tag: 'ai', w: 82 }, { tag: 'machinelearning', w: 50 }, { tag: 'llm', w: 42 },
  { tag: 'go', w: 38 }, { tag: 'rust', w: 34 }, { tag: 'java', w: 44 },
  { tag: 'kotlin', w: 24 }, { tag: 'swift', w: 22 }, { tag: 'mobile', w: 36 },
  { tag: 'frontend', w: 72 }, { tag: 'backend', w: 74 }, { tag: 'api', w: 68 },
  { tag: 'testing', w: 40 }, { tag: 'git', w: 42 }, { tag: 'linux', w: 46 },
  { tag: 'performance', w: 38 }, { tag: 'uiux', w: 48 }, { tag: 'career', w: 44 },
  { tag: 'opensource', w: 40 }, { tag: 'azerbaijan', w: 56 }, { tag: 'startup', w: 30 },
  { tag: 'webdev', w: 66 },
];

/** Fayl kateqoriyaları — team_files.category. */
export const FILE_CATEGORIES = ['documents', 'images', 'code', 'archives', 'other'];

/** Şikayət səbəbləri. */
export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'];
