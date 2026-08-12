// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Komanda / layihə / task / fayl məzmunu
// ═══════════════════════════════════════════════════════════════════════════
//
// `data-teams.mjs`-dəki 25 əllə yazılmış komanda saxlanılır; qalanı sahə ×
// forma kombinasiyasından qurulur (SCALE.teams = istifadəçi sayı / 10).
//
// ⚠ İKİ TASK SİSTEMİ VAR VƏ QARIŞDIRILMAMALIDIR:
//     `team_tasks` → komanda iş sahəsi (Kanban, sprint, assignee)  — BU FAYL
//     `tasks`      → öyrənmə çalışmaları (drills)                  — learning.mjs
//   İkisini bir yerə yazsaq iş sahəsi lövhəsi öyrənmə çalışmaları ilə dolar.

import {
  TEAMS as CURATED_TEAMS, PROJECTS_BY_TEAM, TASK_TEMPLATES,
  TASK_DESCRIPTIONS, SPRINT_NAMES, LABELS, CHECKLIST_ITEMS,
} from '../data-teams.mjs';
import { pick, pickN, randInt, chance } from '../rand.mjs';
import { WS_LABEL_COLORS } from '../config.mjs';

const DOMAINS = [
  ['Backend', 'backend servisləri və API dizaynı'],
  ['Frontend', 'istifadəçi interfeysi və komponent arxitekturası'],
  ['Mobil', 'iOS və Android tətbiqləri'],
  ['DevOps', 'CI/CD, monitorinq və infrastruktur'],
  ['Data', 'məlumat boru xətləri və analitika'],
  ['AI', 'maşın öyrənməsi və LLM tətbiqləri'],
  ['Təhlükəsizlik', 'tətbiq təhlükəsizliyi və audit'],
  ['Bulud', 'edge və serverless həllər'],
  ['QA', 'test avtomatlaşdırması və keyfiyyət'],
  ['Dizayn', 'dizayn sistemi və istifadəçi araşdırması'],
  ['Açıq mənbə', 'icma layihələri və töhfələr'],
  ['Təhsil', 'tədris materialları və mentorluq'],
  ['Oyun', 'oyun mexanikası və qrafika'],
  ['Fintech', 'ödəniş və maliyyə həlləri'],
  ['E-ticarət', 'onlayn satış platformaları'],
];

const FORMS = [
  ['Guild', 'peşəkar icma'], ['Lab', 'təcrübə laboratoriyası'],
  ['Studio', 'məhsul studiyası'], ['Collective', 'birgə iş qrupu'],
  ['Crew', 'kiçik komanda'], ['Circle', 'müzakirə dairəsi'],
  ['Squad', 'çevik komanda'], ['Workshop', 'praktiki emalatxana'],
  ['Hub', 'mərkəz'], ['Team', 'komanda'],
];

const PROJECT_KINDS = [
  ['Platform', 'Əsas platforma xidmətləri'],
  ['Dashboard', 'Analitika və idarəetmə paneli'],
  ['API Gateway', 'Xarici inteqrasiyalar üçün giriş qapısı'],
  ['Mobile App', 'Mobil tətbiq'],
  ['Design System', 'Ortaq komponent kitabxanası'],
  ['Migration', 'Köhnə sistemdən köçürmə'],
  ['Monitoring', 'Müşahidəçilik və xəbərdarlıqlar'],
  ['Onboarding Flow', 'Yeni istifadəçi axını'],
  ['Search Service', 'Axtarış və indeksləmə xidməti'],
  ['Billing', 'Ödəniş və abunə idarəsi'],
  ['Docs Portal', 'Sənədləşdirmə portalı'],
  ['Data Pipeline', 'Məlumat emalı boru xətti'],
  ['Auth Service', 'Autentifikasiya və icazə xidməti'],
  ['Notification Hub', 'Bildiriş çatdırılma mərkəzi'],
  ['Admin Console', 'Daxili idarəetmə konsolu'],
];

