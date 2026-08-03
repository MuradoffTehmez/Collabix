# İstifadəçi Kataloqu və Profil Səhifələri — UI/UX Spesifikasiyası

> İcra: commit `0cf8f84` (kataloq) + `a8a83b7` (profillər)
> Miqrasiya: `0050_user_directory.sql`, `0051_follow_counters.sql`
> Deploy: `013394e4-f614-4e3e-b2ae-a17ab55cfc13`
>
> Fayllar:
> `js/users.js` · `js/profile.js` · `js/profile-kit.js` ·
> `css/89-users.css` · `worker/routes/directory.ts`

Bu sənəd həm **Figma üçün dizayn qaynağı**, həm də **frontend üçün icra
müqaviləsi**dir. Hər ölçü koddakı nişana bağlıdır — sənəd və kod ayrılmasın.

Əhatə **üç ekrandır**: istifadəçi kataloqu (`#users`), publik profil
(`#u/{username}`) və öz profil (`#profil`). Onlar bilərəkdən **eyni vizual
dili** paylaşır — eyni istifadəçi üç yerdə eyni görünməlidir.

---

## 1. UX rasionalı

### 1.1 Nə səhv idi

Köhnə səhifə **artıq güclü özəyə malik idi** — server tərəfli keyset
səhifələmə, dörd sıralama, dörd filtr, grid/list keçidi. Problem estetika
deyil, **qərar verməyə imkan verməmək** idi:

| Simptom | Kök səbəb |
|---|---|
| Kartlar bir-birindən seçilmirdi | Kartda cəmi ad, `@ad`, seriya, XP və 3 skill var idi |
| «Bu adam kimdir?» sualına cavab yox idi | Bio, iş yeri, yer, status, komanda — heç biri göstərilmirdi |
| «Bu adamla nə ortaqlığım var?» | Ortaq komanda/layihə hesablanmırdı |
| XP mənasız rəqəm idi | `1500 XP` — çox, ya az? Səviyyə, rank, növbəti hədəf yox idi |
| «Mentor axtarıram» ssenarisi işləmirdi | Filtr paneldə gizli, sürətli keçid yox idi |
| Bir filtr üçün 5 sorğu gedirdi | `mutual`/`online` client-də süzülürdü; boş səhifə zənciri quraşdırılmışdı |
| Publik profil boş açılırdı | Səhifə `state.users` keşindən oxuyurdu; keş `LIMIT 500` daşıyır |

### 1.2 Aparıcı prinsiplər

1. **Kataloq skan ekranıdır, qalereya deyil.** Kart hündürlüyü sabitdir,
   sıxlıq yüksəkdir. Boşluq artırmaq «premium» deyil — *qərar sürətini*
   azaldır.
2. **Hər kart bir sual cavablandırır: «bu adamla əlaqə qurummu?»**
   Ona görə kartda ortaqlıq (komanda/layihə), status və rank var — sadəcə
   kimlik deyil.
3. **Rəng semantikadır.** Ton yalnız ikon/nöqtə/haşiyədə işlənir; gövdə mətni
   **həmişə** `--text`/`--muted`, çünki `#22c55e` ağ fonda 3.1:1 verir —
   qrafik üçün kifayət (WCAG 1.4.11 → 3:1), mətn üçün yox (4.5:1).
4. **Rəng heç vaxt tək göstərici deyil.** Hər statusun etiketi, hər rankın adı,
   hər kateqoriyanın mətni var.
5. **Sayğac bütün datanı sayır, ekranı yox.** Kartlar `/users/dir-stats`-dan
   qidalanır — əks halda rəqəm sonsuz sürüşmə ilə dəyişərdi.
6. **Üç ekran bir mənbədən.** `profile-kit.js` rank/status/kateqoriyanı verir;
   publik və öz profil eyni endpoint-i çağırır.
7. **Ölç, təxmin etmə.** Yapışqan ofsetlər `ResizeObserver` ilə ölçülür.

### 1.3 Spesifikasiyadan qəsdən fərqlənən üç qərar

| Tələb | Qərar | Səbəb |
|---|---|---|
| `#F7F9FC` fon + ağ kart | **Nişanlarla** (`--bg`/`--surface`) | Açıq temada `--bg` onsuz da `#f2f5fc`, `--surface` ağdır → tələb ödənir. Sabit hex dark/matrix/cyberpunk temalarını sındırardı |
| **Table View** | **YOX** | Spesifikasiyanın öz «no outdated admin panel patterns» qadağası ilə ziddiyyət təşkil edirdi. Əvəzinə **Compact** rejimi (yüksək sıxlıq, cədvəl deyil) |
| **Premium badge** | **YOX** | Məhsulda monetizasiya konsepti yoxdur. Mövcud `verified` + platforma rolu işlədilir |
| **Most Projects** sıralaması | **YOX** | Üçüncü denormallaşdırılmış sayğac TASK-11 komanda servisinin bir neçə yazı yolunda saxlanılmalıdır. Sayı **göstərilir**, sıralanmır — yarımçıq sayğac səssizcə yalan sıra verərdi |

---

## 2. Komponent ierarxiyası

