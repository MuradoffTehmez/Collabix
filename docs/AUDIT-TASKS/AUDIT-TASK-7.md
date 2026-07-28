# AUDIT-TASK-7 — `/files/*` Avtorizasiyası (IDOR Zəncirinin Qırılması)

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md` §C-1 (sətir 285–335) — **auditin 1 nömrəli tapıntısı**
**Əlavə mənbələr:** Task 1–6 hesabatları
**Bağlanan tapıntılar:** **C-1** (Critical — məxfi fayl eksfiltrasiyası)
**Təxmini həcm:** 2–2,5 gün
**Ön şərt:** AUDIT-TASK-6 tamamlanmış olmalıdır
**Risk sinfi:** 🔴🔴 **Bu, zəncirin ən kritik task-ıdır.** Düzəliş **hər fayl sorğusunun** yoluna girir — səhv olsa bütün şəkillər sınır və ya sızma açıq qalır.

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-7  serveFile()-a canReadKey() avtorizasiyası qur — default DENY, 404 qaytar.
               R2 açar məkanının TAM inventarını çıxar, hər prefiks üçün siyasət təyin et.
               createPost-da imageKeys/blocks[].urls sahibliyini məcburi yoxla.
               msg.ts fileKey sahibliyini yoxla. Frontend isSafeImageURL-i sərtləşdir.
               ⚠️ CDN keşi avtorizasiyanı keçir — Cache-Control: private MƏCBURİDİR.
               ⚠️ Performans: publik prefikslər DB sorğusuz keçsin, üzvlük KV-də keşlənsin.
               Mövcud postlarda sızma izi varmı — yoxla.
               DONE: yad komanda faylı 404; feed şəkilləri işləyir; p95 artımı < 30 ms.
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli təhlükəsizlik mühəndisisən**.

Bu, auditin **1 nömrəli tapıntısıdır** və zəncirin ən kritik task-ıdır. Əvvəlki task-lardan üç cəhətdən fərqlənir:

| Cəhət | Task 1–6 | Task 7 |
|---|---|---|
| **Yol** | Ayrı-ayrı endpoint-lər | **Hər fayl sorğusu** — feed səhifəsi 20+ dəfə çağırır |
| **Sındırma əlaməti** | Xəta cavabı | **Sınıq şəkil** — istifadəçi səbəbini görmür |
| **Sızma əlaməti** | Yoxdur | **Yoxdur** — icazəsiz oxu jurnalda görünmür |

Ona görə burada iki qəbul meyarı bərabər dərəcədə vacibdir:
1. 🔴 Yad komanda faylı **404** qaytarır.
2. 🔴 Normal istifadəçinin feed-i, avatarları, öz DM əlavələri **işləyir**.

Birinci olmadan task mənasızdır. İkinci olmadan məhsul çökür.

---

## 2. KONTEKST

### 2.a Tapıntı — C-1

**Yer:** `worker/routes.ts:2831-2845` (`serveFile`) + `worker/index.ts:362-371` + `worker/routes.ts:786-789` (`createPost`)

```ts
// index.ts:368 — TƏK yoxlama
if (!c.user) return err('Giriş tələb olunur.', 401);
const res = await R.serveFile(c, decodeURIComponent(path.slice('/files/'.length)));

