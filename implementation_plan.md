# Frontend İnfrastrukturu — Reaksion (Responsive) Audit və Remediasiya Planı

## Layihə Konteksti

**Collabix** — Cloudflare Workers + D1 üzərində qurulmuş SPA (Single Page Application) arxitekturalı öyrənmə platforması. Frontend vanilla JS + modular CSS (28 fayl, ~500KB CSS) arxitekturası üzərində qurulub. 4 tema (dark, matrix, light, cyberpunk), 3 dil (AZ/EN/RU), 1576 sətirlik monolitik `index.html` ilə 19+ səhifə idarə olunur.

**Mövcud vəziyyət**: Əvvəlki auditlər (TASK-9, TASK-10) 3 əsas breakpoint (768/480/360) və bəzi desktop breakpoint-ləri (1440–2560) əlavə edib. Lakin aralıq ölçülərdə (390, 414, 430, 540, 576, 640, 820, 853, 912, 1152, 1366, 1536, 1600, 1728) audit aparılmayıb.

---

## Audit Fazası — Tədqiqat Tapıntıları

### 1. Layout İyerarxiyası Analizi

```
index.html
├── #publicLayer (Publik qat — auth tələb etmir)
│   ├── .pub-header (sticky, glassmorphism)
│   │   ├── .ph-inner (max-width: 1200px, flex)
│   │   ├── .ph-mobile (hamburger menyu, ≤960px)
│   ├── .breadcrumb
│   ├── #publicMain
│   │   ├── #pub-welcome (Hero + Features + Codeshow + Testimonials)
│   │   ├── #pub-about
│   │   ├── #pub-faq
│   │   ├── #pub-privacy / #pub-terms / #pub-contact / #pub-security / #pub-cookies / #pub-changelog
│   ├── .pub-footer (4 sütun grid)
│
├── #landing (Auth ekranı — giriş/qeydiyyat)
│   └── .auth-wrap (2 sütun grid → mobil 1 sütun)
│
├── #app (Autentifikasiyalı qat)
│   ├── .app-topbar (sticky, flex)
│   ├── .app-row (flex: sidebar + main)
│   │   ├── .sidebar (222px, sticky, ≤768 gizlənir)
│   │   ├── .main (flex:1, max-width:1140px)
│   │   │   ├── #page-home (Lenta + Kompozitor)
│   │   │   ├── #page-chat / #page-dm (3 sütun grid — siyahı+mesaj+detallar)
│   │   │   ├── #page-notifs (Bildiriş mərkəzi)
│   │   │   ├── #page-users (İstifadəçi kataloqu — 2 sütun layout+rail)
│   │   │   ├── #page-tasks (İş sahəsi — Kanban)
│   │   │   ├── #page-drills (Çalışmalar)
│   │   │   ├── #page-teams / #page-team
│   │   │   ├── #page-stats (Statistika)
│   │   │   ├── #page-profil / #page-u (Profil)
│   │   │   ├── #page-settings (Parametrlər)
│   │   │   ├── #page-admin (Admin paneli — sidebar+content)
│   │   │   ├── #page-post / #page-saved
│   ├── .bottom-nav (≤768, fixed bottom)
│
├── .modal-bg → .modal-card (dialog)
├── .palette-bg (Command palette — Ctrl+K)
├── .toast-wrap (Bildirişlər)
├── .social-share-panel
├── #backToTopBtn
```

### 2. Mövcud Breakpoint Sistemi (Boşluq Analizi)

| Mövcud Breakpoint | Yeni Tələb Olunan | Boşluq |
|---|---|---|
| 360, 480, 768 (max-width) | 320, 375, 390, 414, 430, 540, 576, 640 | **8 aralıq mobil ölçü əhatə olunmayıb** |
| 1024 (touch boundary) | 820, 853, 912, 1152 | **4 tablet/dar desktop ölçü** |
| 1440, 1536, 1728, 1920, 2560 (min-width) | 1280, 1366, 1600 | **3 desktop ölçü** |

### 3. Aşkar Edilmiş Qüsurlar (Audit Nəticələri)