/** `SCALE.teams` sayda komanda tərifi qaytarır. */
export function buildTeams(count) {
  const out = [];
  const usedSlug = new Set();

  const push = t => {
    let slug = t.slug;
    let n = 2;
    while (usedSlug.has(slug)) slug = `${t.slug}-${n++}`;
    usedSlug.add(slug);
    out.push({ ...t, slug });
  };

  for (const t of CURATED_TEAMS.slice(0, count)) push(t);

  while (out.length < count) {
    const [domain, domainDesc] = pick(DOMAINS);
    const [form, formDesc] = pick(FORMS);
    const name = `${domain} ${form}`;
    const slug = `${domain.toLowerCase().replace(/[^a-z]/g, '')}-${form.toLowerCase()}`;
    push({
      name,
      slug: slug || `team-${out.length}`,
      description: `${domainDesc} üzrə ${formDesc}. Üzvlər təcrübə paylaşır və birgə layihələr aparır.`,
      // ⚠ Açıq/qapalı nisbəti vacibdir: hamısı `Private` olsa komanda kataloqu
      //   giriş etməmiş istifadəçiyə BOŞ görünərdi (görünürlük qapısı).
      visibility: chance(0.62) ? 'Public' : 'Private',
    });
  }
  return out;
}

/** Komandaya uyğun layihə tərifləri. */
export function buildProjects(teamSlug, teamName, count) {
  const curated = PROJECTS_BY_TEAM[teamSlug];
  const out = curated ? [...curated] : [];
  const used = new Set(out.map(p => p.name));

  while (out.length < count) {
    const [kind, desc] = pick(PROJECT_KINDS);
    const name = out.length === 0 ? `${teamName} ${kind}` : kind;
    if (used.has(name)) { out.push({ name: `${name} v${out.length + 1}`, description: desc }); }
    else { used.add(name); out.push({ name, description: desc }); }
  }
  return out.slice(0, count);
}

export function taskTitle() {
  return pick(TASK_TEMPLATES);
}

export function taskDescription() {
  const base = pick(TASK_DESCRIPTIONS);
  if (!chance(0.55)) return base;
  return base + '\n\n' + pick([
    'Qəbul meyarları: dəyişiklik test edilib, sənədləşdirilib və review-dan keçib.',
    'Qeyd: bu task digər taskdan asılıdır, ardıcıllığa diqqət edin.',
    'Ölçmə tələb olunur — əvvəl/sonra müqayisəsi olmadan bağlamayın.',
    'Bu dəyişiklik geriyə uyğun olmalıdır, köhnə klientlər sınmamalıdır.',
    'Edge case-ləri də əhatə edin: boş siyahı, uzun mətn, şəbəkə xətası.',
  ]);
}

export const sprintName = () => pick(SPRINT_NAMES);
export const checklistItems = n => pickN(CHECKLIST_ITEMS, n);

/** Etiketlər — rəng NİŞAN açarıdır (config.WS_LABEL_COLORS izahına bax). */
export function buildLabels() {
  return LABELS.map((l, i) => ({
    name: l.name,
    color: WS_LABEL_COLORS[i % WS_LABEL_COLORS.length],
  }));
}

// ── Fayllar (sənəd §30) ───────────────────────────────────────────────────
//
// ⚠ Fayl MƏZMUNU yaradılmır, yalnız `team_files` metadata sətri: real bayt R2
//   bucket-indədir və seed onu doldura bilmir. Ona görə yollar `demo/` altında
//   saxlanılır — reset onları asanlıqla ayırır və heç bir real obyekt silinmir.

