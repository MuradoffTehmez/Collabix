// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — İstifadəçi profilləri
// ═══════════════════════════════════════════════════════════════════════════
//
// İki mənbə birləşir:
//   1. `data-users.mjs` — 129 ƏLLƏ yazılmış profil (yüksək keyfiyyətli bio,
//      real görünüşlü bacarıq dəsti). Bunlar demo hesabları və leaderboard-un
//      yuxarı hissəsini doldurur.
//   2. Kombinator generator — qalan sətirlər ad/soyad/peşə/bio hovuzlarından
//      qurulur.
//
// 🔴 NİYƏ KOMBİNATOR: 600 profili əllə yazmaq mümkün deyil, tək şablonu
//    təkrarlamaq isə sənəd §35-i pozur ("məzmun təkrarlanmamalıdır"). Hovuz
//    ölçüləri ad × soyad × peşə × bio-şablon × detal = milyonlarla kombinasiya
//    verir, ona görə 2 500 istifadəçidə (L4) də təkrar olmur.
//
// ⚠ DƏYƏR FORMATLARI KLİENTLƏ BAĞLIDIR:
//     gender     → 'Kişi' | 'Qadın'         (js/profile.js düymələri)
//     lookingFor → 'Study partner' | 'Mentor' | 'Layihə komandası'
//     progLevels açarları → js/taxonomy.js DEFAULT_PROG etiketləri
//     səviyyələr → 'Başlanğıc' | 'Orta' | 'Qabaqcıl'
//   Bu siyahılardan kənar dəyər profil redaktorunda SEÇİLMƏMİŞ görünür və
//   istifadəçi məlumatını "itirmiş" kimi qavrayır.

import { USERS as CURATED } from '../data-users.mjs';
import { PROFILES, USER_COUNT, DEMO_PREFIX } from '../config.mjs';
import { pick, pickN, randInt, chance, shuffle, weightedKey } from '../rand.mjs';

export const GENDERS = { k: 'Kişi', q: 'Qadın' };
export const SKILL_LEVELS = ['Başlanğıc', 'Orta', 'Qabaqcıl'];
export const LOOKING_FOR = ['Study partner', 'Mentor', 'Layihə komandası'];
export const PROG_LABELS = [
  'Python', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Java', 'Go', 'Rust',
  'PHP', 'Kotlin', 'Swift', 'SQL', 'HTML/CSS', 'Bash', 'Arduino/C',
];
export const SPOKEN_LABELS = ['İngilis', 'Alman', 'Rus', 'Fransız', 'İspan', 'Ərəb', 'Türk', 'Çin'];

// ── Ad hovuzları (sintetik — real şəxslərə istinad etmir) ──────────────────

const AZ_MALE = [
  'Turan', 'Elvin', 'Kamran', 'Murad', 'Orxan', 'Anar', 'Rəşad', 'Nicat', 'Elçin',
  'Fərid', 'Samir', 'Tural', 'Ramil', 'Vüqar', 'Cavid', 'Emin', 'Ceyhun', 'Nurlan',
  'Şahin', 'Rüfət', 'Toğrul', 'Zaur', 'İlkin', 'Kənan', 'Rauf', 'Aydın', 'Bəhruz',
  'Nihad', 'Səbuhi', 'Ülvi', 'Rövşən', 'Xəyal', 'Yusif', 'Mahir', 'Elmar', 'Vüsal',
  'Rəvan', 'Səfər', 'Uğur', 'Əli', 'Ramin', 'Elşən', 'Cəlal', 'Fuad', 'Qurban',
  'Bəxtiyar', 'Ruslan', 'Tərlan', 'Etibar', 'Zeynal', 'Xaqan', 'Sənan', 'Rəşid',
];

