# AUDIT-TASK-9 — İcra Hesabatı

**Tarix:** 2026-07-29 **İcraçı:** Claude (Opus 5)
**Bağlanan tapıntılar:** H-3, H-5, H-6 (3 High) + M-4 (Medium) + 2 miras bənd

**Commit-lər (faza üzrə, `master`):**

| Faza | Commit | Başlıq |
|---|---|---|
| D-1 | `d3e778e` | partiya dəyişən limiti auditi — D1 100 parametr sərhədi |
| A-1/A-2 | `3770017` | atomik rate limiter — `RateLimitDO` |
| A-3 | `7d6e507` | hesab başına brute-force qoruması — məcburi Turnstile |
| B | `5c688a8` | XP anti-abuse — jurnal, idempotentlik, tavan, kompensasiya |
| C | `6e2d620` | WS periodik re-auth + `disconnect(uid)` RPC + DO state |
| D-2 | `bf54774` | silinmiş hesabın isti mesajları anonimləşdirilir |
| D-3 | `0d25d80` | AUDIT-9 E2E dəsti — limit ÜSTÜ data ilə |
| düzəliş | `0c10393` | 🔴 disconnect fan-out hədəflənir (32 s → 20 ms) |
| düzəliş | `20079ab` | qonaq spec-i sessiyasız işləyir, seed XP invariantını qoruyur |

---

## 0. Vəziyyət xəritəsi

### 🔴 E2E baseline (9.0/Sual 0) — dürüst qeyd

`e2e/KNOWN-FAILING.md` baseline-ın əvvəlki task-da bağlandığını (**0 sınıq**)
bildirir. Qapı sınağı task-ın əvvəlində fonda başladıldı, **lakin nəticəsi
etibarsızdır**: `wrangler dev` fayl dəyişikliklərini izləyir və qaçış boyu
mənim redaktələrimlə *hot-reload* etdi (ilk 41 test təmiz keçdi, sonrakı
sınıqlar yarımçıq yüklənmiş koddan gəldi). Həmçinin `0030` miqrasiyası həmin
anda hələ tətbiq olunmamışdı, yəni kod `xp_logs`-u gözləyirdi, baza isə onu
təqdim etmirdi.

**Ona görə qərar verici ölçmə TASK-IN SONUNDAKI TƏMİZ QAÇIŞDIR** (§5, meyar 34)
— miqrasiya tətbiq olunmuş, kod dondurulmuş vəziyyətdə.

> **Dərs:** `webServer.reuseExistingServer` + watch rejimi baseline ölçməsini
> səssizcə korlayır. Növbəti task-da baseline qaçışı **kod dəyişməzdən əvvəl**
> tam bitirilməlidir.

### Native binding semantikası (Sual 1) — 🔴 QƏRAR VERİCİ

Mənbə: `developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/`

| Sual | Sənəd cavabı | H-3-ə təsiri |
|---|---|---|
| Qlobal, yoxsa PoP başına? | *"For each unique key … there is a unique limit **per Cloudflare location**"* | 🔴 **H-3/#2 BAĞLANMIR** |
| Dəqiqlik | *"permissive, eventually consistent, and **intentionally designed to not be used as an accurate accounting system**"* | Təhlükəsizlik kontrolu üçün rəsmi olaraq yararsız |
| Pəncərə | `period` yalnız **10** və ya **60** saniyə | `auth` səbətinin **300 s** pəncərəsi ifadə oluna bilmir |
| Konfiq | `wrangler.jsonc`-də **statik** | 8+ səbət → 8+ ayrı binding |

**Nəticə:** native binding üç qüsurdan yalnız birini (atomiklik) bağlayır.

### Mövcud DO naxışı (Sual 2)

`room-do.ts` token-bucket-i `private buckets = new Map()` — yəni **DO
yaddaşında** idi. Hibernation yaddaşı təmizləyir → **M-4 təsdiqləndi**.
`ctx.storage` istifadə olunmurdu; `serializeAttachment` yalnız `{uid, name}`
üçün işlədilirdi.

### XP verilən yerlər (Sual 3) — audit: 4, **faktiki: 7**

| # | Yer | Mənbə | Auditdə var idi? |
|---|---|---|---|
| 1 | `routes.ts` `maybeProfileBonus` | profil bonusu +20 | ❌ |
| 2 | `routes.ts` `createPost` | post +10 | ✅ |
| 3 | `routes.ts` `addComment` | rəy +5 | ✅ |
| 4 | `routes.ts` `reviewSubmission` | həll +50 + `tasks_completed` | ✅ |
| 5 | `routes.ts` `adminPatchUser` | **mütləq** XP yazısı | ❌ |
| 6 | `team/task.service.ts` (Done) | +50 + `tasks_completed` | ❌ |
| 7 | `team/task.service.ts` (reopen) | −50 | ❌ |

Task 2 §5.2 və Task 3 §8/6 dərsi ("öz sayğacınla təsdiqlə") **yenidən özünü
doğrultdu** — auditin siyahısı 43% natamam idi.

### XP profili (Sual 4) — istehsal

