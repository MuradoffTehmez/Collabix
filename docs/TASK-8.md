# Collabix — TASK-8: İrəli Səviyyə İnfrastruktur, Təhlükəsizlik və Miqyaslanma (Cloudflare)

Sən təcrübəli platform/security/edge mühəndisisən. Bu **çoxfazalı proqramdır** (auth, təhlükəsizlik monitorinqi, D1/performans, real-time, async, UX) — tək sprintdə deyil, **prioritetlə faza-faza** icra olunmalıdır. OAuth, 2FA və real-time-DO hər biri öz-özlüyündə böyükdür. Kod yazmadan əvvəl plan + faza sırası → təsdiq; hər fazadan sonra dayan, `tsc --noEmit` + `vite build` + `wrangler deploy --dry-run` + Playwright E2E (desktop+Pixel 7) + sıfır konsol xətası göstər.

## ⚙️ Stack və prinsiplər
- **Cloudflare Workers + D1 (SQLite/SQL, VIEW/TRIGGER/FTS5 dəstəkli) + R2 + KV + TypeScript + Vite + wrangler.** Custom PBKDF2 auth (hazırda 30-gün JWT). Real-time DO fazası hələ qurulmayıb.
- **Cloudflare-native primitivlərdən istifadə et:** `request.cf` (ölkə/şəhər/ASN/timezone) + `CF-Connecting-IP` (geo/IP), **Turnstile** (CAPTCHA), **Queues** (async), **D1 FTS5** (axtarış), **Durable Objects** (WS/stateful, DO alarms), **Cron Triggers** (planlı işlər), **R2** (soyuq arxiv/media), **KV** (qısaömürlü token/rate-limit).
- **Bütün sirlər `wrangler secret` ilə** (OAuth client secret, Turnstile secret, email API key, JWT signing key) — **heç vaxt koda/commit-ə yox**.
- Hər UI: **mobil + AZ/EN/RU + 3 tema + `prefers-reduced-motion`**; mövcud komponentləri təkrar-istifadə; schema dəyişikliyi **migration 0009+**.
- ⚠️ **Xarici hazırlıq (sən edəcəksən):** OAuth app-ları qeydiyyat (GitHub/Google/LinkedIn), email provayderi (MailChannels-ın Workers pulsuz təbəqəsi bağlanıb → Resend/SES/Postmark), Turnstile site/secret açarları. Prompt bunlar üçün konfiq yeri + təlimat versin.

---

# FAZA 1 — Təhlükəsizlik təməli (mövcud auth-ı sındırmadan sərtləşdir)

### Bənd 15 — Token refresh mexanizmi
30-gün JWT-ni əvəz et: **qısaömürlü access token (~15 dəq)** + **uzunömürlü rotated refresh token**. Refresh token `httpOnly + Secure + SameSite` cookie-də; hər istifadədə **rotate** (köhnəni ləğv); refresh token **hash-ları D1-də** cihaz-bağlı saxlanılsın (Bənd 3 ilə); ləğv/denylist KV-də. Access token yeniləmə endpoint-i.

### Bənd 3 — Sessiya və cihaz idarəetməsi
Profil parametrlərində **aktiv sessiyalar siyahısı:** cihaz/OS (User-Agent parse), brauzer, IP + lokasiya (`request.cf.city/country`), son fəallıq. Şübhəli sessiyanı **tək kliklə `destroySession`** (refresh token-i ləğv et). D1: `sessions(id, uid, ua, ip, city, country, created_at, last_seen, revoked)`. "Hamısını çıxart (bu istisna)".

### Bənd 7 — Zərərli bot qoruması (Turnstile)
Qeydiyyat (+ login/magic-link) endpoint-lərinə **Cloudflare Turnstile** (görünməz CAPTCHA): frontend widget + Worker-də server-side token verifikasiyası. Spam/avtomatlaşdırılmış hücumların qarşısı.

### Bənd 1 — Təhlükə Monitorinqi (Hot Threat Dashboard)
Anomaliyaları **D1 log cədvəllərinə** yaz: ardıcıl uğursuz girişlər (IP+username üzrə sayğac), şübhəli IP, fərqli coğrafi lokasiyadan qəfil giriş (`request.cf.country` dəyişməsi), rate-limit pozması. Admin paneldə **canlı "Threat Dashboard"**: son hadisələr, IP/geo xəritəsi, uğursuz-giriş trendi (sparkline), auto-blok/limit siqnalları. D1: `security_events(id, type, uid?, ip, country, meta, created_at)` + index. (Real-time təzələmə DO fazasına qədər qısa polling və ya SSE.)

### Bənd 14 — Server-side şəkil validasiyası/optimizasiyası
Yalnız client-side (`util.js` resizer) təhlükəlidir — istifadəçi keçib R2-yə birbaşa böyük fayl ata bilər. **Worker-də stream edilərkən ölçü/MIME/ölçülər yoxlaması** (≤ limit; magic-byte ilə tip); **Cloudflare Images** və ya Worker-daxili sıxılma; yalnız yoxlanılmış obyekt R2-yə. Bütün yükləmə yolları (avatar, post şəkli, mesaj əlavəsi) bu keçiddən getsin.

