# AUDIT-TASK-5 — İcra Hesabatı

**Tarix:** 2026-07-27
**İcraçı:** Claude (Opus 5) — icra agenti
**Mənbə:** `AUDIT-2026-07-26.md` §H-7 · **Tapşırıq:** `AUDIT-TASK-5.md`
**Bağlanan tapıntılar:** **H-7**, struktur borcu #120 (dublikat nömrələr),
proses borcu #8 (deploy qapısı), Task 1 §5.4, Task 3 §4 + §8/2 + §8/3, Task 4 §8

---

## 0. Miqrasiya inventarı (5.0)

### Sual 1 — faktiki rəqəmlər

| Göstərici | Audit iddiası | Faktiki |
|---|---|---|
| Miqrasiya faylı | 19 | **21** (indi 24) |
| Dublikat nömrə | `0015`, `0016` | ✅ **eyni** |

### Sual 2 — 🔴 hər seed faylının təsnifatı

| Fayl | Cədvəl | Sətirlər | Sinif | Silindi? | Əsaslandırma |
|---|---|---|---|---|---|
| `0002_seed.sql` | rooms, taxonomies, faqs, testimonials | `general` otağı, 23 taksonomiya, 6 FAQ, 3 testimonial | 🟢 **Bootstrap / referans** | ❌ **XEYR** | Onlarsız tətbiq çökür: `general` yoxdursa çat, taksonomiya yoxdursa qeydiyyat sınır |
| `0012_fts_stats_activity.sql` | — | yalnız trigger gövdələrindəki `INSERT` | ⚪ Sxem | ❌ Xeyr | Data deyil, FTS trigger-idir |
| `0015_seed_teams.sql` | users, teams, team_roles, team_members, team_projects, team_tasks, team_chat_rooms | `team_owner_123`, `team_1`, `role_1`, `member_1`, `proj_1`, `task_1`, `tcr_1` | 🔴 **Demo** | ✅ Bəli | Uydurma nümunə ("Alpha Team", "This is a test team") |
| `0016_seed_chat_room.sql` | team_chat_rooms | `tcr_1` → `team_1` | 🔴 Demo | ✅ Bəli | Demo komandanın otağı |
| `0017_seed_chat_room_fk_fix.sql` | rooms | `tcr_1` | 🔴 Demo | ✅ Bəli | 0016-nın FK səhvinin düzəlişi |
| `0018_seed_fix_admin_permissions.sql` | team_roles (UPDATE) | `role_1` → `manage_team` | 🔴 Demo | ✅ Bəli (rol ilə birlikdə) | Demo rolu eskalasiya edirdi |

> **Testimonial-lar niyə silinmədi:** müəllif adları uydurma görünsə də
> (`Aysel M.`, `Rauf H.`), bu, **məhsul məzmunudur** — admin paneli onları
> idarə edir (`/api/admin/testimonials`) və publik səhifədə göstərilir.
> Data bütövlüyü problemi deyil; məzmun qərarı sahibindir.

### Sual 3 — miqrasiya tarixçəsi

Cədvəl: **`d1_migrations`**. Uzaq bazada **21 sətir**, sonuncu
`0019_task11_hardening.sql`. Yəni `0002` və `0015`–`0018` **tətbiq olunub**
sayılır — bu fakt 5.5.a-dakı "yenidən adlandırma" tələsini müəyyən edir.

### Sual 4 — demo sətirlərin faktiki mövcudluğu

| Obyekt | Uzaq (silmədən əvvəl) | Lokal (silmədən əvvəl) |
|---|---|---|
| `users.team_owner_123` | **0** | 1 |
| `teams` (`team_1/2/3`) | **0** | 3 |
| `team_roles` (demo) | **0** | 13 |
| `rooms.tcr_1` | **0** | 1 |
| **`rooms.general`** 🟢 | **0 — YOX!** | **0 — YOX!** |

🔴 **Auditdə olmayan tapıntı** — bax §1.

