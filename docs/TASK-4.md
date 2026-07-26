# Collabix — TASK-4: Peşəkarlaşdırma, Mobil, Sosial və Real-time (Claude Code)

Sən təcrübəli full-stack + UI/UX + real-time mühəndisisən. TASK-1/2/3 **tam icra olunub və işləyir** (Auth, dinamik taksonomiya, block-post, heatmap, follow, mention, public sayt, i18n AZ/EN/RU, 39 prod hesabı lokal emulyatora köçürülüb). İndi 13 bənddən ibarət peşəkarlaşdırma və düzəliş paketini icra edəcəksən. Kod yazmadan əvvəl planı təsdiq etdir; hər fazadan sonra dayan, dəyişiklikləri + E2E test + sıfır konsol xətasını göstər. **Hər yeni UI mobil-uyğun və üçdilli (AZ/EN/RU) olmalıdır.**

---

## 📦 Mövcud vəziyyət (üzərinə qur, dağıtma)

Modular vanilla JS (`js/taxonomy.js`, `wizard.js`, `composer.js`, `heatmap.js`, `i18n.js`, `legal.js` və s.), Firebase **Auth + Firestore + Storage (+ emulator)**, `firestore.rules`, public/app iki qatlı routing, tünd tema. Lokal: `start-local.cmd` → `http://127.0.0.1:5500`.

---

## ⚙️ FAZA 0 — Ortaq təməllər (əvvəl bunları qur, hər yer bunlara bağlıdır)

### 0.1 Mobil/responsive sistem (Bənd 1)

Bütün sayt (public + app) mobil dizaynı zəifdir. **Tam responsive keçid + gələcək dəyişikliklərin avtomatik mobil-uyğun olması üçün sistem** qur:

- **Breakpoint konvensiyaları** (məs. 360 / 480 / 768 / 1024 / 1280) CSS dəyişənləri + utility klaslarla; `RESPONSIVE.md`-də qeyd et ki, hər yeni komponent bu qaydaya uysun.
- Toxunma hədəfləri ≥ 44px; horizontal-scroll qadağan (heatmap istisna — o scroll-lu); modallar mobildə **full-screen**; sidebar/panellər → **drawer**; cədvəllər → kart; grid-lər tək sütuna düşür.
- **App bottom-nav** mobildə (icon-lu), **public header hamburger** (animasiyalı); composer blokları stack; testimonials carousel swipe.
- Səhifə-səhifə audit: feed, composer, chat, DM, users, tasks, stats, profil, admin, bildirişlər + public (home, about, faq, privacy, terms, contact). Test enləri: 360/390/768.

### 0.2 App qatında daimi chrome + i18n + tema (Bənd 2)

Girişdən sonra Header/Navbar/Footer **yox olur** — bu düzəlməlidir. Vahid **app shell** qur:

- **Üst header (app):** loqo (→ app home), qlobal axtarış, **bildiriş zəngi** (oxunmamış sayğac), **AZ/EN/RU switcher**, **tema toggle**, avatar menyusu (Profil / Parametrlər / Çıxış). Mobildə kompakt.
- **Sol nav** (mövcud) qalır; mobildə bottom-nav. Opsional kompakt **app footer** (© + linklər).
- **Tam i18n:** `data-i18n`/`t()`-ni BÜTÜN app view-larına tətbiq et (feed, composer, chat, DM, users, tasks, stats, profil, admin, bildirişlər, parametrlər). Lüğəti tamamla ki, app UI da AZ/EN/RU-da düzgün olsun; dinamik məzmun `tf()` çoxdilli field ilə.
- **Tema sistemi:** ən azı **dark (default) + light**, opsional **"matrix/terminal"** variant; CSS dəyişənləri ilə. Seçim `users/{uid}.settings.theme` + localStorage; header + parametrlərdən dəyişilir; girişdən sonra da işləyir.

### 0.3 Təkrar-istifadə komponentləri (hər yerdə lazım)

- **Initials-avatar (Bənd 11):** `avatar(user)` funksiyası — `photoURL` varsa şəkil; yoxsa **ad-soyadın baş hərfləri** ilə rəngli dairə (məs. "Əli Muradov" → **Ə-M**). Fon rəngi ad/uid hash-ından determinantik (HSL). **Feed, chat, DM, users, profil, bildiriş, mention, şərh, testimonial — hər yerdə** bu istifadə olunsun.
- **Verified badge (Bənd 12):** `nameWithBadge(user)` — ad + təsdiq işarəsi (yalnız `verified===true`). Temaya uyğun mavi/teal ✓, tooltip "Təsdiqlənmiş". Ad göstərilən **hər yerdə** tətbiq et.

