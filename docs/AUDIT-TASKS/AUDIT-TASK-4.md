# AUDIT-TASK-4 — Rate Limit Əhatəsi və Xəta Kodu Ardıcıllığı

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md` §H-4 (sətir 471–491)
**Əlavə mənbələr:** `AUDIT-TASK-1-REPORT.md` §5.3, `AUDIT-TASK-3-REPORT.md` §8
**Bağlanan tapıntılar:** **H-4** (High — maliyyə DoS), Task 1 §5.3 mirası (33 admin route-unda maşın kodu yoxdur)
**Təxmini həcm:** 1 gün
**Ön şərt:** AUDIT-TASK-3 tamamlanmış olmalıdır
**Risk sinfi:** ⚠️ Bu task **hər sorğu yolunu** əhatə edir. Səhv icra bütün istifadəçiləri 429-a salır.

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-4  Rate limit-i opt-in-dən opt-out-a çevir: rl verilməyən route
               avtomatik 'read' səbətinə düşsün. ai/read/presence səbətlərini əlavə et.
               Bahalı endpoint-ləri (Workers AI, Vectorize, admin stats) fərdi limitlə.
               429 cavabına Retry-After + code:'rate_limited' qoy.
               Admin route-larındakı 33 kodsuz 403-ə code sahəsi əlavə et.
               DONE: rl-siz route sayı 0; AI endpoint 20/saat; normal istifadəçi
                     axını heç bir yerdə 429 almır (reqressiya testi yaşıl).
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli backend mühəndisisən**.

Bu task-ın xarakteri əvvəlkilərdən fərqlidir. Task 3 **bir neçə endpoint-də** məntiqi dəyişirdi — səhv olsa Owner-lər kilidlənirdi. Bu task **171 route-un hamısına** toxunur: səhv olsa **bütün istifadəçilər** kilidlənir.

Ona görə burada da birinci qəbul meyarı təhlükəsizlik deyil: **normal istifadəçi axını heç bir yerdə 429 almamalıdır.**

İkinci vacib məqam: bu task **əhatəni** genişləndirir, **düzgünlüyü** yox. Rate limiter-in özü atomik deyil (H-3) və bu task onu düzəltmir — Task 9-dur. §5.2-də bu ayrımın niyə vacib olduğu izah olunur; oxumadan başlama.

---

## 2. KONTEKST

### 2.a Hazırkı vəziyyət

`worker/index.ts` deklarativ route cədvəlində hər route opsional `rl:` bayrağı daşıyır:
```ts
{ method: 'POST', pattern: /…/, handler: R.x, auth: true, rl: 'write' },
```
Limiter `worker/auth.ts:312-322`-də KV sayğacı ilə işləyir.

**Audit tapıntısı:** `rl:` yalnız **64/171** route-da var. Qalan **107** route limitsizdir.

### 2.b Ən ciddi nümunələr (auditdən)

| Route | Yer | Problem |
|---|---|---|
| `POST /api/ai/chat` | `index.ts:193` | **Workers AI çağırışı, limit YOX.** Hər sorğu real pul |
| `GET /api/search/semantic` | `index.ts:194` | Embedding + Vectorize sorğusu, limit YOX |
| `POST /api/presence` | `index.ts:127` | Hər çağırışda **2 D1 yazısı**, limit YOX |
| `GET /api/teams/:id/ai/summary` | `index.ts:210` | 40 tapşırıq LLM-ə göndərilir, limit YOX |
| `GET /api/feed`, `/api/users` | — | Ağır JOIN / 500 sətir, limit YOX |
| `GET /api/admin/stats-daily` | — | 4 × `COUNT(*)` tam skan, limit YOX |

**Təsir:** Maliyyə DoS — Workers AI, Vectorize, D1 read/write vahidləri. D1 yazı kvotasının tükənməsi.

### 2.c Auditin təklif etdiyi düzəliş

> Yeni səbətlər: `ai: { limit: 20, windowSec: 3600 }`, `read: { limit: 300, windowSec: 60 }`, `presence: { limit: 60, windowSec: 300 }` — və **default olaraq hər route-a** səbət təyin et (opt-in → opt-out: `rl` verilməyəndə `read` tətbiq olunsun).

Bu düzgün istiqamətdir, lakin **natamam**. Aşağıdakı dörd məsələ auditdə yoxdur və bu task-da həll olunur: açar strategiyası (4.5), istisnalar (4.4), 429 semantikası (4.6), KV yazı amplifikasiyası (§5.2).

### 2.d Əvvəlki task-lardan gələn dərslər

| Mənbə | Dərs | Bu task-a təsiri |
|---|---|---|
| Task 2 §5.2 | Audit placeholder-ləri **6× az** saymışdı (3 vs 18) | "107 route" rəqəmi də **yoxlanmalıdır** — 4.0/Sual 1 |
| Task 3 §8/6 | Audit `createTeamInvite`-i sadalamamışdı; agent özü tapdı | Rate limit-siz route-ları **öz sayğacınla** tap, auditin siyahısına güvənmə |
| Task 3 §8/1 | E2E paylaşılan sessiya: dəst 26 dəqiqəyə çıxıb | ⚠️ Rate limit testləri paylaşılan sessiyanı **zəhərləyir** — bax 4.8 |
| Task 3 §8/2 | Lokal D1 seed drift-i | Test hazırlığında miqrasiya tarixçəsinə güvənmə |

---

## 3. ƏHATƏ — 9 BƏND

---

### 4.0 · Vəziyyət xəritəsi (ÖN İŞ, kod dəyişikliyi yoxdur)

**Həcm:** 1 saat

#### Sual 1 — Faktiki rəqəmlər nədir?
```bash
grep -c "pattern:" worker/index.ts                  # ümumi route sayı
grep -c "rl:" worker/index.ts                       # rl daşıyan route sayı
grep -n "pattern:" worker/index.ts | grep -v "rl:"  # rl-siz route-ların TAM siyahısı
```
Auditin "171 / 64 / 107" rəqəmləri ilə müqayisə et. **Fərq varsa faktiki rəqəmi əsas götür** və hesabata yaz.

#### Sual 2 — Mövcud səbətlər hansılardır?
```bash
grep -rn "windowSec\|RL_\|limits\s*=\|buckets\s*=" worker/auth.ts worker/index.ts
```
Cədvəl: səbət adı → limit → pəncərə → hansı route-larda istifadə olunur.

#### Sual 3 — 🔴 Limiter açarı necə qurulur?
```bash
sed -n '300,340p' worker/auth.ts
```
Açar `uid` üzrə, yoxsa IP üzrə? Hər ikisi? Anonim sorğular necə açarlanır?

**Bu sualın cavabı 4.5-i müəyyən edir.** Açar yalnız IP-dirsə, korporativ NAT arxasındakı 50 istifadəçi bir sayğac paylaşır → default `read` səbəti onları kütləvi 429-a salar.

#### Sual 4 — Limit aşıldıqda nə qaytarılır?
```bash
grep -rn "429\|rate_limited\|Retry-After" worker/
```
Status kodu, cavab gövdəsi, `code` sahəsi, `Retry-After` başlığı var? Frontend (`js/api.js`) 429-u emal edirmi?

#### Sual 5 — Hansı route-lar rate limit-ə DÜŞMƏMƏLİDİR?
Aşağıdakıları `index.ts`-də tap və siyahıla:
- `/files/*` və digər statik/asset yolları (bir səhifədə 20 şəkil = 20 sorğu)
- WebSocket upgrade yolları
- SSE / long-poll endpoint-ləri
- `OPTIONS` (CORS preflight)
- Sağlamlıq / status endpoint-i varsa

#### Sual 6 — Normal istifadəçi bir dəqiqədə neçə sorğu edir?
Bu, `read` limitinin (300/60s) real olub-olmadığını müəyyən edir. Ölçmək üçün:
- Feed açılışı → neçə API sorğusu? (`js/` kodundan say və ya brauzer network panelindən)
- 3 saniyəlik polling var (audit sətir 627: *"3 saniyəlik poll paralel işləyir"*) → dəqiqədə **20 sorğu yalnız polling-dən**
- Otaq açılışı, profil açılışı, axtarış

**Nəticəni cədvəl kimi yaz.** Əgər tipik aktiv istifadəçi dəqiqədə 300-ə yaxınlaşırsa, `read` limiti **qaldırılmalıdır**.

**Dayanma şərti:** Sual 3 və Sual 6 cavablanmadan kod dəyişikliyinə başlama.

---

### 4.1 · Səbət taksonomiyası — təhlükəsizlik vs xərc qoruyucusu

**Həcm:** 30 dəqiqə (dizayn) · **kod dəyişikliyi minimaldır, lakin qalan hər şey buna əsaslanır**

Bu task-ın konseptual özəyi. Rate limit səbətləri **iki fərqli məqsədə** xidmət edir və onları eyni mexanizmlə idarə etmək səhvdir:

| Sinif | Səbətlər | Məqsəd | Dəqiqlik tələbi | H-3-ün təsiri |
|---|---|---|---|---|
| **🔴 Təhlükəsizlik kontrolu** | `auth`, `upload`, MFA, magic-link | Brute-force, hesab ələ keçirmə | **Atomik olmalıdır** | ⚠️ H-3 səbəbindən **hazırda sızır** — Task 9 düzəldir |
| **🟠 Xərc qoruyucusu** | `ai`, `read`, `write`, `presence` | Maliyyə DoS, kvota tükənməsi | Təxmini kifayətdir | KV-nin itkiliyi **məqbuldur** |

**Niyə bu ayrım vacibdir:** KV limiter paralel sorğularda sızır (H-3). Xərc qoruyucusu üçün bu məqbuldur — 20 əvəzinə 25 AI çağırışı keçsə, maliyyə təsiri kiçikdir. Təhlükəsizlik kontrolu üçün məqbul **deyil** — 10 əvəzinə 200 parol cəhdi keçsə, qoruma mənasızdır.

**Tələb:**

1. Səbət konfiqurasiyasında bu ayrımı **kodda işarələ**:
   ```ts
   /**
    * Rate limit səbətləri — AUDIT-TASK-4.
    *
    * `critical: true` = TƏHLÜKƏSİZLİK kontroludur, atomiklik tələb edir.
    *   ⚠️ Hazırkı KV limiter atomik DEYİL (AUDIT-2026-07-26 / H-3) → bu səbətlər
    *   real dünyada elan edilən limitdən zəifdir. AUDIT-TASK-9 atomik limiterə keçir.
    *   O task bitənə qədər bu səbətlərə TƏK müdafiə kimi güvənilməməlidir.
    *
    * `critical: false` = XƏRC qoruyucusudur, təxmini sayma kifayətdir.
    */
   ```
2. Hesabatda hansı səbətin hansı sinfə düşdüyünü cədvəl kimi yaz.
3. Task 9-a ötürüləcək siyahını hazırla: hansı səbətlər atomik limiterə **mütləq** köçürülməlidir.

**Qadağa:** ❌ Atomik limiteri (native binding / `RateLimitDO`) bu task-da **qurmа** — Task 9-dur. Sən yalnız əhatəni genişləndirir və sinfi sənədləşdirirsən.

---

### 4.2 · Yeni səbətlərin əlavəsi

**Audit ID:** H-4 · **Həcm:** 30 dəqiqə

**Auditin təklifi başlanğıc dəyər kimi:**
```ts
ai:       { limit: 20,  windowSec: 3600 },   // saatda 20 AI çağırışı
read:     { limit: 300, windowSec: 60   },   // dəqiqədə 300 oxuma
presence: { limit: 60,  windowSec: 300  },   // 5 dəqiqədə 60 presence
```

**Tələb — bu dəyərləri kor-koranə qəbul etmə:**

1. **4.0/Sual 6-nın nəticəsi ilə uyğunlaşdır.** Tipik aktiv istifadəçi dəqiqədə 300-ə yaxınlaşırsa, `read` **500–600**-ə qaldırılmalıdır. Rate limit **hücumçunu** dayandırmalıdır, istifadəçini yox.

2. **`presence` limitini polling tezliyi ilə yoxla.** 3 saniyəlik poll = 100 sorğu/5 dəqiqə. Auditin təklifi **60/300s** — yəni **normal istifadəçi limiti aşır**. Ya limit qaldırılmalı (150/300s), ya polling tezliyi azaldılmalıdır (polling→WS keçidi Task 10-dur → **indi limiti qaldır**).

   ⚠️ Bu, auditin təklifindəki **real səhvdir**. Kor-koranə tətbiq etsən presence bütün istifadəçilər üçün sınacaq.

3. **`search` səbətini ayrıca düşün.** `GET /api/search/semantic` embedding + Vectorize işlədir — `read` səbətinə düşməməlidir. Ya `ai` səbətinə sal, ya ayrıca `search: { limit: 60, windowSec: 3600 }` yarat.

4. Hər səbətin yanına **niyə bu dəyər** şərhi yaz — gələcəkdə kimsə "300 azdır" deyib qaldırmaq istəyəndə əsas görsün.

---

### 4.3 · Opt-in → opt-out inversiyası

**Audit ID:** H-4 · **Həcm:** 1,5 saat · **Bu task-ın ən riskli bəndidir**

**Nədir:** Hazırda `rl` verilməyən route limitsizdir. Bunu tərsinə çevir: `rl` verilməyən route avtomatik `read` səbətinə düşsün.

**Tələb:**

```ts
/**
 * Rate limit — DEFAULT DENY prinsipi (AUDIT-TASK-4 / H-4).
 *
 * Əvvəl: `rl` verilməyən route LİMİTSİZ idi → 107/171 route qorunmurdu.
 * İndi:  `rl` verilməyən route avtomatik DEFAULT_RL səbətinə düşür.
 *
 * Yeni route əlavə edən developer artıq rate limit haqqında DÜŞÜNMƏK
 * məcburiyyətində deyil — unutma halında təhlükəsiz default işləyir.
 *
 * İstisna lazımdırsa `rl: 'none'` AÇIQ şəkildə yazılmalıdır (bax 4.4).
 */
