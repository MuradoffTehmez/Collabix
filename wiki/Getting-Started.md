# 🚀 Quraşdırma Təlimatı (Getting Started)

> Bu səhifədə Collabix layihəsini lokal mühitdə necə quraşdırmaq, konfiqurasiya etmək və işə salmaq izah olunur.

---

## 📋 Sistem Tələbləri

Collabix-i lokal olaraq işə salmaq üçün aşağıdakı alətlər lazımdır:

| Alət | Minimum Versiya | Məqsəd |
|------|----------------|--------|
| **Node.js** | v20.0+ | JavaScript runtime mühiti |
| **npm** | v10.0+ | Paket meneceri |
| **Wrangler CLI** | v4.0+ | Cloudflare Workers lokal emulyatoru |
| **Git** | v2.40+ | Versiya idarəetməsi |

### Opsional Alətlər

| Alət | Məqsəd |
|------|--------|
| **VS Code** | Tövsiyə olunan IDE |
| **Playwright** | E2E testlər üçün |
| **Prettier** | Kod formatlaması |

---

## 📥 1. Addım: Layihəni Klonlayın

```bash
git clone https://github.com/MuradoffTehmez/Collabix.git
cd Collabix
```

---

## 📦 2. Addım: Asılılıqları Yükləyin

```bash
npm install
```

Bu əmr `package.json`-dakı bütün asılılıqları (`dependencies` + `devDependencies`) yükləyəcək:

### Əsas Asılılıqlar (Runtime)

| Paket | Versiya | Təyinat |
|-------|---------|---------|
| `dompurify` | ^3.1.6 | XSS qoruması — HTML sanitizasiyası |
| `highlight.js` | ^11.10.0 | Kod blokları üçün syntax highlighting |
| `marked` | ^12.0.2 | Markdown → HTML çeviricisi |
| `qrcode-generator` | ^2.0.4 | 2FA/TOTP üçün QR kod yaratma |
| `workers-og` | ^0.0.27 | OG şəkillərinin canlı renderi |

### İnkişaf Asılılıqları (Dev)

| Paket | Versiya | Təyinat |
|-------|---------|---------|
| `wrangler` | ^4.118.0 | Cloudflare Workers CLI |
| `vite` | ^5.4.8 | Frontend build aləti |
| `vitest` | ^4.1.10 | Unit test çərçivəsi |
| `@playwright/test` | ^1.61.1 | E2E test çərçivəsi |
| `typescript` | ^5.5.4 | TypeScript kompilyatoru |
| `eslint` | ^10.8.0 | Kod keyfiyyəti analizi |
| `prettier` | ^3.9.6 | Kod formatlaması |

---

## 🗄️ 3. Addım: Lokal Verilənlər Bazasını Hazırlayın

Collabix Cloudflare D1 (SQLite əsaslı) verilənlər bazasını istifadə edir. Lokal inkişaf üçün Wrangler özü SQLite emulyatoru təmin edir.

### Miqrasiyaları Tətbiq Edin

```bash
npm run db:migrate:local
```

Bu əmr `migrations/` qovluğundakı **54 SQL miqrasiya faylını** ardıcıllıqla icra edəcək:

```
migrations/
├── 0001_init.sql                    # Əsas 15 cədvəl (users, posts, comments...)
├── 0002_seed.sql                    # Default taksonomiyalar və test datası
├── 0009_sessions_security.sql       # Sessiya təhlükəsizliyi
├── 0011_mfa_totp.sql                # İki mərhələli təsdiq (2FA)
├── 0014_schema_team.sql             # Komanda strukturu
├── 0031_prd_rbac.sql                # Rol əsaslı icazə sistemi
├── 0049_notification_center.sql     # Bildiriş mərkəzi
├── 0054_workspace.sql               # İş sahələri
└── ... (cəmi 54 fayl)
```

> ⚠️ **Vacib:** Miqrasiyalar sıra ilə icra olunmalıdır. Heç bir faylı əl ilə silməyin və ya sıranı dəyişməyin.

---

## 🔑 4. Addım: Mühit Dəyişənlərini Konfiqurasiya Edin

### `.dev.vars` Faylını Yaradın

Lokal inkişaf üçün layihənin kök qovluğunda `.dev.vars` faylı yaradın:

```env
# JWT əsas açarı — sessiya tokenləri üçün
JWT_SECRET=your-super-secret-key-at-least-48-chars-long

# Turnstile gizli açar (opsional — boş saxlasanız bot qoruması sönür)
TURNSTILE_SECRET=

# Resend API açarı (opsional — email funksiyası üçün)
RESEND_API_KEY=
```

> 📌 **Qeyd:** `.dev.vars` faylı `.gitignore`-a əlavə olunub və heç vaxt repository-yə push edilməyəcək.

### Wrangler Konfiqurasiyası

`wrangler.jsonc` faylında əsas konfiqurasiyalar artıq qurulub:

| Dəyişən | Dəyər | Təsvir |
|---------|-------|--------|
| `ENVIRONMENT` | `production` | Mühit tipi |
| `EMAIL_FROM` | `onboarding@resend.dev` | Email göndərici ünvanı |
| `APP_NAME` | `Collabix` | Tətbiq adı |
| `SITE_ORIGIN` | `https://collabix.muradofftehmez01.workers.dev` | Kanonik URL |
| `TURNSTILE_SITE_KEY` | `0x4AAA...` | Turnstile açıq açarı |
| `ARCHIVE_HOT_DAYS` | `90` | Mesaj arxivləmə müddəti (gün) |

---

## 🚀 5. Addım: İnkişaf Serverini İşə Salın

```bash
npm run dev
```

Bu əmr **iki prosesi** eyni anda işə salır:

1. **Vite** — Frontend fayllarını build edir (JS/CSS bundling)
2. **Wrangler** — Cloudflare Workers lokal emulyatorunu işə salır

Server başladıqdan sonra:

```
🌐 Brauzerdə açın: http://localhost:8787
```

### Mövcud NPM Skriptləri

| Skript | Əmr | Təsvir |
|--------|------|--------|
| `dev` | `npm run dev` | Lokal inkişaf serveri |
| `build` | `npm run build` | Vite production build |
| `deploy` | `npm run deploy` | Cloudflare-ə deploy |
| `lint` | `npm run lint` | ESLint kod analizi |
| `lint:fix` | `npm run lint:fix` | Avtomatik lint düzəltmə |
| `typecheck` | `npm run typecheck` | TypeScript tip yoxlaması |
| `test:unit` | `npm run test:unit` | Vitest unit testlər |
| `test:unit:watch` | `npm run test:unit:watch` | İzləmə rejimində testlər |
| `e2e` | `npm run e2e` | Playwright E2E testlər |
| `e2e:ui` | `npm run e2e:ui` | Playwright UI rejimi |
| `db:migrate:local` | `npm run db:migrate:local` | Lokal DB miqrasiyası |
| `db:migrate:remote` | `npm run db:migrate:remote` | Remote DB miqrasiyası |
| `format` | `npm run format -- <fayl>` | Kod formatlaması (tək fayl) |

> ⚠️ **Diqqət:** `npm run format` əmrini bütün repo-ya TƏTBİQ ETMƏYİN — bu `git blame` tarixçəsini məhv edir. Yalnız dəyişdirdiyiniz fayla tətbiq edin: `npm run format -- js/feed.js`

---

## 🧪 6. Addım: Testləri İşə Salın

### Unit Testlər (Vitest)

```bash
npm run test:unit
```

### E2E Testlər (Playwright)

```bash
# İlk dəfə — brauzerləri yükləyin
npx playwright install

# E2E testləri işə salın
npm run e2e

# UI rejimində (vizual debug)
npm run e2e:ui
```

### Tip Yoxlaması (TypeScript)

```bash
npm run typecheck
```

---

## 📁 Layihə Strukturu

```
Collabix/
├── 📁 js/                 # Frontend Vanilla JS Modulları (59 fayl)
├── 📁 css/                # Qlobal stil faylları
├── 📁 worker/             # Backend — Cloudflare Workers (TypeScript)
│   ├── 📁 events/         # Event qəbulediciləri
│   ├── 📁 jobs/           # Cron işləri
│   ├── 📁 middleware/     # Auth, WAF, Security Guard
│   ├── 📁 providers/      # Email, AI xidmətləri
│   ├── 📁 services/       # Biznes məntiqləri
│   ├── 📁 routes/         # API yönləndirmələri
│   └── 📁 workflows/      # Workflow axınları
├── 📁 migrations/         # D1 SQL miqrasiya faylları (54 fayl)
├── 📁 docs/               # Sənədlər (40+ fayl)
├── 📁 e2e/                # Playwright E2E testlər
├── 📁 scripts/            # Build/deploy skriptləri
├── 📁 public/             # Statik aktivlər
├── 📁 dist/               # Vite build çıxışı
├── 📄 index.html          # SPA əsas HTML çərçivəsi
├── 📄 wrangler.jsonc      # Cloudflare konfiqurasiyası
├── 📄 vite.config.ts      # Vite build konfiqurasiyası
├── 📄 package.json        # NPM asılılıqları və skriptlər
├── 📄 tsconfig.json       # TypeScript konfiqurasiyası
└── 📄 eslint.config.js    # ESLint qaydaları
```

---

## ❓ Problem yaşayırsınız?

- 📖 [Troubleshooting](Troubleshooting) səhifəsinə baxın
- 💬 [GitHub Discussions](https://github.com/MuradoffTehmez/Collabix/discussions) bölməsində sual soruşun
- 🐛 [Bug Report](https://github.com/MuradoffTehmez/Collabix/issues/new?template=bug_report.md) göndərin

---

**Növbəti:** [Sistem Arxitekturası →](Architecture)
