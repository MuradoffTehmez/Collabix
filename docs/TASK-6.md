# Collabix — TASK-6: UI/UX Peşəkarlaşdırma (Ana səhifə / İstifadəçilər / Admin) — Cloudflare stack

 /goal Sən təcrübəli full-stack + UI/UX + Cloudflare-edge mühəndisisən. Collabix üzərində 3 səhifə üçün **31 detallı UI/UX təkmilləşdirməsini** icra edəcəksən. Kod yazmadan əvvəl plan → təsdiq; hər bölmədən sonra dayan, dəyişiklik + typecheck + build + `wrangler deploy --dry-run` + E2E göstər.

---

## ⚙️ STACK (dəqiq — əvvəlki TASK-larda yanlış yazılmışdı)
**Cloudflare Workers + D1 (SQLite/SQL) + R2 (obyekt storage) + KV + TypeScript + wrangler.** SSR meta HTMLRewriter (`worker/seo.ts`), dinamik OG `workers-og` (`worker/og.ts`), D1 migration-lar (hazırda 0005-də), **real-time üçün Durable Objects + WebSockets**, custom auth. Firestore/Cloud Functions **yoxdur** — D1 relational-dır (SQL sorğu/index/view; "trigger/SP" məntiqi Worker/DO içində).

## 🔁 Ümumi prinsiplər (HƏR bəndə şamil)
- **Mövcud reusable-ları TƏKRAR-İSTİFADƏ et, yenidən qurma:** initials-avatar (dinamik rəng), verified badge, skeleton, i18n `t()`/`tf()`, tema (dark/light/matrix), heatmap, code-copy komponenti, modal, toast.
- Hər yeni/dəyişən UI: **mobil-uyğun + üçdilli (AZ/EN/RU) + `prefers-reduced-motion` fallback + temaya uyğun**. Yeni mətn üçün i18n açarları AZ/EN/RU-da.
- **Animasiya performansı:** yalnız `transform`/`opacity` (GPU), `IntersectionObserver` ilə görünəndə tətbiq; reduced-motion → dərhal/statik.
- **D1:** schema dəyişikliyi növbəti **migration (0006+)** ilə; sort/filter/pagination üçün **index**; prepared statements; siyahılar üçün cursor/LIMIT.

---

# BÖLMƏ 1 — Ana səhifə (giriş etməmiş, public) — 13 bənd

**1. Hero fade-in-up + düymə hover.** "Birlikdə öyrən. Kod yaz. İnkişaf et." H1 yüklənəndə `opacity 0→1 + translateY(16px→0)` (~500ms ease-out, kiçik stagger: başlıq→şüar→düymələr). "Pulsuz qoşul"/"Necə işləyir?" hover → arxa plan keçidi + `scale(1.03)` + kölgə. Reduced-motion → transform yox, dərhal.

**2. Dinamik rəqəmlər (count-up).** "Canlı statistika" (istifadəçi/paylaşım/…) həmin bölmə viewport-a girəndə `0 → real dəyər` (IntersectionObserver + `requestAnimationFrame`, ~1s ease-out, `Intl.NumberFormat`). Dəyərlər D1-dən (SSR-inject və ya `/api/stats` KV-cache ilə). Bir dəfə işə düşsün.

**3. Kart mikro-interaksiyaları.** "Platformada nə var?" kartları (Birgə öyrənmə, Kod paylaşımı, Tapşırıqlar və XP…) hover → `translateY(-4px)` + kölgə dərinliyi artır, yumşaq `transition`. Reduced-motion → yalnız kölgə/kənar.

**4. Heatmap staggered fade-in.** Heatmap viewport-a girəndə xanalar ardıcıl yanır (indeksə görə kiçik gecikmə, IntersectionObserver, bir dəfə). Reduced-motion → hamısı dərhal. (Heatmap mövcuddur — stagger əlavə et/yoxla.)

**5. Testimonials karusel.** Aysel M./Rauf H./Nigar Q. rəyləri auto-advance + oxlar + nöqtələr, `translateX` slide keçid, hover-də dayan, mobildə swipe. Reduced-motion → auto yox, yalnız əl ilə. Data D1-dən (approved+featured).