const DEFAULT_RL = 'read';
const bucket = route.rl ?? DEFAULT_RL;
```

**Kritik icra detalları:**

| Detal | Tələb |
|---|---|
| **`rl: 'none'` açıq istisna** | İstisna **sükutla** (bayrağın olmaması ilə) deyil, **açıq** yazılmalıdır. Bu, kod baxışında görünür olur |
| **Etibarsız səbət adı** | `rl: 'typo'` yazılarsa → **build/başlanğıc xətası**, sükutla `read`-ə düşməsin. TypeScript union tipi ilə həll et: `rl?: keyof typeof BUCKETS \| 'none'` |
| **Sıra** | Rate limit auth-dan **əvvəl**, yoxsa **sonra**? Auth-dan əvvəl olarsa anonim hücum ucuz kəsilir; sonra olarsa açar `uid` ola bilər. **Mövcud sıranı yoxla və qoru**, dəyişmə |
| **Səhv halı** | KV əlçatmaz olarsa limiter nə edir? **Fail-open** (keçir) yoxsa **fail-closed** (rədd)? Xərc qoruyucusu üçün fail-open düzgündür (KV nasazlığı bütün saytı çökdürməməlidir); təhlükəsizlik səbətləri üçün fail-closed. Mövcud davranışı yoxla və hesabata yaz |

**Doğrulama:**
```bash
grep -c "pattern:" worker/index.ts                    # ümumi
grep -c "rl: 'none'" worker/index.ts                  # açıq istisnalar
# Hər route ya səbət daşıyır, ya 'none' — üçüncü hal olmamalıdır
```

---

### 4.4 · İstisnalar və xüsusi hallar

**Həcm:** 1 saat · **auditdə yoxdur — sındırma riski buradadır**

Opt-out inversiyası bəzi yolları **sındırar**. Aşağıdakıların hər birini yoxla və qərar ver:

| Yol | Problem | Tövsiyə |
|---|---|---|
| **`/files/*`** | Bir feed səhifəsi 20+ şəkil yükləyir → 20 sorğu. `read` (300/60s) 15 səhifə sonra tükənir | Ayrıca `asset` səbəti (yüksək limit, məs. 1000/60s) və ya `rl: 'none'` |
| **WebSocket upgrade** | Bir dəfəlik əl sıxma; limitə düşməsi mənasızdır | `rl: 'none'` — WS daxilindəki mesaj limiti onsuz da `RoomDO` token-bucket-indədir |
| **SSE / long-poll** | Uzun ömürlü bağlantı | `rl: 'none'` |
| **`OPTIONS` (CORS preflight)** | Brauzer avtomatik göndərir, istifadəçi sorğusu deyil | Limiterdən **əvvəl** qaytarılmalıdır |
| **Admin toplu əməliyyatları** | Admin 200 istifadəçini emal edir → `write` (60/60s) tükənir | Ayrıca `admin` səbəti (səxavətli limit). ❌ **Bypass etmə** — limitsiz admin yolu hesab ələ keçirilməsi halında sərbəst hücum vasitəsidir |
| **Auth axını daxili sorğuları** | `refresh` avtomatik çağırılır | Mövcud `auth` səbəti kifayətdirmi? Yoxla |
| **Cron / Queue consumer** | HTTP router-dən keçmirsə problem yoxdur | Təsdiqlə |

**Hər istisna üçün kodda əsaslandırma şərhi məcburidir:**
```ts
// rl: 'none' — /files/* statik asset yoludur. Bir feed səhifəsi 20+ obyekt
// yükləyir; `read` səbətinə salınsa normal gəzinti 15 səhifədən sonra 429 alır.
// Sui-istifadə qoruması: R2 açarları təxmin edilə bilməz + Task 7-də avtorizasiya gəlir.
```

---

### 4.5 · Açar strategiyası

**Həcm:** 1 saat · **auditdə yoxdur**

**4.0/Sual 3-ün cavabına görə:**

| Hal | Problem | Tələb |
|---|---|---|
| Açar yalnız **IP** | Korporativ NAT / mobil operator arxasındakı 50 istifadəçi bir sayğac paylaşır → kütləvi 429 | Autentifikasiya olunmuş sorğularda **`uid`** işlət |
| Açar yalnız **uid** | Anonim sorğular (login, qeydiyyat, publik səhifələr) açarsız qalır | Anonim üçün **IP** |
| **IPv6** | Bir istifadəçiyə /64 prefiks daxilində milyonlarla ünvan düşür | IPv6-nı **/64 prefiksi** üzrə qrupla, tam ünvan üzrə yox |

