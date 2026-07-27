# AUDIT-TASK-3 — İcra Hesabatı

**Tarix:** 2026-07-27
**İcraçı:** Claude (Opus 5) — icra agenti
**Mənbə:** `AUDIT-2026-07-26.md` §H-1 · **Tapşırıq:** `AUDIT-TASK-3.md`
**Commit-lər:** aşağıda §7

---

## 0. Vəziyyət xəritəsi (3.0)

### İcazə kataloqu (Sual 1)

`worker/services/team/permissions.ts:9-20` — `TEAM_PERMISSIONS`, **10 element**:

```
manage_team · manage_settings · manage_roles · manage_members · manage_invites
manage_projects · manage_tasks · manage_files · manage_feed · manage_chat
```

`'*'` bu siyahıda **yoxdur** — yəni ağ siyahı filtri onu özü atır, xüsusi `if` lazım deyil.

### Rol matrisi (Sual 2)

`permissions.ts:31-54` — `STANDARD_ROLES`, 10 rol:

| Rol | Prioritet | İcazələr | `'*'` daşıyır? |
|---|---|---|---|
| Owner | 100 | `['*']` | 🔴 **BƏLİ** |
| Admin | 90 | 9 icazə — `manage_team` **YOX** | xeyr |
| Manager | 70 | projects, tasks, invites, files, feed | xeyr |
| Mentor | 60 | tasks, feed | xeyr |
| Moderator | 55 | feed, chat | xeyr |
| DevOps | 50 | tasks, files | xeyr |
| Developer | 45 | tasks, files | xeyr |
| Designer | 40 | tasks, files | xeyr |
| QA | 35 | tasks | xeyr |
| Viewer | 10 | — | xeyr |

Admin↔Owner sərhədi **yalnız `manage_team`**-dir (`permissions.ts:35` şərhi + `team-routes.ts` `deleteTeam` şərhi).

### 🔴 Owner necə saxlanılır (Sual 3) — TƏLƏ TƏSDİQLƏNDİ

**Cavab: Owner rolu bazada `permissions = '["*"]'` kimi saxlanılır və `hasPermission` wildcard-ı QİYMƏTLƏNDİRİR.**

Sübutlar:
- `permissions.ts:32` — `{ name: 'Owner', permissions: ['*'], priority: 100 }` (seed şablonu)
- `permissions.ts:76-79` — `hasPermission` → `permissions.includes('*') || permissions.includes(required)`
- `e2e/seed.ts:142,151` — `INSERT ... team_roles ... '["*"]'`
- Lokal bazada **53 sətir**: `name='Owner'`, `priority=100`, `permissions='["*"]'`

**3.1-ə təsiri:** §5.2-dəki tələ realdır. Ona görə düzəliş **yalnız GİRİŞ yolunda** aparıldı:

| Yol | Funksiya | Vəziyyət |
|---|---|---|
| Giriş (input) | `sanitizePermissions` | ✅ dəyişdirildi — `'*'` artıq qəbul olunmur |
| Qiymətləndirmə | `hasPermission` | ❌ **toxunulmadı** — wildcard hələ də qiymətləndirilir |

Bu invariant `e2e/team-permissions.spec.ts`-də **3 ayrıca testlə** kilidləndi ki, gələcəkdə kimsə "artıq lazım deyil" deyib silməsin.

### Bazadakı wildcard rollar (Sual 4)

| Baza | Cəmi rol | `'*'` daşıyan | Təsnifat |
|---|---|---|---|
| **Uzaq (production)** | 1 | **0** | — |
| **Lokal (dev/E2E)** | — | 53 | hamısı `name='Owner'`, `priority=100` → ✅ sistem seed-i |

Uzaq bazada `SELECT ... WHERE permissions LIKE '%*%'` **boş** qayıtdı. Yeganə rol sətri demo `role_1`-dir (aşağı, §5).

**Nəticə: istismar heç yerdə baş verməyib.** Sistem seed-i xaricində tək bir wildcard rol yoxdur.

### Sistem bayrağı (Sual 5) — **YOX**

`migrations/0014_schema_team.sql:19-26` — `team_roles(id, team_id, name, permissions, priority)`.
`is_system` / `is_default` / `protected` sütunu **yoxdur**. → 3.4 qərar qapısı işə düşdü (§4).

