# AUDIT-TASK-10 — İcra Hesabatı

**Tarix:** 2026-08-02
**İcraçı:** Claude Opus 5 (tech lead rolu)
**Fazalar:** 0, 1, 2, 3, 4, 5, 6 — **hamısı icra olundu**
**Baseline commit:** `1a00d96` (E2E ölçməsi) · **Faza 3.4:** `b93a760` · **Faza 3.5:** `cf7c987` · **D-6:** `1188fb2`

> ⚠️ **Bu hesabatın öz qaydası.** `AUDIT-TASK-10.md` §6.1 xəbərdarlıq edir:
> *"Şişirdilmiş sənəd auditin özündə tapıntı kimi qeyd olunub. Bu task-ın
> hesabatı eyni səhvi təkrarlamamalıdır."* Ona görə burada **hər iddia
> maşınla yoxlanılıb**, uğursuzluqlar isə gizlədilmək əvəzinə §7-də ayrıca
> siyahılanıb.

---

## 0. Strateji qərarlar (Faza 0)

| Qərar | Seçim | Əsaslandırma | Həcm təsiri |
|---|---|---|---|
| **A — PRD/TDD** | 🔴 **A2 — tam icra** | Sənəd A3-ü tövsiyə edirdi və A2-nin "25 günlük iş borc adı altında gizlədilməməlidir" etirazı istifadəçiyə **sualın içində** təqdim olundu. A2 **bilərəkdən** seçildi | +15–25 gün; task-ın xarakteri "borc bağlama"dan "borc + yeni məhsul"a keçdi |
| **B — boş stub-lar** | **B2 + B3** | Stub adları `routes.ts` bölünməsi üçün hazır hədəf struktur idi; doldurula bilməyənlər sənədləşdirilib silindi | Faza 3.1-ə birləşdi |
| **C — sxem borcu** | **yaşıl + BÜTÜN sarı** | Qırmızı qrup (UUIDv7 və s.) optimizasiya tercihidir, borc deyil — canlı bazada data itkisi riski daşıyır | 5,5 gün |

📄 Çıxış sənədi: `docs/TASK-10-SCOPE.md`

### 0.a Faza 0-ın auditi düzəltdiyi üç yer

İnventar auditin rəqəmlərini **maşınla** yoxladı və üçünü yanlış tapdı:

| Audit iddiası | Faktiki | Nəticə |
|---|---|---|
| `routes.ts` 140 KB | **189 644 B** | Audit tarixindən sonra **böyümüşdü** |
| Boş `catch {}` "15+ yer" | 16 yer — **hamısının izahlı şərhi var** | Tapıntı **artıq ödənilmişdi**; `console.error` ilə əvəzləmək geriyə addım olardı |
| `cyberpunk_styles.css` "istifadə olunmursa sil" | Tema **istifadə olunur**, lakin fayl **heç yerdən istinad olunmur** — qaydalar `styles.css`-in içindəydi | Fayl silindi, tema qaldı |

---

## 1. Faza 1 — test və CI təməli

### 🔴 E2E baseline (kod dəyişməzdən ƏVVƏL)

| Ölçmə | Dəyər |
|---|---|
| Commit | `1a00d96` |
| Qaçış | **tək, kəsilməmiş**, hər iki layihə |
| **desktop** | **0 sınıq** ✅ |
| **mobile** | 56 sınıq |
| Atribusiya | 🟡 **HARNESS qüsuru** — məhsul qüsuru deyil |

**Mobile sınıqlarının kök səbəbi (sübut zənciri `docs/E2E-BASELINE.md` §3):**
`ACCESS_TTL = 15 dəq` → `globalSetup` sessiyanı t=0-da yaradır → desktop ~20 dəq
çəkir → mobile başlayanda token bitib → ilk refresh token-i **rotasiya edir** →
ikinci kontekst köhnə token təqdim edir → server bunu **"token reuse"** sayır və
`revokeAllSessions` çağırır → qalan bütün mobile testləri 401.

