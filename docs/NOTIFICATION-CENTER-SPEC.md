# Bildiriş Mərkəzi — UI/UX Spesifikasiyası

> İcra: commit `f3285ba` · miqrasiya `0049_notification_center.sql` ·
> Deploy: `b37cc0dd-75f3-4bca-bb1a-d60d00df9166`
> Fayllar: `js/notify.js`, `css/88-notifications.css`,
> `worker/routes/notification.ts`, `worker/services/notification/taxonomy.ts`

Bu sənəd həm **Figma üçün dizayn qaynağı**, həm də **frontend üçün icra
müqaviləsi**dir. Hər ölçü koddakı nişana bağlıdır — sənəd və kod ayrılmasın.

---

## 1. Dizayn rasionalı

### 1.1 Nə səhv idi

Köhnə səhifə 141 sətirlik modul idi. Problemi «çirkin görünmək» deyil,
**məlumat verməmək** idi:

| Simptom | Kök səbəb |
|---|---|
| Bütün bildirişlər eyni görünürdü | Tip yalnız emoji ilə ifadə olunurdu; emoji `currentColor`-a tabe olmadığı üçün rəng kodlaması **mümkün deyildi** |
| «Zara bəyəndi» × 8 sətir | Qruplaşdırma yox idi |
| Hansı paylaşım? | Bildiriş mətni yalnız feli ifadədir (`paylaşımını bəyəndi`) — obyekt görünmürdü |
| Komanda bildirişləri filtrsiz | Client-də tip siyahısı **əl ilə** yazılmışdı, səkkiz komanda tipi ora heç vaxt əlavə edilməmişdi |
| 60-dan sonrası əlçatmaz | Server kursor dəstəkləyirdi, UI istifadə etmirdi |
| Heç bir əməliyyat | Yalnız «hamısını oxunmuş et» |

### 1.2 Aparıcı prinsiplər

1. **Sıxlıq ≠ qarışıqlıq.** Kart hündürlüyü 76px-dir (önizləmə ilə ~104px).
   Ekranda 8–9 sətir görünür. Boşluq artırmaq «premium» deyil — *skan sürətini*
   azaldır.
2. **Rəng semantikadır, dekorasiya deyil.** Tip rəngi yalnız ikon/nöqtə/haşiyədə
   işlənir. Gövdə mətni **həmişə** `--text`/`--muted` — çünki `#e5484d` ağ fonda
   3.7:1 verir: qrafik üçün kifayət (WCAG 1.4.11 → 3:1), mətn üçün yox (4.5:1).
3. **Rəng heç vaxt tək göstərici deyil.** Hər tipin öz Lucide ikonu var.
4. **Sayğac bütün datanı sayır, ekranı yox.** Kartlar ayrıca `/stats`
   endpoint-indən qidalanır — əks halda rəqəm sonsuz sürüşmə ilə dəyişərdi.
5. **Optimistik, amma yalançı deyil.** Əməliyyat dərhal ekranda görünür;
   server rədd etsə `reload()` həqiqəti geri qaytarır.
6. **Ölç, təxmin etmə.** Yapışqan ofsetlər `ResizeObserver` ilə ölçülür.

### 1.3 Tema qərarı

Spesifikasiya `#F7F9FC` fon + ağ kart istəyirdi. Collabix dörd temalıdır
(dark/light/matrix/cyberpunk). Sabit hex yazmaq üç temanı sındırardı.

**Həll:** nişanlar. Açıq temada `--bg` = `#f2f5fc`, `--surface` = `#ffffff` —
yəni tələb **onsuz da ödənir**, digər temalar da sağ qalır.

---

## 2. Komponent ierarxiyası