### Prioritet istiqaməti (Sual 6) — **YÜKSƏK RƏQƏM GÜCLÜDÜR**

Kod sübutları (dördü də eyni istiqaməti göstərir):
1. `permissions.ts:30` — *"`priority` böyükdürsə səlahiyyət yüksəkdir"*
2. `STANDARD_ROLES`: Owner **100** → Viewer **10**
3. `role.service.ts:15` və `member.service.ts:17` — `ORDER BY priority DESC` (güclü rol öndə)
4. `js/teams.js` rol modalı — *"Prioritet (böyük = yüksək)"* etiketi

→ Qayda: `hədəf.priority > çağıran.priority` ⇒ **RƏDD**.

---

## 1. Bağlanan tapıntılar

| Audit ID | Bənd | Vəziyyət | Sübut |
|---|---|---|---|
| H-1 | 3.1 · wildcard giriş | ✅ | `permissions.ts:132` (`sanitizePermissions`) |
| H-1 | 3.2 · altçoxluq | ✅ | `permissions.ts:101` + `team-routes.ts:67` (`denyEscalation`) |
| H-1 | 3.3 · prioritet | ✅ | `team-routes.ts:82` (`denyHigherPriority`) — 3 hücum bağlandı |
| — | 3.4 · sistem bayrağı | 💡 | təklif — tətbiq edilmədi, bax §4 |
| — | 3.5 · data təmizliyi | ✅ | 0 şübhəli rol (hər iki bazada) |
| — | 3.6 · E2E | ✅ | **16 protokol + 12 saf funksiya** testi |
| — | + dəvət yolu (auditdə yox) | ✅ | `team-routes.ts:475` — bax §8/5 |

### Nə dəyişdi — fayl-fayl

| Fayl | Dəyişiklik |
|---|---|
| `worker/services/team/permissions.ts` | `sanitizePermissions`-dən `'*'` qısayolu çıxarıldı; `expandPermissions` + `findEscalatedPermissions` əlavə edildi; `hasPermission`-a "SİLMƏ" xəbərdarlığı yazıldı |
| `worker/middleware/team-auth.ts` | `getMembership`-ə `r.priority AS role_priority` əlavə olundu; yeni `getTeamAuthority` (fail-closed, sayt admini/komanda sahibi = `Infinity`) |
| `worker/team-routes.ts` | `loadAuthority` / `denyEscalation` / `denyHigherPriority` köməkçiləri + **5 endpoint**-də tətbiq (`createTeamRole`, `updateTeamRole`, `deleteTeamRole`, `updateMemberRole`, `createTeamInvite`) |
| `worker/services/team/role.service.ts` | SİSTEM yolu (`insertRole`, sanitizasiyasız) İSTİFADƏÇİ yolundan (`createRole`) ayrıldı |
| `e2e/teams-rbac.spec.ts` | `AUDIT H-1` bloku — 16 test; `loginAs` köməkçisi |
| `e2e/team-permissions.spec.ts` | **yeni** — 12 saf funksiya testi (meyar 2–4, 6 + §5.2 invariantı) |

### Müdafiə qatları (defense in depth)

| # | Qat | Yer | Nəyi bağlayır |
|---|---|---|---|
| 1 | Ağ siyahı | `sanitizePermissions` | `permissions: ['*']` |
| 2 | Altçoxluq | `denyEscalation` | açıq `permissions: ['manage_team']` |
| 3 | Prioritet — yaratma | `createTeamRole` | `priority: 99` ilə Owner-üstü rol |
| 4 | Prioritet — təyinat | `updateMemberRole` | Owner rolunu özünə/başqasına vermək |
| 5 | Prioritet — redaktə/silmə | `updateTeamRole`, `deleteTeamRole` | Owner rolunu zəiflətmək, silmək, adını dəyişmək |
| 6 | Altçoxluq — təyinat | `updateMemberRole` | köhnə data: prioriteti aşağı, icazəsi güclü rol |
| 7 | Prioritet + altçoxluq — dəvət | `createTeamInvite` | rolu dəvətlə ötürmək (auditdə yox — bax §8/5) |
| 8 | Ad əsaslı (köhnə) | `role.name === 'Owner'` | saxlanıldı — sahib üçün 400 davranışı dəyişmədi |