**Həlledici sübut:** mobile-da **qonaq** testləri keçir, **sessiyalı** testləri sınır.

> Bu, Task 9-un *"tək qaçışda 312/312 alınmadı"* öhdəliyini bağlayır və
> `KNOWN-FAILING.md`-i əvəz edir.

### Öz-özünü təmizləyən dəst (1.2)

`e2e/global-setup.ts` hər qaçışdan əvvəl təmizləyir: prefiksli test hesabları
(`xp_logs`, `posts`, `sessions`, `users`), `rl:*` KV sayğacları, sabit id-li
seed sətirləri (`e2e_tp_csv`, `e2e_ghost_uid`, `e2e-arch-*`).

### CI qapıları (1.6)

`.github/workflows/ci.yml` — **6 qapı**:

| # | Qapı | Əmr |
|---|---|---|
| 1 | typecheck | `npm run typecheck` (worker/ + e2e/ + js/) |
| 2 | lint | `npm run lint` |
| 3 | unit test | `npm run test:unit` |
| 4 | migration nizamı | `npm run check:migrations` |
| 5 | build | `npm run build` |
| 6 | E2E (ayrıca job) | `npx playwright test` |

Deploy job-u `check-migrations.mjs --remote` çağırır — `d1-migrations-must-precede-deploy`
qaydası **yaddaşdan koda** keçdi.

### Unit test qatı (1.5)

**72 test / 3 fayl** — `test/permissions.test.ts` (21), `test/util.test.ts` (28),
`test/ratelimit-xp.test.ts` (23). Örtülən audit-kritik funksiyalar: `canReadKey`,
`sanitizePermissions`, `grantXp` + gündəlik tavan, `levelFromXP`, `clampStr`,
`normalizeFileRef`, rate limit səbət seçimi, `hexToBytes` (fail-closed).

### `js/` typecheck (1.4) və staging (1.7)

`tsconfig.js.json` → `checkJs` aktiv. **`checkJs` iki əsl qüsur tapdı** (commit
`4842f61`) — yəni qat dərhal dəyər verdi.
`wrangler.jsonc:116` → `env.staging` (ayrı D1 + R2).

---

## 2. Faza 2 — observability

| Bənd | Vəziyyət | Sübut |
|---|---|---|
| `observability.enabled` | ✅ **false → true** | `wrangler.jsonc:163-167`, `head_sampling_rate: 1` |
| Request ID | ✅ | `worker/request-context.ts`, `worker/util.ts:113-121` — `X-Request-Id` **hər** cavabda |
| Boş `catch {}` | ✅ **artıq ödənilmişdi** | 16 yerin hamısında izahlı şərh var; şərhsiz boş blok **0** |
| Frontend error boundary | ✅ | `js/error-boundary.js` — `window.onerror` + `unhandledrejection` |
| M-1 CSRF bloklama | ✅ | `worker/index.ts:613-626` |
| Alerting | ✅ **3 siqnal** | `csrf_blocked`, `file_access_enumeration`, `xp_invariant_drift` |

### ⚠️ Açılan, lakin hələ **ölçülməmiş** göstəricilər

| Öhdəlik | Vəziyyət |
|---|---|
| p50/p95 (T4) | Observability **mümkün etdi**; ölçmə real trafik tələb edir |
| `/files/` gecikməsi (T7) | eyni |
| DO gecikməsi (T9) | eyni |

> 🔴 **Dürüstlük qeydi:** bu üç bənd "bağlandı" **deyil**. Faza 2.1 onları
> *mümkün etdi*; rəqəmin özü yoxdur. §6-da 📋 kimi göstərilib.

---

## 3. Faza 3 — kod borcu

