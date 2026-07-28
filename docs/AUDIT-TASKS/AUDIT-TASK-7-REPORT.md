# AUDIT-TASK-7 — İcra Hesabatı

**Tarix:** 2026-07-28
**İcraçı:** Claude (Opus 5) — Collabix təhlükəsizlik zənciri
**Mənbə tapıntı:** `AUDIT-2026-07-26.md` §C-1 (Critical, auditin 1 nömrəli tapıntısı)
**Tapşırıq sənədi:** `docs/AUDIT-TASKS/AUDIT-TASK-7.md`

> **Bir cümlə ilə:** `/files/*` yolunda avtorizasiya qurulub (default DENY, rədd = 404),
> keş siyasəti prefiksə görə ayrılıb (`public` / `private` / `no-store`), istismar
> zəncirinin hər üç halqası bağlanıb və sızma qiymətləndirməsi **istismar izi
> tapmayıb**.

---

## 1. R2 açar məkanı inventarı (7.0)

### Sual 1 — Kodda hansı prefikslərə YAZILIR?

| Fayl:sətir | Açar şablonu | Kim yazır |
|---|---|---|
| `worker/routes.ts:2977` (`upload`) | `avatars/{uid}/{ts}-{rand}-{ad}` | `POST /api/upload?kind=avatar` |
| `worker/routes.ts:2977` | `posts/{uid}/{ts}-{rand}-{ad}` | `?kind=post` (default) |
| `worker/routes.ts:2977` | `msgfiles/{uid}/{ts}-{rand}-{ad}` | `?kind=msg` |
| `worker/routes.ts:2976` | `teams/{teamId}/{category}/{ts}-{rand}-{ad}` | `?kind=team&teamId=…` (`manage_files` tələb olunur) |
| `worker/archive.ts:65,70` | `archive/{room\|dm}/{scope}/{YYYY-MM-DD}-{rand}.json.gz` | Cron (`runArchiveJob`) |

**Yazı nöqtəsi cəmi 2-dir** (`upload` + `archive`). Silmə: `routes.ts:477` (hesab
silmə), `:911` (post), `:1213` (otaq mesajı), `:1308` (DM),
`services/team/file.service.ts:63` (komanda faylı).

### Sual 2 — R2-də faktiki hansı prefikslər var?

⚠ `wrangler r2 object list` **mövcud deyil** (wrangler 4-də yalnız `get/put/delete`).
İnventar Cloudflare REST API ilə çıxarıldı:
`GET /accounts/{acct}/r2/buckets/collabix-files/objects?per_page=1000`.

| Prefiks | Obyekt sayı | Qeyd | Auditdə var idi? |
|---|---|---|---|
| `avatars/` | **23** | 17-si **legacy** `avatars/{uid}.jpg` (2 seqment, Firebase backfill), 6-sı cari `avatars/{uid}/…` | ✅ |
| `msgfiles/` | **1** | `msgfiles/{uid}/{ts}-{rand}-{ad}` | ✅ |
| `posts/` | **1** | `posts/{uid}/legacy_…_backfill_0.jpg` | ✅ |
| `teams/` | **0** | kod yolu var, obyekt yoxdur | ✅ |
| `archive/` | **0** | `ARCHIVE_HOT_DAYS=3650` → cron heç nə arxivləmir | ✅ |
| **CƏMİ** | **25** | | |

🟢 **Auditdə olmayan prefiks TAPILMADI** → 7.0-ın dayanma şərti işə düşmədi.
Legacy 2-seqmentli `avatars/{uid}.jpg` formatı prefiks yoxlaması ilə tutulur
(sahib seqmenti tələb olunmur) — sınmır.

### Sual 3 — `/files/*`-ə hansı kod yollarından girilir?

| Yol | Vəziyyət |
|---|---|
| `worker/index.ts:400` | **Yeganə** server yolu. Autentifikasiya (401) burada, avtorizasiya `serveFile`-da. İndi `HEAD` də bu yoldan keçir |
| `worker/og.ts:98,110` | 🟠 Satori HTML-inə `<img src="{origin}/files/avatars/…">` yerləşdirir. workers-og onu **server tərəfdə, KUKİSİZ** çəkir → **onsuz da 401 alır**. Yəni OG kartlarında avatar bu düzəlişdən ƏVVƏL də görünmürdü (bax §8/1) |
| `worker/seo.ts:247` | JSON-LD `image` sahəsi — yalnız metadata, biz çəkmirik |
| `worker/seo.ts:305` | `robots.txt` → `Disallow: /files/` ✅ |
| SSR / HTMLRewriter (`rewriteHead`) | Yalnız `<head>` meta yazır, `/files/`-ə toxunmur |
| Service worker / manifest | Yoxdur |