> [!IMPORTANT]
> Aşağıdakı qüsurlar kod mənbəsinin 100% statik analizinə əsaslanır. Browser-da görsel yoxlama ilə əlavə qüsurlar aşkar oluna bilər.

#### Kateqoriya A — Overflow / Daşma Risklərı (Kritik)

| # | Komponent | Qüsur | Təsir olunan ölçülər | Fayllar |
|---|---|---|---|---|
| A1 | `.pub-header .ph-inner` | `gap:18px` + `padding:12px 22px` sabit — 320-375px-də nav linkləri və actions sıxışır | 320–414px | `50-public.css:21-28` |
| A2 | `.ph-search` | `width:190px` sabit, focus-da `230px` — dar ekranda daşar | 320–480px | `50-public.css:76-90` |
| A3 | `.pub-footer .pf-inner` | Footer-da 4 sütun `flex-wrap` yoxdur — dar ekranda daşar | 320–768px | `50-public.css` footer bölməsi |
| A4 | `.auth-hero h1` | `font-size:2.3rem` sabit — 320px-də daşa bilər | 320–375px | `00-tokens-base.css:448` |
| A5 | `.hero h1` | Font ölçüsü yalnız ≤480px-də kiçildilir (1.7rem), 481-768px aralığında böyük qalır | 481–768px | `60-responsive.css:327-329` |
| A6 | `.admin-table-wrap table` | `admin-table-wrap` üfüqi scroll konteynerdir, amma `overflow-x:auto` yoxlanmalı | 320–768px | `86-admin-ui.css` |
| A7 | `.codeshow` (Kod vitrini) | İki sütun grid dar tablet-də sıxılır | 640–960px | `50-public.css` |
| A8 | `.ws-col-w: 300px` | Kanban sütunları sabit 300px — dar ekranda daşma riski | ≤768px | `92-workspace.css:13` |
| A9 | `settings-grid` | Settings blokları tək sütunda 1440px-də 900px boşluq | 1440px+ | `35-stats-profile.css` |
| A10 | `.contact-grid` | Yalnız ≤480px-də tək sütun olur, 481-768 aralığında sıxışır | 481–768px | `60-responsive.css:323-325` |

#### Kateqoriya B — Tipoqrafik / Layout Deformasiyaları

| # | Komponent | Qüsur | Fayllar |
|---|---|---|---|
| B1 | `h1.page-title` | 1.75rem → 1.3rem yalnız ≤768px-də, 1.15rem ≤360px — aradakı ölçülərdə clamp yoxdur | `10-app-shell.css:323` |
| B2 | `.stat-card .num` | 1.7rem → 1.3rem yalnız ≤480px — ardıcıl miqyaslama yoxdur | `10-app-shell.css:413` |
| B3 | `.hero h1` | Publik hero başlığı sabit ölçülüdür, clamp/fluid tipografiya yoxdur | `50-public.css` |
| B4 | `.pf-name` font-size `--fs-2xl` (28px) | Çox uzun adlarda dar ekranda `overflow-wrap:anywhere` var amma sətir hündürlüyü yoxlanmalı | `91-profile.css:179-186` |

#### Kateqoriya C — Grid / Flex Davranış Qüsurları

| # | Komponent | Qüsur | Fayllar |
|---|---|---|---|
| C1 | `.stat-row` | `repeat(3, 1fr)` → ≤768-də `1fr 1fr`, ≤480 `1fr 1fr` — `auto-fit` yoxdur | `10-app-shell.css:391-394` |
| C2 | `.grid2` | `1fr 1fr` → ≤480 `1fr` — 481-768 aralığında hələ iki sütundur, tablet-də sıxışır | `00-tokens-base.css:590-594` |
| C3 | `.feat-grid` | Yalnız ≥1440px-də `repeat(4,1fr)` — digər breakpoint-lərdə sütun sayı bilinmir | `60-responsive.css:351` |
| C4 | `.pub-grid` | İki sütun (məzmun + sidebar) — tablet-də sıxışma riski | `50-public.css` |
| C5 | `.pf-hero__body` | Profil hero flex layout — avatar+info dar ekranda yığılma | `91-profile.css:151-158` |

#### Kateqoriya D — Naviqasiya Problemləri