---

## 🧩 FAZA 1 — Profil, sosial və irəliləyiş

### 1.1 Parametrlər Profilin içində, dinamik (Bənd 3)

"Parametrlər" bölməsini Profil-in içinə köçür (mövcud tab-lı editora **Parametrlər** tab-ı əlavə et). **Schema-driven** et ki, yeni parametr əlavə etmək asan olsun:

- Tema, dil, **bildiriş tərcihləri**, **məxfilik** (kim mesaj yaza bilər, "izlədiklərim" siyahısı görünsün?, onlayn statusu görünsün?), hesab (data ixracı, hesab silmə).
- Data: `users/{uid}.settings = { theme, lang, privacy:{ whoCanMessage, showFollowing, showOnlineStatus }, notifications:{...} }`.

### 1.2 İzləyənlər / izlədiklərim + qarşılıqlı + kim mesaj yaza bilər (Bənd 4, 8)

Instagram üslubunda, amma **saytın kod/matrix temasına uyğun** (monospace, terminal estetikası):

- Profildə **İzlədiklərim** və **İzləyənlər** siyahıları + sayğaclar; **qarşılıqlı izləmə** göstəricisi ("Qarşılıqlı").
- Follow/unfollow hər yerdən (users, public profil, siyahılar). Data: mövcud `follows/*` + `followers` üzü; qarşılıqlılıq hesablanır.
- **"Kim mənə mesaj yaza bilər"** (`privacy.whoCanMessage ∈ {everyone, following, mutual}`) — DM göndərmədə **client + security rules** ilə tətbiq et.
- Başqasının **izlədiklərinə baxmaq**: yalnız o istifadəçinin `privacy.showFollowing` aktivdirsə. Users və public profildə tətbiq et.

### 1.3 "Sahələr üzrə irəliləyiş" dinamik (Bənd 5)

Hazırda işləmir. **Real datadan dinamik** hesabla:

- Hər skill/dil üzrə irəliləyiş = həmin sahədə fəaliyyət (o taqla postlar + həmin kateqoriyada tamamlanmış tapşırıqlar + XP). Taksonomiya sahələri üzrə **progress bar + səviyyə**.
- Data: `users/{uid}/progress/{field}` sayğacları (post/task zamanı `increment`) + səviyyə hədləri; profildə render et. Yeni taksonomiya əlavə olunanda avtomatik görünsün.

### 1.4 İstifadəçilər bölməsi peşəkarlaşması (Bənd 8)

- Zəngin kart: initials-avatar, **verified badge**, **onlayn statusu**, qarşılıqlı-izləmə nişanı, inline follow, səviyyəli skill çipləri.
- Mövcud filtrlərə (skill/səviyyə/nə-axtarır) əlavə: verified, onlayn, qarşılıqlı. Başqasının izlədikləri (icazə varsa) baxıla bilir.

---

## 💬 FAZA 2 — Real-time: presence + zəngin mesajlar (Bənd 10)

- **Onlayn / son görünmə:** presence sistemi. Tövsiyə: Firestore heartbeat (`presence/{uid} = { state, lastSeen }`, hər ~30s yenilə, "onlayn" = lastSeen < ~60s) — emulyatorda işləyir; daha dəqiq variant Realtime DB `onDisconnect`. **`privacy.showOnlineStatus`** aktivsizsə başqaları status görməsin. Otaqlarda, DM-də, users kartında göstər.
- **Zəngin mesajlar:** yalnız mətn deyil — **şəkil, fayl, kod** göndər. **Max 2 MB** (client yoxlaması + Storage rules `request.resource.size < 2*1024*1024`). Mesaj schema: `{ type: text|image|file|code, text?, fileUrl?, fileName?, fileSize?, mimeType?, language?, fromUid, createdAt }`. Şəkil inline preview; fayl → yüklə çipı (ad+ölçü+ikon); kod → highlight edilmiş blok (composer highlight-ını təkrar-istifadə et). MIME validasiyası (təhlükəsizlik). Həm **otaqlar**, həm **DM** üçün.

---

## 🔔 FAZA 3 — Bildirişlər (Bənd 11)