🟢 **Autentifikasiyasız `/files/` yolu YOXDUR.** OG botları onsuz da 401 alırdı;
düzəliş bu vəziyyəti dəyişmir.

### Sual 4 — 🔴 Cavab hansı keş başlıqları ilə gedirdi?

```ts
// ƏVVƏL — worker/routes.ts:2990, HƏR obyekt üçün:
headers.set('Cache-Control', 'public, max-age=31536000, immutable');
```

- `cf: { cacheEverything }` / `cacheTtl` — **kodda heç yerdə yoxdur** (grep: 0 nəticə).
- `wrangler.jsonc` → `run_worker_first: ["/**", "!/assets/*"]`, yəni `/files/*`
  Worker-dən keçir, LAKİN cavab `public, immutable` daşıdığı üçün **edge keşi onu
  saxlamağa tam səlahiyyətlidir**.

🔴 **Boşluq REALDIR:** keş siyasəti düzəldilməsəydi, `canReadKey` bir dəfə işləyər,
sonrakı sorğular Worker-ə çatmadan edge-dən verilərdi → **avtorizasiya tamamilə
keçilərdi**. Bu, 7.4-ün icrasını məcburi etdi.

### Sual 5 — Mövcud köməkçilər

| Funksiya | İmza | Nəticə |
|---|---|---|
| `requireTeamMember(c, teamId)` | `Promise<Response \| null>` | ⚠ **boolean deyil** — auditin `return !(await requireTeamMember(...))` təklifi hər rəddə lazımsız `Response` obyekti yaradardı |
| `getMembership(c, teamId)` | `Promise<TeamMembership \| null>` | ✅ mövcuddur |
| `guardTeamRoom(c, roomId)` | `Promise<Response \| null>` | ✅ otaq üzvlüyü qaydası |
| `sharesThreadWith` | — | ❌ **MÖVCUD DEYİLDİ**, bu task-da yazıldı |

`canReadKey` `requireTeamMember`-i çağırmır: keşlənmiş, `Response` yaratmayan
`isTeamMemberCached` işlədilir (eyni SQL qaydası, `status='active'`).

### Sual 6 — `msgfiles/` açar formatı və iştirakçılıq → **qərar: (b) ekvivalenti**

Açar formatı: `msgfiles/{uid}/{ts}-{rand8}-{fayl adı}` — **söhbət ID-si yoxdur**.

**Lakin** açar mesaj sətrində saxlanılır: `room_messages.file_key`,
`dm_messages.file_key`. Yəni istinad **onsuz da bazadadır**:

```sql
-- DM iştirakçılığı
SELECT 1 FROM dm_messages WHERE file_key = ?1 AND (from_id = ?2 OR to_id = ?2);
-- Otaq iştirakçılığı (sonra guardTeamRoom qaydası)
SELECT DISTINCT room_id FROM room_messages WHERE file_key = ?;
```

| Variant | Seçim | Səbəb |
|---|---|---|
| (a) yalnız sahib | ❌ | DM əlavələri qarşı tərəf üçün sınardı |
| (b) `msg_attachments` istinad cədvəli | ✅ **seçildi — miqrasiyasız formada** | İstinad artıq `file_key` sütunundadır; yeni cədvəl, backfill və yazı yolu dəyişikliyi **lazım deyil**. Yalnız indeks əlavə olundu (`0028`) |
| (c) müvəqqəti, iştirakçılıq yoxlanmır | ❌ | Lazım olmadı — (b) tam dəqiqliklə əldə edildi |

🟢 **Dayanma şərti işə düşmədi:** `sharesThreadWith` mümkünsüz deyil, istifadəçidən
qərar tələb olunmadı.

---

## 2. Siyasət matrisi (7.1)

