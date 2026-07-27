# AUDIT-TASK-5 — Demo Seed-in İstehsaldan Çıxarılması və Miqrasiya Nizamı

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md` §H-7 (sətir 535–556), struktur borcu #120, proses borcu #8
**Əlavə mənbələr:** `AUDIT-TASK-1-REPORT.md` §5.4 · `AUDIT-TASK-3-REPORT.md` §4, §8/2, §8/3 · `AUDIT-TASK-4-REPORT.md` §8
**Bağlanan tapıntılar:** **H-7** (High — data bütövlüyü), dublikat miqrasiya nömrələri, proses borcu #8 (deploy qapısı), Task 1 §5.4 (`import.sql`), Task 3 §4 (`is_system` qərarı), Task 3/4 (E2E seed drift-i)
**Təxmini həcm:** 1–1,5 gün
**Ön şərt:** AUDIT-TASK-4 tamamlanmış olmalıdır
**Risk sinfi:** 🔴 **Bu task istehsal bazasından SƏTİR SİLİR. Geri dönüş yoxdur.** §5.2-ni oxumadan başlama.

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-5  Demo seed-i istehsaldan çıxar — AMMA əvvəlcə sübut et ki, silinən
               sətirlərə real istifadəçi datası bağlı deyil (silmədən əvvəl ixrac + FK analizi).
               DEMO seed-i (0015-0018) BOOTSTRAP seed-indən (0002) ayır — general otağını SİLMƏ.
               Seed-i e2e/-ə köçür, miqrasiya tarixçəsindən asılılığını kəs.
               Nömrələmə qaydasını sənədləşdir + yoxlayıcı script. Deploy qapısını avtomatlaşdır.
               DONE: istehsalda 'Alpha Team'/'Team Owner' yoxdur; general otağı İŞLƏYİR;
                     E2E seed idempotentdir; dublikat nömrə yoxdur; nömrə yoxlayıcısı yaşıl.
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli data mühəndisisən**.

Bu task əvvəlkilərdən **keyfiyyətcə fərqlidir**. Task 1–4 kod dəyişdirirdi: səhv olsa `git revert` işləyirdi. Bu task **istehsal bazasından sətir silir** — `git revert` silinmiş sətri geri gətirmir.

Ona görə burada ardıcıllıq tərsdir: **əvvəlcə sübut, sonra silmə.** Heç bir `DELETE` ifadəsi aşağıdakı üç şərt yerinə yetirilmədən yazılmır:

1. Silinəcək sətirlərin **tam siyahısı** çıxarılıb və ixrac edilib.
2. Həmin sətirlərə **real istifadəçi datasının bağlı olmadığı** sorğu ilə sübut edilib.
3. Silmənin **FK asılılıq sırası** çıxarılıb.

Şübhə varsa — silmə, hesabat ver.

---

## 2. KONTEKST

### 2.a Tapıntı — H-7

`migrations/0015_seed_teams.sql` **istehsal bazasına** yazır:
```sql
INSERT OR IGNORE INTO users (id, username, name, xp, joined_at, pass_hash, pass_salt)
VALUES ('team_owner_123','teamowner_123','Team Owner',100,1700000000000,'hash','salt');

