// ═══════════════════════════════════════════════════════════════════════════
// Collabix Demo Seed — Post məzmunu mühərriki
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 PROBLEM: əvvəlki sürümdə 47 hazır post mətni var idi və 4 500 post üçün
//    hər biri ~95 dəfə təkrarlanırdı. Sənəd §35 bunu açıq qadağan edir.
//
// HƏLL: mətn ÜÇ ölçüdən qurulur —
//    mövzu (11) × janr (9) × şablon (hər janrda 6-10) × slot dəyərləri
//    (texnologiya, anlayış, alət, rəqəm…) → milyonlarla kombinasiya.
//    Üstəlik `seen` dəsti eyni başlığın iki dəfə çıxmasını bağlayır.
//
// ⚠ BLOKLAR, `text` DEYİL, ƏSAS SAHƏDİR: `js/feed.js` kartın gövdəsini
//   `post.blocks` massivindən qurur; `posts.text` yalnız 300 simvolluq
//   ÖNİZLƏMƏDİR (axtarış üçün ayrıca `search_text` var). Əvvəlki seed
//   `blocks`-u boş buraxmışdı, ona görə 338 post feed-də BOŞ kart kimi
//   görünürdü — data var idi, ekran boş idi.

import { pick, pickN, randInt, chance, rnd } from '../rand.mjs';
import { TOPIC_MIX, LANG_AZ_RATIO, TAGS } from '../config.mjs';

// ── Mövzu lüğətləri ───────────────────────────────────────────────────────

