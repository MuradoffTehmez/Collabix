# Collabix — Audit Task Yol Xəritəsi (10 Task)

**Mənbə:** `AUDIT-2026-07-26.md`
**Sıralama prinsipi:** ən xırda (dəqiqələr/saatlar) → ən böyük (həftələr). Prioritet deyil, **iş həcmi** üzrə.
**Ümumi həcm:** ≈ 26–32 iş günü (Task 10 istisna olmaqla ≈ 14 gün).

---

## 0. Təsnifat xülasəsi

| Tapıntı | Say | Ümumi həcm |
|---|---:|---|
| 🔴 Critical | 3 (C-1, C-2, C-3) | ≈ 3,5 gün |
| 🟠 High | 7 (H-1…H-7) | ≈ 6 gün |
| 🟡 Medium | 17 (M-1…M-17) | ≈ 2,5 gün |
| 🔵 Low | 8 (L-1…L-8) | ≈ 0,5 gün |
| Struktur borcu | 7 bənd | ≈ 6 gün |
| Proses borcu | 4 bənd | ≈ 3 gün |
| Strateji (TASK-10 / PRD-TDD) | 2 qərar | 1 gün *və ya* 14–22 gün |

**Diqqət — sıralama xəbərdarlığı:** iş həcmi üzrə sıralamada **CI/CD (Task 10.1)** sona düşür. Praktikada CI **Task 1-dən dərhal sonra** qurulmalıdır, əks halda Task 2–9-un heç bir düzəlişi reqressiyaya qarşı qorunmur. Sıralamanı belə saxlayın, lakin **10.1-i icra sırasında 1.5 mövqeyinə çəkin.**

---

## 1. On Task-ın xəritəsi

| # | Task adı | Bağladığı tapıntılar | Həcm | Risk sinfi |
|---|---|---|---|---|
| **1** | Sıfır-risk blokerlər və repo təmizliyi | C-2, H-2, C-3(müvəqqəti), M-16, L-1, ölü fayllar | **≈3 saat** | Critical |
| **2** | Hüquqi məzmun və domen vahidliyi | Hüquqi risk #12, L-8, borc #14 | **≈3 saat** | Hüquqi |
| **3** | Komanda RBAC eskalasiyasının bağlanması | H-1 | **0,5 gün** | High |
| **4** | Rate limit əhatəsi (opt-in → opt-out) | H-4 | **0,5 gün** | High |
| **5** | Demo seed-in istehsaldan çıxarılması + migration nizamı | H-7, borc #29 | **0,5 gün** | High |
| **6** | Validasiya, audit və data bütövlüyü paketi | M-5…M-17, L-3…L-6, orphan silmələr | **1,5 gün** | Medium |
| **7** | `/files/*` avtorizasiyası (IDOR zəncirinin qırılması) | **C-1** | **2 gün** | **Critical** |
| **8** | Arxiv oxu yolu + GDPR ixracının tamlığı | **C-3**, hüquqi risk #13 | **2 gün** | **Critical** |
| **9** | Runtime təhlükəsizliyi və XP bütövlüyü | H-3, H-5, H-6, M-4 | **3,5 gün** | High |
| **10** | Platform yetkinliyi və strateji qərar | CI/CD, lint, `routes.ts`, polling→WS, feed cursor, observability, TASK-10, PRD/TDD | **10–20 gün** | Strateji |

---

## 2. Goal komandaları (hər task üçün qısa forma)

> Bunlar uzun promptun deyil, **goal/tracking komandasının** girişidir. Hər biri: hədəf + bitmə şərti.

```
/goal AUDIT-1  Sıfır-risk blokerləri bağla: legacy/ sil (53 açıq mətnli parol),
               /api/admin/admins-ə admin qapısı, arxiv silməsini dayandır,
               .gitignore düzəlt, ölü faylları təmizlə.
               DONE: tsc exit 0 + E2E yaşıl + repoda açıq sirr yoxdur.
```

```
/goal AUDIT-2  Legal placeholder-ləri real dəyərlərlə əvəzlə, sosial URL-ləri və
               JSON-LD sameAs-ı düzəlt, tək domen mənbəyi qur (seo.ts).
               DONE: canlı Privacy/Terms-də '[' simvolu yoxdur; bütün URL-lər 200 qaytarır.
```