INSERT OR IGNORE INTO teams (id, slug, name, …)
VALUES ('team_1','alpha-team','Alpha Team','This is a test team for development.', …);
```

`0018_seed_fix_admin_permissions.sql` demo `role_1` rolunu **`manage_team` ilə eskalasiya edir** (Task 3 bunu qeyd etdi, toxunmadı — bu task-a ötürdü).

**Auditdə doğrulanmış:** `pass_hash='hash'`, `pass_salt='salt'` ilə giriş **mümkün deyil** (`verifyPassword` uzunluq uyğunsuzluğuna görə `false` qaytarır) → birbaşa hesab ələ keçirmə yoxdur. **Lakin:**

- Saxta "Team Owner" istifadəçisi `listUsers`, `usersDirectory`, `searchUsers`, `suggestUsers`, `publicStats` sayğacında və **XP liderliyində canlı saytda görünür**.
- "Alpha Team" / "Collabix V2" / "Design UI" demo obyektləri istehsal bazasındadır.
- Migration nömrələri **dublikatdır** (iki `0015`, iki `0016`).

### 2.b 🔴 Ən vacib ayrım — DEMO seed ≠ BOOTSTRAP seed

`AUDIT-TASK-4-REPORT.md` §8 bu sətri daşıyır:

> Lokal D1 seed drift-inin bərpası — **`general` otağı yoxdur**:
> `wrangler d1 execute … --file migrations/0002_seed.sql`

Bu, task-ın **əsas təhlükəsini** açır. `migrations/` altındakı seed faylları **iki fərqli sinifə** bölünür:

| Sinif | Nümunə | Nədir | Silinməlidir? |
|---|---|---|---|
| 🟢 **Bootstrap seed** | `0002_seed.sql` → `general` otağı | Tətbiqin **işləməsi üçün lazım olan** ilkin data. Silinsə çat çökür | ❌ **ƏSLA** |
| 🔴 **Demo seed** | `0015`–`0018` → `Alpha Team`, `Team Owner`, `role_1` | Development üçün uydurulmuş nümunə data | ✅ Bəli |
| ⚪ **Referans data** | statuslar, tiplər, default konfiqurasiya (varsa) | Sxemin bir hissəsi | ❌ Xeyr |

**"Seed" sözü fayl adında olması silinməli olduğunu göstərmir.** Hər seed faylı ayrıca təsnif edilməlidir — 5.0/Sual 2 bunun üçündür.

⚠️ `general` otağının silinməsi bütün istifadəçilər üçün çatı sındırar və **geri dönməzdir** (otaqdakı mesajlar FK ilə birlikdə gedər).

### 2.c 🔴 İkinci təhlükə — silinmiş demo obyektlərinə real data bağlanmış ola bilər

Demo sətirlər istehsalda **aylarla** durub. Bu müddətdə:

- Real istifadəçi `Alpha Team`-ə **qoşulmuş** ola bilər (`team_members`).
- Real istifadəçi demo otağa **mesaj yazmış** ola bilər (`room_messages`).
- Real istifadəçi `team_owner_123`-ü **izləmiş** ola bilər (`follows`).
- Demo komandada **real tapşırıq / post / fayl** ola bilər.

Kor-koranə `DELETE FROM teams WHERE id='team_1'` FK kaskadı ilə **real istifadəçi datasını məhv edə bilər**.

5.1 bəndi məhz bunu yoxlayır və nəticəsi task-ın gedişatını dəyişir.

### 2.d Əvvəlki task-lardan miras qalan bəndlər

Bu task aşağıdakıları da bağlayır (hamısı miqrasiya/seed sahəsindədir):

| Mənbə | Bənd | Bu task-da |
|---|---|---|
| Task 1 §5.4 | `migration-cf/import.sql` — 53 PBKDF2 heşi, `package.json` script-ləri asılıdır | **5.7** |
| Task 3 §4 | `is_system` miqrasiyası — istifadəçi qərarı gözləyir | **5.8** |
| Task 3 §8/3 | `team_roles.priority` NULL ola bilir → fail-closed 403 | **5.8** (eyni miqrasiyada) |
| Task 3 §8/2 | Lokal D1 seed drift-i — miqrasiya tarixçəsi "tətbiq olunub" deyir, sətirlər yoxdur | **5.4** |
| Task 4 §8 | `general` otağı lokal bazada yoxdur | **5.4** |
| Audit #8 | `d1-migrations-must-precede-deploy` **yalnız insan yaddaşındadır** | **5.6** |

### 2.e Əvvəlki task-lardan gələn dərslər

| Mənbə | Dərs | Tətbiqi |
|---|---|---|
| Task 2 §5.2 | Audit placeholder-ləri 6× az saymışdı | Auditin 4 fayllıq siyahısı (`0015`–`0018`) **natamam ola bilər** |
| Task 3 §8/6 | Audit `createTeamInvite`-i sadalamamışdı | Demo sətirləri **öz sorğunla** tap |
| Task 4 §7/1 | `startPoll` 429-da dayanmırdı — auditdə yox idi | Yan təsirləri özün axtar |

---

## 3. ƏHATƏ — 10 BƏND

---

### 5.0 · Miqrasiya inventarı və təsnifat (ÖN İŞ, kod dəyişikliyi yoxdur)

**Həcm:** 1,5 saat

#### Sual 1 — Faktiki miqrasiya siyahısı
```bash
ls -1 migrations/ | sort
ls -1 migrations/ | sed 's/_.*//' | sort | uniq -d      # dublikat nömrələr
```
Auditin "19 migration" və "iki 0015, iki 0016" iddiasını təsdiqlə. **Fərq varsa faktiki vəziyyəti əsas götür.**

#### Sual 2 — 🔴 Hər seed faylının təsnifatı
```bash
grep -ln "INSERT" migrations/*.sql
```
Tapılan **hər fayl** üçün cədvəl doldur:

| Fayl | Hansı cədvələ yazır | Hansı sətirlər | Sinif (2.b) | Silinməli? | Əsaslandırma |
|---|---|---|---|---|---|

**Təsnifat qaydası:**
- Sətir **tətbiqin işləməsi üçün lazımdırsa** (default otaq, sistem rolu, referans dəyər) → 🟢 **Bootstrap**, silinmir.
- Sətir **uydurma nümunədirsə** ("test", "demo", "Alpha", "Lorem", `123` sonluqlu ID-lər) → 🔴 **Demo**, silinir.
- Qeyri-müəyyəndirsə → **soruş**, təxmin etmə.

⚠️ `0002_seed.sql`-in `general` otağı **bootstrap-dır** — Task 4 §8 onun yoxluğunun testləri sındırdığını göstərir.

#### Sual 3 — Miqrasiya tətbiq tarixçəsi necə izlənilir?
```bash
npx wrangler d1 execute collabix-db --remote --command \
  "SELECT * FROM d1_migrations ORDER BY id;"
```
(Cədvəl adı fərqli ola bilər — `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%migration%'` ilə tap.)

**Bu sualın cavabı 5.5-i müəyyən edir** — bax §5.3-dəki ad dəyişikliyi tələsi.

#### Sual 4 — Demo sətirlər istehsalda mövcuddurmu?
```sql
SELECT 'users'  AS t, id, username FROM users  WHERE id = 'team_owner_123'
UNION ALL SELECT 'teams', id, slug  FROM teams WHERE id IN ('team_1','team_2','team_3')
UNION ALL SELECT 'team_roles', id, name FROM team_roles WHERE id LIKE 'role_%';
```
Həm `--local`, həm `--remote` üzərində işlət. Nəticələr fərqli ola bilər.

#### Sual 5 — Sxemin FK qrafiki
```bash
grep -n "REFERENCES\|FOREIGN KEY" migrations/*.sql
```
`users`, `teams`, `team_roles`, `rooms` cədvəllərinə **hansı cədvəllər istinad edir**? Silmə sırası bundan çıxır (5.2).

⚠️ Audit (sətir 629) qeyd edir: *"Bir sıra sosial cədvəldə FK yox"*. FK-sız istinad = **kaskad işləməz**, orphan sətir qalar. Onları da siyahıya sal.

#### Sual 6 — E2E seed infrastrukturu necə işləyir?
```bash
ls -la e2e/ | grep -i "seed\|setup\|fixture"
grep -rn "team_1\|team_owner_123\|role_1\|alpha-team" e2e/
```
E2E testləri demo sətirlərə **birbaşa istinad edirmi**? Edirsə, silmə testləri sındıracaq → 5.4 həmin asılılığı kəsir.

**Dayanma şərti:** Sual 2 (təsnifat) və Sual 5 (FK qrafiki) tamamlanmadan **heç bir DELETE yazma**.

---

### 5.1 · 🔴 Real data bağlılığının yoxlanması

**Həcm:** 1,5 saat · **auditdə yoxdur — bu task-ın ən vacib bəndidir**

Silinəcək hər demo obyekt üçün "ona real istifadəçi datası bağlıdırmı" sualına **sorğu ilə** cavab ver.

#### 5.1.a — Demo komandada real üzv varmı?
```sql
SELECT tm.team_id, tm.uid, u.username, u.joined_at, tm.joined_at AS member_since
FROM team_members tm
JOIN users u ON u.id = tm.uid
WHERE tm.team_id IN ('team_1','team_2','team_3')
  AND tm.uid <> 'team_owner_123';
```

#### 5.1.b — Demo komandada real məzmun varmı?
```sql
SELECT 'tasks' AS kind, COUNT(*) FROM team_tasks  WHERE team_id IN ('team_1','team_2','team_3')
UNION ALL SELECT 'posts', COUNT(*) FROM team_posts WHERE team_id IN (…)
UNION ALL SELECT 'files', COUNT(*) FROM team_files WHERE team_id IN (…)
UNION ALL SELECT 'invites', COUNT(*) FROM team_invites WHERE team_id IN (…);
```

#### 5.1.c — Demo otaqda real mesaj varmı?
```sql
SELECT room_id, COUNT(*) AS msgs, MIN(created_at), MAX(created_at)
FROM room_messages
WHERE room_id IN (<0016-dakı demo otaq ID-ləri>)
GROUP BY room_id;
```

#### 5.1.d — Saxta istifadəçiyə real sosial əlaqə bağlıdırmı?
```sql
SELECT 'followers' AS kind, COUNT(*) FROM follows WHERE target_uid = 'team_owner_123'
UNION ALL SELECT 'following', COUNT(*) FROM follows WHERE uid = 'team_owner_123'
UNION ALL SELECT 'posts',     COUNT(*) FROM posts    WHERE uid = 'team_owner_123'
UNION ALL SELECT 'comments',  COUNT(*) FROM comments WHERE uid = 'team_owner_123'
UNION ALL SELECT 'notifs',    COUNT(*) FROM notifications WHERE actor_uid = 'team_owner_123'
UNION ALL SELECT 'sessions',  COUNT(*) FROM sessions WHERE uid = 'team_owner_123';
```

⚠️ **`sessions` sətri diqqətlə oxu.** Sıfırdan böyükdürsə, kimsə həmin hesaba **giriş edib** — auditin "giriş mümkün deyil" nəticəsi yanlışdır və bu, **hadisədir**. Dərhal dayan və bildir.

#### Nəticənin qiymətləndirilməsi

| Nəticə | Hökm | Əməliyyat |
|---|---|---|
| Hər şey **0** | ✅ Təmiz | Planlaşdırıldığı kimi sil |
| Yalnız demo obyektlərin **öz aralarında** bağlılıq | ✅ Gözlənilən | Sil (FK sırası ilə) |
| **Real istifadəçi** üzv / mesaj / izləyici | ⚠️ **DAYAN** | Silmə. Hesabatda variantları təqdim et: (a) demo obyekti saxla, yalnız adını/görünürlüyünü dəyiş; (b) real datanı köçür, sonra sil; (c) yalnız `team_owner_123`-ü gizlət |
| `sessions` > 0 | 🔴 **HADİSƏ** | Dayan, bildir |

**Bu bəndin nəticəsi hesabatın ayrıca bölməsi olmalıdır.**

---

### 5.2 · Silmə planı və ixrac (silmədən ƏVVƏL)

**Həcm:** 1 saat

#### Addım 1 — Silinəcək sətirlərin tam ixracı

```bash
mkdir -p ../collabix-demo-seed-backup-$(date +%Y%m%d)
```

Hər cədvəl üçün `SELECT * … WHERE <demo şərti>` nəticəsini JSON/SQL kimi saxla. **Repodan kənarda** (`.gitignore` onsuz da `migrations/import.sql` naxışını tutmur — təsadüfən commit olunmasın).

⚠️ İxrac faylı `team_owner_123`-ün `pass_hash`/`pass_salt` dəyərlərini daşıyır. Onlar saxta (`'hash'`/`'salt'`) olsa da, ixracı **repo daxilinə qoyma**.

#### Addım 2 — FK asılılıq sırasının çıxarılması

5.0/Sual 5-in nəticəsindən silmə sırasını qur — **yarpaqdan kökə**:

```
1. team_files, team_tasks, team_posts, team_invites, team_activity   (team_id → teams)
2. team_members                                                       (team_id → teams)
3. team_roles                                                         (team_id → teams)
4. teams
5. room_messages                                                      (room_id → rooms)
6. room_members                                                       (room_id → rooms)
7. rooms                                                              (yalnız DEMO otaqlar!)
8. follows, notifications, posts, comments, sessions, presence         (uid → users)
9. users                                                              (team_owner_123)
```

⚠️ Bu sıra **nümunədir**. Faktiki sırа 5.0/Sual 5-in nəticəsindən çıxarılmalıdır — sxemdə fərqli cədvəllər ola bilər.

⚠️ **FK-sız istinadlar** (audit sətir 629) kaskadla təmizlənməz — onları **açıq şəkildə** silmə siyahısına sal, əks halda orphan sətir qalar.

#### Addım 3 — Quru qaçış (dry run)

Hər `DELETE` üçün əvvəlcə eyni `WHERE` şərti ilə `SELECT COUNT(*)` işlət və gözlənilən sayı hesabata yaz. Faktiki silinən say fərqlənərsə → **araşdır**.

---

### 5.3 · `0020_drop_demo_seed.sql` yazılması

**Audit ID:** H-7 · **Həcm:** 1 saat

#### Nömrə seçimi

5.0/Sual 1-in nəticəsinə görə **mövcud ən yüksək nömrədən sonrakını** götür. Audit `0020` təklif edir, lakin Task 3-də `is_system` üçün də `0020` təklif olunmuşdu — **toqquşma riski var**, faktiki vəziyyəti yoxla.

#### Fayl strukturu

```sql
-- 00XX_drop_demo_seed.sql
--
-- AUDIT-2026-07-26 / H-7: demo seed datası istehsal migration-larına
-- (0015_seed_teams, 0016_seed_chat_room, 0017_*, 0018_*) yerləşdirilmişdi.
-- Saxta "Team Owner" istifadəçisi canlı saytda istifadəçi siyahısında,
-- axtarışda, publicStats sayğacında və XP liderliyində görünürdü.
--
-- ⚠️ BU MİQRASİYA SƏTİR SİLİR VƏ GERİ DÖNMƏZDİR.
-- Silmədən əvvəl AUDIT-TASK-5 §5.1 real-data bağlılığı yoxlaması aparılıb:
-- <nəticəni bura yaz: "0 real üzv, 0 real mesaj, 0 izləyici">
-- İxrac: <repo-dan kənar arxivin təsviri>
--
-- ⚠️ SİLİNMİR: 0002_seed.sql-in `general` otağı — o, BOOTSTRAP datadır,
-- tətbiqin işləməsi üçün lazımdır (bax AUDIT-TASK-4-REPORT §8).
--
-- Silmə sırası FK asılılığına görədir (yarpaqdan kökə).
-- Hər ifadə idempotentdir — təkrar icra zərərsizdir.

-- ─── 1. Komanda alt obyektləri ───
DELETE FROM team_files    WHERE team_id IN ('team_1','team_2','team_3');
DELETE FROM team_tasks    WHERE team_id IN ('team_1','team_2','team_3');
…

-- ─── 9. Saxta istifadəçi ───
DELETE FROM users WHERE id = 'team_owner_123';
```

#### Tələblər

| Tələb | Səbəb |
|---|---|
| **Hər ifadə idempotent** | Miqrasiya təkrar tətbiq oluna bilər; `DELETE … WHERE` təbii olaraq idempotentdir |
| **ID üzrə silmə, ad üzrə deyil** | `WHERE name='Alpha Team'` real istifadəçinin yaratdığı eyniadlı komandanı silə bilər. **Həmişə ID işlət** |
| **`general` otağı istisna edilir** | Şərtdə açıq göstər; kommentlə vurğula |
| **Aggregate/trigger cədvəlləri** | Sxemdə trigger-li aggregate cədvəllər var (audit sətir 629). Silmə onları düzgün yeniləyirmi? Yoxla — yoxsa sayğaclar səhv qalar |
| **FTS indeksləri** | `posts_fts`, `comments_fts`, `users_fts` — silinən sətirlər indeksdən çıxırmı? Trigger yoxdursa əl ilə təmizlə |

⚠️ **Sonuncu iki bənd auditdə yoxdur.** `users` sətri silinsə, `users_fts` indeksində qalıq qalarsa axtarışda **fantom nəticə** çıxar.

---

### 5.4 · Seed-in `e2e/`-ə köçürülməsi və miqrasiya asılılığının kəsilməsi

**Audit ID:** H-7 · **Miras:** Task 3 §8/2, Task 4 §8 · **Həcm:** 2 saat

**Problem (Task 3 §8/2-dən):**
> `db:migrate:local` "No migrations to apply" deyirdi, lakin `0015_seed_teams.sql`-in sətirləri bazada **yox** idi → `global-setup` FK xətası ilə sınırdı. Miqrasiya cədvəli "tətbiq olunub" saydığı üçün wrangler onları bir daha işlətmir.

Bu, **struktur qüsurdur**: test datası miqrasiya tarixçəsindən asılıdır, tarixçə isə testin ehtiyacını bilmir.

**Tələb:**

1. **`e2e/seed.ts` (və ya mövcud seed modulu) öz datasını özü yaratsın.** Miqrasiya tarixçəsinə **güvənməsin**:
   ```ts
   /**
    * E2E test datası — AUDIT-TASK-5.
    *
    * Bu seed miqrasiya tarixçəsindən ASILI DEYİL. Səbəb (AUDIT-TASK-3 §8/2):
    * `d1_migrations` cədvəli miqrasiyanı "tətbiq olunub" saydıqda wrangler onu
    * bir daha işlətmir — lokal baza sıfırlansa belə. Nəticədə test datası
    * sükutla yox olurdu və global-setup FK xətası ilə sınırdı.
    *
    * Hər sətir INSERT OR IGNORE ilə yazılır → idempotentdir, təkrar icra zərərsizdir.
    */
   ```

2. **Bootstrap datası da E2E seed-ində olsun.** Task 4 §8 `general` otağının yoxluğunu qeyd edir — E2E seed onu da `INSERT OR IGNORE` ilə təmin etsin. Beləliklə test mühiti `0002_seed.sql`-in tətbiq olunub-olunmamasından asılı olmaz.

3. **E2E testlərindəki birbaşa istinadları kəs.** 5.0/Sual 6-da tapılan `team_1`, `role_1`, `team_owner_123` sabitləri:
   - Ya E2E seed-in **öz** ID-lərinə keçirilsin (`e2e_team_1` kimi prefiks — istehsal ID-ləri ilə qarışmasın),
   - Ya da mərkəzi `e2e/fixtures.ts`-də sabit kimi saxlanılsın.

   ⚠️ **Prefiks tövsiyəsi vacibdir:** E2E ID-ləri istehsal ID-lərindən fərqlənməlidir ki, gələcəkdə eyni qarışıqlıq təkrarlanmasın.

4. **Seed-in yenidən qaçırılabilməsi:**
   ```bash
   npm run e2e:seed        # idempotent, istənilən vaxt işlədilə bilər
   npm run e2e:seed:reset   # varsa — təmizləyib yenidən qurur
   ```

5. **Doğrulama:** lokal bazanı sıfırla (`.wrangler/state` sil) → migration → seed → E2E qaç. Sınmamalıdır.

---

### 5.5 · Miqrasiya nömrələmə nizamı

**Audit ID:** struktur borcu #120 · **Həcm:** 1,5 saat

#### 🔴 5.5.a — ƏSAS TƏLƏ: tətbiq olunmuş miqrasiyanı YENİDƏN ADLANDIRMA

`wrangler` tətbiq olunmuş miqrasiyaları **fayl adı** ilə `d1_migrations` cədvəlində izləyir. Dublikat nömrəni "düzəltmək" üçün faylı yenidən adlandırsan:

```
0015_seed_teams.sql  →  0019_seed_teams.sql
```

wrangler bunu **yeni miqrasiya** sayar və **yenidən tətbiq edər**. `INSERT OR IGNORE` olduğu üçün bu halda zərərsiz görünə bilər — **lakin ümumi halda dağıdıcıdır** (`ALTER TABLE`, `CREATE INDEX`, `DELETE` daşıyan miqrasiya təkrar icra olunar).

**Qayda:** ✅ **Artıq tətbiq olunmuş heç bir miqrasiya faylı yenidən adlandırılmır və dəyişdirilmir.** Dublikat nömrələr **tarixi faktdır** — sənədləşdirilir, düzəldilmir.

#### 5.5.b — Qaydanın sənədləşdirilməsi

`migrations/README.md` yarat:

```markdown
# Miqrasiya qaydaları

