# Collabix — Tam Sistem və Memarlıq Sənədləşdirilməsi (Ultra-Detail)

Collabix, 18+ yaşlı gənclər, xüsusən də gələcəyin proqramçıları və dil öyrənənləri üçün nəzərdə tutulmuş **müasir, sürətli və oyunlaşdırılmış (gamification)** əməkdaşlıq platformasıdır.

Bu sənəd layihənin arxitekturasını, bütün funksiyalarını, modul quruluşunu və verilənlər bazası strukturunu tam əhatə edən "Single Source of Truth" (Yeganə Həqiqət Mənbəyi) rolunu oynayır.

---

## 🎯 Vizyon: Layihə Nə Üçün Vacibdir?

Müasir proqram təminatı inkişafı və təhsil platformaları tez-tez lüzumsuz mürəkkəbliklərlə (ağır JS çərçivələri, şişirdilmiş state management) yüklənmiş olur. Collabix bu tendensiyaya qarşı çıxaraq, öyrənmə və inkişaf mühitini **əlçatan, sürətli və diqqət dağıtmayan** bir arxitekturaya yerləşdirir.

1. **Performans və "Zero-Latency":** Tətbiq ənənəvi mərkəzləşdirilmiş serverlər əvəzinə Cloudflare Edge şəbəkəsi üzərində işləyir. API sorğuları, məzmun və verilənlər bazası əməliyyatları istifadəçiyə coğrafi baxımdan ən yaxın qovşaqdan (node) anında çatdırılır.
2. **Kənar Çərçivələrdən İmtina (Vanilla JS Gücü):** React, Vue kimi böyük çərçivələrə asılı olmadan, birbaşa brauzerin yerli (native) DOM manipulyasiya gücündən istifadə etməklə inşaa edilmişdir. Bu, həm "load-time" (yüklənmə vaxtını) minimuma endirir, həm də yeni gələn proqramçıların təməl JavaScript biliklərini təkmilləşdirməsi üçün ideal bir istinad kodu (reference code) yaradır.
3. **Məqsədyönlü İcma (Community-Driven):** Gənclərin yalnız sual-cavab formatında deyil, komanda şəklində işləməsini, real layihələr (Projects) bölüşməsini və "XP/Level" sistemi vasitəsilə daimi motivasiyada qalmasını təmin edən avtomatlaşdırılmış sosial alətlər təqdim edir.

# Collabix İnkişaf Yol Xəritəsi (Roadmap)

## Baxış

Collabix-in məqsədi sadəcə proqramçılar üçün növbəti sosial şəbəkə yaratmaq deyil. Məqsəd proqramçıların, komandaların, mentorların, açıq mənbə layihələrinin və texnologiya şirkətlərinin gündəlik istifadə etdiyi vahid ekosistem qurmaqdır.

Uzunmüddətli perspektivdə Collabix aşağıdakı platformaların müxtəlif xüsusiyyətlərini bir araya gətirən vahid platformaya çevrilməyi hədəfləyir:

* GitHub (Kod və repository)
* Jira (Layihə idarəetməsi)
* Discord (Realtime ünsiyyət)
* Slack (Komanda əməkdaşlığı)
* LinkedIn (Peşəkar profil və reputasiya)
* Stack Overflow (Texniki bilik paylaşımı)
* Notion (Sənədləşdirmə və Wiki)
* Coursera/Udemy (Öyrənmə)
* Dev.to / Hashnode (Texniki məqalələr)

Lakin məqsəd bu platformaları kopyalamaq deyil, onların ən faydalı imkanlarını vahid və süni intellekt dəstəkli platformada birləşdirməkdir.

---

# Mərhələ 1 — Platformanın Əsasının Qurulması

Bu mərhələdə platformanın əsas infrastrukturu və istifadəçi təcrübəsi formalaşdırılır.

### Əsas funksiyalar

* Qeydiyyat və autentifikasiya
* Profil sistemi
* Paylaşımlar
* Şərhlər
* Bəyənmələr
* Bookmark
* Bildiriş sistemi
* XP sistemi
* Level sistemi
* Badge sistemi
* Reputasiya sistemi
* Realtime Chat
* Axtarış sistemi
* Admin Panel
* Təhlükəsizlik sistemi

### Texnologiyalar

* Cloudflare Workers
* D1
* R2
* KV
* Durable Objects
* Queues
* Turnstile

Nəticədə platforma müasir sosial platforma səviyyəsinə çatır.

---

# Mərhələ 2 — Cloudflare Native Arxitekturası

Platformanın tam şəkildə Cloudflare ekosisteminə keçirilməsi.

### Məqsədlər

* Event-Driven Architecture
* Queue əsaslı ağır əməliyyatlar
* Workflow əsaslı uzun proseslər
* AI Gateway
* Workers AI
* Browser Rendering
* Vectorize
* Service Layer
* Provider Abstraction

Bu mərhələdə sistem yüksək yüklənməyə hazır olur.

---

# Mərhələ 3 — Team Workspace

Artıq istifadəçilər tək işləməyəcək.

Onlar komanda şəklində layihələr hazırlaya biləcəklər.

### Modullar

* Team
* Workspace
* Team Dashboard
* Team Feed
* Team Chat
* Team Files
* Team Projects
* Team Tasks
* Team Activity
* Team Statistics
* Team XP
* Team Reputation

Bu mərhələdə platforma real komanda əməkdaşlığını dəstəkləyir.

---

# Mərhələ 4 — Git Platform Integration

Platforma GitHub və GitLab ilə inteqrasiya olunur.

### İmkanlar

* GitHub OAuth
* GitLab OAuth
* Repository Sync
* Branches
* Pull Requests
* Issues
* Releases
* Webhooks
* Commit History
* Repository Dashboard

