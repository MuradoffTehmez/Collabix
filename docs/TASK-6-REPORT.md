# TASK-6 — Yekun Hesabat

**Tarix:** 2026-07-21 · **Stack:** Cloudflare Workers + D1 + R2 + KV
**Prod:** https://collabix.muradofftehmez01.workers.dev · **Version:** `549a83d6-df99-45f2-9665-6bfb264daa49`

---

## 1. Ümumi nəticə

| Bölmə | Bənd | Status |
|---|---|---|
| BÖLMƏ 1 — Ana səhifə | 13 | ✅ 13/13 |
| BÖLMƏ 2 — İstifadəçilər | 6 | ✅ 6/6 |
| BÖLMƏ 3 — Admin paneli | 12 | ✅ 12/12 |
| BÖLMƏ 4 — Real-time (DO+WS) | — | ✅ bitdi (2026-07-21, §8-ə bax) |
| **CƏMİ** | **31** | **✅ 31/31** |

> **Yenilənmə (2026-07-21):** hesabat ilk yazılanda Admin#12 (real-time) razılaşdırılmış
> şəkildə ayrıca fazaya buraxılmışdı və presence müvəqqəti heartbeat ilə işləyirdi.
> BÖLMƏ 4 sonradan tam icra olunub və deploy edilib → **TASK-6 indi 31/31**.

### Doğrulama

| Yoxlama | TASK-6 yekununda | Real-time-dan sonra (cari) |
|---|---|---|
| `tsc --noEmit` | ✅ təmiz | ✅ təmiz |
| `vite build` | ✅ ~700 ms | ✅ ~700 ms |
| `wrangler deploy --dry-run` | ✅ 2076 KiB / gzip 720 KiB | ✅ 2089 KiB / gzip 723 KiB |
| **E2E (Playwright)** | ✅ **110/110** | ✅ **132/132** (66 desktop + 66 Pixel 7) |
| Konsol xətası | ✅ sıfır | ✅ sıfır |
| Prod smoke | ✅ public 200, admin 401 | ✅ + WS endpointləri 401 (auth işləyir) |

---

## 2. Görülən işlər

### BÖLMƏ 1 — Ana səhifə (13/13)

| # | Bənd | İcra |
|---|---|---|
| 1 | Hero fade-in-up | `heroIn` keyframe, 5 elementli stagger (0→320 ms), yalnız `opacity`+`translateY`. Düymələr `scale(1.03)` + kölgə |
| 2 | Count-up | `countUp()` → [util.js](js/util.js), `Intl.NumberFormat`, `onceInView` ilə görünəndə bir dəfə |
| 3 | Kart hover | `translateY(-4px)` + kölgə dərinliyi |
| 4 | Heatmap stagger | `--hd-delay` custom property + `.hm-lit`; animasiya yalnız viewport-a girəndə |
| 5 | Testimonials karusel | `translateX` track, oxlar, nöqtələr, 6 s auto-advance, hover/focus-da dayanır, üfüqi-jest swipe, `aria-hidden` idarəsi |
| 6 | Sticky nav | 24 px threshold-dan sonra `blur(16px) saturate(140%)`, rAF-throttle, aktiv-link alt xətti |
| 7 | Loqolu tech badge | [scripts/gen-techlogos.mjs](scripts/gen-techlogos.mjs) — simple-icons-dan 14 loqo statik fayla generasiya olunur (self-host) |
| 8 | Addım ikonları | 4 Lucide SVG — [icons.js](js/icons.js) |
| 9 | Kod copy | Copy komponenti feed.js-dən [icons.js](js/icons.js)-ə çıxarıldı; feed **və** homepage eyni kodu işlədir |
| 10 | Klik-tag filtri | `#users?skill=Python`; qonaq üçün seçim `sessionStorage`-da saxlanılır və qeydiyyatdan sonra tətbiq olunur |
| 11 | Wizard progress | Bar var idi — **faiz** və 4 addımın etiketli stepper-i əlavə edildi (`role="progressbar"` + `aria-valuenow`) |
| 12 | Sosial ikonlar | `SITE.social` massivə çevrildi (Discord/GitHub/LinkedIn) |
| 13 | Cookie | `/cookies` səhifəsi və hüquqi sütun **artıq var idi** — banner + razılıq saxlanması əlavə edildi |

