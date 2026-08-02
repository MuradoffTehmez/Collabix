# İdarəetmə — rollar, icazələr və moderasiya

**Tarix:** 2026-08-02 · **Mənbə:** PRD §4–6, §12–14

Bu sənəd layihənin **iki ayrı rol sistemini** və moderasiya axınlarını təsvir edir.

---

## 1. 🔴 İki rol sistemi — ən çox çaşdıran nöqtə

Layihədə **iki müstəqil rol sistemi** var. Onları qarışdırmaq həm developer,
həm istifadəçi üçün ən böyük çaşqınlıq mənbəyidir.

| | **Platforma rolu** | **Komanda rolu** |
|---|---|---|
| **Əhatə** | Bütün sayt | YALNIZ bir komanda |
| **Rollar** | 10 sabit: `OWNER` … `GUEST` | Komanda özü yaradır, sərbəst ad |
| **Saxlanır** | `users.role` | `team_members.permissions` |
| **Matris** | `roles`, `permissions`, `role_permissions`, `user_permissions` | `team_roles` |
| **Kim təyin edir** | `MANAGE_ROLES` icazəsi olan (SUPER_ADMIN+) | Komanda sahibi |
| **Kod** | `worker/rbac.ts` | `worker/services/team/permissions.ts` |
| **UI** | Admin panel → **Platforma Rolları** | Komanda səhifəsi → Rollar |
| **Wildcard** | ❌ yoxdur | ✅ Owner `["*"]` daşıyır |

### Kəsişmirlər

Bir istifadəçi **qlobal `USER`**, öz komandasında isə **`Owner`** ola bilər.
Bu, ziddiyyət deyil — iki fərqli sahədir.

> ⚠ Ona görə UI hər iki yerdə mənbəni AÇIQ yazır. Əks halda istifadəçi
> *"mən Owner-əm, niyə admin panelinə girə bilmirəm?"* sualını verir.

### İki wildcard qaydası (qarışdırma!)

- **Komanda tərəfi:** `hasPermission` wildcard-ı **QƏBUL edir**,
  `sanitizePermissions` isə **RƏDD edir** (giriş yolu ≠ qiymətləndirmə yolu).
  Owner bazada `["*"]`-dır; qiymətləndirmədən wildcard-ı silmək **bütün
  Owner-ləri kilidləyər**.
- **Platforma tərəfi:** wildcard **ümumiyyətlə yoxdur** — `OWNER` rolu bütün
  icazələri matrisdə **açıq** daşıyır.

---

## 2. Platforma rol ierarxiyası

| Rol | Prioritet | Əsas icazələr |
|---|---:|---|
| `OWNER` | 100 | **HAMISI** |
| `SUPER_ADMIN` | 90 | ADMIN + `MANAGE_ROLES`, `MANAGE_PERMISSIONS`, `MANAGE_LEVELS`, `MANAGE_ADS` |
| `ADMIN` | 80 | SENIOR_MODERATOR + `MANAGE_USERS`, `MANAGE_SETTINGS`, `MANAGE_TAGS`, `MANAGE_CATEGORIES`, `VERIFY_ACCOUNT`, `VIEW_ANALYTICS`, `VIEW_AUDIT_LOG`, `MANAGE_BADGES`, `MANAGE_ROOMS`, `MANAGE_CONTENT`, `MANAGE_CONTACTS`, `MANAGE_TEAMS` |
| `SENIOR_MODERATOR` | 70 | MODERATOR + `MUTE_USER`, `BAN_USER`, `RESTORE_USER` |
| `MODERATOR` | 60 | HELPER + `DELETE_ANY_POST`, `DELETE_ANY_COMMENT`, `WARN_USER`, `MANAGE_REPORTS`, `PIN_POST`, `LOCK_POST`, `MANAGE_TASKS` |
| `HELPER` | 50 | USER + `VIEW_REPORTS` |
| `PREMIUM` / `VERIFIED` | 40 / 30 | USER ilə eyni (fərq göstərişdədir) |
| `USER` | 20 | `CREATE_POST`, `CREATE_COMMENT`, `EDIT_POST`, `DELETE_OWN_POST`, `DELETE_COMMENT` |
| `GUEST` | 10 | — |