AI avtomatik olaraq

* Commit Summary
* Pull Request Summary
* Documentation Summary

yarada bilir.

---

# Mərhələ 5 — Agile Project Management

Komandalar artıq layihələrini Collabix daxilində idarə edə biləcək.

### Modullar

* Sprint
* Kanban
* Scrum
* Roadmap
* Milestone
* Backlog
* Story Points
* Burndown Chart
* Release Planning
* Time Tracking

Bu mərhələdə Collabix klassik Project Management sistemlərini əvəz edə biləcək.

---

# Mərhələ 6 — AI Developer Platform

Platformanın ən vacib hissələrindən biri.

AI sadəcə ChatBot olmayacaq.

Platformanın bütün hissələrinə inteqrasiya olunacaq.

### AI imkanları

* AI Mentor
* AI Code Review
* AI Bug Detection
* AI Security Scan
* AI Refactoring
* AI Documentation
* AI Translation
* AI Task Generator
* AI Meeting Summary
* AI Roadmap Generator
* AI Project Planner
* AI Pair Programming

AI istifadəçinin inkişafını da analiz edəcək.

---

# Mərhələ 7 — Learning Platform

Platforma öyrənmə mühiti də təqdim edəcək.

### Modullar

* Courses
* Learning Paths
* Interactive Lessons
* Coding Challenges
* Labs
* Quizzes
* Exams
* Certificates
* Progress Tracking
* Mentor Sessions

AI hər istifadəçi üçün fərdi öyrənmə planı hazırlayacaq.

---

# Mərhələ 8 — Knowledge Base

Platforma daxili bilik bazası.

### Bölmələr

* Wiki
* Documentation
* Tutorials
* Snippets
* Best Practices
* Templates
* Architecture Library

Vector Search və AI ilə birlikdə işləyəcək.

---

# Mərhələ 9 — Portfolio Platform

İstifadəçinin fəaliyyəti avtomatik portfolioya çevriləcək.

### Daxildir

* Projects
* Git Activity
* Skills
* Certificates
* XP
* Reputation
* Badges
* Achievements
* Timeline

Bir kliklə

* PDF CV
* Portfolio
* Resume

yaradıla biləcək.

---

# Mərhələ 10 — Marketplace

İstifadəçilər

* Freelancer
* Mentor
* Team
* Company

kimi fəaliyyət göstərə biləcəklər.

### Modullar

* Jobs
* Freelance
* Teams
* Services
* Hiring
* Marketplace
* Sponsorship

---

# Mərhələ 11 — Community

Platforma böyük texnologiya icmasına çevriləcək.

### Dəstəklənəcək

* Communities
* Technology Groups
* Hackathons
* Coding Competitions
* Events
* Meetups
* Live Streams

---

# Mərhələ 12 — Enterprise Platform

Şirkətlər üçün ayrıca platforma.

### Modullar

* Organizations
* Departments
* Multiple Teams
* Enterprise RBAC
* SSO
* Audit Logs
* Compliance
* Internal Knowledge Base
* Internal AI Assistant

---

# Mərhələ 13 — AI Native Platform

Uzunmüddətli məqsəd AI-ni ayrıca modul kimi deyil, platformanın ayrılmaz hissəsi kimi istifadə etməkdir.

AI aşağıdakı bütün sistemlərlə inteqrasiya olunacaq:

* Search
* Chat
* Documentation
* Learning
* Project Management
* Repository
* Security
* Portfolio
* Recruitment
* Marketplace

İstifadəçi istənilən səhifədə AI köməkçisi ilə işləyə biləcək.

---

# Uzunmüddətli Texniki İnkişaf

Platforma aşağıdakı prinsiplər əsasında inkişaf etdiriləcək:

* Cloudflare Native Infrastructure
* Event-Driven Architecture
* Service-Oriented Architecture
* Provider-Agnostic AI
* Modular Backend
* API First Design
* Zero Trust Security
* Horizontal Scalability
* Real-Time Communication
* AI-First Experience

---

# Strateji Məqsəd

Collabix-in əsas məqsədi proqramçıların gündəlik istifadə etdiyi çoxsaylı alətləri vahid platformada birləşdirməkdir.

İstifadəçi kod yazmaq, komanda ilə işləmək, layihə idarə etmək, öyrənmək, bilik paylaşmaq, portfolio yaratmaq, iş tapmaq və süni intellektdən dəstək almaq üçün müxtəlif xidmətlər arasında keçid etməyə ehtiyac duymamalıdır.

Bu yanaşma Collabix-i sadəcə sosial platforma deyil, proqramçılar, komandalar və texnologiya şirkətləri üçün tam inteqrasiya olunmuş, AI dəstəkli, müasir və genişlənə bilən Developer Ecosystem kimi formalaşdırmağı hədəfləyir.

---

## 🌟 1. Saytda Olan Bütün Funksiyalar (Xüsusiyyətlər Kataloqu)

Platforma istifadəçilərə və idarəçilərə aşağıdakı tam funksionallığı təqdim edir:

### 🔐 Autentifikasiya və Təhlükəsizlik

* **Qeydiyyat Sehrbazı (Wizard):** 4 mərhələli inkişaf etmiş qeydiyyat. Hesab məlumatları → Şəxsi məlumatlar → Bacarıqlar (Skill/Səviyyə) → Sosial Linklər. Avatar kəsmə (crop) və şifrə gücü göstəricisi mövcuddur.
* **Giriş Metodları:** Standart İstifadəçi adı (Username) / Şifrə ilə giriş, **Magic Link** (eposta ilə linksiz giriş), və **OAuth 2.0** (Google, GitHub, LinkedIn).
* **İki Mərhələli Təsdiq (2FA/TOTP):** İstifadəçi təhlükəsizliyi üçün authenticator app dəstəyi.
* **Sessiya İdarəetməsi:** İstifadəçinin bütün cihazlardakı aktiv sessiyalarına baxma və "Digər sessiyaları ləğv et" düyməsi.

