# AUDIT-RESP-12 — Frontend Reaksion (Responsive) Audit və Remediasiya

**Tarix:** 2026-08-05 · **Əhatə:** yalnız frontend (backend qatına toxunulmayıb)

---

## 1. Metodologiya

Audit **ölçmə ilə** aparılıb, statik oxu ilə deyil. Bütün yoxlamalar brauzer
kontekstində (`page.evaluate`) real `getComputedStyle` + `getBoundingClientRect`
dəyərləri üzərində işləyir.

**Matris — 1564 kombinasiya:**

| Keçid | Səhifə | En | Tema |
|---|---|---|---|
| Struktur baseline | 23 | 24 | `dark` |
| Şrift metrikləri | 23 | 24 | `cyberpunk` (`--body: Orbitron`) |
| Rəng qatı | 23 | 7 kritik | `light`, `matrix` |
| Oriyentasiya | 23 | 6 landşaft | `dark` |

Enlər: `320 · 360 · 375 · 390 · 414 · 430 · 480 · 540 · 576 · 640 · 768 · 820 ·
853 · 912 · 1024 · 1152 · 1280 · 1366 · 1440 · 1536 · 1600 · 1728 · 1920 · 2560`

Landşaft: `568×320 · 812×375 · 932×430 · 1024×768 · 1180×820 · 1368×912`

Yoxlanan kateqoriyalar: səhifə/element daşması, mətn kəsilməsi, toxunma hədəfi,
flex/grid daşması, fixed-sticky toqquşması, üfüqi scroll konteynerləri, media
daşması və aspekt pozulması, cədvəl daşması, modal/overlay ölçüsü, sidebar/navbar
yığılması, element örtüşməsi, CLS, safe-area, şrift ölçüsü.

---

## 2. 🔴 Ən vacib tapıntı — ALƏTİN ÖZÜ ÖLÜ İDİ

Auditə başlayanda mövcud `e2e/audit-lib.ts`-in **6 detektoru heç vaxt bir element
də görməmişdi**. Onlar elementləri belə sorğulayırdı:

```js
document.querySelectorAll('[style*="display: flex"]')
document.querySelectorAll('[style*="position: fixed"]')
document.querySelectorAll('[style*="overflow-x: auto"]')
```

Bu, **inline `style=` atributunu** axtarır. Collabix-də layout yalnız siniflərlə
qurulur, üstəlik CSP inline `style=` atributunu bloklayır. Nəticə: flex/grid
daşması, fixed-sticky toqquşması, scroll konteynerləri və safe-area yoxlamaları
**boş çıxırdı** — audit "təmiz" görünürdü, çünki heç nəyə baxmırdı.

### 2.1 Kök kor nöqtə

`00-tokens-base.css:178`:

```css
html, body { overflow-x: hidden; }
```

Bu, daşmanı **düzəltmir, gizlədir**: `scrollWidth` sıxılır. Element daşması
yoxlaması isə `if (docW > vw)` şərtinin İÇİNDƏ idi — yəni şərt heç vaxt doğru
olmadığı üçün daşma yoxlaması tamamilə ölü qalırdı.

**Düzəliş:** daşma artıq səhifə daşmasından asılı olmadan, element rect-ləri ilə
ölçülür; `html`/`body` qanuni saxlayıcı sayılmır.

---

## 3. Ölçmə nəticələri

| | İlk (qüsurlu detektor) | Baseline (düzəldilmiş) | Remediasiyadan sonra |
|---|---|---|---|
| Ümumi hesab | 46/100 | 77/100 | **DOLDURULACAQ** |
| Pozuntu | 24 067 | 7 121 | **DOLDURULACAQ** |
| Unikal reyestr sətri | 52 | 19 | **DOLDURULACAQ** |
| P0 | 0 | 0 | **DOLDURULACAQ** |

### 3.1 Yalançı tapıntıların təmizlənməsi

İlk ölçmədəki 24 067 rəqəminin böyük hissəsi **detektor qüsuru** idi, kod qüsuru
deyil. Hər biri ayrıca təsdiqlənib və düzəldilib:

| Yalançı | Say | Kök səbəb |
|---|---|---|
| `flex-wrap` | 10 924 | Sütun istiqamətli flex konteynerdə **enlər** toplanırdı (`.how-steps`, `.contact-form`, `.contact-info`, `.testi-content`, `.social-share-panel` — hamısı `flex-direction: column`) |
| `layout-overlap` | 1 013 | `position: fixed` üzən panel (`.social-share-panel`) məzmunun üstündə durmaq üçün var — örtüşmə sayılmamalıdır |
| `fixed-sticky` + `safe-area` | 1 104 | `pointer-events: none` dekorativ qatlar (`#cp-cursor`, `#cp-canvas`, `.hero-floats`) |
| `sidebar-collapse` | 405 | Dar ekranda tam enə yığılmış sidebar pozuntu deyil |
| `touch-target` (skip-link) | 1 012 | `.skip-to-content { top: -100% }` — yalnız klaviatura üçün, toxunulmur |
| `layout-overlap` (akkordeon) | ~400 | Yığılmış `.faq-a` (`grid-template-rows: 0fr`) daxilindəki elementlər eyni nöqtədə "üst-üstə düşür" |
| `layout-overlap` (inline) | 44 | Sətir keçirən inline `<span>`-in `getBoundingClientRect()`-i bütün sətir qutularının birləşməsini verir (`#pfYear` 320px-də) |

---

## 4. 🔴 Kök səbəb: `:not()` spesifiklik tələsi

Ölçülmüş toxunma pozuntularının demək olar **hamısının** tək bir səbəbi var idi.

`75-touch.css`-də:

```css
button:not(.hd):not(.spark-tip):not(.testi-dot),
[role=tab] { min-height: 40px; min-width: 40px; }   /* (0,3,1) */
```

`:not()` özü spesifikliyə sayılmır, amma **arqumenti sayılır** → **(0,3,1)**.
Faylda ondan **sonra** gələn bütün "44px" qaydaları isə (0,1,0)-dır:

```css
.btn-mini, .btn-small, .btn-primary, .btn-danger, .pp, .cmp-chip { min-height: 44px; }
```

Cascade fərqli spesifiklikdə sıraya baxmır → **(0,3,1) qalib gəlirdi** və faylın
bütün 44px niyyəti heç vaxt icra olunmurdu. Ölçmə bunu ədədlə təsdiqlədi:

| Element | Gözlənilən | Ölçülən | Səbəb |
|---|---|---|---|
| `.btn-primary` | ≥44px | **43px** | 44 qaydası tətbiq olunmurdu; təbii hündürlük qalırdı |
| `.ph-theme`, `.ph-burger`, `.code-copy`, `.code-collapse-btn` | ≥44px | **40×40** | generik qayda |
| `.testi-dot` | 8×8 nöqtə | **40×40 blok** | `[role=tab]` seçicisi `:not(.testi-dot)` istisnasını keçirdi |
| `.share-btn` | CSS-də `34px` yazılıb | **40×40** | bəyannamə ilə render uyğun deyildi |

---

## 5. Remediasiya reyestri

| # | Fayl | Dəyişiklik | Kateqoriya |
|---|---|---|---|
| 1 | `75-touch.css` | Baza toxunma həddi 40 → **44px**; `[role=tab]:not(.testi-dot)` | Toxunma / a11y |
| 2 | `75-touch.css` | `.testi-dot` — 44px hit-area `padding` + `background-clip: content-box` ilə; **görünən nöqtə 8px qalır** | Vizual reqressiyanın qarşısı |
| 3 | `65-a11y-seo.css` | `.share-btn` ≤1024 → 44×44 | Toxunma |
| 4 | `20-feed.css` | `.code-lang-badge` 10.56px → `var(--fs-xs)`; hardcoded `rgba` → `color-mix(var(--accent))` | Tipoqrafiya + tema |
| 5 | `60-responsive.css` | `.pf-inner`-dəki **ölü** `flex-direction: column` silindi (grid konteynerdir) | Kod bütövlüyü |
| 6 | `40-admin.css` + `60-responsive.css` | Bottom-nav etiketi: 4 ziddiyyətli qayda → 1 monoton `clamp()` | Tipoqrafiya |
| 7 | `00-tokens-base.css` | Qlobal `img, video { max-width:100%; height:auto }` | Media |
| 8 | `js/util.js` | `avatarNode()` → `loading="lazy"` + `decoding="async"` | Performans |
| 9 | `00-tokens-base.css` | Ölü boş `.btn-primary:hover` qaydası silindi | Kod bütövlüyü |
| 10 | 7 fayl | Modal/overlay/landing → `dvh` fallback naxışı | Mobil viewport |
| 11 | 8 fayl | `-webkit-backdrop-filter` — 13/13 normallaşdırıldı (sıra da düzəldildi) | iOS Safari |
| 12 | 6 fayl | `-webkit-user-select` — 7/7 normallaşdırıldı | iOS Safari |

---

## 6. Qəbul edilmiş istisnalar (əsaslandırma ilə)

| Element | Vəziyyət | Niyə dəyişdirilmir |
|---|---|---|
| `.tl-initial` — 9.28px | 16×16 plitədə ≤2 hərf | **Mətn deyil, qrafikdir**: loqosu olmayan texnologiya üçün loqo əvəzidir və yanındakı 16px loqo şəkilləri ilə vizual paritet saxlayır. Ölçünü qaldırmaq plitəni sındırar. WCAG-də minimum şrift ölçüsü YOXDUR (SC 1.4.4 *böyütmə* haqqındadır; px dəyərlər zoom ilə böyüyür). |
| `.share-btn` desktop 40px | >1024px | Layihənin sənədləşdirilmiş konvensiyası: 44px toxunma aralığında (≤1024), 40px siçan aralığında. Desktop ölçüsünü dəyişmək vizual reqressiya olardı. |
| `.main { max-width: 1140px }` | 2560px-də ağ boşluq | Oxunaqlılıq məhdudiyyətidir (sətir uzunluğu). Lenti 2000px-ə açmaq UX-i pisləşdirər — bu, dizayn qərarıdır, qüsur deyil. |
| `.testi-dots` aralığı ≤1024-də artır | 8px → 36px | 8px nöqtəyə 44px toxunma sahəsi verməyin qaçılmaz nəticəsi. Görünən nöqtə dəyişmir; alternativ (qutunu şişirtmək) nöqtəni 44px bloka çevirərdi. |

---

## 7. Backend asılılıqları

Bu audit **yalnız frontend** əhatəsindədir. Backend qatına (API, DB, avtorizasiya,
servislər) heç bir dəyişiklik edilməyib.

Frontend tərtibatı üçün mock data generasiya olunmayıb; audit real seed
məlumatları ilə işləyir. Aşkar edilmiş **backend asılı frontend limitasiyası
yoxdur** — bütün tapıntılar təmiz CSS/DOM səviyyəsində həll olunub.

---

## 8. Doğrulama

- `npm run audit:responsive` — 1564 kombinasiya
- `npm run e2e` — reqressiya dəsti
- `npx tsc -p tsconfig.e2e.json --noEmit` — tip yoxlaması
- `npx vite build` — CSS parse + bundle

**DOLDURULACAQ: yekun nəticələr**
