# AUDIT-TASK-10 — Platform Yetkinliyi və Borcun Tam Bağlanması

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md` §8 (modul cədvəli), §9 (struktur + proses borcu #1–11)
**Əlavə mənbələr:** Task 1–9 hesabatlarının **bütün** açıq öhdəlikləri
**Bağlanan tapıntılar:** M-3, struktur borcu #1–7, proses borcu #8–11, 11 sxem bəndi, ~35 miras öhdəlik
**Təxmini həcm:** **Faza 0-ın qərarından asılı** — 18 gün (minimum) və ya 35+ gün (maksimum)
**Ön şərt:** AUDIT-TASK-9 tamamlanmış
**Risk sinfi:** 🟡 Orta — hər faza müstəqil buraxıla bilər; əsas risk **əhatənin idarəsizliyidir**

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-10 Altı faza. Faza 0 = strateji qərar qapısı (PRD-nin 88%-i: icra et ya
               sənədi kodun reallığına uyğunlaşdır?) — bu, qalan hər şeyin həcmini müəyyən edir.
               Faza 1 = CI + lint + js/ typecheck + unit test + öz-özünü təmizləyən E2E + staging.
               Faza 2 = observability + request ID + alerting.
               Faza 3 = kod borcu: routes.ts bölünməsi, iki notify(), iki presence,
                        boş stub-lar, styles.css, favicon.
               Faza 4 = sxem borcu (11 bənd, triyajla).
               Faza 5 = funksional boşluqlar (feed cursor, polling→WS, parol bərpası, CSP).
               Faza 6 = sənəd uyğunluğu + 35 miras öhdəliyin bağlanması.
               DONE: hər PR-də avtomatik qapı; boş stub yoxdur; sənəd-kod uyğunluğu ≥90%;
                     açıq öhdəlik siyahısı BOŞ və ya sahibi/tarixi olan xarici bəndlərdən ibarət.
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli baş mühəndissən (tech lead)**.

Bu, audit zəncirinin **sonuncu task-ıdır** və xarakteri əvvəlkilərdən fərqlidir:

| Task 1–9 | Task 10 |
|---|---|
| Konkret tapıntı bağlayırdı | **Proqram** idarə edir |
| Əhatə audit tərəfindən müəyyən idi | Əhatə **sənin qərarınla** müəyyən olunur |
| Riski dərinlikdə idi | Riski **idarəsiz genişlənmədədir** |

**Ən vacib davranış qaydası:** Bu task-ın uğursuzluq rejimi "səhv kod" deyil, **"heç vaxt bitməmək"**dir. Ona görə Faza 0 bağlayıcı qərar qapısıdır və hər faza **müstəqil buraxıla bilən** olmalıdır.

---

## 2. KONTEKST

### 2.a Zəncirin vəziyyəti

| Task | Bağlandı |
|---|---|
| 1 | C-2, H-2, C-3 zərər azaltması, M-16, L-1 |
| 2 | Hüquqi kimlik, domen vahidliyi, **git repo** |
| 3 | H-1 (RBAC eskalasiyası) |
| 4 | H-4 (rate limit əhatəsi) + səbət taksonomiyası |
| 5 | H-7 (demo seed) + miqrasiya nizamı + deploy qapısı |
| 6 | M-1, M-2, M-5…M-17, L-3…L-6 + sxem sərtləşdirmə |
| 7 | **C-1** (`/files/*` avtorizasiyası) |
| 8 | **C-3** (arxiv oxu yolu) + GDPR ixracı |
| 9 | H-3, H-5, H-6, M-4 |

**Qalan:** M-3 (CSP), struktur borcu #1–7, proses borcu #8–11, 11 sxem bəndi, PRD/TDD strateji qərarı və **~35 miras öhdəlik**.

### 2.b 🔴 Bağlayıcı ayrım — borc ≠ məhsul əhatəsi

"Kod borcu qalmamalıdır" tələbinin dəqiq mənası bu ayrımdan asılıdır:

| Kateqoriya | Tərif | Nümunə | Task 10-da |
|---|---|---|---|
| 🔧 **Kod borcu** | Mövcud kod **səhv, dublikat və ya idarəolunmazdır** | `routes.ts` 140 KB, iki `notify()`, iki presence sistemi, CI yoxluğu, boş stub-lar | ✅ **Tam bağlanır** |
| 📦 **Məhsul əhatəsi** | Heç vaxt yazılmamış funksionallıq | PRD-nin 9 rolu, badge/achievement/unlock engine-ləri, moderator namizədliyi, reputation engine | ⚠️ **Borc deyil** — Faza 0 qərarı |
| 🌐 **Xarici öhdəlik** | Kod deyil, əməliyyat/qərar | DNS, VÖEN, hüquqi baxış, git remote | 📋 Sahib + tarix təyin olunur |

⚠️ İkincisini "borc" saymaq bu task-ı **sonsuz** edir. Audit özü də bunu ayırır: `XP / role / progression` modulunu **12%** qiymətləndirir və *"sıfırdan qurulmalıdır"* yazır — bu, təmizlik deyil, **yeni layihədir**.

### 2.c Task 9-dan gələn ən vacib dərs

`AUDIT-TASK-9-REPORT.md` §R-1b:

> `e2e/KNOWN-FAILING.md` baseline-ın bağlandığını (**0 sınıq**) yazır, lakin … `playwright.config.ts`-dən layihə səviyyəsindəki `storageState` **çıxarılmayıb**. Nəticədə `home.spec.ts`-in **21 testinin hamısı** timeout-a düşürdü.
>
> ⚠ Ən diqqətçəkəni: `auth-fixture.ts`-in öz başlıq şərhi bu nəticəni **açıq proqnozlaşdırırdı** — yəni səbəb məlum idi, sadəcə konfiq uyğunlaşdırılmamışdı.
>
> 🔴 **Nəticə:** növbəti task `KNOWN-FAILING.md`-ə güvənməməli, baseline-ı ÖZÜ ölçməlidir.

Buna §R-3b əlavə olunur: dəst **öz-özünü zəhərləyir** (qalıq `a9_*`/`rl_*` hesabları, `heavy` səbət büdcəsi) və §R-2: `reuseExistingServer` ölçməni **səssizcə korlayır**.

**Nəticə:** Faza 1 bu task-ın **birinci və bağlayıcı** hissəsidir. Etibarlı ölçmə olmadan qalan 5 faza öz nəticələrini doğrulaya bilməz.

---

## 3. FAZA 0 — Strateji qərar qapısı

**Həcm:** 1 gün (analiz + qərar) · **kod dəyişikliyi yoxdur**

Bu faza qalan hər şeyin həcmini müəyyən edir. **Qərarlar alınmadan Faza 3–5-ə keçmə.**

---

### 0.1 · Qərar A — PRD/TDD uyğunsuzluğu

**Vəziyyət (auditdən):**

| Sənəd iddiası | Kod reallığı |
|---|---|
| 9 rol (USER…OWNER) + permission matrisi | `users.role` sütunu var, **heç bir avtorizasiya qərarında oxunmur** |
| PRD-nin 17 cədvəli | **Heç biri sxemdə yoxdur** |
| Badge engine (server) | Client-side statik massiv |
| Achievement / unlock / reputation engine | Yoxdur |
| Moderator namizədliyi, warnings/bans/mutes | Yoxdur |
| `XP / role / progression` modulu | Audit: **12%** — *"sıfırdan qurulmalıdır"* |

**Üç variant:**

| Variant | Nə deməkdir | Həcm | Nəticə |
|---|---|---|---|
| **(A1) Sənədi kodun reallığına uyğunlaşdır** | PRD/TDD-ni **faktiki məhsulu** təsvir edən sənədə çevir; icra olunmamış hissələr "gələcək yol xəritəsi" bölməsinə köçürülür | **2 gün** | Sənəd-kod uyğunluğu ≥90%; borc bağlanır |
| **(A2) PRD-ni tam icra et** | 9 rol + 17 cədvəl + 5 engine | **15–25 gün** | Yeni məhsul inkişafı |
| **(A3) Hibrid** | Yalnız təhlükəsizlik dəyəri olan hissə: `users.role`-un avtorizasiyaya bağlanması + admin rol ierarxiyası (audit `admin panel` bölməsində qeyd edir: *"hər admin = tam səlahiyyət"*) | **4–5 gün** | Real risk bağlanır, qalan sənədə köçür |

**Tövsiyə: (A3).** Əsaslandırma:
- (A1) tək başına **real təhlükəsizlik boşluğu buraxır** — hazırda hər admin tam səlahiyyətlidir və 2FA tələbi yoxdur. Task 6 M-14 son admin qorumasını qurdu, lakin ierarxiya hələ yoxdur.
- (A2) audit tapıntısı deyil, məhsul qərarıdır — 25 günlük iş "borcun bağlanması" adı altında gizlədilməməlidir.
- (A3) risk daşıyan 20%-i icra edir, qalan 80%-i dürüst şəkildə yol xəritəsinə köçürür.

**⚠️ İstifadəçidən qərar istə.** Bu, texniki deyil, məhsul qərarıdır.

---

### 0.2 · Qərar B — 23 boş service stub-u + 6 boş workflow

**Vəziyyət (audit struktur borcu #2):**
> Bunlar "arxitektura var" illüziyası yaradır və gələcək developer-i çaşdırır. Ya doldurulmalı, ya silinməlidir — **aralıq vəziyyət ən pisidir**.

| Variant | Həcm | Nəticə |
|---|---|---|
| **(B1) Sil** | 0,5 gün | İllüziya yox olur; arxitektura niyyəti də itir |
| **(B2) Doldur** | Faza 3-ün `routes.ts` bölünməsi ilə birləşir | Stub-lar **hədəf struktur** kimi işlənir |
| **(B3) Sənədləşdir + sil** | 1 gün | `docs/ARCHITECTURE.md`-də niyyət qeydə alınır, boş fayllar silinir |

**Tövsiyə: (B2) + (B3) birləşməsi.** `routes.ts` onsuz da bölünəcək (Faza 3-1) — stub-ların adları hədəf modul strukturu üçün **hazır plandır**. Doldurula bilməyənlər (B3) ilə silinir.

---

### 0.3 · Qərar C — Sxem borcunun 11 bəndi

Task 6 §2.c-dəki triyaj Task 10-a **11 bənd** ötürdü. Onlar **eyni səviyyədə deyil**:

| Qrup | Bəndlər | Həcm | Dəyər |
|---|---|---|---|
| 🟢 **Ucuz + dəyərli** | `contact_messages.uid`, `ANALYZE` cron, çatışmayan FK-lar | 1,5 gün | Yüksək |
| 🟡 **Orta** | `user_bans`, `media`, `daily_stats` (rollup), qlobal `activities` | 4 gün | Orta |
| 🔴 **Böyük refaktor** | UUIDv7, soft delete (tam), `profiles`/`user_emails`/`user_socials`/`user_settings` ayrılması, `post_blocks` | 12+ gün | Aşağı-orta |
| ⚫ **Faza 0/A-dan asılı** | RBAC cədvəlləri (`roles`, `permissions`, …) | A-qərarına görə | — |

**Tövsiyə:** Yaşıl qrup **məcburi**, sarı qrup **seçimli**, qırmızı qrup **təxirə salınır və sənədləşdirilir**.

⚠️ **Qırmızı qrup üçün əsaslandırma:** UUIDv7 keçidi 40+ cədvəldə hər PK/FK-nı yenidən yazmaq deməkdir. Mövcud ID-lər (`vbpVokAhLqJA9m0RpqMryroA4S8s`) **işləyir**. Bu, "borc" deyil, **optimizasiya tercihidir** — və canlı bazada data itkisi riski daşıyır.

---

### 0.4 · Əhatənin təsdiqi

Faza 0-ın nəticəsi: `docs/TASK-10-SCOPE.md` — hansı fazanın nə əhatə etdiyi, təsdiqlənmiş həcm, buraxılmayanların səbəbi.

**Bu sənəd təsdiqlənmədən Faza 3-ə keçmə.**

---

## 4. FAZA 1 — Test və CI təməli

**Həcm:** 4–5 gün · 🔴 **Birinci və bağlayıcı**

Bütün digər fazalar reqressiya qorumasına möhtacdır. Audit sətir 783 bunu açıq deyir:
> *"Bu şəraitdə hər düzəliş yeni reqressiya riskidir və reqressiyanı tutacaq mexanizm yoxdur."*

---

### 1.1 · 🔴 E2E baseline-ın etibarlı ölçülməsi

**Mənbə:** Task 9 §R-1b, §R-2, §R-3b · **Həcm:** 1 gün

⚠️ **`KNOWN-FAILING.md`-ə GÜVƏNMƏ.** Task 9 sübut etdi ki, sənəd "0 sınıq" yazarkən 21 test sınırdı.

**Tələb — bu sıra ilə:**

1. **Ölçmə mühitini təmizlə:**
   ```bash
   # Qalıq test hesabları (Task 9 §R-3b: 24 hesab yığılmışdı)
   # rl:* KV açarları
   # .wrangler/state
   ```
2. **`reuseExistingServer` tələsini bağla** (§R-2): ölçmə zamanı watch rejimi olmasın; əl ilə başladılmış `wrangler dev` təkrar istifadə edilməsin.
3. **Kod dəyişməzdən ƏVVƏL** tam qaçış — bir bütöv, kəsilməmiş qaçış (§ Task 9 açıq öhdəlik: *"tək qaçışda 312/312 alınmadı"*).
4. Nəticəni `docs/E2E-BASELINE.md`-ə yaz: tarix, commit hash, tam say, sınıq siyahısı **atribusiya ilə** (məhsul qüsuru / test qüsuru / mühit).

---

### 1.2 · Öz-özünü təmizləyən test dəsti

**Mənbə:** Task 9 §R-3, §R-3b · **Həcm:** 1 gün

| Problem | Həll |
|---|---|
| Qalıq `a9_*`/`rl_*` hesabları kataloqu doldurur | `globalSetup` prefiksli test hesablarını **silsin** |
| `rl:*` KV açarları limitləri daşıyır | `globalSetup` təmizləsin |
| `heavy` səbəti (20/saat) 6 GDPR testini 429-a salır | Test hesablarını **ayır** və ya limiti test mühitində qaldır |
| `admin.spec` bulk testi istifadəçini bloklu qoyur | İdempotent `afterEach` təmizliyi |
| Sabit id-li seed (`e2e_tp_csv`) `UNIQUE` xətası verir | Task 9-da birincisi düzəldilib — **eyni naxışı hamıya tətbiq et** |

⚠️ **Prinsip:** Test dəsti **əvvəlki qaçışın vəziyyətindən asılı olmamalıdır**. Bu, Task 5-in E2E seed müstəqilliyi qaydasının davamıdır.

---

### 1.3 · Lint və formatter

**Audit ID:** proses borcu #9 · **Həcm:** 0,5 gün

450 KB `js/` **heç bir statik analizdən keçmir**.

| Alət | Konfiqurasiya |
|---|---|
| **ESLint** | `worker/` (TS) + `js/` (ESM) üçün ayrı konfiq |
| **Prettier** | Mövcud kod stilinə **uyğunlaşdır** — kütləvi yenidən formatlaşdırma **etmə** |

⚠️ 🔴 **Kütləvi formatlaşdırma qadağası:** Bütün faylı yenidən formatlamaq `git blame`-i məhv edir və hər sonrakı merge-i konfliktə salır. Yalnız **yeni/dəyişdirilən** fayllara tətbiq et (`lint-staged` naxışı).

⚠️ **İlk qaçış minlərlə xəbərdarlıq verəcək.** Strategiya: qaydaları **tədricən** aktivləşdir (əvvəlcə `error` səviyyəli təhlükəsizlik qaydaları, sonra stil).

---

### 1.4 · `js/` tip yoxlaması

**Mənbə:** Task 6 §8/1, Task 7 §7.7 · **Həcm:** 1 gün

Audit: *"`js/` (≈450 KB) **tamamilə typecheck-siz**"*. Task 7-də bu, real zərər verdi — frontend dəyişikliyi yalnız E2E ilə doğrulana bildi.

**Tələb:**
```jsonc
// jsconfig.json və ya tsconfig.js.json
{ "compilerOptions": { "allowJs": true, "checkJs": true, "noEmit": true, "strict": false } }
```

⚠️ `strict: false` ilə başla. `strict: true` 450 KB-da yüzlərlə xəta verər və bu task-ı bloklayar. Məqsəd: **tipik səhvləri tutmaq** (yazı səhvi, olmayan sahə, yanlış arqument sayı), mükəmməl tipləmə deyil.

⚠️ JSDoc tipləri tədricən əlavə edilə bilər — **indi məcburi deyil**.

---

### 1.5 · Unit test qatı

**Audit ID:** test layer 45% · **Həcm:** 1 gün

Hazırda **unit test 0, integration test 0**.

**Prioritet — audit-kritik saf funksiyalar:**

| Funksiya | Niyə |
|---|---|
| `canReadKey` (Task 7) | C-1-in özəyi; hər prefiks üçün cədvəl testi |
| `sanitizePermissions` + eskalasiya qaydaları (Task 3) | H-1 |
| `grantXp` + gündəlik tavan (Task 9) | H-5 |
| `levelFromXP`, `clampStr`, `normalizeFileRef` | Saf, sürətli, dəyərli |
| Rate limit səbət seçimi (Task 4) | H-4 |
| `hexToBytes` (Task 6 M-17) | Fail-closed davranışı |

⚠️ **Vitest** layihədə onsuz da mövcuddur (audit qeyd edir). Miniflare ilə inteqrasiya testləri **ikinci mərhələdir** — E2E onları qismən örtür.

---

### 1.6 · CI/CD

**Audit ID:** proses borcu #8 · **Həcm:** 1 gün

```yaml
# .github/workflows/ci.yml — qapılar
# 1. typecheck (worker/ + e2e/ + js/)
# 2. lint
# 3. unit test
# 4. check:migrations   ← Task 5-də quruldu
# 5. build
# 6. E2E (ayrı job, daha uzun)
```

⚠️ **Task 5-in deploy qapısı** (`predeploy` → `check-migrations.mjs --remote`) CI-dan çağırılmalıdır. `d1-migrations-must-precede-deploy` qaydası nəhayət **yaddaşdan koda** tam keçir.

⚠️ **Sirlər:** CI Cloudflare API token tələb edir. Ən az səlahiyyət prinsipi; token repo secret-lərində.

⚠️ Git remote hələ təyin olunmayıb (Task 2-dən açıq öhdəlik) → **CI-dan əvvəl həll edilməlidir**.

---

### 1.7 · Staging mühiti

**Audit ID:** proses borcu #10 · **Həcm:** 0,5 gün

> `wrangler.jsonc`-da `env.*` bölməsi yoxdur; deploy **birbaşa istehsala**.

```jsonc
"env": {
  "staging": {
    "vars": { "SITE_ORIGIN": "https://staging…" },
    "d1_databases": [ /* ayrı baza */ ],
    "r2_buckets":   [ /* ayrı bucket */ ]
  }
}
```

⚠️ Task 2-də qurulan `SITE_ORIGIN` tək mənbəsi bunu **artıq mümkün edir**.
⚠️ Miqrasiyalar staging-də əvvəlcə tətbiq olunmalıdır — Task 8 §7.b-dəki gizli Critical qüsur staging-də tutulardı.

---

## 5. FAZA 2 — Observability və əməliyyat

**Həcm:** 2 gün

---

### 2.1 · Observability açılması

**Audit ID:** logging/monitoring 50% · **Həcm:** 0,5 gün

> `wrangler.jsonc:59` → `observability.enabled: **false**` (alt açarlar `true` olsa da **ana açar sönülü**).

Bu, bir sətirlik dəyişiklikdir və **bütün Task 1–9-un ölçmə öhdəliklərini** mümkün edir:
- Task 4: istehsalda p50/p95
- Task 7: `/files/` gecikməsi
- Task 9: DO gecikməsi (açıq öhdəlik)

---

### 2.2 · Request ID və strukturlu log

**Audit ID:** error states 70% · **Həcm:** 1 gün

> Generik 500-lər, **request ID yox**, boş `catch{}` blokları (15+ yer), frontend-də global error boundary yox.

| Bənd | Tələb |
|---|---|
| **Request ID** | Hər sorğuya UUID; cavab başlığında (`X-Request-Id`) və hər log sətrində |
| **Boş `catch{}`** | 15+ yer — hər biri ya loglasın, ya səbəbi şərhdə **açıq yazılsın** (`roomBroadcast`, `userPush`, `verifyTurnstile`, `recentFailures`) |
| **Frontend error boundary** | Qlobal `window.onerror` + `unhandledrejection` → istifadəçiyə anlaşılan mesaj |
| **500 cavabı** | `code` + `requestId` daşısın (məzmun sızdırmadan) |

---

### 2.3 · Alerting və açıq təhlükəsizlik öhdəlikləri

**Mənbə:** Task 6 (M-1), Task 7 §8/5 · **Həcm:** 0,5 gün

| Öhdəlik | Əməliyyat |
|---|---|
| **M-1 CSRF: log → bloklama** | Task 6 log rejimində qoydu. İndi real trafik datası var → **meyar təyin et və keçir** |
| **`file_access_denied` siqnalı** | Task 7 §8/5: bir uid-dən dəqiqədə onlarla rədd = açar sadalama. Avtomatik reaksiya yoxdur |
| **`xp_invariant: 'drift'`** | Task 9 §5.4-də `/api/health`-ə əlavə edildi → siqnala bağla |
| **Cloudflare Cache Rules** | Task 7 §9 açıq: `/files/*` üçün qayda varmı? Dashboard yoxlaması |
| **R2 Logpush** | Task 7 §9: keçmiş oxumaları müəyyən etmək mümkün deyil |

---

## 6. FAZA 3 — Kod borcunun ödənilməsi

**Həcm:** 5–6 gün · **audit struktur borcu #1–7**

---

### 3.1 · `routes.ts` bölünməsi

**Audit ID:** struktur borcu #1 (*"ən böyük borc"*) · **Həcm:** 3 gün

> 140 KB / 100+ export. Hər dəyişiklik bütün faylı toxundurur, merge konflikti riski, koqnitiv yük. **`team-routes.ts` + `services/team/` nümunəsi düzgün yolu göstərir.**

**Tələb:**

1. **Hədəf struktur** — Faza 0/B qərarındakı stub adlarından istifadə et (onlar artıq niyyəti göstərir).
2. **Domen üzrə böl:** `auth`, `user`, `post`, `comment`, `notification`, `room`, `admin`, `search`, `upload`, `export`.
3. 🔴 **Davranış dəyişikliyi SIFIR.** Bu, **saf refaktordur**. Hər addımdan sonra tam E2E.
4. **Addım-addım köçürmə** — 140 KB-ı bir commit-də bölmə. Hər modul ayrıca commit; `routes.ts` re-export barrel kimi qalsın ki, `index.ts` dəyişməsin.
5. **Dairəvi asılılıq** riskini yoxla (`madge` və ya bənzəri).

⚠️ **Ən böyük tələ:** refaktor zamanı "kiçik yaxşılaşdırma" etmək cazibədardır. **Etmə.** Refaktor + davranış dəyişikliyi eyni commit-də olsa, reqressiyanın səbəbi tapıla bilməz.

---

### 3.2 · Dublikat implementasiyalar

**Audit ID:** struktur borcu #4, #5 · **Həcm:** 1 gün

| Dublikat | Yer | Həll |
|---|---|---|
| **İki `notify()`** | `routes.ts:34` və `services/notification/index.ts:12` | Birləşdir. Audit `msg.ts`-in paylaşılan modul kimi çıxarılmasını **düzgün naxış** adlandırır — eyni yolu tət |
| **İki presence sistemi** | D1 `presence` cədvəli + `PresenceDO` | ⚠️ Qərar tələb edir: hansı həqiqət mənbəyidir? DO real-time üçün, D1 tarixçə üçündürsə — **sənədləşdir**. Deyilsə — birini sil |

⚠️ İki `notify()` üçün audit xəbərdarlığı: *"Şərh bunu 'eyni qaydalar' kimi təsvir edir; **vaxtla ayrılacaqlar**."* Birləşdirmədən əvvəl **fərqləri diff-lə** — artıq ayrılmış ola bilərlər.

---

### 3.3 · Boş stub-lar

**Audit ID:** struktur borcu #2 · **Həcm:** Faza 0/B qərarına görə

23 boş service stub-u + 6 boş workflow. Faza 0/B-dəki qərara uyğun icra et.

---

### 3.4 · Frontend aktivləri

**Audit ID:** struktur borcu #6, #7 · **Həcm:** 1 gün

| Problem | Həll |
|---|---|
| **`styles.css` 179 KB bölünməmiş** | Route/komponent üzrə böl; kritik CSS ayır |
| **`cyberpunk_styles.css` ayrı dizayn dili** | Qərar: istifadə olunurmu? Olunmursa **sil** |
| **`favicon.svg` 255 KB** | 🔴 Favicon üçün fövqəladə. Sadələşdir və ya PNG-yə çevir (< 5 KB) |
| **M-3: CSP `style-src 'unsafe-inline'`** | `styles.css` bölünməsi ilə birlikdə inline stilləri çıxar → CSP sərtləşdir |

⚠️ **M-3 `styles.css` işindən asılıdır** — ona görə eyni fazadadır.

---

### 3.5 · Miras kiçik düzəlişlər

**Mənbə:** Task 7 §8/1, §8/2 · **Həcm:** 0,5 gün

| Bənd | Yer | Düzəliş |
|---|---|---|
| **`photo_url` ikiqat prefiks** | `og.ts:98,110`, `seo.ts:247`, `routes.ts:1618` | `fileUrl()` artıq `/files/` daşıyan dəyərə tətbiq olunur → OG avatarı, JSON-LD `image`, publik profil **sınıqdır** |
| **OG üçün publik avatar yolu** | `og.ts` | Sosial botlar giriş etmir → R2-dən **server tərəfdə** oxu və ya `data:` URI |

---

## 7. FAZA 4 — Sxem borcu

**Həcm:** Faza 0/C qərarına görə — 1,5 gün (yalnız yaşıl) və ya 5,5 gün (yaşıl + sarı)

---

### 4.1 · Yaşıl qrup (məcburi)

| Bənd | Mənbə | Həcm |
|---|---|---|
| **`contact_messages.uid`** | Task 8 §9/5 — e-poçt dəyişsə köhnə müraciətlər ixracda itir | 0,5 gün |
| **`ANALYZE` cron** | Task 6 §8/3 — statistika köhnəlir, planlayıcı səhv plan seçir | 0,5 gün |
| **Çatışmayan FK-lar** | Audit: *"bir sıra sosial cədvəldə FK yox"*; Task 5 §10/5 | 0,5 gün |

⚠️ **FK əlavəsi SQLite-də cədvəlin yenidən qurulmasını tələb edir** (Task 6 §Faza D). İndi **staging mövcuddur** (Faza 1.7) → əvvəlcə orada sınaqdan keçir.

---

### 4.2 · Sarı qrup (seçimli)

`user_bans`, `media`, `daily_stats` rollup, qlobal `activities`.

⚠️ **`daily_stats` dəyərlidir:** audit `adminStatsDaily`-nin **4 × `COUNT(*)` tam skan** etdiyini qeyd edir. Rollup cədvəli bunu həll edər.

---

### 4.3 · Qırmızı qrup — sənədləşdirilir, icra olunmur

UUIDv7, soft delete (tam), `profiles`/`user_emails`/`user_socials`/`user_settings` ayrılması, `post_blocks`.

**Tələb:** `docs/SCHEMA-ROADMAP.md` — hər bənd üçün: nə, niyə, həcm, risk, ön şərt. Bu, **borcun ödənilməsi deyil, dürüst qeydə alınmasıdır**.

---

### 4.4 · Miras siyasət qərarları

| Bənd | Mənbə | Qərar |
|---|---|---|
| **`deleteTeam` soft-delete** | Task 7 §8/3 — `team_members` qalır, keçmiş üzvlər faylları görür | Siyasət |
| **`purgeDeletedFromArchives` sürəti** | Task 8 §9/4 — Privacy "24 saat" vəd edir, arxiv böyüdükcə pozula bilər | Ölç + `PURGE_BATCH` uyğunlaşdır |

---

## 8. FAZA 5 — Funksional boşluqlar

**Həcm:** 4–5 gün · **audit modul cədvəlindən**

Yalnız **audit tapıntısı olan** və ya **istifadəçiyə görünən** boşluqlar. Yeni funksionallıq **deyil**.

| # | Boşluq | Modul | Həcm |
|---|---|---|---|
| 1 | **`feed()` cursor paginasiyası** — hazırda `LIMIT 60`, cursor yox | feed 72% | 1 gün |
| 2 | **`notification` paginasiyası + prune cron** — `LIMIT 60`, köhnələr heç vaxt silinmir | notification 78% | 0,5 gün |
| 3 | **Polling → WS siqnalı** — 3 s (chat) + 4 s (comment) poll paralel işləyir | rooms/comment | 2 gün |
| 4 | **`posts_fts` yalnız ilk 300 simvol** — post gövdəsi axtarılmır | search 70% | 0,5 gün |
| 5 | **Parol bərpası (unutma) axını YOXDUR** — yalnız admin `temp-password` verir | auth 85% | 1 gün |
| 6 | **Parol gücü yalnız "≥6 simvol"** — kompleksslik/pwned-check yoxdur | auth 85% | 0,5 gün |
| 7 | **`patchPost` şəkilləri və teqləri yeniləmir** | feed 72% | 0,5 gün |

⚠️ **#3 (polling→WS) Task 4-ün limitlərini dəyişir.** Task 4 §4.2 `presence` limitini məhz polling tezliyinə görə qaldırmışdı — WS-ə keçəndə **limit yenidən aşağı salına bilər**.

⚠️ **#5 real boşluqdur:** parolunu unudan istifadəçi hazırda **admin müdaxiləsi olmadan hesabına qayıda bilmir**. Bu, məhsul üçün ciddi UX qüsurudur.

⚠️ **İstifadəçi-istifadəçi blok/mute** (user modulu 80%) və **email dəyişmə axını** — bunlar məhsul əhatəsidir, Faza 0/A qərarına bağlıdır.

---

## 9. FAZA 6 — Sənəd uyğunluğu və öhdəliklərin bağlanması

**Həcm:** 1,5 gün

---

### 6.1 · Sənəd statuslarının düzəldilməsi

**Audit ID:** proses borcu #11 · **Həcm:** 0,5 gün

| Sənəd | Problem | Düzəliş |
|---|---|---|
| `TASK-11.md` | "Status: Planned" — **yanlış**, icra olunub | Faktiki status |
| `report.md` | "100%" iddia edir (**Firebase dövrü**) | Arxivləşdir və ya yenilə |
| `AUDIT_2026.md` | Özünə "100/100" verir | Faktiki qiymət |
| `TASK-10.md` | "Status: Planned" — doğru | Toxunma |

⚠️ **Şişirdilmiş sənəd auditin özündə tapıntı kimi qeyd olunub.** Bu task-ın hesabatı **eyni səhvi təkrarlamamalıdır** — nailiyyət faktla ölçülməlidir.

---

### 6.2 · 🔴 Bütün açıq öhdəliklərin bağlanması

**Həcm:** 1 gün

Task 1–9-un hesabatlarından **hər açıq öhdəliyi** topla və hər biri üçün üç haldan birini təyin et:

| Hal | Tələb |
|---|---|
| ✅ **Bağlandı** | Sübutla |
| 📋 **Sahibi + tarixi var** | Xarici öhdəlik — kim, nə vaxt |
| ⏭️ **Qəsdən təxirə salındı** | **Yazılı əsaslandırma** + hara köçürüldü |

**Sonuncu hal ⚠️ yalnız əsaslandırma ilə qəbul olunur.** "Vaxt çatmadı" əsaslandırma deyil.

**Bağlanmalı öhdəliklərin tam inventarı:**

| # | Öhdəlik | Mənbə | Bu task-da |
|---|---|---|---|
| 1 | `RL_MECHANISM` bayrağı + `kvHit` yolunun silinməsi | T9 | Faza 6 (2 həftə keçibsə) |
| 2 | DO gecikməsinin **istehsalda** ölçülməsi | T9 | Faza 2.1 mümkün edir |
| 3 | XP tavanlarının real trafiklə yenidən qiymətləndirilməsi | T9 | Faza 2.1 |
| 4 | E2E baseline tam qaçış | T9 | **Faza 1.1** |
| 5 | Dəstin öz-özünü təmizləməsi | T9 | **Faza 1.2** |
| 6 | `admin.spec` bulk təmizliyi | T9 | Faza 1.2 |
| 7 | İstehsalda ilk arxiv cron-unun yoxlanması | T8 | Faza 2.1 |
| 8 | M-1 log → bloklama | T6 | **Faza 2.3** |
| 9 | `file_access_denied` siqnalı | T7 | **Faza 2.3** |
| 10 | Cloudflare Cache Rules yoxlaması | T7 | Faza 2.3 |
| 11 | R2 Logpush | T7 | Faza 2.3 |
| 12 | `photo_url` ikiqat prefiks | T7 | **Faza 3.5** |
| 13 | OG avatar yolu | T7 | **Faza 3.5** |
| 14 | `js/` tip yoxlaması | T6 | **Faza 1.4** |
| 15 | `ANALYZE` cron | T6 | **Faza 4.1** |
| 16 | `purgeDeletedFromArchives` sürəti | T8 | Faza 4.4 |
| 17 | `contact_messages.uid` | T8 | **Faza 4.1** |
| 18 | `deleteTeam` soft-delete siyasəti | T7 | Faza 4.4 |
| 19 | 11 sxem bəndi | T6 | **Faza 0/C + 4** |
| 20 | Hüquqi mətnin peşəkar baxışı | T2 | 📋 Xarici — sahib + tarix |
| 21 | `collabix.az` DNS + MX | T2 | 📋 Xarici |
| 22 | VÖEN, sosial profillər | T2 | 📋 Xarici |
| 23 | Git remote qərarı | T2 | 🔴 **Faza 1.6-nın ön şərti** |
| 24 | İstehsalda p50/p95 ölçməsi | T4 | Faza 2.1 |
| 25 | `read` səbəti üçün sampling | T4 | Faza 2.1 ölçməsindən sonra |

⚠️ **#23 (git remote) Faza 1.6-nı (CI) bloklayır** — ən erkən həll edilməlidir.

---

### 6.3 · Yekun audit hesabatı

`docs/AUDIT-2026-CLOSURE.md` — auditin **hər tapıntısı** üçün son vəziyyət:

```markdown
| Audit ID | Tapıntı | Vəziyyət | Task | Sübut |
| C-1 | /files/* IDOR | ✅ Bağlandı | 7 | canReadKey + E2E |
| C-2 | 53 açıq parol | ✅ Bağlandı | 1 | legacy/ silindi |
| … 35 tapıntı … |
| PRD 88% | XP/rol sistemi | ⏭️ Yol xəritəsi | 10/A3 | SCHEMA-ROADMAP.md |
```

**Yekun hazırlıq faizi** — audit metodologiyası ilə **eyni meyarlarla** yenidən hesablanmalıdır (audit vaxtı: 62%).

⚠️ Faizi **şişirtmə.** Auditin öz tapıntısı (`AUDIT_2026.md` özünə "100/100" verirdi) təkrarlanmamalıdır.

---

## 10. ƏHATƏDƏN KƏNAR

| Bənd | Səbəb |
|---|---|
| PRD-nin tam icrası (A2 seçilməyibsə) | Məhsul əhatəsi, borc deyil |
| UUIDv7, `profiles` ayrılması və s. (qırmızı qrup) | Faza 4.3 — sənədləşdirilir |
| Yeni funksionallıq (thread, reaksiya növləri, push bildiriş) | Məhsul yol xəritəsi |
| Firefox/Safari responsive testi | Audit "refactor tələbi" kimi qeyd edir — Faza 1-dən sonra ayrıca |
| Virus/malware skanı, upload kvotası | Məhsul əhatəsi |
| Hybrid/semantik axtarışın genişləndirilməsi | Məhsul əhatəsi |

---

## 11. İCRA QAYDALARI

### 11.1 Faza müstəqilliyi

Hər faza **ayrıca buraxıla bilən** olmalıdır. Faza 3 sınsa, Faza 1–2 istehsalda qalmalıdır.

**Sıra bağlayıcıdır:** 0 → 1 → 2 → (3, 4, 5 paralel ola bilər) → 6

⚠️ Faza 1 olmadan Faza 3 (refaktor) **təhlükəlidir** — reqressiya tutulmaz.

### 11.2 🔴 Refaktor qaydası

Faza 3 saf refaktordur. **Qızıl qayda:** refaktor commit-i davranış dəyişikliyi **daşımamalıdır**. İkisi eyni commit-də olsa, reqressiyanın səbəbi tapıla bilməz.

Yaxşılaşdırma ideyaları `docs/`-da qeydə alınsın, **sonrakı commit-də** tətbiq olunsun.

### 11.3 Ölçmə dürüstlüyü

Task 9 §R-1b və §R-3b göstərdi ki, **ölçmə mühiti nəticəni səssizcə korlaya bilər**. Bu task-da hər ölçmə üçün:
- Təmiz mühit (qalıq hesab yox, KV təmiz, watch rejimi söndürülü)
- Kod dəyişməzdən **əvvəl**
- Tam, kəsilməmiş qaçış
- Nəticə commit hash-i ilə birlikdə yazılsın

### 11.4 Miqrasiya nizamı

Task 5 qaydaları qüvvədədir: tətbiq olunmuş miqrasiya dəyişmir, bir nömrə = bir fayl, idempotent, `npm run check:migrations` yaşıl.

### 11.5 Şərh mədəniyyəti

Audit bu layihənin şərh mədəniyyətini **ən dəyərli aktivlərindən biri** adlandırıb. Refaktor zamanı şərhlər **köçürülməli**, silinməməlidir — xüsusilə `routes.ts` bölünməsində.

---

## 12. QƏBUL MEYARLARI

### Faza 0
| # | Meyar |
|---|---|
| 1 | `docs/TASK-10-SCOPE.md` mövcuddur və təsdiqlənib |
| 2 | Üç qərar (A, B, C) yazılı əsaslandırma ilə alınıb |

### Faza 1
| # | Meyar | Gözlənilən |
|---|---|---|
| **3** | 🔴 E2E baseline **tam, kəsilməmiş** qaçışla ölçülüb | commit hash-li sənəd |
| 4 | Dəst öz-özünü təmizləyir | 2 ardıcıl qaçış eyni nəticə |
| 5 | ESLint + Prettier işləyir | `npm run lint` exit 0 |
| 6 | `js/` typecheck edilir | `checkJs` aktiv |
| 7 | Unit testlər mövcuddur | ≥ 6 kritik funksiya |
| **8** | 🔴 CI hər PR-də işləyir | 6 qapı |
| 9 | Staging mühiti mövcuddur | `env.staging` |
| 10 | `predeploy` migration qapısı CI-dan çağırılır | — |

### Faza 2
| # | Meyar |
|---|---|
| 11 | `observability.enabled: true` |
| 12 | Request ID hər cavabda və logda |
| 13 | Boş `catch{}` blokları həll olunub (15+ yer) |
| 14 | Frontend error boundary mövcuddur |
| 15 | M-1 bloklamaya keçib |
| 16 | Alerting qurulub (≥ 3 siqnal) |

### Faza 3
| # | Meyar | Gözlənilən |
|---|---|---|
| **17** | 🔴 `routes.ts` bölünüb, **davranış dəyişməyib** | E2E baseline ≥ |
| 18 | Heç bir fayl > 30 KB | — |
| 19 | İki `notify()` birləşdirilib | tək implementasiya |
| 20 | İki presence sistemi həll olunub | birləşdirilib / sənədləşdirilib |
| 21 | Boş stub qalmayıb | Faza 0/B qərarına görə |
| 22 | `favicon.svg` < 10 KB | — |
| 23 | `styles.css` bölünüb | — |
| 24 | **M-3:** CSP `style-src 'unsafe-inline'` çıxarılıb | — |
| 25 | `photo_url` ikiqat prefiks düzəlib | OG kartı avatar göstərir |

### Faza 4
| # | Meyar |
|---|---|
| 26 | Yaşıl qrup tam icra olunub |
| 27 | `docs/SCHEMA-ROADMAP.md` mövcuddur |
| 28 | Sarı/qırmızı qrup üçün yazılı əsaslandırma |

### Faza 5
| # | Meyar |
|---|---|
| 29 | `feed()` cursor paginasiyası |
| 30 | Notification paginasiya + prune cron |
| 31 | Polling → WS keçidi (və ya əsaslandırılmış təxirə) |
| 32 | Parol bərpası axını mövcuddur |
| 33 | Parol gücü qaydası sərtləşib |

### Faza 6
| # | Meyar | Gözlənilən |
|---|---|---|
| 34 | Sənəd statusları faktla uyğundur | 4 sənəd |
| **35** | 🔴 **25 öhdəliyin hamısı üçün hal təyin olunub** | ✅ / 📋 / ⏭️ |
| 36 | ⏭️ olan hər bənd üçün **yazılı əsaslandırma** | "vaxt çatmadı" qəbul olunmur |
| 37 | `docs/AUDIT-2026-CLOSURE.md` mövcuddur | 35 tapıntı |
| 38 | Yekun faiz **audit metodologiyası ilə** hesablanıb | şişirdilməyib |

### Ümumi
| # | Meyar |
|---|---|
| 39 | `npx tsc --noEmit` exit 0 (worker/ + e2e/ + js/) |
| 40 | `npm run lint` exit 0 |
| 41 | `npm run build` exit 0 |
| 42 | `npm run check:migrations` yaşıl |
| **43** | 🔴 E2E dəsti Faza 1.1 baseline-ından **pis deyil** |
| 44 | CI bütün qapılarda yaşıl |

---

## 13. HESABAT FORMATI

`docs/AUDIT-TASK-10-REPORT.md`:

```markdown
# AUDIT-TASK-10 — İcra Hesabatı

**Tarix:** …   **İcraçı:** …   **Fazalar:** <hansılar icra olundu>

## 0. Strateji qərarlar
| Qərar | Seçim | Əsaslandırma | Həcm təsiri |
| A — PRD/TDD | A1/A2/A3 | … | … gün |
| B — boş stub-lar | B1/B2/B3 | … | … |
| C — sxem borcu | yaşıl/sarı/qırmızı | … | … |

## 1. Faza 1 — test və CI
### 🔴 E2E baseline (kod dəyişməzdən ƏVVƏL)
| Ölçmə | Dəyər |
| Commit | … |
| Tam say | … |
| Sınıq | … |
| Atribusiya | məhsul / test / mühit |
### CI qapıları: <6 qapı, orta müddət>
### Unit test örtüyü: <N funksiya>

## 2. Faza 2 — observability
### Açılan ölçmələr (Task 1–9 öhdəlikləri)
| Öhdəlik | Ölçmə nəticəsi |
| p50/p95 (T4) | … |
| /files/ gecikməsi (T7) | … |
| DO gecikməsi (T9) | … |

## 3. Faza 3 — kod borcu
| Bənd | Əvvəl | Sonra |
| routes.ts | 140 KB | N fayl, maks … KB |
| notify() | 2 | 1 |
| Boş stub | 29 | … |
| favicon.svg | 255 KB | … |
| styles.css | 179 KB | … |
### 🔴 Davranış dəyişikliyi: **yoxdur** — E2E sübutu

## 4. Faza 4 — sxem
## 5. Faza 5 — funksional boşluqlar
## 6. Faza 6 — sənəd və öhdəliklər

### 🔴 25 öhdəliyin yekun vəziyyəti
| # | Öhdəlik | Hal | Sübut / sahib / əsaslandırma |
| … 25 sətir — HEÇ BİRİ boş qalmır … |

## 7. Qəbul meyarları (44 sətir)

## 8. Yekun audit bağlanması
### Tapıntı cədvəli (35 sətir)
### Hazırlıq faizi
| Sahə | Audit (2026-07-26) | İndi | Metodologiya |
| Ümumi | 62% | …% | eyni meyarlar |
⚠️ Şişirdilməmiş qiymət — audit özü `AUDIT_2026.md`-nin "100/100" iddiasını
tapıntı kimi qeyd etmişdi.

## 9. Qalan risklər və yol xəritəsi
<icra olunmayan hər şey: nə, niyə, nə vaxt, kim>

## 10. Geri qaytarma planı
| Faza | Revert | Təsir |
```

---

## 14. BİRİNCİ ADDIM

### 🔴 Addım 0 — ölçmə (kod dəyişməzdən əvvəl)

Task 9 §R-1b dərsi: **`KNOWN-FAILING.md`-ə güvənmə.**

1. Mühiti təmizlə: qalıq `a9_*`/`rl_*` hesabları, `rl:*` KV açarları, `.wrangler/state`
2. `reuseExistingServer` tələsini bağla
3. **Tam, kəsilməmiş** E2E qaçışı
4. Nəticəni commit hash ilə birlikdə təqdim et

### Addım 1 — inventar

1. `wc -c worker/*.ts js/*.js *.css | sort -n | tail -20` → faktiki ölçülər
2. `find worker/services worker/workflows -name "*.ts" -size -1k` → boş stub-ların **faktiki** sayı (audit: 23 + 6)
3. `grep -rn "catch\s*{\s*}\|catch\s*{\s*/\*" worker/` → boş catch blokları (audit: 15+)
4. `grep -c "^export" worker/routes.ts` → export sayı (audit: 100+)
5. `git remote -v` → Faza 1.6 üçün bloker varmı