**Normallaşdırma nüansı (6-cı qat).** `denyEscalation` girişi normallaşdırılmış gözləyir və mənbəyə görə iki fərqli funksiya işlədilir:

| Mənbə | Normallaşdırma | Səbəb |
|---|---|---|
| İstifadəçi gövdəsi (`b.permissions`) | `sanitizePermissions` | orada `'*'` uydurma dəyərdir → atılır |
| Bazadakı rol (`target.permissions`) | `expandPermissions` | orada `'*'` **ƏSL** səlahiyyətdir → açılmalıdır |

Səhv seçim gizli boşluq yaradırdı: bazadakı `['*']` rol sanitizasiyadan `[]` kimi çıxıb altçoxluq yoxlamasını yalançı keçirdi. `team-routes.ts:67`-dəki şərh bunu qeyd edir.

**Sıra vacibdir:** `updateTeamRole` / `deleteTeamRole`-da prioritet yoxlaması ad yoxlamasından **ƏVVƏL** gəlir. Belə olduqda Admin 403 alır, komanda sahibi isə (`priority = Infinity`) keçib köhnə 400 cavabını alır — `teams-rbac.spec.ts:215` testi olduğu kimi yaşıl qalır.

---

## 2. Qəbul meyarları

| # | Meyar | Doğrulama | Nəticə |
|---|---|---|---|
| **1** | 🔴 **Owner reqressiyası yoxdur** | `playwright test teams-rbac --grep "Owner"` | ✅ hamısı yaşıl |
| 2 | Wildcard girişdən qəbul olunmur | `sanitizePermissions(['*'])` | ✅ `[]` |
| 3 | Etibarlı icazələr keçir | `sanitizePermissions(['manage_members'])` | ✅ `['manage_members']` |
| 4 | Dublikat təmizlənir | `sanitizePermissions(['a','a'])` | ✅ tək nüsxə |
| 5 | Altçoxluq qaydası işləyir | Admin → `['manage_team']` | ✅ 403 + `code:'forbidden'` |
| 6 | Owner bloklanmır | Owner → tam kataloq ilə rol | ✅ 200 |
| 7 | Prioritet — təyin (özünə) | Admin → Owner rolu özünə | ✅ 403 |
| 8 | Prioritet — üçüncü şəxs | Admin → Owner rolu `e2e_camal`-a | ✅ 403 |
| 9 | Prioritet — redaktə | Admin → Owner rolunu PATCH | ✅ 403 |
| 10 | Prioritet — silmə | Admin → Owner rolunu DELETE | ✅ 403 |
| 11 | Ad dəyişikliyi ilə yayınma | Admin → Owner rolunu adlandırır | ✅ 403 |
| 12 | Zəncirin sonu bağlıdır | Admin → `DELETE /api/teams/:id` | ✅ 403 |
| 13 | Strict TypeScript | `npx tsc --noEmit` | ✅ exit 0 |
| 14 | Build | `npm run build` | ✅ exit 0 |
| 15 | Tam E2E reqressiya | `npm run e2e` | ✅ 209/84 — baseline 115/150, bax §6.1 |
| 16 | Şübhəli wildcard rol qalmayıb | 3.0/Sual 4 təkrarı | ✅ yalnız sistem `Owner` rolları |
| 17 | Fail-closed | üzv olmayan → rol yaratmaq | ✅ 403 (500 deyil) |

---

## 3. İstismar zəncirinin bağlandığının sübutu

Aktyor: **`e2e_bahram`** — komanda `Admin` rolunda, **sayt admini deyil**.
(`e2e_main` sayt adminidir və `requireTeamPermission`-dan keçir — onunla bu ssenari yoxlana bilməz.)

