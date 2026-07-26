# AUDIT-TASK-2 — Hüquqi Mətn Boşluqları

**Tarix:** 2026-07-27
**Mənbə:** AUDIT-TASK-2 / 2.6
**Yoxlanan:** `js/legal.js` → `LEGAL.privacy`, `LEGAL.terms`, `LEGAL.about`, `LEGAL.security`, `LEGAL.changelog` (az / en / ru)
**Mətnin son yenilənmə tarixi (mətnin özündə):** 2026-07-19

> ⚠ **Bu sənəd hüquqi məsləhət deyil.** Mən hüquqşünas deyiləm. Aşağıdakı
> yoxlama GDPR və oxşar rejimlərin **ümumi** tələblərinə əsaslanır və məqsədi
> hüquqşünas baxışı üçün boşluqları SƏNƏDLƏŞDİRMƏKDİR.
>
> ⚠ **Mətnin özü QƏSDƏN dəyişdirilməmişdir** (AUDIT-TASK-2 §2.2 qadağası:
> "`LEGAL` mətnlərinin özünü yenidən yazma"). Bu task yalnız **kimlik datasını**
> düzəltdi. Aşağıdakı boşluqlar düzəldilmək üçün ayrıca qərar tələb edir.

---

## 1. Minimum tələblər cədvəli (12 sual)

| # | Sual | Var? | Yer / qeyd |
|---|---|---|---|
| 1 | Data controller kimdir — ad və ünvan? | ✅ | Privacy §1: `Tahmaz Muradov (Fərdi Sahibkar)` + `Naxçıvan, Azərbaycan`. **AUDIT-TASK-2 / 2.2-də düzəldildi** (əvvəl `[ŞİRKƏT ADI]` idi) |
| 2 | Data subject sorğuları üçün işlək əlaqə kanalı? | ✅ | Privacy §1 + §5: işlək email. Rəsmi domen ünvanı "aktivləşdikdən sonra" qeydi ilə elan olunur |
| 3 | Hansı data toplanır — sadalanıb? | ⚠️ **NATAMAM** | Privacy §2 hesab/profil/məzmun/aktivlik sadalayır, **lakin bax §2.1 — 4 kateqoriya açıqlanmamışdır** |
| 4 | Toplama məqsədi və **hüquqi əsas**? | ⚠️ | Privacy §3 **məqsədləri** verir (xidmət, təhlükəsizlik, statistika), lakin **hüquqi əsas** (müqavilə / razılıq / qanuni maraq) göstərilmir |
| 5 | Saxlama müddəti? | ⚠️ | Privacy §4 "hesab aktiv olduğu müddətdə" deyir — **konkret müddət yoxdur**; arxivləmə açıqlanmır (bax §2.2) |
| 6 | Üçüncü tərəflər sadalanıb? | ⚠️ **NATAMAM** | Yalnız `Cloudflare, Inc.` (prosessor) adlanır. **OAuth provayderləri (GitHub / Google / LinkedIn) və email göndərmə xidməti adlanmır** — halbuki kod onlara data ötürür |
| 7 | İstifadəçi hüquqları sadalanıb? | ⚠️ | Privacy §5: giriş, düzəliş, silinmə, ixrac, şikayət — **hamısı var**, lakin ixrac mətni kodun faktiki imkanından GERİ QALIR (bax §2.3) |
| 8 | Cookie / sessiya izahı? | ❌ **YANLIŞ** | Privacy §2 yalnız `localStorage` deyir. **Kod 4 HTTP cookie qoyur** (bax §2.4) — bu, MADDİ YANLIŞLIQDIR |
| 9 | Yaş həddi? | ✅ | Privacy §6 + Terms §2: "yalnız 18+", qeydiyyatda yoxlanılır (`routes.ts` `age < 18` qapısı ilə uyğun) |
| 10 | Son yenilənmə tarixi? | ⚠️ | `2026-07-19` — **bugünkü kimlik dəyişikliyindən sonra köhnədir**. Yeniləmə hüquqi baxış qərarıdır, ona görə toxunulmadı |
| 11 | Mübahisə həlli / yurisdiksiya (Terms)? | ✅ | Terms sonu: `Azərbaycan Respublikası qanunvericiliyi` |
| 12 | 3 dilin məzmunu uyğundur? | ⚠️ | Struktur eynidir, lakin **`ru` və `en` versiyaları `az`-dan qısadır**: `az` §5 hüquqları 4 bənd kimi sadalayır, `en`/`ru` isə bir paraqrafa sıxır. Öhdəliklər ziddiyyətli deyil, amma detal səviyyəsi fərqlidir |

**Yekun:** 12 sualdan **4-ü tam** ✅, **7-si natamam** ⚠️, **1-i yanlış** ❌.

---

## 2. Kod ↔ mətn ziddiyyətləri (maşınla doğrulanmış)