const TOPICS = {
  programming: {
    tech: ['Python', 'TypeScript', 'Go', 'Rust', 'C#', 'Java', 'Kotlin', 'C++'],
    concept: ['dependency injection', 'immutability', 'error handling', 'generic tiplər',
      'memory layout', 'concurrency modeli', 'trait/interface dizaynı', 'null safety'],
    tool: ['ESLint', 'Prettier', 'pytest', 'JUnit', 'Vitest', 'clippy', 'dotnet analyzers'],
    problem: ['kod təkrarı', 'uzun funksiyalar', 'gizli side-effect-lər', 'sıx bağlılıq',
      'test edilə bilməyən kod'],
    tags: ['programming', 'testing', 'opensource'],
  },
  web: {
    tech: ['Next.js', 'Astro', 'SvelteKit', 'Remix', 'Nuxt', 'Vite'],
    concept: ['SSR', 'hydration', 'edge rendering', 'route-level code splitting',
      'streaming HTML', 'partial prerendering'],
    tool: ['Lighthouse', 'WebPageTest', 'Chrome DevTools', 'Playwright'],
    problem: ['LCP gecikməsi', 'layout shift', 'böyük bundle ölçüsü', 'hydration mismatch',
      'yavaş TTFB'],
    tags: ['webdev', 'frontend', 'performance'],
  },
  backend: {
    tech: ['Node.js', 'ASP.NET Core', 'Spring Boot', 'FastAPI', 'Go net/http', 'NestJS'],
    concept: ['idempotentlik', 'rate limiting', 'circuit breaker', 'event sourcing',
      'CQRS', 'saga naxışı', 'backpressure', 'retry strategiyası'],
    tool: ['Postman', 'k6', 'OpenAPI', 'gRPC', 'RabbitMQ', 'Kafka'],
    problem: ['N+1 sorğu', 'timeout kaskadı', 'yaddaş sızması', 'thread starvation',
      'duplicate mesaj emalı'],
    tags: ['backend', 'api', 'nodejs'],
  },
  frontend: {
    tech: ['React', 'Vue', 'Svelte', 'Angular', 'Solid', 'Tailwind CSS'],
    concept: ['komponent kompozisiyası', 'state normalizasiyası', 'controlled input',
      'render optimallaşdırması', 'dizayn tokenləri', 'focus management'],
    tool: ['Storybook', 'Figma', 'axe DevTools', 'React DevTools'],
    problem: ['lazımsız re-render', 'prop drilling', 'CLS problemi', 'focus halqasının itməsi',
      'kontrast çatışmazlığı'],
    tags: ['frontend', 'react', 'uiux'],
  },
  ai: {
    tech: ['PyTorch', 'TensorFlow', 'scikit-learn', 'LangChain', 'Hugging Face', 'ONNX'],
    concept: ['RAG', 'fine-tuning', 'embedding', 'vektor axtarışı', 'prompt mühəndisliyi',
      'model qiymətləndirməsi', 'hallüsinasiya azaltma', 'token büdcəsi'],
    tool: ['Weights & Biases', 'Jupyter', 'pgvector', 'Qdrant', 'Ollama'],
    problem: ['overfitting', 'məlumat sızması', 'yavaş inference', 'baha token xərci',
      'qeyri-sabit nəticələr'],
    tags: ['ai', 'machinelearning', 'llm'],
  },
  security: {
    tech: ['OAuth 2.0', 'JWT', 'WebAuthn', 'TOTP', 'mTLS', 'OIDC'],
    concept: ['təhdid modelləşdirməsi', 'ən az imtiyaz prinsipi', 'CSRF müdafiəsi',
      'CSP siyasəti', 'token rotasiyası', 'sirlərin idarəsi', 'audit izi'],
    tool: ['Burp Suite', 'OWASP ZAP', 'nmap', 'semgrep', 'trivy'],
    problem: ['SQL injection', 'XSS', 'IDOR', 'sızmış API açarı', 'zəif parol siyasəti',
      'köhnəlmiş asılılıq'],
    tags: ['security', 'cybersecurity', 'api'],
  },
  database: {
    tech: ['PostgreSQL', 'MySQL', 'SQLite', 'D1', 'MongoDB', 'Redis', 'ClickHouse'],
    concept: ['indeksləmə strategiyası', 'normalizasiya', 'tranzaksiya izolyasiyası',
      'partisiyalama', 'materialized view', 'sorğu planı', 'connection pooling'],
    tool: ['EXPLAIN ANALYZE', 'pgAdmin', 'DBeaver', 'Flyway', 'Prisma'],
    problem: ['tam cədvəl skanı', 'kilid gözləməsi', 'şişmiş indeks', 'yavaş JOIN',
      'miqrasiya konflikti'],
    tags: ['database', 'sql', 'postgresql'],
  },
  cloud: {
    tech: ['Cloudflare Workers', 'AWS Lambda', 'Azure Functions', 'Terraform', 'Pulumi', 'R2'],
    concept: ['soyuq başlanğıc', 'edge caching', 'multi-region replikasiya', 'IaC',
      'obyekt saxlama', 'CDN invalidasiyası'],
    tool: ['wrangler', 'aws-cli', 'Terraform Cloud', 'Grafana'],
    problem: ['gözlənilməz xərc', 'kvota limiti', 'soyuq başlanğıc gecikməsi',
      'region arası latency', 'keş invalidasiyası'],
    tags: ['cloud', 'cloudflare', 'aws'],
  },
  devops: {
    tech: ['Docker', 'Kubernetes', 'GitHub Actions', 'GitLab CI', 'ArgoCD', 'Nginx'],
    concept: ['blue-green deploy', 'canary release', 'IaC', 'artefakt keşi',
      'sağlamlıq yoxlaması', 'avtoskalanma'],
    tool: ['Prometheus', 'Grafana', 'Loki', 'Sentry', 'OpenTelemetry'],
    problem: ['uzun build vaxtı', 'flaky test', 'sızan konteyner', 'nizamsız rollback',
      'log həcminin partlaması'],
    tags: ['devops', 'docker', 'kubernetes'],
  },
  design: {
    tech: ['Figma', 'Framer', 'Penpot', 'Storybook', 'Lottie'],
    concept: ['dizayn tokenləri', 'komponent variantları', 'tipoqrafik şkala',
      'boşluq sistemi', 'əlçatanlıq kontrastı', 'mikro-interaksiya'],
    tool: ['Figma Variables', 'Contrast Checker', 'Maze', 'Hotjar'],
    problem: ['uyğunsuz komponentlər', 'çox sayda rəng dəyəri', 'oxunaqsız kiçik mətn',
      'mobil toxunuş sahəsi', 'dizayn-kod fərqi'],
    tags: ['uiux', 'frontend'],
  },
  career: {
    tech: ['Agile', 'Scrum', 'Kanban', 'OKR', 'RFC prosesi'],
    concept: ['texniki müsahibə', 'kod review mədəniyyəti', 'onboarding', 'sprint planlaması',
      'texniki borc', 'async kommunikasiya'],
    tool: ['Notion', 'Linear', 'Jira', 'Miro'],
    problem: ['tükənmişlik', 'qeyri-müəyyən tələblər', 'uzun görüşlər', 'kontekst dəyişimi',
      'sənədləşdirmə çatışmazlığı'],
    tags: ['career', 'startup', 'azerbaijan'],
  },
};

