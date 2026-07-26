# AUDIT-TASK-3 — Komanda RBAC Eskalasiyasının Bağlanması

**Layihə:** Collabix
**Mənbə audit:** `AUDIT-2026-07-26.md` §H-1 (sətir 393–425)
**Əlavə mənbələr:** `AUDIT-TASK-1-REPORT.md`, `AUDIT-TASK-2-REPORT.md`
**Bağlanan tapıntılar:** **H-1** (High — privilege escalation)
**Təxmini həcm:** 0,5 gün + test
**Ön şərt:** AUDIT-TASK-2 tamamlanmış olmalıdır (git repo mövcuddur → bənd-bənd commit mümkündür)
**Risk sinfi:** ⚠️ **Bu, ilk task-dır ki, işlək avtorizasiya məntiqini dəyişir.** Səhv icra Owner-ləri öz komandalarından kilidləyə bilər — §5.2-dəki tələni oxu.

---

## GOAL KOMANDASI (qısa forma)

```
/goal AUDIT-3  Komanda RBAC-ında '*' wildcard eskalasiyasını bağla:
               istifadəçi girişindən '*' çıxarılsın (QİYMƏTLƏNDİRMƏ yoluna TOXUNMA),
               verilən icazələr çağıranın öz dəstinin altçoxluğu olsun,
               yüksək prioritetli rol redaktə/təyin edilə bilməsin,
               artıq eskalasiya olunmuş rollar təmizlənsin.
               DONE: 3 sorğuluq Admin→Owner zənciri E2E-də 403 verir
                     VƏ mövcud Owner-lər bütün səlahiyyətlərini saxlayır.
```

---

# TAM PROMPT

> Aşağıdakı hissəni olduğu kimi icra agentinə ver.

---

## 1. ROL

Sən Collabix layihəsində işləyən **kıdemli təhlükəsizlik mühəndisisən**.

Əvvəlki iki task **silmə və mətn dəyişikliyi** idi — sındırma riski aşağı. Bu task fərqlidir: sən **canlı avtorizasiya qərar məntiqini** dəyişirsən. Səhv icra iki istiqamətdə zərər verir:

- **Çox sərt** → mövcud Owner-lər öz komandalarını idarə edə bilmir (funksional çökmə).
- **Çox yumşaq** → escalation yolu açıq qalır (təhlükəsizlik çökməsi).

Ona görə bu task-ın **birinci qəbul meyarı təhlükəsizlik deyil, reqressiyanın olmamasıdır**: mövcud Owner rolunun bütün səlahiyyətləri dəyişikliydən sonra işləməlidir.

---

## 2. KONTEKST

### 2.a Komanda RBAC modeli

Collabix-də **iki ayrı avtorizasiya qatı** var və onları qarışdırmaq olmaz:

| Qat | Yer | Model |
|---|---|---|
| **Platforma** | `worker/index.ts` route cədvəli | Binar: `auth: true` / `admin: true`. `users.role` sütunu var, lakin **heç bir avtorizasiya qərarında oxunmur** |
| **Komanda** | `worker/services/team/permissions.ts` + `team-routes.ts` | Real RBAC: 10 rol, 10 icazə, prioritet sistemi |

Bu task **yalnız ikinci qata** aiddir. Platforma RBAC-ı (PRD-dəki 9 rol) Task 10-un strateji qərarıdır.

> **Qeyd:** `worker/services/` altında audit **23 boş sinif stub-u** tapıb. `services/team/` bunlardan **deyil** — o, işlək koddur. Qarışdırma.

### 2.b Tapıntı — H-1

**Yer:** `permissions.ts:100-104` (`sanitizePermissions`) + `team-routes.ts:272-288` (`createTeamRole`) + `team-routes.ts:203-224` (`updateMemberRole`)

`sanitizePermissions` **qəsdən** wildcard qəbul edir:
```ts
export function sanitizePermissions(input: unknown): string[] {
  const list = Array.isArray(input) ? input.map(String) : [];
  if (list.includes('*')) return ['*'];        // ← istifadəçi girişindən qəbul olunur
  …
}
```

Standart **Admin** rolu (`permissions.ts:31-40`) `manage_roles` + `manage_members` daşıyır, lakin **qəsdən** `manage_team` daşımır. Bu, sənədləşdirilmiş sərhəddir — `deleteTeam` (`team-routes.ts:129`) şərhdə açıq yazır:

> *"Silmək yalnız `manage_team` (Owner) səlahiyyətidir — Admin silə bilməz."*

### 2.c İstismar zənciri (3 sorğu, auditdə doğrulanmış)

