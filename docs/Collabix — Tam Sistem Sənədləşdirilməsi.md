# Collabix — Tam Sistem Sənədləşdirilməsi

> **Versiya:** 2.0.0 · **Arxitektura:** Cloudflare Workers + D1 + R2 + KV + Durable Objects
> **Təyinat:** Proqramlaşdırma və xarici dilləri birlikdə öyrənmək üçün 18+ icma platforması

---

## 1. Texnologiya Yığınları (Tech Stack)

### 1.1 Backend — Cloudflare Workers Runtime

| Texnologiya | Rol | Konfiqurasiya |
|---|---|---|
| **Cloudflare Workers** | Serverless compute (V8 Isolates) | [wrangler.jsonc](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/wrangler.jsonc) |
| **D1 (SQLite)** | Əsas relational verilənlər bazası | `collabix-db` binding |
| **R2** | Object storage (avatar, post şəkilləri, mesaj faylları) | `collabix-files` bucket |
| **KV** | Session storage + Rate limiting + Kiçik keşlər | `SESSIONS` namespace |
| **Durable Objects** | Real-time WebSocket fan-out (otaq + presence) | `RoomDO`, `PresenceDO` |
| **TypeScript** | Backend dili (ES2022 strict) | [tsconfig.json](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/tsconfig.json) |
| **workers-og** | Server-side OG image generation (Satori + resvg-wasm) | `@0.0.27` |

### 1.2 Frontend — Vanilla JS SPA

| Texnologiya | Rol | Versiya |
|---|---|---|
| **Vanilla JavaScript (ES Modules)** | SPA tətbiq qatı — framework yoxdur | — |
| **Vite** | Build tool (esbuild minification, code splitting, hashing) | `^5.4.8` |
| **DOMPurify** | HTML sanitizasiyası (XSS qorunması) | `^3.1.6` |
| **highlight.js** | Kod syntax highlighting (lazy-loaded) | `^11.10.0` |
| **marked** | Markdown → HTML rendering | `^12.0.2` |
| **simple-icons** | Texnologiya loqoları (build-time, SVG) | `^16.27.0` |
| **Vanilla CSS** | 124KB styling (glassmorphism, dark mode, responsive) | [styles.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/styles.css) |
| **Google Fonts** | Space Grotesk · Inter · JetBrains Mono | `display=swap` |

### 1.3 Test & DevOps

| Texnologiya | Rol |
|---|---|
| **Playwright** | E2E browser testi (desktop Chrome + Pixel 7) |
| **Wrangler** | Cloudflare CLI (dev/deploy/migrate) |
| **Vite build** | Production bundle: hashed assets, vendor chunk splitting |

---

## 2. Layihə Strukturu

```
Collabix/
├── worker/                  # 🖥️ Backend (Cloudflare Worker)
│   ├── index.ts             # Worker entry: routing, security headers, SEO
│   ├── routes.ts            # Bütün REST API handler-ləri (1577 sətir)
│   ├── auth.ts              # PBKDF2 password hashing, JWT, KV sessions
│   ├── util.ts              # Ortaq tipler (Env, Ctx), mappers, helpers
│   ├── seo.ts               # Server-side SEO: meta injection, sitemap, robots
│   ├── og.ts                # Dinamik OG preview şəkilləri (workers-og)
│   ├── room-do.ts           # RoomDO — WebSocket fan-out (hər otağa bir DO)
│   └── presence-do.ts       # PresenceDO — qlobal online/offline real-time
│
├── js/                      # 🎨 Frontend (34 modul)
│   ├── app.js               # Tətbiq qabığı: auth, naviqasiya, boot
│   ├── api.js               # REST client + polling manager
│   ├── auth.js              # Client auth: login/register/logout
│   ├── store.js             # State management (reactive polling)
│   ├── feed.js              # Block-based post feed, like, comment, bookmark
│   ├── composer.js          # Post yaratma editoru (blok-based)
│   ├── chat.js              # Otaq mesajları (real-time WebSocket)
│   ├── dm.js                # Şəxsi mesajlar (DM)
│   ├── users.js             # İstifadəçi kataloqu, profil modal
│   ├── profile.js           # Öz profili: redaktə, heatmap, nişanlar
│   ├── admin.js             # Admin paneli (807 sətir)
│   ├── notify.js            # Bildiriş sistemi
│   ├── tasks.js             # Tapşırıq sistemi (yaratma, həll, baxış)
│   ├── stats.js             # Statistika və leaderboard
│   ├── settings.js          # İstifadəçi parametrləri
│   ├── wizard.js            # 4 addımlı qeydiyyat sihirbazı
│   ├── i18n.js              # 3 dil dəstəyi (AZ/EN/RU) — 729 sətir
│   ├── presence.js          # Online/offline presence (WS + poll fallback)
│   ├── public.js            # Public landing: vitrin, FAQ, about, legal
│   ├── legal.js             # Hüquqi sənədlər (privacy, terms, cookies)
│   ├── heatmap.js           # GitHub-tipli aktivlik xəritəsi
│   ├── sparkline.js         # Admin sparkline qrafikləri
│   ├── mention.js           # @username qeyd sistemi (autocomplete)
│   ├── markdown.js          # Markdown render wrapper
│   ├── richmsg.js           # Zəngin mesaj rendering (fayl, şəkil, kod)
│   ├── taxonomy.js          # Skill/dil taksonomiyası idarəsi
│   ├── palette.js           # Ctrl+K command palette
│   ├── particles.js         # Landing/auth ekranı particle animasiyaları
│   ├── icons.js             # Lucide SVG ikon fabriki
│   ├── cookies.js           # Cookie consent banner
│   ├── techlogos.js         # Texnologiya loqoları render
│   ├── techlogos.data.js    # SVG data (build-time generated)
│   ├── ui.js                # Modal, toast, tema, skeleton components
│   └── util.js              # DOM helpers (el(), avatarNode, bus...)
│
├── migrations/              # 📊 D1 Database migrations (8 fayl)
├── migration-cf/            # 🔄 Firestore → D1 miqrasiya scriptləri
├── e2e/                     # 🧪 Playwright E2E testləri (12 fayl)
├── scripts/                 # 🛠️ Build-time scriptləri
├── docs/                    # 📝 Sənədlər (16 fayl)
├── dist/                    # 📦 Vite build output
├── index.html               # SPA shell (998 sətir, SEO meta)
├── styles.css               # Master stylesheet (124KB)
└── wrangler.jsonc           # Cloudflare Worker konfiqurasiyası
```

