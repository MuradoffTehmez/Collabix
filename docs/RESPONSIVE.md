# Collabix — Responsive Konvensiyalar

Hər yeni komponent bu qaydalara uymalıdır.

## Breakpoint-lər (max-width)

| Ad | En | Nə dəyişir |
|----|----|-----------|
| `1280` | desktop-geniş | default layout |
| `1024` | desktop-dar | yan panellər daralır |
| `1024` | tablet/touch sərhədi | public header nav → hamburger (TASK-9); touch hədəfləri ≥44px aktivləşir |
| `960`  | (köhnə public header — indi 1024) | pub-grid tək sütun |
| `768`  | tablet/mobil sərhədi | sidebar gizlənir → bottom-nav; modallar **full-screen**; cədvəl/siyahılar kart olur; testimonials → swipe carousel; chat/dm master-detail |
| `480`  | telefon | grid-lər tək sütun, composer stack, axtarış gizlənir |
| `360`  | kiçik telefon | şrift/padding minimuma |
| `320`  | ultra kiçik | minimum dəstəklənən en |

**Audit edilən enlər (24)** — CSS breakpoint-lərindən FƏRQLİDİR: breakpoint qayda
yazdığımız yerdir, audit enləri isə real cihaz ölçüləridir. Aralıq enlərdə
(390/414/430/540/853/1152/1366/1600/1728) qayda yoxdur, amma qüsur ola bilər:

`320 · 360 · 375 · 390 · 414 · 430 · 480 · 540 · 576 · 640 · 768 · 820 · 853 · 912 · 1024 · 1152 · 1280 · 1366 · 1440 · 1536 · 1600 · 1728 · 1920 · 2560`

Landşaft: `568×320 · 812×375 · 932×430 · 1024×768 · 1180×820 · 1368×912`.

## Qaydalar

1. **Toxunma hədəfi ≥ 44px** — `≤1024px`-də bütün düymə/link üçün `min-height` VƏ `min-width` 44px. **40px istisnası ARTIQ YOXDUR** (AUDIT-RESP-12).
   - Vizual olaraq kiçik qalmalı elementlərə (karusel nöqtəsi kimi) qutunu şişirtmək əvəzinə `padding` + `background-clip: content-box` verilir: element 44px olur, görünən forma kiçik qalır.
2. **Horizontal scroll qadağandır** — istisna: heatmap (`.hm-scroll`), kateqoriya tabları (`.task-cat-tabs`), testimonial carousel. Bunlar öz konteynerində `overflow-x:auto` ilə scroll edir, səhifə yox.
3. **Modallar mobildə full-screen** (`≤768`): `.modal-card` avtomatik tam ekran olur — yeni modallar əlavə CSS tələb etmir.
4. **Yan panellər → aşağı yığın**: `.pub-grid`, `.grid2`, `.contact-grid` mobildə tək sütun.
5. **App naviqasiyası**: desktop → sol sidebar; `≤768` → bottom-nav + "⋯ Daha çox" menyusu. Yeni səhifə əlavə edəndə "Daha çox" menyusuna da sal ([js/app.js](js/app.js) `moreNavBtn`).
6. **Public naviqasiya**: `≤960` → hamburger (`#mobileMenu`). Yeni public səhifə linkini həm `#pubNav`, həm `#mobileMenu`, həm footer-ə əlavə et.
7. **Test enləri**: hər dəyişiklikdən sonra 360 / 390 / 768 / 1280-də yoxla (DevTools device toolbar).
8. **i18n**: hər yeni UI mətni `data-i18n` açarı (statik) və ya `t()` (dinamik) ilə — AZ/EN/RU üçün [js/i18n.js](js/i18n.js) lüğətinə əlavə et.
9. **reduced-motion**: animasiyalar `prefers-reduced-motion: reduce`-da avtomatik sönür (qlobal qayda var) — yeni animasiya JS-dədirsə `matchMedia('(prefers-reduced-motion: reduce)')` yoxla.

## TASK-9 — Responsive audit sistemi

**Avtomatik harness:** `npm run audit:responsive` → `audit-reports/audit.{html,md,json}`
(qovluq `.gitignore`-dadır — generasiya olunur, mənbə deyil).

Matris (AUDIT-RESP-12-də genişləndi) — **1564 kombinasiya**:
- 23 səhifə × 24 en × `dark` (struktur baseline)
- 23 səhifə × 24 en × `cyberpunk` (şrift `Orbitron`-a dəyişir → mətn metrikləri
  fərqlidir, ona görə TAM en dəsti lazımdır)
- 23 səhifə × 7 kritik en × `light` + `matrix` (yalnız rəng dəyişir)
- 23 səhifə × 6 landşaft ölçüsü

Hesabat hər kombinasiya üçün ayrıca bölmə YAZMIR — eyni `(kateqoriya + seçici)`
pozuntusu bir sətirdə aqreqasiya olunur, təsirlənən en/tema/səhifə siyahısı ilə.