```
/goal AUDIT-3  Komanda RBAC-ında '*' wildcard eskalasiyasını bağla; icazə verilməsi
               çağıranın öz dəstinin altçoxluğu olsun; rol prioriteti qorunsun.
               DONE: 3 sorğuluq Admin→Owner istismarı E2E testdə 403 verir.
```

```
/goal AUDIT-4  Rate limit-i opt-in-dən opt-out-a çevir; ai/read/presence səbətlərini əlavə et.
               DONE: rl-siz route sayı 107 → 0; AI endpoint-ləri 20/saat limitlidir.
```

```
/goal AUDIT-5  Demo seed-i istehsal migration-larından çıxar, e2e/seed.ts-ə köçür,
               0020_drop_demo_seed.sql yaz, migration nömrələmə qaydasını sənədləşdir.
               DONE: istehsalda 'Alpha Team'/'Team Owner' sətri yoxdur; dublikat nömrə yoxdur.
```

```
/goal AUDIT-6  M-5…M-17 validasiya/audit boşluqlarını topluca bağla:
               clamp-lar, settings sızması, bloklanmış müəllif filtri, admin audit,
               son admin qoruması, assigneeId üzvlüyü, orphan silmələr.
               DONE: 17 Medium-un hamısı bağlıdır, hər biri üçün 1 test var.
```

```
/goal AUDIT-7  serveFile()-a canReadKey() avtorizasiyası qur (default DENY);
               createPost-da imageKeys/blocks[].urls sahibliyini məcburi yoxla;
               msg.ts fileKey sahibliyini yoxla.
               DONE: yad komanda faylı 404 qaytarır; eksfiltrasiya zənciri E2E-də qırılıb.
```

```
/goal AUDIT-8  Arxiv oxu yolunu qur (?before= → readArchive), UI-da 'daha köhnə' yükləmə,
               GDPR ixracına arxiv + komanda datası + contact_messages əlavə et,
               ARCHIVE_HOT_DAYS-i 90-a qaytar.
               DONE: 90 gündən köhnə mesaj UI-dan oxunur; ixrac tam datanı əhatə edir.
```

```
/goal AUDIT-9  Atomik rate limiter (native binding / RateLimitDO), XP anti-abuse
               (xp_logs + UNIQUE + gündəlik tavan + kompensasiya), WS periodik
               yenidən-avtorizasiya + disconnect(uid) RPC, RoomDO state → ctx.storage.
               DONE: paralel 200 sorğu limiti keçmir; XP dövrəsi 0 XP verir; çıxarılan üzv WS-dən düşür.
```

```
/goal AUDIT-10 Platform borcunu bağla: CI/CD + ESLint + unit test qatı, routes.ts bölünməsi,
               polling→WS keçidi, feed cursor, observability açılması; TASK-10 və PRD/TDD
               üçün 'icra et / sənədi kodun reallığına uyğunlaşdır' qərarını RƏSMİLƏŞDİR.
               DONE: hər PR-də avtomatik qapı işləyir; boş stub qalmır; sənəd-kod uyğunluğu ≥90%.
```

---

# TASK 1 — TAM PROMPT

> Aşağıdakı bloku olduğu kimi icra agentinə verin.

---

## ROL VƏ KONTEKST

Sən Collabix layihəsində işləyən **kıdemli təhlükəsizlik mühəndisisən**. Layihə: Cloudflare Workers + D1 + R2 + KV + Durable Objects üzərində qurulmuş, vanilla JS ESM frontend-li sosial/komanda platforması. Kod bazası 2026-07-26 tarixli sərt auditdən keçib (`AUDIT-2026-07-26.md`) və **istehsala hazır DEYİL** hökmü alıb.

Sənin tapşırığın **AUDIT-TASK-1**-dir: auditin ən qısa müddətdə bağlanan, lakin ən yüksək risk/xərc nisbətinə malik tapıntılarını bağlamaq. Bu task **buraxılış blokerlərindən 2-sini** (C-2, H-2) və 1 kritik zərər azaltmasını (C-3-ün müvəqqəti tədbiri) əhatə edir.