const FILES = [
  ['api-design.pdf', 'application/pdf', 'documents', [180_000, 2_400_000]],
  ['database-schema.png', 'image/png', 'images', [90_000, 800_000]],
  ['project-readme.md', 'text/markdown', 'documents', [1_200, 18_000]],
  ['security-checklist.pdf', 'application/pdf', 'documents', [220_000, 1_100_000]],
  ['sprint-retro.md', 'text/markdown', 'documents', [2_000, 12_000]],
  ['architecture-diagram.png', 'image/png', 'images', [120_000, 1_500_000]],
  ['deploy-runbook.pdf', 'application/pdf', 'documents', [140_000, 900_000]],
  ['onboarding-guide.pdf', 'application/pdf', 'documents', [300_000, 1_800_000]],
  ['migration-plan.md', 'text/markdown', 'documents', [3_000, 22_000]],
  ['ui-mockup.jpg', 'image/jpeg', 'images', [200_000, 3_000_000]],
  ['performance-report.pdf', 'application/pdf', 'documents', [260_000, 1_400_000]],
  ['seed-script.sql', 'application/sql', 'code', [4_000, 60_000]],
  ['analytics.py', 'text/x-python', 'code', [1_500, 30_000]],
  ['ci-pipeline.yml', 'text/yaml', 'code', [800, 6_000]],
  ['component-library.zip', 'application/zip', 'archives', [1_000_000, 18_000_000]],
  ['test-results.json', 'application/json', 'code', [5_000, 120_000]],
  ['brand-assets.zip', 'application/zip', 'archives', [2_000_000, 25_000_000]],
  ['meeting-notes.md', 'text/markdown', 'documents', [1_000, 9_000]],
  ['load-test.js', 'text/javascript', 'code', [2_000, 20_000]],
  ['er-diagram.png', 'image/png', 'images', [80_000, 700_000]],
];

export function makeFile(teamId) {
  const [name, mime, category, [lo, hi]] = pick(FILES);
  return {
    // ⚠ `demo/` prefiksi: reset yalnız bu prefiksli sətirləri silir.
    path: `demo/teams/${teamId}/${randInt(1000, 9999)}-${name}`,
    type: mime,
    size: randInt(lo, hi),
    category,
  };
}

/** Komanda lentində elan mətnləri (`team_posts`). */
const TEAM_POSTS = [
  'Bu sprintdə əsas hədəf performans optimallaşdırmasıdır. Taskları lövhədə paylaşdım.',
  'Yeni üzvlərimizi salamlayırıq! Onboarding sənədi fayllar bölməsindədir.',
  'Retrospektiv qeydləri hazırdır. Növbəti sprintdə iki prosesi dəyişirik.',
  'Layihənin birinci mərhələsi bitdi. Təşəkkür edirəm, komanda əla iş çıxardı.',
  'Kod review qaydalarını yenilədik — hər PR ən azı bir təsdiq tələb edir.',
  'Bu həftə cümə günü demo keçirəcəyik, hazırlıqlarınızı bitirin.',
  'Yeni dizayn sistemi versiyası hazırdır, komponentləri yeniləyin.',
  'Təhlükəsizlik auditi başladı. Tapıntılar üçün ayrıca lövhə açdım.',
  'Sənədləşdirmə borcumuz böyüyür. Hər task üçün qısa qeyd yazaq.',
  'Növbəti sprint planlaması bazar ertəsi saat 10:00-dadır.',
  'CI-da build vaxtını 8 dəqiqədən 3 dəqiqəyə endirdik.',
  'Yeni layihəyə başlayırıq — maraqlananlar yazsın.',
];

export const makeTeamPost = () => pick(TEAM_POSTS);

/**
 * Komanda aktivlik hadisələri (`team_activity.event_type`).
 *
 * ⚠ PascalCase QƏSDƏNDİR: `js/teams.js` → `EVENT_LABELS` xəritəsi məhz bu
 *   açarlardır. snake_case yazsaq etiket tapılmır və client fallback-a düşür —
 *   lentdə tərcümə əvəzinə "member joined" kimi xam mətn görünərdi.
 */
export const TEAM_EVENTS = [
  'TeamCreated', 'TeamUpdated', 'MemberJoined', 'MemberLeft', 'RoleChanged',
  'ProjectCreated', 'ProjectCompleted', 'TaskAssigned', 'TeamTaskCompleted',
  'TeamPostCreated', 'FileUploaded', 'InvitationSent',
];
