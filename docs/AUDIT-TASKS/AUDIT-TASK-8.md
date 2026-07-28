# AUDIT-TASK-8 — Arxiv Oxu Yolu və GDPR İxracının Tamlığı

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md` §C-3 (sətir 363–385), hüquqi risk #13 (sətir 662)
**Əlavə mənbələr:** `AUDIT-TASK-2-LEGAL-GAPS.md` §2.2, §2.3 · `AUDIT-TASK-7-REPORT.md` §7, §9 · `audit_analysis.md`
**Bağlanan tapıntılar:** **C-3** (Critical — data availability itkisi), hüquqi risk #13 (GDPR ixracı natamam)
**Təxmini həcm:** 2,5–3 gün
**Ön şərt:** AUDIT-TASK-7 tamamlanmış olmalıdır + ⚠️ **E2E baseline yaşıl olmalıdır** (bax 8.0/Sual 0)
**Risk sinfi:** 🟠 Orta-yüksək — geri qaytarma addımı (`ARCHIVE_HOT_DAYS` → `"90"`) **geri dönməz data silməsini işə salır**

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-8  Arxiv oxu yolunu qur: ?before= endpoint-ləri (otaq + DM) D1 bitəndə
               readArchive() çağırsın; UI-da "daha köhnə" yükləmə.
               ⚠️ /files/archive/-dən KEÇMƏ — Task 7 sərhədi: server tərəfdə oxu, JSON qaytar.
               GDPR ixracına arxiv + komanda datası + contact_messages əlavə et.
               ⚠️ Silinmiş hesabın arxiv mesajları — unudulmaq hüququ boşluğu (auditdə yox).
               Privacy §4-ə arxivləmə açıqlaması ƏVVƏLCƏ, sonra ARCHIVE_HOT_DAYS → "90".
               DONE: 90 gündən köhnə mesaj UI-dan oxunur; ixrac tam; Privacy faktla uyğun;
                     ilk cron dry-run ilə doğrulanıb.
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli backend mühəndisisən**.

Bu task iki hissədən ibarətdir və onların **riskləri fərqlidir**:

| Hissə | Risk | Xarakter |
|---|---|---|
| **Oxu yolunun qurulması** (8.1–8.5) | 🟡 Orta | Yeni funksionallıq; sınsa mövcud davranış qalır |
| **`ARCHIVE_HOT_DAYS` → `"90"`** (8.8) | 🔴 **Yüksək** | Gündəlik cron-u **geri dönməz silməyə** buraxır |

İkinci hissə **birincinin tam işlədiyi sübut olunmadan icra edilmir.** Ardıcıllıq bağlayıcıdır: oxu → test → hüquqi mətn → dry-run → yalnız sonra geri qaytarma.

**Xüsusi diqqət:** Task 1-dən bəri (`ARCHIVE_HOT_DAYS = 3650`) **heç bir arxivləmə baş verməyib**. Yəni yazı yolu real şəraitdə **heç vaxt yoxlanılmayıb** və R2-də `archive/` boş ola bilər. Bu, task-ın gizli çətinliyidir — bax 8.0/Sual 3.

---

## 2. KONTEKST

### 2.a Tapıntı — C-3

**Yer:** `worker/archive.ts:127` (`readArchive`) + `wrangler.jsonc` (cron `17 3 * * *`, `ARCHIVE_HOT_DAYS`)

Gündəlik cron `ARCHIVE_HOT_DAYS`-dən köhnə `room_messages` və `dm_messages` sətirlərini R2-yə yazır və **D1-dən SİLİR** (`archive.ts:88`).

Oxu funksiyası `readArchive()` yazılıb, lakin:
```
grep -rn "readArchive" worker/ js/  →  worker/archive.ts:127 (yalnız tərif)
```

**API endpoint yoxdur. UI-da "daha köhnə mesajları yüklə" yoxdur.** `roomMessages` (`routes.ts:1117`) yalnız D1-dən `LIMIT 120` oxuyur.

**Təsir:** Dəyər `"90"`-a qaytarılarsa, 90 gündən sonra istifadəçilər mesaj tarixçəsini **itirmiş görəcək**. Data R2-də qalır, lakin məhsul vasitəsilə bərpa edilə bilməz. Sükutlu, gecikməli, istifadəçi üçün geri dönməz.

### 2.b Tapıntı — hüquqi risk #13 (GDPR ixracı natamam)

`exportMyData` (`routes.ts:1935-1951`) yalnız D1-dən oxuyur. İxraca **daxil deyil**:
- Arxivlənmiş mesajlar (C-3-lə eyni kök)
- `contact_messages`
- Komanda datası: `team_members`, `team_tasks`, `team_posts`, `team_files`

`AUDIT-TASK-2-LEGAL-GAPS.md` §2.3 əlavə edir: Privacy mətni istifadəçini **əl ilə müraciətə** yönləndirir, halbuki `GET /api/me/export?format=json|csv` self-service hazırdır — mətn köhnəlmişdir.

### 2.c 🔴 Hüquqi ön şərt — LEGAL-GAPS §2.2

> Hazırkı vəziyyət: `ARCHIVE_HOT_DAYS = 3650` → praktikada heç bir mesaj silinmir, yəni **istifadəçiyə görünən ziddiyyət YOXDUR**.
>
> ⚠ **LAKIN:** dəyər `"90"`-a qaytarıldıqda 90 gündən köhnə mesajlar D1-dən silinməyə başlayacaq. **Həmin andan əvvəl** Privacy §4-ə arxivləmə və saxlama müddəti yazılmalıdır — əks halda mətn faktiki davranışla ziddiyyətə düşəcək.

**Bu, bağlayıcı ardıcıllıqdır:** hüquqi mətn → sonra `"90"`. Tərsinə etmək uyğunluq pozuntusudur.

### 2.d 🔴 Task 7 sərhədi — pozulmamalıdır

`AUDIT-TASK-7-REPORT.md` §7 (kodda `worker/files-auth.ts` başlığında da yazılıb):

```
❌ SƏHV: Task 8 istifadəçiyə `/files/archive/...` verir
   → canReadKey-i zəiflətmək tələb olunar → C-1 qismən yenidən açılar

✅ DÜZGÜN: Task 8 ayrıca API endpoint-i qurur
   GET /api/rooms/:id/messages?before=<ts>
   → endpoint öz avtorizasiyasını edir (otaq üzvlüyü / DM iştirakçılığı)
   → R2-dən SERVER TƏRƏFDƏ oxuyur (worker/archive.ts → readArchive)
   → JSON qaytarır, R2 açarını client-ə HEÇ VAXT vermir
