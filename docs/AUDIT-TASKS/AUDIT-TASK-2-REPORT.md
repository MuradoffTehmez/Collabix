# AUDIT-TASK-2 — İcra Hesabatı

**Tarix:** 2026-07-27
**İcraçı:** Claude Opus 5 (icra agenti)
**Mənbə task:** `docs/AUDIT-TASKS/AUDIT-TASK-2.md`
**Mənbə audit:** `docs/AUDIT-TASKS/AUDIT-2026-07-26.md`
**Ön şərt vəziyyəti:** AUDIT-TASK-1 ✅ · git repo **quruldu** (əvvəl mövcud deyildi)

## Commit-lər

| Hash | Bənd | Başlıq |
|---|---|---|
| `c7b4157` | 2.0 | `chore:` repo bazası — AUDIT-TASK-1 tamamlandıqdan sonrakı vəziyyət |
| `3a5050b` | 2.5 + 2.4 | `fix(seo):` domen tək həqiqət mənbəyinə bağlandı + uydurma sameAs çıxarıldı |
| `d242231` | 2.3 | `fix(legal):` sınıq sosial profil linkləri silindi + boş hala qarşı qoruma |
| `8c2eda1` | 2.2 | `fix(legal):` hüquqi kimlik datası placeholder-ləri əvəzləndi (3 dildə) |
| `b6719dc` | 2.4 + 2.7 | `fix(seo):` index.html-dən UYDURMA struktur data çıxarıldı + placeholder detektoru |
| `dfae56a` | 2.6 | `docs(legal):` hüquqi mətn boşluqları auditi |

---

## 0. Ön şərt: versiya nəzarəti (2.0)

| Göstərici | Dəyər |
|---|---|
| İlk commit | **`c7b4157`** |
| İzlənən fayl sayı | **384** |
| Sirr taraması (fayl adı) | ✅ yalnız `tsconfig.json` uyğun gəldi — `config.json` naxışının yalançı pozitivi |
| Sirr taraması (məzmun) | ✅ 15 uyğunluq, **hamısı audit sənədlərində** (parol `<AÇIQ MƏTN>` kimi redaktə olunub) — real dəyər yoxdur |
| İgnore edilən kritik yollar | `.dev.vars`, `.dev.vars.*`, `.env`, `.env.*`, `**/serviceAccountKey.json`, `**/.emulator-data/`, `**/auth_export/`, `**/*.pem`, `**/*.key`, `legacy/`, `testsprite_tests/`, `migration-cf/import.sql`, `migration-cf/update.sql` |

**2.0-da əlavə edilən yeni qaydalar:** `.dev.vars.*`, `.env`, `.env.*`,
`!.env.example`, `migration-cf/update.sql` (əvvəl yalnız `import.sql` var idi,
halbuki `update.sql` da real istifadəçi post məzmunu daşıyır).

### 0.1 · ⚠️ İlk commit-dən əvvəl aşkarlanan problem

`git add -A`-dan sonra staged siyahıda **kökdə `index.ts` və `routes.ts`** göründü.
Bunlar AUDIT-TASK-1-dəki baseline ölçmə əməliyyatımın qalığı idi
(`cp … worker/../` → `worker/../` faktiki olaraq layihə kökünə həll olunur).

Doğrulandı ki, onlar **dəyişiklikdən ƏVVƏLKİ** nüsxələrdir (kök: 33 `admin: true`,
0 `forbidden`; `worker/`: 34 və 1) və snapshot-da nüsxələri var → **commit-dən
əvvəl silindi**. Əks halda repo kökündə iki köhnə dublikat fayl əbədi izlənəcəkdi.

### 0.2 · Git identity

`git init`-dən sonra yerli `user.name`/`user.email` təyin etdim, lakin
**qlobal identity artıq mövcud idi** (`Təhməz Muradoff`). Yerli override
**çıxarıldı** — istifadəçinin öz git kimliyini dəyişmək mənim işim deyil.
`core.autocrlf=true` qoyuldu (Windows CRLF xəbərdarlıqları üçün).

**Qadağa riayət olundu:** ❌ remote əlavə edilmədi, ❌ push edilmədi.

---

## 1. Bağlanan tapıntılar