| # | Sorğu | Tələb olunan icazə | Nəticə |
|---|---|---|---|
| 1 | `POST /api/teams/:id/roles` → `{ name: "Ops", permissions: ["*"], priority: 99 }` | `manage_roles` ✅ Admin-də var | Wildcard rol yaradıldı |
| 2 | `PATCH /api/teams/:id/members/<özüm>` → `{ roleId: "<yeni>" }` | `manage_members` ✅ Admin-də var | Özünü həmin rola keçirdi |
| 3 | `DELETE /api/teams/:id` | `manage_team` — indi `'*'` daxilindədir | **Komanda silindi** |

2-ci addımın keçməsinin səbəbi: `updateMemberRole` yalnız `role.name === 'Owner'` **adını** və **komanda sahibinin** rolunu qoruyur. Yeni rol `"Ops"` adlanır və hədəf sahib deyil → keçir.

**Təsir:** Admin↔Owner sərhədi tamamilə keçilir. Admin komandanı silə, görünürlüyü dəyişə, bütün rolları yenidən yaza bilər.

**Test boşluğu:** `e2e/teams-rbac.spec.ts:208` yalnız *Owner rolunun adını* qoruyur — bu yolu tutmur.

### 2.d Əvvəlki task-lardan gələn dərs

`AUDIT-TASK-2-REPORT.md` §5.2: audit `js/legal.js`-də **3** placeholder saymışdı, faktiki say **18** idi — 6× az qiymətləndirmə. Eyni şey burada da mümkündür.

**Nəticə — bu task üçün məcburi qayda:** auditin sətir nömrələri və istismar təsviri **başlanğıc nöqtəsidir, həqiqət mənbəyi deyil.** 3.0 bəndi məhz bunun üçündür: əvvəlcə faktiki vəziyyəti özün xəritələ, sonra düzəlt.

---

## 3. ƏHATƏ — 7 BƏND

---

### 3.0 · Hazırkı vəziyyətin xəritələnməsi (ÖN İŞ, kod dəyişikliyi yoxdur)

**Həcm:** 45 dəqiqə

Heç bir sətir dəyişdirmədən aşağıdakı 6 sualı cavablandır və nəticəni hesabata yaz. Bu, sonrakı bəndlərin düzgünlüyünün əsasıdır.

#### Sual 1 — İcazə kataloqu nədir?
```bash
grep -n "TEAM_PERMISSIONS" -A 20 worker/services/team/permissions.ts
```
`TEAM_PERMISSIONS` massivinin **tam siyahısını** yaz. Bu, ağ siyahının həqiqət mənbəyidir.

#### Sual 2 — Standart rollar hansılardır və hansı icazələri daşıyır?
```bash
sed -n '1,120p' worker/services/team/permissions.ts
```
Cədvəl kimi yaz: rol adı → prioritet → icazə dəsti → `'*'` daşıyırmı?

#### Sual 3 — 🔴 **KRİTİK:** Owner rolu bazada necə saxlanılır?
```bash
grep -rn "'\*'\|\"\\*\"" worker/services/team/ worker/team-routes.ts migrations/
grep -rn "hasPermission\|can(\|checkPermission" worker/ | head -30
```

**Bu sualın cavabı bütün task-ı müəyyən edir:**

| Owner necə saxlanılır | Nəticə |
|---|---|
| `permissions = ['*']` və `hasPermission` wildcard-ı **qiymətləndirir** | ⚠️ **TƏLƏ** — qiymətləndirmə yoluna toxunsan bütün Owner-lər kilidlənir. Yalnız **giriş** yolunu dəyiş |
| Owner icazələri **açıq sadalanır** (`['manage_team', 'manage_roles', …]`) | Wildcard-ı hər yerdən çıxarmaq təhlükəsizdir |
| Owner **rol sistemindən kənar** yoxlanılır (`teams.owner_uid === uid`) | Wildcard heç yerə lazım deyil |

#### Sual 4 — Bazada artıq neçə wildcard rol var?
```sql
SELECT id, team_id, name, priority, permissions
FROM team_roles
WHERE permissions LIKE '%*%';
```
(`npx wrangler d1 execute <DB> --command "…"` — həm lokal, həm uzaq bazada.)

**Bu, istismarın artıq baş verib-vermədiyini göstərir.** Sistem seed-i xaricində wildcard rol varsa → bax 3.5.

#### Sual 5 — `team_roles` sxemi sistem bayrağı daşıyırmı?
```bash
grep -rn "team_roles" migrations/*.sql
```
`is_system`, `is_default`, `protected` kimi sütun varmı? Cavab 3.4-ü müəyyən edir.