```

`archive/` prefiksi Task 7-də `isAdmin()` ilə bağlanıb. **Bu task ona toxunmur.**

### 2.e Auditin qeyd etmədiyi dörd problem

Bu task onları da həll edir:

| # | Problem | Bənd |
|---|---|---|
| 1 | 🔴 **Silinmiş hesabın mesajları arxivdə qalır** — GDPR "unudulmaq hüququ" pozuntusu | 8.6 |
| 2 | 🔴 **Performans:** gzip dump-ın açılması hər `before=` sorğusunda CPU limitini aşa bilər | 8.3 |
| 3 | 🟠 **Sərhəd problemi:** D1-in ən köhnə mesajı ilə arxivin ən yenisi arasında dublikat və ya boşluq | 8.2 |
| 4 | 🟠 **Yazı yolu heç vaxt real işləməyib** — geri qaytarma ilk dəfə kütləvi silmə edəcək | 8.8 |

### 2.f Əvvəlki task-lardan gələn dərslər

| Mənbə | Dərs | Tətbiqi |
|---|---|---|
| Task 6 §8/2 | İki "sadə düzəliş" reqressiya yaratdı | Hər bənddən sonra E2E |
| Task 7 §9 | **80 mövcud sınıq test** | 8.0/Sual 0 — baseline qapısı |
| Task 7 §8/1 | `photo_url` ikiqat prefiks — mövcud, gizli qüsur | Arxiv məlumat formatını **oxuyaraq** yoxla, fərz etmə |
| Task 5 §5.1 | Silmədən əvvəl sübut | 8.8 dry-run |
| Task 4 §5.2 | KV yazı amplifikasiyası ölçüldü | 8.3-də R2 oxu xərcini ölç |

---

## 3. ƏHATƏ — 10 BƏND

---

### 8.0 · Vəziyyət xəritəsi (ÖN İŞ)

**Həcm:** 2 saat · **kod dəyişikliyi yoxdur**

#### 🔴 Sual 0 — E2E baseline qapısı (BAĞLAYICI)

`AUDIT-TASK-7-REPORT.md` §9:
> **E2E dəstində 80 mövcud sınıq test** — bu task-dan DEYİL, lakin açıq qalır: (a) admin paneli `.admin-user-row` CSS ilə gizlidir, (b) mobile layihəsində paylaşılan sessiya qüsuru. **Yaşıl baseline olmadan növbəti task-ların reqressiyası görünməz qalır.**

```bash
npx playwright test 2>&1 | tail -20
```

| Nəticə | Əməliyyat |
|---|---|
| Baseline yaşıldır | ✅ Davam et |
| 80 sınıq test qalır | ⚠️ **DAYAN** — istifadəçidən qərar istə: (a) əvvəlcə baseline bərpa edilsin, (b) Task 8 mövcud sınıq testlər siyahısı ilə davam etsin və **yalnız yeni sınıqlar** reqressiya sayılsın |

**Tövsiyə: (a).** Səbəb: bu task `ARCHIVE_HOT_DAYS`-i geri qaytarır — geri dönməz silməni işə salan addım. Onu qeyri-müəyyən test bazası üzərində etmək məqbul deyil.

#### Sual 1 — Arxiv yazı formatı nədir?
```bash
sed -n '1,140p' worker/archive.ts
```
Cavabla:
- Açar şablonu: `archive/{room|dm}/{scope}/{nə}?` — tam format
- Qruplaşma: gün üzrə? ay üzrə? ölçü üzrə? **bir obyektdə neçə mesaj ola bilər?**
- Sıxılma: gzip? Sərhəd (`Content-Encoding` vs manual)
- Serializasiya: NDJSON? JSON massiv? Sahələr hansılardır?
- Sıralama: obyekt daxilində mesajlar `created_at` üzrə sıralanıbmı?

⚠️ **Bu suallar 8.3-ün (performans) cavabını müəyyən edir.** Bir obyekt bir aylıq mesajı saxlayırsa, `before=` sorğusu meqabaytlarla data açacaq.

#### Sual 2 — `readArchive()` imzası və davranışı
```bash
sed -n '120,175p' worker/archive.ts
```
- Parametrləri nədir? `(scope, before, limit)`?
- Neçə R2 obyekti oxuyur — birini, yoxsa siyahılayıb bir neçəsini?
- Sıralama və `limit` daxilində edilirmi?
- Xəta halında nə qaytarır?

#### Sual 3 — 🔴 R2-də faktiki arxiv datası varmı?
```bash
npx wrangler r2 object list <bucket> --prefix "archive/" | head -50
```

| Nəticə | Nəticə |
|---|---|
| Obyektlər var | ✅ Real data ilə test edilə bilər |
| **Boşdur** | ⚠️ Task 1-dən bəri arxivləmə baş verməyib → **süni test datası yaradılmalıdır** (8.9) |

⚠️ Boş olarsa: yazı yolunun **real şəraitdə heç vaxt işləmədiyi** deməkdir. `archive.spec.ts` mövcuddur (audit qeyd edir), lakin test mühiti istehsal həcmini əks etdirmir.

#### Sual 4 — Mövcud paginasiya necə işləyir?
```bash
grep -n "before\|keyset\|cursor" worker/routes.ts | grep -i "message" | head -20
sed -n '1110,1140p' worker/routes.ts
```
`roomMessages` `before=` parametrini artıq qəbul edirmi? Keyset paginasiya naxışı nədir? **Yeni endpoint mövcud naxışı təkrarlamalıdır**, yenisini icad etməməlidir.

#### Sual 5 — Avtorizasiya köməkçiləri
```bash
grep -rn "guardTeamRoom\|isRoomMember\|pairId\|canAccessDm" worker/
```
Audit `guardTeamRoom` / pairId yoxlamasına istinad edir. Task 7 `sharesThreadWith` yazıb — **onu yenidən işlət**, dublikat yazma.

#### Sual 6 — GDPR ixracının hazırkı strukturu
```bash
sed -n '1930,1990p' worker/routes.ts
grep -n "EXPORT_SECTIONS" worker/
```
- Bölmələr necə təyin olunur?
- Format: JSON + CSV. Hər ikisi arxivi dəstəkləyəcəkmi?
- Ölçü limiti varmı? Streaming işlədilirmi?

⚠️ Audit qeyd edir: **CSV formula injection qoruması** (`routes.ts:1849`) və **sirlərin çıxarılması** (`routes.ts:1956`) mövcuddur — bunları **pozma**.

#### Sual 7 — Hesab silmə arxivə toxunurmu?
```bash
grep -n "deleteAccount" -A 40 worker/routes.ts | grep -i "archive\|R2\|FILES"
```
Böyük ehtimalla **xeyr** → 8.6.

**Dayanma şərti:** Sual 0 (baseline) və Sual 1 (format) cavablanmadan kod yazma.

---

### 8.1 · Arxiv oxu — otaq mesajları

**Audit ID:** C-3/1 · **Həcm:** 3 saat

**Endpoint:** `GET /api/rooms/:id/messages?before=<ts>&limit=<n>`

**Məntiq:**

```ts
/**
 * Otaq mesajlarının oxunması — D1 + arxiv birləşdirilmiş.
 *
 * AUDIT C-3: arxivlənmiş mesajlar məhsul daxilində ƏLÇATMAZ idi.
 * readArchive() yazılmışdı, lakin heç yerdən çağırılmırdı.
 *
 * ⚠️ TASK 7 SƏRHƏDİ: R2 açarı client-ə HEÇ VAXT verilmir. Arxiv oxusu
 * server tərəfdə edilir; `/files/archive/...` isAdmin ilə bağlıdır və
 * bu endpoint ona TOXUNMUR.
 *
 * Axın:
 *   1. Avtorizasiya (otaq üzvlüyü) — arxivə keçməzdən ƏVVƏL
 *   2. D1-dən oxu (before < ts, DESC, LIMIT n)
 *   3. Nəticə n-dən azdırsa VƏ isti pəncərənin sərhədinə çatılıbsa → arxivə keç
 *   4. Arxivdən qalan sayı oxu
 *   5. Birləşdir, dublikatları at, sırala, n-ə kəs
 */