### Sual 5 — FK qrafiki

`teams(id)` və `users(id)` üzərində `ON DELETE CASCADE` var (8 + 19 istinad).
Lakin **17 cədvəldə FK ÜMUMİYYƏTLƏ YOXDUR** — audit bunu ötəri qeyd etmişdi
("bir sıra sosial cədvəldə FK yox"), faktiki siyahı:

```
admin_logs · admins · bookmarks · comment_likes · contact_messages · dm_threads
follows · message_archives · newsletter · notifications · post_shares · presence
progress · reports · security_events · stats_daily · tasks
```

Bunlar **kaskadla təmizlənmir** → silmə miqrasiyasında AÇIQ sətirlərlə silinir,
əks halda orphan qalardı.

### Sual 6 — E2E infrastrukturu

Testlər demo sətirlərə **birbaşa istinad edirdi** (8 yer): `alpha-team` (slug),
`teamowner_123`, `tcr_1`, `team_1`, `role_1`. Yəni silmə testləri sındıracaqdı
→ §5.4 həmin asılılığı kəsdi.

---

## 1. 🔴 Real data bağlılığı yoxlaması (5.1)

**Ən vacib bənd — silmədən ƏVVƏL icra olundu.**

| Yoxlama | Uzaq | Lokal | Hökm |
|---|---|---|---|
| Demo komandada REAL üzv | 0 | 3 | ✅ lokaldakılar yalnız E2E hesablarıdır (`e2e_main`, `e2e_zara`) |
| Demo layihə / tapşırıq / post / fayl / dəvət | 0 | E2E datası | ✅ |
| Demo otaqda (`tcr_1`) mesaj | 0 | 3 (E2E) | ✅ |
| Saxta istifadəçinin izləyiciləri | 0 | 0 | ✅ |
| Saxta istifadəçinin post / şərh / DM / like / bookmark | 0 | 0 | ✅ |
| Saxta istifadəçi adminmi? | 0 | 0 | ✅ |
| **Saxta istifadəçinin SESSİYALARI** | **0** | **0** | ✅ **hadisə yoxdur** |

**Hökm: TƏMİZ — silməyə davam edildi.**

`sessions = 0` auditin "`pass_hash='hash'` ilə giriş mümkün deyil" nəticəsini
təsdiqləyir: heç kim həmin hesaba girməyib.

### 🔴 Auditdə olmayan tapıntı — BOOTSTRAP datası artıq İTİRİLMİŞDİ

`0002_seed.sql` `general` otağını yaradır və `d1_migrations`-də "tətbiq olunub"
sayılır. Buna baxmayaraq:

```sql
SELECT COUNT(*) FROM rooms WHERE id='general';   →  0    (HƏM lokal, HƏM İSTEHSAL)
SELECT COUNT(*) FROM rooms;                      →  0    (istehsalda ÜMUMİYYƏTLƏ otaq yox)
```

0002-nin **digər** sətirləri yerində idi (23 taksonomiya, 6 FAQ, 3 testimonial)
— yəni miqrasiya işləmişdi, sonradan **yalnız `rooms` cədvəli boşaldılmışdı**.
Kimsə təmizlik apararkən demo otaqla birlikdə **bootstrap otağını da** silmişdi
— məhz tapşırığın §2.b-də xəbərdarlıq etdiyi səhv, artıq baş vermiş halda.

**Təsiri:** `room_messages.room_id` → `rooms(id)` FK-dır. Otaq yoxdursa qlobal
çata yazılan **hər mesaj uğursuz olurdu**:

```
X [ERROR] otaq mesajı D1-ə yazılmadı general … D1_ERROR: FOREIGN KEY constraint failed
```

Bu, AUDIT-TASK-4 §6.2-də `ws-flow` testlərinin sınmasının kök səbəbi idi.

**Düzəliş:** `0021_restore_bootstrap_rooms.sql` (§2).

---