### BÖLMƏ 2 — İstifadəçilər (6/6)

| # | Bənd | İcra |
|---|---|---|
| 1 | Onlayn indikator | Presence heartbeat (30 s) artıq işləyirdi; `privacy.showOnlineStatus`-a hörmət təsdiqləndi |
| 2 | Sabit hündürlük + "+N" | 3 bacarıq görünür, qalanı `+N` nişanında; popover hover/klik/`focus-within` ilə, `aria-expanded` |
| 3 | Grid ⇄ List | Toggle + `localStorage`, reload-dan sonra qalır |
| 4 | Command palette | Yeni [palette.js](js/palette.js): Ctrl/Cmd+K, ↑/↓/↵/Home/End/Esc, fokus tələsi, `role=listbox` |
| 5 | Sıralama | **Server-side** — yeni `/api/users/directory`, 4 sıra rejimi, keyset cursor, infinite scroll |
| 6 | Avatar rəngləri | WCAG düzəlişi (aşağıda §3.1) |

### BÖLMƏ 3 — Admin paneli (11/12)

| # | Bənd | İcra |
|---|---|---|
| 1 | Rəng kodlaması | Sol kənar + rəqəm rəngi (info/danger/warn/alert/ok); rəng **tək siqnal deyil** — mətn etiketi də var |
| 2 | Ripple | Klik nöqtəsindən yayılan dalğa, yalnız transform/opacity |
| 3 | Taksonomiya DnD | Native HTML5 DnD + **↑/↓ klaviatura alternativi**; drop-da tək D1 `batch()` |
| 4 | Siyahı filtri | Serverdə `WHERE` + 0006 index-ləri |
| 5 | Bulk əməliyyatlar | Checkbox + "hamısını seç", təsdiq dialoqu, D1 `batch()` |
| 6 | Terminal jurnal | Monospace, səviyyəyə görə rəngləmə, server-side səviyyə filtri, auto-scroll, kopyala |
| 7 | Skeleton | Hesabat + istifadəçi siyahısı açılışında |
| 8 | Sparkline | Inline SVG + hover tooltip, `stats_daily`-dən |
| 9 | Modal | "#Otaqlara bax" modal-da — səhifə dəyişmir |
| 10 | Pagination | İstifadəçi siyahısı **və** jurnal: keyset cursor + infinite scroll |
| 11 | CSV ixracı | Worker-dən stream (500-lük hissələr), UTF-8 BOM, formula-injection qoruması |
| 12 | Real-time | ⏸ DO+WS fazası |

---

## 3. Tapılan və həll edilən xətalar

E2E dəsti kod yazıldıqdan sonra **6 real qüsur** üzə çıxardı. Hamısı düzəldilib.

### 3.1 WCAG kontrast qüsuru — avatar rəngləri (İstifadəçilər#6)

Test bir avatarda 4.42 nisbəti göstərdi. Tək hal saymayıb **bütün 360 çaları skan etdim**:
`hsl(h 45% 32%)` / `hsl(h 80% 82%)` cütlüyünün ən pis halı **4.25** idi (60° sarı zolağı),
AA həddi isə 4.5. Yəni sistematik qüsur idi.

**Həll:** 28% / 86% → bütün çalarlar üzrə minimum **5.33**. Görünüş praktiki eynidir.
Fayl: [js/util.js](js/util.js) `avatarNode()`.

### 3.2 Aksent fonunda mətn kontrastı — bütün sayt

Ölçülmüş nisbətlər:

| Tema | `--coral` | ağ mətn | tünd mətn |
|---|---|---|---|
| dark | `#4a8fff` | **3.15** ✗ | 6.01 ✓ |
| matrix | `#00e676` | **1.67** ✗ | 12.01 ✓ |
| light | `#2f6fe0` | 4.70 ✓ | 4.30 ✗ |

`background: var(--coral); color: #fff` cütlüyü saytda **7 yerdə** işlənirdi
(dil seçici, aktiv tablar, nav elementləri…) — yəni qaranlıq və matrix temalarında
hamısı həddin altında idi.

**Həll:** temaya bağlı `--on-accent` dəyişəni əlavə edildi və 7 yerin hamısı ona keçirildi.
Bu, yalnız yeni komponentləri deyil, **mövcud UI-nı da** düzəldir.

### 3.3 Mobil üfüqi daşma — toxunma koordinatlarını sındırırdı

Mobil E2E-də 7 test düşdü. İlk fərziyyəm (animasiya yarışı) **yanlış çıxdı**.
Ölçmə ilə getdim:

1. `force: true` klik dispatch olurdu, amma banner qalırdı → hadisə düyməyə çatmır.
2. `elementFromPoint` isə düyməni qaytarırdı → layout viewport ≠ visual viewport.
3. `innerWidth` **446**, halbuki Pixel 7 CSS eni **412** → səhifə üfüqi daşırdı.
4. Mənbə: `ph-burger` düyməsi tam `scrollWidth`-də bitirdi — **public header telefonda sığmırdı**.

Bu, mənim dəyişikliyimdən **əvvəl mövcud olan** bug idi və nəticəsi ciddiydi:
layout viewport genişləndiyi üçün real telefonda **toxunma koordinatları sürüşürdü** —
GDPR bannerinin düymələri basıla bilmirdi.

**Həll:** ≤560 px-də qonaq CTA-ları header-dən çıxarıldı (burger menyusunda onsuz da var).
`innerWidth` 446 → **412**. Reqressiya testi əlavə edildi.

### 3.4 Audit jurnalı bloklamanı redaktədən ayırmırdı

Ekran görüntüsündə 7 eyni sətir: `WARNING user-edit blocked`.
Blok/blokdan-çıxarma adi profil redaktəsi kimi yazılırdı — kimin kimi bloklaması izlənə bilmirdi.

**Həll:** ayrıca `user-block` / `user-unblock` / `user-verify` / `user-unverify` əməliyyatları,
düzgün səviyyə ilə. Fayl: [worker/routes.ts](worker/routes.ts) `adminPatchUser()`.

### 3.5 `deriveLevel` əks əməliyyatları səhv işarələyirdi

```
user-unblock  → error    (olmalıdır: success)
user-unverify → success  (olmalıdır: warning)
```

Səbəb: lookahead `block(?!.*un)` "un"-u *sonra* axtarırdı, halbuki "unblock"-da o *əvvəldədir*.
Eyni məntiqlə "unverify" içindəki "verify" tutulurdu.

**Həll:** "geri alma" formaları ƏVVƏL yoxlanılır. 14 əməliyyat adı üzrə cədvəl testi ilə təsdiqləndi.

### 3.6 Dublikat jurnal yazısı

Hər profil redaktəsi **iki sətir** yaradırdı — biri serverdə (`adminPatchUser`),
biri client-dən (`logAdmin`). **Həll:** client çağırışı silindi.

### 3.7 Digər düzəlişlər