```

**Kritik detallar:**

| Detal | Tələb |
|---|---|
| **Avtorizasiya əvvəl** | Otaq üzvlüyü **arxiv oxusundan əvvəl** yoxlanılır. Fail-closed |
| **Arxivə nə vaxt keçmək** | `before` isti pəncərədən köhnədirsə **və ya** D1 nəticəsi `limit`-dən azdırsa. İkinci şərt vacibdir — sərhəd sorğusu hər iki mənbədən oxumalıdır |
| **Dublikat idarəsi** | Mesaj həm D1-də, həm arxivdə ola bilər (cron yazıb, silmə yarımçıq qalıb). `id` üzrə `Set` ilə dedupe et |
| **Boşluq idarəsi** | Əksi də mümkündür (silinib, yazılmayıb). Boşluğu **gizlətmə** — logla |
| **Cavab forması** | D1 mesajı ilə arxiv mesajı **eyni sxemdə** olmalıdır. Fərq varsa normallaşdır. Client fərqi görməməlidir |
| **`source` sahəsi** | Cavaba `source: 'live' \| 'archive'` əlavə et — **yalnız debug/telemetriya üçün**. Client məntiqi ona güvənməsin |
| **`hasMore`** | Arxivdə də bitibsə `hasMore: false`. Client sonsuz sorğu döngüsünə düşməsin |
| **Rate limit** | Task 4-ün səbətlərindən uyğununu seç. Arxiv oxusu **bahalıdır** → `read` deyil, ayrıca `archive` səbəti (məs. 60/saat) tövsiyə olunur |

⚠️ **Boş nəticə vs xəta ayrımı.** R2 obyekti yoxdursa (heç vaxt arxivlənməyib) → boş massiv, `200`. R2 xətası (şəbəkə, pozulmuş gzip) → `500` və ya deqradasiya, lakin **sükutla boş qaytarma**. Əks halda istifadəçi datanın itdiyini düşünər.

---

### 8.2 · Arxiv oxu — DM mesajları

**Audit ID:** C-3/1 · **Həcm:** 2 saat

**Endpoint:** `GET /api/dms/:pair/messages?before=<ts>&limit=<n>`

Məntiq 8.1 ilə eynidir, fərqlər:

| Fərq | Tələb |
|---|---|
| **Avtorizasiya** | `pairId` istifadəçini əhatə edirmi? Task 7-nin `sharesThreadWith` məntiqi ilə uyğunlaşdır |
| **`pairId` formatı** | Normallaşdırılmış cütlük (`min:max`)? Manipulyasiyaya qarşı yoxla |
| **Bloklanmış istifadəçi** | Task 6 M-10 bloklanmış istifadəçinin məzmununu feed-dən çıxardı. DM arxivi üçün siyasət nədir? **Mövcud `dmMessages` davranışını təkrarla**, yenisini icad etmə |
| **Arxiv scope-u** | `archive/dm/{pairId}/…` — açar formatını 8.0/Sual 1-dən götür |

⚠️ **Sərhəd problemi (8.1-dəki ilə eyni, lakin DM-də daha görünür):** DM söhbətləri az mesajlıdır, ona görə sərhəd sorğusu tez-tez baş verir. Dedupe məntiqi **məcburidir**.

---

### 8.3 · 🔴 Performans və CPU limiti

**Həcm:** 4 saat · **auditdə yoxdur — ən böyük texniki risk**

**Problem:** `readArchive()` gzip-lənmiş obyekt açır. 8.0/Sual 1-in cavabına görə:

| Obyekt həcmi | Bir `before=` sorğusunun maliyyəti |
|---|---|
| Gündəlik dump, ~500 mesaj | ✅ Məqbul (~100 KB açılır) |
| Aylıq dump, ~15 000 mesaj | ⚠️ ~3 MB açılır, 120 mesaj qaytarılır — **97% israf** |
| Otaq üzrə tək dump (bütün tarixçə) | 🔴 **CPU limiti aşılır** — sorğu 1102/500 xətası verir |

**Workers limitləri:** CPU vaxtı plana görə 10–50 ms (bəzi planlarda 30 s wall-clock, lakin CPU ayrıca sayılır). Gzip açılması CPU-intensivdir.

**Tələb — bu sıra ilə qiymətləndir:**

#### Addım 1 — Ölç
Süni (və ya real) dump üzərində:
```
Obyekt ölçüsü → açılma vaxtı → JSON.parse vaxtı → ümumi CPU
```
Nəticəni hesabata yaz.

#### Addım 2 — Ölçmə nəticəsinə görə seç

| Nəticə | Həll |
|---|---|
| CPU < limitin 30%-i | ✅ Sadə oxu kifayətdir |
| CPU 30–70% | ⚠️ **Keş əlavə et** (aşağı) |
| CPU > 70% və ya aşır | 🔴 **Format dəyişikliyi lazımdır** (aşağı) |

#### Keş variantı
```ts
// Açılmış arxiv səhifəsi KV-də keşlənir — eyni otağı vərəqləyən istifadəçi
// eyni obyekti təkrar-təkrar açmasın (AUDIT-TASK-8 §8.3).
// Arxiv datası DƏYİŞMƏZDİR → uzun TTL təhlükəsizdir.
// ⚠️ KV dəyər limiti 25 MB; açılmış səhifə ondan böyükdürsə keşlənməz.
```
⚠️ **Məxfilik:** keşlənən data mesaj məzmunudur. KV açarı **scope-a bağlı** olmalıdır (`arch:{roomId}:{page}`), istifadəçiyə yox — avtorizasiya onsuz da endpoint-də edilir.

#### Format dəyişikliyi variantı
Dump-lar çox böyükdürsə, yazı yolu **kiçik parçalara** bölünməlidir:
- Gündəlik və ya N-mesajlıq parçalar
- Hər scope üçün **manifest faylı** (`archive/{scope}/index.json`): parça → zaman aralığı
- Oxu manifesti oxuyur, yalnız lazımi parçanı açır

⚠️ Bu, **yazı yolunun dəyişməsi** deməkdir və mövcud arxivin **yenidən yazılmasını** tələb edə bilər. R2-də data varsa (8.0/Sual 3), miqrasiya planı lazımdır. **Boşdursa — indi dəyişmək ucuzdur.**

**Qərar qapısı:** Format dəyişikliyi lazım gələrsə, istifadəçidən təsdiq istə — bu, +0,5–1 gün əlavə edir.

---

### 8.4 · UI — "daha köhnə mesajları yüklə"

**Audit ID:** C-3/2 · **Həcm:** 3 saat

**Yer:** `js/chat.js`, `js/dm.js`

⚠️ **Task 6 §8/1: `js/` tip yoxlamasından keçmir** — bu dəyişikliklər yalnız E2E ilə doğrulana bilər. Ehtiyatlı ol.

**Tələb:**

| Element | Davranış |
|---|---|
| **Tetikləyici** | Yuxarı scroll (infinite scroll) və ya açıq "Daha köhnə" düyməsi |
| **Yükləmə göstəricisi** | Arxiv oxusu D1-dən **yavaşdır** — spinner məcburidir, əks halda istifadəçi donma zənn edər |
| **Scroll mövqeyi** | Yeni mesajlar yuxarıya əlavə olunanda scroll **sıçramamalıdır**. Klassik tələ: `scrollHeight` fərqini hesabla və `scrollTop`-u düzəlt |
| **Bitmə vəziyyəti** | `hasMore: false` gələndə "Söhbətin başlanğıcı" göstər, düyməni gizlət |
| **Xəta vəziyyəti** | Arxiv oxusu sınarsa **aydın mesaj** — sükutla boş qalma |
| **Təkrar sorğunun qarşısı** | Yükləmə davam edərkən ikinci sorğu göndərilməsin (`isLoading` bayrağı) |
| **Rate limit (429)** | Task 4 §7/1-dəki dərs: polling 429-da **dayanmalıdır**. Burada da — 429 gələrsə avtomatik təkrar cəhd etmə, istifadəçiyə göstər |
| **3 dil** | "Daha köhnə", "Söhbətin başlanğıcı", xəta mesajları — az/en/ru |

⚠️ **`i18n.js` 96,5 KB-dır və 3 dil daşıyır.** Yeni sətirlər hər üç dilə əlavə edilməlidir; birində qalması Task 2-dəki placeholder problemini təkrarlayar.

---

### 8.5 · GDPR ixracının tamamlanması

**Audit ID:** hüquqi risk #13 · **Həcm:** 4 saat

**Yer:** `worker/routes.ts:1935-1951` (`exportMyData`), `EXPORT_SECTIONS`

**Əlavə ediləcək bölmələr:**

| Bölmə | Mənbə | Qeyd |
|---|---|---|
| **Arxivlənmiş mesajlar** | R2 `archive/` | Yalnız istifadəçinin öz mesajları — bütün otağın deyil |
| **`contact_messages`** | D1 | İstifadəçinin göndərdiyi əlaqə formaları |
| **`team_members`** | D1 | Hansı komandalarda üzvdür, rolu, qoşulma tarixi |
| **`team_tasks`** | D1 | Ona təyin edilmiş / onun yaratdığı tapşırıqlar |
| **`team_posts`** | D1 | Komanda daxili postları |
| **`team_files`** | D1 | Metadata (yüklədiyi fayllar) — **fayl məzmunu deyil** |

**Kritik detallar:**

| Detal | Tələb |
|---|---|
| **Sirlərin çıxarılması** | `routes.ts:1956` `pass_hash`, `totp_secret`, `refresh_hash` çıxarır — **bu davranışı qoru və yeni bölmələrə də tətbiq et** |
| **CSV formula injection** | `routes.ts:1849` `=+-@` neytrallaşdırır — yeni bölmələr **eyni funksiyadan keçməlidir** |
| **Başqasının datası** | `team_posts` başqa üzvlərin postlarını da daşıyır → **yalnız istifadəçinin özünə aid sətirlər**. Əks halda ixrac özü data sızmasına çevrilir |
| **Arxiv filtri** | Arxiv dump-ları **bütün otağın** mesajlarını saxlayır → yalnız `uid === istifadəçi` olanları çıxar |
| **Ölçü** | Arxiv əlavə olunduqca ixrac böyüyür. Streaming işlədilirmi? Yoxsa yaddaşda toplanır? **Ölç** |
| **Rate limit** | Task 4 `heavy` səbətinə (20/saat) salıb. Arxiv əlavəsi ilə daha bahalıdır — **yenidən qiymətləndir** |
| **Uzun sürən ixrac** | Ölçü/vaxt limiti aşılarsa: Queue-ya keçir, hazır olduqda bildiriş. ⚠️ Bu, əhatəni genişləndirir — əvvəlcə **ölç**, lazım olmasa etmə |

⚠️ **Privacy mətni ilə uyğunluq:** LEGAL-GAPS §2.3 mətnin *"bizə müraciət edin"* dediyini, halbuki self-service mövcud olduğunu qeyd edir. İxrac tamamlandıqdan sonra **mətn də yenilənməlidir** → 8.7.

---

### 8.6 · 🔴 Unudulmaq hüququ — arxivdə qalan mesajlar

**Həcm:** 3 saat · **auditdə YOXDUR — GDPR pozuntusu**

**Problem:** İstifadəçi hesabını silir (`deleteAccount`). D1 sətirləri gedir. **Lakin R2 arxivindəki gzip dump-ları onun mesajlarını saxlamağa davam edir.**

Bu, GDPR Art. 17 (silinmə hüququ) ilə birbaşa ziddiyyətdir və Privacy mətnində vəd edilən "silinmə" hüququnu **yerinə yetirmir**.

**8.0/Sual 7-nin cavabına görə üç variant:**

| Variant | Necə | Maliyyət | Qiymətləndirmə |
|---|---|---|---|
| **(a) Dump-ların yenidən yazılması** | Silinən uid-in mesajlarını çıxar, dump-ı yenidən yaz | 🔴 Çox baha — hər dump açılıb-yazılmalıdır | Böyük arxivdə praktiki deyil |
| **(b) Tombstone siyahısı** | `deleted_uids` cədvəli; oxu zamanı həmin uid-in mesajları **filtrlənir/anonimləşdirilir** | 🟢 Ucuz, dərhal təsirli | ⚠️ Data fiziki olaraq qalır |
| **(c) Gecikmiş təmizlik** | Cron dump-ları dövri olaraq təmizləyir | 🟡 Orta | (b) ilə birlikdə yaxşı işləyir |

**Tövsiyə: (b) + (c).**
- (b) **dərhal** tətbiq olunur — silinmiş istifadəçinin mesajları oxu yolunda görünmür.
- (c) fiziki silməni **asinxron** edir (mövcud cron-a əlavə).

```ts
/**
 * Silinmiş hesabların arxivdən filtrlənməsi — GDPR Art. 17.
 *
 * Problem: deleteAccount D1 sətirlərini silir, lakin R2 arxiv dump-ları
 * gzip-lənmiş halda mesajları saxlamağa davam edir. Dump-ı yenidən yazmaq
 * bahadır → oxu yolunda filtr + asinxron fiziki təmizlik.
 *
 * ⚠️ Bu, "silinib" demək DEYİL, "əlçatmazdır" deməkdir. Fiziki silmə
 * cron ilə edilir. Privacy mətnində bu fərq dəqiq ifadə olunmalıdır (§8.7).
 */
