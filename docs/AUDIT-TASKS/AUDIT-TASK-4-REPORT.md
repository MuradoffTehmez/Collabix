# AUDIT-TASK-4 — İcra Hesabatı

**Tarix:** 2026-07-27
**İcraçı:** Claude (Opus 5) — icra agenti
**Mənbə:** `AUDIT-2026-07-26.md` §H-4 · **Tapşırıq:** `AUDIT-TASK-4.md`
**Bağlanan tapıntılar:** **H-4** (High — maliyyə DoS) + `AUDIT-TASK-1-REPORT` §5.3 mirası

---

## 0. Vəziyyət xəritəsi (4.0)

### Sual 1 — faktiki rəqəmlər

| Göstərici | Audit iddiası | Faktiki | Nəticə |
|---|---|---|---|
| Ümumi route | 171 | **171** | ✅ dəqiq |
| `rl` daşıyan | 64 | **64** | ✅ dəqiq |
| `rl`-siz | 107 | **107** | ✅ dəqiq |

> `grep -c "pattern:"` **172** qaytarır — 172-ci sətir `Route` interfeysindəki
> `pattern: RegExp;` elanıdır. Route sayğacı `pattern:.*handler:` olmalıdır.

Task 2 və Task 3-dən fərqli olaraq auditin rəqəmləri **bu dəfə dəqiq çıxdı**.
Lakin auditin "ən ciddi 6 endpoint" siyahısı natamam idi — 107-nin **hər biri**
təsnif olundu (§1).

### Sual 2 — mövcud səbətlər (dəyişiklikdən əvvəl)

| Səbət | Limit | Pəncərə | Route sayı |
|---|---|---|---|
| `auth` | 10 | 300 s | 13 |
| `refresh` | 60 | 300 s | 1 |
| `write` | 60 | 60 s | 47 |
| `upload` | 30 | 3600 s | 1 |
| `form` | 5 | 3600 s | 2 |

### Sual 3 — 🔴 limiter açarı

**Cavab: açar YALNIZ IP-dir və uid heç yerdə iştirak etmir.**

```ts
const ip = req.headers.get('CF-Connecting-IP') || '127.0.0.1';
const key = `rl:${bucket}:${ip}:${win}`;
```

Anonim və autentifikasiya olunmuş sorğular **eyni cür** açarlanırdı. Limiter
`resolveUser`-dən **əvvəl** işləyir (`index.ts` dispatch dövrü), ona görə uid o
nöqtədə mövcud deyildi.

**4.5-ə təsiri:** default `read` səbəti IP açarı ilə tətbiq olunsaydı, korporativ
NAT və ya mobil operator arxasındakı 50 istifadəçi **bir sayğac** paylaşardı və
kütləvi 429 alardı. Ona görə açar strategiyası dəyişdirildi (§3).

### Sual 4 — limit aşıldıqda nə qaytarılırdı

```ts
return withSecurityHeaders(err('Çox sorğu — bir az sonra yenidən cəhd edin.', 429), false);
```

| Element | Əvvəl | İndi |
|---|---|---|
| Status | 429 ✅ | 429 |
| `code` sahəsi | ❌ yox | `rate_limited` |
| `Retry-After` | ❌ yox | saniyə ilə |
| Frontend emalı | ❌ yox — `js/api.js` yalnız 401-ə baxır | toast + polling dayanır |
| `security_events` | ✅ yazılır | yazılır (`read` üçün 1/10 sampling) |

🔴 **Ən ciddi tapıntı:** `startPoll` yalnız **401**-də dayanırdı. 3 saniyəlik poll
429 aldıqdan sonra da dövr edib sayğacı yenidən doldururdu — istifadəçi limitdən
**heç vaxt çıxa bilmirdi**. Öz-özünü gücləndirən nasazlıq.

### Sual 5 — limitə düşməməli yollar

Hamısı yoxlanıldı; əksəriyyəti **struktur olaraq** route cədvəlindən kənardadır:

| Yol | Vəziyyət |
|---|---|
| `/files/*` (R2) | ROUTES-dan kənar → inversiya toxunmur. Ayrıca `asset` səbəti verildi |
| WebSocket upgrade (`/api/rooms/:id/ws`, `/api/presence/ws`) | ROUTES-dan kənar, limitə düşmür. Mesaj limiti onsuz da `RoomDO` token-bucket-indədir |
| `OPTIONS` (CORS preflight) | Limiterdən **əvvəl** qaytarılır (`index.ts:349`) |
| SSE / long-poll | **Mövcud deyil** (`text/event-stream` heç yerdə yoxdur) |
| `robots.txt`, `sitemap.xml`, `llms.txt`, `/og/*` | ROUTES-dan əvvəl |
| Cron (`scheduled`) və Queue consumer (`queue`) | HTTP router-dən **keçmir** — ayrı Worker handler-ləridir |

**Nəticə:** `rl: 'none'` istisnasına ehtiyac qalmadı — **0 açıq istisna**.
Mexanizm yenə də mövcuddur və testlə qorunur.

### Sual 6 — normal istifadəçi profili (ölçülmüş)

Polling intervalları `js/store.js`, `js/presence.js`, `js/threat.js`-dən oxundu:

| Ssenari | İnterval | Sorğu/dəqiqə |
|---|---|---|
| Otaq mesajları (`/rooms/:id/messages`) | 3 s | **20** |
| DM mesajları (`/dms/:pair/messages`) | 3 s | **20** |
| Post şərhləri (`/posts/:id/comments`) | 4 s | 15 |
| DM söhbətləri (`/dms`) | 5 s | 12 |
| Bildirişlər (`/notifications`) | 8 s | 7,5 |
| Feed (`/feed`) | 10 s | 6 |
| İstifadəçilər / gözləyən tapşırıqlar | 15 s | 4 |
| Tapşırıqlar, jurnal, hesabatlar, threat paneli | 20 s | 3 |
| Presence heartbeat (POST) | 30 s | 2 |
| Presence izləmə (GET) | 30 s | 2 |
| Otaqlar, adminlər, sosial | 30 s | 2 |

| Profil | Sorğu/dəqiqə |
|---|---|
| **Ən yüklü TƏK tab** (mesajlar səhifəsi, DM açıq) | **≈ 43,5** |
| Admin paneli tabı (9 paralel poll) | ≈ 37 |
| 4 tab paralel | **≈ 180** |

→ **`read` limiti 300 → 600 qaldırıldı.** 300 real profilə cəmi 1,7× ehtiyat
verirdi; 6-7 tab açan istifadəçi 429 alardı.

> ⚠ **Auditin ehtimalı yanlış çıxdı.** Audit "3 saniyəlik poll" ilə `presence`-i
> nəzərdə tuturdu (sətir 627) və `presence: 60/300s` limitinin normal istifadəçini
> kəsəcəyindən narahat idi. Faktiki olaraq **presence pollinqi 30 saniyədir**
> (`js/presence.js:99` heartbeat, `js/presence.js:104` izləmə) — 3 saniyəliklər
> otaq və DM mesajlarıdır, onlar `read` səbətinə düşür.
> Yəni auditin narahatlığı **doğru, səbəbi yanlış** idi: `presence` 60/300s yenə
> də dardır (5 dəqiqədə 20 sorğu × 3 tab = 60 = tam limit), lakin `read` limiti
> daha ciddi problem idi.

---

## 1. Bağlanan tapıntılar