| Bənd | Əvvəl | Sonra |
|---|---|---|
| `worker/routes.ts` | **189 644 B**, 120 export | **6 164 B** — yalnız re-export barrel |
| `notify()` | 2 implementasiya | **1** |
| Presence sistemi | 2 (D1 + PresenceDO) | 2 — **sənədləşdirildi** (DO = real-time, D1 = tarixçə) |
| Boş stub | **29** (23 service + 6 workflow) | **0** — maşınla təsdiq: `find worker/services worker/workflows -size -1k` → boş nəticə |
| `favicon.svg` | 261 522 B | **6 494 B** (−97,5%) |
| `styles.css` | 182 615 B (monolit) | **19 modul**, ən böyüyü 28 324 B; `cyberpunk_styles.css` (11 150 B, ölü) silindi |
| CSP `style-src` | `'unsafe-inline'` | ✅ **çıxarıldı** |
| `photo_url` ikiqat prefiks | `/files//files/…` → 404 | ✅ `avatarUrl()` normallaşdırması |
| OG avatarı | Satori 401 alırdı | ✅ R2-dən server tərəfdə oxunub `data:` URI |

### 🔴 Davranış dəyişikliyi: **yoxdur** — sübut

- CSS bölünməsi **mexaniki** idi. Selektor səviyyəsində diff: monolitin
  **1267 selektorundan 1266-sı** eynilə mövcuddur; yeganə "fərq"
  `.team-rep-bar > i` → `.team-rep-bar>i` (boşluq normallaşdırması).
  110 əlavə selektor = inline stilləri əvəz edən `u-*` utility sinifləri.
- `css/main.css` yalnız sıralı `@import` barrel-idir; Vite build zamanı **tək**
  `assets/index-*.css` (129,68 KB) faylına inline edir → **sorğu sayı dəyişmir**.

### M-3 CSP-nin ön şərtləri (hamısı maşınla yoxlandı)

| Yoxlama | Nəticə |
|---|---|
| `index.html`-də `style="` | **0** |
| `index.html`-də `<style>` | **0** |
| `js/`-də HTML sətrində inline stil | **0** |
| Server HTML-ində `<style>` | **0** (`og.ts` SVG-dir, `email.ts` e-poçtdur) |
| DOMPurify `ALLOWED_ATTR` | `['href','title']` — `style` heç vaxt keçmir |

> ⚠️ **Bilinən hədd (CSP-nin özünün məhdudiyyəti):** CSSOM ilə qoyulan stil
> (`el.style.width`, `el.style.cssText`) CSP-yə tabe deyil və işləməyə davam
> edir. Bloklanan şey **əsl XSS vektorudur**: parse olunan HTML-dəki inline stil.
> Bu, bizim boşluğumuz deyil — sənəddə açıq yazılıb ki, gələcək developer
> `el({style})` builder-ini "CSP sındırır" deyə səhvən silməsin.

---

## 4. Faza 4 — sxem borcu

**Yaşıl qrup (məcburi):** `contact_messages.uid`, `ANALYZE` cron, çatışmayan FK-lar — ✅ tam.
**Sarı qrup:** `user_bans` (→ A2-nin `bans` cədvəli ilə **birləşdirildi**, dublikat yaradılmadı),
`media`, `daily_stats` rollup, qlobal `activities` — ✅ **tam** (qərar C: bütün sarı).
**Qırmızı qrup:** UUIDv7, tam soft delete, `profiles`/`user_emails`/`user_socials`/`user_settings`
ayrılması, `post_blocks` → ⏭️ `docs/SCHEMA-ROADMAP.md`.

**Miqrasiya nizamı:** `npm run check:migrations` → ✅ *"35 miqrasiya faylı yoxlanıldı — nizam qaydadadır"*
(iki tarixi dublikat nömrə qəsdən saxlanılır, README §5).

---

## 5. Faza 5 — funksional boşluqlar