### 2.1 Kataloq (`#page-users`)

```
#page-users
├── header.ud-head
│   ├── .ud-head__text → h1.ud-title · p.ud-sub
│   └── .ud-head__actions → [İxrac] [Dəvət et]
│
├── .ud-stats                       8 kart · auto-fit minmax(136px, 1fr)
│   └── .ud-stat.ud-t--<ton>
│       ├── .ud-stat__ic            30×30, fon = currentColor 12%
│       └── .ud-stat__body → .ud-stat__num · .ud-stat__lbl · .ud-stat__trend
│
└── .ud-layout                      ≥1280px: grid 1fr / 300px
    └── .ud-main  (≥1280px: display: contents)
        ├── .ud-controls            position: sticky
        │   ├── .ud-searchrow
        │   │   ├── .c-search.ud-search → input#userSearch · kbd.ud-kbd
        │   │   │   └── .ud-suggest[role=listbox]   avtotamamlama
        │   │   ├── button.ud-filterbtn → .ud-filterbtn__n (aktiv filtr sayı)
        │   │   └── .ud-viewtoggle    [grid] [list] [compact]
        │   ├── .ud-quick[role=tablist]   6 sürətli pill
        │   └── .ud-filters[hidden]       8 sahə · ≤480px alt vərəq
        │
        ├── .ud-rail                 ≥1280px sağ sütun, altında üfüqi zolaq
        │   └── .ud-rail__box × 4 → .ud-mini → .ud-mini__id · .ud-mini__f
        │
        ├── .user-grid.view-{grid|list|compact}
        │   └── article.ud-card
        │       ├── .ud-card__av → .avatar · .ud-status
        │       ├── .ud-card__body
        │       │   ├── .ud-id       .ud-name · .ud-handle · .ud-badge
        │       │   ├── .ud-meta     şirkət · yer · qoşulma
        │       │   ├── p.ud-bio     2 sətir clamp
        │       │   ├── .ud-xp       .ud-rank + .ud-xp__bar
        │       │   ├── .ud-skills   .ud-skill.cat-* · .ud-skill--more
        │       │   └── .ud-social   saylar + .ud-mutual
        │       └── .ud-card__side → .ud-seen · .ud-actions
        │
        ├── .dir-sentinel            IntersectionObserver hədəfi
        └── .dir-status[aria-live]   «N nəticə» / xəta
```

**Portal qatı** (`body`-yə çıxarılır, bax §9.3):
`.c-pop.ud-menu` · `.c-pop.ud-hover` · `.c-pop.ud-skillpop`

### 2.2 Profil (`#page-u` və `#page-profil`)

```
section.pp-card
├── .pp-cover                       96px örtük zolağı
└── .pp-head                        margin-top: -38px (avatar örtüyə çıxır)
    ├── .pp-avatar → .avatar(96px) · .ud-status
    ├── .pp-id
    │   ├── h1.pp-name              ad + təsdiq nişanı
    │   ├── .pp-handle              @ad · «İş axtarıram» · «Səni izləyir»
    │   ├── .ud-meta.pp-meta        şirkət · yer · qoşulma · son görülmə
    │   ├── p.pp-bio                · p.pp-goals
    │   └── .ud-xp.pp-xp            rank + zolaq + «növbəti səviyyəyə N XP»
    └── .pp-actions                 [Mesaj] [İzlə] [⋯]  ⇄  [Redaktə et]

.pp-stats                           6 sayğac · auto-fit minmax(104px, 1fr)
section.pp-block × N                Ortaq nöqtələr · Bacarıqlar · Linklər
                                    · Aktivlik xəritəsi · Paylaşımlar
```

> ⚠ **Öz profil və publik profil eyni `pp-*` qatını işlədir.** Fərq yalnız
> əməliyyat sütunundadır. Əvvəl iki səhifə iki ayrı koddan çəkilirdi və eyni
> hesab iki fərqli izləyici sayı göstərə bilirdi.

---

## 3. Aralıq (spacing) sistemi

4px əsaslı qlobal şkala (`css/15-components.css`, `:root`):

| Nişan | Dəyər | Kataloqda harada |
|---|---|---|
| `--sp-1` | 4px | ikon↔mətn, meta elementləri |
| `--sp-2` | 8px | kart daxili gap (mobil), pill aralığı, siyahı boşluğu |
| `--sp-3` | 12px | avatar↔gövdə, kart doldurması (mobil), rail boşluğu |
| `--sp-4` | 16px | kart doldurması (desktop), filtr paneli |
| `--sp-5` | 24px | başlıq alt boşluğu, rail sütun aralığı, `pp-head` yan doldurma |
| `--sp-6` | 32px | — |
| `--sp-7` | 48px | boş vəziyyət doldurması |

### Modul nişanları

| Nişan | Desktop | ≤768px | Compact rejim |
|---|---|---|---|
| `--ud-avatar` | **56px** | 48px | **38px** |
| `--ud-card-pad` | `--sp-4` (16px) | `--sp-3` (12px) | `--sp-2 --sp-3` |
| `--ud-rail-w` | **300px** | — (üfüqi zolaq) | — |
| `--ud-topbar` | ölçülür (~57px) | ölçülür | — |
| `--ud-controls-h` | ölçülür (~108px) | ölçülür | — |

