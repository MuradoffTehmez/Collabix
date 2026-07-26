# Collabix — Təhlükəsizlik düzəlişi + CRUD + funksiya genişləndirmə (Claude Code tapşırığı)

Sən təcrübəli bir full-stack + təhlükəsizlik yönümlü developer-sən. Aşağıdakı layihəni **mərhələ-mərhələ** təhlükəsiz, tam funksional və genişləndirilə bilən hala gətirəcəksən. Kod yazmadan əvvəl planı təsdiq etdir, hər mərhələdən sonra dayan və nəticəni göstər.

---

## 📦 Layihə konteksti

- **Nədir:** "Collabix" — 18+ gənclər üçün öyrənmə/əməkdaşlıq platforması (feed, ümumi chat, DM, istifadəçi kataloqu, kateqoriyalı tapşırıqlar, statistika, admin panel).
- **Struktur:** Bütün tətbiq TƏK fayldadır — `index.html` (~1314 sətir). Framework yoxdur, vanilla JS.
- **Backend:** Firebase Firestore, hazırda **"test mode"** (dünyaya açıq oxu/yazı).
- **Data modeli (hazırkı):** Firestore KV-store kimi işlədilir. `collabix_kv` kolleksiyası, sənəd ID-ləri: `users:<username>`, `posts:<id>`, `chat:general:<id>`, `dm:<a__b>:<id>`, `tasks:<id>`, `reports:<id>`, `admin:session`, `connection_test`. Hər sənəd `{ value: "<JSON string>" }` formatındadır.
- **Hosting:** Netlify — **build step yoxdur** (static). Deploy-u qırmaq olmaz.
- **Dil/tema:** UI **Azərbaycan dilindədir**, tema tünd (dark, mavi/teal aksentlər). **Hər ikisi saxlanılmalıdır.**

---

## ⚠️ Dəyişməz qaydalar (bunlara həmişə əməl et)

1. **Vizual dizaynı və Azərbaycan mətnlərini saxla.** Yenidən dizayn etmə; yeni elementlər mövcud tema dəyişənlərinə (`--bg`, `--surface`, `--coral`, `--teal` və s.) uyğun olsun.
2. **Deploy-u qırma.** Buildless qalmağı üstün tut. Əgər fayl bölünməsi/modul lazım olsa, `<script type="module">` + CDN import (və ya importmap) istifadə et ki, Netlify-a əlavə build olmadan çıxsın. Build əlavə edəcəksənsə, əvvəlcə mənə de.
3. **Bazanı dəyişən/silən heç bir əməliyyatı təsdiqsiz icra etmə.** Migration script-ləri əvvəl "dry-run" (yalnız oxu + hesabat) rejimində yaz, mən təsdiq etdikdən sonra yazma rejimini işə sal.
4. **Heç bir secret-i koda hardcode etmə və commit etmə.** Admin kodu, xüsusi açarlar client JS-ə yazılmamalıdır.
5. **KRİTİK — sızdırılmış kredensiallar:** Hazırkı admin kodu (`dilsuz515253`) və admin adı client JS-də açıq idi və artıq **kompromitə olunmuş** sayılır. Onları koddan tamamilə çıxar; yeni admin təyinatı aşağıdakı təhlükəsiz üsulla olsun (heç vaxt koda yazılmadan).
6. **Firestore Security Rules-u sən deploy edə bilməyəcəksən** (Firebase Console mənə lazımdır). Ona görə `firestore.rules` faylını hazırla və mənə dəqiq deploy təlimatı ver.
7. **Mərhələ-mərhələ işlə**, hər mərhələnin sonunda dayan, dəyişiklikləri xülasə et və test nəticələrini göstər.

---

## Mərhələ 0 — Kəşfiyyat və plan (kod yazma)

1. `index.html`-i tam oxu, bütün funksiyaları, DOM strukturunu, storage helper-ləri (`storeGet/storeSet/storeListKeys` və s.) və data axınlarını xəritələ.
2. Aşağıdakı problemləri kodda konkret sətir nömrələri ilə təsdiqlə: açıq Firestore, plaintext parol, hardcoded admin, XSS (`image` src interpolation), `onclick` string injection, username normalizasiya bug-u, debug elementləri, 4 saniyəlik polling.
3. Bütün mərhələlər üçün qısa **icra planı** və **tövsiyə olunan yeni data schema**-nı təqdim et. Mən təsdiq edəndən sonra Mərhələ 1-ə başla.

---