// routes.ts:2832 — avtorizasiya YOXDUR
export async function serveFile(c: Ctx, key: string) {
  const obj = await c.env.FILES.get(key);   // ← istənilən açar
```

`serveFile()` yalnız *"giriş edilibmi?"* soruşur. **Obyektin sahibliyi, komanda üzvlüyü, söhbət iştirakçılığı — heç biri yoxlanılmır.**

### 2.b R2-də saxlanan məxfi məzmun

| Prefiks | Məzmun | Həssaslıq |
|---|---|---|
| `teams/{teamId}/{category}/…` | Komanda sənəd arxivi | 🔴 Məxfi |
| `msgfiles/{uid}/…` | DM və otaq əlavələri | 🔴 Məxfi |
| `archive/{room\|dm}/{scope}/…` | **Bütöv gzip-lənmiş mesaj tarixçəsi dump-ları** | 🔴🔴 Kütləvi |
| `avatars/…` | Profil şəkilləri | 🟢 Publik |
| `posts/…` | Post şəkilləri | 🟢 Publik |

⚠️ `archive/` ən ağırıdır: **bir açar bütöv otağın mesaj tarixçəsini** verir.

### 2.c İstismar zənciri (auditdə tam doğrulanmış)

1. `createPost` (`routes.ts:788`) `blocks`-u **verbatim** saxlayır — `blocks[].urls` içindəki dəyərlər heç yoxlanılmır. `imageKeys` də `toJSON(b.imageKeys, '[]')` ilə **xam** qəbul olunur.
2. Hücumçu göndərir:
   ```json
   POST /api/posts
   { "blocks": [{ "type": "image",
                  "urls": ["/files/teams/<qurbanTeamId>/documents/<açar>"] }] }
   ```
3. Frontend `isSafeImageURL()` (`js/util.js:49`) **yalnız `/files/` prefiksini** tələb edir → şəkil render olunur.
4. **Qlobal feed-i açan hər kəsin brauzeri məxfi komanda sənədini yükləyir.**

**Əlavə vektor:** `sanitizeMsg` (`worker/msg.ts:44`) `fileKey`-i yalnız `msgfiles/` **prefiksinə** görə yoxlayır — açarın **göndərənə aid olduğunu yoxlamır**. Şərh qorumanın olduğunu iddia edir, yoxlama isə natamamdır.

**Təsir:** Məxfi komanda sənədlərinin, DM əlavələrinin və arxiv dump-larının icazəsiz oxunması. **Komandadan çıxarılmış üzv gördüyü hər fayla əbədi çıxış saxlayır.** Qəsdən publik sızma mümkündür.

### 2.d Auditin təklif etdiyi düzəliş

```ts
async function canReadKey(c: Ctx, key: string): Promise<boolean> {
  const uid = c.user!.id;
  if (key.startsWith('avatars/') || key.startsWith('posts/')) return true;
  if (key.startsWith('archive/')) return c.isAdmin;
  const msg = key.match(/^msgfiles\/([\w-]+)\//);
  if (msg) return msg[1] === uid || await sharesThreadWith(c, key);
  const team = key.match(/^teams\/([\w-]+)\//);
  if (team) return !(await requireTeamMember(c, team[1]));
  return c.isAdmin;   // default DENY
}
```

Bu, **düzgün istiqamətdir**, lakin üç kritik boşluğu var. Hər üçü bu task-da həll olunur:

| Boşluq | Bənd | Nəticəsi |
|---|---|---|
| 🔴 **CDN keşləməsi avtorizasiyanı keçir** | 7.4 | Yoxlama bir dəfə işləyir, sonra edge hər kəsə verir |
| 🔴 **Performans** — hər fayl sorğusuna D1 sorğusu | 7.3 | Feed səhifəsi 20 şəkil = 20 D1 sorğusu |
| 🔴 **Mövcud sızmanın qiymətləndirilməsi** | 7.8 | Düzəliş gələcəyi qoruyur, keçmişi yox |

### 2.e Əvvəlki task-lardan gələn dərslər

| Mənbə | Dərs | Tətbiqi |
|---|---|---|
| Task 2 §5.2 | Audit 6× az saymışdı | R2 prefiks siyahısı **natamam ola bilər** → 7.0 |
| Task 3 §5.2 | Giriş yolu ≠ qiymətləndirmə yolu | Yükləmə validasiyası ≠ oxu avtorizasiyası |
| Task 5 §5.1 | Silmədən əvvəl sübut | Sızma qiymətləndirməsi → 7.8 |
| Task 6 §8/1 | **`js/` tip yoxlamasından keçmir** | 7.6 frontend-ə toxunur → yalnız E2E doğrulaya bilər |
| Task 6 §8/2 | "Sadə düzəliş" 2 reqressiya yaratdı | Hər bənddən sonra E2E |
| Task 6 §8/3 | `ANALYZE` statistikası köhnəlir | Yeni üzvlük sorğuları indeks tələb edə bilər |
| Task 4 §7/4 | *"Rate limit avtorizasiyanın əvəzi deyil"* | `asset` səbəti xərci qorudu, **bu task** avtorizasiyanı qurur |

---

## 3. ƏHATƏ — 11 BƏND

---

### 7.0 · R2 açar məkanının tam inventarı (ÖN İŞ)

**Həcm:** 2 saat · **kod dəyişikliyi yoxdur**

Auditin 5 prefiksi **başlanğıc nöqtəsidir**. `canReadKey`-in `default DENY` qaydası o deməkdir ki, **sadalanmayan hər prefiks bloklanacaq** — inventar natamam olarsa, işlək funksionallıq sınacaq.

#### Sual 1 — Kodda hansı prefikslərə YAZILIR?
```bash
grep -rn "FILES.put\|\.put(" worker/ | grep -v "KV\|kv\." 
grep -rno "'[a-z]*/'" worker/ | grep -iE "avatar|post|team|msg|archive|file|upload|media|attach"
```
Hər yazı yerini siyahıla: fayl:sətir → açar şablonu → kim yazır.

#### Sual 2 — R2-də faktiki hansı prefikslər var?
```bash
npx wrangler r2 object list <bucket-adı> --prefix "" | head -200
```
Nəticəni prefiks üzrə qrupla və say. ⚠️ Kodda **artıq yazılmayan**, lakin R2-də **qalan** köhnə prefikslər ola bilər (Firebase miqrasiyasından).

#### Sual 3 — `/files/*`-ə hansı kod yollarından girilir?
```bash
grep -rn "/files/" worker/ js/ | grep -v "\.md"
```
Xüsusilə axtar:
- `worker/og.ts` — OG/social preview şəkilləri **autentifikasiyasız** xidmət olunurmu?
- SSR / HTMLRewriter yolları
- Service worker / manifest
- `sitemap`/`seo` yolları

⚠️ **OG şəkil yolu kritikdir:** sosial preview botları (Facebook, Twitter, Slack) **giriş etmir**. Əgər OG şəkli `/files/`-dən gəlirsə, ya ayrıca publik yol lazımdır, ya da OG yalnız `posts/`/`avatars/` işlətməlidir.

#### Sual 4 — 🔴 Cavab hansı keş başlıqları ilə gedir?
```bash
sed -n '2825,2850p' worker/routes.ts
grep -rn "Cache-Control\|cf: *{\|cacheTtl\|cacheEverything" worker/
```
Hazırda `/files/` cavabları `public, max-age=…` daşıyırmı? Cloudflare `cacheEverything` aktivdirmi?

**Bu sualın cavabı 7.4-ü müəyyən edir və bu, task-ın ən vacib texniki məsələsidir.**

#### Sual 5 — Mövcud köməkçi funksiyalar hansılardır?
```bash
grep -rn "requireTeamMember\|isTeamMember\|sharesThread\|isParticipant\|canAccess" worker/
```
Auditin təklifi `requireTeamMember` və `sharesThreadWith` funksiyalarına istinad edir. **Birincisi mövcuddur** (Task 3-də istifadə olundu). **İkincisi ola bilər ki, mövcud deyil** — yazılmalıdır.

⚠️ `requireTeamMember` **xəta qaytaran** funksiyadırsa (`Response | null`), boolean kimi istifadəsi (`return !(await requireTeamMember(...))`) səhv ola bilər. İmzasını yoxla.

#### Sual 6 — DM/otaq iştirakçılığı necə müəyyən olunur?
```bash
grep -rn "dm_messages\|pair_id\|room_members" worker/ | head -20
```
`msgfiles/{uid}/xxx` açarından **hansı söhbətə aid olduğunu** necə bilmək olar? Açarın özündə söhbət ID-si yoxdursa, `sharesThreadWith` **mümkün olmaya bilər** → bax 7.2/qərar qapısı.

**Dayanma şərti:** Sual 4 və Sual 6 cavablanmadan kod yazma.

---

### 7.1 · Siyasət matrisinin layihələndirilməsi

**Həcm:** 1 saat · **dizayn — sonrakı hər şey buna əsaslanır**

7.0-ın nəticəsindən **hər prefiks üçün** cədvəl qur:

| Prefiks | Kim oxuya bilər | Yoxlama növü | DB sorğusu? | Keş |
|---|---|---|---|---|
| `avatars/` | Hər kəs (giriş etmiş) | Prefiks | ❌ Yox | `public` |
| `posts/` | Hər kəs (giriş etmiş) | Prefiks | ❌ Yox | `public` |
| `teams/{id}/` | Komanda üzvləri | Üzvlük | ✅ Bəli | `private` |
| `msgfiles/{uid}/` | Sahib + söhbət iştirakçıları | Sahiblik / iştirak | ⚠️ Şərti | `private` |
| `archive/` | **Yalnız admin** | `c.isAdmin` | ❌ Yox | `private, no-store` |
| *(sadalanmayan)* | **Heç kim** (admin istisna) | Default DENY | ❌ Yox | — |

**Qərar tələb edən suallar:**

1. **`avatars/` və `posts/` həqiqətən publikdirmi?**
   Bloklanmış istifadəçinin avatarı? Silinmiş postun şəkli? Task 6 M-10 bloklanmış istifadəçinin məzmununu feed-dən çıxardı — şəkil hələ də əlçatandır. **Qərar:** prefiks yoxlaması kifayətdir (məzmun onsuz da publik idi), yoxsa əlavə yoxlama lazımdır?
   *Tövsiyə:* prefiks kifayətdir. Səbəb: bu fayllar onsuz da publik feed-də göstərilirdi; DB sorğusu əlavə etmək performansı öldürər, qazanc isə minimaldır.

2. **`teams/` üçün: hansı üzvlük səviyyəsi?**
   Sadəcə üzv olmaq kifayətdirmi, yoxsa fayl kateqoriyasına görə icazə lazımdır (`teams/{id}/documents/` vs `teams/{id}/public/`)?
   *Tövsiyə:* birinci mərhələdə **sadə üzvlük**. İncə icazələr sonrakı işdir — sadə qayda tez tətbiq olunur və sızmanı dərhal bağlayır.

3. **`archive/` — Task 8 ilə koordinasiya.**
   Task 8 arxiv **oxu yolunu** quracaq. ⚠️ **O, `/files/archive/`-dən KEÇMƏMƏLİDİR.** Arxiv oxusu ayrıca API endpoint-i olmalıdır (`GET /api/rooms/:id/messages?before=…`), hansı ki, öz avtorizasiyasını edir və R2-dən **server tərəfdə** oxuyur.
   Bu task `archive/`-i `c.isAdmin` ilə bağlayır; Task 8 ona toxunmur.
   **Bunu hesabatda açıq yaz** ki, Task 8 səhv yola getməsin.

---

### 7.2 · `canReadKey` implementasiyası

**Həcm:** 3 saat

```ts
/**
 * R2 açarı üçün oxu avtorizasiyası — AUDIT-2026-07-26 / C-1.
 *
 * Əvvəl: serveFile() yalnız "giriş edilibmi?" soruşurdu. İstənilən giriş etmiş
 * istifadəçi `teams/<yad-komanda>/documents/<açar>` və ya `archive/<otaq>/dump.gz`
 * oxuya bilirdi. İstismar üç sorğuluq idi və qlobal feed vasitəsilə kütləviləşirdi.
 *
 * Prinsip: DEFAULT DENY. Sadalanmayan hər prefiks bloklanır.
 * Fail-closed: yoxlama xəta versə → false.
 *
 * ⚠️ Sıralama TƏSADÜFİ DEYİL: DB sorğusuz sürətli yollar ƏVVƏL gəlir.
 * Feed səhifəsi 20+ /files/ sorğusu edir; hər birinə D1 sorğusu əlavə etmək
 * gecikməni ölçüləbilən şəkildə artırar (bax §7.3).
 */
async function canReadKey(c: Ctx, key: string): Promise<AccessDecision> {
  // ─── Sürətli yol 1: normallaşdırma və sanity ───
  if (!key || key.includes('..') || key.startsWith('/')) return DENY;

  // ─── Sürətli yol 2: publik prefikslər — DB sorğusu YOX ───
  if (key.startsWith('avatars/') || key.startsWith('posts/')) {
    return { allow: true, cache: 'public' };
  }

  // ─── Sürətli yol 3: arxiv — yalnız admin ───
  if (key.startsWith('archive/')) {
    return { allow: c.isAdmin, cache: 'no-store' };
  }

  const uid = c.user!.id;

  // ─── Sahiblik: msgfiles/{uid}/ ───
  const msg = key.match(/^msgfiles\/([\w-]+)\//);
  if (msg) {
    if (msg[1] === uid) return { allow: true, cache: 'private' };
    return { allow: await sharesThreadWith(c, key), cache: 'private' };
  }

  // ─── Üzvlük: teams/{teamId}/ ───
  const team = key.match(/^teams\/([\w-]+)\//);
  if (team) {
    return { allow: await isTeamMemberCached(c, team[1]), cache: 'private' };
  }

  // ─── DEFAULT DENY ───
  return { allow: c.isAdmin, cache: 'no-store' };
}
```

**Kritik icra detalları:**

| Detal | Tələb |
|---|---|
| **404, 403 deyil** | Rədd halında **`404 Not Found`** qaytar. `403` faylın **mövcudluğunu** təsdiqləyir → açar sadalanmasına imkan verir |
| **Fail-closed** | `isTeamMemberCached` istisna atarsa → `false`. `try/catch` ilə sar, xətanı logla, **keçirmə** |
| **Açar normallaşdırma** | `decodeURIComponent` `index.ts:368`-də edilir. `..`, `//`, başlanğıc `/` — hamısı rədd. L-7 R2-də traversal-ın istismar edilə bilməyəcəyini deyir, lakin **regex uyğunluğunu** poza bilər (`msgfiles/../teams/x`) |
| **Boş `c.user`** | `index.ts:368` onsuz da 401 qaytarır, lakin `canReadKey` **öz-özünə də** təhlükəsiz olmalıdır (`c.user!` işarəsinə güvənmə) |
| **`AccessDecision` tipi** | Sadə `boolean` **kifayət etmir** — keş siyasəti də qərarın bir hissəsidir (bax 7.4) |
| **Regex sərtliyi** | `[\w-]+` ID formatına uyğundurmu? Task 5-də ID-lərin `vbpVokAhLqJA9m0RpqMryroA4S8s` formatında olduğu göstərilib — `\w` bunu tutur, lakin **təsdiqlə** |

**`sharesThreadWith` qərar qapısı:**

7.0/Sual 6-nın cavabına görə:

| Hal | Əməliyyat |
|---|---|
| Açardan söhbət ID-si çıxarıla bilir | `sharesThreadWith` yaz — `room_members` / `dm` cütü yoxlaması |
| Açar yalnız `msgfiles/{uid}/{rand}` formatındadır | ⚠️ İştirakçılıq **müəyyən edilə bilməz** → bax aşağı |

**Açardan söhbət çıxarıla bilmirsə iki variant:**

| Variant | Təsir | Tövsiyə |
|---|---|---|
| **(a) Yalnız sahib oxuya bilir** | DM əlavələri **qarşı tərəf üçün sınar** — funksional reqressiya | ❌ |
| **(b) İstinad cədvəli** — `msg_attachments(key, msg_id, room_id/pair_id)` | Miqrasiya + yazı yolunun dəyişməsi + mövcud açarlar üçün backfill | ✅ Düzgün həll |
| **(c) Müvəqqəti: prefiks + göndərən uid, iştirakçılıq yoxlanmır** | Sızma **qismən** bağlanır (yad uid-in faylı oxunmur), lakin eyni istifadəçinin başqa söhbətdəki faylı oxunur | ⚠️ Aralıq |

**Bu qərar istifadəçiyə təqdim edilməlidir.** (b) düzgündür, lakin +0,5 gün. (c) sızmanın **90%-ni** bağlayır. Ölçmə: `msgfiles/` altında neçə obyekt var və neçə istifadəçiyə aiddir.

---

### 7.3 · 🔴 Performans — üzvlük keşi

**Həcm:** 3 saat · **auditdə yoxdur**

**Problem:** `teams/` və `msgfiles/` yolları D1 sorğusu tələb edir. Komanda fayl siyahısı səhifəsi 30 fayl göstərirsə → **30 D1 sorğusu**, hamısı eyni üzvlük yoxlaması.

**Ölçmə (icradan əvvəl məcburi):**
```
Komanda fayl səhifəsi   → neçə /files/ sorğusu?
Feed səhifəsi           → neçə? (əsasən posts/ və avatars/ — sürətli yol)
Otaq açılışı            → neçə msgfiles/?
```

**Həll — üç qatlı:**

#### Qat 1 — Sürətli yol prioritetliyi (7.2-də edildi)
`avatars/` və `posts/` **heç bir DB sorğusu etmir**. Feed trafikinin böyük hissəsi burada bitir.

#### Qat 2 — Üzvlük keşi (KV, qısa TTL)
```ts
/**
 * Komanda üzvlüyü keşi — AUDIT-TASK-7 §7.3.
 *
 * Fayl səhifəsi eyni komanda üçün onlarla sorğu edir; hər birində D1 sorğusu
 * lazımsızdır. TTL QISA saxlanılır: üzv komandadan çıxarıldıqda çıxışın
 * dərhal kəsilməsi C-1-in əsas tələblərindəndir ("çıxarılmış üzv əbədi çıxış saxlayır").
 *
 * TTL = 60 s → ən pis halda çıxarılmış üzv 60 saniyə əlavə çıxış saxlayır.
 * Bu, mövcud vəziyyətdən (ƏBƏDİ çıxış) qat-qat yaxşıdır.
 *
 * ⚠️ Üzv çıxarıldıqda keş AÇIQ ŞƏKİLDƏ invalidasiya olunur (bax aşağı) —
 * TTL yalnız fallback-dır.
 */
const key = `tm:${teamId}:${uid}`;
```

⚠️ **Açıq invalidasiya məcburidir.** `removeMember`, `leaveTeam`, `deleteTeam` və Task 3-dəki rol dəyişikliyi yollarında keş açarı silinsin. TTL tək başına kifayət deyil — C-1-in mətnində məhz "çıxarılmış üzv" ssenarisi göstərilir.

⚠️ **KV yazı amplifikasiyası:** Task 4 §5.2 KV yazılarının 2,7× artdığını ölçmüşdü. Bu keş **oxu-ağırdır** (yazı yalnız cache miss-də) — yəni əlavə yük azdır. Lakin **ölç və hesabata yaz**.

#### Qat 3 — İndeks
Üzvlük sorğusu `team_members(team_id, uid)` üzrə kompozit indeks tələb edir. Task 6 §D-4 indeks işini görüb — **`EXPLAIN QUERY PLAN` ilə yoxla**, `SCAN TABLE` görünürsə indeks əlavə et.

⚠️ Task 6 §8/3: *"`ANALYZE` statistikası köhnəlir — planlayıcı statistikasız səhv plan seçir."* Yeni indeks əlavə edilərsə `ANALYZE` işlət.

**Qəbul həddi:** `/files/` üçün **p95 gecikmə artımı < 30 ms**. Aşarsa keş strategiyasını yenidən nəzərdən keçir.

---

### 7.4 · 🔴 CDN keşləməsi — avtorizasiyanın keçilməsi

**Həcm:** 2 saat · **auditdə yoxdur — ən təhlükəli boşluq**

**Problem:** Cloudflare edge keşi cavabı `Cache-Control` başlığına görə saxlayır. Əgər `/files/teams/<id>/secret.pdf` cavabı `public, max-age=31536000` daşıyırsa:

1. Qanuni üzv faylı açır → `canReadKey` → ✅ → **edge cavabı keşləyir**.
2. Yad istifadəçi eyni URL-i açır → sorğu **Worker-ə heç çatmır** → edge keşdən verir.
3. **Avtorizasiya tamamilə keçilir.**

Bu, düzəlişi **mənasız** edən boşluqdur və audit onu qeyd etmir.

**Tələb:**

| Prefiks | `Cache-Control` | Səbəb |
|---|---|---|
| `avatars/`, `posts/` | `public, max-age=…, immutable` | Onsuz da publik — keşlənməsi **arzuolunandır** |
| `teams/`, `msgfiles/` | **`private, max-age=0, must-revalidate`** | Edge keşləməməlidir; yalnız brauzer keşi |
| `archive/` | **`no-store`** | Heç yerdə keşlənməsin |
| Rədd (404) | **`no-store`** | Rədd cavabı da keşlənməməlidir |

**Əlavə yoxlamalar:**

1. **`cf: { cacheEverything: true }`** — kodda varsa, məxfi prefikslər üçün **söndür**. Bu parametr `Cache-Control`-u **üstələyir**.
2. **Cloudflare Dashboard Page Rules / Cache Rules** — `/files/*` üçün qaydası varsa, `Cache-Control`-u ləğv edə bilər. ⚠️ **Bu, kodda görünmür** — istifadəçidən yoxlamasını istə.
3. **`Vary` başlığı** — cavab istifadəçiyə görə dəyişirsə, `Vary: Cookie` lazım ola bilər. Lakin `private` daha etibarlıdır.
4. **Doğrulama:**
   ```bash
   curl -sI "<url>/files/teams/<id>/<açar>" -H "Cookie: cx_at=<token>" | grep -i "cache-control\|cf-cache-status"
   ```
   `cf-cache-status: HIT` **görünməməlidir** məxfi prefikslər üçün.

⚠️ **Reqressiya riski:** `avatars/`/`posts/` üçün keşi söndürsən, hər feed açılışı R2-yə gedər → gecikmə və R2 sorğu xərci artar. Publik prefikslər üçün keş **saxlanılmalıdır**.

---

### 7.5 · `createPost` — yükləmə mənbəyinin yoxlanması

**Audit ID:** C-1 zəncirinin 1-ci addımı · **Həcm:** 2 saat

**Yer:** `worker/routes.ts:786-789`

**Nədir:** `blocks` **verbatim** saxlanılır; `imageKeys` `toJSON(b.imageKeys, '[]')` ilə **xam** qəbul olunur. Hücumçu istənilən `/files/` yolunu post daxilinə yerləşdirə bilir.

**Tələb:**

```ts
/**
 * Post şəkil mənbələrinin sahiblik yoxlaması — AUDIT C-1 / zəncirin 1-ci addımı.
 *
 * Post yalnız MÜƏLLİFİN öz yüklədiyi şəkilləri göstərə bilər.
 * Əvvəl: blocks[].urls verbatim saxlanılırdı → hücumçu
 * `/files/teams/<yad>/documents/<açar>` yerləşdirib qlobal feed-də
 * məxfi sənədi göstərə bilirdi.
 *
 * ⚠️ Bu, canReadKey-in ƏVƏZİ deyil, ONA ƏLAVƏDİR. canReadKey oxunu bağlayır;
 * bu yoxlama isə istinadın ilk növbədə yaradılmasının qarşısını alır
 * (feed-də sınıq şəkil görünməsin).
 */
function assertOwnedImageRefs(uid: string, refs: string[]): void {
  const prefix = `posts/${uid}/`;
  for (const raw of refs) {
    const key = normalizeFileRef(raw);          // "/files/posts/x/y" → "posts/x/y"
    if (!key.startsWith(prefix)) {
      throw new HttpError(400, 'invalid_image_ref',
        'Post yalnız öz yüklədiyiniz şəkilləri göstərə bilər.');
    }
  }
}
```

**Kritik detallar:**

| Detal | Tələb |
|---|---|
| **Hər iki sahə** | `imageKeys` **və** `blocks[].urls` — biri qorunub digəri açıq qalmasın |
| **Blok növləri** | Yalnız `image` deyil — `video`, `file`, `embed`, `gallery` bloklarında da URL sahəsi ola bilər. **Bütün blok növlərini** sadala (`grep -rn "type: *'" js/` və serverdəki emal) |
| **Normallaşdırma** | `/files/posts/x/y`, `posts/x/y`, `https://<domen>/files/posts/x/y` — hamısı eyni açara gətirilməlidir. Ayrı `normalizeFileRef` funksiyası yaz |
| **Xarici URL-lər** | Xarici şəkil URL-inə icazə verilirmi? CSP `img-src 'self'` onsuz da bloklayır → **rədd et** və aydın xəta ver |
| **`updatePost`** | Post redaktəsi yolu varsa, **eyni yoxlama** ora da tətbiq olunmalıdır |
| **Mövcud postlar** | Bu yoxlama yalnız **yeni** postlara işləyir → 7.8 mövcudları yoxlayır |

---

### 7.6 · `msg.ts` — `fileKey` sahibliyi

**Audit ID:** C-1 əlavə vektoru · **Həcm:** 1 saat

**Yer:** `worker/msg.ts:44` (`sanitizeMsg`)

**Nədir:** `fileKey` yalnız `msgfiles/` **prefiksinə** görə yoxlanılır. Şərh qorumanın olduğunu iddia edir, yoxlama isə **açarın göndərənə aid olduğunu yoxlamır**.

**Tələb:**
```ts
// Əvvəl: key.startsWith('msgfiles/')   → istənilən istifadəçinin əlavəsi göndərilə bilirdi
// İndi:  key.startsWith(`msgfiles/${senderUid}/`)
```

⚠️ **Şərhi də düzəlt.** Mövcud şərh qorumanın mövcud olduğunu iddia edir — bu, gələcək oxucunu yanıldır. Task 1-dən bəri saxlanılan qayda: şərh reallığı əks etdirməlidir.

⚠️ **Reqressiya:** Yönləndirilən (forward) mesaj funksiyası varsa, başqasının `fileKey`-ini göndərmək **qanuni** ssenari ola bilər. Yoxla:
```bash
grep -rn "forward\|repost\|share" worker/msg.ts js/chat.js
```
Varsa, yönləndirmə üçün ayrı yol lazımdır (açarı köçür və ya istinad cədvəlində icazə qeyd et).

---

### 7.7 · Frontend `isSafeImageURL` sərtləşdirilməsi

**Həcm:** 1 saat · ⚠️ **Task 6 §8/1: `js/` tip yoxlamasından keçmir — yalnız E2E doğrulaya bilər**

**Yer:** `js/util.js:49`

**Nədir:** Yalnız `/files/` prefiksini tələb edir → istismar zəncirinin 3-cü addımı.

**Tələb:** Feed/post kontekstində render üçün **yalnız publik prefikslər**:
```js
// Post/feed şəkilləri yalnız posts/ və avatars/ prefiksindən ola bilər (AUDIT C-1).
// Server tərəfdə canReadKey və createPost yoxlaması var; bu, dərinlikdə müdafiədir
// və eyni zamanda sınıq şəkil sorğularının qarşısını alır.
```

⚠️ **Diqqət:** Bu funksiya başqa kontekstlərdə də işlədilirsə (DM əlavəsi önizləməsi, komanda fayl qalereyası), sərtləşdirmə **onları sındırar**. Əvvəlcə:
```bash
grep -rn "isSafeImageURL" js/
```
İstifadə yerlərini sadala. Lazım gələrsə **kontekstli variant** yaz: `isSafePublicImageURL()` (feed) və `isSafeFileURL()` (əlavələr).

⚠️ **Doğrulama yalnız E2E ilə mümkündür** — `js/` `tsc`-dən keçmir (Task 6 §8/1). Hər dəyişiklikdən sonra vizual axını test et.

---

### 7.8 · 🔴 Mövcud sızmanın qiymətləndirilməsi

**Həcm:** 2 saat · **auditdə yoxdur**

Düzəliş **gələcəyi** qoruyur. İstismar artıq baş veribsə, mövcud postlarda məxfi fayllara istinad **qalır** və düzəlişdən sonra onlar sınıq şəkil kimi görünəcək (yaxşı), lakin **hadisə qeydə alınmalıdır**.

#### 7.8.a — Postlarda şübhəli istinad axtarışı
```sql
SELECT id, uid, created_at, substr(blocks, 1, 300) AS snippet
FROM posts
WHERE blocks LIKE '%/files/teams/%'
   OR blocks LIKE '%/files/msgfiles/%'
   OR blocks LIKE '%/files/archive/%'
   OR image_keys LIKE '%teams/%'
   OR image_keys LIKE '%msgfiles/%'
   OR image_keys LIKE '%archive/%';
```

#### 7.8.b — Rəylərdə / mesajlarda eyni axtarış
`comments`, `room_messages`, `dm_messages`, `team_posts` — hər birində eyni naxış.

#### 7.8.c — Nəticənin qiymətləndirilməsi

| Nəticə | Hökm | Əməliyyat |
|---|---|---|
| **0 sətir** | ✅ İstismar izi yoxdur | Hesabata yaz, davam et |
| Sətir var, **müəllif faylın sahibidir** | ⚠️ Qanuni ola bilər (öz komandasının faylını paylaşıb) | Siyahıla, silmə |
| Sətir var, **müəllif sahib deyil** | 🔴 **HADİSƏ** | Dayan, bildir |

**Hadisə halında:**
- Hansı fayllar, kimin tərəfindən, nə vaxt.
- Postun görünürlüyü (publik feed / komanda daxili).
- ⚠️ Datanın **artıq sızmış** olduğu qəbul edilməlidir — R2 obyektinin açarı dəyişdirilməli və sahibi məlumatlandırılmalıdır.
- Post silinməsi **qərarı istifadəçiyə aiddir** — avtomatik silmə etmə.

#### 7.8.d — R2 giriş jurnalı
```bash
# Cloudflare R2 access logs aktivdirmi?
```
Aktiv deyilsə, keçmiş oxumaları müəyyən etmək **mümkün deyil** — bunu hesabatda məhdudiyyət kimi qeyd et.

---

### 7.9 · Task 8 ilə koordinasiya — `archive/` sərhədi

**Həcm:** 30 dəqiqə (sənədləşdirmə)

Bu task `archive/`-i `c.isAdmin` ilə bağlayır. Task 8 arxiv **oxu yolunu** quracaq.

**Sənədləşdirilməli qayda:**

```
❌ SƏHV: Task 8 istifadəçiyə `/files/archive/...` verir
   → canReadKey-i zəiflətmək tələb olunar → C-1 qismən yenidən açılar

✅ DÜZGÜN: Task 8 ayrıca API endpoint-i qurur
   GET /api/rooms/:id/messages?before=<ts>
   → endpoint öz avtorizasiyasını edir (otaq üzvlüyü)
   → R2-dən SERVER TƏRƏFDƏ oxuyur (readArchive)
   → JSON qaytarır, R2 açarını client-ə HEÇ VAXT vermir
```

Bunu `docs/`-da və `canReadKey`-in şərhində yaz.

---

### 7.10 · E2E testləri

**Həcm:** 3 saat

```ts
test.describe('AUDIT C-1 — /files/* avtorizasiyası @files', () => {

  // ─── 🔴 REQRESSİYA — ən vacib blok ───
  test('feed şəkilləri yüklənir', async ({ page }) => {
    // Feed aç → bütün <img src="/files/posts/..."> 200 qaytarır
    // SINSA → düzəliş çox sərtdir
  });

  test('avatarlar yüklənir', async ({ request }) => { /* /files/avatars/... → 200 */ });

  test('öz DM əlavəm yüklənir', async ({ request }) => {
    // msgfiles/{öz uid}/... → 200
  });

  test('öz komandamın faylı yüklənir', async ({ request }) => {
    // teams/{üzv olduğum}/... → 200
  });

  // ─── 🔴 TƏHLÜKƏSİZLİK ───
  test('yad komandanın faylı 404 qaytarır', async ({ request }) => {
    // teams/{üzv OLMADIĞIM}/documents/... → 404 (403 DEYİL)
  });

  test('başqasının DM əlavəsi 404 qaytarır', async ({ request }) => {
    // msgfiles/{yad uid}/... → 404
  });

  test('arxiv dump-u adi istifadəçi üçün 404', async ({ request }) => {
    // archive/room/general/... → 404
  });

  test('sadalanmayan prefiks 404 (default DENY)', async ({ request }) => {
    // /files/random/xxx → 404
  });

  // ─── 🔴 ÇIXARILMIŞ ÜZV — C-1-in əsas ssenarisi ───
  test('komandadan çıxarılan üzv fayla çıxışını İTİRİR', async ({ request }) => {
    // 1. Üzv faylı oxuyur → 200
    // 2. Owner üzvü çıxarır
    // 3. Keş invalidasiyası → üzv yenidən oxuyur → 404
    // ⚠️ TTL-i gözləmə — açıq invalidasiya işləməlidir (§7.3)
  });

  // ─── İstismar zəncirinin addımları ───
  test('createPost yad komanda faylına istinadı rədd edir', async ({ request }) => {
    // blocks:[{type:'image',urls:['/files/teams/<yad>/x']}] → 400 invalid_image_ref
  });

  test('createPost imageKeys sahəsində də rədd edir', async ({ request }) => {
    // imageKeys:['teams/<yad>/x'] → 400
  });

  test('mesajda başqasının fileKey-i rədd olunur', async ({ request }) => {
    // fileKey:'msgfiles/<yad uid>/x' → 400
  });

  // ─── 🔴 CDN KEŞİ ───
  test('məxfi fayl cavabı private keş başlığı daşıyır', async ({ request }) => {
    // teams/... → cache-control: private (public DEYİL)
  });

  test('arxiv cavabı no-store daşıyır', async ({ request }) => { /* … */ });

  test('publik fayl keşlənə bilir', async ({ request }) => {
    // posts/... → cache-control: public (performans reqressiyası olmasın)
  });

  // ─── HTTP metodları ───
  test('HEAD sorğusu da avtorizasiyadan keçir', async ({ request }) => {
    // HEAD /files/teams/<yad>/x → 404
  });

  test('Range sorğusu da avtorizasiyadan keçir', async ({ request }) => {
    // Range: bytes=0-100 ilə yad fayl → 404
  });
});
```

⚠️ **İzolyasiya:** Task 6 §9 E2E sessiya refaktorunun hələ açıq olduğunu göstərir. Bu testlər **iki fərqli istifadəçi** tələb edir (üzv / qeyri-üzv) → `loginAs` naxışı ilə izolə identity işlət.

---

## 4. ƏHATƏDƏN KƏNAR

| Tapıntı | Aid task | Səbəb |
|---|---|---|
| Arxiv **oxu yolu** (C-3) | **Task 8** | 7.9 sərhədi müəyyən edir |
| `ARCHIVE_HOT_DAYS` → `"90"` | **Task 8** | — |
| H-3 atomik limiter, H-5 XP, H-6 WS re-auth, M-4 RoomDO | **Task 9** | — |
| `js/` tip yoxlaması (Task 6 §8/1) | **Task 10** | 7.7 frontend-ə toxunur, lakin infrastruktur Task 10-dur |
| `ANALYZE` cron mexanizmi (Task 6 §8/3) | **Task 9/10** | 7.3 indeks tələb edərsə qeyd et |
| M-1 log→bloklama keçidi | **Ayrıca** | Meyar müəyyən edilməlidir |
| Sxem #13 `media` cədvəli | **Task 10** | R2 açar idarəçiliyinin düzgün həlli — bu task minimal düzəlişdir |
| İncə fayl icazələri (`teams/{id}/public/` vs `documents/`) | **Task 10** | 7.1/qərar 2 — sadə üzvlük kifayətdir |
| R2 access log-larının aktivləşdirilməsi | **Ayrıca** | Cloudflare konfiqurasiyası |
| CSP `style-src` (M-3), CI/CD | **Task 10** | — |

---

## 5. İCRA QAYDALARI

### 5.1 Commit strategiyası

```
fix(security): /files/* avtorizasiyası — default DENY

Audit: AUDIT-2026-07-26.md §C-1 (1 nömrəli tapıntı)
Risk: Critical (məxfi fayl eksfiltrasiyası)
Təsir: İstənilən giriş etmiş istifadəçi yad komandanın sənədini, başqasının
       DM əlavəsini və bütöv arxiv dump-larını oxuya bilirdi.
       Qlobal feed vasitəsilə kütləvi sızma mümkün idi.
Əlavə: CDN keş siyasəti (private/no-store) — auditdə qeyd olunmayıb,
       onsuz düzəliş edge səviyyəsində keçilə bilərdi.
Test: e2e/*.spec.ts @files — N test
```

**Sıra:** 7.0 → 7.1 → 7.8 → 7.4 → 7.2 → 7.3 → 7.5 → 7.6 → 7.7 → 7.10 → 7.9

⚠️ **7.8 (sızma qiymətləndirməsi) erkən gəlir** — düzəlişdən **sonra** şübhəli istinadlar sınıq şəkilə çevriləcək və hadisənin izi çətinləşəcək.

⚠️ **7.4 (keş) `canReadKey`-dən əvvəl gəlir** — keş siyasəti `AccessDecision` tipinin bir hissəsidir.

### 5.2 🔴 Üç sındırma tələsi

| Tələ | Nəticə | Qoruma |
|---|---|---|
| **Publik prefikslər üçün keş söndürülür** | Hər feed açılışı R2-yə gedir → gecikmə + xərc | `posts/`, `avatars/` üçün `public` saxla |
| **`isSafeImageURL` başqa kontekstlərdə işlədilir** | DM əlavə önizləməsi, komanda qalereyası sınır | 7.7-də əvvəlcə `grep`, lazımsa kontekstli variant |
| **`sharesThreadWith` mümkün deyil** | DM əlavələri qarşı tərəf üçün sınır | 7.2/qərar qapısı — istifadəçidən variant seç |

### 5.3 Fail-closed, lakin ölçülmüş

Hər yoxlama fail-closed olmalıdır. **Lakin** fail-closed sistemin sükutla sınmasına səbəb ola bilər: istifadəçi "sınıq şəkil" görür, səbəbini bilmir.

**Tələb:** Rədd qərarları **loglansın** (`security_events` və ya struktur log):
```
{ event: 'file_access_denied', key_prefix: 'teams/', uid, reason: 'not_member' }
```
⚠️ **Tam açarı logla.ma** — açarın özü həssas ola bilər. Yalnız prefiks + səbəb.

Bu, iki məqsədə xidmət edir: (a) reqressiya diaqnostikası, (b) real hücum cəhdlərinin aşkarlanması.

### 5.4 404 vs 403

**Həmişə 404.** `403` faylın mövcudluğunu təsdiqləyir → hücumçu açar sadalaması ilə komanda struktu­runu öyrənə bilər. Task 4-də `code` sahələri əlavə edildi, lakin burada **kod da verilməməlidir** — sadəcə boş 404.

### 5.5 Şərh mədəniyyəti

`msg.ts:44`-dəki mövcud şərh qorumanın olduğunu **yanlış** iddia edir. Bu task-da:
- Yanlış şərhi düzəlt.
- Hər yeni yoxlamanın yanına **hansı hücumu bağladığını** yaz.
- Keş siyasətinin **niyə** belə olduğunu yaz — gələcəkdə kimsə "performans üçün public edək" deməsin.

---

## 6. QƏBUL MEYARLARI

| # | Meyar | Doğrulama | Gözlənilən |
|---|---|---|---|
| **1** | 🔴 **Feed şəkilləri yüklənir** | E2E vizual axın | hamısı 200 |
| **2** | 🔴 **Avatarlar yüklənir** | `/files/avatars/…` | 200 |
| **3** | 🔴 **Öz komanda faylım yüklənir** | üzv olduğum komanda | 200 |
| **4** | 🔴 **Öz DM əlavəm yüklənir** | `msgfiles/{öz uid}/…` | 200 |
| 5 | Yad komanda faylı bağlıdır | qeyri-üzv | **404** |
| 6 | Başqasının DM əlavəsi bağlıdır | yad uid | **404** |
| 7 | Arxiv adi istifadəçiyə bağlıdır | `archive/…` | **404** |
| 8 | Sadalanmayan prefiks bağlıdır | `/files/xxx/` | **404** (default DENY) |
| 9 | Rədd `403` deyil, `404` verir | hər rədd halı | 404 |
| **10** | 🔴 **Çıxarılan üzv çıxışını itirir** | çıxar → dərhal oxu | **404** (TTL gözləmədən) |
| 11 | `createPost` yad istinadı rədd edir | `blocks[].urls` | 400 `invalid_image_ref` |
| 12 | `createPost` `imageKeys`-i də yoxlayır | ayrıca test | 400 |
| 13 | `updatePost` da yoxlayır (varsa) | — | 400 |
| 14 | `msg.ts` yad `fileKey`-i rədd edir | — | 400 |
| **15** | 🔴 **Məxfi cavab `private`/`no-store`** | `curl -I` | `public` **YOX** |
| 16 | Publik cavab `public` saxlayır | `curl -I` | `public` var |
| 17 | `cf-cache-status: HIT` məxfidə yoxdur | 2× sorğu | HIT yox |
| 18 | HEAD sorğusu yoxlanılır | — | 404 |
| 19 | Range sorğusu yoxlanılır | — | 404 |
| **20** | 🔴 **p95 gecikmə artımı < 30 ms** | ölçmə | hesabatda |
| 21 | Rədd hadisələri loglanır | `security_events` | prefiks + səbəb |
| 22 | 7.8 sızma yoxlaması aparılıb | hesabat §3 | nəticə mövcuddur |
| 23 | Strict TypeScript keçir | `npx tsc --noEmit` | exit 0 (worker/ + e2e/) |
| 24 | Build uğurludur | `npm run build` | exit 0 |
| 25 | Tam E2E dəsti sınmır | `npx playwright test` | Task 6 nəticəsi ≥ |
| 26 | Task 8 sərhədi sənədləşib | `docs/` + şərh | 7.9 |

**Meyar 1–4 və ya 25 ❌ olarsa:** `git revert` — düzəliş çox sərtdir.
**Meyar 15 ❌ olarsa:** düzəliş **mənasızdır** — edge keş onu keçir.

---

## 7. HESABAT FORMATI

`docs/AUDIT-TASK-7-REPORT.md`:

```markdown
# AUDIT-TASK-7 — İcra Hesabatı

**Tarix:** …   **İcraçı:** …   **Commit-lər:** <hash → başlıq>

## 1. R2 açar məkanı inventarı (7.0)
| Prefiks | Obyekt sayı | Kim yazır (fayl:sətir) | Auditdə var idi? |
### /files/*-ə giriş yolları (Sual 3)
### 🔴 Mövcud keş başlıqları (Sual 4)
### Mövcud köməkçilər (Sual 5)
### msgfiles/ açar formatı və iştirakçılıq (Sual 6) → qərar: <a/b/c>

## 2. Siyasət matrisi (7.1)
| Prefiks | Kim | Yoxlama | DB? | Keş |

## 3. 🔴 Sızma qiymətləndirməsi (7.8)
| Cədvəl | Şübhəli sətir | Müəllif sahibdir? | Hökm |
### R2 access log — <aktiv / deaktiv → keçmiş oxumalar müəyyən edilə bilməz>
**Hökm:** <istismar izi yoxdur / HADİSƏ — detallar>

## 4. Performans (7.3)
| Ssenari | /files/ sorğusu | p50 əvvəl | p50 sonra | p95 əvvəl | p95 sonra |
| Feed açılışı | … | … | … | … | … |
| Komanda fayl səhifəsi | … | … | … | … | … |
→ Keş hit nisbəti: …
→ Meyar 20 (<30 ms): <keçdi / keçmədi>

## 5. 🔴 CDN keş doğrulaması (7.4)
| Prefiks | Cache-Control | cf-cache-status (2-ci sorğu) |
### Cloudflare Cache Rules yoxlanıldımı: <bəli/xeyr — istifadəçi təsdiqi>

## 6. Qəbul meyarları (26 sətir)

## 7. Task 8 sərhədi (7.9)
<arxiv oxusunun /files/-dən KEÇMƏMƏSİ qaydası — yazıldığı yerlər>

## 8. Aşkarlanan yeni risklər

## 9. Açıq qalan öhdəliklər
- [ ] 🔴 H-3/H-5/H-6 → Task 9
- [ ] 🔴 C-3 arxiv oxu yolu + ARCHIVE_HOT_DAYS → Task 8
- [ ] 🔴 E2E sessiya refaktoru
- [ ] 🟠 <7.2/qərar (c) seçilibsə: msg_attachments istinad cədvəli>
- [ ] 🟠 M-1 log→bloklama, js/ tip yoxlaması, ANALYZE mexanizmi
- [ ] <Task 6-dan qalanlar>

## 10. Geri qaytarma planı
| Bənd | Revert | Təsir |
| 7.2 canReadKey | `git revert` | ⚠️ C-1 tamamilə yenidən açılır |
| 7.4 keş | `git revert` | ⚠️ Avtorizasiya edge-də keçilir |
```

---

## 8. BİRİNCİ ADDIM

**Yalnız oxu rejimində** 7.0-dakı 6 sualı cavablandır. Kod yazma.

Xüsusilə bu üçünü konkret cavabla:

1. **Sual 4** — 🔴 `/files/` cavabları hazırda hansı `Cache-Control` daşıyır? `cf: { cacheEverything }` işlədilirmi? *(Bu, task-ın ən vacib texniki sualıdır — cavab "public" olarsa, düzəliş keş siyasəti olmadan mənasızdır.)*
2. **Sual 6** — `msgfiles/` açarından söhbət ID-si çıxarıla bilirmi? Çıxarıla bilmirsə 7.2-dəki (a)/(b)/(c) variantlarından hansını tövsiyə edirsən və niyə?
3. **Sual 3** — `worker/og.ts` və ya başqa **autentifikasiyasız** yol `/files/`-ə çıxırmı? *(Sosial preview botları giriş etmir — OG şəkli məxfi prefiksdən gəlirsə, ya sınacaq, ya sızma qapısı qalacaq.)*

**Sonra 7.8-i icra et** (sızma qiymətləndirməsi) — düzəlişdən əvvəl, çünki sonra izlər çətinləşir.

**Üç dayanma şərti:**

| Şərt | Əməliyyat |
|---|---|
| 7.8-də **müəllifi sahib olmayan** istinad tapılarsa | 🔴 **HADİSƏ** — dayan, bildir. Post silmə qərarı istifadəçiyə aiddir |
| 7.0/Sual 2-də **auditdə olmayan** prefiks tapılarsa | Dayan, siyasətini soruş — default DENY onu bloklayacaq |
| 7.0/Sual 6 `sharesThreadWith`-i **mümkünsüz** göstərirsə | Dayan, (a)/(b)/(c) variantı üçün qərar istə |

Cavablar hazır olduqdan sonra §5.1-dəki sıra ilə icraya başla.