```

⚠️ **Hüquqi dəqiqlik:** Privacy mətni "dərhal silinir" deyirsə və reallıq "oxu yolunda gizlədilir, N gün ərzində fiziki silinir"dirsə — **mətn faktı əks etdirməlidir**. Bu, 8.7-nin bir hissəsidir.

⚠️ **Mövcud silinmiş hesablar:** `deleteAccount` artıq işlədilibsə, həmin uid-lər `deleted_uids`-ə **backfill** edilməlidir. `users`-də olmayan, lakin arxivdə mesajı olan uid-lər — yoxla.

---

### 8.7 · Hüquqi mətnin faktla uyğunlaşdırılması (GERİ QAYTARMADAN ƏVVƏL)

**Mənbə:** LEGAL-GAPS §2.2, §2.3 · **Həcm:** 1,5 saat

🔴 **Bu bənd 8.8-dən əvvəl tamamlanmalıdır.** Bağlayıcı ardıcıllıq.

**Privacy §4-ə (Saxlama müddəti) əlavə ediləcəklər — hər 3 dildə:**

| Fakt | Mətndə olmalıdır |
|---|---|
| Mesajlar N gündən sonra arxivə köçürülür | Arxivləmə mexanizmi və müddəti |
| Arxivlənmiş mesajlar **istifadəçi üçün əlçatan qalır** | Data itmir — "daha köhnə yüklə" ilə oxunur |
| Hesab silinərsə arxiv mesajları necə emal olunur | 8.6-dakı davranışın **dəqiq** təsviri |
| İxrac arxivi də əhatə edir | 8.5-in nəticəsi |

**Privacy §5-də (İstifadəçi hüquqları) düzəliş — LEGAL-GAPS §2.3:**
> Mətn *"JSON formatında əldə etmək üçün bizə müraciət edin"* deyir. Self-service `GET /api/me/export` **hazırdır**.

Mətn faktı əks etdirsin: ixracın **hesab parametrlərindən özü** endirilə biləcəyi + Task 4-dəki saat limiti (Task 6 A-2-də qismən edilib — **yoxla, dublikat yaratma**).

⚠️ **Task 2 §2.2 qadağası qüvvədədir:** `LEGAL` mətnlərini **yenidən yazma**. Yalnız faktiki davranışı əks etdirən **əlavələr** et. Hüquqi mətn redaktəsi hüquqşünas baxışı tələb edir (açıq öhdəlik).

⚠️ `js/i18n.js` — hər üç dil paralel.

---

### 8.8 · 🔴 `ARCHIVE_HOT_DAYS` → `"90"` geri qaytarılması

**Mənbə:** Task 1 §1.2-nin öhdəliyi · **Həcm:** 2 saat · **geri dönməz nəticəsi var**

Bu, zəncirin **ən uzun müddət açıq qalan öhdəliyidir** (Task 1-dən bəri) və **yeganə addımdır ki, geri dönməz data silməsini işə salır**.

#### 🔴 Ön şərtlər — hamısı ✅ olmalıdır

| # | Şərt | Doğrulama |
|---|---|---|
| 1 | Oxu yolu işləyir (otaq + DM) | 8.1, 8.2 testləri yaşıl |
| 2 | UI "daha köhnə" işləyir | 8.4 E2E yaşıl |
| 3 | Performans məqbuldur | 8.3 ölçməsi |
| 4 | GDPR ixracı arxivi əhatə edir | 8.5 testləri |
| 5 | Silinmiş hesab filtri işləyir | 8.6 testləri |
| 6 | **Privacy mətni yenilənib** | 8.7 — 3 dildə |
| 7 | Yazı yolu real datada doğrulanıb | aşağı |

**Hər hansı biri ❌ olarsa — dəyəri dəyişmə.** Hesabatda blokeri qeyd et.

#### Addım 1 — Dry-run

Silmədən **əvvəl** nə silinəcəyini ölç:
```sql
SELECT COUNT(*) AS silinecek,
       MIN(created_at) AS en_kohne,
       MAX(created_at) AS en_yeni
