# Collabix — TASK-5: Kəşfolunma, i18n Bütövlüyü, Paylaşım/Re-post + Welcome Effekti (Claude Code)

Sən təcrübəli full-stack + technical-SEO + i18n mühəndisisən. Collabix (Auth+Firestore+Storage, modular vanilla JS, iki qatlı public/app SPA, AZ/EN/RU i18n) üzərində 4 bəndi icra edəcəksən. **Qeyd:** Bənd 13 (particle) və 14 (i18n) TASK-4 ilə üst-üstə düşür — **əgər TASK-4-də artıq edilibsə, yenidən qurma; yoxla, tamamla, düzəlt.** Kod yazmadan əvvəl plan → təsdiq; hər fazadan sonra dayan, dəyişiklik + E2E + sıfır konsol xətası göstər. Hər UI **mobil + üçdilli** olmalıdır.

---

## FAZA A — i18n bütövlüyü + "teq/açar görünmə" bug-u (Bənd 14)

Bəzi səhifələrdə **xam `data-i18n` açarları/teqlər** göstərilir (məs. tərcümə yerinə `nav.home` görünür). Tam QA + tamamlama:
- Bütün səhifələri (public + app) audit et: hər `data-i18n` açarının AZ/EN/RU lüğətdə **qarşılığı var**; çatışmayanları tamamla.
- **Fallback zənciri:** açar tapılmasa → AZ (default) → oxunaqlı mətn; dev-də çatışmayan açarları konsola/`missing-i18n.json`-a yaz (prod-da yox).
- Hardcode qalmış stringləri açara çevir; dinamik/DB məzmununu **`tf()` çoxdilli field** ilə göstər.
- **Locale formatlaması:** tarix, say, nisbi vaxt (`Intl.DateTimeFormat`/`NumberFormat`) cari dilə görə.
- Dil dəyişəndə **bütün** görünən mətn (statik + dinamik + yeni Share/SEO UI) anında yenilənsin; seçim yadda qalsın; `<html lang>` düzgün.
- `hreflang` üçün hazırlıq (FAZA B ilə bağlı): hər səhifənin AZ/EN/RU variantı məlum olsun.

---

## FAZA B — SEO / GEO / AEO / E-E-A-T / SXO / SMO (Bənd 15)

### ⚠️ Kök problem (əvvəl bunu həll et)
Sayt **hash-routing** (`#welcome`, `#about`) + client-render-dir. Axtarış motorları və sosial "scraper"-lar hash-fraqmentləri və JS-render məzmunu **indeksləmir/oxumur**. Kəşfolunma üçün:
- **Public səhifələri real path-lara keçir** (History API): `/`, `/about`, `/faq`, `/privacy`, `/terms`, `/contact`, `/u/{username}`, `/post/{id}`. App qatı (auth) SPA qala bilər.
- **Prerender/SSR:** hər public path üçün crawler və social scraper-a **hazır HTML + per-page meta** ver. Netlify variantları: **Edge Functions** ilə URL-ə görə meta inject, və ya build-time static HTML generasiyası, və ya prerender xidməti. (Araşdır, ən uyğununu seç və mənə izah et.)

### SEO (baza)
- Hər səhifə üçün unikal `<title>` + `meta description` (dildən asılı), **canonical**, `robots.txt`, avto **XML sitemap** (public path-lar + postlar/profillər), semantik HTML + düzgün H1/başlıq iyerarxiyası, `img alt`, 404 idarəsi, təmiz URL.
- **Multilingual:** `hreflang` (az/en/ru + `x-default`), tərcümə olunmuş meta.

### Structured data / JSON-LD (AEO + E-E-A-T + rich results)
- `Organization`, `WebSite` (+ `SearchAction` sitelinks searchbox), `BreadcrumbList`.
- **`FAQPage`** (FAQ səhifəsi — böyük AEO qazancı), postlar üçün `Article`/`SocialMediaPosting`, profillər üçün `ProfilePage`/`Person`, öyrənmə platforması üçün `Course`/`LearningResource`/`EducationalOrganization`.

