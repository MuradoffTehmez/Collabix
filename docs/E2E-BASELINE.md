# E2E Baseline — etibarlı ölçmə

**AUDIT-TASK-10 / Faza 1.1.** Bu sənəd `e2e/KNOWN-FAILING.md`-i **əvəz edir**.

> ⚠ Task 9 §R-1b sübut etdi ki, `KNOWN-FAILING.md` "0 sınıq" yazarkən 21 test
> sınırdı. Ona görə Task 10 baseline-ı **özü ölçdü** — sənədə güvənmədən.

---

## 1. Ölçmə şərtləri

| Şərt | Dəyər |
|---|---|
| **Commit** | `1a00d96` (kod dəyişməzdən ƏVVƏL) |
| **Tarix** | 2026-07-29 |
| **Qaçış** | TƏK, kəsilməmiş, hər iki layihə (`desktop` + `mobile`) |
| **Əmr** | `npx playwright test` |

### Ölçmədən əvvəl təmizlənən (Task 9 §R-2, §R-3b)

| Nə | Niyə |
|---|---|
| `workerd.exe` prosesləri | `reuseExistingServer: true` əl ilə başladılmış (bəlkə də səhv bayraqlı) serveri təkrar istifadə edir → arxiv testləri sükutla sınır |
| Qalıq `a9_*` / `rl_*` / `probe_*` hesabları | İstifadəçi kataloqunun ilk səhifəsini doldurub `users.spec`-i sındırır |
| `rl:*` KV açarları | `heavy` səbəti (20/saat) GDPR ixrac testlərini 429-a salır |
| Bloklu qalmış istifadəçi | `admin.spec` bulk testi sınıq buraxırsa növbəti qaçış da sınır |
| `e2e_tp_csv`, `e2e_ghost_uid`, `e2e-arch-*` | Sabit id-li seed sətirləri `UNIQUE` xətası verir |

---

## 2. 🔴 Nəticə

| Layihə | Sınıq | Atribusiya |
|---|---:|---|
| **desktop** | **0** | — |
| **mobile** | **56** | 🟡 **HARNESS qüsuru** — məhsul qüsuru DEYİL |

**Desktop tam təmizdir.** Bu, Task 9-un açıq öhdəliyini bağlayır
(*"tək qaçışda 312/312 alınmadı"*).

---

## 3. Mobile sınıqlarının kök səbəbi — sessiya köhnəlməsi

### Sübut zənciri

1. `worker/auth.ts` → `ACCESS_TTL = 15 * 60` (15 dəqiqə).
2. `globalSetup` **hər iki** layihə üçün sessiyanı **t = 0**-da yaradır.
3. `desktop` layihəsi **~20 dəqiqə** çəkir.
4. Yəni `mobile` başlayanda fayldakı access token **artıq bitib**.
5. Hər mobile konteksti refresh etməli olur; **birinci refresh token-i ROTASİYA
   edir**, fayl isə köhnə nüsxəni saxlayır.
6. İkinci kontekst köhnə refresh token təqdim edir → server bunu **"token
   reuse"** sayır və `revokeAllSessions` çağırır → **qalan bütün mobile testləri
   401 alır**.

### 🔴 Həlledici sübut

`mobile` layihəsində **qonaq** testləri KEÇİR, **sessiyalı** testləri SINIR:

| Spec | Sessiya lazımdır? | Nəticə |
|---|---|---|
| `home.spec.ts` (21 test) | ❌ qonaq | ✅ **21/21 keçdi** |
| `legal.spec.ts` | ❌ qonaq | ✅ keçdi |
| `admin.spec`, `users.spec`, `teams.spec`, … | ✅ sessiyalı | ❌ hamısı 8,5 s timeout |

Əgər problem mobile viewport-unda olsaydı, qonaq səhifələri də sınardı.
**Server davranışı DÜZGÜNDÜR** — token reuse aşkarlaması Task 8-in qəsdli
təhlükəsizlik mexanizmidir. Qüsur harness-dədir.

### Niyə Task 9-un düzəlişi kifayət etmədi

Task 9 `auth-fixture.ts` ilə **hər layihəyə ayrı sessiya** verdi və bu, desktop
↔ mobile çarpaz zəhərlənməsini bağladı. Lakin o, **sessiyanın YAŞINI** həll
etmirdi: hər iki fayl hələ də `globalSetup` anında, yəni istifadədən 20 dəqiqə
əvvəl yazılır.

---

## 4. Bağlanma

Bu, Faza 1.2-nin (öz-özünü təmizləyən dəst) predmetidir — bax həmin bölmə və
`docs/AUDIT-TASK-10-REPORT.md`.

**Baseline müqayisə qaydası:** sonrakı hər ölçmə bu sənədlə müqayisə olunur.
`desktop` sınığı **0-dan böyük olarsa reqressiyadır**; `mobile` sınığı isə
Faza 1.2-dən sonra **0** olmalıdır.
