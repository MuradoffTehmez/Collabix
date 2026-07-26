# Collabix — Məhsul, UX və Funksiya Spesifikasiyası (Claude Code tapşırığı)

Sən təcrübəli full-stack + product-minded developer və UI/UX mühəndisisən. Aşağıdakı yayımlanmış tətbiqi **peşəkar, dinamik və genişləndirilə bilən** məhsula çevirəcəksən. Kod yazmadan əvvəl planı təsdiq etdir; hər mərhələdən sonra dayan, nəticəni göstər.

---

## 📦 Kontekst

- **Tətbiq:** "Collabix" — 18+ öyrənmə/əməkdaşlıq platforması (feed, ümumi chat, DM, istifadəçi kataloqu, kateqoriyalı tapşırıqlar, statistika, admin, profil).
- **Struktur:** hazırda TƏK `index.html` (~1314 sətir), vanilla JS, framework yoxdur.
- **Backend:** Firebase Firestore. Hosting: Netlify (buildless). Lokal dev: VS Code Live Server (`127.0.0.1:5500`).
- **Dil/tema:** UI Azərbaycan dilində, tünd (dark) tema (`--bg`, `--surface`, `--coral`, `--teal`, `--violet` və s.) — **saxlanılmalıdır**.
- **Mövcud sabit ID-lər (əvəz olunacaq):** registration — `regName`, `regAge`, `regUser`, `regPass`, `regInsta`, `regGithub`, `pillProg`, `pillLang`, gender `.genBtn`; composer — `composerText`, `composerTags`, `handleComposerImage`/`composerImageData` (yalnız 1 şəkil); sabit `CATEGORIES = ['Python','JavaScript','C++','Java','Arduino/C','İngilis','Alman','Rus','Fransız']`.

---

## ⚠️ Prerequisite (əvvəlki təhlükəsizlik tapşırığı)

Bu spesifikasiya **Firebase Authentication + düzgün Firestore kolleksiyaları + Security Rules** əsası üzərində qurulur (ayrı tapşırıq faylında verilib). Əgər o hələ tətbiq olunmayıbsa, ƏVVƏLCƏ onu tamamla: real auth, plaintext parolların ləğvi, hardcoded admin-in silinməsi, XSS düzəlişi, şəkillərin Firebase Storage-a köçürülməsi. Aşağıdakı bütün yeni yazma əməliyyatları `request.auth != null` və müvafiq rules ilə qorunmalıdır.

---

## 🎨 Ümumi prinsiplər (hər yerdə tətbiq et)

1. **Dizayn dili:** mövcud tünd temanı və mövcud animasiya "dilini" (float glow, `cardPop`, `dotPulse`, `shine`) əsas götür — kohesiv, təmiz, gaudy deyil.
2. **Animasiyalar hər yerdə, amma zövqlə:** route keçidləri, hover/press micro-interaction-lar, modal open/close, skeleton shimmer, stagger-in. **Mütləq `prefers-reduced-motion` dəstəklə** (bu istifadəçilər üçün animasiyaları söndür).
3. **Buildless qal:** Netlify deploy dəyişməsin. Lazım olan kitabxanaları CDN/ES-module ilə gətir (highlight.js, kiçik animasiya lib və s.).
4. **Accessibility:** klaviatura naviqasiyası, focus state-lər, ARIA label-lar, kontrast (muted mətn oxunaqlı olsun).
5. **Konfiqurasiya kodda deyil, bazada:** heç bir dil/skill siyahısını hardcode etmə (aşağı bax — dinamik taksonomiya).
6. Hər əməliyyat **toast** ilə təsdiq/xəta versin; silmələr **confirmation dialoqu** ilə.

---

## 1️⃣ Dinamik taksonomiya (ƏVVƏL BUNU QUR — hər şey buna bağlıdır)

**Problem:** `CATEGORIES` hardcode-dur; gələcəkdə yeni dil/proqramlaşdırma dili əlavə etmək kod dəyişikliyi tələb edir.

**Həll — Firestore-da idarə olunan taksonomiya:**

```
taxonomies/programmingLanguages/items/{id}  → { label, color, icon, highlightId, order, active }
taxonomies/spokenLanguages/items/{id}       → { label, flag, order, active }
taxonomies/postTags/items/{id}              → { label, color, order, active }   // opsional, prog dilləri ilə birləşdirilə bilər
```

