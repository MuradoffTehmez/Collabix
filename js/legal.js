// About / Privacy / Terms — çoxdilli statik məzmun (markdown).
//
// ⚠ HÜQUQİ KİMLİK DATASI — AUDIT-TASK-2 / hüquqi risk #12.
// Aşağıdaki dəyərlər Privacy Policy, Terms of Service, Security səhifəsində və
// footer-də CANLI SAYTDA göstərilir və data controller identifikasiyası kimi
// qanuni tələbi qarşılayır (GDPR Art. 13(1)(a) analoqu + AR "Fərdi məlumatlar
// haqqında" Qanunu).
//
// Əvvəl burada `[ŞİRKƏT ADI / Collabix]` və `[Rəsmi ünvan — şəhər, küçə]`
// placeholder-ləri var idi və aylarla canlı qaldı — yəni məxfilik siyasəti
// data controller-i identifikasiya etmirdi.
//
// ⛔ PLACEHOLDER-Ə QAYTARMA. Dəyişmək üçün sahibin təsdiqi lazımdır.
// ⛔ UYDURMA: şirkət adı, hüquqi forma, ünvan, VÖEN, email — heç biri
//    "məntiqli görünən" dəyərlə doldurulmur. Data yoxdursa sahə çıxarılır.
// Mənbə: sahib tərəfindən 2026-07-27-də təsdiqlənmiş kimlik cədvəli.
export const SITE = {
  // Hüquqi ad (data controller) — brenddən AYRIDIR.
  company: 'Tahmaz Muradov (Fərdi Sahibkar)',
  // Ticarət nişanı / məhsul adı — UI-da brend kimi işlədilir.
  brand: 'Collabix',
  legalForm: 'Fərdi Sahibkar',
  // Qeydiyyatsız fərdi sahibkar → yalnız şəhər/ölkə. Küçə/bina UYDURULMUR.
  address: 'Naxçıvan, Azərbaycan',
  jurisdiction: 'Azərbaycan Respublikası',
  // ⚠ ƏSAS kanal QƏSDƏN gmail-dir: `collabix.az` 2026-07-27-də DNS-də
  // QEYDİYYATDA DEYİL (NXDOMAIN, MX yoxdur) — yəni support@collabix.az
  // məktub QƏBUL EDƏ BİLMİR. Data-subject sorğusu (silmə/ixrac/etiraz)
  // çatmayan ünvan göstərmək placeholder-dən pisdir: placeholder açıq
  // şəkildə natamamdır, işləməyən ünvan isə SAXTA TƏSDİQDİR.
  email: 'muradofftehmez01@gmail.com',
  // Domen aktivləşdikdən sonra əsas kanal buna keçir (mətndə elan olunur).
  emailAlt: 'privacy@collabix.az',
  // VÖEN QƏSDƏN YOXDUR — qeydiyyat hələ tamamlanmayıb (sahibin qeydi).
  // Qeydiyyatdan sonra əlavə et; uydurma nömrə YAZMA.
  hours: 'B.e – Cümə, 10:00 – 18:00 (GMT+4)',
  // Ünvan Naxçıvandır — əvvəl bu link Bakıya işarə edirdi (uyğunsuzluq).
  mapsURL: 'https://maps.google.com/?q=Nakhchivan,Azerbaijan',
  // Footer sosial dəsti (TASK-6 / Ana#12) — sıra burada verildiyi kimi render olunur.
  // `icon` = techlogos.data.js açarı (rəsmi SVG); `mark` = loqo mövcud olmayanda mətn-nişan.
  //
  // ⚠ QƏSDƏN BOŞDUR (AUDIT-TASK-2 / 2.3). Əvvəl burada üç SINTAKTİK OLARAQ
  // ETİBARSIZ URL var idi: `https://discord.gg/[collabix]`,
  // `https://github.com/[collabix]`, `https://linkedin.com/company/[collabix]`.
  // Mötərizələr placeholder idi, yəni footer-dəki ikonlar klikləndikdə brauzer
  // xətası / 404 verirdi — və bu, aylarla canlı saytda qaldı.
  //
  // 2026-07-27-də 9 namizəd profil maşınla yoxlandı, HEÇ BİRİ mövcud deyil:
  //   x.com/collabixaz · github.com/collabixaz · youtube.com/@collabixaz → 404
  //   linkedin.com/company/collabixaz                                    → "isn't available"
  //   facebook / instagram / threads / tiktok                            → yalnız login divarı
  //   t.me/collabixaz                → mövcud OLMAYAN adla bayt-bayt eyni cavab
  //
  // QAYDA: sınıq link "tezliklə" mesajından da pisdir. Profil REAL yaradılana
  // qədər massiv boş qalır. Yaradıldıqdan sonra `{ id, label, icon|mark, url }`
  // əlavə et — `e2e/legal.spec.ts` hər URL-i avtomatik yoxlayacaq və sınıqsa
  // dəst qırmızı olacaq.
  social: [],
};

