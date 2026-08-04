# Collabix — Profil ekranı: dizayn və icra sənədi

Bu sənəd **`#page-profil` (öz profil)** və **`#page-u` (publik profil)**
ekranlarını təsvir edir. Hər iki səhifə **eyni renderer-dən** qurulur
(`js/profile-view.js`), ona görə sənəd də birdir.

Bütün rəqəmlər koddan oxunub. Mənbələr:
`css/91-profile.css` · `js/profile-view.js` · `js/profile-kit.js` ·
`worker/routes/profile.ts` · `migrations/0052_profile_center.sql`

---

## 1. UX rasionalı

### 1.1 Nə səhv idi

| Problem | Nəticə |
|---|---|
| İki ayrı quruluş: öz profil HTML şablonundan, publik profil JS-dən | Nişanlar yalnız birində, ortaq komandalar yalnız digərində. Eyni istifadəçi iki səhifədə iki fərqli məhsul kimi görünürdü |
| Saylar iki mənbədən (`state.myFollowers.size` vs ayrıca fetch) | Eyni hesab iki yerdə fərqli izləyici sayı göstərə bilirdi |
| Nişanlar client-də statik massiv (`js/util.js` → `BADGES`, 7 ədəd) | Brauzerdə uydurula bilirdi (PRD §19 pozuntusu); serverdəki 11 nişandan 4-ü heç vaxt görünmürdü |
| Publik profil postları `feedCache`-dən süzülürdü | Ən çox 10 post; lent açılmayıbsa profil "paylaşım yoxdur" deyirdi |
| Başlıq "Profil" + "Sənin öyrənmə kartın" | Hero-nun üstündə ~96px yer tutub heç nə demirdi |
| Statistika sətri sadə sayğaclar idi | Ölçü, ton və ierarxiya yox idi — hamısı eyni görünürdü |
| Taymlayn, layihə vitrini, sancaq, analitika | Mövcud deyildi |

### 1.2 Yeddi prinsip

1. **Bir renderer, iki rejim.** Fərq YALNIZ `mode`-dadır (`self` / `public`).
   İstifadəçi öz profilinin kənardan necə göründüyünü bilir.
2. **Nüfuz serverdən gəlir.** XP, nişan, nailiyyət, reputasiya, töhfə balı —
   hamısı serverdə hesablanır, client yalnız oxuyur.
3. **Ton məna daşıyır.** Mavi = sosial, bənövşəyi = irəliləyiş, yaşıl = məzmun,
   sarı = nüfuz. Rəng dekor deyil.
4. **İddia ≠ fakt.** Bacarıqda özünüqiymət (səviyyə), təcrübə ili və REAL
   fəaliyyət zolağı yan-yana durur və bir-birini əvəz etmir.
5. **Hər bölmə öz datasını gözləyir.** Bir yavaş sorğu bütün səhifəni saxlamır.
6. **Boş sahə israf edilmir.** Sıxlıq spesifikasiyanın açıq tələbidir.
7. **Nişanlar `:root`-dadır.** Portal olunan panellər onları görməlidir.

### 1.3 Spesifikasiyadan qəsdən fərqlənən qərarlar

| Spesifikasiya | Qərar | Səbəb |
|---|---|---|
| "Background `#F7F9FC`, Cards White" | Sabit hex YOXDUR — `var(--bg)` / `var(--surface)` | Açıq temada onsuz da bu dəyərlər çıxır; sabit yazsaydıq dark/matrix/cyberpunk-da profil saytdan qopardı |
| "Cover image" | Yüklənən şəkil YOX — **9 hazır naxış** | Hər profil başlığında ixtiyari şəkil = yeni moderasiya səthi + R2 xərci + 4 temada kontrast riski. Naxış tema nişanlarından qurulur |
| "Recent visitors" | YALNIZ toplu say | Kim kimə baxdığını saxlamaq yeni şəxsi məlumat toplusudur (gizlilik parametri, saxlama müddəti, hesab silinəndə təmizləmə). Toplu say heç birini tələb etmir |
| "Premium badge" | YOXDUR | Məhsulda premium səviyyə mövcud deyil — olmayan statusu göstərmək yalan olardı |
| "Download Resume" | YOXDUR | Ayrıca PDF qurma qatı tələb edir; §15.2-də açıq bənd kimi qeyd olunub |
| "Pinned Repositories / Articles / Polls" | Yalnız **post** sancağı | Repo və məqalə anlayışı sxemdə yoxdur; sorğu (poll) onsuz da postun içindədir |