**6. Sticky nav + backdrop blur.** Header scroll-da sticky; threshold-dan sonra `backdrop-filter: blur(...)` + yarımşəffaf fon + incə kölgə; aktiv-link vurğu. (Header var — sticky+blur davranışı əlavə et.)

**7. Texnologiya nişanları (loqolu badge).** "Populyar sahələr"də TypeScript/Python/C# və s. mətn əvəzinə **rəsmi loqolu** kiçik badge. Loqoları **self-host** et (simple-icons/devicon SVG-ləri lokal bundle — hotlink yox: perf+etibarlılıq), taksonomiyanın `icon`/`highlightId`-sindən map; loqo yoxdursa rəngli initial badge fallback.

**8. Addım ikonları.** "Qeydiyyatdan keç → İcmaya qoşul → Öyrən və paylaş → İnkişafını izlə" hər mərhələyə vahid üslublu kiçik SVG ikon.

**9. Kod bloku "Kopyala" düyməsi.** Homepage "Kod paylaşımı" showcase bloklarında görünən "Kopyala" (clipboard API + toast). Composer-dəki mövcud copy komponentini **təkrar-istifadə et**.

**10. Ağıllı klik-tag filtri.** "Study-partner tap" bölməsində texnologiya/xarici dil taglarına (taksonomiyadan) **klik → İstifadəçilər səhifəsinə öncədən-filtrlənmiş** keçid (URL param, məs. `/u?skill=python`). 

**11. Tərəqqi paneli (wizard).** 4-addımlı qeydiyyat sehrbazında vizual progress bar (addım X/4 + faiz + addım etiketləri) — yarımçıq qoymanı azaldır. (TASK-2-də var — vizual bar-ı yoxla/gücləndir.)

**12. Sosial platforma ikonları.** Footer "Yeniliklərdən xəbərdar ol" + əlaqə yanında **Discord, GitHub, LinkedIn** ikon-linkləri (hover animasiya). Dəsti `SITE`/config-də konfiqurativ et (dev icması üçün Discord/GitHub daxil); linklər placeholder → mən dolduraram.

**13. Hüquqi linklərin qruplaşması.** Footer "Məxfilik siyasəti / İstifadə şərtləri / **Cookie siyasəti**" ayrı təmiz sütunda alt-alta. ⚠ Cookie siyasəti yeni səhifə + **cookie-consent banner** (GDPR) tələb edir — əgər yoxdursa əlavə et (`/cookies` + banner + KV/localStorage razılıq).

---

# BÖLMƏ 2 — İstifadəçilər səhifəsi — 6 bənd

**1. Onlayn status indikatoru.** Avatar kənarında yaşıl nöqtə (onlayn); `privacy.showOnlineStatus` aktivsizsə göstərmə. Presence Durable Object-dən (BÖLMƏ 4). "Mesaj yaz" ilə birbaşa əlaqə.

**2. Kart hündürlüyü sabit + "+N" skill.** Ən vacib 2-3 bacarıq göstər, qalanı **"+2"** interaktiv nişan (hover/klik popover ilə tam siyahı). Bütün kartlar bərabər hündürlükdə (flex/grid + line-clamp).

**3. Grid ⇄ List keçidi.** Axtarış panelinin sağında görünüş toggle; seçim yadda qalsın (localStorage); list = sıx sətir formatı (sürətli tarama).

**4. Command palette (Ctrl/Cmd+K).** Qlobal qısayol axtarışa fokuslanır və ya kiçik palette overlay açır (sürətli naviqasiya/axtarış); klaviatura-idarəli, accessible (focus trap, Esc bağla).

**5. Ətraflı sıralama.** "Sırala" menyusu — Ən yüksək XP, Son aktiv olanlar, Əlifba sırası (+ default). D1 `ORDER BY` + uyğun index (`xp`, `last_active`, `username`).