| Göstərici | Dəyər |
|---|---|
| XP-si olan istifadəçi | **1** |
| Ümumi XP | 1 000 060 |
| Maksimum | 1 000 060 |
| Ortalama | 1 000 060 |

### 🔴 Anomal hesablar

**Bəli — bir hesab.** Tək XP sahibinin dəyəri **1 000 060** (`levelFromXP` →
Lv ≈ 101). Bu, organik qazanc profili deyil; admin panelindən əl ilə qoyulmuş
dəyərə bənzəyir (TASK-7 B6 — XP redaktəsi). İstismar izi **deyil**: istehsalda
başqa heç kimin XP-si yoxdur, yəni real trafik də yoxdur.

**İstifadəçi qərarı (Addım 3):** sıfırla və yenidən başla.
→ `0030_xp_logs.sql` `UPDATE users SET xp = 0 WHERE xp <> 0` icra edir və
auditin təklif etdiyi sintetik `legacy` sətrini **yazmır** (saxlanacaq organik
XP olmadığı üçün süni sətir invariantı mənasız dəyərlə doldurardı).
İnvariant yenə qurulur: **0 == 0**.

### CHECK trigger (Sual 5) — **MÖVCUDDUR**

`migrations/0026_check_triggers.sql`:
`users_xp_nonneg_update` / `users_xp_nonneg_insert` → `RAISE(ABORT)`.
→ **B-4-ün üç qatlı müdafiəsi məcburi oldu** (aşağıda).

### WS axını (Sual 6)

`grep -rn "revokeAllSessions\|removeMember\|blockUser" worker/ | grep -i "room\|ws\|socket"`
→ **boş çıxdı**, auditin proqnozu təsdiqləndi: heç bir üzvlük/sessiya
dəyişikliyi WebSocket-ə toxunmurdu.

---

## 1. Faza A — rate limiter

### A-1 Mexanizm qərarı

| Sinif | Seçilən | Əsaslandırma |
|---|---|---|
| 🔴 Təhlükəsizlik (`auth`, `refresh`, `upload`) | **(b) `RateLimitDO`** | Native binding PoP başına sayır → H-3/#2 açıq qalardı; sənəd onu "accurate accounting system deyil" adlandırır; 300 s pəncərə ifadə oluna bilmir |
| 🟠 Xərc (`read`, `write`, `ai`, `presence`, `admin`, `heavy`, `asset`, `archive`, `form`, `search`) | **(d) KV-də qalır** | Task 4 §4.1 taksonomiyası — təxmini sayma kifayətdir, miqrasiya xərcini əsaslandırmır |

**Atomikliyin mənbəyi** (Rules of Durable Objects): *"While these storage
operations execute, no other requests can interleave — input gate blocks new
events."* Yəni `storage.get()` → `storage.put()` arasında ikinci sorğu araya
girə bilmir. Məhz H-3/#1-in tərifi.

**DO açar strategiyası:** hər limit açarına ayrıca instans
(`idFromName('rl:auth:i:<ip>')`) — auditin tövsiyəsi ilə üst-üstə düşür.
Pəncərə indeksi **açara qatılmır**, arqument kimi ötürülür: əks halda hər
pəncərədə yeni DO yaranar və köhnələri storage-da qalardı. Təmizləmə alarm ilə;
alarm **aktiv pəncərəni silmir** (silsəydi, təmizləmə məntiqi limiterin özündə
boşluq yaradardı).

### A-2 Gecikmə ölçməsi

| Səbət | Mexanizm | p50 | p95 |
|---|---|---|---|
| *(bax §6 — ölçmə lokal `wrangler dev`-də aparıldı)* | | | |

⚠ **Ölçmənin məhdudiyyəti dürüst qeyd olunur:** lokal `wrangler dev`-də DO və
Worker eyni prosesdədir, yəni **şəbəkə round-trip-i yoxdur**. İstehsalda DO tək
coğrafi yerdədir və uzaq istifadəçi üçün 100–300 ms əlavə oluna bilər. Login
üçün bu məqbuldur (nadir əməliyyat); `upload` üçün **istehsalda ölçülməlidir**
— açıq öhdəlik kimi §7-də qeyd olunub.

### A-3 Hesab qoruması: **Turnstile CAPTCHA** (istifadəçi qərarı)

| Aspekt | Həll |
|---|---|
| Astanalar | 3 uğursuz cəhd → CAPTCHA istənilir (fail-open); **10 → MƏCBURİ** (fail-closed) |
| Fail-open boşluğu | `verifyTurnstile` açar yoxdursa/xidmət əlçatmazsa `skipped: true` qaytarırdı → sərt astanada bu artıq **qəbul edilmir** |
| Sayğacın sıfırlanması | `recentFailures` indi son `login_ok`-dan **sonrakı** uğursuzluqları sayır. IP və ad sayğacları **ayrı-ayrı** sıfırlanır: hücumçu öz hesabına girib IP sayğacını sıfırlaya bilər, qurbanın adı üzrə sayğac isə toxunulmaz qalır |
| MFA | `mfaVerify` də eyni qapıdan keçir (audit: "yalnız `auth` səbətinə güvənirdi") + client tərəfdə widget |
| Bildiriş | Sərt astanada hesab sahibinə email, 3 dildə. Mətn **"hesabınız bloklanmayıb"** deyir — model kiliddən fərqlidir. Saatda bir məktub tıxacı (əks halda xəbərdarlığın özü spam vektoru olardı) |
| Hesab sadalanması | Qapı `recentFailures` ilə açılır, hesabın **mövcudluğu** ilə yox. Uğursuz girişlər mövcud olmayan ad üçün də jurnala düşür → sayğac eyni artır, cavab və gecikmə fərqlənmir |
| DoS riski | **Yoxdur** — qurban heç vaxt kilidlənmir |
| Admin bərpası | **Tətbiq olunmur** (kilid yoxdur, açılacaq bir şey yoxdur) |

