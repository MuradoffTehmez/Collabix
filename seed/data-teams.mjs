// Collabix Demo Seed — Team, Project, Task data
// 25 komanda, 50+ layihə, 350+ tapşırıq

import { pick, randInt } from './rand.mjs';

/** @type {Array<{name: string, slug: string, description: string, visibility: string}>} */
export const TEAMS = [
  { name: 'Frontend Guild', slug: 'frontend-guild', description: 'React, Vue, Svelte — frontend texnologiyaları müzakirəsi və əməkdaşlıq.', visibility: 'Public' },
  { name: 'Backend Masters', slug: 'backend-masters', description: 'API dizaynı, database, microservices — backend developer-lər üçün.', visibility: 'Public' },
  { name: 'AI & ML Lab', slug: 'ai-ml-lab', description: 'Süni intellekt, machine learning, deep learning araşdırmaları.', visibility: 'Public' },
  { name: 'DevOps Pipeline', slug: 'devops-pipeline', description: 'CI/CD, Docker, Kubernetes, Infrastructure as Code.', visibility: 'Public' },
  { name: 'Cybersecurity Team', slug: 'cybersecurity-team', description: 'Təhlükəsizlik araşdırmaları, penetration testing, OWASP.', visibility: 'Public' },
  { name: 'Mobile Dev', slug: 'mobile-dev', description: 'Flutter, Swift, Kotlin — mobil tətbiq inkişafı.', visibility: 'Public' },
  { name: 'Open Source AZ', slug: 'open-source-az', description: 'Azərbaycan open source layihələri. Gəlin birlikdə quraq!', visibility: 'Public' },
  { name: 'Python Club', slug: 'python-club', description: 'Python proqramlaşdırma: web, data science, automation.', visibility: 'Public' },
  { name: 'Design System', slug: 'design-system', description: 'UI/UX dizayn, komponent kitabxanaları, Figma.', visibility: 'Public' },
  { name: 'Cloud Native', slug: 'cloud-native', description: 'AWS, Azure, GCP, Cloudflare — cloud texnologiyaları.', visibility: 'Public' },
  { name: 'GameDev Studio', slug: 'gamedev-studio', description: 'Oyun inkişafı: Unity, Unreal Engine, oyun dizaynı.', visibility: 'Public' },
  { name: 'Data Engineering', slug: 'data-engineering', description: 'ETL, data pipelines, Apache Spark, Airflow.', visibility: 'Public' },
  { name: 'Code Review Club', slug: 'code-review-club', description: 'Bir-birimizin kodunu nəzərdən keçirək. Öyrənmək üçün ən yaxşı yol!', visibility: 'Public' },
  { name: 'Rust Enthusiasts', slug: 'rust-enthusiasts', description: 'Rust proqramlaşdırma dili həvəskarları.', visibility: 'Public' },
  { name: 'Java Developers', slug: 'java-developers', description: 'Spring Boot, microservices, enterprise Java.', visibility: 'Public' },
  { name: 'Tech Interview Prep', slug: 'tech-interview-prep', description: 'Texniki müsahibəyə hazırlıq: DSA, System Design, Behavioral.', visibility: 'Public' },
  { name: 'Web3 Explorers', slug: 'web3-explorers', description: 'Blockchain, smart contracts, dApps.', visibility: 'Public' },
  { name: 'Linux Users', slug: 'linux-users', description: 'Linux əməliyyat sistemi, shell scripting, system administration.', visibility: 'Public' },
  { name: '.NET Community', slug: 'dotnet-community', description: 'C#, ASP.NET Core, Blazor, MAUI.', visibility: 'Public' },
  { name: 'Startup Lab', slug: 'startup-lab', description: 'Tech startup qurmaq istəyənlər üçün: ideadan məhsula.', visibility: 'Private' },
  { name: 'QA Engineers', slug: 'qa-engineers', description: 'Test automation, QA metodologiyaları, testing tools.', visibility: 'Public' },
  { name: 'TypeScript World', slug: 'typescript-world', description: 'TypeScript: type safety, advanced patterns, framework integration.', visibility: 'Public' },
  { name: 'Database Admins', slug: 'database-admins', description: 'PostgreSQL, MySQL, Redis, MongoDB — database administration.', visibility: 'Public' },
  { name: 'IoT Makers', slug: 'iot-makers', description: 'Internet of Things: Arduino, Raspberry Pi, sensor networks.', visibility: 'Public' },
  { name: 'AZ Education', slug: 'az-education', description: 'Azərbaycanda texniki təhsil və öyrənmə resursları.', visibility: 'Public' },
];