### 🔴 "Hər admin = tam səlahiyyət" tapıntısı bağlandı

Audit `admin panel` bölməsində qeyd edirdi ki, hər admin tam səlahiyyətlidir.
İndi `ADMIN` rolu **qəsdən** bunları DAŞIMIR:

- `MANAGE_ROLES` — başqasının rolunu dəyişmək
- `MANAGE_PERMISSIONS` — fərdi icazə istisnası
- `SYSTEM_BACKUP` — istifadəçi/jurnal CSV ixracı (kütləvi PII)

Bu invariant `test/route-permissions.test.ts` ilə qorunur.

### Eskalasiya qapıları

1. **`assertCanAssignRole`** — hədəf rolun prioriteti çağıranınkindən **aşağı**
   olmalıdır; çağıran **öz** rolunu dəyişə bilməz.
2. **`assertCanModerate`** — moderator özündən yüksək rollu istifadəçiyə
   toxuna bilməz (iki moderatorun bir-birini bloklamasının qarşısı).

---

## 3. Marşrut qorunması

`worker/index.ts` marşrut cədvəlində iki qapı var:

```ts
{ …, admin: true }        // ⚠ KÖHNƏ: "bu hesab `admins` cədvəlindədir?"
{ …, perm: 'MANAGE_USERS' }  // ✅ YENİ: "bu hesabın həmin icazəsi var?"
```

**Hazırda `admin: true` daşıyan marşrut YOXDUR** — 34-ü də icazəyə köçürülüb
(PRD §5: *"Backend hər əməliyyatda Permission yoxlamalıdır"*).

⚠ İkisi birlikdə verilsə **hər ikisi** tələb olunur (VƏ məntiqi) — qapının
sükutla zəifləməsi mümkün olmamalıdır.

⚠ `admins` cədvəli **silinməyib**: fövqəladə bootstrap yolu kimi qalır və
`c.isAdmin` ondan **və ya** `priority >= 80`-dən hesablanır.

### 🔴 Bootstrap OWNER

`migrations/0031` bütün adminləri `ADMIN` roluna qoydu, lakin `ADMIN`-də
`MANAGE_ROLES` yoxdur və heç kimə `OWNER` verilmədi → həmin icazələr
**heç kimdə** yox idi, yəni rol sistemi **ətalətdə** idi.

`migrations/0035` bunu determinstik həll edir: adminlər arasında **ən erkən
qoşulan** hesab (`joined_at ASC`) `OWNER` olur. İdempotentdir — artıq `OWNER`
varsa toxunmur.

---

## 4. Moderator namizədliyi (PRD §12)

> *"İstifadəçi moderator OLMUR. Müraciət edir."*