export const LEGAL = {
  // ⚠ `about` AÇARI SİLİNDİ — ölü məzmun idi.
  //   "Haqqımızda" səhifəsi artıq markdown deyil, struktur datadır:
  //   `js/about-content.js` → `ABOUT`. Burada qalsaydı, iki mənbə görünərdi
  //   və köhnə mətn (ikon kimi 🔥 emoji daxil) canlı sanılardı.

  privacy: {
    az: `*Son yenilənmə: 2026-07-28*

## 1. Kim məsuliyyət daşıyır?

Bu platforma **${SITE.company}** (${SITE.address}) tərəfindən idarə olunur. Data-subject sorğuları (silmə, ixrac, etiraz) üçün: **${SITE.email}** — rəsmi domen aktivləşdikdən sonra: ${SITE.emailAlt}. Məlumatların texniki emalında Cloudflare, Inc. xidmətlərindən **prosessor** qismində istifadə olunur (Workers, D1 verilənlər bazası, R2 fayl anbarı, KV).

## 2. Hansı məlumatları toplayırıq?

- **Hesab:** istifadəçi adı, şifrə (PBKDF2 ilə heşlənmiş, açıq mətn heç vaxt saxlanılmır), könüllü əlaqə e-poçtu;
- **Profil:** ad, doğum tarixi, cins, ölkə/şəhər, bio, bacarıqlar və səviyyələr, öyrənmə hədəfləri, sosial linklər, avatar;
- **Məzmun:** postlar, şərhlər, otaq mesajları, şəxsi mesajlar, tapşırıq həlləri, şikayətlər;
- **Aktivlik:** giriş günləri, aktivlik sayğacı (heatmap), XP/seriya göstəriciləri;
- **Texniki:** sessiya üçün localStorage (tema, dil, giriş vəziyyəti). Reklam cookie-ləri istifadə olunmur.

## 3. Məlumatlar nə üçün istifadə olunur?

Xidmətin göstərilməsi (profil, feed, mesajlaşma), təhlükəsizlik və moderasiya, statistika (icma göstəriciləri) və platformanın inkişafı üçün. Məlumatlarınız üçüncü tərəflərə **satılmır**.

## 4. Saxlama müddəti

Hesab aktiv olduğu müddətdə saxlanılır. Hesab silindikdə profil, istifadəçi adı, bildirişlər və avatar avtomatik silinir; icma məzmunu (postlar/şərhlər) siz silməyincə qala bilər.

**Mesaj arxivi.** Otaq və şəxsi mesajlar **90 gündən** sonra əsas bazadan sıxılmış arxiv anbarına köçürülür. Bu, **silinmə deyil**: arxivlənmiş mesajlar sizin üçün əlçatan qalır — söhbətdə «Daha köhnə mesajlar» düyməsi ilə oxunur və data ixracınıza daxil edilir.

**Hesab silindikdə arxiv.** Silinmə anından etibarən mesajlarınız arxiv oxunuşunda **dərhal gizlədilir** və heç kimə göstərilmir; arxiv fayllarından **fiziki silinmə** isə gündəlik təmizlik işi ilə, adətən 24 saat ərzində tamamlanır.

**Hesab silindikdə son 90 gün.** Arxivə köçməmiş (son 90 günlük) mesajlarınız **anonimləşdirilir**: adınız və hesab identifikatorunuz «Silinmiş istifadəçi» ilə əvəz olunur, mesajın **mətni isə söhbətdə qalır**. Səbəb: söhbət iki tərəflidir — mətni tamamilə silmək qarşı tərəfin öz yazışma tarixçəsini anlaşılmaz edərdi. Anonimləşdirmədən sonra həmin mesajlar sizinlə əlaqələndirilə bilmir.

## 5. Hüquqlarınız

- **Giriş və düzəliş** — profil redaktoru vasitəsilə istənilən vaxt;
- **Silinmə** — Parametrlər → Hesabı sil (tam təmizləmə ilə);
- **Data ixracı** — Parametrlər bölməsindən **özünüz** endirirsiniz (JSON və ya CSV); ixraca profil, postlar, şərhlər, mesajlar (arxivlənmişlər daxil), komanda üzvlükləri və əlaqə müraciətləriniz daxildir;
- **Şikayət** — ${SITE.email} və ya səlahiyyətli orqana müraciət.

Texniki qeyd: sui-istifadənin qarşısını almaq üçün data ixracı sorğusu saatda məhdud sayda emal olunur; limit aşıldıqda bir müddət sonra yenidən cəhd edə bilərsiniz.

GDPR prinsipləri və Azərbaycan Respublikasının "Fərdi məlumatlar haqqında" Qanunu nəzərə alınır. Yurisdiksiya: **${SITE.jurisdiction}**.

## 6. Uşaqlar

Platforma **yalnız 18+** istifadəçilər üçündür; qeydiyyatda yaş yoxlanılır.`,
    en: `*Last updated: 2026-07-28*

## 1. Who is responsible?

This platform is operated by **${SITE.company}** (${SITE.address}). For data-subject requests (deletion, export, objection): **${SITE.email}** — once the official domain is live: ${SITE.emailAlt}. Cloudflare, Inc. acts as a **processor** for technical data processing (Workers, D1 database, R2 file storage, KV).

## 2. What data we collect

- **Account:** username, password (hashed with PBKDF2, plaintext never stored), optional contact email;
- **Profile:** name, date of birth, gender, country/city, bio, skills & levels, goals, social links, avatar;
- **Content:** posts, comments, room messages, direct messages, task submissions, reports;
- **Activity:** login days, activity counters (heatmap), XP/streak;
- **Technical:** localStorage for session (theme, language, auth state). No advertising cookies.

## 3. Why we use it

To provide the service (profile, feed, messaging), for safety and moderation, community statistics and product improvement. Your data is **never sold**.

## 4. Retention

Data is kept while your account is active. On account deletion, your profile, username, notifications and avatar are removed automatically; community content may remain until you delete it.

**Message archive.** Room and direct messages are moved to compressed archive storage after **90 days**. This is **not deletion**: archived messages remain available to you — they load in the conversation via “Load older messages” and are included in your data export.

**Archive on account deletion.** From the moment of deletion your messages are **immediately hidden** from archive reads and shown to no one; **physical removal** from the archive files is completed by the daily maintenance job, normally within 24 hours.

**The last 90 days on account deletion.** Messages that have not yet moved to the archive (the last 90 days) are **anonymised**: your name and account identifier are replaced with “Deleted user”, while the **message text remains in the conversation**. The reason: a conversation has two sides — deleting the text outright would make the other person’s own history unreadable. After anonymisation those messages can no longer be linked to you.

## 5. Your rights

Access & correction (profile editor), deletion (Settings → Delete account), data export — you download it **yourself** from Settings (JSON or CSV), covering your profile, posts, comments, messages (including archived ones), team memberships and contact requests — complaint (${SITE.email} or your supervisory authority). Technical note: to prevent abuse, data-export requests are processed a limited number of times per hour; if the limit is reached, please retry later. GDPR principles and the Azerbaijani Law "On Personal Data" are respected. Jurisdiction: **${SITE.jurisdiction}**.

## 6. Children

The platform is **18+ only**; age is verified at registration.`,
    ru: `*Обновлено: 2026-07-28*

## 1. Ответственный

Платформой управляет **${SITE.company}** (${SITE.address}). Запросы субъекта данных (удаление, экспорт, возражение): **${SITE.email}** — после активации официального домена: ${SITE.emailAlt}. Cloudflare, Inc. выступает **процессором** данных (Workers, база данных D1, хранилище R2, KV).

## 2. Какие данные мы собираем

- **Аккаунт:** имя пользователя, пароль (хешированный PBKDF2, открытый текст не хранится), необязательный email;
- **Профиль:** имя, дата рождения, пол, страна/город, био, навыки и уровни, цели, соцсети, аватар;
- **Контент:** посты, комментарии, сообщения, решения заданий, жалобы;
- **Активность:** дни входа, счётчики активности, XP/серия;
- **Техническое:** localStorage (тема, язык, сессия). Рекламные cookie не используются.

## 3. Зачем

Для работы сервиса, безопасности и модерации, статистики и развития платформы. Данные **не продаются**.

## 4. Хранение

Пока аккаунт активен. При удалении аккаунта профиль, имя пользователя, уведомления и аватар удаляются автоматически.

**Архив сообщений.** Сообщения в комнатах и личные сообщения переносятся в сжатое архивное хранилище через **90 дней**. Это **не удаление**: архивные сообщения остаются доступны вам — они загружаются в беседе кнопкой «Загрузить старые сообщения» и включаются в экспорт данных.

**Архив при удалении аккаунта.** С момента удаления ваши сообщения **сразу скрываются** при чтении архива и никому не показываются; **физическое удаление** из архивных файлов выполняет ежедневная служебная задача, как правило в течение 24 часов.

**Последние 90 дней при удалении аккаунта.** Сообщения, ещё не перенесённые в архив (последние 90 дней), **анонимизируются**: имя и идентификатор аккаунта заменяются на «Удалённый пользователь», а **текст сообщения остаётся в беседе**. Причина: беседа двусторонняя — полное удаление текста сделало бы историю собеседника нечитаемой. После анонимизации эти сообщения невозможно связать с вами.

## 5. Ваши права

Доступ и исправление (редактор профиля), удаление (Настройки → Удалить аккаунт), экспорт данных — вы скачиваете его **самостоятельно** в Настройках (JSON или CSV); в него входят профиль, посты, комментарии, сообщения (включая архивные), участие в командах и ваши обращения — жалоба (${SITE.email}). Техническое примечание: во избежание злоупотреблений запросы на экспорт данных обрабатываются ограниченное число раз в час; при достижении лимита повторите попытку позже. Учитываются принципы GDPR и закон АР «О персональных данных». Юрисдикция: **${SITE.jurisdiction}**.

## 6. Дети

Платформа **только 18+**; возраст проверяется при регистрации.`,
  },

  terms: {
    az: `*Son yenilənmə: 2026-07-19*

## 1. Ümumi

Bu şərtlər **${SITE.company}** tərəfindən idarə olunan **${SITE.brand}** platformasından istifadəni tənzimləyir. Qeydiyyatdan keçməklə bu şərtləri qəbul edirsiniz.

## 2. Yaş tələbi

Platforma **yalnız 18 yaşdan yuxarı** şəxslər üçündür. Yanlış yaş bəyanı hesabın bağlanmasına səbəb olur.

## 3. Qadağan olunan davranış

Təhqir, nifrət nitqi, spam, digər istifadəçilərin şəxsi məlumatlarının icazəsiz paylaşılması, zərərli kod/link paylaşımı, qanunsuz məzmun. Pozuntular xəbərdarlıqsız blok ilə nəticələnə bilər.

## 4. Məzmun və mülkiyyət

Paylaşdığınız məzmunun müəllifi siz qalırsınız; platformaya onu göstərmək üçün qeyri-eksklüziv lisenziya verirsiniz. Başqalarının məzmununu mənbə göstərmədən paylaşmayın.

## 5. Hesabın dayandırılması

Qaydaları pozan hesablar admin qərarı ilə müvəqqəti və ya birdəfəlik bloklana bilər. Şikayət sistemi vasitəsilə etiraz etmək mümkündür.

## 6. Məsuliyyətin məhdudlaşdırılması

Platforma "olduğu kimi" təqdim olunur; istifadəçi məzmununa görə müəlliflər məsuliyyət daşıyır. Fasiləsiz işləmə zəmanəti verilmir.

## 7. Dəyişikliklər

Şərtlər yenilənə bilər; əhəmiyyətli dəyişikliklər platformada elan olunur. Davam edən istifadə yeni şərtlərin qəbulu sayılır.

Yurisdiksiya: **${SITE.jurisdiction}** qanunvericiliyi. Əlaqə: **${SITE.email}**.`,
    en: `*Last updated: 2026-07-19*

## 1. General

These terms govern the use of **${SITE.brand}**, operated by **${SITE.company}**. By signing up you accept them.

## 2. Age requirement

The platform is for persons **18 or older** only. Misstating your age leads to account termination.

## 3. Prohibited conduct

Harassment, hate speech, spam, sharing others' personal data without consent, malicious code/links, illegal content. Violations may result in a ban without prior warning.

## 4. Content & ownership

You remain the author of your content and grant the platform a non-exclusive license to display it. Do not share others' content without attribution.

## 5. Suspension

Accounts violating the rules may be temporarily or permanently blocked by admins. Appeals are possible via the report system.

## 6. Limitation of liability

The platform is provided "as is"; authors are responsible for their content. No uptime guarantee is given.

## 7. Changes

Terms may be updated; significant changes are announced on the platform. Continued use constitutes acceptance.

Jurisdiction: laws of **${SITE.jurisdiction}**. Contact: **${SITE.email}**.`,
    ru: `*Обновлено: 2026-07-19*

## 1. Общее

Настоящие условия регулируют использование **${SITE.brand}**, управляемого **${SITE.company}**. Регистрируясь, вы принимаете их.

## 2. Возраст

Платформа только для лиц **18+**. Ложные данные о возрасте ведут к блокировке.

## 3. Запрещено

Оскорбления, язык вражды, спам, разглашение чужих данных, вредоносный код/ссылки, незаконный контент. Нарушения могут привести к блокировке без предупреждения.

## 4. Контент

Вы остаётесь автором своего контента и даёте платформе неисключительную лицензию на его показ.

## 5. Блокировка

Аккаунты-нарушители могут быть заблокированы решением администрации.

## 6. Ответственность

Платформа предоставляется «как есть»; за пользовательский контент отвечают авторы.

## 7. Изменения

Условия могут обновляться; значимые изменения анонсируются. Продолжение использования — согласие.

Юрисдикция: законодательство **${SITE.jurisdiction}**. Контакт: **${SITE.email}**.`,
  },
};