| # | Komponent | Qüsur | Fayllar |
|---|---|---|---|
| D1 | `.ph-nav` | Publik nav ≤960px-da hamburger — amma breakpoint 960 artıq 1024-ə köçürülüb sənəddə | `50-public.css:35-61` |
| D2 | `.admin-sidebar` | Admin panel sidebar-ı mobil/tablet-də adaptiv deyil | `86-admin-ui.css` |
| D3 | `.bottom-nav` | 6 düymə + "⋯" — 320px-də sıxışma riski | `10-app-shell.css` + responsive |

#### Kateqoriya E — Modal / Overlay / Interactive Komponent Qüsurları

| # | Komponent | Qüsur | Fayllar |
|---|---|---|---|
| E1 | `.modal-card` | ≤768px-də full-screen — ≥769 amma ≤1024 ölçüdə eni yoxlanmalı | `60-responsive.css:121-134` |
| E2 | `.palette` (Command palette) | Responsive ölçüləndirmə yoxlanmalı | `50-public.css` / ayrı CSS |
| E3 | `.chat-details` panel | 312px sabit eni — tablet-də chat-wrap-ı daşıra bilər | `87-chat-modern.css:75` |

#### Kateqoriya F — Tema Uyğunsuzluqları

| # | Problem | Fayllar |
|---|---|---|
| F1 | `75-touch.css:128-140` — Cyberpunk font override-ları `.card`, `.btn`, `input` hədəfləyir, amma bu sinif adları mövcud komponentlərlə uyğun deyil | `75-touch.css` |
| F2 | `.role-badge` — hardcoded `rgba` rəngləri tema dəyişənlərindən yan keçir | `20-feed.css:78-98` |

---

## Proposed Changes

### Faza 1: Responsive Qırılma Nöqtələrinin Genişləndirilməsi

#### [MODIFY] [60-responsive.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/60-responsive.css)
- **320px** breakpoint əlavəsi — ultra kiçik ekranlar üçün minimum ölçü qoruması
- **576px** breakpoint — Bootstrap-uyğun kiçik ekran keçidi
- **640px** breakpoint — grid/flex keçid nöqtəsi
- **820px, 912px** — tablet ölçüləri üçün adaptasiyalar
- **1024px** breakpoint genişlənməsi — sidebar + məzmun adaptasiyası
- **1152px, 1280px, 1366px** — desktop keçid ölçüləri
- **1600px** — ultra-wide əlavəsi

#### [MODIFY] [50-public.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/50-public.css)
- Publik header — dar ölçülərdə axtarış gizlənməsi, gap/padding adaptasiyası
- Footer — grid-dən stack-ə keçid ≤768px
- Hero — fluid tipoqrafiya (`clamp()`)
- `.pub-grid` — tablet breakpoint-ləri
- `.codeshow` — iki sütundan tək sütuna keçid nöqtəsi

### Faza 2: Komponent Səviyyəli Remediasiya

#### [MODIFY] [00-tokens-base.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/00-tokens-base.css)
- Auth wrap — `.auth-hero h1` fluid font-size
- `.grid2` → `auto-fit minmax()` ilə əvəzləmə

#### [MODIFY] [10-app-shell.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/10-app-shell.css)
- `.stat-row` → `auto-fit minmax()` ilə əvəzləmə (statik `repeat(3,1fr)` əvəzinə)
- `h1.page-title` — `clamp()` fluid tipoqrafiya
- `.stat-card .num` — mütənasib miqyaslanma

#### [MODIFY] [87-chat-modern.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/87-chat-modern.css)
- Detallar paneli — tablet-də tam eni almaq / overlay rejimi
- Chat siyahısı — dar tablet ölçülərində adaptasiya

#### [MODIFY] [91-profile.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/91-profile.css)
- Hero body — dar ekranda stack layout
- Avatar ölçüsü — responsive dəyişən

#### [MODIFY] [92-workspace.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/92-workspace.css)
- Kanban sütunları — mobil/tablet adaptasiyası
- Detal paneli — responsive eni

#### [MODIFY] [86-admin-ui.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/86-admin-ui.css)
- Admin sidebar — mobil/tablet-də top-tabs və ya drawer
- Cədvəl sarğısı — həmişə `overflow-x: auto`