const AZ_FEMALE = [
  'Nigar', 'Aysel', 'Leyla', 'Zəhra', 'Nərmin', 'Sara', 'Ayla', 'Günel', 'Aygün',
  'Şəbnəm', 'Lalə', 'Mələk', 'Ülkər', 'Fidan', 'Aynur', 'Gülnar', 'Sevinc', 'Nərgiz',
  'Ilahə', 'Xədicə', 'Röya', 'Səbinə', 'Türkan', 'Nurana', 'Aytac', 'Gülşən',
  'Aygül', 'Zeynəb', 'Mətanət', 'Vüsalə', 'Rəna', 'Dilarə', 'Maya', 'Nailə',
  'Şəfa', 'Könül', 'Aynurə', 'Xatirə', 'Sevil', 'Aidə', 'Solmaz', 'Pərvanə',
  'Aysu', 'Günay', 'Ləman', 'Nazrin', 'Sədaqət', 'Firuzə', 'Mehriban', 'Ayan',
];

const AZ_SURNAME = [
  'Məmmədov', 'Əliyev', 'Hüseynov', 'Həsənov', 'Quliyev', 'İsmayılov', 'Rəhimli',
  'Əsgərov', 'Abbasov', 'Nəbiyev', 'Süleymanov', 'Kərimov', 'Bağırov', 'Cəfərov',
  'Vəliyev', 'Sadıqov', 'Nəsirov', 'Mustafayev', 'Rzayev', 'Tağıyev', 'Şirinov',
  'Xəlilov', 'Ağayev', 'Babayev', 'Zeynalov', 'Yusifov', 'Salmanov', 'Muradov',
  'Orucov', 'Novruzov', 'Şükürov', 'Bayramov', 'Qasımov', 'Nərimanov', 'Əhmədov',
  'Seyidov', 'Paşayev', 'Dadaşov', 'Fərzəliyev', 'Məhərrəmov', 'Nəcəfov',
  'Hacıyev', 'Alışov', 'Camalov', 'Sarıyev', 'Teymurov', 'İbrahimov', 'Osmanov',
  'Qurbanov', 'Ramazanov', 'Səfərov', 'Vəkilov', 'Zamanov', 'Xanlarov',
];

const INTL = [
  ['Marek', 'Kowalczyk', 'Polşa', 'Kraków', 'k'], ['Elena', 'Petrova', 'Ukrayna', 'Lviv', 'q'],
  ['Tomasz', 'Nowicki', 'Polşa', 'Varşava', 'k'], ['Ana', 'Beridze', 'Gürcüstan', 'Tbilisi', 'q'],
  ['Giorgi', 'Kapanadze', 'Gürcüstan', 'Batumi', 'k'], ['Mehmet', 'Yıldırım', 'Türkiyə', 'İstanbul', 'k'],
  ['Zeynep', 'Karaca', 'Türkiyə', 'Ankara', 'q'], ['Lucas', 'Ferreira', 'Braziliya', 'São Paulo', 'k'],
  ['Camila', 'Rocha', 'Braziliya', 'Rio de Janeiro', 'q'], ['Kenji', 'Watanabe', 'Yaponiya', 'Tokio', 'k'],
  ['Yuki', 'Morimoto', 'Yaponiya', 'Osaka', 'q'], ['Lukas', 'Brandt', 'Almaniya', 'Berlin', 'k'],
  ['Anja', 'Keller', 'Almaniya', 'Münhen', 'q'], ['Daniel', 'Whitaker', 'ABŞ', 'Austin', 'k'],
  ['Megan', 'Hollis', 'ABŞ', 'Seattle', 'q'], ['Wei', 'Zhang', 'Çin', 'Şençjen', 'k'],
  ['Li', 'Chen', 'Çin', 'Şanxay', 'q'], ['Oleh', 'Tkachenko', 'Ukrayna', 'Kiyev', 'k'],
  ['Sofia', 'Marchetti', 'İtaliya', 'Milan', 'q'], ['Andrei', 'Popescu', 'Rumıniya', 'Buxarest', 'k'],
  ['Ines', 'Duarte', 'Portuqaliya', 'Lissabon', 'q'], ['Bilal', 'Rahman', 'Pakistan', 'Lahor', 'k'],
  ['Priya', 'Nair', 'Hindistan', 'Banqalor', 'q'], ['Arjun', 'Kapoor', 'Hindistan', 'Puna', 'k'],
];

