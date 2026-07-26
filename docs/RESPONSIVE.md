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

## Qaydalar

1. **Toxunma hədəfi ≥ 44px** — bütün düymə/link mobil breakpoint-də `min-height:44px` (kiçik ikonlar üçün 40px minimum).
2. **Horizontal scroll qadağandır** — istisna: heatmap (`.hm-scroll`), kateqoriya tabları (`.task-cat-tabs`), testimonial carousel. Bunlar öz konteynerində `overflow-x:auto` ilə scroll edir, səhifə yox.
3. **Modallar mobildə full-screen** (`≤768`): `.modal-card` avtomatik tam ekran olur — yeni modallar əlavə CSS tələb etmir.
4. **Yan panellər → aşağı yığın**: `.pub-grid`, `.grid2`, `.contact-grid` mobildə tək sütun.
5. **App naviqasiyası**: desktop → sol sidebar; `≤768` → bottom-nav + "⋯ Daha çox" menyusu. Yeni səhifə əlavə edəndə "Daha çox" menyusuna da sal ([js/app.js](js/app.js) `moreNavBtn`).
6. **Public naviqasiya**: `≤960` → hamburger (`#mobileMenu`). Yeni public səhifə linkini həm `#pubNav`, həm `#mobileMenu`, həm footer-ə əlavə et.
7. **Test enləri**: hər dəyişiklikdən sonra 360 / 390 / 768 / 1280-də yoxla (DevTools device toolbar).
8. **i18n**: hər yeni UI mətni `data-i18n` açarı (statik) və ya `t()` (dinamik) ilə — AZ/EN/RU üçün [js/i18n.js](js/i18n.js) lüğətinə əlavə et.
9. **reduced-motion**: animasiyalar `prefers-reduced-motion: reduce`-da avtomatik sönür (qlobal qayda var) — yeni animasiya JS-dədirsə `matchMedia('(prefers-reduced-motion: reduce)')` yoxla.

## TASK-9 — Responsive audit sistemi

**Avtomatik harness:** `npm run audit:responsive` → `test-results/responsive-audit.{json,md}`.
19 səhifə × 13 ölçü matrisini gəzib proqramla ölçür: üfüqi overflow (P0), günahkar
element, touch target <40px, mətn kəsilməsi. Kod (`e2e/audit-lib.ts`) yalançı
pozitivləri filtrləyir: `pointer-events:none` (bağlı dropdown/menu), absolute badge
(bildiriş sayı), checkbox/radio (WCAG native), inline mətn linkləri.

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
    `flex-shrink: 0` + `min-width: auto` (generic `min-width:40` onları sıxıb mətni
    kəsirdi; konteyner onsuz da `overflow-x:auto`).