---

## 2. Faza B — XP

### B-1 Backfill

**0 istifadəçi, 0 XP `legacy` kimi qeyd edildi** — qəsdən. Səbəb yuxarıda
(Sual 4). İstehsalda tək anomal hesabın XP-si sıfırlandı.

### B-2 İdempotentlik — incə mexanizm

```sql
INSERT OR IGNORE INTO xp_logs (id, …) VALUES (?logId, …);
UPDATE users SET xp = xp + ?  WHERE id = ?
  AND EXISTS (SELECT 1 FROM xp_logs WHERE id = ?logId);
```

`logId` məhz indi yaradılmış UUID-dir → həmin id-li sətir **yalnız bizim
INSERT işləyibsə** mövcuddur. Şərtsiz UPDATE yazsaydıq, təkrar çağırış
**logsuz XP verərdi** — yəni idempotentlik heç olmazdı. `tasks_completed`
eyni şərtdən keçir.

### B-3 Tavan dəyərləri

| Mənbə | Tavan | Əsas |
|---|---|---|
| `post` | 100 XP/gün | 10 post/gün |
| `comment` | 100 XP/gün | 20 rəy/gün |
| `solution` | tavansız | admin təsdiqi tələb edir |
| `team_task` | tavansız | komanda iş axını təsdiqi tələb edir |
| **Ümumi** | **300 XP/gün** | son müdafiə xətti |

🔴 **DÜRÜST QEYD:** audit tavanları **ölçməyə** əsaslandırmağı tələb edirdi
("kor-koranə qəbul etmə"). **Ölçmə mümkün olmadı** — istehsalda organik XP
yoxdur (Sual 4), yəni qanuni istifadəçinin gündəlik qazanc paylanması mövcud
deyil. Dəyərlər **əməliyyat sayından** çıxarıldı. Real trafik yığıldıqdan sonra
yenidən qiymətləndirilməlidir (§7 öhdəlik) — Task 4 §4.2-də auditin `presence`
limiti məhz ölçülmədiyi üçün səhv çıxmışdı.

Gün sərhədi **UTC** (client-in elan etdiyi qurşaq manipulyasiyaya açıqdır).
Tavana çatanda **əməliyyat uğurlu olur**, yalnız XP verilmir + `xpCapped: true`
→ UI 3 dildə bildiriş göstərir.

### B-4 🔴 Trigger toqquşması — necə həll edildi

Trigger **mövcuddur**. Üç qat:

| Qat | Qayda |
|---|---|
| 1 | Uyğun `xp_logs` sətri **yoxdursa** kompensasiya **edilmir** (jurnaldan köhnə məzmun toxunulmur) |
| 2 | Clamp: `-MIN(?amount, u.xp)` — heç vaxt mənfiyə düşülmür |
| 3 | Kompensasiya `source='compensation'`, mənfi məbləğlə loglanır → invariant qorunur |

🔴 **Clamp və jurnal EYNİ SQL ifadəsindən gəlir.** INSERT `-MIN(?, u.xp)`
yazır, UPDATE isə həmin **yazılmış** dəyəri `xp_logs`-dan geri oxuyub tətbiq
edir. Əvvəlcə JS-də oxuyub sonra `MAX(0, xp - n)` yazsaydıq, paralel silmələrdə
jurnal ilə real XP **aralanardı** (drift) — məhz `/api/health`-in aşkarladığı hal.

**Tavan qarşılıqlı təsiri:** tavan hesabı yalnız `amount > 0` sətirlərini sayır
→ kompensasiya gündəlik cəmi **azaltmır**, yəni yarat-sil dövrəsi tavanı bərpa
edə bilmir.

**`deleteAccount`:** `xp_logs` sətirləri silinir (FK yoxdur → orphan qalardı və
invariant hər hesab silinməsindən sonra pozulardı).

### B-5 `submitSolution`

`ON CONFLICT … DO UPDATE SET status = CASE WHEN submissions.status = 'approved'
THEN 'approved' ELSE 'pending' END`. `grantXp` idempotentliyi ikinci müdafiə
xəttidir.

### İnvariant: `SUM(xp_logs) == users.xp` → ✅ (`/api/health` → `xp_invariant`)