Profil: avatar **96px** (desktop) / **76px** (≤768px), örtük **96px** / **76px**.

**Şaquli ritm:** kartlar arası 8px (list/compact), 12px (grid gap);
bloklar arası 12px; başlıq bloku 24px.

---

## 4. Tipoqrafiya sistemi

| Rol | Nişan | Ölçü | Çəki | Sətir hünd. | Şrift |
|---|---|---|---|---|---|
| Səhifə başlığı | `--fs-2xl` | 28px | 700 | 1.25 | `--display` |
| Profil adı (`.pp-name`) | `--fs-xl` | 22px | 700 | 1.25 | `--display` |
| Alt-başlıq | `--fs-sm` | 13px | 400 | 1.55 | `--body` |
| Kart sayğacı (`.ud-stat__num`) | `--fs-lg` | 18px | 700 | 1.1 | `--display` |
| Kart etiketi | `--fs-xs` | 12px | 600 | 1.25 | `--body` |
| Trend mətni | — | 11px | 400 | — | `--body` |
| **İstifadəçi adı** (`.ud-name`) | `--fs-md` | 15px | 700 | 1.25 | `--body` |
| `@handle` | `--fs-xs` | 12px | 400 | — | `--body` |
| Meta sətri | `--fs-xs` | 12px | 400 | — | `--body` |
| Bio | `--fs-xs` | 12px | 400 | 1.5 | `--body` |
| Rank nişanı | — | 11px | 700 | — | `--body` |
| Rank səviyyəsi (`i`) | — | 11px | 700 | — | `--mono` |
| Bacarıq nişanı | — | 11px | 600 | — | `--body` |
| Səviyyə hərfi (`i`) | — | 11px | 600 | — | `--mono` |
| Sosial say | `--fs-xs` | 12px | 400/700 | — | `--body` |
| Son görülmə | — | 10px | 400 | — | `--body` |
| Klaviatura nişanı (`kbd`) | — | 10px | 400 | 1.4 | `--mono` |
| Rail başlığı (`.ud-rail__h`) | `--fs-xs` | 12px | 700 | — | `--body`, uppercase, `.06em` |

**Qaydalar**

- Ən kiçik ölçü **10px** və yalnız köməkçi metada (`.ud-seen`, `kbd`).
  Əsas mətn heç vaxt 12px-dən kiçik deyil (AUDIT-9 həddi).
- Rəqəm daşıyan **hər yerdə** `font-variant-numeric: tabular-nums` —
  `countUp` animasiyası sətri sıçratmasın.
- Bio **2 sətirdən**, kart başlığı **1 sətirdən** sonra kəsilir;
  tam ad `overflow-wrap: anywhere` ilə sınır, kəsilmir.
- Bacarıq səviyyəsi tək hərflə göstərilir (**B**/**O**/**Q**) və tam dəyər
  `title` atributundadır — dar nişan + itməyən məlumat.

---

## 5. Rəng nişanları

### 5.1 Səth və mətn (qlobal)

| Nişan | dark | light | Rol |
|---|---|---|---|
| `--bg` | `#0b1020` | `#f2f5fc` | səhifə fonu |
| `--surface` | `#151b2e` | `#ffffff` | kart fonu |
| `--surface-2` | `#1c2440` | `#e8edf9` | hover, zolaq fonu |
| `--border` | `#2a3358` | `#c9d3ec` | haşiyə |
| `--text` | `#eef1fb` | `#141a2e` | əsas mətn |
| `--muted` | `#8d97b8` | `#5b678c` | ikinci dərəcəli |
| `--coral` | `#4a8fff` | `#2f6fe0` | aksent |
| `--coral-dim` | `#1c2c52` | `#dce8ff` | aktiv pill fonu |

### 5.2 Status tonları

| Status | Nişan | dark | light | Nə vaxt göstərilir |
|---|---|---|---|---|
| Onlayn | `--ud-online` | `#22c55e` | `#15803d` | presence ölçüsü |
| Uzaqda | `--ud-away` | `#f59e0b` | `#b45309` | əl ilə **+ onlayn** |
| Məşğul | `--ud-busy` | `#ef4444` | `#dc2626` | əl ilə **+ onlayn** |
| Narahat etməyin | `--ud-dnd` | `#dc2626` | `#dc2626` | əl ilə **+ onlayn** |
| İş axtarıram | `--ud-hiring` | `#0ea5e9` | `#0369a1` | əl ilə, **onlayndan asılı deyil** |
| Oflayn | `--ud-offline` | `--muted` | `--muted` | default |

> 🔴 **İki mənbə birləşir.** `presence` — «bağlıdırmı» (ölçülür).
> `users.status` — «nə demək istəyir» (əl ilə). Oflayn istifadəçinin `busy`
> statusu **göstərilmir**: etiket bağlantı faktını əvəz etmir və «Məşğul»
> yazısı onlayn olduğu təəssüratı yaradardı. Yeganə istisna `hiring` —
> uzunmüddətli niyyətdir (LinkedIn «Open to work» məntiqi).

