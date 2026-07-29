# AUDIT-TASK-9 — Runtime Təhlükəsizliyi və XP Bütövlüyü

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md` §H-3 (448–467), §H-5 (495–513), §H-6 (517–531), §M-4
**Əlavə mənbələr:** `AUDIT-TASK-4-REPORT.md` §4.1 (səbət taksonomiyası) · `AUDIT-TASK-6-REPORT.md` §D-2 (CHECK trigger-ləri) · `AUDIT-TASK-7-REPORT.md` (üzvlük keşi) · `AUDIT-TASK-8-REPORT.md` §7.b, §9
**Bağlanan tapıntılar:** **H-3**, **H-5**, **H-6** (3 High) + **M-4** (Medium) + 2 miras bənd
**Təxmini həcm:** **4,5–5 gün** (4 faza)
**Ön şərt:** AUDIT-TASK-8 tamamlanmış + ⚠️ **E2E baseline qərarı** (9.0/Sual 0)
**Risk sinfi:** 🔴 Yüksək — üç fərqli runtime alt-sistemi (KV/DO, XP, WebSocket) eyni task-da dəyişir

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-9  Dörd faza: (A) atomik rate limiter — Task 4-ün təhlükəsizlik/xərc
               taksonomiyasına görə mexanizm seç; hesab başına kilid.
               (B) XP anti-abuse — xp_logs + UNIQUE + gündəlik tavan + kompensasiya
               + submitSolution təkrar-təsdiq bağlanması.
               (C) WS periodik re-auth + disconnect(uid) RPC + RoomDO state → storage.
               (D) miras: partiya dəyişən limiti auditi, silinmiş hesabın isti mesajları.
               ⚠️ Kompensasiya Task 6-nın xp>=0 CHECK trigger-inə DƏYƏ BİLƏR — §B-4.
               DONE: paralel 200 sorğu limiti keçmir; XP dövrəsi 0 XP verir;
                     çıxarılan üzv WS-dən düşür; hibernation token-bucket-i sıfırlamır.
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli sistem mühəndisisən**.

Bu task **üç fərqli runtime alt-sistemini** eyni anda dəyişir: rate limiting (KV/DO), XP mühasibatı (D1 + trigger), WebSocket sessiya idarəçiliyi (Durable Objects). Onlar bir-birindən müstəqildir, lakin **hər biri canlı istifadəçi axınının ortasındadır**.

İki davranış qaydası:

1. **Faza-faza işlə.** A, B, C, D ayrı-ayrı bloklardır. Bir fazanın sınması digərini bloklamamalıdır.
2. **Task 8 §7.b-nin dərsini tətbiq et.** Orada `ARCHIVE_HOT_DAYS = 3650` iki task boyu **gizli Critical qüsuru** örtdü: kod yolu heç vaxt işə düşmədiyi üçün D1 dəyişən limiti aşılması görünmədi, test datası isə limitin altında idi.
   → **Bu task-da hər partiya/limit yolu üçün test datası limitin ÜSTÜNDƏ olmalıdır.**

---

## 2. KONTEKST

### 2.a Bağlanan tapıntılar

| ID | Nədir | Yer |
|---|---|---|
| **H-3** | Rate limiter atomik deyil → brute-force qoruması sızır | `auth.ts:312-322` |
| **H-5** | XP anti-abuse tamamilə yoxdur → sonsuz XP | `routes.ts:790, 845, 1013, 1387, 1411` |
| **H-6** | WS avtorizasiyası yalnız upgrade anında yoxlanılır | `index.ts:386-395`, `room-do.ts:113-131` |
| **M-4** | `RoomDO` token-bucket state-i hibernation-da itir | `room-do.ts` |

### 2.b H-3 — üç ayrı qüsur

```ts
// auth.ts:312-322
const cur = parseInt((await env.SESSIONS.get(key)) || '0', 10);
if (cur >= limit) return false;
await env.SESSIONS.put(key, String(cur + 1), { expirationTtl: cfg.windowSec + 60 });
```

| # | Qüsur | Nəticə |
|---|---|---|
| 1 | **Read-then-write yarışı** | Paralel N sorğu eyni `cur`-u oxuyur; limit 10 olsa da **200 sorğu keçə bilər** |
| 2 | **KV eventual consistency** | Dəyər qlobal olaraq ~60 s-ə yayılır; hər edge PoP müstəqil sayğac görür → **botnet coğrafi paylanma ilə limiti dəfələrlə keçir** |
| 3 | **KV: 1 yazı/saniyə/açar** | Sürətli seriyada `put` **sükutla itir**, sayğac artmır |

**Təsir:** `auth` səbəti (10/300s) real dünyada qat-qat zəifdir. Parol hücumu, MFA kod hücumu (`mfaVerify` **yalnız** bu limitə güvənir), magic-link spam.

⚠️ **Task 4 §5.2** KV yazılarının 2,7× artdığını ölçmüşdü → qüsur #3 **daha da pisləşib**.

### 2.c 🔴 Task 4-ün taksonomiyası bu task üçün yazılmışdı

`AUDIT-TASK-4-REPORT.md` §4.1 səbətləri iki sinifə böldü — **məhz bu task-da qərar verilə bilsin deyə**:

| Sinif | Səbətlər | Dəqiqlik tələbi | H-3-ün təsiri |
|---|---|---|---|
| 🔴 **Təhlükəsizlik kontrolu** | `auth`, `upload`, MFA, magic-link | **Atomik olmalıdır** | Hazırda **sızır** |
| 🟠 **Xərc qoruyucusu** | `ai`, `read`, `write`, `presence`, `archive`, `asset` | Təxmini kifayətdir | KV itkiliyi **məqbuldur** |

**Nəticə:** Bütün səbətləri eyni mexanizmə köçürmək **lazım deyil və bahalıdır**. Yalnız təhlükəsizlik sinfi atomik mexanizm tələb edir. Bax 9.1.

### 2.d H-5 — iki istismar

**İstismar 1 (post dövrəsi):**
post yarat (+10 XP) → postu sil (**XP qalır**) → təkrarla.
`rl: 'write'` = 60/dəq → **600 XP/dəq = 36 000 XP/saat**. `levelFromXP = sqrt(xp/100)+1` → **bir saatda Lv 20**.

**İstismar 2 (təkrar təsdiq):**
`submitSolution` (`routes.ts:1387`) `ON CONFLICT … status='pending'` edir. Təsdiqlənmiş həlli yenidən göndərmək statusu `pending`-ə qaytarır; admin təkrar təsdiqləyəndə `if (status === 'approved' && row.status !== 'approved')` şərti **yenidən doğru olur** → **+50 XP və `tasks_completed`+1 təkrar verilir**.

**Təsir:** Liderlik cədvəli, `usersDirectory` XP sıralaması, badge-lər, komanda reputation-ı mənasızlaşır. `xp_logs` yoxdur → **istismarı geriyə dönük aşkarlamaq mümkün deyil**.

### 2.e H-6 — açıq soketin əbədi etibarı

Komanda otağı üzvlüyü **yalnız** WS upgrade-də yoxlanılır. Soket açıldıqdan sonra `RoomDO.webSocketMessage` yalnız `meta.uid`-in mövcudluğuna baxır. **Hibernation API ilə soket saatlarla, günlərlə yaşaya bilər.**

**Təsir:** Komandadan çıxarılan, bloklanan və ya sessiyası ləğv edilən istifadəçi açıq soket üzərindən **məxfi otağı oxumağa və yazmağa davam edir**. `revokeAllSessions` və `removeMember` WS-ə **təsir etmir**.

⚠️ Task 7 `canReadKey` ilə **fayl** oxusunu bağladı, Task 3 `removeMember`-i düzəltdi — lakin **açıq soket hər ikisini keçir**.

### 2.f Əvvəlki task-lardan gələn dörd bağlayıcı dərs

| Mənbə | Dərs | Bu task-a təsiri |
|---|---|---|
| **Task 8 §7.b** | `IN (?×2000)` D1 limitini aşırdı; kod yolu işləmədiyi üçün **2 task gizli qaldı** | Faza D-1: bütün partiya yolları auditi |
| **Task 8 §9/2** | Test datası limitin **altında** idi | Hər limit yolu üçün **limit üstü** test datası |
| **Task 6 §D-2** | `users_xp_nonneg` CHECK trigger-i əlavə edildi (`xp >= 0`) | ⚠️ **Kompensasiya bu trigger-ə dəyə bilər** → Faza B-4 |
| **Task 7 §7.3** | Üzvlük keşi + açıq invalidasiya naxışı qurulub | Faza C-1 **eyni naxışı** işlədir, yenisini icad etmir |

---

## 3. ƏHATƏ — 4 FAZA

---

### 9.0 · Vəziyyət xəritəsi və qapılar (ÖN İŞ)

**Həcm:** 2 saat

#### 🔴 Sual 0 — E2E baseline qapısı (BAĞLAYICI)

Task 7 §9 və Task 8 §10 eyni şeyi deyir:
> **80 sınıq E2E testi** (`e2e/KNOWN-FAILING.md`) — yaşıl baseline olmadan sonrakı task-ların reqressiyaları **səs-küydə itir**.

```bash
npx playwright test 2>&1 | tail -20
```

| Nəticə | Əməliyyat |
|---|---|
| Yaşıl | ✅ Davam |
| 80 sınıq qalır | ⚠️ **DAYAN** — qərar istə |

**Bu task üçün tövsiyə əvvəlkindən sərtdir: baseline bərpa edilməlidir.** Səbəb: Task 9 **WebSocket** və **XP** yollarını dəyişir — hər ikisi E2E-dən başqa üsulla doğrulana bilməz. `ws-flow` testləri onsuz da sınıq siyahısındadır (Task 4 §7/3: 2 → 6).

#### Sual 1 — Rate limiter mexanizmi: nə mövcuddur?

Cloudflare-in **native rate limiting binding**-inin cari semantikasını **sənəddən yoxla** (təxmin etmə):

| Sual | Niyə vacibdir |
|---|---|
| Binding **qlobalmı, yoxsa PoP başınamı** sayır? | PoP başınadırsa H-3/#2 (coğrafi paylanma) **bağlanmır** |
| Limit `wrangler.jsonc`-də **statik** təyin olunur, yoxsa runtime-da dinamik? | Task 4-də 8+ səbət var — hər biri üçün ayrı binding lazım ola bilər |
| Pəncərə növü: sabit (fixed) yoxsa sürüşən (sliding)? | Sərhəd effekti |
| Xəta/əlçatmazlıq davranışı | Fail-open yoxsa fail-closed |

⚠️ **Sənəd nəticəsi qərarı müəyyən edir.** Binding PoP başınadırsa, `auth` səbəti üçün **DO əsaslı limiter** məcburidir.

#### Sual 2 — Mövcud DO naxışı
```bash
sed -n '1,140p' worker/room-do.ts
grep -rn "token.*bucket\|refill\|allowance" worker/room-do.ts
```
Audit deyir: *"`room-do.ts`-dəki token-bucket naxışı hazır nümunədir"*. Onu oxu — `RateLimitDO` eyni naxışı təkrarlamalıdır.

Həmçinin: state harada saxlanılır — **yaddaşda** (hibernation-da itir → M-4) yoxsa `ctx.storage`-də?

#### Sual 3 — XP verilən bütün yerlər
```bash
grep -rn "xp\s*[+=]\|UPDATE users SET xp\|xp = xp" worker/
```
Audit 4 yer sadalayır (`:790`, `:1013`, `:1411`, `:845`). **Öz sayğacınla təsdiqlə** — Task 2 §5.2 (6× az sayma) və Task 3 §8/6 (sadalanmamış route) dərsləri.

#### Sual 4 — Mövcud XP-nin vəziyyəti
```sql
SELECT COUNT(*) AS users, SUM(xp) AS total_xp, MAX(xp) AS max_xp,
       AVG(xp) AS avg_xp FROM users WHERE xp > 0;
