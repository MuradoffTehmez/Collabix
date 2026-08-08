# 🎮 Xüsusiyyətlər Kataloqu

> Collabix platformasındakı bütün funksiyaların detallı siyahısı və təsviri.

---

## 🔐 Autentifikasiya və Təhlükəsizlik

### Qeydiyyat Sehrbazı (4 Mərhələli Wizard)

```
Addım 1: Hesab Məlumatları        Addım 2: Şəxsi Məlumatlar
  ├── Username                       ├── Ad/Soyad
  ├── Email                          ├── Bio
  ├── Şifrə (güc göstəricisi)       ├── Avatar (crop + preview)
  └── Şifrə təsdiqi                 └── Doğum tarixi

Addım 3: Bacarıqlar               Addım 4: Sosial Linklər
  ├── Proqramlaşdırma dilləri        ├── GitHub profili
  ├── Bacarıq səviyyəsi              ├── LinkedIn
  └── Maraq sahələri                 ├── Twitter/X
                                     └── Vebsayt
```

### Giriş Metodları

| Metod | Təsvir | İkon |
|-------|--------|------|
| **Standart Giriş** | Username/Email + Şifrə | 🔑 |
| **Magic Link** | Email-ə təsdiq linki göndərilir | ✉️ |
| **Google OAuth** | Google hesabı ilə giriş | 🔵 |
| **GitHub OAuth** | GitHub hesabı ilə giriş | ⚫ |
| **LinkedIn OAuth** | LinkedIn hesabı ilə giriş | 🔷 |

### Təhlükəsizlik Funksiyaları

| Funksiya | Təsvir |
|----------|--------|
| **2FA/TOTP** | Google Authenticator / Authy ilə iki mərhələli təsdiq |
| **Sessiya İdarəetməsi** | Bütün cihazlardakı aktiv sessiyalara baxma |
| **Sessiya Ləğvi** | "Digər sessiyaları ləğv et" düyməsi |
| **Məcburi Şifrə Yenilənməsi** | Admin müvəqqəti şifrə verdikdə məcburi dəyişiklik |
| **Turnstile CAPTCHA** | Bot hücumlarından qorunma |

---

## 👤 Profil və Fərdi İnkişaf

### Profil Komponentləri

| Komponent | Təsvir |
|-----------|--------|
| **Avatar** | Yükləmə + kəsmə (crop) funksiyası |
| **Bio** | 500 simvolluq şəxsi təsvir |
| **Bacarıqlar** | Proqramlaşdırma dilləri və səviyyələri |
| **Sosial Linklər** | GitHub, LinkedIn, Twitter, vebsayt |
| **Statistika** | Post sayı, izləyici, izlənən, reputasiya |
| **Aktivlik Xəritəsi** | GitHub-stilində 365 günlük heatmap |
| **XP & Level** | Cari təcrübə xalı və səviyyə göstəricisi |
| **Badges** | Qazanılmış nişanlar |

### Oyunlaşdırma (Gamification) Sistemi

#### XP (Təcrübə Xalı) Mənbələri

| Fəaliyyət | XP Miqdarı | Limit |
|-----------|-----------|-------|
| Post yazmaq | +10 XP | Gündə max 5 dəfə |
| Şərh yazmaq | +5 XP | Gündə max 10 dəfə |
| Tapşırıq həll etmək | +50 XP | Limitsiz |
| Gündəlik giriş | +5 XP | Gündə 1 dəfə |
| Bəyənmə almaq | +2 XP | Gündə max 20 dəfə |
| İlk post | +25 XP bonus | Bir dəfəlik |
| Profil tamamlama | +30 XP bonus | Bir dəfəlik |

#### Level Sistemi

```
Level 1:  0 — 99 XP       (Yeni başlayan)
Level 2:  100 — 299 XP    (Aktiv üzv)
Level 3:  300 — 599 XP    (Təcrübəli)
Level 4:  600 — 999 XP    (Mütəxəssis)
Level 5:  1000+ XP        (Lider)
...
```

#### Reputasiya Sistemi

Reputasiya fərqli kanallardan toplanır:
- **Bəyənmə almaq** → +1 Reputasiya
- **Doğru cavab** → +5 Reputasiya
- **Tapşırıq təsdiqi** → +10 Reputasiya
- **Şikayət almaq** → -5 Reputasiya

#### Badge (Nişan) Nümunələri

| Badge | Şərt | İkon |
|-------|------|------|
| **İlk Addım** | İlk postu paylaş | 🌱 |
| **Aktiv Üzv** | 7 gün ardıcıl giriş | 🔥 |
| **Mentor** | 50 şərh yaz | 🧑‍🏫 |
| **Kod Ustası** | 10 tapşırıq həll et | 💻 |
| **Populyar** | 100 bəyənmə al | ⭐ |
| **Təsdiqlənmiş** | Admin tərəfindən verify | ✅ |

---