### GEO (Generative Engine Optimization — LLM-lərin sitat gətirməsi)
LLM-lər (ChatGPT, Perplexity, Gemini, Claude, AI Overviews) məzmunu çıxarıb sitat gətirə bilsin:
- Prerender olunmuş, crawlable, aydın-başlıqlı məzmun; qısa, dəqiq **tərif/cavab** blokları; faktlar/statistika/sitat/ekspert rəyi (bunlar GEO görünürlüyünü artırır); semantik aydınlıq. `llms.txt` (saytı LLM-lərə təsvir edən fayl).

### AEO (Answer Engine Optimization)
- Sual-formalı başlıqlar, birbaşa qısa cavablar, `FAQPage`/`HowTo` schema, snippet-uyğun formatlama.

### E-E-A-T (Experience, Expertise, Authoritativeness, Trust)
- Müəllif bylines + profilə link, **verified badge** (TASK-4), About/komanda + kvalifikasiya, Privacy/Terms/Contact (mövcud), testimonials, HTTPS, dəqiq authorship.

### SXO (Search Experience Optimization)
- **Core Web Vitals** (LCP/INP/CLS) hədəfləri, mobil (TASK-4 Bənd 1), sürətli yüklənmə, lazy-load, daxili linkləmə, oxunaqlı tipoqrafiya, aşağı bounce.

### SMO (Social Media Optimization)
- **Open Graph** (`og:title/description/image/type/url`) + **Twitter Card** hər səhifə/post/profil üçün; **dinamik OG şəkil** (post/profil üçün edge function ilə preview kartı) — bu, Bənd 16 xarici paylaşımında WhatsApp/Telegram/FB-də zəngin preview verir; ardıcıl brendinq.

### Yoxlama
- Google Search Console + Bing Webmaster, sitemap təqdimatı, structured-data validasiyası, Lighthouse hədəfləri.

---

## FAZA C — Paylaş / Re-post / Quote (Bənd 16)

Instagram/LinkedIn üslubunda paylaşım. **Diqqət:** istifadəçi SQL terminləri ilə yazıb (ParentPostID, PostType, ShareCount, Trigger/Stored Procedure, FK) — bunlar **Firestore/NoSQL-ə** map olunur:

| SQL tələbi | Firestore qarşılığı |
|---|---|
| `ParentPostID`/`OriginalPostID` | post sənədində `originalPostId` (string ref, source of truth) |
| `PostType (Original/Repost/Quote)` | `postType: 'original' \| 'repost' \| 'quote'` |
| FK, dublikat yox (Relational) | yalnız `originalPostId` saxla; render zamanı orijinalı ID ilə oxu (opsional yüngül snapshot cache) |
| `ShareCount` + Trigger/SP auto-increment | orijinalda `shareCount`; **Cloud Function trigger** `onDocumentCreated(posts)` → repost/quote yaranında `increment(1)`, `onDocumentDeleted` → `increment(-1)` |
| Cascade Deletion | **Cloud Function** `onDocumentDeleted(posts/{id})` → `originalPostId==id` olan repost/quote-ları **soft-mark** `originalDeleted:true` → "Bu məzmun silinib" göstər (quote şərhini qoru) |

### Funksional tələblər
- **Birbaşa Re-post:** əlavə mətnsiz; orijinal müəllif + məzmun görünür (`postType:'repost'`).
- **Quote (fikirlə paylaşım):** yuxarıda öz mətni/həştəqi + altında orijinal (`postType:'quote'`, `quoteText`).
- **Xarici paylaşım:** **Copy Link** (`navigator.clipboard`) + Web Share API (`navigator.share`) + açıq WhatsApp/Telegram/Facebook/X intent URL-ləri. (Zəngin preview üçün FAZA B prerender/OG lazımdır.)
- **Orijinal izlənməsi:** repost/quote-da orijinal mənbəyə (müəllif profili + `/post/{id}`) **klik olunan hyperlink**.
- **Flatten:** repost-un/quote-un repost-u → həmişə **kök orijinala** istinad et (dərin zəncir yaratma).
- **İdempotentlik:** eyni postu ikiqat birbaşa repost etmə (toggle: repost/undo-repost); `shareCount` düzgün qalsın.

### UI / UX
- Hər postun altında **like/comment yanında aydın "Paylaş" ikonu**.
- Klikdə **modal/dropdown**: "Re-post" / "Fikirlə paylaş" / "Linki kopyala" / "Xaricə paylaş".
- Feed-də repost-un yuxarısında kiçik fərqli mətn: **"[İstifadəçi Adı] re-post etdi"** (profilə link).
- Profildə istifadəçinin repost/quote-ları da görünsün; `shareCount` post üzərində.