---

## 3. Backend Arxitekturası

### 3.1 Request İşləmə Axını

```
Browser Request
      │
      ▼
┌─────────────────────────┐
│   Cloudflare Edge       │ ← /assets/* birbaşa edge-dən (Worker işə düşmür)
│   (CDN + WAF + DDoS)    │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│   Worker (index.ts)     │
│   ├── CORS preflight    │
│   ├── SEO files         │ ← /robots.txt, /sitemap.xml, /llms.txt
│   ├── OG images         │ ← /og/post/:id.png, /og/user/:name.png
│   ├── R2 files          │ ← /files/* (auth required)
│   ├── WebSocket upgrade │ ← /api/rooms/:id/ws, /api/presence/ws
│   ├── API routing       │ ← /api/*
│   │   ├── Rate Limit    │
│   │   ├── resolveUser() │ ← Cookie → JWT → KV Session → DB user
│   │   ├── isAdmin check │
│   │   ├── Route handler │
│   │   └── Security hdrs │
│   └── SPA fallback      │ ← Public pages (HTMLRewriter meta injection)
└─────────────────────────┘
```

### 3.2 Worker Entry ([index.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/worker/index.ts))

**325 sətir** — əsas routing, security headers, SEO handling:

- **Route registry**: 92 REST endpoint (method + regex pattern + handler + auth/admin/rate-limit flags)
- **Security Headers**: CSP, HSTS (preload), X-Frame-Options (DENY), COOP/CORP, Permissions-Policy
- **SEO**: robots.txt, sitemap.xml (D1-dən dinamik), llms.txt, per-route meta injection (HTMLRewriter)
- **WebSocket**: RoomDO (otaq real-time) + PresenceDO (online/offline) upgrade handling

### 3.3 Auth Sistemi ([auth.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/worker/auth.ts))

| Komponent | Detallar |
|---|---|
| **Password hashing** | PBKDF2 (SHA-256, 100K iterations, 16B salt) — WebCrypto API |
| **JWT** | HS256, HttpOnly cookie (`cx_sess`), 30 gün TTL |
| **Session** | KV-da `sess:{uid}:{jti}` açarı, TTL ilə avtomatik expiry |
| **Revocation** | `destroySession()` (single), `destroyAllSessions()` (all tabs) |
| **Rate Limit** | KV-based sliding window: auth(10/5min), write(60/1min), upload(30/1hr), form(5/1hr) |
| **Timing-safe** | Password compare timing-safe XOR (side-channel attack qorunması) |

### 3.4 Routing & API ([routes.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/worker/routes.ts))

**1587 sətir** — bütün business logic. Heç bir framework istifadə edilmir.

### 3.5 Durable Objects

#### RoomDO ([room-do.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/worker/room-do.ts))
- Hər otağa bir Durable Object instansı (`idFromName(roomId)`)
- **Hibernation API** — boş duran DO yaddaşda saxlanılmır
- `broadcast(payload)` — RPC: bütün bağlı client-lərə siqnal
- Client-dən yalnız `typing` hadisəsi qəbul edilir
- Mesaj persistence D1-dədir — DO yalnız fan-out siqnal göndərir

