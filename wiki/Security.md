# 🔐 Təhlükəsizlik Arxitekturası

> Collabix-in çoxqatlı təhlükəsizlik sistemi — Zero Trust modeli, kriptoqrafiya, rate limiting və hücumdan qorunma.

---

## 🛡️ Təhlükəsizlik Fəlsəfəsi

Collabix **Zero Trust** (Sıfır Güvən) modeli üzərində qurulub: heç bir əməliyyat Client (müştəri) tərəfindən göndərilən məlumatlara güvənmir. Bütün validasiyalar, icazə yoxlamaları və məlumat manipulyasiyaları **server tərəfində** (Worker) aparılır.

```
┌──────────────────────────────────────────────────────────────┐
│                    TƏHLÜKƏSİZLİK QATLARİ                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Layer 1: Cloudflare WAF + DDoS Protection             │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  Layer 2: Turnstile (Bot Qoruması / CAPTCHA)           │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  Layer 3: Rate Limiting (Durable Object əsaslı)        │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  Layer 4: JWT Authentication + Session Validation       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  Layer 5: RBAC (Rol Əsaslı İcazə Yoxlaması)           │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  Layer 6: Input Validation + Sanitization               │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  Layer 7: Security Headers (CSP, HSTS, X-Frame)         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔑 Autentifikasiya Sistemi

### Parol Şifrələməsi (PBKDF2)

| Parametr | Dəyər |
|----------|-------|
| **Alqoritm** | PBKDF2-SHA256 |
| **İterasiya** | 100,000+ dəfə |
| **Duz (Salt)** | 16 bayt kriptografik təsadüfi |
| **API** | WebCrypto (W3C standartı) |

```typescript
// worker/auth.ts — Parol hash prosesi
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
const hash = await crypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
  key, 256
);
```

### Sessiya İdarəetməsi (JWT)

| Parametr | Dəyər |
|----------|-------|
| **Token Formatı** | JSON Web Token (JWT) |
| **İmzalama** | HS256 (HMAC-SHA256) |
| **Saxlama** | KV (Cloudflare KV Namespace) |
| **İkili Yoxlama** | JWT imzası + KV-də mövcudluq |

```
Giriş Axını:
  İstifadəçi credentials ──→ Worker (auth.ts)
       │
       ├── PBKDF2 ilə parol yoxlanılır
       ├── JWT token yaradılır (HS256)
       ├── Token KV-yə yazılır (sessiya qeydiyyatı)
       └── Token brauzere qaytarılır (HttpOnly cookie)
```

### Giriş Metodları

| Metod | Təsvir | Status |
|-------|--------|--------|
| **Username/Password** | Standart autentifikasiya | ✅ Aktiv |
| **Magic Link** | Email ilə linksiz giriş | ✅ Aktiv |
| **OAuth 2.0** | Google, GitHub, LinkedIn | ✅ Aktiv |
| **2FA/TOTP** | Authenticator app (Google Auth, Authy) | ✅ Aktiv |

### İki Mərhələli Təsdiq (2FA/TOTP)

```
Quraşdırma:
  1. İstifadəçi 2FA-nı aktivləşdirir
  2. Server TOTP gizli açar yaradır
  3. QR kod göstərilir (qrcode-generator)
  4. İstifadəçi Authenticator app ilə skan edir
  5. 6 rəqəmli kod daxil edir → server təsdiq edir

Giriş:
  Username + Password ──→ JWT (qismən)
                            │
                            └── TOTP kodu tələb olunur
                                    │
                                    └── Kod doğrudursa ──→ Tam sessiya
```

---

## 🚧 Rate Limiting

### Durable Object Əsaslı Atomik Limiter

Cloudflare-in native `ratelimit` binding-i **PoP başına** sayır və dəqiq deyil. Buna görə Collabix **Durable Object** əsaslı öz rate limiterini istifadə edir:

```
Hər limit açarı = Ayrıca DO instansı
  Məsələn: rl:auth:ip:192.168.1.1
  