| Audit ID | Bənd | Vəziyyət | Sübut |
|---|---|---|---|
| H-4 | 4.1 · səbət taksonomiyası | ✅ | `auth.ts` — `critical` bayrağı hər səbətdə |
| H-4 | 4.2 · yeni səbətlər | ✅ | `read`, `presence`, `ai`, `search`, `admin`, `heavy`, `asset` |
| H-4 | 4.3 · opt-out inversiyası | ✅ | `DEFAULT_RL`, `rl?: RateBucket \| 'none'` |
| H-4 | 4.4 · istisnalar | ✅ | 0 açıq istisna lazım oldu (§0/Sual 5) |
| H-4 | 4.5 · açar strategiyası | ✅ | `peekUid` + `normalizeIp` (IPv6 `/64`) |
| H-4 | 4.6 · 429 semantikası | ✅ | `Retry-After` + `code` + frontend emalı |
| Task 1 §5.3 | 4.7 · maşın kodları | ✅ | 35 kodsuz 401/403 → kodlu |
| — | 4.8 · E2E | ✅ | 15 test (8 konfiq + 7 protokol) |

### Route təsnifatı — 107-nin hamısı

| Səbət | Limit | Pəncərə | Route | Sinif |
|---|---|---|---|---|
| `write` | 60 | 60 s | **73** | xərc |
| `read` | 600 | 60 s | **50** | xərc *(DEFAULT)* |
| `admin` | 300 | 60 s | **22** | xərc |
| `auth` | 10 | 300 s | **13** | 🔴 təhlükəsizlik |
| `heavy` | 20 | 3600 s | **3** | xərc |
| `ai` | 20 | 3600 s | **2** | xərc (🔴 real pul) |
| `search` | 60 | 3600 s | **2** | xərc |
| `presence` | 150 | 300 s | **2** | xərc |
| `form` | 5 | 3600 s | **2** | xərc |
| `upload` | 30 | 3600 s | **1** | 🔴 təhlükəsizlik |
| `refresh` | 60 | 300 s | **1** | 🔴 təhlükəsizlik |
| `asset` | 1200 | 60 s | *(ROUTES-dan kənar: `/files/*`)* | xərc |
| | | | **171** | **rl-siz: 0** |

Auditin sadaladığı 6 "ən ciddi" endpoint-in hamısı bağlandı:

| Route | Əvvəl | İndi |
|---|---|---|
| `POST /api/ai/chat` | limitsiz | `ai` — 20/saat |
| `GET /api/search/semantic` | limitsiz | `search` — 60/saat |
| `POST /api/presence` | limitsiz | `presence` — 150/5 dəq |
| `GET /api/teams/:id/ai/summary` | limitsiz | `ai` — 20/saat |
| `GET /api/feed`, `/api/users` | limitsiz | `read` — 600/dəq |
| `GET /api/admin/stats-daily` | limitsiz | `heavy` — 20/saat |

---

## 2. Qəbul meyarları

| # | Meyar | Nəticə |
|---|---|---|
| **1** | 🔴 Normal istifadəçi axını 429 almır | ✅ 132 fasiləsiz sorğu → 0 × 429 |
| **2** | 🔴 Tam E2E dəsti sınmır | ✅ **224 keçdi / 84 uğursuz** — baseline 209/84; uğursuzluq **eyni**, keçən **+15** |
| 3 | Limitsiz route qalmayıb | ✅ 171/171 açıq `rl`, rl-siz **0** |
| 4 | Hər istisna açıqdır | ✅ 0 istisna lazım oldu (§0/Sual 5) |
| 5 | Etibarsız səbət adı build-i sındırır | ✅ `rl: 'typo'` → `TS2322` |
| 6 | AI endpoint limitlidir | ✅ `ai` 20/saat (konfiq testi — protokol testi PUL xərcləyərdi) |
| 7 | Semantic search limitlidir | ✅ `search` 60/saat |
| 8 | `presence` normal polling-i kəsmir | ✅ 40 sorğu → 0 × 429 |
| 9 | `/files/*` asset axını kəsilmir | ✅ 50 ardıcıl sorğu → 0 × 429 |
| 10 | 429 `Retry-After` daşıyır | ✅ rəqəm, 0 < x ≤ pəncərə |
| 11 | 429 `code: 'rate_limited'` daşıyır | ✅ |
| 12 | Admin 403 `code: 'forbidden'` daşıyır | ✅ 3 admin route-unda |
| 13 | Limitlər istifadəçi arası izolədir | ✅ A limitdə, B işləyir (eyni IP-dən) |
| 14 | Frontend 429-u emal edir | ✅ toast + `startPoll` `Retry-After` müddətinə dayanır |
| 15 | Strict TypeScript keçir | ✅ exit 0 |
| 16 | Build uğurludur | ✅ exit 0 |
| 17 | KV amplifikasiyası ölçülüb | ⚠️ qismən — bax §5 |