## 1. Bir nömrə = bir fayl
Nömrə 4 rəqəmlidir, ardıcıldır, boşluq buraxılmır.

## 2. Tətbiq olunmuş miqrasiya DƏYİŞMƏZDİR
Adı dəyişdirilmir, məzmunu redaktə edilmir, silinmir.
`wrangler` tətbiq tarixçəsini fayl adı ilə izləyir — ad dəyişikliyi təkrar icra deməkdir.
Səhv varsa: **yeni** miqrasiya yaz.

## 3. Seed datası miqrasiyaya YAZILMIR
İstisna: tətbiqin işləməsi üçün lazım olan **bootstrap** data
(məs. `0002_seed.sql` → `general` otağı).
Test/demo datası → `e2e/seed.ts`.
Fərq: bootstrap-sız tətbiq **çökür**; demo-suz tətbiq **işləyir**.

## 4. Hər miqrasiya idempotent olmalıdır
`CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`, `DELETE … WHERE`.

## 5. Mövcud dublikatlar (tarixi — DÜZƏLDİLMİR)
| Nömrə | Fayllar | Tətbiq sırası |
|---|---|---|
| 0015 | `0015_project…`, `0015_seed_teams` | əlifba sırası ilə təsadüfən düzgün |
| 0016 | `0016_seed_chat_room`, `0016_task11…` | eyni |