**Vacib prinsip:** bu task-da heç bir yeni funksionallıq yazılmır. Yalnız *silmə*, *bir sətirlik qapı*, *konfiqurasiya* və *təmizlik*. Refactor etmə. Əhatədən kənara çıxma.

---

## ƏHATƏ (SCOPE) — 8 bənd

### 1.1 — `/api/admin/admins` admin qapısı (H-1 sinfi: **High**, 5 dəqiqə)

**Yer:** `worker/index.ts:174`

Hazırkı vəziyyət:
```ts
{ method: 'GET', pattern: /^\/api\/admin\/admins$/, handler: R.adminListAdmins, auth: true },
//                                                                              ^^^ admin: true YOXDUR
```

Qonşu **32** admin route-unun hamısında `admin: true` var; handler-in özündə də (`worker/routes.ts:1683`) `isAdmin` yoxlaması yoxdur. Nəticədə giriş etmiş **istənilən** istifadəçi bütün admin `user_id`-lərini sadalaya bilir → hədəfli parol/phishing hücumu üçün hazır siyahı.

**Tələb:**
- `index.ts:174` route-una `admin: true` əlavə et.
- **Əlavə olaraq** `adminListAdmins` handler-inin özündə də `if (!c.isAdmin) return err('İcazə yoxdur.', 403, 'forbidden')` müdafiəsini qur (defense-in-depth — route cədvəli gələcəkdə səhvən dəyişdirilə bilər).
- Bütün 171 route-u yoxla: `admin` sözü keçən pattern-lərdən `admin: true` bayrağı **olmayan** başqa route varmı? Varsa siyahıla və hesabata yaz (bu task-da düzəltmə, yalnız bildir).

---

### 1.2 — Arxiv silinməsinin dərhal dayandırılması (C-3 zərər azaltması, 5 dəqiqə)

**Yer:** `wrangler.jsonc:55` → `ARCHIVE_HOT_DAYS: "90"`, cron `17 3 * * *` (`wrangler.jsonc:104`)

Gündəlik cron 90 gündən köhnə `room_messages` / `dm_messages` sətirlərini R2-yə yazır və **D1-dən silir** (`worker/archive.ts:88`). `readArchive()` (`archive.ts:127`) yazılıb, **heç yerdən çağırılmır** — yəni silinən data məhsul daxilində əbədi əlçatmazdır.

**Tələb:**
- `ARCHIVE_HOT_DAYS`-i `"3650"` et.
- Dəyərin üstündə **məcburi** şərh qoy:
  ```jsonc
  // MÜVƏQQƏTİ (AUDIT-TASK-1 / C-3): arxiv OXU yolu qurulana qədər D1-dən silmə dayandırılıb.
  // AUDIT-TASK-8 tamamlandıqdan sonra "90"-a qaytarılmalıdır. Qaytarılmadan buraxılış = sükutlu data itkisi.
  ```
- Bu qaytarma öhdəliyini `docs/`-da izlənən yerə (məs. `AUDIT-TASKS-ROADMAP.md` → Task 8) bağla.

**Qadağa:** arxiv oxu yolunu bu task-da **yazma**. O, Task 8-dir.

---

### 1.3 — `legacy/` qovluğunun təhlükəsiz silinməsi (C-2, **Critical**, ≈1 saat)

**Yer:** `legacy/` (2,1 MB), xüsusilə `legacy/firebase/.emulator-data/auth_export/accounts.json` (27,5 KB)

Fayl Firebase emulator export formatındadır və parolları **açıq mətnlə** saxlayır:
```
"passwordHash":"fakeHash:salt=fakeSalt…:password=<AÇIQ MƏTN>"
```
**Doğrulanmış:** 53 `localId`, 53 `password=…`, 53 unikal email. Eyni 53 istifadəçi `migration-cf/import.sql`-də `pass_hash` ilə mövcuddur → bunlar **real istifadəçilərdir**, fixture deyil.

**Silmədən ƏVVƏL məcburi addımlar (bu sıra ilə):**

1. **Asılılıq yoxlaması** — heç bir işlək kodun `legacy/`-dən import etmədiyini sübut et:
   ```bash
   git grep -n "legacy/" -- ':!legacy/' ':!*.md'
   git grep -n "client-firebase" -- ':!legacy/'
   ```
   Nəticə boş olmalıdır. Boş deyilsə → **DAYAN**, tapıntını hesabata yaz, silmə.

