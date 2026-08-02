# Təxirə salınmış bəndlər — sxem XARİCİ

**Tarix:** 2026-08-02 · **Mənbə:** `AUDIT-TASK-10.md` §6.2 / §12
**Qardaş sənəd:** `docs/SCHEMA-ROADMAP.md` (yalnız **sxem** bəndləri: UUIDv7, `post_blocks`, …)

> Bu sənədin məqsədi **borcu ödəmək deyil, dürüst qeydə almaqdır.**
> `AUDIT-TASK-10.md` §6.2 qaydası: *"⏭️ yalnız əsaslandırma ilə qəbul olunur.
> 'Vaxt çatmadı' əsaslandırma deyil."* Aşağıdakı hər bənddə **texniki səbəb** var.

---

## D-1 · OAuth PKCE (audit L-2)

| | |
|---|---|
| **Nə** | `oauth.ts` authorization code axınında `code_challenge`/`code_verifier` yoxdur |
| **Niyə təxirə** | Auditin **öz qiyməti**: *"confidential client + ikiqat `state` yoxlaması ilə risk aşağıdır"*. PKCE **public client** (mobil/SPA, secret saxlaya bilməyən) üçün nəzərdə tutulub; bizim `client_secret` Worker-dədir və heç vaxt client-ə çıxmır. Yəni bu, boşluq deyil, **dərinlikdə müdafiə** əlavəsidir |
| **Nə vaxt lazım olur** | 🔴 **Mobil tətbiq və ya native client** əlavə olunan gün — o zaman PKCE **məcburidir**, seçim deyil |
| **Həcm** | 0,5 gün |
| **Risk** | Aşağı — mövcud axına əlavədir, sındırmır |

---

## D-2 · 30 KB-dan böyük üç fayl (qəbul meyarı 18)

| Fayl | Ölçü |
|---|---:|
| `worker/index.ts` | 53 281 B |
| `worker/team-routes.ts` | 52 955 B |
| `worker/routes/post.ts` | 34 169 B |

**Niyə təxirə:** Faza 3.1-in **audit tapıntısı** `routes.ts` idi (189 KB, 120 export)
və o bağlandı — **6 164 B** barrel qaldı. Qalan üç fayl fərqli kateqoriyadır:

- `index.ts` — deklarativ **route cədvəli** + `fetch` handler + security header-lər.
  Route cədvəlini bölmək dispatch-i iki yerə yayardı; auditin tərifləmədiyi struktur budur.
- `team-routes.ts` — auditin **özü** bunu *"düzgün yolu göstərən nümunə"* adlandırır
  (`team-routes.ts` + `services/team/`). Onu bölmək auditin təklifinin **əksinə** getmək olardı.
- `routes/post.ts` — Faza 3.1-in **nəticəsidir** (185 KB-dan ayrıldı), səbəbi deyil.

**Yəni bu, yeni refaktordur — audit tapıntısı deyil.** Faza 3-ün qızıl qaydası
(§11.2) refaktoru davranış dəyişikliyindən ayırmağı tələb edir; E2E ölçülmədən
əlavə refaktor aparmaq həmin qaydanı pozardı.

**Ön şərt:** tam E2E qaçışı (qəbul meyarı 43) · **Həcm:** 1,5 gün

---

## D-3 · Integration test qatı (Miniflare)

**Niyə təxirə:** `AUDIT-TASK-10.md` §1.5 açıq deyir: *"Miniflare ilə inteqrasiya
testləri **ikinci mərhələdir** — E2E onları qismən örtür."* Faza 1-in tələbi
**unit qatı** idi və o ödəndi (64 test / 3 fayl).

**Nə vaxt:** E2E mobile harness qüsuru həll olunandan sonra — əks halda iki
qat eyni səbəbdən qırmızı olar və siqnal itər.

**Həcm:** 2 gün

---

## D-4 · Mobile E2E harness qüsuru (56 sınıq)

| | |
|---|---|
| **Nə** | `mobile` layihəsində sessiyalı testlərin hamısı 401 alır |
| **Kök səbəb** | Məhsul qüsuru **deyil**: `AUTH_FILE` paylaşılır, ilk refresh token-i **rotasiya edir**, ikinci kontekst köhnə token təqdim edir → server "token reuse" sayır → `revokeAllSessions` |
| **Sübut** | `docs/E2E-BASELINE.md` §3 — mobile-da **qonaq** testləri keçir, **sessiyalı** testləri sınır |
| **Həll** | Layihə başına izolə `storageState` + desktop-only protokol testləri |
| **Həcm** | 1 gün |

---

## D-5 · İstehsal ölçmələri (Task 4/7/9 öhdəlikləri)

Faza 2.1 (`observability.enabled: true`) bunları **mümkün etdi**, lakin rəqəm
yığmaq **real trafik tələb edir**.

| Ölçmə | Mənbə |
|---|---|
| p50/p95 gecikməsi | T4 |
| `/files/` gecikməsi | T7 |
| DO gecikməsi | T9 |
| İlk arxiv cron-unun yoxlanması | T8 |
| `purgeDeletedFromArchives` sürəti + `PURGE_BATCH` tənzimi | T8 |
| `read` səbəti üçün sampling nisbəti | T4 |