---

## 2. Komponent ierarxiyası

```
#page-profil                         #page-u
├─ #profCompleteness (nudge)         └─ #pubProfile
├─ #profHost ──────────────┐              └─ .pf ◄── EYNİ AĞAC
│                          ▼
│  .pf
│  ├─ .pf-hero
│  │  ├─ .pf-cover.pf-cover--<naxış>
│  │  │  └─ .pf-cover__edit          (yalnız self)
│  │  ├─ .pf-hero__body
│  │  │  ├─ .pf-ava > .avatar + .pf-status
│  │  │  ├─ .pf-id
│  │  │  │  ├─ .pf-nameline > .pf-name + .pf-rank
│  │  │  │  ├─ .pf-handle  > @ad + hiring + "səni izləyir"
│  │  │  │  ├─ .pf-meta    > şirkət · yer · qoşulma · son görülmə
│  │  │  │  ├─ .pf-bio / .pf-goals
│  │  │  │  └─ .pf-links   > sosial çiplər
│  │  │  └─ .pf-actions               (rejimə görə fərqlənən YEGANƏ blok)
│  │  └─ .pf-xp > .pf-xp__top + .pf-xp__bar > .pf-xp__fill
│  ├─ .pf-tabs > .pf-tab × 7          (yapışqan)
│  └─ .pf-layout
│     ├─ .pf-main
│     │  ├─ #pf-stats  → .pf-stats--hero(4) + .pf-stats(8) + .pf-xpb + .pf-ins
│     │  ├─ #pf-ach    → .pf-achs (qazanılan) + .pf-achs--off (kilidli)
│     │  ├─ #pf-skills → .pf-skgrp × kateqoriya > .pf-skill
│     │  ├─ #pf-act    → .pf-streaks(4) + .heatmap
│     │  ├─ #pf-proj   → .pf-projs > .pf-proj
│     │  ├─ #pf-posts  → .pf-pins + .pf-posts > .feed-card + .pf-sentinel
│     │  └─ #pf-tl     → .pf-tl > .pf-tli + .pf-more
│     └─ .pf-rail                     (≥1280px)
└─ #govModeratorBox / #govInviteBox   (yalnız self, renderer-dən KƏNAR)
```

**Portal qatı** (`body` səviyyəsində, `.c-pop`): `.pf-pop` → örtük seçicisi.
Səbəb: kart daxilində `position: absolute` panel `contain: paint` ilə kəsilir.

---

## 3. Layout grid

| Blok | Qayda |
|---|---|
| Səhifə | `.pf-layout` `display: block`; ≥1280px-də `grid: minmax(0,1fr) 300px` |
| Hero | `flex`, `align-items: flex-start`, `gap: var(--sp-4)`; avatar `margin-top: calc(var(--pf-avatar) / -2)` ilə örtüyün üstünə çıxır |
| Hero statistika | `repeat(auto-fit, minmax(150px, 1fr))` |
| Şəbəkə statistika | `repeat(auto-fit, minmax(124px, 1fr))` |
| XP bölgüsü | `repeat(auto-fit, minmax(110px, 1fr))` |
| Analitika | `repeat(auto-fit, minmax(96px, 1fr))` |
| Nişanlar | `repeat(auto-fill, minmax(210px, 1fr))` → ≤1024px `180px` → ≤480px `1fr` |
| Seriya kartları | `repeat(auto-fit, minmax(110px, 1fr))` |
| Layihələr | `repeat(auto-fill, minmax(250px, 1fr))` → ≤480px `1fr` |
| Örtük seçicisi | `repeat(3, 1fr)` → ≤480px `repeat(2, 1fr)` |

---

## 4. Spacing sistemi