| Prefiks | Kim oxuya bilər | Yoxlama növü | I/O | `Cache-Control` |
|---|---|---|---|---|
| `avatars/` | Hər giriş etmiş istifadəçi | Prefiks | ❌ **yox** | `public, max-age=31536000, immutable` |
| `posts/` | Hər giriş etmiş istifadəçi | Prefiks | ❌ **yox** | `public, max-age=31536000, immutable` |
| `msgfiles/{uid}/` | Sahib | Sahiblik (sətir müqayisəsi) | ❌ **yox** | `private, max-age=0, must-revalidate` + `Vary: Cookie` |
| `msgfiles/{yad}/` | Söhbət iştirakçısı, sonra admin | `sharesThreadWith` → D1 | ✅ 1–2 D1 | `private, …` |
| `teams/{id}/` | Komanda aktiv üzvü, sonra admin | `isTeamMemberCached` → KV (miss: D1) | ✅ 1 KV | `private, …` |
| `archive/` | **Yalnız sayt admini** | `isAdmin()` | ✅ 1 D1 | `no-store` |
| *(sadalanmayan)* | **Heç kim** (admin istisna) | **Default DENY** | ✅ 1 D1 | `no-store` |
| **Rədd (404)** | — | — | — | `no-store` |

**Qərar 1 — `avatars/`/`posts/` publikdir:** prefiks yoxlaması kifayətdir. Bu fayllar
onsuz da publik feed-də göstərilirdi; hər şəkilə "müəllif bloklanıbmı" sorğusu
əlavə etmək feed-i öldürərdi, qazanc isə minimaldır (M-10 bloklanmış istifadəçinin
məzmununu feed-dən onsuz da çıxarıb).

**Qərar 2 — `teams/` üçün sadə üzvlük:** kateqoriya səviyyəli incə icazələr
(`documents/` vs `public/`) **Task 10**-dur. Sadə qayda dərhal tətbiq olunur və
sızmanı bu gün bağlayır.

**Qərar 3 — `archive/` yalnız admin:** bax §7 (Task 8 sərhədi).

---

## 3. 🔴 Sızma qiymətləndirməsi (7.8)

Düzəlişdən **ƏVVƏL** icra olundu (§5.1 sırasına uyğun) — sonra şübhəli istinadlar
sınıq şəklə çevrilib izi çətinləşdirərdi.

### 3.a — İstehsal bazasının vəziyyəti

| Cədvəl | Sətir |
|---|---|
| `users` | **1** |
| `posts` | **0** |
| `teams` | **0** |
| `team_files` | **0** |
| `room_messages` (file_key ilə) | **0** |
| `dm_messages` (file_key ilə) | **0** |
| `message_archives` | **0** |

### 3.b — Şübhəli istinad axtarışı

| Cədvəl | Naxış | Şübhəli sətir | Hökm |
|---|---|---|---|
| `posts` | `blocks`/`image_keys` LIKE `%teams/%`, `%msgfiles/%`, `%archive/%`, `%/files/…%` | **0** | ✅ |
| `comments` | `text LIKE '%/files/%'` | **0** | ✅ |
| `room_messages` | `file_key NOT LIKE 'msgfiles/%'` | **0** | ✅ |
| `room_messages` | `text LIKE '%/files/%'` | **0** | ✅ |
| `dm_messages` | `file_key NOT LIKE 'msgfiles/%'` | **0** | ✅ |
| `dm_messages` | `text LIKE '%/files/%'` | **0** | ✅ |
| `team_posts` | `content LIKE '%/files/%'` | **0** | ✅ |
| `teams` | `avatar`/`banner` LIKE `%/files/%` | **0** | ✅ |
| `users` | `photo_url NOT LIKE 'avatars/%'` | **1** | ⚠ qanuni — bax §8/1 (format qüsuru, sızma deyil) |

### 3.c — R2 giriş jurnalı

`wrangler.jsonc`-də **Logpush konfiqurasiyası yoxdur** və R2 bucket-i üçün access
log aktivləşdirilməyib. Yəni **keçmiş oxumaları maşınla müəyyən etmək mümkün
deyil** — bu, qiymətləndirmənin məhdudiyyəti kimi qeyd olunur.
⚠ Cloudflare panelində R2 → Settings → Logpush yoxlanması **istifadəçiyə qalır**.

### **Hökm: ✅ İSTİSMAR İZİ YOXDUR**

Nə postlarda, nə rəylərdə, nə mesajlarda, nə də komanda məzmununda məxfi prefiksə
istinad tapılmadı. İstehsal bazası praktiki olaraq boşdur (1 istifadəçi, 0 post,
0 komanda) — yəni C-1 **istismar edilməmiş** vəziyyətdə bağlanır.
🟢 Dayanma şərti (HADİSƏ) işə düşmədi.

---

## 4. Performans (7.3)

### Metodologiya