### 5.3 Rank tonları

Rank **yeni məlumat deyil** — `levelFromXP()` səviyyəsindən törəyir.

| Rank | Səviyyə | Nişan | dark | light |
|---|---|---|---|---|
| Bürünc | Lv 1–2 | `--ud-bronze` | `#b45309` | `#b45309` |
| Gümüş | Lv 3–4 | `--ud-silver` | `#94a3b8` | `#64748b` |
| Qızıl | Lv 5–6 | `--ud-gold` | `#eab308` | `#a16207` |
| Almaz | Lv 7–8 | `--ud-diamond` | `#22d3ee` | `#0e7490` |
| Usta | Lv 9 | `--ud-master` | `#a855f7` | `#7e22ce` |
| Əfsanə | Lv 10 | `--ud-legend` | `--coral` | `--coral` |

**XP astanaları** (`js/util.js` → `LEVEL_THRESHOLDS`):
`0 · 500 · 1500 · 3500 · 7000 · 12000 · 18000 · 26000 · 36000 · 50000`

> ⚠ Astanalar **üç yerdədir**: `migrations/0034`, `worker/level.ts`,
> `js/util.js`. Dəyişsə **hər üçü eyni commit-də** dəyişməlidir. Rank cədvəli
> dördüncü nüsxə **yaratmır** — səviyyədən törəyir.

### 5.4 Bacarıq kateqoriyaları

Mənbə: `taxonomies.category` (miqrasiya 0050) — **admin panelindən idarə olunur**.

| Kateqoriya | Nişan | dark | light | Mövcud skill-lər |
|---|---|---|---|---|
| Dil | `--ud-cat-lang` | `#3b82f6` | `#1d63d1` | Python, JS, TS, Java, C++, C#, Go, Rust, Kotlin, Swift, PHP |
| Veb | `--ud-cat-web` | `#f97316` | `#c2410c` | HTML/CSS |
| Baza | `--ud-cat-db` | `#8b5cf6` | `#6d28d9` | SQL |
| DevOps | `--ud-cat-devops` | `#14b8a6` | `#0f766e` | Bash |
| Bulud | `--ud-cat-cloud` | `#0ea5e9` | `#0369a1` | *(ehtiyatda)* |
| Dizayn | `--ud-cat-design` | `#ec4899` | `#be185d` | *(ehtiyatda)* |
| Təhlükəsizlik | `--ud-cat-security` | `#ef4444` | `#b91c1c` | *(ehtiyatda)* |
| Gömülü | `--ud-cat-embedded` | `#84cc16` | `#4d7c0f` | Arduino/C |
| Danışıq dili | `--ud-cat-spoken` | `#06b6d4` | `#0e7490` | 8 dil |
| Naməlum | `--ud-cat-other` | `--muted` | `--muted` | catch-all |

### 5.5 Statistika kartı tonları

`--ud-accent` (`--coral`) · `--ud-online` · `--ud-follow` `#6366f1` ·
`--ud-team` `#06b6d4` · `--ud-project` `#14b8a6` · `--ud-verified` `#22c55e` ·
`--ud-mentor` `#a855f7` · `--ud-hiring` `#0ea5e9`

**Törəmə fonlar** `color-mix(in srgb, currentColor 12%, transparent)` ilə
hesablanır — hər ton üçün ayrıca sabit yazmağa ehtiyac yoxdur və tema
dəyişəndə avtomatik izləyir.

---

## 6. Görünüş rejimləri

Seçim `localStorage` → `collabix_users_view` açarında **yadda qalır**.

| | **Grid** | **List** | **Compact** |
|---|---|---|---|
| Konteyner | `grid`, `auto-fill minmax(320px,1fr)` | `flex column`, gap 8px | `flex column`, gap 8px |
| Kart oxu | şaquli (`column`) | üfüqi, mərkəzləşmiş | üfüqi, sıx |
| Avatar | 56px | 56px | **38px** |
| Bio | var (2 sətir) | var (2 sətir) | **yox** |
| Bacarıq | 4 + «+N» | 4 + «+N» | **2** + «+N» |
| Sosial sətir | var | var | **yox** |
| Əməliyyat | altda, tam en, üst haşiyə ilə | sağda şaquli | sağda, ikon düymələr |
| «Profil» düyməsi | var | var | **yox** (⋯ menyusunda) |
| Son görülmə | var | var | **yox** |
| Kart hündürlüyü | ~190px | ~190px | **~64px** |
| İstifadə ssenarisi | kəşf, vizual seçim | müqayisə, enterprise siyahı | çox nəfəri sürətlə skan etmək |

`contain-intrinsic-size`: grid/list **190px**, compact **64px**.

---

## 7. Süzgəc və sıralama modeli

### 7.1 Sürətli pillər (`.ud-quick`) — həmişə görünür

| Pill | Nə tətbiq edir |
|---|---|
| Hamısı | — (sıfırlayır) |
| Onlayn | `extra=online` *(client tərəfli — bax §7.3)* |
| İş axtarır | `status=hiring` |
| Mentorlar | `looking=Mentor` |
| Təsdiqlənmiş | `extra=verified` |
| Qarşılıqlı | `extra=mutual` |

