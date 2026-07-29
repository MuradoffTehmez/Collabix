# Arxitektura — modul quruluşu və silinmiş niyyətlər

**AUDIT-TASK-10 / Faza 3.3** (qərar **B2 + B3**).

Audit tapıntısı: *"23 boş service stub-u + 6 boş workflow"* — struktur borcu #2.

> Qərar B2 = **doldur**, B3 = **sənədləşdir + sil**.
> *"Doldurula bilməyənlər (B3) ilə silinir."*

Bu sənəd **silinən niyyəti qeydə alır** ki, fayl silinməklə birlikdə
arxitektura fikri də itməsin.

---

## 1. Niyə boş stub aktiv zərərdir

Boş fayl **koda baxan hər kəsə yalan danışır**:

| Yalan | Nəticə |
|---|---|
| `services/ai/moderation.ts` var | "AI moderasiyası qurulub" — yoxdur, `export class {}` idi |
| `workflows/leaderboard.ts` var | "Reytinq cədvəli fon işi ilə hesablanır" — heç yerdən çağırılmırdı |
| `WorkflowParams` içində `DigestWorkflow` | tip birləşməsi "gündəlik xülasə var" deyirdi; `runDigest` yalnız `console.log` edirdi |

Audit bunu məhz bu səbəbdən **"illüziya"** adlandırır. Silinmə funksionallıq
itkisi DEYİL — heç bir fayl idxal olunmurdu, heç bir marşrut onlara çatmırdı.

**Yoxlama üsulu (silmədən əvvəl icra olundu):** hər stub adı üçün
`grep -rn "services/<ad>" --include=*.ts worker e2e test` → **hamısı 0 nəticə**.
Workflow-lar üçün funksiya adı üzrə axtarış → `processUserRegistered` və
`processTeamOnboardingWorkflow` istisna olmaqla **hamısı 0 çağırış**.

---

## 2. B2 — DOLDURULAN (davranış qazandı)

### `runWelcome` — `worker/workflows/index.ts`

**Vəziyyət:** ✅ dolduruldu.

Bu, siyahıdakı yeganə **çatıla bilən, lakin içi boş** iş idi: `queue.ts` →
`processUserRegistered` onu REAL yaradırdı, workflow 1 gün gözləyirdi və
sonra yalnız `console.log('Sending followup email…')` edirdi.

⚠ Bu, TASK-11-də `runTeamOnboarding` üçün düzəldilən qüsurun **eyni sinfidir**:
"workflow yaradılır, amma heç bir addım icra olunmur".

**İndi:** 1 gün sonra ilk paylaşım xatırlatması, 3 gün sonra profil tamamlama
xatırlatması. Hər addım əvvəlcə REAL vəziyyəti yoxlayır — fəal istifadəçiyə
xatırlatma getmir.

⚠ **E-poçt deyil, tətbiqdaxili bildiriş.** E-poçt yolu `EMAIL` binding-inə
bağlıdır və qurulmayan quraşdırmada səssizcə heç nə etməzdi — illüziyanı
yenidən qurardıq.

### Marşrut modulları — `worker/routes/`

Faza 3.1-də `routes.ts` (185 KB) **14 modula** bölündü. Stub adları hədəf
struktur kimi işləndi (B2-nin əsas tətbiqi):

```
worker/routes/  shared · auth · auth-guard · auth-methods · admin · post
                room · user · task · export · search · public · upload · moderation
```

`routes.ts` **4,7 KB barrel** kimi qaldı — `index.ts` dəyişmədi.

---

## 3. B3 — SİLİNƏN (niyyət burada qeydə alınır)

### 3.1 · `services/ai/*` (8 fayl)

`chat` · `embedding` · `summary` · `mentor` · `review` · `translation` · `quiz` · `moderation`

**Niyyət:** hər AI qabiliyyəti ayrıca modul olsun.

**Reallıq:** `services/ai/index.ts` → `AIService` **artıq işləyir** və
`chat()`, `embed()`, `summarize()` metodlarını `providers/ai`-yə ötürür.
Qalan beşi (mentor, review, translation, quiz, moderation) **yazılmamış
məhsul funksiyalarıdır**, kod borcu deyil.

**Gələcəkdə:** funksiya REAL tələb olunanda `AIService`-ə metod kimi əlavə
edilsin; fayl ancaq metod böyüyəndə ayrılsın. Boş fayl əvvəlcədən
yaradılmasın.

### 3.2 · `services/browser/*` (5 fayl)

`pdf` · `screenshot` · `resume` · `portfolio` · `certificate`

**Reallıq:** `services/browser/index.ts` → `BrowserService.generatePDF()`
işləyir (`@cloudflare/puppeteer`) və `jobs/render.ts` onu çağırır. Qalanı
Browser Rendering üzərində qurulacaq **məhsul ideyalarıdır**.

⚠ Hər biri `BROWSER` binding-i tələb edir — quraşdırılmayıbsa onsuz da
`throw` edir. Yəni boş fayllar heç bir konfiqurasiyada işə düşməzdi.

### 3.3 · `services/search/*` (3 fayl)

