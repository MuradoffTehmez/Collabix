# 🏗️ Sistem Arxitekturası

> Collabix-in tam texniki arxitekturası — Cloudflare Native, Edge-First, Serverless monolit.

---

## 📐 Arxitektura İcmalı

Collabix **Cloudflare Edge şəbəkəsi** üzərində tamamilə serverless olaraq işləyir. Ənənəvi mərkəzləşdirilmiş serverlər (AWS EC2, DigitalOcean VPS) əvəzinə, bütün API sorğuları, verilənlər bazası əməliyyatları və statik aktivlər istifadəçiyə **coğrafi baxımdan ən yaxın qovşaqdan** anında çatdırılır.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        İSTİFADƏÇİ BRAUZERİ                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  app.js   │  │  feed.js  │  │  chat.js  │  │  59 ES Modul     │   │
│  │ (Router)  │  │  (Lent)   │  │  (WS)     │  │  (Vanilla JS)    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │              │                 │             │
│       └──────────────┴──────┬───────┴─────────────────┘             │
│                             │                                       │
│                     ┌───────┴───────┐                               │
│                     │    api.js     │  ← Mərkəzi Fetch Wrapper      │
│                     └───────┬───────┘                               │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTPS / WSS
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE NETWORK                          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Cloudflare Worker (V8 Isolate)             │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐    │   │
│  │  │  index.ts   │  │  routes.ts  │  │  team-routes.ts     │    │   │
│  │  │ (Entrypoint)│  │ (92+ APIs) │  │  (Workspace APIs)   │    │   │
│  │  └──────┬─────┘  └──────┬─────┘  └──────────┬──────────┘    │   │
│  │         │               │                    │               │   │
│  │  ┌──────┴───────────────┴────────────────────┴───────────┐   │   │
│  │  │                   Middleware Layer                      │   │   │
│  │  │  auth.ts │ security.ts │ rbac.ts │ rate-limit-do.ts    │   │   │
│  │  └──────┬─────────────────────────────────────────────────┘   │   │
│  │         │                                                     │   │
│  └─────────┼─────────────────────────────────────────────────────┘   │
│            │                                                         │
│  ┌─────────┴─────────────────────────────────────────────────────┐   │
│  │                    CLOUDFLARE XİDMƏTLƏRİ                      │   │
│  │                                                                │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌───────────────────┐    │   │
│  │  │   D1   │  │   R2   │  │   KV   │  │ Durable Objects   │    │   │
│  │  │(SQLite)│  │(Fayllar)│  │(Sessiya)│  │ (Realtime State)  │    │   │
│  │  └────────┘  └────────┘  └────────┘  └───────────────────┘    │   │
│  │                                                                │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌───────────────────┐    │   │
│  │  │ Queues │  │   AI   │  │Vectorize│  │    Workflows     │    │   │
│  │  │(Async) │  │(LLM)   │  │(Vector)│  │  (Uzun proseslər) │    │   │
│  │  └────────┘  └────────┘  └────────┘  └───────────────────┘    │   │
│  │                                                                │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🧱 Arxitektura Komponentləri

### 1. Frontend — Vanilla JS SPA

Collabix frontend-i **heç bir UI çərçivəsi** (React, Vue, Angular) istifadə etmir. Əvəzinə, brauzer-nativ DOM API-ləri ilə yazılmış **59 müstəqil ES modul**dan ibarətdir.

| Komponent | Fayllar | Məsuliyyət |
|-----------|---------|-----------|
| **Tətbiq Qabığı** | `app.js` | Hash-routing, sessiya lifecycle, onboarding |
| **Şəbəkə Qatı** | `api.js` | Mərkəzi Fetch wrapper, Visibility API polling |
| **State İdarəsi** | `store.js` | Redux-bənzər reaktiv state, lokal keş |
| **Autentifikasiya** | `auth.js`, `wizard.js`, `oauth.js`, `mfa.js` | Giriş, qeydiyyat, 2FA, OAuth |
| **Sosial Lent** | `feed.js`, `composer.js` | Infinite scroll, blok redaktor |
| **Real-vaxt Chat** | `chat.js`, `chat-ui.js`, `dm.js` | WebSocket, typing indicator |
| **Komandalar** | `teams.js`, `workspace.js` | Team/Workspace idarəetmə UI |
| **Profil** | `profile.js`, `profile-view.js`, `users.js` | Profil, istifadəçi kataloqu |
| **İ18n** | `i18n.js` | 3 dil (AZ, EN, RU), 400+ açar |
| **UI Aletlər** | `ui.js`, `util.js`, `palette.js` | Toast, modal, Cmd+K palette |
| **Vizual Effektlər** | `particles.js`, `cyberpunk_fx.js` | Canvas animasiyaları |

### 2. Backend — Cloudflare Workers (TypeScript)

Backend tamamilə serverless formatında TypeScript ilə yazılıb. **92+ REST endpoint** və WebSocket dəstəyi mövcuddur.

#### Əsas Modullar

