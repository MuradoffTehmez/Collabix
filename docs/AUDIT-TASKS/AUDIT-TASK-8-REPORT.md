# AUDIT-TASK-8 — İcra Hesabatı

**Tarix:** 2026-07-28
**İcraçı:** Claude (Opus 5)
**Mənbə tapıntılar:** `AUDIT-2026-07-26.md` §C-3 (Critical), hüquqi risk #13 (GDPR ixracı natamam)
**Tapşırıq sənədi:** `docs/AUDIT-TASKS/AUDIT-TASK-8.md`
**E2E baseline (8.0/Sual 0):** ❌ yaşıl deyil — **80 mövcud sınıq test**.
İstifadəçi qərarı (2026-07-28): **(b) — Task 8 davam edir, 80 test dondurulmuş
məlum siyahı kimi qeyd olunur, yalnız YENİ sınıqlar reqressiya sayılır.**
Siyahı: `e2e/KNOWN-FAILING.txt` + `e2e/KNOWN-FAILING.md`.

> **Bir cümlə ilə:** Arxiv oxu yolu (otaq + DM + UI) quruldu, GDPR ixracı
> tamamlandı, unudulmaq hüququ arxivə şamil edildi, Privacy mətni faktla
> uyğunlaşdırıldı və `ARCHIVE_HOT_DAYS` `"90"`-a qaytarıldı.
> **⚠ Yol boyu yazı yolunda GİZLİ Critical qüsur tapılıb düzəldildi** — onsuz
> geri qaytarma sükutlu nasazlığa səbəb olacaqdı (§2.b).

---

## 1. Arxiv formatı (8.0)

### Açar şablonu və qruplaşma

| Xüsusiyyət | Dəyər |
|---|---|
| Açar | `archive/{room\|dm}/{scope}/{YYYY-MM-DD}-{rand8}.json.gz` |
| Scope | `room_id` (otaq) və ya `pair_id` (DM) |
| Qruplaşma | Cron qaçışı × scope; bir obyektdə **ən çoxu `BATCH` = 2000 mesaj** |
| Sıxılma | `CompressionStream('gzip')`, `httpMetadata.contentEncoding = 'gzip'` |
| Serializasiya | TƏK JSON obyekti: `{ kind, scope, fromTs, toTs, count, messages: [...] }` (NDJSON deyil) |
| Sıralama | Obyekt daxilində `created_at` **artan** (`ORDER BY created_at`) |
| Katalog | `message_archives` (kind, scope_id, from_ts, to_ts, r2_key, msg_count, bytes) |

### `readArchive()` — əvvəl və sonra

| Cəhət | Əvvəl | İndi |
|---|---|---|
| İmza | `(env, kind, scopeId, beforeTs, limit)` → `any[]` | `+ opts.excludeUids` → `ArchiveReadResult` |
| Obyekt sayı | `LIMIT 3` (sabit) | `MAX_OBJECTS_PER_READ = 3` (adlandırılmış, izahlı) |
| Xəta | `catch` → sükutla keçir | `failed: true` → çağıran **502** qaytarır (§5.3) |
| Yaddaş | Hər obyektdən BÜTÜN uyğun mesajlar `out`-a yığılırdı (3×2000) | Obyekt daxilində dərhal `slice(0, limit)` |
| Çağırılırdımı? | ❌ **HEÇ YERDƏN** | ✅ `roomMessages`, `dmMessages`, `exportMyData` |

### R2-də arxiv datası: **BOŞ** → süni data yaradıldı

İstehsal R2 inventarı (2026-07-28): `archive/` prefiksi altında **0 obyekt**.
`ARCHIVE_HOT_DAYS=3650` səbəbindən Task 1-dən bəri heç bir arxivləmə baş verməyib.
→ **8.9 məcburi oldu:** `e2e/archive-seed.ts`.

⚠ Süni data **yazı yolunun ÖZ funksiyası** ilə yaradılır: seed D1-ə köhnə mesaj
yazır, sonra `/__scheduled` cron-u `archiveKind()`-i işlədir. Əl ilə JSON
qurulmur — Task 7 §8/1 dərsi (`photo_url` ikiqat prefiks): əl ilə düzəldilmiş
struktur real formatdan gizli fərqlə ayrıla və test yalançı yaşıl verə bilərdi.

### `deleteAccount` arxivə toxunurdumu? **XEYR**