### 👥 Profil və Fərdi İnkişaf

* **Genişləndirilmiş Profil:** Bio, qlobal irəliləyiş göstəriciləri, xüsusi bacarıq səviyyələri və sosial şəbəkə əlaqələri.
* **Oyunlaşdırma (XP və Level):** Post yazmaq (+10 XP), Tapşırıq həll etmək (+50 XP), Gündəlik giriş (+5 XP) vasitəsilə Təcrübə Xalları toplanır. XP-yə əsaslanaraq avtomatik Səviyyə (Level) hesablanır.
* **Reputasiya və Nişanlar (Badges):** Etibarlı fəaliyyətlərə (bəyənmə alma, doğru cavab) görə reputasiya xalı və profilə əlavə olunan avtomatik nişanlar.
* **Aktivlik Xəritəsi (Heatmap):** İstifadəçinin il ərzindəki aktivliyini göstərən GitHub üslubunda 365 günlük dinamik təqvim.
* **Məcburi Şifrə Yenilənməsi:** Admin istifadəçiyə müvəqqəti şifrə verdikdə, ilk girişdə şifrənin dəyişdirilməsi məcburiyyəti.

### 📝 Sosial Şəbəkə və Məzmun Yaradılması (Feed)

* **Blok-Əsaslı Redaktor (Composer):** Eyni post daxilində eyni vaxtda Mətn, Dinamik Kod bloku (syntax highlighting) və Şəkil blokları yerləşdirmə imkanı.
* **Reaksiyalar:** Postu və şərhləri bəyənmə (Like).
* **Yenidən Paylaşım (Repost/Quote):** Başqasının məzmununu öz divarında paylaşma və ya sitat gətirmə.
* **Saxlanılanlar (Bookmarks):** Məqalə və postları daha sonra oxumaq üçün xüsusi yaddaşa əlavə etmə.

### 💬 Real-Vaxt Ünsiyyət (WebSockets)

* **Qlobal Otaqlar (Rooms):** Mövzulara görə (məsələn: Python, İngilis dili) bölünmüş səs-küylü söhbət otaqları. Canlı "Typing" (yazır...) göstəricisi.
* **Şəxsi Mesajlaşma (DM):** Birbaşa mesajlaşma, oxundu işarələri (Read Receipts) və mesajın göndərilmə anından dərhal sonra redaktə/silinməsi.
* **Mövcudluq (Presence):** Kimin onlayn, kimin oflayn olduğunun yaşıl nöqtə ilə anında qlobal yayımı.

### 🏢 Komandalar və İş Sahələri (Teams & Workspaces)

* **Komanda Yaratma və İdarəetmə:** Qapalı qrupların yaradılması, sahiblik (Ownership) transferi, fərdi komanda rollarının yaradılması və idarəedilməsi.
* **Layihələr (Projects):** Komandadaxili layihələrə ayrılma.
* **Tapşırıq İdarəetməsi (Kanban Tasks):** Komanda daxilində tapşırıqların yaradılması, icraçıların təyini, statusun dəyişdirilməsi.
* **Daxili Lent və Fayllar:** Yalnız komanda üzvlərinin gördüyü xüsusi post axını və ortaq R2 fayl anbarı.

### 🎓 Təhsil və Tapşırıqlar (Tasks)

* **Tədris Tapşırıqları:** Admin tərəfindən sayta yüklənən tapşırıqlar (JavaScript, Python və s. kateqoriyalarda).
* **Həll Göndərilməsi (Submissions):** İstifadəçilər öz həllini (kod və ya Github linki şəklində) göndərir.
* **Review (Yoxlama):** Admin həlli təsdiq etdikdə istifadəçiyə xal və XP verilir.

### 🛠 Admin Paneli (İdarəetmə Mərkəzi)

* **Qrafiklər (Sparklines):** Canlı sistem performansı və aktivlik statistikası.
* **İstifadəçi Menecmenti:** Rolların (Admin/User) dəyişdirilməsi, təsdiqlənmiş (Verified) işarəsinin verilməsi, hesabın bloklanması və məcburi XP dəyişimi.
* **Şikayətlər (Reports):** İstifadəçilərin etdiyi şikayətlərə (Spam, Təhqir) baxılması və həlli.
* **Audit Jurnalı (Log Terminal):** Sistemdə baş verən bütün kritik əməliyyatların (Delete, Ban, Role Change) izlənilməsi, CSV formatında ixracı.
* **Taksonomiya (Taxonomy):** Saytdakı bacarıq (Skill) və Dil (Language) siyahılarının idarəedilməsi və Sürüşdürüb-Buraxma (Drag & Drop) vasitəsilə sıralanması.
* **FAQ və Rəylər (Testimonials) CRUD:** Ana səhifədə görünən məzmunun dinamik idarəsi.

---

## 📂 2. Frontend Modullarının Dərin Analizi (`/js/` qovluğu)

Frontend **34 müstəqil Vanilla JS ES modulu** üzərində fəaliyyət göstərir. Heç bir kənar çərçivə (React/Vue) yoxdur.

1. **`app.js` (Tətbiq Qabığı & Routing):**
   * Hash (`#`) və deep-link URL əsaslı Client-side router funksiyasını yerinə yetirir.
   * Sessiya həyat dövrünə nəzarət edir. Onboarding turunu və Qlobal Modal açılışlarını idarə edir.
2. **`api.js` (Network Mühərriki):**
   * Bütün REST API sorğularının tək mərkəzi. Ağıllı *Polling* məntiqi burada qurulub: Tab gizlədildikdə (Visibility API) arxa fon sorğularını dayandırır.