⚠ **Ardıcıl ölçmə səhv nəticə verir.** İlk cəhddə prefikslər növbə ilə ölçüldü və
dev serverinin istiliyi/GC sürüşməsi fərq kimi göründü (`posts/` p95-i eyni kodla
35 ms → 66 ms dəyişdi). Yekun ölçmə **növbələşdirilmişdir** (hər turda hər
prefiksə bir sorğu) — sürüşmə hamısına eyni təsir edir və çıxılanda yox olur.

`canReadKey` publik prefikslərdə **heç bir I/O əlavə etmir** (yalnız sətir
müqayisələri), ona görə `posts/` bugünkü ölçüsü **düzəlişdən əvvəlki vəziyyətin
ekvivalentidir**. Artım = `p95(məxfi prefiks) − p95(posts/)`.

Skript: `e2e/_perf-files.spec.ts` (adi dəstdə **skip**, icra: `PERF=1 npx playwright test _perf-files --project=desktop`).

### Nəticə (n = 80 / prefiks, iki müstəqil tur)

| Prefiks | Əlavə I/O | p50 (tur 1 / tur 2) | p95 (tur 1 / tur 2) |
|---|---|---|---|
| `posts/` (baza = "əvvəl") | yox | 30,4 / 28,3 ms | 57,7 / 57,1 ms |
| `msgfiles/` (öz faylım) | yox | 28,9 / 28,1 ms | 63,0 / 75,9 ms |
| `teams/` (üzvlük, KV) | 1 KV oxusu | 31,8 / 32,2 ms | 64,7 / 52,4 ms |

| Artım | Tur 1 | Tur 2 | Hədd |
|---|---|---|---|
| p50 (`teams` − `posts`) | +1,4 ms | +3,9 ms | — |
| **p95 (`teams` − `posts`)** | **+7,0 ms** | **−4,7 ms** | < 30 ms ✅ |
| p50 (`msgfiles` − `posts`) | −1,5 ms | −0,2 ms | — |
| **p95 (`msgfiles` − `posts`)** | **+5,3 ms** | **+18,8 ms** | < 30 ms ✅ |

→ **Meyar 20: ✅ KEÇDİ.** Ən pis müşahidə +18,8 ms.

### ⚠ İcra zamanı tapılan və düzəldilən performans qüsuru

İlk versiyada `c.isAdmin` `/files/` yolunun **əvvəlində**, hər qeyri-publik sorğu
üçün hesablanırdı (`SELECT 1 FROM admins…`). Ölçmə `msgfiles/` üçün **+30,3 ms p95**
göstərdi — halbuki **öz** DM əlavəsini oxumaq üçün heç bir D1 sorğusu lazım deyil.

Həll: `lazyAdminCheck()` — sorğu daxilində memoizasiya olunan **tənbəl** resolver.
Admin sorğusu yalnız qərar ondan asılı olanda gedir (arxiv, yad `msgfiles`, üzvü
olmadığın komanda, sadalanmayan prefiks). Sahib/üzv yolları D1-ə **heç toxunmur**.
Sıralama da dəyişdi: `teams/`-də üzvlük (KV) **əvvəl**, admin (D1) **sonra**.

⚠ Memo dəyişəni funksiya daxilindədir — modul səviyyəsində saxlansaydı, isolate
təkrar istifadə olunanda bir istifadəçinin admin statusu digərinə sızardı.

### KV yazı amplifikasiyası

Üzvlük keşi **oxu-ağırdır**: yazı yalnız cache miss-də olur (TTL 60 s). Bir istifadəçi
+ bir komanda üçün dəqiqədə ≤ 1 KV yazısı. Task 4 §5.2-də ölçülən 2,7× artım riski
burada təkrarlanmır. Mənfi nəticə də keşlənir (`'0'`) — hücumçunun açar sadalaması
hər sorğuda D1-ə dəymir.

### İndeks (Qat 3)

`migrations/0028_files_auth_indexes.sql`:
- `idx_room_messages_file_key ON room_messages(file_key) WHERE file_key IS NOT NULL`
- `idx_dm_messages_file_key ON dm_messages(file_key) WHERE file_key IS NOT NULL`
- `ANALYZE` (Task 6 §8/3 dərsi — statistikasız planlayıcı səhv plan seçir)

Qismən indeks seçildi: mesajların əksəriyyəti mətndir (`file_key IS NULL`), onları
indeksdən kənarda saxlamaq indeksi kiçik və yazını ucuz saxlayır.
`team_members(team_id, user_id)` indeksi **artıq mövcuddur** (`0019`:
`idx_team_members_team`, `idx_team_members_user` + `UNIQUE(team_id, user_id)`) —
yeni indeks lazım olmadı.