| Addım | Sorğu | Əvvəl | İndi | Test |
|---|---|---|---|---|
| 1 | `POST /roles {permissions:['*']}` | 201 + `['*']` | **201 + `[]`** (wildcard süzülür) | `Admin permissions:['*'] ilə səlahiyyət ala bilmir` |
| 1b | `POST /roles {permissions:['manage_team']}` | 201 | **403** `forbidden` | `Admin ... manage_team ... VERƏ BİLMƏZ` |
| 1c | `POST /roles {priority:99}` | 201 | **403** `forbidden` | `Admin özündən yüksək prioritetli rol YARADA BİLMƏZ` |
| 2 | `PATCH /members/<özü> {roleId:<Owner>}` | 200 | **403** | `Admin Owner rolunu ÖZÜNƏ təyin edə bilməz` |
| 2b | `PATCH /members/<3-cü şəxs> {roleId:<Owner>}` | 200 | **403** | `... BAŞQASINA da təyin edə bilməz` |
| 3 | `DELETE /api/teams/:id` | 200 | **403** | `Admin komandanı SİLƏ BİLMƏZ` |
| 1→3 | tam zəncir ardıcıl | komanda **silinirdi** | komanda **yerindədir** | `3 sorğuluq Admin→Owner zənciri komandanı silə bilmir` |

Əlavə bağlanan hücumlar (auditdə yox idi):

| Hücum | İndi | Test |
|---|---|---|
| Owner rolunun icazələrini azaltmaq | 403 | `Admin Owner rolunu REDAKTƏ edə bilməz` |
| Owner rolunun prioritetini endirmək | 403 | `Admin Owner rolunun prioritetini ENDİRƏ bilməz` |
| Öz rolunun prioritetini qaldırmaq | 403 | `Admin öz rolunun prioritetini QALDIRA bilməz` |
| Owner rolunu silmək | 403 | `Admin Owner rolunu SİLƏ bilməz` |
| Owner rolunu yenidən adlandırmaq | 403 | `Admin Owner rolunu YENİDƏN ADLANDIRA bilməz` |
| Aşağı prioritetli, güclü icazəli rolu özünə təyin etmək | 403 | `Admin AŞAĞI prioritetli, lakin güclü rolu da özünə təyin edə bilməz` |
| Güclü rolu **dəvətlə** ötürmək | 403 | `Admin özündən güclü rola DƏVƏT göndərə bilməz` |

### Reqressiya sübutu (meyar 1 və 6)

`Owner BÜTÜN səlahiyyətlərini saxlayır` testində sahib qəsdən **`e2e_camal`**-dır — yəni sayt admini **deyil**, `c.isAdmin` yan qapısı işləmir. Yoxlanan əməliyyatlar: rol yaratma ✅, rol redaktəsi ✅, üzv rolunun dəyişdirilməsi ✅, rol silmə ✅, komanda parametrləri ✅, komanda silmə ✅.

---

## 4. `is_system` miqrasiyası — QƏRAR QAPISI (3.4)

**Sütun mövcud deyil.** Tapşırıq §3.4-ə görə **tətbiq edilmədi**, təklif kimi qeyd olunur.

Səbəb: prioritet qaydası (3.3) əsas müdafiəni **onsuz da** verir və rolun yenidən adlandırılması ilə yayınmağa imkan qoymur — sxem dəyişikliyi bu task-ın tələb etdiyi qorumaya əlavə heç nə vermir, riski isə artırır.

Təsdiqlənərsə tətbiq oluna bilər (növbəti nömrə **0020** — ən yüksək mövcud `0019_task11_hardening.sql`):

```sql
-- migrations/0020_team_roles_system_flag.sql
-- AUDIT-TASK-3 / H-1: ad əsaslı Owner qoruması kövrəkdir.
-- Rol adı istifadəçi girişidir; sistem rolları struktur bayraqla işarələnməlidir.
ALTER TABLE team_roles ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;

UPDATE team_roles SET is_system = 1 WHERE name = 'Owner';
```

⚠ Tətbiq edilsə `team-routes.ts`-dəki `role.name === 'Owner'` yoxlamaları `role.is_system`-ə keçirilməlidir.

---

## 5. Data təmizliyi (3.5)

| Baza | Şübhəli (istifadəçi tərəfindən yaradılmış) wildcard rol | Əməliyyat |
|---|---|---|
| Uzaq (production) | **0** | — |
| Lokal (dev/E2E) | **0** (53 sətrin hamısı sistem `Owner`-idir) | — |

**Normallaşdırma tələb olunmadı.** Heç bir rol dəyişdirilmədi, heç nə silinmədi.