⚠ `drift` `ok`-u **aşağı salmır**: bu, məlumat bütövlüyü siqnalıdır, xidmət
nasazlığı deyil — 503 vermək sağlam saytı monitorinqdə "ölü" göstərərdi.

---

## 3. Faza C — WS/DO

### C-2 `disconnect(uid)` çağırılan yerlər

| Yer | Auditdə var idi? |
|---|---|
| `removeMember` | ✅ |
| `leaveTeam` | ✅ |
| `revokeAllSessions` (sessiya ləğvi) | ✅ |
| `blockUser` (`adminPatchUser`) | ✅ |
| `deleteAccount` | ✅ |
| `deleteTeam` | ✅ (⚠ soft-delete — `team_members` qalır, üzvlük yoxlaması otağı bağlamır) |
| `updateMemberRole` | ✅ |
| `changePassword` | ❌ **əlavə tapıldı** |
| `adminBulkUsers` (toplu blok) | ❌ **əlavə tapıldı** |
| `adminTempPassword` | ❌ **əlavə tapıldı** |

**`exceptSid`:** "digər cihazlardan çıxış" axınında cari cihazın soketi
toxunulmaz qalır — əks halda istifadəçi öz çatını itirərdi və client 4403-də
yenidən qoşulmadığı üçün söhbət sükutla ölərdi.

### C-1 oxu yolunun bağlanması

`handleSend` yoxlaması yalnız **yazını** dayandırır. Broadcast server tərəfdən
gəlir və "qəbul anında" yoxlanıla bilmir → **süpürgə alarmı** (60 s) bütün
soketləri yenidən avtorizasiya edir və icazəsizləri bağlayır. Keş soketin
attachment-indədir (hibernation-da qorunur), TTL 60 s — hər mesajda D1 sorğusu
aktiv otaqda 1000 sorğu/dəq olardı.

**Fail-closed, lakin kəskin deyil:** D1 xətasında keş 120 s uzadılır, sonra
soket bağlanır.

### C-3 State mexanizmi: **`serializeAttachment`**

Per-soket state (uid, sid, token-bucket, re-auth keşi) attachment-dədir —
hibernation boyu qorunur və `ctx.storage`-dən fərqli olaraq disk yazısı tələb
etmir (~150 B, limit ~2 KB). `ctx.storage` yalnız **alarm** üçün işlədilir.

---

## 4. Faza D

### D-1 🔴 Partiya yolları auditi

**D1 limiti: 100 bağlı parametr/sorğu** (`d1/platform/limits`).

| Yer | Partiya | Dəyişən/element | Nəzəri maksimum | Aşırdı? | Düzəldildi | Limit üstü test |
|---|---|---|---|---|---|---|
| `adminBulkUsers` | `uids.slice(0,200)` | 1 + N | **201** | 🔴 Bəli | `chunkForD1(targets, 1)` | ✅ 150 uid |
| `deleteComment` | 1 + cavab sayı | N | **sərhədsiz** | 🔴 Bəli | `chunkForD1(ids)`, eyni batch | ✅ 120 cavab |
| `listComments` (cavablar) | `topIds` | N | **200** | 🔴 Bəli | `chunkForD1(topIds)` | ✅ |
| `listComments` (`comment_likes`) | üst rəylər + BÜTÜN cavablar | 1 + N | **sərhədsiz** | 🔴 Bəli | `chunkForD1(allIds, 1)` | ✅ |
| `notifyMentions` | unikal @qeydlər | N | **~1000** (5000 simvol / `@abc`) | 🔴 Bəli | `chunkForD1(names)` | ✅ 150 qeyd |
| `queue.ts` mention fan-out | `slice(0,20)` | N | 20 | ✅ Xeyr | — | — |
| `archive.ts` | `DELETE_CHUNK = 50` | N | 50 | ✅ Xeyr (Task 8) | — | — |
| `reorderTaxonomy` | 300 **ayrı** statement | 3/statement | 3 | ✅ Xeyr | — | — |
| `deleteAccount` cascade | alt-sorğu (`IN (SELECT …)`) | sabit | — | ✅ Xeyr | — | — |

**Eyni sinifdən iki əlavə qüsur (auditin sadalamadığı):**

1. 🔴 **Yoxlanılan sərhəd ≠ saxlanılan sərhəd.** `collectImageRefs` yalnız ilk
   **30** `imageKeys`-i və blok başına ilk **20** `urls`-i yoxlayırdı,
   `createPost` isə `toJSON(b.imageKeys)` ilə **xam** massivi saxlayırdı.
   Nəticə: 31-ci açardan sonrakı istinadlar `assertOwnedImageRefs`-dən
   **tamamilə yan keçib bazaya düşürdü** — yəni AUDIT C-1-in bağladığı zəncirin
   1-ci addımı 30-dan çox şəkilli postda yenidən açıq idi. Kəsmə indi
   saxlamadan **əvvəl** edilir.
2. **R2 yetim obyektləri.** `deleteAccount` `keys.slice(0, 100)`, `deletePost`
   `slice(0, 30)` — limitdən çox şəkli olan hesab silinəndə artıq fayllar R2-də
   qalırdı, yəni GDPR "unudulmaq hüququ" **yarımçıq** icra olunur və heç bir
   xəta görünmürdü. `deleteR2Keys` 1000-lik hissələrlə hamısını silir.