#### PresenceDO ([presence-do.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/worker/presence-do.ts))
- Tək qlobal instans (`idFromName('global')`)
- Real-time online/offline broadcast (`snapshot`, `on`, `off` hadisələri)
- Çox-tab dəstəyi: eyni uid-li bütün soketlər sayılır, sonuncusu bağlananda `off`
- `push(uid, payload)` — RPC: konkret istifadəçiyə siqnal (bildiriş/DM)
- Privacy: `hidden=true` → başqalarına görünmür, amma öz bildirişlərini alır

### 3.6 SEO Sistemi ([seo.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/worker/seo.ts))

| Funksiya | Açıqlama |
|---|---|
| `matchPublicRoute()` | Path → page/param/locale parsing (locale prefix: /en/, /ru/) |
| `buildMeta()` | Per-route meta tags (title, desc, canonical, OG, JSON-LD) |
| `rewriteHead()` | HTMLRewriter ilə shell HTML-ə meta injection |
| `buildRobots()` | D1-dən dinamik robots.txt |
| `buildSitemap()` | D1-dən dinamik XML sitemap (posts + users + static pages) |
| `buildLlms()` | LLM crawler üçün llms.txt |
| **JSON-LD sxemləri** | Organization, WebApplication, FAQPage, BreadcrumbList, Article, ProfilePage |
| **Hreflang** | az/en/ru + x-default alternativ URL-lər |

### 3.7 OG Image Generation ([og.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/worker/og.ts))

- **workers-og** kitabxanası: HTML+CSS → SVG (Satori) → PNG (resvg-wasm)
- 3 növ: `/og/default.png` (brend), `/og/post/:id.png` (post preview), `/og/user/:name.png` (profil)
- 8 saniyə render timeout + statik fallback
- `caches.default` ilə edge caching, `?v=updated_at` cache bust

---

## 4. Verilənlər Bazası (D1 / SQLite)

### 4.1 Cədvəl Siyahısı

8 migration faylı ilə qurulmuş **26 cədvəl**:

| Cədvəl | Sütun sayı | Təyinat | Migration |
|---|---|---|---|
| `users` | 38 | İstifadəçi profilləri, auth, XP, streak | 0001 |
| `posts` | 15 | Paylaşımlar (block-based, repost/quote) | 0001+0003-0005 |
| `comments` | 8 | Rəylər (thread + like) | 0001+0008 |
| `comment_likes` | 3 | Rəy bəyənmələri | 0008 |
| `likes` | 3 | Post bəyənmələri | 0001 |
| `bookmarks` | 3 | Saxlanılanlar | 0001 |
| `follows` | 3 | İzləmə münasibətləri | 0001 |
| `post_shares` | 4 | Re-post toggle (idempotent) | 0005 |
| `rooms` | 4 | Söhbət otaqları | 0001 |
| `room_messages` | 12 | Otaq mesajları (text/image/file/code) | 0001 |
| `dm_threads` | 8 | DM thread meta (son mesaj, oxunma vəziyyəti) | 0001 |
| `dm_messages` | 13 | Şəxsi mesajlar | 0001 |
| `tasks` | 10 | Tapşırıqlar (pending/approved/rejected) | 0001 |
| `submissions` | 12 | Tapşırıq həlləri | 0001 |
| `reports` | 8 | Şikayətlər | 0001 |
| `admins` | 3 | Admin istifadəçilər | 0001 |
| `notifications` | 9 | Bildirişlər | 0001 |
| `taxonomies` | 9 | Skill/dil taksonomiyası | 0001 |
| `faqs` | 7 | FAQ məzmunu | 0001 |
| `testimonials` | 8 | İstifadəçi rəyləri | 0001 |
| `newsletter` | 3 | Newsletter abunəçiləri | 0001 |
| `contact_messages` | 6 | Əlaqə forması mesajları | 0001 |
| `admin_logs` | 8 | Admin audit jurnal | 0001+0007 |
| `progress` | 5 | Sahə üzrə irəliləyiş | 0001 |
| `presence` | 2 | Online vəziyyət (heartbeat) | 0001 |
| `stats_daily` | 6 | Gündəlik sparkline statistika | 0006 |