// ── Janrlar ───────────────────────────────────────────────────────────────
//
// Sənəd §11: post uzunluqları və tipləri müxtəlif olmalıdır.

const KINDS = [
  { id: 'question',     share: 0.22, len: 'short'  },
  { id: 'discussion',   share: 0.18, len: 'medium' },
  { id: 'tip',          share: 0.14, len: 'short'  },
  { id: 'problem',      share: 0.12, len: 'medium' },
  { id: 'tutorial',     share: 0.10, len: 'long'   },
  { id: 'opinion',      share: 0.09, len: 'medium' },
  { id: 'showcase',     share: 0.07, len: 'medium' },
  { id: 'announcement', share: 0.05, len: 'short'  },
  { id: 'retro',        share: 0.03, len: 'long'   },
];

/** Başlıq şablonları: [AZ, EN] */
const HEADLINE = {
  question: [
    ['{tech} ilə {concept} necə qurursunuz?', 'How do you handle {concept} with {tech}?'],
    ['{problem} ilə qarşılaşan olub? {tech} tərəfdə həll nədir?', 'Anyone hit {problem} with {tech}? What worked?'],
    ['{tech} yoxsa {tech2} — hansı halda hansını seçirsiniz?', '{tech} or {tech2} — how do you decide?'],
    ['{concept} üçün hansı {tool} istifadə edirsiniz?', 'Which {tool} do you use for {concept}?'],
    ['{tech} layihəsində {concept} nə qədər erkən düşünülməlidir?', 'How early should {concept} be planned in a {tech} project?'],
    ['Komanda {problem} ilə üzləşəndə ilk addımınız nə olur?', 'What is your first move when the team hits {problem}?'],
    ['{tech} öyrənməyə hardan başlamaq lazımdır?', 'Where should someone start learning {tech}?'],
    ['{concept} üçün yaxşı resurs bilən varmı?', 'Any good resources on {concept}?'],
  ],
  discussion: [
    ['{concept} həqiqətən hər layihəyə lazımdırmı?', 'Is {concept} really needed in every project?'],
    ['{tech} ekosistemi son bir ildə çox dəyişdi — müşahidələriniz?', 'The {tech} ecosystem shifted a lot this year — thoughts?'],
    ['{problem} texniki problem deyil, proses problemidir', '{problem} is a process problem, not a technical one'],
    ['{tech} ilə {tech2} arasında seçim: kontekst hər şeyi həll edir', 'Choosing between {tech} and {tech2}: context decides everything'],
    ['{concept} haqqında ən çox yayılmış yanlış fikirlər', 'The most common misconceptions about {concept}'],
    ['Kiçik komandada {concept} nə qədər rəsmiləşdirilməlidir?', 'How formal should {concept} be in a small team?'],
    ['{tool} bizim iş axınımızı dəyişdi — sizdə necə?', '{tool} changed our workflow — how about yours?'],
  ],
  tip: [
    ['{tech} ipucu: {concept} üçün kiçik, amma faydalı bir yanaşma', '{tech} tip: a small but useful approach to {concept}'],
    ['{problem} problemini {number} dəqiqədə həll edən üsul', 'A {number}-minute fix for {problem}'],
    ['{tool} ilə {concept} yoxlamasını avtomatlaşdırın', 'Automate your {concept} checks with {tool}'],
    ['{tech} işlədirsinizsə bu {number} parametri yoxlayın', 'If you use {tech}, check these {number} settings'],
    ['{concept} üçün kiçik checklist', 'A short checklist for {concept}'],
  ],
  problem: [
    ['{problem} ilə {number} gün əlləşdim — səbəb gözlədiyim yerdə deyildi', 'Spent {number} days on {problem} — the cause was not where I expected'],
    ['İstehsalda {problem} çıxdı, kök səbəbi belə tapdıq', 'Hit {problem} in production, here is how we found the root cause'],
    ['{tech} tərəfdə {problem}: simptom və həqiqi səbəb', '{problem} in {tech}: symptom vs actual cause'],
    ['Debug hekayəsi: {problem} və {tool}', 'Debug story: {problem} and {tool}'],
    ['{problem} bizə {number} saat itirdirdi. Nə öyrəndik?', '{problem} cost us {number} hours. What we learned'],
  ],
  tutorial: [
    ['{tech} ilə {concept}: addım-addım bələdçi', 'A step-by-step guide to {concept} with {tech}'],
    ['{concept} sıfırdan: {tech} nümunəsi ilə', '{concept} from scratch, with a {tech} example'],
    ['{tool} quraşdırmasından istehsala: qısa yol xəritəsi', 'From {tool} setup to production: a short roadmap'],
    ['{tech} layihəsində {concept} qurmağın praktik yolu', 'A practical way to set up {concept} in a {tech} project'],
    ['{concept} öyrənərkən yazdığım qeydlər', 'Notes I took while learning {concept}'],
  ],
  opinion: [
    ['{concept} üzərində çox vaxt itiririk', 'We spend too much time on {concept}'],
    ['{tech} populyardır, amma hər problem üçün deyil', '{tech} is popular, but not for every problem'],
    ['Ölçmədən optimallaşdırmaq {problem} yaradır', 'Optimising without measuring creates {problem}'],
    ['{tool} olmadan da yaxşı iş görmək olar', 'You can do good work without {tool}'],
    ['Sadə {concept} mürəkkəb {concept} qədər dəyərlidir', 'Simple {concept} is worth as much as clever {concept}'],
  ],
  showcase: [
    ['{tech} ilə kiçik pet-project yazdım — {concept} üzərində qurulub', 'Built a small side project with {tech} — it is all about {concept}'],
    ['Həftəsonu layihəsi: {tool} + {tech}', 'Weekend project: {tool} + {tech}'],
    ['{concept} üçün açıq mənbə alət yazdım', 'I wrote an open source tool for {concept}'],
    ['Komanda daxili {tool} panelimizi paylaşıram', 'Sharing the internal {tool} dashboard we built'],
  ],
  announcement: [
    ['{tech} {version} çıxdı — diqqət çəkən dəyişikliklər', '{tech} {version} is out — the notable changes'],
    ['Bakıda {topicLabel} üzrə görüş təşkil edirik', 'We are organising a {topicLabel} meetup in Baku'],
    ['Komandamıza {profession} axtarırıq', 'We are looking for a {profession} to join the team'],
    ['{tool} üçün icma tərcüməsinə başladıq', 'We started a community translation for {tool}'],
  ],
  retro: [
    ['{number} aylıq {tech} təcrübəsi: nə işlədi, nə işləmədi', '{number} months with {tech}: what worked and what did not'],
    ['{concept} miqrasiyamızın retrospektivi', 'A retrospective of our {concept} migration'],
    ['Layihəni {tech}-dən {tech2}-ə köçürdük — dürüst hesabat', 'We moved the project from {tech} to {tech2} — an honest report'],
  ],
};