**Tövsiyə olunan qayda:**
```ts
// Açar: səbət + kimlik. Autentifikasiya olunubsa uid (dəqiq və NAT-a davamlı),
// olunmayıbsa IP (IPv6 üçün /64 prefiksi — tam ünvan trivial şəkildə dəyişdirilir).
const identity = c.uid ?? normalizeIp(reqInfo(request).ip);
const key = `rl:${bucket}:${identity}`;
```

**Diqqət:** `worker/security.ts:23` `reqInfo()` artıq IP çıxarır — **yenisini yazma**, mövcudu işlət.

⚠️ **Təhlükəsizlik səbətləri üçün istisna:** `auth` səbəti **IP üzrə** qalmalıdır, `uid` üzrə deyil — çünki login zamanı uid hələ məlum deyil və hücumçu fərqli istifadəçi adları sınayır. Audit H-3 həmçinin **hesab başına** kilid tövsiyə edir (`security.ts:73` `recentFailures` hazırdır) — o, **Task 9**-dur, burada etmə.

---

### 4.6 · 429 cavabının düzgün formalaşdırılması

**Həcm:** 45 dəqiqə

**Tələb:**

1. **Status:** `429 Too Many Requests`
2. **`Retry-After` başlığı** — saniyə ilə. Bu, HTTP standartıdır və düzgün client-lər ona əməl edir:
   ```ts
   headers.set('Retry-After', String(retryAfterSec));
   ```