> Pill panel filtrini **əzir** — istifadəçinin son toxunduğu idarəetmə qalib
> gəlməlidir.

### 7.2 Geniş panel (`.ud-filters`) — 8 sahə

Bacarıq · Səviyyə · Nə axtarır · Status · İş yeri · Yer · Əlaqə · Sıralama

**Sıralama:** Ən yeni üzvlər *(default)* · Ən yüksək XP · Son aktiv olanlar ·
**Ən çox izləyici** · Əlifba sırası

### 7.3 Serverdə vs client-də

| Filtr | Harada | Səbəb |
|---|---|---|
| `q`, `skill`, `level`, `looking`, `company`, `loc`, `status` | **server** | SQL + indeks |
| `verified`, `following`, `followers`, `mutual` | **server** *(yeni)* | Əvvəl client-də idi və bir filtr üçün **5 səhifə sorğusu** gedirdi |
| `online` | **client** | Presence ayrı sistemdir; sorğuya qoşulması kataloqu presence yazılarına bağlayardı |

> `online` client-də qaldığı üçün səhifə boşala bilər. `loadDirectory()`
> **5 boş səhifədən sonra** dayanır — onsuz «onlayn» filtri heç kim uyğun
> gəlməyəndə bütün bazanı ard-arda sorğulayardı.

---

## 8. Data müqaviləsi

### 8.1 Sxem əlavələri

```sql
-- 0050
ALTER TABLE users      ADD COLUMN company  TEXT DEFAULT '';
ALTER TABLE users      ADD COLUMN status   TEXT DEFAULT '';   -- ''|away|busy|dnd|hiring
ALTER TABLE taxonomies ADD COLUMN category TEXT DEFAULT '';
CREATE INDEX ix_users_dir_xp     ON users(blocked, xp DESC, id);
CREATE INDEX ix_users_dir_active ON users(blocked, last_active_at DESC, id);
CREATE INDEX ix_users_dir_joined ON users(blocked, joined_at DESC, id);

-- 0051
ALTER TABLE users ADD COLUMN followers_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX ix_users_dir_followers ON users(blocked, followers_count DESC, id);
```

> 🔴 **`status` sütununda `CHECK` YOXDUR.** SQLite-də ALTER ilə əlavə olunan
> sütuna CHECK vermək cədvəli yenidən qurmağı tələb edir. Yeganə qapı
> `patchMe`-dəki `USER_STATUSES` ağ siyahısıdır — dəyər oradan keçməlidir.

> 🔴 **`followers_count` DENORMALLAŞDIRILMIŞDIR.** «Ən çox izləyici»
> sıralaması korrelyasiyalı alt-sorğu tələb edirdi və o, **keyset kursorunu
> sındırır** (hesablanan ifadə indekslənə bilmir). `posts.like_count` ilə eyni
> naxış. Sayğacı dəyişən **hər yol** onu yeniləməlidir:
> `followPut` · `followDelete` · `deleteAccount`.
> Yazı `meta.changes`-dən **asılıdır** — `INSERT OR IGNORE` heç nə yazmayanda
> sayğac artırılmamalıdır, əks halda təkrar «İzlə» onu şişirdir.

### 8.2 Endpoint-lər

| Metod | Yol | Səbət | Təyinat |
|---|---|---|---|
| GET | `/api/users/directory` | `read` | filtr + sıralama + kursor + sosial zənginləşdirmə |
| GET | `/api/users/dir-stats` | `read` | 8 kart üçün toplu saylar |
| GET | `/api/users/suggested` | `read` | 4 tövsiyə siyahısı |
| GET | `/api/users/export.csv` | `heavy` | cari filtrlə ≤500 sətir CSV |
| GET | `/api/users/:username/profile` | `read` | publik + öz profil |

> ⚠ **Marşrut sırası bağlayıcıdır:** sabit seqmentli naxışlar
> (`/suggested`, `/dir-stats`, `/export.csv`) parametrli
> `([\w.]+)/profile`-dan **əvvəl** gəlməlidir.

> ⚠ `profile` naxışı `[\w.]+`-dir, `[\w-]+` **yox**: istifadəçi adında nöqtə
> ola bilər (`validUsername`: `[a-z0-9._]`), defis ola bilməz.

### 8.3 Zənginləşdirmə — N+1 qapadılması

`enrichSocial()` 24 nəfərlik səhifə üçün **4 sorğu** işlədir (sətir-sətir
çağırış 96 gediş-gəliş olardı):

1. komanda sayı · 2. layihə sayı · 3. **ortaq** komanda · 4. **ortaq** layihə
   *(+ izləmə istiqamətləri həmin batch-də, tək sorğuda hər iki tərəf)*

İzləyici sayı **burada hesablanmır** — `users.followers_count` sütunundan
gəlir, yəni beşinci sorğuya ehtiyac qalmır.

### 8.4 Statistika — tək sorğu

`directoryStats()` səkkiz kartı **bir `SELECT`** ilə doldurur (şərti toplama).
Səkkiz ayrı `COUNT(*)` səkkiz tam skan olardı — `adminStatsDaily` ilə eyni
sinif qüsur (AUDIT-TASK-10 / Faza 4).