| Problem | Həll |
|---|---|
| `.term-line` sinif toqquşması — landing yazı effekti `margin-top:26px` + teal rəng + `::before {"$ "}` gətirirdi (ekrandakı nəhəng boşluqlar və yalançı prompt) | Jurnal sətri `.log-line` adlandırıldı |
| `.admin-toolbar input { flex:1 }` checkbox-u da tuturdu → avto-sürüşmə qutusu uzanır, etiketi uzaqda qalırdı | Yalnız mətn sahələri hədəflənir (həm əsas qayda, həm mobil media query) |
| `.btn-mini.dismiss` ("rədd et") neytral əməliyyatlarda işlənirdi → matrix-də parlaq mavi | Neytral `.btn-mini`; "blokdan çıxar" üçün yeni `.btn-mini.ok` |
| Xülasə kartı "ümumi istifadəçi" deyirdi, amma `state.users` keşi 500-lə kəsilir | Serverin real `COUNT(*)` dəyəri işlədilir |
| `status.textContent = au.done ? (au.count ? '' : '') : ''` — hər halda `''` qaytaran ölü ifadə | Mənalı status mətni |
| `loadDirectory` client süzgəcindən sonra boş səhifələrdə hədsiz rekursiya edə bilərdi | 5 boş səhifədən sonra dayanır |
| `feed.copy_btn` mətnində `⧉` glifi SVG ikonla təkrarlanırdı; `'Copied'` hardcode idi | Glif silindi, mətn i18n-ləşdi |
| `vite.config.ts`-də köhnə Firebase manual-chunk hər build-də boş chunk yaradırdı | Silindi |

---

## 4. Memarlıq qərarları

**`state.users` toxunulmaz saxlanıldı.** O, qlobal identifikasiya keşidir — feed (post müəllifi),
DM, mention, admin ondan asılıdır. Server-pagination-a çevirmək bu modulları sındırardı.
Ona görə **iki ayrı endpoint** var: `listUsers` (keş, dəyişməyib) və `usersDirectory` (səhifənin sorğusu).

**`users.last_seen` sütunu əlavə EDİLMƏDİ.** TASK-6 onu istəyirdi, amma `last_active_at` (0001)
və ayrıca `presence` cədvəli onsuz da eyni faktı saxlayır — üçüncü sütun sinxrondan çıxardı.
Səbəb migration faylında yazılıb.

**Admin jurnalı üçün `level` SÜTUNU** (0007), client-side ad təxmini əvəzinə: səviyyə filtri
serverdə `WHERE` ilə işləməlidir, əks halda pagination yalan danışır.

**Cookie razılığı localStorage-də, KV-də yox.** KV variantı işləmir: razılığı serverdə saxlamaq
üçün əvvəlcə identifikator cookie-si lazımdır — yəni razılıqdan əvvəl cookie.

**Loqo dəsti ayrı chunk-da** (~9 KB gzip): yalnız public qatda lazımdır, daxil olmuş istifadəçi
onu heç vaxt yükləmir.

---

## 5. D1 migration-ları

| Fayl | Məzmun | Lokal | Uzaq |
|---|---|---|---|
| `0006_directory_indexes.sql` | 7 index (kataloq sıralaması, admin filtrləri, taksonomiya) + `stats_daily` cədvəli | ✅ | ✅ |
| `0007_admin_log_level.sql` | `admin_logs.level` sütunu + 2 index + backfill | ✅ | ✅ |

> **Qeyd:** migration zamanı üzə çıxdı ki, uzaq bazada **0005 (repost/quote) heç vaxt tətbiq
> olunmamışdı** — yalnız 0001-0004 var idi. İndi 0005, 0006, 0007 hamısı tətbiq olunub.

---

## 6. Bundle təsiri

| | Əvvəl | Sonra |
|---|---|---|
| Entry chunk (gzip) | 75.5 KB | 78.5 KB |
| `techlogos` (ayrı, lazy) | — | 8.95 KB |
| CSS (gzip) | 13.9 KB | ~16 KB |

31 bəndin bütün JS-i giriş yoluna cəmi **+3 KB gzip** əlavə edir.

---

## 7. E2E infrastrukturu

`@playwright/test` + Chromium quruldu — `npm run e2e`.

- **110 test**, 2 proyekt (Desktop Chrome + Pixel 7), 3 spec faylı.
  *(TASK-6 yekunundakı vəziyyət. TASK-7 + real-time fazasından sonra: **132 test, 9 spec faylı**.)*