### 4.2 `users` Cədvəli (Əsas Sxema)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  age INTEGER DEFAULT 18,
  birth_date TEXT, gender TEXT, country TEXT, city TEXT, bio TEXT,
  contact_email TEXT, photo_url TEXT,
  prog_levels TEXT DEFAULT '{}',    -- JSON: {"Python":"Orta","JavaScript":"Qabaqcıl"}
  lang_levels TEXT DEFAULT '{}',    -- JSON: {"İngilis":"Başlanğıc"}
  goals TEXT, looking_for TEXT DEFAULT '[]',
  instagram TEXT, github TEXT, linkedin TEXT, telegram TEXT, website TEXT,
  streak INTEGER DEFAULT 0,        -- gündəlik seriay 🔥
  xp INTEGER DEFAULT 0,            -- təcrübə xalı ⚡
  tasks_completed INTEGER DEFAULT 0,
  last_active_day TEXT, last_active_at INTEGER,
  activity_days TEXT DEFAULT '{}',  -- JSON heatmap: {"2026-07-21": 3}
  joined_at INTEGER NOT NULL,
  blocked INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user',
  settings TEXT DEFAULT '{}',       -- JSON: {lang, theme, privacy, notifications}
  must_reset_password INTEGER DEFAULT 0,
  pass_hash TEXT NOT NULL,          -- PBKDF2 hash
  pass_salt TEXT NOT NULL           -- 16B hex salt
);
```

### 4.3 Mövcud İndekslər (25+)

```
idx_posts_created, idx_posts_author, idx_comments_post, idx_comments_parent,
idx_likes_user, idx_follows_target, idx_roommsg, idx_dmthreads_a/b, idx_dmmsg,
idx_tasks_status, idx_sub_user, idx_sub_status, idx_notif_user,
idx_users_dir_xp, idx_users_dir_active, idx_users_dir_username, idx_users_dir_joined,
idx_users_role, idx_users_verified, idx_tax_order,
idx_admin_logs_level, idx_admin_logs_time,
idx_post_shares_post, idx_post_shares_repost, idx_comment_likes_user
```

---

## 5. REST API Endpointləri (92 REST + 2 WebSocket)

> Saylar `worker/index.ts`-dəki `ROUTES` registry-dən maşınla sayılıb.

### 5.1 Auth (8 endpoint)

| Method | Path | Auth | Funksiya |
|---|---|---|---|
| POST | `/api/auth/register` | ✗ | Qeydiyyat (4 addımlı wizard) |
| POST | `/api/auth/login` | ✗ | Giriş (streak yeniləmə daxil) |
| POST | `/api/auth/logout` | ✗ | Çıxış (session destroy) |
| GET | `/api/auth/me` | ✗ | Session yoxla + profil qaytar |
| GET | `/api/auth/username-available` | ✗ | Username mövcudluğu yoxla |
| POST | `/api/auth/change-password` | ✓ | Şifrə dəyiş |
| POST | `/api/auth/change-username` | ✓ | Username dəyiş |
| DELETE | `/api/auth/account` | ✓ | Hesab sil (R2 təmizlə, cascade delete) |

### 5.2 Users & Profile (7 endpoint)

| Method | Path | Funksiya |
|---|---|---|
| GET | `/api/users` | Bütün istifadəçilər (keş — 500 limit) |
| GET | `/api/users/directory` | Katalog: sıralama + filtr + keyset pagination |
| PATCH | `/api/me` | Profil redaktəsi |
| PATCH | `/api/me/settings` | Parametrlər (dil, tema, privacy, bildiriş) |
| GET | `/api/me/social` | Like/bookmark/follow/repost vəziyyəti |
| GET | `/api/users/:uid/follow-lists` | İzləyənlər/izlədiklərim siyahısı |
| GET | `/api/users/:uid/progress` | Sahə üzrə irəliləyiş |

### 5.3 Social (4 endpoint)

| Method | Path | Funksiya |
|---|---|---|
| PUT | `/api/follows/:uid` | İzlə |
| DELETE | `/api/follows/:uid` | İzləmədən çıx |
| PUT | `/api/bookmarks/:pid` | Saxla |
| DELETE | `/api/bookmarks/:pid` | Saxlanılanlardan çıxar |

### 5.4 Posts (14 endpoint — `/api/feed` daxil)

| Method | Path | Funksiya |
|---|---|---|
| GET | `/api/feed` | Feed (60 post, repost JOIN) |
| GET | `/api/posts/:id` | Tək post |
| POST | `/api/posts` | Yeni post (block-based: text/code/image) |
| PATCH | `/api/posts/:id` | Post redaktə |
| DELETE | `/api/posts/:id` | Post sil (cascade: likes, comments, bookmarks, shares, R2) |
| POST | `/api/posts/:id/repost` | Re-post toggle (idempotent) |
| PUT | `/api/posts/:id/like` | Like |
| DELETE | `/api/posts/:id/like` | Unlike |
| GET | `/api/posts/:id/comments` | Rəylər (thread, sort, pagination) |
| POST | `/api/posts/:id/comments` | Yeni rəy (thread cavab dəstəyi) |
| PATCH | `/api/posts/:pid/comments/:cid` | Rəy redaktə |
| DELETE | `/api/posts/:pid/comments/:cid` | Rəy sil (cascade: cavablar + reaksiyalar) |
| PUT | `/api/posts/:pid/comments/:cid/like` | Rəy bəyən |
| DELETE | `/api/posts/:pid/comments/:cid/like` | Rəy bəyənməni geri al |

### 5.5 Rooms (7 endpoint)

| Method | Path | Auth | Funksiya |
|---|---|---|---|
| GET | `/api/rooms` | ✓ | Otaq siyahısı |
| POST | `/api/rooms` | Admin | Yeni otaq yarat |
| DELETE | `/api/rooms/:id` | Admin | Otaq sil |
| GET | `/api/rooms/:id/messages` | ✓ | Son 120 mesaj |
| POST | `/api/rooms/:id/messages` | ✓ | Mesaj göndər (text/image/file/code) |
| PATCH | `/api/rooms/:id/messages/:mid` | ✓ | Mesaj redaktə (yalnız müəllif) |
| DELETE | `/api/rooms/:id/messages/:mid` | ✓ | Mesaj sil |

### 5.6 DM (6 endpoint)

| Method | Path | Funksiya |
|---|---|---|
| GET | `/api/dms` | Thread siyahısı |
| GET | `/api/dms/:pairId/messages` | Son 150 mesaj |
| POST | `/api/dms/to/:uid` | Mesaj göndər (privacy siyasəti: everyone/followers/mutual) |
| PATCH | `/api/dms/:pairId/messages/:mid` | Mesaj redaktə |
| DELETE | `/api/dms/:pairId/messages/:mid` | Mesaj sil |
| POST | `/api/dms/:pairId/read` | Oxundu işarələ |

### 5.7 Presence & Notifications (5 endpoint)

| Method | Path | Funksiya |
|---|---|---|
| POST | `/api/presence` | Heartbeat (last_active_at yeniləmə) |
| GET | `/api/presence` | Presence map (2 dəq pəncərə) |
| GET | `/api/notifications` | Son 60 bildiriş |
| POST | `/api/notifications/read-all` | Hamısını oxundu et |
| POST | `/api/notifications/:id/read` | Tək bildirişi oxundu et |

### 5.8 Tasks & Submissions (7 endpoint)

| Method | Path | Auth | Funksiya |
|---|---|---|---|
| GET | `/api/tasks` | ✓ | Tapşırıq siyahısı (scope: approved/pending/mine) |
| POST | `/api/tasks` | ✓ | Yeni tapşırıq (admin: dərhal approved; user: pending) |
| POST | `/api/tasks/:id/review` | Admin | Təsdiq/rədd |
| DELETE | `/api/tasks/:id` | Admin | Tapşırıq sil |
| PUT | `/api/tasks/:id/submission` | ✓ | Həll göndər (upsert) |
| GET | `/api/submissions` | ✓ | Həllər (scope: mine/pending) |
| POST | `/api/submissions/:tid/:uid/review` | Admin | Həlli təsdiqlə (XP+50 verilir) |

### 5.9 Reports (3 endpoint)

| Method | Path | Auth | Funksiya |
|---|---|---|---|
| POST | `/api/reports` | ✓ | Şikayət yarat |
| GET | `/api/reports` | Admin | Açıq şikayətlər |
| PATCH | `/api/reports/:id` | Admin | Şikayəti həll et |

### 5.10 Admin (20 endpoint — taksonomiya `reorder` daxil)

| Method | Path | Funksiya |
|---|---|---|
| GET/POST/DELETE | `/api/admin/faqs` | FAQ CRUD |
| GET/POST/DELETE | `/api/admin/testimonials` | Rəy CRUD |
| GET/POST | `/api/admin/contacts` | Əlaqə mesajları |
| PATCH | `/api/admin/users/:uid` | İstifadəçi redaktə (role, verified, blocked, xp) |
| POST | `/api/admin/users/:uid/temp-password` | Müvəqqəti şifrə təyin et |
| GET/PUT/DELETE | `/api/admin/admins` | Admin idarəsi |
| GET | `/api/admin/logs` | Audit jurnal (level filtr + keyset pagination) |
| GET | `/api/admin/users` | İstifadəçi siyahısı (filtr + search + pagination) |
| POST | `/api/admin/users/bulk` | Toplu block/unblock |
| GET | `/api/admin/stats-daily` | Sparkline zaman seriyası (30/90 gün) |
| GET | `/api/admin/export/(users\|logs).csv` | CSV ixracı (stream, BOM+formula injection qorunması) |
| POST | `/api/taxonomies/(prog\|spoken)/reorder` | Taksonomiya sıralaması |

### 5.11 WebSocket Endpointlər (2)

| Path | Funksiya |
|---|---|
| `/api/rooms/:id/ws` | Otaq real-time (refresh + typing siqnalları) |
| `/api/presence/ws` | Qlobal presence (online/offline + push bildirişlər) |

### 5.12 Public (7 endpoint — auth tələb etmir)

| Method | Path | Funksiya |
|---|---|---|
| GET | `/api/public/faqs` | FAQ siyahısı |
| GET | `/api/public/testimonials` | Rəylər |
| GET | `/api/public/stats` | İstifadəçi/post sayı |
| GET | `/api/public/posts/:id` | Post (SSR/OG üçün) |
| GET | `/api/public/users/:name` | Profil (SSR/OG üçün) |
| POST | `/api/public/newsletter` | Newsletter abunə |
| POST | `/api/public/contact` | Əlaqə forması |

### 5.13 Taxonomy (3 endpoint)

| Method | Path | Auth | Funksiya |
|---|---|---|---|
| GET | `/api/taxonomies` | ✗ | Skill/dil taksonomiyası (public — wizard və filtrlər üçün) |
| POST | `/api/taxonomies/(prog\|spoken)` | Admin | Element əlavə/redaktə |
| DELETE | `/api/taxonomies/(prog\|spoken)/:id` | Admin | Elementi deaktiv et |

> `POST /api/taxonomies/(prog|spoken)/reorder` §5.10-da (admin) sayılıb.

### 5.14 Upload (1 endpoint)

| Method | Path | Auth | Funksiya |
|---|---|---|---|
| POST | `/api/upload` | ✓ | R2-yə fayl yükləmə (avatar 1MB / post şəkli 2MB, MIME whitelist, `upload` rate-limit) |

---

## 6. Frontend Modulları (Ətraflı)

### 6.1 Tətbiq Qabığı

| Modul | Fayl | Sətir | Funksiyalar |
|---|---|---|---|
| **App** | [app.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/app.js) | 497 | Auth UI, SPA routing (hash + real path), session lifecycle, onboarding tour, force-reset modal, sidebar render, badge sayları |
| **Store** | [store.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/store.js) | 641 | Qlobal state (authUser, me, users, likes, bookmarks, follows, reposts), polling watchers, API wrappers |
| **API** | [api.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/api.js) | 61 | REST client (`same-origin` credentials), `startPoll()` (interval + event-driven refresh + visibilitychange) |
| **Auth** | [auth.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/auth.js) | 87 | `watchAuthState()`, `register()`, `login()`, `logout()`, `changePassword()`, `changeUsername()`, `deleteAccount()` |

### 6.2 Funksional Modullar

| Modul | Fayl | Sətir | Funksiyalar |
|---|---|---|---|
| **Feed** | [feed.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/feed.js) | 1011 | Block-based post rendering (text/code/image blocks), like/unlike, bookmark, repost/quote, comment threads (1-level), comment like, "daha çox oxu", post detail page, `Saxlanılanlar` tab, feed tab switching (Hamısı/İzlədiklərim), Lucide SVG icons, glassmorphism cards |
| **Composer** | [composer.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/composer.js) | 7513B | Block-based post editor (text + code + image blocks), image upload, tag selection, quote attachment |
| **Chat** | [chat.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/chat.js) | 193 | Otaq mesajları: real-time WebSocket (typing indicator, refresh signal), otaq keçidi, mesaj göndər/redaktə/sil, fayl paylaşımı |
| **DM** | [dm.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/dm.js) | 175 | Şəxsi mesajlar: thread siyahısı, unread badge, mesaj göndər/redaktə/sil, oxundu statusu, online göstərici |
| **Users** | [users.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/users.js) | 19110B | İstifadəçi kataloqu: axtarış, skill/səviyyə/məqsəd filtri, sıralama (yeni/XP/aktiv/əlifba), keyset pagination, profil modal, follow/unfollow, DM başlatma, report |
| **Profile** | [profile.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/profile.js) | 412 | Öz profil: avatar yüklə/sil, ad/bio/sosial redaktə, skill picker, heatmap widget, irəliləyiş qrafikləri, level/XP/streak göstəriciləri, izləyən/izləyici siyahısı, öz postlarının idarəsi |
| **Tasks** | [tasks.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/tasks.js) | 9276B | Tapşırıq sistemi: yaratma (kateqoriya seçimi), həll göndərmə (kod + link), admin baxışı (təsdiq/rədd), status izləmə |
| **Notifications** | [notify.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/notify.js) | 4349B | Bildiriş siyahısı, unread badge, hamısını oxundu et, bildiriş növləri (like, comment, follow, mention, DM, task, repost) |
| **Stats** | [stats.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/stats.js) | 7710B | Statistika: leaderboard (XP/streak/posts), sahə paylanması, online sayğac |
| **Admin** | [admin.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/admin.js) | 807 | Tam admin paneli: statistika kartları (sparkline), şikayət idarəsi, istifadəçi siyahısı (search/filter/pagination), toplu block, istifadəçi redaktəsi (role/verified/blocked/XP), müvəqqəti şifrə, admin idarəsi, otaq CRUD, FAQ/testimonial CRUD, əlaqə mesajları, taksonomiya idarəsi (drag-and-drop sıralama), audit jurnal (level filtr + pagination + terminal UI), CSV ixracı, seed tools |

### 6.3 Dəstək Modulları

| Modul | Fayl | Funksiya |
|---|---|---|
| **i18n** | [i18n.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/i18n.js) | 3 dil (AZ/EN/RU), 400+ açar, `t()` funksiyası, `data-i18n` atribut yenilənməsi, `fmtRelTime()` (nisbi vaxt) |
| **Wizard** | [wizard.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/wizard.js) | 4 addımlı qeydiyyat: Hesab → Şəxsi → Bacarıqlar → Sosial, skill-level picker, şifrə gücü göstəricisi, avatar crop, username real-time yoxlama |
| **Presence** | [presence.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/presence.js) | WebSocket (PresenceDO) + heartbeat poll fallback, exponential backoff reconnect (3s→30s cap), multi-tab-safe |
| **Settings** | [settings.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/settings.js) | Dil seçimi, tema seçimi, privacy (online status, following gizləmə, whoCanMessage), bildiriş tərcihləri |
| **Heatmap** | [heatmap.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/heatmap.js) | GitHub-tipli aktivlik xəritəsi (SVG), rəng intensivliyi, tooltip |
| **Sparkline** | [sparkline.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/sparkline.js) | Admin panel mini qrafik (SVG polyline) |
| **Mention** | [mention.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/mention.js) | @username autocomplete dropdown, `mentionify()` link çevirmə |
| **Markdown** | [markdown.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/markdown.js) | `marked` + `DOMPurify` wrapper |
| **RichMsg** | [richmsg.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/richmsg.js) | Fayl/şəkil/kod mesaj rendering, grouped messages (eyni müəllifin ardıcıl mesajları) |
| **Palette** | [palette.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/palette.js) | Ctrl+K command palette (fuzzy search) |
| **Particles** | [particles.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/particles.js) | Canvas particle animasiyaları (landing hero + auth ekranı) |
| **Public** | [public.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/public.js) | Landing page: hero, features, how-it-works, FAQ, testimonials carousel, about, contact, legal pages, kod vitrini, live stats widget, canlı trendlər |
| **Legal** | [legal.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/legal.js) | Privacy Policy, Terms, Cookies, Security, Changelog — çoxdilli default məzmun |
| **Util** | [util.js](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/js/util.js) | `el()` DOM builder, `avatarNode()`, event bus, highlight.js lazy loader, image resizer, `levelFromXP()`, `nameWithBadge()`, `fmtTime()`, XSS-safe URL yoxlama |

---

## 7. Təhlükəsizlik Qatları

| Qat | İmplementasiya |
|---|---|
| **Authentication** | PBKDF2 + HS256 JWT + KV Session (revocable) |
| **Authorization** | `auth: true` (giriş tələbi) + `admin: true` (admin yoxlaması) per route |
| **XSS** | `el()` DOM builder (innerHTML yoxdur), DOMPurify, CSP header |
| **CSRF** | SameSite=Lax cookie + same-origin credentials |
| **Injection** | D1 Prepared Statements (heç bir raw SQL interpolasiya) |
| **Rate Limiting** | KV sliding window (4 bucket: auth/write/upload/form) |
| **HSTS** | `max-age=63072000; includeSubDomains; preload` |
| **CSP** | `script-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'` |
| **Headers** | X-Content-Type-Options, X-Frame-Options, COOP, CORP, Permissions-Policy |
| **Password** | Timing-safe compare, server-side only, 6 char minimum |
| **File Upload** | Size limits (1MB avatar, 2MB post), MIME whitelist, `/files/` prefix validation |
| **CSV Export** | Formula injection qorunması (=, +, -, @ → apostrof prefix) |
| **Privacy** | `showOnlineStatus`, `showFollowing`, `whoCanMessage` (everyone/followers/mutual) |