3. **Maşın-oxunaqlı kod** — layihənin öz fəlsəfəsinə uyğun (`util.ts:93-95`: *"code maşın üçündür… client mesaj mətninə baxıb təxmin etmək əvəzinə koda baxır"*):
   ```ts
   err('Çox sayda sorğu. Bir az sonra yenidən cəhd edin.', 429, 'rate_limited')
   ```
4. **Frontend emalı** — `js/api.js` 429-u necə emal edir? (4.0/Sual 4). Emal etmirsə:
   - İstifadəçiyə anlaşılan mesaj göstər (429 səssiz uğursuzluğa çevrilməsin)
   - Polling loop-ları `Retry-After` müddətinə **dayandırsın** — əks halda 429 alan poll dövrədə davam edib limiti daha da doldurur (**öz-özünü gücləndirən nasazlıq**)

   ⚠️ Bu sonuncu bənd vacibdir: 3 saniyəlik polling 429 aldıqda dayanmasa, istifadəçi limitdən **heç vaxt çıxa bilməz**.

5. **Log** — 429 hadisəsi `security_events`-ə yazılırmı? Audit `logSecurityEvent()`-in rate-limit pozmalarını yazdığını göstərir. Yeni səbətlərin də ora düşdüyünü təsdiqlə (log həcmi partlamasın deyə `read` səbəti üçün **sampling** düşün).