Layihənin `--sp-1…7` şkalası işlədilir; profil öz aralıq nişanını əlavə edir.

| Nişan | Dəyər | İstifadə |
|---|---|---|
| `--pf-gap` | `var(--sp-4)` | Bölmələr arası şaquli ritm |
| Bölmə daxili | `var(--sp-4)` (≤768px `var(--sp-3)`) | `.pf-sec` padding |
| Hero yan | `var(--sp-5)` (≤768px `var(--sp-4)`) | `.pf-hero__body`, `.pf-xp` |
| Çip aralığı | `6px` | `.pf-skills`, `.pf-links`, `.pf-chips` |
| Kart daxili | `var(--sp-3)` | `.pf-stat`, `.pf-proj`, `.pf-ach` |

---

## 5. Tipoqrafiya

| Element | Ölçü | Çəki | Qeyd |
|---|---|---|---|
| `.pf-name` | `--fs-2xl` (≤768px `--fs-xl`) | 800 | `letter-spacing: -0.02em`, `line-height: 1.15` |
| `.pf-sec__h` | `--fs-md` | 700 | Bölmə başlığı |
| `.pf-stat--hero .pf-stat__n` | `--fs-xl` | 800 | `tabular-nums` |
| `.pf-stat__n` | `--fs-lg` | 800 | `tabular-nums` |
| `.pf-bio` | `--fs-sm` | 400 | `line-height: 1.6`, `max-width: 68ch` |
| `.pf-handle` | `--fs-sm` | 400 | `.pf-at` monospace |
| `.pf-tli__k`, `.pf-sub` | `--fs-xs` | 700 | `uppercase`, `letter-spacing: .04em` |
| Etiketlər / meta | `--fs-xs` | 400–600 | `--muted` / `--text-sec` |

**Rəqəmlər həmişə `font-variant-numeric: tabular-nums`** — sayğac animasiyası
zamanı en dəyişməsin.

---

## 6. Rəng nişanları

Rank / status / bacarıq kateqoriyası rəngləri **kataloqdan gəlir**
(`--ud-*`, `css/89-users.css`) — profil onları yenidən təyin etmir.
Profilin öz nişanları:

| Nişan | Tünd | Açıq | Məna |
|---|---|---|---|
| `--pf-blue` | `#3b82f6` | `#1d63d1` | Sosial (izləyici, izlənilən) |
| `--pf-violet` | `#a855f7` | `#7e22ce` | İrəliləyiş (XP, tapşırıq, nailiyyət) |
| `--pf-green` | `#22c55e` | `#15803d` | Məzmun (post, şərh, töhfə) |
| `--pf-amber` | `#f59e0b` | `#b45309` | Nüfuz (reputasiya, seriya, nişan) |
| `--pf-rose` | `#e5484d` | `#be123c` | Alınan bəyənmə |
| `--pf-teal` | `#14b8a6` | `#0f766e` | Komanda / layihə |
| `--pf-gold` | `#eab308` | `#a16207` | Səviyyə artımı, qurucu |

**Ölçü nişanları:** `--pf-avatar: 112px` (1024px→96, 768px→84, 480px→72),
`--pf-cover-h: 168px` (→140, →112, →96), `--pf-rail-w: 300px`,
`--pf-topbar: 57px`.

> ⚠ Nişanlar `:root`-dadır, səhifə seçicisində YOX. Səbəb §9.4-dədir.

---

## 7. Data müqaviləsi

### 7.1 Sxem (miqrasiya 0052)

```sql
ALTER TABLE users ADD COLUMN cover      TEXT NOT NULL DEFAULT '';   -- naxış açarı
ALTER TABLE users ADD COLUMN skill_meta TEXT NOT NULL DEFAULT '{}'; -- {"Python":{"y":3,"c":1}}
ALTER TABLE posts ADD COLUMN profile_pinned_at INTEGER;             -- MÜƏLLİF sancağı

CREATE TABLE profile_views (uid, date, count, PRIMARY KEY (uid, date));
```

İndekslər: `ix_posts_profile_pin` (qismi), `ix_profile_views_date`,
`ix_badge_logs_uid_time`, `ix_achievement_logs_uid_time`,
`ix_follows_target_time`.