SELECT id, username, xp, tasks_completed FROM users ORDER BY xp DESC LIMIT 20;
```
⚠️ **Anomaliya axtar:** ortadan kəskin fərqlənən XP istismar əlaməti ola bilər. `xp_logs` olmadığı üçün geriyə dönük sübut yoxdur, lakin **şübhəli hesablar qeyd edilməlidir**.

#### Sual 5 — Task 6-nın CHECK trigger-i
```bash
grep -rn "users_xp_nonneg\|RAISE(ABORT" migrations/
```
Trigger mövcuddursa **kompensasiya onu tetikləyə bilər** → Faza B-4-ün dizaynını müəyyən edir.

#### Sual 6 — WS axını və mövcud qoruma
```bash
sed -n '380,400p' worker/index.ts
sed -n '100,140p' worker/room-do.ts
grep -rn "revokeAllSessions\|removeMember\|blockUser" worker/ | grep -i "room\|ws\|socket"
```
Sonuncu **boş çıxacaq** (H-6-nın özü budur) — təsdiqlə.

**Dayanma şərti:** Sual 0, Sual 1 və Sual 5 cavablanmadan kod yazma.

---

# FAZA A — Atomik rate limiter (H-3)

**Həcm:** 1,5 gün

---

### A-1 · Mexanizm seçimi (QƏRAR QAPISI)

**Həcm:** 2 saat

9.0/Sual 1-in nəticəsinə görə **hər səbət sinfi üçün ayrıca** qərar ver:

| Sinif | Variantlar | Qiymətləndirmə meyarı |
|---|---|---|
| 🔴 **Təhlükəsizlik** (`auth`, `upload`, MFA, magic-link) | (a) Native binding · (b) `RateLimitDO` · (c) Hibrid | **Atomiklik + qlobal ardıcıllıq məcburidir** |
| 🟠 **Xərc qoruyucusu** (qalan 6+ səbət) | (d) KV-də qalsın | Dəyişiklik **lazım deyil** |

**Variantların müqayisəsi:**

| Variant | Atomiklik | Qlobal ardıcıllıq | Gecikmə | Xərc | Mürəkkəblik |
|---|---|---|---|---|---|
| **(a) Native binding** | ✅ | ⚠️ **9.0/Sual 1-dən asılı** | Çox aşağı | Aşağı | Aşağı |
| **(b) `RateLimitDO`** | ✅ | ✅ (tək DO instance) | ⚠️ DO-ya round-trip | Orta | Orta |
| **(c) Hibrid** | ✅ | ✅ | Orta | Orta | Yüksək |
| **(d) KV (mövcud)** | ❌ | ❌ | Aşağı | Aşağı | — |

**Tövsiyə olunan yol:**
- Native binding **qlobal**dırsa → **(a)** təhlükəsizlik səbətləri üçün, `auth` üçün əlavə olaraq A-3 (hesab kilidi).
- Native binding **PoP başına**dırsa → **(b)** `auth` və MFA üçün; `upload` üçün (a) kifayət edə bilər.

⚠️ **DO gecikmə tələsi:** DO tək instance-dır və coğrafi olaraq bir yerdədir. Uzaq istifadəçi üçün əlavə 100–300 ms. Login yolunda bu **məqbuldur** (nadir əməliyyat), lakin `upload` üçün hər fayl yükləməsinə əlavə olunar → **ölç**.

⚠️ **DO açar strategiyası:** hər limit açarı üçün ayrıca DO instance (`idFromName(key)`) — çoxlu kiçik DO. Alternativ: şardlanmış DO (`idFromName(hash(key) % N)`). Birincisi sadə və atomikdir; ikincisi az DO yaradır, lakin daxili sayğac ayrımı tələb edir. **Birincini seç** — sadəlik reqressiya riskini azaldır.

**Qərarı hesabatda əsaslandır və istifadəçiyə təqdim et.**

---

### A-2 · İmplementasiya

**Həcm:** 4 saat

**Tələb:**

```ts
/**
 * Atomik rate limiter — AUDIT-2026-07-26 / H-3.
 *
 * Əvvəl (auth.ts:312): KV read-then-write. Üç qüsur:
 *   1. Yarış — paralel 200 sorğu eyni sayğacı oxuyub hamısı keçirdi
 *   2. KV eventual consistency — hər PoP müstəqil sayğac görürdü
 *   3. KV 1 yazı/san/açar — sürətli seriyada put SÜKUTLA itirdi
 *
 * ⚠️ Bütün səbətlər köçürülmür. AUDIT-TASK-4 §4.1 taksonomiyası:
 *   - TƏHLÜKƏSİZLİK səbətləri (auth, upload, MFA) → atomik mexanizm
 *   - XƏRC qoruyucuları (read, ai, presence, …) → KV-də qalır;
 *     təxmini sayma kifayətdir və miqrasiya xərcini əsaslandırmır.
 */
