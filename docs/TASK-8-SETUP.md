# TASK-8 — Xarici xidmətlərin qurulması

Bu sənəd TASK-8-in **xaricdən açar tələb edən** hissələrini izah edir.

> **Əsas prinsip — graceful degradation.**
> Aşağıdakı açarların HEÇ BİRİ məcburi deyil. Açar qurulmayıbsa müvafiq funksiya
> səssizcə söndürülür və sayt tam işlək qalır. Açar qoyulan an funksiya
> avtomatik aktivləşir — **kod dəyişmir, yenidən deploy kifayətdir.**

---

## 1. Turnstile — bot qoruması (Bənd 7) ✅ kod hazırdır

Cloudflare-in görünməz CAPTCHA-sı. Qeydiyyatı və (3 uğursuz cəhddən sonra) girişi qoruyur.

### Addımlar

1. Cloudflare dashboard → **Turnstile** → **Add widget**
2. Widget name: `collabix`, Domain: `collabix.com` (+ test üçün `127.0.0.1`)
3. Widget mode: **Managed** (tövsiyə)
4. İki açar verilir: **Site Key** (public) və **Secret Key** (gizli)

### Qurulma

```bash
# Public açar — wrangler.jsonc → vars → TURNSTILE_SITE_KEY
#   (secret deyil, brauzerə onsuz da göndərilir)

# Gizli açar — HEÇ VAXT repo-ya yazılmır:
npx wrangler secret put TURNSTILE_SECRET
```

`wrangler.jsonc`-də:

```jsonc
"vars": { "TURNSTILE_SITE_KEY": "0x4AAAAAAA..." }
```

### Açar qoyulmayanda nə olur?

| Qat | Davranış |
| --- | --- |
| Frontend | `/api/config` boş açar qaytarır → widget render olunmur, xarici skript **yüklənmir** |
| Backend | `TURNSTILE_SECRET` yoxdur → `verifyTurnstile` `skipped: true` qaytarır, yoxlama atlanır |

### Diqqət

- CSP-də `challenges.cloudflare.com` **həmişə** icazəlidir (`worker/index.ts`) — siyahı statikdir, açardan asılı deyil.
- Turnstile xidmətinə çatılmasa **fail-open** davranırıq: CAPTCHA-nın əlçatmazlığı bütün saytı bağlamamalıdır; rate-limit və digər qatlar hər halda işləyir.
- Token **birdəfəlikdir** — uğursuz cəhddən sonra client widget-i `reset()` edir.

---

## 2. Email — Cloudflare Email Sending (Bənd 4, magic link) ✅ kod hazırdır

> Seçilmiş provayder: **Cloudflare Email Sending** (stack-ə uyğun, ayrıca hesab/API key tələb etmir).
> MailChannels-ın Workers pulsuz təbəqəsi bağlandığı üçün köhnə sənədlərdəki `mailchannels.net` yolu **artıq işləmir**.

Binding modeli seçilib (REST API yox): Worker-in içindən API açarı ümumiyyətlə lazım
gəlmir, yəni saxlanacaq/sızacaq bir sirr də olmur.

### Addımlar

```bash
# 1. Domeni Email Sending-ə onboard et (DKIM/SPF qeydlərini özü qurur)
npx wrangler email sending enable collabix.com

# 2. Yoxla
npx wrangler email sending list
```

`wrangler.jsonc`-ə binding və göndərən ünvan:

```jsonc
{
  "send_email": [{ "name": "EMAIL" }],
  "vars": {
    "EMAIL_FROM": "giris@collabix.com",   // domen ONBOARD OLUNMUŞ olmalıdır
    "APP_NAME": "Collabix"
  }
}
```

### Açar qoyulmayanda nə olur?

`EMAIL` binding-i **və ya** `EMAIL_FROM` yoxdursa magic link tamamilə söndürülür:
`/api/config` → `magicLink: false`, "şifrəni unutdum" köhnə "admin ilə əlaqə saxla"
izahını göstərir. Endpoint özü qalır, amma həmişə neytral `{ ok: true }` qaytarır.

### Nəzərə alınmalı davranışlar

- **İstifadəçi sadalanması bağlıdır.** `POST /api/auth/magic-link` HƏMİŞƏ eyni cavabı
  verir — email mövcuddur, yoxdur, göndərmə alındı, alınmadı: fərq etməz. Fərqli cavab
  versəydik, bu endpoint "hansı email Collabix-də qeydiyyatdadır?" sualına cavab verən
  pulsuz alətə çevrilərdi. UI mesajı da şərtlidir ("hesab varsa göndərildi").
- **Link birdəfəlikdir və 10 dəqiqəlikdir.** KV-də yalnız SHA-256 heşi saxlanılır,
  oxunan kimi silinir — forward edilsə, keşlənsə və ya poçt skaneri açsa təkrar işləmir.
- **Ünvan başına limit** (15 dəq / 3 link) IP limitindən ƏLAVƏ tətbiq olunur: botnet
  fərqli IP-lərdən eyni qurbanın qutusunu doldura bilməsin.