// E-E-A-T: Security, Cookies, Changelog content (trust signals)
export const EEAT_CONTENT = {
  security: {
    az: `## Təhlükəsizlik siyasəti

Collabix istifadəçi məlumatlarının qorunmasını ciddi şəkildə prioritetləşdirir.

### Parol təhlükəsizliyi

Bütün parollar **PBKDF2 (600.000 iterasiya)** ilə heşlənir və heç vaxt açıq saxlanılmır. Heç kim — admin daxil — parolunuzu görə bilmir.

### Sessiya idarəetməsi

- Sessiyalar **HS256 JWT** ilə imzalanır
- Sessiya açarları **Cloudflare KV**-da saxlanılır
- Logout zamanı sessiya dərhal ləğv edilir
- 30 gün ərzində yenilənməyən sessiyalar avtomatik silinir

### Məlumat şifrələməsi

- Bütün əlaqə **HTTPS/TLS 1.3** üzərindən şifrələnir
- Cloudflare edge network ilə **DDoS** qoruması
- Rate limiting ilə brute-force hücumlarına qarşı müdafiə

### Təhlükəsizlik başlıqları

| Başlıq | Dəyər |
|--------|-------|
| Content-Security-Policy | Yalnız own-origin resurslar |
| Strict-Transport-Security | 2 illik HSTS + preload |
| X-Frame-Options | DENY (clickjacking qoruması) |
| X-Content-Type-Options | nosniff |
| Permissions-Policy | Kamera, mikrofon, geolokasiya deaktiv |
| Cross-Origin-Opener-Policy | same-origin |

### Zəiflik bildirişi

Təhlükəsizlik zəifliyi tapdınızsa, **${SITE.email}** ünvanına bildirin. Cavab müddəti: 48 saat.

### Məsul AI bəyanatı

Collabix AI texnologiyalarından istifadə etmir, lakin AI sistemlərinin saytı düzgün başa düşməsi üçün strukturlaşdırılmış məlumatlar (JSON-LD, FAQ, semantik HTML) təmin edir.`,
    en: `## Security Policy

Collabix takes user data protection seriously as a top priority.

### Password security

All passwords are hashed with **PBKDF2 (100,000 iterations)** and are never stored in plain text. Nobody — including admins — can see your password.

### Session management

- Sessions are signed with **HS256 JWT**
- Session keys are stored in **Cloudflare KV**
- Sessions are invalidated immediately on logout
- Sessions not refreshed within 30 days are automatically deleted

### Data encryption

- All connections are encrypted via **HTTPS/TLS 1.3**
- **DDoS** protection through Cloudflare edge network
- Rate limiting protects against brute-force attacks

### Security headers

| Header | Value |
|--------|-------|
| Content-Security-Policy | Own-origin resources only |
| Strict-Transport-Security | 2-year HSTS + preload |
| X-Frame-Options | DENY (clickjacking protection) |
| X-Content-Type-Options | nosniff |
| Permissions-Policy | Camera, microphone, geolocation disabled |
| Cross-Origin-Opener-Policy | same-origin |

### Vulnerability disclosure

If you find a security vulnerability, report it to **${SITE.email}**. Response time: 48 hours.

### Responsible AI statement

Collabix does not use AI technologies, but provides structured data (JSON-LD, FAQ, semantic HTML) so AI systems can properly understand the site.`,
    ru: `## Политика безопасности

Collabix серьёзно относится к защите данных пользователей.

### Безопасность паролей

Все пароли хешируются с помощью **PBKDF2 (100 000 итераций)** и никогда не хранятся в открытом виде. Никто, включая администраторов, не может увидеть ваш пароль.

### Управление сессиями

- Сессии подписываются **HS256 JWT**
- Ключи сессий хранятся в **Cloudflare KV**
- При выходе сессия немедленно аннулируется
- Сессии, не обновлённые в течение 30 дней, автоматически удаляются

### Шифрование данных

- Все соединения зашифрованы через **HTTPS/TLS 1.3**
- Защита от **DDoS** через сеть Cloudflare
- Rate limiting для защиты от brute-force атак

### Заголовки безопасности

| Заголовок | Значение |
|-----------|----------|
| Content-Security-Policy | Только собственные ресурсы |
| Strict-Transport-Security | HSTS на 2 года + preload |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Permissions-Policy | Камера, микрофон, геолокация отключены |

### Сообщение об уязвимости

Нашли уязвимость? Сообщите на **${SITE.email}**. Время ответа: 48 часов.`,
  },

  cookies: {
    az: `## Cookie siyasəti

### Hansı cookie-lərdən istifadə edirik?

Collabix yalnız **əsas funksional cookie-lərdən** istifadə edir. Reklam və ya izləmə cookie-ləri yoxdur.

| Cookie | Məqsəd | Müddət |
|--------|--------|--------|
| cx_sess | Sessiya autentifikasiyası | 30 gün |
| collabix_lang | Dil tərcihinin yadda saxlanması | Daimi |
| collabix_theme | Tema tərcihinin yadda saxlanması | Daimi |
| collabix_onboarded | Onboarding turun göstərilib-göstərilmədiyini yadda saxlama | Daimi |

### Üçüncü tərəf cookie-ləri

- **Google Fonts**: şrift fayllarını yükləyir (cookie yoxdur, yalnız preconnect)
- Analitika, reklam və ya sosial media izləmə cookie-ləri **istifadə olunmur**

### Cookie-ləri idarə etmək

Brauzerinizin tənzimləmələrindən cookie-ləri silə və ya blok edə bilərsiniz. cx_sess cookie-sini silsəniz, sessiyadan çıxmış olursunuz.`,
    en: `## Cookie Policy

### Which cookies do we use?

Collabix only uses **essential functional cookies**. There are no advertising or tracking cookies.

| Cookie | Purpose | Duration |
|--------|---------|----------|
| cx_sess | Session authentication | 30 days |
| collabix_lang | Language preference | Persistent |
| collabix_theme | Theme preference | Persistent |
| collabix_onboarded | Whether onboarding tour was shown | Persistent |

### Third-party cookies

- **Google Fonts**: loads font files (no cookies, preconnect only)
- Analytics, advertising, and social media tracking cookies are **not used**

### Managing cookies

You can delete or block cookies from your browser settings. Deleting the cx_sess cookie will log you out of your session.`,
    ru: `## Политика cookies

### Какие cookies мы используем?

Collabix использует только **необходимые функциональные cookies**. Рекламные или отслеживающие cookies отсутствуют.

| Cookie | Назначение | Срок |
|--------|-----------|------|
| cx_sess | Аутентификация сессии | 30 дней |
| collabix_lang | Языковые предпочтения | Постоянно |
| collabix_theme | Тема оформления | Постоянно |
| collabix_onboarded | Был ли показан вводный тур | Постоянно |

### Cookies третьих сторон

- **Google Fonts**: загружает шрифты (без cookies)
- Аналитические, рекламные и трекинговые cookies **не используются**

### Управление cookies

Вы можете удалить или заблокировать cookies в настройках браузера.`,
  },

  changelog: {
    az: `## Yenilik jurnalı və yol xəritəsi

### 🗺 Yol xəritəsi (gələcək planlar)

- [ ] Email bildirişləri
- [ ] İki faktorlu autentifikasiya (2FA)
- [ ] Mobil tətbiq (PWA)
- [ ] Açıq API
- [ ] Müəllim/mentor rolu
- [ ] Video söhbət otaqları
- [ ] Kod yarışmaları
- [ ] AI əsaslı tapşırıq tövsiyələri

---

### v2.0.0 — 2026-07-20

**Yeni xüsusiyyətlər:**
- ✅ Cloudflare Workers-ə tam miqrasiya (D1 + R2 + KV)
- ✅ Blok-əsaslı post sistemi (mətn + kod + şəkil)
- ✅ Çoxdilli interfeys (AZ/EN/RU)
- ✅ Tapşırıq təklifi və admin təsdiqi
- ✅ Aktivlik xəritəsi və XP sistemi
- ✅ Şəxsi mesajlaşma
- ✅ Bildiriş sistemi
- ✅ Komanda sistemi (admin əlavə/silmə, jurnal)
- ✅ Yeni public sayt (hero, xüsusiyyətlər, FAQ, rəylər)
- ✅ SEO, GEO, AEO, E-E-A-T tam optimizasiyası
- ✅ WCAG 2.2 AA uyğunluğu
- ✅ Tam təhlükəsizlik başlıq dəsti

### v1.0.0 — 2024

- İlk buraxılış (Firebase/Firestore)`,
    en: `## Changelog & Roadmap

### 🗺 Roadmap (future plans)

- [ ] Email notifications
- [ ] Two-factor authentication (2FA)
- [ ] Mobile app (PWA)
- [ ] Open API
- [ ] Teacher/mentor role
- [ ] Video chat rooms
- [ ] Coding competitions
- [ ] AI-powered task recommendations

---

### v2.0.0 — 2026-07-20

**New features:**
- ✅ Full migration to Cloudflare Workers (D1 + R2 + KV)
- ✅ Block-based post system (text + code + image)
- ✅ Multilingual interface (AZ/EN/RU)
- ✅ Task proposals and admin approval
- ✅ Activity heatmap and XP system
- ✅ Direct messaging
- ✅ Notification system
- ✅ Admin system (add/remove admins, audit log)
- ✅ New public site (hero, features, FAQ, testimonials)
- ✅ Full SEO, GEO, AEO, E-E-A-T optimization
- ✅ WCAG 2.2 AA compliance
- ✅ Complete security header suite

### v1.0.0 — 2024

- Initial release (Firebase/Firestore)`,
    ru: `## Журнал изменений и план развития

### 🗺 План развития

- [ ] Email-уведомления
- [ ] Двухфакторная аутентификация (2FA)
- [ ] Мобильное приложение (PWA)
- [ ] Открытый API
- [ ] Роль учителя/ментора
- [ ] Видеочат-комнаты
- [ ] Соревнования по программированию
- [ ] AI-рекомендации задач

---

### v2.0.0 — 2026-07-20

**Новые возможности:**
- ✅ Полная миграция на Cloudflare Workers (D1 + R2 + KV)
- ✅ Блочные посты (текст + код + изображения)
- ✅ Многоязычный интерфейс (AZ/EN/RU)
- ✅ Предложения задач и модерация
- ✅ Карта активности и XP
- ✅ Личные сообщения
- ✅ Система уведомлений
- ✅ Новый публичный сайт
- ✅ Полная SEO/GEO/AEO/E-E-A-T оптимизация

### v1.0.0 — 2024

- Первый релиз (Firebase/Firestore)`,
  },
};