#### [MODIFY] [85-teams.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/85-teams.css)
- Team stat grid — dar ölçülərdə sütun sayı
- Team chat box — mobil hündürlük adaptasiyası

#### [MODIFY] [20-feed.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/20-feed.css)
- `.role-badge` — hardcoded `rgba` → tema dəyişənləri ilə
- Şərh paneli — dar ölçülərdə adaptasiya

#### [MODIFY] [88-notifications.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/88-notifications.css)
- Statistika kartları — minmax dəyərləri dar ölçülər üçün yoxlama

#### [MODIFY] [89-users.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/89-users.css)
- Kataloq layout — rail mobil adaptasiyası yoxlama

#### [MODIFY] [93-drills.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/93-drills.css)
- Çalışma kartları — mobil adaptasiya yoxlaması

#### [MODIFY] [75-touch.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/75-touch.css)
- Cyberpunk font override-ları — düzgün sinif hədəfləməsi

#### [MODIFY] [35-stats-profile.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/35-stats-profile.css)
- Settings grid — responsive grid layout

#### [MODIFY] [51-home-polish.css](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/css/51-home-polish.css)
- Hero float kartları — responsive adaptasiya yoxlaması

### Faza 3: Tipoqrafik Miqyaslama

Bütün statik `font-size` dəyərlərin `clamp()` ilə əvəzlənməsi:
- `h1.page-title`: `clamp(1.15rem, 1rem + 1.5vw, 1.75rem)`
- `.hero h1`: `clamp(1.7rem, 1.2rem + 2.5vw, 3.2rem)`
- `.auth-hero h1`: `clamp(1.6rem, 1.2rem + 2vw, 2.3rem)`
- `.stat-card .num`: `clamp(1.3rem, 1rem + 1vw, 1.7rem)`

### Faza 4: Təsvir və Media Adaptivliyi

- Bütün `img` elementlərinə `max-width: 100%`, `height: auto` tətbiqi (baza CSS-də var, amma `.feed-img`, `.composer-img-preview img` yoxlanacaq)
- `.hero-floats` — dar ölçülərdə gizlənmə
- Avatar ölçüləri — responsive dəyişənlər

---

## Open Questions

> [!IMPORTANT]
> **Q1**: Admin panel sidebar-ı mobildə necə davranmalıdır?
> - **Variant A**: Yuxarıda üfüqi tab sırası (horizontal scroll ilə)
> - **Variant B**: Hamburger/drawer menyu
> - **Variant C**: Accordion tərzi

> [!IMPORTANT]
> **Q2**: Kanban board mobildə necə göstərilməlidir?
> - **Variant A**: Üfüqi sürüşən sütunlar (hazırda)
> - **Variant B**: Hər sütun ayrıca accordion/tab

> [!IMPORTANT]
> **Q3**: 2560px ultra-wide monitor-da `.main` max-width-i artırılmalıdırmı (hazırda 1140px)?

---

## Verification Plan

### Automated Tests
- `npm run audit:responsive` — mövcud Playwright responsive audit 19 səhifə × 13 ölçü
- `npm run e2e` — reqressiya testi (11 səhifə × 4 ölçü)
- Modifikasiyadan sonra hər iki test keçməlidir

### Manual Verification
- DevTools ilə 24 tələb olunan eni yoxlama (320–2560px)
- 4 tema (dark, matrix, light, cyberpunk) × 3 dil (AZ/EN/RU) yoxlama
- Portret/landşaft oriyentasiya yoxlaması
- Klaviatura naviqasiyası testi (Tab ardıcıllığı, fokus görünürlüyü)
- Üfüqi scroll olmadığına zəmanət (bütün breakpoint-lərdə)

### Keyfiyyət Metrikleri
- ✅ 0 üfüqi page-level overflow (hər breakpoint)
- ✅ 0 kəsilmiş/örtülən məzmun
- ✅ 0 element kəsişməsi
- ✅ WCAG 2.2 AA uyğunluğu qorunur
- ✅ 4 tema universallığı
- ✅ Touch target ≥ 44px (≤1024px)
- ✅ CLS reqressiya sıfır