#### Sual 6 — Prioritet necə istifadə olunur?
```bash
grep -rn "priority" worker/services/team/ worker/team-routes.ts
```
Prioritet **yüksək rəqəm = güclü**, yoxsa **aşağı rəqəm = güclü**? Auditdəki istismar `priority: 99` istifadə edir — bu, yüksək rəqəmin güclü olduğunu göstərir, lakin **kodla təsdiqlə**. Səhv istiqamət bütün 3.3-ü tərsinə çevirər.

**Dayanma şərti:** Sual 3 və ya Sual 6-nın cavabı qeyri-müəyyən qalarsa → **kod dəyişikliyinə başlama**, nəticəni bildir.

---

### 3.1 · `sanitizePermissions` — wildcard-ın istifadəçi girişindən çıxarılması

**Audit ID:** H-1 · **Həcm:** 30 dəqiqə

**Tələb:**

```ts
/**
 * İSTİFADƏÇİ girişindən gələn icazə siyahısını təmizləyir.
 *
 * AUDIT-2026-07-26 / H-1: bu funksiya əvvəllər `'*'` qəbul edirdi. `manage_roles`
 * daşıyan Admin `permissions: ['*']` ilə rol yaradıb özünü ora keçirməklə
 * `manage_team` (Owner) səlahiyyətini ələ keçirə bilirdi — 3 sorğuluq zəncir.
 *
 * ⚠️ Bu funksiya YALNIZ istifadəçi girişi üçündür. Sistem seed-i və miqrasiya
 * kodu bu yoldan KEÇMİR — onlar `permissions.ts`-dəki sabitləri birbaşa yazır.
 *
 * ⚠️ Bu, QİYMƏTLƏNDİRMƏ (`hasPermission`) yolu deyil. Bazada mövcud `'*'`
 * dəyərlərinin necə qiymətləndirildiyini dəyişmə — bax AUDIT-TASK-3 §3.0/Sual 3.
 */
export function sanitizePermissions(input: unknown): string[] {
  const list = Array.isArray(input) ? input.map(String) : [];
  return [...new Set(
    list.filter((p) => (TEAM_PERMISSIONS as readonly string[]).includes(p)),
  )];
}
```

**Diqqət nöqtələri:**

1. **`TEAM_PERMISSIONS` yeganə ağ siyahıdır.** Sabit kodlanmış ikinci siyahı yaratma — gələcəkdə yeni icazə əlavə olunanda avtomatik axsın.
2. **Boş nəticə halı.** İstifadəçi yalnız etibarsız icazə göndərərsə nəticə `[]` olur. Çağıran tərəf bunu necə emal edir? `createTeamRole` boş icazəli rol yaratmalıdır, yoxsa 400 qaytarmalıdır? **Mövcud davranışı yoxla və qoru** — bu task davranış dəyişmir, yalnız wildcard-ı kəsir.
3. **`'*'` sətri artıq `TEAM_PERMISSIONS`-də deyilsə** filtr onu avtomatik atır. Xüsusi `if` yazma — sadəlik reqressiya riskini azaldır.

**Bütün çağıranları tap və hər birini yoxla:**
```bash
grep -rn "sanitizePermissions" worker/
```
Hər çağırış yerində: giriş istifadəçidən gəlirmi, yoxsa sistemdən? Sistemdən gələn çağırış varsa (seed, miqrasiya) — o, bu funksiyadan keçməməlidir.

---

### 3.2 · Eskalasiya qadağası — altçoxluq qaydası

**Audit ID:** H-1 (düzəlişin ikinci hissəsi) · **Həcm:** 1 saat

**Nədir:** `sanitizePermissions` düzəlişi tək başına **kifayət deyil**. `manage_roles` daşıyan Admin hələ də `permissions: ['manage_team']` yaza bilər — wildcard olmadan, açıq şəkildə. Nəticə eynidir.

**Qayda:** *Verilən icazə dəsti çağıranın öz effektiv icazə dəstinin altçoxluğu olmalıdır.*

**Yer:** `team-routes.ts:272-288` (`createTeamRole`) və `updateTeamRole`

**Tələb:**

```ts
/**
 * Eskalasiya qadağası — AUDIT-2026-07-26 / H-1.
 *
 * Çağıran özündə olmayan icazəni başqasına (və ya özünə) VERƏ BİLMƏZ.
 * Bu, wildcard düzəlişindən AYRI bir müdafiədir: `'*'` çıxarıldıqdan sonra da
 * `manage_roles` daşıyan Admin `['manage_team']` yazmaqla eyni nəticəyə çata bilərdi.
 *
 * Fail-closed: çağıranın icazə dəsti müəyyən edilə bilmirsə → RƏDD.
 */
function assertNoEscalation(callerPerms: string[], requested: string[]): void {
  const owned = new Set(callerPerms);
  const escalated = requested.filter((p) => !owned.has(p));
  if (escalated.length > 0) {
    throw new HttpError(
      403,
      'forbidden',
      `Özünüzdə olmayan səlahiyyəti verə bilməzsiniz: ${escalated.join(', ')}`,
    );
  }
}
```