// Default FAQ dəsti (seed + public fallback)
// Kateqoriyalar: account (hesab), privacy (məxfilik), security (təhlükəsizlik), 
// usage (istifadə), moderation (moderasiya)
export const DEFAULT_FAQS = [
  // ============================================================
  // KATEQORİYA 1: HESAB & QEYDİYYAT (ACCOUNT & REGISTRATION)
  // ============================================================
  {
    id: 'faq-account-1',
    category: 'account',
    order: 1,
    active: true,
    q: {
      az: 'Qeydiyyat pulludur?',
      en: 'Is registration paid?',
      ru: 'Регистрация платная?'
    },
    a: {
      az: 'Xeyr, **Collabix** tamamilə pulsuzdur. Bütün əsas funksiyalar — post paylaşmaq, şərh yazmaq, otaqlarda mesajlaşmaq, tapşırıq həll etmək və XP toplamaq — heç bir ödəniş tələb etmir. Gələcəkdə əlavə xüsusiyyətlər (məsələn, premium nişanlar) təqdim olunarsa, bu barədə istifadəçilərə əvvəlcədən məlumat veriləcək.',
      en: 'No, **Collabix** is completely free. All core features — posting, commenting, messaging in rooms, solving tasks, and earning XP — require no payment. If additional features (e.g., premium badges) are introduced in the future, users will be notified in advance.',
      ru: 'Нет, **Collabix** полностью бесплатен. Все основные функции — публикация постов, комментарии, обмен сообщениями в комнатах, решение задач и получение XP — не требуют оплаты. Если в будущем появятся дополнительные функции (например, премиум-бейджи), пользователи будут уведомлены заранее.'
    }
  },
  {
    id: 'faq-account-2',
    category: 'account',
    order: 2,
    active: true,
    q: {
      az: 'Email ünvanı mütləq tələb olunur?',
      en: 'Is an email address mandatory?',
      ru: 'Обязателен ли адрес электронной почты?'
    },
    a: {
      az: 'Xeyr. Qeydiyyatdan keçərkən **yalnız istifadəçi adı və şifrə** tələb olunur. Email tamamilə **könüllüdür**. Onu əlavə etsəniz, bu ünvandan iki halda istifadə olunacaq: (1) şifrənizi unutduqda müvəqqəti şifrə göndərmək, (2) vacib platforma xəbərdarlıqları (məsələn, təhlükəsizlik yeniləməsi) üçün. Email ünvanınız heç vaxt üçüncü tərəflərlə paylaşılmır.',
      en: 'No. **Only a username and password** are required to register. Email is completely **optional**. If you provide it, we will use it in two cases: (1) to send a temporary password if you forget yours, (2) for important platform announcements (e.g., security updates). Your email is never shared with third parties.',
      ru: 'Нет. Для регистрации требуются **только имя пользователя и пароль**. Электронная почта полностью **необязательна**. Если вы её укажете, мы будем использовать её в двух случаях: (1) для отправки временного пароля при его потере, (2) для важных уведомлений платформы (например, обновлений безопасности). Ваш email никогда не передаётся третьим лицам.'
    }
  },
  {
    id: 'faq-account-3',
    category: 'account',
    order: 3,
    active: true,
    q: {
      az: 'Yaş məhdudiyyəti varmı? Doğum tarixini niyə istəyirsiniz?',
      en: 'Is there an age limit? Why do you ask for my date of birth?',
      ru: 'Есть ли возрастное ограничение? Зачем вы запрашиваете дату рождения?'
    },
    a: {
      az: 'Bəli, platforma **yalnız 18 yaşdan yuxarı** şəxslər üçündür. Qeydiyyat zamanı doğum tarixini soruşuruq ki, yaş həddinə uyğunluğu yoxlaya bilək. Bu məlumat **yoxlanılır** və profilinizda başqalarına göstərilmir (yalnız sizin üçün saxlanılır). Yanlış yaş bəyan etdiyi aşkarlanan hesablar xəbərdarlıq edilmədən bağlanacaq.',
      en: 'Yes, the platform is **for users 18 and older only**. We ask for your date of birth during registration to verify age eligibility. This information is **validated** and is **not shown** to other users on your profile (it is stored only for internal verification). Accounts found to have misrepresented their age will be terminated without prior notice.',
      ru: 'Да, платформа предназначена **только для пользователей старше 18 лет**. При регистрации мы запрашиваем дату рождения для проверки возрастного ценза. Эта информация **проверяется** и **не отображается** в вашем профиле для других пользователей (хранится только для внутренней проверки). Аккаунты, уличенные в указании ложного возраста, будут заблокированы без предупреждения.'
    }
  },
  {
    id: 'faq-account-4',
    category: 'account',
    order: 4,
    active: true,
    q: {
      az: 'Hesabımı necə silə bilərəm? Nə baş verir?',
      en: 'How do I delete my account? What happens to my data?',
      ru: 'Как удалить аккаунт? Что произойдет с моими данными?'
    },
    a: {
      az: 'Hesabı silmək üçün **Parametrlər → Hesabı sil** bölməsinə keçin. Silindikdən dərhal sonra: profil, istifadəçi adı, avatar, bildirişlər **ani olaraq** silinir. Son 90 gün ərzində yazdığınız otaq/şəxsi mesajlar **anonimləşdirilir** (adınız "Silinmiş istifadəçi" ilə əvəz olunur, mətn qalır). 90 gündən köhnə arxivlənmiş mesajlarınız isə oxuculardan **dərhal gizlənir** və 24 saat ərzində fiziki olaraq məhv edilir. İcma postlarınız isə sizin tərəfinizdən silinməyibsə, müəllif "Silinmiş istifadəçi" kimi görünəcək.',
      en: 'To delete your account, go to **Settings → Delete account**. Immediately after deletion: your profile, username, avatar, and notifications are **instantly** removed. Room and direct messages from the last 90 days are **anonymized** (your name is replaced with "Deleted user", while the text remains). Your archived messages (older than 90 days) are **immediately hidden** from readers and physically purged within 24 hours. If you haven\'t manually deleted your community posts, their author will be shown as "Deleted user".',
      ru: 'Чтобы удалить аккаунт, перейдите в **Настройки → Удалить аккаунт**. Сразу после удаления: ваш профиль, имя пользователя, аватар и уведомления **мгновенно** удаляются. Сообщения в комнатах и личные сообщения за последние 90 дней **анонимизируются** (ваше имя заменяется на "Удаленный пользователь", текст остается). Ваши архивные сообщения (старше 90 дней) **немедленно скрываются** от читателей и физически удаляются в течение 24 часов. Если вы не удалили свои посты вручную, их автором будет указан "Удаленный пользователь".'
    }
  },

  // ============================================================
  // KATEQORİYA 2: MƏXFİLİK & DATA (PRIVACY & DATA)
  // ============================================================
  {
    id: 'faq-privacy-1',
    category: 'privacy',
    order: 5,
    active: true,
    q: {
      az: 'Məlumatlarımı kimlər görə bilər? Üçüncü tərəflərlə paylaşılırmı?',
      en: 'Who can see my data? Is it shared with third parties?',
      ru: 'Кто может видеть мои данные? Передаются ли они третьим лицам?'
    },
    a: {
      az: 'Məlumatlarınız heç vaxt üçüncü tərəflərə **satılmır** və marketinq məqsədilə paylaşılmır. Profil məlumatlarınız (ad, bio, bacarıqlar) digər platforma istifadəçilərinə göstərilir. Texniki emal üçün **Cloudflare, Inc.** (Workers, D1 verilənlər bazası, R2 fayl anbarı, KV) ilə işləyirik — onlar bizim üçün **məlumat emalçısı (prosessor)** kimi çıxış edir və Avropa Komissiyasının Standart Müqavilə Şərtlərinə (SCC) uyğun fəaliyyət göstərirlər. Şifrəniz, e-poçtunuz və sessiya məlumatlarınız heç bir istifadəçiyə (administratorlara belə) açıq görünmür.',
      en: 'Your data is **never sold** or shared with third parties for marketing purposes. Your profile information (name, bio, skills) is visible to other platform users. For technical processing, we work with **Cloudflare, Inc.** (Workers, D1 database, R2 storage, KV) — they act as our **data processors** and operate in compliance with the EU Standard Contractual Clauses (SCC). Your password, email, and session data are never visible to any user (including administrators).',
      ru: 'Ваши данные **никогда не продаются** и не передаются третьим лицам в маркетинговых целях. Информация вашего профиля (имя, био, навыки) видна другим пользователям платформы. Для технической обработки мы работаем с **Cloudflare, Inc.** (Workers, D1, R2, KV) — они выступают в роли наших **процессоров данных** и действуют в соответствии со Стандартными договорными положениями ЕС (SCC). Ваш пароль, email и данные сессии никогда не видны никому из пользователей (включая администраторов).'
    }
  },
  {
    id: 'faq-privacy-2',
    category: 'privacy',
    order: 6,
    active: true,
    q: {
      az: 'Məlumatlarımın ixracını (export) necə edə bilərəm?',
      en: 'How can I export my data?',
      ru: 'Как я могу экспортировать свои данные?'
    },
    a: {
      az: 'Bütün məlumatlarınızı **Parametrlər → Məlumat ixracı** bölməsindən özünüz endirə bilərsiniz. Endirdiyiniz fayl (JSON və ya CSV formatında) aşağıdakıları əhatə edir: tam profil, bütün postlar, şərhlər, otaq və şəxsi mesajlar (arxivlənmişlər daxil olmaqla), XP tarixçəsi, qazanılmış nişanlar, komanda üzvlükləri və əlaqə sorğuları. Fayl hazırlandıqdan sonra birbaşa brauzerinizə yüklənir. Texniki məhdudiyyət: sui-istifadənin qarşısını almaq üçün saatda məhdud sayda sorğu qəbul edilir; limit aşıldıqda bir müddət sonra yenidən cəhd edin.',
      en: 'You can download all your data yourself from **Settings → Export Data**. The downloaded file (in JSON or CSV format) includes: your full profile, all posts, comments, room and direct messages (including archived ones), XP history, earned badges, team memberships, and contact requests. The file is generated and downloaded directly to your browser. Technical limitation: to prevent abuse, a limited number of requests are processed per hour; if you hit the limit, please retry later.',
      ru: 'Вы можете самостоятельно скачать все свои данные в разделе **Настройки → Экспорт данных**. Загружаемый файл (в формате JSON или CSV) включает: полный профиль, все посты, комментарии, сообщения в комнатах и личные сообщения (включая архивные), историю XP, полученные бейджи, участие в командах и ваши обращения. Файл генерируется и загружается непосредственно в ваш браузер. Техническое ограничение: во избежание злоупотреблений обрабатывается ограниченное число запросов в час; при достижении лимита повторите попытку позже.'
    }
  },
  {
    id: 'faq-privacy-3',
    category: 'privacy',
    order: 7,
    active: true,
    q: {
      az: 'Köhnə mesajlarım harada saxlanılır? "Arxiv" nə deməkdir?',
      en: 'Where are my old messages stored? What does "archive" mean?',
      ru: 'Где хранятся мои старые сообщения? Что значит "архив"?'
    },
    a: {
      az: 'Otaq və şəxsi mesajlar **90 gündən** sonra əsas sürətli verilənlər bazasından çıxarılaraq sıxılmış **arxiv anbarına** (R2) köçürülür. Bu **silmə deyil** — arxivləşdirilmiş mesajlar sizin üçün əlçatan qalır: söhbət ekranında "Daha köhnə mesajlar" düyməsi ilə onları yükləyə bilərsiniz. Bu mesajlar həm də data ixracına daxil edilir. Arxiv fiziki olaraq Cloudflare R2-də şifrələnmiş şəkildə saxlanılır.',
      en: 'Room and direct messages are moved from the primary fast database to compressed **archive storage** (R2) after **90 days**. This is **not deletion** — archived messages remain accessible to you: you can load them in the chat via the "Load older messages" button. They are also included in your data export. The archive is stored encrypted in Cloudflare R2.',
      ru: 'Сообщения в комнатах и личные сообщения через **90 дней** перемещаются из основной быстрой базы данных в сжатое **архивное хранилище** (R2). Это **не удаление** — архивные сообщения остаются доступными для вас: вы можете загрузить их в чате через кнопку "Загрузить старые сообщения". Они также включаются в экспорт данных. Архив хранится в зашифрованном виде в Cloudflare R2.'
    }
  },

  // ============================================================
  // KATEQORİYA 3: TƏHLÜKƏSİZLİK (SECURITY)
  // ============================================================
  {
    id: 'faq-security-1',
    category: 'security',
    order: 8,
    active: true,
    q: {
      az: 'Şifrəm nə dərəcədə təhlükəsizdir?',
      en: 'How secure is my password?',
      ru: 'Насколько безопасен мой пароль?'
    },
    a: {
      az: 'Şifrələr **heç vaxt** açıq mətndə saxlanılmır. Qeydiyyat və daxil olma zamanı şifrəniz dərhal **PBKDF2-HMAC-SHA256** alqoritmi ilə (310.000 iterasiya) heşlənir (hash) və bazaya bu heşlənmiş versiya yazılır. Bu o deməkdir ki, nə adminlər, nə də başqa heç kim şifrənizi oxuya bilməz. Şifrənizi yalnız siz bilirsiniz. Əlavə olaraq, giriş cəhdləri **rate limiting** ilə məhdudlaşdırılır ki, brute-force (qüvvə ilə sındırma) hücumlarının qarşısı alınsın.',
      en: 'Passwords are **never** stored in plain text. During registration and login, your password is immediately hashed using **PBKDF2-HMAC-SHA256** (310,000 iterations), and only this hashed version is stored in the database. This means neither admins nor anyone else can read your password — only you know it. Additionally, login attempts are protected by **rate limiting** to prevent brute-force attacks.',
      ru: 'Пароли **никогда** не хранятся в открытом виде. При регистрации и входе ваш пароль немедленно хешируется с помощью **PBKDF2-HMAC-SHA256** (310 000 итераций), и в базе данных сохраняется только эта хешированная версия. Это означает, что ни администраторы, ни кто-либо ещё не могут прочитать ваш пароль — только вы его знаете. Кроме того, попытки входа ограничены по частоте (**rate limiting**) для предотвращения атак перебором (brute-force).'
    }
  },
  {
    id: 'faq-security-2',
    category: 'security',
    order: 9,
    active: true,
    q: {
      az: 'Şifrəmi unutmuşam. Nə etməliyəm?',
      en: 'I forgot my password. What should I do?',
      ru: 'Я забыл пароль. Что делать?'
    },
    a: {
      az: 'Giriş ekranında **"Parolu unutmusan?"** linkinə klikləyin. Əgər qeydiyyat zamanı e-poçt ünvanınızı daxil etmisinizsə, sistem həmin ünvana müvəqqəti (bir dəfəlik) şifrə göndərəcək. Bu şifrə ilə daxil olduqdan sonra profilinizdən yeni, daimi şifrə təyin edə bilərsiniz. **Email daxil etməmisinizsə**, zəhmət olmasa dəstək xidmətinə (`${SITE.email}`) müraciət edin — administrator şəxsiyyətinizi təsdiqlədikdən sonra hesabınıza müvəqqəti giriş yaradacaq.',
      en: 'Click the **"Forgot password?"** link on the login screen. If you provided an email address during registration, the system will send a temporary (one-time) password to that address. Once logged in with this password, you can set a new permanent password in your profile. **If you did not provide an email**, please contact support at `${SITE.email}` — after verifying your identity, an administrator will grant temporary access to your account.',
      ru: 'Нажмите ссылку **"Забыли пароль?"** на экране входа. Если вы указали адрес электронной почты при регистрации, система отправит временный (одноразовый) пароль на этот адрес. Войдя с этим паролем, вы сможете установить новый постоянный пароль в своем профиле. **Если вы не указали email**, обратитесь в службу поддержки (`${SITE.email}`) — после проверки личности администратор предоставит вам временный доступ к аккаунту.'
    }
  },
  {
    id: 'faq-security-3',
    category: 'security',
    order: 10,
    active: true,
    q: {
      az: 'Sessiyam nə vaxt bitir? Birdən çox cihazda daxil ola bilərəmmi?',
      en: 'When does my session expire? Can I log in from multiple devices?',
      ru: 'Когда истекает моя сессия? Могу ли я войти с нескольких устройств?'
    },
    a: {
      az: 'Hər daxil olanda sizin üçün **JWT (HS256)** ilə imzalanmış unikal sessiya yaradılır və **Cloudflare KV**-da saxlanılır. Sessiya **30 gün** ərzində yenilənmədikdə avtomatik silinir. Siz istədiyiniz qədər cihazda eyni hesabla daxil ola bilərsiniz — hər cihaz üçün ayrıca sessiya yaradılır. **Çıxış (Logout)** etdikdə həmin cihazdakı sessiya dərhal ləğv edilir. Başqa cihazlardakı sessiyalar isə aktiv qalır.',
      en: 'Each time you log in, a unique session is created, signed with **JWT (HS256)** and stored in **Cloudflare KV**. Sessions automatically expire after **30 days** of inactivity. You can log in to your account from as many devices as you like — each device gets its own separate session. **Logging out** immediately invalidates that specific device\'s session. Sessions on other devices remain active.',
      ru: 'При каждом входе создается уникальная сессия, подписанная с помощью **JWT (HS256)** и хранящаяся в **Cloudflare KV**. Сессия автоматически истекает через **30 дней** бездействия. Вы можете войти в свой аккаунт с любого количества устройств — для каждого устройства создается отдельная сессия. **Выход** из системы немедленно аннулирует сессию на этом устройстве. Сессии на других устройствах остаются активными.'
    }
  },

  // ============================================================
  // KATEQORİYA 4: PLATFORMA & İSTİFADƏ (PLATFORM & USAGE)
  // ============================================================
  {
    id: 'faq-usage-1',
    category: 'usage',
    order: 11,
    active: true,
    q: {
      az: 'XP (təcrübə xalı) və nişanları necə qazanım?',
      en: 'How do I earn XP (experience points) and badges?',
      ru: 'Как заработать XP (очки опыта) и бейджи?'
    },
    a: {
      az: 'XP aktivliyə görə avtomatik verilir: yeni post paylaşmaq (+10 XP), şərh yazmaq (+5 XP), tapşırıq həllinizin administrator tərəfindən təsdiqlənməsi (+50 XP), gündəlik daxil olmaq (+2 XP). Müəyyən XP həddinə çatdıqda nişanlar avtomatik olaraq profilinizə əlavə olunur (məsələn, "İlk post", "10 həll", "30 günlük seriya"). Bütün XP və nişan tarixçəniz profilinizin "Statistika" bölməsində izlənilə bilər.',
      en: 'XP is awarded automatically for activity: creating a new post (+10 XP), writing a comment (+5 XP), having your task solution approved by an admin (+50 XP), and daily login (+2 XP). Badges are added to your profile automatically when you reach certain XP milestones (e.g., "First Post", "10 Solutions", "30-Day Streak"). Your full XP and badge history can be viewed in the "Statistics" section of your profile.',
      ru: 'XP начисляется автоматически за активность: создание нового поста (+10 XP), написание комментария (+5 XP), одобрение администратором вашего решения задачи (+50 XP), ежедневный вход (+2 XP). Бейджи автоматически добавляются в ваш профиль при достижении определенных порогов XP (например, "Первый пост", "10 решений", "30-дневная серия"). Полная история XP и бейджей доступна в разделе "Статистика" вашего профиля.'
    }
  },
  {
    id: 'faq-usage-2',
    category: 'usage',
    order: 12,
    active: true,
    q: {
      az: '🔥 Gündəlik seriya (streak) necə işləyir?',
      en: 'How does the daily streak (🔥) work?',
      ru: 'Как работает ежедневная серия (🔥)?'
    },
    a: {
      az: 'Seriya hər gün platformaya daxil olub **heç olmasa bir hərəkət** etdikdə (post paylaşmaq, şərh yazmaq və ya tapşırıq göndərmək) artır. Seriyanı saxlamaq üçün hər 24 saatda bir dəfə aktiv olmaq kifayətdir. Əgər bir gün aktivlik etməsəniz, seriyanız **sıfırlanır** (0-a düşür). Seriya göstəricisi profilinizdə və başlıq panelində görünür. Uzun seriyalar (məsələn, 30, 100, 365 gün) üçün xüsusi nişanlar nəzərdə tutulub.',
      en: 'Your streak increases when you log in and perform **at least one action** (e.g., posting, commenting, or submitting a task) each day. To keep your streak alive, you only need to be active once every 24 hours. If you miss a day of activity, your streak **resets to zero**. Your streak counter is displayed on your profile and header bar. Special badges are awarded for long streaks (e.g., 30, 100, and 365 days).',
      ru: 'Серия увеличивается, когда вы входите на платформу и совершаете **хотя бы одно действие** (например, публикуете пост, пишете комментарий или отправляете задание) каждый день. Чтобы сохранить серию, достаточно быть активным раз в 24 часа. Если вы пропустите день активности, ваша серия **сбрасывается до нуля**. Счетчик серии отображается в вашем профиле и в верхней панели. За длинные серии (например, 30, 100, 365 дней) предусмотрены специальные бейджи.'
    }
  },
  {
    id: 'faq-usage-3',
    category: 'usage',
    order: 13,
    active: true,
    q: {
      az: 'Postda kod paylaşanda avtomatik highlighting olurmu?',
      en: 'Is there automatic syntax highlighting when I share code in a post?',
      ru: 'Будет ли автоматическая подсветка синтаксиса, если я поделюсь кодом в посте?'
    },
    a: {
      az: 'Bəli. Post yazarkən "Kod bloku" əlavə edin və açılan siyahıdan proqramlaşdırma dilini seçin (JavaScript, Python, Java, C++, Rust, Go və s.). Sistem avtomatik olaraq həmin dilin sintaksisinə uyğun rəngləmə (highlighting) tətbiq edəcək. Bu, həm oxunaqlılığı artırır, həm də kodun strukturunu aydın şəkildə göstərir. Highlighting bütün istifadəçilər üçün eyni görünür.',
      en: 'Yes. When writing a post, add a "Code block" and select the programming language from the dropdown (JavaScript, Python, Java, C++, Rust, Go, etc.). The system will automatically apply syntax highlighting based on that language. This improves readability and clearly displays the code structure. The highlighting looks the same for all users.',
      ru: 'Да. При написании поста добавьте "Блок кода" и выберите язык программирования из выпадающего списка (JavaScript, Python, Java, C++, Rust, Go и др.). Система автоматически применит подсветку синтаксиса в соответствии с этим языком. Это повышает читаемость и наглядно показывает структуру кода. Подсветка выглядит одинаково для всех пользователей.'
    }
  },

  // ============================================================
  // KATEQORİYA 5: MODERASİYA & QAYDALAR (MODERATION & RULES)
  // ============================================================
  {
    id: 'faq-moderation-1',
    category: 'moderation',
    order: 14,
    active: true,
    q: {
      az: 'Qaydaları pozan məzmun və ya istifadəçi görsəm, nə etməliyəm?',
      en: 'What should I do if I see content or a user that violates the rules?',
      ru: 'Что делать, если я вижу контент или пользователя, нарушающего правила?'
    },
    a: {
      az: 'Hər bir post, şərh və istifadəçi profilində **"Şikayət et" (🚩 bayraq)** düyməsi var. Ona klikləyib şikayət səbəbini qeyd edin. Bütün şikayətlər administrator tərəfindən **48 saat ərzində** nəzərdən keçirilir. Şikayət əsaslandırılmış olarsa, məzmun silinir və ya istifadəçiyə qarşı müvafiq tədbirlər (xəbərdarlıq, müvəqqəti və ya daimi blok) tətbiq edilir. Siz şikayətinizin statusunu şəxsi mesajlarınızda izləyə bilərsiniz.',
      en: 'Every post, comment, and user profile has a **"Report" (🚩 flag)** button. Click it and describe the reason for your report. All reports are reviewed by an administrator within **48 hours**. If the report is justified, the content will be removed or the user will face appropriate action (warning, temporary ban, or permanent ban). You can track the status of your report in your direct messages.',
      ru: 'Каждый пост, комментарий и профиль пользователя имеют кнопку **"Пожаловаться" (🚩 флаг)**. Нажмите её и укажите причину жалобы. Все жалобы рассматриваются администратором в течение **48 часов**. Если жалоба обоснована, контент будет удален, а к пользователю будут применены соответствующие меры (предупреждение, временная или постоянная блокировка). Статус вашей жалобы можно отслеживать в личных сообщениях.'
    }
  },
  {
    id: 'faq-moderation-2',
    category: 'moderation',
    order: 15,
    active: true,
    q: {
      az: 'Bloklansam, etiraz edə bilərəmmi?',
      en: 'Can I appeal if I get banned?',
      ru: 'Могу ли я обжаловать бан?'
    },
    a: {
      az: 'Bəli. Əgər hesabınız bloklanıbsa və bu qərarın səhv olduğunu düşünürsünüzsə, rəsmi əlaqə ünvanımıza (`${SITE.email}`) müraciət edə bilərsiniz. Müraciətinizdə istifadəçi adınızı, blok tarixini və qısa izahatınızı qeyd edin. Administrator müraciəti **5 iş günü** ərzində yenidən araşdıracaq. Əgər blok səhvən tətbiq edilibsə, hesabınız bərpa olunacaq; əks halda blok qüvvədə qalacaq. Təkrar ciddi pozuntular zamanı etiraz hüququ məhdudlaşdırıla bilər.',
      en: 'Yes. If your account is banned and you believe the decision was incorrect, you can appeal by contacting our official address (`${SITE.email}`). In your appeal, include your username, the ban date, and a brief explanation. An administrator will review your case within **5 business days**. If the ban was applied by mistake, your account will be restored; otherwise, the ban remains in place. In cases of repeated severe violations, the right to appeal may be limited.',
      ru: 'Да. Если ваш аккаунт заблокирован, и вы считаете это решение ошибочным, вы можете подать апелляцию, обратившись по нашему официальному адресу (`${SITE.email}`). В обращении укажите ваше имя пользователя, дату блокировки и краткое объяснение. Администратор рассмотрит ваше обращение в течение **5 рабочих дней**. Если бан был применен ошибочно, ваш аккаунт будет восстановлен; в противном случае бан останется в силе. При повторных серьезных нарушениях право на апелляцию может быть ограничено.'
    }
  },
  {
    id: 'faq-moderation-3',
    category: 'moderation',
    order: 16,
    active: true,
    q: {
      az: 'Platformada hansı məzmun qadağandır?',
      en: 'What type of content is prohibited on the platform?',
      ru: 'Какой контент запрещен на платформе?'
    },
    a: {
      az: 'Aşağıdakı məzmun qəti qadağandır: **təhqir, nifrət nitqi, ayrı-seçkilik**, spam, digər istifadəçilərin razılığı olmadan şəxsi məlumatlarını paylaşmaq (doxxing), zərərli kod və ya linklər, qanunsuz fəaliyyətə təşviq, açıq-saçıq pornoqrafik materiallar və müəllif hüquqları pozulan məzmun. Həmçinin, platforma xarici dillər və proqramlaşdırma öyrənmək məqsədi daşıdığı üçün mövzudan kənar (off-topic) daimi paylaşımlar da məhdudlaşdırıla bilər. Qaydaların tam siyahısı **İstifadə Şərtləri (Terms of Service)** sənədində verilmişdir.',
      en: 'The following content is strictly prohibited: **harassment, hate speech, discrimination**, spam, sharing other users\' personal data without consent (doxxing), malicious code or links, incitement to illegal activity, explicit pornographic material, and copyrighted content. Additionally, since the platform is focused on learning languages and programming, persistent off-topic posts may also be restricted. The full list of rules is provided in the **Terms of Service**.',
      ru: 'Следующий контент строго запрещен: **оскорбления, язык вражды, дискриминация**, спам, распространение личных данных других пользователей без их согласия (доксинг), вредоносный код или ссылки, призывы к незаконным действиям, откровенный порнографический материал и контент, нарушающий авторские права. Кроме того, поскольку платформа ориентирована на изучение языков и программирования, постоянные посты не по теме (off-topic) также могут быть ограничены. Полный список правил приведен в документе **Условия использования (Terms of Service)**.'
    }
  }
];