- `highlightId` = highlight.js grammar identifikatoru (`python`, `javascript`, `cpp`, `csharp`, `java`, `sql` və s.) — kod highlighting üçün.
- **Admin panelində taksonomiya CRUD:** admin yeni dil/skill əlavə/redaktə/deaktiv edə bilsin (label, rəng, ikon, highlightId).
- **Bütün istifadə yerləri dinamikləşsin:** qeydiyyat skill/dil seçimi, profil redaktəsi, post tag-ları, kod dili dropdown-u, task kateqoriyaları, statistika bölgüsü — hamısı taksonomiyanı oxusun (bir dəfə fetch + cache).
- **Seed script:** mövcud 9 dəyəri + zənginləşdirilmiş default set-i (C#, Go, Rust, TypeScript, SQL, HTML/CSS, PHP, Kotlin, Swift, Bash; spoken: İspan, Ərəb, Türk, Çin və s.) rəng/ikon/highlightId ilə doldur.

---

## 2️⃣ Peşəkar qeydiyyat (multi-step wizard)

Tək uzun formu **addımlı sihirbaza** çevir; progress indicator + addımlar arası animasiyalı keçid + hər addımda validasiya.

- **Addım 1 — Hesab:** username (canlı `usernames/{username}` uniqueness yoxlaması + qayda göstəricisi `[a-z0-9._]`), parol (**strength meter** + təkrar/confirm sahəsi + göz ikonası), email (könüllü, reset üçün).
- **Addım 2 — Şəxsi:** tam ad, avatar (yükləmə + crop + preview), cins, **doğum tarixi** (raw yaş əvəzinə → yaşı hesabla, 18+ məcburi), ölkə/şəhər (könüllü), qısa bio.
- **Addım 3 — Bacarıqlar və hədəflər:** proqramlaşdırma dilləri (dinamik taksonomiyadan, **hər biri üçün səviyyə**: başlanğıc/orta/qabaqcıl), öyrəndiyi/bildiyi dillər (dinamik, səviyyə ilə), öyrənmə hədəfləri, "nə axtarıram" (study partner / mentor / layihə komandası).
- **Addım 4 — Sosial:** instagram, github, linkedin, telegram, şəxsi sayt (hamısı könüllü, format validasiyası).
- Progress bar, geri/irəli, addım validasiyası, animasiyalı keçidlər. **Bütün bu sahələr sonradan profildən redaktə oluna bilər.**

---

## 3️⃣ Login-in peşəkarlaşdırılması

- Aydın **loading state** (spinner), dəqiq **xəta mesajları** (hesab yoxdur / parol yanlış / bloklanıb), inline validasiya.
- **Göz ikonası** (parolu göstər), **"Məni xatırla"** (auth persistence — F5-də daxil qalsın), **"Parolu unutmusan?"** linki (reset axını).
- Çox uğursuz cəhddə yumşaq rate-limit / bloklanma bildirişi.
- Giriş/qeydiyyat tab keçidləri animasiyalı, terminal-vari mövcud estetika saxlanılsın.

---

## 4️⃣ Geniş və peşəkar profil redaktəsi

Qeydiyyatda toplanan hər şey burada redaktə olunsun. **Tab-lı editor** + canlı preview + save/cancel + toast.

- **Tab "Ümumi":** avatar (dəyiş/sil/crop), ad, bio, doğum tarixi, cins, ölkə/şəhər.
- **Tab "Bacarıqlar":** proqramlaşdırma dilləri və danışıq dilləri — **dinamik taksonomiyadan seç**, hər biri üçün səviyyə; öyrənmə hədəfləri; "nə axtarıram". (Yeni taksonomiya əlavə olunanda avtomatik burada görünsün.)
- **Tab "Sosial":** bütün linklər.
- **Tab "Təhlükəsizlik":** parol dəyiş, **username dəyiş** (uniqueness + `usernames` mapping transaction ilə yenilə), hesabı sil (confirmation + tam təmizləmə).
- Profil görünüşündə: banner/cover, avatar, səviyyəli skill çipləri, sosial çiplər, statistika (seriya, post, mesaj), və aktivlik xəritəsi (aşağı).

---

## 5️⃣ Çoxparçalı (block-based) paylaşım composer-i

**Tələb:** bir post mətn + kod + şəkildən ibarət ola bilər; **birdən çox parça və birdən çox şəkil**. Notion/Medium-vari blok redaktoru.

**Data modeli:** post = sıralı **bloklar massivi**.

```
posts/{postId} → {
  authorUid, authorName, createdAt, editedAt, tags[],
  blocks: [
    { type:'text',  content:'...' },
    { type:'code',  language:'python', highlightId:'python', content:'...' },
    { type:'image', urls:['storageUrl1','storageUrl2'], caption:'...' }  // qalereya
  ],
  likeCount, commentCount
}
```

**Composer UX:**

- "**+ Blok əlavə et**" → Mətn / Kod / Şəkil seç.
- Bloklar **yenidən sıralana bilir** (sürüklə və ya yuxarı/aşağı), hər biri redaktə/sil.
- Mətn bloku: sadə markdown (qalın, kursiv, link, siyahı) və ya minimum sətir sonu + link avtolinki.
- Kod bloku: dil seçimi (aşağı §6) + monospace + preview.
- Şəkil bloku: bir blokda **çox şəkil** (grid/carousel), hər birinə caption; Storage-a yüklə.
- Blok əlavə/silmə animasiyalı; xarakter/ölçü limitləri və validasiya.

**Render:** blokları sırayla göstər — kod highlighting + copy düyməsi ilə, çox şəkilli bloklar qalereya/carousel kimi, mətn oxunaqlı tipoqrafiya ilə. Feed-də uzun postlar "daha çox oxu" ilə kəsilsin; tam görünüş **post detal səhifəsində**.

---

## 6️⃣ Kod bloku — dil seçimi + syntax highlighting

- Kod blokunda **dil seçici dropdown** (dinamik taksonomiyanın `highlightId` sahəsindən qidalanır).
- **highlight.js** (CDN, buildless) ilə highlighting; tünta uyğun tema (məs. atom-one-dark). Yalnız seçilmiş dilin grammar-ını lazım olduqda yüklə.
- Kod blokunda: **dil etiketi** (badge), **copy düyməsi** (toast ilə "kopyalandı"), opsional sətir nömrələri, horizontal scroll (wrap yox), mövcud JetBrains Mono fontu.
- Təhlükəsizlik: kod məzmunu **mətn kimi** render olunsun (highlight.js escape edir); heç vaxt `innerHTML`-ə xam kod qoyulmasın.

---

## 7️⃣ Modern aktivlik xəritəsi (GitHub-tipli heatmap)

- **52 həftə × 7 gün** kvadrat şəbəkəsi; gündəlik fəaliyyət sayına görə rəng intensivliyi (5 səviyyə, teal→coral qradiyenti temaya uyğun).
- **"Fəaliyyət" = o gün** post + mesaj + task submission + giriş sayı.
- **Data:** `users/{uid}` sənədində `activityByDay: { 'YYYY-MM-DD': count }` map (və ya `users/{uid}/activity/{date}` subkolleksiya). Hər mənalı əməliyyatda müvafiq günü `increment(1)` et.
- **Görünüş:** yuvarlaq künclü kvadratlar, ay etiketləri (üst), həftə günü etiketləri (sol), hover-də **tooltip** ("3 fəaliyyət — 19 iyul"), aşağıda "Az → Çox" legend. Yüklənəndə stagger-in animasiyası, hover-də kiçik pulse.
- SVG və ya CSS grid ilə qur; profildə göstər.

---

## 8️⃣ Animasiyalar (site-wide)

- **Route/səhifə keçidləri** (fade/slide) nav bölmələri arasında.
- **Micro-interaction:** button hover/press, kart hover-lift, **like düyməsi pop**, tag toggle, toast slide-in.
- **Modal** open/close (scale + fade), composer blok əlavə/sil.
- **Skeleton shimmer** yüklənmə üçün (boş ekran yerinə).
- **Heatmap** stagger + hover; **feed kartları** ardıcıl görünmə.
- Yüngül kitabxana (məs. Motion One / anime.js CDN) yalnız lazım olsa; əksər hallarda CSS transition/keyframe kifayətdir.
- **`prefers-reduced-motion: reduce`** olduqda bütün qeyri-vacib animasiyaları söndür.

---

## 9️⃣ Araşdırılmış əlavə funksiyalar (peşəkar roadmap)

Platformanı tam etmək üçün (prioritetlə əlavə et):

- **Follow sistemi + fərdi feed** — "İzlədiklərim" vs "Hamısı" tab-ları.
- **Mention (@username)** — post/şərh/chat-da autocomplete + profilə link + bildiriş.
- **Bildiriş mərkəzi (🔔) + unread badge** — like, şərh, mesaj, mention, task nəticəsi.
- **Axtarış və filtrlər** — istifadəçini skill/səviyyə/dil üzrə; postu tag/tip üzrə.
- **Bookmark/saxlanmış postlar** səhifəsi.
- **Gamification** — XP, level, **badges/nişanlar**, streak (freeze/repair ilə), genişlənmiş leaderboard (XP + tamamlanmış task).
- **Study otaqları / mövzu kanalları** — tək ümumi chat əvəzinə (məs. "Python otağı", "İngilis otağı").
- **Task submission + review workflow** — istifadəçi həll göndərir, admin təsdiq/rədd edir, XP verilir.
- **Onboarding tour** — ilk girişdə qısa bələdçi.
- **Moderasiya/admin dashboard** — şikayətlər, metriklər (istifadəçi/post/aktivlik sayı), taksonomiya idarəsi, istifadəçi blok/açma.
- **PWA** — installable, offline shell, (mümkünsə) push bildiriş; manifest + service worker.
- **Rate limiting / spam qorunması** — post/mesaj tezliyi məhdudiyyəti.
- **i18n hazırlığı** — mətnləri mərkəzi obyektdə saxla ki, gələcəkdə EN/RU əlavə oluna bilsin (indi AZ).
- **İstifadəçi data ixracı** — öz məlumatını JSON kimi endirə bilsin.

---

## 🔟 Çatışmayan səhifələr / modullar (yaradılmalı)

Mövcud: Ana səhifə, Ümumi söhbət, Mesajlar, İstifadəçilər, Tapşırıqlar, Statistika, Profil, Admin.
**Əlavə olunmalı:**

- **Settings** (parol/username/tema/bildiriş/hesab silmə/data ixracı)
- **Bildirişlər** mərkəzi
- **Post detal** səhifəsi (şərhlər + tam bloklar) — deep-link (`#post/{id}`)
- **Bookmarks** (saxlanmışlar)
- **Study otaqları** siyahısı + otaq görünüşü
- **Axtarış nəticələri** səhifəsi
- **Public profil görünüşü** (redaktədən ayrı, deep-link `#u/{username}`)
- **Onboarding** ekranı
- **Admin alt-səhifələri:** taksonomiya CRUD, moderasiya, metriklər
- **Empty / 404 / xəta** state-ləri (mövcud olanları saxla, çatışmayanları əlavə et)
- Bütün naviqasiya **hash routing** (`#home`, `#post/123`) ilə deep-linkable olsun; **mobil bottom-nav** əlavə et.

---

## 🗂️ Konsolidə data schema (yekun)

```
users/{uid}                         profil + səviyyəli skill-lər + activityByDay + role
usernames/{username}                → { uid }   (immutable, uniqueness)
taxonomies/{type}/items/{id}        proq. dilləri / danışıq dilləri / tag-lar (admin CRUD)
posts/{postId}                      block-based post
posts/{postId}/comments/{id}
posts/{postId}/likes/{uid}
posts/{postId}/bookmarks/{uid}      (və ya users/{uid}/bookmarks/{postId})
chat_general/{msgId}
rooms/{roomId}/messages/{msgId}     study otaqları
dms/{pairId}/messages/{msgId}
tasks/{taskId}/submissions/{uid}
follows/{followerUid}/following/{targetUid}
notifications/{uid}/items/{id}
reports/{reportId}
admins/{uid}
```

Hər yeni kolleksiya üçün **Firestore + Storage security rules** yaz (`request.auth.uid` sahiblik yoxlaması, admin istisnası, ölçü/tip limitləri).

---

## ✅ Definition of Done

- [ ] Heç bir dil/skill/tag hardcode deyil — hamısı taksonomiyadan; admin yeni əlavə edə bilir.
- [ ] Qeydiyyat çoxaddımlı, zəngin data toplayır; **hamısı profildən redaktə olunur**.
- [ ] Login peşəkar (loading, dəqiq xətalar, göz ikonası, remember me, reset).
- [ ] Post çoxparçalıdır — çox mətn/kod/şəkil bloku, sıralana bilir; kod dili seçimi + highlighting + copy işləyir.
- [ ] Aktivlik xəritəsi GitHub-tipli, real datadan, tooltip + animasiya ilə.
- [ ] Site-wide animasiyalar + `prefers-reduced-motion` dəstəyi.
- [ ] Çatışmayan səhifələr (Settings, Bildirişlər, Post detal, Bookmarks, Study otaqları, Public profil) mövcuddur və deep-linkable-dir.
- [ ] Netlify deploy qırılmayıb; UI Azərbaycan dilində, tünd temada.
- [ ] Bütün yeni yazma əməliyyatları auth + rules ilə qorunur.

---

## ❓ Başlamazdan əvvəl məndən təsdiq al

1. **Sıra:** taksonomiya → qeydiyyat/profil → post composer → heatmap → əlavə funksiyalar razısan?
2. **Post markdown:** tam markdown (rich text) yoxsa sadə formatlanma (qalın/kursiv/link/kod) kifayətdir?
3. **Səviyyə sistemi:** skill səviyyələri sadə 3 pillə (başlanğıc/orta/qabaqcıl) yoxsa faizli/XP-yə bağlı olsun?
4. **Study otaqları və gamification** bu mərhələyə daxil olsun, yoxsa əvvəlcə əsas (taksonomiya + post + profil + heatmap) tamamlansın?
5. **PWA** indi lazımdır, yoxsa sonraya?

Planı təsdiq etdikdən sonra §1 (dinamik taksonomiya) ilə başla.