```

**Kritik detallar:**

| Detal | Tələb |
|---|---|
| **İnterfeys dəyişməzliyi** | Çağıran kod (`index.ts` route dispatcher) **dəyişməməlidir**. `rateLimit(bucket, key)` imzası eyni qalsın; daxildə mexanizm seçilsin |
| **Fail-closed** | Təhlükəsizlik səbətlərində mexanizm əlçatmaz olarsa → **RƏDD ET**. Task 4 §5.3 bu qaydanı qoydu |
| **Fail-open** | Xərc qoruyucularında KV nasazlığı bütün saytı çökdürməməlidir |
| **`Retry-After`** | Task 4 §4.6-da qurulub — yeni mexanizm də düzgün dəyər qaytarmalıdır |
| **`code: 'rate_limited'`** | Eyni |
| **Telemetriya** | Hansı mexanizmin işlədiyi loglansın — miqrasiya dövründə diaqnostika üçün |
| **Geri qaytarma açarı** | Env dəyişəni ilə köhnə KV yoluna qayıtma imkanı (`RL_MECHANISM=kv\|native\|do`). ⚠️ Bu, **müvəqqəti** olmalıdır — Task 1-dəki `ARCHIVE_HOT_DAYS` dərsi: müvəqqəti bayraq geri qaytarma öhdəliyi ilə yazılmalıdır |

**🔴 Limit üstü test (Task 8 §9/2 dərsi):**
```ts
// 200 paralel sorğu — limit 10
const results = await Promise.all(Array.from({ length: 200 }, () => attempt()));
expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(10);
// KV limiter-də bu test SINACAQ (məhz H-3-ün sübutu)
```

---

### A-3 · Hesab başına kilid

**Həcm:** 3 saat

Audit tələb edir:
> Əlavə olaraq **hesab başına** kilid: `recentFailures` (`security.ts:73`) artıq istifadəçi adı üzrə sayır — 10 uğursuz cəhddən sonra hesabı müvəqqəti kilidlə.

**Niyə lazımdır:** IP əsaslı limit paylanmış hücumu (hər IP-dən 5 cəhd, 1000 IP) tutmur. Hesab əsaslı kilid hədəflənmiş hücumu bağlayır.

**Tələb:**

| Detal | Qərar |
|---|---|
| **Kilid müddəti** | Sabit (məs. 15 dəq) yoxsa eksponensial artan? *Tövsiyə: eksponensial, tavanlı — 1, 2, 4, 8, 15 dəq* |
| **Sayğacın sıfırlanması** | Uğurlu girişdə sıfırlanmalıdır |
| **Bildiriş** | İstifadəçiyə email göndərilsinmi? *Tövsiyə: bəli — `security_events` onsuz da yazır; email hesab sahibinə hücumdan xəbər verir* |
| **🔴 Hesab sadalama (enumeration)** | ⚠️ Kilid mesajı mövcud olmayan hesab üçün **fərqli olmamalıdır**. `"Hesab müvəqqəti bloklanıb"` vs `"Yanlış parol"` → hücumçu hansı istifadəçi adlarının mövcud olduğunu öyrənir |
| **Admin bərpası** | Admin kilidi əl ilə aça bilməlidirmi? *Tövsiyə: bəli — dəstək halları üçün* |
| **DoS riski** | 🔴 Hücumçu qurbanın hesabını qəsdən kilidləyə bilər. **Azaltma:** kilid yalnız **eyni IP/ASN**-dən gələn cəhdlərə tətbiq olunsun, ya da kilid CAPTCHA-ya çevrilsin (Turnstile mövcuddur) |

⚠️ **Sonuncu bənd vacibdir.** Sadə hesab kilidi **yeni hücum vektoru** yaradır: rəqib istifadəçinin hesabını istənilən vaxt bloklaya bilər. Turnstile layihədə **artıq mövcuddur** (audit təsdiqləyir) → kilid əvəzinə **məcburi CAPTCHA** daha yaxşı seçimdir.

**Qərar qapısı:** kilid yoxsa CAPTCHA? İstifadəçiyə təqdim et.

---

# FAZA B — XP anti-abuse (H-5)

**Həcm:** 1,5–2 gün

---

### B-1 · `xp_logs` sxemi və backfill strategiyası

**Həcm:** 3 saat

```sql
-- 00XX_xp_logs.sql — AUDIT H-5
CREATE TABLE IF NOT EXISTS xp_logs (
  id         TEXT PRIMARY KEY,
  uid        TEXT NOT NULL,
  source     TEXT NOT NULL,          -- 'post' | 'comment' | 'solution' | 'legacy' | 'compensation'
  ref_id     TEXT,                   -- post/comment/submission id
  amount     INTEGER NOT NULL,       -- müsbət = qazanc, mənfi = kompensasiya
  created_at INTEGER NOT NULL
);