## 2. Silmə planı və icrası (5.2, 5.3)

### İxrac (silmədən əvvəl)

Bütün demo sətirlər **repo-dan KƏNAR** arxivə (JSON) yazıldı: users, teams,
team_roles, team_members, team_projects, team_chat_rooms, `rooms.tcr_1`.
Uzaq bazada ixrac **boşdur** — orada demo sətir yox idi.

### Quru qaçış → faktiki (lokal)

| Cədvəl | Gözlənilən | Faktiki | Uyğun? |
|---|---|---|---|
| team_posts | 3 | 3 | ✅ |
| team_activity | 29 | 29 | ✅ |
| team_chat_rooms | 4 | 4 | ✅ |
| team_tasks | 4 | 4 | ✅ |
| team_projects | 4 | 4 | ✅ |
| team_members | 4 | 4 | ✅ |
| team_roles | 13 | 13 | ✅ |
| teams | 3 | 3 | ✅ |
| room_messages (`tcr_1`) | 3 | 3 | ✅ |
| rooms (`tcr_1`) | 1 | 1 | ✅ |
| users (`team_owner_123`) | 1 | 1 | ✅ |

### Miqrasiyalar

| Fayl | Nə edir |
|---|---|
| `0020_drop_demo_seed.sql` | 26 `DELETE` — FK sırası yarpaqdan kökə, **həmişə ID üzrə** |
| `0021_restore_bootstrap_rooms.sql` | `general` otağını bərpa edir (`INSERT OR IGNORE`) |
| `0022_team_roles_priority_default.sql` | `priority IS NULL` → 0 (§9) |

Hər üçü **hər iki bazaya tətbiq olundu** (əvvəlcə lokal, sonra uzaq).

---

## 3. 🟢 Qəsdən SİLİNMƏYƏNLƏR

| Obyekt | Sinif | Səbəb |
|---|---|---|
| `rooms.general` | Bootstrap | Qlobal çat; FK ilə bağlı mesajlar. **Silinmək əvəzinə BƏRPA olundu** |
| `taxonomies` (23) | Referans | Qeydiyyat və profil formaları bunlarsız işləmir |
| `faqs` (6), `testimonials` (3) | Məhsul məzmunu | Admin paneli idarə edir; publik səhifədə göstərilir |
| `users.muradovtahmaz` | 🔴 **REAL istifadəçi** | Sahibin öz admin hesabı. İstifadəçi qərarı: **"admin hesabım sadəcə qalsın"** |
| `migrations/0015`–`0018` faylları | Tarixi miqrasiya | README §2 — tətbiq olunmuş fayl dəyişdirilmir; onların **sətirləri** 0020 ilə silinir |

---

## 4. Qəbul meyarları