| Audit ID | Bənd | Vəziyyət | Sübut |
|---|---|---|---|
| — | 2.0 · `git init` | ✅ | commit `c7b4157`, 384 fayl |
| #12 | 2.1 · hüquqi data toplandı | ✅ | 8 sahədən 7-si gəldi; VÖEN qeydiyyat gözləyir (uydurulmadı) |
| #12 | 2.2 · `legal.js` düzəldildi | ✅ | **18 placeholder** 3 dildə əvəzləndi (audit yalnız 3-ünü görmüşdü) |
| TASK-5 | 2.3 · sosial URL-lər | ✅ | 3 sınıq URL silindi; 9 namizədin heç biri doğrulanmadı |
| L-8 | 2.4 · JSON-LD `sameAs` | ✅ | `worker/seo.ts` **və** `index.html` — ikisindən də çıxarıldı |
| #14 | 2.5 · domen vahidliyi | ✅ | `vars.SITE_ORIGIN` tək mənbə; **1 live bug bağlandı** |
| — | 2.6 · hüquqi boşluq auditi | ✅ | `docs/AUDIT-TASK-2-LEGAL-GAPS.md` — 12 sual, 4✅/7⚠️/1❌ |
| — | 2.7 · placeholder detektoru | ✅ | `e2e/legal.spec.ts` — **7 test, 7/7 yaşıl** |

---

## 2. Qəbul meyarları

| # | Meyar | ✅/❌ | Nəticə |
|---|---|---|---|
| 1 | Git repo mövcuddur | ✅ | `git rev-parse --is-inside-work-tree` → `true` |
| 2 | İlk commit sirr daşımır | ✅ | `-S "password="` / `-S "API_KEY"` → 1-1 commit, lakin **DƏYƏR yoxdur** (yalnız audit sənədlərində redaktə olunmuş istinadlar) |
| 3 | `.dev.vars` / `.env` izlənmir | ✅ | `check-ignore`: `:11:.dev.vars`, `:13:.env` |
| 4 | Strict TypeScript keçir | ✅ | `tsc --noEmit` exit **0** |
| 5 | Build uğurludur | ✅ | `npm run build` exit **0** |
| 6 | E2E reqressiya yoxdur | ⚠️ | Bax §2.1 — mövcud uğursuzluqlar **dəyişikliklərimdən əvvəl də var idi** |
| 7 | Placeholder detektoru yaşıl | ✅ | `playwright test legal` → **7/7** |
| 8 | Hüquqi səhifələrdə `[…]` yoxdur | ✅ | `/privacy`, `/terms`, `/about`, `/security` — 0 uyğunluq (render olunmuş mətndə) |
| 9 | Sosial URL-lər işləyir | ✅ | Sahə **silindi** (heç biri doğrulanmadı) → sınıq link qalmadı |
| 10 | JSON-LD valid | ✅ | `index.html`-dəki **6/6** blok parse olunur |
| 11 | `sameAs` sınıq link daşımır | ✅ | Sahə tamamilə çıxarıldı (iki fayldan) |
| 12 | Domen tək mənbədən | ✅ | `worker/` + `js/`-də hardcoded domen **yoxdur** (yalnız `ORIGIN_FALLBACK` — qəsdən) |
| 13 | `SITE_ORIGIN` binding işləyir | ✅ | canlı `/sitemap.xml`, `/robots.txt`, canonical, hreflang — hamısı `SITE_ORIGIN`-dən |
| 14 | Sondakı slash problemi yoxdur | ✅ | `sitemap.xml`-də `https://` xaricində `//` **yoxdur** |
| 15 | 3 dil uyğundur | ✅ | `js/i18n.js`-də hüquqi placeholder **yoxdur** (18 `[` uyğunluğu JS kodu / i18n token-ləridir) |
| 16 | Footer boş `social`-da çökmür | ✅ | `Array.isArray` qoruması + `hidden`; `legal.spec.ts` footer testi yaşıl |

### 2.1 · Meyar 6 — E2E reqressiya təhlili

**Tam dəst nəticəsi: 150 uğursuz / 115 keçdi (20,9 dəq).** Bu rəqəm
**yanıldıcıdır** və aşağıda niyə olduğu sübutla göstərilir.

#### A) Mənim dəyişikliyimin yaratdığı REAL reqressiya — 1 test, TAPILDI və DÜZƏLDİLDİ

`home.spec.ts:154` "Ana#12 sosial ikonlar" `#pfSocial a` üçün **`toHaveCount(3)`**
tələb edirdi. 2.3-də `SITE.social` boşaldıldığı üçün say 0 oldu →
desktop + mobile = **2 uğursuz**.