DO tək-axınlıdır (single-threaded) ──→ get → put yarışsızdır (race-free)
```

### Rate Limit Səbətləri

| Endpoint Kateqoriyası | Limit | Pəncərə |
|----------------------|-------|---------|
| **Auth** (login, register) | 10 sorğu | 5 dəqiqə |
| **Write** (post, comment, message) | 60 sorğu | 1 dəqiqə |
| **Read** (feed, profile) | 300 sorğu | 1 dəqiqə |
| **Upload** (avatar, fayl) | 30 sorğu | 1 saat |
| **Admin** | 120 sorğu | 1 dəqiqə |

### DDoS Miqyaslama

```
Sorğu ──→ [Cloudflare WAF]  ← L3/L4 DDoS qoruması (pulsuz)
              │
              ▼
         [Turnstile]  ← Bot/insan ayırması
              │
              ▼
         [RateLimitDO]  ← Tətbiq səviyyəsi limit
              │
              ▼
         [Worker]  ← Biznes məntiqi
```

---

## 🔒 XSS Qoruması

### Frontend (Client-Side)

| Qoruma | Həyata Keçirmə |
|--------|----------------|
| **DOM Manipulation** | `innerHTML` HEÇ VAXT istifadə edilmir — yalnız `document.createElement()` |
| **DOMPurify** | Markdown → HTML çevirildiyi hər yerdə mütləq sanitizasiya |
| **util.js `el()` funksiyası** | XSS-dən qorunan element yaratma helper-i |

```javascript
// ❌ QADAĞAN — Heç vaxt belə etmə
element.innerHTML = userInput;

// ✅ DÜZGÜN — Collabix yanaşması
const el = document.createElement('p');
el.textContent = userInput;  // Avtomatik escape
```

### Backend (Server-Side)

| Qoruma | Təsvir |
|--------|--------|
| **Content-Security-Policy** | Sərt CSP — yalnız təsdiq olunmuş mənbələrdən skript yüklənir |
| **X-Frame-Options** | `DENY` — clickjacking hücumunun qarşısı |
| **X-Content-Type-Options** | `nosniff` — MIME sniffing bloklanır |
| **HSTS** | HTTPS məcburiyyəti |
| **Referrer-Policy** | `strict-origin-when-cross-origin` |

---

## 🗃️ SQL Injection Qoruması

Bütün SQL sorğuları **Prepared Statements** (Bind Parameters) ilə icra olunur:

```typescript
// ❌ QADAĞAN — SQL Injection zəifliyi
const result = await db.prepare(`SELECT * FROM users WHERE id = '${userId}'`).all();

// ✅ DÜZGÜN — Parametrləşdirilmiş sorğu
const result = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).all();
```

---

## 📁 Fayl Yükləmə Təhlükəsizliyi (R2)

### MIME Whitelisting

R2-yə yüklənən hər faylın **həqiqi tipi** Worker-də yoxlanılır:

| Kateqoriya | İcazəli MIME Tipləri |
|------------|---------------------|
| **Şəkil** | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml` |
| **Sənəd** | `application/pdf`, `text/plain` |

```
Yükləmə Axını:
  Fayl ──→ [Worker]
              │
              ├── MIME tipi yoxlanılır (whitelist)
              ├── Fayl ölçüsü yoxlanılır (limit)
              ├── Təsadüfi ad verilir (original ad gizlədilir)
              └── R2-yə yazılır
```

---

## 👑 RBAC (Rol Əsaslı İcazə İdarəetməsi)

### Qlobal Rollar

| Rol | İcazələr |
|-----|---------|
| **Super Admin** | Tam sistem icazəsi — bütün əməliyyatlar |
| **Admin** | İstifadəçi idarəetmə, məzmun moderasiyası, sistem ayarları |
| **Moderator** | Məzmun moderasiyası, şikayət həlli |
| **User** | Standart istifadəçi əməliyyatları |

### Komanda Rolları

| Rol | İcazələr |
|-----|---------|
| **Owner** | Komanda yaradıcısı — tam nəzarət, komanda silmə |
| **Admin** | Üzv idarəetmə, rol təyinatı, layihə idarəetmə |
| **Moderator** | Məzmun moderasiyası, fayda idarəetmə |
| **Member** | Standart üzv — post, mesaj, tapşırıq |
| **Guest** | Yalnız oxuma icazəsi |

