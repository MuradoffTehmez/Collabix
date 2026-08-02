# AUDIT-2026-07-26 — Yekun Bağlanma Sənədi

**Tarix:** 2026-08-02
**Mənbə audit:** `docs/AUDIT-TASKS/AUDIT-2026-07-26.md` (35 tapıntı)
**Bağlayan zəncir:** AUDIT-TASK-1 … AUDIT-TASK-10
**Tələb:** `AUDIT-TASK-10.md` §6.3

> ⚠️ **Ölçmə dürüstlüyü qaydası (§11.3).** Bu sənəddəki hər ✅ **koda baxılaraq**
> təsdiqlənib — task hesabatlarına güvənilməyib. Auditin öz dərsi budur:
> `AUDIT_2026.md` özünə "100/100" verirdi və bu, auditdə **tapıntı** kimi
> qeyd olundu. Aşağıdakı cədvəldə "Sübut" sütunu boş qalan sətir yoxdur.

---

## 1. Kritik tapıntılar (3)

| ID | Tapıntı | Vəziyyət | Task | Sübut (maşınla yoxlanıldı) |
|---|---|---|---|---|
| **C-1** | `/files/*`-də avtorizasiya yoxdur (IDOR) → fayl eksfiltrasiyası | ✅ **Bağlandı** | 7 | `worker/files-auth.ts` → `canReadKey`; `worker/index.ts` serveFile yolunda çağırılır. Unit test: `test/permissions.test.ts` |
| **C-2** | 53 istifadəçinin açıq mətnlə parolu (`legacy/`) | ✅ **Bağlandı** | 1 | `legacy/` və `testsprite_tests/` qovluqları **mövcud deyil** (`ls` → No such file) |
| **C-3** | Arxivlənmiş mesajlar məhsul daxilində əlçatmaz | ✅ **Bağlandı** | 8 | `worker/routes/room.ts:116-199` arxivi oxuyur; `worker/routes/export.ts:137,161` GDPR ixracına daxil edir |

---

## 2. Yüksək tapıntılar (7)

| ID | Tapıntı | Vəziyyət | Task | Sübut |
|---|---|---|---|---|
| **H-1** | Komanda RBAC-ında `'*'` wildcard eskalasiyası | ✅ **Bağlandı** | 3 | `sanitizePermissions` + eskalasiya qadağası; `test/permissions.test.ts` (21 test) |
| **H-2** | `GET /api/admin/admins` admin qapısı olmadan açıq | ✅ **Bağlandı** | 1 | `worker/index.ts:211-213` — hər üç route-da `admin: true` |
| **H-3** | Rate limiter atomik deyil, KV yazı həddinə düşür | ✅ **Bağlandı** | 9 | `wrangler.jsonc:142,222` `RATE_LIMIT_DO` binding; `:228` `new_sqlite_classes: ["RateLimitDO"]` |
| **H-4** | 171 route-un 107-sində rate limit yoxdur | ✅ **Bağlandı** | 4 | Model **opt-out**-a çevrildi: `rl` yoxdursa `read` səbəti tətbiq olunur |
| **H-5** | XP anti-abuse tamamilə yoxdur (sonsuz XP) | ✅ **Bağlandı** | 9 | `migrations/0030_xp_logs.sql:34` → `ux_xp_logs_source` UNIQUE indeks + gündəlik tavan; `test/ratelimit-xp.test.ts` |
| **H-6** | WS avtorizasiyası yalnız upgrade anında yoxlanılır | ✅ **Bağlandı** | 9 | `disconnect(uid)` RPC (commit `0c10393`) — blokdan sonrakı sorğu 32 s → 20 ms |
| **H-7** | İstehsal migration-larında demo/test seed datası | ✅ **Bağlandı** | 5 | `migrations/0020_drop_demo_seed.sql` |

---

## 3. Orta tapıntılar (17)

