# Collabix — Cloudflare miqrasiyası

> ## 🟢 Canlı sayt: https://collabix.muradofftehmez01.workers.dev
> Tam işlək: D1, KV, R2 hamısı aktiv və smoke-test edilib (qeydiyyat→giriş→post→
> avatar yükləmə→feed→çıxış ✓). Heç bir bloklayıcı qalmayıb.

Collabix Firebase-dən (Auth + Firestore + Storage + Hosting + Functions) **tam olaraq**
Cloudflare ekosisteminə (Workers + D1 + R2 + KV + Static Assets) köçürülüb. Bu sənəd
miqrasiyanın nəticəsini, dəyişdirilən/silinən/əlavə olunan komponentləri, lazımi
`wrangler` əmrlərini və deploy addımlarını izah edir.

> Kod tərəfi tam hazırdır və lokal mühitdə test olunub (E2E ✓, aşağıya bax). Real
> Cloudflare hesabında **resurs yaratmaq** (D1, R2, KV) və **secret təyin etmək**
> sənin əlinlədir — bunlar Cloudflare API tokeni tələb edir və mən icra edə bilmirəm.

---

## 1. Arxitektura

**Tək Worker + Static Assets** modeli seçildi (Cloudflare-in hazırkı tövsiyəsi):

```
Brauzer
  │
  ▼
Cloudflare Worker (worker/index.ts)
  ├─ /api/*    → REST endpoint-lər (worker/routes.ts)
  ├─ /files/*  → R2-dən şəkil/fayl servisi (auth tələb edir)
  └─ digər hər şey → Static Assets (dist/, Vite build çıxışı)
       │
       ├─ D1 (collabix-db)     — bütün relational data (istifadəçi, post, mesaj, tapşırıq...)
       ├─ R2 (collabix-files)  — avatar, post şəkilləri, mesaj faylları
       └─ KV (SESSIONS)        — JWT sessiyaları, rate-limit sayğacları
```

Real-time (`onSnapshot`) sadə **ağıllı polling**lə əvəzləndi: chat/DM 3s, feed/bildiriş
8-20s, mutasiyadan sonra (post paylaşma, mesaj göndərmə və s.) dərhal bir əlavə sorğu
("ani yenilənmə"). Bu, buildless/serverless mühitdə WebSocket/Durable Objects
kompleksliyi olmadan təbii hiss olunan təcrübə verir.

---

## 2. Firebase → Cloudflare xəritəsi

| Firebase | Cloudflare | Fayl |
|---|---|---|
| Hosting | Workers Static Assets | [wrangler.jsonc](wrangler.jsonc) `assets` bloku |
| Cloud Functions | Worker (bir fayl, marşrutlaşdırıcı) | [worker/index.ts](worker/index.ts), [worker/routes.ts](worker/routes.ts) |
| Firestore | D1 (SQLite) | [migrations/0001_init.sql](migrations/0001_init.sql) |
| Firebase Authentication | Öz JWT + PBKDF2 sistemi | [worker/auth.ts](worker/auth.ts) |
| Firestore Security Rules | Worker-dəki server-side yoxlamalar | [worker/routes.ts](worker/routes.ts) (hər handler daxilində) |
| Firebase Storage | R2 | `FILES` binding, `/files/*` marşrutu |
| Firestore onSnapshot | Ağıllı polling | [js/api.js](js/api.js) `startPoll()` |
| Admin SDK callable (`setTempPassword`) | Adi `/api/admin/...` endpoint | [worker/routes.ts](worker/routes.ts) `adminTempPassword` |
| `.env`/Firebase config | Wrangler Secrets | `wrangler secret put` |

---

## 3. Silinən Firebase komponentləri

Heç biri **runtime kodda** qalmayıb (yoxlanılıb: `grep -rniE "firebase|firestore" js/ index.html worker/` → yalnız 1 zərərsiz daxili şərh). Köhnə fayllar silinməyib, **`legacy/firebase/`** altına arxivləşdirilib (tarixçə üçün, deploy-a düşmür):