```
#page-notifs
├── header.nc-head
│   ├── .nc-head__text
│   │   ├── h1.nc-title                 "Bildirişlər"
│   │   ├── p.nc-sub                    alt-başlıq (max 64ch)
│   │   └── p.nc-meta
│   │       ├── .nc-meta__count         "12 oxunmamış bildiriş" (::before nöqtə)
│   │       └── .nc-meta__sync          "Son sinxron: 2 dəqiqə əvvəl"
│   └── .nc-head__actions
│       ├── button.c-icon-btn.nc-iconbtn      ↻ yenilə (spin animasiyası)
│       ├── button.c-btn--ghost               ⚙ Parametrlər
│       └── button.c-btn--primary             ✓✓ Hamısını oxunmuş et
│
├── .nc-stats                            9 kart · auto-fit minmax(132px, 1fr)
│   └── button.nc-stat[.is-active]
│       ├── .nc-stat__ic.nc-t--<ton>     30×30, fon = currentColor 12%
│       └── .nc-stat__body
│           ├── .nc-stat__num            countUp animasiyası, tabular-nums
│           ├── .nc-stat__lbl
│           └── .nc-stat__trend          "+5 / 24s"
│
├── .nc-controls                         position: sticky
│   ├── .nc-searchrow
│   │   ├── span.c-search.nc-search  →  input#notifSearch
│   │   └── button#notifSelectBtn        "Seç" ⇄ "Bitir"
│   └── .nc-filters[role=tablist]        12 pill · yan sürüşmə + mask
│       └── button.nc-pill[.is-active]
│           ├── .nc-pill__ic  ├ .nc-pill__lbl  └ .nc-pill__count
│
├── .nc-bulkbar[hidden]                  seçim rejimi · sticky
│   ├── .nc-bulk__count  ├ .nc-bulk__link  ├ .nc-bulk__spacer
│   └── [Oxunmuş et] [Arxivə at] [Sil] [✕]
│
├── #notifList[aria-live=polite]
│   ├── .nc-group-lbl                    sticky · SABİTLƏNMİŞ / BU GÜN / …
│   ├── .nc-group[.is-open]              çoxlu sətir birləşəndə
│   │   ├── article.nc-card              qrup başlığı
│   │   └── .nc-group__rest              açılmış alt sətirlər
│   └── article.nc-card
│       ├── .nc-card__pick               seçim (yalnız .is-selecting)
│       ├── .nc-card__avatar
│       │   ├── .avatar | .nc-avstack     tək ⇄ 3-lük yığın
│       │   └── .nc-card__type            20px tip nişanı (avatarın küncündə)
│       ├── .nc-card__body
│       │   ├── p.nc-card__title          3 sətir clamp
│       │   ├── .nc-preview               şəkil 40px + 2 sətir mətn
│       │   └── .nc-card__meta            time · .nc-flag · .nc-card__toggle
│       └── .nc-card__side
│           ├── .nc-dot                   oxunmamış (pulse)
│           ├── .nc-actions               hover qatı (absolute)
│           └── .nc-menu                  "daha çox" popover
│
└── .nc-sentinel                          IntersectionObserver hədəfi
```

Modal (`showModal`): `.nc-set` → tip açarları (2 sütun grid) · çatdırılma
kanalları · sussuz edilənlər siyahısı.

---

## 3. Aralıq (spacing) sistemi

4px əsaslı şkala (`css/15-components.css`, `:root`):

| Nişan | Dəyər | Bildiriş mərkəzində harada |
|---|---|---|
| `--sp-1` | 4px | ikon↔mətn, meta elementləri arası |
| `--sp-2` | 8px | kart daxili boşluq (mobil), pill aralığı, kartlar arası |
| `--sp-3` | 12px | kart doldurması (desktop), avatar↔gövdə |
| `--sp-4` | 16px | başlıq↔kartlar, panel doldurması |
| `--sp-5` | 24px | başlıq blokunun alt boşluğu, modal bölmələri |
| `--sp-6` | 32px | qrup alt sətirlərinin girintisi |
| `--sp-7` | 48px | boş vəziyyət doldurması |

Modul nişanları:

| Nişan | Desktop | ≤768px |
|---|---|---|
| `--nc-avatar` | 44px | 40px |
| `--nc-card-pad` | 12px | 8px |
| `--nc-gap` | 12px | 8px |