**Kritik detallar:**

| Detal | Tələb |
|---|---|
| **Effektiv icazə dəsti** | Çağıranın rolu `'*'` daşıyırsa (Owner), `callerPerms` **genişləndirilmiş** dəst olmalıdır — yəni `TEAM_PERMISSIONS`-in hamısı. Əks halda Owner heç bir rol yarada bilməyəcək → **funksional çökmə** |
| **Komanda sahibi** | `teams.owner_uid === uid` halı ayrıca yoxlanılmalıdır — sahib rol sistemindən asılı olmadan tam səlahiyyətlidir (Sual 3-ün cavabına görə) |
| **Platforma admini** | `c.isAdmin` halı? Mövcud `adminTeamAction` yolu ayrıdır — bu funksiyaya toxunmur. Yoxla və toxunma |
| **Fail-closed** | `callerPerms` boş və ya `undefined` olarsa → **rədd et**, keçirmə |
| **Xəta kodu** | `403` + maşın-oxunaqlı `code: 'forbidden'`. `AUDIT-TASK-1-REPORT` §5.3 qeyd etmişdi ki, admin route-larında `code` yoxdur — burada **yeni kod yazırsan**, ona görə düzgün formada yaz |

**Hər iki endpoint-ə tətbiq et:** `createTeamRole` **və** `updateTeamRole`. Yalnız birini qorumaq boşluq saxlayır.

---

### 3.3 · Prioritet qaydası — yuxarı rola müdaxilənin bloklanması

**Audit ID:** H-1 (düzəlişin üçüncü hissəsi) · **Həcm:** 1 saat

Bu bənd **üç ayrı hücum** bağlayır. Üçü də prioritet müqayisəsi ilə həll olunur.

#### 3.3.a — Yüksək prioritetli rolun təyin edilməsi

**Yer:** `team-routes.ts:203-224` (`updateMemberRole`)

Hazırkı müdafiə **ad əsaslıdır** (`role.name === 'Owner'`) və kövrəkdir. Prioritet əsaslı qayda əlavə et:

> Təyin edilən rolun prioriteti çağıranın öz rolunun prioritetindən **yüksək olmamalıdır**.

⚠️ Prioritet istiqamətini **3.0/Sual 6-nın cavabına görə** yaz. Yüksək rəqəm güclüdürsə `targetRole.priority > callerRole.priority` → rədd. Tərsinədirsə şərti çevir.

#### 3.3.b — Yüksək prioritetli rolun redaktəsi (auditdə yoxdur — yeni)

`manage_roles` daşıyan Admin `updateTeamRole` ilə **Owner rolunun özünü** dəyişə bilir: icazələrini azalda, prioritetini endirə, adını dəyişə bilər.

Altçoxluq qaydası (3.2) bunu **tutmur** — çünki Admin icazə *vermir*, *alır*.

> Çağıran öz prioritetindən yüksək rolu **redaktə edə və ya silə bilməz**.

`updateTeamRole` və `deleteTeamRole`-a tətbiq et.

#### 3.3.c — Ad dəyişikliyi ilə qorumadan yayınma

`updateTeamRole` rol adını dəyişməyə icazə verirsə, ad əsaslı `'Owner'` qoruması mənasızlaşır: rol yenidən adlandırılır, qoruma düşür.

3.3.b bunu bağlayır (Owner rolu yüksək prioritetlidir → redaktə edilə bilməz), lakin **bunu açıq şəkildə testlə təsdiqlə**.

---

### 3.4 · Ad əsaslı Owner qorumasının möhkəmləndirilməsi (QƏRAR QAPISI)

**Həcm:** 30 dəqiqə (qərar) + 30 dəqiqə (miqrasiya, seçilərsə)

`'Owner'` **sətrinə** əsaslanan avtorizasiya kövrəkdir: rol adları istifadəçi girişidir, lokalizə oluna bilər, dublikat yaradıla bilər.

**3.0/Sual 5-in cavabına görə iki yol:**

| Hal | Əməliyyat |
|---|---|
| `team_roles`-də `is_system` (və ya bənzər) sütun **var** | Ad yoxlamalarını həmin sütuna keçir. Miqrasiya lazım deyil |
| Sütun **yoxdur** | Miqrasiya təklif et, **avtomatik tətbiq etmə** — bax aşağı |