3. **`store.js` (Reactive Dövlət İdarəsi):**
   * `state` obyekti vasitəsilə Redux-a bənzər reaksiya yaradır. `myLikes`, `myBookmarks`, `myFollowing` məlumatlarını önbellekdə saxlayır ki, UI dərhal reaksiya versin.
4. **`auth.js`:**
   * `login()`, `register()`, `logout()` əməliyyatlarını həyata keçirir, parolların daxil edilməsini təhlükəsiz şəkildə worker-ə ötürür.
5. **`wizard.js`:**
   * 4-addımlı qeydiyyat formunu idarə edən mürəkkəb tək-səhifəlik məntiq.
6. **`i18n.js` (Beynəlxalqlaşdırma):**
   * 400-dən çox sözdən ibarət AZ, EN, RU lüğəti. `data-i18n` atributlarını oxuyub bütün DOM-u bir anda tərcümə edir.
7. **`feed.js` & `composer.js`:**
   * `feed.js`: Sonsuz skrollu (Infinite Scroll) məzmun axınını və post/comment renderini təmin edir.
   * `composer.js`: Bloklara əsaslanan WYSIWYG redaktorudur. Kod blokunu, şəkil yükləməsini və mətn idarəsini eyni vaxtda sinxronlaşdırır.
8. **`chat.js` & `dm.js`:**
   * WebSocket kanallarını canlandırır. Otaqdakı yazışmaları və "Typing..." animasiyalarını ekranda göstərir.
9. **`presence.js`:**
   * İstifadəçinin onlayn olub-olmamasını izləyən ürək döyüntüsü (Heartbeat) mühərriki. Exponential backoff metodu ilə qırılan bağlantıları bərpa edir.
10. **`users.js` & `profile.js`:**
    * `users.js`: Qabaqcıl filtrasiya və Pagination ilə istifadəçi axtarış kataloqunu yaradır.
    * `profile.js`: Profilə daxil olanda statistikaları, irəliləyişi və Heatmap-i çəkir.
11. **`admin.js`:**
    * İdarə panelinin işini tənzimləyir. Qrafikləri çəkir, Audit Log terminalını emulyasiya edir.
12. **`tasks.js` & `teams.js`:**
    * Təhsil tapşırıqları və Komanda (Workspace) interfeyslərini yükləyir.
13. **`ui.js` & `util.js`:**
    * `util.js`: DOM Manipulyasiyası üçün `el()` funksiyası. XSS qarşısını alır (innerHTML əvəzinə `createElement` işlədir).
    * `ui.js`: Toast mesajları, Modallar, və Dark/Light/Matrix temalarının dinamik tətbiqi.
14. **Digər köməkçi modullar:** `notify.js` (Bildirişlər), `settings.js` (Ayarlar), `markdown.js` (marked+DOMPurify), `richmsg.js` (Mesaj rəngləndirici), `particles.js` (Animasiyalı Arxa Fon), `cyberpunk_fx.js` (Cyberpunk glitch effektləri), `palette.js` (Cmd+K command panel).

---

## ⚙️ 3. Backend Modullarının Dərin Analizi (`/worker/` qovluğu)

Backend tamamilə Serverless (Cloudflare Workers) formatında Typescript ilə yazılıb. 92 REST endpoint, və WebSocket dəstəyinə malikdir.

1. **`index.ts` (Entrypoint & Router):**
   * Bütün yolları (Routes) tənzimləyir.
   * **Static Asset Serving:** Hashed frontend resurslarını kəsmədən təqdim edir.
   * **SEO & SSR Fallback:** HTMLRewriter ilə səhifələrə (Məs: `/post/123`, `/u/tahmaz`) dinamik `meta`, `JSON-LD` və OG teqlərini inyeksiya edir ki, botlar üçün açıq olsun.
   * **Təhlükəsizlik Başlıqları (Security Headers):** Sərt `Content-Security-Policy` (CSP), `X-Frame-Options: DENY`, `HSTS` və CORS yoxlamalarını qoyur.
2. **`routes.ts` (Core Logic):**
   * Bütün 92 əsas API müraciətinin biznes məntiqini cəmləşdirir (Məs: `createPost`, `sendDM`, `adminTempPassword`). Bura D1 baza çağırışları daxildir.
3. **`team-routes.ts` (Workspace Logic):**
   * Komandalarla bağlı çoxsaylı API-ları (üzvlər, layihələr, rollar) saxlayır. Optimizasiya üçün yalnız ehtiyac olduqda (`Lazy Load`) işə salınır ki, serverin Cold-Start vaxtı sürətlənsin.
4. **`auth.ts` (Crypto & Session):**
   * Parol şifrələməsi: WebCrypto API istifadə edərək **PBKDF2-SHA256** alqoritmi, 100,000 iterasiya, 16 bayt duz (salt).
   * Sessiya: **HS256 JWT**. Tokenlər KV-də saxlanıldığı üçün İkili Təhlükəsizlik qatına malikdir.
   * **Rate Limiting:** KV-əsaslı pəncərə sayğacı.
5. **`seo.ts` & `og.ts` (Search Engine Optimization):**
   * `seo.ts`: Avtomatik olaraq D1 məlumatlarına əsasən `sitemap.xml`, `robots.txt` və `llms.txt` (Süni İntellekt Crawlerləri üçün) generə edir.
   * `og.ts`: `workers-og` vasitəsilə postlar və profillər paylaşıldıqda Facebook/Twitter üçün xüsusi dizayn edilmiş şəkli (PNG) canlı olaraq render edir.