**Şaquli ritm:** kartlar arası 8px, tarix bölməsi arası 16px üst / 8px alt.
Sıxlıq qəsdən yüksəkdir — bu, siyahı ekranıdır, marketinq səhifəsi deyil.

---

## 4. Tipoqrafiya sistemi

| Rol | Nişan | Ölçü | Çəki | Sətir hündürlüyü | Şrift |
|---|---|---|---|---|---|
| Səhifə başlığı | `--fs-2xl` | 28px | 700 | 1.25 | `--display` (Space Grotesk) |
| Alt-başlıq | `--fs-sm` | 13px | 400 | 1.55 | `--body` (Inter) |
| Meta sətri | `--fs-xs` | 12px | 500/600 | 1.55 | `--body` |
| Kart sayğacı | `--fs-lg` | 18px | 700 | 1.1 | `--display` |
| Kart etiketi | `--fs-xs` | 12px | 600 | — | `--body` |
| Trend mətni | — | 11px | 400 | — | `--body` |
| Pill etiketi | `--fs-sm` | 13px | 600 | — | `--body` |
| **Bildiriş başlığı** | `--fs-sm` | 13px | 400 → **600 oxunmamışda** | 1.55 | `--body` |
| Aktor adı (`<b>`) | `--fs-sm` | 13px | 700 | — | `--body` |
| Önizləmə mətni | `--fs-xs` | 12px | 400 | 1.45 | `--body` |
| Vaxt damğası | `--fs-xs` | 12px | 400 | — | `--body` |
| Tarix bölməsi | — | 11px | 600 | — | `--mono` · `.08em` · uppercase |
| Nişan/bayraq | — | 11px | 700 | — | `--body` |

**Qaydalar**

- Ən kiçik ölçü **11px** və yalnız köməkçi metada (AUDIT-9 həddi 11px-dir).
- Rəqəm daşıyan hər yerdə `font-variant-numeric: tabular-nums` — sayğac
  animasiyası sətri sıçratmasın.
- Başlıq **3 sətirdən sonra** kəsilir (`-webkit-line-clamp: 3`); tam mətn
  `aria-label`-dədir, yəni ekran oxuyucusu üçün itmir.
- Mətn ölçüsü heç yerdə `px` sabitlə deyil, nişanla verilir → Dynamic Type
  və brauzer zoom-u pozulmur.

---

## 5. Rəng nişanları

### 5.1 Səth və mətn (mövcud qlobal nişanlar)

| Nişan | dark | light | Rol |
|---|---|---|---|
| `--bg` | `#0b1020` | `#f2f5fc` | səhifə fonu |
| `--surface` | `#151b2e` | `#ffffff` | kart fonu |
| `--surface-2` | `#1c2440` | `#e8edf9` | sayğac nişanı, hover |
| `--border` | `#2a3358` | `#c9d3ec` | haşiyə |
| `--text` | `#eef1fb` | `#141a2e` | əsas mətn |
| `--muted` | `#8d97b8` | `#5b678c` | ikinci dərəcəli |
| `--coral` | `#4a8fff` | `#2f6fe0` | aksent (oxunmamış) |
| `--coral-dim` | `#1c2c52` | `#dce8ff` | **oxunmamış kart fonu** |

### 5.2 Tip tonları (bu modul)

| Tip | Nişan | dark | light | İkon |
|---|---|---|---|---|
| Bəyənmə / re-post | `--nc-like` | `#e5484d` | `#d32f2f` | `heart` / `refresh` |
| Şərh | `--nc-comment` | `#3b82f6` | `#1d63d1` | `message` |
| Mesaj | `--nc-message` | `#22c55e` | `#15803d` | `mail` |
| Qeyd | `--nc-mention` | `#a855f7` | `#7e22ce` | `at` |
| İzləyici | `--nc-follow` | `#6366f1` | `#4338ca` | `userPlus` |
| Tapşırıq | `--nc-task` | `#f59e0b` | `#b45309` | `tasks` |
| Komanda | `--nc-team` | `#06b6d4` | `#0e7490` | `users` |
| Layihə | `--nc-project` | `#14b8a6` | `#0f766e` | `folder` |
| Sistem | `--nc-system` | `var(--muted)` | `var(--muted)` | `info` |