/** Gövdə paraqrafları — janra görə. */
const BODY = {
  question: [
    ['Kontekst: kiçik komandayıq, {tech} istifadə edirik və {concept} hissəsi hələ tam oturuşmayıb.',
      'Context: small team, we use {tech}, and the {concept} part is still not settled.'],
    ['Sənədlərdə yazılanlarla real təcrübə arasında fərq görürəm, ona görə soruşuram.',
      'There is a gap between the docs and real experience, so I am asking here.'],
    ['İndiyə qədər {tool} sınadım, amma {problem} qaldı.',
      'So far I tried {tool}, but {problem} is still there.'],
    ['Təcrübəsi olan varsa qısa da olsa yazsın, çox kömək olar.',
      'If anyone has been through this, even a short answer helps a lot.'],
  ],
  discussion: [
    ['Son {number} ayda bu mövzuda fikrim dəyişdi. Əvvəl {concept} üzərində çox dayanırdıq, indi əsas vaxtı {problem} tutur.',
      'My view changed over the last {number} months. We used to focus on {concept}; now {problem} takes most of the time.'],
    ['Böyük komandada işləyən yanaşma kiçik komandada əlavə yük yaradır — bu fərq çox vaxt nəzərə alınmır.',
      'What works in a large team becomes overhead in a small one — that difference is often ignored.'],
    ['{tool} tərəfdən baxanda mənzərə fərqlidir, ona görə bir neçə rəy eşitmək istərdim.',
      'The picture looks different from the {tool} side, so I would like to hear a few opinions.'],
  ],
  tip: [
    ['Qısa qeyd: {tool} ilə bunu bir addımda etmək olur, ayrıca skript lazım deyil.',
      'Quick note: {tool} does this in one step, no extra script needed.'],
    ['Bu kiçik dəyişiklik bizdə {number}% fərq yaratdı.',
      'This small change made about {number}% difference for us.'],
    ['Vacib incəlik: dəyişiklikdən sonra mütləq ölçün, əks halda təsadüfi nəticə alarsınız.',
      'Important detail: measure after the change, otherwise the result is accidental.'],
  ],
  problem: [
    ['Simptom belə idi: sistem normal işləyirdi, amma yük artanda {problem} özünü göstərirdi.',
      'The symptom: everything looked fine until load increased, then {problem} showed up.'],
    ['İlk baxışda {tech} tərəfdə problem axtardıq. Səhv idi — kök səbəb {concept} hissəsində idi.',
      'At first we looked at {tech}. That was wrong — the root cause was in the {concept} part.'],
    ['{tool} loglarını açanda mənzərə aydınlaşdı: eyni əməliyyat təkrar-təkrar icra olunurdu.',
      'The {tool} logs made it clear: the same operation was running over and over.'],
    ['Nəticə: düzəliş bir sətir idi, tapmaq isə {number} saat çəkdi.',
      'The fix was one line. Finding it took {number} hours.'],
  ],
  tutorial: [
    ['Addım 1 — mühiti hazırlayın: {tool} quraşdırın və layihəni işə salın.',
      'Step 1 — prepare the environment: install {tool} and run the project.'],
    ['Addım 2 — {concept} hissəsini konfiqurasiya edin. Burada ən çox buraxılan detal validasiyadır.',
      'Step 2 — configure the {concept} part. The most commonly skipped detail here is validation.'],
    ['Addım 3 — test yazın. Testsiz bu konfiqurasiya səssizcə sınır və problem yalnız istehsalda görünür.',
      'Step 3 — write tests. Without them this config fails silently and you only find out in production.'],
    ['Son addım — ölçün. {tool} ilə əvvəl/sonra müqayisəsi aparın.',
      'Final step — measure. Compare before and after with {tool}.'],
  ],
  opinion: [
    ['Bu mövzuda razılaşmayanlar olacaq, amma təcrübəm bunu deyir.',
      'Some will disagree, but this is what my experience says.'],
    ['Alət seçimi problemi həll etmir; problemi anlamaq həll edir.',
      'Picking a tool does not solve the problem; understanding it does.'],
    ['{concept} özlüyündə pis deyil — pis olan onu düşünmədən tətbiq etməkdir.',
      '{concept} is not bad in itself — applying it without thinking is.'],
  ],
  showcase: [
    ['Kod açıq mənbədir, rəy və PR-lara açığam.',
      'The code is open source, feedback and PRs welcome.'],
    ['Məqsəd böyük məhsul yaratmaq deyildi — {concept} hissəsini praktikada anlamaq idi.',
      'The goal was not a big product — it was to understand {concept} in practice.'],
    ['Ən çox vaxtı {problem} apardı, gözlədiyimdən çox.',
      'Most of the time went into {problem}, more than I expected.'],
  ],
  announcement: [
    ['Ətraflı məlumatı şərhlərdə paylaşacağam.',
      'I will share the details in the comments.'],
    ['İştirak etmək istəyənlər yazsın, yer məhduddur.',
      'If you want to join, drop a comment — places are limited.'],
  ],
  retro: [
    ['Yaxşı gedən: komanda {concept} üzərində razılığa gəldi və qərarlar sənədləşdirildi.',
      'What went well: the team aligned on {concept} and decisions were documented.'],
    ['Pis gedən: {problem} planlaşdırmada nəzərə alınmamışdı və qrafiki {number} həftə uzatdı.',
      'What went badly: {problem} was not in the plan and pushed the timeline by {number} weeks.'],
    ['Növbəti dəfə: kiçik addımlarla köçürəcəyik, tam kəsimlə yox.',
      'Next time: we migrate in small steps, not in one cut-over.'],
  ],
};