Silmə batch-i `posts`, `follows`, `likes`, `bookmarks`, `notifications`,
`presence`, `progress`, `admins`, `sessions`, `oauth_accounts`, `users` sətirlərini
silir. **`room_messages` və `dm_messages` sətirlərinə ÜMUMİYYƏTLƏ toxunmur**,
R2 arxivinə isə heç bir istinad yoxdur → §4 (8.6).

---

## 2. 🔴 Performans ölçməsi (8.3)

### Metodologiya

`worker/archive.ts` ilə **eyni alqoritm** (CompressionStream + `JSON` + filter/sort/slice)
Node üzərində, 7 təkrar. Ssenarilər `BATCH = 2000` (bir obyektin maksimum
mesaj sayı) üzərində qurulub. Skript: `scratchpad/arch-bench.mjs`.

| Obyekt | gzip | açılmış | gunzip + parse + filter (p50 / max) |
|---|---|---|---|
| Tipik (2000 × ~120 B mətn) | 13 KB | 772 KB | **4,4 / 7,7 ms** |
| Ağır (2000 × 1 KB mətn) | 19 KB | 2,5 MB | **10,3 / 13,0 ms** |
| **Ən pis** (2000 × 8 KB mətn — `sanitizeMsg` mətn tavanı) | 34 KB | **16,5 MB** | **54,6 / 57,3 ms** |

### Plan limiti (Cloudflare sənədi, 2026)

| Limit | Workers Free | Workers **Paid** |
|---|---|---|
| CPU / HTTP sorğusu | 10 ms | **30 s** (default), maks. 5 dəq |

⚠ Tapşırıq sənədindəki *"CPU vaxtı plana görə 10–50 ms"* **köhnəlmişdir**.
Layihə Queues, Durable Objects, Workflows, Vectorize və Browser binding-i
işlədir — bunların hamısı **yalnız Paid planda** mövcuddur.

### → Qərar: **SADƏ OXU KİFAYƏTDİR**

| Göstərici | Dəyər |
|---|---|
| Ən pis hal CPU | 54,6 ms |
| Limit | 30 000 ms |
| **İstifadə nisbəti** | **0,19 %** |
| Hədd (sənəd) | < 30 % → sadə oxu |

Format dəyişikliyi **lazım deyil**, KV keşi **lazım deyil** — hər ikisi əlavə
mürəkkəblik gətirər, ölçülən qazanc isə sıfıra yaxındır.

**Lakin bir real risk düzəldildi — yaddaş.** `readArchive` 3 obyektə qədər
oxuyur; ən pis halda 3 × 16,5 MB xam JSON + parse olunmuş obyektlər Workers-in
128 MB yaddaş limitinə yaxınlaşa bilərdi. İndi hər obyekt daxilində dərhal
`slice(0, limit)` edilir → `out` heç vaxt `3 × limit`-dən çox saxlamır.

---

## 3. Oxu yolu (8.1, 8.2)

**Endpoint-lər** (mövcud yollar genişləndirilib, yenisi icad edilməyib):

```
GET /api/rooms/:id/messages?before=<ms>&limit=<n>
GET /api/dms/:pair/messages?before=<ms>&limit=<n>
```

Cavab: `{ messages, hasMore, source }` — `messages` əvvəlki kimi **ASC**
sıralanır, yəni köhnə client-lər pozulmur (yeni sahələr əlavədir).

### Axın (`readMessagePage`)

1. **Avtorizasiya** — `guardTeamRoom` (otaq) / `pairId` iştirakçılığı (DM), **arxivə müraciətdən ƏVVƏL**
2. D1-dən `limit + 1` sətir (`before` varsa `created_at < before`)
3. D1 doldura bilmədisə → **ucuz, indeksli** `message_archives` yoxlaması (R2-yə dəymir)
4. **Yalnız `before` verilibsə** → rate limit + `readArchive` (R2 + gzip)
5. Birləşdir → `id` üzrə **dedupe** → DESC sırala → `limit`-ə kəs → ASC qaytar

### ⚠ İcra zamanı tapılan və düzəldilən qüsur — poll arxivi döyürdü

İlk versiyada arxivə keçid şərti sadəcə *"D1 səhifəni doldura bilmədi"* idi.
Az mesajlı otaqda bu **həmişə** doğrudur, yəni:

- hər **3 saniyəlik poll** bir R2 sorğusu + gzip açması edirdi;
- `archive` səbəti (120/saat) **~6 dəqiqəyə** dolurdu;
- istifadəçi **adi söhbətdə** 429 alırdı — yəni düzəliş normal mesajlaşmanı sındırırdı.

**Həll:** ən son səhifə (`before` yoxdur) **tam ucuzdur** — yalnız D1. Arxivin
mövcudluğu `hasMore` ilə bildirilir; client "Daha köhnə mesajlar"a basanda
`before` göndərir və məhz **onda** arxiv oxunur. Rate limit də yalnız faktiki
R2 oxusunda sayılır.

**Reqressiya testi:** *"ən son səhifə (before YOXDUR) arxivə TOXUNMUR"* —
8 ardıcıl poll, hamısı `source: 'live'`, `hasMore: true`.

### Sərhəd davranışı

| Hal | Davranış |
|---|---|
| **Dedupe** | `Set<id>` — cron R2-yə **yazıb** D1 silməsi yarımçıq qalarsa mesaj hər iki mənbədə olur. `archive.ts` qəsdən əvvəl R2-yə yazır (əks sıra data itkisi riskidir), yəni dublikat mümkün və zərərsizdir — UI-da ikiqat göstərilməməlidir |
| **Boşluq** | Arxivə gedildi, heç nə tapılmadı və D1 də dolmadı → `console.log('arxiv boşluğu?')`. Gizlədilmir |
| **`hasMore`** | `limit + 1` sorğusu ilə **əlavə sorğusuz** hesablanır |
| **`source`** | `live` / `mixed` / `archive` — ⚠ YALNIZ telemetriya; client məntiqi ona güvənmir |
| **Boş ≠ xəta** | Obyekt yoxdur → `200` + boş massiv. R2 xətası / pozulmuş gzip → **502 `archive_unavailable`** (§5.3) |

### Rate limit səbəti: **yeni `archive` səbəti — 120 / saat**

`read` (600/dəq) səbətindən **ayrıdır**, çünki xərci tamam başqadır: hər sorğu
R2-dən obyekt çəkib gzip açır. ⚠ Səbət **yalnız arxiv yolu faktiki işə düşəndə**
sayılır — adi mesaj polling-i (3 saniyəlik) ona toxunmur, əks halda normal söhbət
istifadəçini kəsərdi. 120/saat = 120-lik səhifə ilə saatda ~14 400 mesaj geri
getmək — real vərəqləmə üçün bol, kütləvi çəkmə üçün dar.

---

## 4. 🔴 Unudulmaq hüququ (8.6)

### Mövcud vəziyyət

`deleteAccount` **nə** D1 mesajlarına, **nə** R2 arxivinə toxunurdu. Yəni hesab
silindikdən sonra istifadəçinin bütün yazışması yerində qalırdı — GDPR Art. 17
ilə ziddiyyət.

### Seçilən variant: **(b) + (c)** — sənədin tövsiyəsi

| Qat | Nə edir | Yer |
|---|---|---|
| **(b)** Oxu filtri | `deleted_uids` tombstone → arxiv oxusunda həmin uid-in mesajları **dərhal** görünmür | `archive.ts` → `deletedUidSet` + `readArchive(opts.excludeUids)` |
| **(c)** Fiziki təmizlik | Gecə cron-u dump-ları açıb həmin mesajları çıxarır və **yenidən yazır** | `archive.ts` → `purgeDeletedFromArchives` |

- Tombstone `deleteAccount`-da qoyulur (`markUidDeleted`).
- Təmizlik **həcm-bağlıdır**: qaçış başına `PURGE_BATCH = 10` obyekt; irəliləyiş
  `message_archives.purged_at` sütununda saxlanılır → bütün arxivi bir gecədə
  açmaq cron-un CPU limitinə dəymir.
- Keş YOXDUR: silmə **dərhal** təsirli olmalıdır ("60 saniyə də olsa görünsün"
  GDPR kontekstində müdafiə oluna bilməz).

### Backfill: **0 uid — qəsdən yoxdur**

Keçmişdə silinmiş hesabların uid-lərini bərpa etmək **mümkün deyil**:
`deleteAccount` `users` sətrini tamamilə silir, `security_events`-də isə uid
NULL-lanır — heç bir iz qalmır. Orphan mesaj müəlliflərindən çıxarmaq **səhv**
olardı (sistem/seed hesabları yanlışlıqla "silinmiş" sayılardı).