### D-2 Silinmiş hesab siyasəti: **(b) anonimləşdirmə** — istifadəçi qərarı

`room_messages.author_id` + `author_name`, `dm_messages.from_id`/`to_id` →
`deleted_user` / "Silinmiş istifadəçi". **`author_id` da dəyişdirilir**, təkcə
ad yox: uid qalsaydı, o, hələ də həmin şəxsə bağlanan identifikator olardı və
anonimləşdirmə GDPR mənasında natamam qalardı.

Privacy mətni **3 dildə** yeniləndi (audit tələbi: seçilən variant hüquqi mətnlə
uyğun olmalıdır).

### D-3 E2E — 20 test, hamısı keçir

Yol boyu tapılan **harness** qüsurları (məhsul qüsuru deyil, lakin testi yalançı
yaşıl/qırmızı edirdi):

1. `wrangler --json` hər ifadə üçün ayrıca blok qaytarır; çoxsətirli SQL-də
   birinci blok INSERT-in nəticəsidir və `results` boşdur → `parsed[0]` həmişə 0.
2. `comments.author_id` → `users(id)` FK daşıyır; uydurma uid ilə partiya
   datası yaratmaq mümkün deyil.
3. 🔴 `page.evaluate` ilə hesab silmək **31 saniyə** asılı qalırdı (birbaşa
   sorğu 0,5 s): silmə sessiyanı ləğv edir, səhifədəki tətbiq buna reaksiya
   verir və səhifə yenidən qurulduğu üçün `evaluate` tamamlanmır.
   `context.request` eyni cookie-ləri daşıyır, lakin səhifə həyat dövrünə
   bağlı deyil.
4. **Seed invariantı pozurdu.** Seed XP-ni birbaşa D1-ə yazırdı, `xp_logs`-a
   yox → `/api/health` **daimi** `drift` göstərirdi. Bu yalançı siqnal
   invariantın real drift-i aşkarlama qabiliyyətini səs-küydə itirərdi.

---

## 5. Qəbul meyarları (35)

### Faza A — rate limiter

| # | Meyar | Nəticə |
|---|---|---|
| **1** | 🔴 200 paralel sorğu limiti keçmir | ✅ **210 sorğu → `{400: 150, 429: 60}`** — dəqiq limit qədəri keçdi |
| 2 | Təhlükəsizlik səbətləri atomikdir | ✅ `mechanismFor` → DO; `security_events.meta.mechanism` loglanır |
| 3 | Xərc səbətləri KV-də qalır | ✅ qəsdən (E2E: `critical` bayrağı təsbit olunur) |
| 4 | Fail-closed (təhlükəsizlik) | ✅ `catch` → `ok: !cfg.critical` |
| 5 | Fail-open (xərc) | ✅ eyni yerdə |
| 6 | `Retry-After` + `code` qorunub | ✅ hesab hər iki mexanizmdə eynidir |
| 7 | Hesab qoruması işləyir | ✅ Turnstile, iki astana |
| 8 | Kilid hesab sadalamasına imkan vermir | ✅ E2E: mövcud/olmayan ad eyni cavab |
| 9 | Gecikmə artımı ölçülüb | ⚠ **qismən** — §1/A-2 (lokal ölçmə; istehsal öhdəliyi §7) |

### Faza B — XP

| # | Meyar | Nəticə |
|---|---|---|
| **10** | 🔴 Yarat-sil dövrəsi XP verməz | ✅ 8 dövrə → XP dəyişmir |
| 11 | Eyni ref üçün XP bir dəfə | ✅ UNIQUE |
| 12 | Gündəlik tavan işləyir | ✅ 12 post → qazanc ≤ 100 |
| 13 | Tavan əməliyyatı bloklamır | ✅ hamısı 200 |
| **14** | 🔴 Legacy XP-li post silinə bilir | ✅ DB xətası yox, XP dəyişmir |
| **15** | 🔴 Kompensasiya XP-ni mənfiyə salmır | ✅ clamp |
| 16 | Kompensasiya tavanı bərpa etmir | ✅ `amount > 0` şərti |
| 17 | Təkrar təsdiq XP verməz | ✅ B-5 + UNIQUE |
| 18 | `SUM(xp_logs) == users.xp` | ✅ `/api/health` → `ok` |
| 19 | Tavan aktiv qanuni istifadəçini kəsmir | ⚠ **ölçülə bilmədi** — §1/B-3 |

### Faza C — WS/DO

| # | Meyar | Nəticə |
|---|---|---|
| **20** | 🔴 Çıxarılan üzv soketdən düşür | ✅ 4403 |
| 21 | Yazı **və oxu** dayanır | ✅ yazı `handleSend`-də, oxu süpürgə alarmında |
| 22 | `revokeAllSessions` soketi bağlayır | ✅ |
| 23 | `blockUser` soketi bağlayır | ✅ |
| **24** | 🔴 Qanuni üzv soketdə qalır | ✅ E2E reqressiya testi |
| 25 | Client 4403-də yenidən qoşulmur | ✅ `chat.js` + `teams.js` |
| 26 | Hibernation token-bucket-i sıfırlamır | ⚠ **mexanizm** təsbit olunub (hibernation E2E-də məcbur edilə bilmir — runtime qərarıdır) |
| 27 | Re-auth D1 sorğusunu keşləyir | ✅ 60 s, attachment-də |