---

## 5. 🔴 CDN keş doğrulaması (7.4)

| Prefiks | `Cache-Control` | `Vary` | E2E ilə təsdiq |
|---|---|---|---|
| `avatars/` | `public, max-age=31536000, immutable` | — | ✅ |
| `posts/` | `public, max-age=31536000, immutable` | — | ✅ |
| `msgfiles/` | `private, max-age=0, must-revalidate` | `Cookie` | ✅ (`public` YOX) |
| `teams/` | `private, max-age=0, must-revalidate` | `Cookie` | ✅ (`public` YOX) |
| `archive/` | `no-store` | — | ✅ |
| Rədd (404) | `no-store` | — | ✅ |

- `cf: { cacheEverything }` kodda **yoxdur** — söndürüləcək bir şey tapılmadı.
- `Vary: Cookie` məxfi cavablara əlavə olundu (`private` ilə birlikdə, ikinci qat).

### ⚠ Lokal doğrulamanın məhdudiyyəti

`cf-cache-status` başlığı **yalnız Cloudflare edge-ində** yaranır; `wrangler dev`
lokal mühitində belə başlıq yoxdur. Yəni **meyar 17 lokal olaraq yoxlanıla bilmir**.

**Deploy-dan sonra icra edilməli (istifadəçi tərəfindən):**
```bash
# Məxfi prefiks — İKİ dəfə çağır, HIT GÖRÜNMƏMƏLİDİR
curl -sI "https://<domen>/files/teams/<id>/<açar>" -H "Cookie: cx_at=<token>" | grep -i "cache-control\|cf-cache-status"
curl -sI "https://<domen>/files/teams/<id>/<açar>" -H "Cookie: cx_at=<token>" | grep -i "cf-cache-status"
# Publik prefiks — keşlənməsi ARZUOLUNANDIR
curl -sI "https://<domen>/files/posts/<uid>/<açar>" -H "Cookie: cx_at=<token>" | grep -i "cache-control"
```

### ⚠ Cloudflare Dashboard Cache Rules — **istifadəçi təsdiqi tələb olunur**

Page Rules / Cache Rules **kodda görünmür** və `Cache-Control`-u ləğv edə bilər.
`/files/*` üçün "Cache Everything" və ya "Edge TTL override" qaydası varsa,
bu düzəliş edge səviyyəsində **yenidən keçilər**.
🔴 **Yoxlanılmalı:** Dashboard → Caching → Cache Rules → `/files/*` üçün qayda varmı?

---

## 6. Qəbul meyarları (26 sətir)

| # | Meyar | Nəticə | Doğrulama |
|---|---|---|---|
| **1** | 🔴 Feed şəkilləri yüklənir | ✅ | `files-auth.spec.ts` → "post şəkli yüklənir" (200 + `public`) |
| **2** | 🔴 Avatarlar yüklənir | ✅ | "öz avatarım yüklənir" (200 + `public`) |
| **3** | 🔴 Öz komanda faylım yüklənir | ✅ | "çıxarılan üzv" testinin 1-ci addımı (əsl üzvlük yolu, 200) |
| **4** | 🔴 Öz DM əlavəm yüklənir | ✅ | "öz mesaj əlavəm" (200 + `private`) |
| 5 | Yad komanda faylı bağlıdır | ✅ | 404 |
| 6 | Başqasının DM əlavəsi bağlıdır | ✅ | 404 |
| 7 | Arxiv adi istifadəçiyə bağlıdır | ✅ | 404 + `no-store` |
| 8 | Sadalanmayan prefiks bağlıdır | ✅ | `random/`, `backup/`, `legacy/` → 404 |
| 9 | Rədd `403` deyil, `404` verir | ✅ | Bütün rədd testləri `toBe(404)` |
| **10** | 🔴 Çıxarılan üzv çıxışını itirir | ✅ | TTL **gözlənilmədən** 404 (açıq KV invalidasiyası) |
| 11 | `createPost` yad istinadı rədd edir | ✅ | 400 `invalid_image_ref` |
| 12 | `createPost` `imageKeys`-i də yoxlayır | ✅ | 400 `invalid_image_ref` |
| 13 | `updatePost` da yoxlayır | ✅ | `patchPost`-a əlavə olundu (müəllifin uid-inə görə) |
| 14 | `msg.ts` yad `fileKey`-i rədd edir | ✅ | 400 |
| **15** | 🔴 Məxfi cavab `private`/`no-store` | ✅ | E2E başlıq assertion-ları |
| 16 | Publik cavab `public` saxlayır | ✅ | E2E |
| 17 | `cf-cache-status: HIT` məxfidə yoxdur | ⚠ **lokal yoxlanıla bilmir** | Deploy-dan sonra `curl -I` — §5 |
| 18 | HEAD sorğusu yoxlanılır | ✅ | 404 (əvvəl SPA fallback-ı 200 HTML verirdi) |
| 19 | Range sorğusu yoxlanılır | ✅ | 404 |
| **20** | 🔴 p95 gecikmə artımı < 30 ms | ✅ | Ən pis: **+18,8 ms** — §4 |
| 21 | Rədd hadisələri loglanır | ✅ | `security_events.file_access_denied` (prefiks + səbəb, **tam açar YOX**) |
| 22 | 7.8 sızma yoxlaması aparılıb | ✅ | §3 — istismar izi yoxdur |
| 23 | Strict TypeScript keçir | ✅ | `tsc --noEmit` + `tsc -p tsconfig.e2e.json` → exit 0 |
| 24 | Build uğurludur | ✅ | `npm run build` → exit 0 |
| 25 | Tam E2E dəsti sınmır | ✅ | Bax §6.1 |
| 26 | Task 8 sərhədi sənədləşib | ✅ | `files-auth.ts` başlıq şərhi + §7 |