Açıq temada hər ton bir pillə tündləşir — ağ səthdə eyni dəyər 3:1 həddinə
yaxınlaşırdı.

**Törəmə fonlar** `color-mix(in srgb, currentColor 12%, transparent)` ilə
hesablanır → hər tip üçün ayrıca sabit yazmaq lazım deyil, tema dəyişəndə
avtomatik izləyir.

### 5.3 Vəziyyət kodlaması

| Vəziyyət | Fon | Sol haşiyə | Əlavə |
|---|---|---|---|
| Oxunmamış | `--coral-dim` | 3px `--coral` | mavi nöqtə (pulse) + başlıq 600 |
| Oxunmuş | `--surface` | 3px **şəffaf** | — |
| Yüksək prioritet | — | 3px `--nc-task` | ⚡ «Yüksək prioritet» bayrağı |
| Sabitlənmiş | — | — | haşiyə 45% coral · 📌 bayraq |
| Seçilmiş | — | — | 1px coral inset ring |

> Sol zolaq oxunmuş kartda da **yer tutur** (şəffaf). Onsuz oxunmuşa keçid
> 3px genişlik dəyişikliyi ilə sətri sıçradardı.

---

## 6. İnteraksiya spesifikasiyası

### 6.1 Kart

| Jest | Nəticə |
|---|---|
| Klik (adi kart) | `routeNotif()` — oxunmuş et + hədəf səhifə |
| Klik (qrup başlığı) | qrupu aç/yığ |
| Klik (seçim rejimi) | seçimə əlavə/çıxar |
| `Enter` / `Space` | klik ilə eyni |
| `↓` / `j` | növbəti karta fokus |
| `↑` / `k` | əvvəlki karta fokus |
| `x` | seçimə əlavə/çıxar |
| Hover | əməliyyat qatı + elevasiya (−1px, `--sh-2`) |
| Sola sürüşdür (>88px) | **sil** (undo ilə) |
| Sağa sürüşdür (>88px) | **arxivə at** |

Sürüşdürmə astanası 12px-dir və şaquli hərəkət üstünlüklüdürsə jest ləğv olunur
— onsuz səhifə sürüşməsi kilidlənirdi.

### 6.2 Sürətli əməliyyatlar (hover qatı)

`✓ Oxunmuş` · `🗄 Arxivə at` (arxivdə: `📥 Arxivdən çıxar`) · `🗑 Sil` · `⋯ Daha çox`

«Daha çox» menyusu: Sabitlə/Ləğv et · Aç · Linki kopyala ·
Bu mövzunu sussuz et · Bu istifadəçini sussuz et · Bu tipi sussuz et.

### 6.3 Toplu əməliyyat

Seçim rejimi «Seç» düyməsi və ya kartda `x` ilə açılır. Zolaq: seçim sayı,
«Hamısını seç/Ləğv et», `Oxunmuş et` · `Arxivə at` · `Sil` · bağla.
Maksimum **200 sətir** bir sorğuda (`BULK_MAX`).

### 6.4 Undo

Silmə `undoToast` ilədir və mutasiya **6 saniyə təxirə salınır** — «Geri al»
basılsa `DELETE` serverə heç vaxt getmir. Bu, silinmiş sətri bərpa etmək
problemini tamamilə aradan qaldırır.

### 6.5 Axtarış

280ms debounce · `Escape` → təmizlə · server tərəfli `LIKE` (mətn + göndərən adı),
`%`/`_` neytrallaşdırılır (`ESCAPE '\'`).

---

## 7. Animasiya spesifikasiyası

Vahid nişanlar: `--mo-fast: 120ms`, `--mo-base: 200ms`,
`--mo-ease: cubic-bezier(.4, 0, .2, 1)`.