| Modul | Fayl | Təsvir |
|-------|------|--------|
| **Entrypoint** | `index.ts` | Router, SSR (HTMLRewriter), CSP, CORS |
| **Core API** | `routes.ts` | 92+ endpoint-in biznes məntiqi |
| **Team API** | `team-routes.ts` | Workspace/Team əməliyyatları (lazy-loaded) |
| **Auth** | `auth.ts` | PBKDF2-SHA256, JWT (HS256), sessiya |
| **Təhlükəsizlik** | `security.ts` | WAF, XSS qoruması, IP bloklaması |
| **RBAC** | `rbac.ts` | Rol əsaslı icazə yoxlaması |
| **SEO** | `seo.ts` | sitemap.xml, robots.txt, llms.txt, JSON-LD |
| **OG Images** | `og.ts` | Dinamik sosial media şəkilləri (PNG render) |
| **Email** | `email.ts` | Resend API ilə transactional email |
| **Arxiv** | `archive.ts` | 90 gün + mesajların R2-yə köçürülməsi |
| **XP Sistemi** | `xp.ts` | Təcrübə xalı hesablama mühərriki |
| **Level** | `level.ts` | Səviyyə hesablama alqoritmi |

#### Durable Objects (Stateful Edge)

| DO | Fayl | Təsvir |
|----|------|--------|
| **RoomDO** | `room-do.ts` | Hər otaq üçün real-vaxt mesaj + typing |
| **PresenceDO** | `presence-do.ts` | Qlobal online/offline status yayımı |
| **RateLimitDO** | `rate-limit-do.ts` | Atomik rate limiter (yarışsız) |

### 3. Cloudflare Xidmətləri

| Xidmət | Binding | Təyinat |
|--------|---------|---------|
| **D1** | `DB` | Əsas verilənlər bazası (SQLite) — 26+ cədvəl |
| **R2** | `FILES` | Fayl anbarı — avatar, post şəkilləri, mesaj faylları |
| **KV** | `SESSIONS` | Sessiya saxlama + rate-limit + keş |
| **Queues** | `TASKS` | Asinxron tapşırıq növbəsi (fan-out) |
| **Durable Objects** | `ROOM_DO`, `PRESENCE_DO`, `RATE_LIMIT_DO` | Stateful edge computing |
| **Workers AI** | `AI` | LLM inteqrasiyası |
| **Vectorize** | `VECTORIZE` | Vektor axtarışı |
| **Browser** | `BROWSER` | Server-side browser rendering |
| **Workflows** | `WORKFLOW` | Uzun müddətli iş axınları |
| **Cron Triggers** | — | Gündəlik arxivləmə (03:17 UTC) |

---

## 🔄 Sorğu Axını (Request Flow)

```
İstifadəçi brauzeri
    │
    ▼
[Cloudflare Edge PoP]  ← Coğrafi ən yaxın qovşaq
    │
    ├── /assets/*  ──→  [Statik CDN]  (Worker-i keçir, sıfır gecikmə)
    │
    ├── /api/*     ──→  [Worker]
    │                      │
    │                      ├── [Middleware: Auth + RBAC + Rate Limit]
    │                      │
    │                      ├── [Route Handler]
    │                      │      │
    │                      │      ├── D1 sorğusu
    │                      │      ├── R2 əməliyyatı
    │                      │      ├── KV oxuma/yazma
    │                      │      └── Queue göndərmə
    │                      │
    │                      └── [Response + Security Headers]
    │
    ├── /ws/*      ──→  [Durable Object]  (WebSocket upgrade)
    │                      │
    │                      ├── RoomDO (otaq mesajları)
    │                      └── PresenceDO (online status)
    │
    └── /*         ──→  [Worker → HTMLRewriter]  (SSR meta injection)
```

---

## ⚡ Performans Arxitekturası

### Edge-First Strategiya

| Strategiya | Təsvir | Nəticə |
|------------|--------|--------|
| **Edge Computing** | Kod istifadəçiyə ən yaxın PoP-da işləyir | <50ms TTFB |
| **Statik Asset Bypass** | `/assets/*` birbaşa CDN-dən verilir | Worker yükü azalır |
| **Lazy Loading** | `team-routes.ts` yalnız lazım olduqda yüklənir | Cold-start azalır |
| **Visibility API Polling** | Tab gizlədildikdə polling dayanır | Resurs qənaəti |
| **Hashed Assets** | Immutable JS/CSS fayllar (uzun cache) | Dərhal yüklənmə |

### Observability (Müşahidə)

```jsonc
{
  "observability": {
    "enabled": true,           // ← Əvvəl false idi (AUDIT-TASK-10-da aşkarlandı)
    "head_sampling_rate": 1,   // 100% sampling
    "logs": { "enabled": true, "persist": true },
    "traces": { "enabled": true, "persist": true }
  }
}
```

---

## 🌐 Mühitlər (Environments)

| Mühit | Worker Adı | Məqsəd |
|-------|-----------|--------|
| **Production** | `collabix` | Canlı istifadəçilər |
| **Staging** | `collabix-staging` | Test — `wrangler deploy --env staging` |
| **Local** | — | `npm run dev` — lokal SQLite emulyasiya |

### Staging Konfiqurasiyası

```bash
# Staging resurslarını yaratmaq (hesab sahibi tərəfindən):
wrangler d1 create collabix-db-staging
wrangler r2 bucket create collabix-files-staging
wrangler kv namespace create SESSIONS_STAGING

# Deploy:
npx wrangler deploy --env staging
```

---

## 🔗 Əlaqəli Səhifələr

- **[Verilənlər Bazası Sxemi →](Database-Schema)**
- **[Frontend Modulları →](Frontend-Modules)**
- **[API Reference →](API-Reference)**
- **[Təhlükəsizlik Arxitekturası →](Security)**
- **[Cloudflare Ekosistemi →](Cloudflare-Ecosystem)**

---

**Əvvəlki:** [← Quraşdırma Təlimatı](Getting-Started) | **Növbəti:** [Verilənlər Bazası Sxemi →](Database-Schema)