### Addım 2 — üç strateji qərar üçün istifadəçiyə təqdim et

| Qərar | Variantlar | Tövsiyəm |
|---|---|---|
| **A — PRD/TDD** | A1 sənədi uyğunlaşdır (2 gün) · A2 tam icra (15–25 gün) · A3 hibrid (4–5 gün) | **A3** |
| **B — boş stub-lar** | B1 sil · B2 doldur · B3 sənədləşdir+sil | **B2+B3** |
| **C — sxem borcu** | yaşıl (1,5 gün) · +sarı (5,5 gün) · +qırmızı (17+ gün) | **yaşıl məcburi, sarı seçimli** |

Hər üç qərarın **ümumi həcmə təsirini** hesabla və təqdim et.

### Dayanma şərtləri

| Şərt | Əməliyyat |
|---|---|
| Git remote yoxdur | 🔴 Faza 1.6 bloklanır — **əvvəlcə həll et** |
| E2E baseline qaçışı kəsilirsə | Təkrarla — dilimlərlə ölçmə **qəbul olunmur** (Task 9 §R-2) |
| Faza 0 qərarları alınmayıbsa | Faza 3–5-ə **keçmə** |
| Faza 3 refaktoru E2E baseline-ı pisləşdirirsə | `git revert` — refaktor davranış dəyişdirməməlidir |

Qərarlar alındıqdan sonra **Faza 1-dən** başla — o, qalan hər şeyin ön şərtidir.