FROM room_messages
WHERE created_at < (strftime('%s','now') - 90*86400) * 1000;
-- dm_messages üçün eyni
```

⚠️ Task 1-dən bəri arxivləmə **dayandırılıb** (≈ ...günlük yığılma). İlk cron **böyük həcmi** bir dəfəyə emal edəcək.

| Say | Risk | Əməliyyat |
|---|---|---|
| < 10 000 | 🟢 Aşağı | Normal davam |
| 10 000 – 100 000 | 🟠 Orta | Batch limiti yoxla (`archive.ts`-də varmı?) |
| > 100 000 | 🔴 Yüksək | **Mərhələli keçid** (aşağı) |

#### Addım 2 — Mərhələli keçid (böyük həcmdə)

Birbaşa `3650 → 90` etmə. Addım-addım:
```
3650 → 365   (cron işlə, doğrula)
 365 → 180   (cron işlə, doğrula)
 180 →  90   (yekun)
```
Hər addımdan sonra: arxiv obyektləri yaradıldımı? Oxu yolu onları görürmü? D1 silmələri gözlənilən sayda idimi?

#### Addım 3 — İlk cron-un müşahidəsi

Cron `17 3 * * *` işlədikdən sonra **məcburi yoxlama**:
```bash
npx wrangler r2 object list <bucket> --prefix "archive/" | tail -20   # yeni obyektlər
# D1-də silinən say = arxivə yazılan say?
```

⚠️ **Yazı-sonra-silmə atomikliyi:** `archive.ts:88` əvvəlcə R2-yə yazır, sonra D1-dən silir. R2 yazısı uğurlu, D1 silməsi uğursuz olarsa → dublikat (zərərsiz, 8.1 dedupe edir). **Əksi baş verərsə → data itkisi.** Kodda sıranı təsdiqlə.

#### Addım 4 — Şərhin yenilənməsi

Task 1-də qoyulmuş müvəqqəti şərhi **sil və əvəzlə**:
```jsonc
// Arxivləmə isti pəncərəsi: 90 gündən köhnə mesajlar R2-yə köçürülür.
// Oxu yolu: GET /api/rooms/:id/messages?before= (AUDIT-TASK-8).
// ⚠️ Bu dəyəri artırmaq D1 storage xərcini artırır; azaltmaq isə istifadəçi
// üçün "daha köhnə" yükləmələrini bahalaşdırır (§8.3 performans ölçməsi).
"ARCHIVE_HOT_DAYS": "90",
```

---

### 8.9 · Test datasının hazırlanması

**Həcm:** 2 saat · **8.0/Sual 3 "boş" cavab verərsə məcburi**

R2-də arxiv datası yoxdursa, oxu yolu **test edilə bilməz**. Süni data lazımdır.

**Tələb:**

1. `e2e/`-də arxiv seed köməkçisi:
   ```ts
   /**
    * Süni arxiv datası — AUDIT-TASK-8 §8.9.
    * Səbəb: ARCHIVE_HOT_DAYS=3650 olduğu üçün Task 1-dən bəri real arxivləmə
    * baş verməyib; R2-də arxiv obyekti yoxdur. Oxu yolunu test etmək üçün
    * yazı yolunun ÖZ funksiyası ilə (əl ilə JSON qurmaqla DEYİL) data yaradılır.
    */
   ```
   ⚠️ **Yazı yolunun öz funksiyasını işlət** — əl ilə qurulmuş JSON formatı gizli fərqlə saxlaya bilər və test yalançı yaşıl verər (Task 7 §8/1-dəki `photo_url` dərsi).

2. Task 5-in E2E seed müstəqilliyi qaydasına uy: idempotent, miqrasiya tarixçəsindən asılı deyil.

3. Lokal R2 (Miniflare) və uzaq R2 fərqini nəzərə al.

---

### 8.10 · E2E testləri

**Həcm:** 3 saat

```ts
test.describe('AUDIT C-3 — arxiv oxu yolu @archive', () => {

  // ─── 🔴 REQRESSİYA ───
  test('normal otaq mesajları işləyir (arxivsiz)', async () => {
    // Mövcud davranış pozulmayıb
  });

  // ─── Oxu yolu ───
  test('isti pəncərədən köhnə mesaj arxivdən gəlir', async () => {
    // before=<arxiv dövrü> → mesajlar qayıdır
  });

  test('sərhəd sorğusu hər iki mənbədən oxuyur', async () => {
    // before = D1-in ən köhnə mesajına yaxın → D1 + arxiv birləşməsi
    // Dublikat YOXDUR, boşluq YOXDUR, sıralama düzgündür
  });

  test('arxiv də bitəndə hasMore=false', async () => {
    // Client sonsuz döngüyə düşməsin
  });

  test('DM arxivi oxunur', async () => { /* … */ });

  // ─── 🔴 AVTORİZASİYA ───
  test('yad otağın arxivi oxunmur', async () => {
    // Üzv olmadığım otaq → 403/404
  });

  test('yad DM-in arxivi oxunmur', async () => { /* … */ });

  test('arxiv R2 açarı cavabda YOXDUR', async () => {
    // Task 7 sərhədi: JSON-da heç bir R2 açarı görünməməlidir
    // expect(JSON.stringify(body)).not.toContain('archive/')
  });

  test('/files/archive/ hələ də bağlıdır', async () => {
    // Task 7 reqressiyası: adi istifadəçi → 404
  });

  // ─── GDPR ───
  test('ixrac arxiv bölməsini əhatə edir', async () => { /* … */ });
  test('ixrac contact_messages əhatə edir', async () => { /* … */ });
  test('ixrac komanda datasını əhatə edir', async () => { /* … */ });
  test('ixracda BAŞQASININ datası yoxdur', async () => {
    // team_posts-dan yalnız öz sətirləri
  });
  test('ixracda sirlər yoxdur', async () => {
    // pass_hash, totp_secret, refresh_hash — mövcud qorumanın reqressiya testi
  });

  // ─── 🔴 UNUDULMAQ HÜQUQU ───
  test('silinmiş hesabın arxiv mesajları görünmür', async () => {
    // deleteAccount → arxiv oxusunda həmin uid-in mesajları filtrlənir
  });

  // ─── UI ───
  test('"daha köhnə" düyməsi işləyir və scroll sıçramır', async ({ page }) => { /* … */ });
  test('söhbətin başlanğıcında düymə gizlənir', async ({ page }) => { /* … */ });
  test('429-da avtomatik təkrar cəhd YOXDUR', async ({ page }) => {
    // Task 4 §7/1 dərsi
  });
});
```

⚠️ **İzolyasiya:** Task 7 §9-dakı 80 sınıq test və sessiya qüsuru — 8.0/Sual 0-ın nəticəsinə görə davran.

---

## 4. ƏHATƏDƏN KƏNAR

| Tapıntı | Aid task | Səbəb |
|---|---|---|
| `/files/archive/` açılması | ⛔ **Qadağan** | Task 7 sərhədi — C-1 yenidən açılar |
| H-3 atomik limiter, H-5 XP, H-6 WS re-auth, M-4 RoomDO | **Task 9** | — |
| `photo_url` ikiqat prefiks (Task 7 §8/1) | **Task 10** | Ayrı qüsur |
| OG üçün publik avatar yolu (Task 7 §8/2) | **Task 10** | — |
| `deleteTeam` soft-delete siyasəti (Task 7 §8/3) | **Task 10** | Siyasət qərarı |
| `js/` tip yoxlaması | **Task 10** | 8.4 frontend-ə toxunur |
| M-1 log→bloklama, `file_access_denied` siqnalı | **Ayrıca** | Meyar lazımdır |
| Hüquqi mətnin peşəkar baxışı | **Xarici** | 8.7 yalnız faktı əks etdirir |
| `ANALYZE` cron mexanizmi | **Task 9/10** | — |
| 11 sxem bəndi (Task 6 §5) | **Task 10** | — |
| E2E sessiya refaktoru / 80 sınıq test | **8.0/Sual 0** | Qərar qapısı |

---

## 5. İCRA QAYDALARI

### 5.1 Commit strategiyası

```
feat(archive): arxiv oxu yolu — otaq və DM mesajları