**Əlavə test (auditdə yoxdur):** traversal açarı (`msgfiles/../teams/…`) → 404;
xarici domen şəkli `createPost`-da → 400.

### 6.1 Tam E2E dəsti

| Dəst | Nəticə |
|---|---|
| `@files` (yeni, `files-auth.spec.ts`) | **18 / 18 keçdi** (desktop; mobile-də qəsdən skip — protokol testi) |
| Tam dəst (`npm run e2e`, 544 test) | **278 keçdi · 186 skip · 80 sındı** (26,8 dəq) |

#### 🔴 80 sınıq test — bu düzəlişdən DEYİL (baseline ilə sübut edildi)

Sınıqlar iki qrupda cəmlənib və **hamısı `/files/` yolundan kənardır**:

| Qrup | Say | Nümunə |
|---|---|---|
| **Admin paneli** (desktop + mobile) | ~40 | `admin.spec.ts`, `admin-level.spec.ts`, `security.spec.ts` (təhlükə paneli), `ux-phase.spec.ts` (Admin Geri al), `responsive-audit.spec.ts` (admin/teams) |
| **Mobile layihəsi** (viewport) | ~40 | `comments.spec.ts`, `messages.spec.ts`, `presence.spec.ts` — **eyni testlər desktop-da KEÇİR** |

**Baseline sübutu:** dəyişikliklər `git stash` ilə kənara qoyulub təmiz `HEAD`
üzərində `admin.spec --project=desktop` işlədildi →
**eyni 12 test, eyni sətirlərdə sındı** (20, 71, 98, 115, 140, 150, 180, 196,
207, 316×3). Yəni sınıqlar **bu task-dan əvvəl mövcud idi**.

**Kök səbəb (admin qrupu):** `expect(locator('#adminUserList .admin-user-row').first()).toBeVisible()`
→ *"locator resolved to `<div class="admin-user-row">` … unexpected value `hidden`"*.
Sətir DOM-da **var**, lakin CSS ilə gizlidir — admin panelinin layout qüsurudur,
avtorizasiya və ya data problemi deyil.

**Mobile qrupu:** Task 4 §5.2-dən bəri bilinən paylaşılan sessiya/viewport qüsuru
(`docs/`-da qeyd olunub) — desktop-da eyni testlər keçir.

⚠ **Task 6 baseline-i (265/75) ilə birbaşa müqayisə mümkün deyil:** dəst o vaxtdan
bəri ≈340 → **544 testə** böyüyüb (mobile layihəsi + Task 9 responsive auditi +
bu task-ın 18 testi). Ona görə hökm mütləq saya deyil, **baseline təkrar
qaçışına** əsaslanır.

→ **Meyar 25 (dəst sınmır): ✅** — bu düzəliş **bir dənə də yeni sınıq yaratmadı**;
`@files` dəsti tam yaşıldır və `comments`/`messages`/`teams`/`realtime` desktop
dəstləri keçir.