### 7.2 Endpoint-lər

| Metod | Yol | Cavab | Nə vaxt |
|---|---|---|---|
| GET | `/api/users/:u/profile` | başlıq (`mapUser` + sosial) | dərhal |
| GET | `/api/users/:u/overview` | statistika, nişan, nailiyyət, sancaq, layihə, (+ insights) | başlıqdan sonra |
| GET | `/api/users/:u/timeline?cursor=` | 20 hadisə + kursor | bölmə görünəndə |
| GET | `/api/users/:u/activity` | heatmap | mount-da |
| GET | `/api/users/:uid/progress` | sahə üzrə fəaliyyət | mount-da |
| GET | `/api/feed?author=<uid>` | müəllif postları (keyset) | bölmə görünəndə |
| POST | `/api/users/:u/view` | baxış sayğacı | sessiya başına 1 |
| POST | `/api/posts/:id/profile-pin` | sancaq aç/bağla | əməliyyat |

### 7.3 Sorğu iqtisadiyyatı

- **`overview` = 6 sorğu, TƏK `batch()`.** Sadəlövh variant hər blok üçün
  ayrıca çağırış olardı.
- **Taymlayn = 6 ayrı sorğu, `UNION ALL` DEYİL.** D1 `SQLITE_MAX_COMPOUND_SELECT`-i
  **5 termə** endirib (ölçüldü: 5 işləyir, 6 çökür). Birləşmə JS-dədir.
- **Insights = 2 sorğu**, yalnız sahibinə.
- **Nişanlar `LEFT JOIN` ilə** — qazanılan və kilidli bir sorğuda.

### 7.4 Hədlər

| Sabit | Dəyər | Yer |
|---|---|---|
| `PIN_MAX` | 3 | server + UI |
| `PROJECT_MAX` | 6 | vitrin |
| `TIMELINE_PAGE` | 20 | səhifə |
| `SKILL_YEARS_MAX` | 30 | il |
| `SKILL_META_MAX` | 60 | bacarıq sətri |
| `SKILL_POINT_CAP` | 300 | zolağın 100%-i |
| baxış saxlama | 400 gün | `archive.ts` |

### 7.5 Töhfə balı

```
bal = post×3 + şərh×1 + tapşırıq×5 + alınan_bəyənmə×0.5 + max(0, reputasiya)×0.5
```

**TƏK MƏNBƏ serverdədir** (`contributionScore`). Client yalnız hazır rəqəmi
oxuyur — client-də təkrarlansaydı iki tərəf fərqli bal göstərərdi
(`level-thresholds-three-copies` dərsi).

---

## 8. Bölmələr

### 8.1 Hero

Örtük → avatar (örtüyün üstünə yarıya qədər çıxır) → ad + doğrulama + rank
çipi → `@ad` + hiring + "səni izləyir" → meta sətri → bio → hədəflər →
sosial çiplər. Sağda əməliyyatlar. Altda tam enli XP zolağı.

**Rank** XP-dən törəyir, ayrıca sütun deyil: Bürünc ≤Lv2, Gümüş ≤Lv4,
Qızıl ≤Lv6, Almaz ≤Lv8, Usta ≤Lv9, Əfsanə.

**Status** iki mənbənin birləşməsidir: presence (ölçülür) + əl ilə qoyulan
(niyyət). Oflayn istifadəçinin `busy` statusu göstərilmir; `hiring` istisnadır.

### 8.2 Statistika

4 böyük kart (izləyici · XP · töhfə · reputasiya) + 8 kiçik kart. Böyük kartda
ikon **dolu dairədədir**, kiçikdə sadə qlif — fərq ölçüdə deyil, quruluşdadır.
Altda XP bölgüsü (həftə / ay / ümumi), sonra analitika (yalnız sahibinə).

### 8.3 Nailiyyətlər

Server kataloqundan: 11 nişan + 4 nailiyyət. Qazanılanlar üstdə, kilidlilər
"Növbəti hədəflər" altında irəliləyiş zolağı ilə.