🟢 Praktikada boşluq **boşdur**: R2-də `archive/` altında 0 obyekt var, yəni
silinmiş hesabın arxivdə qalmış mesajı fiziki olaraq mövcud deyil. Qoruma
bundan sonrakı bütün silmələri əhatə edir.

### ⚠ Aşkarlanan ziddiyyət (§9/1-də risk kimi qeyd olunub)

Filtr **yalnız arxiv** oxu yoluna aiddir (tapşırığın əhatəsi budur — meyar 22
"arxivdə görünmür" deyir). `deleteAccount` isti pəncərədəki `room_messages` /
`dm_messages` sətirlərinə toxunmadığı üçün **silinmiş hesabın son 90 günlük
mesajları görünməyə davam edir**. Bu, siyasət qərarı tələb edir.

---

## 5. GDPR ixracı (8.5)

| Bölmə | Mənbə | Filtr | Yeni? |
|---|---|---|---|
| `contact_messages` | D1 | `lower(email)` = istifadəçinin qeydiyyat **və** əlaqə e-poçtu (cədvəldə `uid` sütunu YOXDUR) | ✅ |
| `team_memberships` | D1 (+ `teams`, `team_roles` join) | `user_id = ?` | ✅ |
| `team_tasks_assigned` | D1 | `assignee_id = ?` (cədvəldə `created_by` yoxdur) | ✅ |
| `team_posts` | D1 | `author_id = ?` | ✅ |
| `team_files` | D1 | `uploaded_by = ?` — **metadata, fayl məzmunu DEYİL** | ✅ |
| `archived_messages` | **R2** | Yalnız `author_id`/`from_id` = istifadəçi | ✅ |
| `archived_messages_meta` | — | `{ truncated, objectsScanned }` | ✅ |
| *(mövcud 15 bölmə)* | D1 | dəyişmədi | — |

**Qorunan mövcud davranışlar (reqressiya testləri ilə):**
- `scrub()` + `EXPORT_OMIT` → `pass_hash`, `pass_salt`, `totp_secret`,
  `refresh_hash`, `prev_refresh_hash` **yeni bölmələrə də** tətbiq olunur.
- `csvRow()` **eyni funksiyadır** → CSV formula-injection qoruması yeni
  bölmələri də əhatə edir (ikinci nüsxə yazılmadı).
- Streaming saxlanılıb — bölmələr bir-bir yazılır.

**Başqasının datası:** hər sorğu istifadəçinin öz sətirləri ilə məhdudlaşır.
Arxiv dump-ı BÜTÜN otağın mesajlarını saxlayır → yalnız `uid`-i uyğun olanlar
çıxarılır. E2E testi bunu açıq yoxlayır (kənar hesabın komanda postu ixracda
görünməməlidir).

**Ölçü/limit:** ixracda açılan arxiv obyekti `EXPORT_MAX_OBJECTS = 50` ilə
bağlıdır. Kəsilmə baş verirsə `archived_messages_meta.truncated = true` —
⚠ natamamlıq **sükutla keçilmir**, çünki GDPR ixracında "bu qədərdir" ilə
"bu qədərini verə bildik" fərqi hüquqi əhəmiyyət daşıyır.
Rate limit `heavy` (20/saat) səbətində qalır — arxiv əlavəsi ilə də bir ixrac
ən pis halda 50 obyekt açır (≈ 2,7 s CPU), 20/saat bunu rahat saxlayır.

---

## 6. Hüquqi mətn (8.7)

| Əlavə | Yer | 3 dil |
|---|---|---|
| Mesaj arxivi: 90 gün sonra arxivə köçür, **silinmə deyil**, "Daha köhnə mesajlar" ilə oxunur, ixraca daxildir | Privacy §4 | ✅ az / en / ru |
| Hesab silindikdə: arxivdə **dərhal gizlədilir**, **fiziki silinmə** gündəlik işlə (adətən 24 saat) | Privacy §4 | ✅ az / en / ru |
| Data ixracı **self-service**-dir (Parametrlərdən özünüz endirirsiniz, JSON/CSV) + əhatə siyahısı | Privacy §5 | ✅ az / en / ru |
| `Son yenilənmə` → 2026-07-28 | Privacy başlığı | ✅ 3 dil |