6. **`room-do.ts` & `presence-do.ts` (Durable Objects):**
   * Bu modullar stateful işləyir. `PresenceDO` qlobal onlayn məlumatını öz operativ yaddaşında saxlayıb bütün bağlanan klentlərə anında yayır. `RoomDO` yalnız seçilmiş otağa mesaj/typings eventlərini göndərir.

---

## 🗄 4. Verilənlər Bazası Memarlığı (Cloudflare D1 SQLite)

Verilənlər bazasında D1 üçün optimallaşdırılmış (25+ indeksli) **26 cədvəl** mövcuddur:

* **Hesablar və İdarə:** `users` (profil datası), `admins` (rol təyinatı), `admin_logs` (audit loqları), `progress` (inkişaf qeydləri), `presence` (son aktivlik statusu).
* **Məzmun və Cəmiyyət:** `posts` (paylaşımlar), `comments` (şərhlər), `likes` (bəyənmələr), `comment_likes`, `bookmarks` (yadda saxlanılanlar), `post_shares` (repostlar), `follows` (izləmə münasibətləri).
* **Ünsiyyət:** `rooms` (otaqlar), `room_messages` (otaq yazışmaları), `dm_threads` (mesajlaşma pəncərəsi), `dm_messages` (şəxsi mesajlar).
* **Workspace (Komandalar):** `teams`, `team_members`, `team_roles`, `team_invites`, `team_projects`, `team_tasks`, `team_files` (İş sahəsi asılılıqları).
* **Təhsil Sistemi:** `tasks` (tədris tapşırıqları), `submissions` (həllər).
* **Nəzarət və Tənzimləmə:** `reports` (şikayətlər), `taxonomies` (dil və skill kateqoriyaları), `faqs` (Sual-Cavab), `testimonials` (Rəylər), `stats_daily` (Gündəlik qrafik xam məlumatları), `contact_messages` (əlaqə forması), `newsletter` (abunələr).

---

## 🛡 5. Təhlükəsizlik Sistemi və Anti-Abuse

Tətbiq son dərəcə etibarlı bir struktura malikdir:

* **Zero Trust Model:** Heç bir əməliyyat Client (müştəri) məlumatlarına güvənmir. XP yalnız serverdə hadisələrə (Events) bağlı olaraq hesablanır.
* **WAF & Rate Limits:** DDoS və Spam qoruması. Auth endpointləri (5 dəq-də 10 cəhd), Write endpointləri (1 dəq-də 60), Upload (1 saatda 30) məhdudiyyətləri var.
* **XSS Qoruması:** Mütləq `DOMPurify`. DOM-a heç bir yerdə string vasitəsilə HTML daxil edilmir. Hər şey proqrammatik olaraq yaradılır (`document.createElement`).
* **SQL Injection:** SQLite bazasına gələn bütün sorğular `Prepared Statements` (Bind parameters) ilə qorunur.
* **R2 MIME Whitelisting:** Cloudflare R2-yə yüklənən faylların həqiqi tipləri (MIME) Worker-də yoxlanılır (yalnız müvafiq Şəkil/Sənəd icazəlidir).

---

## ⚙️ 6. İnkişaf (Lokal) və Deploy Təlimatı

Sistem xüsusi backend server (Node/Express) əvəzinə Wrangler emulyatoru ilə lokal olaraq tam test edilə bilir.

**1. Quraşdırma:**

```bash
npm install
```

**2. Lokal Baza Qurulumu (D1 Emulator):**

```bash
npm run db:migrate:local
npm run db:import:local
```

**3. İşə Salma (Frontend Vite + Backend Wrangler):**

```bash
npm run dev
```

*(Bu komanda Vite izləmə rejimi və Worker-in eyni anda portlarda işləməsini təmin edir)*

**4. Avtomatlaşdırılmış E2E Testləri:**
Layihədə tam Playwright sınaq infrastrukturu var. Authentication-dan tutmuş Real-time mesajlara kimi hər şey test edilir.

```bash
npm run e2e
```

**5. Cloudflare Canlı Yayım (Deploy):**

```bash
npm run deploy
```

---

## 📁 7. Layihə və Qovluq Quruluşu (Directory Structure)

Layihənin mərkəzi qovluq və fayl arxitekturası aşağıdakı kimi qurulub. Struktur ön-üz (frontend) və arxa-üz (backend) üçün ayrılmış, lakin monorepo formasında bir araya gətirilmişdir.

### 🌳 Ümumi Sxem (Tree View)

```text
Collabix/
├── 📁 js/                 # Bütün Frontend Vanilla JS Modulları
├── 📁 worker/             # Cloudflare Workers Backend Kodu (TypeScript)
│   ├── 📁 events/         # CQRS / Event qəbulediciləri
│   ├── 📁 jobs/           # Cron işləri (Gündəlik/saatlıq təmizləmə)
│   ├── 📁 middleware/     # Auth, WAF və Security Guard mexanizmləri
│   ├── 📁 providers/      # Kənar xidmətlər (Email, AI)
│   ├── 📁 services/       # Biznes məntiqləri
│   └── 📁 workflows/      # Kompleks iş axınları
├── 📁 migrations/         # D1 Verilənlər Bazası cədvəl yaradılış faylları (.sql)
├── 📁 docs/               # PRD, TDD, Arxitektura və Task sənədləşdirmələri
├── 📁 e2e/                # Playwright avtomatlaşdırılmış Test Skriptləri
├── 📁 scripts/            # Build, deploy və təmizləmə üçün köməkçi BASH/JS scriptləri
├── 📄 index.html          # SPA-nın əsas və yeganə HTML çərçivəsi
├── 📄 styles.css          # Qlobal stil, UI dəyişənləri və struktur kodu
├── 📄 cyberpunk_*.css     # Matrix və kiberpunk xüsusi temaları
├── 📄 vite.config.ts      # Frontend üçün paketləmə və HMR aləti
├── 📄 wrangler.jsonc      # Cloudflare D1, KV, R2, DO və domen konfiqurasiyaları
└── 📄 package.json        # Asılılıqlar və NPM skriptləri
```