| ID | Tapıntı | Vəziyyət | Task | Sübut / əsaslandırma |
|---|---|---|---|---|
| **M-1** | CSRF yalnız log rejimində | ✅ **Bağlandı** | 6 → **10/2.3** | `worker/index.ts:613-626` — `cross_origin:*` siqnalı **bloklanır** (403 `csrf_blocked`), `sec_fetch_site:*` log rejimində qalır (yalançı pozitiv riski) |
| **M-2** | PBKDF2 100 000 iterasiya (OWASP: 600 000) | ⏭️ **Platforma limiti** | 6 → **10** | 🔴 Task 6-da 600 000 tətbiq olundu və **canlı mühitdə qeydiyyatı çökdürdü**: Cloudflare Workers Web Crypto 100 000-dən yuxarı iterasiyanı dəstəkləmir. 100 000-ə qaytarıldı. `users.pass_iter` (0023) köçürmə mexanizmi **yerində qalır** — limit qalxan gün tədrici köçürmə işə düşür |
| **M-3** | CSP `style-src 'unsafe-inline'` | ✅ **Bağlandı** | **10/3.4** | `worker/index.ts` CSP-dən çıxarıldı. Ön şərt ödəndi: `index.html`-də inline `style=` **0**, `<style>` bloku **0**; `js/` daxilində HTML sətirlərində inline stil **0**; DOMPurify `ALLOWED_ATTR: ['href','title']` |
| **M-4** | RoomDO in-memory state hibernation-da itir | ✅ **Bağlandı** | 9 | `worker/room-do.ts` — `ctx.storage` |
| **M-5** | `blocks` JSON ölçü limiti yoxdur | ✅ **Bağlandı** | 6 | `clampBlockRefs` + blok başına clamp |
| **M-6** | `createTeam` clamp etmir | ✅ **Bağlandı** | 6 | `clampStr(name, 80)` / `(description, 2000)` |
| **M-7** | `updateTeam` avatar/banner validasiya olunmur | ✅ **Bağlandı** | 6 | yalnız `/files/` qəbul olunur |
| **M-8** | `bumpActivity` read-modify-write (lost update) | ✅ **Bağlandı** | 6 | JSON blob yazısı dayandırıldı, `user_activity` UPSERT-i tək mənbədir |
| **M-9** | `mapUser` hər kəsin `settings`-ini yayımlayır | ✅ **Bağlandı** | 6 | `self === false` halında `settings` cavabdan çıxarılır |
| **M-10** | Bloklanmış istifadəçinin məzmunu feed-də qalır | ✅ **Bağlandı** | 6 | `feed()` və `listComments`-də `blocked = 0` filtri |
| **M-11** | `adminTeamAction` audit log-a yazmır | ✅ **Bağlandı** | 6 | `logAdmin(c, 'team-' + action, …)` |
| **M-12** | `unlinkOAuth` admin log-unu çirkləndirir | ✅ **Bağlandı** | 6 | `security_events`-ə köçürüldü |
| **M-13** | `adminLogAction` log forging-ə icazə verir | ✅ **Bağlandı** | 6 | `action` ağ siyahısı |
| **M-14** | `adminRemoveAdmin` son admini/özünü silə bilir | ✅ **Bağlandı** | 6 | `worker/routes/admin.ts:219-225` — **iki ayrı müdafiə**: `self_admin_removal` (409) + `last_admin` (409) |
| **M-15** | `createTeamTask.assigneeId` üzvlük yoxlanmır | ✅ **Bağlandı** | 6 | `team_members` yoxlaması |
| **M-16** | `.gitignore` backslash ilə → işləmir | ✅ **Bağlandı** | 1 | `/` sintaksisi; `legacy/`, `testsprite_tests/` əlavə olundu |
| **M-17** | `hexToBytes` boş salt-da 500 verir | ✅ **Bağlandı** | 6 | `worker/auth.ts:96-100` — `null` qaytarır (**fail-closed**); `test/util.test.ts` |

---

## 4. Aşağı tapıntılar (8)

