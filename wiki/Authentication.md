# 🔑 Autentifikasiya Sistemi

> Collabix yüksək təhlükəsizliyə malik, çoxkanallı autentifikasiya mexanizmlərinə sahibdir.

---

## 🔒 Token və Şifrələmə Altqatı

Collabix məlumat bazasında **heç vaxt şifrələrin açıq mətnini (plain text) saxlamır**.

1. **Şifrələmə Alqoritmi:** WebCrypto API üzərindən **PBKDF2-SHA256**.
2. **Gücləndirmə:** 100,000 iterasiya + 16 bayt təsadüfi duz (salt).
3. **Sessiya:** Hesab məlumatları təsdiqləndikdən sonra istifadəçiyə Cloudflare KV-də (ikili doğrulama üçün) saxlanılan və HS256 alqoritmi ilə imzalanan bir **JWT Token** verilir.
4. **Çatdırılma:** Token, təhlükəsiz bir HttpOnly və Secure Cookie olaraq brauzerə təhvil verilir.

---

## 🔓 Giriş Növləri

### 1. Standart Giriş (Username/Email + Password)
- İstifadəçi adı və ya qeydiyyatlı e-poçt ünvanı ilə giriş.
- Sistem əvvəlcə istifadəçini tapır, daha sonra daxil edilən parolu xüsusi "salt" ilə PBKDF2 ilə hesablayaraq məlumat bazasındakı dəyərlə müqayisə edir.

### 2. Magic Link (Sehrli Keçid)
- İstifadəçi parolu unutduqda və ya şifrəsiz giriş istədikdə, e-poçt ünvanını daxil edir.
- Cloudflare Workers arxasında olan Resend API istifadəçiyə bir-dəfəlik, vaxtı məhdud (məs, 15 dəqiqə) JWT tərkibli təhlükəsiz link göndərir.
- Linkə kliklədikdə avtomatik olaraq sessiya yaradılır.

### 3. OAuth 2.0 (Sosial Giriş)
İstifadəçilər bir kliklə 3-cü tərəf provayderləri ilə giriş edə bilərlər. Mövcud dəstək:
- **Google**
- **GitHub**
- **LinkedIn**

Sistem OAuth provayderindən alınan e-poçt ünvanını məlumat bazasında yoxlayır, hesab varsa birləşdirir (link account), yoxdursa yeni hesab yaradır.

---

## 🛡️ İki Mərhələli Təsdiq (2FA / TOTP)

Collabix istifadəçilərə əlavə təhlükəsizlik qatı (Layer) kimi 2FA təklif edir.

1. **Aktivləşdirmə:** İstifadəçi tənzimləmələrdən 2FA-nı aktivləşdirir.
2. **QR Kod:** Sistem, `qrcode-generator` kitabxanası ilə gizli açar (Secret) daxil edilmiş QR Kod hazırlayır.
3. **Proqram:** İstifadəçi Google Authenticator, Authy kimi proqramlar ilə kodu skan edir.
4. **Giriş Məntiqi:** Standart giriş edildikdən sonra, sistem 2FA-nın aktiv olduğunu görürsə, JWT tokenini natamam (unverified 2FA state) verir və istifadəçidən 6 rəqəmli kodu istəyir.
5. **Doğrulama:** 6 rəqəmli kod düzgündürsə, tam yetkili sessiya tokeni verilir.

---

## 💻 Sessiya (Session) İdarəetməsi

İstifadəçi müxtəlif cihazlarda və ya brauzerlərdə eyni anda açıq olan hesablarını tam idarə edə bilər.

- **Sessiya Ekranı:** Tənzimləmələrdə, cari aktiv sessiyalar (IP ünvanı, cihaz məlumatları və bağlanma tarixi) göstərilir.
- **Sessiya Ləğvi:** İstifadəçi tək bir düymə ("Digər sessiyaları ləğv et") ilə hesabına bağlı olan digər bütün JWT tokenləri KV verilənlər bazasından silə bilər. Bu, oğurlanmış tokenlərin və şübhəli girişlərin qarşısını almaq üçün vacibdir.

---

**Əvvəlki:** [← Təhlükəsizlik](Security) | **Növbəti:** [RBAC Sistemi →](RBAC)
