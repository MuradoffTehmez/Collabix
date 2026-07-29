// i18n: AZ / EN / RU. Statik UI mətnləri açarla (t), baza məzmunu çoxdilli field-lə.
// Dil localStorage-da yadda qalır; dəyişəndə data-i18n elementləri yenidən yazılır.
export const LANGS = ['az', 'en', 'ru'];
const KEY = 'collabix_lang';
let current = localStorage.getItem(KEY) || 'az';

const D = {
  /* ---------- header / nav ---------- */
  'nav.home':      { az: 'Ana Səhifə', en: 'Home', ru: 'Главная' },
  'nav.about':     { az: 'Haqqımızda', en: 'About Us', ru: 'О нас' },
  'nav.faq':       { az: 'FAQ', en: 'FAQ', ru: 'FAQ' },
  'nav.teams':     { az: 'Komandalar', en: 'Teams', ru: 'Команды' },
  'teams.sub':     { az: 'İcma ilə birgə çalışın və komanda layihələri yaradın.', en: 'Collaborate with the community and build team projects.', ru: 'Сотрудничайте с сообществом и создавайте командные проекты.' },
  'teams.create':  { az: 'Yeni Komanda', en: 'New Team', ru: 'Новая команда' },
  'teams.overview': { az: 'İcmal', en: 'Overview', ru: 'Обзор' },
  'teams.members': { az: 'Üzvlər', en: 'Members', ru: 'Участники' },
  'teams.projects': { az: 'Layihələr', en: 'Projects', ru: 'Проекты' },
  'teams.tasks':   { az: 'Tapşırıqlar', en: 'Tasks', ru: 'Задания' },
  'teams.chat':    { az: 'Söhbət', en: 'Chat', ru: 'Чат' },
  'teams.settings': { az: 'Parametrlər', en: 'Settings', ru: 'Настройки' },
  'teams.activity': { az: 'Fəaliyyət', en: 'Activity', ru: 'Активность' },
  'teams.feed':    { az: 'Lent', en: 'Feed', ru: 'Лента' },
  'teams.files':   { az: 'Fayllar', en: 'Files', ru: 'Файлы' },
  'teams.statistics': { az: 'Statistika', en: 'Statistics', ru: 'Статистика' },
  'teams.scope_mine': { az: 'Komandalarım', en: 'My teams', ru: 'Мои команды' },
  'teams.scope_discover': { az: 'Kəşf et', en: 'Discover', ru: 'Обзор' },
  'teams.scope_invites': { az: 'Dəvətlər', en: 'Invites', ru: 'Приглашения' },
  'teams.search_ph': { az: 'Komanda axtar…', en: 'Search teams…', ru: 'Поиск команд…' },
  'nav.features':  { az: 'Xüsusiyyətlər', en: 'Features', ru: 'Возможности' },
  'nav.contact':   { az: 'Əlaqə', en: 'Contact', ru: 'Контакты' },
  'cta.login':     { az: 'Giriş', en: 'Log in', ru: 'Войти' },
  'cta.register':  { az: 'Qeydiyyatdan keç', en: 'Sign up', ru: 'Регистрация' },
  'cta.goapp':     { az: 'Tətbiqə keç', en: 'Open app', ru: 'В приложение' },
  'search.ph':     { az: 'FAQ və kömək üzrə axtar...', en: 'Search FAQ & help...', ru: 'Поиск по FAQ...' },
  'back.site':     { az: '← Sayta qayıt', en: '← Back to site', ru: '← На сайт' },

  /* ---------- hero ---------- */
  'hero.h1':       { az: 'Birlikdə öyrən. Kod yaz. İnkişaf et.', en: 'Learn together. Write code. Grow.', ru: 'Учись вместе. Пиши код. Развивайся.' },
  'hero.tagline':  { az: 'Collabix — proqramlaşdırma və xarici dilləri birgə öyrənmək üçün 18+ icma platforması.', en: 'Collabix is an 18+ community platform for learning programming and languages together.', ru: 'Collabix — платформа 18+ для совместного изучения программирования и языков.' },
  'hero.sub':      { az: 'Study-partner tap, kod paylaş, tapşırıqları həll et, XP qazan və seriya saxla — hamısı bir yerdə.', en: 'Find study partners, share code, solve tasks, earn XP and keep your streak — all in one place.', ru: 'Находи партнёров, делись кодом, решай задачи, зарабатывай XP и держи серию — всё в одном месте.' },
  'hero.cta1':     { az: 'Pulsuz qoşul', en: 'Join for free', ru: 'Присоединиться' },
  'hero.cta2':     { az: 'Necə işləyir?', en: 'How it works', ru: 'Как это работает' },

  /* ---------- features ---------- */
  'feat.title':    { az: 'Platformada nə var?', en: 'What’s inside?', ru: 'Что внутри?' },
  'feat.1t':       { az: 'Birgə öyrənmə', en: 'Learn together', ru: 'Совместное обучение' },
  'feat.1d':       { az: 'Skill və səviyyəyə görə study-partner, mentor və ya komanda tap.', en: 'Find study partners, mentors or teams by skill and level.', ru: 'Находи партнёров, менторов и команды по навыкам и уровню.' },
  'feat.2t':       { az: 'Kod paylaşımı', en: 'Code sharing', ru: 'Обмен кодом' },
  'feat.2d':       { az: 'Syntax highlighting ilə kod blokları, markdown postlar və şəkil qalereyaları.', en: 'Code blocks with syntax highlighting, markdown posts and image galleries.', ru: 'Код с подсветкой, markdown-посты и галереи изображений.' },
  'feat.3t':       { az: 'Tapşırıqlar və XP', en: 'Tasks & XP', ru: 'Задания и XP' },
  'feat.3d':       { az: 'Həll göndər, təsdiq al, XP + nişanlar qazan, liderlər lövhəsinə düş.', en: 'Submit solutions, get approved, earn XP + badges, climb the leaderboard.', ru: 'Отправляй решения, получай XP и бейджи, поднимайся в рейтинге.' },
  'feat.4t':       { az: 'Aktivlik seriyası', en: 'Activity streak', ru: 'Серия активности' },
  'feat.4d':       { az: 'GitHub-tipli aktivlik xəritəsi və gündəlik 🔥 seriya motivasiyası.', en: 'GitHub-style activity heatmap and daily 🔥 streak motivation.', ru: 'Карта активности в стиле GitHub и ежедневная 🔥 серия.' },
  'feat.5t':       { az: 'Otaqlar və mesajlar', en: 'Rooms & messages', ru: 'Комнаты и сообщения' },
  'feat.5d':       { az: 'Mövzu otaqları, şəxsi mesajlar, @mention və bildirişlər.', en: 'Topic rooms, direct messages, @mentions and notifications.', ru: 'Тематические комнаты, личные сообщения, @упоминания.' },
  'feat.6t':       { az: 'Çoxdilli icma', en: 'Multilingual community', ru: 'Многоязычное сообщество' },
  'feat.6d':       { az: 'Proqramlaşdırma dilləri ilə yanaşı İngilis, Alman, Rus və digər dillər.', en: 'Programming languages plus English, German, Russian and more.', ru: 'Языки программирования плюс английский, немецкий и другие.' },

  /* ---------- how it works ---------- */
  'how.title':     { az: 'Necə işləyir?', en: 'How it works', ru: 'Как это работает' },
  'how.1t':        { az: 'Qeydiyyatdan keç', en: 'Sign up', ru: 'Зарегистрируйся' },
  'how.1d':        { az: '4 addımlı sihirbazla profil yarat — skill-lərini və hədəflərini seç.', en: 'Create a profile with the 4-step wizard — pick your skills and goals.', ru: 'Создай профиль в 4 шага — выбери навыки и цели.' },
  'how.2t':        { az: 'İcmaya qoşul', en: 'Join the community', ru: 'Присоединяйся' },
  'how.2d':        { az: 'Maraqlarına uyğun insanları tap, izlə, otaqlarda söhbətə başla.', en: 'Find people who match your interests, follow them, join room chats.', ru: 'Находи людей по интересам, подписывайся, общайся в комнатах.' },
  'how.3t':        { az: 'Öyrən və paylaş', en: 'Learn & share', ru: 'Учись и делись' },
  'how.3d':        { az: 'Tapşırıqları həll et, öyrəndiklərini postla, sual ver, cavab al.', en: 'Solve tasks, post what you learn, ask questions, get answers.', ru: 'Решай задачи, публикуй прогресс, задавай вопросы.' },
  'how.4t':        { az: 'İnkişafını izlə', en: 'Track your growth', ru: 'Отслеживай рост' },
  'how.4d':        { az: 'XP, level, nişanlar və aktivlik xəritəsi ilə irəliləyişini gör.', en: 'See your progress with XP, levels, badges and the activity heatmap.', ru: 'Следи за прогрессом: XP, уровни, бейджи, карта активности.' },

  /* ---------- sidebar widgets ---------- */
  'sb.stats':      { az: 'Canlı statistika', en: 'Live stats', ru: 'Статистика' },
  'sb.users':      { az: 'istifadəçi', en: 'users', ru: 'пользователей' },
  'sb.posts':      { az: 'paylaşım', en: 'posts', ru: 'постов' },
  'sb.langs':      { az: 'dil / skill', en: 'languages / skills', ru: 'языков / навыков' },
  'sb.trends':     { az: 'Populyar sahələr', en: 'Trending topics', ru: 'Популярные темы' },
  'sb.trends_hint': { az: 'Nişana klik et — həmin sahə üzrə study-partner tap.', en: 'Click a badge to find study partners in that area.', ru: 'Нажми на значок — найди партнёров по этой теме.' },
  'sb.join':       { az: 'İcmaya qoşul, pulsuzdur 🚀', en: 'Join the community, it’s free 🚀', ru: 'Присоединяйся бесплатно 🚀' },

  /* ---------- kod paylaşımı vitrini (Ana#9) ---------- */
  'codeshow.title': { az: 'Kod paylaş, cavab al', en: 'Share code, get answers', ru: 'Делись кодом, получай ответы' },
  'codeshow.sub':  { az: 'Syntax highlighting, sətir nömrələri və bir kliklə kopyalama — postlarda və otaqlarda.', en: 'Syntax highlighting, line numbers and one-click copy — in posts and rooms.', ru: 'Подсветка синтаксиса, номера строк и копирование в один клик — в постах и комнатах.' },

  /* ---------- testimonials ---------- */
  'testi.title':   { az: 'İstifadəçilər nə deyir?', en: 'What users say', ru: 'Отзывы' },
  'testi.prev':    { az: 'Əvvəlki rəy', en: 'Previous testimonial', ru: 'Предыдущий отзыв' },
  'testi.next':    { az: 'Növbəti rəy', en: 'Next testimonial', ru: 'Следующий отзыв' },
  'testi.goto':    { az: 'Rəyə keç', en: 'Go to testimonial', ru: 'Перейти к отзыву' },
  'testi.carousel': { az: 'İstifadəçi rəyləri karuseli', en: 'User testimonials carousel', ru: 'Карусель отзывов' },

  /* ---------- FAQ ---------- */
  'faq.title':     { az: 'Tez-tez verilən suallar', en: 'Frequently asked questions', ru: 'Частые вопросы' },
  'faq.search':    { az: 'Sual axtar...', en: 'Search questions...', ru: 'Поиск вопросов...' },
  'faq.empty':     { az: 'Uyğun sual tapılmadı.', en: 'No matching questions found.', ru: 'Вопросы не найдены.' },
  'faq.cta':       { az: 'Cavab tapmadın? Qeydiyyatdan keç və icmadan soruş!', en: 'Didn’t find an answer? Sign up and ask the community!', ru: 'Не нашли ответ? Зарегистрируйтесь и спросите сообщество!' },

  /* ---------- contact ---------- */
  'contact.title': { az: 'Bizimlə əlaqə', en: 'Contact us', ru: 'Связаться с нами' },
  'contact.sub':   { az: 'Sual, təklif və ya problem — bizə yaz, ən qısa zamanda cavablayaq.', en: 'Questions, ideas or issues — write to us and we’ll get back soon.', ru: 'Вопросы и предложения — напишите нам.' },
  'contact.name':  { az: 'Adınız', en: 'Your name', ru: 'Ваше имя' },
  'contact.email': { az: 'E-poçt', en: 'Email', ru: 'Эл. почта' },
  'contact.msg':   { az: 'Mesajınız...', en: 'Your message...', ru: 'Ваше сообщение...' },
  'contact.send':  { az: 'Göndər', en: 'Send', ru: 'Отправить' },
  'contact.ok':    { az: 'Mesajınız göndərildi — təşəkkürlər!', en: 'Message sent — thank you!', ru: 'Сообщение отправлено!' },
  'contact.err':   { az: 'Göndərilə bilmədi — sahələri yoxlayın.', en: 'Could not send — check the fields.', ru: 'Не удалось отправить.' },
  'contact.addr':  { az: 'Ünvan', en: 'Address', ru: 'Адрес' },
  'contact.hours': { az: 'İş saatları', en: 'Working hours', ru: 'Часы работы' },
  'contact.map':   { az: 'Xəritədə bax', en: 'View on map', ru: 'На карте' },

  /* ---------- footer ---------- */
  'ft.nav':        { az: 'Sayt xəritəsi', en: 'Site map', ru: 'Карта сайта' },
  'ft.legal':      { az: 'Hüquqi', en: 'Legal', ru: 'Правовое' },
  'ft.privacy':    { az: 'Məxfilik siyasəti', en: 'Privacy Policy', ru: 'Политика конфиденциальности' },
  'ft.terms':      { az: 'İstifadə şərtləri', en: 'Terms & Conditions', ru: 'Условия использования' },
  'ft.contact':    { az: 'Əlaqə', en: 'Contact', ru: 'Контакты' },
  'ft.social':     { az: 'Sosial şəbəkələr', en: 'Social', ru: 'Соцсети' },
  'ft.newsTitle':  { az: 'Yeniliklərdən xəbərdar ol', en: 'Stay in the loop', ru: 'Будьте в курсе' },
  'ft.newsSub':    { az: 'Yeni funksiyalar və icma xəbərləri — ayda maksimum 1-2 məktub.', en: 'New features and community news — 1-2 emails a month max.', ru: 'Новости платформы — не чаще 1-2 писем в месяц.' },
  'ft.newsPh':     { az: 'e-poçt ünvanınız', en: 'your email', ru: 'ваш email' },
  'ft.newsBtn':    { az: 'Abunə ol', en: 'Subscribe', ru: 'Подписаться' },
  'ft.newsOk':     { az: 'Abunə olundunuz ✓', en: 'Subscribed ✓', ru: 'Вы подписаны ✓' },
  'ft.newsErr':    { az: 'Alınmadı — e-poçtu yoxlayın (bəlkə artıq abunəsiniz).', en: 'Failed — check the email (maybe already subscribed).', ru: 'Ошибка — проверьте email.' },
  'ft.rights':     { az: 'Bütün hüquqlar qorunur.', en: 'All rights reserved.', ru: 'Все права защищены.' },
  'ft.madeby':     { az: 'Collabix komandası tərəfindən 💙 ilə hazırlanıb', en: 'Made with 💙 by the Collabix team', ru: 'Сделано с 💙 командой Collabix' },

  /* ---------- app chrome ---------- */
  'app.searchPh':  { az: '⌕ Axtar: istifadəçi, post...', en: '⌕ Search users, posts...', ru: '⌕ Поиск...' },
  'app.logout':    { az: 'Çıxış et', en: 'Log out', ru: 'Выйти' },
  'nav.feed':      { az: 'Ana səhifə', en: 'Feed', ru: 'Лента' },
  'nav.rooms':     { az: 'Otaqlar', en: 'Rooms', ru: 'Комнаты' },
  'nav.dm':        { az: 'Mesajlar', en: 'Messages', ru: 'Сообщения' },
  'nav.notifs':    { az: 'Bildirişlər', en: 'Notifications', ru: 'Уведомления' },
  'nav.users':     { az: 'İstifadəçilər', en: 'Users', ru: 'Пользователи' },
  'nav.tasks':     { az: 'Tapşırıqlar', en: 'Tasks', ru: 'Задания' },
  'nav.stats':     { az: 'Statistika', en: 'Stats', ru: 'Статистика' },
  'nav.saved':     { az: 'Saxlanılanlar', en: 'Saved', ru: 'Сохранённые' },
  'nav.profile':   { az: 'Profil', en: 'Profile', ru: 'Профиль' },
  'nav.settings':  { az: 'Parametrlər', en: 'Settings', ru: 'Настройки' },
  'nav.admin':     { az: 'Admin panel', en: 'Admin panel', ru: 'Админ-панель' },

  /* ---------- settings ---------- */
  'set.theme':     { az: 'Tema', en: 'Theme', ru: 'Тема' },
  'set.theme.dark':   { az: '🌙 Tünd', en: '🌙 Dark', ru: '🌙 Тёмная' },
  'set.theme.light':  { az: '☀ Açıq', en: '☀ Light', ru: '☀ Светлая' },
  'set.theme.matrix': { az: '🖥 Matrix', en: '🖥 Matrix', ru: '🖥 Matrix' },
  'set.theme.cyberpunk': { az: '🤖 Cyberpunk', en: '🤖 Cyberpunk', ru: '🤖 Киберпанк' },
  'set.lang':      { az: 'Dil', en: 'Language', ru: 'Язык' },
  'set.privacy':   { az: 'Məxfilik', en: 'Privacy', ru: 'Приватность' },
  'set.whoMsg':    { az: 'Kim mənə mesaj yaza bilər?', en: 'Who can message me?', ru: 'Кто может мне писать?' },
  'set.whoMsg.everyone':  { az: 'Hamı', en: 'Everyone', ru: 'Все' },
  'set.whoMsg.following': { az: 'Yalnız izlədiklərim', en: 'Only people I follow', ru: 'Только те, на кого я подписан' },
  'set.whoMsg.mutual':    { az: 'Yalnız qarşılıqlı izləyənlər', en: 'Mutual follows only', ru: 'Только взаимные' },
  'set.showFollowing': { az: 'İzlədiklərim siyahım başqalarına görünsün', en: 'Others can see who I follow', ru: 'Показывать мои подписки' },
  'set.showOnline':    { az: 'Onlayn statusum görünsün', en: 'Show my online status', ru: 'Показывать онлайн-статус' },
  'set.notifs':    { az: 'Bildiriş tərcihləri', en: 'Notification preferences', ru: 'Уведомления' },
  'set.notif.likes':    { az: 'Like bildirişləri', en: 'Like notifications', ru: 'Лайки' },
  'set.notif.comments': { az: 'Şərh bildirişləri', en: 'Comment notifications', ru: 'Комментарии' },
  'set.notif.follows':  { az: 'İzləmə bildirişləri', en: 'Follow notifications', ru: 'Подписки' },
  'set.saved':     { az: 'Yadda saxlanıldı', en: 'Saved', ru: 'Сохранено' },

  /* ---------- sosial ---------- */
  'soc.followers':  { az: 'İzləyənlər', en: 'Followers', ru: 'Подписчики' },
  'soc.following':  { az: 'İzlədiklərim', en: 'Following', ru: 'Подписки' },
  'soc.followingOf':{ az: 'İzlədikləri', en: 'Following', ru: 'Подписки' },
  'soc.mutual':     { az: 'Qarşılıqlı', en: 'Mutual', ru: 'Взаимно' },
  'soc.follow':     { az: '+ İzlə', en: '+ Follow', ru: '+ Подписаться' },
  'soc.unfollow':   { az: '✓ İzlənilir', en: '✓ Following', ru: '✓ Подписан' },
  'soc.hidden':     { az: 'Bu siyahı gizlidir', en: 'This list is private', ru: 'Список скрыт' },
  'soc.msgBlocked': { az: 'Bu istifadəçi yalnız izlədiyi şəxslərdən mesaj qəbul edir', en: 'This user only accepts messages from people they follow', ru: 'Пользователь принимает сообщения только от тех, на кого подписан' },

  /* ---------- vaxt / presence ---------- */
  'time.now':      { az: 'indicə', en: 'just now', ru: 'только что' },
  'pres.online':   { az: 'onlayn', en: 'online', ru: 'онлайн' },
  'pres.last_seen':{ az: 'son görünmə', en: 'last seen', ru: 'был(а)' },

  /* ---------- mesajlar ---------- */
  'msg.attach':    { az: 'Fayl/şəkil göndər (maks 2MB)', en: 'Send file/image (max 2MB)', ru: 'Файл/фото (до 2МБ)' },
  'msg.code':      { az: 'Kod göndər', en: 'Send code', ru: 'Отправить код' },
  'msg.tooBig':    { az: 'Fayl 2 MB-dan böyükdür', en: 'File exceeds 2 MB', ru: 'Файл больше 2 МБ' },
  'msg.badType':   { az: 'Bu fayl tipi dəstəklənmir', en: 'File type not allowed', ru: 'Тип файла не поддерживается' },

  /* ---------- tasks ---------- */
  'task.propose':  { az: '＋ Tapşırıq təklif et', en: '＋ Propose a task', ru: '＋ Предложить задание' },
  'task.pending':  { az: 'Gözləyən tapşırıqlar', en: 'Pending tasks', ru: 'Ожидающие задания' },
  'task.proposed': { az: 'Təklifin göndərildi — admin təsdiqindən sonra görünəcək', en: 'Proposal sent — visible after admin approval', ru: 'Предложение отправлено' },

  /* ---------- page titles ---------- */
  'pg.about':      { az: 'Haqqımızda', en: 'About Us', ru: 'О нас' },
  'pg.privacy':    { az: 'Məxfilik siyasəti', en: 'Privacy Policy', ru: 'Политика конфиденциальности' },
  'pg.terms':      { az: 'İstifadə şərtləri', en: 'Terms & Conditions', ru: 'Условия использования' },
  'pg.security':   { az: 'Təhlükəsizlik siyasəti', en: 'Security Policy', ru: 'Политика безопасности' },
  'pg.cookies':    { az: 'Cookie siyasəti', en: 'Cookie Policy', ru: 'Политика cookies' },
  'pg.changelog':  { az: 'Yenilik jurnalı', en: 'Changelog & Roadmap', ru: 'Журнал изменений' },
  'legal.disclaimer': {
    az: '⚠ Bu mətn şablondur və hüquqi məsləhət deyil. Real istifadədən əvvəl hüquqşünasla dəqiqləşdirin.',
    en: '⚠ This text is a template and not legal advice. Consult a lawyer before production use.',
    ru: '⚠ Этот текст — шаблон, а не юридическая консультация. Проконсультируйтесь с юристом.',
  },

  /* ---------- footer (E-E-A-T) ---------- */
  'ft.security':   { az: 'Təhlükəsizlik', en: 'Security', ru: 'Безопасность' },
  'ft.cookies':    { az: 'Cookie siyasəti', en: 'Cookie Policy', ru: 'Cookies' },
  'ft.changelog':  { az: 'Yenilik jurnalı', en: 'Changelog', ru: 'Изменения' },

  /* ---------- cookie razılığı (GDPR — Ana#13) ---------- */
  'cookie.title':  { az: 'Cookie-lərdən istifadə', en: 'We use cookies', ru: 'Мы используем cookies' },
  'cookie.text':   {
    az: 'Sayt işləməsi üçün zəruri cookie-lərdən istifadə edirik. Analitika yalnız razılığınızla aktivləşir.',
    en: 'We use essential cookies to run the site. Analytics is enabled only with your consent.',
    ru: 'Мы используем необходимые cookies для работы сайта. Аналитика включается только с вашего согласия.',
  },
  'cookie.accept': { az: 'Hamısını qəbul et', en: 'Accept all', ru: 'Принять все' },
  'cookie.reject': { az: 'Yalnız zəruri', en: 'Essential only', ru: 'Только необходимые' },
  'cookie.more':   { az: 'Ətraflı', en: 'Learn more', ru: 'Подробнее' },
  'cookie.banner': { az: 'Cookie razılığı', en: 'Cookie consent', ru: 'Согласие на cookies' },

  /* ---------- accessibility ---------- */
  'a11y.skipToContent': { az: 'Məzmuna keç', en: 'Skip to content', ru: 'Перейти к содержимому' },
  'a11y.backToTop':     { az: 'Yuxarıya qayıt', en: 'Back to top', ru: 'Наверх' },
  'a11y.scrollProgress': { az: 'Oxuma irəliləyişi', en: 'Reading progress', ru: 'Прогресс чтения' },
  'a11y.sharePanel':    { az: 'Sosial paylaşım', en: 'Social sharing', ru: 'Поделиться' },
  'a11y.copyLink':      { az: 'Link kopyalandı!', en: 'Link copied!', ru: 'Ссылка скопирована!' },

  /* ---------- Auth & Landing ---------- */
  'auth.landing_h1': { az: 'Kod yaz.<br><span class="grad">Dil öyrən.</span><br>Yoldaş tap.', en: 'Write code.<br><span class="grad">Learn langs.</span><br>Find peers.', ru: 'Пиши код.<br><span class="grad">Учи языки.</span><br>Находи друзей.' },
  'auth.landing_sub': { az: '18 yaşdan yuxarı gənclər üçün öyrənmə platforması — proqramlaşdırma dilləri və xarici dillər üzrə birgə öyrənmə. Mövzu otaqları, şəxsi mesajlaşma, tapşırıqlar, XP və nişanlar.', en: 'An 18+ learning platform for collaborative programming and languages. Topic rooms, direct messages, tasks, XP and badges.', ru: 'Платформа 18+ для совместного изучения программирования и языков. Тематические комнаты, ЛС, задания, XP и бейджи.' },
  'auth.storage_note': { az: 'Hesab məlumatlarınız qorunur — şifrələr PBKDF2 ilə heşlənir və heç vaxt açıq şəkildə saxlanılmır.', en: 'Your account data is secure — passwords are PBKDF2 hashed and never stored in plain text.', ru: 'Данные защищены — пароли хешируются через PBKDF2 и не хранятся в открытом виде.' },
  'auth.tab_reg': { az: 'Qeydiyyat', en: 'Register', ru: 'Регистрация' },
  'auth.tab_login': { az: 'Daxil ol', en: 'Login', ru: 'Вход' },
  'auth.step_lbl': { az: 'Addım 1/4 — Hesab', en: 'Step 1/4 — Account', ru: 'Шаг 1/4 — Аккаунт' },
  'auth.btn_back': { az: '← Geri', en: '← Back', ru: '← Назад' },
  'auth.btn_next': { az: 'İrəli →', en: 'Next →', ru: 'Далее →' },
  'auth.reg_note': { az: 'Qeydiyyatla platformanın davranış qaydalarını qəbul edirsiniz. Təhqiredici dil və qanunsuz davranış hesabın bağlanmasına səbəb olur.', en: 'By registering you accept the platform rules. Abusive language and illegal behavior will lead to account termination.', ru: 'Регистрируясь, вы принимаете правила платформы. Оскорбления и незаконное поведение приведут к блокировке.' },
  'auth.lbl_user': { az: 'İstifadəçi adı', en: 'Username', ru: 'Имя пользователя' },
  'auth.lbl_pass': { az: 'Şifrə', en: 'Password', ru: 'Пароль' },
  'auth.btn_show_pass': { az: 'Şifrəni göstər', en: 'Show password', ru: 'Показать пароль' },
  'auth.lbl_remember': { az: 'Məni xatırla', en: 'Remember me', ru: 'Запомнить меня' },
  'auth.btn_forgot': { az: 'Parolu unutmusan?', en: 'Forgot password?', ru: 'Забыли пароль?' },
  'auth.login_note': { az: 'Hesabınız yoxdursa, əvvəlcə <b>Qeydiyyat</b> bölməsindən profil yaradın.', en: 'If you do not have an account, create one in the <b>Register</b> section.', ru: 'Если у вас нет аккаунта, сначала создайте его в разделе <b>Регистрация</b>.' },

  /* ---------- App General & Sidebar ---------- */
  'app.guest': { az: 'Qonaq', en: 'Guest', ru: 'Гость' },
  'app.more': { az: 'Daha çox', en: 'More', ru: 'Ещё' },

  /* ---------- Page: Home ---------- */
  'home.welcome': { az: 'Xoş gəldin!', en: 'Welcome!', ru: 'Добро пожаловать!' },
  'home.lbl_streak': { az: '🔥 gündəlik seriya', en: '🔥 daily streak', ru: '🔥 серия дней' },
  'home.lbl_xp': { az: '⚡ XP', en: '⚡ XP', ru: '⚡ XP' },
  'home.lbl_users': { az: 'qeydiyyatlı istifadəçi', en: 'registered users', ru: 'зарегистрированных' },
  'home.add_text': { az: '＋ Mətn', en: '＋ Text', ru: '＋ Текст' },
  'home.add_code': { az: '</> Kod', en: '</> Code', ru: '</> Код' },
  'home.add_img': { az: '🖼 Şəkil', en: '🖼 Image', ru: '🖼 Изображение' },
  'home.btn_share': { az: 'Paylaş', en: 'Share', ru: 'Поделиться' },
  'home.search_feed': { az: '⌕ Paylaşımlarda axtar (mətn, müəllif, tag)...', en: '⌕ Search posts...', ru: '⌕ Поиск по постами...' },
  'home.tab_all': { az: 'Hamısı', en: 'All', ru: 'Все' },
  'home.tab_following': { az: 'İzlədiklərim', en: 'Following', ru: 'Подписки' },

  /* ---------- Page: Chat & DM ---------- */
  'chat.sub': { az: 'Ümumi otaq və mövzu otaqları — hamı üçün açıqdır', en: 'General and topic rooms — open to everyone', ru: 'Общие и тематические комнаты — открыты для всех' },
  'chat.ph': { az: 'Mesaj yaz...', en: 'Write a message...', ru: 'Написать сообщение...' },
  'chat.send': { az: 'Göndər', en: 'Send', ru: 'Отправить' },
  'dm.sub': { az: 'İstənilən istifadəçiyə şəxsi mesaj yaz', en: 'Direct message any user', ru: 'Личные сообщения любому пользователю' },
  'dm.head': { az: 'Söhbət seçin', en: 'Select a chat', ru: 'Выберите чат' },
  'dm.empty': { az: 'Soldan bir istifadəçi seçib yazışmaya başla', en: 'Select a user from the left to start chatting', ru: 'Выберите пользователя слева для начала общения' },

  /* ---------- Page: Notifs ---------- */
  'notifs.sub': { az: 'Like, şərh, mesaj və tapşırıq yoxlanışları', en: 'Likes, comments, messages, and task reviews', ru: 'Лайки, комментарии, сообщения и проверки заданий' },
  'notifs.mark_all': { az: 'Hamısını oxunmuş et', en: 'Mark all as read', ru: 'Отметить всё как прочитанное' },

  /* ---------- Page: Users ---------- */
  'users.sub': { az: 'Platformadakı bütün üzvlər — profilə bax, birbaşa mesaj yaz', en: 'All platform members — view profiles, send direct messages', ru: 'Все участники платформы — смотрите профили, отправляйте ЛС' },
  'users.search': { az: '⌕ Ad, istifadəçi adı və ya tag üzrə axtar...', en: '⌕ Search by name, username or tag...', ru: '⌕ Поиск по имени, юзернейму или тегу...' },
  'users.flt_skill': { az: 'Bütün skill-lər', en: 'All skills', ru: 'Все навыки' },
  'users.flt_level': { az: 'Bütün səviyyələr', en: 'All levels', ru: 'Все уровни' },
  'users.flt_beg': { az: 'Başlanğıc', en: 'Beginner', ru: 'Новичок' },
  'users.flt_mid': { az: 'Orta', en: 'Intermediate', ru: 'Средний' },
  'users.flt_adv': { az: 'Qabaqcıl', en: 'Advanced', ru: 'Продвинутый' },
  'users.flt_look': { az: 'Nə axtarır — hamısı', en: 'Looking for — all', ru: 'Ищет — все' },
  'users.flt_sp': { az: 'Study partner', en: 'Study partner', ru: 'Study partner' },
  'users.flt_mentor': { az: 'Mentor', en: 'Mentor', ru: 'Ментор' },
  'users.flt_team': { az: 'Layihə komandası', en: 'Project team', ru: 'Команда проекта' },
  'users.flt_ext_all': { az: 'Hamısı', en: 'All', ru: 'Все' },
  'users.flt_ver': { az: '✓ Təsdiqlənmiş', en: '✓ Verified', ru: '✓ Подтверждённые' },
  'users.flt_on': { az: '🟢 Onlayn', en: '🟢 Online', ru: '🟢 Онлайн' },
  'users.flt_mut': { az: '⇄ Qarşılıqlı', en: '⇄ Mutual', ru: '⇄ Взаимно' },

  /* ---------- İstifadəçilər səhifəsi — TASK-6 / BÖLMƏ 2 ---------- */
  'users.sort':        { az: 'Sırala', en: 'Sort', ru: 'Сортировать' },
  'users.sort_recent': { az: 'Ən yeni üzvlər', en: 'Newest members', ru: 'Новые участники' },
  'users.sort_xp':     { az: 'Ən yüksək XP', en: 'Highest XP', ru: 'Больше всего XP' },
  'users.sort_active': { az: 'Son aktiv olanlar', en: 'Recently active', ru: 'Недавно активные' },
  'users.sort_alpha':  { az: 'Əlifba sırası', en: 'Alphabetical', ru: 'По алфавиту' },
  'users.view':        { az: 'Görünüş', en: 'View', ru: 'Вид' },
  'users.view_grid':   { az: 'Kart görünüşü', en: 'Grid view', ru: 'Сетка' },
  'users.view_list':   { az: 'Siyahı görünüşü', en: 'List view', ru: 'Список' },
  'users.more_skills': { az: 'Daha {0} bacarıq', en: '{0} more skills', ru: 'Ещё навыков: {0}' },
  'users.all_skills':  { az: 'Bütün bacarıqlar', en: 'All skills', ru: 'Все навыки' },
  'users.loading':     { az: 'Yüklənir...', en: 'Loading...', ru: 'Загрузка...' },
  'users.end':         { az: 'Hamısı göstərildi', en: 'That’s everyone', ru: 'Это все' },
  'users.none':        { az: 'Filtrlərə uyğun istifadəçi tapılmadı', en: 'No users match these filters', ru: 'Нет пользователей по этим фильтрам' },
  'users.err':         { az: 'Siyahı yüklənə bilmədi', en: 'Could not load the list', ru: 'Не удалось загрузить список' },

  /* ---------- command palette (İstifadəçilər#4) ---------- */
  'pal.title':      { az: 'Sürətli axtarış', en: 'Quick search', ru: 'Быстрый поиск' },
  'pal.ph':         { az: 'İstifadəçi axtar və ya səhifəyə keç...', en: 'Search users or jump to a page...', ru: 'Найти пользователя или перейти...' },
  'pal.results':    { az: 'Nəticələr', en: 'Results', ru: 'Результаты' },
  'pal.empty':      { az: 'Nəticə yoxdur', en: 'No results', ru: 'Ничего не найдено' },
  'pal.pages':      { az: 'Səhifələr', en: 'Pages', ru: 'Страницы' },
  'pal.people':     { az: 'İstifadəçilər', en: 'People', ru: 'Люди' },
  'pal.hint_nav':   { az: 'hərəkət', en: 'navigate', ru: 'навигация' },
  'pal.hint_open':  { az: 'aç', en: 'open', ru: 'открыть' },
  'pal.hint_close': { az: 'bağla', en: 'close', ru: 'закрыть' },

  /* ---------- Page: Tasks ---------- */
  'tasks.sub': { az: 'Sahələrə uyğun tapşırıqlar — həllini göndər, admin yoxlasın, XP qazan', en: 'Field-specific tasks — submit solutions, get admin reviews, earn XP', ru: 'Задания по направлениям — отправляй решения, получай проверку админа и XP' },
  'tasks.new_title': { az: 'Yeni tapşırıq', en: 'New task', ru: 'Новое задание' },
  'tasks.lbl_title': { az: 'Tapşırığın başlığı', en: 'Task title', ru: 'Заголовок задания' },
  'tasks.lbl_desc': { az: 'Tapşırığın təsviri', en: 'Task description', ru: 'Описание задания' },
  'tasks.pending_adm': { az: '⏳ Yoxlama gözləyən həllər', en: '⏳ Solutions pending review', ru: '⏳ Решения на проверке' },

  /* ---------- Page: Saved ---------- */
  'saved.sub': { az: '★ ilə yadda saxladığın paylaşımlar', en: 'Posts saved with ★', ru: 'Посты, сохранённые с ★' },

  /* ---------- Page: Stats ---------- */
  'stats.sub': { az: 'İcmanın real fəaliyyəti', en: 'Real community activity', ru: 'Реальная активность сообщества' },
  'stats.r1': { az: '1 gün', en: '1 day', ru: '1 день' },
  'stats.r7': { az: '7 gün', en: '7 days', ru: '7 дней' },
  'stats.r14': { az: '14 gün', en: '14 days', ru: '14 дней' },
  'stats.r30': { az: 'Aylıq', en: 'Monthly', ru: 'Месяц' },
  'stats.rc': { az: 'Tarix aralığı', en: 'Date range', ru: 'Диапазон дат' },
  'stats.apply': { az: 'Tətbiq et', en: 'Apply', ru: 'Применить' },
  'stats.post_count': { az: 'Paylaşım sayı', en: 'Post count', ru: 'Количество постов' },
  'stats.adm_title': { az: '⚑ Platforma statistikası (yalnız admin)', en: '⚑ Platform stats (admin only)', ru: '⚑ Статистика платформы (только админ)' },
  'stats.top_contrib': { az: 'Top töhfəçilər (XP)', en: 'Top contributors (XP)', ru: 'Топ участников (XP)' },
  'stats.growth': { az: 'Artım (son 30 gün qeydiyyat)', en: 'Growth (last 30 days signups)', ru: 'Рост (регистрации за 30 дней)' },
  'stats.lb': { az: '🏆 Liderlər lövhəsi', en: '🏆 Leaderboard', ru: '🏆 Таблица лидеров' },
  'stats.lb_xp': { az: '⚡ XP', en: '⚡ XP', ru: '⚡ XP' },
  'stats.lb_tasks': { az: '☑ Tapşırıq', en: '☑ Task', ru: '☑ Задание' },
  'stats.lb_streak': { az: '🔥 Seriya', en: '🔥 Streak', ru: '🔥 Серия' },
  'stats.lang_dist': { az: 'Dil / sahə bölgüsü', en: 'Language / field distribution', ru: 'Распределение языков / сфер' },

  /* ---------- Page: Profil ---------- */
  'prof.sub': { az: 'Sənin öyrənmə kartın', en: 'Your learning card', ru: 'Твоя учебная карточка' },
  'prof.edit': { az: '✎ Redaktə et', en: '✎ Edit', ru: '✎ Редактировать' },
  'prof.tasks_done': { az: '☑ tamamlanmış tapşırıq', en: '☑ completed tasks', ru: '☑ выполненных заданий' },
  'prof.badges': { az: '🏅 Nişanlar', en: '🏅 Badges', ru: '🏅 Бейджи' },
  'prof.heatmap': { az: 'Aktivlik xəritəsi', en: 'Activity heatmap', ru: 'Карта активности' },
  'prof.prog': { az: 'Sahələr üzrə irəliləyiş', en: 'Progress by field', ru: 'Прогресс по сферам' },
  'prof.social': { az: 'Sosial media hesabları', en: 'Social media accounts', ru: 'Аккаунты в соцсетях' },
  'prof.myposts': { az: 'Paylaşımlarım', en: 'My posts', ru: 'Мои посты' },

  /* ---------- Page: Settings ---------- */
  'set.sub': { az: 'Hesab və görünüş tənzimləmələri', en: 'Account and appearance settings', ru: 'Настройки аккаунта и внешнего вида' },
  'set.appr': { az: 'Görünüş', en: 'Appearance', ru: 'Внешний вид' },
  'set.pass_ch': { az: 'Şifrəni dəyiş', en: 'Change password', ru: 'Сменить пароль' },
  'set.pass_cur': { az: 'Hazırkı şifrə', en: 'Current password', ru: 'Текущий пароль' },
  'set.pass_new': { az: 'Yeni şifrə (min 6 simvol)', en: 'New password (min 6 chars)', ru: 'Новый пароль (мин. 6 симв.)' },
  'set.pass_btn': { az: 'Şifrəni yenilə', en: 'Update password', ru: 'Обновить пароль' },
  'set.export': { az: 'Data ixracı', en: 'Data export', ru: 'Экспорт данных' },
  'set.export_sub': { az: 'Bütün fəaliyyət tarixçən: profil, postlar, rəylər, mesajlar, bəyənmələr, sessiyalar. JSON və ya CSV.', en: 'Your complete history: profile, posts, comments, messages, likes, sessions. JSON or CSV.', ru: 'Вся ваша история: профиль, посты, комментарии, сообщения, лайки, сессии. JSON или CSV.' },
  'set.export_btn': { az: '⬇ Datamı endir (JSON)', en: '⬇ Download my data (JSON)', ru: '⬇ Скачать мои данные (JSON)' },
  /* ---------- profil tamlığı (TASK-8 / Bənd 6) ---------- */
  'cmp.title': { az: 'Profilini tamamla', en: 'Complete your profile', ru: 'Заполните профиль' },
  'cmp.hint': { az: 'Bütün sahələri doldur və {xp} XP bonus qazan.', en: 'Fill in every field to earn a {xp} XP bonus.', ru: 'Заполните все поля и получите бонус {xp} XP.' },
  'cmp.bonus_earned': { az: '🎉 Profil 100% tamamlandı — +20 XP qazandın!', en: '🎉 Profile 100% complete — you earned +20 XP!', ru: '🎉 Профиль заполнен на 100% — вы получили +20 XP!' },
  'cmp.f_avatar': { az: 'Avatar', en: 'Avatar', ru: 'Аватар' },
  'cmp.f_bio': { az: 'Bio', en: 'Bio', ru: 'Био' },
  'cmp.f_goals': { az: 'Hədəflər', en: 'Goals', ru: 'Цели' },
  'cmp.f_prog': { az: 'Proqramlaşdırma', en: 'Programming', ru: 'Программирование' },
  'cmp.f_langs': { az: 'Dillər', en: 'Languages', ru: 'Языки' },
  'cmp.f_looking': { az: 'Nə axtarırsan', en: 'Looking for', ru: 'Что ищете' },
  'cmp.f_city': { az: 'Şəhər', en: 'City', ru: 'Город' },
  'cmp.f_social': { az: 'Sosial link', en: 'Social link', ru: 'Соцсеть' },

  /* ---------- Admin "Geri al" (TASK-8 / Bənd 17) ---------- */
  'adm.undo': { az: 'Geri al', en: 'Undo', ru: 'Отменить' },

  /* ---------- markdown redaktoru (TASK-8 / Bənd 16) ---------- */
  'comp.md_ph': { az: 'Markdown yaz… **qalın**, *kursiv*, `kod`, - siyahı', en: 'Write markdown… **bold**, *italic*, `code`, - list', ru: 'Пишите markdown… **жирный**, *курсив*, `код`, - список' },
  'comp.md_empty': { az: 'Önbaxış burada görünəcək…', en: 'Preview will appear here…', ru: 'Здесь появится предпросмотр…' },
  'comp.md_preview': { az: 'Önbaxış', en: 'Preview', ru: 'Предпросмотр' },
  'comp.md_bold': { az: 'Qalın (Ctrl+B)', en: 'Bold (Ctrl+B)', ru: 'Жирный (Ctrl+B)' },
  'comp.md_italic': { az: 'Kursiv (Ctrl+I)', en: 'Italic (Ctrl+I)', ru: 'Курсив (Ctrl+I)' },
  'comp.md_code': { az: 'Sətir içi kod', en: 'Inline code', ru: 'Строчный код' },
  'comp.md_link': { az: 'Link', en: 'Link', ru: 'Ссылка' },
  'comp.md_list': { az: 'Siyahı', en: 'List', ru: 'Список' },
  'comp.md_quote': { az: 'Sitat', en: 'Quote', ru: 'Цитата' },
  'comp.md_bold_ph': { az: 'qalın mətn', en: 'bold text', ru: 'жирный текст' },
  'comp.md_italic_ph': { az: 'kursiv mətn', en: 'italic text', ru: 'курсивный текст' },
  'comp.md_link_ph': { az: 'link mətni', en: 'link text', ru: 'текст ссылки' },

  /* ---------- FAZA 5: realtime mesaj axını (TASK-8 / Bənd 13) ---------- */
  'chat.back': { az: 'Siyahıya qayıt', en: 'Back to list', ru: 'Назад к списку' },
  'chat.rate_limit': { az: 'Çox sürətli yazırsan — bir az yavaşla.', en: 'You’re sending too fast — slow down a little.', ru: 'Слишком быстро — немного помедленнее.' },
  // AUDIT-TASK-9 / C-2 — WS 4403. Səbəb QƏSDƏN ümumidir: "komandadan çıxarıldın"
  // ilə "sessiyan ləğv olundu" arasındakı fərq client-ə bilinmir və onu təxmin
  // etmək yanlış mesaj göstərmək riskidir.
  'chat.ws_unauthorized': {
    az: 'Bu söhbətə çıxışınız dayandırıldı.',
    en: 'Your access to this chat has ended.',
    ru: 'Ваш доступ к этому чату прекращён.',
  },

  /* ---------- Arxiv tarixçəsi (AUDIT-TASK-8 / §8.4) ---------- */
  // ⚠ Üç dil PARALEL saxlanılır: Task 2-də bir dildə qalan mətn placeholder
  // kimi canlıya çıxmışdı. Yeni açar əlavə edən hər kəs üçünü də doldurmalıdır.
  'hist.load_older': { az: 'Daha köhnə mesajlar', en: 'Load older messages', ru: 'Загрузить старые сообщения' },
  'hist.loading': { az: 'Yüklənir…', en: 'Loading…', ru: 'Загрузка…' },
  'hist.start': { az: 'Söhbətin başlanğıcı', en: 'Beginning of the conversation', ru: 'Начало беседы' },
  'hist.error': { az: 'Köhnə mesajlar yüklənmədi. Yenidən cəhd edin.', en: 'Could not load older messages. Try again.', ru: 'Не удалось загрузить старые сообщения. Попробуйте снова.' },
  'hist.rate_limit': { az: 'Arxiv oxu limiti aşıldı — bir qədər sonra yenidən cəhd edin.', en: 'Archive read limit reached — try again later.', ru: 'Достигнут лимит чтения архива — попробуйте позже.' },

  /* ---------- FAZA 4: axtarış / ixrac (TASK-8 / Bənd 10, 11) ---------- */
  'pal.posts': { az: 'Paylaşımlar', en: 'Posts', ru: 'Посты' },
  'pal.comments': { az: 'Rəylər', en: 'Comments', ru: 'Комментарии' },
  'set.export_csv': { az: '⬇ CSV', en: '⬇ CSV', ru: '⬇ CSV' },
  'set.export_started': { az: 'İxrac başladı — fayl hazırlanır…', en: 'Export started — preparing your file…', ru: 'Экспорт начался — файл готовится…' },

  /* ---------- 2FA / TOTP (TASK-8 / Bənd 2) ---------- */
  'mfa.title': { az: 'İki mərhələli təsdiq (2FA)', en: 'Two-factor authentication (2FA)', ru: 'Двухфакторная аутентификация (2FA)' },
  'mfa.sub': { az: 'Şifrənə əlavə olaraq telefonundakı authenticator kodu tələb olunur. Şifrən oğurlansa belə hesabın qorunur.', en: 'Requires a code from your authenticator app in addition to your password. Even a stolen password won’t be enough.', ru: 'Кроме пароля потребуется код из приложения-аутентификатора. Даже украденный пароль не поможет злоумышленнику.' },
  'mfa.app_name': { az: 'Authenticator tətbiqi', en: 'Authenticator app', ru: 'Приложение-аутентификатор' },
  'mfa.app_hint': { az: 'Google Authenticator, Authy, 1Password və s.', en: 'Google Authenticator, Authy, 1Password, etc.', ru: 'Google Authenticator, Authy, 1Password и др.' },
  'mfa.on': { az: 'AKTİV', en: 'ON', ru: 'ВКЛ' },
  'mfa.off': { az: 'SÖNÜLÜ', en: 'OFF', ru: 'ВЫКЛ' },
  'mfa.enable': { az: 'Aktivləşdir', en: 'Enable', ru: 'Включить' },
  'mfa.disable': { az: 'Söndür', en: 'Disable', ru: 'Отключить' },
  'mfa.disabled': { az: '2FA söndürüldü', en: '2FA disabled', ru: '2FA отключена' },
  'mfa.err': { az: '2FA vəziyyəti yüklənmədi.', en: 'Could not load 2FA status.', ru: 'Не удалось загрузить статус 2FA.' },
  'mfa.confirm': { az: 'Təsdiqlə', en: 'Confirm', ru: 'Подтвердить' },
  'mfa.ask_code': { az: 'Təsdiq üçün authenticator kodunu (və ya ehtiyat kodu) yaz.', en: 'Enter your authenticator code (or a backup code) to confirm.', ru: 'Введите код из приложения (или резервный код) для подтверждения.' },
  'mfa.qr_alt': { az: 'Authenticator üçün QR kod', en: 'QR code for your authenticator app', ru: 'QR-код для приложения-аутентификатора' },
  'mfa.setup_title': { az: '🔐 2FA qurulması', en: '🔐 Set up 2FA', ru: '🔐 Настройка 2FA' },
  'mfa.setup_1': { az: '1. Authenticator tətbiqini aç və bu QR kodu skan et:', en: '1. Open your authenticator app and scan this QR code:', ru: '1. Откройте приложение-аутентификатор и отсканируйте QR-код:' },
  'mfa.setup_manual': { az: 'QR skan edə bilmirsənsə, bu açarı əl ilə daxil et:', en: 'Can’t scan? Enter this key manually:', ru: 'Не удаётся отсканировать? Введите ключ вручную:' },
  'mfa.setup_2': { az: '2. Tətbiqin göstərdiyi 6 rəqəmli kodu yaz:', en: '2. Enter the 6-digit code shown in the app:', ru: '2. Введите 6-значный код из приложения:' },
  'mfa.setup_confirm': { az: 'Təsdiqlə və aktivləşdir', en: 'Confirm and enable', ru: 'Подтвердить и включить' },
  'mfa.disable_title': { az: '2FA söndürülsün?', en: 'Disable 2FA?', ru: 'Отключить 2FA?' },
  'mfa.regen': { az: 'Yenilə', en: 'Regenerate', ru: 'Обновить' },
  'mfa.regen_title': { az: 'Ehtiyat kodları yenilə', en: 'Regenerate backup codes', ru: 'Обновить резервные коды' },
  'mfa.backup_title': { az: 'Ehtiyat kodlar', en: 'Backup codes', ru: 'Резервные коды' },
  'mfa.backup_hint': { az: 'Telefonunu itirsən yeganə giriş yolun budur.', en: 'These are your only way in if you lose your phone.', ru: 'Единственный способ войти, если потеряете телефон.' },
  'mfa.backup_low': { az: '⚠ Ehtiyat kodların bitmək üzrədir — yenilərini yarat.', en: '⚠ You’re running out of backup codes — generate new ones.', ru: '⚠ Резервные коды заканчиваются — создайте новые.' },
  'mfa.remaining': { az: '{n} ehtiyat kod qalıb', en: '{n} backup codes left', ru: 'Осталось резервных кодов: {n}' },
  'mfa.codes_title': { az: '🔑 Ehtiyat kodların', en: '🔑 Your backup codes', ru: '🔑 Ваши резервные коды' },
  'mfa.codes_warn': { az: 'Bu kodlar BİR DƏFƏ göstərilir və bir daha görünməyəcək. İndi kopyala və təhlükəsiz yerdə saxla. Hər kod yalnız bir dəfə işləyir.', en: 'These codes are shown ONCE and will never be shown again. Copy them now and store them somewhere safe. Each code works only once.', ru: 'Коды показываются ОДИН РАЗ и больше не появятся. Скопируйте их и сохраните в надёжном месте. Каждый код одноразовый.' },
  'mfa.codes_done': { az: 'Saxladım, davam et', en: 'I’ve saved them, continue', ru: 'Сохранил, продолжить' },
  'mfa.copy': { az: '📋 Kopyala', en: '📋 Copy', ru: '📋 Копировать' },
  'mfa.copied': { az: 'Kodlar kopyalandı', en: 'Codes copied', ru: 'Коды скопированы' },
  'mfa.copy_err': { az: 'Kopyalanmadı — əl ilə seç.', en: 'Copy failed — select manually.', ru: 'Не удалось скопировать — выделите вручную.' },
  'mfa.download': { az: '⬇ Endir', en: '⬇ Download', ru: '⬇ Скачать' },
  'mfa.step_title': { az: '🔐 İki mərhələli təsdiq', en: '🔐 Two-factor authentication', ru: '🔐 Двухфакторная аутентификация' },
  'mfa.step_sub': { az: 'Authenticator tətbiqindəki 6 rəqəmli kodu yaz. Telefonun əlində deyilsə ehtiyat kodlarından birini işlət.', en: 'Enter the 6-digit code from your authenticator app. No phone? Use one of your backup codes.', ru: 'Введите 6-значный код из приложения. Нет телефона? Используйте резервный код.' },
  'mfa.step_btn': { az: 'Təsdiqlə və daxil ol', en: 'Verify and sign in', ru: 'Подтвердить и войти' },
  'mfa.err_short': { az: 'Kod 6 rəqəm olmalıdır (ehtiyat kod: xxxx-xxxx).', en: 'The code must be 6 digits (backup code: xxxx-xxxx).', ru: 'Код должен состоять из 6 цифр (резервный: xxxx-xxxx).' },

  /* ---------- Magic link (TASK-8 / Bənd 4) ---------- */
  'magic.title': { az: '🔑 Şifrəsiz giriş', en: '🔑 Passwordless sign-in', ru: '🔑 Вход без пароля' },
  'magic.sub': { az: 'Email ünvanını yaz — sənə birdəfəlik giriş linki göndərək. Link 10 dəqiqə etibarlıdır. Şifrəni unutmusansa da bu yolla daxil olub Parametrlərdən yenisini təyin edə bilərsən.', en: 'Enter your email and we’ll send a one-time sign-in link, valid for 10 minutes. Forgot your password? Sign in this way, then set a new one in Settings.', ru: 'Укажите email — пришлём одноразовую ссылку для входа на 10 минут. Забыли пароль? Войдите так и задайте новый в Настройках.' },
  'magic.send': { az: 'Giriş linki göndər', en: 'Send sign-in link', ru: 'Отправить ссылку' },
  'magic.err_email': { az: 'Düzgün email ünvanı yaz.', en: 'Enter a valid email address.', ru: 'Введите корректный email.' },
  // ⚠ Mesaj QƏSDƏN şərtlidir ("hesab varsa") — "göndərildi" deyilsəydi, bu ekran
  //   hansı email-in qeydiyyatda olduğunu aşkarlayan alətə çevrilərdi.
  'magic.sent': { az: 'Bu ünvanda hesab varsa, giriş linki göndərildi. Poçtunu yoxla.', en: 'If an account exists for that address, a sign-in link has been sent. Check your inbox.', ru: 'Если аккаунт с таким адресом существует, ссылка отправлена. Проверьте почту.' },
  'magic.res_ok': { az: 'Xoş gəldin! 👋', en: 'Welcome back! 👋', ru: 'С возвращением! 👋' },
  'magic.res_expired': { az: 'Link vaxtı bitib və ya artıq istifadə olunub. Yenisini istə.', en: 'That link has expired or was already used. Request a new one.', ru: 'Ссылка истекла или уже использована. Запросите новую.' },
  'magic.res_blocked': { az: 'Hesabınız bloklanıb.', en: 'Your account is blocked.', ru: 'Ваш аккаунт заблокирован.' },

  /* ---------- OAuth (TASK-8 / Bənd 5) ---------- */
  'oauth.or': { az: 'və ya', en: 'or', ru: 'или' },
  'oauth.with': { az: 'ilə davam et:', en: 'Continue with', ru: 'Продолжить через' },
  'oauth.title': { az: 'Bağlı hesablar', en: 'Connected accounts', ru: 'Связанные аккаунты' },
  'oauth.sub': { az: 'Xarici hesab bağlasan tək kliklə giriş edə bilərsən.', en: 'Link an external account to sign in with one click.', ru: 'Свяжите внешний аккаунт для входа в один клик.' },
  'oauth.connect': { az: 'Bağla', en: 'Connect', ru: 'Связать' },
  'oauth.unlink': { az: 'Ayır', en: 'Disconnect', ru: 'Отвязать' },
  'oauth.connected': { az: 'bağlıdır', en: 'connected', ru: 'связан' },
  'oauth.not_connected': { az: 'bağlı deyil', en: 'not connected', ru: 'не связан' },
  'oauth.confirm_unlink': { az: 'Bu hesab ayrılsın?', en: 'Disconnect this account?', ru: 'Отвязать этот аккаунт?' },
  'oauth.last_method': { az: 'Bu yeganə giriş üsulunuzdur — əvvəlcə şifrə təyin edin.', en: 'This is your only sign-in method — set a password first.', ru: 'Это единственный способ входа — сначала задайте пароль.' },
  'oauth.none_available': { az: 'Hazırda xarici giriş provayderi aktiv deyil.', en: 'No external sign-in providers are enabled.', ru: 'Внешние провайдеры входа не подключены.' },
  'oauth.err': { az: 'Bağlı hesablar yüklənmədi.', en: 'Could not load connected accounts.', ru: 'Не удалось загрузить аккаунты.' },
  'oauth.wiz_note': { az: '{p} hesabın tanındı. Qeydiyyatı tamamlamaq üçün istifadəçi adını və doğum tarixini təsdiqlə (platforma 18+-dır).', en: 'Your {p} account was recognised. Confirm your username and date of birth to finish (the platform is 18+).', ru: 'Ваш аккаунт {p} распознан. Подтвердите имя пользователя и дату рождения (платформа 18+).' },
  'oauth.msg_linked': { az: 'Hesab bağlandı ✓', en: 'Account connected ✓', ru: 'Аккаунт связан ✓' },
  'oauth.msg_unlinked': { az: 'Hesab ayrıldı', en: 'Account disconnected', ru: 'Аккаунт отвязан' },
  'oauth.msg_already': { az: 'Bu hesab artıq başqa profilə bağlıdır.', en: 'That account is already linked to another profile.', ru: 'Этот аккаунт уже связан с другим профилем.' },
  'oauth.msg_cancelled': { az: 'Giriş ləğv edildi.', en: 'Sign-in cancelled.', ru: 'Вход отменён.' },
  'oauth.msg_state_err': { az: 'Təhlükəsizlik yoxlaması alınmadı. Yenidən cəhd edin.', en: 'Security check failed. Please try again.', ru: 'Проверка безопасности не пройдена. Попробуйте снова.' },
  'oauth.msg_provider_err': { az: 'Provayderlə əlaqə alınmadı. Yenidən cəhd edin.', en: 'Could not reach the provider. Please try again.', ru: 'Не удалось связаться с провайдером. Попробуйте снова.' },
  'oauth.msg_blocked': { az: 'Hesabınız bloklanıb.', en: 'Your account is blocked.', ru: 'Ваш аккаунт заблокирован.' },

  /* ---------- Təhlükə Monitorinqi (TASK-8 / Bənd 1) ---------- */
  'thr.title': { az: '🛡 Təhlükə monitorinqi', en: '🛡 Threat monitoring', ru: '🛡 Мониторинг угроз' },
  'thr.sub': { az: 'Son 24 saatın təhlükəsizlik hadisələri. Rəqəmlər canlı yenilənir.', en: 'Security events from the last 24 hours. Figures refresh live.', ru: 'События безопасности за 24 часа. Данные обновляются в реальном времени.' },
  'thr.c_critical': { az: 'Kritik', en: 'Critical', ru: 'Критические' },
  'thr.c_warning': { az: 'Xəbərdarlıq', en: 'Warnings', ru: 'Предупреждения' },
  'thr.c_failed': { az: 'Uğursuz giriş', en: 'Failed logins', ru: 'Неудачные входы' },
  'thr.c_total': { az: 'Ümumi hadisə', en: 'Total events', ru: 'Всего событий' },
  'thr.trend': { az: 'Uğursuz giriş trendi (24 saat)', en: 'Failed login trend (24h)', ru: 'Тренд неудачных входов (24 ч)' },
  'thr.top_ips': { az: 'Ən çox cəhd edən IP-lər (7 gün)', en: 'Top attacking IPs (7 days)', ru: 'Топ IP-адресов по попыткам (7 дней)' },
  'thr.attempts': { az: 'cəhd', en: 'attempts', ru: 'попыток' },
  'thr.targets': { az: 'hədəf hesab', en: 'target accounts', ru: 'целевых аккаунтов' },
  'thr.filter_ip': { az: 'Bu IP üzrə filtrlə', en: 'Filter by this IP', ru: 'Фильтровать по этому IP' },
  'thr.refresh': { az: '↻ Təzələ', en: '↻ Refresh', ru: '↻ Обновить' },
  'thr.more': { az: 'Daha çox göstər', en: 'Show more', ru: 'Показать ещё' },
  'thr.empty': { az: 'Hadisə yoxdur — hər şey qaydasındadır.', en: 'No events — all clear.', ru: 'Событий нет — всё чисто.' },
  'thr.err': { az: 'Hadisələr yüklənmədi.', en: 'Could not load events.', ru: 'Не удалось загрузить события.' },
  'thr.f_all': { az: 'Bütün tiplər', en: 'All types', ru: 'Все типы' },
  'thr.sev_all': { az: 'Bütün səviyyələr', en: 'All severities', ru: 'Все уровни' },
  'thr.sev_critical': { az: 'KRİTİK', en: 'CRITICAL', ru: 'КРИТИЧНО' },
  'thr.sev_warning': { az: 'XƏBƏRDARLIQ', en: 'WARNING', ru: 'ВНИМАНИЕ' },
  'thr.sev_info': { az: 'MƏLUMAT', en: 'INFO', ru: 'ИНФО' },
  'thr.t_login_failed': { az: 'Uğursuz giriş', en: 'Failed login', ru: 'Неудачный вход' },
  'thr.t_login_ok': { az: 'Uğurlu giriş', en: 'Successful login', ru: 'Успешный вход' },
  'thr.t_token_reuse': { az: 'Token təkrar istifadəsi', en: 'Token reuse detected', ru: 'Повторное использование токена' },
  'thr.t_geo_change': { az: 'Yeni ölkədən giriş', en: 'Login from new country', ru: 'Вход из новой страны' },
  'thr.t_rate_limit': { az: 'Sorğu limiti aşıldı', en: 'Rate limit exceeded', ru: 'Превышен лимит запросов' },
  // AUDIT-TASK-9 / B-3 — gündəlik XP tavanı. Əməliyyat UĞURLUDUR (post/rəy
  // yaranır), yalnız XP verilmir — mətn bunu açıq deməlidir, əks halda
  // istifadəçi paylaşımının getmədiyini düşünüb təkrar göndərər.
  'xp.daily_cap': {
    az: 'Bugünkü XP limitinə çatdınız — paylaşımınız yerləşdirildi, XP sabah yenidən verilir.',
    en: 'You have reached today’s XP limit — your content was posted, XP resumes tomorrow.',
    ru: 'Вы достигли дневного лимита XP — публикация создана, начисление возобновится завтра.',
  },
  'thr.t_turnstile_failed': { az: 'Bot yoxlaması uğursuz', en: 'Bot check failed', ru: 'Проверка на бота не пройдена' },
  'thr.t_upload_rejected': { az: 'Fayl rədd edildi', en: 'Upload rejected', ru: 'Загрузка отклонена' },
  'thr.t_session_revoked': { az: 'Sessiya ləğv edildi', en: 'Session revoked', ru: 'Сессия отозвана' },
  'thr.t_password_changed': { az: 'Parol dəyişdirildi', en: 'Password changed', ru: 'Пароль изменён' },

  /* ---------- aktiv sessiyalar / cihazlar (TASK-8 / Bənd 3) ---------- */
  'set.sessions': { az: 'Aktiv sessiyalar', en: 'Active sessions', ru: 'Активные сессии' },
  'set.sessions_sub': { az: 'Hesabına daxil olan cihazlar. Tanımadığın cihaz varsa dərhal çıxart və şifrəni dəyiş.', en: 'Devices signed in to your account. If you don’t recognise one, sign it out and change your password.', ru: 'Устройства с доступом к аккаунту. Незнакомое — выйдите и смените пароль.' },
  'set.sess_this': { az: 'bu cihaz', en: 'this device', ru: 'это устройство' },
  'set.sess_last': { az: 'son fəallıq:', en: 'last active:', ru: 'активность:' },
  'set.sess_unknown': { az: 'Naməlum cihaz', en: 'Unknown device', ru: 'Неизвестное устройство' },
  'set.sess_revoke': { az: 'Çıxart', en: 'Sign out', ru: 'Выйти' },
  'set.sess_revoke_all': { az: 'Digər bütün cihazları çıxart', en: 'Sign out all other devices', ru: 'Выйти на всех других устройствах' },
  'set.sess_loading': { az: 'Yüklənir…', en: 'Loading…', ru: 'Загрузка…' },
  'set.sess_none': { az: 'Aktiv sessiya tapılmadı.', en: 'No active sessions found.', ru: 'Активных сессий нет.' },
  'set.sess_err': { az: 'Sessiyalar yüklənmədi.', en: 'Could not load sessions.', ru: 'Не удалось загрузить сессии.' },
  'set.sess_confirm': { az: 'Bu cihaz hesabdan çıxarılsın?', en: 'Sign this device out of your account?', ru: 'Выйти из аккаунта на этом устройстве?' },
  'set.sess_confirm_all': { az: 'Bu cihazdan başqa bütün cihazlar çıxarılsın?', en: 'Sign out every device except this one?', ru: 'Выйти на всех устройствах, кроме текущего?' },
  'set.sess_done': { az: 'Cihaz çıxarıldı', en: 'Device signed out', ru: 'Устройство отключено' },
  'set.sess_done_all': { az: 'Digər bütün cihazlar çıxarıldı', en: 'All other devices signed out', ru: 'Все другие устройства отключены' },

  'set.danger': { az: 'Təhlükəli zona', en: 'Danger zone', ru: 'Опасная зона' },
  'set.danger_sub': { az: 'Hesab silindikdə profiliniz, istifadəçi adınız və giriş məlumatlarınız birdəfəlik silinir.', en: 'Deleting your account permanently removes your profile, username, and login data.', ru: 'Удаление аккаунта навсегда стирает ваш профиль, юзернейм и данные для входа.' },
  'set.danger_btn': { az: 'Hesabı birdəfəlik sil', en: 'Permanently delete account', ru: 'Навсегда удалить аккаунт' },

  /* ---------- Page: Admin ---------- */
  'adm.sub': { az: 'Şikayətlər, istifadəçilər, otaqlar və adminlər', en: 'Reports, users, rooms, and admins', ru: 'Жалобы, пользователи, комнаты и админы' },
  'adm.q_pend': { az: '⏳ Həlləri yoxla', en: '⏳ Review solutions', ru: '⏳ Проверить решения' },
  'adm.q_task': { az: '☑ Yeni tapşırıq', en: '☑ New task', ru: '☑ Новое задание' },
  'adm.q_rooms': { az: '# Otaqlara bax', en: '# View rooms', ru: '# Смотреть комнаты' },
  'adm.reports': { az: 'Açıq şikayətlər', en: 'Open reports', ru: 'Открытые жалобы' },
  'adm.room_new': { az: 'Yeni otaq yarat', en: 'Create new room', ru: 'Создать новую комнату' },
  'adm.room_ph': { az: 'Otaq adı (məs. Python otağı)', en: 'Room name (e.g., Python room)', ru: 'Название комнаты (напр. Python)' },
  'adm.room_btn': { az: 'Yarat', en: 'Create', ru: 'Создать' },
  'adm.tax': { az: '🏷 Taksonomiya (dillər / skill-lər)', en: '🏷 Taxonomy (langs / skills)', ru: '🏷 Таксономия (языки / навыки)' },
  'adm.tax_sub': { az: 'Burada əlavə/redaktə etdiyin dəyərlər qeydiyyat, profil, post tag-ları, kod dili seçimi, tapşırıq kateqoriyaları və statistikada avtomatik görünür.', en: 'Values added/edited here automatically appear in registration, profiles, tags, etc.', ru: 'Добавленные/измененные здесь значения автоматически появляются при регистрации, в профиле и т.д.' },
  'adm.tax_seed': { az: 'Standart dəsti bazaya yüklə', en: 'Load default set to DB', ru: 'Загрузить стандартный набор в БД' },
  'adm.tax_prog': { az: 'Proqramlaşdırma', en: 'Programming', ru: 'Программирование' },
  'adm.tax_spoken': { az: 'Danışıq dilləri', en: 'Spoken languages', ru: 'Разговорные языки' },
  'adm.btn_add': { az: '+ Yeni əlavə et', en: '+ Add new', ru: '+ Добавить новый' },
  'adm.pub': { az: '🌐 Public sayt məzmunu', en: '🌐 Public site content', ru: '🌐 Публичный контент' },
  'adm.pub_seed': { az: 'Default FAQ + Rəy dəstini yüklə', en: 'Load default FAQ + Testimonial set', ru: 'Загрузить стандартный FAQ и Отзывы' },
  'adm.pub_faq': { az: 'FAQ', en: 'FAQ', ru: 'FAQ' },
  'adm.pub_testi': { az: 'Rəylər', en: 'Testimonials', ru: 'Отзывы' },
  'adm.pub_msg': { az: '📩 Əlaqə mesajları', en: '📩 Contact messages', ru: '📩 Сообщения контактов' },
  'adm.add_adm': { az: 'Admin əlavə et', en: 'Add admin', ru: 'Добавить админа' },
  'adm.adm_ph': { az: 'istifadəçi adı', en: 'username', ru: 'имя пользователя' },
  'adm.adm_btn': { az: 'Admin et', en: 'Make admin', ru: 'Сделать админом' },
  'adm.users': { az: 'Bütün istifadəçilər', en: 'All users', ru: 'Все пользователи' },
  'adm.log': { az: '📜 Admin əməliyyat jurnalı', en: '📜 Admin action log', ru: '📜 Лог действий админов' },

  /* ---------- TASK-6 / BÖLMƏ 3 — admin paneli ---------- */
  // xülasə kartları (Admin#1 rəng kodlaması)
  'adm.st_users':   { az: 'ümumi istifadəçi', en: 'total users', ru: 'всего пользователей' },
  'adm.st_reports': { az: 'açıq şikayət', en: 'open reports', ru: 'открытых жалоб' },
  'adm.st_pending': { az: 'yoxlama gözləyən həll', en: 'solutions pending review', ru: 'решений на проверке' },
  'adm.st_blocked': { az: 'bloklanmış', en: 'blocked', ru: 'заблокировано' },
  'adm.st_admins':  { az: 'admin', en: 'admins', ru: 'админов' },
  'adm.spark_days': { az: 'son 30 gün', en: 'last 30 days', ru: 'последние 30 дней' },

  // istifadəçi siyahısı (Admin#4/#5/#10/#11)
  'adm.u_search':      { az: '⌕ Ad və ya istifadəçi adı...', en: '⌕ Name or username...', ru: '⌕ Имя или юзернейм...' },
  'adm.f_all':         { az: 'Hamısı', en: 'All', ru: 'Все' },
  'adm.f_blocked':     { az: 'Yalnız bloklanmış', en: 'Blocked only', ru: 'Только заблокированные' },
  'adm.f_admin':       { az: 'Yalnız adminlər', en: 'Admins only', ru: 'Только админы' },
  'adm.f_verified':    { az: 'Yalnız təsdiqlənmiş', en: 'Verified only', ru: 'Только подтверждённые' },
  'adm.bulk':          { az: 'Toplu əməliyyatlar', en: 'Bulk actions', ru: 'Массовые действия' },
  'adm.select_all':    { az: 'Hamısını seç', en: 'Select all', ru: 'Выбрать все' },
  'adm.selected':      { az: '{0} seçilib', en: '{0} selected', ru: 'Выбрано: {0}' },
  'adm.bulk_block':    { az: 'Blokla', en: 'Block', ru: 'Заблокировать' },
  'adm.bulk_unblock':  { az: 'Blokdan çıxar', en: 'Unblock', ru: 'Разблокировать' },
  'adm.bulk_confirm':  { az: '{0} istifadəçi üçün "{1}" əməliyyatı icra olunacaq. Davam edilsin?', en: '"{1}" will be applied to {0} users. Continue?', ru: '«{1}» будет применено к {0} пользователям. Продолжить?' },
  'adm.bulk_done':     { az: '{0} istifadəçi yeniləndi', en: '{0} users updated', ru: 'Обновлено пользователей: {0}' },
  'adm.export_users':  { az: '⭳ İstifadəçiləri ixrac et', en: '⭳ Export users', ru: '⭳ Экспорт пользователей' },
  'adm.export_logs':   { az: '⭳ Jurnalı ixrac et', en: '⭳ Export log', ru: '⭳ Экспорт лога' },
  'adm.u_none':        { az: 'Uyğun istifadəçi tapılmadı', en: 'No matching users', ru: 'Пользователи не найдены' },

  // terminal jurnal (Admin#6)
  'adm.lvl_all':    { az: 'Bütün səviyyələr', en: 'All levels', ru: 'Все уровни' },
  'adm.autoscroll': { az: 'Avto-sürüşmə', en: 'Auto-scroll', ru: 'Автопрокрутка' },
  'adm.log_copy':   { az: '⧉ Kopyala', en: '⧉ Copy', ru: '⧉ Копировать' },
  'adm.log_more':   { az: '↓ Daha çox yüklə', en: '↓ Load more', ru: '↓ Загрузить ещё' },
  'adm.log_empty':  { az: 'Jurnal boşdur.', en: 'Log is empty.', ru: 'Лог пуст.' },
  'adm.log_copied': { az: 'Jurnal kopyalandı', en: 'Log copied', ru: 'Лог скопирован' },

  // taksonomiya DnD (Admin#3)
  'adm.tax_drag':   { az: 'Sürüşdürüb sırala', en: 'Drag to reorder', ru: 'Перетащите для сортировки' },
  'adm.tax_up':     { az: 'Yuxarı daşı', en: 'Move up', ru: 'Вверх' },
  'adm.tax_down':   { az: 'Aşağı daşı', en: 'Move down', ru: 'Вниз' },
  'adm.tax_saved':  { az: 'Sıra yadda saxlanıldı', en: 'Order saved', ru: 'Порядок сохранён' },
  'adm.tax_hint':   { az: 'Elementi sürüşdür və ya ↑/↓ düymələri ilə daşı — sıra avtomatik yadda saxlanılır.', en: 'Drag an item or use ↑/↓ — the order is saved automatically.', ru: 'Перетащите элемент или используйте ↑/↓ — порядок сохраняется автоматически.' },

  // modal (Admin#9)
  'adm.rooms_title': { az: '# Otaqlar', en: '# Rooms', ru: '# Комнаты' },
  'adm.rooms_none':  { az: 'Otaq yoxdur', en: 'No rooms', ru: 'Нет комнат' },
  'adm.room_open':   { az: 'Otağa keç', en: 'Open room', ru: 'Открыть' },

  /* ---------- JS Dynamic Messages ---------- */
  'dyn.pass_upd': { az: 'Şifrə yeniləndi', en: 'Password updated', ru: 'Пароль обновлен' },
  'dyn.pass_err': { az: 'Yeni şifrə minimum 6 simvol.', en: 'New password min 6 chars.', ru: 'Новый пароль мин 6 символов.' },
  'dyn.logout': { az: 'Çıxış edildi', en: 'Logged out', ru: 'Вышли из системы' },
  'dyn.checking': { az: 'Yoxlanılır...', en: 'Checking...', ru: 'Проверка...' },
  'dyn.login': { az: 'Daxil ol', en: 'Login', ru: 'Войти' },
  'dyn.err_try': { az: 'Xəta baş verdi', en: 'An error occurred', ru: 'Произошла ошибка' },

  /* ---------- Wizard ---------- */
  'wiz.step1': { az: 'Addım {0}/{1} — {2}', en: 'Step {0}/{1} — {2}', ru: 'Шаг {0}/{1} — {2}' },
  'wiz.title1': { az: 'Hesab', en: 'Account', ru: 'Аккаунт' },
  'wiz.title2': { az: 'Şəxsi məlumat', en: 'Personal info', ru: 'Личные данные' },
  'wiz.title3': { az: 'Bacarıqlar və hədəflər', en: 'Skills & Goals', ru: 'Навыки и цели' },
  'wiz.title4': { az: 'Sosial (hamısı könüllü)', en: 'Social (optional)', ru: 'Социальные сети (необязательно)' },
  'wiz.btn_next': { az: 'İrəli →', en: 'Next →', ru: 'Далее →' },
  'wiz.btn_finish': { az: '✓ Hesab yarat', en: '✓ Create account', ru: '✓ Создать аккаунт' },
  'wiz.err_uname': { az: 'İstifadəçi adı düzgün deyil (3-20 simvol: a-z, 0-9, . _).', en: 'Invalid username (3-20 chars: a-z, 0-9, . _).', ru: 'Недопустимое имя (3-20 символов: a-z, 0-9, . _).' },
  'wiz.err_pass_len': { az: 'Şifrə minimum 6 simvol olmalıdır.', en: 'Password must be at least 6 characters.', ru: 'Пароль должен содержать минимум 6 символов.' },
  'wiz.err_pass_match': { az: 'Şifrələr uyğun gəlmir.', en: 'Passwords do not match.', ru: 'Пароли не совпадают.' },
  'wiz.err_email': { az: 'Email formatı düzgün deyil.', en: 'Invalid email format.', ru: 'Неверный формат email.' },
  'wiz.err_uname_taken': { az: 'Bu istifadəçi adı artıq tutulub.', en: 'This username is taken.', ru: 'Это имя пользователя занято.' },
  'wiz.lbl_uname': { az: 'İstifadəçi adı', en: 'Username', ru: 'Имя пользователя' },
  'wiz.lbl_uname_hint': { az: 'Yalnız a-z, 0-9, nöqtə və alt xətt', en: 'Only a-z, 0-9, dots and underscores', ru: 'Только a-z, 0-9, точки и подчеркивания' },
  'wiz.lbl_pass': { az: 'Şifrə (min 6 simvol)', en: 'Password (min 6 chars)', ru: 'Пароль (мин 6 символов)' },
  'wiz.lbl_pass2': { az: 'Şifrənin təkrarı', en: 'Repeat password', ru: 'Повторите пароль' },
  'wiz.ph_pass2': { az: 'Şifrəni təkrar yaz', en: 'Repeat password', ru: 'Повторите пароль' },
  'wiz.lbl_email': { az: 'Email (könüllü — yalnız əlaqə üçün)', en: 'Email (optional — contact only)', ru: 'Email (необязательно — только для связи)' },
  'wiz.pass_show': { az: 'Şifrəni göstər', en: 'Show password', ru: 'Показать пароль' },
  'wiz.pass_str': { az: 'Güc: ', en: 'Strength: ', ru: 'Сложность: ' },
  'wiz.err_name': { az: 'Ad boş ola bilməz.', en: 'Name cannot be empty.', ru: 'Имя не может быть пустым.' },
  'wiz.err_bd': { az: 'Doğum tarixini seç.', en: 'Select birth date.', ru: 'Выберите дату рождения.' },
  'wiz.err_age': { az: 'Platforma yalnız 18 yaşdan yuxarı istifadəçilər üçündür.', en: 'Platform is for 18+ users only.', ru: 'Платформа только для пользователей 18+.' },
  'wiz.err_bd_inv': { az: 'Doğum tarixi düzgün deyil.', en: 'Invalid birth date.', ru: 'Недопустимая дата рождения.' },
  'wiz.err_gender': { az: 'Cinsi seç.', en: 'Select gender.', ru: 'Выберите пол.' },
  'wiz.lbl_photo': { az: 'Profil şəkli seç', en: 'Choose profile photo', ru: 'Выберите фото профиля' },
  'wiz.lbl_name': { az: 'Tam ad', en: 'Full name', ru: 'Полное имя' },
  'wiz.ph_name': { az: 'Ad Soyad', en: 'Name Surname', ru: 'Имя Фамилия' },
  'wiz.lbl_bd': { az: 'Doğum tarixi (18+ məcburi)', en: 'Birth date (18+ required)', ru: 'Дата рождения (18+ обязательно)' },
  'wiz.lbl_gender': { az: 'Cins', en: 'Gender', ru: 'Пол' },
  'wiz.lbl_country': { az: 'Ölkə (könüllü)', en: 'Country (optional)', ru: 'Страна (необязательно)' },
  'wiz.ph_country': { az: 'Azərbaycan', en: 'Azerbaijan', ru: 'Азербайджан' },
  'wiz.lbl_city': { az: 'Şəhər (könüllü)', en: 'City (optional)', ru: 'Город (необязательно)' },
  'wiz.ph_city': { az: 'Bakı', en: 'Baku', ru: 'Баку' },
  'wiz.lbl_bio': { az: 'Bio (könüllü)', en: 'Bio (optional)', ru: 'Био (необязательно)' },
  'wiz.ph_bio': { az: 'Özün haqqında qısa...', en: 'Briefly about yourself...', ru: 'Коротко о себе...' },
  'wiz.lbl_prog': { az: 'Proqramlaşdırma dilləri', en: 'Programming languages', ru: 'Языки программирования' },
  'wiz.hint_prog': { az: 'Klik: Başlanğıc → Orta → Qabaqcıl → çıxart', en: 'Click: Beginner → Intermediate → Advanced → remove', ru: 'Клик: Начинающий → Средний → Продвинутый → убрать' },
  'wiz.lbl_lang': { az: 'Öyrəndiyi / bildiyi dillər', en: 'Spoken / Learning languages', ru: 'Владение языками' },
  'wiz.hint_lang': { az: 'Klik sayı ilə səviyyə seç', en: 'Select level by clicking', ru: 'Выберите уровень кликами' },
  'wiz.lbl_goals': { az: 'Öyrənmə hədəfləri (könüllü)', en: 'Learning goals (optional)', ru: 'Цели обучения (необязательно)' },
  'wiz.ph_goals': { az: 'Məs.: 3 aya Python-da orta səviyyəyə çatmaq...', en: 'E.g.: Reach intermediate Python in 3 months...', ru: 'Напр.: Достичь среднего уровня Python за 3 месяца...' },
  'wiz.lbl_lf': { az: 'Nə axtarıram? (könüllü)', en: 'What am I looking for? (optional)', ru: 'Что я ищу? (необязательно)' },
  'wiz.lbl_site': { az: 'Şəxsi sayt', en: 'Personal website', ru: 'Личный сайт' },
  'wiz.err_site': { az: 'Sayt ünvanı http(s):// ilə başlamalıdır.', en: 'Website must start with http(s)://.', ru: 'Адрес сайта должен начинаться с http(s)://.' },
  'wiz.create_load': { az: 'Hesab yaradılır...', en: 'Creating account...', ru: 'Создание аккаунта...' },

  /* ---------- Profile & Users ---------- */
  'prof.no_prog': { az: 'Hələ irəliləyiş məlumatı yoxdur — post paylaş və tapşırıq həll et.', en: 'No progress yet — share posts and solve tasks.', ru: 'Пока нет прогресса — делитесь постами и решайте задачи.' },
  'prof.ch_pass': { az: 'Şifrəni dəyiş', en: 'Change password', ru: 'Изменить пароль' },
  'prof.cur_pass': { az: 'Hazırkı şifrə', en: 'Current password', ru: 'Текущий пароль' },
  'prof.new_pass': { az: 'Yeni şifrə (min 6)', en: 'New password (min 6)', ru: 'Новый пароль (мин 6)' },
  'prof.err_pass_fld': { az: 'Sahələri doldur (yeni şifrə min 6 simvol).', en: 'Fill fields (new pass min 6 chars).', ru: 'Заполните поля (новый пароль мин 6 символов).' },
  'prof.btn_pass': { az: 'Şifrəni yenilə', en: 'Update password', ru: 'Обновить пароль' },
  'prof.new_uname': { az: 'Yeni istifadəçi adı', en: 'New username', ru: 'Новое имя пользователя' },
  'prof.new_uname_hint': { az: 'Login adın da dəyişəcək: yeni adla daxil olacaqsan', en: 'Login name changes too: you will log in with this', ru: 'Имя для входа тоже изменится: будете входить с новым' },
  'prof.pass_confirm': { az: 'Təsdiq üçün şifrə', en: 'Password for confirmation', ru: 'Пароль для подтверждения' },
  'prof.warn_set': { az: 'Hesab əməliyyatları (şifrə, silmə, data ixracı) — Parametrlər səhifəsində və Təhlükəsizlik tabındadır.', en: 'Account actions (password, delete, export) — in Settings and Security tab.', ru: 'Действия с аккаунтом (пароль, удаление, экспорт) — на странице Настройки и вкладке Безопасность.' },
  'prof.upd_ok': { az: 'Profil yeniləndi', en: 'Profile updated', ru: 'Профиль обновлен' },
  'prof.edit_title': { az: '✎ Profili redaktə et', en: '✎ Edit profile', ru: '✎ Редактировать профиль' },
  'usr.view': { az: 'Profilə bax', en: 'View profile', ru: 'Посмотреть профиль' },
  'usr.msg': { az: 'Mesaj yaz', en: 'Send message', ru: 'Написать сообщение' },
  'usr.act_map': { az: 'Aktivlik xəritəsi', en: 'Activity map', ru: 'Карта активности' },
  'usr.lvl': { az: 'Səviyyə', en: 'Level', ru: 'Уровень' },
  'usr.streak': { az: '🔥 seriya', en: '🔥 streak', ru: '🔥 серия' },
  'usr.tasks': { az: '☑ tapşırıq', en: '☑ tasks', ru: '☑ задач' },
  'usr.posts': { az: 'Paylaşımlar', en: 'Posts', ru: 'Посты' },
  'usr.no_posts': { az: 'Hələ paylaşım yoxdur', en: 'No posts yet', ru: 'Пока нет постов' },

  /* ---------- Settings ---------- */
  'set.err_len': { az: 'Yeni şifrə minimum 6 simvol olmalıdır.', en: 'New password must be at least 6 chars.', ru: 'Новый пароль должен содержать минимум 6 символов.' },
  'set.del_warn': { az: 'Hesabınız, profiliniz və istifadəçi adınız birdəfəlik silinəcək. Bu əməliyyat geri qaytarıla bilməz.', en: 'Your account, profile and username will be permanently deleted. This cannot be undone.', ru: 'Ваш аккаунт, профиль и имя пользователя будут удалены навсегда. Это действие необратимо.' },
  'set.ph_pass': { az: 'Şifrəni daxil et', en: 'Enter password', ru: 'Введите пароль' },
  'set.del_hint': { az: 'Hesabı silmək üçün şifrənizi daxil edin.', en: 'Enter your password to delete the account.', ru: 'Введите пароль для удаления аккаунта.' },

  /* ---------- Feed / Saved ---------- */
  'feed.greeting': { az: 'Xoş gəldin', en: 'Welcome', ru: 'Добро пожаловать' },
  'feed.empty_all': { az: 'Hələ paylaşım yoxdur. İlk paylaşımı sən et!', en: 'No posts yet. Be the first to post!', ru: 'Пока нет постов. Опубликуйте первым!' },
  'feed.empty_following': { az: 'İzlədiklərindən hələ paylaşım yoxdur — İstifadəçilər bölməsindən izləməyə başla.', en: 'No posts from people you follow yet — start following in the Users section.', ru: 'Пока нет постов от тех, на кого вы подписаны — подпишитесь в разделе Пользователи.' },
  'feed.edit_title': { az: '✎ Paylaşımı redaktə et', en: '✎ Edit post', ru: '✎ Редактировать пост' },
  'feed.comments': { az: 'Şərhlər', en: 'Comments', ru: 'Комментарии' },
  // Qeyd: düymənin qarşısında artıq SVG ikon var (icons.js) — mətndə ⧉ glifi təkrarlanmır.
  'feed.copy_btn': { az: 'Kopyala', en: 'Copy', ru: 'Копировать' },
  'feed.img_edit_note': { az: '🖼 Şəkil bloku — şəkillər redaktədə dəyişmir', en: '🖼 Image block — images are not editable here', ru: '🖼 Блок изображения — изображения не редактируются' },
  'feed.no_saved': { az: 'Heç bir saxlanılan məzmun yoxdur.', en: 'No saved content.', ru: 'Нет сохраненного контента.' },
  'feed.empty_saved': { az: 'Hələ saxlanılan paylaşım yoxdur — feed-də ☆ düyməsi ilə saxla.', en: 'No saved posts yet — use ☆ to save.', ru: 'Пока нет сохраненных постов — нажмите ☆ чтобы сохранить.' },
  'feed.empty_del': { az: 'Saxlanılan paylaşımlar tapılmadı (silinmiş ola bilər).', en: 'Saved posts not found (may have been deleted).', ru: 'Сохраненные посты не найдены (возможно удалены).' },
  'feed.edited': { az: '(redaktə olunub)', en: '(edited)', ru: '(изменено)' },
  // Kart 3-nöqtə menyusu (əvvəl sabit ingilis mətn idi).
  'feed.menu_copy': { az: 'Linki kopyala', en: 'Copy link', ru: 'Скопировать ссылку' },
  'feed.menu_edit': { az: 'Redaktə et', en: 'Edit post', ru: 'Редактировать' },
  'feed.menu_del': { az: 'Sil', en: 'Delete', ru: 'Удалить' },
  'feed.menu_report': { az: 'Şikayət et', en: 'Report', ru: 'Пожаловаться' },
  'feed.reported': { az: 'Admin-lərə bildirildi', en: 'Reported to admins', ru: 'Отправлено администраторам' },
  'feed.not_found': { az: 'Post tapılmadı', en: 'Post not found', ru: 'Пост не найден' },
  'feed.not_found_del': { az: 'Post tapılmadı və ya silinib', en: 'Post not found or deleted', ru: 'Пост не найден или удален' },
  'feed.ph_comment': { az: 'Şərh yaz... (@ ilə istifadəçi qeyd et)', en: 'Write comment... (@ to tag)', ru: 'Написать комментарий... (@ для отметки)' },
  'feed.comment_fail': { az: 'Şərh göndərilə bilmədi', en: 'Failed to send comment', ru: 'Не удалось отправить комментарий' },
  'feed.no_comments': { az: 'Hələ şərh yoxdur — ilk şərhi sən yaz.', en: 'No comments yet — be the first to write.', ru: 'Пока нет комментариев — напишите первым.' },
  'feed.comment_del_conf': { az: 'Şərh silinsin?', en: 'Delete comment?', ru: 'Удалить комментарий?' },
  'feed.comment_del_replies_conf': { az: 'Bu şərh və bütün cavabları silinsin?', en: 'Delete this comment and all its replies?', ru: 'Удалить этот комментарий и все ответы?' },
  'feed.reply': { az: 'Cavab yaz', en: 'Reply', ru: 'Ответить' },
  'feed.ph_reply': { az: 'Cavab yaz... (@ ilə qeyd et)', en: 'Write a reply... (@ to tag)', ru: 'Написать ответ... (@ для отметки)' },
  'feed.sort_new': { az: 'Ən yeni', en: 'Newest', ru: 'Новые' },
  'feed.sort_top': { az: 'Ən çox bəyənilən', en: 'Top', ru: 'Популярные' },
  'feed.load_more_comments': { az: '↓ Daha çox rəy yüklə', en: '↓ Load more comments', ru: '↓ Загрузить ещё' },
  'dyn.copy_ok': { az: 'Kod kopyalandı', en: 'Code copied', ru: 'Код скопирован' },
  'dyn.copy_fail': { az: 'Kopyalana bilmədi', en: 'Failed to copy', ru: 'Не удалось скопировать' },
  'dyn.copied': { az: 'Kopyalandı', en: 'Copied', ru: 'Скопировано' },

  /* ---------- Chat / DM ---------- */
  'chat.ph_msg': { az: 'Mesaj yaz...', en: 'Write a message...', ru: 'Напишите сообщение...' },
  'chat.empty': { az: 'Mesaj yoxdur. İlk yazan siz olun!', en: 'No messages. Be the first to write!', ru: 'Нет сообщений. Будьте первым!' },
  'chat.empty_chat': { az: 'Hələ mesaj yoxdur. Söhbətə başla!', en: 'No messages yet. Start chatting!', ru: 'Пока нет сообщений. Начните беседу!' },
  'chat.empty_dm_users': { az: 'Hələ başqa istifadəçi yoxdur', en: 'No other users yet', ru: 'Пока нет других пользователей' },
  'chat.empty_dm_msgs': { az: 'Hələ mesaj yoxdur, ilk mesajı yaz', en: 'No messages yet, write the first one', ru: 'Пока нет сообщений, напишите первое' },
  'chat.typing': { az: 'yazır…', en: 'is typing…', ru: 'печатает…' },
  'chat.someone': { az: 'Kimsə', en: 'Someone', ru: 'Кто-то' },

  /* ---------- Actions / Dynamic ---------- */
  'dyn.del_fail': { az: 'Silinə bilmədi', en: 'Failed to delete', ru: 'Не удалось удалить' },
  'dyn.upd_fail': { az: 'Yenilənə bilmədi', en: 'Failed to update', ru: 'Не удалось обновить' },
  'dyn.save': { az: 'Yadda saxla', en: 'Save', ru: 'Сохранить' },
  'dyn.cancel': { az: 'İmtina', en: 'Cancel', ru: 'Отмена' },
  'dyn.edit_msg': { az: '✎ Mesajı redaktə et', en: '✎ Edit message', ru: '✎ Редактировать сообщение' },
  'dyn.msg_del_conf': { az: 'Mesaj silinsin?', en: 'Delete message?', ru: 'Удалить сообщение?' },
  'dyn.msg_upd': { az: 'Mesaj yeniləndi', en: 'Message updated', ru: 'Сообщение обновлено' },
  'dyn.msg_send_fail': { az: 'Mesaj göndərilə bilmədi', en: 'Failed to send message', ru: 'Не удалось отправить сообщение' },
  'dyn.room_del_conf': { az: 'Otaq silinsin? Mesajlar arxivdə qalır, otaq siyahıdan çıxır.', en: 'Delete room? Messages remain in archive, room is removed from list.', ru: 'Удалить комнату? Сообщения останутся в архиве, комната пропадет из списка.' },
  'dyn.room_del': { az: 'Otaq silindi', en: 'Room deleted', ru: 'Комната удалена' },
  'dyn.read_more': { az: 'Daha çox oxu →', en: 'Read more →', ru: 'Читать далее →' },
  'dyn.post_del_conf': { az: 'Bu paylaşım, şərhləri və şəkilləri birdəfəlik silinəcək.', en: 'This post, comments, and images will be permanently deleted.', ru: 'Этот пост, комментарии и изображения будут удалены навсегда.' },
  'dyn.post_del': { az: 'Paylaşım silindi', en: 'Post deleted', ru: 'Пост удален' },
  'dyn.err_generic': { az: 'Alınmadı', en: 'Failed', ru: 'Ошибка' },
  'dyn.err_img': { az: 'Şəkil oxuna bilmədi', en: 'Failed to read image', ru: 'Не удалось прочитать изображение' },
  'dyn.saved': { az: 'Saxlanıldı', en: 'Saved', ru: 'Сохранено' },
  'dyn.unsaved': { az: 'Saxlanılanlardan çıxarıldı', en: 'Removed from saved', ru: 'Удалено из сохраненных' },
  'dyn.post_upd': { az: 'Paylaşım yeniləndi', en: 'Post updated', ru: 'Пост обновлен' },
  'dyn.err_user': { az: 'İstifadəçi tapılmadı', en: 'User not found', ru: 'Пользователь не найден' },
  'dyn.reported': { az: 'Şikayət göndərildi', en: 'Report sent', ru: 'Жалоба отправлена' },
  'dyn.report_fail': { az: 'Şikayət göndərilə bilmədi', en: 'Failed to send report', ru: 'Не удалось отправить жалобу' },
  'dyn.username_ok': { az: 'İstifadəçi adı dəyişdirildi', en: 'Username changed', ru: 'Имя пользователя изменено' },
  'dyn.err_name': { az: 'Ad boş ola bilməz', en: 'Name cannot be empty', ru: 'Имя не может быть пустым' },
  'dyn.err_age': { az: 'Yaş 18-dən az ola bilməz', en: 'Age cannot be less than 18', ru: 'Возраст не может быть меньше 18' },
  'dyn.err_url': { az: 'Sayt http(s):// ilə başlamalıdır', en: 'Site must start with http(s)://', ru: 'Сайт должен начинаться с http(s)://' },
  'dyn.err_uname_fmt': { az: 'İstifadəçi adı düzgün deyil (3-20 simvol: a-z, 0-9, . _).', en: 'Invalid username (3-20 chars: a-z, 0-9, . _).', ru: 'Неверное имя пользователя (3-20 символов: a-z, 0-9, . _).' },

  /* ---------- Composer ---------- */
  'comp.text_ph':   { az: 'Mətn yaz... (markdown dəstəklənir: **qalın**, *kursiv*, [link](url), - siyahı)', en: 'Write text... (markdown supported: **bold**, *italic*, [link](url), - list)', ru: 'Напишите текст... (поддерживается markdown: **жирный**, *курсив*, [ссылка](url), - список)' },
  'comp.code_ph':   { az: '// kodunu bura yaz...', en: '// write your code here...', ru: '// напишите код здесь...' },
  'comp.cap_ph':    { az: 'Başlıq / izah (könüllü)', en: 'Caption / description (optional)', ru: 'Подпись / описание (необязательно)' },
  'comp.img_add':   { az: '＋ Şəkil əlavə et', en: '＋ Add image', ru: '＋ Добавить изображение' },
  'comp.type_text': { az: '¶ Mətn', en: '¶ Text', ru: '¶ Текст' },
  'comp.type_code': { az: '</> Kod', en: '</> Code', ru: '</> Код' },
  'comp.type_img':  { az: '🖼 Şəkil (maks 6)', en: '🖼 Image (max 6)', ru: '🖼 Изображение (макс 6)' },
  'comp.quote_on':  { az: '↪ Fikir bildirilir', en: '↪ Quoting', ru: '↪ Цитирование' },
  'comp.quote_cancel': { az: '✕ Ləğv et', en: '✕ Cancel', ru: '✕ Отменить' },
  'comp.empty':     { az: 'Post boş ola bilməz', en: 'Post cannot be empty', ru: 'Пост не может быть пустым' },
  'comp.quote_need_text': { az: 'Sitat üçün öz fikrini yaz', en: 'Write your own text to quote', ru: 'Напишите свой текст для цитаты' },
  'comp.published': { az: 'Paylaşıldı', en: 'Posted', ru: 'Опубликовано' },
  'comp.fail':      { az: 'Paylaşım alınmadı', en: 'Failed to post', ru: 'Не удалось опубликовать' },
  'comp.up':        { az: 'Yuxarı', en: 'Move up', ru: 'Вверх' },
  'comp.down':      { az: 'Aşağı', en: 'Move down', ru: 'Вниз' },
  'comp.del':       { az: 'Sil', en: 'Delete', ru: 'Удалить' },
  'comp.img_fail':  { az: 'Şəkil oxuna bilmədi', en: 'Failed to read image', ru: 'Не удалось прочитать изображение' },

  /* ---------- Share / Re-post / Quote ---------- */
  'share.title':    { az: 'Paylaş', en: 'Share', ru: 'Поделиться' },
  'share.repost':   { az: '↺ Birbaşa paylaş', en: '↺ Repost', ru: '↺ Репост' },
  'share.reposted': { az: '✓ Paylaşıldı — geri al', en: '✓ Reposted — undo', ru: '✓ Репостнуто — отменить' },
  'share.quote':    { az: '❝ Fikirlə paylaş', en: '❝ Quote', ru: '❝ Цитировать' },
  'share.copy':     { az: '🔗 Linki kopyala', en: '🔗 Copy link', ru: '🔗 Скопировать ссылку' },
  'share.copied':   { az: 'Link kopyalandı ✓', en: 'Link copied ✓', ru: 'Ссылка скопирована ✓' },
  'share.external': { az: 'Xaricə paylaş', en: 'Share externally', ru: 'Поделиться вовне' },
  'share.native':   { az: '⇪ Cihazla paylaş', en: '⇪ Share via device', ru: '⇪ Поделиться через устройство' },
  'share.wa':       { az: 'WhatsApp', en: 'WhatsApp', ru: 'WhatsApp' },
  'share.tg':       { az: 'Telegram', en: 'Telegram', ru: 'Telegram' },
  'share.fb':       { az: 'Facebook', en: 'Facebook', ru: 'Facebook' },
  'share.x':        { az: 'X', en: 'X', ru: 'X' },
  'share.li':       { az: 'LinkedIn', en: 'LinkedIn', ru: 'LinkedIn' },
  'share.by':       { az: 're-post etdi', en: 'reposted', ru: 'сделал репост' },
  'share.orig':     { az: 'Orijinal paylaşım', en: 'Original post', ru: 'Оригинальный пост' },
  'share.deleted':  { az: 'Bu məzmun silinib', en: 'This content was deleted', ru: 'Этот контент удалён' },
  'share.count':    { az: 'paylaşım', en: 'shares', ru: 'репостов' },
  'share.self':     { az: 'Öz paylaşımını re-post edə bilməzsən', en: 'You can’t repost your own post', ru: 'Нельзя репостить свой пост' },
  'share.fail':     { az: 'Paylaşıla bilmədi', en: 'Could not share', ru: 'Не удалось поделиться' },
  // Toast mətnləri — yuxarıdakı share.repost/share.reposted DÜYMƏ etiketləridir.
  'share.done':     { az: 'Paylaşıldı ✓', en: 'Reposted ✓', ru: 'Репост сделан ✓' },
  'share.undone':   { az: 'Paylaşım geri alındı', en: 'Repost removed', ru: 'Репост отменён' },
  // Yenilənmiş paylaş modalı (ikon + təsvir) — glyph-siz təmiz etiketlər.
  'share.repost_do':   { az: 'Birbaşa paylaş', en: 'Repost', ru: 'Репост' },
  'share.reposted_do': { az: 'Paylaşıldı', en: 'Reposted', ru: 'Репостнуто' },
  'share.repost_hint': { az: 'Postu olduğu kimi profilində paylaş', en: 'Share to your profile as-is', ru: 'Поделиться в профиле как есть' },
  'share.quote_do':    { az: 'Fikirlə paylaş', en: 'Quote', ru: 'Цитировать' },
  'share.quote_hint':  { az: 'Öz şərhini əlavə edərək paylaş', en: 'Add your own take', ru: 'Добавьте своё мнение' },
  'share.copy_do':     { az: 'Kopyala', en: 'Copy', ru: 'Копир.' },
  'prof.stat_orig': { az: 'Orijinal', en: 'Original', ru: 'Оригинал' },
  'prof.stat_repost': { az: 'Re-post', en: 'Reposts', ru: 'Репосты' },
  'prof.stat_quote': { az: 'Sitat', en: 'Quotes', ru: 'Цитаты' },
  'prof.stat_shares': { az: 'Alınan paylaşım', en: 'Shares received', ru: 'Получено репостов' },

  /* ---------- Badges ---------- */
  'badge.first_post': { az: 'İlk paylaşım', en: 'First post', ru: 'Первый пост' },
  'badge.streak_7': { az: '7 gün seriya', en: '7 day streak', ru: 'Серия 7 дней' },
  'badge.streak_30': { az: '30 gün seriya', en: '30 day streak', ru: 'Серия 30 дней' },
  'badge.task_1': { az: 'İlk tapşırıq', en: 'First task', ru: 'Первое задание' },
  'badge.task_10': { az: '10 tapşırıq', en: '10 tasks', ru: '10 заданий' },
  'badge.xp_500': { az: '500 XP', en: '500 XP', ru: '500 XP' },
  'badge.xp_2000': { az: '2000 XP', en: '2000 XP', ru: '2000 XP' }
};