**Sütun yoxdursa təklif olunan miqrasiya:**
```sql
-- migrations/00XX_team_roles_system_flag.sql
-- AUDIT-TASK-3 / H-1: ad əsaslı Owner qoruması kövrəkdir.
-- Rol adı istifadəçi girişidir; sistem rolları struktur bayraqla işarələnməlidir.
ALTER TABLE team_roles ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;

UPDATE team_roles SET is_system = 1 WHERE name = 'Owner';
```

⚠️ **Miqrasiya nömrəsi:** `AUDIT-2026-07-26` §H-7 migration nömrələmə pozğunluğunu qeyd edir (Task 5). **Mövcud ən yüksək nömrəni yoxla** və növbətini götür — dublikat nömrə yaratma.

⚠️ **Qərar qapısı:** Bu miqrasiya sxem dəyişikliyidir və 3.3-dəki prioritet qaydası **onsuz da əsas müdafiəni verir**. Ona görə:
- Prioritet qaydası (3.3) **məcburidir** — indi tətbiq et.
- `is_system` sütunu **tövsiyədir** — hesabatda təklif et, istifadəçi təsdiqləməsə tətbiq etmə.

---

### 3.5 · Artıq eskalasiya olunmuş rolların təmizlənməsi

**Həcm:** 45 dəqiqə

**Nədir:** Kod düzəlişi **gələcəyi** qoruyur. Bazada istismarla yaradılmış wildcard rol varsa, o, düzəlişdən sonra da işləməyə davam edəcək.

**Tələb:**

1. **3.0/Sual 4-ün nəticəsini qiymətləndir.** Wildcard daşıyan hər rol üçün:

   | Rol | Təsnifat | Əməliyyat |
   |---|---|---|
   | Sistem seed-indən gələn Owner rolu | ✅ Qanuni | Toxunma |
   | Demo seed (`0015`–`0018`) rolları | ⚠️ Bax aşağı | **Task 5** |
   | İstifadəçi tərəfindən yaradılmış | 🔴 **Şübhəli** | Normallaşdır + qeyd et |

2. **Demo seed qeydi:** Audit (sətir 545) `migrations/0018_seed_fix_admin_permissions.sql`-in demo `role_1` rolunu **`manage_team` ilə eskalasiya etdiyini** yazır. Bu, **Task 5**-in əhatəsidir (demo seed təmizliyi) — burada **silmə**, yalnız 3.0/Sual 4 nəticəsində aşkarlanıbsa hesabata yaz və Task 5-ə bağla.

3. **Şübhəli rol tapılarsa:**
   - **Avtomatik silmə** — ❌ etmə. Rol istifadəçilərə təyin olunmuş ola bilər; silinməsi onları rolsuz qoyar.
   - **Normallaşdırma** — `'*'` dəyərini rolun **faktiki niyyətinə uyğun açıq siyahı** ilə əvəzlə. Niyyət bilinmirsə → istifadəçidən soruş.
   - Hər halda hesabata yaz: hansı komanda, hansı rol, nə vaxt yaradılıb, kimə təyin olunub.

4. **İstismarın baş verib-vermədiyini qiymətləndir:** `team_activity` və ya audit log-da silinmiş komanda / rol yaratma hadisələri varmı? Varsa hesabatda ayrıca bölmə.

---

### 3.6 · E2E testləri — istismar zəncirinin bağlandığının sübutu

**Həcm:** 1,5 saat

**Yer:** `e2e/teams-rbac.spec.ts` (mövcud, `:208`-də Owner adı testi var — genişləndir, əvəzləmə)

**Məcburi test dəsti:**