---

## 8. Real-Time Sistemi

```
┌─────────────┐                    ┌──────────────┐
│ Browser Tab │ ←── WebSocket ───→ │  PresenceDO  │ ← qlobal online/offline
│             │                    │  (1 instans) │
│ presence.js │ ← snapshot/on/off  │              │
│   (tək WS)  │ ← notif / dm       │              │ ← worker RPC push(uid, …)
└──────┬──────┘                    └──────────────┘
       │ event bus (emit)
       ├─→ refresh-notifs          → notify.js poll-u dərhal tick edir
       ├─→ refresh-threads         → dm.js thread siyahısı
       └─→ refresh-dm-<pairId>     → dm.js açıq söhbət

┌─────────────┐                    ┌─────────────┐
│ Browser Tab │ ←── WebSocket ───→ │   RoomDO    │ ← hər otağa bir instans
│             │                    │ (per-room)  │
│   chat.js   │ → typing           │             │
│             │ ← refresh / typing │             │ ← worker RPC (yeni mesaj)
└─────────────┘                    └─────────────┘
```

**Fallback**: WS mümkün olmayanda polling qalır (heartbeat + `GET /api/presence`, interval-əsaslı feed/messages refresh).

---

## 9. XP və Level Sistemi (Mövcud)

| Hadisə | XP |
|---|---|
| Post yaratma | +10 |
| Şərh yazma | +5 |
| Tapşırıq həlli təsdiqlənməsi | +50 |
| Admin manual redaktə | İstənilən dəyər |