/** Hər komanda üçün layihələr */
export const PROJECTS_BY_TEAM = {
  'frontend-guild': [
    { name: 'Component Library', description: 'Shared UI component kitabxanası' },
    { name: 'Performance Toolkit', description: 'Frontend performance ölçmə alətləri' },
  ],
  'backend-masters': [
    { name: 'API Gateway', description: 'Unified API gateway layihəsi' },
    { name: 'Auth Service', description: 'Authentication & Authorization servisi' },
    { name: 'Notification Engine', description: 'Push, email, SMS notification sistemi' },
  ],
  'ai-ml-lab': [
    { name: 'NLP Pipeline', description: 'Natural Language Processing pipeline' },
    { name: 'Image Classifier', description: 'CNN-based image classification' },
  ],
  'devops-pipeline': [
    { name: 'CI/CD Templates', description: 'Reusable CI/CD pipeline şablonları' },
    { name: 'Monitoring Stack', description: 'Prometheus + Grafana monitoring' },
    { name: 'IaC Library', description: 'Terraform modul kitabxanası' },
  ],
  'cybersecurity-team': [
    { name: 'Vulnerability Scanner', description: 'Avtomatik zəiflik skaneri' },
    { name: 'Security Audit Tool', description: 'Kod təhlükəsizliyi audit aləti' },
  ],
  'mobile-dev': [
    { name: 'Flutter Starter', description: 'Flutter project boilerplate' },
    { name: 'Mobile CI', description: 'Mobile app CI/CD pipeline' },
  ],
  'open-source-az': [
    { name: 'AZ Locale Pack', description: 'Azərbaycan dili lokalizasiya paketi' },
    { name: 'Collabix Plugins', description: 'Community plugin-ləri' },
  ],
  'python-club': [
    { name: 'Web Scraper', description: 'Çox funksiyalı web scraping aləti' },
    { name: 'Data Pipeline', description: 'ETL pipeline boilerplate' },
  ],
  'design-system': [
    { name: 'Token System', description: 'Design token management' },
    { name: 'Icon Library', description: 'SVG icon kitabxanası' },
  ],
  'cloud-native': [
    { name: 'K8s Operator', description: 'Custom Kubernetes operator' },
    { name: 'Serverless Framework', description: 'Multi-cloud serverless framework' },
  ],
};

/** Task şablonları (hər layihə üçün təsadüfi seçiləcək) */
export const TASK_TEMPLATES = [
  // Frontend
  'Responsive navbar komponenti yarat', 'Dark mode toggle əlavə et',
  'Form validation əlavə et', 'Loading skeleton implementasiya et',
  'Modal komponenti refactor et', 'Search bar əlavə et',
  'Pagination komponenti yarat', 'Accessibility audit keçir',
  'Bundle size optimallaşdır', 'Unit testlər yaz',
  'Storybook story-ləri yarat', 'Error boundary əlavə et',
  // Backend
  'REST API endpoint yarat', 'Rate limiting əlavə et',
  'JWT authentication implementasiya et', 'Database migration yaz',
  'Caching layer əlavə et', 'Logging middleware yarat',
  'Input validation əlavə et', 'API documentation yaz',
  'WebSocket support əlavə et', 'Background job processor yarat',
  'Health check endpoint əlavə et', 'CORS configuration yenilə',
  // DevOps
  'Docker image optimallaşdır', 'GitHub Actions workflow yarat',
  'Staging environment qur', 'SSL certificate yenilə',
  'Monitoring alertləri konfiqurasiya et', 'Backup strategiyası hazırla',
  'Load balancer konfiqurasiya et', 'Log aggregation qur',
  // General
  'README.md yenilə', 'Code review keçir', 'Bug investigation',
  'Performance profiling', 'Security audit', 'Dependencies yenilə',
  'Technical debt azalt', 'Documentation yaz', 'Spike: yeni texnologiya araşdır',
  'User feedback əsasında dəyişiklik', 'Integration test yaz',
  'Database index optimallaşdır', 'API response format standardlaşdır',
  'Error handling yaxşılaşdır', 'Refactoring: DRY prinsipini tətbiq et',
];

/** Task descriptions */
export const TASK_DESCRIPTIONS = [
  'Bu task üçün ətraflı araşdırma aparılmalıdır.',
  'Müvafiq test-lər yazılmalıdır.',
  'PR-ə screenshots əlavə edilməlidir.',
  'Mövcud funksionallığa təsir etməməlidir.',
  'Performance benchmark-ları paylaşılmalıdır.',
  'Accessibility standartlarına uyğun olmalıdır.',
  'Sənədləşdirmə yenilənməlidir.',
  'Edge case-lər nəzərə alınmalıdır.',
  'Code review-dən keçməlidir.',
  'Staging-də test edilməlidir.',
  '',
  '',
  '',
];

/** Sprint adları */
export const SPRINT_NAMES = [
  'Sprint 1 — Foundation', 'Sprint 2 — Core Features',
  'Sprint 3 — Integration', 'Sprint 4 — Polish',
  'Sprint 5 — Beta', 'Sprint 6 — Launch Prep',
];

/** Label-lər (hər komanda üçün yaradılacaq) */
export const LABELS = [
  { name: 'bug', color: '#d73a4a' },
  { name: 'feature', color: '#a2eeef' },
  { name: 'enhancement', color: '#7057ff' },
  { name: 'documentation', color: '#0075ca' },
  { name: 'good first issue', color: '#7ae37a' },
  { name: 'help wanted', color: '#008672' },
  { name: 'priority: high', color: '#e11d48' },
  { name: 'priority: low', color: '#94a3b8' },
];

/** Checklist item-ləri */
export const CHECKLIST_ITEMS = [
  'Kodu yaz', 'Unit test yaz', 'Code review keçir', 'Sənədləşdir',
  'Edge case-ləri yoxla', 'Performance test et', 'Staging-ə deploy et',
  'QA-dan keçir', 'Accessibility yoxla', 'PR merge et',
];
