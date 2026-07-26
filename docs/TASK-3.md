# Collabix — TASK-3: Public Sayt Qatı + i18n + Hesab Miqrasiyası (Claude Code)

Sən təcrübəli full-stack + product/UX + i18n mühəndisisən. TASK-1 (təhlükəsizlik/auth) və TASK-2 (taksonomiya, wizard, block-post, heatmap, follow, mention) **tam icra olunub və işləyir**. İndi tətbiqi "login-arxası SPA"-dan **tam public sayt + məlumat/hüquqi səhifələri** olan real məhsula çevirəcəksən. Kod yazmadan əvvəl planı təsdiq etdir; hər mərhələdən sonra dayan, nəticəni + test göstər.

---

## 📦 Mövcud vəziyyət (dəyişmə, üzərinə qur)

- Modular vanilla JS: `js/taxonomy.js`, `js/wizard.js`, `js/composer.js`, `js/heatmap.js` və s.; `firestore.rules`; Firebase **Auth + Firestore + Storage**; lokal **Firebase emulator** (`start-local.cmd`, `http://127.0.0.1:5500`).
- Hazırda tətbiq **auth-gated**-dir: ziyarətçini əvvəlcə login/register ekranı qarşılayır. Public marketing səhifəsi **yoxdur**.
- Tünd tema, Azərbaycan dili, dinamik taksonomiya, block-based post, GitHub-tipli heatmap — hamısı qüvvədədir və **saxlanılır**.

---

## 🏛️ ƏSAS ARXİTEKTURA QƏRARI — iki qat (bunu əvvəl anla)

Sayt iki təbəqəyə bölünür; routing bunları ayırmalıdır:

1. **Public qat (auth YOX):** Homepage (vitrin), About Us, FAQ, Privacy Policy, Terms, Contact — marketing **Header + Footer** ilə. Hər kəs (girişsiz) görə bilər.
2. **App qatı (auth VAR):** mövcud feed/chat/profil/mesaj/tapşırıq/admin SPA — öz sol-nav-ı ilə. Yalnız daxil olanlar.
3. **Körpü:** Header-dəki **CTA** ("Giriş" / "Qeydiyyatdan keç") mövcud auth axınını (wizard/login) açır. Uğurlu girişdən sonra istifadəçi App qatına keçir.

**Routing sxemi (təsdiq et):** public landing `#/` (və ya `#welcome`) girişsizlərə; app feed mövcud `#home`-da (auth-gated) qalır — `#home` adlandırma toqquşmasını həll et. Public informativ səhifələr auth-dan asılı olmayaraq açılır: `#about`, `#faq`, `#privacy`, `#terms`, `#contact`. Daxil olmuş istifadəçi `#/`-ə gedəndə → app feed-ə yönləndir (və ya "Tətbiqə keç" göstər).

---

## Mərhələ A — Real hesabların prod → local miqrasiyası (Bənd 1)

**Məqsəd:** `heartfelt-monstera-4d1b6e.netlify.app` prod Firestore-undakı real istifadəçi hesablarını lokal emulyatorda **eynilə** yaratmaq (test üçün onlarla giriş edə bilmək).

**Vacib:** Prod **köhnə** data modelindədir (`collabix_kv` KV-store, `users:<username>` sənədləri, plaintext `pass`). Lokal **yeni** modeldədir (Auth + `users/{uid}` + `usernames/{username}` + taksonomiya). Miqrasiya köhnə→yeni transformasiyasıdır.

**Addımlar (`js/migrate-prod-users.js` və ya bir dəfəlik script):**

1. Prod Firestore REST API-dən (public web key) bütün `users:*` sənədlərini oxu. **Əvvəlcə 1 nümunə sənədi göstər və sahə map-ini mənə təsdiqlət** (name, age/DOB, gender, prog[], langs[], instagram/github, photo, streak, joinedAt, `pass`).
2. Hər istifadəçi üçün **lokal emulyatorda** (Admin SDK ilə):
   - `usernameNorm = normalize(username)` (TASK-2 qaydası: `[a-z0-9._]`, NFKC).
   - Firebase Auth user yarat: email `${usernameNorm}@collabix.app`, **password = prod-dakı orijinal plaintext `pass`** (test davamlılığı üçün — eyni parolla giriş etsinlər).
   - `users/{uid}` sənədi (yeni schema-ya map olunmuş: ad, DOB/age, gender, səviyyəsiz köhnə skill-ləri "Başlanğıc" default ilə köçür, sosial linklər, avatar Storage-a köçür və ya URL saxla, streak, joinedAt).
   - `usernames/{usernameNorm}` → `{ uid }`.