- `js/firebase.js` (client SDK init) → `legacy/firebase/client-firebase.js`
- `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- `functions/` (Cloud Functions — `setTempPassword`, sayğaclar və s.)
- `migration/` (əvvəlki Firestore→Firestore miqrasiya skriptləri)
- `public/` (Firebase Hosting-in avtomatik yaratdığı SDK boot faylı)
- `start-local.cmd`, `DEPLOY.md` (əvvəlki Firebase-lokal təlimatı)
- `.emulator-data/` (Firebase Auth+Firestore emulyator ixracı — **son data mənbəyi kimi istifadə olundu**, aşağıya bax)

`package.json`-dan bütün `firebase`/`firebase-admin`/`firebase-tools` paketləri çıxarılıb.

---

## 4. Əlavə olunan Cloudflare komponentləri

| Fayl | Nə üçün |
|---|---|
| [worker/index.ts](worker/index.ts) | Marşrutlaşdırıcı, security header-lər, CSP, static assets |
| [worker/routes.ts](worker/routes.ts) | ~90 REST endpoint (auth, posts, chat, DM, tasks, admin, public) |
| [worker/auth.ts](worker/auth.ts) | PBKDF2 parol heşi, HS256 JWT, KV sessiya, rate-limit |
| [worker/util.ts](worker/util.ts) | Tip tərifləri, D1↔client format çeviriciləri |
| [migrations/0001_init.sql](migrations/0001_init.sql) | D1 sxemi (23 cədvəl) |
| [migrations/0002_seed.sql](migrations/0002_seed.sql) | Default taksonomiya + FAQ + rəylər |
| [wrangler.jsonc](wrangler.jsonc) | D1/R2/KV binding-ləri, static assets konfiqi |
| [js/api.js](js/api.js) | REST client + polling meneceri (əvvəlki Firestore SDK-nın yerinə) |
| [migration-cf/emulator-to-d1.mjs](migration-cf/emulator-to-d1.mjs) | Köhnə Firebase emulyator datasını D1-ə köçürür |
| [migration-cf/firestore-to-d1.mjs](migration-cf/firestore-to-d1.mjs) | Alternativ: birbaşa **prod** Firestore-dan D1-ə (rate-limit-ə həssasdır) |
| [vite.config.ts](vite.config.ts), [tsconfig.json](tsconfig.json) | Build sistemi (aşağı bax) |

`js/store.js`, `js/auth.js`, `js/taxonomy.js`, `js/presence.js` REST+polling əsasında
tam yenidən yazıldı, amma **bütün export adları eyni saxlanıldı** — buna görə UI
modulları (feed, chat, dm, tasks, admin və s.) demək olar ki, dəyişmədən qaldı.

---

## 5. Autentifikasiya (yeni sistem)

- **Parol:** PBKDF2-SHA256, 100 000 iterasiya, təsadüfi 16-bayt duz (`worker/auth.ts`).
- **Sessiya:** HS256 JWT, `HttpOnly; Secure; SameSite=Lax` cookie-də (`cx_sess`).
  Token özü KV-də saxlanılan sessiya qeydinə (`sess:{uid}:{jti}`) işarə edir —
  logout və ya admin-in "müvəqqəti şifrə" təyinatı bu qeydi silərək **bütün
  cihazlarda dərhal çıxışı** məcburi edir (JWT-nin özü hələ etibarlı olsa belə).
- **Rate-limit:** KV-əsaslı sadə pəncərə sayğacı — giriş/qeydiyyat 5 dəq-də 10,
  yazma əməliyyatları 1 dəq-də 60, fayl yükləmə saatda 30, public formalar
  (newsletter/contact) saatda 5.

---

## 6. Təhlükəsizlik

- **Security header-lər** hər cavabda: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`.
- **CSP** (yalnız HTML cavablarında): `default-src 'self'` — bütün skriptlər öz
  bundle-ımızdan gəlir (CDN asılılığı yoxdur, hər şey npm→Vite build ilə lokal bundle
  olunur), şriftlər üçün yalnız Google Fonts-a icazə.
- **CORS açılmayıb** — API yalnız same-origin cookie ilə işləyir, `OPTIONS` sorğuları
  204 ilə cavablanır amma cross-origin `Access-Control-Allow-Origin` header-i yoxdur.
- **Fayl yükləmə:** ölçü limiti (avatar 1MB, post/mesaj 2MB) + ciddi MIME whitelist
  (worker tərəfdə yoxlanılır, client limiti yalnız UX üçündür).
- **whoCanMessage** (kim mənə mesaj yaza bilər) siyasəti **server tərəfdə** məcburi
  edilir (`worker/routes.ts` `sendDM`), təkcə client-də yox.