`keyword` · `semantic` · `hybrid`

**Reallıq:**
- **keyword** axtarışı ARTIQ VAR — `worker/routes/search.ts`, FTS5
  (`posts_fts`, Faza 5/#4-də tam gövdəyə genişləndirildi). Ayrı modul
  dublikat olardı.
- **semantic** ARTIQ VAR — `services/search/index.ts` → `semanticSearch()`
  (Vectorize).
- **hybrid** (ikisinin çəkili birləşməsi) yazılmayıb və **ölçülmüş ehtiyac
  yoxdur**: FTS nəticələri hazırda kifayətdir.

### 3.4 · `services/vector/*` (6 fayl)

`post` · `comment` · `task` · `wiki` · `course` · `documentation`

**Niyyət:** hər məzmun növü üçün ayrıca indeksləmə adapteri.

**Reallıq:** `services/vector/index.ts` → `VectorService.insertDocument()`
**növdən asılı deyil** — `metadata` ilə hər məzmunu qəbul edir. Altı adapter
eyni kodun altı nüsxəsi olardı.

⚠ `wiki`, `course`, `documentation` — bu üç məzmun növü **məhsulda
ÜMUMİYYƏTLƏ YOXDUR**. Cədvəlləri də yoxdur.

### 3.5 · `workflows/*` (7 fayl)

| Fayl | Niyyət | Niyə silindi |
|---|---|---|
| `cleanup.ts` | köhnə datanın təmizlənməsi | ✅ ARTIQ VAR: `archive.ts` → `runArchiveJob` (arxivləmə + bildiriş prune + `stats_rollup`), `scheduled` handler-dən çağırılır |
| `daily_digest.ts` | gündəlik xülasə e-poçtu | heç yerdən çağırılmırdı; `runDigest` yalnız `console.log` edirdi → `DigestWorkflow` tipi də silindi |
| `leaderboard.ts` | reytinq hesablaması | reytinq hazırda **canlı sorğu** ilə gəlir (`stats`); fon işi ölçülmüş ehtiyac deyil |
| `inactive_user.ts` | fəaliyyətsiz istifadəçiyə xatırlatma | yazılmayıb; `runWelcome` onboarding hissəsini onsuz da örtür |
| `report_generation.ts` | hesabat generasiyası | GDPR ixracı ARTIQ VAR (`routes/export.ts`, Task 8) |
| `contest.ts` | müsabiqə | məhsulda müsabiqə anlayışı yoxdur |
| `certificate.ts` | sertifikat PDF-i | kurs/sertifikat məhsulda yoxdur |

---

## 4. Qalan REAL modul xəritəsi

```
worker/
  index.ts            marşrut cədvəli + fetch/queue/scheduled handler-ləri
  routes.ts           barrel (4,7 KB) → routes/*
  routes/             14 domen modulu
  services/
    ai/               AIService (chat, embed, summarize)
    browser/          BrowserService (generatePDF)
    search/           SearchService (semanticSearch)
    vector/           VectorService (insertDocument)
    queue/            QueueService (publish + sinxron fallback)
    notification/     NotificationService (notify, pushSignal)
    team/             13 modul — komanda domeni (TASK-11)
  jobs/               ai · render · team — növbə istehlakçıları
  workflows/          index.ts (CollabixWorkflow) · welcome.ts · team_onboarding.ts
  events/             SystemEvent tipləri
```

**Qayda (bundan sonra):** modul faylı **ilk real implementasiya ilə birlikdə**
yaradılır. Ad ehtiyatı üçün boş fayl yaradılmır — niyyət bu sənəddə yazılır.

---

## 5. İki RBAC sistemi — QƏSDƏN ayrıdır

Bu, tez-tez dublikat kimi görünür, ona görə burada qeyd olunur:

| Sistem | Yer | Əhatə |
|---|---|---|
| **Sayt RBAC-ı** | `worker/rbac.ts` + `roles`/`permissions` cədvəlləri | qlobal rollar (PRD §6), moderasiya |
| **Komanda RBAC-ı** | `services/team/permissions.ts` | komanda DAXİLİ rollar, hər komanda üçün ayrı |

⚠ **Birləşdirilməməlidir.** Komanda rolu komanda-spesifikdir (eyni istifadəçi
A komandasında Owner, B-də Viewer ola bilər); sayt rolu qlobaldır.
`services/team/permissions.ts`-də Owner bazada `["*"]` wildcard-ıdır —
`hasPermission`-dan wildcard-ı silmək BÜTÜN Owner-ləri kilidləyər.

---

## 6. İki presence sistemi — QƏSDƏN ayrıdır

| Sistem | Sual | İstifadə |
|---|---|---|
| **D1 `presence` cədvəli** | "son 2 dəqiqədə fəal idimi?" | tarixçə + WS qoşulmayan client üçün fallback |
| **`PresenceDO`** | "İNDİ qoşulubmu?" | real-time siqnal marşrutlaşdırması (`pushSignal`) |

Dublikat **cədvəllər deyil, POLLING modelidir** — bax Faza 5/#3
(`docs/AUDIT-TASK-10-REPORT.md`).