| Animasiya | Müddət | Əyri | Xüsusiyyət |
|---|---|---|---|
| Kart görünməsi (`nc-fade-in`) | 200ms | ease | `opacity` + `translateY(6px)` |
| Menyu / toplu zolaq (`nc-slide-down`) | 120/200ms | ease | `opacity` + `translateY(−6px)` |
| Qrup açılışı | 200ms | ease | `nc-slide-down` |
| Hover elevasiyası | 120ms | ease | `translateY(−1px)` + kölgə |
| Kart sayğacı (`countUp`) | 420ms | — | `util.js`, reduced-motion-a hörmət edir |
| Oxunmamış nöqtəsi (`nc-pulse`) | 2.4s ∞ | ease | `box-shadow` halqası |
| Yenilə düyməsi (`nc-spin`) | 600ms | ease | `rotate(360deg)` |
| Əməliyyat qatı | 120ms | ease | `opacity` + `translateX(6px)` |
| Switch sürgüsü | 120ms | ease | `translateX(16px)` |

**Qaydalar**

- Yalnız `transform` və `opacity` animasiya olunur (kompozitor qatı) —
  `width`/`height`/`top` heç yerdə.
- Çıxış animasiyası giriş animasiyasından qısadır (menyu 120ms vs kart 200ms).
- `prefers-reduced-motion: reduce` → `--mo-*` nişanları 0ms olur **və**
  `animation: none` ayrıca verilir (nişan `@keyframes`-i söndürmür).

---

## 8. Əlçatanlıq

| Sahə | İcra |
|---|---|
| Klaviatura | Hər kart `tabindex=0` · `↑↓`/`jk` naviqasiya · `Enter/Space` aç · `x` seç · `Escape` menyunu/modalı bağla |
| Fokus halqası | `2px solid var(--coral)`, `outline-offset: 2px` — **`:focus-visible`**, `:focus` yox (siçan klikində halqa göstərmək qüsur kimi bildirilmişdi) |
| Toxunuş hədəfi | ≥768px-də bütün əməliyyat düymələri `--tap` (44px); pill 38px vizual + 8px aralıq |
| ARIA | `role=button` + `aria-label` (tam mətn) kartda · `role=checkbox` + `aria-checked` seçimdə · `role=tablist`/`tab` + `aria-selected` filtrdə · `role=toolbar` toplu zolaqda · `role=menu`/`menuitem` popoverdə · `aria-pressed` kart və seçim düyməsində |
| Canlı bölgə | `#notifList` → `aria-live="polite"` + `aria-busy` (yüklənərkən `true`) |
| Kontrast | Mətn ≥4.5:1 (`--text`/`--muted`), qrafik ≥3:1 (tip tonları) — hər iki temada ayrıca ölçülüb |
| Rəng tək deyil | Hər tipin öz ikonu; oxunmamış = fon + haşiyə + nöqtə + çəki (dörd siqnal) |
| Kəsilmiş mətn | 3 sətir clamp, tam mətn `aria-label`-də · vaxt damğasının `title`-ı mütləq tarixdir |
| Modal | Fokus tələsi + `Escape` + fokusun çağıran düyməyə qayıtması (`ui.js`) |
| Switch | Əsl `<input type=checkbox>` üstündə qurulub — semantika anadangəlmə |
| Jest alternativi | Sürüşdürmə ilə edilən hər şey düymə ilə də mümkündür (`gesture-alternative`) |

---

## 9. Uyğunlaşan davranış

Breakpoint konvensiyası (`docs/RESPONSIVE.md`): **360 / 480 / 768 / 1024 / 1280**.