const AZ_CITIES = [
  ['Bakı', 62], ['Gəncə', 8], ['Sumqayıt', 7], ['Şəki', 3], ['Mingəçevir', 3],
  ['Lənkəran', 3], ['Quba', 2], ['Şirvan', 2], ['Naxçıvan', 3], ['Xaçmaz', 2],
  ['Şamaxı', 2], ['Qəbələ', 2], ['Zaqatala', 1],
];

// ── Peşə → profil xəritəsi ────────────────────────────────────────────────
//
// ⚠ Peşə DAVRANIŞI müəyyən edir (sənəd §33): developer texniki post yazır,
//   dizayner UI/UX müzakirəsi açır, tələbə sual verir. Ona görə peşə təsadüfi
//   seçilmir — davranış profilindən TÖRƏYİR.

const PROFESSIONS = {
  POWER_USER: [
    ['Senior Backend Engineer', 'backend'], ['Staff Software Engineer', 'programming'],
    ['Principal Engineer', 'programming'], ['Tech Lead', 'backend'],
    ['Full-stack Developer', 'web'], ['Software Architect', 'programming'],
  ],
  ACTIVE_CONTRIBUTOR: [
    ['Backend Developer', 'backend'], ['Frontend Developer', 'frontend'],
    ['Full-stack Developer', 'web'], ['Platform Engineer', 'cloud'],
    ['DevOps Engineer', 'devops'], ['Site Reliability Engineer', 'devops'],
  ],
  TECHNICAL_USER: [
    ['.NET Developer', 'backend'], ['Java Developer', 'backend'],
    ['Python Developer', 'programming'], ['Go Developer', 'backend'],
    ['Mobile Developer', 'programming'], ['Database Engineer', 'database'],
    ['Data Engineer', 'database'], ['ML Engineer', 'ai'],
    ['Security Engineer', 'security'], ['QA Automation Engineer', 'programming'],
    ['Cloud Engineer', 'cloud'], ['Systems Programmer', 'programming'],
  ],
  PROJECT_MANAGER: [
    ['Product Manager', 'career'], ['Project Manager', 'career'],
    ['Engineering Manager', 'career'], ['Scrum Master', 'career'],
    ['Product Owner', 'career'],
  ],
  DESIGNER: [
    ['UI/UX Designer', 'design'], ['Product Designer', 'design'],
    ['UX Researcher', 'design'], ['Design Systems Lead', 'design'],
    ['Motion Designer', 'design'],
  ],
  LEARNER: [
    ['Junior Frontend Developer', 'frontend'], ['Junior Backend Developer', 'backend'],
    ['Kompüter elmləri tələbəsi', 'programming'], ['Bootcamp iştirakçısı', 'web'],
    ['Junior QA Engineer', 'programming'], ['İT tələbəsi', 'programming'],
    ['Data Analitika tələbəsi', 'ai'],
  ],
  CASUAL_USER: [
    ['Freelance Developer', 'web'], ['IT Support Specialist', 'devops'],
    ['Technical Writer', 'career'], ['Business Analyst', 'career'],
    ['No-code Developer', 'web'],
  ],
  READER: [
    ['Frontend Developer', 'frontend'], ['Backend Developer', 'backend'],
    ['Sistem inzibatçısı', 'devops'], ['Məlumat analitiki', 'database'],
    ['Tələbə', 'programming'],
  ],
  PASSIVE_USER: [
    ['Developer', 'programming'], ['Tələbə', 'programming'],
    ['İT mütəxəssisi', 'devops'], ['Dizayner', 'design'],
  ],
};

// ── Bio mühərriki ─────────────────────────────────────────────────────────
//
// Şablon × fokus × detal → hər peşə üçün minlərlə fərqli bio.

const BIO_AZ = [
  '{prof}. {focus} üzərində işləyirəm. {detail}',
  '{prof} — əsas maraq sahəm {focus}. {detail}',
  '{focus} ilə məşğulam. {detail}',
  '{prof}. Son vaxtlar {focus} öyrənirəm, {detail}',
  '{prof}. {detail} {focus} mövzusunda müzakirələri sevirəm.',
  '{focus} sahəsində {years} illik təcrübə. {detail}',
];