---

## 9. İnteraksiya spesifikasiyası

### 9.1 Kart

| Jest | Nəticə |
|---|---|
| Klik | profil səhifəsi |
| `Enter` | profil səhifəsi |
| Hover (kart) | elevasiya −2px + haşiyə `--coral2` |
| Hover (**avatar**, 380 ms) | mini profil paneli |
| `Mesaj` | DM (icazə yoxlanır) |
| `İzlə` | optimistik toggle + sayğac |
| `⋯` | menyu: Profil · Linki kopyala · Profili paylaş · Şikayət et |
| `+N` **klik** | bacarıq paneli *(hover ilə açılmır — §9.3)* |

### 9.2 Axtarış

- `Ctrl/Cmd + K` → fokus + mətn seçimi *(yalnız səhifə aktivdirsə)*
- 250 ms debounce — hər hərf bir sorğu limit səbətini yeyirdi
- Avtotamamlama: **yüklənmiş nəticələr + taksonomiya**, ayrıca sorğu **yox**
- `↑`/`↓` naviqasiya · `Enter` seçim · `Escape` təmizlə

### 9.3 🔴 Portal qatı — `content-visibility` tələsi

Kartlar virtuallaşdırma üçün `content-visibility: auto` işlədir. Həmin
xüsusiyyət elementə **həmişə** `contain: paint` tətbiq edir — yəni kartın
qutusundan kənara çıxan hər şey `overflow: hidden` kimi **kəsilir**.

**Nəticə:** kartın içində `position: absolute` ilə açılan menyu DOM-da yaranır,
`z-index` böyükdür, DevTools-da hər şey «düzgün» görünür — **ekranda yoxdur**.
`z-index` kömək **etmir**: paint containment stacking context-dən asılı deyil.

**Həll:** `js/ui.js` → `openPopover()` — panel `body`-yə portal edilir,
`position: fixed` + `getBoundingClientRect()` ilə yerləşdirilir, viewport
kənarında çevrilir, `scroll` / `resize` / `Escape` / kənar-klik ilə bağlanır.

> ⚠ Portal olunan panelin CSS-ində **`position` elanı olmamalıdır** — səhifə
> modulu sonra yükləndiyi üçün `.c-pop { position: fixed }`-i basar və panel
> yenidən kəsilər.

> ⚠ `+N` paneli **hover ilə açılmır**: portal hover ilə idarə olunanda siçan
> paneldən çıxanda ilişib qalırdı. Klik həm də toxunuşda işləyir
> (`hover-vs-tap`).

### 9.4 Yapışqan qatlar

`--ud-topbar` → `--ud-controls-h` ofsetləri **JS ilə ölçülür**
(`syncUsersSticky` + `ResizeObserver`). Sabit `top: 108px` yazılanda 480px-də
sarma zamanı axtarış sahəsi topbar-ın **altında gizlənirdi**.

---

## 10. Animasiya spesifikasiyası

Vahid nişanlar: `--mo-fast: 120ms` · `--mo-base: 200ms` ·
`--mo-ease: cubic-bezier(.4, 0, .2, 1)`

| Animasiya | Müddət | Xüsusiyyət |
|---|---|---|
| Kart görünməsi (`ud-fade-in`) | 200ms | `opacity` + `translateY(6px)` |
| Menyu / filtr (`ud-slide-down`) | 120 / 200ms | `opacity` + `translateY(−6px)` |
| Alt vərəq (`ud-sheet-up`, ≤480px) | 200ms | `translateY(100%)` |
| Kart hover | 120ms | `translateY(−2px)` + kölgə + haşiyə |
| **Avatar hover** | 200ms | `scale(1.06)` |
| Onlayn nöqtəsi (`ud-pulse`) | 2.4s ∞ | `box-shadow` halqası |
| **XP zolağı** | 600ms | `width` (`--ud-xp-pct`) |
| Sayğac (`countUp`) | 420ms | `util.js`, reduced-motion-a hörmət edir |
| Görünüş keçidi | 120ms | `background` + `color` |

**Qaydalar**

- Yalnız `transform` və `opacity` animasiya olunur — **istisna** XP zolağının
  `width`-idir: o, bir dəfə, kart görünəndə işləyir və `contain` daxilindədir.
- Onlayn nöqtəsi **yalnız onlayn** halda nəbz vurur — sabit statuslarda hərəkət
  diqqəti boş yerə oğurlayardı.
- `prefers-reduced-motion: reduce` → nişanlar 0ms **və** `animation: none`
  ayrıca verilir (nişan `@keyframes`-i söndürmür), hover `transform`-ları
  söndürülür, XP zolağının `transition`-ı ləğv olunur.

---

## 11. Əlçatanlıq