---

### 4.7 · Admin route-larında maşın kodu (Task 1 §5.3 mirası)

**Mənbə:** `AUDIT-TASK-1-REPORT.md` §5.3 · **Həcm:** 45 dəqiqə

**Nədir:** `worker/index.ts:453` → `err('Yalnız admin.', 403)` — `code` sahəsi yoxdur. Bu, **33 admin route-unun hamısına** aiddir. Layihənin öz sənədləşdirilmiş fəlsəfəsi (`util.ts:93-95`) buna ziddir.

Task 1-də qəsdən düzəldilmədi ("yeni funksionallıq yazılmır" qaydası). Bu task onsuz da xəta cavab formasına toxunduğu üçün **məntiqi yeri buradır**.

**Tələb:**
```ts
err('Yalnız admin.', 403, 'forbidden')
```

**Yoxlama — başqa kodsuz xətalar varmı:**
```bash
grep -rn "err(" worker/ | grep -E "40[0-9]|41[0-9]|42[0-9]" | grep -v "', *[0-9]\+, *'"
```
Tapılan hər kodsuz xətanı siyahıla. **Hamısını düzəltmə** — yalnız `403`/`401`/`429` kimi client-in davranış dəyişməli olduğu halları düzəlt. `500` üçün kod o qədər vacib deyil.

**Reqressiya riski:** Frontend hazırda 403-ün `code`-una baxmır (`js/api.js:53` yalnız `401`/`auth_required` yoxlayır — Task 1 §5.3). Yəni `code` əlavəsi **sındırıcı deyil**, sadəcə əlavədir. Bunu təsdiqlə və hesabata yaz.

---

### 4.8 · E2E testləri — ⚠️ paylaşılan sessiya problemi ilə

**Həcm:** 2 saat

**🔴 Əvvəlcə bunu oxu.** `AUDIT-TASK-3-REPORT.md` §8/1: E2E dəsti tək `AUTH_FILE` paylaşır və dəst 26 dəqiqəyə çıxıb. Rate limit testləri bu problemi **keyfiyyətcə pisləşdirir**:

> Rate limit testi paylaşılan uid-i limitə salır → **eyni uid ilə işləyən bütün digər testlər 429 alır** → dəst kütləvi şəkildə sınır.

**Bu, nəzəri risk deyil — qaçılmazdır.** Ona görə:

**Məcburi izolyasiya qaydaları:**