---

# FAZA 2 — Auth genişlənməsi (təməl üstünə)

### Bənd 5 — OAuth 2.0 (GitHub, Google, LinkedIn)
Tək kliklə qeydiyyat/giriş. Worker OAuth redirect + `state` (CSRF) + code→token exchange idarə etsin; profil məlumatını çək; mövcud username-based sistemə **hesab bağlama** (email/OAuth-id → uid mapping); eyni email varsa hesabı birləşdir. Proqramçı platforması üçün **GitHub** əsas. Client id/secret `wrangler secret`-də.

### Bənd 4 — Magic Links (parolsuz giriş)
Email-ə **qısaömürlü (~10 dəq), birdəfəlik** token (KV-də hash, tək istifadə) olan link → şifrəsiz giriş. Email provayderi (yuxarı). Rate-limit + Turnstile. Password reset də eyni mexanizmdən faydalanır.

### Bənd 2 — İki mərhələli təsdiq (2FA/MFA)
**TOTP** (Google Authenticator — Worker-də HMAC-based generate/verify, QR provisioning, backup codes) + **WebAuthn/Passkeys** (barmaq izi/FaceID — reg/auth ceremony, credential-ları D1-də saxla). Profil təhlükəsizlik tab-ında aktiv/deaktiv; girişdə ikinci addım. (WebAuthn üçün uyğun kitabxana və ya Cloudflare nümunəsi.)

---

# FAZA 3 — Onboarding UX

### Bənd 6 — Progressive Profiling + gamification
Qeydiyyatda yalnız **əsas** (ad, email/username, parol) → hesab yaransın. Bacarıq/dil/bio sonra, sistemi kəşf etdikcə. **Profil tamlığı %** + "100% üçün 20 XP qazan" kimi təşviq (mövcud XP/level sistemi ilə). Wizard-ı buna uyğun qısalt/böl; qalan sahələr üçün profil-daxili "tamamla" nudge-ləri.

---

# FAZA 4 — Data, axtarış və miqyaslanma (D1)

### Bənd 11 — Qlobal Full-Text Search (D1 FTS5)
`LIKE '%...%'` böyük cədvəldə performansı öldürür. **FTS5 virtual cədvəlləri** qur (post/rəy/mesaj/istifadəçi üzrə), `content=`/external-content + sync trigger-ləri ilə mənbə cədvəllərə bağla. Qlobal axtarış UI (header/command-palette ilə birləşir): postlar, istifadəçilər, rəylər üzrə sürətli mətn axtarışı, sıralama/snippet.

### Bənd 8 — Məlumat bütövlüyü və optimizasiya (precomputed)
Profil/statistikanı hər dəfə sıfırdan hesablama — **D1 VIEW-lar** (oxu-rahatlığı) və/və ya **aggregate cədvəllər + TRIGGER-lər** (yazıda artımlı yenilə: post/rəy/tapşırıq sayı, XP, fəallıq). Profil yüklənməsi kəskin sürətlənir. Ağır aqreqatlar üçün Cron Trigger ilə periodik refresh alternativi.

### Bənd 9 — GitHub-tipli fəaliyyət qrafiki (storage)
Mövcud heatmap-ı **effektiv storage** ilə dəstəklə: gündəlik fəaliyyət (post/rəy/tapşırıq həlli). **Normalized `user_activity(uid, date, count)` cədvəli** (index ilə) tövsiyə — sorğu/aqreqasiya üçün JSON blob-dan yaxşıdır; sadəlik üçün `activity_days` JSON alternativ. Profil heatmap-ı buradan oxusun.

### Bənd 10 — Data ixracı/portativliyi (GDPR)
İstifadəçi **bütün** fəaliyyət tarixçəsini, postlarını, mesajlarını strukturlu (**JSON** və ya təhlükəsiz-formatlanmış **CSV** — formula-injection qoruması) yükləsin + **hesab silmə** (tam cascade). Mövcud ixracı bu tam əhatəyə genişləndir; böyük data üçün Worker stream.

### Bənd 12 — D1 storage limiti → arxivləmə
D1 hər baza üçün limitlidir (cari limiti Cloudflare docs-dan yoxla). `room_messages`/DM/feed sürətlə böyüyür. **Arxivləmə strategiyası:** köhnə mesajları **Cron Trigger** ilə **R2-yə** (soyuq yaddaş, sıxılmış JSON/Parquet-vari) köçür, D1-də yalnız isti pəncərə qalsın; lazım olanda R2-dən oxu. Sərhəd/saxlama siyasətini konfiqurativ et.

---

# FAZA 5 — Real-time və async (DO fazası ilə)

### Bənd 13 — Mesaj göndərmə axını (birbaşa WS→DO)
Cari zəncir (Browser→REST→Worker→D1→RPC→DO→WS) gecikmə yaradır. **Ən yaxşı praktika:** mesaj birbaşa **WebSocket üzərindən DO-ya** → DO dərhal digərlərinə **broadcast** → arxada **asinxron D1-ə yaz** (Queue və ya DO `waitUntil`). Bu, Bənd 18 və pending Room-DO fazasının bir hissəsidir. (idempotency + sıralama + çatdırılma təsdiqi nəzərə al.)