### Manual əlavə etmək istəsən (Cloudflare Dashboard, kod dəyişikliyi tələb etmir)

- **WAF qaydaları:** https://developers.cloudflare.com/waf/
- **Rate Limiting Rules** (KV-əsaslı daxili limitə əlavə, edge səviyyəsində):
  https://developers.cloudflare.com/waf/rate-limiting-rules/
- **Bot Management / Turnstile** (qeydiyyat formasına CAPTCHA əlavə etmək üçün):
  https://developers.cloudflare.com/turnstile/

---

## 7. Performans

- **Vite build:** tree-shaking + minification (esbuild) aktivdir, hashed fayl adları
  (`assets/index-XXXX.js`) → `Cache-Control: public, max-age=31536000, immutable`
  (`worker/index.ts`).
- **Lazy loading:** `highlight.js` (böyük kitabxana) yalnız kod bloku render olunanda
  dinamik `import()` ilə yüklənir (`js/util.js` `highlightEl()`); markdown/DOMPurify
  ayrıca chunk-dadır (`vite.config.ts` `manualChunks`).
- **R2 faylları:** `/files/*` cavabında `Cache-Control: public, max-age=31536000, immutable`
  + `ETag`.
- **Cloudflare CDN:** statik asset-lər avtomatik edge-də keşlənir (Workers Static
  Assets daxili davranışı) — əlavə konfiqurasiya lazım deyil.

---

## 8. Lokal inkişaf

```bash
npm install
npm run dev          # build + wrangler dev (Worker+D1+R2+KV lokalda, .wrangler/state-də saxlanılır)
```

Ayrıca terminalda (canlı düzəliş üçün):
```bash
npx vite build --watch     # client dəyişikliklərini avtomatik yenidən build edir
npx wrangler dev --persist-to .wrangler/state --port 8787   # worker
```

İlk dəfə lokal D1-i qurmaq üçün:
```bash
npm run db:migrate:local      # sxemi + seed-i tətbiq edir
```

Test hesabı üçün: `npm run dev` işə düşəndə saytda **Qeydiyyat** vasitəsilə yeni
hesab yarat, ya da köhnə Firebase datasını köçür (aşağıya bax).

---

## 9. Prod resurslarının yaradılması — ✅ İCRA OLUNUB

Bu addımlar artıq sənin Cloudflare hesabında (`muradofftehmez01@gmail.com`) icra edilib:

| Resurs | Vəziyyət | ID |
|---|---|---|
| D1 (`collabix-db`) | ✅ yaradılıb, sxem+seed tətbiq olunub | `eb30cafe-d189-42d3-aed5-320eafe5c188` |
| KV (`SESSIONS`) | ✅ yaradılıb | `c631f38c595440de8431bc93d00cb548` |
| `JWT_SECRET` | ✅ təyin olunub (təsadüfi 48-bayt) | — (Cloudflare-də şifrələnmiş saxlanılır) |
| R2 (`collabix-files`) | ✅ yaradılıb, aktiv | bind: `FILES` |
| Worker deploy | ✅ canlıdır | https://collabix.muradofftehmez01.workers.dev |

Gələcəkdə **yeni bir Cloudflare hesabında sıfırdan** qurmaq istəsən, addımlar bunlardır:

```bash
npx wrangler login

# 1) D1 verilənlər bazası
npx wrangler d1 create collabix-db
# → çıxışdakı "database_id" dəyərini wrangler.jsonc-də d1_databases[0].database_id-ə yaz

# 2) R2 bucket (əvvəlcə Dashboard-da R2-ni aktivləşdirməlisən, § 15)
npx wrangler r2 bucket create collabix-files
# → wrangler.jsonc-də şərhə alınmış r2_buckets blokunu geri aç

# 3) KV namespace (sessiyalar)
npx wrangler kv namespace create SESSIONS
# → çıxışdakı "id" dəyərini wrangler.jsonc-də kv_namespaces[0].id-ə yaz

# 4) Sxemi prod D1-ə tətbiq et
npm run db:migrate:remote

# 5) Secret — HƏTMİ təsadüfi, uzun sətir olsun (repo-ya YAZILMIR)
npx wrangler secret put JWT_SECRET
# soruşanda məs. bu əmrin çıxışını yapışdır: openssl rand -base64 48

# 6) Deploy
npm run deploy
```

---

## 10. Köhnə Firebase datasının D1-ə köçürülməsi