- **Peşəkar bildiriş mərkəzi:** vaxta görə qruplaşdırma, oxunmuş/oxunmamış, **hər tip üçün öz ikonu** (follow, like, comment, mention, message, task-approved, verified, admin), "hamısını oxundu et", filtrlər.
- **Toast:** yeni bildiriş gələndə ekranın **sağ üstündə ~1 saniyə** göstər (ikon + initials-avatar + mətn, klik olunan). Mövcud toast sistemini genişləndir.
- Data: `notifications/{uid}/items/{id} = { type, fromUid, fromName, fromPhoto, targetType, targetId, text, read, createdAt }`. Avatar yoxdursa initials-avatar (FAZA 0.3).

---

## 📋 FAZA 4 — Tapşırıqlar (Bənd 7)

- **Xətanı düzəlt:** tapşırıq yaratmaq işləmir — səbəbi diaqnoz et (ehtimal: rules write-i rədd edir, və ya migration sonrası schema/kateqoriya uyğunsuzluğu) və düzəlt.
- **İstifadəçi-yaratma + admin təsdiqi:** hər kəs tapşırıq təklif edə bilsin → `status:'pending'` (rules bunu məcbur edir) → **"Gözləyən Tapşırıqlar"** bölməsində qalsın (yalnız yaradan + admin görür) → admin təsdiq edir (`status:'approved'`, yalnız admin dəyişə bilər) → public görünür. Rədd → yaradana bildiriş. Data: `tasks/{id} = { title, desc, category, createdBy, status, createdAt, approvedBy, approvedAt }`.

---

## 📊 FAZA 5 — Statistika (Bənd 6)

- **Vaxt filtrləri:** 1 / 7 / 14 gün, aylıq, **tarixlər-arası (custom range)** seçici.
- İstifadəçi: öz statistikası + ictimai icma statistikası. **Yalnız admin** platforma üzrə **detallı** statistikanı görür (ümumi/aktiv istifadəçi, artım, DAU/MAU, top töhfəçilər, moderasiya, newsletter aboneləri).
- Qrafiklər: Chart.js (CDN, buildless) və ya mövcud SVG bar-lar. Admin aqreqatları client bütün istifadəçini oxuya bilmədiyi üçün **Cloud Function** ilə `stats/daily/{date}` toplansın.

---

## 🛡️ FAZA 6 — Admin panel (Bənd 9, 12)

Hazırda yalnız blok/blokdan-çıxarma var. Genişləndir:

- **İstifadəçi redaktəsi:** admin istənilən istifadəçinin sahələrini (ad, bio, skill, sosial, rol) dəyişə bilsin.
- **Müvəqqəti şifrə:** şifrəsini unudan istifadəçiyə admin müvəqqəti şifrə təyin etsin → istifadəçi növbəti girişdə **məcburi dəyişsin** (`mustResetPassword` flag). Şifrə təyini **Admin SDK** tələb edir → **admin-only callable Cloud Function** (`context.auth` + admin yoxlaması ilə) → `admin.auth().updateUser(uid,{password})`. Emulyatorda işləyir; prod üçün deploy təlimatı ver.
- **Verified/mavi tik (Bənd 12):** admin `verified` toggle etsin; hər yerdə badge (FAZA 0.3). Rules: `verified`/`role`/`blocked` yalnız admin yaza bilər.
- **Admin log:** `adminLogs/{id}` (kim, nə, kimə, nə vaxt).

---

## 🌌 FAZA 7 — #welcome + login: interaktiv particle-network (Bənd 13)

**Effektin adı:** *Interactive Particle Network (Constellation) background with mouse repulsion + idle text-morphing* — mesh şəbəkə + maus interaksiyası + boşdayanmada mətnə çevrilmə. Kitabxana: **tsParticles** (v3+, `slim`/`polygonMask`) uyğundur, amma bu dəqiq "idle→mətn→dağıl" davranışı üçün **xüsusi HTML5 Canvas 2D** implementasiyası daha çox nəzarət verir (tövsiyə).

**Davranış:**

1. Arxa fonda yüzlərlə kiçik particle sərbəst sürüşür; yaxın particle-lar arasında xətt çəkilir (**mesh/constellation**).
2. Maus yaxınlaşanda particle-lar **elastik itələnir** (repulse; opsional attract) — maus radiusunda.
3. Maus **2 saniyə** hərəkətsiz qalanda → particle-lar hədəf mövqelərinə **yumşaq keçidlə** toplaşıb **"COLLABIX"** sözünü formalaşdırır. (Texnika: sözü offscreen canvas-a çək, piksellərini nümunələ, particle-ları ən yaxın mətn-pikselinə hədəflə — pixel-sampling / text-as-particle-target.)
4. Maus yenidən hərəkət edəndə → yazı dağılır, particle-lar yenidən sərbəst + mesh.