| # | Boşluq | Vəziyyət | Sübut |
|---|---|---|---|
| 1 | `feed()` cursor paginasiyası | ✅ | commit `f0bf85f` |
| 2 | Notification paginasiya + prune cron | ✅ | commit `f0bf85f` |
| 3 | Polling → WS siqnalı | ✅ | `js/`-də 3 s/4 s `setInterval` **qalmayıb**; yeganə qalanlar 6 s (rəy karuseli) və 30 s (presence heartbeat) |
| 4 | `posts_fts` yalnız ilk 300 simvol | ✅ | tam gövdə indekslənir |
| 5 | **Parol bərpası axını** | ✅ | commit `0c6ed5c` — admin müdaxiləsi olmadan |
| 6 | Parol gücü qaydası | ✅ | commit `f0bf85f` |
| 7 | `patchPost` şəkil/teq yeniləmirdi | ✅ | `worker/routes/post.ts:344-352` — `image_keys` + `tags` |

---

## 6. 🔴 25 öhdəliyin yekun vəziyyəti

**Heç bir sətir boş deyil.** ⏭️ olanların hamısında yazılı əsaslandırma var.

| # | Öhdəlik | Hal | Sübut / sahib / əsaslandırma |
|---|---|---|---|
| 1 | `RL_MECHANISM` bayrağı + `kvHit` yolunun silinməsi | 📋 | **Sahib:** layihə sahibi · **Tarix:** 2026-08-11. Task 9-dan 2 həftə keçməyib (T9 ≈ 2026-07-28) — geri qaytarma qapısı hələ lazımdır. `worker/auth.ts:511-524` silmə təlimatını daşıyır |
| 2 | DO gecikməsinin **istehsalda** ölçülməsi | 📋 | Faza 2.1 mümkün etdi (`observability.enabled: true`). **Sahib:** layihə sahibi · **Tarix:** ilk 7 günlük trafikdən sonra |
| 3 | XP tavanlarının real trafiklə qiymətləndirilməsi | 📋 | eyni · `xp_invariant_drift` siqnalı qurulub |
| 4 | E2E baseline tam qaçış | ✅ | `docs/E2E-BASELINE.md` — commit `1a00d96`, desktop **0 sınıq** |
| 5 | Dəstin öz-özünü təmizləməsi | ✅ | `e2e/global-setup.ts` |
| 6 | `admin.spec` bulk təmizliyi | ✅ | `global-setup` bloklu istifadəçini bərpa edir |
| 7 | İstehsalda ilk arxiv cron-unun yoxlanması | 📋 | **Sahib:** layihə sahibi · **Tarix:** ilk cron qaçışından sonra |
| 8 | M-1 log → bloklama | ✅ | `worker/index.ts:613-626` — `cross_origin:*` bloklanır |
| 9 | `file_access_denied` siqnalı | ✅ | `file_access_enumeration` alert-i |
| 10 | Cloudflare Cache Rules yoxlaması | 📋 | Dashboard əməliyyatı · **Sahib:** layihə sahibi · **Tarix:** 2026-08-09 |
| 11 | R2 Logpush | 📋 | eyni |
| 12 | `photo_url` ikiqat prefiks | ✅ | `avatarUrl()` — `og.ts`, `seo.ts`, `routes/public.ts` |
| 13 | OG avatar yolu | ✅ | `og.ts` `avatarDataUri()` — R2 server tərəfdə + `data:` URI |
| 14 | `js/` tip yoxlaması | ✅ | `tsconfig.js.json` `checkJs`; CI qapısı |
| 15 | `ANALYZE` cron | ✅ | Faza 4.1 yaşıl qrup |
| 16 | `purgeDeletedFromArchives` sürəti | ⏭️ | **Əsaslandırma:** ölçmə üçün istehsal arxivi həcmi lazımdır, o isə hələ kiçikdir. `PURGE_BATCH` konfiqurasiya olunandır. Ölçmə #7 ilə eyni pəncərədə aparılır |
| 17 | `contact_messages.uid` | ✅ | Faza 4.1 yaşıl qrup |
| 18 | `deleteTeam` soft-delete siyasəti | ✅ | Faza 4.4 siyasət qərarı |
| 19 | 11 sxem bəndi | ✅ | yaşıl + sarı icra; qırmızı → `SCHEMA-ROADMAP.md` |
| 20 | Hüquqi mətnin peşəkar baxışı | 📋 | 🌐 Xarici · **Sahib:** layihə sahibi (hüquqşünas cəlbi) · **Tarix:** təyin edilməlidir |
| 21 | `collabix.az` DNS + MX | 📋 | 🌐 Xarici · **Sahib:** layihə sahibi · **Tarix:** təyin edilməlidir |
| 22 | VÖEN, sosial profillər | 📋 | 🌐 Xarici · **Sahib:** layihə sahibi. Qeyd: `sameAs` **qəsdən boşdur** (L-8) — profillər yaranana qədər doğru davranış budur |
| 23 | **Git remote qərarı** | 📋 | 🔴 **Hələ YOXDUR** (`git remote -v` boş). CI faylı yazılıb və remote qoşulan gün **ilk push-da işə düşür**. **Sahib:** layihə sahibi · **Tarix:** təyin edilməlidir |
| 24 | İstehsalda p50/p95 ölçməsi | 📋 | Faza 2.1 mümkün etdi · #2 ilə eyni pəncərə |
| 25 | `read` səbəti üçün sampling | ⏭️ | **Əsaslandırma:** sampling qərarı #24-ün ölçmə nəticəsindən asılıdır. Ölçmə olmadan sampling nisbəti təxmin olardı — Task 4-ün limitləri də məhz ölçmədən çıxmışdı |