⚠ **Sampling qərarı ölçmədən ƏVVƏL verilə bilməz.** Task 4-ün `presence` limiti
məhz ölçülmədiyi üçün səhv çıxmışdı — eyni səhv təkrarlanmamalıdır.

**Pəncərə:** ilk 7 günlük istehsal trafiki · **Sahib:** layihə sahibi

---

## D-6 · ✅ PRD məhsul qərarları — **İCRA OLUNDU** (2026-08-02)

`docs/TASK-10-SCOPE.md` §3 bu iki bəndi Faza 0-da **qəsdən istifadəçiyə
qaldırmışdı** ("mənim texniki seçimim deyil, məhsul qərarıdır").

🔴 **Qərar verildi: "Kodu PRD-yə tam uyğunlaşdır".** Commit `1188fb2`.
Bu, **görünən məhsul dəyişikliyidir** — saf refaktor deyil.

### D-6.a · Level astanaları — ✅ `migrations/0034_prd_level_thresholds.sql`

| XP | Köhnə (`sqrt(xp/100)+1`) | İndi (PRD §7) |
|---:|---:|---:|
| 100 | Lv2 | **Lv1** |
| 500 | Lv3 | **Lv2** |
| 8 100 | Lv10 | **Lv6** |
| 50 000 | Lv23 | **Lv10** |

**Data itkisi riski yoxdur:** `users`-də `level` sütunu yoxdur, səviyyə hər
yerdə XP-dən törənir → miqrasiya heç bir sətri yeniləmir.

**Geri qaytarma:** `DELETE FROM levels;` (keş TTL 5 dəq). ⚠ Həmin halda
`js/util.js` → `LEVEL_THRESHOLDS` də geri qaytarılmalıdır.

⚠ **Üç nüsxə sinxronlaşdırıldı:** miqrasiya (mənbə) → `worker/level.ts`
(DB-dən oxuyur) → `js/util.js` (əl ilə nüsxə; admin panelində hələ
saxlanılmamış XP üçün canlı önizləmə lazımdır). `worker/routes/admin.ts`-dəki
sabit formula kopyası silinib `levelFromXp()`-ə bağlandı.
`test/util.test.ts` sinxronu **miqrasiya faylının özündən** oxuyub qoruyur.

### D-6.b · XP dəyərləri və hadisələr — ✅ 10/11

| Hadisə | PRD §6 | Əvvəl | İndi |
|---|---:|---:|---:|
| Paylaşım | +10 | +10 | ✅ +10 |
| Orijinal paylaşım | +15 | (fərq yox) | ✅ **+15** (`sharedPostId` boşdursa) |
| Şərh | +2 | +5 | ✅ **+2** |
| Profili tamamlamaq | +100 | +20 | ✅ **+100** |
| İlk qeydiyyat | +50 | yoxdur | ✅ **+50** |
| Gündəlik giriş | +5 | yoxdur | ✅ **+5** (5 giriş yolundan) |
| Repost | +3 | yoxdur | ✅ **+3** |
| Like almaq | +1 | yoxdur | ✅ **+1** |
| Hesabın təsdiqi | +100 | yoxdur | ✅ **+100** |
| Faydalı cavab | +10 | +50 | ✅ +50 (layihə dəyəri saxlanıldı) |
| **Dost dəvəti** | +50 | yoxdur | ⏭️ **AÇIQ** — sabit və tavan hazırdır, lakin **məhsulda dəvət axını yoxdur** |

**Tavanlar yenidən hesablandı** (tavan XP-də ölçülür, əməliyyat sayında yox —
şərh 5→2 endiyi üçün köhnə `comment: 100` tavanı 20 rəy əvəzinə 50 rəyə icazə
verərdi): post 100 · comment 40 · repost 30 · like_received 50 · daily_login 5 ·
invite 100. Cəm **325 > `XP_DAILY_TOTAL` 300** → ümumi tavan **ilk dəfə
bağlayıcıdır** (əvvəl cəm 200 < 300 idi).

**İdempotentlik** — hamısı `ux_xp_logs_source` UNIQUE indeksinə söykənir:
`signup`/`verified` → `refId = uid`; `daily_login` → `refId = YYYY-MM-DD` (UTC);
`repost` → `refId = KÖK post` (toggle dövrəsi XP fabriki olmasın);
`like_received` → `refId = post:bəyənən` (öz postunu bəyənmə istisna edilib).
---

## Yenidən baxış meyarı

| Bənd | Nə vaxt yenidən bax |
|---|---|
| D-1 | Mobil/native client əlavə olunanda |
| D-2 | Tam E2E baseline bərpa olunandan sonra |
| D-3 | D-4 həll olunandan sonra |
| D-4 | Növbəti E2E iş pəncərəsində |
| D-5 | İlk 7 günlük trafikdən sonra |
| D-6 | ✅ **Bağlandı** (2026-08-02). Qalan tək bənd "Dost dəvəti" dəvət axını yazılanda |