// ── Kod nümunələri ────────────────────────────────────────────────────────
//
// ⚠ Kod blokları REAL görünməlidir: `js/feed.js` onları `codeBlockNode()` ilə
//   sintaksis vurğulaması ilə göstərir, ona görə boş və ya uydurma kod dərhal
//   nəzərə çarpır.

const SNIPPETS = {
  javascript: [
    `const cache = new Map();\nexport async function getUser(id) {\n  if (cache.has(id)) return cache.get(id);\n  const res = await fetch(\`/api/users/\${id}\`);\n  if (!res.ok) throw new Error('user fetch failed: ' + res.status);\n  const user = await res.json();\n  cache.set(id, user);\n  return user;\n}`,
    `// debounce — hər klaviatura hadisəsində sorğu getməsin\nexport function debounce(fn, ms = 300) {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), ms);\n  };\n}`,
    `const observer = new IntersectionObserver(entries => {\n  for (const e of entries) {\n    if (!e.isIntersecting) continue;\n    e.target.src = e.target.dataset.src;\n    observer.unobserve(e.target);\n  }\n}, { rootMargin: '200px' });`,
  ],
  typescript: [
    `type Result<T, E = Error> =\n  | { ok: true; value: T }\n  | { ok: false; error: E };\n\nexport async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {\n  try {\n    return { ok: true, value: await fn() };\n  } catch (e) {\n    return { ok: false, error: e as Error };\n  }\n}`,
    `interface Paginated<T> {\n  items: T[];\n  cursor: string | null;\n}\n\nexport function mapPage<T, U>(p: Paginated<T>, f: (x: T) => U): Paginated<U> {\n  return { items: p.items.map(f), cursor: p.cursor };\n}`,
  ],
  python: [
    `from functools import lru_cache\n\n@lru_cache(maxsize=1024)\ndef fib(n: int) -> int:\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)`,
    `import asyncio\n\nasync def fetch_all(urls, limit=10):\n    sem = asyncio.Semaphore(limit)\n    async def one(u):\n        async with sem:\n            return await fetch(u)\n    return await asyncio.gather(*(one(u) for u in urls))`,
    `def chunked(items, size):\n    """Böyük siyahını bərabər paylara böl."""\n    for i in range(0, len(items), size):\n        yield items[i:i + size]`,
  ],
  sql: [
    `-- Yavaş: hər sətir üçün alt sorğu\nSELECT u.id, u.username,\n       (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts\nFROM users u;\n\n-- Sürətli: tək JOIN + GROUP BY\nSELECT u.id, u.username, COUNT(p.id) AS posts\nFROM users u\nLEFT JOIN posts p ON p.author_id = u.id\nGROUP BY u.id;`,
    `CREATE INDEX idx_posts_author_created\n  ON posts (author_id, created_at DESC);\n\nEXPLAIN QUERY PLAN\nSELECT * FROM posts\nWHERE author_id = ?\nORDER BY created_at DESC\nLIMIT 20;`,
  ],
  bash: [
    `#!/usr/bin/env bash\nset -euo pipefail\n\nfor f in ./migrations/*.sql; do\n  echo "→ $f"\n  wrangler d1 execute app-db --local --file "$f"\ndone`,
    `# ən çox yer tutan 20 qovluq\ndu -h --max-depth=2 . 2>/dev/null | sort -hr | head -20`,
  ],
  csharp: [
    `public sealed record CreateUser(string Username, string Email);\n\npublic async Task<IResult> Handle(CreateUser cmd, CancellationToken ct)\n{\n    if (await _repo.ExistsAsync(cmd.Username, ct))\n        return Results.Conflict("username taken");\n\n    var id = await _repo.AddAsync(cmd, ct);\n    return Results.Created($"/users/{id}", new { id });\n}`,
  ],
  go: [
    `func WithTimeout(next http.Handler, d time.Duration) http.Handler {\n\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n\t\tctx, cancel := context.WithTimeout(r.Context(), d)\n\t\tdefer cancel()\n\t\tnext.ServeHTTP(w, r.WithContext(ctx))\n\t})\n}`,
  ],
};