-- İdempotentliyin özəyi: eyni (uid, source, ref_id) üçün XP BİR DƏFƏ verilir.
CREATE UNIQUE INDEX IF NOT EXISTS ux_xp_logs_source
  ON xp_logs(uid, source, ref_id) WHERE ref_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_xp_logs_uid_created ON xp_logs(uid, created_at);
```

⚠️ **Miqrasiya nömrələməsi:** Task 5-in qaydası — `npm run check:migrations` yaşıl olmalıdır.

**🔴 Backfill qərarı (kritik):**

Mövcud XP **loglar olmadan** qazanılıb. Bu, iki problem yaradır:

1. **Kompensasiya mənfi XP verə bilər.** Köhnə post silinərsə, ona uyğun `xp_logs` sətri yoxdur → nə qədər geri alınmalıdır? Bilinmir.
2. **Task 6-nın `users_xp_nonneg` trigger-i `RAISE(ABORT)` edir** → silmə əməliyyatı **DB xətası ilə çökər**.

**Həll — sintetik `legacy` sətri:**
```sql
-- Hər istifadəçi üçün mövcud XP-ni tək 'legacy' sətri kimi qeyd et.
-- Səbəb: xp_logs-dan əvvəlki XP-nin mənbəyi bilinmir; kompensasiya
-- yalnız UYĞUN log sətri olan əməliyyatlara tətbiq olunur (bax B-4).
INSERT INTO xp_logs (id, uid, source, ref_id, amount, created_at)
SELECT lower(hex(randomblob(16))), id, 'legacy', NULL, xp, <now>
FROM users WHERE xp > 0;
```

Bu, üç şeyi təmin edir:
- Cəm `SUM(xp_logs.amount) == users.xp` **invariantı** qurulur → gələcəkdə yoxlanıla bilər.
- Kompensasiya "log yoxdursa geri alma" qaydası ilə təhlükəsiz olur.
- 9.0/Sual 4-dəki anomal hesablar `legacy` sətrindən görünür.

---

### B-2 · İdempotent XP verilməsi

**Həcm:** 4 saat

**Tələb:** XP verən **hər yer** (9.0/Sual 3-ün siyahısı) tək funksiyadan keçsin:

```ts
/**
 * XP verilməsi — idempotent. AUDIT H-5.
 *
 * UNIQUE(uid, source, ref_id) sayəsində eyni mənbə üçün XP BİR DƏFƏ verilir.
 * Təkrar cəhd sükutla no-op olur (INSERT OR IGNORE) — xəta atmır, çünki
 * təkrar çağırış qanuni retry ola bilər.
 *
 * ⚠️ ATOMIKLIK: xp_logs INSERT-i və users.xp UPDATE-i EYNİ batch-də olmalıdır.
 * Ayrı olsalar, biri uğurlu digəri uğursuz olduqda invariant pozulur.
 */
async function grantXp(c: Ctx, uid: string, source: XpSource,
                       refId: string | null, amount: number): Promise<boolean>
```

| Detal | Tələb |
|---|---|
| **Atomiklik** | `env.DB.batch([insertLog, updateUser])` — **eyni batch** |
| **Təkrar çağırış** | `INSERT OR IGNORE`; sətir yazılmayıbsa `users.xp` **artırılmır** |
| **`ref_id` null halı** | Bəzi XP mənbələrində ref yoxdur (məs. gündəlik giriş bonusu). UNIQUE indeksi `WHERE ref_id IS NOT NULL` ilə qismidir → bunlar gündəlik tavan (B-3) ilə idarə olunur |
| **`tasks_completed`** | `reviewSubmission` XP ilə birlikdə onu da artırır → **eyni idempotentlik** tətbiq olunmalıdır |

---

### B-3 · Gündəlik tavan

**Həcm:** 3 saat

**Niyə tək başına `UNIQUE` kifayət etmir:** Hücumçu postu **silib yenisini yaradır** → yeni `ref_id` → yeni XP. İdempotentlik dövrəni bağlamır; **gündəlik tavan bağlayır**.

```ts
/**
 * Gündəlik XP tavanı — AUDIT H-5 / PRD §8 "XP Anti Abuse".
 *
 * UNIQUE(uid,source,ref_id) TƏKRAR verilməni bağlayır, lakin sil-yenidən-yarat
 * dövrəsini bağlamır (hər dəfə yeni ref_id). Tavan onu bağlayır.
 */
```

**Tövsiyə olunan dəyərlər (auditin təklifi + genişləndirmə):**

| Mənbə | Gündəlik tavan | Əsas |
|---|---|---|
| `post` | 100 XP (≈10 post) | Auditin təklifi |
| `comment` | 100 XP (≈20 rəy) | Simmetrik |
| `solution` | tavan **yox** və ya yüksək | Admin təsdiqi tələb edir → sui-istifadə çətindir |
| **Ümumi gündəlik** | 300 XP | Son müdafiə xətti |

⚠️ **Dəyərləri kor-koranə qəbul etmə.** 9.0/Sual 4-dəki ortalama gündəlik qazancı ölç — tavan **aktiv qanuni istifadəçini kəsməməlidir**. Task 4 §4.2-də auditin `presence` limiti məhz bu səbəbdən səhv çıxmışdı.

| Detal | Tələb |
|---|---|
| **Gün sərhədi** | UTC yoxsa istifadəçinin saat qurşağı? *Tövsiyə: UTC — sadə və manipulyasiyaya davamlı* |
| **Tavana çatanda davranış** | Əməliyyat **uğurlu** olsun, yalnız XP verilməsin. Post yaratmaq XP tavanına görə rədd edilməməlidir |
| **İstifadəçi bildirişi** | "Bugünkü XP limitinə çatdınız" — 3 dildə |
| **Sorğu** | `SELECT SUM(amount) FROM xp_logs WHERE uid=? AND source=? AND created_at >= ?` — `ix_xp_logs_uid_created` indeksi bunun üçündür |

---

### B-4 · 🔴 Kompensasiya və CHECK trigger toqquşması

**Həcm:** 3 saat · **auditin qeyd etmədiyi tələ**

`deletePost` XP-ni geri almalıdır (audit #3). **Lakin Task 6 §D-2** `users_xp_nonneg` trigger-i əlavə edib:
```sql
BEFORE UPDATE OF xp ON users WHEN NEW.xp < 0 → RAISE(ABORT, 'xp mənfi ola bilməz')
```

**Toqquşma ssenarisi:**
1. İstifadəçinin XP-si 5.
2. `legacy` backfill-dən əvvəl yaradılmış post silinir → 10 XP geri alınmalıdır.
3. `5 - 10 = -5` → **trigger ABORT edir** → `deletePost` **DB xətası ilə çökür**.

İstifadəçi öz postunu silə bilmir. Bu, funksional çökmədir.

**Həll — üç qat:**

```ts
/**
 * XP kompensasiyası — AUDIT H-5 #3.
 *
 * ⚠️ Task 6 §D-2 `users_xp_nonneg` trigger-i XP-nin mənfi olmasını ABORT edir.
 * Kompensasiya onu tetiklərsə deletePost tamamilə çökər. Üç qat müdafiə:
 *   1. Yalnız UYĞUN xp_logs sətri varsa kompensasiya et (legacy XP toxunulmaz)
 *   2. Məbləği mövcud XP ilə clamp et: min(amount, currentXp)
 *   3. Kompensasiya sətri xp_logs-a MƏNFİ amount ilə yazılsın (audit izi)
 */
