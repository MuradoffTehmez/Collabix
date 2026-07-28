# Collabix Audit (2026-07-26) — Tamamlanma Analizi

**Analiz tarixi:** 2026-07-28
**Mənbə audit:** [AUDIT-2026-07-26.md](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/docs/AUDIT-TASKS/AUDIT-2026-07-26.md)
**Remediation roadmap:** [AUDIT-TASKS-ROADMAP.md](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/docs/AUDIT-TASKS/AUDIT-TASKS-ROADMAP.md)

---

## Ümumi Görünüş

Audit 10 remediation task-a bölünüb. **İlk 7 task tamamlanıb**, **3 task qalır**.

| Task | Məzmun | Vəziyyət | Hesabat |
|---|---|---|---|
| **AUDIT-TASK-1** | Sıfır-risk blokerlər + repo təmizliyi | ✅ **TAMAMLANIB** | [Report](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/docs/AUDIT-TASKS/AUDIT-TASK-1-REPORT.md) |
| **AUDIT-TASK-2** | Hüquqi məzmun + domen vahidliyi | ✅ **TAMAMLANIB** | [Report](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/docs/AUDIT-TASKS/AUDIT-TASK-2-REPORT.md) |
| **AUDIT-TASK-3** | Komanda RBAC eskalasiyasının bağlanması | ✅ **TAMAMLANIB** | [Report](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/docs/AUDIT-TASKS/AUDIT-TASK-3-REPORT.md) |
| **AUDIT-TASK-4** | Rate limit əhatəsi (opt-in → opt-out) | ✅ **TAMAMLANIB** | [Report](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/docs/AUDIT-TASKS/AUDIT-TASK-4-REPORT.md) |
| **AUDIT-TASK-5** | Demo seed təmizliyi + migration nizamı | ✅ **TAMAMLANIB** | [Report](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/docs/AUDIT-TASKS/AUDIT-TASK-5-REPORT.md) |
| **AUDIT-TASK-6** | Validasiya, audit və data bütövlüyü paketi | ✅ **TAMAMLANIB** | [Report](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/docs/AUDIT-TASKS/AUDIT-TASK-6-REPORT.md) |
| **AUDIT-TASK-7** | `/files/*` avtorizasiyası (C-1 IDOR) | ✅ **TAMAMLANIB** | [Report](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/docs/AUDIT-TASKS/AUDIT-TASK-7-REPORT.md) |
| **AUDIT-TASK-8** | Arxiv oxu yolu + GDPR ixracı tamlığı | ❌ **BAŞLAMAIYB** | Hesabat yoxdur |
| **AUDIT-TASK-9** | Runtime təhlükəsizliyi + XP bütövlüyü | ❌ **BAŞLAMAIYB** | Hesabat yoxdur |
| **AUDIT-TASK-10** | Platform yetkinliyi + strateji qərar | ❌ **BAŞLAMAIYB** | Hesabat yoxdur |

---

## Tapıntı-tapıntı Vəziyyət Xəritəsi

### 🔴 CRITICAL Tapıntılar (3)