Bunlar rəy deyil — hər biri koda istinadla yoxlanılıb.

### 2.1 · ❌ Toplanan data natamam açıqlanır

Privacy §2 bu kateqoriyaları **sadalamır**, halbuki kod onları saxlayır:

| Toplanan | Kodda yer | Cədvəl/sütun |
|---|---|---|
| **IP ünvanı** | `worker/security.ts:23` `reqInfo()` | `sessions.ip`, `security_events.ip` |
| **Coğrafi mövqe** (ölkə/şəhər) | `worker/security.ts:25-26` (`request.cf`) | `sessions.city/country`, `security_events.city/country`, `users.last_country` |
| **User-Agent / cihaz** | `worker/security.ts:26` | `sessions.ua` (+ `parseUA()` ilə cihaz/OS/brauzer) |
| **Təhlükəsizlik telemetriyası** | `worker/security.ts:51` `logSecurityEvent()` | `security_events` (uğursuz giriş cəhdləri, cəhd edilən istifadəçi adı, rate-limit pozmaları, yüklənmə rəddi) |

**Niyə əhəmiyyətlidir:** IP və coğrafi mövqe GDPR-də şəxsi məlumat sayılır.
Bunların toplandığı açıqlanmalı, saxlama müddəti göstərilməlidir
(`security_events` cron ilə **90 gün** sonra silinir — `worker/archive.ts`
`pruneSecurityEvents`; bu fakt da mətndə yoxdur).

**Tövsiyə:** Privacy §2-yə "Texniki və təhlükəsizlik" kateqoriyası əlavə edilsin,
§4-də `security_events` üçün 90 günlük müddət açıqlansın.

---

### 2.2 · ⚠️ Mesaj arxivləməsi açıqlanmır

`worker/archive.ts` mesajları D1-dən R2-yə köçürür və **D1-dən silir**.
Privacy §4 bunu heç qeyd etmir.

**Hazırkı vəziyyət:** `ARCHIVE_HOT_DAYS = 3650` (AUDIT-TASK-1 / C-3 ilə
müvəqqəti dayandırıldı, çünki **oxu yolu qurulmayıb**) → praktikada indi heç bir
mesaj silinmir, yəni **istifadəçiyə görünən ziddiyyət YOXDUR**.

⚠ **LAKIN:** AUDIT-TASK-8 bitib dəyər `"90"`-a qaytarıldıqda 90 gündən köhnə
mesajlar D1-dən silinməyə başlayacaq. **Həmin andan əvvəl** Privacy §4-ə
arxivləmə və saxlama müddəti yazılmalıdır — əks halda mətn faktiki davranışla
ziddiyyətə düşəcək.

**Bu bənd AUDIT-TASK-8-ə bağlıdır.**

---

### 2.3 · ⚠️ Data ixracı mətni kodun imkanından geri qalır

| Mətn (Privacy §5) | Kodun faktiki vəziyyəti |
|---|---|
| az: "JSON formatında əldə etmək üçün **bizə müraciət edin**" | **Self-service mövcuddur:** `GET /api/me/export?format=json\|csv` (`worker/routes.ts` `exportMyData`) — istifadəçi düymə ilə özü endirir |
| en: "contact us for a JSON export" | eyni |
| ru: "экспорт данных (по запросу)" | eyni |

Yəni mətn istifadəçini lazımsız yerə əl ilə müraciətə yönləndirir, halbuki
avtomatik ixrac hazırdır. Bu, istifadəçi əleyhinə deyil, sadəcə **köhnəlmiş**dir.