---

## 3. Səbət taksonomiyası (4.1)

| Səbət | Sinif | H-3-ün təsiri | Task 9-a köçürülməlidir? |
|---|---|---|---|
| `auth` | 🔴 təhlükəsizlik | **Sızır** — paralel giriş cəhdləri elan edilən 10 limitini aşır | ✅ **MƏCBURİ** |
| `refresh` | 🔴 təhlükəsizlik | Sızır — token reuse aşkarlaması zəifləyir | ✅ **MƏCBURİ** |
| `upload` | 🔴 təhlükəsizlik | Sızır — R2 yazı kvotası | ✅ tövsiyə |
| `ai` | 🟠 xərc | Sızır (20 → ~25) | ⚠️ real pul olduğuna görə tövsiyə |
| `search`, `heavy` | 🟠 xərc | Sızır, təsir kiçik | ❌ lazım deyil |
| `read`, `write`, `presence`, `admin`, `asset`, `form` | 🟠 xərc | Sızır, təsir kiçik | ❌ lazım deyil |

**Niyə ayrım vacibdir:** KV limiterində oxu ilə yazı arasında yarış var (H-3) və
KV eyni açara saniyədə ~1 yazı qəbul edir. Xərc qoruyucusu üçün bu məqbuldur —
20 əvəzinə 25 AI çağırışı keçsə maliyyə təsiri kiçikdir. Təhlükəsizlik kontrolu
üçün məqbul **deyil**: 10 əvəzinə 200 parol cəhdi keçsə qoruma mənasızdır.

⚠️ **Bu task atomikliyi DÜZƏLTMİR** (Task 9). `auth` və `refresh` səbətləri
hazırda elan edilən limitdən zəifdir — Turnstile və `security.ts`-dəki
`recentFailures` ora qədər əlavə qat kimi qalır.

---

## 4. İstisnalar (4.4)

| Yol | Səbəb | Kompensasiya edən qoruma |
|---|---|---|
| `/files/*` | Bir feed səhifəsi 20+ obyekt çəkir; `read`-ə salınsaydı normal gəzinti kəsilərdi | Ayrıca `asset` səbəti (1200/dəq, uid üzrə) + giriş tələb olunur. Avtorizasiya → **Task 7** (C-1) |
| WS upgrade | Bir dəfəlik əl sıxma; limitə düşməsi mənasızdır | `RoomDO` daxilindəki token-bucket (state itkisi → **Task 9** / M-4) |
| `OPTIONS` | Brauzer avtomatik göndərir, istifadəçi sorğusu deyil | Limiterdən əvvəl rədd olunur; yalnız same-origin |
| Cron / Queue | HTTP router-dən keçmir | Cloudflare planlayıcısı; xarici trigger yoxdur |
| Admin toplu əməliyyatları | 200 istifadəçinin emalı `write` (60/dəq) səbətini tükədərdi | Ayrıca `admin` səbəti (300/dəq). ❌ **Bypass EDİLMƏDİ** — hesab ələ keçirilsə limitsiz admin yolu hücumçuya sərbəst vasitə verərdi |

---

## 5. 🔴 KV yazı amplifikasiyası (§5.2)

### 5.1 Ölçülmüş rəqəmlər

| Göstərici | Əvvəl | Sonra | Fərq |
|---|---|---|---|
| KV toxunan route | 64 / 171 (37,4 %) | **171 / 171 (100 %)** | **2,67×** |
| KV əməliyyatı / limitli sorğu | 1 oxu + 1 yazı | 1 oxu + 1 yazı | dəyişməyib |
| **Polling trafikinin KV-yə toxunan hissəsi** | **≈ 0 %** | **100 %** | — |
| Ən yüklü tab: KV yazı / dəqiqə / istifadəçi | **0** | **≈ 44** | ∞ |