**Level formulu (kodda):** `Math.floor(Math.sqrt(xp / 100)) + 1`

> [!NOTE]
> XP artımı yalnız post yaratma və tapşırıq təsdiqlənməsində tətbiq olunur. PRD-dəki tam XP Engine hələ implementasiya olunmayıb.

---

## 10. E2E Test Strukturu

| Fayl | Əhatə |
|---|---|
| [home.spec.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/home.spec.ts) | Feed, post yaratma/silmə, like, bookmark |
| [admin.spec.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/admin.spec.ts) | Admin paneli smoke testi |
| [admin-level.spec.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/admin-level.spec.ts) | Admin XP redaktəsi → Lv törəməsi + `user-level-edit` audit jurnalı |
| [comments.spec.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/comments.spec.ts) | Rəy sistemi |
| [users.spec.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/users.spec.ts) | İstifadəçi kataloqu |
| [messages.spec.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/messages.spec.ts) | Otaq mesajları |
| [presence.spec.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/presence.spec.ts) | PresenceDO: WS snapshot + çox-tab dublikat qorunması |
| [realtime.spec.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/realtime.spec.ts) | RoomDO: otaq `refresh` broadcast + `typing` |
| [realtime-dm.spec.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/realtime-dm.spec.ts) | Bildiriş fan-out + canlı DM (iki sessiya) |
| [seed.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/seed.ts) | Test data hazırlığı |
| [global-setup.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/global-setup.ts) | Auth session + hesab hazırlığı |
| [helpers.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/e2e/helpers.ts) | Test yardımçıları |