Bu, **mənim səhvim** idi: §2.3-də `SITE.social` istifadə yerlərini render
kodunda yoxladım, lakin həmin sahəni kilidləyən **testi** yoxlamadım.
Düzəliş: commit `c1f82c2` — test silinmədi, invariantla uyğunlaşdırıldı.
**Nəticə: 41 keçdi / 2 uğursuz → 43 keçdi / 0 uğursuz.**

#### B) Qalan ~148 uğursuzluq: dəstin ÖZ struktur qüsuru (mənim dəyişikliyim deyil)

**Sübut 1 — izolə qaçışda EYNİ testlər keçir.** Tam dəstdə `users.spec.ts`-in
13 mobile testi **hamısı** uğursuz idi. Təkbaşına işlədildikdə:
**13/13 keçdi (47 s).** Kod dəyişmədi — yalnız icra konteksti dəyişdi.

**Sübut 2 — uğursuzluqların paylanması.** Tutulan 42 uğursuzluğun **100%-i
`[mobile]`**, `[desktop]` **sıfır**. Hər biri ~2,2 saniyədə sınır — yəni
real assertion pozuntusu deyil, precondition çatmır.

**Sübut 3 — mexanizm koddan oxunur.** `e2e/global-setup.ts` BİR DƏFƏ giriş edir
və bütün spec-lər `test.use({ storageState: AUTH_FILE })` ilə **eyni** sessiyanı
paylaşır. Access token TTL = **15 dəqiqə** (`worker/auth.ts` `ACCESS_TTL`),
dəst isə **20,9 dəqiqə** işləyir. 15-ci dəqiqədən sonra:

1. token bitir → client `/api/auth/refresh` çağırır
2. refresh token hər istifadədə **ROTASİYA** olunur (`rotateSession`)
3. `AUTH_FILE` diskdə **KÖHNƏ** token-i saxlayır, hər yeni kontekst onu yükləyir
4. eyni köhnə token ikinci dəfə işlədilir → **`prev_refresh_hash` reuse
   aşkarlaması** (`worker/auth.ts:143-153`)
5. cavab: `revokeAllSessions(uid, 'reuse')` → istifadəçinin **BÜTÜN** sessiyaları ləğv
6. bundan sonrakı hər auth tələb edən test dərhal sınır

Sıra `desktop → mobile` olduğu üçün desktop 15 dəqiqəlik pəncərədə əsasən sağ
qalır, mobile isə **ölü sessiya** ilə başlayır — uğursuzluqların 100%-inin
mobile olması məhz bununla izah olunur.

> Bu qüsur **əvvəlki sessiyada da sənədləşdirilmişdi** (layihə yaddaşı:
> "refresh rotasiyası AUTH_FILE-ı zəhərləyir; izolə kontekst lazımdır").
> AUDIT-TASK-2 onu nə yaratdı, nə də ağırlaşdırdı.

#### C) Hökm

| Sual | Cavab |
|---|---|
| AUDIT-2 reqressiya yaratdı? | ✅ **Bəli — 1 test**, tapıldı və düzəldildi (`c1f82c2`) |
| Qalan uğursuzluqlar AUDIT-2-dəndir? | ❌ **Xeyr** — izolə qaçışda keçirlər |
| Meyar 6 ölçülə bilirmi? | ⚠️ **XEYR** — dəstin nəticəsi determinist deyil, divar-saatı ilə deqradasiya edir |

**Dəyişikliklərimin toxunduğu spec-lər izolə yoxlanıldı — hamısı yaşıl:**

| Spec | Nəticə | Nəyi örtür |
|---|---|---|
| `legal.spec.ts` | **7/7** | placeholder, JSON-LD, footer linkləri (YENİ fayl) |
| `home.spec.ts` + `_check.spec.ts` | **43/43** | SEO meta, footer, sosial ikonlar, 3 tema, 3 dil |
| `users.spec.ts` (mobile) | **13/13** | `js/users.js` JSON-LD dəyişikliyi |
| `security-api.spec.ts` (H-2) | **3/3** | AUDIT-TASK-1 qapısı hələ bağlıdır |