const BIO_EN = [
  '{prof} focused on {focusEn}. {detailEn}',
  '{prof}. Working with {focusEn} day to day. {detailEn}',
  'Building things with {focusEn}. {detailEn}',
  '{prof} — {years} years around {focusEn}. {detailEn}',
];

const FOCUS = {
  backend: [
    ['paylanmış sistemlər və API arxitekturası', 'distributed systems and API design'],
    ['mikroservis arxitekturası', 'microservice architecture'],
    ['yüksək yüklü backend servisləri', 'high-throughput backend services'],
    ['event-driven arxitektura', 'event-driven architecture'],
    ['REST və gRPC API dizaynı', 'REST and gRPC API design'],
  ],
  frontend: [
    ['komponent arxitekturası və dizayn sistemləri', 'component architecture and design systems'],
    ['React performans optimallaşdırması', 'React performance optimisation'],
    ['əlçatanlıq (a11y) və semantik HTML', 'accessibility and semantic HTML'],
    ['state management naxışları', 'state management patterns'],
  ],
  web: [
    ['tam yığın veb tətbiqləri', 'full-stack web applications'],
    ['SSR və edge rendering', 'SSR and edge rendering'],
    ['veb performansı və Core Web Vitals', 'web performance and Core Web Vitals'],
  ],
  programming: [
    ['təmiz kod və test mədəniyyəti', 'clean code and testing culture'],
    ['alqoritmlər və məlumat strukturları', 'algorithms and data structures'],
    ['funksional proqramlaşdırma', 'functional programming'],
    ['kod keyfiyyəti və refaktorinq', 'code quality and refactoring'],
  ],
  database: [
    ['sorğu optimallaşdırması və indeksləmə', 'query optimisation and indexing'],
    ['məlumat modelləşdirməsi', 'data modelling'],
    ['analitik anbarlar', 'analytical warehouses'],
  ],
  cloud: [
    ['edge computing və serverless', 'edge computing and serverless'],
    ['infrastruktur kodu (IaC)', 'infrastructure as code'],
    ['multi-region deploy strategiyaları', 'multi-region deployment strategies'],
  ],
  devops: [
    ['CI/CD boru xətləri', 'CI/CD pipelines'],
    ['müşahidəçilik və monitorinq', 'observability and monitoring'],
    ['konteynerləşdirmə və orkestrasiya', 'containerisation and orchestration'],
  ],
  security: [
    ['tətbiq təhlükəsizliyi', 'application security'],
    ['nüfuzetmə testləri', 'penetration testing'],
    ['təhlükəsiz autentifikasiya axınları', 'secure authentication flows'],
    ['təhdid modelləşdirməsi', 'threat modelling'],
  ],
  ai: [
    ['maşın öyrənməsi modellərinin istehsala çıxarılması', 'shipping ML models to production'],
    ['LLM tətbiqləri və RAG', 'LLM applications and RAG'],
    ['məlumat boru xətləri', 'data pipelines'],
  ],
  design: [
    ['istifadəçi araşdırması və prototipləmə', 'user research and prototyping'],
    ['dizayn sistemləri', 'design systems'],
    ['əlçatan interfeys dizaynı', 'accessible interface design'],
  ],
  career: [
    ['komanda prosesləri və planlaşdırma', 'team process and planning'],
    ['məhsul kəşfi', 'product discovery'],
    ['texniki komandaların idarəsi', 'engineering management'],
  ],
};