### 📋 Ön-Üz (Frontend) Qovluq Detalları - `js/`

Ön-üz heç bir çərçivə olmadan tam modular (ESM) dizayn edilib. Hər bir fayl öz vəzifəsinə cavabdehdir.

| Modul/Fayl Adı | Təyinatı və Funksiyası |
|---|---|
| `app.js` | Tətbiq qabığı, Hash-routing, Onboarding, Tətbiq səviyyəsində State inisializasiyası. |
| `api.js` | Backend ilə əlaqə quran mərkəzi Fetch wrapper, xətaların tutulması və Polling strategiyası. |
| `store.js` | İstifadeçi məlumatları (State) və Keş (Cache) sistemi. Reactivity emulyasiyası. |
| `auth.js` | Qeydiyyat, Giriş, və Multi-Tab sinxronlaşdırılması məntiqləri. |
| `feed.js` / `chat.js` / `teams.js` | Əsas UI blokları: Sosial lent, Real-vaxt otaqları, və Komanda idarəetmə pəncərələri. |
| `i18n.js` | 3 Dildə (AZ, EN, RU) tətbiqin dərhal tərcümə olunması üçün sözlük bazası. |
| `particles.js` & `cyberpunk_fx.js` | Səhifələrdə olan füsunkar kətan (Canvas) və glitch vizual effektləri. |
| `ui.js` / `util.js` | HTML elementləri yaradan qoruyucu funksiyalar (XSS prevent) və Toast bildirişləri. |

### 🛠 Arxa-Üz (Backend) Qovluq Detalları - `worker/`

Arxa üz TypeScript ilə yazılıb və Cloudflare Serverless ekosistemi (Wrangler) tərəfindən V8 Isolates daxilində işlədilir.

| Modul/Fayl Adı | Təyinatı və Funksiyası |
|---|---|
| `index.ts` | Əsas giriş nöqtəsi (Entrypoint). Yönləndirmə (Routing), SSR (HTMLRewriter) və CORS tənzimləmələri. |
| `routes.ts` | Təməl API Endpoint-lərini saxlayan ana modul. Bütün HTTP metodları (GET, POST, PUT, DELETE) buradadır. |
| `team-routes.ts` | İş sahələrinə (Teams) aid əlavə sorğuları emal edir. |
| `room-do.ts` & `presence-do.ts` | **Durable Objects**. Otaqlardakı real-vaxt söhbətləri və qlobal Online/Offline statuslarını paylayır. |
| `auth.ts` | Şifrələmə (PBKDF2), Rate Limitlər və JWT Tokenlərin generasiya/yoxlanılması. |
| `seo.ts` / `og.ts` | Axtarış motorları üçün dinamik `robots.txt`, `sitemap.xml`, və Sosial şəbəkə şəkillərinin (OG Images) canlı renderi. |

### 🗄 Verilənlər Bazası Miqrasiyaları - `migrations/`

Bu qovluqda Cloudflare D1 üçün yazılmış tam SQL məntiqi yer alır. Hər bir fayl ardıcıllıqla icra edilərək bazanı yeniləyir:

| SQL Faylı | Təyinatı |
|---|---|
| `0001_init.sql` | Əsas 15 cədvəlin (users, posts, comments, likes) strukturu. |
| `0002_seed.sql` | Dummy data (Sınaq məlumatları) və default Taksonomiyaların əlavə edilməsi. |
| `0009_sessions_security.sql` | Çoxlu tab/sessiya idarəsi və təhlükəsizlik cədvəli əlavələri. |
| `0011_mfa_totp.sql` | İki mərhələli təsdiq (2FA) üçün gizli açar cədvəlləri. |
| `0014_schema_team.sql` & `0016_task11_schema.sql` | Yeni əlavə edilmiş "Teams" (Komandalar, rollar, fayllar) relasiya strukturu. |

---

## 📚 8. Genişləndirilmiş Sənədləşdirmə və Strateji Yol Xəritələri (Gələcək Sənədlər)

Collabix böyüdükcə aşağıdakı qabaqcıl arxitektur və biznes strategiya sənədlərinin hazırlanması planlaşdırılır. Hər biri müvafiq mərhələdə məhsulun sağlam böyüməsini və şirkət/icma idarəetməsini asanlaşdırmaq üçün `docs/` daxilinə və ya xüsusi Wiki səhifəsinə yerləşdiriləcək.

### 1. Product Strategy (Məhsul Strategiyası)

Bu bölmə məhsulun niyə yaradıldığını, hansı problemi həll etdiyini və gələcəyini izah edir:

* **Vision & Mission:** Collabix-in son hədəfi və cəmiyyətə verəcəyi dəyər (Gələcəyin proqramçılarını bir araya gətirmək).
* **Product Philosophy & Principles:** Dizayn və funksional qərarların arxasında duran sadəlik, sürət və əlçatanlıq fəlsəfəsi.
* **Core Values & Long-term Goals:** İstifadəçi məxfiliyi, davamlı inkişaf və 5 illik böyümə hədəfləri.
* **Success Metrics & North Star Metric:** Aktiv komanda layihələrinin sayı və ya gündəlik yazılan kod sətirləri kimi platformanın uğurunu ölçən əsas göstəricilər.
* **Product Positioning & Lifecycle:** Rəqiblərə (GitHub, Discord, Slack) qarşı mövqeləndirmə və məhsulun həyat dövrü.

### 2. Business Strategy (Biznes və Gəlir Strategiyası)

Layihənin uzunmüddətli maliyyə dayanıqlığını təmin etmək üçün:

* **Business & Revenue Model:** Pulsuz (Freemium) istifadə və gələcək monetizasiya yolları.
* **Pricing Strategy & Subscription Plans:** Şirkətlər və peşəkar qruplar üçün Premium/Enterprise paketləri.
* **Premium Features:** Şəxsi bulud anbarı (R2 genişlənməsi), xüsusi AI limitləri.
* **Marketplace & Creator Economy:** Təlimçilərin və kurs yaradıcılarının öz məzmunlarını və ya xidmətlərini (Mentorluq) sata biləcəyi daxili bazar.
* **Sponsorship Model & API Monetization:** Korporativ sponsorluqlar və xarici proqramçılar üçün ödənişli API çıxışları.

### 3. Technical Architecture (Texniki Memarlıq)

Mühəndislər və Açıq Mənbə (Open Source) töhfəçiləri üçün ən vacib istinad mərkəzi:

* **System & Cloudflare Architecture:** V8 Isolates, Edge Computing və D1/KV sinxronizasiyasının tam arxitektur diaqramları.
* **Microservice Roadmap & Event-Driven Design:** Gələcəkdə monolitdən mikroservislərə və hadisəyönümlü (Event-Driven) arxitekturaya keçid planı.
* **Service Layer & API Design Guide:** REST və qismən GraphQL üçün standartlar, endpoint strukturlaşdırması.
* **Database Standards & Naming Conventions:** SQL yazılış standartları, dəyişən (variable) adlandırma konvensiyaları.
* **Folder Structure & Security Architecture:** Backend/Frontend qovluq iyerarxiyası və təhlükəsizlik halqaları.

### 4. AI Strategy (Süni İntellekt Strategiyası)

Collabix-in rəqabət üstünlüyü - Süni İntellekt mərkəzli (AI-First) həllər:

* **AI Vision, Principles, Ethics, Privacy:** Süni intellektin istifadəsində əxlaqi sərhədlər və istifadəçi məlumatlarının məxfiliyi.
* **AI Models, Providers, Agents:** Llama, OpenAI və ya Cloudflare Workers AI kimi modellərin seçimi və inteqrasiyası.
* **AI Memory & AI Assistant Roadmap:** İstifadəçinin kod yazma vərdişlərini xatırlayan (Long-term memory) və ona spesifik mentorluq edən fərdi AI köməkçisi.

### 5. Security Documentation (Təhlükəsizlik və Məxfilik)

Zero-Trust (Sıfır Güvən) modeli üzrə dərin təhlükəsizlik qaydaları:

* **Zero Trust, Authentication & Authorization:** PBKDF2, JWT və TOTP (2FA) ilə çoxqatlı qorunma mexanizmləri.
* **Role-Based Access Control (RBAC):** İş sahələrində (Workspace) və qlobalda istifadəçi səlahiyyətlərinin (Admin, Moderator, Member) idarə edilməsi.
* **Encryption, Secrets Management & Rate Limiting:** Verilənlərin şifrələnməsi, `.dev.vars` idarəsi və DDoS hücumlarına qarşı sərt Rate Limitlər.
* **Audit Logs, Threat Modeling & OWASP Checklist:** Bütün sistem dəyişikliklərinin izlənməsi, təhdid modelləşdirməsi və OWASP Top 10 zəifliklərinə qarşı yoxlama siyahısı.

### 6. UX Documentation (İstifadəçi Təcrübəsi və Dizayn)

Təcrübənin və dizaynın bütün ekranlarda ardıcıllığını qorumaq üçün:

* **Design Language, UI Principles & UX Rules:** Collabix-in vizual dili (Cyberpunk/Minimalist) və təməl UX qaydaları.
* **Accessibility & Responsive Rules:** Görmə/eşitmə məhdudiyyətli istifadəçilər üçün əlçatanlıq (WCAG) və mobil/planşet uyğunluğu.
* **Typography, Color System & Iconography:** Rəsmi şriftlər (Məs: Inter, Fira Code), Matrix-yaşıl və Tünd-boz rəng paletləri.
* **Animation Standards & Component Guidelines:** Kətan (Canvas) effektləri, səhifə keçidləri və təkrar istifadə edilə bilən UI komponentləri.

### 7. Community Strategy (İcma və İdarəetmə)

Collabix-in sosial mərkəzi olduğu üçün mütləq icma qanunları:

* **Community Rules & Moderation:** Platformadaxili davranış qaydaları və moderatorların iş prinsipləri.
* **Reputation, XP & Badge Philosophy:** Təcrübə xallarının (XP) verilmə düsturları, reputasiya qazanma yolları və nişanların (Badges) iyerarxiyası.
* **Anti-Spam & Anti-Toxicity Policies:** Təhqir, nifrət nitqi və spam göndərişlərinin avtomatik (AI ilə) və manual filtrlənməsi.
* **Reporting System, Trust Score & Verification:** Şikayət mexanizmi, istifadəçilərin etibarlılıq xalı və "Mavi Tik" (Verified) doğrulama sistemi.

### 8. Developer Documentation (Tərtibatçı və İntegrasiya sənədləri)

Açıq Mənbə və xarici inteqrasiyalar üçün mərkəz:

* **API & SDK Documentation:** Üçüncü tərəf (Third-party) tətbiqlər üçün Collabix API-nin istifadə qaydaları.
* **CLI & Webhook Guides:** Avtomatlaşdırma üçün Webhook-ların qurulması və ehtimal olunan Collabix CLI aləti.
* **Integration Guide:** GitHub, GitLab və Jira kimi kənar sistemlərlə birləşmə təlimatları.
* **Plugin, Extension & Theme Systems:** İcma tərəfindən yaradıla biləcək əlavələr və fərdi UI temalarının hazırlanması standartları.