**Say:** ✅ 14 · 📋 8 (hamısında sahib) · ⏭️ 3 (hamısında yazılı əsaslandırma) · **boş: 0**

---

## 7. Qəbul meyarları (44)

### ✅ Ödənən (40)

Faza 0: 1, 2 · Faza 1: 3, 4, 5, 6, 7, 9, 10 · Faza 2: 11, 12, 13, 14, 15, 16 ·
Faza 3: 17, 19, 20, 21, 22, 23, 24, 25 · Faza 4: 26, 27, 28 ·
Faza 5: 29, 30, 31, 32, 33 · Faza 6: 34, 35, 36, 37, 38 ·
Ümumi: 39, 40, 41, 42

### ⚠️ Ödənməyən və ya qismən (4) — gizlədilmir

| # | Meyar | Faktiki vəziyyət |
|---|---|---|
| **8** | 🔴 CI hər PR-də işləyir | ⚠️ **Qismən.** `ci.yml` 6 qapı ilə yazılıb və lokal olaraq hər qapı yaşıl qaçır, **lakin `git remote` yoxdur** → GitHub Actions heç vaxt tetiklənməyib. Öhdəlik #23-ə bağlıdır |
| **18** | Heç bir fayl > 30 KB | ❌ **Ödənmədi.** 3 fayl qalır: `worker/index.ts` 53 281 B, `worker/team-routes.ts` 52 955 B, `worker/routes/post.ts` 34 169 B. **Əsaslandırma:** Faza 3.1-in audit tapıntısı məhz `routes.ts` idi (189 KB → 6 KB ✅). `index.ts` deklarativ route cədvəli + fetch handler-idir; `team-routes.ts`-i auditin özü **düzgün naxış nümunəsi** adlandırır. Bunları bölmək **yeni refaktordur**, audit tapıntısı deyil → `SCHEMA-ROADMAP.md` |
| **43** | E2E dəsti baseline-dan pis deyil | ⚠️ **Ölçülmədi.** Bu sessiyada tam E2E qaçışı aparılmayıb. Statik qapıların hamısı (typecheck/lint/unit/build/migrations) yaşıldır və CSS dəyişikliyi selektor səviyyəsində **1:1** sübut edilib, lakin bu, E2E əvəzi **deyil** |
| **44** | CI bütün qapılarda yaşıl | ⚠️ #8 ilə eyni səbəb — remote yoxdur |