**Platformalar:** Desktop Chrome + Mobile Pixel 7 · **Cari vəziyyət: 132/132 keçir**

> [!IMPORTANT]
> Lokal D1 bütün spec-lər arasında **paylaşılır və silinmir**. Verilənləri dəyişən test
> (məs. `admin-level.spec.ts` XP redaktəsi) dəyəri `finally`-də bərpa etməlidir —
> əks halda sonrakı spec-lər (`users.spec.ts` XP sıralaması) sonrakı işə salmalarda sınır.

---

## 11. Build & Deploy

```bash
# Lokal development
npm run dev        # vite build → wrangler dev (lokal D1/KV/R2)

# DB migration
npm run db:migrate:local    # lokal SQLite
npm run db:migrate:remote   # production D1

# Production deploy
npm run deploy     # vite build → wrangler deploy

# E2E test
npm run e2e        # Playwright (desktop + mobile)
```

### Vite Build ([vite.config.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/vite.config.ts))
- **Target:** esnext
- **Minify:** esbuild
- **Code splitting:** vendor chunk (`marked` + `dompurify`), CSS split
- **Output:** `dist/assets/[name]-[hash].js` (immutable cache)

---

## 12. Dil Dəstəyi (i18n)

| Dil | Kod | Status |
|---|---|---|
| Azərbaycan | `az` | Əsas dil (default) |
| English | `en` | Tam dəstək |
| Русский | `ru` | Tam dəstək |