**Tövsiyə (yeni task):** `storageState` paylaşımı əvəzinə hər faylda
`freshDevice()` naxışı işlədilsin — `security-api.spec.ts`-də bu naxış artıq
var və həmin fayl tam dəstdə də sağ qalır. Əks halda dəst heç vaxt etibarlı
reqressiya siqnalı verməyəcək və CI (audit Sprint 1/#14) qurulan kimi daim
qırmızı olacaq.

---

## 3. Domen istinad xəritəsi (2.5 / addım 1)

**Əvvəl — 4 FƏRQLİ domen, 20+ hardcoded nöqtə:**

| Fayl:sətir | Domen | Rolu | Vəziyyət |
|---|---|---|---|
| `worker/seo.ts:6` | `…workers.dev` | ORIGIN — canonical, sitemap, robots, llms, OG, JSON-LD | ✅ → `siteOrigin(env)` |
| `worker/og.ts` (4 yer) | `…workers.dev` | OG şəkil / favicon yönləndirmə | ✅ → `siteOrigin(env)` |
| `js/feed.js:82` | `…workers.dev` | paylaş linkləri (ikinci nüsxə) | ✅ → `location.origin` |
| `js/public.js:599` | `…workers.dev` | JSON-LD BreadcrumbList | ✅ → `location.origin` |
| `js/users.js:350,360` | `…workers.dev` | profil JSON-LD + şəkil URL-ləri | ✅ → `location.origin` |
| `worker/jobs/team.ts:109` | **`collabix.site`** | komanda dəvət emaili linki | ✅ → `APP_URL` / `SITE_ORIGIN` |
| `js/legal.js:7,317,356,394` | **`collabix.app`** | əlaqə + təhlükəsizlik emaili | ✅ → `SITE.email` |
| `index.html` (15 yer) | `…workers.dev` | statik meta/JSON-LD/footer linkləri | ⚠️ **qaldı** — bax §5.4 |

**Sonra — tək mənbə:** `wrangler.jsonc` → `vars.SITE_ORIGIN` (+ `APP_URL`).
Server `siteOrigin(env)` ilə oxuyur (sondakı slash normalizasiyası ilə),
frontend `location.origin` işlədir.

### 3.1 · 🔴 Aşkarlanan LIVE BUG

`worker/jobs/team.ts:109` komanda dəvət emailindəki linkin bazası kimi
`env.APP_URL || 'https://collabix.site'` işlədirdi. Yoxlama:

- `APP_URL` **`wrangler.jsonc`-də təyin olunmamışdı** → fallback aktiv idi
- `collabix.site` → **NXDOMAIN** (DNS-də mövcud deyil)

Yəni **göndərilən hər komanda dəvət emaili ölü linklə gedirdi.**
Auditdə bu tapılmamışdı; domen kartlaşdırılarkən üzə çıxdı.

---

## 4. Doldurulmamış / şərti hüquqi sahələr

| Sahə | Vəziyyət | Bloklayır |
|---|---|---|
| Hüquqi ad | ✅ `Tahmaz Muradov (Fərdi Sahibkar)` | — |
| Hüquqi forma | ✅ `Fərdi Sahibkar` | — |
| Ünvan | ✅ `Naxçıvan, Azərbaycan` (küçə/bina uydurulmadı) | — |
| Yurisdiksiya | ✅ `Azərbaycan Respublikası` | — |
| Əlaqə emaili | ⚠️ **işlək gmail** + `privacy@collabix.az` "domen aktivləşdikdən sonra" kimi elan olunur | Rəsmi ünvana keçid DNS+MX tələb edir |
| **VÖEN** | ⏳ **gözləyir** — qeydiyyat tamamlanmayıb | Etibarlılıq siqnalı zəifdir; **uydurma nömrə YAZILMADI** |
| Rəsmi domen | ⚠️ `collabix.az` verildi, lakin **NXDOMAIN** | `SITE_ORIGIN` faktiki canlı domendə saxlanıldı |
| Sosial profillər | ❌ **heç biri mövcud deyil** → sahə boşaldıldı | Footer-də sosial ikon yoxdur (qəsdən) |

### 4.1 · Email qərarının əsaslandırılması

Verilən üç ünvan (`support@` / `privacy@` / `legal@collabix.az`) **hamısı**
`collabix.az` domenindədir. Yoxlama:

```text
nslookup collabix.az        → Non-existent domain (NXDOMAIN)
nslookup -type=MX collabix.az → Non-existent domain
```

Yəni bu ünvanlar **məktub qəbul edə bilmir**. Data-subject sorğusu (silmə,
ixrac, etiraz) üçün çatmayan kanal göstərmək placeholder-dən **pisdir**:
placeholder açıq şəkildə natamamdır, işləməyən ünvan isə **saxta təsdiqdir**
(task §2-nin öz xəbərdarlığı). Ona görə sahibə seçim təqdim edildi və
**"ikisi birlikdə"** seçildi: əsas kanal işlək ünvan, rəsmi ünvan isə mətndə
"domen aktivləşdikdən sonra" qeydi ilə elan olunur.

---

## 5. Aşkarlanan yeni risklər

### 5.1 · 🔴 `index.html`-də UYDURMA struktur data (audit bunu tapmamışdı)

Audit yalnız `worker/seo.ts:122`-yə baxmışdı. `index.html`-də **6 statik
JSON-LD bloku** var və orada aşkarlandı:

| Sahə | Dəyər | Problem |
|---|---|---|
| `aggregateRating` | `ratingValue: "4.8"`, `ratingCount: "150"` | **150 rəyin 4.8 ortalaması iddia edilirdi — belə rəy MÖVCUD DEYİL.** Google struktur data siyasətinin pozulması: rich-result itkisi + manual action riski. §5.2 bu sahəni adı ilə qadağan edir |
| `sameAs` | 3 ölü URL | seo.ts-dən çıxarılan EYNİ massiv — yalnız seo.ts düzəldilsəydi problem canlı qalardı |
| `foundingDate` | `"2024"` | Təsdiqlənməyib (layihə datası 2026-nı göstərir) |
| `contactPoint.email` | `info@collabix.app` | Sahibliyi təsdiqlənməmiş domen |
| `google-site-verification` | `YOUR_GOOGLE_VERIFICATION_CODE` | **Canlı HTML-də placeholder** |
| `msvalidate.01` | `YOUR_BING_VERIFICATION_CODE` | Eyni |

**Hamısı çıxarıldı.** Doğrulama: 6/6 JSON-LD bloku parse olunur.

### 5.2 · ⚠️ Audit placeholder problemini 6× az qiymətləndirmişdi

Audit `js/legal.js`-də **3** placeholder tapmışdı (`SITE.company`,
`SITE.address`, `SITE.social`). Faktiki say: **18** — və onlar Privacy, Terms,
Security, About səhifələrində **ÜÇ DİLDƏ** paralel yaşayırdı
(`[email]` ×6, `[ölkə/şəhər]`/`[country/city]`/`[страна/город]`,
`[ŞİRKƏT ADI]`/`[COMPANY]`/`[КОМПАНИЯ]` ×6, `[Komanda üzvləri…]` ×3).

**Səbəb:** audit `SITE` obyektini qrep etmişdi, `LEGAL` mətnlərinin içini yox.
`js/legal.js` 30 KB-dır və auditin öz §"Metod" bölməsi bu faylı "qrep/statistik
əhatə" kimi işarələmişdi — yəni məhdudiyyət sənədləşdirilmişdi.

**Dərs:** mətn məzmunu üçün qrep kifayət deyil; **render olunmuş çıxış**
yoxlanmalıdır. `e2e/legal.spec.ts` məhz bunu edir.

### 5.3 · ⚠️ Hüquqi mətndə 4 kod↔mətn ziddiyyəti

Tam siyahı: `docs/AUDIT-TASK-2-LEGAL-GAPS.md`. Ən ciddiləri:

- ❌ **Cookie açıqlaması yanlışdır** — mətn "yalnız localStorage" deyir, kod
  4 HTTP cookie qoyur (`cx_at`, `cx_rt`, `cx_sess`, `cx_oauth`). Cookie
  banner-i məhsulda var, mətn isə cookie istifadəsini inkar edir.
- ❌ **IP / coğrafi mövqe / User-Agent / təhlükəsizlik telemetriyası
  açıqlanmır**, halbuki `sessions` və `security_events` onları saxlayır.
- ⚠️ Arxivləmə açıqlanmır → **AUDIT-TASK-8 `ARCHIVE_HOT_DAYS`-i "90"-a
  qaytarmazdan ƏVVƏL** mətn yenilənməlidir.
- ⚠️ Changelog 2FA-nı "planlanır" göstərir, halbuki TOTP tam tətbiq olunub.

**Mətn QƏSDƏN dəyişdirilmədi** (§2.2 qadağası).

### 5.4 · ⚠️ `index.html`-də 15 hardcoded domen qaldı (şüurlu)

Meyar 12 yalnız `worker/` və `js/`-i əhatə edir və orada təmizdir. `index.html`
statik `<head>` meta-larında və footer linklərində domen hələ hardcoded-dır.

**Niyə hazırda kritik deyil:** Worker `rewriteHead()` ilə **public route-larda**
`canonical`, `og:url`, `hreflang`, `og:image` etiketlərini `SITE_ORIGIN`-dən
ÜZƏRİNƏ YAZIR. Yəni crawler-in gördüyü dəyərlər düzgündür; statik dəyərlər
yalnız fallback-dır.

**Qalan risk:** footer linkləri (`<a href="https://…workers.dev/#about">`)
rewrite olunmur. Domen dəyişəndə onlar köhnə domenə işarə edəcək.
**Tövsiyə:** nisbi URL-lərə (`/#about`) çevrilsin — ayrıca kiçik task.

### 5.5 · ⚠️ `SITE.hours` təsdiqlənməyib

`'B.e – Cümə, 10:00 – 18:00 (GMT+4)'` — footer və Əlaqə səhifəsində göstərilir.
Sahib bu sahəni **təqdim etməmişdi**; mövcud dəyər saxlanıldı, çünki hüquqi
kimlik datası deyil. Tək nəfərlik layihə üçün bu iş saatları vədi realdırsa
saxlanılsın, deyilsə çıxarılsın — **sahibin qərarı**.

---

## 6. Açıq qalan öhdəliklər

- [ ] **🔴 Hüquqi mətnin peşəkar nəzərdən keçirilməsi** — `AUDIT-TASK-2-LEGAL-GAPS.md`
      giriş materialıdır. Xüsusilə §2.4 (cookie) və §2.1 (IP/geo) prioritetdir.
- [ ] **🔴 `collabix.az` DNS + MX** — domen qeydiyyatı tamamlanana qədər
      `privacy@collabix.az` işləmir. Qurulduqdan sonra: `SITE.email`-i keçirmək,
      `SITE_ORIGIN` üçün DNS + Cloudflare custom domain + köhnə URL-lərdən 301
      yönləndirmə planı (SEO reqressiyası olmadan).
- [ ] **🟠 VÖEN** — qeydiyyatdan sonra `SITE`-a əlavə edilsin (uydurma yazılmasın).
- [ ] **🟠 Sosial profillər** — real yaradıldıqdan sonra `SITE.social`-a əlavə et;
      `e2e/legal.spec.ts` onları avtomatik yoxlayacaq.
- [ ] **🟡 `index.html` footer linkləri** nisbi URL-lərə çevrilsin (§5.4).
- [ ] **🟡 Changelog roadmap-ı** real vəziyyətlə uzlaşdırılsın (2FA tətbiq olunub).
- [ ] **🟡 Search Console / Bing doğrulama kodları** — real kod alındıqda meta
      yenidən əlavə edilsin (placeholder çıxarıldı).
- [ ] Git remote qərarı — **repo sahibi** (2.0 yalnız yerli repo qurdu).

### AUDIT-TASK-1-dən miras qalan öhdəliklər

- [ ] **🔴 MƏCBURİ:** `ARCHIVE_HOT_DAYS` → `"90"` (AUDIT-TASK-8-dən sonra).
      ⚠ Bundan **əvvəl** Privacy §4-ə arxivləmə açıqlaması əlavə edilməlidir
      (bax §5.3) — əks halda mətn faktla ziddiyyətə düşəcək.
- [ ] TestSprite API açarının rotasiyası — **gözləyir**.
- [ ] 53 hesaba parol sıfırlama qərarı — git sızması **yoxdur**, disk ifşası
      inkar edilə bilmir → sahibin qərarı.

---

## 7. Geri qaytarma planı

**Artıq `git revert` ilə bənd-bənd mümkündür** (2.0 sayəsində) — AUDIT-TASK-1-də
bu mümkün deyildi.

| Commit | Revert | Gözlənilən təsir |
|---|---|---|
| `dfae56a` (2.6) | `git revert dfae56a` | Yalnız sənəd silinir — kod təsiri **yoxdur** |
| `b6719dc` (2.4+2.7) | `git revert b6719dc` | ⚠ **Uydurma `aggregateRating` geri qayıdır** — etmə |
| `8c2eda1` (2.2) | `git revert 8c2eda1` | ⚠ Hüquqi placeholder-lər geri qayıdır — etmə |
| `d242231` (2.3) | `git revert d242231` | ⚠ Sınıq sosial linklər geri qayıdır — etmə |
| `3a5050b` (2.5+2.4) | `git revert 3a5050b` | ⚠ Dəvət emaili yenidən ölü domenə işarə edər — etmə |
| `c7b4157` (2.0) | — | İlk commit; revert mənasızdır |

**AUDIT-TASK-1 snapshot-ı** (`../collabix-AUDIT-TASK-1-snapshot-*`) hələ də
mövcuddur və git-dən əvvəlki vəziyyəti saxlayır. Parol datası **daxil deyil**
(maşınla təsdiqlənib).