| Sahə | İcra |
|---|---|
| Klaviatura | Kart `tabindex=0` + `Enter` · `Ctrl+K` axtarış · `↑↓`+`Enter` avtotamamlama · `Escape` bağla |
| Fokus halqası | `2px solid var(--coral)`, `outline-offset: 2px`, **`:focus-visible`** (siçan klikində halqa göstərmək qüsur kimi bildirilmişdi) |
| Toxunuş hədəfi | ≤768px-də `⋯` və görünüş düymələri `--tap` (44px); pill 36px + 8px aralıq; axtarış/select `min-height: var(--tap)` |
| ARIA | `role=tablist`/`tab`+`aria-selected` (pillər) · `role=combobox`+`aria-expanded`+`aria-controls` (axtarış) · `role=listbox`/`option` (təkliflər) · `role=menu`/`menuitem` (⋯) · `role=progressbar`+`aria-valuenow` (XP) · `aria-pressed` (izlə) · `aria-label` (kart, status, `+N`) |
| Canlı bölgə | `.dir-status` → `role=status` + `aria-live=polite` |
| Kontrast | Mətn ≥4.5:1, qrafik ≥3:1 — **hər iki temada ayrıca ölçülüb** (açıq temada 18 ton bir pillə tündləşdirilib) |
| Rəng tək deyil | Status → nöqtə + etiket + `title`; rank → ad + «Lv N»; kateqoriya → mətn |
| Kəsilmiş mətn | Bio 2 sətir clamp; bacarıq səviyyəsi tək hərf + tam `title`; ad kəsilmir, sınır |
| Jest alternativi | Bütün əməliyyatlar düymə ilə əlçatandır |

---

## 12. Uyğunlaşan davranış

Breakpoint konvensiyası (`docs/RESPONSIVE.md`): **360 / 480 / 768 / 1024 / 1280**

| Ölçü | Dəyişiklik |
|---|---|
| **≥1280** Desktop | Tövsiyə raili **sağ sütunda** (300px, sticky). Grid `minmax(320px, 1fr)`. Stat kartları bir sıra |
| **1024–1280** | Rail **üfüqi zolağa** düşür (260px kartlar, yan sürüşmə). Layout tək sütun |
| **768–1024** Planşet | Grid `minmax(280px, 1fr)`. Stat `minmax(124px, 1fr)` |
| **≤768** Mobil | Başlıq şaquli, düymələr tam en · **Stat kartları yan sürüşür** (sarılsaydı 3 sıra tutub siyahını ekrandan qovurdu) · **Grid tək sütun** · Avatar 48px · Hover paneli **söndürülür** (JS də bloklayır) · Toxunuş hədəfləri 44px-ə bərpa olunur |
| **≤480** | **Filtr paneli alt vərəqə (bottom sheet)** çevrilir — `position: fixed`, `max-height: 82vh`, `safe-area-inset-bottom` · Axtarış sətri sarılır · `Ctrl K` nişanı gizlənir · Əməliyyat düymələri tam en |
| **≤360** | Başlıq və pill etiketləri gizlənir, yalnız ikon (toxunuş hədəfi qorunur) · Sosial sətirdə yalnız ilk iki say |

**Doğrulama:** `npm run audit:responsive` → **21 səhifə × bütün ölçülər →
overflow-x 0 · element-overflow 0 · touch 0 · text-clip 0**

---

## 13. Performans

| Texnika | İcra | Səbəb |
|---|---|---|
| Virtuallaşdırma | `content-visibility: auto` + `contain-intrinsic-size` | Klassik JS virtualizasiyası **üç rejimin** dəyişkən hündürlükləri ilə uyuşmurdu; brauzer-native həll eyni qazancı sıfır JS ilə verir. ⚠ Popover-ləri kəsir — bax §9.3 |
| Sonsuz sürüşmə | `IntersectionObserver`, `rootMargin: 300px` | Ekrana çatmadan yüklənir |
| Kursor səhifələmə | keyset (`<dəyər>\|<id>`) | OFFSET dərin səhifələrdə yavaşlayır və sətir sürüşdürür |
| Zənginləşdirmə | 4 toplu sorğu | Sətir-sətir 96 gediş-gəliş olardı |
| Statistika | tək `SELECT` | 8 `COUNT(*)` = 8 tam skan |
| İzləyici sayı | denormallaşdırılmış sütun | Korrelyasiyalı alt-sorğu keyset-i sındırırdı |
| Tövsiyələr | ayrıca endpoint | Kataloq cavabına qatılsaydı hər filtr dəyişikliyində yenidən hesablanardı |
| Avatar | `object-fit: cover`, sabit ölçü | CLS = 0 |
| Axtarış | 250 ms debounce | Hər hərf bir `read` sorğusu idi |
| Avtotamamlama | **sıfır** əlavə sorğu | Yüklənmiş nəticələr + taksonomiya üzərində |
| Optimistik UI | izləmə düyməsi dərhal dəyişir | 200–400 ms gözləmə «düymə işləmir» hissi verirdi |

---

## 14. Figma üçün qaynaq

**Artboard-lar:** 1440 (Desktop + rail) · 1280 (rail sərhədi) · 1024 (Planşet) ·
390 (Mobil) · 360 (Kiçik)

**Auto-layout**