```ts
/**
 * AUDIT-TASK-3 — H-1 privilege escalation reqressiya qoruması.
 *
 * Auditdə doğrulanmış 3 sorğuluq zəncir:
 *   1. manage_roles ilə permissions:['*'] rol yarat
 *   2. manage_members ilə özünü ora keçir
 *   3. manage_team tələb edən DELETE /api/teams/:id çağır
 *
 * Hər üç addım ayrıca test olunur — birinci addım bağlansa da,
 * qalanları müstəqil müdafiə kimi qalmalıdır (defense in depth).
 */
test.describe('AUDIT H-1 — komanda RBAC eskalasiyası', () => {

  // ─── Addım 1: wildcard rədd olunur ───
  test('Admin permissions:["*"] ilə rol YARADA BİLMƏZ', async () => {
    // POST /api/teams/:id/roles { name:'Ops', permissions:['*'], priority:99 }
    // Gözlənilən: 400/403 VƏ YA 201 amma permissions === [] (wildcard süzülüb)
    // Hansı davranış seçilibsə testdə onu təsbit et — 3.1/detал 2
  });

  // ─── Addım 1b: açıq eskalasiya rədd olunur ───
  test('Admin özündə olmayan manage_team icazəsini VERƏ BİLMƏZ', async () => {
    // POST /api/teams/:id/roles { permissions:['manage_team'] }
    // Gözlənilən: 403 + code:'forbidden'
  });

  // ─── Addım 2: prioritet qaydası ───
  test('Admin özündən yüksək prioritetli rolu ÖZÜNƏ təyin edə bilməz', async () => {
    // PATCH /api/teams/:id/members/<özü> { roleId: '<Owner rolu>' }
    // Gözlənilən: 403
  });

  test('Admin Owner rolunu BAŞQASINA da təyin edə bilməz', async () => {
    // Eyni, lakin hədəf üçüncü üzv — "yalnız özünə" boşluğu qalmasın
  });

  // ─── 3.3.b: yuxarı rola müdaxilə ───
  test('Admin Owner rolunu REDAKTƏ edə bilməz', async () => {
    // PATCH /api/teams/:id/roles/<owner-role> { permissions:[...] }
    // Gözlənilən: 403
  });

  test('Admin Owner rolunu SİLƏ bilməz', async () => {
    // DELETE /api/teams/:id/roles/<owner-role> → 403
  });

  // ─── 3.3.c: ad dəyişikliyi ilə yayınma ───
  test('Admin Owner rolunu YENİDƏN ADLANDIRA bilməz', async () => {
    // PATCH … { name: 'Ops' } → 403 (ad əsaslı qorumadan yayınma bağlıdır)
  });

  // ─── Addım 3: son müdafiə ───
  test('Admin komandanı SİLƏ BİLMƏZ', async () => {
    // DELETE /api/teams/:id → 403
  });

  // ─── 🔴 REQRESSİYA — ən vacib test ───
  test('Owner BÜTÜN səlahiyyətlərini saxlayır', async () => {
    // Owner: rol yaradır ✅, rol redaktə edir ✅, üzv rolunu dəyişir ✅,
    // komanda parametrlərini dəyişir ✅, komandanı silir ✅
    // Bu test SINSA → düzəliş çox sərtdir, geri qaytar
  });

  test('Owner istənilən icazəni verə bilər (altçoxluq qaydası Owner-i bloklamır)', async () => {
    // Owner permissions:['manage_team','manage_roles',…] ilə rol yaradır → 201
    // 3.2-dəki "effektiv icazə dəsti" genişləndirməsinin sübutu
  });
});
```

**Test tələbləri:**
- Hər test **ayrıca** olmalıdır — birləşdirilmiş test hansı müdafiənin işlədiyini gizlədir.
- Sonuncu iki test (**reqressiya**) yaşıl olmadan task bitmiş sayılmır.
- Mövcud `teams-rbac.spec.ts:208` testini **silmə** — o, ad əsaslı qorumanı test edir və hələ də dəyərlidir.

---

## 4. ƏHATƏDƏN KƏNAR — bunları ETMƏ

| Tapıntı | Aid task | Səbəb |
|---|---|---|
| `adminTeamAction` audit log-a yazmır (M-11) | **Task 6** | Ayrı problem — audit izi, avtorizasiya deyil |
| `createTeamTask.assigneeId` üzvlük yoxlaması (M-15) | **Task 6** | Ayrı endpoint |
| `LIKE` naxışlarında escape (L-3) | **Task 6** | — |
| `getTeamActivity` `before` NaN (L-6) | **Task 6** | — |
| Demo seed rollarının silinməsi (`0015`–`0018`) | **Task 5** | Miqrasiya işidir; 3.5 yalnız aşkarlayır |
| Platforma RBAC-ı / PRD-dəki 9 rol | **Task 10** | Strateji qərar |
| `users.role` sütununun avtorizasiyaya bağlanması | **Task 10** | Eyni |
| `serveFile` avtorizasiyası (C-1) | **Task 7** | — |
| Rate limit (H-4) | **Task 4** | — |
| Admin route-larında `code` sahəsi (Task 1 §5.3) | **Task 4** | 33 route-a təsir edir |
| `worker/services/` 23 boş stub | **Task 10** | — |

---

## 5. İCRA QAYDALARI

### 5.1 Commit strategiyası

```
fix(rbac): '*' wildcard istifadəçi girişindən çıxarıldı

Audit: AUDIT-2026-07-26.md §H-1
Risk: High (privilege escalation)
Təsir: manage_roles daşıyan Admin 3 sorğu ilə manage_team (Owner)
       səlahiyyətini ələ keçirə bilirdi.
Qeyd: QİYMƏTLƏNDİRMƏ yoluna toxunulmadı — mövcud Owner rolları işləyir.
Test: e2e/teams-rbac.spec.ts — AUDIT H-1 bloku
```