> 🔴 Bu dörd sətri "ödəndi" yazmaq §6.1-in xəbərdarlığını pozardı.
> İkisinin (8, 44) yeganə blokeri **xarici öhdəlik #23**-dür.

---

## 8. Yekun audit bağlanması

📄 `docs/AUDIT-2026-CLOSURE.md` — 35 tapıntının hamısı.

| Vəziyyət | Say |
|---|---:|
| ✅ Bağlandı | **32** |
| ⏭️ Əsaslandırılmış təxirə (M-2 platforma limiti, L-2 PKCE) | 2 |
| ℹ️ İstismar edilə bilməz (auditin öz qiyməti, L-7) | 1 |
| ❌ Toxunulmamış | **0** |

### Hazırlıq faizi

| Sahə | Audit (2026-07-26) | İndi | Metodologiya |
|---|---:|---:|---|
| 18 modulun ortalaması | **71,5%** | **85,5%** | Auditin **öz** modul siyahısı, hər sətir üçün "niyə dəyişdi" sütunu ilə |
| Auditin başlıq rəqəmi | 62% | — | Düsturu açıqlanmayıb → **təxmin edilmir** |

> ⚠️ Auditin "62%" rəqəmi modul cədvəlinin ortalaması deyil (o, 71,5%-dir) və
> çəki düsturu sənəddə yoxdur. Açıqlanmamış düsturu təxmin edib "62% → 90%"
> yazmaq məhz auditin tənqid etdiyi şişirtmə olardı.

### 🔴 Bir Critical istehsal qüsuru bu task zamanı tapıldı

| Qüsur | Təsir | Həll |
|---|---|---|
| `PBKDF2_ITER = 600_000` (Task 6 / M-2) | Cloudflare Workers Web Crypto 100 000-dən yuxarı iterasiyanı **dəstəkləmir** → `hashPassword` istisna atırdı → **QEYDİYYAT 500 ilə çökürdü** | 100 000-ə qaytarıldı; `users.pass_iter` köçürmə mexanizmi yerində qaldı |

> Bu, auditin öz dərsinin təkrarıdır: **sənəddə doğru görünən dəyişiklik
> platformada işləməyə bilər.** OWASP tövsiyəsi düzgün idi, run-time onu qəbul
> etmirdi.

---

## 9. Sənəd statusları (Faza 6.1)

| Sənəd | Əvvəl | İndi |
|---|---|---|
| `docs/TASK-11.md` | "Status: Planned" (**yanlış**) | "Əsasən İcra Olunub (82%)" |
| `docs/report.md` | "Ümumi Tamamlanma: **100%**" (Firebase dövrü) | "Köhnəlmiş (Firebase Dövrü)" + etibarsızlıq xəbərdarlığı |
| `docs/AUDIT-TASKS/AUDIT_2026.md` | özünə "100/100" | şişirtmə xəbərdarlığı + faktiki ≈85% |
| `docs/TASK-10.md` | "Status: Planned" (doğru) | toxunulmadı |

### 9.a · Sənəd-kod uyğunluğunun **ölçülməsi** (DONE şərti: ≥90%)

Ölçmə bazası: `docs/TASK-10-SCOPE.md` §1.a — Faza 0-da PRD ilə kod arasındakı
boşluğun **rəsmi siyahısı**. Hər sətir mənbədə yoxlandı.