### 9. Operations (Ops, DevOps & SRE)

Məhsul kommersiyalaşdıqda dayanıqlıq üçün:

* **Incident Response & Monitoring:** Sistem çöküşlərinə (Downtime) anında reaksiya qaydaları və canlı monitorinq.
* **Alerting, Logging & Backup:** Adminlərə gedən avtomatik xəbərdarlıqlar, Cloudflare D1 məlumat bazasının avtomatik ehtiyat nüsxələnməsi (Backup).
* **Disaster Recovery & Scaling Plan:** Fəlakət anında sistemin bərpası və ani istifadəçi artımında (Viral böyümə) serverin miqyaslanması.
* **SLA, SLO & Error Budgets:** Xidmət Səviyyəsi Razılaşmaları (SLA) və icazə verilən xəta marjaları.

### 10. Future Vision (Gələcəyin Vizyonu)

Layihənin epik səviyyədə qlobal böyümə planı:

* **1, 3, 5 və 10 İllik Planlar:** Qısamüddətli (İcma böyütmə) və uzunmüddətli (Qlobal sənaye standartı olmaq) hədəflərin xronologiyası.
* **Global Expansion:** Çoxdilliliyin (i18n) genişləndirilməsi və beynəlxalq bazarlara çıxış.
* **AI-First & Enterprise Strategies:** Süni intellektin tətbiqin nüvəsinə çevrilməsi və böyük şirkətlərin (Enterprise) platformaya cəlbi.
* **Education, Startup & Open Source Strategies:** Universitetlərlə əməkdaşlıq, startaplar üçün inkubasiya mühiti və Open Source fəlsəfəsinin qorunması.

---

## 👤 9. Müəllif və İnkişaf etdirici (Developer Profile)

**Təhməz Muradov**  
*Founder • Full Stack Developer • Software Architect • AI & Cloud Engineer*

### Haqqımda

Mən proqram təminatının hazırlanmasına sistemli və uzunmüddətli yanaşan Full Stack Developer və Software Architect-əm. Məqsədim yalnız işləyən tətbiqlər hazırlamaq deyil, gələcəkdə milyonlarla istifadəçini dəstəkləyə biləcək miqyaslana bilən, təhlükəsiz və davamlı proqram platformaları yaratmaqdır.

İnkişaf etdirdiyim layihələrdə kod yazmaqla yanaşı, məhsul strategiyası, proqram arxitekturası, təhlükəsizlik, istifadəçi təcrübəsi və infrastruktur planlaşdırılmasına da xüsusi diqqət yetirirəm. Mənim üçün proqramlaşdırma yalnız funksionallıq deyil, həm də uzunömürlü və idarəolunan sistemlər qurmaq deməkdir.

### İxtisaslaşma & Əsas Bacarıqlar

* **İxtisaslar:** Full Stack Web Development, Backend Architecture, Cloud Computing, Software Architecture, Artificial Intelligence Integration, Database Design, DevOps, API Development, Cyber Security, System Optimization.
* **Təməl Konseptlər:** Clean Architecture, Event-Driven Architecture, Service-Oriented Design, REST API Design, Authentication & Authorization, Performance Optimization, Real-Time & Distributed Systems, Cloud Native Development.
* **Maraq Sahələri:** Süni İntellekt (AI/ML), LLM, Developer Platformaları, Məhsuldarlıq Alətləri, Kibertəhlükəsizlik, Avtomatlaşdırma, Developer Experience (DX) və Human-Centered Software Design.

### Texnologiya Yığını (Tech Stack)

* **Backend:** TypeScript, JavaScript, C#, .NET, Python, Java, Node.js
* **Frontend:** React, TypeScript, HTML5, CSS3, Tailwind CSS, Responsive Design
* **Database:** Cloudflare D1, Microsoft SQL Server, SQLite, PostgreSQL
* **Cloud & DevOps:** Cloudflare Workers (D1, R2, KV, Durable Objects, Queues, Workflows, Workers AI, AI Gateway, Vectorize), Git, GitHub, Docker, CI/CD, Wrangler CLI

### İş və İnkişaf Prinsipləri

Hər yeni layihəyə texniki keyfiyyət, istifadəçi təcrübəsi və gələcək genişlənmə imkanlarını birlikdə nəzərə alaraq yanaşıram. Tətbiq etdiyim prinsiplər:

* Sadə və oxunaqlı kod, Modul arxitektura, Təhlükəsizlik və Performans.
* Miqyaslana bilən sistemlər, Yenidən istifadə oluna bilən komponentlər, Avtomatlaşdırma.
* Davamlı inkişaf, Mükəmməl sənədləşdirmə və Test edilə bilən proqram təminatı.

### Hazırkı və Gələcək Məqsədim

Hazırda ən böyük layihəm olan **Collabix** üzərində çalışıram. Collabix proqramçılar, texnologiya komandaları və İT mütəxəssisləri üçün tam Cloudflare Native arxitekturası üzərində qurulmuş, yüksək performanslı bir əməkdaşlıq platformasıdır.

**Hədəfim:** Proqramçılar üçün gündəlik istifadə olunan müxtəlif xidmətləri vahid platformada birləşdirən, süni intellektlə zənginləşdirilmiş, müasir və qlobal səviyyədə istifadə oluna biləcək Developer Ecosystem qurmaqdır. Bu ekosistem proqramçıların öyrənməsi, komanda ilə işləməsi, layihələrini idarə etməsi, bilik paylaşması və peşəkar inkişafını dəstəkləyən inteqrasiya olunmuş mühit olacaqdır.

---

*Əlavə sənədlər (Cloudflare miqrasiyası, PRD Tərtibatı, TDD dizayn sənədləri) layihənin `/docs` qovluğunda tapıla bilər.*