const TOPIC_LANG = {
  programming: ['python', 'typescript', 'go'],
  web: ['javascript', 'typescript'],
  backend: ['csharp', 'go', 'typescript'],
  frontend: ['javascript', 'typescript'],
  ai: ['python'],
  security: ['bash', 'python'],
  database: ['sql'],
  cloud: ['bash', 'typescript'],
  devops: ['bash'],
  design: ['javascript'],
  career: ['bash'],
};

const TOPIC_LABEL = {
  programming: 'proqramlaşdırma', web: 'veb texnologiyaları', backend: 'backend',
  frontend: 'frontend', ai: 'süni intellekt', security: 'kibertəhlükəsizlik',
  database: 'verilənlər bazası', cloud: 'bulud', devops: 'DevOps',
  design: 'UI/UX', career: 'karyera',
};

// ═══════════════════════════════════════════════════════════════════════════

const seen = new Set();

function fillSlots(tpl, ctx) {
  return tpl
    .replace(/\{tech2\}/g, ctx.tech2)
    .replace(/\{tech\}/g, ctx.tech)
    .replace(/\{concept\}/g, ctx.concept)
    .replace(/\{tool\}/g, ctx.tool)
    .replace(/\{problem\}/g, ctx.problem)
    .replace(/\{number\}/g, String(ctx.number))
    .replace(/\{version\}/g, ctx.version)
    .replace(/\{topicLabel\}/g, ctx.topicLabel)
    .replace(/\{profession\}/g, ctx.profession);
}