🔴 **Route sayı (2,67×) əsl mənzərəni gizlədir.** Ölçülmüş polling profilindəki
**bütün** endpoint-lər (`/feed`, `/notifications`, `/rooms/:id/messages`,
`/dms/:pair/messages`, `/dms`, `/presence`, `/users`, `/posts/:id/comments`,
`/tasks`) əvvəllər **`rl`-siz** idi. Yəni aktiv sessiyanın trafiki praktiki
olaraq **sıfırdan** KV yazısına keçdi. Trafik çəkisi ilə amplifikasiya route
sayından qat-qat böyükdür.

### 5.2 Aylıq xərc təxmini

**Fərziyyələr** (dəyişsə nəticə mütənasib dəyişir):
1 000 gündəlik aktiv istifadəçi · gündə 60 dəqiqə aktiv istifadə · 44 sorğu/dəqiqə

```
1 000 × 60 × 44          = 2 640 000 sorğu/gün
                         ≈ 79,2 M sorğu/ay
                         → 79,2 M KV oxu + 79,2 M KV yazı
```

Cloudflare Workers Paid siyahı qiymətləri ilə (**təsdiqlənməli** — qiymətlər
dəyişir): oxu ≈ $0,50/M, yazı ≈ $5,00/M

```
oxu    79,2 M × $0,50/M ≈  $40 / ay
yazı   79,2 M × $5,00/M ≈ $396 / ay
                          ─────────
                          ≈ $436 / ay   (yazı 91 %-ini təşkil edir)
```

### 5.3 Gecikmə — ⚠️ ÖLÇÜLMƏDİ

Dəyişiklikdən əvvəl/sonra p50/p95 müqayisəsi **tamamlanmadı**. Cəhd edildi:
`git worktree` ilə dəyişiklikdən əvvəlki commit ayrıca porta qaldırıldı, lakin
lokal `wrangler dev` instansı sabit işləmədi (`.dev.vars` worktree-də yoxdur;
`--persist-to` mütləq yolla ayrı state qovluğu yaratdı; sonra server sorğu qəbul
etməyi dayandırdı). Vaxt sərhədinə görə ləğv edildi.

**Bunun əvəzinə bilinən struktur delta:** hər limitli sorğuya **tam olaraq 1 KV
`get` + 1 KV `put`** əlavə olunur. Lokal Miniflare KV-si istehsal KV-sinin
gecikməsini əks etdirmir, ona görə lokal ölçmə onsuz da yanıldıcı olardı.

**Tövsiyə:** gecikmə istehsalda Workers Analytics (p50/p95) ilə deploy-dan
əvvəl/sonra müqayisə edilməlidir — lokal mühitdə mənalı rəqəm alınmır.

### 5.4 Qərar

**Müvəqqəti olaraq QƏBUL EDİLİR**, çünki qorunan xərc daha böyükdür: tək bir
limitsiz Workers AI endpoint-i ayda $436-dan qat-qat artıq zərər verə bilər.
Lakin bu, sıfır xərcli düzəliş deyil və Task 9-da atomik limiterə keçid həm
düzgünlüyü, həm də xərci həll etməlidir.

### 5.5 💡 Alternativ — `read` səbəti üçün sampling (təklif, tətbiq edilmədi)

```ts
// YALNIZ `critical: false` səbətlər üçün. Hər N-ci sorğu sayılır, hədd isə
// limit/N olur → KV yazısı N dəfə azalır, dəqiqlik ±N sorğu qədər kobudlaşır.
const N = 10;
if (Math.random() < 1 / N) { /* sayğacı artır, hədd = limit / N */ }
```