⚠️ Bunlar `d1_migrations`-də qeydə alınıb. Yenidən adlandırılması təkrar icraya səbəb olar.

## 6. Deploy sırası
Miqrasiya **deploy-dan ƏVVƏL** tətbiq olunur. Bax `scripts/check-migrations.mjs`.
```

#### 5.5.c — Avtomatik yoxlayıcı

`scripts/check-migrations.mjs` yaz:

- Yeni dublikat nömrə **yaradılıbsa** → xəta (mövcud tarixi dublikatlar ağ siyahıda).
- Nömrə boşluğu varsa → xəbərdarlıq.
- Fayl adı formatı (`NNNN_ad.sql`) pozulubsa → xəta.
- `package.json`-a `"check:migrations"` script-i əlavə et.

Bu, Task 10-dakı CI-ın hazır girişidir.

---

### 5.6 · Deploy qapısının avtomatlaşdırılması

**Audit ID:** proses borcu #8 · **Həcm:** 1 saat

**Nədir (auditdən, sətir 651):**
> `d1-migrations-must-precede-deploy` qaydası **yalnız insan yaddaşında** — unudulsa istehsalda yalnız *düzgün* parol 500 verir (uğursuz giriş 401 qalır), yəni **problem gizlənir**.

Bu, xüsusilə xəbisdir: qüsur yalnız **uğurlu** giriş cəhdində üzə çıxır, uğursuzda yox → monitorinq onu "normal 401 fonu" kimi görür.

**Tələb:**

1. `scripts/check-migrations.mjs`-i genişləndir: **tətbiq olunmamış miqrasiya varsa** deploy-u bloklasın.
   ```bash
   # tətbiq olunmuş miqrasiyalar (uzaq baza) ilə migrations/ qovluğunu tutuşdur
   npx wrangler d1 migrations list collabix-db --remote
   ```
2. `package.json`-da deploy script-ini qapıdan keçir:
   ```json
   "predeploy": "node scripts/check-migrations.mjs --remote",
   "deploy": "wrangler deploy"
   ```
   npm `predeploy`-u avtomatik icra edir → qayda **yaddaşdan koda** keçir.
3. `migrations/README.md` §6-da prosesi yaz.

⚠️ **Qadağa:** ❌ GitHub Actions / CI pipeline **qurma** — Task 10-dur. Sən yalnız lokal qapını qoyursan; CI onu sonra çağıracaq.

---

### 5.7 · `migration-cf/` artefaktlarının həlli

**Miras:** Task 1 §5.4 · **Həcm:** 45 dəqiqə

**Nədir:** `migration-cf/import.sql` **53 istifadəçinin PBKDF2 heşini** saxlayır. Açıq mətn deyil (Task 1-də açıq mətnli mənbə `legacy/` ilə silindi), lakin miqrasiya tamamlandığı üçün fayl artıq lazımsızdır.

Task 1 silmədi, çünki `package.json:15-16` `db:import:*` script-ləri ona istinad edir.

**Tələb:**

1. **Miqrasiyanın tamamlandığını təsdiqlə:**
   ```sql
   SELECT COUNT(*) FROM users WHERE id LIKE 'legacy_%';
   ```
   (Task 3 hesabatı `legacy_*` prefiksinin miqrasiya olunmuş sətir ID-si olduğunu qeyd edir.)
   Sətirlər bazadadırsa → miqrasiya bitib → fayl lazımsızdır.

2. **Qərar ver:**

   | Variant | Nə vaxt | Əməliyyat |
   |---|---|---|
   | **Sil** | Miqrasiya təsdiqlənib, təkrar lazım deyil | Fayllar + `package.json` script-ləri silinir |
   | **Arxivləşdir** | Ehtiyat üçün saxlanılır | Repo-dan **kənara** çıxarılır, script-lər silinir |
   | **Saxla** | Bərpa ehtimalı var | ⚠️ `.gitignore`-dadır (Task 2-də əlavə edildi) → git-ə düşmür, lakin diskdə qalır |

   Tövsiyə: **arxivləşdir + script-ləri sil**. Fayl bir daha lazım olarsa arxivdən gətirilər; `package.json`-da qalan script isə kiminsə onu təsadüfən yenidən icra etməsi riskidir.

3. **`update.sql`** üçün eyni qərar (Task 2 hesabatı onun **real istifadəçi post məzmunu** daşıdığını qeyd edir).

4. Silmədən əvvəl `git grep -n "import.sql\|update.sql"` ilə başqa istinad olmadığını təsdiqlə.

---

### 5.8 · Qərar qapısı — `is_system` + `priority NOT NULL` miqrasiyası

**Miras:** Task 3 §4, Task 3 §8/3 · **Həcm:** 45 dəqiqə (təsdiqlənərsə)

Task 3 iki bağlı təklif buraxdı:

| Təklif | Mənbə | Səbəb |
|---|---|---|
| `team_roles.is_system` sütunu | Task 3 §4 | Ad əsaslı (`name === 'Owner'`) qoruma kövrəkdir |
| `team_roles.priority NOT NULL DEFAULT 0` | Task 3 §8/3 | NULL prioritet fail-closed 403 verir → istifadəçiyə "səbəbsiz rədd" kimi görünür |

Task 3 hesabatı ikisinin **eyni miqrasiyada** birləşdirilməsini təklif edir. Bu task miqrasiya task-ı olduğu üçün **məntiqi yeri buradır**.

**Tələb:**

1. **İstifadəçidən qərar istə.** Təsdiq gəlməsə **tətbiq etmə** — Task 3-dəki prioritet qaydası onsuz da əsas müdafiəni verir.
2. Təsdiqlənərsə:
   ```sql
   -- 00XX_team_roles_hardening.sql
   -- AUDIT-TASK-3 §4 + §8/3 → AUDIT-TASK-5 §5.8

   ALTER TABLE team_roles ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;
   UPDATE team_roles SET is_system = 1 WHERE name = 'Owner';
   UPDATE team_roles SET priority  = 0 WHERE priority IS NULL;
   ```
   ⚠️ SQLite `ALTER TABLE`-da mövcud sütunu `NOT NULL` etməyə icazə vermir → cədvəlin yenidən qurulması lazımdır (`CREATE TABLE new … ; INSERT … SELECT … ; DROP ; RENAME`). **Bu, ciddi əməliyyatdır** — dəyəri riskə dəyirmi, qiymətləndir və hesabatda əsaslandır. Sadəcə `UPDATE … WHERE priority IS NULL` + tətbiq səviyyəsində default kifayət edə bilər.
3. Tətbiq olunarsa, Task 3-dəki ad əsaslı yoxlamaları `is_system`-ə keçir.
4. ⚠️ **Sıra:** bu miqrasiya `drop_demo_seed`-dən **sonra** gəlməlidir — demo `role_1` silindikdən sonra `is_system` təyinatı təmiz data üzərində işləsin.

---

### 5.9 · Doğrulama və testlər

**Həcm:** 1,5 saat

#### 5.9.a — Silmənin doğrulanması
```sql
-- Hamısı 0 qaytarmalıdır
SELECT COUNT(*) FROM users      WHERE id = 'team_owner_123';
SELECT COUNT(*) FROM teams      WHERE id IN ('team_1','team_2','team_3');
SELECT COUNT(*) FROM team_roles WHERE id LIKE 'role_%';