**Sıra:** 3.0 → 3.1 → 3.2 → 3.3 → 3.6 → 3.5 → 3.4
*(Testlər data təmizliyindən **əvvəl** gəlir — beləliklə təmizlik zamanı müdafiənin işlədiyi artıq sübut olunmuş olur.)*

### 5.2 🔴 Əsas tələ — giriş yolu ≠ qiymətləndirmə yolu

Bu task-ın yeganə ciddi sındırma riski budur:

| Yol | Nədir | Bu task-da |
|---|---|---|
| **Giriş (input)** | `sanitizePermissions` — istifadəçidən gələn siyahını təmizləyir | ✅ **Dəyişdirilir** |
| **Qiymətləndirmə (evaluation)** | `hasPermission` / `can()` — bazadakı dəyəri oxuyub qərar verir | ❌ **TOXUNULMUR** |

Owner rolu bazada `['*']` kimi saxlanılırsa və sən qiymətləndirmə yolundan wildcard dəstəyini çıxarsan, **hər komandanın Owner-i öz komandasından kilidlənir.** Bu, təhlükəsizlik düzəlişi deyil, hadisədir.

3.0/Sual 3 məhz bunun üçündür. Cavab aydın deyilsə → **dayan**.

### 5.3 Fail-closed prinsipi

Hər yeni yoxlama üçün: **məlumat çatışmırsa RƏDD ET.**
- Çağıranın rolu tapılmırsa → 403, `undefined`-ı "icazə yoxdur" kimi qəbul etmə, **açıq rədd et**.
- Prioritet `null`/`NaN`-dırsa → 403.
- Rol sətri bazada pozulubsa → 403 + log.

Səhv tərəfə düşmək lazımdırsa, **funksionallıq tərəfinə deyil, təhlükəsizlik tərəfinə** düş — bu, kilidləmə yaradarsa reqressiya testi (3.6) onu dərhal tutacaq.

### 5.4 Şərh mədəniyyəti

Task 1 və 2-də olduğu kimi: hər yeni yoxlamanın yanına **hansı hücumu bağladığı** yazılsın. Gələcəkdə kimsə "bu yoxlama artıqdır" deyib silməsin.

---

## 6. QƏBUL MEYARLARI

| # | Meyar | Doğrulama | Gözlənilən |
|---|---|---|---|
| **1** | 🔴 **Owner reqressiyası yoxdur** | `npx playwright test teams-rbac --grep "Owner"` | **hamısı yaşıl** |
| 2 | Wildcard istifadəçi girişindən qəbul olunmur | `sanitizePermissions(['*'])` | `[]` |
| 3 | Etibarlı icazələr keçir | `sanitizePermissions(['manage_members'])` | `['manage_members']` |
| 4 | Dublikat təmizlənir | `sanitizePermissions(['a','a'])` | tək nüsxə |
| 5 | Altçoxluq qaydası işləyir | Admin → `permissions:['manage_team']` | 403 + `code:'forbidden'` |
| 6 | Owner altçoxluq qaydası ilə bloklanmır | Owner → istənilən icazə ilə rol | 201 |
| 7 | Prioritet qaydası — təyin | Admin → Owner rolunu özünə | 403 |
| 8 | Prioritet qaydası — üçüncü şəxs | Admin → Owner rolunu başqasına | 403 |
| 9 | Prioritet qaydası — redaktə | Admin → Owner rolunu PATCH | 403 |
| 10 | Prioritet qaydası — silmə | Admin → Owner rolunu DELETE | 403 |
| 11 | Ad dəyişikliyi ilə yayınma bağlıdır | Admin → Owner rolunu yenidən adlandırır | 403 |
| 12 | İstismar zəncirinin sonu bağlıdır | Admin → `DELETE /api/teams/:id` | 403 |
| 13 | Strict TypeScript keçir | `npx tsc --noEmit` | exit 0 |
| 14 | Build uğurludur | `npm run build` | exit 0 |
| 15 | Tam E2E reqressiya yoxdur | `npx playwright test` | Task 2 nəticəsi ≥ |
| 16 | Bazada şübhəli wildcard rol qalmayıb | 3.0/Sual 4 sorğusu təkrar | yalnız sistem/demo rolları |
| 17 | Fail-closed davranış | rolu olmayan üzv → rol yaratmağa cəhd | 403, 500 deyil |

**Meyar 1 ❌ olarsa:** dəyişikliyi geri qaytar (`git revert`) və §5.2-dəki tələyə qayıt. Təhlükəsizlik düzəlişi funksionallığı sındırmamalıdır.