⚠ **Ayrıca öhdəlik:** 80 sınıq test bu task-ın əhatəsindən kənardır, lakin
**bağlanmalıdır** — bax §9.

---

## 7. Task 8 sərhədi (7.9)

```
❌ SƏHV: Task 8 istifadəçiyə `/files/archive/...` verir
   → canReadKey-i zəiflətmək tələb olunar → C-1 qismən yenidən açılar

✅ DÜZGÜN: Task 8 ayrıca API endpoint-i qurur
   GET /api/rooms/:id/messages?before=<ts>
   → endpoint öz avtorizasiyasını edir (otaq üzvlüyü / DM iştirakçılığı)
   → R2-dən SERVER TƏRƏFDƏ oxuyur (worker/archive.ts → readArchive)
   → JSON qaytarır, R2 açarını client-ə HEÇ VAXT vermir
```

**Bu qayda iki yerdə yazılıb:**
1. `worker/files-auth.ts` — fayl başlığındakı şərh bloku (kodu oxuyan görsün).
2. Bu hesabat § 7 (planlaşdırma sənədi).

`archive/` bu task-da `isAdmin()` ilə bağlandı; Task 8 **ona toxunmamalıdır**.

---

## 8. Aşkarlanan yeni risklər

### 1. 🟠 `photo_url` ikiqat prefiks qüsuru (mövcud, bu task-dan əvvəl)

`users.photo_url` **`/files/` prefiksi ilə** saxlanılır (istehsalda təsdiqləndi:
`/files/avatars/vbp…/…jpg`; `routes.ts:474` də bu formanı fərz edir). Lakin üç yer
onun üstünə `fileUrl()` tətbiq edir:

| Yer | Nəticə |
|---|---|
| `worker/og.ts:98,110` | `{origin}/files//files/avatars/…` → OG kartında avatar **görünmür** |
| `worker/seo.ts:247` | JSON-LD `image` **yanlış URL** |
| `worker/routes.ts:1618` | Publik profil `photoURL` **sınıq** |

`mapUser` (`util.ts:200`) isə xam dəyəri qaytarır — **düzgün** olan budur.
Bu qüsur düzəlişdən əvvəl də mövcud idi; sərtləşdirilmiş `isSafeImageURL` indi
sınıq şəkli göstərmək əvəzinə sadəcə render etmir (daha yaxşı davranış).
→ **Ayrıca kiçik düzəliş** (Task 10 və ya sərbəst commit).

### 2. 🟠 OG şəkilləri üçün publik avatar yolu yoxdur

Sosial preview botları (Facebook, Twitter, Slack) giriş etmir; `og.ts` avatarı
`/files/avatars/…` üzərindən çəkir və **401** alır. Yəni OG kartlarında avatar
heç vaxt görünməyib. Düzgün həll: OG render-i üçün R2-dən **server tərəfdə**
oxumaq (binding ilə, HTTP-siz) və ya `data:` URI kimi yerləşdirmək. → **Task 10**.

### 3. 🟡 `deleteTeam` soft-delete-dir

`status='deleted'` qoyulur, `team_members` sətirləri **qalır** → silinmiş komandanın
faylları hələ də keçmiş üzvlərə açıqdır. Bu, mövcud davranışdır (digər komanda
endpoint-ləri də eyni şəkildə işləyir) və üzvlük keşi onu **pisləşdirmir**
(keş D1 ilə eyni cavabı verir). → Siyasət qərarı tələb edir, Task 10.

### 4. 🟡 Rol dəyişikliyi keşi invalidasiya etmir — **hazırda düzgündür**

Keş yalnız *"aktiv üzvdürmü"* boolean-ını saxlayır; rol dəyişikliyi bunu dəyişmir.
⚠ **Task 10-da kateqoriya səviyyəli icazələr gələndə** (`teams/{id}/documents/` vs
`public/`) keş açarı rolu da əhatə etməli və `updateMemberRole`/`deleteRole`
yollarında invalidasiya olunmalıdır. Bu, gələcək tələ kimi qeyd edilir.

### 5. 🟡 `file_access_denied` hadisələri üçün siqnal (alert) yoxdur

Jurnal yazılır, lakin M-1-dəki kimi **yalnız müşahidə rejimidir**. Bir uid-dən
dəqiqədə onlarla rədd = açar sadalama cəhdidir və avtomatik reaksiya yoxdur.
→ M-1 log→bloklama keçidi ilə birlikdə həll edilməlidir.

### 6. 🟢 `asset` rate-limit səbəti rədd cavablarını da sayır