-- 🟢 BOOTSTRAP data QALMALIDIR — 1 (və ya daha çox) qaytarmalıdır
SELECT COUNT(*) FROM rooms WHERE id = 'general';
```

#### 5.9.b — Canlı saytda görünmə testi

Demo obyektlərin **görünən** yerlərini yoxla (auditin sadaladığı 5 yer):

| Endpoint | Yoxlama |
|---|---|
| `GET /api/users` | `teamowner_123` yoxdur |
| `GET /api/users/directory` | yoxdur |
| `GET /api/search?q=Team Owner` | nəticə yoxdur |
| `GET /api/users/suggest` | yoxdur |
| `GET /api/stats/public` | sayğac 1 azalıb |
| XP liderliyi | `Team Owner` yoxdur |

⚠️ **FTS indeksi** — axtarış hələ də nəticə qaytarırsa, `users_fts` təmizlənməyib (bax 5.3).

#### 5.9.c — E2E dəsti

```bash
rm -rf .wrangler/state          # ⚠️ yalnız LOKAL
npm run db:migrate:local
npm run e2e:seed
npx playwright test
```

**Bu, 5.4-ün əsas sübutudur:** sıfırdan qurulmuş baza üzərində E2E dəsti sınmamalıdır.

#### 5.9.d — Yeni testlər

```ts
test.describe('AUDIT H-7 — demo seed təmizliyi', () => {

  test('istehsal datasında saxta istifadəçi yoxdur', async ({ request }) => {
    const res = await request.get('/api/users?limit=200');
    const users = (await res.json()).users ?? [];
    expect(users.find((u) => u.username === 'teamowner_123')).toBeUndefined();
  });

  test('axtarışda demo komanda çıxmır', async ({ request }) => {
    const res = await request.get('/api/search?q=Alpha%20Team');
    // FTS indeksinin də təmizləndiyinin sübutu
    expect(JSON.stringify(await res.json())).not.toContain('alpha-team');
  });

  // ─── 🔴 REQRESSİYA — bootstrap data qorunub ───
  test('general otağı işləyir', async ({ request }) => {
    const res = await request.get('/api/rooms/general/messages');
    expect(res.status()).toBeLessThan(400);
  });

  test('otaq siyahısı boş deyil', async ({ request }) => {
    const res = await request.get('/api/rooms');
    expect((await res.json()).rooms?.length).toBeGreaterThan(0);
  });
});
```

⚠️ **İzolyasiya:** Task 4 §7/3 E2E paylaşılan sessiya qüsurunun ağırlaşdığını qeyd edir (28,8 dəqiqə). Bu testlər **yüngüldür** və izolə identity tələb etmir, lakin `@ratelimit` testləri kimi ayrıca teq (`@seed`) vermək faydalıdır.

---

## 4. ƏHATƏDƏN KƏNAR

| Tapıntı | Aid task | Səbəb |
|---|---|---|
| CI/CD pipeline (GitHub Actions) | **Task 10** | 5.6 yalnız **lokal** qapı qoyur |
| E2E paylaşılan sessiya refaktoru | **Ayrıca task** | Task 3 §8/1 + Task 4 §7/3 — struktur işdir |
| Atomik rate limiter (H-3) | **Task 9** | — |
| XP anti-abuse (H-5) | **Task 9** | Demo istifadəçinin XP-si silinir, sistem qalır |
| `serveFile` avtorizasiyası (C-1) | **Task 7** | — |
| Arxiv oxu yolu (C-3) | **Task 8** | — |
| M-5…M-17 validasiya paketi | **Task 6** | — |
| FTS `ə` normalizasiyası | **Task 10** | Axtarış keyfiyyəti — ayrı problem |
| `posts_fts` yalnız ilk 300 simvol | **Task 10** | — |
| Sosial cədvəllərdə çatışmayan FK | **Task 10** | Sxem refaktoru; 5.2 yalnız orphan-ları təmizləyir |
| PRD-nin 17 cədvəli | **Task 10** | Strateji qərar |
| `read` səbəti üçün sampling | **Task 9/10** | Task 4 §5.5 — istifadəçi qərarı |

---

## 5. İCRA QAYDALARI

### 5.1 Commit strategiyası

```
fix(db): demo seed istehsal bazasından təmizləndi