### İcazə Yoxlama Axını

```
API Sorğusu ──→ [JWT Yoxlama]
                     │
                     ├── Token etibarlıdırmı?
                     │     └── Xeyr ──→ 401 Unauthorized
                     │
                     ├── [KV-də sessiya mövcuddurmu?]
                     │     └── Xeyr ──→ 401 (sessiya ləğv edilib)
                     │
                     └── [RBAC İcazə Yoxlaması]
                           │
                           ├── Qlobal rol yoxlanılır
                           ├── Resurs-spesifik icazə yoxlanılır
                           └── Komanda rolu yoxlanılır (əgər team endpoint-idirsə)
                                 │
                                 ├── İcazə var ──→ ✅ İcra et
                                 └── İcazə yoxdur ──→ 403 Forbidden
```

---

## 🔐 Gizli Açarların İdarə Edilməsi

| Açar | Saxlama Yeri | Quraşdırma |
|------|-------------|-----------|
| `JWT_SECRET` | Cloudflare Secrets | `wrangler secret put JWT_SECRET` |
| `TURNSTILE_SECRET` | Cloudflare Secrets | `wrangler secret put TURNSTILE_SECRET` |
| `RESEND_API_KEY` | Cloudflare Secrets | `wrangler secret put RESEND_API_KEY` |
| `TURNSTILE_SITE_KEY` | `wrangler.jsonc` vars | Açıq açar — brauzerə göndərilir |
| Lokal inkişaf | `.dev.vars` | `.gitignore`-dadır |

> ⚠️ **Heç vaxt** gizli açarları `wrangler.jsonc`-ın `vars` bölməsinə yazmayın. Yalnız `wrangler secret put` istifadə edin.

---

## 📊 Audit Logging

Bütün kritik əməliyyatlar `admin_logs` cədvəlində qeydə alınır:

| Hadisə Tipi | Nümunə |
|-------------|--------|
| `USER_BANNED` | Admin istifadəçini bloklamışdır |
| `ROLE_CHANGED` | Rol dəyişikliyi (User → Admin) |
| `POST_DELETED` | Məzmun silinmişdir |
| `SESSION_REVOKED` | Sessiya ləğv edilmişdir |
| `2FA_ENABLED` | İki mərhələli təsdiq aktivləşdirilmişdir |
| `PASSWORD_RESET` | Şifrə sıfırlanmışdır |

Audit logları:
- Admin panelində terminal üslubunda göstərilir
- CSV formatında ixrac edilə bilər
- 90+ gündən sonra avtomatik arxivlənir

---

## 🛡️ OWASP Top 10 Əhatəsi

| # | Zəiflik | Collabix Qoruması | Status |
|---|---------|-------------------|--------|
| A01 | Broken Access Control | RBAC + JWT + KV ikili yoxlama | ✅ |
| A02 | Cryptographic Failures | PBKDF2-SHA256, 100K iterasiya | ✅ |
| A03 | Injection | Prepared Statements (bind params) | ✅ |
| A04 | Insecure Design | Zero Trust, server-side validation | ✅ |
| A05 | Security Misconfiguration | Sərt CSP, HSTS, X-Frame-Options | ✅ |
| A06 | Vulnerable Components | Minimal asılılıqlar, audit yoxlamaları | ✅ |
| A07 | Auth Failures | Rate limiting, 2FA, session revocation | ✅ |
| A08 | Data Integrity Failures | Server-side XP/Level hesablama | ✅ |
| A09 | Logging Failures | Audit log, observability tracing | ✅ |
| A10 | SSRF | R2 MIME whitelisting, URL validasiyası | ✅ |

---

## 🔗 Əlaqəli Səhifələr

- **[Autentifikasiya Sistemi →](Authentication)**
- **[RBAC Sistemi →](RBAC)**
- **[Sistem Arxitekturası →](Architecture)**

---

**Əvvəlki:** [← API Sənədləri](API-Reference) | **Növbəti:** [Autentifikasiya Sistemi →](Authentication)