**Texniki:** `requestAnimationFrame`, cihaza görə particle sayını məhdudlaşdır, tab gizlənəndə dayandır, **`prefers-reduced-motion`** üçün statik/sadə fallback. Temaya uyğun (matrix/teal-yaşıl aksent). **#welcome** və **login** ekranının arxa fonunda.

---

## 🗂️ Data schema / rules / functions xülasəsi

```
users/{uid}.settings          { theme, lang, privacy:{whoCanMessage, showFollowing, showOnlineStatus}, notifications }
users/{uid}.verified          bool (yalnız admin yazır)
users/{uid}/progress/{field}  { count, xp, level }
presence/{uid}                { state, lastSeen }
dms/../messages, rooms/../messages   → type + fileUrl/language (2MB Storage)
tasks/{id}                    + status: pending|approved|rejected
notifications/{uid}/items/{id}
stats/daily/{date}            (Cloud Function aqreqat)
adminLogs/{id}
```

- **Rules:** whoCanMessage tətbiqi (DM create); `verified/role/blocked` yalnız admin; task create məcburi `pending`, approve yalnız admin; presence yalnız sahib yazır; message ölçü/tip; showFollowing/showOnlineStatus oxu-icazəsi.
- **Storage rules:** mesaj əlavələri < 2MB, icazəli MIME.
- **Cloud Functions (emulyatorda):** admin `setTempPassword` (callable), `stats/daily` aqreqasiya, opsional presence.

---

## ✅ Definition of Done (13 bəndə uyğun)

- [ ] (1) Bütün səhifələr mobildə düzgün (360/390/768); responsive konvensiya sənədləşib.
- [ ] (2) Girişdən sonra header/nav/footer var; AZ/EN/RU + tema girişdən sonra işləyir; app UI tam tərcümə olunur.
- [ ] (3) Parametrlər Profil içində, dinamik/schema-driven.
- [ ] (4) İzləyənlər/izlədiklərim + qarşılıqlı + "kim mesaj yaza bilər" işləyir (rules ilə).
- [ ] (5) "Sahələr üzrə irəliləyiş" real datadan dinamik.
- [ ] (6) Statistika 1/7/14/aylıq/custom-range; admin detallı görür.
- [ ] (7) Tapşırıq yaratma işləyir; user-təklif + admin təsdiqi + "Gözləyən" queue.
- [ ] (8) Users zəngin/funksional; icazə ilə başqasının izlədikləri görünür.
- [ ] (9) Admin istifadəçi redaktə + müvəqqəti şifrə (məcburi reset) edə bilir.
- [ ] (10) Onlayn/son-görünmə (toggle-lı) + şəkil/fayl/kod mesaj (≤2MB) otaq+DM-də.
- [ ] (11) Bildirişlər peşəkar (tip-ikonları, sağ-üst 1s toast); initials-avatar hər yerdə.
- [ ] (12) Admin verified badge verir; hər yerdə görünür.
- [ ] (13) #welcome + login-də particle-network + idle text-morph "COLLABIX"; reduced-motion fallback.
- [ ] Netlify deploy qırılmayıb; tünd tema qorunub; E2E + sıfır konsol xətası; hər yeni UI mobil+üçdilli.

---

## ❓ Başlamazdan əvvəl məndən təsdiq al

1. **Sıra:** FAZA 0 (mobil + chrome/i18n + ortaq komponentlər) əvvəl, sonra sosial/real-time, ən sonda welcome effekti — razısan?
2. **Presence:** Firestore heartbeat (sadə, buildless) yoxsa Realtime DB `onDisconnect` (daha dəqiq)?
3. **Tema:** yalnız dark+light, yoxsa "matrix/terminal" üçüncü tema da?
4. **Welcome effekti:** xüsusi Canvas 2D (tam nəzarət) yoxsa tsParticles (hazır lib) üstünlük?
5. **Cloud Functions:** admin müvəqqəti-şifrə və stats-aqreqat üçün Functions əlavə edirik (emulyatorda) — təsdiq? (Prod-da deploy lazım olacaq.)
6. **Mesaj faylları:** yalnız şəkil/kod, yoxsa istənilən fayl tipi (pdf/zip və s.) də ≤2MB?

Planı təsdiq etdikdən sonra FAZA 0.1 (responsive) ilə başla.