| ID | Tapıntı | Vəziyyət | Task | Sübut / əsaslandırma |
|---|---|---|---|---|
| **L-1** | `X-XSS-Protection` başlığı | ✅ **Bağlandı** | 1 | `worker/index.ts:377-381` — **qəsdən qoyulmur**, səbəbi şərhdə (auditor-un özü yan-kanal vektoru idi) |
| **L-2** | OAuth-da PKCE yoxdur | ⏭️ **Təxirə salındı** | — | **Əsaslandırma:** auditin öz qiyməti *"confidential client + ikiqat `state` yoxlaması ilə risk aşağıdır"*. PKCE **public client** üçün nəzərdə tutulub; bizim `client_secret` serverdədir. Bu, təhlükəsizlik boşluğu deyil, **dərinlikdə müdafiə** əlavəsidir → `docs/ROADMAP-DEFERRED.md` **D-1** |
| **L-3** | `LIKE` naxışlarında `%`/`_` escape edilmir | ✅ **Bağlandı** | 6 | escape bütün çağırış yerlərinə yayıldı |
| **L-4** | `createReport.targetUid` varlıq yoxlaması yoxdur | ✅ **Bağlandı** | 6 | varlıq yoxlaması əlavə olundu |
| **L-5** | `resolveReport` ixtiyari status qəbul edir | ✅ **Bağlandı** | 6 | enum məhdudlaşdırması |
| **L-6** | `getTeamActivity` `before` NaN yoxlanmır | ✅ **Bağlandı** | 6 | NaN yoxlaması |
| **L-7** | R2-də path traversal | ℹ️ **İstismar edilə bilməz** | — | Auditin **öz qiyməti**: R2 iyerarxik fayl sistemi deyil, `../` düz açar sətridir. Kod dəyişikliyi tələb olunmur |
| **L-8** | JSON-LD `sameAs` mövcud olmayan profillərə işarə edir | ✅ **Bağlandı** | 2 | `worker/seo.ts:142-155` — `sameAs` **qəsdən çıxarıldı**, boş massiv də qoyulmadı; səbəb şərhdə |

---

## 5. Yekun say

| Vəziyyət | Say | Pay |
|---|---:|---:|
| ✅ Bağlandı | **32** | 91,4% |
| ⏭️ Əsaslandırılmış təxirə (M-2 platforma limiti, L-2 PKCE) | **2** | 5,7% |
| ℹ️ İstismar edilə bilməz (auditin öz qiyməti, L-7) | **1** | 2,9% |
| ❌ Naməlum / toxunulmamış | **0** | 0% |

---

## 6. Hazırlıq faizi — **eyni metodologiya ilə**

Audit §8-dəki **18 modulun** siyahısı və qiymətləndirmə üsulu dəyişdirilməyib.
Hər sətir üçün "niyə dəyişdi" göstərilib; sübutsuz artım yoxdur.