1. **Hər rate limit testi öz istifadəçisini yaradır.** Paylaşılan `AUTH_FILE` sessiyasını **istifadə etmə**. Task 3-dəki `loginAs` köməkçisi hazır nümunədir.
2. **Test bitdikdən sonra sayğacı təmizlə** — mümkünsə KV açarını sil, mümkün deyilsə pəncərənin bitməsini gözləmə (60s test dəstini uzadar) əvəzinə hər test üçün **yeni identity** işlət.
3. **Rate limit testləri serial işləsin** (`test.describe.configure({ mode: 'serial' })`) — paralel işləsələr bir-birinin sayğacına təsir edə bilər.
4. **Bu testləri ayrıca layihə/teq altına al** ki, əsas dəstdən təcrid oluna bilsin:
   ```ts
   test.describe('AUDIT H-4 @ratelimit', () => { … });
   ```

**Test dəsti:**

```ts
test.describe('AUDIT H-4 — rate limit əhatəsi @ratelimit', () => {
  test.describe.configure({ mode: 'serial' });

  // ─── 🔴 REQRESSİYA — ən vacib test ───
  test('normal istifadəçi axını 429 ALMIR', async () => {
    // Yeni istifadəçi yarat → login → feed aç → profil aç → axtar →
    // otaq aç → 60 saniyə polling simulyasiyası
    // Gözlənilən: heç bir 429
    // SINSA → limitlər çox aşağıdır, 4.2-yə qayıt
  });

  test('/files/* çoxsaylı asset sorğusu 429 vermir', async () => {
    // 50 ardıcıl fayl sorğusu → hamısı < 400
    // 4.4-dəki asset istisnasının sübutu
  });

  // ─── Əhatə ───
  test('rl bayrağı olmayan route default səbətə düşür', async () => {
    // Əvvəl limitsiz olan bir route-a limit üstü sorğu → 429
  });

  test('AI endpoint saatda 20-dən sonra 429 verir', async () => {
    // POST /api/ai/chat × 21 → sonuncu 429
    // ⚠️ Bu test real AI çağırışı edirsə PUL XƏRCLƏYİR.
    // Mock/stub yolu varsa onu işlət; yoxdursa testi @expensive teqi ilə ayır
  });

  test('presence limiti normal polling tezliyini KƏSMİR', async () => {
    // 5 dəqiqəlik pəncərədə 3 saniyəlik poll = 100 sorğu → 429 OLMAMALIDIR
    // Zamanı sürətləndirmək üçün limitin dəyərini birbaşa yoxlamaq da olar
  });

  // ─── Cavab forması ───
  test('429 cavabı Retry-After və code daşıyır', async () => {
    // status === 429
    // headers['retry-after'] mövcud və rəqəmdir
    // body.code === 'rate_limited'
  });

  test('admin 403-ü maşın kodu daşıyır', async () => {
    // Adi istifadəçi → istənilən admin route → body.code === 'forbidden'
    // 4.7-nin sübutu
  });

  // ─── İzolyasiya ───
  test('bir istifadəçinin limiti digərini təsir etmir', async () => {
    // User A limitə çatır → User B normal işləyir
    // 4.5 açar strategiyasının sübutu
  });
});
```

---

## 4. ƏHATƏDƏN KƏNAR — bunları ETMƏ

| Tapıntı | Aid task | Səbəb |
|---|---|---|
| **Atomik rate limiter** (native binding / `RateLimitDO`) | **Task 9** | H-3 — ayrı problem, 1 gün |
| **Hesab başına kilid** (`recentFailures` → 10 cəhddən sonra) | **Task 9** | H-3-ün bir hissəsi |
| `RoomDO` token-bucket state itkisi (M-4) | **Task 9** | Hibernation problemi |
| XP anti-abuse (H-5) | **Task 9** | Rate limit XP istismarını **azaldır**, həll etmir |
| Polling → WebSocket keçidi | **Task 10** | 2 gün; bu task limiti polling reallığına **uyğunlaşdırır** |
| E2E paylaşılan sessiya refaktoru | **Ayrıca task** | Task 3 §8/1 — bu task yalnız öz testlərini izolə edir |
| `serveFile` avtorizasiyası (C-1) | **Task 7** | 4.4-dəki `/files/*` istisnası oraya bağlıdır |
| Demo seed (H-7) | **Task 5** | — |
| M-5…M-17 validasiya paketi | **Task 6** | — |
| `getTeam` sayt admininə `['*']` qaytarır | **Task 10** | Task 3 §8/4 — UI məsələsi |

---

## 5. İCRA QAYDALARI

### 5.1 Commit strategiyası

```
feat(ratelimit): opt-in → opt-out inversiyası (default DENY)

Audit: AUDIT-2026-07-26.md §H-4
Risk: High (maliyyə DoS)
Təsir: 107/171 route limitsiz idi — Workers AI və Vectorize daxil.
Qeyd: Bu, ƏHATƏNİ genişləndirir. Limiterin ATOMİKLİYİ (H-3) Task 9-dadır.
Test: e2e/*.spec.ts @ratelimit — N test, izolə identity ilə
```

**Sıra:** 4.0 → 4.1 → 4.2 → 4.5 → 4.6 → 4.7 → 4.4 → 4.3 → 4.8