3. **Dry-run əvvəl:** yalnız oxu + "N hesab köçürüləcək, bunlar: ..." hesabatı ver; mən təsdiq edəndən sonra yazma rejimini işə sal. İdempotent olsun (təkrar işlədikdə dublikat yaratmasın).
4. **Opsional (soruş):** həmin istifadəçilərin postlarını/mesajlarını da köçür (köhnə format → block-based).

**⚠️ Təhlükəsizlik qeydi (prompta daxil et):** Bu parollar prod-da plaintext idi və artıq ifşa olunub. Lokal test üçün orijinal parollarla yaratmaq məqbuldur, **AMMA** bu hesablar real yeni prod-a köçəndə istifadəçilər **məcburi parol sıfırlamasına** yönləndirilməlidir. Bunu miqrasiya planına qeyd et.

---

## Mərhələ B — i18n sistemi: AZ / EN / RU (Bənd 2 utility bar)

Header/footer/public səhifələr dilə bağlı olduğu üçün **bunu əvvəl qur**.

- **`js/i18n.js`:** `{ az:{...}, en:{...}, ru:{...} }` — açar əsaslı lüğətlər. `t(key)` funksiyası cari dili oxuyur.
- **Dil store:** localStorage-da saxla (default `az`), `<html lang>` yenilə. Dil dəyişəndə DOM-u yenidən yaz: statik elementlərdə `data-i18n="key"` atributu → `textContent`; dinamik yerlərdə `t()` çağır.
- **İki mətn növünü ayır:**
  - **Statik UI chrome** (header, footer, düymələr, hero, section başlıqları) → **translation açarları** (`i18n.js`-də AZ/EN/RU).
  - **Baza məzmunu** (FAQ, testimonial, About/Privacy/Terms mətnləri) → sənəddə **hər-dil sahələri** saxla: məs. `{ q:{az,en,ru}, a:{az,en,ru} }`. (Belə məzmun üçün açar sistemi yox, çoxdilli field.)
- **Utility bar switcher:** header-də AZ/EN/RU seçici (dropdown və ya seqment); seçim dərhal tətbiq olunur və yadda qalır.
- **Əhatə:** infrastruktur + bütün **yeni public qat** tam tərcümə olunsun (AZ/EN/RU). Mövcud app UI-ni də mərhələli açarla (minimum auth/nav); əvvəlcə public qata fokus.

---

## Mərhələ C — Header / Başlıq Hissəsi (Bənd 2)

Public qat üçün sticky, responsive marketing header (app qatında mövcud sol-nav qalır):

- **Loqo + brendinq:** "Collabix" loqo/işarə, klik → homepage.
- **Naviqasiya menyusu:** Ana Səhifə, Haqqımızda, FAQ, (Xüsusiyyətlər/anchor), Əlaqə — aktiv link vurğusu.
- **Axtarış paneli:** daxil olanlarda app axtarışına (TASK-2) bağlanır (istifadəçi/post); public-də help/FAQ/About üzrə axtarır və ya girişə yönləndirir (soruş).
- **CTA düyməsi:** "Giriş" + "Qeydiyyatdan keç" (mövcud auth axınını açır); daxil olmuşlarda → "Tətbiqə keç" + avatar/menyu.
- **Utility bar:** AZ/EN/RU switcher (Mərhələ B), opsional tema toggle.
- **Responsive:** mobil hamburger menyu (animasiyalı açılış), sticky/scroll-da kölgə, `prefers-reduced-motion` dəstəyi.

---

## Mərhələ D — Body / Homepage (Bənd 3)

Girişsiz görünən **vitrin** homepage. Məqsədi ilk **3 saniyədə** ötürməlidir.