| Modul | Audit (2026-07-26) | İndi | Niyə dəyişdi |
|---|---:|---:|---|
| auth | 85% | **93%** | Parol bərpası axını (Faza 5/#5), parol gücü qaydası (#6). Qalan: PKCE (L-2), e-poçt dəyişmə axını |
| user / profile | 80% | **85%** | `photo_url` ikiqat prefiks düzəldi (publik profil **sınıq idi**); `bans`/`mutes` cədvəlləri gəldi |
| feed / post | 72% | **85%** | Cursor paginasiya (#1), `patchPost` artıq `image_keys` + `tags` yeniləyir (#7) |
| comment / reaction / share | 85% | **88%** | 4 s polling WS siqnalına keçdi (#3) |
| notification | 78% | **88%** | Paginasiya + prune cron (#2) |
| admin panel | 80% | **88%** | PRD rol ierarxiyası: `roles`/`permissions`/`user_permissions` (A2) — "hər admin = tam səlahiyyət" bitdi |
| settings | 85% | **85%** | dəyişmədi |
| search / filter | 70% | **80%** | `posts_fts` artıq **tam gövdəni** indeksləyir (əvvəl ilk 300 simvol) |
| upload / media | 75% | **75%** | dəyişmədi (virus skanı və kvota **əhatədən kənar**) |
| rooms / chat | 70% | **80%** | 3 s chat polling-i WS-ə keçdi (#3) |
| **XP / role / progression** | **12%** | **95%** | 🔴 Ən böyük dəyişiklik: **A2 qərarı icra olundu** — `roles`, `permissions`, `role_permissions`, `user_permissions`, `levels`, `badges`, `badge_logs`, `achievements`, `achievement_logs`, `reputation_logs`, `warnings`, `bans`, `mutes` (`0031`). **D-6 ilə tamamlandı:** PRD §7 level astanaları (`0034`) + PRD §6-nın 11 hadisəsindən 10-u. Açıq: "Dost dəvəti" (dəvət axını məhsulda yoxdur) |
| database schema | 82% | **90%** | Faza 4: yaşıl qrup **+ bütün sarı qrup** icra olundu |
| API layer | 80% | **88%** | `routes.ts` 185 KB → 4,7 KB barrel; request ID hər cavabda |
| routing (frontend) | 80% | **80%** | dəyişmədi |
| responsive layout | 88% | **88%** | dəyişmədi (Firefox/Safari **əhatədən kənar**) |
| error states | 70% | **88%** | Request ID + strukturlu log + frontend error boundary + 500-də `code`+`requestId` |
| logging / monitoring | 50% | **85%** | `observability.enabled` **false → true**; alerting; strukturlu log |
| test layer | 45% | **78%** | Unit qatı (64 test / 3 fayl), CI 6 qapı, öz-özünü təmizləyən E2E, staging. Qalan: **integration test yoxdur**, mobile E2E harness qüsuru |

### Yekun

| Ölçü | Audit | İndi |
|---|---:|---:|
| **18 modulun ortalaması** | **71,5%** | **85,5%** |
| Auditin başlıq rəqəmi | **62%** | — |

> ⚠️ **Niyə iki rəqəm var və niyə 62% ilə birbaşa müqayisə etmirəm.**
> Auditin başlıq "62%" rəqəmi modul cədvəlinin ortalaması **deyil** (o, 71,5%-dir) —
> ona təhlükəsizlik tapıntılarının çəkisi də daxil edilib, lakin çəki düsturu
> sənəddə açıqlanmayıb. Açıqlanmamış düsturu təxmin edib "62% → 90%" yazmaq
> məhz auditin tənqid etdiyi şişirtmə olardı. Ona görə **yenidən hesablana bilən
> yeganə göstərici** — 18 modulun ortalaması — verilir: **71,5% → 85,5%**.
> Təhlükəsizlik tərəfi isə ayrıca və dəqiq ölçülür: **35 tapıntının 32-si bağlı,
> 0-ı toxunulmamış** (§5).

---

## 7. Bağlanmayanların açıq siyahısı

Aşağıdakılar **bilərəkdən** açıqdır. Heç birinin səbəbi "vaxt çatmadı" deyil.

| Bənd | Səbəb | Hara köçdü |
|---|---|---|
| **M-2** PBKDF2 600 000 | Cloudflare Workers platforma limiti — tətbiqi qeydiyyatı çökdürür | `users.pass_iter` mexanizmi kodda hazır gözləyir |
| **L-2** PKCE | Confidential client-də dərinlikdə müdafiədir, boşluq deyil | `docs/ROADMAP-DEFERRED.md` **D-1** |
| **Qırmızı sxem qrupu** (UUIDv7, tam soft delete, `profiles`/`user_emails`/`user_socials`/`user_settings` ayrılması, `post_blocks`) | Optimizasiya tercihidir, borc deyil; canlı bazada data itkisi riski daşıyır | `docs/SCHEMA-ROADMAP.md` **R-1…R-4** |
| **3 fayl > 30 KB** (qəbul meyarı 18) | Audit tapıntısı `routes.ts` idi və bağlandı; qalanlar **yeni refaktordur** | `docs/ROADMAP-DEFERRED.md` **D-2** |
| **Integration test qatı (Miniflare)** | E2E onları qismən örtür; Faza 1-in tələbi unit qatı idi | `docs/ROADMAP-DEFERRED.md` **D-3** |
| **Mobile E2E harness qüsuru (56 sınıq)** | Məhsul qüsuru **deyil** — paylaşılan sessiya faylının rotasiya ilə zəhərlənməsi | `docs/E2E-BASELINE.md` §3 · `ROADMAP-DEFERRED.md` **D-4** |
| **"Dost dəvəti +50"** | XP mənbəyi və tavanı hazırdır, lakin **məhsulda dəvət axını yoxdur** — yazılmamış funksiya, borc deyil | Məhsul yol xəritəsi |
| **Xarici öhdəliklər** (DNS/MX, VÖEN, hüquqi baxış, git remote, sosial profillər) | Kod deyil, əməliyyat qərarı | `docs/AUDIT-TASK-10-REPORT.md` §6 — sahib + tarix |