**Əlavə problem (audit hüquqi risk #13):** ixracın özü natamamdır — arxivlənmiş
mesajlar, `contact_messages` və komanda datası (`team_members`, `team_tasks`,
`team_posts`, `team_files`) əhatə olunmur. Yəni mətn "bütün datanız" vəd etsə
ziddiyyət yaranar. **AUDIT-TASK-8-ə bağlıdır.**

---

### 2.4 · ❌ Cookie açıqlaması YANLIŞDIR

**Mətn (Privacy §2, hər 3 dildə):**
> "**Texniki:** sessiya üçün localStorage (tema, dil, giriş vəziyyəti).
> Reklam cookie-ləri istifadə olunmur."

**Kodun faktiki vəziyyəti — 4 HTTP cookie:**

| Cookie | Yer | Rolu | Atributlar |
|---|---|---|---|
| `cx_at` | `worker/auth.ts:22` | access token (JWT, 15 dəq) | HttpOnly, Secure, SameSite=Lax, Path=/ |
| `cx_rt` | `worker/auth.ts:23` | refresh token (30 gün, rotasiyalı) | HttpOnly, Secure, SameSite=Strict, Path=/api/auth |
| `cx_sess` | `worker/auth.ts:27` | köhnə sessiya (keçid dövrü) | HttpOnly, Secure, SameSite=Lax |
| `cx_oauth` | `worker/oauth.ts:121` | OAuth `state` (CSRF qoruması) | HttpOnly, Secure, SameSite=Lax, Path=/api/auth |

**Niyə bu ciddidir:** məxfilik siyasəti öz cookie istifadəsini **maddi olaraq
yanlış** təsvir edir. "Reklam cookie-ləri yoxdur" hissəsi **doğrudur** və
cookie-lərin hamısı **funksional/təhlükəsizlik** məqsədlidir (yəni əksər
rejimlərdə razılıq tələb etmir) — problem qadağan olunmuş izləmə deyil,
**natamam və yanlış açıqlamadır**.

Layihədə `js/cookies.js` və `collabix_cookie_consent` localStorage açarı ilə
cookie banner-i **var** — yəni məhsul cookie istifadəsini qəbul edir, mətn isə
inkar edir. Daxili ziddiyyət.

**Tövsiyə:** Privacy §2-yə yuxarıdaki cədvəl əlavə edilsin (ad, məqsəd, müddət).

---

### 2.5 · ⚠️ Changelog köhnəlmiş — tətbiq olunmuş funksiyalar "planlanır" kimi

`LEGAL.changelog` "Yol xəritəsi" bölməsi **hər 3 dildə** bunları hələ
tamamlanmamış (`- [ ]`) göstərir, halbuki kod onları daşıyır:

| Roadmap bəndi | Faktiki vəziyyət |
|---|---|
| `- [ ] İki faktorlu autentifikasiya (2FA)` | ✅ **TƏTBİQ OLUNUB** — TOTP + backup kodlar (`worker/totp.ts`, `user_mfa`/`mfa_backup_codes` cədvəlləri, `routes.ts`-də 8 istinad, `e2e/security-api.spec.ts`-də tam axın testi) |
| `- [ ] Email bildirişləri` | ⚠️ Qismən — `worker/email.ts` magic link + komanda dəvəti göndərir |

Canlı səhifədə mövcud funksiyanı "planlanır" kimi göstərmək istifadəçini
yanıldır və məhsulun özünü zəif təqdim edir.

**Tövsiyə:** roadmap real vəziyyətlə uzlaşdırılsın. Bu, hüquqi mətn deyil →
§2.2 qadağasına düşmür, lakin ayrıca commit tələb edir (bu task-da edilmədi,
çünki əhatə hüquqi kimlik datasıdır).

---

## 3. Prioritetləşdirilmiş tövsiyələr

| Prioritet | Boşluq | Səbəb |
|---|---|---|
| 🔴 **Yüksək** | §2.4 — cookie açıqlaması yanlışdır | Siyasət öz davranışını maddi olaraq yanlış təsvir edir; düzəltmək asandır (mətn əlavəsi) |
| 🔴 **Yüksək** | §2.1 — IP / geo / UA / telemetriya açıqlanmır | GDPR-də şəxsi məlumat; hazırda tamamilə gizlidir |
| 🟠 Orta | Q4 — hüquqi əsas göstərilmir | GDPR Art. 6 tələbi |
| 🟠 Orta | Q6 — OAuth provayderləri və email xidməti adlanmır | Data ötürülən üçüncü tərəflər açıqlanmalıdır |
| 🟠 Orta | §2.2 — arxivləmə açıqlanmır | **AUDIT-TASK-8-dən ƏVVƏL** həll olunmalıdır, yoxsa ziddiyyət yaranacaq |
| 🟡 Aşağı | §2.3 — ixrac mətni köhnəlmiş | İstifadəçi əleyhinə deyil, sadəcə dəqiq deyil |
| 🟡 Aşağı | §2.5 — changelog köhnəlmiş | Məhsul təqdimatı |
| 🟡 Aşağı | Q10 — tarix köhnə, Q12 — dil detalları fərqli | Formal |

---

## 4. Bu task-da NƏ EDİLDİ / NƏ EDİLMƏDİ

**Edildi (kimlik datası — 2.2):**
- Data controller adı, hüquqi forması, ünvanı, yurisdiksiyası
- İşlək əlaqə kanalı (+ gələcək rəsmi ünvanın elanı)
- Bütün dəyərlər `${SITE.*}` ilə tək mənbəyə bağlandı → bir dəyişiklik 3 dilə tətbiq olunur

**Edilmədi (qəsdən — §2.2 qadağası):**
- Privacy / Terms bəndlərinin mətni yenidən yazılmadı
- Yuxarıdaki 8 boşluğun heç biri mətn səviyyəsində düzəldilmədi

**Səbəb:** hüquqi mətn redaktəsi hüquqşünas baxışı tələb edir. Bu sənəd həmin
baxış üçün giriş materialıdır.
