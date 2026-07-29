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
  about: {
    az: `## Missiyamız

Collabix — proqramlaşdırma və xarici dilləri **birlikdə** öyrənmək istəyən 18+ gənclər üçün icma platformasıdır. İnanırıq ki, öyrənmə tək yox, icma içində daha sürətli və daha maraqlıdır.

## Nə edirik?

- Study-partner, mentor və layihə komandası tapmağa kömək edirik;
- Kod paylaşımı, tapşırıq həlli və XP sistemi ilə praktik öyrənməni stimullaşdırırıq;
- Gündəlik seriya (🔥) və aktivlik xəritəsi ilə davamlılığı vərdiş halına gətiririk.

## Hekayəmiz

Collabix kiçik bir öyrənmə qrupunun "birlikdə öyrənək" ideyasından doğdu və indi çoxdilli, açıq icmaya çevrilir. Platforma daim istifadəçi rəyləri əsasında inkişaf etdirilir.

## Komanda

Collabix hazırda **müstəqil, tək nəfərlik layihədir** — Tahmaz Muradov (fərdi sahibkar) tərəfindən qurulur və idarə olunur. Komanda böyüdükcə bu bölmə real adlarla yenilənəcək.

## Dəyərlərimiz

**Açıqlıq** — hər səviyyədən öyrənənə hörmət. **Təhlükəsizlik** — 18+ icma, moderasiya və şikayət sistemi. **Davamlılıq** — kiçik gündəlik addımların gücü.`,
    en: `## Our mission

Collabix is a community platform for people 18+ who want to learn programming and languages **together**. We believe learning is faster and more fun in a community than alone.

## What we do

- Help you find study partners, mentors and project teams;
- Encourage hands-on learning with code sharing, tasks and an XP system;
- Build consistency with daily streaks (🔥) and an activity heatmap.

## Our story

Collabix grew out of a small study group's "let's learn together" idea and is becoming a multilingual open community, shaped continuously by user feedback.

## Team

Collabix is currently an **independent, one-person project**, built and maintained by Tahmaz Muradov (sole proprietor). This section will be updated with real names as the team grows.

## Values

**Openness** — respect for learners at every level. **Safety** — an 18+ community with moderation and reporting. **Consistency** — the power of small daily steps.`,
    ru: `## Наша миссия

Collabix — платформа-сообщество для людей 18+, которые хотят изучать программирование и языки **вместе**. Мы верим, что учиться в сообществе быстрее и интереснее, чем в одиночку.

## Что мы делаем

- Помогаем найти партнёров по учёбе, менторов и команды;
- Стимулируем практику через обмен кодом, задания и систему XP;
- Формируем привычку с помощью ежедневных серий (🔥) и карты активности.

## Наша история

Collabix вырос из идеи небольшой учебной группы «давайте учиться вместе» и превращается в многоязычное открытое сообщество.

## Команда

Collabix — **независимый проект одного человека**: его создаёт и поддерживает Тахмаз Мурадов (индивидуальный предприниматель). Раздел будет обновлён реальными именами по мере роста команды.

## Ценности

**Открытость**, **безопасность** (18+, модерация), **последовательность**.`,
  },

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