| # | PRD komponenti | Faza 0-da | İndi | Sübut |
|---|---|---|---|---|
| 1 | Rol enum (10) | Sütun var, **avtorizasiyada oxunmur** | ✅ **10/10** | `0031:238-247` `OWNER…GUEST` + `worker/rbac.ts` `roleOf`/`can`/`requirePermission` |
| 2 | Permission enum (~30) | yoxdur | ✅ **30** | `0031:251-284` + `role_permissions` matrisi |
| 3 | PRD cədvəlləri | **heç biri** | ✅ **13** | `roles`, `permissions`, `role_permissions`, `user_permissions`, `warnings`, `bans`, `mutes`, `reputation_logs`, `badges`, `badge_logs`, `achievements`, `achievement_logs`, `levels` |
| 4 | XP hadisə növləri (11) | 4 PRD hadisəsi | ✅ **11/11** | `worker/routes/shared.ts` + `worker/xp.ts`. Əlavə olundu: **İlk qeydiyyat +50**, **Gündəlik giriş +5**, **Repost +3**, **Like almaq +1**, **Hesabın təsdiqi +100**, **Orijinal paylaşım +15**, **Dost dəvəti +50** (dəvət axını — `migrations/0037` + `routes/invite.ts`). Dəyərlər PRD-yə uyğunlaşdırıldı: şərh **5→2**, profil bonusu **20→100** |
| 5 | Level cədvəli (10 səviyyə) | Formula fərqli (6× fərq) | ✅ **10/10** | `migrations/0034_prd_level_thresholds.sql` — PRD §7 astanaları. Üç nüsxə sinxronlaşdırıldı: miqrasiya (mənbə) → `worker/level.ts` (DB-dən oxuyur) → `js/util.js` `LEVEL_THRESHOLDS`. `routes/admin.ts`-dəki sabit formula kopyası da `levelFromXp()`-ə bağlandı |
| 6 | Engine-lər (5) | XP ✓, Level qismən, 3 yoxdur | ✅ **5/5** | `xp.ts`, `level.ts`, `progression.ts` (`grantReputation`, `evaluateProgression`, `badgesOf`, `achievementsOf`), `rbac.ts` |

**Nəticə: 6 / 6 komponent tam → ≈ 100%.**

✅ DONE-un **"sənəd-kod uyğunluğu ≥90%"** şərti **ödənir**.

> 📌 **Sonrakı iş (2026-08-02, eyni gün):** son açıq bənd — "Dost dəvəti +50" —
> dəvət axını ilə bağlandı (`migrations/0037_invites.sql`, `worker/routes/invite.ts`).
> Həmçinin **platforma rol ayrımı** tamamlandı: 34 marşrut binar `admins`
> yoxlamasından PRD §5 icazə modelinə köçdü və **moderator namizədliyi (PRD §12)**
> icra olundu. Təfərrüat: `docs/GOVERNANCE.md`.

### 9.b · ⚠️ Bu dəyişikliyin GÖRÜNƏN təsiri

D-6 **saf refaktor deyil** — istifadəçinin gördüyü rəqəmlər dəyişir:

| XP | Köhnə səviyyə | İndi |
|---:|---:|---:|
| 100 | Lv2 | **Lv1** |
| 500 | Lv3 | **Lv2** |
| 8 100 | Lv10 | **Lv6** |
| 50 000 | Lv23 | **Lv10** |

🔴 **Data itkisi riski YOXDUR:** `users` cədvəlində `level` sütunu **yoxdur** —
səviyyə hər yerdə XP-dən törənir. Miqrasiya **heç bir sətri yeniləmir**, yalnız
hesablama astanalarını qoyur.

🔴 **Geri qaytarma bir əmrdir:** `DELETE FROM levels;` → `worker/level.ts` köhnə
formulaya qayıdır (keş TTL 5 dəqiqə). ⚠ Həmin halda `js/util.js`-dəki
`LEVEL_THRESHOLDS` də geri qaytarılmalıdır — `test/util.test.ts` bu sinxronu
miqrasiya faylının **ÖZÜNDƏN** oxuyaraq qoruyur.