| Ölçü | Dəyişiklik |
|---|---|
| **≥1280** (Desktop) | 9 kart bir sıra · əməliyyatlar hover qatı · önizləmə max 520px |
| **1024–1280** | Kartlar `auto-fit` ilə sarılır · önizləmə tam en |
| **768–1024** (Planşet) | Kart minimum 120px · qalan desktop kimi |
| **≤768** (Mobil) | Başlıq şaquli · «Hamısını oxunmuş et» tam en · **statistika kartları yan sürüşür** (sarılsaydı 3 sıra tutub siyahını ekrandan qovurdu) · əməliyyatlar sıraya qayıdır və **həmişə görünür** (hover yoxdur) · düymələr 44px · avatar 40px |
| **≤480** | Sürətli əməliyyatlardan yalnız «⋯» qalır (qalanı sürüşdürmə + menyu ilə) · axtarış sətri sarılır, «Seç» tam en · başlıq düymələri 3 sütunlu grid · önizləmə şəkli 32px |
| **≤360** | Düymə və pill etiketləri gizlənir, yalnız ikon (toxunuş hədəfi qorunur) |

**Yapışqan qatlar** (`--nc-topbar` → `--nc-controls-h` → `--nc-bulk-h`) JS ilə
ölçülür. Sabit `top: 92px` yazılanda 480px-də sarma zamanı axtarış sahəsi
topbar-ın altında gizlənirdi.

Doğrulama: `npm run audit:responsive` → **21 səhifə × bütün ölçülər →
overflow-x 0 · element-overflow 0 · touch 0 · text-clip 0**.

---

## 10. Performans

| Texnika | İcra | Səbəb |
|---|---|---|
| Virtuallaşdırma | `content-visibility: auto` + `contain-intrinsic-size: auto 76px` | Klassik JS virtualizasiyası yapışqan tarix başlıqları və **dəyişkən hündürlüklü qruplar** ilə uyuşmurdu. Brauzer-native həll eyni qazancı sıfır JS ilə verir və sürüşmə çubuğu titrəmir |
| Sonsuz sürüşmə | `IntersectionObserver`, `rootMargin: 600px` | Ekrana çatmadan yüklənir — «boş uç» görünmür |
| Yüklənmiş tavan | 400 sətir (`MAX_LOADED`) | Hər render bütün massivi yenidən qruplaşdırır; tavansız 10 000 sətirdə donardı |
| Önizləmə | **Toplu** endpoint, ən çox 40 id | Sətir-sətir çağırış bir ekranda 40 sorğu = N+1 |
| Avatar | `loading="lazy"` + `decoding="async"` + açıq `width/height` | CLS = 0 |
| Statistika | **Tək** `GROUP BY` sorğusu | Doqquz səbət üçün doqquz `COUNT(*)` doqquz tam skan olardı |
| Qlobal dövrə | `limit=20` (əvvəl 60) | Səhifə bağlı olsa belə 8 saniyədə bir işləyir |
| Axtarış | 280ms debounce | Hər hərf bir `read` sorğusu limit səbətini yeyirdi |
| İndekslər | `(user_id, archived, created_at DESC)` · qismən `pinned_at` · `(user_id, group_key)` | Hər siyahı sorğusunda `archived` filtri var; onsuz indeksdən yalnız prefiks işlənərdi |
| Optimistik UI | Yerli vəziyyət əvvəl, server sonra | 200–400ms gözləmə «düymə işləmir» hissi verirdi |

---

## 11. Data müqaviləsi

### 11.1 Sxem (`migrations/0049`)

```sql
ALTER TABLE notifications ADD COLUMN archived  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN pinned_at INTEGER;              -- NULL = sabitlənməyib
ALTER TABLE notifications ADD COLUMN priority  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN group_key TEXT;

CREATE TABLE notification_mutes (
  user_id TEXT, scope TEXT CHECK (scope IN ('type','user','thread','team','project')),
  target TEXT, created_at INTEGER, PRIMARY KEY (user_id, scope, target)
);
```

### 11.2 Endpoint-lər

