# 🧩 Frontend Modulları

> Collabix frontend-i heç bir xarici UI framework (React, Vue) olmadan, tamamilə **Vanilla JavaScript (ES Modules)** ilə inkişaf etdirilmişdir.

---

## 📂 Struktur İcmalı

`/js/` qovluğunda cəmi **59 ədəd müstəqil modul** yerləşir. Hər modul öz məsuliyyət sahəsini idarə edir.

### 🌟 Əsas Tətbiq Modulları

| Modul | Funksiya | Təsvir |
|-------|----------|--------|
| `app.js` | **Tətbiq Qabığı** | SPA (Single Page Application) məntiqini qurur. Hash (`#`) əsaslı marşrutlayıcı (router) və tətbiq həyat dövrü burada idarə olunur. |
| `api.js` | **Şəbəkə Mühərriki** | Bütün `fetch` sorğuları bu wrapper-dən keçir. Xəta idarəsi, token əlavəsi və Visibility API ilə "smart polling" edir. |
| `store.js` | **Reaktiv Vəziyyət (State)** | Redux-a bənzər yaddaş idarəsi. Bəyənmələr, izləmələr kimi istifadəçi datalarını önbellekdə saxlayaraq UI-ın cəld reaksiyasını təmin edir. |

### 🔐 Təhlükəsizlik və Hesab

| Modul | Funksiya | Təsvir |
|-------|----------|--------|
| `auth.js` | **Autentifikasiya** | Login, Logout və Multi-tab sinxronizasiyasını təşkil edir. |
| `wizard.js` | **Qeydiyyat Forması** | 4-mərhələli interaktiv qeydiyyat axınını idarə edir. |
| `mfa.js` | **2FA / TOTP** | İki mərhələli təsdiqin tənzimlənməsi. |
| `oauth.js` | **Xarici Giriş** | Google, GitHub, LinkedIn hesabları ilə giriş interfeysləri. |
| `password-reset.js` | **Şifrə Yeniləmə** | Şifrənin sıfırlanması əməliyyatları. |

### 📝 Məzmun və Sosial Lent

| Modul | Funksiya | Təsvir |
|-------|----------|--------|
| `feed.js` | **Lent Sistemi** | Sonsuz skroll (infinite scroll), post və şərhlərin render edilməsi. |
| `composer.js` | **Redaktor** | Yeni post yazmaq üçün blok əsaslı (WYSIWYG) redaktor. |
| `markdown.js` | **Formatlama** | Mətnin HTML-ə çevrilməsi və `DOMPurify` ilə təmizlənməsi. |
| `code-block.js` | **Kod Görünüşü** | `highlight.js` vasitəsilə kodların rəngləndirilməsi. |
| `richmsg.js` | **Zəngin Mesaj** | Mesajlarda qalın, link kimi xüsusiyyətlərin formatlanması. |

### 💬 Ünsiyyət

| Modul | Funksiya | Təsvir |
|-------|----------|--------|
| `chat.js` | **Otaqlar** | WebSocket üzərindən qlobal otaqlarda yazışmalar. |
| `chat-ui.js` | **Chat interfeysi** | Yazışma ekranındakı animasiyalar və "Typing..." göstəriciləri. |
| `dm.js` | **Şəxsi Mesaj (DM)** | İstifadəçilər arası birbaşa mesajlaşma. |
| `presence.js` | **Onlayn İzləmə** | Qlobal Heartbeat mühərriki ilə onlayn/oflayn vəziyyət bildirimi. |

### 🏢 Komandalar (Workspace)

| Modul | Funksiya | Təsvir |
|-------|----------|--------|
| `teams.js` | **Komandalar** | Komanda idarəetmə interfeysi. |
| `workspace.js` | **İş Sahəsi** | İş sahəsi idarəetməsi, layihə və tapşırıqlar. |
| `workspace-views.js` | **Görünüşlər** | Kanban lövhəsi kimi xüsusi görünüşlərin idarəsi. |
| `workspace-detail.js` | **Detallar** | Tək komanda üzərindəki məlumat panelləri. |

### 👤 Profil və Cəmiyyət

| Modul | Funksiya | Təsvir |
|-------|----------|--------|
| `profile.js` | **Profil Məlumatı** | İstifadəçinin profil məlumatlarının çəkilməsi. |
| `profile-view.js` | **Profil Ekranı** | Profil dizaynının və tab-ların (Lent, Statistikalar) idarəsi. |
| `users.js` | **Kataloq** | Çox parametrik filtrli istifadəçi axtarış paneli. |
| `stats.js` | **Statistika** | Fərdi inkişaf və aktivlik qrafikləri. |
| `heatmap.js` | **Aktivlik Xəritəsi** | GitHub üslublu fəaliyyət rəng xəritəsi. |
| `completeness.js` | **Profil Dolğunluğu** | Profilin neçə faiz tamamlandığını hesablayan köməkçi. |

### 🛠️ Köməkçi və UI Alətləri

| Modul | Funksiya | Təsvir |
|-------|----------|--------|
| `ui.js` | **Interfeys** | Toast mesajları, Modallar (Popup) və Temaların idarəsi. |
| `util.js` | **Köməkçilər** | XSS-ə qarşı `el()` funksiyası və ümumi formatlayıcılar. |
| `i18n.js` | **Tərcümə** | 400+ sözlük lüğət. 3 dildə dərhal tərcümə (AZ, EN, RU). |
| `icons.js` / `icon-set.js` | **İkonlar** | Vektor SVG ikon kitabxanası. |
| `palette.js` | **Kommanda Paneli**| `Cmd+K` vasitəsilə tətbiqdaxili sürətli axtarış və naviqasiya. |
| `particles.js` | **Vizual Effekt** | Səhifə arxaplanda hərəkət edən qrafik hissəciklər. |
| `cyberpunk_fx.js` | **Tema Effekti** | "Matrix" temasında UI elementlərinə glitch və neon effekti verilməsi. |
| `admin.js` | **Admin Paneli** | Loglar, istifadəçi idarəsi və statistika panelləri. |

---

## 🚫 Çərçivə (Framework) Niyə Yoxdur?

Collabix qəsdən kənar böyük çərçivələrdən qaçır:
1. **Sürət (Zero-Latency):** Brauzer Vanilla JS-i qat-qat sürətli icra edir. Tətbiq bir göz qırpımında açılır.
2. **Öyrədici Mühit:** Gənc proqramçılar arxa planda baş verənləri "qara qutu" (black-box) daxilində deyil, birbaşa koda baxaraq öyrənə bilərlər.

---

**Əvvəlki:** [Verilənlər Bazası Sxemi](Database-Schema) | **Növbəti:** [API Reference](API-Reference)