## Mərhələ 1 — TƏHLÜKƏSİZLİK (ən yüksək prioritet, əvvəlcə bu)

### 1.1 Real autentifikasiya — Firebase Authentication

Hazırkı "auth" brauzerdə parol müqayisəsidir; bu tamamilə əvəz olunmalıdır.

- **Firebase Auth (Email/Password) provider-ini** işə sal.
- **Username-only UX saxlanılsın** (istifadəçidən email istəmə). Bunun üçün sintetik email istifadə et: qeydiyyatda `${normalizedUsername}@collabix.app` formatında email yarat və `createUserWithEmailAndPassword` çağır.
- **Login axını:** istifadəçi username + parol daxil edir → `usernames/{username}` mapping sənədindən email/uid tapılır → `signInWithEmailAndPassword(email, pass)`.
- **Parollar artıq yalnız Firebase Auth-da** saxlanılır. Bütün user sənədlərindən `pass` sahəsini **tamamilə sil**.
- Əlavə et: **parol dəyişmə** (`updatePassword`), **çıxış** (`signOut`), və **auth state persistence** (`onAuthStateChanged` ilə səhifə yenilənəndə istifadəçi daxil qalsın — hazırda F5 çıxış edir).
- Opsional (mən qərar verəcəyəm): email əlavə etmək istəyənlər üçün könüllü email sahəsi + `sendPasswordResetEmail`.

### 1.2 Data modeli miqrasiyası (KV → düzgün kolleksiyalar)

`collabix_kv` KV-store-dan Firestore-un təbii kolleksiya modelinə keç:

```
users/{uid}                 → { username, name, age, gender, prog[], langs[],
                                instagram, github, bio, photoURL, streak,
                                lastActive, joinedAt, blocked, role }   // pass YOX
usernames/{username}        → { uid }                 // uniqueness + username→uid axtarışı
posts/{postId}              → { authorUid, authorName, text, tags[], imageURL,
                                createdAt, likeCount, commentCount }
posts/{postId}/comments/{id}
posts/{postId}/likes/{uid}
chat_general/{msgId}        → { authorUid, authorName, text, createdAt }
dms/{pairId}/messages/{id}  → { fromUid, toUid, text, createdAt, editedAt }
tasks/{taskId}              → { title, desc, category, createdBy, createdAt }
tasks/{taskId}/submissions/{uid} → { text, link, status, submittedAt }
reports/{reportId}          → { reporterUid, targetUid, reason, status, createdAt }
admins/{uid}                → { addedAt }             // admin siyahısı (aşağıya bax)
```

- **Migration script yaz** (bir dəfəlik, `migrate.html` və ya konsol script kimi). Əvvəl **dry-run**: köhnə sənədləri oxu, neçəsinin köçürüləcəyini hesabat ver. Təsdiqdən sonra yaz.
- **Mövcud 19 istifadəçi** üçün: onların Firebase Auth hesabı yoxdur. Mənə iki variant təklif et və qərarı mənə burax: (a) köhnə plaintext parollarla proqram vasitəsilə Auth hesabı yaratmaq (Admin SDK/server lazımdır), yoxsa (b) erkən mərhələ olduğundan istifadəçiləri yenidən qeydiyyata dəvət etmək (parol reset). Destruktiv addım atmamışdan əvvəl təsdiq al.

### 1.3 Firestore Security Rules (`firestore.rules`)

- `request.auth != null` olmadan **heç bir oxu/yazı olmasın**.
- İstifadəçi yalnız **öz** `users/{uid}` sənədini yaza bilsin (`request.auth.uid == uid`).
- Post/mesaj yaradarkən `authorUid == request.auth.uid` məcburi olsun; başqasının sənədini redaktə/sil edə bilməsin (admin istisna).
- `usernames/{username}` yaratmağa yalnız o uid sahib olsun; dəyişməz (immutable) et.
- Admin yoxlaması: `exists(/databases/$(db)/documents/admins/$(request.auth.uid))` (aşağı bax).
- Şəkil/mətn field-lərinə server-side validasiya (tip, uzunluq limitləri).
- Faylı hazırla + Firebase Console-da necə deploy etməyi addım-addım izah et.

### 1.4 Admin sistemi (hardcoded creds → təhlükəsiz)