- **Klik email-i doğrulayır.** Link `contact_email`-ə də göndərilir (doğrulanmamış),
  amma uğurlu klik həmin qutuya çıxışı SÜBUT etdiyi üçün ünvan `email_verified = 1`
  kimi qeyd olunur və sonrakı OAuth birləşdirmələri üçün etibarlı açar olur.
- **Parol bərpası ayrıca mexanizm DEYİL.** Link ilə daxil olursan, sonra Parametrlərdən
  şifrə təyin edirsən — ayrıca reset token saxlamağa ehtiyac yoxdur.

---

## 3. OAuth — GitHub / Google / LinkedIn (Bənd 5) ✅ kod hazırdır

Hər provayder üçün callback URL: `https://<domen>/api/auth/oauth/<provider>/callback`

| Provayder | Qeydiyyat yeri | Lazımi scope |
| --- | --- | --- |
| GitHub | Settings → Developer settings → OAuth Apps | `read:user user:email` |
| Google | Google Cloud Console → APIs & Services → Credentials | `openid email profile` |
| LinkedIn | LinkedIn Developers → Create app → Products → *Sign In with LinkedIn using OpenID Connect* | `openid profile email` |

```bash
# Gizli açarlar
npx wrangler secret put OAUTH_GITHUB_SECRET
npx wrangler secret put OAUTH_GOOGLE_SECRET
npx wrangler secret put OAUTH_LINKEDIN_SECRET
```

Client ID-lər public-dir → `wrangler.jsonc` → `vars`:

```jsonc
"vars": {
  "OAUTH_GITHUB_ID": "Iv1....",
  "OAUTH_GOOGLE_ID": "....apps.googleusercontent.com",
  "OAUTH_LINKEDIN_ID": "...."
}
```

### Provayder yalnız CÜTÜ tam olduqda aktivləşir

`id` və `secret`-dən biri əskikdirsə provayder **mövcud sayılmır**: `/api/config`
onu siyahıya salmır, düymə render olunmur, `start`/`callback` endpoint-ləri 404 verir.
Yarımçıq konfiq istifadəçini işləməyən axına buraxmır.

### Nəzərə alınmalı davranışlar

- **18+ qapısı keçilmir.** OAuth profili yaş vermir, ona görə yeni istifadəçi üçün
  hesab callback-də dərhal yaradılmır: profil 15 dəqiqəlik "bilet" kimi KV-yə yazılır,
  istifadəçi sihirbaza yönləndirilir və doğum tarixini orada təsdiqləyir.
- **Hesab birləşdirmə yalnız DOĞRULANMIŞ email ilə.** Doğrulanmamış email ilə
  birləşdirsəydik, hücumçu provayderdə qurbanın email-ini yazıb hesabı ələ keçirərdi.
- **Son giriş üsulu ayrıla bilmir.** Parolu olmayan hesab tək bağlı provayderini
  silə bilməz — əvvəlcə şifrə təyin etməlidir.

---

## 4. E2E-də Turnstile

Test dəsti Cloudflare-in **rəsmi dummy açar cütü** ilə işləyir (`playwright.config.ts`):

| Dəyər | Açar |
| --- | --- |
| Site key | `1x00000000000000000000BB` (həmişə keçir, görünməz) |
| Secret | `1x0000000000000000000000000000000AA` (həmişə keçir) |

**Hər ikisi override olunmalıdır** — `.dev.vars`-dakı əsl secret test site key-i ilə
cütləşmir və hər doğrulama sınardı. Real site key isə domenə bağlıdır, `127.0.0.1`-də
Turnstile konsola xəta yazıb "sıfır konsol xətası" şərtini yalançı pozardı.

Brauzerdən kənar (xam `fetch`) çağırışlar widget-dən token ala bilmir, ona görə
`e2e/seed.ts` → `E2E_TURNSTILE` sabitini göndərir. Boş token siteverify-a çatmadan
rədd olunur, ona görə dəyər boş ola bilməz.

---

## Cari secret siyahısı

```bash
npx wrangler secret put JWT_SECRET          # MƏCBURİ — `openssl rand -base64 48`
npx wrangler secret put TURNSTILE_SECRET    # opsional (Bənd 7)
```

Lokal dev üçün eyni dəyərlər `.dev.vars` faylına yazılır (gitignore-dadır).

---

## Rate-limit və test mühiti

`worker/auth.ts` → `rlFactor()` limitləri **yalnız qeyri-production** mühitdə genişləndirir:

```ts
const rlFactor = (env) => (env.ENVIRONMENT === 'production' ? 1 : 20);
```

E2E dəsti bunu `wrangler dev --var ENVIRONMENT:test` ilə seçir (`playwright.config.ts`).
Səbəb: bütün test "cihazları" tək `127.0.0.1`-dən gəlir və prod limiti ilə dəst öz-özünü bloklayır.

**Production-da bu çarpan heç vaxt tətbiq olunmur** — `ENVIRONMENT` orada `production`-dır,
yəni səhvən qoyulmuş konfiq canlı limitləri zəiflədə bilmir.