const DETAIL_AZ = [
  'Açıq mənbə layihələrinə töhfə verməyi sevirəm.',
  'Yeni texnologiyaları kiçik pet-project-lərdə sınayıram.',
  'Bilik paylaşmaq və mentorluq mənim üçün vacibdir.',
  'Yaxşı sənədləşdirməyə inanıram.',
  'Kod review-larda ətraflı rəy yazmağa çalışıram.',
  'Konfranslarda çıxış etməyi planlaşdırıram.',
  'Həftəsonu blog yazıram.',
  'Komanda ilə işləməyi tək işləməkdən üstün tuturam.',
  'Sadə həllər mürəkkəb həllərdən yaxşıdır.',
  'Ölçmədən optimallaşdırmıram.',
  'Yerli tech icmasında aktivəm.',
  'Junior-lara kömək etməyə vaxt ayırıram.',
];

const DETAIL_EN = [
  'Open source contributor.',
  'Always experimenting with side projects.',
  'I care a lot about documentation.',
  'Mentoring juniors whenever I can.',
  'Big believer in measuring before optimising.',
  'I write about what I learn.',
  'Remote-first, async by default.',
  'Simple solutions beat clever ones.',
];

const GOALS = [
  'Bu il açıq mənbə layihəyə mütəmadi töhfə vermək.',
  'Komanda ilə real məhsul çıxarmaq.',
  'Sistem dizaynı üzrə dərinləşmək.',
  'İlk texniki məqaləmi yazmaq.',
  'Sertifikasiya imtahanını vermək.',
  'Mentor tapmaq və mentorluq etmək.',
  '',
  '',
];

const STATUSES = [
  'İş axtarıram', 'Açıq mənbəyə töhfə verirəm', 'Yeni layihəyə açığam',
  'Mentorluq edirəm', 'Öyrənirəm', '', '', '', '',
];

const COMPANIES = [
  'Freelance', 'Startup', 'Fintech şirkəti', 'Telekom operatoru', 'Bank',
  'E-ticarət platforması', 'Outsourcing şirkəti', 'Universitet', '', '', '',
];

// ═══════════════════════════════════════════════════════════════════════════

/** `share` paylarına görə profil adlarının siyahısını qurur. */
function buildProfileSlots(total) {
  const slots = [];
  for (const [name, cfg] of Object.entries(PROFILES)) {
    const n = Math.round(total * cfg.share);
    for (let i = 0; i < n; i++) slots.push(name);
  }
  // Yuvarlaqlaşdırma fərqini ən böyük qrupla düzəlt.
  while (slots.length < total) slots.push('READER');
  while (slots.length > total) slots.pop();
  return shuffle(slots);
}

/** ASCII-yə yaxınlaşdırılmış username hissəsi. */
function slugify(s) {
  return s.toLowerCase()
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/İ/g, 'i')
    .replace(/[^a-z0-9]/g, '');
}

function makeSkills(topic, seniority) {
  const CORE = {
    backend: ['C#', 'Java', 'Go', 'Python', 'SQL'],
    frontend: ['JavaScript', 'TypeScript', 'HTML/CSS'],
    web: ['JavaScript', 'TypeScript', 'HTML/CSS', 'SQL'],
    programming: ['Python', 'C++', 'JavaScript', 'Java'],
    database: ['SQL', 'Python'],
    cloud: ['Go', 'Python', 'Bash'],
    devops: ['Bash', 'Go', 'Python'],
    security: ['Python', 'Bash', 'C++'],
    ai: ['Python', 'SQL'],
    design: ['HTML/CSS', 'JavaScript'],
    career: ['SQL'],
  }[topic] || ['JavaScript'];

  const out = {};
  const primary = pickN(CORE, randInt(1, Math.min(3, CORE.length)));
  for (const p of primary) {
    out[p] = seniority === 'senior' ? pick(['Orta', 'Qabaqcıl', 'Qabaqcıl'])
      : seniority === 'mid' ? pick(['Başlanğıc', 'Orta', 'Orta', 'Qabaqcıl'])
        : pick(['Başlanğıc', 'Başlanğıc', 'Orta']);
  }
  // Əlavə təsadüfi bacarıq — profil bir sahəyə kilidlənməsin.
  if (chance(0.5)) {
    const extra = pick(PROG_LABELS.filter(x => !out[x]));
    out[extra] = pick(['Başlanğıc', 'Orta']);
  }
  return out;
}