| Göstərici | İndi | Sampling (N=10) |
|---|---|---|
| `read` KV yazısı / ay | ≈ 79 M | ≈ 7,9 M |
| Təxmini aylıq xərc | ≈ $436 | ≈ $80 |
| Limit dəqiqliyi | ±0 | ≈ ±10 sorğu |

⚠️ **Təhlükəsizlik səbətlərinə (`auth`, `refresh`, `upload`) HEÇ VAXT tətbiq
edilməməlidir** — orada dəqiqlik məhz qorumanın özüdür.
Eyni sampling naxışı artıq `security_events` jurnalında işlədilir
(`index.ts` — `read` səbəti üçün 1/10), ona görə nümunə kodda mövcuddur.

---

## 6. Test nəticələri

| Dəst | Nəticə |
|---|---|
| `rate-limit.spec.ts` (konfiq + protokol) | **15 / 15 ✅** |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 |
| `rl: 'typo'` → `tsc` | ✅ `TS2322` (meyar 5) |
| `npm run e2e` (tam dəst) | bax §6.1 |

### 6.1 Tam dəst — meyar 2

| İcra | Keçdi | Uğursuz | Müddət |
|---|---|---|---|
| AUDIT-TASK-3 baseline | 209 | 84 | 26,0 dəq |
| AUDIT-TASK-4 (1-ci qaçış) | 210 | 92 | 28,8 dəq |
| **AUDIT-TASK-4 (yekun)** | **224** | **84** | 26,9 dəq |

🔴 **Meyar 2 ödənildi.** Uğursuzluq sayı baseline ilə **eynidir** (84 = 84),
keçən testlər isə **+15** artıb — bu, məhz bu task-da əlavə edilən test sayıdır.
Yəni rate limit inversiyası **bir dənə də test sındırmadı**.

Desktop bölgüsü baseline ilə **sətir-sətir eynidir**:

| Spec | AUDIT-3 baseline | AUDIT-4 yekun |
|---|---|---|
| `admin` | 12 | 12 |
| `ws-flow` | 2 | 2 |
| `ux-phase` | 2 | 2 |
| `responsive-audit` | 2 | 2 |
| `security`, `realtime`, `messages`, `admin-level` | 1 + 1 + 1 + 1 | 1 + 1 + 1 + 1 |
| `rate-limit` | — | **0** |
| **Cəmi desktop** | **22** | **22** |

### 6.2 1-ci qaçışdakı +8 uğursuzluğun təhlili (yekun qaçışda aradan qalxdı)

| Mənbə | Say | Səbəb | Vəziyyət |
|---|---|---|---|
| `rate-limit.spec.ts` | 1 | **Mənim testim** — 132 sorğunun hər biri ayrıca `page.evaluate` round-trip-i idi, dəst yükü altında 30 s timeout-a düşürdü. **429 DEYİLDİ** | ✅ düzəldildi (`2ae60a7`) — dövr səhifə daxilinə yığıldı |
| `ws-flow.spec.ts` | +4 | Dəst kontekstində sessiya ölümü | ❌ mənim deyil — sübut aşağıda |
| `[mobile]` | +3 | Eyni sessiya qüsuru; dəst 26,0 → 28,8 dəqiqəyə uzandı | ❌ mənim deyil |

**`ws-flow` sübutu — izolə qaçış:** `playwright test ws-flow --project=desktop`
təkbaşına → **2 uğursuz / 5 keçdi**, yəni **AUDIT-TASK-3 baseline-i ilə eyni**.
Dəstdəki 6 rəqəmi kontekst effektidir.

Kök səbəb loqdan birbaşa oxunur:

```
X [ERROR] otaq mesajı D1-ə yazılmadı general … D1_ERROR: FOREIGN KEY constraint failed
```

Lokal D1-də doğrulandı: `rooms` cədvəlində **819 sətir var, `general` YOXDUR**.
Bu, AUDIT-TASK-3 §8/2-də sənədləşdirilmiş **lokal seed drift-idir** (eyni sinif:
`team_1` sətirləri də yoxa çıxmışdı) — rate limit ilə heç bir əlaqəsi yoxdur.

