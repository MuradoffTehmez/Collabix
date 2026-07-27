# AUDIT-TASK-6 — Validasiya Paketi, Açıq Öhdəliklər və Sxem Sərtləşdirmə

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md` §M-1, M-2, M-5…M-17, L-3…L-6
**Əlavə mənbələr:** Task 1–5 hesabatlarının açıq öhdəlikləri + istifadəçinin 24 bəndlik sxem siyahısı
**Bağlanan tapıntılar:** 15 Medium, 4 Low, 13 açıq öhdəlik, 6 sxem bəndi
**Təxmini həcm:** **3–4 gün** (5 faza)
**Ön şərt:** AUDIT-TASK-5 tamamlanmış olmalıdır (miqrasiya nizamı + `check-migrations.mjs` qapısı mövcuddur)
**Risk sinfi:** 🟠 Orta — geniş əhatə, hər biri kiçik. Əsas risk **həcmdir**, dərinlik deyil.

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-6  Beş faza: (A) açıq öhdəlikləri bağla — əvvəlcə tsconfig e2e boşluğu;
               (B) M-5…M-17 validasiya/audit paketi; (C) M-1 Origin yoxlaması +
               M-2 PBKDF2 600k tədrici köçürmə; (D) sxem sərtləşdirmə — audit sütunları,
               CHECK trigger-ləri, çatışmayan indekslər, `ə` normalizasiyası;
               (E) doğrulama.
               ⚠️ UUIDv7, users bölünməsi, Argon2id, RBAC cədvəlləri ƏHATƏDƏ DEYİL — §2.d.
               DONE: 15 Medium + 4 Low bağlıdır, açıq öhdəlik siyahısı boşalıb,
                     tsc e2e/-i yoxlayır, mövcud E2E dəsti sınmır.
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli backend mühəndisisən**.

Bu task əvvəlkilərdən **strukturca fərqlidir**. Task 1–5 hər biri **bir problemi dərindən** həll edirdi. Bu task **çoxlu kiçik problemi** həll edir — 15 Medium, 4 Low, 13 açıq öhdəlik və 6 sxem bəndi.

**Əsas risk dərinlik deyil, həcmdir.** Ona görə:

- Faza-faza işlə, fazaları qarışdırma.
- Hər faza sonunda tam E2E qaç — 40 dəyişiklikdən sonra hansının sındırdığını tapmaq baha başa gəlir.
- Bənd atlama. Hər birinin öz sətri var, hər biri hesabatda ✅ və ya əsaslandırılmış ❌ almalıdır.

---

## 2. KONTEKST

### 2.a Layihənin hazırkı vəziyyəti (Task 1–5-dən sonra)

| Bağlandı | Task |
|---|---|
| 53 açıq mətnli parol, `legacy/`, admin qapısı, `.gitignore` | 1 |
| Hüquqi kimlik datası, domen vahidliyi, git repo | 2 |
| RBAC eskalasiyası (`'*'`, altçoxluq, prioritet, dəvət yolu) | 3 |
| Rate limit əhatəsi (171/171), `Retry-After`, `code` sahələri | 4 |
| Demo seed təmizliyi, miqrasiya nizamı, deploy qapısı, E2E seed müstəqilliyi | 5 |

**Açıq qalan:** C-1 (Task 7), C-3 (Task 8), H-3/H-5/H-6 (Task 9), struktur borcu (Task 10) — və **bu task-ın əhatəsi**.

### 2.b 🔴 Ən vacib açıq öhdəlik — `tsconfig` boşluğu

`AUDIT-TASK-5-REPORT.md` §10/1:

> `tsconfig.json` yalnız `worker/**/*.ts`-i əhatə edir — `npx tsc --noEmit` **e2e/ qovluğunu heç vaxt yoxlamır**. Bu task-da həmin boşluq real zərər verdi: `e2e/audit-lib.ts`-də çatışmayan `import` `tsc`-dən keçdi və **BÜTÜN dəstin yüklənməsini sındırdı** (`ReferenceError: E2E_TEAM is not defined`) — səhv yalnız Playwright işə salınanda üzə çıxdı.

Bu, **bu task-ın birinci bəndidir**. Səbəb: Task 6 çox sayda dəyişiklik edir və hər birinin doğrulanması `tsc`-yə güvənir. Yoxlama boşluqlu qalarsa, task boyu səhvlər sükutla keçəcək.

### 2.c 24 bəndlik sxem siyahısının triyajı

İstifadəçi 24 bəndlik enterprise sxem siyahısı təqdim edib. Hər bənd auditlə tutuşdurulub və dörd kateqoriyaya bölünüb.

#### 🟢 A — ARTIQ MÖVCUDDUR (yalnız doğrulanır, qurulmur)

| # | Bənd | Auditdə sübut |
|---|---|---|
| 9 | `sessions` cədvəli | ✅ Mövcuddur — `sessions.ip`, `.ua`, `.city`, `.country` (§H-3, LEGAL-GAPS §2.1). Refresh rotasiyası + reuse detection (`auth.ts:131-175`) auditdə "RFC 6819-a uyğun" qiymətləndirilib |
| 15 | FTS5 axtarış | ✅ **FTS5 × 3** — `posts_fts`, `comments_fts`, `users_fts`, bm25 çəkiləri, snippet, unicode61 (audit sətir 625) |
| 17 | Trigger-lər | ✅ "trigger-li aggregate cədvəllər" (audit sətir 629) |
| 8 | `notifications` | ✅ Mövcuddur — `notifications.actor_uid` (Task 5 §5.1.d sorğusu) |
| 10 | Login tarixçəsi | ✅ `security_events` uğursuz girişləri, cəhd edilən istifadəçi adını, IP/geo/UA saxlayır (`security.ts:51`) |
| 18 | İndekslər | ⚠️ Qismən — "düşünülmüş indekslər" var, lakin **tam əhatə yoxlanmayıb** → **Faza D-4** |
| 21 | Təhlükəsizlik cədvəlləri | ⚠️ Qismən — `security_events` ✅, `oauth_accounts` ✅, refresh token-lər `sessions`-da ✅, `rate_limits` **KV-də** (qəsdən — cədvəl deyil) |
| 1 | Audit sütunları | ⚠️ Qismən — `created_at` əksəriyyətdə var; `updated_at`/`deleted_at` yoxdur → **Faza D-1** |

#### 🟡 B — BU TASK-DA (ucuz, təhlükəsiz, dəyərli)

| # | Bənd | Faza | Qeyd |
|---|---|---|---|
| 1 | `updated_at`, `updated_by` sütunları | D-1 | `ALTER TABLE ADD COLUMN` — SQLite-də təhlükəsiz |
| 16 | `CHECK` konstraintləri | D-2 | ⚠️ SQLite `ALTER TABLE ADD CHECK` **dəstəkləmir** → trigger ilə emulyasiya |
| 18 | Çatışmayan indekslər | D-4 | `CREATE INDEX IF NOT EXISTS` — geri dönən, təhlükəsiz |
| 4 | Username normalizasiyası (`search_name`) | D-3 | Auditin `ə` normalizasiya problemi ilə eyni bənddir (sətir 625) |
| 19 | Parol heşləmə | C-2 | ⚠️ **Argon2id əvəzinə PBKDF2 600k** — səbəb aşağıda |

#### 🔵 C — TASK 9-a AİD

| # | Bənd | Səbəb |
|---|---|---|
| 23 | `xp_transactions` | Bu, **H-5**-in özüdür (XP anti-abuse). Audit `xp_logs` + `UNIQUE` + gündəlik tavan + kompensasiya tövsiyə edir — Task 9-un əsas bəndi |

#### 🔴 D — TASK 10-a AİD (böyük / strateji)

| # | Bənd | Niyə indi yox |
|---|---|---|
| 3 | UUIDv7 / ULID keçidi | **Bütün PK və FK-ların yenidən yazılması.** Canlı bazada, CI olmadan, 40+ cədvəldə. Həftələrlə iş, yüksək data itkisi riski |
| 2 | Soft delete (tam qəbul) | Sütun əlavəsi ucuzdur, **istifadəsi** isə hər oxu sorğusuna `WHERE deleted_at IS NULL` tələb edir. Qismən qəbul **təhlükəlidir** — filtrlənməmiş sorğu silinmiş sətri geri qaytarar. Bütöv layihə kimi edilməlidir |
| 5, 6, 7, 20 | `user_emails`, `user_socials`, `user_settings`, `profiles` ayrılması | Normalizasiya refaktoru — hər oxu yoluna, `mapUser`-ə, bütün frontend-ə toxunur |
| 11 | `user_bans` | Orta həcm; mövcud `blocked` bayrağı işləyir |
| 12 | `roles`/`permissions`/`role_permissions`/`user_roles` | Audit **PRD-nin 17 cədvəlinin heç birinin sxemdə olmadığını** qeyd edir → **strateji qərar** (Task 10) |
| 13 | `media` cədvəli | Orta həcm; R2 açarları hazırda işləyir |
| 14 | `post_blocks` | Auditin `posts_fts` yalnız ilk 300 simvol problemi ilə bağlıdır — birlikdə həll edilməlidir |
| 22 | Qlobal `activities` | `team_activity` mövcuddur; qlobal versiya yenidir |
| 24 | `daily_stats` rollup | Auditin `adminStatsDaily` 4× `COUNT(*)` tam skan problemini həll edər — dəyərli, lakin yeni funksionallıqdır |

#### ⛔ E — RƏDD EDİLİR (faktiki səhv)

**#19 — "SHA-256 istifadə etmə → Argon2id"**

İki səbəbdən olduğu kimi tətbiq edilmir:

1. **Layihə SHA-256 işlətmir.** `auth.ts:18` **PBKDF2** işlədir (SHA-256 daxili hash funksiyası kimi, 100 000 iterasiya ilə). Bu, düz parol heşi deyil — tamamilə fərqli təhlükəsizlik profilidir.
2. **Argon2id Cloudflare Workers-də mövcud deyil.** Web Crypto API onu dəstəkləmir. Yeganə yol WASM kitabxanasıdır — bu, soyuq start gecikməsi, yaddaş limiti (Workers 128 MB) və paket ölçüsü cəriməsi deməkdir. Login yolunda bu, məqbul deyil.

**Bunun əvəzinə auditin öz tövsiyəsi tətbiq olunur (M-2):**
> `PBKDF2_ITER = 600_000` (OWASP 2023); köçürmə: girişdə köhnə iterasiya ilə yoxla, uğurda yenidən heşlə (`pass_iter` sütunu əlavə et).

Bu, eyni məqsədə (baza sızarsa parol bərpasının çətinləşdirilməsi) **runtime-a uyğun** yolla çatır. Bax **Faza C-2**.

### 2.d Əhatə xəbərdarlığı

⚠️ Bu task **A**, **B** və **C** kateqoriyalarını icra edir. **D** kateqoriyasına toxunmur.

Səbəb: layihədə hələ **CI yoxdur** (Task 10). D kateqoriyasındakı hər bənd 20+ oxu yolunu dəyişir və reqressiyanı tutacaq avtomatik mexanizm mövcud deyil. Onları CI-dan **əvvəl** etmək, auditin sətir 783-dəki xəbərdarlığını təkrarlamaq olardı:

> *"Bu şəraitdə hər düzəliş yeni reqressiya riskidir və reqressiyanı tutacaq mexanizm yoxdur."*

---

## 3. ƏHATƏ — 5 FAZA

---

# FAZA A — Açıq öhdəliklərin bağlanması

**Həcm:** 0,5 gün

---

### A-1 · 🔴 `tsconfig` e2e boşluğu (BİRİNCİ BƏND)

**Mənbə:** Task 5 §10/1 · **Həcm:** 30 dəqiqə

1. Əvvəlcə mövcud xətanı düzəlt: `e2e/audit-lib.ts:18` — `Violation[]` tipi.
2. `tsconfig.json` → `include`-a `e2e/**/*.ts` əlavə et.
3. `npx tsc --noEmit` → exit 0 olana qədər qalan xətaları düzəlt.
4. ⚠️ Playwright tipləri `tsc`-də konflikt yaradarsa, ayrıca `tsconfig.e2e.json` yarat və `package.json`-a `"typecheck": "tsc --noEmit && tsc -p tsconfig.e2e.json --noEmit"` qoy.

**Niyə birinci:** bu task-ın qalan 40+ dəyişikliyinin doğrulanması `tsc`-yə güvənir.

---

### A-2 · GDPR ixracının rate limit-i Privacy-də qeyd olunsun

**Mənbə:** Task 4 §7/6 · **Həcm:** 15 dəqiqə

`GET /api/me/export` `heavy` səbətindədir (20/saat). "Məlumatlarıma çıxış" hüququnun texniki məhdudiyyəti Privacy sənədində açıqlanmalıdır.

`js/legal.js` → Privacy §5-ə **hər üç dildə** bir cümlə: ixracın texniki səbəblərdən saatda məhdud sayda mümkün olduğu.

⚠️ Task 2 §2.2 qadağası (*"LEGAL mətnlərini yenidən yazma"*) **qüvvədədir** — bu, mətnin yenidən yazılması deyil, faktiki davranışın açıqlanmasıdır. Bir cümlə ilə kifayətlən.

---

### A-3 · İstehsal bootstrap sağlamlıq yoxlaması

**Mənbə:** Task 5 §10/2 · **Həcm:** 1 saat

**Problem:** `0021` bootstrap datasını bərpa etdi, lakin heç nə gələcək təkrarın qarşısını almır. `e2e/seed-hygiene.spec.ts` lokal mühitdə tutur, **istehsalda tutmur**.

**Tələb:** `GET /api/health` (və ya mövcud endpoint-i genişləndir):
```ts
// Bootstrap sağlamlığı — AUDIT-TASK-5 §10/2.
// `general` otağı BOOTSTRAP datadır; silinsə çat çökür.
// Task 5-də bir dəfə silinib bərpa olunub — təkrarı aşkarlanmalıdır.
{
  ok: boolean,
  checks: {
    db: 'ok' | 'fail',
    bootstrap_general_room: 'ok' | 'missing',
    migrations_applied: number,
  }
}
```

⚠️ Endpoint **məlumat sızdırmamalıdır** — sətir sayı, istifadəçi adı, versiya nömrəsi qaytarma. Yalnız `ok`/`fail`. `rl: 'read'` səbətinə düşsün (Task 4-dən sonra default onsuz da tətbiq olunur).

---

### A-4 · İstehsal DB əl əməliyyatları jurnalı

**Mənbə:** Task 5 §10/3 · **Həcm:** 30 dəqiqə

**Problem:** Task 3 ilə Task 5 arasında istehsal bazasından sətirlər **əl ilə silinib** və bu heç yerdə qeydə alınmayıb.

`docs/DB-OPERATIONS-LOG.md` yarat:
```markdown
# İstehsal bazası — əl ilə aparılan əməliyyatlar jurnalı