| # | Meyar | Nəticə |
|---|---|---|
| **1** | 🔴 `general` otağı işləyir | ✅ oxunur **və yazıla bilir** (FK sağlam) — 2 test |
| **2** | 🔴 Real istifadəçi datası itməyib | ✅ `muradovtahmaz` yerindədir; §5.1 təkrar sorğusu təmiz |
| **3** | 🔴 Tam E2E dəsti sınmır | ✅ **230 keçdi / 82 uğursuz** — baseline 224/84, hər iki oxda yaxşılaşma (§5.1) |
| 4 | Saxta istifadəçi silinib | ✅ 0 (hər iki baza) |
| 5 | Demo komandalar silinib | ✅ 0 |
| 6 | Demo rollar silinib | ✅ 0 |
| 7 | Orphan sətir qalmayıb | ✅ 17 FK-sız cədvəl açıq silindi |
| 8 | FTS indeksi təmizdir | ✅ `users_fts_ad` trigger-i indeksi sinxron saxlayır — testlə təsbit |
| 9 | Aggregate sayğaclar düzgündür | ✅ `publicStats` canlı `COUNT(*)` işlədir — saxlanılan sayğac yoxdur |
| 10 | Miqrasiya idempotentdir | ✅ 2 dəfə təkrar icra — xəta yox, `general` yerində |
| 11 | E2E seed miqrasiyadan asılı deyil | ✅ `.wrangler/state` silindi → migrate → seed → dəst |
| 12 | Nömrə yoxlayıcısı işləyir | ✅ `npm run check:migrations` → exit 0 |
| 13 | Yeni dublikat bloklanır | ✅ süni `0021_*` dublikatı → **xəta**, exit 1 |
| 14 | Deploy qapısı işləyir | ✅ tətbiq olunmamış 0020/0021 ilə → **BLOKLANDI**, exit 1 |
| 15 | Tətbiq olunmuş miqrasiya adı dəyişməyib | ✅ `migrations/` altında rename yoxdur |
| 16 | `migration-cf` istinadı qalmayıb | ⚠️ kod/script-də yoxdur; `.claude/settings.json` icazə siyahısında 2 ölü sətir qalıb (zərərsiz) |
| 17 | Strict TypeScript keçir | ✅ exit 0 |
| 18 | Build uğurludur | ✅ exit 0 |
| 19 | `migrations/README.md` mövcuddur | ✅ 6 bölmə |
| 20 | İxrac arxivi yaradılıb | ✅ repo-dan kənar, 7 fayl |

---

## 5. Test nəticələri

### 5.1 Tam dəst — meyar 3

| İcra | Keçdi | Uğursuz | Desktop uğursuz | Müddət |
|---|---|---|---|---|
| AUDIT-TASK-4 baseline | 224 | 84 | 22 | 26,9 dəq |
| **AUDIT-TASK-5 (yekun)** | **230** | **82** | **18** | 26,8 dəq |

🔴 **`ws-flow` artıq SINMIR (2 → 0).** Bu, `general` otağının bərpasının
birbaşa sübutudur: həmin iki test `FOREIGN KEY constraint failed` səbəbindən
sınırdı, kök səbəb isə itmiş bootstrap otağı idi (§1).

`teams`, `teams-rbac`, `seed-hygiene` — **hamısı 0 uğursuz**, yəni E2E seed
refaktoru (§5.2) heç bir testi sındırmadı.

Qalan 18 desktop uğursuzluğu: `admin` 12, `ux-phase` 2, `security` 1,
`responsive-audit` 1, `admin-level` 1 — hamısı əvvəlki baseline-də də var idi
və seed/miqrasiya kodunu işlətmirlər.

⚠ **1 uğursuzluq mənim testimin vaxt büdcəsi idi** (`rate-limit` →
"normal istifadəçi axını 429 ALMIR"): test qəsdən 132 sorğu göndərir və tam
dəst yükü altında 30 saniyəlik default timeout-a düşürdü — **429 səbəbindən
DEYİL**. Bloka 120 saniyəlik timeout verildi; izolə qaçışda
`rate-limit` + `seed-hygiene` = **25/25 yaşıl**.

### 5.2 E2E seed müstəqilliyi (5.4)

### Nə dəyişdi

| Əvvəl | İndi |
|---|---|
| `team_1`, `role_1`, `tcr_1`, `alpha-team`, `teamowner_123` — miqrasiyadan | `e2e_team_alpha`, `e2e_role_alpha_admin`, `e2e_room_alpha`, `e2e-alpha-team`, `e2e_teamowner` — **seed-dən** |
| ID-lər istehsal ID-ləri ilə eyni formada | hamısı **`e2e_` prefiksli** |
| Sabitlər 8 fayla səpələnmiş | mərkəzi **`e2e/fixtures.ts`** |
| `general` otağı miqrasiyadan gözlənilirdi | seed **özü təmin edir** |
| Seed yalnız Playwright `globalSetup`-dan | **`npm run e2e:seed`** — ayrıca, idempotent |

### Sıfırdan qurma testi (§5.9.c — 5.4-ün əsas sübutu)

```
rm -rf .wrangler/state   →   npm run db:migrate:local   →   npm run e2e
```