```

| Qat | Qayda |
|---|---|
| **1** | `xp_logs`-da `(uid, 'post', postId)` sətri **yoxdursa** → kompensasiya **etmə**. `legacy` XP-yə toxunulmur |
| **2** | `amount = min(logAmount, currentXp)` — heç vaxt mənfiyə düşmə |
| **3** | Kompensasiya `xp_logs`-a `source='compensation'`, `amount = -N` ilə yazılsın → invariant qorunur |

⚠️ **Gündəlik tavan qarşılıqlı təsiri:** Kompensasiya gündəlik cəmi **azaltmalıdırmı**? Azaltsa, hücumçu yarat-sil dövrəsi ilə tavanı bərpa edər → **azaltmamalıdır**. Tavan hesablaması yalnız **müsbət** sətirləri saymalıdır:
```sql
SELECT SUM(amount) FROM xp_logs WHERE uid=? AND amount > 0 AND created_at >= ?
```

⚠️ **`deleteAccount`** — hesab silinəndə `xp_logs` sətirləri nə olur? FK yoxdursa orphan qalar. Task 8 §9/2-dəki partiya limiti də burada tətbiq olunur.

---

### B-5 · `submitSolution` təkrar-təsdiq bağlanması

**Həcm:** 2 saat

**Yer:** `routes.ts:1387` (`submitSolution`), `routes.ts:1411` (`reviewSubmission`)

**Nədir:** `ON CONFLICT … status='pending'` təsdiqlənmiş həlli yenidən `pending`-ə salır → admin təkrar təsdiqləyəndə XP və `tasks_completed` **təkrar verilir**.

**Tələb:**
```sql
-- Təsdiqlənmiş həll yenidən pending-ə DÜŞMÜR (AUDIT H-5 / istismar 2).
ON CONFLICT(...) DO UPDATE SET
  content = excluded.content,
  status  = CASE WHEN submissions.status = 'approved'
                 THEN 'approved' ELSE 'pending' END
```

⚠️ **UX nəticəsi:** İstifadəçi təsdiqlənmiş həllini yeniləyə bilməyəcək (status dəyişməyəcək). Bu, **düzgün davranışdır**, lakin UI-da izah olunmalıdır: "Təsdiqlənmiş həll yenidən nəzərdən keçirilmir."

⚠️ **B-2 ilə əlaqə:** `grantXp(uid, 'solution', submissionId, 50)` idempotentliyi **ikinci müdafiə xəttidir** — status məntiqi sınsa belə XP təkrar verilməz.

---

# FAZA C — WebSocket və Durable Object (H-6, M-4)

**Həcm:** 1,5 gün

---

### C-1 · Periodik yenidən-avtorizasiya

**Audit ID:** H-6 · **Həcm:** 4 saat

**Tələb:** `RoomDO.handleSend` (və oxu yolu) periodik olaraq üzvlüyü yenidən yoxlasın.

```ts
/**
 * WS periodik re-auth — AUDIT H-6.
 *
 * Əvvəl: üzvlük YALNIZ upgrade anında yoxlanılırdı. Hibernation API ilə soket
 * saatlarla yaşayır → komandadan çıxarılan / bloklanan / sessiyası ləğv edilən
 * istifadəçi məxfi otağı oxumağa və yazmağa DAVAM EDİRDİ.
 *
 * ⚠️ Bu, TƏK müdafiə deyil: disconnect(uid) RPC (C-2) dərhal təsir edir,
 * periodik yoxlama isə RPC itsə fallback-dır (defense in depth).
 *
 * Keş naxışı AUDIT-TASK-7 §7.3-dən götürülüb — yenisini icad etmə.
 */