> Sahib öz profilinə baxanda `evaluateProgression` `waitUntil` ilə işə düşür —
> qaydası çoxdan ödənmiş nişan növbəti XP hadisəsinə qədər kilidli qalmasın.
> Göstərilən `have` hədlə sıxılır ("300 / 20" kimi mənasız cüt görünməsin).

### 8.4 Bacarıqlar

Kateqoriya üzrə qruplaşma (`SKILL_CAT_ORDER`: lang → web → db → cloud →
devops → security → embedded → design → spoken → other). Hər çipdə: ad,
səviyyə, təcrübə ili, sertifikat ikonu, altda fəaliyyət zolağı.

Zolaq **real fəaliyyətdəndir** (`progress` cədvəli: post×10 + task×50 + xp),
istifadəçinin iddiasından yox. Data yoxdursa zolaq göstərilmir — "0%"
yeni başlayanı cəzalandırardı.

### 8.5 Aktivlik

4 göstərici (illik fəaliyyət · cari seriya · ən uzun seriya · ən aktiv həftə
günü) + GitHub tipli 52 həftəlik xəritə. Statistika **client-də** hesablanır
(`activityStats`) — data onsuz da gəlir, ikinci sorğu mənasız olardı.
Gün açarı UTC-dir.

### 8.6 Layihələr, sancaq, paylaşımlar, taymlayn

- **Layihə:** loqo, ad, qurucu nişanı, təsvir, status, üzv sayı, komanda,
  son yenilənmə. Kənar şəxsə yalnız `Public` layihələr.
- **Sancaq:** ən çox 3, müəllif seçimi. Kənar şəxsə yalnız `public` post.
- **Paylaşımlar:** `/api/feed?author=` + `IntersectionObserver` sonsuz sürüşmə;
  hər kartda sancaq düyməsi (yalnız müəllifə).
- **Taymlayn:** 6 mənbə — qoşulma, nişan, nailiyyət, post, komanda, `activities`
  (səviyyə artımı). Kursor `"<ts>_<id>"`.

---

## 9. İnteraksiya və tələlər

### 9.1 Yapışqan naviqasiya

`.pf-tabs` `top: var(--pf-topbar)`. Bölmələrdə
`scroll-margin-top: calc(var(--pf-topbar) + 56px)` — əks halda hədəf bölmənin
başlığı tab sətrinin altında qalırdı.

### 9.2 Baxış sayğacı

Client sessiya başına bir dəfə göndərir (`sessionStorage`); server öz-özünə
baxışı bağlayır. **Mühafizənin həddi açıq elan olunur:** client tərəfli
mühafizə keçilə bilər, yəni bu təhlükəsizlik sərhədi deyil, dəqiqlik tədbiridir.
Baxış sayı icazə qərarına təsir etmir.

### 9.3 D1 parametr bağlama qaydası