/** Mövzuya uyğun tag dəsti — bəziləri mövzudan, biri ümumi hovuzdan. */
function makeTags(topic) {
  const base = TOPICS[topic].tags;
  const out = new Set(pickN(base, randInt(1, base.length)));
  if (chance(0.55)) {
    // Populyarlığa görə çəkili — sənəd §28: "tag-lərin populyarlığı realistik olsun".
    let total = 0;
    for (const t of TAGS) total += t.w;
    let r = rnd() * total;
    for (const t of TAGS) {
      r -= t.w;
      if (r <= 0) { out.add(t.tag); break; }
    }
  }
  return [...out].slice(0, 4);
}

/**
 * Bir post yaradır.
 *
 * @param {string} topic   TOPIC_MIX açarı
 * @param {object} author  { profession, profile }
 * @returns {{blocks, text, searchText, tags, topic, kind, subject, lang}}
 */
export function makePost(topic, author) {
  const T = TOPICS[topic];
  const kindDef = pickKind();
  const kind = kindDef.id;

  const techs = pickN(T.tech, 2);
  const ctx = {
    tech: techs[0],
    tech2: techs[1] || techs[0],
    concept: pick(T.concept),
    tool: pick(T.tool),
    problem: pick(T.problem),
    number: pick([2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 30, 40, 60]),
    version: `${randInt(2, 9)}.${randInt(0, 9)}`,
    topicLabel: TOPIC_LABEL[topic],
    profession: author.profession,
  };

  // Dil: beynəlxalq mövzular daha çox ingiliscə yazılır.
  const az = rnd() < LANG_AZ_RATIO;
  const idx = az ? 0 : 1;

  let headline = fillSlots(pick(HEADLINE[kind])[idx], ctx);
  // Təkrar başlıq → slotları bir dəfə yenidən seç.
  if (seen.has(headline)) {
    ctx.concept = pick(T.concept);
    ctx.tool = pick(T.tool);
    ctx.number = randInt(2, 60);
    headline = fillSlots(pick(HEADLINE[kind])[idx], ctx);
  }
  seen.add(headline);

  const paraCount = kindDef.len === 'short' ? randInt(0, 1)
    : kindDef.len === 'medium' ? randInt(1, 2)
      : randInt(2, 4);
  const paras = pickN(BODY[kind], paraCount).map(p => fillSlots(p[idx], ctx));

  const blocks = [{ type: 'text', content: [headline, ...paras].join('\n\n') }];

  // Kod bloku — texniki janrlarda daha çox.
  const codeChance = kind === 'tutorial' ? 0.6
    : kind === 'problem' ? 0.35
      : kind === 'tip' ? 0.3
        : kind === 'showcase' ? 0.25
          : 0.08;
  if (chance(codeChance)) {
    const lang = pick(TOPIC_LANG[topic]);
    const snippets = SNIPPETS[lang];
    if (snippets) {
      blocks.push({ type: 'code', content: pick(snippets), language: lang });
      if (chance(0.4)) {
        blocks.push({
          type: 'text',
          content: az
            ? fillSlots(pick([
              'Burada diqqət ediləsi hissə {concept} hissəsidir.',
              'Bu variant {problem} probleminin qarşısını alır.',
              'Ölçdükdə fərq nəzərəçarpan idi.',
            ]), ctx)
            : fillSlots(pick([
              'The part worth noting here is {concept}.',
              'This version avoids {problem}.',
              'The difference was measurable.',
            ]), ctx),
        });
      }
    }
  }

  const fullText = blocks.map(b => b.content).join(' ');
  return {
    blocks,
    text: (blocks.find(b => b.type === 'text')?.content || '').slice(0, 300),
    searchText: fullText.slice(0, 20_000),
    tags: makeTags(topic),
    topic,
    kind,
    subject: ctx,
    lang: az ? 'az' : 'en',
  };
}