## 📝 Sosial Şəbəkə və Məzmun (Feed)

### Blok-Əsaslı Redaktor (Composer)

Eyni post daxilində müxtəlif məzmun tipləri:

```
┌────────────────────────────────────────┐
│  📝 Mətn Bloku                         │
│  "Bu gün yeni bir Python skripti..."   │
├────────────────────────────────────────┤
│  💻 Kod Bloku (syntax highlighting)    │
│  ```python                             │
│  def hello():                          │
│      print("Hello, Collabix!")         │
│  ```                                   │
├────────────────────────────────────────┤
│  🖼️ Şəkil Bloku                       │
│  [screenshot.png]                      │
├────────────────────────────────────────┤
│  [+ Blok Əlavə Et]                    │
└────────────────────────────────────────┘
```

### Feed Funksiyaları

| Funksiya | Təsvir |
|----------|--------|
| **Infinite Scroll** | Sonsuz skrollu məzmun axını |
| **Bəyənmə (Like)** | Post və şərhləri bəyənmə |
| **Emoji Reaksiyaları** | Müxtəlif emoji ilə reaksiya |
| **Repost** | Başqasının postunu paylaşma |
| **Quote (Sitat)** | Şəxsi əlavə ilə repost |
| **Bookmark** | Sonra oxumaq üçün yadda saxlama |
| **Şərh Threads** | İç-içə şərh axını |
| **Sorğu (Poll)** | Post daxilində sorğu yaratma |
| **Planlı Paylaşım** | Gələcək tarixə post planlaşdırma |
| **Görünürlük** | Public / Followers Only / Private |

---

## 💬 Real-Vaxt Ünsiyyət

### Qlobal Otaqlar (Rooms)

```
┌─────────────────────────────────────┐
│  #python    #javascript    #english │  ← Mövzu otaqları
│─────────────────────────────────────│
│  👤 Ali: Salam hamıya!              │
│  👤 Vüsal: Salam!                   │
│  ✍️ Leyla yazır...                   │  ← Typing indicator
│─────────────────────────────────────│
│  [Mesaj yaz...]           [Göndər]  │
└─────────────────────────────────────┘
```

| Funksiya | Təsvir |
|----------|--------|
| **Canlı Mesajlaşma** | WebSocket ilə anında mesaj çatdırılması |
| **Typing Indicator** | "Yazır..." göstəricisi |
| **Mesaj Redaktəsi** | Göndərilmiş mesajı düzəltmək |
| **Mesaj Silinməsi** | Göndərilmiş mesajı silmək |
| **Pinned Mesajlar** | Vacib mesajları sabitləmək |
| **Mesaj Reaksiyaları** | Emoji ilə mesaja reaksiya |
| **Thread (Cavab)** | Mesaja cavab thread-i |
| **Fayl Paylaşımı** | Şəkil/sənəd göndərmə |
| **Link Preview** | URL paylaşıldıqda önizləmə |
| **Syntax Highlighting** | Kod bloklarının rənglənməsi |

### Şəxsi Mesajlaşma (DM)

| Funksiya | Təsvir |
|----------|--------|
| **1:1 Mesajlaşma** | İki istifadəçi arasında birbaşa ünsiyyət |
| **Read Receipts** | Oxundu işarəsi |
| **Online Status** | Yaşıl nöqtə ilə onlayn/oflayn göstəricisi |

### Presence (Mövcudluq) Sistemi

```
Heartbeat Mühərriki:
  Brauzer ──→ [PresenceDO] ──→ Bütün qoşulmuş istifadəçilərə yayılır
                                    │
                                    ├── 🟢 Onlayn
                                    ├── 🟡 Uzaq (5 dəq inaktiv)
                                    └── ⚫ Oflayn (heartbeat kəsilib)

  Bağlantı qırılarsa: Exponential Backoff ilə avtomatik yenidən qoşulma
```

---

## 🏢 Komandalar və İş Sahələri

### Komanda Funksiyaları

| Funksiya | Təsvir |
|----------|--------|
| **Komanda Yaratma** | Ad, təsvir, avatar ilə yeni komanda |
| **Üzv Dəvəti** | Email ilə dəvət göndərmə |
| **Rol İdarəetməsi** | Fərdi rollar yaratma (ad, rəng, icazələr) |
| **Sahiblik Transferi** | Komanda sahibliyini başqasına ötürmə |
| **Daxili Lent** | Yalnız komanda üzvlərinin gördüyü post axını |
| **Daxili Chat** | Komanda söhbət otağı |
| **Fayl Anbarı** | Ortaq R2 fayl saxlama sahəsi |

### Layihə və Tapşırıq İdarəetməsi

```
Komanda
  └── Layihə (Project)
        └── Tapşırıqlar (Kanban)
              ├── 📋 Backlog
              ├── 🔄 İşdə (In Progress)
              ├── 👀 Yoxlamada (Review)
              └── ✅ Tamamlanmış (Done)
```