Moderatorluq XP və ya səviyyə ilə **avtomatik gəlmir** (PRD §4: *"Level heç
vaxt Moderator və ya Admin etmir"*).

### Şərtlər — `moderator_requirements` cədvəlindən

| Açar | Default | Mənbə |
|---|---:|---|
| `min_account_days` | 90 | PRD §12 |
| `min_level` | **10** | PRD §12 (aşağıdakı qeydə bax) |
| `min_reputation` | 500 | PRD §12 |
| `warning_free_days` | 30 | PRD §12 |
| `require_verified` | 1 | PRD §12 |
| `reapply_days` | 30 | PRD-də yoxdur — spam qarşısı |

> 🔴 **PRD-nin daxili ziddiyyəti:** §12 **LV15+** tələb edir, §7-nin səviyyə
> cədvəli isə **Lv10-da bitir** (50 000 XP). LV15 **əlçatmazdır** — şərt hərfi
> tətbiq olunsa heç kim heç vaxt müraciət edə bilməzdi. Astana mövcud **ən
> yüksək səviyyə** kimi oxunur; §12-nin niyyəti (çox yüksək bar) qorunur.

⚠ Astanalar **kodda sabit deyil** — cədvəldədir (`levels` ilə eyni fəlsəfə):
tələbi dəyişmək üçün deploy lazım deyil.

### Axın

```
istifadəçi → uyğunluq yoxlanışı → müraciət (motivasiya ≥ 30 simvol)
          → admin növbəsi (MANAGE_ROLES) → təsdiq/rədd
          → təsdiqdə: users.role = 'MODERATOR'   ·   XP DƏYİŞMİR
```

### İki mühüm qərar

1. **Snapshot saxlanılır.** Admin müraciətə bir həftə sonra baxa bilər; o vaxta
   qədər XP, reputasiya və xəbərdarlıqlar dəyişir. Snapshot olmasa *"niyə bu
   qəbul olundu?"* sualına sonradan cavab vermək mümkün olmazdı.
2. **`MANAGE_ROLES` tələb olunur, `VIEW_REPORTS` yox.** Namizədləri görmək rol
   təyini prosesidir; moderatorun özü namizədləri görməməlidir (maraqlar
   toqquşması).

---

## 5. Moderasiya cəzaları

| Cəza | İcazə | Təsir |
|---|---|---|
| Xəbərdarlıq | `WARN_USER` | `warnings` sətri + reputasiya azalır |
| Susdurma | `MUTE_USER` | Oxuya bilər, **yaza bilməz** (yalnız mutasiya metodları bağlanır, sessiya ləğv EDİLMİR) |
| Bloklama | `BAN_USER` | Sessiyalar ləğv olunur + WS-dən çıxarılır |
| Bərpa | `RESTORE_USER` | — |

⚠ **Ban-ın həqiqət mənbəyi `bans` cədvəlidir**, `users.blocked` sütunu deyil:
müddətli ban bitəndə sütunu sıfırlayan cron yoxdur, ona görə vaxtı bitmiş ban
sorğu anında sükutla keçir və bayraq uzlaşdırılır.

---

## 6. Audit jurnalı (PRD §14)

`admin-log.ts` → `ADMIN_LOG_ACTIONS` ağ siyahısı (M-13: log forging qarşısı).

PRD §14-ün tələb etdiyi hər bənd siyahıdadır: `user-role-change`,
`user-permission`, `xp-edit` / `user-level-edit`, `user-warn`, `user-ban`,
`user-mute`, `user-restore`, `mod-apply`, `mod-approve`, `mod-reject`.

⚠ Bu əməliyyatlar **əvvəl də yazılırdı**, lakin siyahıda olmadığı üçün admin
panelinin filtrində **görünmürdü**.

---

## 7. Dəvət axını (PRD §6)

`invites` (kod, sahib, limit) + `invite_redemptions` (**`invitee_uid` PRIMARY KEY**).

| Qayda | Səbəb |
|---|---|
| Hesab başına bir dəfə | Əks halda bir istifadəçi bir neçə kodla dəfələrlə XP qazandırardı |
| Hesab başına ≤ 5 aktiv kod | Limitsiz kod fermalama üçün paralel kanal açardı |
| Öz-özünü dəvət bloklanır | — |
| Bloklu hesabın kodu işləmir | — |
| Səhv kod qeydiyyatı **dayandırmır** | Kod marketinq mexanizmidir, autentifikasiya şərti deyil |
| Kod əlifbasında `0/O`, `1/I/l` yoxdur | Kod əllə köçürülür və şifahi deyilir |

XP **dəvət edənə** verilir (`refId` = dəvət olunanın uid-i → UNIQUE indeks
təkrarı bağlayır).