- `ADMIN_NAME` / `ADMIN_CODE` sabitlərini və `admin:session` məntiqini **tamamilə sil**.
- Admin statusu `admins/{uid}` kolleksiyası ilə idarə olunsun; bu sənədi yaratmağa/silməyə security rules-da yalnız mövcud admin icazəlidir. İlk admini mən Firebase Console-dan əl ilə əlavə edəcəyəm — bunun üçün təlimat ver.
- (Əgər sonradan Cloud Functions əlavə etsək: daha güclü variant kimi Auth **custom claims** (`admin:true`) + rules-da `request.auth.token.admin == true` təklif et.)
- Admin paneli yalnız `admins/{uid}` mövcud olduqda göstərilsin (client tərəf yalnız UI üçün; əsl qoruma rules-dadır).

### 1.5 XSS və injection düzəlişləri

- **innerHTML attribute interpolation-u ləğv et.** `src="'+p.image+'"` kimi yerləri `img.src = url` (property) və ya `setAttribute` ilə əvəz et. DOM elementlərini `createElement` + `textContent` ilə qur, string HTML birləşdirmədən.
- Bütün `onclick="fn('...')"` inline handler-ləri **`addEventListener` + `data-*` atributları** ilə əvəz et (username-də tək dırnaq injection-u aradan qalxsın).
- `escapeHtml` istifadə olunan yerlər qalsın, amma attribute kontekstləri üçün ayrıca düzgün escaping/DOM API tətbiq et.
- Şəkil URL-lərini validasiya et: yalnız `https://...firebasestorage...` domenli URL-lərə icazə ver (data: URL və ixtiyari domen qəbul etmə).

### 1.6 Debug / production təmizliyi

- Sağ üst küncdəki **Firebase status qutusunu** (`#fbStatusBox`) tamamilə sil.
- Hər ziyarətçinin bazaya yazdığı **`connection_test`** sənəd yazısını sil.
- Bütün `console.log`/`console.error` debug çıxışlarını nəzərdən keçir, lazımsızları təmizlə.

### 1.7 Username normalizasiyası (İ/I / Unicode bug)

- Səbəb: `toLowerCase()` az-AZ "İ/I" hərflərini fərqli emal edir → dublikat hesablar (`ismayılov_grup` vs `i̇smayılov_grup`).
- Həll: yalnız ASCII-yə icazə ver — `username.trim().toLowerCase().normalize('NFKC').replace(/[^a-z0-9._]/g, '')`; boş və ya çox qısa olarsa rədd et. Uniqueness-i `usernames/{username}` ilə transaction daxilində yoxla.

### 1.8 Şəkillər → Firebase Storage

- Base64 data URL-ləri Firestore sənədində saxlamağı dayandır (sənədləri şişirdir, bahalıdır).
- Şəkilləri **Firebase Storage**-a yüklə, yalnız `downloadURL`-i sənəddə saxla. Storage üçün də security rules yaz (yalnız daxil olmuş istifadəçi, ölçü/tip limiti ilə).

---

## Mərhələ 2 — CRUD tamamlanması

### 2.1 Profil (istifadəçinin qeyd etdiyi əsas boşluq)

- **Profil redaktə** modalı: ad, avatar, prog/langs, sosial linklər dəyişmək (UPDATE).
- **Bio / "Haqqımda"** sahəsi əlavə et (schema-da var, UI + edit ilə).
- **Hesabı silmə** (DELETE) — təsdiq dialoqu ilə; Auth hesabı + user sənədi + `usernames` mapping birlikdə silinsin.
- **Öz postlarını profildən idarə** — redaktə/sil.

### 2.2 Post

- Post **redaktə** və **silmə** (yalnız müəllif/admin).
- Silinəndə əlaqəli `comments`, `likes` və Storage şəkli də təmizlənsin.

### 2.3 Mesaj (ümumi chat + DM)

- Mesaj **redaktə** (`editedAt`) və **silmə**.

---

## Mərhələ 3 — Yeni funksiyalar

### 3.1 Post qarşılıqlı əlaqəsi

- **Like/reaksiya** (`posts/{id}/likes/{uid}`, `likeCount`) və **şərh** (`comments`) sistemi.
- **Kod snippet post-ları** — syntax highlighting ilə (proqramlaşdırma platforması üçün əsas dəyər). Buildless highlight kitabxanası (məs. highlight.js CDN) istifadə et.
- **Bookmark/saxla** və **post detal görünüşü**.

### 3.2 Öyrənmə funksiyaları (platformanın əsl dəyəri)

- **Task submission** — istifadəçi tapşırığa cavab/həll göndərsin (`submissions/{uid}`), admin **yoxlasın/təsdiqləsin** (status: pending/approved/rejected).
- **Progress tracking** — hər skill/dil üzrə real faiz (tamamlanmış task əsasında, sadəcə seçilmiş tag yox).
- **XP / level + nişanlar (badges)** — streak-ə əlavə; leaderboard-u XP və tamamlanmış task üzrə genişləndir.
- **Study otaqları / mövzu qrupları** — tək ümumi chat əvəzinə (məs. "Python otağı").