---

## FAZA D — #welcome + login: interaktiv particle-network (Bənd 13)

*(TASK-4 FAZA 7-də varsa yoxla/cilalayaraq keç.)* **Effekt:** Interactive Particle Network (Constellation) + mouse repulsion + idle text-morph.
1. Arxa fonda yüzlərlə kiçik particle sərbəst sürüşür; yaxınlar arasında **mesh xətləri**.
2. Maus yaxınlaşanda particle-lar **elastik itələnir** (repulse).
3. Maus **2 saniyə** hərəkətsiz → particle-lar yumşaq keçidlə **"COLLABIX"** sözünü formalaşdırır (texnika: sözü offscreen canvas-a çək → piksel nümunələ → particle-ları ən yaxın mətn-pikselinə hədəflə).
4. Maus hərəkət edəndə → yazı dağılır, yenidən sərbəst mesh.

**Texniki:** xüsusi HTML5 **Canvas 2D** (tam nəzarət; alternativ tsParticles v3 slim/polygonMask), `requestAnimationFrame`, cihaza görə particle limiti, tab gizlənəndə dayandır, **`prefers-reduced-motion` fallback**, temaya uyğun (matrix/teal aksent). **#welcome + login** arxa fonunda.

---

## 🗂️ Schema / rules / functions

```
posts/{id}   + originalPostId, postType(original|repost|quote), quoteText?, shareCount, originalDeleted?
llms.txt, robots.txt, sitemap.xml (public)
Cloud Functions: onPostCreate→shareCount++, onPostDelete→shareCount-- + cascade soft-mark, dynamic-OG-image (edge)
```
- **Rules:** repost/quote `originalPostId` mövcud olmalı; `shareCount` yalnız function/transaction; postType client sən istəyən dəyəri məcbur etməsin (validate); xarici write yox.
- **Routing:** public path-lar prerender/crawlable; app path-lar auth-gated.

---

## ✅ Definition of Done

- [ ] (14) Heç bir səhifədə xam i18n açarı görünmür; AZ/EN/RU tam; dinamik `tf()`; locale format; hreflang hazır.
- [ ] (15) Public səhifələr real path + prerender/per-route meta; JSON-LD (Organization/WebSite/FAQPage/Article/ProfilePage/Course); sitemap/robots/canonical/hreflang; OG+Twitter+dinamik OG şəkil; Core Web Vitals; llms.txt. SEO+GEO+AEO+E-E-A-T+SXO+SMO əhatə olunub.
- [ ] (16) Birbaşa repost + quote işləyir; `originalPostId/postType/shareCount`; Cloud Function ilə count + cascade "silinib"; Copy Link + xarici paylaşım; orijinal-mənbə linki; repost-of-repost flatten; "[user] re-post etdi" başlıq; Paylaş ikonu+modal.
- [ ] (13) #welcome + login particle-network + idle "COLLABIX" morph; reduced-motion fallback.
- [ ] Netlify deploy qırılmayıb; tünd tema; hər UI mobil+üçdilli; E2E + sıfır konsol xətası.

---

## ❓ Başlamazdan əvvəl təsdiq al

1. **Routing:** public səhifələri hash-dən real path-a keçirməyə razısan? (SEO üçün vacibdir; app auth-routing qalır.)
2. **Prerender üsulu:** Netlify Edge Functions (per-URL meta) yoxsa build-time static generasiya — üstünlük?
3. **Cascade:** orijinal silinəndə repost/quote **soft-mark "silinib"** (quote şərhi qorunur) — təsdiq? (Yoxsa tam sil?)
4. **Xarici paylaşım:** hansı platformalar (WhatsApp/Telegram/Facebook/X/LinkedIn)?
5. **Dinamik OG şəkil:** postlar üçün avto preview kartı generasiyası (edge function) indi, yoxsa sonra?
6. **13/14:** TASK-4-də edilibsə — yoxlayıb cilalayım, yoxsa yenidən icra?

Təsdiqdən sonra FAZA A (i18n QA) və FAZA B (routing/prerender təməli) ilə başla.