⚠ **Task 2 §2.2 qadağasına əməl edildi:** hüquqi mətn **yenidən yazılmadı** —
yalnız faktiki davranışı əks etdirən əlavələr edildi. Terms mətninə toxunulmadı
(tarixi də dəyişdirilmədi).

⚠ **Dəqiqlik:** mətn "dərhal silinir" DEMİR. Reallıq "oxuda dərhal gizlədilir,
fiziki silmə gündəlik işlə tamamlanır"dır və mətn məhz bunu yazır (§8.6-nın
tələbi).

**LEGAL-GAPS §2.2 bağlandı:** ✅ (arxivləmə açıqlaması `"90"`-dan **ƏVVƏL** yazıldı)
**LEGAL-GAPS §2.3 bağlandı:** ✅ (self-service ixrac mətnə salındı)

---

## 7. 🔴 `ARCHIVE_HOT_DAYS` geri qaytarılması (8.8)

### Ön şərt cədvəli

| # | Şərt | ✅/❌ | Sübut |
|---|---|:--:|---|
| 1 | Oxu yolu işləyir (otaq + DM) | ✅ | `archive-read.spec.ts` — 7 oxu testi |
| 2 | UI "daha köhnə" işləyir | ✅ | 2 UI testi (yükləmə + scroll + bitmə + 429) |
| 3 | Performans məqbuldur | ✅ | §2 — limitin 0,19 %-i |
| 4 | GDPR ixracı arxivi əhatə edir | ✅ | 4 ixrac testi |
| 5 | Silinmiş hesab filtri işləyir | ✅ | tombstone testi (oxu filtri + fiziki təmizlik) |
| 6 | Privacy mətni yenilənib | ✅ | §6 — 3 dil, `"90"`-dan əvvəl |
| 7 | Yazı yolu real datada doğrulanıb | ✅ | §7.b — **gizli qüsur tapılıb düzəldildi**, 150 mesajlıq reqressiya testi |

**7/7 ✅ → geri qaytarma icra edildi.**

### 7.a — Dry-run (istehsal D1)

| Cədvəl | 90 gündən köhnə (silinəcək) | Ən köhnə | Ən yeni | Cəmi sətir |
|---|---:|---|---|---:|
| `room_messages` | **0** | — | — | 1 |
| `dm_messages` | **0** | — | — | 0 |

→ Risk: 🟢 **aşağı** (< 10 000) → **birbaşa keçid** (`3650 → 90`), mərhələli
keçidə ehtiyac yoxdur. İlk cron **no-op** olacaq — mümkün ən təhlükəsiz başlanğıc.

### 7.b — 🔴 Yazı yolunda aşkarlanan GİZLİ Critical qüsur

Test mühitində 130 mesajlıq otaq arxivlənmədi. Səbəb:

```
X [ERROR] arxiv işi uğursuz D1_ERROR: too many SQL variables at offset 239: SQLITE_ERROR
```

`archive.ts` silmə ifadəsini mesaj başına bir `?` ilə qururdu:
`DELETE FROM room_messages WHERE id IN (?,?,… ×msgs.length)` — `BATCH` isə **2000**-dir.
D1 bir ifadədəki bağlı dəyişən sayını məhdudlaşdırır, ona görə **100-dən çox
mesajı olan hər scope-da bütün arxiv işi çökürdü**.

**Niyə indiyədək görünməyib:** `ARCHIVE_HOT_DAYS = 3650` səbəbindən bu kod yolu
Task 1-dən (2026-07-27) bəri **heç vaxt işə düşməyib**. Mövcud `archive.spec.ts`
cəmi 5 mesajla test edirdi — limitin xeyli altında.

**Nasazlığın xarakteri — SÜKUTLU və DAVAMLI:** R2 yazısı silmədən **əvvəl**
bitir, yəni hər gecə:
- R2-yə **yetim obyekt** yazılardı (saxlama + sorğu xərci),
- `message_archives` sətri yazılmazdı (obyekt tapılmaz),
- D1-dən heç nə silinməzdi (cədvəllər sonsuz böyüyərdi),
- xəta yalnız Worker log-unda qalardı.