### Faza D

| # | Meyar | Nəticə |
|---|---|---|
| **28** | 🔴 Partiya yolları auditi tamamlanıb | ✅ cədvəl §4/D-1 |
| 29 | Hər düzəldilmiş yol limit üstü test daşıyır | ✅ 150 qeyd / 150 uid / 120 cavab |
| 30 | Silinmiş hesab siyasəti tətbiq olunub | ✅ (b) + Privacy 3 dildə |

### Ümumi

| # | Meyar | Nəticə |
|---|---|---|
| 31 | `npx tsc --noEmit` | ✅ exit 0 |
| 32 | `npm run build` | ✅ exit 0 |
| 33 | `npm run check:migrations` | ✅ 32 fayl, nizam qaydada |
| **34** | 🔴 Tam E2E dəsti | ✅ **kod reqressiyası yoxdur** — aşağıdakı cədvələ bax |
| 35 | `/api/health` XP invariantını göstərir | ✅ `xp_invariant` |

### Meyar 34 — tam dəst qaçışlarının izi (dürüst hesabat)

| # | Nə | Nəticə | Şərh |
|---|---|---|---|
| 1 | `desktop` (iki düzəlişdən ƏVVƏL) | 298 keçdi · **12 sındı** · 2 atlandı | 6 × GDPR 429 (`heavy` büdcəsi), 5 × `users.spec` (24 qalıq test hesabı), 1 × `security.spec` |
| 2 | `desktop` (düzəliş + təmizlikdən sonra) | 273/312-yə çatdı · **0 sındı** | fon tapşırığı kəsildi |
| 3 | `desktop` (əlavə təmizliklə) | 306/312-yə çatdı · **1 sındı** | `heavy` 429 — təcriddə **keçir** |
| 4 | Quyruq dilimi (`ws-flow`, `ux-phase`, `users`) | **26/26** | 3-cü qaçışın çatmadığı hissə |
| 5 | `audit9` (yeni dəst) | **20/20** | |
| 6 | `home.spec` | **21/21** | əvvəl 0/21 |
| 7 | `archive-read` | **18/18** | |
| 8 | `admin` + `archive` | **25/25** | |
| 9 | `mobile` layihəsi | 286/312-yə çatdı · **2 sındı** | ikisi də `admin.spec` — aşağı bax |

**`mobile` sınıqlarının atribusiyası (ölçmə ilə, təxminlə yox):**

| Test | Mənim ağacımda | Dəyişikliklərdən ƏVVƏLKİ ağacda | Hökm |
|---|---|---|---|
| `admin.spec:235` "#6 jurnal kopyalanır" | ✘ (30,4 s) | ✘ (30,4 s) | **MÖVCUD qüsur** — mənim işimdən deyil |
| `admin.spec:247` "#7 skeleton" | ✓ (1,9 s) təcriddə | ✓ (1,9 s) | **Kaskad** — #6-nın 30 s timeout-undan sonra serial rejimdə sınırdı |

⚠ Hər ikisi `KNOWN-FAILING.md`-in "bağlandı" saydığı qrupdadır — yəni "0 sınıq"
iddiasının etibarsızlığı yalnız `home.spec` ilə məhdud deyil (bax R-1b).

⚠ **Tək qalan sınıq növü `heavy` səbətinin saatlıq büdcəsidir** (20/saat, testdə
×5 = 100/uid) və o, **bir saat ərzində təkrar tam qaçışların** nəticəsidir, kod
dəyişikliyinin yox — hər dəfə təcrid qaçışında keçir. Bax R-3b.

⚠ Fon qaçışları üç dəfə xarici səbəbdən kəsildi (10-14 dəqiqə civarında), ona
görə **tək bir 312/312 sətri yoxdur**; əvəzində örtük yuxarıdakı dilimlərlə
tamamlanıb. Bu, meyar 34 üçün zəiflikdir və §7-də öhdəlik kimi qeyd olunub.

---

## 6. Aşkarlanan yeni risklər

### 🔴 R-1 — `disconnect` fan-out-u sorğu yolunu 32 SANİYƏ bloklayırdı (öz gətirdiyim, düzəldildi)

C-2-nin ilk versiyası istifadəçinin qoşula **biləcəyi** hər otağa RPC göndərirdi.
`env.ROOM_DO.get(...)` otaqda soket olmasa belə DO-nu **oyadır**; oyanan DO-nun
gözləyən alarm-ı varsa o da işə düşür və hər soket üçün D1 sorğusu edir.

**Ölçmə:** bloklamadan sonrakı ilk `GET` → **31 934 ms** (→ 20 ms düzəlişdən sonra).
`admin.spec.ts` "#5 bulk blok" testi məhz buna görə sınırdı.