- **Hero Section:** böyük fon şəkli/gradient üzərində **H1** (əsas başlıq) + şüar (tagline) + qısa izah + 2 CTA ("Qeydiyyatdan keç" / "Necə işləyir"). Canlı arxa-plan animasiyası (mövcud glow estetikası), amma performanslı. Bir baxışda "bu nədir" aydın olsun.
- **Features / Services:** ikon + başlıq + təsvirli kart şəbəkəsi (məs. "Birgə öyrənmə", "Kod paylaşımı + highlighting", "Mentor/komanda tap", "Aktivlik seriyası & nişanlar", "Tapşırıqlar"). Hover animasiyası, stagger görünmə.
- **Modern Sidebar (yan panel):** homepage layout-unda widget-lər — **canlı platforma statistikası** (istifadəçi sayı, bugünkü post, aktiv dil) count-up animasiyası ilə, **trend tag-lar**, **seçilmiş/aktiv istifadəçilər**. Müasir görünüş: glass/soft kart, yumşaq kölgə. (Mövcud app sol-nav-ını da vizual təzələmək istəsən, ayrıca qeyd et.)
- **Content Blocks:** "Necə işləyir" (3-4 addım), kateqoriyalar/dillər vitrin, seçilmiş postlar/nümunələr — növbələşən (zig-zag) mətn+şəkil bloklar.
- **Testimonials / Rəylər:** ulduzlu reytinq (1-5) + istifadəçi adı/rolu/avatarı + rəy mətni; carousel/grid. **Psixoloji güvən** üçün real istifadəçi rəyləri.
  - **Data:** `testimonials/{id}` → `{ authorName, authorTitle, avatarUrl, rating, text:{az,en,ru}, featured, approved, createdAt }`. Admin CRUD; opsional: real istifadəçi rəy göndərsin → moderasiya növbəsi (`approved=false` başlanğıc). Homepage-də yalnız `approved && featured` göstər.

---

## Mərhələ E — Footer / Daban (Bənd 4)

Bütün public səhifələrdə görünən genişləndirilmiş footer:

- **Footer Navigation (sütunlar):** sayt xəritəsi — Məxfilik siyasəti, İstifadə şərtləri, FAQ, Haqqımızda, Əlaqə, (Vakansiyalar) sütun-sütun.
- **Əlaqə və Lokasiya:** rəsmi ünvan, e-poçt, **interaktiv Google Maps keçidi/embed**, iş saatları. (Yer məlumatlarını mən verəcəyəm — placeholder qoy və soruş.)
- **Sosial media ikonları:** Facebook, Instagram, LinkedIn, YouTube — ikon şəklində keçid linkləri (hover animasiyası).
- **Newsletter (bülleten):** e-poçt sahəsi + "Abunə ol" düyməsi. **Data:** `newsletter_subscribers/{id}` → `{ email, lang, createdAt }`; email validasiyası, dublikat yoxlaması, uğur/xəta toast. Security rules: public **create** (yalnız valid email, digər field yox), oxu yalnız admin.
- **Copyright + hüquqi qeyd:** incə üst xətt + "© 2026 Collabix. Bütün hüquqlar qorunur." + hazırlayan imzası. İl avtomatik (`new Date().getFullYear()`).

---

## Mərhələ F — Vacib səhifələr (Bəndlər 5, 6, 7)

Hamısı **public** (auth yox), **i18n** (AZ/EN/RU), footer/header naviqasiyasında, deep-linkable.

- **Homepage** — Mərhələ D (girişsiz vitrin).
- **Haqqımızda / About Us** (`#about`): missiya, vizyon, komanda, tarixçə/hekayə — etibar yaradan səhifə. Məzmun çoxdilli; komanda kartları (foto, ad, rol) opsional admin-idarəli (`siteContent` və ya statik).
- **FAQ** (`#faq`): kateqoriyalı, **akkordeon** (animasiyalı aç/bağla), axtarış sahəsi. **Data:** `faqs/{id}` → `{ q:{az,en,ru}, a:{az,en,ru}, category, order, active }`; admin CRUD. Boş olsa default dəst seed olunsun (qeydiyyat, təhlükəsizlik, hesab, istifadə üzrə tipik suallar).
- **Gizlilik Siyasəti / Privacy Policy** (`#privacy`): **real, Collabix-ə uyğun** məzmun — toplanan data (username, e-poçt, doğum tarixi, cins, ölkə/şəhər, bacarıqlar, sosial linklər, postlar/şərhlər/mesajlar, aktivlik datası, avatar/şəkillər), Firebase/Google (processor) rolu, cookie/localStorage (sessiya), saxlama müddəti, **istifadəçi hüquqları** (giriş, düzəliş, silmə, **data ixracı** — artıq mövcud), əlaqə. GDPR prinsipləri + Azərbaycan "Fərdi məlumatlar haqqında" qanunu konteksti.
- **İstifadə Şərtləri / Terms & Conditions** (`#terms`): istifadə qaydaları, 18+ tələbi, qadağan olunan davranış, məzmun mülkiyyəti/lisenziya, hesabın dayandırılması, məsuliyyətin məhdudlaşdırılması, dəyişikliklər.
- **Əlaqə / Contact** (`#contact`) *(footer əlaqə blokuna əlavə tam səhifə)*: əlaqə forması (ad, e-poçt, mesaj) → `contactMessages/{id}` (public create, rules ilə valid); ünvan + Google Maps + iş saatları; opsional admin-də mesaj siyahısı.