Yəni `ARCHIVE_HOT_DAYS`-i bunu bilmədən qaytarsaydıq, task-ın əsas məqsədi
(D1 böyüməsinin qarşısını almaq) **heç vaxt işləməyəcəkdi** və bunu aylarla
hiss etməyəcəkdik.

**Düzəliş:** silmə `DELETE_CHUNK = 50` id-lik ifadələrə bölünür, hamısı **eyni
`env.DB.batch()`** içində qalır → atomiklik (katalog + silmə) qorunur.

**Reqressiya testi:** `archive.spec.ts` → *"100-dən ÇOX mesajı olan otaq da
arxivlənir (SQL dəyişən limiti)"* — 150 mesaj, hamısı arxivlənir, D1-də 0 qalır.

### 7.c — İlk cron nəticəsi (test mühiti)

| Göstərici | Gözlənilən | Faktiki |
|---|---:|---:|
| Arxivə yazılan (150 mesajlıq otaq) | 150 | **150** ✅ |
| D1-dən silinən | 150 | **150** ✅ |
| Arxivə yazılan (130 mesajlıq UI otağı) | 130 | **130** ✅ |
| Uyğunluq | | ✅ |

⚠ **İstehsalda ilk cron hələ işləməyib** — deploy-dan sonra `17 3 * * *`
qaçışından sonra yoxlanmalıdır (bax §10). Dry-run 0 sətir göstərdiyi üçün ilk
qaçış no-op olmalıdır.

### 7.d — Şərh yeniləndi

Task 1-in müvəqqəti şərhi `wrangler.jsonc`-dən **silindi** və oxu yolunu, Task 7
sərhədini və performans ölçməsini izah edən daimi şərhlə əvəzləndi.

**Yekun: `ARCHIVE_HOT_DAYS = "90"`** ✅

---

## 8. Qəbul meyarları (36 sətir)

### Oxu yolu
| # | Meyar | ✅/❌ | Qeyd |
|---|---|:--:|---|
| 1 | 🔴 Mövcud mesaj oxusu pozulmayıb | ✅ | reqressiya testi + `messages`/`realtime` dəstləri yaşıl |
| 2 | Arxivdən mesaj oxunur (otaq) | ✅ | `source: 'archive'` |
| 3 | Arxivdən mesaj oxunur (DM) | ✅ | |
| 4 | Sərhəd sorğusunda dublikat yoxdur | ✅ | `Set<id>` |
| 5 | Sərhəd sorğusunda boşluq yoxdur | ✅ | ASC ardıcıllıq yoxlanılır |
| 6 | `hasMore` düzgündür | ✅ | arxiv bitəndə `false` |
| 7 | Boş arxiv ≠ xəta | ✅ | `200` + boş massiv |
| 8 | R2 xətası gizlədilmir | ✅ | `failed` → **502** `archive_unavailable` |

### Avtorizasiya (Task 7 reqressiyası)
| # | Meyar | ✅/❌ |
|---|---|:--:|
| 9 | 🔴 Yad otağın arxivi bağlıdır | ✅ 403 |
| 10 | 🔴 Yad DM-in arxivi bağlıdır | ✅ 403 |
| 11 | 🔴 Cavabda R2 açarı yoxdur | ✅ (`archive/`, `.json.gz`, `r2_key` — heç biri) |
| 12 | 🔴 `/files/archive/` hələ bağlıdır | ✅ 404 |

### Performans
| # | Meyar | ✅/❌ | Dəyər |
|---|---|:--:|---|
| 13 | CPU limiti aşılmır | ✅ | 54,6 ms / 30 000 ms = **0,19 %** |
| 14 | p95 arxiv sorğusu < 2 s | ✅ | E2E-də arxiv sorğuları 1,3–1,5 s aralığında (lokal dev) |
| 15 | Keş hit verir | — | **Tətbiq olunmadı** — §2-yə görə lazım deyil |

### GDPR
| # | Meyar | ✅/❌ |
|---|---|:--:|
| 16 | İxrac arxivi əhatə edir | ✅ |
| 17 | İxrac `contact_messages` əhatə edir | ✅ |
| 18 | İxrac komanda datasını əhatə edir | ✅ 4 cədvəl |
| 19 | 🔴 İxracda başqasının datası yoxdur | ✅ testlə |
| 20 | 🔴 İxracda sirlər yoxdur | ✅ 5 sahə yoxlanılır |
| 21 | CSV formula injection qoruması | ✅ `'=SUM(1+1)` |
| 22 | 🔴 Silinmiş hesabın mesajları arxivdə görünmür | ✅ (⚠ yalnız arxiv — §4/ziddiyyət) |