const REAUTH_INTERVAL_MS = 60_000;
```

| Detal | Tələb |
|---|---|
| **Yoxlanılanlar** | (a) komanda/otaq üzvlüyü, (b) `users.blocked`, (c) sessiya etibarlılığı |
| **Keş yeri** | DO yaddaşında per-soket. ⚠️ **Hibernation-da itir** → `serializeAttachment` ilə sokete bağla (M-4 ilə eyni mexanizm) |
| **Uğursuzluqda** | Soketi **bağla** (`ws.close(4403, 'unauthorized')`) — sadəcə mesajı at, soket qalsın **deyil** |
| **Fail-closed** | D1 sorğusu xəta versə → mövcud keş dəyəri qalsın (qısa müddət), TTL bitibsə **bağla** |
| **Performans** | Hər mesajda D1 sorğusu **etmə** — 60 s TTL ilə keşlə. Aktiv otaqda 20 mesaj/dəq × 50 istifadəçi = 1000 sorğu/dəq olardı |
| **Oxu yolu** | Yalnız `handleSend` deyil — **oxu** (broadcast alma) da bağlanmalıdır. Çıxarılan üzv yaza bilməsə də oxumağa davam edərsə sızma qalır |

---

### C-2 · `disconnect(uid)` RPC

**Audit ID:** H-6 · **Həcm:** 3 saat

Periodik yoxlama **60 saniyəyə qədər** gecikmə buraxır. Dərhal təsir üçün RPC lazımdır.

**Çağırılacaq yerlər — hamısı:**

| Yer | Səbəb |
|---|---|
| `removeMember` | Task 3-də düzəldildi, WS-ə təsir etmirdi |
| `leaveTeam` | İstifadəçi özü çıxır |
| `revokeAllSessions` | Parol dəyişikliyi / təhlükəsizlik hadisəsi |
| `blockUser` (admin) | Task 6 M-10 ilə əlaqəli |
| `deleteAccount` | Hesab silinir |
| `deleteTeam` | ⚠️ Task 7 §8/3: soft-delete-dir, `team_members` qalır |
| `updateMemberRole` | ⚠️ Yalnız rol otaq çıxışını dəyişirsə |

⚠️ **Tam siyahı üçün öz sayğacınla axtar** — audit yalnız ikisini sadalayır:
```bash
grep -rn "team_members\|DELETE FROM sessions\|blocked = 1" worker/ | grep -v test
```

| Detal | Tələb |
|---|---|
| **Hansı DO-lar?** | İstifadəçi bir neçə otaqda ola bilər → **hər aidiyyəti `RoomDO`**-ya göndərilməlidir. Otaq siyahısı haradan gəlir? |
| **Xəta idarəsi** | RPC uğursuz olarsa əsas əməliyyat (`removeMember`) **geri qaytarılmamalıdır**. Logla, periodik yoxlama (C-1) fallback-dır |
| **`waitUntil`** | RPC cavabı gözlənilməsin — əməliyyat gecikməsin |
| **Bağlanma kodu** | `ws.close(4403, …)` — client bunu tanısın və **yenidən qoşulmağa cəhd etməsin** (sonsuz dövrə riski) |

⚠️ **Client tərəfi:** `js/chat.js` avtomatik yenidən qoşulma məntiqi varsa, `4403` kodunda **dayanmalıdır**. Task 4 §7/1-dəki dərs (polling 429-da dayanmalıdır) eyni sinifdir.

---

### C-3 · `RoomDO` state persistensiyası (M-4)

**Həcm:** 3 saat

**Nədir:** Token-bucket state-i **yaddaşda** saxlanılır. Hibernation-da DO yaddaşı təmizlənir → limit sıfırlanır → sui-istifadə.

**Tələb — 9.0/Sual 2-nin nəticəsinə görə:**

| State növü | Mexanizm | Səbəb |
|---|---|---|
| **Per-soket** (uid, re-auth keşi, token-bucket) | `ws.serializeAttachment()` | Hibernation-da **qorunur**, storage yazısı tələb etmir |
| **Per-otaq** (ümumi sayğaclar) | `ctx.storage` | Soketdən müstəqildir |

⚠️ **`serializeAttachment` limiti:** ~2 KB. Kiçik state üçün idealdır.

⚠️ **Storage yazı xərci:** Hər mesajda `ctx.storage.put` **etmə**. Token-bucket üçün: state-i yaddaşda saxla, **periodik** (məs. hər 10 saniyə və ya N əməliyyatda bir) persist et. Hibernation-dan əvvəl `webSocketClose`/`alarm` ilə flush et.

⚠️ **Ən sadə düzgün həll:** token-bucket-i `serializeAttachment`-ə köçür. Per-soket olduğu üçün bu, təbii yerdir və storage xərci yoxdur.

---

# FAZA D — Miras bəndlər

**Həcm:** 0,5–1 gün

---

### D-1 · 🔴 Partiya dəyişən limiti auditi

**Mənbə:** Task 8 §7.b, §9/2 · **Həcm:** 4 saat

**Kontekst:** Task 8-də aşkarlandı ki, `archive.ts` `DELETE … IN (?×2000)` qururdu və D1 dəyişən limitini aşırdı. Kod yolu `ARCHIVE_HOT_DAYS = 3650` səbəbindən işə düşmədiyi üçün **2 task boyu gizli qaldı**. Test datası cəmi 5 mesaj idi — limitin xeyli altında.

**Tələb — eyni sinif qüsuru hər yerdə axtar:**

```bash
grep -rn "IN (\|map(() => '?')\|join(',')\|placeholders" worker/ | grep -v test
grep -rn "\.slice(0, *[0-9]\+)" worker/
grep -rn "batch(\[" worker/
```

Task 8 §9/2 üç yeri konkret sadalayır:
- `deleteAccount` → `keys.slice(0, 100)`
- `deletePost` → `slice(0, 30)`
- `taxonomy-reorder` batch

**Hər tapılan yer üçün cədvəl:**

| Yer | Partiya ölçüsü | Dəyişən sayı/element | Nəzəri maksimum | Limit aşılır? | Test datası limit üstündədirmi? |
|---|---|---|---|---|---|

**Düzəliş naxışı** (Task 8-dəki ilə eyni):
```ts
// Silmə CHUNK-lara bölünür, hamısı EYNİ batch()-də qalır → atomiklik qorunur.
const CHUNK = 50;
```

🔴 **Hər düzəldilmiş yol üçün limit ÜSTÜ test datası ilə test yaz.** Bu, §9/2-nin əsas dərsidir.

---

### D-2 · Silinmiş hesabın isti-pəncərə mesajları (QƏRAR QAPISI)

**Mənbə:** Task 8 §9/1 · **Həcm:** 2 saat (qərara görə)

**Problem:** `deleteAccount` `room_messages`/`dm_messages` sətirlərinə toxunmur. Task 8-in tombstone filtri yalnız **arxiv** oxu yoluna tətbiq olunub. Nəticə:

> Silinmiş hesabın **son 90 günlük** mesajları görünür, **90 gündən köhnələri** görünmür — ziddiyyətli davranış.

**Variantlar:**

| Variant | Necə | Təsir |
|---|---|---|
| **(a)** Filtri D1 oxusuna da tətbiq et | Bir SQL şərti (`LEFT JOIN deleted_uids`) | Ardıcıl davranış; ⚠️ hər mesaj sorğusuna JOIN |
| **(b)** Silmədə mesajları anonimləşdir | `uid → 'deleted_user'`, məzmun qalır | Söhbət konteksti qorunur |
| **(c)** Mövcud davranışı Privacy-də izah et | Mətn dəyişikliyi | Ən ucuz, lakin ziddiyyət qalır |

**Tövsiyə: (b).** Səbəb: (a) hər sorğuya JOIN əlavə edir; (c) ziddiyyəti qanuniləşdirir. (b) həm GDPR-i, həm söhbət bütövlüyünü qoruyur.

⚠️ **İstifadəçidən qərar istə** — bu, siyasət qərarıdır, texniki deyil.

⚠️ Seçilən variant **Privacy mətni ilə uyğun** olmalıdır (Task 8 §8.7-də arxiv üçün yazıldı).

---

### D-3 · E2E testləri

**Həcm:** 4 saat

```ts
test.describe('AUDIT H-3 — atomik rate limiter @ratelimit', () => {
  test.describe.configure({ mode: 'serial' });

  // 🔴 Limit ÜSTÜ test — Task 8 §9/2 dərsi
  test('200 paralel sorğu limiti keçmir', async () => {
    // limit=10 → uğurlu sorğu sayı ≤ 10
    // KV limiter-də bu test SINIRDI — H-3-ün sübutu
  });

  test('xərc səbətləri KV-də qalır (miqrasiya edilməyib)', async () => {
    // Taksonomiya qərarının sübutu
  });

  test('hesab kilidi / CAPTCHA işə düşür', async () => { /* A-3 qərarına görə */ });

  test('kilid mesajı hesab sadalanmasına imkan vermir', async () => {
    // Mövcud olmayan istifadəçi ilə eyni cavab
  });
});

test.describe('AUDIT H-5 — XP anti-abuse @xp', () => {
  // 🔴 Əsas istismar
  test('post yarat-sil dövrəsi XP verməz', async () => {
    // 15 dəfə yarat+sil → XP artımı ≈ 0 (tavan + kompensasiya)
  });

  test('eyni post üçün XP iki dəfə verilmir', async () => { /* UNIQUE */ });

  test('gündəlik tavan işləyir', async () => {
    // 11 post → 10-u XP verir, 11-ci vermir
    // ⚠️ Post yaratma ÖZLÜYÜNDƏ uğurlu olmalıdır
  });

  test('təsdiqlənmiş həll təkrar təsdiqlə XP vermir', async () => { /* B-5 */ });

  // 🔴 Trigger toqquşması
  test('legacy XP-li köhnə post silinə bilir', async () => {
    // xp_logs sətri OLMAYAN post silinir → DB xətası YOXDUR, XP dəyişmir
  });

  test('kompensasiya XP-ni mənfiyə salmır', async () => {
    // xp=5, kompensasiya=10 → xp=0, ABORT yox
  });

  test('kompensasiya gündəlik tavanı bərpa etmir', async () => {
    // Tavana çat → sil → yenidən yarat → XP verilmir
  });

  test('SUM(xp_logs) == users.xp invariantı', async () => { /* B-1 */ });
});