| ID | Təsvir | Vəziyyət | Bağlayan task | Təfərrüat |
|---|---|---|---|---|
| **C-1** | `/files/*`-də avtorizasiya YOXDUR (IDOR → eksfiltrasiya) | ✅ **BAĞLANDI** | AUDIT-TASK-7 | Tam `canReadKey()` sistemi qurulub: default DENY, prefiks-əsaslı siyasət, keş siyasəti ayrılması (`public`/`private`/`no-store`), KV-keşli komanda üzvlüyü yoxlaması, DM/otaq iştirakçılıq yoxlaması, tənbəl admin resolver. **Audit tapıntısından kənar** əlavə bir boşluq aşkarlanıb və bağlanıb: CDN keşi avtorizasiyanı keçirdi (yeni [files-auth.ts](file:///c:/Users/Tahmaz Muradov/Desktop/Collabix/worker/files-auth.ts) — 336 sətir) |
| **C-2** | 53 istifadəçinin açıq mətnlə parolu repo-da | ✅ **BAĞLANDI** | AUDIT-TASK-1 | `legacy/` qovluğu tamamilə silinib. Git tarixçəsində yox idi (repo yeni yaradılıb). Sızma riski **yoxdur** |
| **C-3** | Arxivlənmiş mesajlar əlçatmaz (sükutlu data itkisi) | ⚠️ **MÜVƏQQƏTİ TƏDBİR** | AUDIT-TASK-1 (müvəqqəti) | `ARCHIVE_HOT_DAYS` `"3650"` edilib — silmə dayandırılıb. **Tam həll (oxu yolu + UI + GDPR) AUDIT-TASK-8-dədir, hələ başlanmayıb** |

### 🟠 HIGH Tapıntılar (7)

| ID | Təsvir | Vəziyyət | Bağlayan task |
|---|---|---|---|
| **H-1** | Komanda RBAC-da `'*'` wildcard eskalasiyası | ✅ **BAĞLANDI** | AUDIT-TASK-3 | 
| **H-2** | `/api/admin/admins` admin qapısı olmadan açıq | ✅ **BAĞLANDI** | AUDIT-TASK-1 |
| **H-3** | Rate limiter atomik deyil (KV yarışı) | ❌ **AÇIQ** | Gözləyir: AUDIT-TASK-9 |
| **H-4** | 171 route-un 107-sində rate limit yoxdur | ✅ **BAĞLANDI** | AUDIT-TASK-4 |
| **H-5** | XP anti-abuse tamamilə yoxdur (sonsuz XP) | ❌ **AÇIQ** | Gözləyir: AUDIT-TASK-9 |
| **H-6** | WebSocket avtorizasiyası yalnız upgrade anında | ❌ **AÇIQ** | Gözləyir: AUDIT-TASK-9 |
| **H-7** | İstehsal migration-larında demo seed datası | ✅ **BAĞLANDI** | AUDIT-TASK-5 |

### 🟡 MEDIUM Tapıntılar (17)

| ID | Təsvir | Vəziyyət | Bağlayan task |
|---|---|---|---|
| **M-1** | CSRF token yoxdur | ⚠️ **QISMƏN** (AUDIT-TASK-6) | Yalnız log rejimində — `csrf_suspect` hadisəsi qeydə alınır, sorğu bloklanmır. Bloklamaya keçid real trafik datası toplandıqdan sonra |
| **M-2** | PBKDF2 100k iterasiya (OWASP: 600k) | ✅ **BAĞLANDI** | AUDIT-TASK-6 — köçürmə mexanizmi ilə (600k + `pass_iter` sütunu) |
| **M-3** | `CSP: style-src 'unsafe-inline'` | ❌ **AÇIQ** | AUDIT-TASK-10 (böyük iş) |
| **M-4** | RoomDO in-memory state hibernation-da itir | ❌ **AÇIQ** | Gözləyir: AUDIT-TASK-9 |
| **M-5** | `blocks` JSON ölçü limiti yoxdur | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-6** | `createTeam` name/description clamp etmir | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-7** | `updateTeam` avatar/banner validasiya olunmur | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-8** | `bumpActivity` lost update | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-9** | `mapUser` hər kəsin settings-ini yayımlayır | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-10** | Bloklanmış istifadəçinin məzmunu feed-də qalır | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-11** | `adminTeamAction` audit log-a yazmır | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-12** | `unlinkOAuth` admin_logs-a yazır (yanlış yer) | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-13** | `adminLogAction` ixtiyari log yazmağa icazə verir | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-14** | `adminRemoveAdmin` son admini silməyə icazə verir | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-15** | `createTeamTask.assigneeId` üzvlük yoxlanmır | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **M-16** | `.gitignore` qaydası backslash ilə → işləmir | ✅ **BAĞLANDI** | AUDIT-TASK-1 |
| **M-17** | `hexToBytes` boş salt-da runtime xətası | ✅ **BAĞLANDI** | AUDIT-TASK-6 |

### 🔵 LOW Tapıntılar (8)

| ID | Təsvir | Vəziyyət | Bağlayan task |
|---|---|---|---|
| **L-1** | `X-XSS-Protection` başlığı | ✅ **BAĞLANDI** | AUDIT-TASK-1 |
| **L-2** | OAuth-da PKCE yoxdur | ❌ **AÇIQ** | Təyin olunmayıb (aşağı risk) |
| **L-3** | `LIKE` naxışlarında wildcard escape edilmir | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **L-4** | `createReport.targetUid` varlıq yoxlaması yoxdur | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **L-5** | `resolveReport` ixtiyari status qəbul edir | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **L-6** | `getTeamActivity.before` NaN yoxlanmır | ✅ **BAĞLANDI** | AUDIT-TASK-6 |
| **L-7** | R2-də path traversal (istismar edilə bilməz) | ✅ **BAĞLANDI** | AUDIT-TASK-7 — `canReadKey`-də `..` / `//` bloklanır |
| **L-8** | JSON-LD `sameAs` uydurma profillərə işarə edir | ✅ **BAĞLANDI** | AUDIT-TASK-2 |

---

## Struktur / Proses Borcu Vəziyyəti

| # | Borc | Vəziyyət | Qeyd |
|---|---|---|---|
| 1 | `routes.ts` 140 KB monolit | ❌ **AÇIQ** | AUDIT-TASK-10 (indi ~160 KB, artıb) |
| 2 | 23 boş service stub + 6 boş workflow | ❌ **AÇIQ** | AUDIT-TASK-10 (strateji qərar: doldur ya sil) |
| 3 | `legacy/` + `testsprite_tests/` | ✅ **BAĞLANDI** | AUDIT-TASK-1 |
| 4 | İki `notify()` implementasiyası | ❌ **AÇIQ** | AUDIT-TASK-10 |
| 5 | İki presence sistemi (D1 + DO) | ❌ **AÇIQ** | AUDIT-TASK-10 |
| 6 | `styles.css` 179 KB bölünməmiş | ❌ **AÇIQ** | AUDIT-TASK-10 |
| 7 | `favicon.svg` 255 KB | ❌ **AÇIQ** | AUDIT-TASK-10 |
| 8 | CI/CD yoxdur | ❌ **AÇIQ** | AUDIT-TASK-10 |
| 9 | Lint/formatter yoxdur | ❌ **AÇIQ** | AUDIT-TASK-10 |
| 10 | Staging mühiti yoxdur | ❌ **AÇIQ** | AUDIT-TASK-10 |
| 11 | Sənəd statusları köhnəlmiş | ⚠️ **QISMƏN** | Report faylları yaradılıb |
| 12 | Legal placeholder-lər | ✅ **BAĞLANDI** | AUDIT-TASK-2 (bəzi açıq öhdəliklər: VÖEN, peşəkar hüquqi baxış) |
| 13 | GDPR ixracı natamam | ❌ **AÇIQ** | AUDIT-TASK-8 |
| 14 | Domen uyğunsuzluğu | ✅ **BAĞLANDI** | AUDIT-TASK-2 — `SITE_ORIGIN` vahidləşdirilib |

---

## Rəqəmsal Xülasə

### Tapıntıların bağlanma faizi

| Kateqoriya | Cəmi | Bağlı | Qismən/Müvəqqəti | Açıq | Bağlanma % |
|---|---|---|---|---|---|
| 🔴 Critical | 3 | 2 | 1 (C-3 müvəqqəti) | 0 | **67%** (tam: 2/3) |
| 🟠 High | 7 | 4 | 0 | 3 | **57%** |
| 🟡 Medium | 17 | 14 | 1 (M-1 log rejimi) | 2 | **82%** |
| 🔵 Low | 8 | 7 | 0 | 1 | **88%** |
| Struktur/Proses | 14 | 4 | 1 | 9 | **29%** |
| **CƏMİ tapıntılar** | **35** | **27** | **2** | **6** | **77%** |
| **CƏMİ (borc daxil)** | **49** | **31** | **3** | **15** | **63%** |

### Task tamamlanma faizi

- **Tamamlanan task-lar:** 7 / 10 = **70%**
- **Qalan task-lar:** 3 (AUDIT-TASK-8, 9, 10)
- **Qalan iş həcmi (roadmap təxmini):** ≈ 15.5–25.5 iş günü

---

## Hələ Başlanmamış 3 Task — Detallı Analiz

### AUDIT-TASK-8 — Arxiv oxu yolu + GDPR ixracı (~2 gün)

> [!WARNING]
> C-3-ün tam həlli. Hazırda silmə dayandırılıb (`ARCHIVE_HOT_DAYS=3650`), lakin **oxu yolu hələ yoxdur**.

**Nə olmalıdır:**
- `GET /api/rooms/:id/messages?before=<ts>` — D1-dəki mesajlar bitəndə `readArchive()` çağırsın
- `GET /api/dms/:pair/messages?before=<ts>` — eyni
- UI-da "daha köhnə mesajları yüklə" düyməsi (chat və DM)
- GDPR ixracına arxiv + komanda datası + `contact_messages` daxil edilməsi
- İş bitdikdən sonra `ARCHIVE_HOT_DAYS` → `"90"` qaytarılmalıdır

**Doğrulama:**
- `readArchive()` hələ yalnız tərif kimi qalır — kodda `grep` heç bir çağırış göstərmir
- `ARCHIVE_HOT_DAYS` `wrangler.jsonc:89`-da `"3650"` olaraq müvəqqəti dəyərdədir

---

### AUDIT-TASK-9 — Runtime təhlükəsizliyi + XP bütövlüyü (~3.5 gün)

> [!IMPORTANT]
> 3 High tapıntını (H-3, H-5, H-6) və 1 Medium-u (M-4) bağlayır.

**Nə olmalıdır:**

| Tapıntı | İş |
|---|---|
| **H-3** — Atomik rate limiter | KV read-then-write yarışı → Cloudflare native binding / `RateLimitDO` |
| **H-5** — XP anti-abuse | `xp_logs (uid, source, ref_id) UNIQUE` + gündəlik tavan + `deletePost` kompensasiya + `submitSolution` təkrar-təsdiq bağlanması |
| **H-6** — WS yenidən-avtorizasiya | `RoomDO.handleSend`-də periodik üzvlük yoxlaması + `removeMember`/`revokeAllSessions` → `disconnect(uid)` RPC |
| **M-4** — RoomDO state itkisi | `seq`, `seenCids`, `buckets` → `ctx.storage` (SQLite) |

**Doğrulama:**
- Rate limiter hələ KV-əsaslıdır (AUDIT-TASK-4 yalnız əhatəni genişləndirdi, mexanizmi dəyişmədi)
- `xp_logs` cədvəli migration-larda **yoxdur** — `grep -rn xp_logs migrations/` boşdur
- WS-də periodik yenidən yoxlama kodda **yoxdur**

---

### AUDIT-TASK-10 — Platform yetkinliyi + strateji qərar (~10-20 gün)

> [!CAUTION]
> Ən böyük task — bütün struktur/proses borcunu və strateji qərarları əhatə edir.

**Əsas iş bəndləri:**

| Bənd | Təsvir | Həcm |
|---|---|---|
| CI/CD qurulması | GitHub Actions: `tsc` → `eslint` → `playwright test` → migration yoxlama → deploy | 1 gün |
| ESLint + Prettier | `js/` (450 KB) heç bir statik analizdən keçmir | 1 gün |
| `routes.ts` bölünməsi | 160 KB → `routes/{auth,users,posts,comments,...}.ts` | 2 gün |
| Polling → WS siqnalına keçid | 20 polling dövrünü 30 s "safety net"-ə endirmə | 2 gün |
| `feed()` cursor pagination | Hazırda `LIMIT 60`, cursor yoxdur | 1.5 gün |
| `observability.enabled: true` | + strukturlu log + request ID + alerting | 0.5 gün |
| RoomDO state → `ctx.storage` | `seq`, `seenCids`, `buckets` | 0.5 gün |
| `notify()` dublikatının birləşdirilməsi | İki müstəqil implementasiya | 0.5 gün |
| **TASK-10 qərarı** | `services/` stub-larını doldur (6-10 gün) **YA DA** sil + sənədi yenilə (0.5 gün) | Qərar tələb edir |
| **PRD/TDD qərarı** | 17 cədvəllik progression sistemi icra et (8-12 gün) **YA DA** sənədi reallığa uyğunlaşdır (0.5 gün) | Qərar tələb edir |

**Doğrulama — hələ mövcud olan boşluqlar:**
- **23 boş service stub** hələ qalır (30-38 bayt fayllar)
- **6 boş workflow** hələ qalır (179-320 bayt)
- `observability.enabled` hələ `false`
- `.github/` qovluğu yoxdur — CI yoxdur
- ESLint/Prettier konfiqurasiyası yoxdur
- `routes.ts` **indi 160 KB** (auditdəki 140 KB-dan böyüyüb — yeni düzəlişlər əlavə olunub)

---

## Audit-dən Sonra Əldə Edilən Əlavə Qazanclar

Task-ların icrası zamanı audit sənədində **olmayan** aşağıdakı əlavə işlər görülüb:

| İş | Mənbə |
|---|---|
| **Git repo qurulub** (əvvəl mövcud deyildi!) | AUDIT-TASK-1 |
| **CDN keş boşluğu aşkarlanıb və bağlanıb** (`public, immutable` → prefiks-əsaslı) | AUDIT-TASK-7 |
| **`tsconfig.e2e.json`** yaradılıb — 12 gizli TS xətası üzə çıxıb | AUDIT-TASK-6 |
| **`/api/health`** bootstrap yoxlaması əlavə edilib | AUDIT-TASK-6 |
| **DB əməliyyat jurnalı** başladılıb | AUDIT-TASK-5 |
| **Eskalasiya qadağası** (icazə altçoxluğu + prioritet yoxlaması) | AUDIT-TASK-3 |
| **Sızma qiymətləndirməsi** — R2 inventarı Cloudflare REST API ilə çıxarılıb, istismar izi axtarılıb | AUDIT-TASK-7 |
| **Dəvət emailinin ölü linki düzəldilib** (`APP_URL` əlavə olunub) | AUDIT-TASK-2 |
| PBKDF2 köçürmə mexanizmi (`pass_iter` sütunu, `waitUntil` yenidən heşləmə) | AUDIT-TASK-6 |
| **`e2e/files-auth.spec.ts`** — 16 KB yeni E2E test (IDOR senarilər) | AUDIT-TASK-7 |
| Migration README yazılıb (qayda sənədi) | AUDIT-TASK-5 |
| Rate limit açarına `uid` əlavə olunub (əvvəl yalnız IP idi) | AUDIT-TASK-4 |

---

## Açıq Öhdəliklər (istifadəçi qərarı gözləyən)

Aşağıdakılar kod deyil, **istifadəçi tərəfindən qərar/əməliyyat** tələb edir:

| Öhdəlik | Mənbə | Vəziyyət |
|---|---|---|
| `collabix.az` DNS + MX qurulması | AUDIT-TASK-2 | ⏳ gözləyir |
| VÖEN, rəsmi sosial profillər | AUDIT-TASK-2 | ⏳ gözləyir |
| Hüquqi mətnin peşəkar hüquqşünas tərəfindən baxışı | AUDIT-TASK-2 | ⏳ gözləyir |
| İstehsalda p50/p95 gecikmə ölçməsi | AUDIT-TASK-4 | ⏳ Workers Analytics tələb edir |
| **TASK-10 strateji qərarı:** boş stub-ları doldur ya sil? | AUDIT-TASK-10 | ❓ qərar verilməyib |
| **PRD/TDD strateji qərarı:** icra et ya sənədi yenilə? | AUDIT-TASK-10 | ❓ qərar verilməyib |
| CSRF-i log rejimindən bloklamaya keçirmə | AUDIT-TASK-6 | ⏳ real trafik datası lazımdır |

---

## Yekun Hökm

### Nə EDİLİB (7 task, ≈14 gün iş):

✅ Bütün **Sprint 0** (buraxılış blokerlər) tamamlanıb:
- Açıq mətnli parollar silinib, repo təmizlənib, git qurulub
- `/files/*` IDOR zənciri — ən kritik boşluq — tam bağlanıb (+ auditin tapmadığı CDN keş boşluğu)
- Admin qapısı bağlanıb, arxiv silmə dayandırılıb
- RBAC eskalasiyası bağlanıb (wildcard + altçoxluq + prioritet)
- Rate limit 107 route-dan 0-a enib
- Demo seed təmizlənib, migration qaydaları yazılıb
- 15 Medium + 4 Low validasiya boşluğu bağlanıb
- PBKDF2 600k-ya yüksəldilib (köçürmə mexanizmi ilə)
- Hüquqi placeholder-lər əvəzlənib, domen vahidləşdirilib

### Nə QALIR (3 task, ≈15.5–25.5 gün iş):

❌ **C-3 tam həlli** — arxiv oxu yolu + UI + GDPR (AUDIT-TASK-8)
❌ **H-3** — Atomik rate limiter (AUDIT-TASK-9)
❌ **H-5** — XP anti-abuse (AUDIT-TASK-9)
❌ **H-6** — WS yenidən-avtorizasiya (AUDIT-TASK-9)
❌ **M-4** — RoomDO state itkisi (AUDIT-TASK-9)
❌ Bütün **struktur/proses borcu**: CI/CD, lint, `routes.ts` bölünməsi, polling→WS, cursor pagination, observability
❌ **Strateji qərar**: 23 boş stub + 6 boş workflow + PRD/TDD — icra etmək ya sənədi uyğunlaşdırmaq?

### Layihə Metrikləri — Audit Vaxtı vs İndi

| Göstərici | Audit vaxtı (26 İyul) | İndi (28 İyul) | Dəyişiklik |
|---|---|---|---|
| Route sayı | 171 | **172** | +1 (`/api/health`) |
| `routes.ts` ölçüsü | 140 KB | **160 KB** | ⬆️ +20 KB (düzəlişlər) |
| Migration faylları | 19 | **30** | +11 yeni migration |
| E2E spec faylları | 19 | **26** | +7 yeni spec |
| E2E `test()` çağırışları | 150 | **254** | ⬆️ +104 yeni test |
| Worker TS faylları | ~45 | **76** | +31 (files-auth, middleware, etc.) |
| `legacy/` qovluğu | Mövcud (2.1 MB) | **SİLİNİB** | ✅ |
| `testsprite_tests/` qovluğu | Mövcud | **SİLİNİB** | ✅ |
| Git repo | **YOXDUR** | **MÖVCUDDUR** | ✅ |
| Boş service stub-ları | 23 | **23 (dəyişməyib)** | ❌ hələ açıq |
| Boş workflow-lar | 6 | **6 (dəyişməyib)** | ❌ hələ açıq |
| `observability.enabled` | `false` | **`false` (dəyişməyib)** | ❌ hələ açıq |
| CI/CD (`.github/`) | Yoxdur | **Yoxdur** | ❌ hələ açıq |
| ESLint/Prettier | Yoxdur | **Yoxdur** | ❌ hələ açıq |
| `xp_logs` cədvəli | Yoxdur | **Yoxdur** | ❌ hələ açıq |

### Faiz cədvəli:

| Ölçü | Dəyər |
|---|---|
| Tamamlanan task-lar | **7 / 10 (70%)** |
| Bağlanan tapıntılar (Critical+High+Medium+Low) | **27 / 35 (77%)** |
| Bağlanan tapıntılar + borc bəndləri | **31 / 49 (63%)** |
| Sprint 0 (buraxılış blokerlər) | **100% tamamlanıb** |
| Sprint 1 bəndləri | **~30%** (yalnız rate limit əhatəsi və hüquqi) |
| Sprint 2-3 bəndləri | **~5%** (demək olar ki, başlanmayıb) |

> [!IMPORTANT]
> **Sprint 0 tamamilə bitib** — layihə artıq "buraxılış bloklanmalıdır" vəziyyətindən çıxıb. Amma **Sprint 1-dən 3 High tapıntı (H-3, H-5, H-6)** və **C-3-ün tam həlli** hələ açıqdır — buraxılışdan dərhal sonra bağlanmalıdır. Struktur/proses borcu isə uzunmüddətli investisiyadır.