> ⚠ **Mühit qəsdən düzəldilmədi.** `general` otağını bərpa etmək uğursuzluq
> sayını azaldardı, lakin AUDIT-TASK-3 baseline-i həmin drift ilə ölçülüb —
> mühiti müqayisənin ortasında dəyişmək meyar 2-ni mənasızlaşdırardı.
> Bərpa əmri §7-də açıq öhdəlik kimi qeyd olunub.

---

## 7. Aşkarlanan yeni risklər

1. 🟠 **`startPoll` 429-da dayanmırdı — öz-özünü gücləndirən nasazlıq (BAĞLANDI).**
   Auditdə yoxdur. Rate limit əhatəsi genişləndirildikdən sonra bu, ən ciddi
   praktiki riskə çevrilirdi: 3 saniyəlik poll 429 aldıqdan sonra dövr edib
   sayğacı yenidən doldururdu. Limit əhatəsi ilə birlikdə tətbiq edilməsəydi,
   bir dəfə limitə düşən istifadəçi **öz-özünü kilidləyirdi**.

2. 🟠 **Test mühiti çarpanı limit testlərini mümkünsüz edirdi.** `rlFactor` bütün
   səbətlərə 20× tətbiq edirdi; ən kiçik uid səbətini (20/saat) doldurmaq üçün
   401 sorğu lazım gəlirdi. Çarpan açar sinfinə bağlandı (IP 20×, uid 5×) —
   əsaslandırma: uid üzrə hesablar artıq qarışmır, yəni köhnə əsaslandırma
   ("bütün cihazlar bir IP-dən gəlir") uid səbətlərinə şamil olunmur.

3. 🟠 **E2E paylaşılan sessiya qüsuru daha da ağırlaşdı.** Dəst 26,0 → 28,8
   dəqiqəyə çıxdı və `ws-flow` uğursuzluğu 2 → 6 oldu. Hər yeni test bu qüsuru
   pisləşdirir. AUDIT-TASK-3 §8/1-də təklif edilən refaktor (hər spec öz izolə
   kontekstində giriş etsin) **artıq təxirə salına bilməz**.

4. 🟡 **`/files/*` avtorizasiyasızdır** (C-1 → Task 7). Bu task ona `asset`
   səbəti verdi, yəni **xərc** qorundu, **avtorizasiya** yox. Rate limit
   avtorizasiyanın əvəzi deyil.

5. 🟡 **`admin` səbəti 300/dəq-dir və 22 route-a şamil olunur.** Admin paneli 9
   paralel poll işlədir (≈37 sorğu/dəq) — 8 tab ehtiyatı var. Admin toplu
   əməliyyatları (200 istifadəçinin emalı) bir sorğuda getdiyi üçün problem
   yaratmır, lakin gələcəkdə sətir-sətir toplu əməliyyat əlavə olunsa bu limit
   yenidən qiymətləndirilməlidir.

6. 🟡 **`heavy` səbəti `GET /api/me/export`-u da əhatə edir** (GDPR ixracı,
   20/saat). Qanuni istifadəçi ildə bir neçə dəfə ixrac edir — geniş ehtiyat.
   Lakin hüquqi baxımdan "məlumatlarıma çıxış" hüququnun rate limit ilə
   məhdudlaşdırılması Privacy sənədində qeyd olunmalıdır (LEGAL-GAPS-ə əlavə).

---

## 8. Açıq qalan öhdəliklər

- [ ] 🔴 **Atomik limiter → Task 9.** `auth`, `refresh`, `upload` səbətləri
      hazırda elan edilən limitdən **zəifdir** (H-3). Bu task əhatəni
      genişləndirdi, düzgünlüyü yox.
- [ ] 🔴 **E2E paylaşılan sessiya refaktoru** (Task 3 §8/1 + bu hesabat §7/3)
- [ ] 🟠 Lokal D1 seed drift-inin bərpası — `general` otağı yoxdur:
      `npx wrangler d1 execute collabix-db --local --persist-to .wrangler/state --file migrations/0002_seed.sql`
      (bütün seed faylları `INSERT OR IGNORE`-dur, idempotentdir)