function makeLangs(intl) {
  const out = { 'İngilis': pick(['Orta', 'Qabaqcıl', 'Qabaqcıl']) };
  if (chance(0.35)) out['Rus'] = pick(SKILL_LEVELS);
  if (chance(0.18)) out['Türk'] = pick(['Orta', 'Qabaqcıl']);
  if (intl && chance(0.3)) out[pick(['Alman', 'Fransız', 'İspan', 'Çin'])] = pick(SKILL_LEVELS);
  return out;
}

/** Bacarıq meta (miqrasiya 0052 — `users.skill_meta`). */
function makeSkillMeta(progLevels, age) {
  const meta = {};
  const maxYears = Math.max(1, Math.min(15, age - 18));
  for (const skill of Object.keys(progLevels)) {
    if (!chance(0.55)) continue;
    const lvl = progLevels[skill];
    const years = lvl === 'Qabaqcıl' ? randInt(3, maxYears)
      : lvl === 'Orta' ? randInt(2, Math.max(2, Math.min(6, maxYears)))
        : randInt(1, 2);
    meta[skill] = { years };
    if (chance(0.2)) meta[skill].cert = pick([
      'Coursera', 'Udemy', 'Microsoft', 'AWS', 'Google Cloud', 'Cisco', 'Oracle',
    ]);
  }
  return meta;
}

function buildBio(profession, topic, years, intlUser) {
  const focusPair = pick(FOCUS[topic] || FOCUS.programming);
  const useEn = intlUser ? chance(0.75) : chance(0.22);
  if (useEn) {
    return pick(BIO_EN)
      .replace('{prof}', profession)
      .replace('{focusEn}', focusPair[1])
      .replace('{detailEn}', pick(DETAIL_EN))
      .replace('{years}', String(years));
  }
  return pick(BIO_AZ)
    .replace('{prof}', profession)
    .replace('{focus}', focusPair[0])
    .replace('{detail}', pick(DETAIL_AZ))
    .replace('{years}', String(years));
}

/**
 * `USER_COUNT` sayda profil qaytarır.
 *
 * Qaytarılan obyekt sxem sütunlarına DEYİL, məntiqi sahələrə görə adlanır —
 * SQL-ə çevirmə `generate.mjs`-dədir. Belə olanda sxem dəyişəndə düzəliş bir
 * yerdədir.
 */
