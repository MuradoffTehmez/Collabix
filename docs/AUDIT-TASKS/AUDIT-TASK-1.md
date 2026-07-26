# AUDIT-TASK-1 — Sıfır-Risk Blokerlər və Repo Təmizliyi

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md`
**Bağlanan tapıntılar:** C-2 (Critical), H-2 (High), C-3 zərər azaltması (Critical), M-16 (Medium), L-1 (Low), struktur borcu #3 və #14
**Təxmini həcm:** 3 saat (sızma aşkarlansa +2 saat)
**Ön şərt:** yoxdur — bu, zəncirin ilk task-ıdır
**Blokladığı task:** heç biri (Task 2–10 paralel başlaya bilər, lakin bu task buraxılış blokeridir)

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-1  Sıfır-risk blokerləri bağla: legacy/ sil (53 açıq mətnli parol),
               /api/admin/admins-ə admin qapısı qoy, arxiv silməsini dayandır,
               .gitignore düzəlt, ölü faylları təmizlə.
               DONE: tsc exit 0 + E2E yaşıl + repoda açıq sirr yoxdur + admin endpoint 403.
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli təhlükəsizlik mühəndisisən**. Bu task-da sənin işin **yeni kod yazmaq deyil** — mövcud kod bazasındakı açıq qapıları bağlamaq, sirləri təmizləmək və gecikməli data itkisini dayandırmaqdır.

Davranış qaydan: **hər dəyişiklik sübutla əsaslandırılır, hər geri dönməz əməliyyat əvvəlcə yoxlanılır.** Şübhə varsa icra etmə — hesabat ver.

---

## 2. KONTEKST

Collabix — Cloudflare Workers üzərində qurulmuş sosial/komanda platformasıdır:

| Qat | Texnologiya | Miqyas |
|---|---|---|
| Backend | Cloudflare Worker (TypeScript, strict) | 171 route, regex dispatch cədvəli |
| Database | D1 (SQLite) | 19 migration, 40+ cədvəl, FTS5 × 3 |
| Storage | R2 | `avatars/`, `posts/`, `msgfiles/`, `teams/`, `archive/` |
| Cache/KV | KV | rate-limit, oauth state, magic token, mfa challenge |
| Realtime | Durable Objects | `RoomDO`, `PresenceDO` |
| Async | Queues + Workflows + Cron | `collabix-tasks` + DLQ, `17 3 * * *` |
| Frontend | Vanilla JS ESM + Vite | 27 modul, 3 dil (az/en/ru) |

2026-07-26 tarixli sərt audit hökmü: **istehsala hazır DEYİL.** Funksional mövcudluq ≈85%, istehsala hazırlıq ≈62%.

**Kod bazasının güclü tərəfi — pozma:** auth infrastrukturu (PBKDF2 + rotasiyalı refresh + reuse detection + TOTP + OAuth×3 + magic link), fayl yükləmə validasiyası (magic byte sniff + piksel bomb qoruması), təhlükəsizlik telemetriyası və **kodda "niyə" izah edən şərh mədəniyyəti** auditdə "nümunəvi" qiymətləndirilib. Bunlara toxunma.

**Bu task-ın həll etdiyi problem:** auditin ən ucuz, lakin ən yüksək risk daşıyan tapıntıları. Cəmi 3 saatlıq iş iki buraxılış blokerini bağlayır və bir sükutlu data itkisini dayandırır.

---

## 3. ƏHATƏ — 8 BƏND

---

### 1.1 · `/api/admin/admins` admin qapısı olmadan açıqdır

**Audit ID:** H-2 · **Risk:** High · **Həcm:** 5 dəqiqə + test

**Yer:** `worker/index.ts:174`

**Nədir:**
```ts
{ method: 'GET', pattern: /^\/api\/admin\/admins$/, handler: R.adminListAdmins, auth: true },
//                                                                              ^^^ `admin: true` YOXDUR
```

Qonşu **32** admin route-unun hamısında `admin: true` bayrağı var. Handler-in özündə də (`worker/routes.ts:1683`) `isAdmin` yoxlaması yoxdur. Bu, dizayn qərarı deyil — **açıq nəzarətsizlikdir**, çünki yeganə istehlakçı `js/admin.js:967` (admin paneli) admin kimi çağırır.

**Təsir:** Giriş etmiş **istənilən** istifadəçi bütün admin `user_id`-lərini sadalaya bilir. `/api/users` onsuz da `uid → username` xəritəsi verdiyi üçün nəticə birbaşa **"kimi hədəfləməli" siyahısıdır**: parol hücumu, sosial mühəndislik, phishing.

**Tələb:**

1. Route cədvəlinə `admin: true` əlavə et:
   ```ts
   { method: 'GET', pattern: /^\/api\/admin\/admins$/, handler: R.adminListAdmins, auth: true, admin: true },
   ```

2. **Defense-in-depth** — handler-in özündə də qapı qur (`worker/routes.ts:1683`):
   ```ts
   export async function adminListAdmins(c: Ctx) {
     // Route cədvəlində `admin: true` var, lakin bu qapı bir dəfə səhvən silinmişdi (AUDIT H-2).
     // Handler səviyyəsində təkrar yoxlama şüurlu dublikatdır — cədvəl dəyişikliyi bunu sındırmasın.
     if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden');
     …
   }
   ```

3. **Auditi genişləndir** — bütün 171 route-u yoxla:
   ```bash
   grep -n "api/admin" worker/index.ts | grep -v "admin: true"
   ```
   Nəticədə başqa qapısız admin route çıxsa: **bu task-da düzəltmə**, yalnız hesabata siyahıla. Səbəb: əhatə dəyişikliyi ayrıca qərar tələb edir.

4. Eyni məntiqlə handler-lərin `c.isAdmin` yoxlamasız olduğu digər halları da qeyd et (düzəltmədən).

---

### 1.2 · Arxiv silinməsinin dərhal dayandırılması

**Audit ID:** C-3 (zərər azaltması) · **Risk:** Critical · **Həcm:** 5 dəqiqə

**Yerlər:** `wrangler.jsonc:55` (`ARCHIVE_HOT_DAYS: "90"`), `wrangler.jsonc:104` (cron `17 3 * * *`), `worker/archive.ts:88` (silmə), `worker/archive.ts:127` (`readArchive`)

**Nədir:** Gündəlik cron 90 gündən köhnə `room_messages` və `dm_messages` sətirlərini R2-yə yazır və **D1-dən SİLİR**. Oxu funksiyası `readArchive()` yazılıb, lakin:
```bash
grep -rn "readArchive" worker/ js/   →   worker/archive.ts:127 (yalnız tərif)
```
Nə API endpoint-i, nə UI-da "daha köhnə mesajları yüklə" düyməsi var. `roomMessages` (`routes.ts:1117`) yalnız D1-dən `LIMIT 120` oxuyur.

**Təsir:** Deploy-dan 90 gün sonra istifadəçilər mesaj tarixçəsini **itirmiş görəcək**. Data R2-də qalır (fiziki itki yoxdur), lakin məhsul vasitəsilə bərpa edilə bilməz. Sükutlu, gecikməli və istifadəçi üçün geri dönməz. GDPR ixracı (`exportMyData`, `routes.ts:1935`) da yalnız D1-dən oxuyur → ixrac arxivi əhatə etmir.

**Tələb:**

`wrangler.jsonc:55`-i dəyiş və **şərh məcburidir**:
```jsonc
// ⚠️ MÜVƏQQƏTİ (AUDIT-TASK-1 / C-3): arxiv OXU yolu qurulmayıb, ona görə D1-dən
// silmə dayandırılıb. readArchive() yazılıb, amma heç yerdən çağırılmır —
// silinən mesajı məhsul daxilində bərpa etmək MÜMKÜN DEYİL.
// AUDIT-TASK-8 tamamlandıqdan sonra "90"-a QAYTARILMALIDIR.
// Qaytarılmadan buraxılış = arxiv cədvəlinin sonsuz böyüməsi + D1 storage xərci.
"ARCHIVE_HOT_DAYS": "3650",
```

**Qadağalar:**
- ❌ Cron-u söndürmə — yazı yolu düzgün işləyir və `archive.spec.ts` onu test edir. Yalnız pəncərəni genişləndirirsən.
- ❌ `archive.ts`-də kod dəyişikliyi etmə.
- ❌ Arxiv oxu endpoint-i yazma — o, **Task 8**-dir.

**Öhdəlik izləmə:** Bu geri qaytarma öhdəliyi hesabatın §4 bölməsində checkbox kimi qeyd olunmalıdır.

---

### 1.3 · `legacy/` — 53 istifadəçinin açıq mətnli parolu

**Audit ID:** C-2 · **Risk:** Critical · **Həcm:** 1 saat (sızma varsa +2 saat)

**Yer:** `legacy/` (2,1 MB), kritik fayl: `legacy/firebase/.emulator-data/auth_export/accounts.json` (27,5 KB)

**Nədir:** Firebase emulator export formatı parolu **şifrələnməmiş** saxlayır:
```json
"passwordHash": "fakeHash:salt=fakeSalt…:password=<AÇIQ MƏTN>",
"providerUserInfo": [{ "providerId": "password", "email": "<...>@collabix.app" }]
```

**Doğrulanmış say:** 53 `localId`, 53 `password=…`, 53 unikal email. Eyni 53 istifadəçi `migration-cf/import.sql`-də `pass_hash` ilə mövcuddur — yəni bunlar **real istifadəçilərdir**, sintetik fixture deyil.

**Təsir:** 53 real hesabın email + parol cütü. Parol təkrar-istifadəsi nəzərə alınarsa təsir Collabix-dən kənara çıxır (email, bank, sosial şəbəkə). `.gitignore`-da `.emulator-data/` qaydası var, yəni ehtimalən git-ə düşməyib — **lakin fayl diskdə, layihə qovluğunda durur və backup / bulud sinxronizasiyası / arxiv paylaşımı riski altındadır.**

**İcra — bu sıra ilə, addım atlanmadan:**

#### Addım 1 — Asılılıq yoxlaması (silmədən əvvəl MƏCBURİ)

```bash
git grep -n "legacy/"            -- ':!legacy/' ':!*.md'
git grep -n "client-firebase"    -- ':!legacy/'
git grep -n "firestore"          -- ':!legacy/' ':!*.md'
```

- **Nəticə boşdursa** → davam et.
- **Nəticə boş deyilsə** → **DAYAN.** Tapıntını hesabata yaz, silmə. İşlək kod hələ legacy-dən asılıdır və bu, ayrıca qərar tələb edir.

#### Addım 2 — Sızma yoxlaması (hadisə aşkarlaması)

```bash
git log --all --oneline -- "legacy/firebase/.emulator-data/*"
git log --all --oneline -- "legacy/firebase/migration/serviceAccountKey.json"
git log --all -S "password=" --oneline -- "legacy/*"
```

| Nəticə | Təsnifat | Əməliyyat |
|---|---|---|
| Üçü də boş | Sızma yoxdur | Sadəcə sil, davam et |
| Hər hansı biri nəticə verir | **TƏHLÜKƏSİZLİK HADİSƏSİ** | Silmə kifayət etmir → aşağı bax |

**Hadisə halında:**
- Hesabatda **qırmızı** bənd: *"53 hesaba məcburi parol sıfırlama tələb olunur"*.
- Ayrıca task aç: `adminBulkUsers` + `must_reset_password = 1` sütunu + istifadəçi bildirişi.
- Git tarixçəsinin təmizlənməsi (`git filter-repo` / BFG) və force-push qərarı **repo sahibinə aiddir** — sən yalnız aşkarlayır və tövsiyə edirsən.
- ⚠️ Bu axını **bu task-da icra etmə** — əhatədən kənardır. Aşkarla və eskalasiya et.

#### Addım 3 — Arxivləmə (geri dönməzlik qoruması)

Silmədən əvvəl repodan **kənar** yerə köçür:
```bash
# repo qovluğundan KƏNARDA icra et
tar -czf ../collabix-legacy-archive-$(date +%Y%m%d).tar.gz legacy/
```
PowerShell:
```powershell
Compress-Archive -Path .\legacy\ -DestinationPath ..\collabix-legacy-archive-$(Get-Date -f yyyyMMdd).zip
```

Sonra **arxivin içindən də** parol faylını sil (arxiv yalnız Firebase konfiqurasiyası üçün saxlanılır, parollar üçün yox) və ya arxivi şifrələ.

Hesabatda arxivin **tam yolunu yazma** — yalnız təsviri qeyd et (məs. "repo-dan kənar şifrələnmiş yerdə").

#### Addım 4 — Silmə

```bash
git rm -r --cached legacy/ 2>/dev/null || true
rm -rf legacy/
```
PowerShell:
```powershell
Remove-Item -Recurse -Force .\legacy\
```

#### Addım 5 — Doğrulama

```bash
test ! -d legacy && echo "OK: legacy/ silinib"
git grep -rn "password=" -- ':!*.md'          # → boş olmalıdır
git status --porcelain | head -20              # silinmiş fayllar görünməlidir
```

---

### 1.4 · `testsprite_tests/` — API açarı və docs dublikatı

**Audit ID:** M-16 · **Risk:** Medium (açar səbəbindən praktikada High) · **Həcm:** 15 dəqiqə

**Yerlər:**
- `testsprite_tests/tmp/config.json` — **`API_KEY` daxildir**
- `testsprite_tests/tmp/prd_files/` — `docs/`-un **tam dublikatı**, mojibake adlarla (`Tam Ä°cra PlanÄ±.md`)

**Nədir:** `.gitignore:20`-dəki qayda backslash ilə yazılıb (`testsprite_tests\tmp\config.json`) və bu səbəbdən **heç vaxt işləməyib** — Git yalnız forward slash tanıyır. Yəni açar faylı ignore edilmiş sayılırdı, əslində isə deyildi.

Dublikat `prd_files/` isə axtarış nəticələrini çirkləndirir: `grep` ilə sənəd axtaranda hər nəticə iki dəfə çıxır və mojibake versiyası hansının aktual olduğunu qeyri-müəyyən edir.

**Tələb:**

1. Açarın git-ə düşüb-düşmədiyini yoxla:
   ```bash
   git log --all --oneline -- "testsprite_tests/tmp/config.json"
   git log --all -S "API_KEY" --oneline
   ```

2. Qovluğu tamamilə sil:
   ```bash
   git rm -r --cached testsprite_tests/ 2>/dev/null || true
   rm -rf testsprite_tests/
   ```

3. **Açarı rotasiya et — git nəticəsindən ASILI OLMAYARAQ.** Fayl aylarla diskdə açıq qalıb; sızma ehtimalı sıfır deyil. Rotasiya provayder panelindən edilir (kod dəyişikliyi deyil) → hesabatda `edildi / gözləyir` kimi işarələ.

---

### 1.5 · `.gitignore` qaydalarının düzəldilməsi

**Audit ID:** M-16 · **Risk:** Medium · **Həcm:** 10 dəqiqə

**Yer:** `.gitignore:20` və ətrafı

**Sınıq qaydalar:**

| Hazırkı qayda | Problem |
|---|---|
| `testsprite_tests\tmp\config.json` | **Backslash** → Git tanımır → qayda heç vaxt işləməyib |
| `migration/serviceAccountKey.json` | Yalnız kök `migration/`-ə şamil olunur; `legacy/firebase/migration/`-i tutmur |
| `legacy/` qaydası yoxdur | 2,1 MB + 53 parol izlənə bilərdi |

**Tələb — bu bloku əlavə et / mövcud sınıq sətirləri əvəzlə:**

```gitignore
# ─── Sirlər: heç bir halda commit edilməməlidir (AUDIT M-16) ───
# Qeyd: Git YALNIZ forward slash tanıyır. Backslash ilə yazılan qayda
# sükutla işləmir — əvvəlki `testsprite_tests\tmp\config.json` qaydası buna nümunə idi.
**/serviceAccountKey.json
**/.emulator-data/
**/auth_export/
**/*.pem
**/*.key
testsprite_tests/