| Komponent | İstiqamət | Gap | Padding | Ölçü |
|---|---|---|---|---|
| `Card / List` | horizontal | 12 | 16 | Fill × Hug |
| `Card / Grid` | vertical | 12 | 16 | Fill × Hug |
| `Card / Compact` | horizontal | 12 | 8 / 12 | Fill × Hug (64) |
| `Card body` | vertical | 6 | 0 | Fill × Hug |
| `Stat` | horizontal | 8 | 8 / 12 | Fill × 62 |
| `Rail box` | vertical | 8 | 12 | 300 × Hug |
| `Filters` | grid wrap | 12 | 16 | Fill × Hug |

**Komponent variantları**

- `UserCard`: `view = grid | list | compact`
- `UserCard`: `status = online | away | busy | dnd | hiring | offline`
- `UserCard`: `verified = true | false`, `mutual = none | team | project | both`
- `Rank`: `tier = bronze | silver | gold | diamond | master | legend`
- `SkillChip`: `category = <10 kateqoriya>`, `level = none | B | O | Q`
- `Pill`: `state = default | active`
- `ViewToggle`: `active = grid | list | compact`
- `ProfileCard`: `owner = self | other`

**Stil adlandırması** — Figma stilinin adı **CSS dəyişəni ilə üst-üstə
düşməlidir**: `color/ud-cat-lang`, `color/ud-rank-gold`, `text/ud-name`,
`space/sp-3`. Dizayn↔kod fərqi adlandırmadan başlayır.

---

## 15. Frontend icra tövsiyələri

### 15.1 Yeni ekran əlavə edərkən

1. **Rank/status/kateqoriya məntiqi yazma** — `js/profile-kit.js`-dən import et.
   Üç ekran onu paylaşır; dördüncü nüsxə eyni istifadəçini fərqli göstərər.
2. **Kart siyahısına `content-visibility: auto` verirsənsə**, içindəki hər
   popover portal olmalıdır (§9.3).
3. **Yeni bacarıq/skill** yalnız `taxonomies` cədvəlinə əlavə olunur —
   `category` sütunu ilə birlikdə, əks halda nişan boz çıxır.
4. **Yeni status** `USER_STATUSES` ağ siyahısına + `STATUS_META`-ya +
   `--ud-<status>` nişanına + i18n açarına **eyni commit-də** əlavə edilir.

### 15.2 Açıq qalan bəndlər

| # | Bənd | Səbəb / gözlənti |
|---|---|---|
| 1 | **E2E örtük** — `e2e/users.spec.ts` | Hazırda yalnız responsive audit örtür; filtr, rejim keçidi və portal menyusu üçün reqressiya testi yoxdur |
| 2 | **«Ən çox layihə» sıralaması** | `team_project_members` üzərində üçüncü denormallaşdırılmış sayğac + TASK-11 yazı yollarında saxlanma tələb edir |
| 3 | **Şirkət normallaşdırması** | Hazırda sərbəst mətndir («Google» / «Google LLC» / «google»). Ehtiyac yaranarsa `taxonomies` naxışı ilə |
| 4 | **Bulud / Dizayn / Təhlükəsizlik kateqoriyaları boşdur** | Nişan və rəng hazırdır; taksonomiyaya uyğun skill əlavə edilməlidir |
| 5 | **Rail tövsiyələri sadə heuristikadır** | «Tanış ola bilərsən» = izlədiklərimin izlədikləri. Ortaq komanda + skill oxşarlığı çəkiləri ölçülməmiş mürəkkəblik olardı |
| 6 | **Sayğac drift yoxlaması** | `followers_count` vs `COUNT(follows)` invariantı `/api/health`-ə əlavə oluna bilər (XP drift yoxlaması ilə eyni naxış) |
| 7 | **Redaktə forması** genişləndirildi, yenidən qurulmadı | İşlək, tab-lı və bütün sahələri daşıyır; tam yenidən yazmaq üçün əsas görülmədi |

---

## 16. Dəyişiklik jurnalı

| Tarix | Commit | Nə |
|---|---|---|
| 2026-08-04 | `0cf8f84` | Kataloq: rank, status, şirkət, tövsiyələr, 3 rejim, CSV, dəvət |
| 2026-08-04 | `a8a83b7` | Profillər: real endpoint, portal menyusu, `append(null)`, SEO sıfırlaması, `fmtMonthYear` |

**Bu işdə tapılıb düzəldilən gizli qüsurlar** (spesifikasiyada deyildi):

1. `repost` heç bir səbətdə deyildi → «Sistem» pilinə düşürdü
2. Hesab silinəndə **qalan** istifadəçilərin izləyici sayı şişik qalırdı
3. Təkrar «İzlə» sayğacı şişirdirdi (`INSERT OR IGNORE` heç nə yazmır)
4. `.append(null)` DOM-a **«null» mətni** yazırdı (3 yerdə)
5. SEO başlığı profildən çıxandan sonra ilişib qalırdı
6. Chrome `az-AZ` ICU: `month:'long'` → **«M07»** («Qoşulub 2026 M07»)
7. 8 statistika kartında uzun etiket kəsilirdi («Komandalar…»)
8. Seriya/XP/tapşırıq profildə **iki dəfə** görünürdü
9. `content-visibility` popover-ləri kəsirdi — **iki səhifədə**