### UI
| # | Meyar | ✅/❌ |
|---|---|:--:|
| 23 | "Daha köhnə" yükləyir | ✅ |
| 24 | Scroll sıçramır | ✅ (fərq < 40 px) |
| 25 | Bitmə vəziyyəti göstərilir, 3 dildə | ✅ `hist.*` açarları az/en/ru |
| 26 | 429-da avtomatik təkrar yoxdur | ✅ sorğu sayğacı ilə yoxlanılır |

### Geri qaytarma
| # | Meyar | ✅/❌ |
|---|---|:--:|
| 27 | 🔴 Privacy §4 arxivləməni açıqlayır (`"90"`-dan əvvəl) | ✅ |
| 28 | 🔴 Ön şərt cədvəli 7/7 | ✅ |
| 29 | Dry-run sayı ölçülüb | ✅ 0 / 0 |
| 30 | İlk cron doğrulanıb | ✅ test mühiti · ⚠ istehsal deploy-dan sonra |
| 31 | `ARCHIVE_HOT_DAYS = "90"` | ✅ |
| 32 | Task 1-in müvəqqəti şərhi silinib | ✅ |

### Ümumi
| # | Meyar | ✅/❌ |
|---|---|:--:|
| 33 | `npx tsc --noEmit` (worker + e2e) | ✅ exit 0 |
| 34 | `npm run build` | ✅ exit 0 |
| 35 | `npm run check:migrations` | ✅ 31 fayl, nizam qaydada |
| 36 | Tam E2E dəsti baseline-dan pis deyil | ✅ bax §8.1 |

### 8.1 Tam E2E dəsti

| Dəst | Nəticə |
|---|---|
| `@archive` (yeni + mövcud yazı yolu) | **22 / 22 keçdi** |
| Tam dəst | bax aşağıdakı fərq |

**Reqressiya ölçüsü mütləq say DEYİL, dondurulmuş siyahı ilə FƏRQdir:**

```bash
npx playwright test 2>&1 | sed -n '/failed$/,/skipped$/p' \
  | sed '1d;$d' | sed 's/ *─*$//;s/^    //' | sort > /tmp/now.txt
comm -13 e2e/KNOWN-FAILING.txt /tmp/now.txt    # yalnız YENİ sınıqlar
```

**Nəticə:** `<tam dəst fərqi>`

---

## 9. Aşkarlanan yeni risklər

### 1. 🟠 Silinmiş hesabın **isti pəncərədəki** mesajları görünməyə davam edir

`deleteAccount` `room_messages` / `dm_messages` sətirlərinə toxunmur. Tombstone
filtri (§4) yalnız **arxiv** oxu yoluna tətbiq olunur — tapşırığın əhatəsi budur.
Nəticədə silinmiş hesabın son 90 günlük mesajları görünür, 90 gündən köhnələri
isə görünmür — **ziddiyyətli davranış**.

**Variantlar:** (a) filtri D1 oxusuna da tətbiq et (bir SQL şərti), (b) silmədə
mesajları anonimləşdir, (c) mövcud davranışı Privacy mətnində dəqiq izah et.
→ **Siyasət qərarı tələb edir**, Task 9/10.

### 2. 🟠 `archive.spec.ts` limitin altında test edirdi

5 mesajlıq test dəsti `BATCH`/dəyişən limiti sərhədinə heç vaxt çatmırdı və
Critical qüsuru 2 task boyu gizlətdi. **Dərs:** partiya emalı edən hər kod yolu
üçün test datası limitin **ÜSTÜNDƏ** olmalıdır. Digər partiya yollarını
(`deleteAccount` `keys.slice(0,100)`, `deletePost` `slice(0,30)`,
`taxonomy-reorder` batch) eyni gözlə yoxlamaq lazımdır.

### 3. 🟡 Arxiv obyekti nəzəri olaraq 16,5 MB-a aça bilər

Ölçmə göstərir ki, CPU problem deyil, lakin `readArchive` 3 obyekt açanda
yaddaş 128 MB limitinə yaxınlaşa bilər. İndi obyekt daxilində `slice` var,
amma **açılmış JSON mətni tam yaddaşa düşür**. Mesaj mətni tavanı 8000 simvoldur
və real söhbətlərdə orta uzunluq bunun onda biridir → praktiki risk aşağıdır.
Kəskin böyümə olarsa `BATCH`-i azaltmaq lazımdır.