Bütün parollar **PBKDF2 (100.000 iterasiya)** ilə heşlənir və heç vaxt açıq saxlanılmır. Heç kim — admin daxil — parolunuzu görə bilmir.

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
export const DEFAULT_FAQS = [
  { id: 'reg1', category: 'account', order: 1, active: true,
    q: { az: 'Qeydiyyat pulludur?', en: 'Is registration paid?', ru: 'Регистрация платная?' },
    a: { az: 'Xeyr, Collabix tam pulsuzdur.', en: 'No, Collabix is completely free.', ru: 'Нет, Collabix полностью бесплатен.' } },
  { id: 'reg2', category: 'account', order: 2, active: true,
    q: { az: 'Email tələb olunur?', en: 'Do I need an email?', ru: 'Нужен ли email?' },
    a: { az: 'Xeyr — yalnız istifadəçi adı və şifrə kifayətdir. Email könüllüdür.', en: 'No — just a username and password. Email is optional.', ru: 'Нет — достаточно имени пользователя и пароля.' } },
  { id: 'age', category: 'account', order: 3, active: true,
    q: { az: 'Neçə yaşdan qoşulmaq olar?', en: 'What is the minimum age?', ru: 'С какого возраста можно?' },
    a: { az: 'Platforma yalnız 18 yaşdan yuxarı istifadəçilər üçündür.', en: 'The platform is for users 18 and older only.', ru: 'Платформа только для пользователей 18+.' } },
  { id: 'sec1', category: 'security', order: 4, active: true,
    q: { az: 'Şifrəm təhlükəsizdirmi?', en: 'Is my password safe?', ru: 'Мой пароль в безопасности?' },
    a: { az: 'Şifrələr PBKDF2 ilə heşlənmiş saxlanılır — heç kim (admin daxil) onları açıq şəkildə görə bilmir.', en: 'Passwords are stored hashed with PBKDF2 — nobody (including admins) can see them in plain text.', ru: 'Пароли хранятся в хешированном виде (PBKDF2) — никто, включая администраторов, не может их увидеть.' } },
  { id: 'sec2', category: 'security', order: 5, active: true,
    q: { az: 'Şifrəmi unutsam nə edim?', en: 'What if I forget my password?', ru: 'Что делать, если забыл пароль?' },
    a: { az: 'Giriş ekranındakı "Parolu unutmusan?" bölməsinə bax — admin sənə müvəqqəti parol təyin edəcək.', en: 'See "Forgot password?" on the login screen — an admin will set you a temporary password.', ru: 'См. «Забыли пароль?» на экране входа.' } },
  { id: 'use1', category: 'usage', order: 6, active: true,
    q: { az: 'XP və nişanlar necə qazanılır?', en: 'How do I earn XP and badges?', ru: 'Как заработать XP и бейджи?' },
    a: { az: 'Post paylaş (+10), şərh yaz (+5), tapşırıq həllin təsdiqlənsin (+50). Nişanlar avtomatik açılır.', en: 'Share posts (+10), comment (+5), get task solutions approved (+50). Badges unlock automatically.', ru: 'Посты (+10), комментарии (+5), одобренные решения (+50).' } },
  { id: 'use2', category: 'usage', order: 7, active: true,
    q: { az: 'Seriya (🔥) necə işləyir?', en: 'How do streaks (🔥) work?', ru: 'Как работает серия (🔥)?' },
    a: { az: 'Hər gün platformaya daxil olub aktiv olsan seriya artır; bir gün ötürsən sıfırlanır.', en: 'Log in and be active daily to grow your streak; missing a day resets it.', ru: 'Заходите и будьте активны каждый день; пропуск обнуляет серию.' } },
  { id: 'use3', category: 'usage', order: 8, active: true,
    q: { az: 'Kod paylaşanda highlighting varmı?', en: 'Is there code highlighting?', ru: 'Есть ли подсветка кода?' },
    a: { az: 'Bəli — post yazanda "Kod" bloku əlavə et, dili seç, avtomatik highlight olunur.', en: 'Yes — add a "Code" block to your post, pick a language, and it highlights automatically.', ru: 'Да — добавьте блок «Код» и выберите язык.' } },
];

// Default testimonial dəsti (seed + public fallback)
export const DEFAULT_TESTIMONIALS = [
  { id: 't1', authorName: 'Aysel M.', authorTitle: { az: 'Python öyrənən', en: 'Python learner', ru: 'Изучает Python' }, rating: 5, featured: true, approved: true,
    text: { az: 'Study-partner tapmaq heç vaxt bu qədər asan olmamışdı. Seriya sistemi məni hər gün öyrənməyə məcbur edir 🔥', en: 'Finding a study partner was never this easy. The streak system keeps me learning daily 🔥', ru: 'Найти партнёра по учёбе никогда не было так просто. Серия мотивирует каждый день 🔥' } },
  { id: 't2', authorName: 'Rauf H.', authorTitle: { az: 'Frontend developer', en: 'Frontend developer', ru: 'Frontend-разработчик' }, rating: 5, featured: true, approved: true,
    text: { az: 'Kod bloklarının highlighting-i və tapşırıq sistemi əladır — mentorluq etdiyim tələbələrlə burada işləyirəm.', en: 'Code highlighting and the task system are great — I work with my mentees right here.', ru: 'Подсветка кода и система заданий — отлично. Работаю здесь со своими менти.' } },
  { id: 't3', authorName: 'Nigar Q.', authorTitle: { az: 'İngilis dili həvəskarı', en: 'English enthusiast', ru: 'Изучает английский' }, rating: 4, featured: true, approved: true,
    text: { az: 'Dil otaqlarında hər gün praktika edirəm. İcma çox dəstəkləyicidir!', en: 'I practice daily in the language rooms. The community is super supportive!', ru: 'Практикуюсь каждый день в языковых комнатах. Сообщество очень поддерживает!' } },
];