---

## 7. HESABAT FORMATI

`docs/AUDIT-TASK-3-REPORT.md`:

```markdown
# AUDIT-TASK-3 — İcra Hesabatı

**Tarix:** …   **İcraçı:** …
**Commit-lər:** <hash → başlıq>

---

## 0. Vəziyyət xəritəsi (3.0)

### İcazə kataloqu (Sual 1)
<TEAM_PERMISSIONS tam siyahısı>

### Rol matrisi (Sual 2)
| Rol | Prioritet | İcazələr | '*' daşıyır? |

### 🔴 Owner necə saxlanılır (Sual 3)
<cavab + kod istinadı + bunun 3.1-ə təsiri>

### Bazadakı wildcard rollar (Sual 4)
| Rol ID | Komanda | Ad | Prioritet | Təsnifat |

### Sistem bayrağı (Sual 5) — <var / yox>
### Prioritet istiqaməti (Sual 6) — <yüksək rəqəm güclü / tərsinə> + kod sübutu

---

## 1. Bağlanan tapıntılar
| Audit ID | Bənd | Vəziyyət | Sübut |
| H-1 | 3.1 · wildcard giriş  | ✅ | permissions.ts:NNN |
| H-1 | 3.2 · altçoxluq       | ✅ | team-routes.ts:NNN |
| H-1 | 3.3 · prioritet       | ✅ | 3 hücum bağlandı |
| —   | 3.4 · sistem bayrağı  | ✅/💡 | <tətbiq / təklif> |
| —   | 3.5 · data təmizliyi  | ✅ | <N rol> |
| —   | 3.6 · E2E             | ✅ | <N test> |

## 2. Qəbul meyarları
| … 17 sətir … |

## 3. İstismar zəncirinin bağlandığının sübutu
| Addım | Əvvəl | İndi | Test |
| 1. wildcard rol | 201 | <…> | … |
| 2. özünə təyin  | 200 | 403  | … |
| 3. komanda silmə| 204 | 403  | … |

## 4. Aşkarlanan yeni risklər
<3.0 zamanı görülən hər şey — audit 6× az qiymətləndirmişdi, bax Task 2 §5.2>

## 5. Açıq qalan öhdəliklər
- [ ] `is_system` miqrasiyası — <tətbiq edildi / təklif, istifadəçi qərarı gözləyir>
- [ ] Demo seed rollarının təmizliyi → **Task 5**
- [ ] <3.5-də aşkarlanan şübhəli rollar>

### Əvvəlki task-lardan miras
- [ ] 🔴 `ARCHIVE_HOT_DAYS` → `"90"` (Task 8-dən sonra) — **əvvəlcə Privacy §4-ə
      arxivləmə açıqlaması** (LEGAL-GAPS §2.2)
- [ ] 🔴 Hüquqi mətnin peşəkar nəzərdən keçirilməsi (LEGAL-GAPS §2.4, §2.1)
- [ ] 🔴 `collabix.az` DNS + MX
- [ ] 🟠 TestSprite API açarının rotasiyası
- [ ] 🟠 53 hesaba parol sıfırlama qərarı
- [ ] 🟠 VÖEN, sosial profillər (real olduqda)
- [ ] Git remote qərarı

## 6. Geri qaytarma planı
| Commit | Revert | Gözlənilən təsir |
| 3.1 | `git revert <hash>` | wildcard yenidən qəbul olunur — H-1 açılır |
| 3.3 | `git revert <hash>` | ⚠️ Owner qorumasının bir hissəsi qalır (ad əsaslı) |
```

---

## 8. BİRİNCİ ADDIM

**Yalnız oxu rejimində** 3.0-dakı 6 sualı cavablandır və nəticəni təqdim et. Kod dəyişikliyinə **başlama**.

Xüsusilə bu ikisini açıq şəkildə cavablandır:

1. **Sual 3** — Owner rolu bazada `['*']` kimi saxlanılır, yoxsa icazələri açıq sadalanır? `hasPermission` wildcard-ı qiymətləndirirmi? *(Bu, §5.2-dəki tələnin cavabıdır.)*
2. **Sual 6** — prioritetdə yüksək rəqəm güclüdür, yoxsa aşağı? Kod sübutu ilə.

**Dayanma şərti:** Bu iki sualın hər hansı biri qeyri-müəyyən qalarsa, düzəlişə başlama — yanlış cavab ya bütün Owner-ləri kilidləyər, ya da prioritet qaydasını tərsinə çevirib eskalasiyanı **asanlaşdırar**.

Cavablar aydın olduqdan sonra §5.1-dəki sıra ilə icraya başla.