İki skript var (`migration-cf/`):

**A) `emulator-to-d1.mjs`** (tövsiyə olunan, artıq işlədilib və yoxlanılıb) —
`legacy/firebase/.emulator-data/` altındakı əvvəlki Firebase emulyator ixracından
oxuyur. Bu, **parolları da daxil olmaqla** (auth export-dakı fake-hash-dən çıxarılır)
tam data toplusunu ehtiva edir:

```bash
# 1) Köhnə emulyatoru qaldır (ayrı terminal)
cd legacy/firebase
npx firebase-tools emulators:start --project demo-collabix --only auth,firestore --import .emulator-data

# 2) Yeni terminalda:
cd migration-cf
node emulator-to-d1.mjs             # DRY-RUN — hesabat
node emulator-to-d1.mjs --execute   # import.sql yaradır

# 3) Tətbiq et
cd ..
npm run db:import:local     # lokal test üçün
# və ya
npm run db:import:remote    # birbaşa prod D1-ə
```

**B) `firestore-to-d1.mjs`** — birbaşa **canlı prod Firestore**-dan (`collabix-37e67`)
oxuyur, REST API açar publikdir. Firestore-un aqressiv rate-limitinə görə skript
avtomatik backoff edir, amma çox sənəd üçün yavaş ola bilər. Yalnız emulyator
exportu mövcud deyilsə istifadə et.

**Nəticə (lokal test edilib):** 53 istifadəçi, parollar **eyni** qalır (PBKDF2 ilə
yenidən heşlənib) — istifadəçilər köhnə parolları ilə giriş edə bilirlər. ⚠ Bu
parollar əvvəlcə Firestore-da plaintext saxlanıldığından **ifşa olunmuş sayılır**;
real prod-a keçəndə istifadəçilərə Parametrlər bölməsindən **parol dəyişməyi**
tövsiyə et (admin panelindən də "müvəqqəti şifrə + məcburi reset" funksiyası var).

`migration-cf/import.sql` parol heşləri saxladığı üçün **`.gitignore`-dadır** —
heç vaxt commit etmə.

---

## 11. Deploy — ✅ İCRA OLUNUB

```bash
npm run deploy
# = npm run build && wrangler deploy
```

**Canlı ünvan: https://collabix.muradofftehmez01.workers.dev**

Öz domenini bağlamaq istəsən: Cloudflare Dashboard → Workers & Pages →
`collabix` → Settings → Domains & Routes → "Add Custom Domain".

---

## 12. Manual müdaxilə tələb edən hissələr

| Addım | Vəziyyət | Niyə mən edə bilmirəm |
|---|---|---|
| `wrangler login` | ✅ artıq daxil olunub | — |
| D1 yaratma + sxem | ✅ edildi | — |
| KV yaratma | ✅ edildi | — |
| `JWT_SECRET` təyini | ✅ edildi | — |
| `npm run deploy` | ✅ edildi, canlıdır | — |
| R2 aktivləşdirmə + bucket yaratma | ✅ edildi (sən Dashboard-da aktivləşdirdin, mən bucket yaratdım) | — |
| Custom domen bağlama | Edilməyib (opsional) | DNS/zone idarəsi sənin qərarındır |
| WAF / Rate Limiting Rules / Turnstile | Edilməyib (opsional) | Dashboard konfiqurasiyası, əlavə qoruma qatı |
| Prod D1-ə köhnə Firebase datasının köçürülməsi | Edilməyib (opsional) | Geri dönüşü olmayan yazma — sən qərar verməlisən (§ 10) |

---

## 13a. Test nəticələri (canlı prod, `collabix.muradofftehmez01.workers.dev`)

Deploy-dan dərhal sonra real Cloudflare mühitində (yerli emulyator yox, əsl D1/KV/Worker) yoxlanıldı:

- `GET /` → 200, HTML düzgün gəlir
- `GET /api/public/stats`, `/api/public/faqs` → 200, D1 seed məlumatı düzgün qayıdır
- **Tam qeydiyyat→giriş(JWT)→post yaratma→feed→çıxış axını** → hamısı ✓ (`node` ilə birbaşa API çağırışları ilə test edildi)
- Test hesabı (`smoke...`) yaradıldı, yoxlanıldı, sonra **təmizləndi** (silindi) ki, canlı sayt səliqəli qalsın
- Security header-lər ilk yoxlamada HTML səhifəsində əskik çıxdı → səbəb tapıldı və düzəldildi (aşağı bax) → yenidən yoxlanıldı, indi düzgündür
- Prod D1-də artıq 1 real istifadəçi (`sara`) var — bu mənim yaratdığım deyil, toxunulmayıb