⚠️ **4.3 (inversiya) sondan əvvəl gəlir.** Səbəb: inversiya "hər şeyi sındıra bilən" addımdır. İstisnalar (4.4), açar strategiyası (4.5) və cavab forması (4.6) **ondan əvvəl hazır olmalıdır** ki, inversiya tətbiq olunanda sistem artıq düzgün davransın.

### 5.2 🔴 Əsas gərginlik — KV yazı amplifikasiyası

Bu task-ın ən vacib mühəndislik məsələsi və auditdə **yoxdur**:

Hazırda 64 route KV yazısı edir. İnversiyadan sonra **171** route edəcək — **2,7× artım**. Bunun üç nəticəsi var:

| Nəticə | Təsir | Qərar |
|---|---|---|
| **KV yazı xərci** | Hər sorğu = 1 read + 1 write | Ölç və hesabata yaz. Cloudflare KV yazısı oxumadan **baha**dır |
| **KV 1 yazı/saniyə/açar həddi** | Aktiv istifadəçi eyni `rl:read:<uid>` açarına saniyədə bir neçə yazı edir → **yazılar sükutla itir** | Xərc qoruyucusu üçün **məqbuldur** (limit bir az sızır). Bunu şərhdə yaz ki, gələcəkdə "limiter işləmir" kimi səhv diaqnoz qoyulmasın |
| **Gecikmə** | Hər sorğuya KV round-trip əlavə olunur | Ölç: dəyişiklikdən əvvəl/sonra p50 və p95 |

**Qərar:** Bu, **qəbul edilən müvəqqəti xərcdir**. Task 9 atomik limiterə keçəndə həll olunur. Lakin:
- Ölçülməli və hesabata yazılmalıdır.
- Kodda şərh olmalıdır ki, itkili sayma **məlum və qəbul edilmiş** davranışdır.
- Xərc gözləniləndən yüksək çıxarsa, `read` səbəti üçün **sampling** (məs. hər 5-ci sorğunu say, limiti 5× artır) alternativi hesabatda təklif olunmalıdır.

### 5.3 Fail-open vs fail-closed

| Səbət sinfi | KV nasazlığında | Səbəb |
|---|---|---|
| Xərc qoruyucusu (`read`, `write`, `presence`) | **Fail-open** (keçir) | KV nasazlığı bütün saytı çökdürməməlidir |
| Təhlükəsizlik (`auth`, `upload`) | **Fail-closed** (rədd) | Limiter işləmirsə brute-force açıqdır |

Mövcud davranışı yoxla; fərqlidirsə dəyişməzdən əvvəl hesabatda əsaslandır.

### 5.4 Auditin rəqəmlərinə güvənmə

Task 2 §5.2 və Task 3 §8/6 göstərdi ki, auditin siyahıları **natamamdır**. Bu task-da:
- "171/64/107" rəqəmlərini **öz sayğacınla** təsdiqlə (4.0/Sual 1).
- Auditin sadaladığı 6 "ən ciddi" endpoint-lə kifayətlənmə — **rl-siz route-ların tam siyahısını** çıxar və hər birini təsnif et.

---

## 6. QƏBUL MEYARLARI

| # | Meyar | Doğrulama | Gözlənilən |
|---|---|---|---|
| **1** | 🔴 **Normal istifadəçi axını 429 almır** | `npx playwright test @ratelimit --grep "REQRESSİYA\|normal"` | yaşıl |
| **2** | 🔴 **Tam E2E dəsti sınmır** | `npx playwright test` | Task 3 nəticəsi ≥ |
| 3 | Limitsiz route qalmayıb | `grep -c "pattern:"` vs `rl:` + `rl: 'none'` cəmi | bərabər |
| 4 | Hər istisna açıqdır | `grep -n "rl: 'none'"` | hər biri şərhli |
| 5 | Etibarsız səbət adı build-i sındırır | `rl: 'typo'` yaz → `npx tsc --noEmit` | **xəta verir** |
| 6 | AI endpoint limitlidir | `POST /api/ai/chat` × (limit+1) | sonuncu 429 |
| 7 | Semantic search limitlidir | eyni | 429 |
| 8 | `presence` normal polling-i kəsmir | 5 dəq × 3 san poll | 429 yox |
| 9 | `/files/*` asset axını kəsilmir | 50 ardıcıl fayl sorğusu | hamısı < 400 |
| 10 | 429 `Retry-After` daşıyır | cavab başlıqları | rəqəm dəyər |
| 11 | 429 `code: 'rate_limited'` daşıyır | cavab gövdəsi | ✅ |
| 12 | Admin 403 `code: 'forbidden'` daşıyır | adi istifadəçi → admin route | ✅ |
| 13 | Limitlər istifadəçi arası izolədir | User A limitdə, User B normal | B işləyir |
| 14 | Frontend 429-u emal edir | brauzerdə limit doldur | anlaşılan mesaj, polling **dayanır** |
| 15 | Strict TypeScript keçir | `npx tsc --noEmit` | exit 0 |
| 16 | Build uğurludur | `npm run build` | exit 0 |
| 17 | KV amplifikasiyası ölçülüb | hesabat §5 | rəqəmlər mövcuddur |