// Default testimonial dəsti (seed + public fallback)
export const DEFAULT_TESTIMONIALS = [
  {
    id: 't1', authorName: 'Aysel M.', authorTitle: { az: 'Python öyrənən', en: 'Python learner', ru: 'Изучает Python' }, rating: 5, featured: true, approved: true,
    text: { az: 'Study-partner tapmaq heç vaxt bu qədər asan olmamışdı. Seriya sistemi məni hər gün öyrənməyə məcbur edir 🔥', en: 'Finding a study partner was never this easy. The streak system keeps me learning daily 🔥', ru: 'Найти партнёра по учёбе никогда не было так просто. Серия мотивирует каждый день 🔥' }
  },
  {
    id: 't2', authorName: 'Rauf H.', authorTitle: { az: 'Frontend developer', en: 'Frontend developer', ru: 'Frontend-разработчик' }, rating: 5, featured: true, approved: true,
    text: { az: 'Kod bloklarının highlighting-i və tapşırıq sistemi əladır — mentorluq etdiyim tələbələrlə burada işləyirəm.', en: 'Code highlighting and the task system are great — I work with my mentees right here.', ru: 'Подсветка кода и система заданий — отлично. Работаю здесь со своими менти.' }
  },
  {
    id: 't3', authorName: 'Nigar Q.', authorTitle: { az: 'İngilis dili həvəskarı', en: 'English enthusiast', ru: 'Изучает английский' }, rating: 4, featured: true, approved: true,
    text: { az: 'Dil otaqlarında hər gün praktika edirəm. İcma çox dəstəkləyicidir!', en: 'I practice daily in the language rooms. The community is super supportive!', ru: 'Практикуюсь каждый день в языковых комнатах. Сообщество очень поддерживает!' }
  },
];