### Bənd 18 — Asinxron emal (Cloudflare Queues)
Post paylaşımında ağır işi arxaya at: R2 şəkil yükləmə/optimizasiya, abunəçilərə bildiriş fan-out, FTS index yeniləmə. **Cloudflare Queues** producer (Worker) + consumer (Worker). UI dərhal cavab verir (optimistic), ağır iş fonda.

---

# FAZA 6 — Redaktor və admin UX

### Bənd 16 — Zəngin mətn redaktoru (markdown + live preview)
"Kod paylaşımı"/post composer-də sadə textarea əvəzinə **markdown redaktoru + canlı önbaxış** (yan-yana və ya toggle) + toolbar (qalın/kursiv/link/kod/siyahı). Mövcud `marked`+DOMPurify-ı preview üçün təkrar-istifadə; kod blokları highlight ilə. Buildless-uyğun (yüngül lib və ya custom textarea+preview), block-composer içində.

### Bənd 17 — Admin Undo (geri al)
Destruktiv admin əməliyyatlarından (blok, şikayət silmə) sonra **5-10 saniyəlik "Geri al" toast**: ya mutasiyanı pəncərə boyu **təxirə sal**, ya da dərhal icra + inverse endpoint-i toast-dan çağır (audit log blok/blokdan-çıxarmanı ayrı yazır — TASK-6). İnzibatçının səhvlərini xilas edir.

---

## 🗂️ D1 migration / schema (0009+) — əsas yeni obyektlər
```
sessions(id, uid, ua, ip, city, country, created_at, last_seen, revoked)        -- Bənd 3,15
security_events(id, type, uid?, ip, country, meta, created_at) + index          -- Bənd 1
oauth_accounts(provider, provider_id, uid) / user_mfa(uid, totp_secret, ...)     -- Bənd 5,2
webauthn_credentials(uid, credential_id, public_key, counter, ...)              -- Bənd 2
posts_fts / comments_fts / users_fts (FTS5 virtual + sync triggers)             -- Bənd 11
user_stats (aggregate) + triggers  /  user_activity(uid, date, count)           -- Bənd 8,9
archive metadata (R2 keys, ranges)                                              -- Bənd 12
```
- Secrets: `wrangler secret put` (OAUTH_*_SECRET, TURNSTILE_SECRET, EMAIL_API_KEY, JWT_SECRET). Bindings: Queues, DO, R2, KV, Cron Triggers `wrangler.jsonc`-də.

---

## ✅ Definition of Done (18 bənd)
**Təhlükəsizlik:** [ ] rotated refresh + qısa access [ ] sessiya/cihaz siyahısı + destroySession [ ] Turnstile [ ] Threat Dashboard (D1 log + canlı panel) [ ] server-side şəkil validasiya.
**Auth:** [ ] OAuth (GitHub/Google/LinkedIn) [ ] magic link [ ] 2FA (TOTP + WebAuthn).
**UX:** [ ] progressive profiling + XP nudge [ ] rich markdown editor + live preview [ ] admin Undo toast.
**Data/miqyas:** [ ] FTS5 axtarış [ ] precomputed stats (VIEW/TRIGGER) [ ] activity storage + heatmap [ ] GDPR export+delete [ ] D1→R2 arxivləmə (Cron).
**Real-time/async:** [ ] WS→DO→async-D1 mesaj axını [ ] Queues async fan-out.
**Ümumi:** [ ] sirlər `wrangler secret`-də, koda yox [ ] mobil+AZ/EN/RU+3 tema+reduced-motion [ ] tsc+build+dry-run+E2E ✅, sıfır konsol xətası [ ] deploy qırılmayıb.

---

## ❓ Başlamazdan əvvəl təsdiq al
1. **Faza sırası:** Təhlükəsizlik təməli (1) → Auth genişlənməsi (2) → Data/axtarış (4) → real-time/async (5) → onboarding+UX (3,6) — bu prioritet uyğundur? (Yoxsa hansı əvvəl?)
2. **Xarici setup:** OAuth app qeydiyyatı, email provayderi, Turnstile açarları — bunları sən indi hazırlayırsan, yoxsa konfiq/placeholder qoyum və sonra dolduracaqsan?
3. **2FA əhatəsi:** həm TOTP həm WebAuthn indi, yoxsa əvvəl TOTP (sadə), WebAuthn sonra?
4. **Arxivləmə (12):** isti-pəncərə həddini (məs. son 90 gün D1-də, qalan R2-də) sən təyin edirsən, yoxsa default qoyum?
5. **Mesaj axını (13):** bu, real-time DO fazasının içində birlikdə edilsin — təsdiq? (Yəni DO fazası bura daxildir.)
6. **Email provayderi:** hansını istifadə edək (Resend/SES/Postmark/başqa)?

Təsdiqdən sonra FAZA 1 (Bənd 15 token refresh) ilə başla.