### İstismarın baş verib-vermədiyi (3.5/bənd 4)

Uzaq bazada: `teams` = 1 (demo), `team_activity` = **0** sətir, `status != 'active'` komanda = **0**.
Yəni production-da real komanda datası hələ yoxdur və silinmiş komanda izi də yoxdur → **istismar baş verməyib**.

### Task 5-ə ötürülən tapıntı

`migrations/0018_seed_fix_admin_permissions.sql` demo `role_1` rolunu (`team_1`, adı **"Admin"**, prioritet **10**) `manage_team` ilə eskalasiya edir:

```sql
UPDATE team_roles SET permissions = '[... "manage_team", "manage_roles"]' WHERE id = 'role_1';
```

Bu sətir uzaq bazadakı **yeganə** rol qeydidir. Tapşırıq §3.5/2-yə görə burada **silinmədi** — demo seed təmizliyi **Task 5**-in əhatəsidir.

⚠ Diqqət: `role_1` prioriteti **10**-dur, lakin `manage_team` daşıyır — yəni "aşağı prioritet = zəif" ehtimalını pozur. Məhz buna görə `updateMemberRole`-da prioritet yoxlamasına **əlavə olaraq** altçoxluq yoxlaması da qoyuldu (`team-routes.ts:270`): belə köhnə rol təyinatla verilə bilməz.

---

## 6. Test nəticələri

| Dəst | Nəticə |
|---|---|
| `team-permissions.spec.ts` (saf funksiya) | **12 / 12 ✅** |
| `teams-rbac.spec.ts` (protokol) | **34 / 34 ✅** — 16-sı yeni `AUDIT H-1` testi |
| Birgə icra (`teams-rbac` + `team-permissions`, desktop) | **46 / 46 ✅** |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 |
| `npm run e2e` (tam dəst, hər iki layihə) | **209 keçdi / 84 uğursuz** — baseline 115/150-dən yaxşıdır, bax §6.1 |

### 6.1 Tam dəst — meyar 15 (`Task 2 nəticəsi ≥`)

| İcra | Keçdi | Uğursuz | Müddət |
|---|---|---|---|
| **AUDIT-TASK-2 baseline** (həmin hesabat §2.1) | 115 | 150 | 20,9 dəq |
| **AUDIT-TASK-3 (bu icra)** | **209** | **84** | 26,0 dəq |

Hər iki oxda yaxşılaşma var → **meyar 15 ödənilir**. (Müddətin artması gözləniləndir: dəstə 28 yeni test əlavə olundu.)

#### Qalan 84 uğursuzluq mənim dəyişikliyimə aid deyil — sübutlar

**1. Bölgü.** 62 uğursuzluq `[mobile]`, 22 `[desktop]`.
`[mobile]`-dakı tam çökmə AUDIT-TASK-2 §2.1/B-də **artıq sənədləşdirilib**: bütün spec-lər `AUTH_FILE`-dakı EYNİ sessiyanı paylaşır, refresh token isə hər istifadədə rotasiya olunur; ~15 dəqiqədən sonra reuse aşkarlanır və `revokeAllSessions` işə düşür. Sıra `desktop → mobile` olduğu üçün mobile ölü sessiya ilə başlayır. Dəst 26 dəqiqə çəkdiyinə görə bu qüsur bu icrada da təkrarlandı.

**2. Komanda testləri təmizdir.** `teams-rbac`, `team-permissions` — **desktop-da 46/46 yaşıl**. `teams.spec.ts`-in 12 uğursuzluğunun **hamısı yalnız `[mobile]`**-dadır (yuxarıdakı sessiya qüsuru); desktop-da hamısı keçir.

**3. Desktop uğursuzluqları toxunmadığım kod yollarındadır.** 22-nin 13-ü `admin.spec.ts` / `admin-level.spec.ts`, qalanı `messages`, `realtime`, `security`, `ux-phase`, `ws-flow`, `responsive-audit`. Uğursuzluq forması UI görünürlüyüdür (`#adminUserList .admin-user-row` → `hidden`, `.skeleton` qalır) — avtorizasiya cavabı deyil.