export function getLang(){ return current; }

// Dev-də çatışmayan açarları yığırıq (prod-da səssiz). window.__i18nMissing() → missing-i18n JSON.
const DEV = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) || false;
const _missing = new Set();
function reportMissing(key){
  if(!DEV || _missing.has(key)) return;
  _missing.add(key);
  console.warn('[i18n] çatışmayan açar:', key);
}
if(typeof window !== 'undefined'){
  window.__i18nMissing = () => JSON.stringify([...(_missing)].sort(), null, 2);
}

// Açar tapılmasa: xam açarı yox, oxunaqlı mətn qaytar ("nav.home" → "Home").
function humanize(key){
  const tail = String(key).split('.').pop().replace(/[_-]+/g, ' ').trim();
  return tail ? tail.charAt(0).toUpperCase() + tail.slice(1) : String(key);
}

export function t(key){
  const e = D[key];
  if(!e){ reportMissing(key); return humanize(key); }
  return e[current] || e.az || humanize(key);
}
// Çoxdilli field ({az,en,ru}) üçün oxuyucu.
export function tf(obj){
  if(!obj) return '';
  if(typeof obj === 'string') return obj;
  return obj[current] || obj.az || Object.values(obj)[0] || '';
}

/* ---------- Locale-aware formatlama (Intl) ---------- */
const _localeTag = { az: 'az-AZ', en: 'en-US', ru: 'ru-RU' };
function localeTag(){ return _localeTag[current] || 'az-AZ'; }
export function getLocaleTag(){ return localeTag(); }