Bu, **auditin proqnozlaşdırmadığı** risk sinfidir: "dərhal təsir" tələbi
düşünülmədən tətbiq olunanda özü performans qüsuruna çevrilir.

### 🟠 R-2 — E2E harness-i baseline ölçməsini səssizcə korlayır

`webServer.reuseExistingServer: true` + `wrangler dev` watch rejimi:
qaçış zamanı edilən kod redaktələri serveri yenidən yükləyir və nəticə
qarışıq koddan gəlir. Daha pisi — başqa məqsədlə əl ilə başladılmış
`wrangler dev` (məs. diaqnostika üçün, `--test-scheduled` olmadan) **təkrar
istifadə olunur** və bütün arxiv testləri sınır. Bu, bir dəfə səhv diaqnoza
səbəb oldu (§0).

### 🔴 R-1b — "0 sınıq" baseline iddiası ETİBARSIZ idi (mənim işimdən əvvəl)

`e2e/KNOWN-FAILING.md` baseline-ın bağlandığını (**0 sınıq**) yazır, lakin iş
ağacındakı (commit edilməmiş) baseline işi yarımçıq idi: `auth-fixture.ts`
yaradılıb, `playwright.config.ts`-dən isə layihə səviyyəsindəki `storageState`
**çıxarılmayıb**. Nəticədə sessiyalı kontekst QONAQ spec-inə də tətbiq olunurdu
və `home.spec.ts`-in **21 testinin hamısı** 7 saniyəlik timeout-a düşürdü.