**4. İzolə icrada da eyni cür sınır.** `playwright test admin.spec.ts admin-level.spec.ts --project=desktop` təkbaşına: **13 uğursuz / 10 keçdi** — yəni dəst kontekstindən asılı deyil, mühit/UI problemidir.

**5. Asılılıq zənciri yoxdur.** Dəyişdirdiyim modulları (`services/team/permissions.ts`, `middleware/team-auth.ts`, `services/team/role.service.ts`, `team-routes.ts`) yalnız `team-routes.ts` və `routes.ts` import edir; `routes.ts`-dəki yeganə istifadə komanda **fayl yükləmə**si üçün `requireTeamPermission`-dır — həmin funksiyanın məntiqi **dəyişdirilməyib** (yalnız `getMembership`-in `SELECT`-inə sütun əlavə olunub). Admin paneli, WS/DO, mesajlaşma və responsiv testlər bu modullara heç toxunmur.

### Yol boyu aşkarlanan test mühiti problemi (kod problemi deyil)

`komanda hadisələri aktivlik jurnalına düşür` testi bir icrada sındı, sonrakılarda keçdi.
Səbəb **flakiness**: aktivlik jurnalı Queues üzərindən **eventual**-dır və lokal `wrangler dev`-də
`Binding VECTORIZE needs to be run remotely` xətası növbə emalını ləngidir.
**Doğrulandı:** həmin test həm dəyişikliksiz (`git stash`) kodda, həm də dəyişikliklə keçir → RBAC düzəlişi ilə əlaqəsi yoxdur.

---

## 7. Commit-lər

| Hash | Bənd | Başlıq |
|---|---|---|
| `b2be1f5` | 3.1 | `fix(rbac): '*' wildcard istifadəçi girişindən çıxarıldı` |
| `82f0a3d` | 3.2 + 3.3 | `fix(rbac): rol iyerarxiyası — altçoxluq və prioritet qaydaları` |
| `03888fa` | 3.6 | `test(rbac): AUDIT H-1 eskalasiya zənciri üçün E2E dəsti` |
| *(bu commit)* | 3.4/3.5 | `docs(audit): AUDIT-TASK-3 icra hesabatı` |

Push edilmədi — git remote qərarı hələ açıqdır (§9).

---

## 8. Aşkarlanan yeni risklər

1. 🟠 **E2E paylaşılan sessiya qüsuru daha da kritikləşdi.** AUDIT-TASK-2 §2.1/B-də sənədləşdirilən problem (bir `AUTH_FILE`, rotasiya olunan refresh token → ~15 dəqiqədən sonra `revokeAllSessions`) dəst uzandıqca daha çox testi udur. Bu task dəstə 28 test əlavə etdi və müddət 20,9 → 26,0 dəqiqəyə çıxdı. Dəst böyüdükcə mobile layihəsi tamamilə istifadəsiz olacaq. **Təklif:** hər spec faylı öz izolə kontekstində giriş etsin (bu task-dakı `loginAs` köməkçisi hazır nümunədir) və ya `globalSetup` hər layihə üçün ayrı `storageState` yaratsın. Ayrıca task kimi planlaşdırılmalıdır.
2. **Lokal D1 seed drift-i (orta).** `db:migrate:local` "No migrations to apply" deyirdi, lakin `0015_seed_teams.sql`-in sətirləri (`team_1`, `team_owner_123`) bazada **yox** idi → `global-setup` FK xətası ilə sınırdı. Miqrasiya cədvəli "tətbiq olunub" saydığı üçün wrangler onları bir daha işlətmir. Seed faylları əl ilə yenidən icra edildi (hamısı `OR IGNORE` — idempotentdir). **Təklif:** E2E seed-i `team_1`/`role_1` sətirlərini özü `INSERT OR IGNORE` etsin, miqrasiya tarixçəsinə güvənməsin.
3. **`updateMemberRole` üçün `roleId` NULL prioritetli olarsa 403 verir (fail-closed).** `team_roles.priority` sütunu `DEFAULT 0`-dır və NULL ola bilər; belə sətir rol idarəetməsində rədd olunur. Bu, §5.3-ə uyğun qəsdən seçimdir, lakin pozulmuş data varsa istifadəçiyə "səbəbsiz 403" kimi görünə bilər. `is_system` miqrasiyası tətbiq edilərsə `priority NOT NULL DEFAULT 0` da eyni miqrasiyada düzəldilə bilər.
4. **`getTeam` cavabı sayt admininə `permissions: ['*']` qaytarır** (`team-routes.ts:102`). Bu, yalnız UI düymələri üçündür və avtorizasiya qərarı deyil, lakin front-end-də wildcard-ın "normal dəyər" kimi görünməsini davam etdirir. Toxunulmadı — davranış dəyişikliyi bu task-ın əhatəsində deyil.
5. **`adminTeamAction` yolu bu qoruyuculardan keçmir** (tapşırıq §3.2 belə tələb edir: "Yoxla və toxunma"). Yoxlanıldı — ayrı yoldur, dəyişdirilmədi. Audit izi problemi (M-11) **Task 6**-dadır.
6. 🟠 **Dəvət yolu — auditdə sadalanmayan eyni sinifli boşluq (BAĞLANDI).** Audit §H-1 yalnız `createTeamRole` / `updateTeamRole` / `updateMemberRole`-u sadalayır. Lakin `createTeamInvite` dəvətə `roleId` bağlamağa icazə verir — bu da səlahiyyət verməkdir, sadəcə bir addım gecikməli. `invite.service.ts:23` yalnız `role.name === OWNER_ROLE` yoxlayırdı, yəni **adı fərqli, lakin güclü** rol (demo `role_1` kimi) dəvətlə ötürülə bilərdi. Tapşırığın §3.2 qaydası ("verilən icazə çağıranın dəstinin altçoxluğu olmalıdır") bu endpoint-siz natamam qalırdı, ona görə eyni iki qoruyucu ora da tətbiq edildi (commit `e320722`). Task 2 §5.2-dəki dərsin təkrarı: **auditin siyahısı başlanğıc nöqtəsidir, tam siyahı deyil.**