2. **Sızma yoxlaması** — fayl git tarixçəsinə düşübmü:
   ```bash
   git log --all --oneline -- "legacy/firebase/.emulator-data/*"
   git log --all --oneline -- "legacy/firebase/migration/serviceAccountKey.json"
   ```
   - **Nəticə boşdursa:** sızma yoxdur, sadəcə sil.
   - **Nəticə boş deyilsə:** bu **hadisədir (incident)**. Silmə ilə kifayətlənmə — hesabatda "53 hesaba məcburi parol sıfırlama tələb olunur" bəndini **qırmızı** işarələ və ayrıca task aç. (Sıfırlama axını bu task-ın əhatəsində deyil, lakin aşkarlama əhatədədir.)

3. **Arxivləmə (geri dönməzlik qoruması)** — silmədən əvvəl repodan **kənar**, şifrələnmiş yerə köçür:
   ```bash
   # nümunə — repo qovluğundan KƏNARDA
   tar -czf ../collabix-legacy-archive-$(date +%Y%m%d).tar.gz legacy/
   ```
   Sonra arxivin `accounts.json`-unu ayrıca sil və ya arxivi şifrələ. Arxivin yerini hesabatda **yolu ilə deyil, təsviri ilə** qeyd et.

4. **Silmə:**
   ```bash
   git rm -r --cached legacy/ 2>/dev/null || true
   rm -rf legacy/          # PowerShell: Remove-Item -Recurse -Force legacy
   ```

---

### 1.4 — `testsprite_tests/` təmizliyi + API açarının rotasiyası (M-16, ≈15 dəqiqə)

**Yerlər:**
- `testsprite_tests/tmp/prd_files/` — `docs/`-un tam dublikatı, mojibake adlarla (`Tam Ä°cra PlanÄ±.md`)
- `testsprite_tests/tmp/config.json` — **`API_KEY` daxildir**

**Tələb:**
1. `git log --all --oneline -- "testsprite_tests/tmp/config.json"` ilə açarın git-ə düşüb-düşmədiyini yoxla.
2. Qovluğu tamamilə sil.
3. **Açarı düşüb-düşməməsindən asılı olmayaraq rotasiya et** (fayl diskdə açıq qalmışdı — sızma ehtimalı sıfır deyil). Rotasiya provayder panelindən edilir; bu, kod dəyişikliyi deyil — hesabatda "rotasiya edilməlidir / edildi" bəndini işarələ.

---

### 1.5 — `.gitignore` qaydalarının düzəldilməsi (M-16, ≈10 dəqiqə)

**Yer:** `.gitignore:20`

Hazırkı qayda **backslash** ilə yazılıb və bu səbəbdən **heç vaxt işləməyib**:
```
testsprite_tests\tmp\config.json     ← İŞLƏMİR
```
Həmçinin `migration/serviceAccountKey.json` qaydası `legacy/firebase/migration/`-ə şamil olunmur.

**Tələb — qaydaları belə əvəzlə:**
```gitignore
# Sirlər — heç bir halda commit edilməməlidir
**/serviceAccountKey.json
**/.emulator-data/
**/auth_export/
testsprite_tests/

# Köhnəlmiş / artefakt
legacy/
.claude/skills/run-collabix/shots/
```
Sonra **qaydanın həqiqətən işlədiyini sübut et**:
```bash
git check-ignore -v testsprite_tests/tmp/config.json
git check-ignore -v legacy/firebase/.emulator-data/auth_export/accounts.json
```
Hər ikisi uyğun qaydanı göstərməlidir. Göstərmirsə qayda səhvdir.

---

### 1.6 — Ölü faylların silinməsi (borc #3, #14, ≈20 dəqiqə)

| Fayl | Səbəb | Əməliyyat |
|---|---|---|
| kök `sitemap.xml` | **Ölü kod** — `worker/index.ts:352-353` onu D1-dən generasiya ilə əvəzləyir | Sil |
| kök `robots.txt` | Eyni səbəb + `collabix.app` yazır, `worker/seo.ts:6` isə `collabix.muradofftehmez01.workers.dev` → **ziddiyyət** | Sil |
| `legacy/index-v1.html` (75,7 KB) | Köhnə tək-fayl tətbiq | `legacy/` ilə birgə silinir (1.3) |