⚠ Ən diqqətçəkəni: `auth-fixture.ts`-in öz başlıq şərhi bu nəticəni **açıq
proqnozlaşdırırdı** ("layihə səviyyəsində `use.storageState` təyin etsək, o,
QONAQ testlərinə də … tətbiq olunar və onlar sınar") — yəni səbəb məlum idi,
sadəcə konfiq uyğunlaşdırılmamışdı. Düzəldildi (`20079ab`).

Əlavə olaraq `mobile / admin.spec:235` ("#6 jurnal kopyalanır") **hələ də
sınır** və bu, dəyişikliklərdən ƏVVƏLKİ ağacda da təkrarlanır (§5-dəki
atribusiya cədvəli). Yəni siyahı bir deyil, **iki müstəqil yerdən** natamamdır.

🔴 **Nəticə:** növbəti task `KNOWN-FAILING.md`-ə güvənməməli, baseline-ı
ÖZÜ ölçməlidir — və ölçməni kod dəyişməzdən əvvəl bitirməlidir.

### 🟠 R-3 — Test izolyasiyası: sabit id-li seed + yarımçıq qaçış

`archive-read` CSV testi sabit `e2e_tp_csv` id-si ilə seed edir və sonda silir.
Qaçış yarımçıq kəsilsə sətir qalır → növbəti qaçış `UNIQUE constraint failed`
ilə sınır. Eyni sinif: `admin.spec` bulk testi bloklanmış istifadəçi qoyub gedir.
Birincisi düzəldildi (idempotent seed), ikincisi **açıq qalır**.

### 🟡 R-4 — Gündəlik tavan yarışa açıqdır

Tavan yoxlaması `batch()`-dən kənardadır, yəni tam paralel iki sorğu tavanı bir
əməliyyat qədər aşa bilər. **Qəbul edilib:** tavan təhlükəsizlik kontrolu deyil,
sui-istifadə qapısıdır — 100 əvəzinə 110 XP modeli pozmur.

### 🟡 R-4b — İnvariantı POZAN yeganə real mənbə seed-in özü çıxdı

`SUM(xp_logs) == users.xp` invariantı qurulan kimi **iki dəfə** siqnal verdi və
hər ikisində səbəb məhsul deyil, **E2E seed-i** idi:
1. seed XP-ni birbaşa D1-ə yazır, `xp_logs`-a yox;
2. seed `users.xp`-ni sabit dəyərə qaytarır, lakin əvvəlki qaçışın organik
   jurnal sətirlərini saxlayırdı (ölçüldü: `e2e_main` xp=10, jurnal=55).

Bu, invariantın **işlədiyinin** sübutudur — məhz "jurnaldan kənarda XP dəyişir"
halını tutdu. Lakin göstərir ki, `xp_invariant: 'drift'` istehsalda görünsə,
ilk şübhəli **kod deyil, əl ilə/skriptlə edilən D1 müdaxiləsidir**.

### 🟠 R-3b — Dəst öz-özünü zəhərləyir: `heavy` büdcəsi + qalıq test hesabları

Bu task-da dəst onlarla dəfə (tam və hissəvi) işlədildi və **iki müstəqil
zəhərlənmə** ortaya çıxdı:

1. **`heavy` səbəti (20/saat, testdə ×5 = 100/uid).** `/api/me/export` və admin
   CSV ixracları paylaşılan `e2e_main` hesabı ilə gedir. Bir təmiz qaçış ~10-15
   çağırış edir — problem yoxdur; lakin bir saat ərzində 10+ qaçış büdcəni
   yeyir və **6 GDPR testi 429 alır**. `KNOWN-FAILING.md` bu sinfi artıq
   sənədləşdirmişdi (mobile CSV testləri).
2. **Qalıq test hesabları.** Yarımçıq kəsilmiş qaçışlar `a9_*` / `rl_*`
   hesablarını silmədən buraxır; 24 belə hesab yığıldı və istifadəçi kataloqunun
   ilk səhifəsini doldurub `users.spec`-in 5 testini sındırdı — məhz
   `rate-limit.spec.ts`-in şərhində xəbərdarlıq edilən hal.

⚠ **Hər ikisi məhsul qüsuru DEYİL**, lakin hər ikisi "reqressiya varmı?"
sualına yalançı cavab verir. Diaqnoz üçün tələb olunan addımlar: qalıq hesabları
sil, `rl:*` KV açarlarını təmizlə, sonra ölç.

### 🟡 R-5 — `noteSocket` KV yazısı hər WS upgrade-ə əlavə olunur

Upgrade nadir əməliyyatdır (mesaj başına deyil, bağlantı başına), lakin KV
yazısı kvotaya dəyir. Sıx yenidən-qoşulma dövrəsi olan client bunu artıra bilər
— `chat.js` 3 saniyəlik geri çəkilmə işlədir, 4403-də isə tamamilə dayanır.

---

## 7. Açıq qalan öhdəliklər

- [ ] 🔴 `RL_MECHANISM` bayrağının və `kvHit` yolunun **silinməsi** (atomik
      mexanizm istehsalda 2 həftə stabil işlədikdən sonra)
- [ ] 🔴 **DO gecikməsinin İSTEHSALDA ölçülməsi** — lokal `wrangler dev`-də DO
      və Worker eyni prosesdədir, şəbəkə round-trip-i yoxdur. `upload` səbəti
      üçün xüsusilə vacibdir (hər fayl yükləməsinə əlavə olunur)
- [ ] 🔴 **XP tavanlarının real trafiklə yenidən qiymətləndirilməsi** — hazırkı
      dəyərlər ölçməyə yox, əməliyyat sayına əsaslanır (B-3)
- [ ] 🔴 E2E baseline qaçışı **kod dəyişməzdən əvvəl** tam bitirilməlidir
      (watch rejimi ölçməni səssizcə korlayır)
- [ ] 🟠 **Dəst öz-özünü təmizləməlidir** (R-3b): `globalSetup` qalıq `a9_*`/`rl_*`
      hesablarını və `rl:*` KV açarlarını silsin. Hazırda bu, əl ilə edilir və
      unudulsa növbəti task-ın diaqnozu yenidən yalançı olur
- [ ] 🟠 `admin.spec` "#5 bulk blok" testi sınsa istifadəçini **bloklu qoyub gedir**
      → növbəti qaçış da sınır (idempotent təmizlik lazımdır)
- [ ] 🟠 **Tək qaçışda 312/312 sətri alınmadı** (meyar 34): fon prosesi üç dəfə
      xarici səbəbdən kəsildi. Örtük dilimlərlə tamamlandı, lakin növbəti task
      bunu bir bütöv qaçışla təsdiqləməlidir
- [ ] 🔴 Hüquqi mətnin peşəkar baxışı
- [ ] 🔴 İstehsalda ilk arxiv cron-unun yoxlanması (Task 8 §10)
- [ ] 🟠 M-1 log→bloklama + `file_access_denied` siqnalı
- [ ] 🟠 Cloudflare Cache Rules, R2 Logpush
- [ ] 🟠 `photo_url` ikiqat prefiks, OG avatar (Task 7 §8)
- [ ] 🟡 Task 10-a ötürülənlər: 11 sxem bəndi, `ANALYZE` cron,
      `purgeDeletedFromArchives` sürəti, `contact_messages.uid`,
      `deleteTeam` soft-delete siyasəti, `js/` tip yoxlaması
- [ ] `collabix.az` DNS + MX, VÖEN, sosial profillər, Git remote

---

## 8. Geri qaytarma planı

| Faza | Revert | Data təsiri |
|---|---|---|
| A | `RL_MECHANISM=kv` (kod dəyişmədən) | ⚠ H-3 yenidən açılır |
| A-3 | `git revert 7d6e507` | Hesab qapısı itir; `recentFailures` sıfırlanması da geri gedir |
| B | `git revert 5c688a8` | ⚠ Miqrasiya QALIR (`xp_logs` cədvəli zərərsizdir). **XP sıfırlanması geri qaytarıla BİLMİR** — `0030` icra olunubsa köhnə dəyər itib |
| C | `git revert 6e2d620` | ⚠ H-6 yenidən açılır. `wrangler.jsonc` DO migration `v3` **geri alınmamalıdır** |
| D-2 | `git revert bf54774` | Anonimləşdirilmiş mesajlar geri qayıtmır (birtərəfli) |
| D-1 | ⛔ **REVERT ETMƏ** | Partiya qüsuru sükutla çökər; `adminBulkUsers` 100+ uid ilə tamamilə işləməz |