**⚠️ Hüquqi disclaimer (prompta daxil et):** Privacy/Terms mətnləri **şablondur, hüquqi məsləhət deyil**. Səhifələrdə "layihə komandası ilə/hüquqşünasla dəqiqləşdirin" qeydi olsun və mənə real prod-dan əvvəl **hüquqşünas baxışı tövsiyə et**. Şirkət adı, ünvan, əlaqə, yurisdiksiya kimi dəqiq detalları mən verəcəyəm — placeholder qoy və soruş.

---

## 🗂️ Data schema əlavələri

```
testimonials/{id}         → { authorName, authorTitle, avatarUrl, rating(1-5), text:{az,en,ru}, featured, approved, createdAt }
faqs/{id}                 → { q:{az,en,ru}, a:{az,en,ru}, category, order, active }
newsletter_subscribers/{id} → { email, lang, createdAt }
contactMessages/{id}      → { name, email, message, createdAt, read }
siteContent/{pageId}      → About/Privacy/Terms üçün çoxdilli redaktə olunan məzmun (opsional; statik də olar)
```

## 🔒 Security rules əlavələri

- `testimonials`, `faqs`, `siteContent`: **public read** yalnız `approved/active` sənədlər; yazma yalnız admin.
- `newsletter_subscribers`, `contactMessages`: **public create** (ciddi validasiya — yalnız valid email/məhdud field; oxu yalnız admin).
- Migrasiya ilə yaradılan `users/{uid}`, `usernames/{username}` mövcud rules-a uyğun olsun.

---

## ✅ Definition of Done

- [ ] Prod real hesablar lokal emulyatorda **eyni username/parolla** giriş edir; dry-run təsdiqi ilə köçürülüb, idempotentdir.
- [ ] AZ/EN/RU switcher işləyir, seçim yadda qalır; **bütün public qat** üç dildə düzgün tərcümə olunur (statik açar + baza çoxdilli field).
- [ ] Girişsiz **Homepage** görünür: Header (loqo/nav/axtarış/CTA/dil) + Hero (H1+şüar, 3-san dəyər) + Features + modern Sidebar + Content Blocks + ulduzlu Testimonials + tam Footer.
- [ ] Footer: nav sütunları + əlaqə/Google-Maps/iş saatı + sosial ikonlar + işləyən Newsletter + copyright/imza.
- [ ] Public səhifələr mövcud və deep-linkable: About, FAQ (axtarışlı akkordeon), Privacy, Terms, Contact (işləyən forma).
- [ ] Public/App routing təmizdir: girişsizlər vitrini, daxil olanlar app-ı görür; CTA körpüsü işləyir; `#home` toqquşması həll olub.
- [ ] Privacy/Terms Collabix-ə uyğun məzmunla + hüquqi disclaimer; Netlify deploy qırılmayıb; tünd tema qorunub; `prefers-reduced-motion` dəstəklənir.
- [ ] Yeni public write-lar (newsletter/contact/rəy göndərmə) rules ilə qorunur; E2E test + sıfır konsol xətası.

---

## ❓ Başlamazdan əvvəl məndən təsdiq al

1. **Miqrasiya:** real hesabları orijinal parollarla köçürək (test davamlılığı) — təsdiq? Postları/mesajları da köçürək, yoxsa yalnız hesablar?
2. **Routing:** public landing `#/`, app feed `#home`-da qalsın — bu sxem uyğundur? Daxil olan `#/`-ə gedəndə app-a yönlənsin?
3. **Header axtarışı:** public ziyarətçidə nə etsin — help/FAQ axtarsın, yoxsa girişə yönləndirsin?
4. **Əlaqə/hüquqi detallar:** şirkət adı, ünvan, e-poçt, iş saatları, sosial link-lər, Google Maps yeri, yurisdiksiya — bunları placeholder qoyum, sən sonra dolduracaqsan? (Yoxsa indi ver.)
5. **Content idarəsi:** About/FAQ/Testimonial/Privacy/Terms admin panelindən redaktə olunsun (Firestore `siteContent`/`faqs`/...), yoxsa hələlik statik kod kifayətdir?
6. **Sidebar:** yalnız homepage-də müasir yan-panel (widget-lər), yoxsa mövcud app sol-nav-ı da vizual təzələnsin?

Planı təsdiq etdikdən sonra Mərhələ A (miqrasiya dry-run) və Mərhələ B (i18n) ilə başla.