export function buildPeople() {
  const slots = buildProfileSlots(USER_COUNT);
  const used = new Set();
  const people = [];

  /*
   * Unikal username — toqquşmada rəqəm əlavə olunur.
   *
   * ⚠ UZUNLUQ HƏDDİ MƏHSULDAN GƏLİR: `worker/util.ts → validUsername` yalnız
   *   3–20 simvola icazə verir. Generator `demo_` prefiksi ilə birlikdə 23
   *   simvolluq adlar yaradırdı — belə hesab real qeydiyyat axını ilə HEÇ VAXT
   *   yarana bilməzdi, yəni demo data məhsulun öz qaydasını pozurdu.
   *   Prefiks 5 simvoldur, ona görə əsas hissə ən çox 15 ola bilər.
   */
  const MAX = 20 - DEMO_PREFIX.length;
  const uniq = base => {
    let u = base.slice(0, MAX);
    let n = 2;
    while (used.has(u)) {
      const suffix = String(n++);
      u = base.slice(0, MAX - suffix.length) + suffix;
    }
    used.add(u);
    return u;
  };

  // ── 1. Əllə yazılmış profillər ──────────────────────────────────────────
  // Bunlar siyahının BAŞINDA gəlir ki, ən aktiv profillər (POWER_USER) onlara
  // düşsün — leaderboard-un yuxarısı ən keyfiyyətli bio-larla dolsun.
  const curatedOrder = [...CURATED].sort((a, b) => a.group.localeCompare(b.group));

  for (let i = 0; i < Math.min(curatedOrder.length, USER_COUNT); i++) {
    const c = curatedOrder[i];
    const profile = slots[i];
    const topic = (PROFESSIONS[profile].find(p => p[0] === c.profession) || pick(PROFESSIONS[profile]))[1];
    people.push({
      username: uniq(slugify(c.username) || slugify(c.name)),
      handle: c.username,
      name: c.name,
      bio: c.bio,
      profession: c.profession,
      country: c.country,
      city: c.city,
      gender: GENDERS[c.gender] || '',
      age: c.age,
      profile,
      topic,
      progLevels: Object.keys(c.progLevels).length ? c.progLevels : makeSkills(topic, 'mid'),
      langLevels: Object.keys(c.langLevels).length ? c.langLevels : makeLangs(false),
      // ⚠ Mənbə korpusda 'Əməkdaşlıq', 'Mentorluq' kimi dəyərlər var; klient
      //   yalnız üç dəyəri tanıyır, ona görə normalizasiya edilir.
      lookingFor: pickN(LOOKING_FOR, randInt(0, 2)),
      github: c.github || (chance(0.4) ? slugify(c.username) : ''),
      linkedin: c.linkedin || '',
      curated: true,
    });
  }

  // ── 2. Generasiya edilən profillər ──────────────────────────────────────
  for (let i = people.length; i < USER_COUNT; i++) {
    const profile = slots[i];
    const [profession, topic] = pick(PROFESSIONS[profile]);
    const intlUser = chance(0.18);

    let first, last, country, city, genderKey;
    if (intlUser) {
      const p = pick(INTL);
      [first, last, country, city, genderKey] = p;
    } else {
      genderKey = chance(0.62) ? 'k' : 'q';
      first = pick(genderKey === 'k' ? AZ_MALE : AZ_FEMALE);
      last = pick(AZ_SURNAME);
      if (genderKey === 'q') last += 'a';           // Azərbaycan soyad forması
      country = 'Azərbaycan';
      city = weightedKey(Object.fromEntries(AZ_CITIES));
    }

    const age = profile === 'LEARNER' ? randInt(18, 25)
      : profile === 'POWER_USER' ? randInt(26, 42)
        : randInt(20, 45);
    const years = Math.max(1, Math.min(age - 18, randInt(1, 12)));
    const seniority = age >= 30 ? 'senior' : age >= 24 ? 'mid' : 'junior';

    const fs = slugify(first);
    const ls = slugify(last);
    const handleStyle = randInt(1, 6);
    const base =
      handleStyle === 1 ? `${fs}.${ls}` :
        handleStyle === 2 ? `${fs}.${slugify(topic)}` :
          handleStyle === 3 ? `${fs}${ls}` :
            handleStyle === 4 ? `${fs}.${pick(['dev', 'codes', 'ui', 'sec', 'cloud', 'data', 'js', 'py'])}` :
              handleStyle === 5 ? `${fs}_${ls.slice(0, 4)}` :
                `${fs}${randInt(11, 99)}`;

    const progLevels = makeSkills(topic, seniority);

    people.push({
      username: uniq(base),
      handle: base,
      name: `${first} ${last}`,
      bio: buildBio(profession, topic, years, intlUser),
      profession,
      country,
      city,
      gender: GENDERS[genderKey],
      age,
      profile,
      topic,
      progLevels,
      langLevels: makeLangs(intlUser),
      lookingFor: pickN(LOOKING_FOR, randInt(0, 2)),
      github: chance(0.45) ? `${fs}${ls}`.slice(0, 24) : '',
      linkedin: chance(0.3) ? `${fs}-${ls}`.slice(0, 30) : '',
      curated: false,
    });
  }

  // ── 3. Ortaq sahələr ────────────────────────────────────────────────────
  for (const p of people) {
    p.skillMeta = makeSkillMeta(p.progLevels, p.age);
    p.goals = pick(GOALS);
    p.status = pick(STATUSES);
    p.company = pick(COMPANIES);
    p.website = chance(0.12) ? `https://${slugify(p.handle)}.dev` : '';
    p.telegram = chance(0.25) ? slugify(p.handle) : '';
    p.behaviour = PROFILES[p.profile];
  }

  return people;
}