**Silmədən əvvəl məcburi sübut:** Worker-in bu iki yolu həqiqətən idarə etdiyini `worker/index.ts:352-353`-i oxuyaraq təsdiqlə və `vite.config.ts` / `public/` konfiqurasiyasının bu faylları `dist/`-ə kopyalamadığını yoxla. Kopyalayırsa əvvəlcə konfiqurasiyanı düzəlt, sonra sil.

**Qadağa:** domen vahidləşdirilməsini (`seo.ts` ORIGIN dəyəri) bu task-da **etmə** — o, Task 2-dir. Burada yalnız ölü faylı silirsən.

---

### 1.7 — `X-XSS-Protection` başlığının çıxarılması (L-1, ≈5 dəqiqə)

**Yer:** `worker/index.ts:325`

Başlıq köhnəlmişdir, bütün müasir brauzerlərdə iqnor edilir, bəzi köhnə mühitlərdə isə özü XSS vektoru yarada bilir. `script-src 'self'` (nonce-suz, `unsafe-inline`-siz) onsuz da əsas müdafiəni verir.

**Tələb:** başlığı sil. **Digər heç bir security header-ə toxunma** (HSTS, COOP, CORP, Permissions-Policy, `frame-ancestors 'none'`, CSP — hamısı düzgündür, auditdə "nümunəvi" qiymətləndirilib).

---

### 1.8 — Skrinşot artefaktlarının repodan çıxarılması (≈5 dəqiqə)

`.claude/skills/run-collabix/shots/*.png` (860 KB) — `.gitignore`-a əlavə edilib (1.5), lakin artıq izlənirsə cache-dən çıxar:
```bash
git rm -r --cached .claude/skills/run-collabix/shots/ 2>/dev/null || true
```

---

## ƏHATƏDƏN KƏNAR (bunları ETMƏ)

- ❌ `serveFile` avtorizasiyası (C-1) → **Task 7**
- ❌ Arxiv oxu endpoint-ləri (C-3 tam həll) → **Task 8**
- ❌ `sanitizePermissions` / `'*'` eskalasiyası (H-1) → **Task 3**
- ❌ Rate limit səbətləri (H-4) → **Task 4**
- ❌ Demo seed migration-ları (H-7) → **Task 5**
- ❌ `legal.js` placeholder-ləri (hüquqi risk) → **Task 2**
- ❌ `routes.ts` bölünməsi, hər hansı refactor, adlandırma dəyişikliyi
- ❌ `worker/services/` altındakı 23 boş stub-un silinməsi → **Task 10** (strateji qərar tələb edir)

---

## İCRA QAYDALARI

1. **Hər bənd ayrıca commit.** Commit mesajı formatı:
   ```
   fix(security): <bənd> — <audit ID>

   Audit: AUDIT-2026-07-26.md §<bölmə>
   Risk: <Critical|High|Medium|Low>
   ```
   Səbəb: geri qaytarma (revert) lazım olsa bənd-bənd mümkün olsun.

2. **Silmədən əvvəl həmişə sübut.** Heç bir fayl "yəqin lazım deyil" mülahizəsi ilə silinmir — hər silmə üçün `git grep` və ya kod istinadı sübutu hesabatda olmalıdır.

3. **Geri dönməz əməliyyatlarda dayan və soruş.** `legacy/` silinməsi və API açarı rotasiyası geri dönməzdir. Asılılıq və ya sızma yoxlaması gözlənilməz nəticə versə → **icra etmə, hesabat ver.**

4. **Mövcud şərh mədəniyyətini qoru.** Kod bazasında "niyə" izah edən şərhlər var və bu, auditdə layihənin ən dəyərli aktivlərindən biri kimi qiymətləndirilib. Şərhləri silmə; yeni əlavə etdiyin hər müvəqqəti həllin yanına səbəb və geri qaytarma şərti yaz.

---

## QƏBUL MEYARLARI (hamısı ✅ olmalıdır)