Miqrasiyadan sonra (seed-dən ƏVVƏL) baza vəziyyəti:

| Göstərici | Nəticə |
|---|---|
| `rooms.general` | **1** ✅ bootstrap yerindədir |
| `users` | **0** ✅ demo istifadəçi yoxdur |
| `teams` | **0** ✅ demo komanda yoxdur |
| `taxonomies` | **23** ✅ referans data yerindədir |

Bu, tam olaraq gözlənilən son vəziyyətdir: **miqrasiyalar tək başına təmiz,
işlək baza qurur** — bootstrap var, demo yox.

---

## 6. Nömrələmə nizamı (5.5)

### Tarixi dublikatlar — DÜZƏLDİLMƏDİ

| Nömrə | Fayllar |
|---|---|
| `0015` | `0015_project_members_requests.sql`, `0015_seed_teams.sql` |
| `0016` | `0016_seed_chat_room.sql`, `0016_task11_schema.sql` |

**Səbəb (§5.5.a):** `wrangler` tətbiq tarixçəsini **fayl adı** ilə izləyir.
Yenidən adlandırma = **yeni miqrasiya** = **təkrar icra**. `INSERT OR IGNORE`
daşıyan faylda zərərsiz görünə bilər, lakin `ALTER TABLE` / `DELETE` daşıyanda
dağıdıcıdır. Dublikatlar **sənədləşdirildi**, düzəldilmədi.

### Yoxlayıcı

```
$ npm run check:migrations
⚠  Tarixi dublikat 0015: … — qəsdən saxlanılır (README §5)
⚠  Tarixi dublikat 0016: … — qəsdən saxlanılır (README §5)
✓ 24 miqrasiya faylı yoxlanıldı — nizam qaydadadır
```

Süni dublikat sınağı (meyar 13):

```
✗  YENİ dublikat nömrə 0021: 0021_restore_bootstrap_rooms.sql, 0021_suni_dublikat.sql
1 xəta — bax migrations/README.md          (exit 1)
```

---

## 7. Deploy qapısı (5.6)

`package.json`:

```json
"check:migrations": "node scripts/check-migrations.mjs",
"predeploy":        "node scripts/check-migrations.mjs --remote",
"deploy":           "npm run build && wrangler deploy"
```

npm `predeploy`-u **avtomatik** icra edir → qayda insan yaddaşından koda keçdi.

Faktiki bloklama sınağı (meyar 14), 0020/0021 tətbiq olunmamış ikən:

```
✗  TƏTBİQ OLUNMAMIŞ miqrasiya var — deploy BLOKLANDI:
    • 0020_drop_demo_seed.sql
    • 0021_restore_bootstrap_rooms.sql
  → Əvvəlcə: npm run db:migrate:remote
  → Sonra:   npm run deploy                 (exit 1)
```

❌ CI pipeline qurulmadı — **Task 10**. Bu, yalnız lokal qapıdır.

---

## 8. `migration-cf` qərarı (5.7) — **TAM SİLİNDİ**

### Tapıntı — tapşırığın fərziyyəsi səhv çıxdı

Tapşırıq `SELECT COUNT(*) FROM users WHERE id LIKE 'legacy_%'` sorğusu ilə
miqrasiyanın bitdiyini təsdiqləməyi təklif edirdi. Faktiki olaraq:

- `legacy_*` prefiksli istifadəçi **heç bir bazada yoxdur** — `import.sql`
  Firebase-stil ID-lər işlədir (`0457kQANOsTGL13jovtw3a5xm6R4`).
- `import.sql` **53 istifadəçi + 12 post + 24 otaq mesajı + 17 DM + şərh,
  like, tapşırıq, admin** sətri saxlayır — yəni tam miqrasiya yükü.
- İstehsal bazasında həmin 53 hesabdan **yalnız 1-i** var (`muradovtahmaz`).