| Metod | Yol | Səbət | Təyinat |
|---|---|---|---|
| GET | `/api/notifications` | `read` | `state`·`bucket`·`unread`·`q`·`cursor`·`limit` |
| GET | `/api/notifications/stats` | `read` | səbət başına total/unread/recent |
| GET | `/api/notifications/previews?ids=` | `read` | toplu paylaşım önizləməsi (≤40) |
| GET | `/api/notifications/mutes` | `read` | susdurma siyahısı |
| POST | `/api/notifications/mutes` | `write` | `{scope,target,muted}` toggle |
| POST | `/api/notifications/read-all` | `write` | yalnız arxivlənməmişlər |
| POST | `/api/notifications/bulk` | `write` | `{action, ids|groupKey}` |
| POST | `/api/notifications/:id/read` | `write` | (mövcud) |
| DELETE | `/api/notifications/:id` | `write` | tək silmə |

> Marşrut cədvəlində **sabit seqmentlər parametrlilərdən əvvəldir** —
> `DELETE /:id` naxışı `…/mutes`-a da uyğun gəlir.

### 11.3 Qruplaşdırma açarı

```
dm       → dm:<göndərən>          hər həmsöhbət ayrı
follow   → follow                 hamısı tək qrupda ("N nəfər izlədi")
post-lu  → <tip>:<post>           eyni postdakı reaksiyalar birləşir
qalan    → <tip>:<göndərən>
```

Client qruplaşdırarkən açara **tarix bölməsini də** əlavə edir
(`groupKey|bucket`) — onsuz üç ay əvvəlki bəyənmə bugünkü ilə birləşib
«Bu gün» bölməsinə düşərdi.

> ⚠ Bu qayda **iki yerdədir**: SQL (miqrasiya geriyə-doldurması) və
> TypeScript (`taxonomy.ts`). Dəyişsə **hər ikisi eyni commit-də** dəyişməlidir.

---

## 12. İcra tövsiyələri (növbəti addımlar)

| # | Bənd | Səbəb |
|---|---|---|
| 1 | **E2E örtük** — `e2e/notifs.spec.ts` | Hazırda yalnız responsive audit örtür; qruplaşdırma və toplu əməliyyat üçün reqressiya testi yoxdur |
| 2 | **Realtime insert animasiyası** | Yeni sətir gələndə siyahı `reload()` edir. WebSocket siqnalı ilə **yalnız yeni sətri** əlavə etmək daha yumşaq olardı |
| 3 | **E-poçt bildirişləri** | UI-da açar var, «hazırlanır» kimi işarələnib. `cloudflare-email-service` + gündəlik yığım (digest) axını lazımdır |
| 4 | **Push (Web Push)** | Masaüstü bildirişi yalnız tab açıq olanda işləyir. Əsl push üçün Service Worker + VAPID |
| 5 | **Susdurma sahələri** `team`/`project` | Sxem və endpoint hazırdır, UI hələ yalnız `type`/`user`/`thread` təklif edir |
| 6 | **Arxiv təmizliyi** | Arxivlənmiş sətirlər prune-dan **istisnadır** — sonsuz böyümə riski. Ayrıca 1 illik qayda lazımdır |
| 7 | **`limit=20` qlobal dövrə** | Hələ də polling-dir. Mövcud `PresenceDO` push kanalı ilə əvəzlənə bilər |

---

## 13. Figma üçün qısa qaynaq

**Artboard-lar:** 1440 (Desktop) · 1024 (Planşet) · 390 (Mobil) · 360 (Kiçik)

**Auto-layout:**
- Kart: horizontal, gap 12, padding 12, «Hug» hündürlük
- Gövdə: vertical, gap 4, «Fill» en
- Statistika sırası: horizontal wrap, gap 8, minimum 132

**Stillər:** yuxarıdakı §4 (mətn) və §5 (rəng) cədvəllərini **eyni adlarla**
Figma stilinə çevir (`text/card-title`, `color/type-like`, …). Nişan adları
koddakı CSS dəyişənləri ilə üst-üstə düşməlidir — dizayn↔kod fərqi
adlandırmadan başlayır.

**Komponent variantları:**
- `Card`: `state = read | unread | selected | pinned | priority`
- `Card`: `content = simple | with-preview | grouped`
- `Pill`: `state = default | active`, `count = none | number`
- `Stat`: `state = default | active`, `tone = <9 ton>`