- [ ] 💡 `read` səbəti üçün sampling (§5.5) — istifadəçi qərarı gözləyir
- [ ] 🟡 Polling → WebSocket → **Task 10** (`presence` və `read` limitləri
      polling reallığına görə səxavətlidir; keçiddən sonra sıxıla bilər)
- [ ] 🟡 GDPR ixracının rate limit-i Privacy sənədində qeyd olunsun (§7/6)
- [ ] 🟡 İstehsalda p50/p95 gecikmə müqayisəsi (§5.3)

### Əvvəlki task-lardan miras

- [ ] 🔴 `ARCHIVE_HOT_DAYS` → `"90"` (Task 8-dən sonra; əvvəlcə Privacy §4)
- [ ] 🔴 Hüquqi mətnin peşəkar nəzərdən keçirilməsi (LEGAL-GAPS §2.4, §2.1)
- [ ] 🔴 `collabix.az` DNS + MX
- [ ] 🟠 TestSprite API açarının rotasiyası
- [ ] 🟠 53 hesaba parol sıfırlama qərarı
- [ ] 🟠 VÖEN, sosial profillər (real olduqda)
- [ ] 💡 `is_system` miqrasiyası (Task 3 §4) — istifadəçi qərarı gözləyir
- [ ] Demo seed `role_1` → **Task 5**
- [ ] Git remote qərarı

---

## 9. Commit-lər

| Hash | Bənd | Başlıq |
|---|---|---|
| `be69cb7` | 4.1, 4.2, 4.5 | `feat(ratelimit): səbət taksonomiyası, yeni səbətlər və uid açar strategiyası` |
| `ba929cf` | 4.3, 4.4, 4.6, 4.7 | `feat(ratelimit): opt-in → opt-out inversiyası (default DENY)` |
| `87d5830` | 4.7 | `fix(api): kodsuz 401/403 xətalarına maşın kodu əlavə olundu` |
| `666701f` | 4.6 | `feat(api): frontend 429-u emal edir — polling dayanır, istifadəçi xəbərdar olur` |
| `6c30eb3` | 4.8 | `test(ratelimit): AUDIT H-4 əhatə, cavab forması və izolyasiya dəsti` |
| `2ae60a7` | 4.8 | `test(ratelimit): sorğu dövrələri səhifə daxilinə yığıldı (timeout düzəlişi)` |

Push edilmədi — git remote qərarı hələ açıqdır.

---

## 10. Geri qaytarma planı

| Commit | Revert | Gözlənilən təsir |
|---|---|---|
| `ba929cf` (inversiya) | `git revert ba929cf` | 107 route yenidən limitsiz — **H-4 tam açılır**. ⚠ `auth.ts`-dəki səbətlər qalır, lakin heç bir route onlara istinad etmir |
| `be69cb7` (səbətlər) | `git revert be69cb7` | ⚠ **ba929cf-dən ƏVVƏL revert edilə bilməz** — route cədvəli mövcud olmayan səbətlərə istinad edər və `tsc` sınar. Sıra: əvvəlcə `ba929cf`, sonra `be69cb7` |
| `666701f` (frontend) | `git revert 666701f` | 429 yenidən səssiz uğursuzluğa çevrilir və **polling dövrəsi dayanmır** — istifadəçi limitdən çıxa bilmir. Server düzəlişi qalsa da UX çökür |
| `87d5830` (kodlar) | `git revert 87d5830` | Xəta kodları itir; frontend hazırda onlara baxmadığı üçün davranış dəyişmir |

⚠ **Limitlərin özünü azaltmayın.** `read: 600` və `presence: 150` dəyərləri
§0/Sual 6-dakı **ölçmələrdən** çıxıb, təxmin deyil. Azaldılsa normal istifadəçi
429 alacaq — reqressiya testi (`normal istifadəçi axını 429 ALMIR`) bunu dərhal
tutur.