- `globalSetup` test hesablarını hazırlayır və **bir dəfə** giriş edib sessiyanı saxlayır
  (`auth` rate-limit-i 5 dəq / 10 sorğudur).
- Seed **real `/api/auth/register`** endpoint-i işlədir — parol heşi (PBKDF2) məntiqi təkrarlanmır.
- Yalnız çatışmayan istifadəçilər qeydiyyatdan keçir → təkrar işə salmalarda sıfır auth sorğusu.

**Test yazarkən öz səhvlərim** (kod bug-ı deyil, düzəldilib): lokal bazada seed-dən kənar
hesablar var idi (sıralama testləri indi yalnız **nisbi** sıranı yoxlayır); açıq modal
onboarding turu imiş; kartlar yalnız **eyni grid sətrində** bərabər olur; `waitForRequest`
cavabı yox, sorğunu gözləyir; `fetch().text()` UTF-8 BOM-u spesifikasiya üzrə silir;
ripple yoxlaması `>= 0` ilə heç nə yoxlamırdı.

**Diqqətəlayiq:** `page.request` 401, səhifədaxili `fetch` 200 verirdi. Səbəb — sessiya
cookie-si `Secure`-dur; brauzer `127.0.0.1`-i etibarlı origin sayır, Playwright-in Node
klienti isə `Secure`-u sərt tətbiq edir. **Məhsul bug-ı deyil** (prod HTTPS-dir).

---

## 8. Qalan iş

### Sənin tərəfindən

1. **`SITE.social` URL-ləri placeholder-dir** — [js/legal.js](js/legal.js):
   `https://discord.gg/[collabix]`, `https://github.com/[collabix]`, `https://linkedin.com/company/[collabix]`.

### ~~Növbəti faza~~ → BİTDİ (2026-07-21)

2. ~~**BÖLMƏ 4 — real-time (Durable Objects + WebSocket)**~~ ✅ **TAMAMLANDI və deploy olundu.**
   Üç mərhələdə icra olundu (TASK-7-dən sonra):
   - **RoomDO** (`worker/room-do.ts`) — otaq mesajı `refresh` broadcast + `typing` indikatoru,
     Hibernation API, hər otağa bir instans.
   - **PresenceDO** (`worker/presence-do.ts`) — tək qlobal instans, `snapshot`/`on`/`off`,
     çox-tab dublikat qorunması, `privacy.showOnlineStatus` gizlətməsi.
   - **Bildiriş fan-out + canlı DM** — `PresenceDO.push(uid, payload)` RPC; ayrıca "user DO"
     sinfi yaradılmadı (qlobal DO onsuz da uid→soket indeksi saxlayır → client-də əlavə WS yox).
   - Client: `js/chat.js` + `js/presence.js` WS klientləri, exponential backoff (3s→30s),
     **polling fallback tam qalır** (WS mümkün olmayan mühitlər üçün).
   - Deploy: Version `1cc2ab61-149c-4d95-8ced-708984c132de`, DO migration v1+v2.

   **Nəticə: Admin#12 və İstifadəçilər#1 tam bitdi → TASK-6 artıq 31/31.**

### Məlum məhdudiyyətlər

3. **C#, Java, LinkedIn loqoları yoxdur** — simple-icons bunları trademark səbəbi ilə silib.
   C#/Java TASK-6-nın öz qaydası ilə rəngli initial badge-ə düşür; LinkedIn footer-də
   mətn-nişan ("in") olaraq qalır. Rəsmi loqonu əl ilə bərpa etmək eyni hüquqi problemi geri gətirər.

4. **`online` / `mutual` filtrləri client-də süzülür** — presence xəritəsi və izləmə dəstləri
   yalnız client-də mövcuddur. Nəticədə həmin filtrlərlə səhifə `limit`-dən az element qaytara bilər
   (kodda qeyd olunub, 5 boş səhifə həddi ilə məhdudlaşdırılıb).