**6. Dinamik placeholder avatar rəngləri.** İnisial avatarlar (AS, BL, 8B…) ad/uid hash-ından fərqli, kontrastlı fon rəngləri. (initials-avatar komponentində var — burada tətbiq olunduğunu yoxla, rəng çeşidini/kontrastı təmin et.)

---

# BÖLMƏ 3 — Admin Panel — 12 bənd

**1. Rəng kodlaması.** Xülasə kartları semantik rənglə: açıq şikayətlər **qırmızı**, yoxlama gözləyən həllər **sarı**, ümumi istifadəçi **mavi/yaşıl**, bloklanmış **narıncı/qırmızı**. Kontrast + accessible.

**2. Hover/klik (ripple) animasiyaları.** Quick-action düymələri (Həlləri yoxla, Yeni tapşırıq, #Otaqlara bax) hover-də yüngül qabarma, klikdə **ripple** effekti; vahid.

**3. Taksonomiya drag-and-drop sıralama.** "sıra: N" əl ilə yazma əvəzinə **sürüşdür-burax**; drop-da D1 `order` sütununu **batch** yenilə. Native HTML5 DnD və ya kiçik lib; klaviatura-alternativi (yuxarı/aşağı düymə) accessible üçün.

**4. İstifadəçi siyahısında filtr.** Uzun siyahının üstündə sürətli axtarış + filtrlər (yalnız bloklanmış / yalnız admin / yalnız verified). D1 `WHERE` + index.

**5. Toplu əməliyyatlar (bulk).** Hər sətirdə checkbox + "hamısını seç" → toplu Blokla/Blokdan-çıxar (opsional verify/sil). Təsdiq dialoqu. D1 `batch()`.

**6. Terminal-tipli admin jurnalı.** Admin log-u interaktiv terminal pəncərəsi kimi: monospace, matrix estetikası, **statusa görə syntax highlighting** (error=qırmızı, warning=sarı, success=yaşıl, info=default), səviyyəyə görə filtr, auto-scroll, kopyala. Mövcud tünd/matrix temaya çox uyğun.

**7. Skeleton yüklənmə ekranları.** İstifadəçilər + admin açılışında spinner/boş ekran əvəzinə skeleton maketlər. (Skeleton var — ardıcıl tətbiq et.)

**8. İnteraktiv qrafiklər (sparkline).** Xülasə kartlarının arxa planında kiçik sparkline (istifadəçi artımı, şikayət dinamikası) — D1 zaman-seriyasından (`stats_daily`). Inline SVG və ya kiçik lib; hover tooltip.

**9. Modal (popup) pəncərələr.** "#Otaqlara bax", "Yeni otaq yarat" və s. tam səhifəyə keçmək əvəzinə mərkəzdə modal (iş axını qırılmadan). Mövcud modal sistemini təkrar-istifadə et.

**10. Pagination / infinite scroll.** "Bütün istifadəçilər" və "admin jurnalı" uzun siyahıları — hamısını DOM-a yükləmə. **D1 `LIMIT` + cursor** (indekslə), server-side; UI pagination və ya infinite scroll (IntersectionObserver). "View"/prepared-query ilə optimallaşdır.

**11. İxrac (CSV/Excel).** "İxrac et" → Worker endpoint D1-dən **CSV stream** edir (istifadəçilər, log-lar) → download. Excel üçün CSV kifayətdir (istəsən `xlsx` generasiyası). Böyük data üçün streaming response.

**12. Real-time (WebSockets).** Otaqlar/Mesajlar canlı: yeni mesaj dərhal, **"typing…" indikatoru**, presence, ani bildiriş. Cloudflare-də bu **Durable Objects + WebSocket** deməkdir → BÖLMƏ 4.

---

# BÖLMƏ 4 — Real-time infrastruktur (Durable Objects) — Users#1 + Admin#12 üçün

Cloudflare-də real-time = **Durable Objects (DO) + WebSocket (Hibernation API)**. (Cari Cloudflare docs-a görə yoxla.)
- **Room DO:** hər otaq (və hər DM cütü) üçün bir DO instansı WebSocket bağlantılarını saxlayır; yeni mesajı bütün qoşulanlara **broadcast** edir. Mesajlar **D1-də saxlanılır** (source of truth); DO yalnız canlı qat + broadcast.
- **Typing indikatoru:** DO vasitəsilə efemer event (D1-ə yazılmır).
- **Presence / son görünmə:** DO qoşulanları izləyir; disconnect-də `users.last_seen`-i D1-ə yaz; "onlayn" = aktiv WS bağlantısı. `privacy.showOnlineStatus`-a hörmət.
- **Ani bildiriş:** istifadəçi-scoped kanal (per-user DO və ya room DO → notification fan-out); oxunmamış say D1-də; gələndə sağ-üst toast (TASK-4 bildiriş sistemi).
- **R2:** mesaj əlavələri (şəkil/fayl/kod, ≤2MB — TASK-4). Hibernation ilə xərc optimallaşması. Bu **böyük memarlıq əlavəsidir** — polish bəndlərindən sonra faza et.

---

## 🗂️ D1 migration / schema (0006+)
```
0006: users.last_seen (index), taxonomy.order (varsa yoxla), stats_daily(date PK, users, posts, complaints, ...) sparkline üçün
index-lər: users(xp), users(last_active), users(username), users(blocked), users(role), users(verified)
(testimonials, faqs, post_shares artıq var)
```
- İxrac/pagination üçün schema dəyişməz; yalnız index + prepared query.
- Real-time: `wrangler.toml`-da Durable Object binding + migration; R2/KV binding-ləri mövcud.

---

## ✅ Definition of Done (31 bənd)
**Ana səhifə:** [ ] hero fade-in + düymə hover [ ] count-up [ ] kart hover [ ] heatmap stagger [ ] testimonials karusel [ ] sticky+blur nav [ ] loqolu tech badge [ ] addım ikonları [ ] kod copy [ ] klik-tag filtr [ ] wizard progress [ ] sosial ikon [ ] hüquqi qrup + cookie banner
**İstifadəçilər:** [ ] onlayn nöqtə [ ] sabit hündürlük + "+N" [ ] grid/list [ ] Ctrl/Cmd+K [ ] sort menyusu [ ] dinamik avatar rəngi
**Admin:** [ ] rəng kodu [ ] ripple [ ] taksonomiya DnD [ ] siyahı filtr [ ] bulk actions [ ] terminal log [ ] skeleton [ ] sparkline [ ] modal [ ] pagination [ ] CSV ixrac [ ] real-time (DO+WS: mesaj+typing+presence+bildiriş)
**Ümumi:** [ ] hər yeni UI mobil+AZ/EN/RU+reduced-motion+tema [ ] mövcud komponentlər təkrar-istifadə [ ] typecheck+build+dry-run+E2E ✅, sıfır konsol xətası [ ] deploy qırılmayıb.

---

## ❓ Başlamazdan əvvəl təsdiq al
1. **Real-time (Admin#12 / Users#1):** Durable Objects + WebSocket-i indi qururuq, yoxsa əvvəlcə bütün polish bəndlərini bitirib real-time-ı ayrıca fazaya buraxaq? (Ən böyük iş budur.)
2. **Presence:** DO+WS (dəqiq, canlı) yoxsa müvəqqəti sadə `last_seen` heartbeat (real-time olmadan)?
3. **Cookie (Ana#13):** cookie-consent banner + `/cookies` səhifəsi əlavə edim? (GDPR üçün lazımdır.)
4. **Tech loqoları (Ana#7):** simple-icons/devicon SVG-lərini bundle-a əlavə edirik (self-host) — təsdiq?
5. **İxrac (Admin#11):** yalnız CSV, yoxsa əsl `.xlsx` da?
6. **Sosial linklər (Ana#12):** dəqiq Discord/GitHub/LinkedIn URL-lərini indi verirsən, yoxsa placeholder?
7. **Sıra:** Ana səhifə → İstifadəçilər → Admin (real-time sonda) — uyğundur?

Təsdiqdən sonra BÖLMƏ 1 (Ana səhifə polish) ilə başla; real-time-ı razılaşdığımız fazada.