export function fmtDate(ts, opts){
  const d = ts instanceof Date ? ts : new Date(Number(ts));
  if(isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(localeTag(), opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function fmtNum(n){
  const v = Number(n);
  if(!isFinite(v)) return '0';
  return new Intl.NumberFormat(localeTag()).format(v);
}

// Nisbi vaxt: "5 dəq əvvəl" / "5 min ago" / "5 мин назад".
export function fmtRelTime(ts){
  const then = ts instanceof Date ? ts.getTime() : Number(ts);
  if(!isFinite(then)) return '';
  const diff = then - Date.now();
  const rtf = new Intl.RelativeTimeFormat(localeTag(), { numeric: 'auto' });
  const abs = Math.abs(diff);
  /** @type {Array<[Intl.RelativeTimeFormatUnit, number]>} */
  const units = [
    ['year', 31536e6], ['month', 2592e6], ['week', 6048e5],
    ['day', 864e5], ['hour', 36e5], ['minute', 6e4], ['second', 1e3],
  ];
  for(const [unit, ms] of units){
    if(abs >= ms || unit === 'second'){
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return '';
}

export function setLang(lang){
  if(!LANGS.includes(lang)) return;
  current = lang;
  localStorage.setItem(KEY, lang);
  document.documentElement.lang = lang;
  applyI18n();
  document.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang } }));
}

// data-i18n="key" → textContent; data-i18n-ph="key" → placeholder.
export function applyI18n(root = document){
  root.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(n => { n.innerHTML = t(n.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-ph]').forEach(n => { n.placeholder = t(n.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-aria]').forEach(n => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach(n => { n.title = t(n.dataset.i18nTitle); });
}

export function initI18n(){
  document.documentElement.lang = current;
  applyI18n();
}