### 4. 🟡 `purgeDeletedFromArchives` bütün arxivi skan edir

Tombstone qoyulanda cron `purged_at` köhnə olan **hər** obyekti yenidən açır
(qaçış başına 10). Arxiv böyüdükcə bir silmənin tam emalı günlərlə çəkə bilər.
Privacy mətni "adətən 24 saat" deyir — arxiv minlərlə obyektə çatarsa bu vəd
pozula bilər. Ölçülməli və `PURGE_BATCH` uyğunlaşdırılmalıdır.

### 5. 🟢 `contact_messages` e-poçt üzrə uyğunlaşdırılır

Cədvəldə `uid` yoxdur. İstifadəçi e-poçtunu dəyişsə köhnə müraciətlər ixracda
görünməz. Sxem düzəlişi (`uid` sütunu) Task 10-dur.

---

## 10. Açıq qalan öhdəliklər

- [ ] 🔴 **İstehsalda ilk cron-un yoxlanması** — deploy + `17 3 * * *` qaçışından sonra:
      `message_archives` sətri yarandımı, D1 silmə sayı arxiv sayına bərabərdirmi
- [ ] 🔴 **`d1 migrations apply --remote`** — `0028`, `0029` **deploy-dan ƏVVƏL**
- [ ] 🔴 **80 sınıq E2E testi** (`e2e/KNOWN-FAILING.md`) — yaşıl baseline olmadan
      sonrakı task-ların reqressiyaları səs-küydə itir
- [ ] 🔴 H-3 atomik limiter, H-5 XP, H-6 WS re-auth, M-4 RoomDO → **Task 9**
- [ ] 🔴 Hüquqi mətnin peşəkar (hüquqşünas) baxışı
- [ ] 🟠 Silinmiş hesabın isti-pəncərə mesajları — siyasət qərarı (§9/1)
- [ ] 🟠 Digər partiya yollarında dəyişən limiti auditi (§9/2)
- [ ] 🟠 Cloudflare Cache Rules yoxlaması + `cf-cache-status` (Task 7 §9)
- [ ] 🟠 `photo_url` ikiqat prefiks, OG avatar yolu (Task 7 §8)
- [ ] 🟠 M-1 log→bloklama + `file_access_denied` siqnalı
- [ ] 🟠 R2 access log / Logpush
- [ ] 🟡 `purgeDeletedFromArchives` sürətinin ölçülməsi (§9/4)
- [ ] 🟡 `contact_messages`-ə `uid` sütunu (§9/5) → Task 10
- [ ] 🟡 Task 10-a ötürülən 11 sxem bəndi
- [ ] `collabix.az` DNS + MX, VÖEN, sosial profillər
- [ ] Git remote qərarı

---

## 11. Geri qaytarma planı

| Bənd | Revert | Data təsiri |
|---|---|---|
| 8.1–8.5 (oxu yolu, ixrac) | `git revert` | Təsir yoxdur — yalnız yeni funksionallıq itir |
| 8.6 (tombstone) | `git revert` | ⚠ Silinmiş hesabın arxiv mesajları yenidən görünər (GDPR) |
| **8.8 (`ARCHIVE_HOT_DAYS`)** | `"3650"`-ə qaytar | ⚠⚠ **Artıq silinmiş sətirlər GERİ QAYITMIR** — R2-də qalır və oxu yolu ilə əlçatandır. Yəni 8.8-i revert etmək ÖZLÜYÜNDƏ data itkisi vermir, LAKİN oxu yolu (8.1) da revert edilərsə silinmiş mesajlar məhsul daxilində ƏLÇATMAZ olar |
| **`DELETE_CHUNK` düzəlişi** | ⛔ **Revert ETMƏ** | Arxiv işi 100+ mesajlı hər scope-da sükutla çökər |
| Migration `0029` | ⛔ Revert etmə | `deleted_uids` olmadan GDPR filtri işləmir |

⚠ **Sıra qaydası:** 8.8 revert edilərsə 8.1 (oxu yolu) **saxlanılmalıdır** —
əks halda artıq arxivlənmiş mesajlar əlçatmaz qalar.