### İş Sahəsi (Workspace)

| Funksiya | Təsvir |
|----------|--------|
| **Workspace Dashboard** | Statistika, aktivlik, son dəyişikliklər |
| **Workspace Feed** | Komandadaxili post axını |
| **Workspace Files** | Paylaşılan fayllar |
| **Workspace Members** | Üzv siyahısı və rolları |
| **Workspace Statistics** | XP, aktivlik, töhfə statistikaları |

---

## 🎓 Təhsil Sistemi

| Funksiya | Təsvir |
|----------|--------|
| **Tapşırıq Kataloqu** | Kateqoriya (Python, JS, SQL) üzrə tapşırıqlar |
| **Çətinlik Səviyyəsi** | Asan / Orta / Çətin |
| **Həll Göndərmə** | Kod və ya GitHub linki ilə həll |
| **Review** | Admin tərəfindən yoxlama və təsdiq |
| **XP Mükafatı** | Təsdiq olunduqda avtomatik XP verilməsi |

---

## 🛠️ Admin Paneli

### Dashboard

| Widget | Təsvir |
|--------|--------|
| **Sparkline Qrafiklər** | Canlı sistem performansı |
| **Aktiv İstifadəçilər** | Real-vaxt onlayn sayı |
| **Gündəlik Statistika** | Yeni qeydiyyatlar, postlar, mesajlar |

### İstifadəçi İdarəetmə

| Əməliyyat | Təsvir |
|-----------|--------|
| **Rol Dəyişdirmə** | User ↔ Admin ↔ Moderator |
| **Verify** | Təsdiqlənmiş (✅) işarəsi vermə |
| **Ban/Unban** | Hesabı bloklama/açma |
| **Müvəqqəti Şifrə** | İstifadəçiyə yeni şifrə vermə |
| **XP Dəyişimi** | Manual XP əlavə/silmə |

### Moderasiya

| Funksiya | Təsvir |
|----------|--------|
| **Şikayətlər** | Spam, təhqir, uyğunsuz məzmun şikayətləri |
| **Audit Jurnalı** | Terminal üslubunda log terminalı |
| **CSV İxracı** | Audit loglarının ixracı |
| **Taksonomiya** | Skill/Language siyahılarının idarəsi (Drag & Drop) |
| **FAQ CRUD** | Ana səhifədə görünən FAQ idarəsi |
| **Testimonials CRUD** | Rəylər idarəsi |

---

## 🌐 SEO və Sosial Şəbəkə

| Funksiya | Təsvir |
|----------|--------|
| **Dinamik Meta Tags** | HTMLRewriter ilə SSR meta injection |
| **JSON-LD** | Strukturlaşdırılmış data (Schema.org) |
| **OG Images** | `workers-og` ilə canlı PNG render |
| **sitemap.xml** | Avtomatik yaradılan sayt xəritəsi |
| **robots.txt** | Crawler qaydaları |
| **llms.txt** | AI crawlerləri üçün xüsusi fayl |
| **hreflang** | Çoxdilli alternativlər |

---

## 🎨 Tema və İnterface

| Tema | Təsvir |
|------|--------|
| **Light** | İşıqlı tema |
| **Dark** | Tünd tema (default) |
| **Matrix** | Yaşıl-qara cyberpunk stili |

### UI Komponentləri

| Komponent | Təsvir |
|-----------|--------|
| **Toast Bildirişlər** | Müvəqqəti bildirim mesajları |
| **Modallar** | Popup pəncərələr |
| **Command Palette** | `Cmd+K` / `Ctrl+K` ilə sürətli əmr paneli |
| **Particles** | Canvas animasiyalı arxa fon |
| **Cyberpunk FX** | Glitch effektləri |
| **i18n** | 3 dil dəstəyi (AZ, EN, RU) |

---

## 📱 Bildiriş Sistemi

| Bildiriş Tipi | Trigger |
|---------------|---------|
| **Yeni Bəyənmə** | Postunuz bəyənildikdə |
| **Yeni Şərh** | Postunuza şərh yazıldıqda |
| **Yeni İzləyici** | Kimsə sizi izlədikdə |
| **Yeni Mesaj** | DM aldıqda |
| **Komanda Dəvəti** | Komandaya dəvət olunduqda |
| **Tapşırıq Təsdiqi** | Həlliniz təsdiq olunduqda |
| **XP Qazanma** | XP aldıqda |
| **Level Up** | Yeni səviyyəyə çatdıqda |

---

## 🔗 Əlaqəli Səhifələr

- **[Oyunlaşdırma Sistemi →](Gamification)**
- **[Real-Vaxt Ünsiyyət →](Realtime)**
- **[Komandalar →](Teams-and-Workspaces)**
- **[Sistem Arxitekturası →](Architecture)**

---

**Əvvəlki:** [← RBAC Sistemi](RBAC) | **Növbəti:** [Oyunlaşdırma Sistemi →](Gamification)