Yəni miqrasiya cari baza üzərində **tamamlanmayıb** — baza sıfırlanıb.
Bu, tapşırığın "arxivləşdir + script-ləri sil" tövsiyəsini şübhə altına aldı:
fayl 52 hesabın yeganə nüsxəsi ola bilərdi.

### İstifadəçi qərarı

> *"bütün hesabları tam sil. artıq gərək deyil. datanı tam yenilə. heçnə
> qalmasın"* + *"admin hesabım sadəcə qalsın"*

**İcra olunan:**

| Obyekt | Əməliyyat |
|---|---|
| `migration-cf/import.sql`, `update.sql` | **Silindi** (git-də deyildi → bərpa olunmur) |
| `migration-cf/backfill-images.mjs`, `firestore-to-d1.mjs` | **Silindi** (git tarixçəsində qalır) |
| `db:import:local`, `db:import:remote` script-ləri | **Silindi** |
| `.gitignore` | Naxış `migration-cf/`-ə genişləndirildi + səbəb yazıldı |
| İstehsaldakı `muradovtahmaz` hesabı | 🟢 **TOXUNULMADI** — istifadəçi qərarı |

---

## 9. `is_system` qərarı (5.8) — **TƏXİRƏ SALINDI (qismən)**

İstifadəçi qərarı: **"Yalnız priority düzəlişi"**.

| Təklif | Vəziyyət | Səbəb |
|---|---|---|
| `priority IS NULL` → 0 | ✅ **tətbiq olundu** (`0022`) | Sadə, risksiz `UPDATE`; "səbəbsiz 403" problemini həll edir |
| `is_system` sütunu | ❌ **tətbiq olunmadı** | SQLite `NOT NULL` üçün cədvəlin yenidən qurulmasını tələb edir (CREATE→INSERT SELECT→DROP→RENAME). Task 3-dəki **prioritet qaydası əsas müdafiəni onsuz da verir** və rolun yenidən adlandırılması ilə yayınmağa imkan vermir |

Task 3-dəki ad əsaslı yoxlamalar **olduğu kimi qaldı**.

---

## 10. Aşkarlanan yeni risklər

1. 🔴 **`tsconfig.json` yalnız `worker/**/*.ts`-i əhatə edir** — `npx tsc --noEmit`
   **e2e/ qovluğunu heç vaxt yoxlamır**. Bu task-da həmin boşluq real zərər
   verdi: `e2e/audit-lib.ts`-də çatışmayan `import` `tsc`-dən keçdi və BÜTÜN
   dəstin yüklənməsini sındırdı (`ReferenceError: E2E_TEAM is not defined`) —
   səhv yalnız Playwright işə salınanda üzə çıxdı.
   **Təklif:** `include`-a `e2e/**/*.ts` əlavə et. ⚠ Əvvəlcədən mövcud
   **1 xəta** (`audit-lib.ts:18` — `Violation[]` tipi) düzəldilməlidir.

2. 🟠 **Bootstrap datası bir daha silinə bilər.** `0021` onu bərpa etdi, lakin
   heç nə gələcək təkrarın qarşısını almır. `e2e/seed-hygiene.spec.ts`-dəki
   "general otağı İŞLƏYİR" testi lokal mühitdə tutur, **istehsalda tutmur**.
   **Təklif:** sağlamlıq endpoint-i və ya deploy sonrası smoke yoxlaması
   (Task 10 / CI).

3. 🟠 **İstehsal bazası sıfırlanıb və bu heç yerdə qeydə alınmayıb.**
   AUDIT-TASK-3-də (bu gün, bir neçə saat əvvəl) uzaq bazada `team_1` və
   `role_1` var idi; AUDIT-TASK-5-də artıq yox idi. Miqrasiya tarixçəsi (21
   sətir) toxunulmamışdı — yəni sətirlər əl ilə silinib. Belə əməliyyatlar
   jurnala düşmür.
   **Təklif:** istehsal bazasında əl ilə aparılan `DELETE`-lər üçün qeyd
   proseduru (ən azı `docs/`-da jurnal).