test.describe('AUDIT H-6 — WS re-auth @ws', () => {
  // 🔴 Əsas ssenari
  test('komandadan çıxarılan üzv soketdən DÜŞÜR', async () => {
    // WS aç → removeMember → soket bağlanır (4403), yazı və OXU dayanır
  });

  test('sessiyası ləğv edilən üzv soketdən düşür', async () => { /* revokeAllSessions */ });

  test('bloklanan istifadəçi soketdən düşür', async () => { /* blockUser */ });

  test('4403 kodunda client yenidən qoşulmağa cəhd etmir', async ({ page }) => {
    // Sonsuz dövrə riski
  });

  // 🔴 REQRESSİYA
  test('qanuni üzv soketdə qalır (60 s+)', async () => {
    // Re-auth qanuni istifadəçini atmamalıdır
  });
});

test.describe('AUDIT M-4 — RoomDO state @do', () => {
  test('hibernation token-bucket-i sıfırlamır', async () => {
    // Limitə çat → hibernation → yenidən qoşul → limit HƏLƏ qüvvədədir
  });
});

test.describe('AUDIT-9 D-1 — partiya limiti @batch', () => {
  // 🔴 Hər düzəldilmiş yol üçün LİMİT ÜSTÜ data
  test('100+ obyektli hesab silinir', async () => { /* deleteAccount */ });
  test('30+ şəkilli post silinir', async () => { /* deletePost */ });
});
```

---

## 4. ƏHATƏDƏN KƏNAR

| Tapıntı | Aid | Səbəb |
|---|---|---|
| Xərc səbətlərinin atomik mexanizmə köçürülməsi | ⛔ **Qəsdən yox** | Task 4 §4.1 taksonomiyası — bahalı və lazımsız |
| `photo_url` ikiqat prefiks, OG avatar yolu | **Task 10** | — |
| `deleteTeam` soft-delete siyasəti | **Task 10** | C-2-də yalnız RPC çağırılır |
| `js/` tip yoxlaması | **Task 10** | C-2 client-ə toxunur |
| M-1 log→bloklama + `file_access_denied` siqnalı | **Ayrıca** | A-3-lə əlaqəlidir, lakin ayrı meyar tələb edir |
| `purgeDeletedFromArchives` sürəti (Task 8 §9/4) | **Task 10** | Ölçmə lazımdır |
| `contact_messages`-ə `uid` (Task 8 §9/5) | **Task 10** | Sxem |
| `ANALYZE` cron mexanizmi (Task 6 §8/3) | **Task 10** | — |
| CI/CD, `routes.ts` bölünməsi, polling→WS | **Task 10** | — |
| 11 sxem bəndi | **Task 10** | — |
| E2E baseline bərpası | **9.0/Sual 0** | Qərar qapısı |

---

## 5. İCRA QAYDALARI

### 5.1 Faza-faza commit

**Sıra:** 9.0 → **D-1** → **A** → **B** → **C** → **D-2** → D-3

⚠️ **D-1 (partiya limiti) birinci gəlir.** Səbəb: Task 8 §7.b göstərdi ki, bu sinif qüsur **sükutla** yaşayır və digər fazaların testlərini yalançı yaşıl edə bilər. Əvvəlcə təməli təmizlə.

### 5.2 🔴 Dörd tələ

| Tələ | Nəticə | Qoruma |
|---|---|---|
| **Limit altı test datası** | Qüsur task-lar boyu gizli qalır | Hər limit yolu üçün **limit üstü** data (Task 8 §9/2) |
| **Kompensasiya `xp>=0` trigger-inə dəyir** | `deletePost` DB xətası ilə çökür | B-4 üç qatlı müdafiə |
| **Hesab kilidi DoS vektoru yaradır** | Rəqib qurbanın hesabını bloklayır | A-3 — CAPTCHA alternativi |
| **Client `4403`-də sonsuz yenidən qoşulur** | DO-ya yük, batareya sərfi | C-2 client tərəfi |

### 5.3 Müvəqqəti bayraqlar öhdəliklə yazılır

A-2-də `RL_MECHANISM` geri qaytarma bayrağı təklif olunur. Task 1-in `ARCHIVE_HOT_DAYS` dərsi: **müvəqqəti bayraq geri qaytarma şərti ilə sənədləşdirilməlidir**, əks halda illərlə qalır.

```jsonc
// MÜVƏQQƏTİ (AUDIT-TASK-9 / H-3): miqrasiya dövründə köhnə KV yoluna
// qayıtma imkanı. Atomik mexanizm istehsalda 2 həftə stabil işlədikdən sonra
// bu bayraq və köhnə kod yolu SİLİNMƏLİDİR.
```

### 5.4 İnvariant yoxlaması

Faza B `SUM(xp_logs.amount) == users.xp` invariantını qurur. **Bu, yoxlanıla bilən sağlamlıq göstəricisidir** — Task 6 A-3-dəki `/api/health` endpoint-inə əlavə et:
```
xp_invariant: 'ok' | 'drift'
```

---

## 6. QƏBUL MEYARLARI

### Faza A — rate limiter
| # | Meyar | Gözlənilən |
|---|---|---|
| **1** | 🔴 200 paralel sorğu limiti keçmir | uğurlu ≤ limit |
| 2 | Təhlükəsizlik səbətləri atomikdir | mexanizm loglanır |
| 3 | Xərc səbətləri KV-də qalır | qəsdən |
| 4 | Fail-closed (təhlükəsizlik) | mexanizm sınsa → rədd |
| 5 | Fail-open (xərc) | KV sınsa → keçir |
| 6 | `Retry-After` + `code` qorunub | Task 4 reqressiyası |
| 7 | Hesab kilidi / CAPTCHA işləyir | A-3 qərarına görə |
| 8 | Kilid hesab sadalamasına imkan vermir | eyni cavab |
| 9 | Gecikmə artımı ölçülüb | hesabatda |

### Faza B — XP
| # | Meyar | Gözlənilən |
|---|---|---|
| **10** | 🔴 Yarat-sil dövrəsi XP verməz | ≈ 0 |
| 11 | Eyni ref üçün XP bir dəfə | UNIQUE |
| 12 | Gündəlik tavan işləyir | 11-ci post XP verməz |
| 13 | Tavan əməliyyatı **bloklamır** | post yaranır |
| **14** | 🔴 Legacy XP-li post silinə bilir | DB xətası yox |
| **15** | 🔴 Kompensasiya XP-ni mənfiyə salmır | `xp >= 0` |
| 16 | Kompensasiya tavanı bərpa etmir | dövrə bağlıdır |
| 17 | Təkrar təsdiq XP verməz | B-5 |
| 18 | `SUM(xp_logs) == users.xp` | invariant |
| 19 | Tavan aktiv qanuni istifadəçini kəsmir | ölçülüb |

### Faza C — WS/DO
| # | Meyar | Gözlənilən |
|---|---|---|
| **20** | 🔴 Çıxarılan üzv soketdən düşür | 4403 |
| 21 | Yazı **və oxu** dayanır | hər ikisi |
| 22 | `revokeAllSessions` soketi bağlayır | ✅ |
| 23 | `blockUser` soketi bağlayır | ✅ |
| **24** | 🔴 Qanuni üzv soketdə qalır | 60 s+ |
| 25 | Client 4403-də yenidən qoşulmur | sonsuz dövrə yox |
| 26 | Hibernation token-bucket-i sıfırlamır | M-4 |
| 27 | Re-auth D1 sorğusunu keşləyir | hər mesajda deyil |

### Faza D
| # | Meyar | Gözlənilən |
|---|---|---|
| **28** | 🔴 Partiya yolları auditi tamamlanıb | cədvəl |
| 29 | Hər düzəldilmiş yol **limit üstü** test daşıyır | ✅ |
| 30 | Silinmiş hesab siyasəti tətbiq olunub | D-2 qərarına görə |

### Ümumi
| # | Meyar | Gözlənilən |
|---|---|---|
| 31 | `npx tsc --noEmit` | exit 0 |
| 32 | `npm run build` | exit 0 |
| 33 | `npm run check:migrations` | yaşıl |
| **34** | 🔴 Tam E2E dəsti | 9.0/Sual 0 baseline-dan pis deyil |
| 35 | `/api/health` XP invariantını göstərir | 5.4 |

**Meyar 14, 15, 24 və ya 34 ❌ olarsa:** `git revert` — bunlar funksional çökmə göstəriciləridir.

---

## 7. HESABAT FORMATI

`docs/AUDIT-TASK-9-REPORT.md`:

```markdown
# AUDIT-TASK-9 — İcra Hesabatı