Miqrasiyadan KƏNAR hər `INSERT`/`UPDATE`/`DELETE` bura yazılır.

| Tarix | İcraçı | Əməliyyat | Təsirlənən | Səbəb | İxrac |
|---|---|---|---|---|---|
| 2026-07-27 | ? | `team_1`, `role_1` silinməsi | ? | ? | ❌ yoxdur |
```

⚠️ Yuxarıdakı sətir **retrospektiv qeyddir** — Task 5 §10/3-də aşkarlanan, sənədləşdirilməmiş əməliyyatdır. Bilinməyən sahələri `?` ilə saxla, uydurma.

---

### A-5 · Qalan öhdəliklərin statusunun yenilənməsi

**Həcm:** 15 dəqiqə

Aşağıdakılar **kod işi deyil** — statusları hesabatda yenilə, mümkün olanları bağla:

| Öhdəlik | Əməliyyat |
|---|---|
| TestSprite API açarının rotasiyası | İstifadəçidən status soruş |
| `collabix.az` DNS + MX | İstifadəçidən status soruş |
| VÖEN, sosial profillər | İstifadəçidən status soruş |
| Hüquqi mətnin peşəkar baxışı | İstifadəçidən status soruş |
| Git remote qərarı | İstifadəçidən status soruş |
| İstehsalda p50/p95 gecikmə (Task 4 §5.3) | Ölçülə bilirsə ölç, yoxsa saxla |
| `read` sampling (Task 4 §5.5) | Qərar gözləyir — toxunma |
| E2E paylaşılan sessiya refaktoru | ⚠️ Bax A-6 |
| Atomik limiter (H-3) | Task 9 — toxunma |
| `ARCHIVE_HOT_DAYS` → `"90"` | Task 8 — toxunma |

---

### A-6 · E2E paylaşılan sessiya — qərar qapısı

**Mənbə:** Task 3 §8/1, Task 4 §7/3, Task 5 · **Həcm:** qərara görə

**Vəziyyət:** Dəst 20,9 → 26,0 → 28,8 dəqiqəyə çıxıb; `ws-flow` uğursuzluğu 2 → 6 olub. Kök səbəb: tək `AUTH_FILE`, rotasiya olunan refresh token → ~15 dəqiqədən sonra `revokeAllSessions`.

**Bu task dəstə daha çox test əlavə edəcək** → problem daha da pisləşəcək.

**İki variant:**

| Variant | Həcm | Nə vaxt |
|---|---|---|
| **(a) İndi düzəlt** — hər spec öz izolə kontekstində giriş etsin (`globalSetup` hər layihə üçün ayrı `storageState`) | +0,5 gün | Task 6-nın testləri buna **möhtacdır** |
| **(b) Ayrıca task** | — | Task 6 öz testlərini `loginAs` naxışı ilə izolə edir |

**Tövsiyə: (a).** Səbəb: bu task ~20 yeni test əlavə edir. (b) seçilsə, dəst 35+ dəqiqəyə çıxar və `ws-flow` uğursuzluqları artar — yəni Task 6-nın öz nəticələri şübhəli olar.

⚠️ **İstifadəçidən qərar istə.** (b) seçilərsə, bu task-ın bütün yeni testləri izolə identity işlətməlidir.

---

# FAZA B — Validasiya, audit və data bütövlüyü paketi

**Həcm:** 1,5 gün · **Audit ID:** M-5…M-17, L-3…L-6

Hər bənd müstəqildir. Sıra sərbəstdir, lakin **hər 3-4 bənddən sonra `tsc` + E2E** qaç.

---

### B-1 · Giriş validasiyası (M-5, M-6, M-7)

| ID | Yer | Problem | Düzəliş |
|---|---|---|---|
| **M-5** | `routes.ts:770` | `blocks` JSON ölçü limiti yoxdur → D1 sətir şişməsi, storage DoS | Hər blok üçün `clampStr(content, 5000)` + **ümumi JSON ölçüsü üçün tavan** |
| **M-6** | `team.service.ts:41` | `createTeam` `name`/`description` clamp etmir. `updateTeam` **edir** → daxili uyğunsuzluq | `clampStr(name, 80)`, `clampStr(description, 2000)` — `updateTeam`-lə **eyni** dəyərlər |
| **M-7** | `team.service.ts:141-142` | `avatar`/`banner` validasiya olunmur | URL sxemi + uzunluq yoxlaması, **yalnız `/files/` qəbul et** |

⚠️ **M-5 üçün:** ümumi tavan hesablanarkən `JSON.stringify(blocks).length` işlət, blok sayına güvənmə. 20 blok × 5000 = 100 KB — bu, D1 sətri üçün hələ də çoxdur. **Ümumi tavan 64 KB** tövsiyə olunur; mövcud ən böyük post ölçüsünü sorğu ilə yoxla və ondan aşağı düşmə.

⚠️ **M-7 üçün:** Task 7 `/files/*` avtorizasiyasını qurur. Burada yalnız **format** yoxlanılır, sahiblik yox — o, Task 7-dədir.

---

### B-2 · Məlumat sızması və görünürlük (M-9, M-10)

| ID | Yer | Problem | Düzəliş |
|---|---|---|---|
| **M-9** | `util.ts:147` + `routes.ts:486` | `mapUser` **hər istifadəçinin** `settings` obyektini yayımlayır — privacy/notification tərcihləri, `profileBonusGiven` bayrağı hər kəsə görünür | `self === false` halında `settings`-i cavabdan **çıxar** |
| **M-10** | `routes.ts:739`, `:951` | Bloklanmış istifadəçinin postları/rəyləri feed-də qalır. `publicGetPost` filtrləyir → **daxili ziddiyyət** | `feed()` və `listComments`-ə `JOIN users … WHERE blocked = 0` |

⚠️ **M-9 reqressiya riski:** frontend `settings`-i başqa istifadəçilər üçün oxuyursa (məs. "bu istifadəçi DM qəbul edirmi" yoxlaması), çıxarılması UI-nı sındırar. **Əvvəlcə yoxla:**
```bash
grep -rn "\.settings" js/ | grep -v "me\.\|self\.\|currentUser"
```
İstifadə varsa, həmin sahələri ayrıca **publik alt-obyektə** ayır (`publicSettings`), hamısını gizlətmə.

⚠️ **M-10 performans riski:** `feed()` ağır JOIN-dir (audit: "ağır JOIN/500 sətir"). Yeni JOIN indeks tələb edə bilər → **Faza D-4 ilə əlaqələndir**.

---

### B-3 · Audit izi (M-11, M-12, M-13)

| ID | Yer | Problem | Düzəliş |
|---|---|---|---|
| **M-11** | `team-routes.ts:1016-1036` | `adminTeamAction` audit log-a yazmır → admin komanda silmə/bərpa/görünürlük dəyişməsi **izsizdir** | `logAdmin(c, 'team-' + action, teamId, …)` |
| **M-12** | `routes.ts:2572` | `unlinkOAuth` **istifadəçi** əməliyyatını `admin_logs`-a yazır → admin jurnalı çirklənir | `security_events`-ə köçür |
| **M-13** | `routes.ts:1917` | `adminLogAction` **ixtiyari** log yazısına icazə verir → admin jurnalını saxtalaşdıra bilər (log forging) | `action` dəyərini **ağ siyahı** ilə məhdudlaşdır |

⚠️ **M-13 üçün:** ağ siyahını `TEAM_PERMISSIONS` naxışı ilə qur — tək mənbə, `as const` massiv, TypeScript union tipi. Etibarsız dəyər → `400` + `code: 'invalid_action'`.

⚠️ **M-11 üçün:** Task 3 §8/5 `adminTeamAction`-un ayrı yol olduğunu və toxunulmadığını qeyd edir. İndi ona **yalnız audit yazısı** əlavə olunur — avtorizasiya məntiqinə toxunma.

---

### B-4 · Əməliyyat bütövlüyü (M-14, M-15, M-8)

| ID | Yer | Problem | Düzəliş |
|---|---|---|---|
| **M-14** | `routes.ts:1693` | `adminRemoveAdmin` özünü/son admini silməyə icazə verir → **panelə çıxış itir, bərpa yolu yoxdur** | `WHERE (SELECT COUNT(*) FROM admins) > 1` + özünü silmə qadağası |
| **M-15** | `team-routes.ts:616`, `:660` | `createTeamTask.assigneeId` üzvlük yoxlanmır → istənilən platforma istifadəçisinə tapşırıq + bildiriş spam | `team_members`-də `assigneeId` yoxla |
| **M-8** | `routes.ts:66-78` | `bumpActivity` `users.activity_days` JSON-unu **read-modify-write** edir → paralel yazılarda lost update | Köhnə blob yazısını **dayandır** (client-lər `activityFor` endpoint-inə keçib) |

🔴 **M-14 ən kritikidir.** Bütün adminlər silinsə panel **bərpa olunmaz** şəkildə bağlanır. İki müdafiə qur:
1. Son admini silmə qadağası (`COUNT(*) > 1`).
2. Özünü silmə qadağası (səhvən öz-özünü çıxarma).

Xəta: `409` + `code: 'last_admin'`.

⚠️ **M-8 üçün:** blob yazısını dayandırmadan **əvvəl** təsdiqlə ki, heç bir oxu yolu ona güvənmir:
```bash
grep -rn "activity_days" worker/ js/
```
Oxu varsa, əvvəlcə oxunu `user_activity` cədvəlinə keçir, sonra yazını dayandır. Task 3 §5.2-dəki "giriş yolu ≠ qiymətləndirmə yolu" tələsinin eyni sinfidir.

---

### B-5 · Runtime davamlılığı (M-17)

**M-17** — `auth.ts:50` `hexToBytes` boş salt-da runtime xətası verir:
```ts
h.match(/.{2}/g)!    // null üzərində .map → TypeError → 500
```

**Düzəliş:** null yoxlaması + **`verifyPassword` üçün fail-closed**:
```ts
function hexToBytes(h: string): Uint8Array | null {
  const m = h.match(/.{2}/g);
  return m ? new Uint8Array(m.map((b) => parseInt(b, 16))) : null;
}
// verifyPassword: null → false (fail-closed), 500 deyil
```

⚠️ **Vacib:** `null` halında `false` qaytar, **istisna atma**. Pozulmuş sətir 500 verirsə, hücumçu hansı hesabların pozulduğunu **cavab kodundan** öyrənir (oracle).

---

### B-6 · Low tapıntılar (L-3, L-4, L-5, L-6)

| ID | Yer | Düzəliş |
|---|---|---|
| **L-3** | `team-routes.ts:914,954,966`; `team.service.ts:115` | `LIKE` naxışlarında `%`/`_` escape et. `usersDirectory` və `adminUsersList` **düzgün edir** → onların köməkçisini yenidən işlət, yenisini yazma |
| **L-4** | `routes.ts:1427` | `createReport.targetUid` varlıq yoxlaması |
| **L-5** | `routes.ts:1442` | `resolveReport` status enum-u (`clampStr(b.status, 20)` → ağ siyahı) |
| **L-6** | `team-routes.ts:894` | `getTeamActivity` `before` NaN yoxlaması. `limit` **düzgün** clamp olunur → eyni naxışı tətbiq et |

---

# FAZA C — Auth sərtləşdirmə

**Həcm:** 0,5 gün

---

### C-1 · CSRF dərinlikdə müdafiə (M-1)

**Yer:** `auth.ts:216-225`

**Nədir:** Müdafiə yalnız `SameSite=Lax` + same-origin `fetch`-ə əsaslanır. Praktiki risk aşağıdır, lakin `Authorization: Bearer` yolunun mövcudluğu (`auth.ts:259`) və gələcək cross-origin ehtiyacı bunu kövrək edir.

**Düzəliş (auditin ucuz variantı):** Mutasiya edən endpoint-lərdə `Origin` / `Sec-Fetch-Site` yoxlaması.

```ts
// CSRF dərinlikdə müdafiə — AUDIT M-1.
// SameSite=Lax əsas müdafiədir; bu, ikinci qatdır.
// Sec-Fetch-Site müasir brauzerlərdə mövcuddur; Origin fallback-dır.
// Hər ikisi yoxdursa: brauzer deyil (curl, mobil app) → Bearer token yolu tələb olunur.
```

⚠️ **Reqressiya riski yüksəkdir.** Yoxlama çox sərt olarsa:
- Mobil tətbiq / API client-lər kəsilər.
- Bəzi brauzer versiyaları `Sec-Fetch-Site` göndərmir.

**Tələb:** Əvvəlcə **yalnız log rejimində** tətbiq et (pozma halını `security_events`-ə yaz, sorğunu **bloklama**). Bir müddət sonra real bloklamaya keç. Bu, hesabatda açıq öhdəlik kimi qeyd olunsun.

---

### C-2 · PBKDF2 sərtləşdirmə (M-2) — Argon2id ƏVƏZİNƏ

**Yer:** `auth.ts:18` — `PBKDF2_ITER = 100_000`

**Kontekst:** §2.c/E-də izah olunduğu kimi, Argon2id Workers runtime-ında mövcud deyil. Auditin tövsiyəsi tətbiq olunur.

**Düzəliş — tədrici köçürmə:**

1. **Miqrasiya:** `users`-ə `pass_iter INTEGER NOT NULL DEFAULT 100000` sütunu.
   *(Task 5-in nömrələmə qaydasına uy — növbəti sərbəst nömrə.)*
2. **`PBKDF2_ITER = 600_000`** (OWASP 2023, SHA-256 üçün).
3. **Doğrulama:** `verifyPassword` **sətirdəki `pass_iter` dəyəri ilə** yoxlasın, sabitlə deyil.
4. **Yenidən heşləmə:** uğurlu girişdə `pass_iter < 600_000`-dirsə, parolu yeni iterasiya ilə yenidən heşlə və `pass_iter`-i yenilə.
5. **Yeni qeydiyyat:** həmişə 600 000.

```ts
// PBKDF2 iterasiya köçürməsi — AUDIT M-2.
// OWASP 2023: SHA-256 üçün 600 000. Köhnə hesablar 100 000 ilə yazılıb.
// Kütləvi yenidən heşləmə MÜMKÜN DEYİL (açıq parol yoxdur) → girişdə tədricən.
// pass_iter sütunu hər hesabın öz iterasiyasını saxlayır — köhnə hesablar
// köçürülənə qədər işləməyə davam edir.
```

⚠️ **Performans:** 600 000 iterasiya Workers CPU vaxtını **6× artırır**. Login yolunda CPU limitini (10–50 ms, plana görə) yoxla. Aşırsa:
- Ya iterasiyanı 300 000-də saxla (yenə 3× yaxşılaşma),
- Ya `waitUntil` ilə yenidən heşləməni cavabdan **sonraya** at.

**Ölç və hesabata yaz** — təxmin etmə.

⚠️ 🔴 **Reqressiya testi məcburidir:** köhnə (100k) və yeni (600k) hesabların **hər ikisi** giriş edə bilməlidir. Bu sınsa, bütün mövcud istifadəçilər kilidlənir.

---

# FAZA D — Sxem sərtləşdirmə

**Həcm:** 1 gün

⚠️ **SQLite/D1 məhdudiyyətləri — icradan əvvəl oxu:**

| Əməliyyat | SQLite-də | Nəticə |
|---|---|---|
| `ALTER TABLE ADD COLUMN` (nullable və ya DEFAULT ilə) | ✅ Dəstəklənir | Təhlükəsiz |
| `ALTER TABLE ADD CHECK` | ❌ **Dəstəklənmir** | Trigger ilə emulyasiya |
| `ALTER TABLE ADD FOREIGN KEY` | ❌ **Dəstəklənmir** | Cədvəlin yenidən qurulması |
| Mövcud sütunu `NOT NULL` etmək | ❌ **Dəstəklənmir** | Cədvəlin yenidən qurulması |
| `CREATE INDEX IF NOT EXISTS` | ✅ Dəstəklənir | Təhlükəsiz, geri dönən |

**Cədvəlin yenidən qurulması (12 addımlı prosedur) bu task-da EDİLMİR.** Səbəb: canlı bazada, CI olmadan, data itkisi riski ilə. Task 10.

---

### D-1 · Audit sütunları

**Sxem siyahısı #1**

**Tələb:**
1. **Əvvəlcə mövcud vəziyyəti xəritələ:**
   ```bash
   grep -n "created_at\|updated_at\|deleted_at" migrations/*.sql
   ```
   Cədvəl: hansı cədvəldə hansı sütun var.

2. **Yalnız çatışmayanları əlavə et** — və **yalnız əsas cədvəllərə**:
   ```sql
   ALTER TABLE posts    ADD COLUMN updated_at INTEGER;
   ALTER TABLE comments ADD COLUMN updated_at INTEGER;
   ALTER TABLE teams    ADD COLUMN updated_at INTEGER;
   -- …
   ```
   Nullable saxla (`NOT NULL DEFAULT` köhnə sətirlərə yanlış tarix yazar).

3. **`updated_at`-ı yazan kodu əlavə et** — sütun boş qalarsa mənasızdır. Hər `UPDATE` sorğusuna əlavə et.

⚠️ **`deleted_at` ƏLAVƏ ETMƏ.** Səbəb §2.c/D-2: sütun var, lakin oxu sorğuları filtrləmirsə, "silinmiş" sətirlər UI-da görünməyə davam edər — bu, mövcud vəziyyətdən **pisdir**, çünki developer soft delete-in işlədiyini zənn edər. Bütöv layihə kimi Task 10-da.

⚠️ **`created_by`/`updated_by`** — yalnız `uid` kontekstinin mövcud olduğu cədvəllərə əlavə et. `posts.uid` onsuz da müəllifi saxlayır; dublikat sütun yaratma.

---

### D-2 · CHECK konstraintləri — trigger emulyasiyası

**Sxem siyahısı #16**

SQLite mövcud cədvələ `CHECK` əlavə etməyə imkan vermir. **İki qatlı həll:**

**Qat 1 — tətbiq səviyyəsi (əsas müdafiə):**
Kodda `clamp` funksiyaları ilə. Bunların bir hissəsi Faza B-də onsuz da edilir (M-5, M-6).

**Qat 2 — baza səviyyəsi (trigger):**
```sql
-- CHECK emulyasiyası — SQLite ALTER TABLE ADD CHECK dəstəkləmir (AUDIT-TASK-6 §D-2).
CREATE TRIGGER IF NOT EXISTS users_xp_nonneg
BEFORE UPDATE OF xp ON users
WHEN NEW.xp < 0
BEGIN
  SELECT RAISE(ABORT, 'xp mənfi ola bilməz');
END;
```

**Tətbiq ediləcək invariantlar:**

| Cədvəl.sütun | Şərt | Səbəb |
|---|---|---|
| `users.xp` | `>= 0` | H-5 (XP) Task 9-dadır; bu, sonuncu müdafiə xəttidir |
| `users.streak` | `>= 0` | — |
| `users.age` | `>= 18` | Privacy §6 və `routes.ts` qapısı 18+ deyir (LEGAL-GAPS Q9) — **13 deyil** |
| `team_roles.priority` | `>= 0` | Task 3 §8/3 — NULL/mənfi prioritet fail-closed 403 verir |

⚠️ **`age >= 13` DEYİL.** Sxem siyahısı 13 təklif edir, lakin layihənin öz hüquqi mətni və kod qapısı **18+** tələb edir. Baza konstraintini hüquqi mətnə **uyğunlaşdır**, əks halda ziddiyyət yaranar.

⚠️ **Trigger performansı:** hər `UPDATE`-ə trigger əlavə olunur. `users.xp` tez-tez yenilənir — ölç. Ölçülə bilən yavaşlama varsa, yalnız tətbiq qatında saxla və hesabatda əsaslandır.

---

### D-3 · Username / axtarış normalizasiyası

**Sxem siyahısı #4 + audit sətir 625**

Audit qeyd edir:
> **`ə` hərfi normalizasiya olunmur** (migration-ın özündə qeyd olunub) — Azərbaycan dilli platforma üçün **ciddi**.

Yəni `Təhməz` axtarışı `Tehmez` yazılışını tapmır və əksinə.

**Tələb:**
1. `users`-ə `search_name TEXT` sütunu (normallaşdırılmış: kiçik hərf, diakritiksiz, `ə→e`, `ı→i`, `ö→o`, `ü→u`, `ç→c`, `ş→s`, `ğ→g`).
2. Yazı yollarında (`register`, `updateProfile`) doldur.
3. **Mövcud sətirlər üçün backfill** — miqrasiyada `UPDATE`.
4. `users_fts`-ə əlavə et və ya axtarış sorğusunda işlət.

⚠️ **FTS reqressiya riski:** `users_fts` mövcuddur və işləyir. Onu **yenidən qurma** — yalnız yeni sütunu əlavə et. FTS cədvəlinin yenidən qurulması indeks itkisi riskidir.

⚠️ Normalizasiya funksiyası **həm yazı, həm sorğu tərəfində eyni** olmalıdır. Fərqli olsa axtarış heç nə tapmaz. Tək köməkçi funksiya yaz, hər iki yerdə çağır.

---

### D-4 · Çatışmayan indekslər

**Sxem siyahısı #18**

**Tələb — təxminlə deyil, ölçü ilə:**

1. **Mövcud indeksləri sadala:**
   ```sql
   SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' ORDER BY tbl_name;
   ```

2. **Ağır sorğuları müəyyən et.** Auditin sadaladıqları:
   - `feed()` — "ağır JOIN/500 sətir"
   - `adminStatsDaily` — "4 × `COUNT(*)` tam skan"
   - `room_messages` / `dm_messages` keyset paginasiyası

3. **Hər biri üçün `EXPLAIN QUERY PLAN`** işlət. `SCAN TABLE` görünürsə indeks çatışmır.

4. **Yalnız sübutlanmış ehtiyacları əlavə et:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_room_messages_room_created ON room_messages(room_id, created_at);
   CREATE INDEX IF NOT EXISTS idx_notifications_receiver     ON notifications(receiver_uid, created_at);
   -- …yalnız EXPLAIN QUERY PLAN sübut etdiklərini
   ```

⚠️ **Kor-koranə indeks əlavə etmə.** Hər indeks yazı əməliyyatını yavaşladır və storage tutur. Sxem siyahısının 6 indeksindən bəziləri **artıq mövcud** ola bilər.

⚠️ **Faza B-2 (M-10) ilə əlaqə:** `feed()`-ə `JOIN users … WHERE blocked = 0` əlavə edilir → `users(blocked)` indeksi lazım ola bilər. `EXPLAIN` ilə yoxla.

---

# FAZA E — Doğrulama

**Həcm:** 0,5 gün

---

### E-1 · Test dəsti

Hər Medium/Low üçün **ən azı bir** test. Qruplaşdır:

```ts
test.describe('AUDIT-6 — validasiya paketi @audit6', () => {
  // M-5: nəhəng blocks JSON rədd olunur
  // M-6: nəhəng komanda adı clamp olunur
  // M-7: xarici URL avatar rədd olunur
  // M-9: başqa istifadəçinin settings-i cavabda YOXDUR
  // M-10: bloklanmış istifadəçinin postu feed-də YOXDUR
  // M-13: ağ siyahıdan kənar admin log action → 400
  // M-14: 🔴 son admin silinə bilmir → 409 + code:'last_admin'
  // M-14: admin özünü silə bilmir → 409
  // M-15: komanda üzvü olmayana tapşırıq təyin edilə bilmir → 400/403
  // L-4: mövcud olmayan istifadəçiyə şikayət → 404
  // L-5: etibarsız report statusu → 400
  // L-6: before=NaN → düzgün emal
});

test.describe('AUDIT-6 — auth sərtləşdirmə @audit6', () => {
  // 🔴 C-2 REQRESSİYA: köhnə (100k) hesab giriş edə bilir
  // 🔴 C-2 REQRESSİYA: yeni (600k) hesab giriş edə bilir
  // C-2: uğurlu girişdən sonra pass_iter 600000-ə yenilənir
  // M-17: pozulmuş salt → 401, 500 DEYİL
});

test.describe('AUDIT-6 — sxem @audit6', () => {
  // D-2: mənfi xp → rədd
  // D-3: 'Təhməz' axtarışı 'Tehmez' yazılışını tapır (və əksinə)
  // A-3: /api/health bootstrap yoxlamasını qaytarır
});
```

⚠️ **İzolyasiya:** A-6-nın nəticəsindən asılı olaraq — variant (a) seçilibsə standart naxış; (b) seçilibsə hər test öz identity-si ilə.

---

### E-2 · Faza sonu yoxlamaları

Hər fazadan sonra **məcburi**:
```bash
npx tsc --noEmit          # A-1-dən sonra e2e/ də daxildir
npm run build
npm run check:migrations   # Task 5-dən
npx playwright test
```

Faza yaşıl olmadan növbətiyə **keçmə**.

---

## 4. ƏHATƏDƏN KƏNAR

| Bənd | Aid | Səbəb |
|---|---|---|
| M-3 CSP `style-src 'unsafe-inline'` | **Task 10** | 179 KB CSS köçürülməsi |
| M-4 RoomDO hibernation state | **Task 9** | DO işi |
| C-1 `serveFile` avtorizasiyası | **Task 7** | — |
| C-3 arxiv oxu yolu | **Task 8** | — |
| H-3 atomik limiter, H-5 XP, H-6 WS re-auth | **Task 9** | — |
| Sxem #23 `xp_transactions` | **Task 9** | H-5-in özüdür |
| Sxem #3 UUIDv7 | **Task 10** | Bütün PK/FK yenidən yazılması |
| Sxem #2 soft delete (tam) | **Task 10** | Hər oxu yoluna toxunur |
| Sxem #5,6,7,20 normalizasiya | **Task 10** | `mapUser` + frontend refaktoru |
| Sxem #11 `user_bans`, #13 `media`, #14 `post_blocks`, #22, #24 | **Task 10** | Yeni funksionallıq |
| Sxem #12 RBAC cədvəlləri | **Task 10** | Strateji qərar (PRD-nin 17 cədvəli) |
| Sxem #19 Argon2id | ⛔ **Rədd** | Workers-də mövcud deyil → C-2 əvəzləyir |
| FK əlavəsi / cədvəl yenidən qurulması | **Task 10** | Task 5 §10/5 — 17 cədvəldə FK yox |
| CI/CD | **Task 10** | — |

---

## 5. İCRA QAYDALARI

### 5.1 Faza-faza icra

Hər faza **ayrıca commit qrupudur**. Faza yaşıl olmadan növbətiyə keçmə. Bu, 40+ dəyişikliyin hansının sındırdığını tapmağı mümkün edir.

### 5.2 🔴 Üç reqressiya tələsi

| Bənd | Tələ | Qoruma |
|---|---|---|
| **C-2** (PBKDF2) | Köhnə hesablar kilidlənə bilər | Hər iki iterasiya üçün giriş testi — **məcburi** |
| **M-9** (settings) | Frontend başqasının `settings`-ini oxuyursa UI sınar | Əvvəlcə `grep`, lazımsa `publicSettings` ayır |
| **M-8** (activity_days) | Oxu yolu hələ blob-a güvənirsə data itkisi | Əvvəlcə oxunu köçür, sonra yazını dayandır |

Üçü də Task 3 §5.2-dəki **"giriş yolu ≠ qiymətləndirmə yolu"** tələsinin eyni sinfidir.

### 5.3 Miqrasiya nizamı

Task 5 qaydaları **qüvvədədir**:
- Tətbiq olunmuş miqrasiya **dəyişdirilmir, adı dəyişmir**.
- Bir nömrə = bir fayl; `npm run check:migrations` yaşıl olmalıdır.
- Hər miqrasiya idempotent.

Bu task 3 miqrasiya yaradır: `pass_iter` (C-2), audit sütunları + CHECK trigger-ləri (D-1, D-2), `search_name` + indekslər (D-3, D-4). **Ayrı-ayrı fayllar** — birləşdirmə.

### 5.4 Sxem siyahısına münasibət

24 bəndlik siyahı **dəyərli girişdir**, lakin §2.c-dəki triyaj bağlayıcıdır. Agent kimi:
- A kateqoriyasını **qurma** — mövcudluğunu təsdiqlə və hesabata yaz.
- D kateqoriyasına **toxunma** — Task 10-a ötür.
- E kateqoriyasını **tətbiq etmə** — C-2 onu əvəzləyir.

Triyaja etiraz edərsənsə, hesabatda əsaslandır — sükutla kənara çıxma.

---

## 6. QƏBUL MEYARLARI

### Faza A
| # | Meyar | Doğrulama |
|---|---|---|
| 1 | 🔴 `tsc` e2e/-i yoxlayır | `tsconfig.json` `include` + exit 0 |
| 2 | `/api/health` bootstrap yoxlaması | `GET /api/health` |
| 3 | DB əməliyyat jurnalı mövcuddur | `docs/DB-OPERATIONS-LOG.md` |
| 4 | GDPR ixrac limiti Privacy-də | 3 dildə |
| 5 | Öhdəlik statusları yenilənib | hesabat §7 |

### Faza B
| # | Meyar | Doğrulama |
|---|---|---|
| 6 | M-5…M-17 hamısı bağlı (13 bənd) | hər biri üçün test |
| 7 | L-3…L-6 bağlı (4 bənd) | hər biri üçün test |
| 8 | 🔴 M-14: son admin silinmir | `409` + `code:'last_admin'` |
| 9 | 🔴 M-9: `settings` sızmır | başqasının profili → sahə yox |
| 10 | M-10: bloklanmış məzmun feed-də yox | — |

### Faza C
| # | Meyar | Doğrulama |
|---|---|---|
| 11 | 🔴 Köhnə (100k) hesab giriş edir | E2E |
| 12 | 🔴 Yeni (600k) hesab giriş edir | E2E |
| 13 | `pass_iter` girişdə yenilənir | DB sorğusu |
| 14 | Login CPU limitini aşmır | ölçülüb, hesabatda |
| 15 | M-1 log rejimində işləyir | `security_events` |

### Faza D
| # | Meyar | Doğrulama |
|---|---|---|
| 16 | Audit sütunları əlavə edilib **və doldurulur** | `UPDATE`-dən sonra `updated_at` dolu |
| 17 | CHECK trigger-ləri işləyir | mənfi `xp` → rədd |
| 18 | `age` konstraintі **18**-dir | hüquqi mətnə uyğun |
| 19 | `ə` normalizasiyası hər iki istiqamətdə | axtarış testi |
| 20 | İndekslər `EXPLAIN` ilə əsaslandırılıb | hesabatda plan |
| 21 | `deleted_at` **ƏLAVƏ EDİLMƏYİB** | qəsdən — §D-1 |

### Ümumi
| # | Meyar | Doğrulama |
|---|---|---|
| 22 | 🔴 Tam E2E dəsti sınmır | Task 5 nəticəsi ≥ |
| 23 | `tsc --noEmit` exit 0 | worker/ + e2e/ |
| 24 | `npm run build` exit 0 | — |
| 25 | `npm run check:migrations` yaşıl | — |
| 26 | Miqrasiyalar idempotentdir | 2× tətbiq |

**Meyar 11, 12 və ya 22 ❌ olarsa:** dərhal `git revert` — bunlar kütləvi kilidlənmə göstəriciləridir.

---

## 7. HESABAT FORMATI

`docs/AUDIT-TASK-6-REPORT.md`:

```markdown
# AUDIT-TASK-6 — İcra Hesabatı

**Tarix:** …   **İcraçı:** …   **Commit-lər:** <faza üzrə qruplaşdırılmış>

## 1. Faza A — açıq öhdəliklər
| Öhdəlik | Mənbə | Vəziyyət | Qeyd |

## 2. Faza B — validasiya paketi
| ID | Yer | Düzəliş | Test | Vəziyyət |
| M-5 | routes.ts:770 | … | … | ✅ |
| … 17 sətir … |

## 3. Faza C — auth sərtləşdirmə
### C-2 PBKDF2 ölçmələri
| Göstərici | 100k | 600k |
| Login CPU (ms) | … | … |
| Plan limiti | … | … |
→ Qərar: <600k / 300k — əsaslandırma>

## 4. Faza D — sxem
### D-1 Audit sütunları
| Cədvəl | Əlavə edilən | Dolduran kod |
### D-2 CHECK trigger-ləri
| İnvariant | Trigger | Performans təsiri |
### D-3 Normalizasiya
### D-4 İndekslər — EXPLAIN QUERY PLAN sübutları
| Sorğu | Əvvəl | Sonra | İndeks |

## 5. 24 bəndlik sxem siyahısının statusu
| # | Bənd | Kateqoriya | Vəziyyət | Ünvan |
| 1 | Audit sütunları | B | ✅ qismən | D-1 |
| 3 | UUIDv7 | D | ⏭️ təxirə | Task 10 |
| 9 | sessions | A | ✅ mövcuddur | doğrulandı |
| 19 | Argon2id | E | ⛔ rədd | C-2 əvəzlədi |
| … 24 sətir …|

## 6. Qəbul meyarları (26 sətir)

## 7. Aşkarlanan yeni risklər

## 8. Açıq qalan öhdəliklər
- [ ] 🔴 Atomik limiter (H-3) → Task 9
- [ ] 🔴 `ARCHIVE_HOT_DAYS` → `"90"` → Task 8
- [ ] 🔴 Hüquqi mətnin peşəkar baxışı
- [ ] 🟠 M-1 log rejimindən bloklamaya keçid
- [ ] <A-5-dən qalanlar>
- [ ] <Task 10-a ötürülən 11 sxem bəndi>

## 9. Geri qaytarma planı
| Faza | Commit | Revert | Data təsiri |
| C-2 | … | `git revert` | ⚠️ `pass_iter` sütunu qalır (zərərsiz) |
| D | … | `git revert` | ⚠️ Miqrasiya geri qayıtmır — sütunlar qalır |
```

---

## 8. BİRİNCİ ADDIM

### Addım 1 — dərhal icra et
**A-1** (`tsconfig` e2e boşluğu). Bu, qalan hər şeyin doğrulanmasının şərtidir. Nəticəni bildir: neçə yeni `tsc` xətası çıxdı və hansıları.

### Addım 2 — yalnız oxu, sonra təqdim et
1. `grep -n "created_at\|updated_at\|deleted_at" migrations/*.sql` → audit sütunları xəritəsi
2. `SELECT name, tbl_name FROM sqlite_master WHERE type='index'` → mövcud indekslər
3. `grep -rn "\.settings" js/` → M-9 reqressiya riski
4. `grep -rn "activity_days" worker/ js/` → M-8 oxu asılılığı
5. `auth.ts:14-60` → PBKDF2 və `hexToBytes` mövcud vəziyyəti

### Addım 3 — istifadəçidən qərar istə
| Sual | Variant |
|---|---|
| **A-6** — E2E sessiya refaktoru | (a) indi, +0,5 gün · (b) ayrıca task |
| **A-5** — 5 xarici öhdəliyin statusu | rotasiya / DNS / VÖEN / hüquqi baxış / git remote |
| **§2.c triyajı** | təsdiq / etiraz |

**Dayanma şərtləri:**

| Şərt | Əməliyyat |
|---|---|
| A-1-dən sonra `tsc` **çox sayda** xəta verirsə (>20) | Dayan, siyahı təqdim et — ayrıca task ola bilər |
| C-2 login CPU-su plan limitini aşırsa | Dayan, ölçməni təqdim et, iterasiya sayı üçün qərar istə |
| M-9 `grep`-i frontend asılılığı göstərirsə | Dayan, `publicSettings` ayrımı üçün təsdiq istə |

Cavablar hazır olduqdan sonra **faza-faza** icraya başla — hər fazadan sonra tam E2E.