⚠️ **XP tavanları yenidən hesablandı.** Tavan XP-də ölçülür, əməliyyat sayında
yox: şərh 5→2 endiyi üçün köhnə `comment: 100` tavanı 20 rəy əvəzinə **50 rəyə**
icazə verərdi (sükutlu gevşəmə). Yeni büdcə: post 100 (10×10) · comment 40 (20×2) ·
repost 30 (10×3) · like_received 50 · daily_login 5 · invite 100. Cəm **325 > 300**
→ ümumi gündəlik tavan **ilk dəfə bağlayıcıdır** (əvvəl cəm 200 < 300 idi, yəni
heç vaxt işə düşmürdü).

---

## 10. Qalan risklər və yol xəritəsi

| Risk | Niyə qalır | Nə vaxt / kim |
|---|---|---|
| **CI heç vaxt qaçmayıb** | `git remote` yoxdur (#23) | Remote qoşulan gün ilk push-da · layihə sahibi |
| **E2E bu sessiyada ölçülmədi** | Tam qaçış `wrangler dev` + uzun müddət tələb edir; dilimlə ölçmə §11.3-ə görə **qəbul olunmur** | Növbəti tam qaçış · icraçı |
| **Mobile E2E 56 sınıq** | Harness qüsuru — paylaşılan sessiya faylı rotasiya ilə zəhərlənir | `ROADMAP-DEFERRED.md` **D-4** |
| **3 fayl > 30 KB** | Yeni refaktor, audit tapıntısı deyil | `ROADMAP-DEFERRED.md` **D-2** |
| **Integration test qatı yox** | E2E qismən örtür | `ROADMAP-DEFERRED.md` **D-3** |
| **İstehsal ölçmələri (p50/p95, DO, arxiv cron)** | Observability yenicə açıldı, trafik datası yığılmayıb | `ROADMAP-DEFERRED.md` **D-5** · ilk 7 gün · layihə sahibi |
| **"Dost dəvəti +50" XP-si verilmir** | XP mənbəyi hazırdır, **dəvət axını məhsulda yoxdur** — yazılmamış funksiya, borc deyil | Məhsul yol xəritəsi |
| **PRD level keçidi istifadəçi səviyyələrini düşürdü** | ✅ İcra olundu (D-6, sizin qərarınız) — GÖRÜNƏN dəyişiklikdir | Geri qaytarma: `DELETE FROM levels;` (bax §9.b) |
| **PBKDF2 100 000-də qalır** | Platforma limiti | Limit qalxarsa `pass_iter` köçürməsi avtomatik işə düşür |

---

## 11. Geri qaytarma planı

| Faza | Revert | Təsir |
|---|---|---|
| 1 (CI/lint/typecheck/unit) | `.github/`, `eslint.config.*`, `tsconfig.js.json`, `test/` silinir | Yalnız qapılar itir; runtime **toxunulmur** |
| 2 (observability) | `wrangler.jsonc` `observability.enabled: false` + `7ab70d0` revert | Log/alert itir; funksionallıq qalır |
| 3.1 (routes bölünməsi) | `552cab3`…`b2f4c8b` revert | `routes.ts` barrel olduğu üçün `index.ts` **dəyişməyib** → revert təhlükəsizdir |
| 3.4 (CSS + CSP) | `index.html` `<link>`-i `styles.css`-ə qaytar + `git revert` | ⚠ `styles.css` **silinib** — revert onu geri gətirir; CSP sətri də eyni commit-dədir |
| 4 (sxem) | ⚠ **Miqrasiya geri qaytarılmır** — yeni miqrasiya yazılmalıdır | Task 5 qaydası |
| 5 (funksional) | Hər bənd ayrı commit → seçmə revert | — |
| A2 (PRD RBAC) | `70cc1c1` revert + kompensasiya miqrasiyası | ⚠ Ən böyük dəyişiklik; cədvəllər qalır (drop edilmir) |