---

## 9. Açıq qalan öhdəliklər

- [ ] 💡 `is_system` miqrasiyası (`0020`) — **təklif olundu, istifadəçi qərarı gözləyir** (§4)
- [ ] Demo seed rolunun (`role_1` — `manage_team`) təmizliyi → **Task 5**
- [ ] E2E seed-inin miqrasiya tarixçəsindən asılılığının aradan qaldırılması (§8/1)
- [x] 3.5-də aşkarlanan şübhəli rollar — **yoxdur**

### Əvvəlki task-lardan miras

- [ ] 🔴 `ARCHIVE_HOT_DAYS` → `"90"` (Task 8-dən sonra) — əvvəlcə Privacy §4-ə arxivləmə açıqlaması (LEGAL-GAPS §2.2)
- [ ] 🔴 Hüquqi mətnin peşəkar nəzərdən keçirilməsi (LEGAL-GAPS §2.4, §2.1)
- [ ] 🔴 `collabix.az` DNS + MX
- [ ] 🟠 TestSprite API açarının rotasiyası
- [ ] 🟠 53 hesaba parol sıfırlama qərarı
- [ ] 🟠 VÖEN, sosial profillər (real olduqda)
- [ ] Git remote qərarı

---

## 10. Geri qaytarma planı

| Commit | Revert | Gözlənilən təsir |
|---|---|---|
| 3.1 (wildcard) | `git revert <hash>` | `permissions: ['*']` yenidən qəbul olunur — H-1-in 1-ci halqası açılır. Qalan 5 müdafiə qatı zənciri hələ də bağlı saxlayır |
| 3.2/3.3 (iyerarxiya) | `git revert <hash>` | Altçoxluq və prioritet qaydaları düşür; ad əsaslı `'Owner'` qoruması qalır — yəni **"Ops" adlı güclü rol** yolu yenidən açılır |
| 3.6 (testlər) | `git revert <hash>` | Reqressiya qoruması itir; kod davranışı dəyişmir |

⚠ **Heç bir halda `hasPermission`-dan wildcard dəstəyini çıxarmayın** — bax §0/Sual 3 və `permissions.ts:69-75` şərhi. Bu, təhlükəsizlik düzəlişi deyil, hadisədir: hər komandanın Owner-i öz komandasından kilidlənər.