**Meyar 1 və ya 2 ❌ olarsa:** limitlər çox aşağıdır. `git revert` → 4.2-yə qayıt → 4.0/Sual 6-nın ölçmələrini yenidən nəzərdən keçir.

---

## 7. HESABAT FORMATI

`docs/AUDIT-TASK-4-REPORT.md`:

```markdown
# AUDIT-TASK-4 — İcra Hesabatı

**Tarix:** …   **İcraçı:** …   **Commit-lər:** <hash → başlıq>

## 0. Vəziyyət xəritəsi (4.0)
| Göstərici | Audit iddiası | Faktiki |
| Ümumi route | 171 | … |
| rl daşıyan | 64 | … |
| rl-siz | 107 | … |

### Mövcud səbətlər
| Səbət | Limit | Pəncərə | Sinif (4.1) | Route sayı |

### Açar strategiyası (Sual 3)
### Normal istifadəçi profili (Sual 6)
| Ssenari | Sorğu/dəqiqə |
| Feed açılışı | … |
| Polling (3s) | 20 |
| **Cəmi tipik** | … |
→ `read` limiti <300 / dəyişdirildi: N> — əsaslandırma

## 1. Bağlanan tapıntılar
| Audit ID | Bənd | Vəziyyət | Sübut |

## 2. Qəbul meyarları  (17 sətir)

## 3. Səbət taksonomiyası (4.1)
| Səbət | Sinif | H-3 təsiri | Task 9-a köçürülməlidir? |

## 4. İstisnalar (4.4)
| Route | Səbəb | Kompensasiya edən qoruma |

## 5. 🔴 KV yazı amplifikasiyası (§5.2)
| Göstərici | Əvvəl | Sonra | Fərq |
| KV yazı/sorğu | … | … | … |
| p50 gecikmə | … | … | … |
| p95 gecikmə | … | … | … |
| Təxmini aylıq KV xərci | … | … | … |
→ Qərar: <qəbul edildi / sampling təklif olunur>

## 6. Aşkarlanan yeni risklər

## 7. Açıq qalan öhdəliklər
- [ ] 🔴 Atomik limiter → **Task 9** (təhlükəsizlik səbətləri hazırda sızır)
- [ ] Polling → WS → **Task 10** (presence limiti buna görə səxavətlidir)
- [ ] E2E paylaşılan sessiya refaktoru (Task 3 §8/1)

### Əvvəlki task-lardan miras
- [ ] 🔴 `ARCHIVE_HOT_DAYS` → `"90"` (Task 8-dən sonra; əvvəlcə Privacy §4)
- [ ] 🔴 Hüquqi mətnin peşəkar nəzərdən keçirilməsi
- [ ] 🔴 `collabix.az` DNS + MX
- [ ] 🟠 TestSprite API açarının rotasiyası
- [ ] 🟠 53 hesaba parol sıfırlama qərarı
- [ ] 🟠 VÖEN, sosial profillər
- [ ] 💡 `is_system` miqrasiyası (Task 3 §4) — istifadəçi qərarı gözləyir
- [ ] Demo seed `role_1` → **Task 5**
- [ ] Git remote qərarı

## 8. Geri qaytarma planı
| Commit | Revert | Gözlənilən təsir |
| 4.3 inversiya | `git revert <hash>` | 107 route yenidən limitsiz — H-4 açılır |
```

---

## 8. BİRİNCİ ADDIM

**Yalnız oxu rejimində** 4.0-dakı 6 sualı cavablandır. Kod dəyişikliyinə **başlama**.

Xüsusilə bu üçünü rəqəmlə cavablandır:

1. **Sual 1** — faktiki route sayı və rl-siz route-ların **tam siyahısı**. Audit 107 deyir; öz sayğacınla təsdiqlə.
2. **Sual 3** — limiter açarı `uid` üzrədir, IP üzrədir, yoxsa hər ikisi? Anonim sorğular necə açarlanır?
3. **Sual 6** — tipik aktiv istifadəçi dəqiqədə neçə sorğu edir? Polling tezliyi nədir?

**Dayanma şərti:** Sual 6-nın cavabı `presence` üçün auditin təklif etdiyi **60/300s** limitini aşırsa (3 saniyəlik polling = 100/300s → **aşır**), auditin dəyərini kor-koranə tətbiq etmə. Düzəldilmiş dəyəri təklif et və təsdiq gözlə.

Cavablar hazır olduqdan sonra §5.1-dəki sıra ilə icraya başla — **4.3 sondan əvvəl**.