- **400+ açar** (nav, hero, features, FAQ, settings, admin, feed, chat, legal...)
- `data-i18n` atributu ilə statik elementlər, `t('key')` ilə dinamik mətnlər
- Dil localStorage-da saxlanılır, serverdə `settings.lang` kimi
- URL locale prefix `/en/`, `/ru/` → SSR meta üçün, client-də strip olunur

---

## 13. PWA Dəstəyi

[manifest.webmanifest](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/manifest.webmanifest):
- **Display:** standalone
- **Orientation:** any
- **Categories:** education, social, productivity
- **Icons:** SVG (any) + PNG 192x192 + PNG 512x512 (maskable)
- **Theme color:** `#4a8fff` (dark) / `#2f6fe0` (light)

---

## 14. Miqrasiya Tarixi (Firestore → Cloudflare)

`migration-cf/` qovluğu layihənin əvvəlki Firebase/Firestore versiyasından Cloudflare-ə miqrasiya scriptlərini saxlayır:

| Fayl | Təyinat |
|---|---|
| `firestore-to-d1.mjs` | Firestore → D1 data transfer |
| `emulator-to-d1.mjs` | Firebase emulator → D1 |
| `backfill-images.mjs` | Firebase Storage → R2 şəkil miqrasiyası |
| `import.sql` | 60KB SQL import (seed data) |
| `update.sql` | Post-migration fixups |

---

## 15. Performans Xüsusiyyətləri

| Sahə | Detallar |
|---|---|
| **Edge caching** | Hashed assets `immutable` cache, HTML `no-cache` (ETag ilə 304) |
| **Lazy loading** | highlight.js yalnız kod bloku görünəndə yüklənir |
| **Keyset pagination** | OFFSET əvəzinə cursor-based (dərin səhifələrdə sabit sürət) |
| **D1 batch()** | Atomik çox-sorğu (cascade delete, bulk operations) |
| **Polling optimization** | `visibilitychange` event — tab gizli olanda poll dayandırılır |
| **WebSocket reconnect** | Exponential backoff (3s→30s cap), `wsAttempt` counter |
| **OG image cache** | `caches.default` edge cache, `?v=` bust |
| **Font preconnect** | `dns-prefetch` + `preconnect` (Google Fonts) |
| **Vendor splitting** | `marked` + `dompurify` ayrı chunk (dəyişməyən kitabxanalar cache-dən) |