Audit: AUDIT-2026-07-26.md §C-3
Risk: Critical (data availability itkisi)
Təsir: readArchive() yazılmışdı, lakin heç yerdən çağırılmırdı. 90 gündən
       köhnə mesajlar məhsul daxilində ƏLÇATMAZ idi.
Task 7 sərhədi: R2 açarı client-ə verilmir; /files/archive/ isAdmin qalır.
Performans: §8.3 ölçməsi — <nəticə>
Test: e2e/*.spec.ts @archive — N test
```

**Sıra:** 8.0 → 8.9 → 8.3 → 8.1 → 8.2 → 8.6 → 8.5 → 8.4 → 8.10 → 8.7 → **8.8**

🔴 **8.8 mütləq sonuncudur.** Ondan əvvəl gələn hər bənd onun ön şərtidir.
🔴 **8.7 (hüquqi mətn) 8.8-dən dərhal əvvəl** — LEGAL-GAPS §2.2-nin bağlayıcı tələbi.
⚠️ **8.3 (performans) erkən gəlir** — nəticəsi format dəyişikliyi tələb edərsə, 8.1/8.2 ona görə yazılmalıdır.

### 5.2 🔴 Üç tələ

| Tələ | Nəticə | Qoruma |
|---|---|---|
| **`/files/archive/` açmaq cazibədar görünür** | C-1 qismən yenidən açılır | Task 7 sərhədi — server tərəfdə oxu, JSON qaytar |
| **Süni test datasını əl ilə qurmaq** | Format fərqi gizli qalır, test yalançı yaşıl verir | 8.9 — yazı yolunun öz funksiyası |
| **`ARCHIVE_HOT_DAYS`-i erkən qaytarmaq** | Geri dönməz silmə, oxu yolu hazır deyil | 8.8 ön şərt cədvəli |

### 5.3 Boş nəticə ≠ xəta

Arxiv oxusu üç fərqli hal qaytara bilər və onlar **qarışdırılmamalıdır**:

| Hal | Cavab | Client davranışı |
|---|---|---|
| Arxiv obyekti yoxdur (heç vaxt arxivlənməyib) | `200`, boş massiv, `hasMore: false` | "Söhbətin başlanğıcı" |
| Arxivdə data var, lakin `before`-dan köhnəsi yoxdur | `200`, boş massiv, `hasMore: false` | Eyni |
| R2 xətası / pozulmuş gzip | `5xx` + log | **Xəta mesajı** — "başlanğıc" göstərmə |

Üçüncü halı birinci kimi göstərmək **data itkisi qavrayışı** yaradır — C-3-ün özünün səbəbi budur.

### 5.4 Şərh mədəniyyəti

`archive.ts` **artıq yaxşı şərhlənib** (audit "şərh mədəniyyəti" bölməsində layihəni tərifləyir). Yeni kod eyni səviyyədə olmalıdır — xüsusilə:
- Task 7 sərhədi (niyə `/files/`-dən keçmirik)
- Dedupe məntiqi (niyə lazımdır)
- 8.6 filtrinin "silinib" deyil, "əlçatmazdır" olduğu

---

## 6. QƏBUL MEYARLARI

### Oxu yolu
| # | Meyar | Doğrulama | Gözlənilən |
|---|---|---|---|
| **1** | 🔴 Mövcud mesaj oxusu pozulmayıb | E2E | yaşıl |
| 2 | Arxivdən mesaj oxunur (otaq) | `?before=<köhnə>` | mesajlar gəlir |
| 3 | Arxivdən mesaj oxunur (DM) | eyni | — |
| 4 | Sərhəd sorğusunda **dublikat yoxdur** | id-lər unikal | ✅ |
| 5 | Sərhəd sorğusunda **boşluq yoxdur** | ardıcıl `created_at` | ✅ |
| 6 | `hasMore` düzgündür | arxiv bitəndə | `false` |
| 7 | Boş arxiv ≠ xəta | obyektsiz scope | `200` + boş |
| 8 | R2 xətası gizlədilmir | süni xəta | `5xx` + log |

### Avtorizasiya (Task 7 reqressiyası)
| # | Meyar | Gözlənilən |
|---|---|---|
| **9** | 🔴 Yad otağın arxivi bağlıdır | 403/404 |
| **10** | 🔴 Yad DM-in arxivi bağlıdır | 403/404 |
| **11** | 🔴 Cavabda R2 açarı **yoxdur** | `archive/` sətri yox |
| **12** | 🔴 `/files/archive/` hələ bağlıdır | adi istifadəçi → 404 |

### Performans
| # | Meyar | Gözlənilən |
|---|---|---|
| 13 | CPU limiti aşılmır | ölçülüb, hesabatda |
| 14 | p95 arxiv sorğusu | < 2 s |
| 15 | Keş (tətbiq olunubsa) hit verir | metrika |

### GDPR
| # | Meyar | Gözlənilən |
|---|---|---|
| 16 | İxrac arxivi əhatə edir | bölmə mövcuddur |
| 17 | İxrac `contact_messages` əhatə edir | ✅ |
| 18 | İxrac komanda datasını əhatə edir | 4 cədvəl |
| **19** | 🔴 İxracda **başqasının** datası yoxdur | yalnız öz sətirləri |
| **20** | 🔴 İxracda sirlər yoxdur | `pass_hash` və s. yox |
| 21 | CSV formula injection qoruması işləyir | `=` ilə başlayan xana |
| **22** | 🔴 Silinmiş hesabın mesajları arxivdə görünmür | filtr işləyir |

### UI
| # | Meyar | Gözlənilən |
|---|---|---|
| 23 | "Daha köhnə" yükləyir | E2E |
| 24 | Scroll sıçramır | E2E |
| 25 | Bitmə vəziyyəti göstərilir | 3 dildə |
| 26 | 429-da avtomatik təkrar yoxdur | E2E |

### Geri qaytarma (8.8)
| # | Meyar | Gözlənilən |
|---|---|---|
| **27** | 🔴 Privacy §4 arxivləməni açıqlayır | 3 dildə, `"90"`-dan **əvvəl** |
| **28** | 🔴 8.8 ön şərt cədvəli 7/7 ✅ | hesabatda |
| 29 | Dry-run sayı ölçülüb | hesabatda |
| 30 | İlk cron doğrulanıb | R2 obyektləri + D1 sayı |
| 31 | `ARCHIVE_HOT_DAYS = "90"` | `wrangler.jsonc` |
| 32 | Task 1-in müvəqqəti şərhi silinib | — |

### Ümumi
| # | Meyar | Gözlənilən |
|---|---|---|
| 33 | `npx tsc --noEmit` | exit 0 |
| 34 | `npm run build` | exit 0 |
| 35 | `npm run check:migrations` | yaşıl |
| 36 | Tam E2E dəsti | 8.0/Sual 0 baseline-dan pis deyil |

**Meyar 1, 9–12 və ya 36 ❌ olarsa:** `git revert`.
**Meyar 27 və ya 28 ❌ olarsa:** 🔴 **8.8-i icra etmə** — dəyəri `"3650"`-də saxla.

---

## 7. HESABAT FORMATI

`docs/AUDIT-TASK-8-REPORT.md`:

```markdown
# AUDIT-TASK-8 — İcra Hesabatı

**Tarix:** …   **İcraçı:** …   **Commit-lər:** <hash → başlıq>
**E2E baseline (8.0/Sual 0):** <yaşıl / N sınıq — qərar>

## 1. Arxiv formatı (8.0)
### Açar şablonu, qruplaşma, sıxılma, serializasiya
### readArchive() imzası və davranışı
### R2-də arxiv datası: <var / BOŞ → süni data yaradıldı>

## 2. 🔴 Performans ölçməsi (8.3)
| Göstərici | Dəyər |
| Orta obyekt ölçüsü | … |
| Açılma CPU vaxtı | … |
| Plan limiti | … |
| İstifadə nisbəti | …% |
→ Qərar: <sadə oxu / keş / format dəyişikliyi>

## 3. Oxu yolu (8.1, 8.2)
### Sərhəd davranışı — dedupe və boşluq idarəsi
### Rate limit səbəti: <hansı, niyə>

## 4. 🔴 Unudulmaq hüququ (8.6)
### Mövcud vəziyyət: deleteAccount arxivə toxunurdumu?
### Seçilən variant: <a/b/c> — əsaslandırma
### Backfill: <silinmiş uid sayı>

## 5. GDPR ixracı (8.5)
| Bölmə | Mənbə | Sətir sayı (test) | Sirr filtri |
### İxrac ölçüsü: əvvəl … → sonra …

## 6. Hüquqi mətn (8.7)
| Əlavə | Yer | 3 dil |
### LEGAL-GAPS §2.2 bağlandı: ✅

## 7. 🔴 ARCHIVE_HOT_DAYS geri qaytarılması (8.8)
### Ön şərt cədvəli
| # | Şərt | ✅/❌ |
| 1 | Oxu yolu işləyir | |
| … 7 sətir … |

### Dry-run
| Cədvəl | Silinəcək sətir | Ən köhnə | Ən yeni |
→ Risk: <aşağı/orta/yüksək> → Keçid: <birbaşa / mərhələli>

### İlk cron nəticəsi
| Göstərici | Gözlənilən | Faktiki |
| Arxivə yazılan | … | … |
| D1-dən silinən | … | … |
| Uyğunluq | | ✅/❌ |

**Yekun:** ARCHIVE_HOT_DAYS = <"90" / "3650" — səbəb>

## 8. Qəbul meyarları (36 sətir)

## 9. Aşkarlanan yeni risklər

## 10. Açıq qalan öhdəliklər
- [ ] 🔴 H-3/H-5/H-6/M-4 → **Task 9**
- [ ] 🔴 E2E baseline / 80 sınıq test (§8.0)
- [ ] 🔴 Hüquqi mətnin peşəkar baxışı
- [ ] 🟠 Cloudflare Cache Rules yoxlaması (Task 7 §9)
- [ ] 🟠 `photo_url` ikiqat prefiks, OG avatar yolu (Task 7 §8)
- [ ] 🟠 M-1 log→bloklama + `file_access_denied` siqnalı
- [ ] 🟠 R2 access log / Logpush
- [ ] 🟡 Task 10-a ötürülən 11 sxem bəndi
- [ ] <8.6/(c) seçilibsə: fiziki təmizlik cron-u>
- [ ] `collabix.az` DNS + MX, VÖEN, sosial profillər
- [ ] Git remote qərarı

## 11. Geri qaytarma planı
| Bənd | Revert | Data təsiri |
| 8.1–8.5 | `git revert` | Təsir yoxdur |
| **8.8** | `ARCHIVE_HOT_DAYS` → `"3650"` | ⚠️ **Artıq silinmiş sətirlər GERİ QAYITMIR** — yalnız R2-də qalır və oxu yolu ilə əlçatandır |
```

---

## 8. BİRİNCİ ADDIM

### 🔴 Addım 0 — bağlayıcı qapı
```bash
npx playwright test 2>&1 | tail -20
```
Nəticəni bildir. **80 sınıq test qalırsa dayan** və 8.0/Sual 0-dakı qərarı istə.

### Addım 1 — yalnız oxu, sonra təqdim et
1. `worker/archive.ts` **tam məzmunu** — xüsusilə açar formatı, sıxılma, `readArchive` imzası
2. `npx wrangler r2 object list <bucket> --prefix "archive/" | head -50` → arxivdə data varmı
3. `worker/routes.ts:1110-1140` → `roomMessages` paginasiya naxışı
4. `worker/routes.ts:1930-1990` → `exportMyData` + `EXPORT_SECTIONS`
5. `grep -n "deleteAccount" -A 40 worker/routes.ts` → arxivə toxunurmu
6. `wrangler.jsonc` → cron + `ARCHIVE_HOT_DAYS` (Task 1-in şərhi ilə birlikdə)

### Addım 2 — üç sualı konkret cavabla
1. **Bir arxiv obyektində neçə mesaj var və açılmış ölçüsü nədir?** *(8.3-ün — task-ın ən böyük texniki riskinin — cavabı budur.)*
2. **R2-də arxiv datası varmı?** Yoxdursa 8.9 məcburidir.
3. **`deleteAccount` arxivə toxunurmu?** Toxunmursa 8.6 GDPR boşluğudur.

### Dayanma şərtləri

| Şərt | Əməliyyat |
|---|---|
| E2E baseline sınıqdır (80 test) | Dayan, qərar istə |
| Arxiv obyekti çox böyükdür (CPU limiti riski) | Dayan, format dəyişikliyi üçün təsdiq istə (+0,5–1 gün) |
| `deleteAccount` arxivi təmizləmir **və** artıq silinmiş hesablar var | Dayan, 8.6 variantı üçün qərar istə |
| 8.8 ön şərtlərindən biri ❌ | 🔴 **`ARCHIVE_HOT_DAYS`-i dəyişmə** — `"3650"`-də saxla, hesabatda blokeri yaz |

Cavablar hazır olduqdan sonra §5.1-dəki sıra ilə icraya başla — **8.8 mütləq sonuncu**.