**Tarix:** …   **İcraçı:** …   **Commit-lər:** <faza üzrə>
**E2E baseline (9.0/Sual 0):** <yaşıl / N sınıq — qərar>

## 0. Vəziyyət xəritəsi
### Native binding semantikası (Sual 1) — <qlobal / PoP başına> + mənbə
### Mövcud DO naxışı (Sual 2)
### XP verilən yerlər (Sual 3) — audit: 4, faktiki: N
### XP profili (Sual 4)
| Göstərici | Dəyər |
| İstifadəçi | … |
| Ümumi XP | … |
| Maksimum | … |
| Ortalama | … |
### Anomal hesablar: <siyahı / yoxdur>
### CHECK trigger (Sual 5): <var / yox> → B-4 dizaynına təsiri

## 1. Faza A — rate limiter
### A-1 Mexanizm qərarı
| Sinif | Səçilən | Əsaslandırma |
### A-2 Gecikmə ölçməsi
| Səbət | Əvvəl p50/p95 | Sonra p50/p95 |
### A-3 Hesab qoruması: <kilid / CAPTCHA> — əsaslandırma

## 2. Faza B — XP
### B-1 Backfill: <N istifadəçi, M XP 'legacy' kimi qeyd edildi>
### B-3 Tavan dəyərləri — ölçməyə əsaslanan
| Mənbə | Tavan | Qanuni istifadəçi ortalaması |
### B-4 🔴 Trigger toqquşması — necə həll edildi
### İnvariant: SUM(xp_logs) == users.xp → ✅

## 3. Faza C — WS/DO
### C-2 disconnect(uid) çağırılan yerlər
| Yer | Auditdə var idi? |
### C-3 State mexanizmi: <serializeAttachment / ctx.storage>

## 4. Faza D
### D-1 🔴 Partiya yolları auditi
| Yer | Partiya | Dəyişən/element | Maksimum | Aşılırdı? | Düzəldildi | Limit üstü test |
### D-2 Silinmiş hesab siyasəti: <a/b/c> — istifadəçi qərarı

## 5. Qəbul meyarları (35 sətir)

## 6. Aşkarlanan yeni risklər

## 7. Açıq qalan öhdəliklər
- [ ] 🔴 `RL_MECHANISM` bayrağının silinməsi (2 həftə stabil işlədikdən sonra)
- [ ] 🔴 E2E baseline / 80 sınıq test
- [ ] 🔴 Hüquqi mətnin peşəkar baxışı
- [ ] 🔴 İstehsalda ilk arxiv cron-unun yoxlanması (Task 8 §10)
- [ ] 🟠 M-1 log→bloklama + `file_access_denied` siqnalı
- [ ] 🟠 Cloudflare Cache Rules, R2 Logpush
- [ ] 🟠 `photo_url`, OG avatar (Task 7 §8)
- [ ] 🟡 Task 10-a ötürülənlər: 11 sxem bəndi, `ANALYZE` cron,
      `purgeDeletedFromArchives` sürəti, `contact_messages.uid`,
      `deleteTeam` siyasəti, `js/` tip yoxlaması
- [ ] `collabix.az` DNS + MX, VÖEN, sosial profillər, Git remote

## 8. Geri qaytarma planı
| Faza | Revert | Data təsiri |
| A | `RL_MECHANISM=kv` | ⚠️ H-3 yenidən açılır |
| B | `git revert` | ⚠️ Miqrasiya qalır; xp_logs sətirləri zərərsiz |
| C | `git revert` | ⚠️ H-6 yenidən açılır |
| D-1 | ⛔ **Revert ETMƏ** | Partiya qüsuru sükutla çökər |
```

---

## 8. BİRİNCİ ADDIM

### 🔴 Addım 0 — bağlayıcı qapı
```bash
npx playwright test 2>&1 | tail -20
```
80 sınıq test qalırsa **dayan**. Bu task WS və XP yollarını dəyişir — hər ikisi yalnız E2E ilə doğrulana bilər.

### Addım 1 — yalnız oxu, sonra təqdim et
1. `worker/auth.ts:300-340` → mövcud limiter
2. `worker/room-do.ts` **tam** → token-bucket naxışı, state yeri, hibernation idarəsi
3. `grep -rn "xp\s*[+=]\|UPDATE users SET xp" worker/` → XP verilən **bütün** yerlər
4. 9.0/Sual 4 SQL sorğuları → XP profili + anomaliyalar
5. `grep -rn "users_xp_nonneg" migrations/` → trigger mövcuddurmu
6. `grep -rn "IN (\|slice(0, *[0-9]" worker/` → D-1 üçün namizədlər

### Addım 2 — üç sualı sənədlə cavabla
1. **Cloudflare native rate limiting binding qlobalmı, yoxsa PoP başınamı sayır?** *(Sənəd linki ilə. Bu, A-1 qərarını müəyyən edir — PoP başınadırsa H-3/#2 bağlanmır.)*
2. **`users_xp_nonneg` trigger-i mövcuddurmu?** *(Mövcuddursa B-4 üç qatlı müdafiə məcburidir.)*
3. **D-1 namizədlərindən neçəsi D1 dəyişən limitini aşır?** *(Task 8 §7.b-nin təkrarı.)*

### Addım 3 — istifadəçidən iki qərar istə
| Qərar | Variantlar |
|---|---|
| **A-3** — hesab qoruması | Kilid (DoS riski) / Turnstile CAPTCHA (tövsiyə) |
| **D-2** — silinmiş hesabın isti mesajları | (a) D1 filtri · (b) anonimləşdirmə (tövsiyə) · (c) yalnız Privacy izahı |

### Dayanma şərtləri

| Şərt | Əməliyyat |
|---|---|
| E2E baseline sınıqdır | Dayan, qərar istə |
| Native binding PoP başınadır **və** DO gecikməsi login üçün > 500 ms | Dayan, hibrid variant üçün təsdiq istə |
| 9.0/Sual 4-də **anomal XP** hesabları tapılarsa | Dayan, bildir — istismar izi ola bilər |
| D-1-də **aşan** partiya yolu tapılarsa | Digər fazalardan **əvvəl** düzəlt |

Cavablar hazır olduqdan sonra §5.1-dəki sıra ilə icraya başla — **D-1 birinci**.