⚠ **Tarixi xəbərdarlıq:** bu kitabxananın 6 detektoru bir müddət ÖLÜ idi —
elementləri `[style*="display: flex"]` kimi **inline style atributu** ilə
sorğulayırdı. Layout burada yalnız siniflərlə qurulur (üstəlik CSP inline `style=`
bloklayır), ona görə həmin yoxlamalar heç vaxt bir element də tapmırdı və audit
"təmiz" görünürdü. Yeni detektorlar MÜTLƏQ `getComputedStyle` üzərindən işləməlidir.

Yalançı pozitiv filtrləri: `pointer-events:none` (dekorativ qat — kursor, fon
canvas-ı, hero float-ları), `position:fixed` üzən panellər (örtüşmə yoxlamasında),
yığılmış akkordeon (`clientHeight === 0` + `overflow:hidden`), sətir keçirən inline
element (`getClientRects().length > 1`), viewport-dan kənar elementlər
(`.skip-to-content`), qlif plitələri (≤2 simvol, ≤20px qutu), checkbox/radio,
inline mətn linkləri.

**Daimi reqressiya toru:** `e2e/responsive-audit.spec.ts` — 11 səhifə × 4 ölçüdə
pozuntu olsa FAIL. Hər dəyişiklikdən sonra `npm run e2e` bunu işlədir.

### Kök səbəb qaydaları (audit-in tapdığı əsas naxışlar)

10. **Flex daşma → `min-width: 0`** — flex uşağı (`.main`) default `min-width: auto`
    ilə məzmununa görə genişlənir. Heatmap-ın `max-content` eni `.main`-ı viewport-dan
    itələyirdi. Flex/grid uşaqlarına `min-width: 0` (üfüqi daşmanın ən çox səbəbi).
11. **Gizli overlay rect saxlayır** — `visibility:hidden` popover (`.skill-pop`) rect-i
    saxlayır və viewport-dan çıxıb səhifəni daşıdır. Gizli halda `max-width: 0`, açıqda
    `min(Npx, calc(100vw - X))`.
12. **iOS input zoom** — mobildə `font-size: 16px` (kiçik input-a fokusda Safari
    avtomatik zoom edir → layout sıçrayışı). Bütün `input/select/textarea` ≤1024px-də.
13. **CSS cascade sırası** — `styles.css` sonuna `cat >>` ilə əlavə edilən bloklar
    media query-lərdən SONRA gəlir və eyni specificity ilə onları override edir.
    Touch qaydaları qəsdən **faylın sonundadır** (bax "TOUCH TARGET" bloku) ki, baza
    qaydaları (`.md-tb-btn min-width`) üstələməsin.
14. **Scroll-tab düymələri** — `.task-cat-tabs`/`.notif-filters` içindəki düymələr
    `flex-shrink: 0` + `min-width: auto`; konteyner onsuz da `overflow-x:auto`.
    ⚠ Buradakı köhnə izah SƏHV İDİ: "generic `min-width:40` onları sıxıb mətni
    kəsirdi" yazılmışdı. `min-width` DÖŞƏMƏDİR — elementi kiçildə və ya mətni kəsə
    bilməz, yalnız minimumu qaldırır. Qayda faydalıdır (nowrap + shrink qorunması),
    lakin səbəbi başqadır.

15. **🔴 `:not()` SPESİFİKLİK TƏLƏSİ** — AUDIT-RESP-12-nin kök səbəbi.
    `:not()` özü spesifikliyə sayılmır, amma ARQUMENTİ sayılır:
    `button:not(.hd):not(.spark-tip):not(.testi-dot)` = **(0,3,1)**.
    `75-touch.css`-də bu qayda `min-height/min-width: 40px` verirdi və ondan
    SONRA gələn bütün `.btn-primary` / `.btn-small` / `.pp` (0,1,0) "44px"
    qaydalarını UDURDU — cascade fərqli spesifiklikdə sıraya baxmır.
    Nəticə ölçüldü: `.btn-primary` 43px, `.ph-theme`/`.ph-burger`/`.code-copy`
    40px, `.testi-dot` 8px əvəzinə 40×40 blok, `.share-btn` isə CSS-də `34px`
    yazıldığı halda 40px render olunurdu.
    **Qayda:** `:not()` zənciri olan seçicidə hədd dəyərini ELƏ ORADA düzgün
    ver; onu sonrakı sinif qaydası ilə "düzəltmək" işləmir.

16. **Kök `overflow-x: hidden` daşmanı DÜZƏLTMİR, gizlədir** —
    `00-tokens-base.css`-də `html, body { overflow-x: hidden }` var. O,
    `scrollWidth`-i sıxdığı üçün səhifə səviyyəsində daşma HEÇ VAXT görünmür.
    Audit daşmanı bu səbəbdən element rect-ləri ilə, səhifə daşmasından ASILI
    OLMADAN ölçür (`e2e/audit-lib.ts` → `clipXAncestor` `html`/`body`-ni
    qanuni saxlayıcı SAYMIR).

17. **Sütun flex-də en toplamaq mənasızdır** — `flex-direction: column`
    konteynerdə uşaqlar şaquli yığılır. Daşma yoxlaması yalnız
    `row`/`row-reverse` üçün keçərlidir (auditin ilk versiyası bunu qarışdırıb
    10 924 yalançı tapıntı vermişdi).