**D1 bind sayının sorğudakı ƏN BÖYÜK yer tutucu indeksinə BƏRABƏR olmasını
tələb edir.** Kodda əks iddia yazılmışdı ("istifadə olunmayan indeksə dəyər
vermək təhlükəsizdir") və `?author=` şərti yer tutucusu əlavə olunanda
**bütün lent 500 verdi**. Şərti yer tutucu = şərti bind.

### 9.4 Portal olunan panel nişanları görmür

`--pf-*` əvvəl `#page-profil, #page-u` üzərində elan olunmuşdu. Örtük seçicisi
`body`-yə portal edildiyi üçün oradakı `color-mix(... var(--pf-violet) ...)`
naməlum rənglə **etibarsız** olurdu → bütün elan atılırdı → doqquz naxışın
hamısı eyni tünd kvadrat kimi görünürdü. Nişanlar `:root`-a köçürüldü.

### 9.5 Digər tələlər

| Tələ | Nəticə | Həll |
|---|---|---|
| `hidden` atributu `display` qaydasına uduzur | "Daha çox" boş taymlaynda görünürdü | `.pf-more[hidden]{display:none}` |
| `<button>` default rəngi | Tünd temada layihə adı görünmürdü | `.pf-proj{color:var(--text)}` |
| `.empty-state .ic` `inline-flex` | `margin-inline:auto` mərkəzləşdirmir, ikon mətnin üstünə minir | `display:flex` |
| Taksonomiya gec gəlir | Bütün bacarıqlar "Digər" | İndeks `taxonomy-updated`-da özünü sıfırlayır + bölmə yenidən çəkilir |
| `content-visibility` | Popover kəsilir | Bölmələrdə İŞLƏDİLMİR + portal |
| Dinamik `import('./feed.js')` | Build xəbərdarlığı | QƏSDƏNDİR: `profile-view → feed → users → profile-view` dövrünü qırır |

---

## 10. Animasiya

| Hadisə | Müddət | Əyri |
|---|---|---|
| XP zolağı | 520ms | `var(--mo-ease)` |
| Sayğac (`countUp`) | 520ms | daxili |
| Taymlayn sətri | `var(--mo-base)`, stagger 28ms (maks 400ms) | `var(--mo-ease)` |
| Kart hover | `var(--mo-fast)` | `var(--mo-ease)` |
| Avatar hover | `var(--mo-base)`, `scale(1.03)` | `var(--mo-ease)` |
| Skelet parıltısı | 1.3s, sonsuz | `linear` |

`prefers-reduced-motion: reduce` → skelet, taymlayn, XP, avatar və kart
transformları söndürülür; XP dərhal hədəf faizdə başlayır.

---

## 11. Əlçatanlıq

- `<h1>` hero-dadır (səhifədə tək), bölmələr `<h2>`, rail `<h3>`.
- XP zolağı `role="progressbar"` + `aria-valuenow/min/max`.
- Nişan vəziyyəti `aria-label`-da MƏTNLƏ də var — rəng tək siqnal deyil.
- Bütün fokuslanan elementlərdə `:focus-visible` halqası (`2px`, `offset: 2px`).
- Taymlayn `<ol>`, tarix `<time datetime>`.
- ≤768px: tab, sancaq və silmə düymələri `var(--tap)` = 44px.
- Ölçmə: profil qatında 44px-dən kiçik toxunuş hədəfi **0**.

---

## 12. Responsive davranış

| Kəsim | Dəyişiklik |
|---|---|
| ≥1280 | Sağ sütun görünür (`grid`, `sticky`) |
| ≤1024 | Avatar 96px, örtük 140px, nişan şəbəkəsi 180px |
| ≤768 | Hero şaquli; əməliyyatlar tam enli; statistika **yan sürüşür** (`scroll-snap`); toxunuş hədəfləri 44px |
| ≤480 | Avatar 72px, örtük 96px; layihə/nişan tək sütun; örtük seçicisi 2 sütun; taymlayn tarixi gizlənir (`title`-da qalır) |
| ≤360 | Statistika kartı 120px; sosial linkdə yalnız ikon |

Sağ sütun ≤1280px-də əsas sütunun altına DÜŞMÜR, tamamilə gizlənir —
məzmunu köməkçidir və mobil profili uzadardı.

---

## 13. Performans

- Üç mərhələli yükləmə; hər bölmənin öz skeleti.
- `IntersectionObserver`: paylaşımlar (`rootMargin: 300px`), taymlayn
  (`threshold: 0.05`), sayğaclar (`onceInView`).
- Sağ sütun tövsiyələri **yalnız ≥1280px-də** sorğu göndərir (`matchMedia`).
- Keyset paginasiya (post + taymlayn) — `OFFSET` səhifə sürüşməsi vermir.
- `renderKey`: lent hadisəsi profilin görünən datasını dəyişmirsə render
  ATLANIR (sürüşmə mövqeyi və yüklənmiş postlar qorunur).
- Ölçmə: 1440/768/390/360 və hər iki temada `overflow-x = 0`, konsol xətası yox.

---

## 14. Figma qaynağı

**Auto-layout**

| Freym | İstiqamət | Gap | Padding |
|---|---|---|---|
| `Hero` | ↓ | 0 | 0 |
| `Hero/Body` | → | 16 | 0 20 16 |
| `Hero/Id` | ↓ | 4 | 0 |
| `Section` | ↓ | 12 | 16 |
| `Stat/Hero` | → | 8 | 12 |
| `Skill/Chip` | → | 6 | 5 10 |
| `Timeline/Item` | → | 8 | 8 0 8 12 |

**Variantlar**

| Komponent | Variantlar |
|---|---|
| `Cover` | `pattern` = default·aurora·mesh·grid·dusk·forest·ember·ocean·mono |
| `Stat` | `size` = hero·grid × `tone` = blue·violet·green·amber·rose·teal |
| `Badge` | `state` = earned·locked × `type` = badge·achievement |
| `Skill` | `cat` = 10 dəyər × `hasYears` = bool × `hasCert` = bool |
| `Project` | `status` = active·paused·done·archived × `owner` = bool |
| `Timeline` | `kind` = joined·badge·achievement·post·team·level_up |
| `Profile` | `mode` = self·public |

Rəng dəyişənləri §6-dakı cədvəldən götürülür; hər ikisi (tünd/açıq) mode
kimi qurulur.

---

## 15. İcra tövsiyələri və açıq bəndlər

### 15.1 Yeni bölmə əlavə edərkən

1. `SECTIONS` massivinə bənd, `section()` çağırışı, `.pf-main`-ə əlavə.
2. Data `overview`-a əlavə olunursa — **`batch()` daxilində**, ayrıca sorğu yox.
3. `content-visibility` İŞLƏTMƏ; popover lazımdırsa `openPopover()`.
4. Yeni ton lazımdırsa `:root`-a əlavə et, səhifə seçicisinə YOX.

### 15.2 Açıq qalan bəndlər

- `e2e/profile.spec.ts` yoxdur (kataloq və bildiriş üçün də yoxdur).
- Resume/CV ixracı qurulmayıb.
- Örtük yalnız hazır naxışdır (yükləmə qərarla kənarda saxlanılıb).
- "Ən aktiv gün" həftə günüdür, konkret tarix deyil (`bestDay` hesablanır,
  göstərilmir).
- Reaksiya dərəcəsi (response rate) — DM analitikası yoxdur.
- Taymlayn `activities`-dən yalnız `level_up` alır; rol dəyişikliyi, xəbərdarlıq
  və s. hələ ora yazılmır.
- Nişan qazanma anımasiyası (unlock animation) yoxdur — nişan səhifə
  açılışında hazır vəziyyətdə görünür.

---

## 16. Dəyişiklik jurnalı

**Miqrasiya:** `0052_profile_center.sql`
**Yeni fayllar:** `worker/routes/profile.ts` · `js/profile-view.js` ·
`css/91-profile.css` · bu sənəd
**Silinən:** `pp-*` qatı (`89-users.css`) · `setFeedCache`/`feedCache` ·
`renderCard`/`renderBadges`/`renderHeatmap`/`renderProgress`/`renderMyPosts`
(`profile.js`) · `#page-profil` şablon markup-u

**Tapılan və bağlanan qüsurlar (11):**

1. 🔴 `/api/feed` tamamilə çökmüşdü (D1 bind sayı qaydası) — və onu doğuran
   səhv şərh düzəldildi.
2. 🔴 D1 `UNION ALL` 5 term həddi — taymlayn icra vaxtı çökürdü.
3. 🔴 Portal olunan panel səhifə nişanlarını görmür — örtük seçicisi işləmirdi.
4. Nişanlar client-də uydurula bilirdi (PRD §19); 4 nişan heç görünmürdü.
5. Publik profil postları `feedCache`-dən (ən çox 10, çox vaxt 0).
6. `<button>` default rəngi tünd temada layihə adını itirirdi.
7. `.empty-state` ikonu mətnin üstünə minirdi (BÜTÜN səhifələrdə).
8. `.pf-more[hidden]` `display` qaydasına uduzurdu.
9. Bacarıq kateqoriyaları taksonomiya gec gələndə "Digər"ə düşürdü.
10. `--ud-*` nişanları iki yerdə təkrarlanırdı.
11. Nişanlar tənbəl qiymətləndirildiyi üçün "300 / 20 — qazanılmayıb"
    kimi mənasız cüt görünürdü.