# ─── Köhnəlmiş / artefakt (AUDIT struktur borcu #3) ───
legacy/
.claude/skills/run-collabix/shots/
```

**Doğrulama — qaydanın işlədiyini SÜBUT ET:**
```bash
git check-ignore -v testsprite_tests/tmp/config.json
git check-ignore -v legacy/firebase/.emulator-data/auth_export/accounts.json
git check-ignore -v .claude/skills/run-collabix/shots/test.png
```
Hər üçü uyğun qayda sətrini göstərməlidir. Göstərməyən varsa qayda səhvdir — düzəlt və yenidən yoxla.

---

### 1.6 · Ölü faylların silinməsi

**Audit ID:** struktur borcu #3, #14 · **Risk:** Low (qarışıqlıq) · **Həcm:** 20 dəqiqə

| Fayl | Səbəb | Əməliyyat |
|---|---|---|
| kök `sitemap.xml` | **Ölü kod** — `worker/index.ts:352-353` onu D1-dən dinamik generasiya ilə əvəzləyir | Sil |
| kök `robots.txt` | Eyni səbəb + **domen ziddiyyəti**: fayl `collabix.app` yazır, `worker/seo.ts:6` isə `collabix.muradofftehmez01.workers.dev` | Sil |
| `.claude/skills/run-collabix/shots/*.png` (860 KB) | Skrinşot artefaktları | Cache-dən çıxar (1.5-də ignore edildi) |

**Silmədən əvvəl MƏCBURİ sübut:**

1. `worker/index.ts:350-355` sətirlərini oxu və Worker-in bu iki yolu həqiqətən idarə etdiyini təsdiqlə.
2. `vite.config.ts` və `public/` konfiqurasiyasını yoxla — bu fayllar `dist/`-ə kopyalanırmı?
   ```bash
   grep -n "robots\|sitemap\|publicDir" vite.config.ts
   ```
   Kopyalanırsa: **əvvəlcə konfiqurasiyanı düzəlt, sonra sil.** Əks halda build sınar.

**Silmə:**
```bash
git rm sitemap.xml robots.txt
git rm -r --cached .claude/skills/run-collabix/shots/ 2>/dev/null || true
```

**Qadağa:** ❌ Domen vahidləşdirilməsini (`seo.ts:6` ORIGIN dəyərinin dəyişdirilməsi) bu task-da **etmə** — o, **Task 2**-dir. Burada yalnız ölü faylı silirsən, canlı konfiqurasiyaya toxunmursan.

---

### 1.7 · `X-XSS-Protection` başlığının çıxarılması

**Audit ID:** L-1 · **Risk:** Low · **Həcm:** 5 dəqiqə

**Yer:** `worker/index.ts:325`

**Nədir:** Başlıq köhnəlmişdir. Chrome və Edge XSS Auditor-u tamamilə çıxarıb, Firefox heç vaxt tətbiq etməyib. Bəzi köhnə mühitlərdə isə auditor-un özü **yan-kanal informasiya sızması** vektoru yaradırdı — məhz buna görə silindi.

Collabix-də əsas müdafiə onsuz da düzgün qurulub: `script-src 'self'` (nonce-suz, `unsafe-inline`-siz) + `js/util.js:14`-dəki `el()` DOM builder-i + DOMPurify.

**Tələb:** yalnız `X-XSS-Protection` sətrini sil.

**Qadağa — bu başlıqlara TOXUNMA:**
`Strict-Transport-Security` (preload ilə), `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy`, `Content-Security-Policy`, `frame-ancestors 'none'`, `X-Content-Type-Options`. Auditdə bu dəst "nümunəvi" qiymətləndirilib.

> **Qeyd:** `CSP: style-src 'unsafe-inline'` (M-3) auditdə ayrıca tapıntıdır və **bu task-a daxil deyil** — `styles.css` 179 KB olduğu üçün inline stillərin köçürülməsi böyük işdir (Task 10).

---

### 1.8 · Yekun repo gigiyenası

**Həcm:** 5 dəqiqə

1. Silinmiş qovluqlara istinad qalıbmı:
   ```bash
   git grep -n "legacy\|testsprite" -- ':!*.md' ':!.gitignore'
   ```
   `package.json` script-lərində, `tsconfig.json` `include/exclude`-unda, `playwright.config.ts`-də, `.dockerignore`-da qalıq ola bilər. Varsa təmizlə.

2. Repo ölçüsünü öncə/sonra ölç və hesabata yaz:
   ```bash
   du -sh . --exclude=node_modules --exclude=.git
   ```

---

## 4. ƏHATƏDƏN KƏNAR — bunları ETMƏ

| Tapıntı | Aid task | Səbəb |
|---|---|---|
| `serveFile` avtorizasiyası (C-1) | **Task 7** | Yeni məntiq + E2E tələb edir, 2 gün |
| Arxiv oxu endpoint-ləri (C-3 tam həll) | **Task 8** | API + UI + GDPR ixracı, 2 gün |
| `sanitizePermissions` `'*'` (H-1) | **Task 3** | RBAC məntiqi dəyişikliyi |
| Rate limit səbətləri (H-4) | **Task 4** | 107 route-a təsir edir |
| Demo seed migration-ları (H-7) | **Task 5** | Yeni migration + istehsal datası |
| `js/legal.js` placeholder-ləri | **Task 2** | Sizdən real məlumat tələb edir |
| `seo.ts` ORIGIN / domen vahidliyi | **Task 2** | SEO reqressiya riski, ayrıca doğrulama |
| `worker/services/` 23 boş stub | **Task 10** | Strateji qərar (doldur / sil) tələb edir |
| `routes.ts` bölünməsi, hər hansı refactor | **Task 10** | — |
| CSP `style-src 'unsafe-inline'` (M-3) | **Task 10** | 179 KB CSS köçürməsi |

**Ümumi qayda:** bu task-da **heç bir yeni funksionallıq yazılmır**. Yalnız: silmə, bir sətirlik qapı, konfiqurasiya dəyəri, `.gitignore`, və 2 ədəd reqressiya testi.

---

## 5. İCRA QAYDALARI

### 5.1 Commit strategiyası — hər bənd ayrıca

```
fix(security): admin qapısı /api/admin/admins-ə əlavə edildi

Audit: AUDIT-2026-07-26.md §7 / H-2
Risk: High
Təsir: giriş etmiş istənilən istifadəçi admin uid siyahısını ala bilirdi.
Düzəliş: route cədvəlinə admin:true + handler-də defense-in-depth yoxlaması.
Test: e2e/security-api.spec.ts — 2 yeni test.
```

Səbəb: hər hansı bənd reqressiya yaratsa **bənd-bənd revert** mümkün olsun. `legacy/` silinməsi ilə admin qapısı bir commit-də olsa, birini geri qaytarmaq digərini də geri qaytarır.

**Commit sırası (tövsiyə):** 1.1 → 1.7 → 1.5 → 1.4 → 1.6 → 1.3 → 1.2 → 1.8
*(Ən risksizdən ən geri dönməzə doğru — `legacy/` silinməsi sondan əvvəl gəlir ki, ona qədər build-in sağlam olduğu təsdiqlənsin.)*

### 5.2 Sübut məcburiyyəti

Heç bir fayl **"yəqin lazım deyil"** mülahizəsi ilə silinmir. Hər silmə üçün hesabatda:
- ya `git grep` nəticəsi (boş çıxış),
- ya kodda əvəzləyici istinad (`index.ts:352-353` kimi).

### 5.3 Geri dönməz əməliyyatlarda dayanma nöqtələri

Aşağıdakılar geri dönməzdir və gözlənilməz nəticə halında **icra edilmir, hesabat verilir**:
- `legacy/` silinməsi (asılılıq yoxlaması nəticə versə)
- Git tarixçəsinin təmizlənməsi (bu task-da **ümumiyyətlə icra olunmur**)
- API açarının rotasiyası (koordinasiya tələb edir)

### 5.4 Kod mədəniyyətinin qorunması

Kod bazasında hər qeyri-adi qərarın "niyə"si şərhdə izah olunub və auditdə bu, **layihənin ən dəyərli aktivlərindən biri** kimi qiymətləndirilib. Ona görə:
- Mövcud şərhləri silmə.
- Əlavə etdiyin hər müvəqqəti həllin (məs. `ARCHIVE_HOT_DAYS`) yanına **səbəb + geri qaytarma şərti** yaz.
- Silmək əvəzinə şərhə almadın — silinən kod git-də qalır, şərhə alınmış kod isə oxunuşu çirkləndirir.

---

## 6. TEST TƏLƏBİ

`e2e/security-api.spec.ts` faylına **2 yeni test** əlavə et. Bu, əhatənin məcburi hissəsidir — H-2 bir sətirlik nəzarətsizlik idi və test olmadan yenidən yarana bilər.

```ts
test.describe('AUDIT H-2 — /api/admin/admins avtorizasiyası', () => {

  test('adi istifadəçi 403 alır', async ({ request }) => {
    const token = await loginAsRegularUser(request);        // mövcud helper-dən istifadə et
    const res = await request.get('/api/admin/admins', {
      headers: { Cookie: `cx_at=${token}` },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('forbidden');                    // maşın-oxunaqlı kod yoxlanılır
  });

  test('admin 200 alır və siyahı qaytarılır', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.get('/api/admin/admins', {
      headers: { Cookie: `cx_at=${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).admins)).toBe(true);
  });

  test('anonim istifadəçi 401 alır', async ({ request }) => {
    const res = await request.get('/api/admin/admins');
    expect(res.status()).toBe(401);
  });
});
```

**Qeyd:** mövcud `security-api.spec.ts` (33,5 KB) TASK-8-i ciddi örtür — orada auth helper-ləri artıq var. Yenisini yazma, mövcudları işlət.

---

## 7. QƏBUL MEYARLARI

Hamısı ✅ olmalıdır. ❌ olan varsa task bitməyib.

| # | Meyar | Doğrulama | Gözlənilən |
|---|---|---|---|
| 1 | Strict TypeScript keçir | `npx tsc --noEmit` | exit 0 |
| 2 | Build uğurludur | `npm run build` | exit 0 |
| 3 | E2E reqressiya yoxdur | `npx playwright test` | əvvəlki nəticə ≥ |
| 4 | Yeni testlər keçir | `npx playwright test security-api` | 3/3 yaşıl |
| 5 | Açıq mətnli parol yoxdur | `git grep -rn "password=" -- ':!*.md'` | **boş** |
| 6 | `legacy/` yoxdur | `test ! -d legacy && echo OK` | OK |
| 7 | `testsprite_tests/` yoxdur | `test ! -d testsprite_tests && echo OK` | OK |
| 8 | `.gitignore` işləyir | `git check-ignore -v` × 3 nümunə | 3/3 qayda göstərir |
| 9 | Admin qapısı bağlıdır | adi token → `GET /api/admin/admins` | **403** |
| 10 | Admin özü işləyir | admin token → eyni endpoint | **200** |
| 11 | Arxiv silməsi dayanıb | `wrangler.jsonc` yoxlaması | `"3650"` + geri qaytarma şərhi |
| 12 | SEO pozulmayıb | deploy sonrası `GET /robots.txt`, `GET /sitemap.xml` | **200**, məzmun Worker-dən |
| 13 | Ölü istinad qalmayıb | `git grep -n "legacy\|testsprite" -- ':!*.md' ':!.gitignore'` | **boş** |
| 14 | Security header dəsti toxunulmayıb | `curl -I <url>` | HSTS/COOP/CORP/CSP mövcud, X-XSS-Protection yox |

---

## 8. HESABAT FORMATI

İş bitdikdən sonra `docs/AUDIT-TASK-1-REPORT.md` yarat:

```markdown
# AUDIT-TASK-1 — İcra Hesabatı

**Tarix:** …
**İcraçı:** …
**Commit-lər:** <hash → başlıq siyahısı>
**Repo ölçüsü:** öncə <X> MB → sonra <Y> MB

---

## 1. Bağlanan tapıntılar

| Audit ID | Bənd | Vəziyyət | Sübut |
|---|---|---|---|
| H-2  | 1.1 · admin qapısı        | ✅ | index.ts:174 + routes.ts:1683; E2E 3/3 |
| C-3  | 1.2 · arxiv dayandırıldı  | ✅ | wrangler.jsonc:55 = "3650" |
| C-2  | 1.3 · legacy/ silindi     | ✅ | `git grep "password="` → boş |
| M-16 | 1.4 · testsprite/ silindi | ✅ | … |
| M-16 | 1.5 · .gitignore          | ✅ | `git check-ignore` 3/3 |
| —    | 1.6 · ölü fayllar         | ✅ | … |
| L-1  | 1.7 · X-XSS-Protection    | ✅ | … |
| —    | 1.8 · gigiyena            | ✅ | … |

## 2. Qəbul meyarları

| # | Meyar | ✅/❌ | Nəticə |
| … 14 sətir … |

## 3. Sızma yoxlamasının nəticəsi

**`legacy/firebase/.emulator-data/` git tarixçəsində:** VAR / YOXDUR
**`testsprite_tests/tmp/config.json` git tarixçəsində:** VAR / YOXDUR

<VAR halında: hadisə təsviri, təsir dairəsi, tövsiyə olunan addımlar>

## 4. Açıq qalan öhdəliklər

- [ ] **MƏCBURİ:** `ARCHIVE_HOT_DAYS` → `"90"` (Task 8 tamamlandıqdan sonra)
- [ ] TestSprite API açarının rotasiyası — <edildi / gözləyir / məsul şəxs>
- [ ] 53 hesaba məcburi parol sıfırlama — <tələb olunur / olunmur + səbəb>
- [ ] Git tarixçəsinin təmizlənməsi — <tələb olunur / olunmur>

## 5. Aşkarlanan yeni risklər

<1.1-də tapılan digər qapısız admin route-lar; silmə zamanı üzə çıxan hər şey>

## 6. Geri qaytarma planı

| Commit | Revert əmri | Gözlənilən təsir |
|---|---|---|
| … | `git revert <hash>` | … |

**Diqqət:** `legacy/` və `testsprite_tests/` silinməsi `git revert` ilə bərpa olunur,
lakin bu, 53 açıq mətnli parolu geri gətirir. Bərpa yalnız asılılıq problemi
aşkarlanarsa və şüurlu qərarla edilməlidir.
```

---

## 9. BİRİNCİ ADDIM — icradan əvvəl

İşə başlamazdan əvvəl **yalnız oxu rejimində** aşağıdakı 6 sübutu topla və mənə təqdim et:

1. `git grep -n "legacy/" -- ':!legacy/' ':!*.md'` nəticəsi
2. `git log --all --oneline -- "legacy/firebase/.emulator-data/*"` nəticəsi
3. `git log --all --oneline -- "testsprite_tests/tmp/config.json"` nəticəsi
4. `worker/index.ts` sətir **170–180** və **320–330** və **350–355**
5. `.gitignore` tam məzmunu
6. `wrangler.jsonc`-də `ARCHIVE_HOT_DAYS` və `triggers.crons` sətirləri
7. `grep -n "robots\|sitemap\|publicDir" vite.config.ts` nəticəsi

**Dayanma şərti:** 2 və ya 3-cü bənd **boş deyilsə**, icraya keçmə — bu, təhlükəsizlik hadisəsidir və silmədən əvvəl ayrıca qərar tələb edir. Nəticəni bildir və gözlə.

Qalan hallarda sübutları təqdim etdikdən sonra §5.1-dəki commit sırası ilə icraya başla.