let kindBag = [];
function pickKind() {
  if (!kindBag.length) {
    // "Torba" üsulu: paylar 100 elementlik torbaya doldurulur və qarışdırılır.
    // Sırf çəkili random ilə müqayisədə qısa aralıqlarda da nisbət qorunur.
    for (const k of KINDS) {
      const n = Math.max(1, Math.round(k.share * 100));
      for (let i = 0; i < n; i++) kindBag.push(k);
    }
    for (let i = kindBag.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [kindBag[i], kindBag[j]] = [kindBag[j], kindBag[i]];
    }
  }
  return kindBag.pop();
}

/**
 * Sitat (quote-repost) mətni.
 *
 * ⚠ Sabit 6 cümləlik hovuz KİFAYƏT ETMİRDİ: 4 000 repost-un ~35%-i sitatdır,
 *   yəni hər cümlə yüzlərlə dəfə təkrarlanırdı və ümumi post unikallığı 75%-ə
 *   düşürdü. İndi mətn açılış × istinad × mövzu slotundan qurulur.
 */
const QUOTE_OPEN = [
  ['Bu mövzu bizdə də aktualdır.', 'This is on our radar too.'],
  ['Tam razıyam.', 'Fully agree with this.'],
  ['Oxumağa dəyər.', 'Worth a read.'],
  ['Komandada müzakirə etdik.', 'We discussed this in the team.'],
  ['Bunu qeyd etmək lazımdır.', 'This deserves a bookmark.'],
  ['Praktikada eyni nəticəyə gəlmişdik.', 'We reached the same conclusion in practice.'],
  ['Yaxşı izahdır.', 'Good explanation.'],
  ['Bu yanaşmanı sınamışam.', 'I have tried this approach.'],
  ['Junior-lar üçün faydalıdır.', 'Useful for juniors.'],
  ['Fikrim bir az fərqlidir.', 'My take is slightly different.'],
];

const QUOTE_TAIL = [
  ['{concept} hissəsi xüsusilə vacibdir.', 'The {concept} part matters most.'],
  ['{tech} işlədənlər üçün aktualdır.', 'Relevant for anyone using {tech}.'],
  ['{problem} bizə də baha başa gəlmişdi.', '{problem} cost us a lot too.'],
  ['{tool} ilə birlikdə daha yaxşı işləyir.', 'It works even better together with {tool}.'],
  ['Ölçmədən qərar verməmək lazımdır.', 'Do not decide without measuring.'],
  ['Kiçik komandada nəticə fərqli ola bilər.', 'The outcome can differ in a small team.'],
  ['Sənədləşdirmə hissəsini əlavə etmək qalır.', 'The documentation part is still missing.'],
  ['', ''],
];

export function makeQuote(post) {
  const az = rnd() < LANG_AZ_RATIO;
  const i = az ? 0 : 1;
  const tail = fillSlots(pick(QUOTE_TAIL)[i], post.subject);
  return [pick(QUOTE_OPEN)[i], tail].filter(Boolean).join(' ');
}

/** Mövzu seçimi — TOPIC_MIX paylarına görə. */
export function pickTopic() {
  let r = rnd();
  for (const [topic, share] of Object.entries(TOPIC_MIX)) {
    r -= share;
    if (r <= 0) return topic;
  }
  return 'programming';
}

export { TOPICS, TOPIC_LABEL };