Hücumçu 1200 sorğu/dəq həddində açar sadalaya bilər, lakin bütün cavablar eyni
boş 404-dür (mövcud/yox fərqi yoxdur), yəni sadalama **informasiya vermir**.
Task 4 §7/4-dəki qayda təsdiqləndi: *rate limit avtorizasiyanın əvəzi deyil* —
indi avtorizasiya da var.

---

## 9. Açıq qalan öhdəliklər

- [ ] 🔴 **Meyar 17** — deploy-dan sonra `cf-cache-status` yoxlaması (§5)
- [ ] 🔴 **Cloudflare Cache Rules** — `/files/*` üçün qayda varmı? Dashboard yoxlaması (§5)
- [ ] 🔴 `d1 migrations apply --remote` — **deploy-dan ƏVVƏL** (`0028`); unudulsa
      `sharesThreadWith` indekssiz tam cədvəl skanı edər
- [ ] 🔴 C-3 arxiv oxu yolu + `ARCHIVE_HOT_DAYS` → `"90"` → **Task 8** (sərhəd: §7)
- [ ] 🔴 H-3 atomik limiter, H-5 XP, H-6 WS re-auth, M-4 RoomDO → **Task 9**
- [ ] 🔴 **E2E dəstində 80 mövcud sınıq test** (§6.1) — bu task-dan DEYİL, lakin
      açıq qalır: (a) admin paneli `.admin-user-row` CSS ilə gizlidir, (b) mobile
      layihəsində paylaşılan sessiya qüsuru. Yaşıl baseline olmadan növbəti
      task-ların reqressiyası görünməz qalır → **Task 9/10-dan əvvəl bağlanmalıdır**
- [ ] 🔴 E2E sessiya refaktoru (Task 6 §9) — bu task izolə kontekst naxışını işlətdi
- [ ] 🟠 `photo_url` ikiqat prefiks düzəlişi (§8/1)
- [ ] 🟠 OG üçün publik avatar yolu (§8/2)
- [ ] 🟠 Task 10-da incə fayl icazələri gələndə keş açarına rol əlavə et (§8/4)
- [ ] 🟠 M-1 log→bloklama keçidi + `file_access_denied` siqnalı (§8/5)
- [ ] 🟠 `js/` tip yoxlaması (Task 6 §8/1) → **Task 10**
- [ ] 🟠 R2 access log / Logpush aktivləşdirilməsi (§3.c)
- [ ] 🟡 `deleteTeam` soft-delete siyasəti (§8/3)

---

## 10. Geri qaytarma planı

| Bənd | Fayl | Revert təsiri |
|---|---|---|
| **7.2 `canReadKey`** | `worker/files-auth.ts` + `routes.ts:serveFile` | ⚠⚠ **C-1 TAMAMİLƏ yenidən açılır** — istənilən giriş etmiş istifadəçi yad komanda sənədini, DM əlavəsini və arxiv dump-larını oxuyur |
| **7.4 keş siyasəti** | `CACHE_HEADER` + `serveFile` başlıqları | ⚠⚠ Avtorizasiya **edge səviyyəsində keçilir** — 7.2 saxlanılsa belə mənasızlaşır |
| 7.3 üzvlük keşi | `isTeamMemberCached` | Funksionallıq qalır, hər `teams/` sorğusu D1-ə gedir (gecikmə + xərc) |
| 7.3 keş invalidasiyası | `member.service.ts`, `invite.service.ts` | Çıxarılan üzv **60 s** əlavə çıxış saxlayır (meyar 10 sınır) |
| 7.5 `assertOwnedImageRefs` | `routes.ts` `createPost`/`patchPost` | Zəncirin 1-ci halqası açılır; `canReadKey` hələ oxunu bağlayır → feed-də **sınıq şəkil** |
| 7.6 `sanitizeMsg(b, senderUid)` | `msg.ts` + 3 çağırış yeri | Başqasının `fileKey`-i mesaja bağlana bilər |
| 7.7 frontend | `js/util.js`, `feed.js`, `richmsg.js` | Dərinlikdə müdafiə itir; server qapısı qalır |
| Migration `0028` | — | ⚠ **Revert ETMƏ** — indeks silinsə `sharesThreadWith` tam cədvəl skanı edər |

**Tam revert əmri:** `git revert <commit>` (tək commit-dir).
⚠ Revert edilərsə C-1 Critical statusuna qayıdır və audit hesabatı yenilənməlidir.