4. 🟡 **`.claude/settings.json`-da 2 ölü icazə sətri** (`mkdir -p migration-cf`,
   `import.sql` üzərində `awk`). Zərərsizdir — icra edilə bilən istinad deyil,
   sadəcə allowlist qalığı. Toxunulmadı (istifadəçinin öz konfiqi).

5. 🟡 **17 cədvəldə FK yoxdur.** Bu task onların orphan sətirlərini açıq
   silməklə həll etdi, lakin **struktur problem qalır**: gələcək silmələr də
   eyni əl işini tələb edəcək. Sxem refaktoru → **Task 10**.

---

## 11. Açıq qalan öhdəliklər

- [ ] 🔴 Atomik limiter → **Task 9** (təhlükəsizlik səbətləri hazırda sızır)
- [ ] 🔴 E2E paylaşılan sessiya refaktoru (Task 3 §8/1 + Task 4 §7/3)
- [ ] 🔴 `tsconfig` `include`-una `e2e/**/*.ts` (§10/1) — əvvəlcə `audit-lib.ts:18`
- [ ] 🔴 `ARCHIVE_HOT_DAYS` → `"90"` (Task 8-dən sonra; əvvəlcə Privacy §4)
- [ ] 🔴 Hüquqi mətnin peşəkar nəzərdən keçirilməsi
- [ ] 🔴 `collabix.az` DNS + MX
- [ ] 🟠 TestSprite API açarının rotasiyası
- [ ] 🟠 İstehsal bazasında bootstrap sağlamlıq yoxlaması (§10/2)
- [ ] 🟠 VÖEN, sosial profillər
- [ ] 🟡 GDPR ixracının rate limit-i Privacy-də qeyd olunsun (Task 4 §7/6)
- [ ] 🟡 İstehsalda p50/p95 gecikmə ölçməsi (Task 4 §5.3)
- [ ] 💡 `read` sampling (Task 4 §5.5)
- [ ] Git remote qərarı

**Bağlandı:** ~~53 hesaba parol sıfırlama qərarı~~ — hesablar silindi (§8).
**Bağlandı:** ~~`is_system` miqrasiyası~~ — qərar verildi (§9).
**Bağlandı:** ~~Demo seed `role_1`~~ — silindi (§2).
**Bağlandı:** ~~Lokal D1 seed drift-i~~ — E2E seed artıq miqrasiyadan asılı deyil (§5.2).

---

## 13. Commit-lər

| Hash | Bənd | Başlıq |
|---|---|---|
|  | 5.5, 5.6, 5.7 |  |
|  | 5.4 |  |
|  | 5.3, 5.8 |  |
|  | 5.9.d |  |
| *(bu commit)* | 5.9 |  |

Push edilmədi — git remote qərarı hələ açıqdır.

---

## 12. Geri qaytarma planı

⚠️ **Silinmiş sətirlər `git revert` ilə BƏRPA OLUNMUR.**

| Dəyişiklik | Bərpa | Şərt |
|---|---|---|
| Kod / miqrasiya faylı | `git revert <hash>` | Adi hal |
| `0020` ilə silinmiş demo sətirlər | İxrac arxivindən `INSERT` | Yalnız zərurət halında; arxiv repo-dan kənardadır |
| `0021` (bootstrap bərpası) | ⚠️ **REVERT ETMƏ** — `general` otağını silmək qlobal çatı yenidən sındırar | — |
| `migration-cf/*.sql` | ❌ **BƏRPA OLUNMUR** — git-də deyildi | İstifadəçi qərarı ilə silindi |
| `migration-cf/*.mjs` | `git revert 7be9d61` | Generator script-ləri |

⚠️ **Miqrasiya fayllarını yenidən adlandırma** (README §2) — `0020`/`0021`/`0022`
artıq `d1_migrations`-də qeydə alınıb.