Audit: AUDIT-2026-07-26.md §H-7
Risk: High (data bütövlüyü)
Təsir: Saxta "Team Owner" istifadəçisi canlı saytda istifadəçi siyahısında,
       axtarışda, publicStats sayğacında və XP liderliyində görünürdü.
Yoxlama: §5.1 real-data bağlılığı — 0 real üzv, 0 real mesaj, 0 izləyici.
İxrac: repo-dan kənar arxiv (silmədən əvvəl).
QORUNDU: 0002_seed.sql-in `general` otağı (bootstrap data).
Test: e2e/*.spec.ts @seed — N test
```

**Sıra:** 5.0 → 5.1 → 5.2 → 5.5 → 5.6 → 5.4 → 5.3 → 5.9 → 5.7 → 5.8

⚠️ **5.3 (faktiki silmə) gec gəlir.** Səbəb: nömrələmə qaydası (5.5), deploy qapısı (5.6) və E2E seed müstəqilliyi (5.4) **ondan əvvəl** hazır olmalıdır. Beləliklə silmə baş verəndə testlər artıq demo datadan asılı olmur və qapı işləyir.

### 5.2 🔴 Geri dönməzlik qaydası

Bu task-da üç əməliyyat geri dönməzdir:

| Əməliyyat | Geri qaytarma | Şərt |
|---|---|---|
| İstehsal sətirlərinin silinməsi | ❌ Yalnız ixracdan bərpa | §5.1 yoxlaması + §5.2 ixracı **məcburidir** |
| `migration-cf/*.sql` silinməsi | ❌ Yalnız arxivdən | Miqrasiyanın bitdiyi təsdiqlənməlidir |
| Cədvəlin yenidən qurulması (5.8) | ❌ | Dəyəri riskinə dəyməlidir |

**`git revert` bunların heç birini geri qaytarmır.** Kod geri qayıdar, data yox.

### 5.3 Ad üzrə deyil, ID üzrə silmə

```sql
DELETE FROM teams WHERE name = 'Alpha Team';   -- ❌ TƏHLÜKƏLİ
DELETE FROM teams WHERE id   = 'team_1';       -- ✅ DÜZGÜN
```
Real istifadəçi eyniadlı komanda yaratmış ola bilər. **Həmişə ID.**

### 5.4 Lokal ≠ uzaq

`--local` və `--remote` bazaların vəziyyəti fərqlidir (Task 3 §8/2, Task 4 §8 bunu sübut edir). Hər sorğunu **hər iki** mühitdə işlət və nəticələri ayrıca yaz.

### 5.5 Şərh mədəniyyəti

Miqrasiya faylları **əbədi qalır** və gələcəkdə oxunur. Hər `DELETE`-in yanında **niyə silindiyi**, **hansı yoxlamadan keçdiyi** və **nəyin qəsdən silinmədiyi** yazılmalıdır.

---

## 6. QƏBUL MEYARLARI

| # | Meyar | Doğrulama | Gözlənilən |
|---|---|---|---|
| **1** | 🔴 **`general` otağı işləyir** | `GET /api/rooms/general/messages` | < 400 |
| **2** | 🔴 **Real istifadəçi datası itməyib** | §5.1 sorğuları silmədən sonra təkrar | real sətirlər yerindədir |
| **3** | 🔴 **Tam E2E dəsti sınmır** | `npx playwright test` | Task 4 nəticəsi ≥ |
| 4 | Saxta istifadəçi silinib | `SELECT … WHERE id='team_owner_123'` | 0 |
| 5 | Demo komandalar silinib | `SELECT … FROM teams WHERE id IN (…)` | 0 |
| 6 | Demo rollar silinib | `SELECT … FROM team_roles WHERE id LIKE 'role_%'` | 0 |
| 7 | Orphan sətir qalmayıb | FK-sız istinad cədvəlləri | 0 |
| 8 | FTS indeksi təmizdir | `GET /api/search?q=Team Owner` | nəticə yox |
| 9 | Aggregate sayğaclar düzgündür | `GET /api/stats/public` | say azalıb |
| 10 | Miqrasiya idempotentdir | eyni miqrasiyanı 2 dəfə tətbiq et | xəta yox |
| 11 | E2E seed miqrasiyadan asılı deyil | `.wrangler/state` sil → migrate → seed → test | yaşıl |
| 12 | Nömrə yoxlayıcısı işləyir | `npm run check:migrations` | exit 0 |
| 13 | Yeni dublikat bloklanır | süni dublikat yarat → yoxlayıcı | **xəta verir** |
| 14 | Deploy qapısı işləyir | tətbiq olunmamış miqrasiya ilə `npm run deploy` | **bloklanır** |
| 15 | Tətbiq olunmuş miqrasiya adı dəyişməyib | `git diff --name-status` | `migrations/` altında **rename yoxdur** |
| 16 | `migration-cf` istinadı qalmayıb | `git grep "import.sql\|update.sql"` | boş / yalnız sənəd |
| 17 | Strict TypeScript keçir | `npx tsc --noEmit` | exit 0 |
| 18 | Build uğurludur | `npm run build` | exit 0 |
| 19 | `migrations/README.md` mövcuddur | — | 6 bölmə |
| 20 | İxrac arxivi yaradılıb | — | repo-dan **kənarda** |

**Meyar 1, 2 və ya 3 ❌ olarsa:** dərhal dayan. Bunlar geri dönməz zərərin göstəriciləridir — kod revert-i kifayət etməz, ixracdan bərpa lazım ola bilər.

---

## 7. HESABAT FORMATI

`docs/AUDIT-TASK-5-REPORT.md`:

```markdown
# AUDIT-TASK-5 — İcra Hesabatı

**Tarix:** …   **İcraçı:** …   **Commit-lər:** <hash → başlıq>

## 0. Miqrasiya inventarı (5.0)
| Fayl | Cədvəl | Sətirlər | Sinif | Silindi? | Əsaslandırma |
### Dublikat nömrələr — faktiki vəziyyət
### Miqrasiya tarixçəsi cədvəli — <ad, sətir sayı>

## 1. 🔴 Real data bağlılığı yoxlaması (5.1)
| Yoxlama | Lokal | Uzaq | Hökm |
| Demo komandada real üzv | 0 | 0 | ✅ təmiz |
| Demo otaqda real mesaj | … | … | … |
| Saxta istifadəçinin izləyiciləri | … | … | … |
| **Saxta istifadəçinin sessiyaları** | … | … | ⚠️ >0 olsa HADİSƏ |

**Hökm:** <silməyə davam edildi / dayandırıldı — səbəb>

## 2. Silmə planı və icrası (5.2, 5.3)
| Sıra | Cədvəl | Gözlənilən | Faktiki | Uyğun? |
### İxrac arxivi — <təsvir, repo-dan kənar>

## 3. 🟢 Qəsdən SİLİNMƏYƏNLƏR
| Obyekt | Sinif | Səbəb |
| `general` otağı (0002_seed) | Bootstrap | Tətbiqin işləməsi üçün lazımdır |

## 4. Qəbul meyarları (20 sətir)

## 5. E2E seed müstəqilliyi (5.4)
### Sıfırdan qurma testi: `.wrangler/state` sil → … → nəticə

## 6. Nömrələmə nizamı (5.5)
### Tarixi dublikatlar — DÜZƏLDİLMƏDİ, səbəb: §5.5.a
### Yoxlayıcı script nəticəsi

## 7. Deploy qapısı (5.6)

## 8. migration-cf qərarı (5.7) — <sil / arxivləşdir / saxla>

## 9. is_system qərarı (5.8) — <tətbiq / təxirə salındı — istifadəçi qərarı>

## 10. Aşkarlanan yeni risklər

## 11. Açıq qalan öhdəliklər
- [ ] 🔴 Atomik limiter → Task 9
- [ ] 🔴 E2E paylaşılan sessiya refaktoru (Task 3 §8/1 + Task 4 §7/3) — **28,8 dəq**
- [ ] 🔴 `ARCHIVE_HOT_DAYS` → `"90"` (Task 8-dən sonra; əvvəlcə Privacy §4)
- [ ] 🔴 Hüquqi mətnin peşəkar nəzərdən keçirilməsi
- [ ] 🔴 `collabix.az` DNS + MX
- [ ] 🟠 TestSprite API açarının rotasiyası
- [ ] 🟠 53 hesaba parol sıfırlama qərarı
- [ ] 🟠 VÖEN, sosial profillər
- [ ] 🟡 GDPR ixracının rate limit-i Privacy-də qeyd olunsun (Task 4 §7/6)
- [ ] 🟡 İstehsalda p50/p95 gecikmə ölçməsi (Task 4 §5.3)
- [ ] 💡 `read` sampling (Task 4 §5.5)
- [ ] Git remote qərarı

## 12. Geri qaytarma planı
⚠️ Silinmiş sətirlər `git revert` ilə BƏRPA OLUNMUR.
| Dəyişiklik | Bərpa | Şərt |
| Kod / miqrasiya faylı | `git revert` | — |
| İstehsal sətirləri | ixrac arxivindən `INSERT` | yalnız zərurət halında |
```

---

## 8. BİRİNCİ ADDIM

**Yalnız oxu rejimində** aşağıdakıları icra et. **Heç bir `DELETE` yazma.**

1. **5.0/Sual 1** — miqrasiya siyahısı + dublikat nömrələr
2. **5.0/Sual 2** — 🔴 hər seed faylının təsnifatı (bootstrap / demo / referans). `0002_seed.sql`-i xüsusi qeyd et
3. **5.0/Sual 4** — demo sətirlər lokal və uzaq bazada mövcuddurmu
4. **5.0/Sual 5** — FK qrafiki + FK-sız istinadlar
5. **5.1** — 🔴 real data bağlılığının tam yoxlaması (4 alt-sorğu, hər iki mühitdə)

**Üç dayanma şərti:**

| Şərt | Əməliyyat |
|---|---|
| `sessions` cədvəlində `team_owner_123` üçün sətir varsa | 🔴 **HADİSƏ** — dayan, bildir. Auditin "giriş mümkün deyil" nəticəsi yanlışdır |
| Demo obyektlərə **real istifadəçi datası** bağlıdırsa | ⚠️ Dayan. §5.1-dəki variantları təqdim et, qərar gözlə |
| Hər hansı seed faylının sinfi (bootstrap/demo) **qeyri-müəyyəndirsə** | ⚠️ Dayan, soruş. Səhv təsnifat `general` otağının silinməsi deməkdir |

Nəticələr təmiz çıxdıqdan sonra §5.1-dəki sıra ilə icraya başla — **5.3 (faktiki silmə) sondan əvvəl**.