| # | Meyar | Doğrulama əmri / üsulu |
|---|---|---|
| 1 | Strict TypeScript keçir | `npx tsc --noEmit` → **exit 0** |
| 2 | Build uğurludur | `npm run build` → exit 0 |
| 3 | E2E reqressiya yoxdur | `npx playwright test` → əvvəlki nəticə ilə eyni və ya daha yaxşı |
| 4 | Repoda açıq mətnli parol yoxdur | `git grep -rn "password=" -- ':!*.md'` → **boş** |
| 5 | `legacy/` yoxdur | `test ! -d legacy && echo OK` |
| 6 | `testsprite_tests/` yoxdur | `test ! -d testsprite_tests && echo OK` |
| 7 | `.gitignore` qaydaları işləyir | `git check-ignore -v` hər iki nümunə üçün qayda göstərir |
| 8 | Admin qapısı bağlıdır | Adi istifadəçi tokeni ilə `GET /api/admin/admins` → **403** |
| 9 | Admin özü işləyir | Admin tokeni ilə eyni endpoint → **200** |
| 10 | Arxiv silməsi dayandırılıb | `wrangler.jsonc` → `ARCHIVE_HOT_DAYS: "3650"` + geri qaytarma şərhi mövcuddur |
| 11 | SEO pozulmayıb | Deploy sonrası `GET /robots.txt` və `GET /sitemap.xml` → **200**, məzmun Worker-dən gəlir |
| 12 | Kod istinadı qırılmayıb | `git grep -n "legacy/" -- ':!*.md'` → **boş** |

**8 və 9-cu meyarlar üçün yeni E2E testi əlavə et** — `e2e/security-api.spec.ts`-ə:
```ts
test('GET /api/admin/admins adi istifadəçi üçün 403 qaytarır', async ({ request }) => { … });
test('GET /api/admin/admins admin üçün 200 qaytarır', async ({ request }) => { … });
```
Səbəb: bu qüsur bir sətirlik nəzarətsizlik idi və test olmadan yenidən yarana bilər.

---

## HESABAT FORMATI

İş bitdikdən sonra `docs/AUDIT-TASK-1-REPORT.md` yarat:

```markdown
# AUDIT-TASK-1 — İcra Hesabatı
**Tarix:** …   **İcraçı:** …   **Commit-lər:** <hash siyahısı>

## 1. Bağlanan tapıntılar
| Audit ID | Bənd | Vəziyyət | Sübut (fayl:sətir / əmr nəticəsi) |

## 2. Qəbul meyarları
| # | Meyar | ✅/❌ | Nəticə |

## 3. Aşkarlanan yeni risklər
(1.1-də tapılan qapısız route-lar; sızma yoxlamasının nəticəsi; başqa nə görsən)

## 4. Açıq qalan öhdəliklər
- [ ] ARCHIVE_HOT_DAYS → "90" (Task 8 tamamlandıqdan sonra) — **MƏCBURİ**
- [ ] TestSprite API açarının rotasiyası — <edildi / gözləyir>
- [ ] 53 hesaba məcburi parol sıfırlama — <tələb olunur / olunmur, səbəb>

## 5. Geri qaytarma planı
Hər commit üçün revert əmri və gözlənilən təsir.
```

---

## BİRİNCİ ADDIM

İşə başlamazdan əvvəl **yalnız oxu rejimində** aşağıdakı sübutları topla və mənə təqdim et — sonra icraya keç:

1. `git grep -n "legacy/" -- ':!legacy/' ':!*.md'` nəticəsi
2. `git log --all --oneline -- "legacy/firebase/.emulator-data/*"` nəticəsi
3. `git log --all --oneline -- "testsprite_tests/tmp/config.json"` nəticəsi
4. `worker/index.ts:170-180` və `worker/index.ts:350-355` sətirləri
5. `.gitignore` tam məzmunu
6. `wrangler.jsonc` içində `ARCHIVE_HOT_DAYS` və cron sətirləri

2 və 3-cü bəndlərdən hər hansı biri **boş deyilsə**, icraya keçməzdən əvvəl mənə xəbər ver — bu, təhlükəsizlik hadisəsidir və ayrıca qərar tələb edir.