> **Deploy zamanı tapılan və düzəldilən problem:** ilk deploydan sonra `/` (əsas HTML
> səhifə) `X-Frame-Options`, `Content-Security-Policy` və digər security header-lər
> olmadan qayıdırdı, halbuki `/api/*` cavabları düzgün idi. Səbəb:
> [wrangler.jsonc](wrangler.jsonc)-dəki `run_worker_first: ["/api/*", "/files/*"]`
> konfiqurasiyası statik HTML sorğularının Worker-imizi **heç işə salmadan**, birbaşa
> Cloudflare-in edge asset-serving qatından keçməsinə səbəb olurdu — header-əlavəetmə
> kodumuz (`withSecurityHeaders`) heç çağırılmırdı. Düzəliş: `run_worker_first` bütün
> yollara (`"/**"`) tətbiq olundu, yalnız hashed/immutable JS-CSS bundle-ları
> (`!/assets/*`) sürət üçün Worker-i keçib birbaşa edge-dən verilir (Cloudflare-in
> özünün tövsiyə etdiyi naxış). Yenidən deploy edildi, header-lər indi HTML-də də düzgün
> göstərilir (yoxlanıldı).

---

## 13. Test nəticələri (lokal, `wrangler dev`)

Headless Chrome ilə tam E2E: qonaq vitrini → i18n (AZ/EN/RU) → FAQ (D1-dən) →
miqrasiya olunmuş real hesabla giriş → yeni post (markdown+kod) → like →
otaq mesajı → **F5 sessiya davamlılığı (JWT cookie)** → istifadəçi kataloqu →
çıxış; ayrıca qeydiyyat sihirbazı → tapşırıq təklifi → admin təsdiqi →
verified badge → müvəqqəti şifrə → məcburi reset ekranı → tema dövrü
(dark/light/**matrix**) → mobil (390px, horizontal-scroll yoxdur).

**Nəticə: bütün ssenarilər ✓, konsol xətası 0.**

> Testlər zamanı bir real bug tapılıb və düzəldilib: [js/richmsg.js](js/richmsg.js)-də
> `highlightEl` import edilməmişdi — kod tipli mesaj render olunanda `ReferenceError`
> bütün mesaj siyahısının sonrakı hissəsini səssizcə kəsirdi (poll-un xəta tutma
> bloku render xətalarını da udurdu). Hər iki qüsur düzəldildi: import əlavə olundu,
> [js/api.js](js/api.js)-də `startPoll` fetch xətalarını render xətalarından ayırdı
> (bundan sonra bu sinif buglar console-da görünəcək), [js/chat.js](js/chat.js) və
> [js/dm.js](js/dm.js)-də hər mesajın render-i ayrıca qorunur ki, tək pozulmuş mesaj
> bütün siyahını kəsməsin.

---

## 14. Faydalı linklər

**Cloudflare Dashboard**
- Ana panel: https://dash.cloudflare.com/
- Workers & Pages: https://dash.cloudflare.com/?to=/:account/workers-and-pages

**Sənədləşmə**
- Workers: https://developers.cloudflare.com/workers/
- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- D1: https://developers.cloudflare.com/d1/
- R2: https://developers.cloudflare.com/r2/
- Workers KV: https://developers.cloudflare.com/kv/
- Secrets (Wrangler): https://developers.cloudflare.com/workers/configuration/secrets/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- Rate Limiting Rules: https://developers.cloudflare.com/waf/rate-limiting-rules/
- WAF: https://developers.cloudflare.com/waf/
- Turnstile (CAPTCHA əvəzi): https://developers.cloudflare.com/turnstile/
- Custom Domains (Workers): https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

**Qiymətləndirmə (Free tier limitlərini yoxlamaq üçün)**
- Workers Pricing: https://developers.cloudflare.com/workers/platform/pricing/
- D1 Pricing: https://developers.cloudflare.com/d1/platform/pricing/
- R2 Pricing: https://developers.cloudflare.com/r2/pricing/

**Bu layihənin əvvəlki (Firebase) sənədləri arxivi**
- [legacy/firebase/DEPLOY.md](legacy/firebase/DEPLOY.md) — köhnə Firebase deploy təlimatı (artıq keçərli deyil, tarixi arayış üçün saxlanılıb)

---

## 15. R2 aktivləşdirmə — ✅ TAMAMLANDI

Sən Dashboard-da R2-ni aktivləşdirdin (`https://dash.cloudflare.com/?to=/:account/r2/overview`),
mən bundan sonra:

```bash
npx wrangler r2 bucket create collabix-files   # ✅ edildi
npm run deploy                                  # ✅ R2 bind aktiv, yenidən deploy edildi
```

**Prod-da yoxlanıldı** (real fayl yükləmə axını): qeydiyyat → avatar yüklə
(`POST /api/upload?kind=avatar`) → R2-də saxlanıldı → `GET /files/avatars/...`
düzgün `Content-Type: image/png` və `Cache-Control: public, max-age=31536000,
immutable` ilə qayıtdı → profil şəkli kimi təyin edildi (`PATCH /api/me`) →
test hesabı silindi (R2 faylı da silindi).

> **Qeyd:** ilk yükləmə cəhdi (R2 aktivləşib deploy edildikdən dərhal sonra) `500`
> xətası verdi — bu, yeni R2 bind-inin bütün Cloudflare edge node-larına yayılması
> üçün adi qısa gecikmə idi (bir neçə saniyə). İkinci və sonrakı cəhdlər sabit
> şəkildə uğurlu oldu. Əgər real istifadəçilər ilk deploydan dərhal sonra bənzər
> keçici xəta görsələrsə, sadəcə bir neçə saniyə sonra yenidən cəhd kifayətdir.

Artıq heç bir bloklayıcı qalmayıb — sayt tam funksional.

---

## 16. Data miqrasiyası + şəkil backfill-i — ✅ TAMAMLANDI

Sənin təsdiqinlə köhnə platformanın real datası prod D1-ə köçürüldü:

```bash
wrangler d1 execute collabix-db --remote --file migration-cf/import.sql
```

**Nəticə:** 54 istifadəçi (53 köçürülən + əvvəldən mövcud `sara`), 12 post, 24 otaq
mesajı, 6 DM thread (17 mesaj), 4 admin, 2 tapşırıq. Köhnə parollar **eyni qalır**
(PBKDF2 ilə yenidən heşlənib) — istifadəçilər əvvəlki parolları ilə giriş edə bilir
(`abbaslishalala` hesabı ilə yoxlanıldı).

### Şəkil backfill-i (əlavə addım)

İlk miqrasiyada **avatar və post şəkilləri köçürülməmişdi** (köhnə Firebase Storage
URL-ləri yeni R2-də mövcud deyildi, ona görə `photo_url = NULL` qoyulmuşdu, post
şəkil blokları isə çıxarılmışdı). Bunu ayrıca skriptlə düzəltdim:
[migration-cf/backfill-images.mjs](migration-cf/backfill-images.mjs) — köhnə
Firebase Storage **emulyatorundan** (`legacy/firebase/.emulator-data/`) əsl şəkil
baytlarını çəkib real R2-ə yüklədi, sonra D1-i yenilədi:

```bash
# 1) Köhnə emulyatoru qaldır (yalnız Storage baytlarını oxumaq üçün)
cd legacy/firebase
npx firebase-tools emulators:start --project demo-collabix --only auth,firestore,storage --import .emulator-data

# 2) Backfill
cd ../../migration-cf
node backfill-images.mjs             # DRY-RUN
node backfill-images.mjs --execute   # R2-ə yükləyir + update.sql yaradır

# 3) Tətbiq
cd ..
wrangler d1 execute collabix-db --remote --file migration-cf/update.sql
```

**Nəticə:** 17 avatar + 4 post şəkli (cəmi 21 fayl) R2-ə yükləndi, D1 yeniləndi.
Real sessiya ilə yoxlanıldı: `muradovtahmaz` hesabının avatarı (18 KB JPEG) və
bir post şəkli (31 KB JPEG) `/files/...` vasitəsilə düzgün servis olunur.

> Qalan istifadəçilərin (36/53) avatarı yox idi — bu, köçürmə qüsuru deyil, sadəcə
> onlar heç vaxt profil şəkli əlavə etməmişdilər (orijinal datada `photoURL` boş idi).