### 3.3 Bildirişlər

- **Bildiriş mərkəzi (🔔)** — yeni mesaj, like, şərh, task yoxlanışı üçün.
- Sidebar-da **oxunmamış sayğac (unread badge)** — mesajlar üçün.
- **Online/offline göstərici** — `lastActive` datası artıq var, göstər.

### 3.4 Axtarış

- İstifadəçi və post üzrə axtarış (username/ad/tag).

---

## Mərhələ 4 — UX / vizual komponentlər

- **Toast bildirişləri** — hər əməliyyatda (paylaşıldı, redaktə olundu, silindi, xəta). Hazırda əməliyyatlar səssizdir.
- **Təsdiq dialoqu (confirmation)** — bütün silmə əməliyyatlarından əvvəl.
- **Loading skeleton** — boş ekran əvəzinə yüklənmə animasiyası.
- **Tema toggle** (dark/light) + **Settings səhifəsi** (parol dəyişmə, hesab silmə, tema burada).
- **Mobil naviqasiya** — bottom nav bar / hamburger; sidebar telefonda əlverişsizdir.
- **Responsive** — cari yalnız 1 `@media (max-width:860px)` var; auth, dashboard, feed, chat üçün əlavə breakpoint-lər.
- **Aktivlik heatmap-ı** (GitHub-tipli seriya təqvimi) — `streak` mövzusuna çox uyğun; profildə göstər.

---

## Mərhələ 5 (opsional) — Kod strukturu

- Tək 1314 sətirlik HTML-i məntiqi fayllara böl: `index.html`, `styles.css`, `firebase.js` (config/init), `auth.js`, `store.js` (data layer), və feature modulları (`feed.js`, `chat.js`, `dm.js`, `tasks.js`, `profile.js`, `admin.js`, `ui.js`).
- ES modules (`type="module"`) ilə buildless saxla ki, Netlify deploy dəyişməsin. Firebase modular SDK (v10 `firebase/app`, `firebase/auth`, `firebase/firestore`) tövsiyə olunur — compat-dan modular-a keçidi et.
- **Firebase config** ayrı fayla çıxsın (API key web üçün public olmaqda problem deyil, əsl qoruma security rules-dadır; amma yenə də ayrılıqda saxla).

---

## ✅ Definition of Done (yekun yoxlama)

- [ ] Firestore rules olmadan autentifikasiyasız oxu/yazı **mümkün deyil** (REST API ilə yoxlanılıb).
- [ ] Heç bir sənəddə plaintext `pass` **qalmayıb**; login Firebase Auth ilə işləyir.
- [ ] Client kodunda **heç bir admin secret / hardcoded kod yoxdur**; admin `admins/{uid}` ilə idarə olunur.
- [ ] `image`/username vasitəsilə **XSS/injection reproduksiya olunmur**.
- [ ] Debug elementləri və `connection_test` yazısı **silinib**.
- [ ] Səhifə yeniləndikdə (F5) istifadəçi **daxil qalır**.
- [ ] Profil, post, mesaj üçün **tam CRUD** işləyir.
- [ ] Şəkillər **Storage**-da, sənədlərdə yalnız URL.
- [ ] Polling əvəzinə real-time listener (`onSnapshot`) və/və ya pagination; artıq bütöv baza hər 4 saniyədə çəkilmir.
- [ ] Netlify deploy **qırılmayıb**; UI Azərbaycan dilində və tünd temada qalıb.

---

## ❓ Başlamazdan əvvəl məndən təsdiq al

1. **Mövcud 19 istifadəçi** üçün migration: köhnə parollarla Auth hesabı yaratmaq (server lazım) yoxsa yenidən qeydiyyat (reset)?
2. **Email**: username-only qalsın (sintetik email) yoxsa könüllü real email + reset əlavə olunsun?
3. **Struktur**: tək fayl qalsın (sadəcə təhlükəsizlik+funksiya) yoxsa Mərhələ 5 (modul bölünməsi) da daxil edilsin?
4. **Cloud Functions**: yalnız Firestore rules ilə (buildless) qalaq, yoxsa admin custom claims / server məntiqi üçün Functions əlavə edək?

Planı təsdiq etdikdən sonra Mərhələ 1-dən başla.
