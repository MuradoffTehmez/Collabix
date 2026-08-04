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
  /* Hero "premium" blokunun mətnləri (2026-08-03 redizayn).
     ⚠ Üzən kartlar MƏHSULU göstərir — uydurma rəy və ya saxta rəqəm deyil:
       real bir söhbət anı, real kod bloku və real XP hadisəsi. */
  'hero.badge':    { az: '18+ icma · AZ / EN / RU', en: '18+ community · AZ / EN / RU', ru: 'Сообщество 18+ · AZ / EN / RU' },
  'hero.f1_who':   { az: 'Aysel', en: 'Aysel', ru: 'Айсель' },
  'hero.f1_msg':   { az: 'Bu döngü niyə işləmir?', en: 'Why is this loop not working?', ru: 'Почему этот цикл не работает?' },
  'hero.f2_who':   { az: 'Rəşad', en: 'Rashad', ru: 'Рашад' },
  'hero.f2_msg':   { az: 'Diapazon 1-dən başlayır — bax:', en: 'Range starts at 1 — look:', ru: 'range начинается с 1 — смотри:' },
  'hero.f3_title': { az: 'Gündəlik seriya', en: 'Daily streak', ru: 'Ежедневная серия' },
  'hero.f3_sub':   { az: '+50 XP qazandın', en: 'You earned +50 XP', ru: 'Вы получили +50 XP' },
  'hero.p_rooms':  { az: 'mövzu otağı', en: 'topic rooms', ru: 'тематических комнат' },
  'hero.p_langs':  { az: 'dil və texnologiya', en: 'languages & tech', ru: 'языков и технологий' },
  'hero.p_free':   { az: 'tam pulsuz', en: 'fully free', ru: 'полностью бесплатно' },

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
  'how.subtitle':  { az: 'Bir neçə sadə addımla icmaya qoşul və inkişaf etməyə başla.', en: 'Join the community and start growing in a few simple steps.', ru: 'Присоединяйтесь к сообществу и начните развиваться в несколько простых шагов.' },
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
  'codeshow.sub':  { az: 'Sual verəndə kodu şəkil kimi yox, kod kimi paylaş — oxunaqlı, kopyalana bilən, redaktə oluna bilən.', en: 'When you ask a question, share code as code — readable, copyable, editable. Not as a screenshot.', ru: 'Задавая вопрос, делись кодом как кодом — читаемым, копируемым, редактируемым. Не скриншотом.' },
  /* Kod vitrininin özəllik sətirləri (2026-08-03 redizayn). */
  'codeshow.f1t':  { az: 'Sintaksis rəngləməsi', en: 'Syntax highlighting', ru: 'Подсветка синтаксиса' },
  'codeshow.f1d':  { az: '20+ dil avtomatik tanınır — Python-dan SQL-ə qədər.', en: '20+ languages detected automatically — from Python to SQL.', ru: '20+ языков определяются автоматически — от Python до SQL.' },
  'codeshow.f2t':  { az: 'Sətir nömrələri və kopyalama', en: 'Line numbers and copy', ru: 'Номера строк и копирование' },
  'codeshow.f2d':  { az: '"3-cü sətirdə" deyə bilirsən. Kopyalayanda nömrələr düşmür.', en: 'You can say "line 3". Numbers are not copied along.', ru: 'Можно сказать «в строке 3». Номера не копируются вместе с кодом.' },
  'codeshow.f3t':  { az: 'Hər yerdə eyni redaktor', en: 'The same editor everywhere', ru: 'Один редактор везде' },
  'codeshow.f3d':  { az: 'Otaq, birbaşa mesaj, post və şərh — fərq yoxdur.', en: 'Rooms, direct messages, posts and comments — no difference.', ru: 'Комнаты, личные сообщения, посты и комментарии — без разницы.' },

  /* ---------- testimonials ---------- */
  'testi.title':   { az: 'İstifadəçilər nə deyir?', en: 'What users say', ru: 'Отзывы' },
  'testi.subtitle':{ az: 'Minlərlə proqramçı və tələbə artıq Collabix ilə öyrənir və inkişaf edir.', en: 'Thousands of developers and students are already learning and growing with Collabix.', ru: 'Тысячи разработчиков и студентов уже учатся и развиваются с Collabix.' },
  'testi.verified':{ az: 'Təsdiqlənmiş istifadəçi', en: 'Verified Member', ru: 'Подтвержденный пользователь' },
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
  'app.searchPh':  { az: 'Axtar: istifadəçi, post...', en: 'Search users, posts...', ru: 'Поиск...' },
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
  'set.theme.dark':   { az: 'Tünd', en: 'Dark', ru: 'Тёмная' },
  'set.theme.light':  { az: 'Açıq', en: 'Light', ru: 'Светлая' },
  'set.theme.matrix': { az: 'Matrix', en: 'Matrix', ru: 'Matrix' },
  'set.theme.cyberpunk': { az: 'Cyberpunk', en: 'Cyberpunk', ru: 'Киберпанк' },
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
  // "Haqqımızda" səhifəsinin CTA-sı. Qalan struktur məzmun
  // `js/about-content.js`-dədir; burada YALNIZ `data-i18n` ilə statik
  // işarələnmiş sətirlər saxlanılır (bax həmin faylın sonundakı şərh).
  'about.ctaTitle': { az: 'Qoşulmaq pulsuzdur', en: 'Joining is free', ru: 'Присоединиться бесплатно' },
  'about.ctaText': {
    az: 'Hesab açmaq bir neçə saniyə çəkir. İlk otağa girin, özünüzü təqdim edin — qalanı icma ilə gəlir.',
    en: 'Creating an account takes a few seconds. Join your first room, introduce yourself — the rest comes with the community.',
    ru: 'Регистрация занимает несколько секунд. Зайдите в первую комнату, представьтесь — остальное придёт вместе с сообществом.',
  },
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
  'a11y.closeModal':    { az: 'Pəncərəni bağla', en: 'Close dialog', ru: 'Закрыть окно' },
  'a11y.dialog':        { az: 'Dialoq pəncərəsi', en: 'Dialog', ru: 'Диалоговое окно' },
  'a11y.edit':          { az: 'Redaktə et', en: 'Edit', ru: 'Редактировать' },
  'a11y.delete':        { az: 'Sil', en: 'Delete', ru: 'Удалить' },
  'a11y.send':          { az: 'Göndər', en: 'Send', ru: 'Отправить' },
  'a11y.cancel':        { az: 'Ləğv et', en: 'Cancel', ru: 'Отмена' },
  'a11y.more':          { az: 'Daha çox', en: 'More', ru: 'Ещё' },
  'a11y.collapse':      { az: 'Yığ', en: 'Collapse', ru: 'Свернуть' },
  'a11y.removeImage':   { az: 'Şəkli sil', en: 'Remove image', ru: 'Удалить изображение' },
  /* AUDIT-UI: qalereya şəkilləri `role=button`+`tabindex` aldı — əlçatan ad lazımdır. */
  'a11y.openImage':     { az: 'Şəkli böyüt ({n})', en: 'Open image ({n})', ru: 'Открыть изображение ({n})' },

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
  /* Parol bərpasının SON EHTİYAT variantı — yalnız avtomatik sıfırlama və
     magic link mümkün olmayanda göstərilir.
     ⚠ Mətn əvvəl SABİT AZƏRBAYCANCA idi (EN/RU istifadəçi də onu görürdü)
       və mövcud OLMAYAN Instagram səhifəsinə yönləndirirdi (`SITE.social`
       qəsdən boşdur). İndi tərcümə olunur və real e-poçt kanalını göstərir. */
  'auth.forgot_t': { az: 'Parolu unutmusan?', en: 'Forgot your password?', ru: 'Забыли пароль?' },
  'auth.forgot_d': {
    az: 'Hesab e-poçtun qeydiyyatda göstərilməyibsə, avtomatik sıfırlama mümkün deyil. Bu halda bizə yaz — kimliyin təsdiqləndikdən sonra müvəqqəti parol təyin olunacaq, sonra onu Parametrlər bölməsindən dəyişərsən.',
    en: 'If no e-mail address was provided at sign-up, automatic reset is not possible. Write to us instead — once your identity is confirmed, a temporary password will be issued, which you then change in Settings.',
    ru: 'Если при регистрации не был указан e-mail, автоматический сброс невозможен. Напишите нам — после подтверждения личности будет выдан временный пароль, который вы смените в «Настройках».',
  },
  'auth.login_note': { az: 'Hesabınız yoxdursa, əvvəlcə <b>Qeydiyyat</b> bölməsindən profil yaradın.', en: 'If you do not have an account, create one in the <b>Register</b> section.', ru: 'Если у вас нет аккаунта, сначала создайте его в разделе <b>Регистрация</b>.' },

  /* ---------- App General & Sidebar ---------- */
  'app.guest': { az: 'Qonaq', en: 'Guest', ru: 'Гость' },
  'app.more': { az: 'Daha çox', en: 'More', ru: 'Ещё' },

  /* ---------- Page: Home ---------- */
  'home.welcome': { az: 'Xoş gəldin!', en: 'Welcome!', ru: 'Добро пожаловать!' },
  'home.lbl_streak': { az: 'gündəlik seriya', en: 'daily streak', ru: 'серия дней' },
  'home.lbl_xp': { az: 'XP', en: 'XP', ru: 'XP' },
  'home.lbl_users': { az: 'qeydiyyatlı istifadəçi', en: 'registered users', ru: 'зарегистрированных' },
  'home.add_text': { az: 'Mətn', en: 'Text', ru: 'Текст' },
  'home.add_code': { az: 'Kod', en: 'Code', ru: 'Код' },
  'home.add_img': { az: 'Şəkil', en: 'Image', ru: 'Изображение' },
  'home.btn_share': { az: 'Paylaş', en: 'Share', ru: 'Поделиться' },
  'home.search_feed': { az: 'Paylaşımlarda axtar (mətn, müəllif, tag)...', en: 'Search posts...', ru: 'Поиск по постами...' },
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
  'notifs.sub': { az: 'Bəyənmə, şərh, izləmə, mesaj, qeyd, tapşırıq və sistem yenilikləri', en: 'Likes, comments, follows, messages, mentions, tasks and system updates', ru: 'Лайки, комментарии, подписки, сообщения, упоминания, задачи и системные обновления' },
  'notifs.mark_all': { az: 'Hamısını oxunmuş et', en: 'Mark all as read', ru: 'Отметить всё как прочитанное' },
  'notifs.refresh': { az: 'Yenilə', en: 'Refresh', ru: 'Обновить' },
  'notifs.settings': { az: 'Parametrlər', en: 'Settings', ru: 'Настройки' },
  'notifs.search_ph': { az: 'Bildirişlərdə axtar...', en: 'Search notifications...', ru: 'Поиск по уведомлениям...' },
  'notifs.filters_label': { az: 'Bildiriş filtrləri', en: 'Notification filters', ru: 'Фильтры уведомлений' },
  'notifs.select': { az: 'Seç', en: 'Select', ru: 'Выбрать' },
  'notifs.select_done': { az: 'Bitir', en: 'Done', ru: 'Готово' },
  'notifs.select_all': { az: 'Hamısını seç', en: 'Select all', ru: 'Выбрать все' },
  'notifs.select_none': { az: 'Seçimi ləğv et', en: 'Clear selection', ru: 'Снять выделение' },

  /* Sayğac sətri — `{n}` əvəzlənir (bax `tn()`). */
  'notifs.unread_n': { az: '{n} oxunmamış bildiriş', en: '{n} unread notifications', ru: '{n} непрочитанных уведомлений' },
  'notifs.unread_0': { az: 'Oxunmamış bildiriş yoxdur', en: 'No unread notifications', ru: 'Нет непрочитанных уведомлений' },
  'notifs.synced': { az: 'Son sinxron: {t}', en: 'Last synced: {t}', ru: 'Синхронизировано: {t}' },
  'notifs.selected_n': { az: '{n} seçildi', en: '{n} selected', ru: 'Выбрано: {n}' },

  /* Filtr pilləri / statistika kartları — açarlar `TYPE_BUCKETS` ilə eynidir. */
  'notifs.b.all': { az: 'Hamısı', en: 'All', ru: 'Все' },
  'notifs.b.unread': { az: 'Oxunmamış', en: 'Unread', ru: 'Непрочитанные' },
  'notifs.b.messages': { az: 'Mesajlar', en: 'Messages', ru: 'Сообщения' },
  'notifs.b.likes': { az: 'Bəyənmələr', en: 'Likes', ru: 'Лайки' },
  'notifs.b.comments': { az: 'Şərhlər', en: 'Comments', ru: 'Комментарии' },
  'notifs.b.mentions': { az: 'Qeydlər', en: 'Mentions', ru: 'Упоминания' },
  'notifs.b.follows': { az: 'İzləyicilər', en: 'Followers', ru: 'Подписчики' },
  'notifs.b.tasks': { az: 'Tapşırıqlar', en: 'Tasks', ru: 'Задачи' },
  'notifs.b.teams': { az: 'Komandalar', en: 'Teams', ru: 'Команды' },
  'notifs.b.projects': { az: 'Layihələr', en: 'Projects', ru: 'Проекты' },
  'notifs.b.system': { az: 'Sistem', en: 'System', ru: 'Система' },
  'notifs.b.archived': { az: 'Arxiv', en: 'Archive', ru: 'Архив' },

  /* Tarix bölmələri */
  'notifs.g.pinned': { az: 'Sabitlənmiş', en: 'Pinned', ru: 'Закреплённые' },
  'notifs.g.today': { az: 'Bu gün', en: 'Today', ru: 'Сегодня' },
  'notifs.g.yesterday': { az: 'Dünən', en: 'Yesterday', ru: 'Вчера' },
  'notifs.g.week': { az: 'Bu həftə', en: 'This week', ru: 'На этой неделе' },
  'notifs.g.lastweek': { az: 'Keçən həftə', en: 'Last week', ru: 'На прошлой неделе' },
  'notifs.g.earlier': { az: 'Daha əvvəl', en: 'Earlier', ru: 'Ранее' },

  /* Nisbi vaxt.
     ⚠ Yalnız "dünən" burada: qalan pillələri (`indicə`, `5 dəqiqə əvvəl`,
       `2 saat əvvəl`) `fmtRelTime()` artıq hər üç dildə düzgün verir. Bütün
       nərdivanı təkrar yazsaydıq iki nisbi-vaxt sistemi olardı və onlar
       vaxtla ayrılardı. AZ budağı `numeric:'auto'` işlətmədiyi üçün "1 gün
       əvvəl" deyir — bu tək hal əl ilə örtülür. */
  'notifs.t.yesterday': { az: 'Dünən', en: 'Yesterday', ru: 'Вчера' },

  /* Qruplaşdırma mətnləri */
  'notifs.grp.repeat': { az: '{n} dəfə', en: '{n} times', ru: '{n} раз(а)' },
  'notifs.grp.others': { az: '{name} və daha {n} nəfər', en: '{name} and {n} others', ru: '{name} и ещё {n}' },
  'notifs.grp.expand': { az: 'Hamısını göstər', en: 'Show all', ru: 'Показать все' },
  'notifs.grp.collapse': { az: 'Yığ', en: 'Collapse', ru: 'Свернуть' },

  /* Sürətli əməliyyatlar */
  'notifs.a.read': { az: 'Oxunmuş et', en: 'Mark as read', ru: 'Отметить прочитанным' },
  'notifs.a.unread': { az: 'Oxunmamış et', en: 'Mark as unread', ru: 'Отметить непрочитанным' },
  'notifs.a.delete': { az: 'Sil', en: 'Delete', ru: 'Удалить' },
  'notifs.a.archive': { az: 'Arxivə at', en: 'Archive', ru: 'В архив' },
  'notifs.a.unarchive': { az: 'Arxivdən çıxar', en: 'Unarchive', ru: 'Из архива' },
  'notifs.a.pin': { az: 'Sabitlə', en: 'Pin', ru: 'Закрепить' },
  'notifs.a.unpin': { az: 'Sabitləməni ləğv et', en: 'Unpin', ru: 'Открепить' },
  'notifs.a.mute_type': { az: 'Bu tipi sussuz et', en: 'Mute this type', ru: 'Отключить этот тип' },
  'notifs.a.mute_user': { az: 'Bu istifadəçini sussuz et', en: 'Mute this user', ru: 'Отключить пользователя' },
  'notifs.a.mute_thread': { az: 'Bu mövzunu sussuz et', en: 'Mute this thread', ru: 'Отключить эту тему' },
  'notifs.a.open': { az: 'Aç', en: 'Open', ru: 'Открыть' },
  'notifs.a.copy': { az: 'Linki kopyala', en: 'Copy link', ru: 'Скопировать ссылку' },
  'notifs.a.more': { az: 'Digər əməliyyatlar', en: 'More actions', ru: 'Другие действия' },
  'notifs.a.priority': { az: 'Yüksək prioritet', en: 'High priority', ru: 'Высокий приоритет' },

  /* Nəticə mesajları */
  'notifs.ok.read': { az: 'Oxunmuş edildi', en: 'Marked as read', ru: 'Отмечено прочитанным' },
  'notifs.ok.deleted': { az: 'Bildiriş silindi', en: 'Notification deleted', ru: 'Уведомление удалено' },
  'notifs.ok.deleted_n': { az: '{n} bildiriş silindi', en: '{n} notifications deleted', ru: 'Удалено уведомлений: {n}' },
  'notifs.ok.archived': { az: 'Arxivə atıldı', en: 'Archived', ru: 'Перемещено в архив' },
  'notifs.ok.unarchived': { az: 'Arxivdən çıxarıldı', en: 'Removed from archive', ru: 'Возвращено из архива' },
  'notifs.ok.pinned': { az: 'Sabitləndi', en: 'Pinned', ru: 'Закреплено' },
  'notifs.ok.unpinned': { az: 'Sabitləmə ləğv edildi', en: 'Unpinned', ru: 'Откреплено' },
  'notifs.ok.muted': { az: 'Sussuz edildi', en: 'Muted', ru: 'Отключено' },
  'notifs.ok.unmuted': { az: 'Səs açıldı', en: 'Unmuted', ru: 'Включено' },
  'notifs.ok.copied': { az: 'Link kopyalandı', en: 'Link copied', ru: 'Ссылка скопирована' },
  'notifs.err': { az: 'Alınmadı', en: 'Failed', ru: 'Не удалось' },

  /* Boş vəziyyətlər */
  'notifs.empty.title': { az: 'Hələ bildiriş yoxdur', en: 'No notifications yet', ru: 'Уведомлений пока нет' },
  'notifs.empty.text': { az: 'Kimsə paylaşımını bəyənəndə, şərh yazanda və ya səni qeyd edəndə burada görünəcək.', en: 'When someone likes your post, comments, or mentions you, it will show up here.', ru: 'Когда кто-то оценит ваш пост, оставит комментарий или упомянет вас — это появится здесь.' },
  'notifs.empty.cta': { az: 'Paylaşımlara bax', en: 'Explore posts', ru: 'Смотреть посты' },
  'notifs.empty.filtered_title': { az: 'Bu filtrdə nəticə yoxdur', en: 'Nothing matches this filter', ru: 'По этому фильтру ничего нет' },
  'notifs.empty.filtered_text': { az: 'Axtarışı dəyiş və ya filtri sıfırla.', en: 'Try a different search or reset the filter.', ru: 'Измените запрос или сбросьте фильтр.' },
  'notifs.empty.reset': { az: 'Filtri sıfırla', en: 'Reset filter', ru: 'Сбросить фильтр' },
  'notifs.empty.archive_title': { az: 'Arxiv boşdur', en: 'Archive is empty', ru: 'Архив пуст' },
  'notifs.empty.archive_text': { az: 'Arxivə atdığın bildirişlər burada saxlanılır.', en: 'Notifications you archive are kept here.', ru: 'Здесь хранятся архивированные уведомления.' },

  /* Parametrlər modalı */
  'notifs.set.title': { az: 'Bildiriş parametrləri', en: 'Notification settings', ru: 'Настройки уведомлений' },
  'notifs.set.types': { az: 'Bildiriş tipləri', en: 'Notification types', ru: 'Типы уведомлений' },
  'notifs.set.types_hint': { az: 'Söndürülmüş tip üzrə yeni bildiriş yazılmır — köhnələr siyahıda qalır.', en: 'Disabled types stop new notifications; existing ones stay in the list.', ru: 'Отключённые типы больше не создаются; прежние остаются в списке.' },
  'notifs.set.channels': { az: 'Çatdırılma kanalları', en: 'Delivery channels', ru: 'Каналы доставки' },
  'notifs.set.ch_inapp': { az: 'Tətbiqdaxili', en: 'In-app', ru: 'В приложении' },
  'notifs.set.ch_inapp_hint': { az: 'Həmişə aktivdir — bildiriş mərkəzinin özüdür.', en: 'Always on — this is the notification center itself.', ru: 'Всегда включено — это сам центр уведомлений.' },
  'notifs.set.ch_desktop': { az: 'Masaüstü bildirişləri', en: 'Desktop notifications', ru: 'Уведомления на рабочем столе' },
  'notifs.set.ch_desktop_hint': { az: 'Brauzer icazəsi tələb olunur. Yalnız bu cihazda saxlanılır.', en: 'Requires browser permission. Stored on this device only.', ru: 'Требуется разрешение браузера. Хранится только на этом устройстве.' },
  'notifs.set.ch_desktop_denied': { az: 'Brauzer icazə vermədi — sayt parametrlərindən aç.', en: 'Browser denied permission — enable it in site settings.', ru: 'Браузер отклонил разрешение — включите в настройках сайта.' },
  'notifs.set.ch_email': { az: 'E-poçt bildirişləri', en: 'Email notifications', ru: 'Уведомления по эл. почте' },
  'notifs.set.ch_email_hint': { az: 'Hazırlanır — yalnız təhlükəsizlik e-poçtları göndərilir.', en: 'Coming soon — only security emails are sent today.', ru: 'В разработке — сейчас отправляются только письма безопасности.' },
  'notifs.set.mutes': { az: 'Sussuz edilənlər', en: 'Muted', ru: 'Отключённые' },
  'notifs.set.mutes_empty': { az: 'Sussuz edilmiş heç nə yoxdur.', en: 'Nothing is muted.', ru: 'Ничего не отключено.' },
  'notifs.set.unmute': { az: 'Aç', en: 'Unmute', ru: 'Включить' },
  'notifs.set.scope_type': { az: 'Tip', en: 'Type', ru: 'Тип' },
  'notifs.set.scope_user': { az: 'İstifadəçi', en: 'User', ru: 'Пользователь' },
  'notifs.set.scope_thread': { az: 'Mövzu', en: 'Thread', ru: 'Тема' },
  'notifs.set.close': { az: 'Bağla', en: 'Close', ru: 'Закрыть' },

  /* ---------- Page: Users ---------- */
  'users.sub': { az: 'Platformadakı bütün üzvlər — profilə bax, birbaşa mesaj yaz', en: 'All platform members — view profiles, send direct messages', ru: 'Все участники платформы — смотрите профили, отправляйте ЛС' },
  'users.search': { az: 'Ad, istifadəçi adı və ya tag üzrə axtar...', en: 'Search by name, username or tag...', ru: 'Поиск по имени, юзернейму или тегу...' },
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

  /* ── Kataloq yenidən dizaynı (miqrasiya 0050/0051) ────────────────────── */
  'users.invite':      { az: 'Dəvət et', en: 'Invite', ru: 'Пригласить' },
  'users.export':      { az: 'İxrac', en: 'Export', ru: 'Экспорт' },
  'users.filters':     { az: 'Filtrlər', en: 'Filters', ru: 'Фильтры' },
  'users.view_compact': { az: 'Sıx görünüş', en: 'Compact view', ru: 'Компактный вид' },
  'users.to_top':      { az: 'Yuxarı qayıt', en: 'Back to top', ru: 'Наверх' },
  'users.sort_followers': { az: 'Ən çox izləyici', en: 'Most followers', ru: 'Больше подписчиков' },

  /* Filtr paneli etiketləri */
  'users.flt_skill_l':   { az: 'Bacarıq', en: 'Skill', ru: 'Навык' },
  'users.flt_level_l':   { az: 'Səviyyə', en: 'Level', ru: 'Уровень' },
  'users.flt_look_l':    { az: 'Nə axtarır', en: 'Looking for', ru: 'Ищет' },
  'users.flt_status_l':  { az: 'Status', en: 'Status', ru: 'Статус' },
  'users.flt_status':    { az: 'Bütün statuslar', en: 'Any status', ru: 'Любой статус' },
  'users.flt_company_l': { az: 'İş yeri', en: 'Company', ru: 'Компания' },
  'users.flt_company':   { az: 'Şirkət adı...', en: 'Company name...', ru: 'Название компании...' },
  'users.flt_loc_l':     { az: 'Yer', en: 'Location', ru: 'Локация' },
  'users.flt_loc':       { az: 'Ölkə və ya şəhər...', en: 'Country or city...', ru: 'Страна или город...' },
  'users.flt_rel_l':     { az: 'Əlaqə', en: 'Relationship', ru: 'Связь' },
  'users.flt_following': { az: 'İzlədiklərim', en: 'People I follow', ru: 'Мои подписки' },
  'users.flt_followers': { az: 'Məni izləyənlər', en: 'My followers', ru: 'Мои подписчики' },
  'users.flt_reset':     { az: 'Sıfırla', en: 'Reset', ru: 'Сбросить' },
  'users.flt_apply':     { az: 'Tətbiq et', en: 'Apply', ru: 'Применить' },
  'users.flt_n':         { az: '{n} filtr aktiv', en: '{n} filters active', ru: 'Активных фильтров: {n}' },

  /* Sürətli pillər */
  'users.q_all':      { az: 'Hamısı', en: 'Everyone', ru: 'Все' },
  'users.q_online':   { az: 'Onlayn', en: 'Online', ru: 'Онлайн' },
  'users.q_hiring':   { az: 'İş axtarır', en: 'Open to work', ru: 'Ищет работу' },
  'users.q_mentor':   { az: 'Mentorlar', en: 'Mentors', ru: 'Менторы' },
  'users.q_verified': { az: 'Təsdiqlənmiş', en: 'Verified', ru: 'Подтверждённые' },
  'users.q_mutual':   { az: 'Qarşılıqlı', en: 'Mutual', ru: 'Взаимные' },
  'users.q_new':      { az: 'Yeni üzvlər', en: 'New members', ru: 'Новые' },

  /* Statistika kartları */
  'users.s_total':    { az: 'Üzvlər', en: 'Members', ru: 'Участники' },
  'users.s_online':   { az: 'Bu gün aktiv', en: 'Active today', ru: 'Активны сегодня' },
  'users.s_following': { az: 'İzlədiklərim', en: 'Following', ru: 'Подписки' },
  'users.s_teams':    { az: 'Komandalarım', en: 'My teams', ru: 'Мои команды' },
  'users.s_projects': { az: 'Layihələrim', en: 'My projects', ru: 'Мои проекты' },
  'users.s_verified': { az: 'Təsdiqlənmiş', en: 'Verified', ru: 'Подтверждённые' },
  'users.s_mentors':  { az: 'Mentorlar', en: 'Mentors', ru: 'Менторы' },
  'users.s_hiring':   { az: 'İşə açıq', en: 'Open to work', ru: 'Открыты к работе' },
  'users.s_new_week': { az: 'həftədə +{n}', en: '+{n} this week', ru: '+{n} за неделю' },

  /* İstifadəçi statusu */
  'users.st_online':  { az: 'Onlayn', en: 'Online', ru: 'Онлайн' },
  'users.st_offline': { az: 'Oflayn', en: 'Offline', ru: 'Офлайн' },
  'users.st_away':    { az: 'Uzaqdayam', en: 'Away', ru: 'Отошёл' },
  'users.st_busy':    { az: 'Məşğulam', en: 'Busy', ru: 'Занят' },
  'users.st_dnd':     { az: 'Narahat etməyin', en: 'Do not disturb', ru: 'Не беспокоить' },
  'users.st_hiring':  { az: 'İş axtarıram', en: 'Open to work', ru: 'Ищу работу' },

  /* Rank adları — XP səviyyəsindən törəyir (bax `level.ts` astanaları) */
  'users.rk_bronze':  { az: 'Bürünc', en: 'Bronze', ru: 'Бронза' },
  'users.rk_silver':  { az: 'Gümüş', en: 'Silver', ru: 'Серебро' },
  'users.rk_gold':    { az: 'Qızıl', en: 'Gold', ru: 'Золото' },
  'users.rk_diamond': { az: 'Almaz', en: 'Diamond', ru: 'Алмаз' },
  'users.rk_master':  { az: 'Usta', en: 'Master', ru: 'Мастер' },
  'users.rk_legend':  { az: 'Əfsanə', en: 'Legend', ru: 'Легенда' },
  'users.rk_next':    { az: 'Növbəti səviyyəyə {n} XP', en: '{n} XP to next level', ru: 'До следующего уровня {n} XP' },
  'users.rk_max':     { az: 'Maksimum səviyyə', en: 'Max level', ru: 'Максимальный уровень' },

  /* Kart məlumatları */
  'users.c_followers':  { az: 'izləyici', en: 'followers', ru: 'подписчиков' },
  'users.c_following':  { az: 'izlədiyi', en: 'following', ru: 'подписок' },
  'users.c_teams':      { az: 'komanda', en: 'teams', ru: 'команд' },
  'users.c_projects':   { az: 'layihə', en: 'projects', ru: 'проектов' },
  'users.c_mutual_t':   { az: '{n} ortaq komanda', en: '{n} mutual team(s)', ru: 'Общих команд: {n}' },
  'users.c_mutual_p':   { az: '{n} ortaq layihə', en: '{n} mutual project(s)', ru: 'Общих проектов: {n}' },
  'users.c_follows_you': { az: 'Səni izləyir', en: 'Follows you', ru: 'Подписан на вас' },
  'users.c_joined':     { az: 'Qoşulub {d}', en: 'Joined {d}', ru: 'Присоединился {d}' },
  'users.c_no_bio':     { az: 'Bio əlavə olunmayıb', en: 'No bio yet', ru: 'Био пока нет' },

  /* Sürətli əməliyyatlar */
  'users.a_msg':      { az: 'Mesaj', en: 'Message', ru: 'Написать' },
  'users.a_profile':  { az: 'Profil', en: 'Profile', ru: 'Профиль' },
  'users.a_follow':   { az: 'İzlə', en: 'Follow', ru: 'Подписаться' },
  'users.a_unfollow': { az: 'İzlənilir', en: 'Following', ru: 'Вы подписаны' },
  'users.a_more':     { az: 'Digər əməliyyatlar', en: 'More actions', ru: 'Другие действия' },
  'users.a_share':    { az: 'Profili paylaş', en: 'Share profile', ru: 'Поделиться профилем' },
  'users.a_copy':     { az: 'Linki kopyala', en: 'Copy link', ru: 'Скопировать ссылку' },
  'users.a_report':   { az: 'Şikayət et', en: 'Report', ru: 'Пожаловаться' },
  'users.a_copied':   { az: 'Link kopyalandı', en: 'Link copied', ru: 'Ссылка скопирована' },

  /* Tövsiyə raili */
  'users.r_title':    { az: 'Kəşf et', en: 'Discover', ru: 'Найти' },
  'users.r_known':    { az: 'Tanış ola bilərsən', en: 'People you may know', ru: 'Возможно, вы знакомы' },
  'users.r_topxp':    { az: 'Ən yüksək XP', en: 'Top XP', ru: 'Лидеры по XP' },
  'users.r_fresh':    { az: 'Yeni qoşulanlar', en: 'Recently joined', ru: 'Недавно присоединились' },
  'users.r_active':   { az: 'Son aktiv olanlar', en: 'Recently active', ru: 'Недавно активные' },
  'users.r_empty':    { az: 'Hələ tövsiyə yoxdur', en: 'No suggestions yet', ru: 'Пока нет рекомендаций' },

  /* Boş vəziyyət / nəticə */
  'users.none_title': { az: 'İstifadəçi tapılmadı', en: 'No users found', ru: 'Пользователи не найдены' },
  'users.none_text':  { az: 'Axtarışı dəyiş, filtrləri sıfırla və ya platformaya yeni adam dəvət et.', en: 'Try a different search, reset the filters, or invite someone new.', ru: 'Измените запрос, сбросьте фильтры или пригласите кого-нибудь.' },
  'users.count_n':    { az: '{n} nəticə', en: '{n} results', ru: 'Результатов: {n}' },
  'users.export_ok':  { az: 'CSV endirilir', en: 'Downloading CSV', ru: 'Загрузка CSV' },
  'users.export_empty': { az: 'İxrac ediləcək nəticə yoxdur', en: 'Nothing to export', ru: 'Нечего экспортировать' },

  'prof.no_social': { az: 'hələ sosial hesab əlavə edilməyib', en: 'no social links yet', ru: 'соцсети пока не добавлены' },

  /* Publik profil (#u/{username}) */
  'pub.edit':      { az: 'Profili redaktə et', en: 'Edit profile', ru: 'Редактировать профиль' },
  'pub.shared':    { az: 'Ortaq nöqtələr', en: 'What you share', ru: 'Общее с вами' },
  'pub.links':     { az: 'Linklər', en: 'Links', ru: 'Ссылки' },
  'pub.not_found': { az: '{u} tapılmadı', en: '{u} not found', ru: '{u} не найден' },

  /* Profil parametrləri — yeni sahələr */
  'set.company':      { az: 'İş yeri / şirkət', en: 'Company', ru: 'Компания' },
  'set.company_ph':   { az: 'Məsələn: Collabix', en: 'e.g. Collabix', ru: 'Например: Collabix' },
  'set.status':       { az: 'Status', en: 'Status', ru: 'Статус' },
  'set.status_none':  { az: 'Təyin edilməyib', en: 'Not set', ru: 'Не задан' },
  'set.status_hint':  { az: 'Status onlayn göstəricisini ƏVƏZ ETMİR — oflayn olanda göstərilmir.', en: 'Status does not replace the online indicator — it is hidden while you are offline.', ru: 'Статус не заменяет индикатор онлайна — он скрыт, пока вы офлайн.' },

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
  'stats.adm_title': { az: 'Platforma statistikası (yalnız admin)', en: 'Platform stats (admin only)', ru: 'Статистика платформы (только админ)' },
  'stats.top_contrib': { az: 'Top töhfəçilər (XP)', en: 'Top contributors (XP)', ru: 'Топ участников (XP)' },
  'stats.growth': { az: 'Artım (son 30 gün qeydiyyat)', en: 'Growth (last 30 days signups)', ru: 'Рост (регистрации за 30 дней)' },
  'stats.lb': { az: 'Liderlər lövhəsi', en: 'Leaderboard', ru: 'Таблица лидеров' },
  'stats.lb_xp': { az: 'XP', en: 'XP', ru: 'XP' },
  'stats.lb_tasks': { az: 'Tapşırıq', en: 'Task', ru: 'Задание' },
  'stats.lb_streak': { az: 'Seriya', en: 'Streak', ru: 'Серия' },
  'stats.lang_dist': { az: 'Dil / sahə bölgüsü', en: 'Language / field distribution', ru: 'Распределение языков / сфер' },

  /* ---------- Page: Profil ---------- */
  'prof.sub': { az: 'Sənin öyrənmə kartın', en: 'Your learning card', ru: 'Твоя учебная карточка' },
  'prof.active_project': { az: 'Hazırda aktiv layihə üzərində işləyir', en: 'Currently working on an active project', ru: 'Сейчас работает над активным проектом' },
  'prof.edit': { az: 'Redaktə et', en: 'Edit', ru: 'Редактировать' },
  'prof.tasks_done': { az: '☑ tamamlanmış tapşırıq', en: '☑ completed tasks', ru: '☑ выполненных заданий' },
  'prof.streak_track': { az: 'Son 7 gün: {n} gün ardıcıl aktiv', en: 'Last 7 days: {n} day streak', ru: 'Последние 7 дней: серия {n} дн.' },
  'prof.badges': { az: 'Nişanlar', en: 'Badges', ru: 'Бейджи' },
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
  'set.export_btn': { az: 'Datamı endir (JSON)', en: 'Download my data (JSON)', ru: 'Скачать мои данные (JSON)' },
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
  'set.export_csv': { az: 'CSV', en: 'CSV', ru: 'CSV' },
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
  // AUDIT-TASK-10 / Faza 2.2 — qlobal error boundary mesajı.
  // ⚠ Mətn QƏSDƏN ÜMUMİDİR: texniki detal (stack, fayl adı) istifadəçiyə
  //   heç nə vermir və daxili strukturu açır. Detal konsola/logə düşür.
  'err.unexpected': {
    az: 'Gözlənilməz xəta baş verdi. Səhifəni yeniləyin.',
    en: 'Something went wrong. Please refresh the page.',
    ru: 'Произошла непредвиденная ошибка. Обновите страницу.',
  },
  // AUDIT-TASK-10 / Faza 5/#5 — parol bərpası axını.
  // ⚠ `🔑` emojisi SİLİNDİ — başlıqda ikon kimi işlədilirdi (platformadan
  //   asılı, temaya uyğunlaşmır). İkon indi `data-icon="lock"` ilə verilir.
  'reset.title':      { az: 'Şifrəni unutmusan?', en: 'Forgot your password?', ru: 'Забыли пароль?' },
  'reset.sub':        { az: 'Hesabına bağlı e-poçt ünvanını yaz — 6 rəqəmli təsdiq kodu göndərəcəyik.', en: 'Enter the e-mail linked to your account — we will send a 6-digit confirmation code.', ru: 'Укажите e-mail, привязанный к аккаунту — мы отправим 6-значный код подтверждения.' },
  'reset.send':       { az: 'Kod göndər', en: 'Send code', ru: 'Отправить код' },
  /* Kod addımı (2026-08-03). Mətn QƏSDƏN "əgər hesab varsa" formasındadır:
     server hesabın mövcudluğunu açmır (hesab sadalanmasının qarşısı), ona
     görə UI da bunu iddia etməməlidir. */
  'reset.code_title': { az: 'Təsdiq kodunu daxil et', en: 'Enter the confirmation code', ru: 'Введите код подтверждения' },
  'reset.code_sub':   { az: 'Əgər bu ünvanla hesab varsa, 6 rəqəmli kod göndərildi. Kod 15 dəqiqə etibarlıdır.', en: 'If an account exists for that address, a 6-digit code has been sent. It is valid for 15 minutes.', ru: 'Если аккаунт с этим адресом существует, отправлен 6-значный код. Он действует 15 минут.' },
  'reset.code_lbl':   { az: 'Təsdiq kodu', en: 'Confirmation code', ru: 'Код подтверждения' },
  'reset.err_code':   { az: '6 rəqəmli kodu daxil et.', en: 'Enter the 6-digit code.', ru: 'Введите 6-значный код.' },
  'reset.new_pass':   { az: 'Yeni şifrə', en: 'New password', ru: 'Новый пароль' },
  'reset.new_pass2':  { az: 'Yeni şifrə (təkrar)', en: 'New password (repeat)', ru: 'Новый пароль (повтор)' },
  'reset.resend':     { az: 'Kod gəlmədi? Yenidən göndər', en: 'No code? Send again', ru: 'Код не пришёл? Отправить снова' },
  'reset.err_email':  { az: 'E-poçt düzgün deyil.', en: 'Invalid email address.', ru: 'Некорректный e-mail.' },
  // ⚠ Mətn QƏSDƏN şərtlidir ("əgər hesab varsa"): server neytral cavab verir
  //   və UI onu təkzib etməməlidir — əks halda hesab sadalanması siqnalı olardı.
  'reset.sent':       { az: 'Əgər bu ünvanla hesab varsa, link göndərildi.', en: 'If an account exists for that address, a link has been sent.', ru: 'Если аккаунт с этим адресом существует, ссылка отправлена.' },
  'reset.new_title':  { az: 'Yeni şifrə təyin et', en: 'Set a new password', ru: 'Задайте новый пароль' },
  'reset.new_sub':    { az: 'Ən azı 8 simvol, hərf və rəqəm (və ya işarə).', en: 'At least 8 characters, letters and a digit (or symbol).', ru: 'Минимум 8 символов, буквы и цифра (или символ).' },
  'reset.revoke_warn':{ az: '⚠ Şifrə dəyişəndə bütün cihazlardakı sessiyalar bağlanacaq.', en: '⚠ Changing the password signs you out of all devices.', ru: '⚠ После смены пароля все сессии на всех устройствах будут закрыты.' },
  'reset.err_match':  { az: 'Şifrələr eyni deyil.', en: 'Passwords do not match.', ru: 'Пароли не совпадают.' },
  'reset.save':       { az: 'Şifrəni yenilə', en: 'Update password', ru: 'Обновить пароль' },
  'reset.done':       { az: 'Şifrə yeniləndi.', en: 'Password updated.', ru: 'Пароль обновлён.' },
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
  'adm.u_search':      { az: 'Ad və ya istifadəçi adı...', en: 'Name or username...', ru: 'Имя или юзернейм...' },
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
  /* AUDIT-UI: admin cədvəllərinin başlıqları SABİT AZƏRBAYCANCA idi — ətrafdakı
     bütün filtr/düymələr tərcümə olunurdu, yalnız `<th>`-lər qalmışdı. */
  'adm.col_date':     { az: 'Tarix', en: 'Date', ru: 'Дата' },
  'adm.col_severity': { az: 'Səviyyə', en: 'Severity', ru: 'Уровень' },
  'adm.col_type':     { az: 'Növ', en: 'Type', ru: 'Тип' },
  'adm.col_user':     { az: 'İstifadəçi', en: 'User', ru: 'Пользователь' },
  'adm.col_action':   { az: 'Əməliyyat', en: 'Action', ru: 'Действие' },
  'adm.col_event':    { az: 'Hadisə', en: 'Event', ru: 'Событие' },
  'adm.col_user_id':  { az: 'İstifadəçi/ID', en: 'User/ID', ru: 'Пользователь/ID' },
  'adm.col_status':   { az: 'Status', en: 'Status', ru: 'Статус' },
  /* AUDIT-UI: ikon-yalnız düymələrin əlçatan adı (emojidən köçürülüb). */
  'adm.temp_pass':    { az: 'Müvəqqəti şifrə', en: 'Temporary password', ru: 'Временный пароль' },
  'adm.copy_id':      { az: 'ID-ni kopyala', en: 'Copy ID', ru: 'Скопировать ID' },

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
  // ⚠ Göz düyməsinin `aria-label`-ı vəziyyətlə dəyişir — ekran oxuyucusu
  //   düymənin indi NƏ edəcəyini bilməlidir, nə etdiyini yox.
  'wiz.pass_hide': { az: 'Şifrəni gizlət', en: 'Hide password', ru: 'Скрыть пароль' },
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
  // Dəvət kodu — QEYDİYYATI BLOKLAMIR (server səhv kodu səssizcə udur, bax
  // `worker/routes/invite.ts`), ona görə mətnlər "istəyə bağlı" tonundadır.
  'wiz.lbl_invite': { az: 'Dəvət kodu', en: 'Invite code', ru: 'Код приглашения' },
  'wiz.invite_opt': { az: 'istəyə bağlı', en: 'optional', ru: 'необязательно' },
  'wiz.invite_hint': { az: 'Sizi dəvət edən dostunuzun kodu. Kodsuz da qeydiyyat tamamlanır.', en: 'The code from the friend who invited you. You can sign up without one.', ru: 'Код друга, который вас пригласил. Без кода регистрация тоже возможна.' },
  'wiz.invite_ok': { az: 'Dəvət edən', en: 'Invited by', ru: 'Пригласил' },
  'wiz.invite_bad': { az: 'Kod tapılmadı və ya vaxtı bitib', en: 'Code not found or expired', ru: 'Код не найден или истёк' },
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
  'prof.edit_title': { az: 'Profili redaktə et', en: 'Edit profile', ru: 'Редактировать профиль' },
  'usr.view': { az: 'Profilə bax', en: 'View profile', ru: 'Посмотреть профиль' },
  'usr.msg': { az: 'Mesaj yaz', en: 'Send message', ru: 'Написать сообщение' },
  'usr.act_map': { az: 'Aktivlik xəritəsi', en: 'Activity map', ru: 'Карта активности' },
  'usr.lvl': { az: 'Səviyyə', en: 'Level', ru: 'Уровень' },
  'usr.streak': { az: '🔥 seriya', en: '🔥 streak', ru: '🔥 серия' },
  'usr.tasks': { az: '☑ tapşırıq', en: '☑ tasks', ru: '☑ задач' },
  'usr.posts': { az: 'Paylaşımlar', en: 'Posts', ru: 'Посты' },
  'usr.no_posts': { az: 'Hələ paylaşım yoxdur', en: 'No posts yet', ru: 'Пока нет постов' },
  'usr.xp': { az: 'XP', en: 'XP', ru: 'XP' },

  /* ---------- Profil ekranı (`js/profile-view.js`) ----------
     ⚠ Öz profil və publik profil EYNİ renderer-dən qidalanır, ona görə
       açarlar da ORTAQDIR — `pf.*` prefiksi hər ikisinə aiddir. */
  'pf.nav_overview': { az: 'Ümumi', en: 'Overview', ru: 'Обзор' },
  'pf.nav_ach': { az: 'Nailiyyətlər', en: 'Achievements', ru: 'Достижения' },
  'pf.nav_skills': { az: 'Bacarıqlar', en: 'Skills', ru: 'Навыки' },
  'pf.nav_activity': { az: 'Aktivlik', en: 'Activity', ru: 'Активность' },
  'pf.nav_projects': { az: 'Layihələr', en: 'Projects', ru: 'Проекты' },
  'pf.nav_posts': { az: 'Paylaşımlar', en: 'Posts', ru: 'Посты' },
  'pf.nav_timeline': { az: 'Xronologiya', en: 'Timeline', ru: 'Хронология' },
  'pf.level': { az: 'Səviyyə {n}', en: 'Level {n}', ru: 'Уровень {n}' },
  'pf.share': { az: 'Paylaş', en: 'Share', ru: 'Поделиться' },
  'pf.link_site': { az: 'Sayt', en: 'Website', ru: 'Сайт' },

  'pf.st_contrib': { az: 'Töhfə balı', en: 'Contribution', ru: 'Вклад' },
  'pf.st_rep': { az: 'Reputasiya', en: 'Reputation', ru: 'Репутация' },
  'pf.st_comments': { az: 'Şərhlər', en: 'Comments', ru: 'Комментарии' },
  'pf.st_likes': { az: 'Alınan bəyənmə', en: 'Likes received', ru: 'Получено лайков' },
  'pf.xp_week': { az: 'Bu həftə', en: 'This week', ru: 'За неделю' },
  'pf.xp_month': { az: 'Bu ay', en: 'This month', ru: 'За месяц' },
  'pf.xp_total': { az: 'Ümumi XP', en: 'Total XP', ru: 'Всего XP' },

  'pf.ins_title': { az: 'Profil analitikası', en: 'Profile insights', ru: 'Аналитика профиля' },
  'pf.ins_private': { az: 'yalnız sənə görünür', en: 'only visible to you', ru: 'видно только вам' },
  'pf.ins_views': { az: 'Ümumi baxış', en: 'Total views', ru: 'Всего просмотров' },
  'pf.ins_views7': { az: '7 gün', en: '7 days', ru: '7 дней' },
  'pf.ins_views30': { az: '30 gün', en: '30 days', ru: '30 дней' },
  'pf.ins_f7': { az: 'Yeni izləyici (7g)', en: 'New followers (7d)', ru: 'Новых подписчиков (7д)' },
  'pf.ins_f30': { az: 'Yeni izləyici (30g)', en: 'New followers (30d)', ru: 'Новых подписчиков (30д)' },

  'pf.no_ach': { az: 'Hələ nişan yoxdur', en: 'No badges yet', ru: 'Пока нет значков' },
  'pf.ach_next': { az: 'Növbəti hədəflər', en: 'Next up', ru: 'Следующие цели' },
  'pf.ach_locked': { az: 'Qazanılmayanlar', en: 'Not earned', ru: 'Не получено' },
  'pf.unlocks': { az: 'Yeni imkan açır', en: 'Unlocks a feature', ru: 'Открывает возможность' },

  'pf.no_skills': { az: 'Hələ bacarıq əlavə olunmayıb', en: 'No skills added yet', ru: 'Навыки пока не добавлены' },
  'pf.looking': { az: 'Nə axtarır', en: 'Looking for', ru: 'Что ищет' },
  'pf.sk_y': { az: '{n} il', en: '{n} yr', ru: '{n} л.' },
  'pf.sk_years': { az: 'Təcrübə ili', en: 'Years of experience', ru: 'Лет опыта' },
  'pf.sk_cert': { az: 'Sertifikatlı', en: 'Certified', ru: 'Сертифицирован' },
  'pf.sk_unit': { az: 'il', en: 'yr', ru: 'л.' },
  'pf.sk_points': { az: '{n} fəaliyyət balı', en: '{n} activity points', ru: '{n} баллов активности' },
  'pf.meta_title': { az: 'Təcrübə və sertifikat', en: 'Experience & certification', ru: 'Опыт и сертификация' },
  'pf.meta_hint': { az: 'Seçilmiş hər bacarıq üçün neçə illik təcrübən olduğunu yaz.', en: 'Add years of experience for each selected skill.', ru: 'Укажите стаж по каждому выбранному навыку.' },
  'pf.meta_none': { az: 'Əvvəlcə yuxarıdan bacarıq seç.', en: 'Pick a skill above first.', ru: 'Сначала выберите навык выше.' },

  'pf.cat_lang': { az: 'Proqramlaşdırma dilləri', en: 'Programming languages', ru: 'Языки программирования' },
  'pf.cat_web': { az: 'Freymvorklar', en: 'Frameworks', ru: 'Фреймворки' },
  'pf.cat_db': { az: 'Verilənlər bazası', en: 'Databases', ru: 'Базы данных' },
  'pf.cat_cloud': { az: 'Bulud', en: 'Cloud', ru: 'Облако' },
  'pf.cat_devops': { az: 'DevOps', en: 'DevOps', ru: 'DevOps' },
  'pf.cat_security': { az: 'Təhlükəsizlik', en: 'Security', ru: 'Безопасность' },
  'pf.cat_embedded': { az: 'Embedded', en: 'Embedded', ru: 'Embedded' },
  'pf.cat_design': { az: 'Dizayn', en: 'Design', ru: 'Дизайн' },
  'pf.cat_spoken': { az: 'Danışıq dilləri', en: 'Spoken languages', ru: 'Разговорные языки' },
  'pf.cat_other': { az: 'Digər', en: 'Other', ru: 'Другое' },

  'pf.ac_total': { az: 'İllik fəaliyyət', en: 'Yearly activity', ru: 'Активность за год' },
  'pf.ac_cur': { az: 'Cari seriya', en: 'Current streak', ru: 'Текущая серия' },
  'pf.ac_long': { az: 'Ən uzun seriya', en: 'Longest streak', ru: 'Самая длинная серия' },
  'pf.ac_best': { az: 'Ən aktiv gün', en: 'Most active day', ru: 'Самый активный день' },
  'pf.wd_sun': { az: 'Bazar', en: 'Sunday', ru: 'Воскресенье' },
  'pf.wd_mon': { az: 'B.e', en: 'Monday', ru: 'Понедельник' },
  'pf.wd_tue': { az: 'Ç.a', en: 'Tuesday', ru: 'Вторник' },
  'pf.wd_wed': { az: 'Çərşənbə', en: 'Wednesday', ru: 'Среда' },
  'pf.wd_thu': { az: 'C.a', en: 'Thursday', ru: 'Четверг' },
  'pf.wd_fri': { az: 'Cümə', en: 'Friday', ru: 'Пятница' },
  'pf.wd_sat': { az: 'Şənbə', en: 'Saturday', ru: 'Суббота' },

  'pf.no_proj': { az: 'Publik layihə yoxdur', en: 'No public projects', ru: 'Нет публичных проектов' },
  'pf.no_proj_self': { az: 'Hələ layihəyə qoşulmamısan', en: 'You have not joined a project yet', ru: 'Вы ещё не в проекте' },
  'pf.pr_owner': { az: 'Qurucu', en: 'Owner', ru: 'Владелец' },

  'pf.pinned': { az: 'Sancaqlanmış', en: 'Pinned', ru: 'Закреплённое' },
  'pf.pin': { az: 'Profilə sancaqla', en: 'Pin to profile', ru: 'Закрепить в профиле' },
  'pf.unpin': { az: 'Sancağı götür', en: 'Unpin', ru: 'Открепить' },
  'pf.pinned_ok': { az: 'Sancaqlandı', en: 'Pinned', ru: 'Закреплено' },
  'pf.unpinned': { az: 'Sancaq götürüldü', en: 'Unpinned', ru: 'Откреплено' },
  'pf.pin_limit': { az: 'Ən çox 3 paylaşım sancaqlana bilər.', en: 'You can pin at most 3 posts.', ru: 'Можно закрепить не более 3 постов.' },
  'pf.pin_media': { az: '(mediа paylaşımı)', en: '(media post)', ru: '(медиа-пост)' },
  'pf.vis_private': { az: 'Şəxsi', en: 'Private', ru: 'Личное' },
  'pf.vis_followers': { az: 'İzləyicilər', en: 'Followers', ru: 'Подписчики' },
  'pf.no_posts_self': { az: 'Hələ paylaşım etməmisən — ilk paylaşımın profilində burada görünəcək.', en: 'No posts yet — your first post will show up here.', ru: 'Постов пока нет — первый появится здесь.' },

  'pf.tl_joined': { az: 'Qoşuldu', en: 'Joined', ru: 'Присоединился' },
  'pf.tl_joined_txt': { az: '{n} Collabix-ə qoşuldu', en: '{n} joined Collabix', ru: '{n} присоединился к Collabix' },
  'pf.tl_badge': { az: 'Nişan', en: 'Badge', ru: 'Значок' },
  'pf.tl_ach': { az: 'Nailiyyət', en: 'Achievement', ru: 'Достижение' },
  'pf.tl_post': { az: 'Paylaşım', en: 'Post', ru: 'Пост' },
  'pf.tl_team': { az: 'Komanda', en: 'Team', ru: 'Команда' },
  'pf.tl_level': { az: 'Səviyyə', en: 'Level up', ru: 'Новый уровень' },
  'pf.tl_level_txt': { az: '{n}-ci səviyyəyə çatdı', en: 'Reached level {n}', ru: 'Достигнут уровень {n}' },
  'pf.tl_other': { az: 'Hadisə', en: 'Event', ru: 'Событие' },
  'pf.no_tl': { az: 'Hələ hadisə yoxdur', en: 'No events yet', ru: 'Пока нет событий' },
  'pf.more': { az: 'Daha çox', en: 'Load more', ru: 'Показать ещё' },

  'pf.rail_shared': { az: 'Ortaq komandalar', en: 'Shared teams', ru: 'Общие команды' },
  'pf.rail_ach': { az: 'Son nailiyyətlər', en: 'Recent achievements', ru: 'Последние достижения' },
  'pf.rail_proj': { az: 'Cari layihələr', en: 'Current projects', ru: 'Текущие проекты' },
  'pf.rail_sugg': { az: 'Tövsiyə olunanlar', en: 'Suggested', ru: 'Рекомендуем' },
  'pf.rail_none': { az: 'Tövsiyə yoxdur', en: 'Nothing to suggest', ru: 'Нет рекомендаций' },

  /* ---------- İş sahəsi (Tapşırıqlar) + Çalışmalar ----------
     ⚠ `ws.*` KOMANDA tapşırıqlarıdır (Kanban/sprint); öyrənmə çalışmaları
       `task.*` / `tasks.*` açarlarında qalır. İkisini qarışdırmaq səhifəni
       yanlış mətnlə doldurar. */
  'nav.drills': { az: 'Çalışmalar', en: 'Drills', ru: 'Упражнения' },
  'dr.sub': { az: 'Çalışmaları həll et, həllini göndər və admin təsdiqindən sonra XP qazan.', en: 'Solve drills, submit your answer and earn XP after review.', ru: 'Решайте упражнения, отправляйте решения и получайте XP после проверки.' },
  'dr.create': { az: 'Çalışma yarat', en: 'New drill', ru: 'Новое упражнение' },
  'dr.propose': { az: 'Çalışma təklif et', en: 'Propose a drill', ru: 'Предложить упражнение' },
  'dr.form_admin': { az: 'Yeni çalışma — dərhal dərc olunur', en: 'New drill — published immediately', ru: 'Новое упражнение — публикуется сразу' },
  'dr.form_user': { az: 'Çalışma təklifi — admin təsdiqindən sonra dərc olunur', en: 'Drill proposal — published after review', ru: 'Предложение — публикуется после проверки' },
  'dr.search_ph': { az: 'Çalışma adı və ya təsvir üzrə axtar…', en: 'Search drills by title or description…', ru: 'Поиск по названию или описанию…' },
  'dr.f_all': { az: 'Hamısı', en: 'All', ru: 'Все' },
  'dr.f_all_cats': { az: 'Bütün sahələr', en: 'All areas', ru: 'Все области' },
  'dr.f_open': { az: 'Həll etmədiklərim', en: 'Not solved yet', ru: 'Ещё не решённые' },
  'dr.c_total': { az: 'Ümumi çalışma', en: 'Total drills', ru: 'Всего упражнений' },
  'dr.c_solved': { az: 'Həll etdiyim', en: 'Solved', ru: 'Решено' },
  'dr.c_waiting': { az: 'Yoxlamada', en: 'In review', ru: 'На проверке' },
  'dr.c_open': { az: 'Açıq', en: 'Open', ru: 'Открытые' },
  'dr.c_cats': { az: 'Sahə', en: 'Areas', ru: 'Области' },
  'dr.s_pending': { az: 'Yoxlanılır', en: 'In review', ru: 'На проверке' },
  'dr.s_approved': { az: 'Təsdiqləndi', en: 'Approved', ru: 'Принято' },
  'dr.s_rejected': { az: 'Rədd edildi', en: 'Rejected', ru: 'Отклонено' },
  'dr.submit': { az: 'Həll göndər', en: 'Submit', ru: 'Отправить решение' },
  'dr.resubmit': { az: 'Yenidən göndər', en: 'Resubmit', ru: 'Отправить снова' },
  'dr.submitted': { az: 'Göndərilib', en: 'Submitted', ru: 'Отправлено' },
  'dr.sol_ph': { az: 'Həllini bura yaz…', en: 'Write your solution here…', ru: 'Напишите решение…' },
  'dr.link_ph': { az: 'Link (GitHub, CodePen — könüllü)', en: 'Link (GitHub, CodePen — optional)', ru: 'Ссылка (GitHub, CodePen — необязательно)' },
  'dr.err_empty': { az: 'Həll boş ola bilməz.', en: 'The solution cannot be empty.', ru: 'Решение не может быть пустым.' },
  'dr.err_link': { az: 'Link https:// ilə başlamalıdır.', en: 'The link must start with https://', ru: 'Ссылка должна начинаться с https://' },
  'dr.err_fields': { az: 'Başlıq və təsvir doldurulmalıdır.', en: 'Title and description are required.', ru: 'Заполните название и описание.' },
  'dr.sent': { az: 'Həll göndərildi — admin yoxlayacaq', en: 'Solution sent — an admin will review it', ru: 'Решение отправлено — админ проверит' },
  'dr.published': { az: 'Çalışma dərc olundu', en: 'Drill published', ru: 'Упражнение опубликовано' },
  'dr.empty': { az: 'Hələ çalışma yoxdur', en: 'No drills yet', ru: 'Упражнений пока нет' },
  'dr.no_match': { az: 'Süzgəcə uyğun çalışma tapılmadı', en: 'No drills match the filters', ru: 'Ничего не найдено по фильтрам' },
  'dr.del_q': { az: '«{n}» çalışması silinsin?', en: 'Delete the drill «{n}»?', ru: 'Удалить упражнение «{n}»?' },
  'dr.deleted': { az: 'Çalışma silindi', en: 'Drill deleted', ru: 'Упражнение удалено' },
  'dr.pending_drills': { az: 'Təsdiq gözləyən çalışmalar', en: 'Drills awaiting approval', ru: 'Упражнения на утверждении' },
  'dr.pending_subs': { az: 'Yoxlama gözləyən həllər', en: 'Solutions awaiting review', ru: 'Решения на проверке' },
  'dr.approve': { az: 'Təsdiqlə', en: 'Approve', ru: 'Утвердить' },
  'dr.reject': { az: 'Rədd et', en: 'Reject', ru: 'Отклонить' },
  'dr.approved': { az: 'Çalışma təsdiqləndi', en: 'Drill approved', ru: 'Упражнение утверждено' },
  'dr.rejected': { az: 'Rədd edildi', en: 'Rejected', ru: 'Отклонено' },
  'dr.sub_approved': { az: 'Təsdiqləndi (+50 XP)', en: 'Approved (+50 XP)', ru: 'Принято (+50 XP)' },
  'ws.sub': { az: 'İşini təşkil et, komandanla əməkdaşlıq qur və layihə gedişini izlə.', en: 'Organize your work, collaborate with your team and track project progress.', ru: 'Организуйте работу, сотрудничайте с командой и следите за прогрессом.' },
  'ws.create': { az: 'Tapşırıq yarat', en: 'New task', ru: 'Новая задача' },
  'ws.more': { az: 'Daha çox', en: 'More', ru: 'Ещё' },
  'ws.export': { az: 'CSV ixrac', en: 'Export CSV', ru: 'Экспорт CSV' },
  'ws.sprints': { az: 'Sprintlər', en: 'Sprints', ru: 'Спринты' },
  'ws.automation': { az: 'Avtomatlaşdırma', en: 'Automation', ru: 'Автоматизация' },
  'ws.automation_hint': { az: 'Qaydalar serverdə icra olunur. Hazırda yalnız baxış rejimindədir.', en: 'Rules run on the server. Currently read-only.', ru: 'Правила выполняются на сервере. Пока только просмотр.' },
  'ws.labels': { az: 'Etiketlər', en: 'Labels', ru: 'Метки' },
  'ws.label': { az: 'Etiket', en: 'Label', ru: 'Метка' },
  'ws.search_ph': { az: 'Tapşırıq, açar və ya təsvir üzrə axtar…', en: 'Search tasks, keys or descriptions…', ru: 'Поиск по задачам, ключам и описаниям…' },
  'ws.filters': { az: 'Süzgəclər', en: 'Filters', ru: 'Фильтры' },
  'ws.views': { az: 'Görünüşlər', en: 'Views', ru: 'Виды' },
  'ws.apply': { az: 'Tətbiq et', en: 'Apply', ru: 'Применить' },
  'ws.reset': { az: 'Sıfırla', en: 'Reset', ru: 'Сбросить' },
  'ws.save_view': { az: 'Görünüşü saxla', en: 'Save view', ru: 'Сохранить вид' },
  'ws.save_view_q': { az: 'Görünüşün adı:', en: 'Name for this view:', ru: 'Название вида:' },
  'ws.saved_ok': { az: 'Görünüş saxlanıldı', en: 'View saved', ru: 'Вид сохранён' },
  'ws.saved_apply': { az: 'Saxlanılmış görünüşü tətbiq et', en: 'Apply saved view', ru: 'Применить сохранённый вид' },
  'ws.card_filter': { az: 'Süzgəc kimi tətbiq et', en: 'Apply as filter', ru: 'Применить как фильтр' },
  'ws.v_kanban': { az: 'Lövhə', en: 'Board', ru: 'Доска' },
  'ws.v_list': { az: 'Siyahı', en: 'List', ru: 'Список' },
  'ws.v_table': { az: 'Cədvəl', en: 'Table', ru: 'Таблица' },
  'ws.v_calendar': { az: 'Təqvim', en: 'Calendar', ru: 'Календарь' },
  'ws.v_timeline': { az: 'Zaman xətti', en: 'Timeline', ru: 'Таймлайн' },
  'ws.v_gantt': { az: 'Gantt', en: 'Gantt', ru: 'Гантт' },
  'ws.soon': { az: 'Bu görünüş hazırlanır.', en: 'This view is being built.', ru: 'Этот вид в разработке.' },
  'ws.c_total': { az: 'Ümumi tapşırıq', en: 'Total tasks', ru: 'Всего задач' },
  'ws.c_progress': { az: 'İşdə', en: 'In progress', ru: 'В работе' },
  'ws.c_overdue': { az: 'Gecikmiş', en: 'Overdue', ru: 'Просрочено' },
  'ws.c_done': { az: 'Tamamlanmış', en: 'Completed', ru: 'Завершено' },
  'ws.c_mine': { az: 'Mənim', en: 'Mine', ru: 'Мои' },
  'ws.c_high': { az: 'Yüksək prioritet', en: 'High priority', ru: 'Высокий приоритет' },
  'ws.c_review': { az: 'Baxışda', en: 'In review', ru: 'На проверке' },
  'ws.c_blocked': { az: 'Bloklanmış', en: 'Blocked', ru: 'Блокировано' },
  'ws.c_new': { az: 'Bu gün yaradılan', en: 'Created today', ru: 'Создано сегодня' },
  'ws.c_done_today': { az: 'Bu gün bitən', en: 'Done today', ru: 'Завершено сегодня' },
  'ws.c_rate': { az: 'Tamamlanma', en: 'Completion', ru: 'Прогресс' },
  'ws.c_spent': { az: 'Sərf olunan', en: 'Time spent', ru: 'Затрачено' },
  'ws.st_backlog': { az: 'Backlog', en: 'Backlog', ru: 'Бэклог' },
  'ws.st_to_do': { az: 'Gözləyir', en: 'To do', ru: 'К выполнению' },
  'ws.st_planning': { az: 'Planlama', en: 'Planning', ru: 'Планирование' },
  'ws.st_in_progress': { az: 'İşdə', en: 'In progress', ru: 'В работе' },
  'ws.st_review': { az: 'Baxış', en: 'Review', ru: 'Проверка' },
  'ws.st_testing': { az: 'Test', en: 'Testing', ru: 'Тестирование' },
  'ws.st_done': { az: 'Bitdi', en: 'Done', ru: 'Готово' },
  'ws.st_blocked': { az: 'Bloklanıb', en: 'Blocked', ru: 'Заблокировано' },
  'ws.st_cancelled': { az: 'Ləğv', en: 'Cancelled', ru: 'Отменено' },
  'ws.pr_critical': { az: 'Kritik', en: 'Critical', ru: 'Критический' },
  'ws.pr_urgent': { az: 'Təcili', en: 'Urgent', ru: 'Срочный' },
  'ws.pr_high': { az: 'Yüksək', en: 'High', ru: 'Высокий' },
  'ws.pr_medium': { az: 'Orta', en: 'Medium', ru: 'Средний' },
  'ws.pr_low': { az: 'Aşağı', en: 'Low', ru: 'Низкий' },
  'ws.f_status': { az: 'Status', en: 'Status', ru: 'Статус' },
  'ws.f_priority': { az: 'Prioritet', en: 'Priority', ru: 'Приоритет' },
  'ws.f_team': { az: 'Komanda', en: 'Team', ru: 'Команда' },
  'ws.f_project': { az: 'Layihə', en: 'Project', ru: 'Проект' },
  'ws.f_sprint': { az: 'Sprint', en: 'Sprint', ru: 'Спринт' },
  'ws.f_assignee': { az: 'İcraçı', en: 'Assignee', ru: 'Исполнитель' },
  'ws.f_due': { az: 'Son tarix', en: 'Due date', ru: 'Срок' },
  'ws.f_sort': { az: 'Sıralama', en: 'Sort', ru: 'Сортировка' },
  'ws.f_labels': { az: 'Etiketlər', en: 'Labels', ru: 'Метки' },
  'ws.f_mine': { az: 'Yalnız mənim', en: 'Only mine', ru: 'Только мои' },
  'ws.f_unassigned': { az: 'Təyin olunmamış', en: 'Unassigned', ru: 'Без исполнителя' },
  'ws.f_archived': { az: 'Arxivi göstər', en: 'Show archive', ru: 'Показать архив' },
  'ws.all_teams': { az: 'Bütün komandalar', en: 'All teams', ru: 'Все команды' },
  'ws.all_projects': { az: 'Bütün layihələr', en: 'All projects', ru: 'Все проекты' },
  'ws.all_sprints': { az: 'Bütün sprintlər', en: 'All sprints', ru: 'Все спринты' },
  'ws.all_assignees': { az: 'Hamı', en: 'Anyone', ru: 'Все' },
  'ws.all_due': { az: 'İstənilən vaxt', en: 'Any time', ru: 'Любой срок' },
  'ws.due_overdue': { az: 'Gecikmiş', en: 'Overdue', ru: 'Просроченные' },
  'ws.due_today': { az: 'Bu gün', en: 'Today', ru: 'Сегодня' },
  'ws.due_week': { az: 'Bu həftə', en: 'This week', ru: 'На этой неделе' },
  'ws.due_none': { az: 'Tarixsiz', en: 'No due date', ru: 'Без срока' },
  'ws.sort_manual': { az: 'Əl ilə', en: 'Manual', ru: 'Вручную' },
  'ws.sort_created': { az: 'Yaradılma', en: 'Created', ru: 'По созданию' },
  'ws.sort_updated': { az: 'Yenilənmə', en: 'Updated', ru: 'По обновлению' },
  'ws.sort_due': { az: 'Son tarix', en: 'Due date', ru: 'По сроку' },
  'ws.sort_priority': { az: 'Prioritet', en: 'Priority', ru: 'По приоритету' },
  'ws.sort_title': { az: 'Başlıq', en: 'Title', ru: 'По названию' },
  'ws.empty': { az: 'Tapşırıq tapılmadı. Süzgəci dəyişin və ya yeni tapşırıq yaradın.', en: 'No tasks found. Change the filters or create one.', ru: 'Задачи не найдены. Измените фильтры или создайте задачу.' },
  'ws.col_empty': { az: 'Boşdur', en: 'Empty', ru: 'Пусто' },
  'ws.col_more': { az: 'Daha çox', en: 'Load more', ru: 'Ещё' },
  'ws.col_more_hint': { az: 'Bu sütunda daha çox tapşırıq var — süzgəcdən istifadə edin.', en: 'This column has more tasks — use the filters.', ru: 'В этой колонке больше задач — используйте фильтры.' },
  'ws.select': { az: 'Seç', en: 'Select', ru: 'Выбрать' },
  'ws.selected': { az: '{n} seçildi', en: '{n} selected', ru: 'Выбрано: {n}' },
  'ws.clear_sel': { az: 'Seçimi ləğv et', en: 'Clear selection', ru: 'Снять выделение' },
  'ws.bulk_done': { az: 'Bitdi', en: 'Mark done', ru: 'Готово' },
  'ws.bulk_progress': { az: 'İşə sal', en: 'Start', ru: 'В работу' },
  'ws.bulk_high': { az: 'Yüksək', en: 'High', ru: 'Высокий' },
  'ws.bulk_archive': { az: 'Arxivlə', en: 'Archive', ru: 'В архив' },
  'ws.bulk_delete': { az: 'Sil', en: 'Delete', ru: 'Удалить' },
  'ws.bulk_delete_q': { az: '{n} tapşırıq silinsin?', en: 'Delete {n} tasks?', ru: 'Удалить {n} задач?' },
  'ws.bulk_ok': { az: '{n} tapşırıq yeniləndi', en: '{n} tasks updated', ru: 'Обновлено задач: {n}' },
  'ws.unassigned': { az: 'Təyin olunmayıb', en: 'Unassigned', ru: 'Без исполнителя' },
  'ws.no_sprint': { az: 'Sprintsiz', en: 'No sprint', ru: 'Без спринта' },
  'ws.detail': { az: 'Tapşırıq detalı', en: 'Task details', ru: 'Детали задачи' },
  'ws.close': { az: 'Bağla', en: 'Close', ru: 'Закрыть' },
  'ws.watch': { az: 'İzlə', en: 'Watch', ru: 'Следить' },
  'ws.watching': { az: 'İzləyirsən', en: 'Watching', ru: 'Вы следите' },
  'ws.unwatched': { az: 'İzləmə dayandırıldı', en: 'Stopped watching', ru: 'Слежение отключено' },
  'ws.title': { az: 'Başlıq', en: 'Title', ru: 'Название' },
  'ws.title_ph': { az: 'Nə edilməlidir?', en: 'What needs to be done?', ru: 'Что нужно сделать?' },
  'ws.description': { az: 'Təsvir', en: 'Description', ru: 'Описание' },
  'ws.desc_ph': { az: 'Detalları yaz…', en: 'Add details…', ru: 'Добавьте детали…' },
  'ws.start': { az: 'Başlama', en: 'Start date', ru: 'Начало' },
  'ws.due': { az: 'Son tarix', en: 'Due date', ru: 'Срок' },
  'ws.estimate': { az: 'Təxmin', en: 'Estimate', ru: 'Оценка' },
  'ws.spent': { az: 'Sərf olunan', en: 'Spent', ru: 'Затрачено' },
  'ws.min': { az: 'dəq', en: 'min', ru: 'мин' },
  'ws.m': { az: 'd', en: 'm', ru: 'м' },
  'ws.h': { az: 's', en: 'h', ru: 'ч' },
  'ws.checklist': { az: 'Yoxlama siyahısı', en: 'Checklist', ru: 'Чек-лист' },
  'ws.check_ph': { az: 'Bənd əlavə et və Enter…', en: 'Add an item and press Enter…', ru: 'Добавьте пункт и нажмите Enter…' },
  'ws.subtasks': { az: 'Alt-tapşırıqlar', en: 'Subtasks', ru: 'Подзадачи' },
  'ws.add_subtask': { az: 'Alt-tapşırıq', en: 'Subtask', ru: 'Подзадача' },
  'ws.no_subtasks': { az: 'Alt-tapşırıq yoxdur', en: 'No subtasks', ru: 'Подзадач нет' },
  'ws.dependencies': { az: 'Asılılıqlar', en: 'Dependencies', ru: 'Зависимости' },
  'ws.depends_on': { az: 'Bundan asılıdır', en: 'Depends on', ru: 'Зависит от' },
  'ws.blocks': { az: 'Bunları bloklayır', en: 'Blocks', ru: 'Блокирует' },
  'ws.no_deps': { az: 'Asılılıq yoxdur', en: 'No dependencies', ru: 'Зависимостей нет' },
  'ws.time': { az: 'Vaxt izləmə', en: 'Time tracking', ru: 'Учёт времени' },
  'ws.timer_start': { az: 'Taymeri başlat', en: 'Start timer', ru: 'Запустить таймер' },
  'ws.timer_stop': { az: 'Dayandır', en: 'Stop', ru: 'Остановить' },
  'ws.time_add': { az: 'Əlavə et', en: 'Add', ru: 'Добавить' },
  'ws.stop': { az: 'Dayandır', en: 'Stop', ru: 'Стоп' },
  'ws.comments': { az: 'Şərhlər', en: 'Comments', ru: 'Комментарии' },
  'ws.comment_ph': { az: 'Şərh yaz…', en: 'Write a comment…', ru: 'Напишите комментарий…' },
  'ws.no_comments': { az: 'Hələ şərh yoxdur', en: 'No comments yet', ru: 'Комментариев пока нет' },
  'ws.comment_del_q': { az: 'Şərh silinsin?', en: 'Delete this comment?', ru: 'Удалить комментарий?' },
  'ws.edited': { az: 'redaktə edilib', en: 'edited', ru: 'изменено' },
  'ws.activity': { az: 'Tarixçə', en: 'Activity', ru: 'История' },
  'ws.act_created': { az: 'yaratdı', en: 'created', ru: 'создал' },
  'ws.act_status': { az: 'statusu dəyişdi', en: 'changed status', ru: 'изменил статус' },
  'ws.act_assignee': { az: 'icraçını dəyişdi', en: 'changed assignee', ru: 'сменил исполнителя' },
  'ws.act_comment': { az: 'şərh yazdı', en: 'commented', ru: 'прокомментировал' },
  'ws.act_time': { az: 'vaxt yazdı', en: 'logged time', ru: 'записал время' },
  'ws.act_dependency': { az: 'asılılıq əlavə etdi', en: 'added a dependency', ru: 'добавил зависимость' },
  'ws.archive': { az: 'Arxivlə', en: 'Archive', ru: 'В архив' },
  'ws.unarchive': { az: 'Arxivdən çıxar', en: 'Unarchive', ru: 'Из архива' },
  'ws.archived_ok': { az: 'Arxiv yeniləndi', en: 'Archive updated', ru: 'Архив обновлён' },
  'ws.delete': { az: 'Sil', en: 'Delete', ru: 'Удалить' },
  'ws.delete_q': { az: 'Bu tapşırıq silinsin?', en: 'Delete this task?', ru: 'Удалить эту задачу?' },
  'ws.deleted': { az: 'Tapşırıq silindi', en: 'Task deleted', ru: 'Задача удалена' },
  'ws.created': { az: 'Tapşırıq yaradıldı', en: 'Task created', ru: 'Задача создана' },
  'ws.err_title': { az: 'Başlıq boşdur.', en: 'Title is empty.', ru: 'Название пустое.' },
  'ws.err_project': { az: 'Layihə seçilməyib.', en: 'No project selected.', ru: 'Проект не выбран.' },
  'ws.no_perm': { az: 'Bu əməliyyat üçün icazən yoxdur.', en: 'You do not have permission for this.', ru: 'Нет прав на это действие.' },
  'ws.label_remove': { az: 'Etiketi çıxar', en: 'Remove label', ru: 'Убрать метку' },
  'ws.label_name': { az: 'Etiket adı', en: 'Label name', ru: 'Название метки' },
  'ws.label_create': { az: 'Etiket yarat', en: 'Create label', ru: 'Создать метку' },
  'ws.no_labels': { az: 'Etiket yoxdur', en: 'No labels', ru: 'Меток нет' },
  'ws.sprint_name': { az: 'Sprint adı', en: 'Sprint name', ru: 'Название спринта' },
  'ws.sprint_create': { az: 'Sprint yarat', en: 'Create sprint', ru: 'Создать спринт' },
  'ws.sprint_del_q': { az: 'Sprint silinsin? Tapşırıqlar qalacaq.', en: 'Delete the sprint? Tasks will remain.', ru: 'Удалить спринт? Задачи останутся.' },
  'ws.no_sprints': { az: 'Sprint yoxdur', en: 'No sprints', ru: 'Спринтов нет' },
  'ws.sp_planned': { az: 'Planlanıb', en: 'Planned', ru: 'Запланирован' },
  'ws.sp_active': { az: 'Aktiv', en: 'Active', ru: 'Активен' },
  'ws.sp_completed': { az: 'Bitib', en: 'Completed', ru: 'Завершён' },
  'ws.no_rules': { az: 'Qayda yoxdur', en: 'No rules', ru: 'Правил нет' },
  'ws.trg_created': { az: 'yaradılanda', en: 'on create', ru: 'при создании' },
  'ws.trg_status_changed': { az: 'status dəyişəndə', en: 'on status change', ru: 'при смене статуса' },
  'ws.trg_due_soon': { az: 'son tarix yaxınlaşanda', en: 'when due soon', ru: 'при приближении срока' },
  'ws.on': { az: 'Aktiv', en: 'On', ru: 'Вкл' },
  'ws.off': { az: 'Sönülü', en: 'Off', ru: 'Выкл' },
  'ws.attachments': { az: 'Qoşmalar', en: 'Attachments', ru: 'Вложения' },
  'ws.attach_drop': { az: 'Faylı bura sürüşdür və ya seçmək üçün klikə', en: 'Drop files here or click to choose', ru: 'Перетащите файлы сюда или нажмите' },
  'ws.attach_add': { az: 'Qoşma əlavə et', en: 'Add attachment', ru: 'Добавить вложение' },
  'ws.no_attach': { az: 'Qoşma yoxdur', en: 'No attachments', ru: 'Вложений нет' },
  'ws.attach_del_q': { az: 'Qoşma silinsin?', en: 'Delete this attachment?', ru: 'Удалить вложение?' },
  'ws.err_name': { az: 'Ad boşdur.', en: 'The name is empty.', ru: 'Название пустое.' },
  'ws.err_team': { az: 'Komanda seçilməyib.', en: 'No team selected.', ru: 'Команда не выбрана.' },
  'ws.err_dates': { az: 'Bitmə tarixi başlanğıcdan sonra olmalıdır.', en: 'The end date must be after the start.', ru: 'Дата окончания должна быть позже начала.' },
  'ws.sp_from': { az: 'Başlanğıc', en: 'Starts', ru: 'Начало' },
  'ws.sp_to': { az: 'Bitmə', en: 'Ends', ru: 'Окончание' },
  'ws.label_color': { az: 'Rəng', en: 'Colour', ru: 'Цвет' },
  'ws.key': { az: 'Açar', en: 'Key', ru: 'Ключ' },
  'ws.prev': { az: 'Əvvəlki', en: 'Previous', ru: 'Назад' },
  'ws.next': { az: 'Növbəti', en: 'Next', ru: 'Вперёд' },
  'ws.today': { az: 'Bu gün', en: 'Today', ru: 'Сегодня' },
  'ws.no_dated': { az: 'Tarixi olan tapşırıq yoxdur. Son tarix və ya başlama tarixi əlavə edin.', en: 'No dated tasks. Add a start or due date.', ru: 'Нет задач с датами. Добавьте дату начала или срок.' },
  'ws.z_day': { az: 'Gün', en: 'Day', ru: 'День' },
  'ws.z_week': { az: 'Həftə', en: 'Week', ru: 'Неделя' },
  'ws.z_month': { az: 'Ay', en: 'Month', ru: 'Месяц' },
  'ws.z_quarter': { az: 'Rüb', en: 'Quarter', ru: 'Квартал' },
  'ws.loading': { az: 'Yüklənir…', en: 'Loading…', ru: 'Загрузка…' },

  /* ---------- İdarəetmə (moderasiya + dəvətlər) ----------
     ⚠ Bu mətnlər ƏVVƏL `js/governance.js`-də SABİT azərbaycanca idi,
       ona görə dil dəyişəndə bölmə tərcümə olunmurdu. */
  'gov.role_note': { az: 'Bu, PLATFORMA roluudur — bütün sayta şamil olur. Komanda daxilindəki rollar ayrıdır və komanda sahibi tərəfindən idarə olunur.', en: 'This is a PLATFORM role — it applies site-wide. Roles inside a team are separate and managed by the team owner.', ru: 'Это роль ПЛАТФОРМЫ — действует на весь сайт. Роли внутри команды отдельные и управляются владельцем команды.' },
  'gov.role_ok': { az: 'Rol yeniləndi.', en: 'Role updated.', ru: 'Роль обновлена.' },
  'gov.role_err': { az: 'Rol dəyişdirilə bilmədi.', en: 'Could not change the role.', ru: 'Не удалось изменить роль.' },
  'gov.chk_age': { az: 'Hesab yaşı (gün)', en: 'Account age (days)', ru: 'Возраст аккаунта (дней)' },
  'gov.chk_level': { az: 'Səviyyə', en: 'Level', ru: 'Уровень' },
  'gov.chk_rep': { az: 'Reputasiya', en: 'Reputation', ru: 'Репутация' },
  'gov.chk_warn': { az: 'Son 30 gündə xəbərdarlıq', en: 'Warnings in the last 30 days', ru: 'Предупреждений за 30 дней' },
  'gov.chk_verified': { az: 'Təsdiqlənmiş hesab', en: 'Verified account', ru: 'Подтверждённый аккаунт' },
  'gov.yes': { az: 'bəli', en: 'yes', ru: 'да' },
  'gov.no': { az: 'xeyr', en: 'no', ru: 'нет' },
  'gov.note_ph': { az: 'Qeyd (istəyə bağlı)', en: 'Note (optional)', ru: 'Заметка (необязательно)' },
  'gov.reject_ph': { az: 'Rədd səbəbi — namizəd üçün faydalı olsun', en: 'Reason for rejection — make it useful for the candidate', ru: 'Причина отказа — сделайте её полезной для кандидата' },
  'gov.approve_btn': { az: 'Təsdiqlə və moderator et', en: 'Approve and make moderator', ru: 'Одобрить и назначить модератором' },
  'gov.reject_btn': { az: 'Rədd et', en: 'Reject', ru: 'Отклонить' },
  'gov.approved_ok': { az: 'Namizəd moderator oldu.', en: 'The candidate is now a moderator.', ru: 'Кандидат стал модератором.' },
  'gov.rejected_ok': { az: 'Müraciət rədd edildi.', en: 'The application was rejected.', ru: 'Заявка отклонена.' },
  'gov.act_err': { az: 'Əməliyyat alınmadı.', en: 'The action failed.', ru: 'Действие не выполнено.' },
  'gov.approve_title': { az: 'Moderator təsdiqi', en: 'Moderator approval', ru: 'Подтверждение модератора' },
  'gov.reject_title': { az: 'Müraciətin rəddi', en: 'Rejecting the application', ru: 'Отклонение заявки' },
  'gov.forbidden_t': { az: 'Bu bölmə üçün səlahiyyətiniz yoxdur', en: 'You do not have access to this section', ru: 'У вас нет доступа к этому разделу' },
  'gov.forbidden_d': { az: 'Moderator namizədlərini yalnız MANAGE_ROLES icazəsi olan hesablar (SUPER_ADMIN və OWNER) görə bilər. Bu, qəsdən belədir: rol təyini adi admin səlahiyyətindən yuxarıdır.', en: 'Only accounts with the MANAGE_ROLES permission (SUPER_ADMIN and OWNER) can see moderator candidates. This is deliberate: assigning roles sits above ordinary admin rights.', ru: 'Кандидатов в модераторы видят только аккаунты с правом MANAGE_ROLES (SUPER_ADMIN и OWNER). Это сделано намеренно: назначение ролей выше обычных прав администратора.' },
  'gov.list_err': { az: 'Siyahı yüklənmədi', en: 'The list could not be loaded', ru: 'Список не загрузился' },
  'gov.no_pending': { az: 'Baxılmamış müraciət yoxdur', en: 'No pending applications', ru: 'Нет заявок на рассмотрении' },
  'gov.no_status': { az: 'Bu statusda müraciət yoxdur', en: 'No applications with this status', ru: 'Нет заявок с этим статусом' },
  'gov.apply_hint': { az: 'Şərtlərə uyğun istifadəçilər profil səhifəsindən müraciət edə bilər.', en: 'Users who meet the requirements can apply from their profile page.', ru: 'Пользователи, отвечающие требованиям, могут подать заявку со своей страницы профиля.' },
  'gov.mod_title': { az: 'Moderasiya səlahiyyəti', en: 'Moderation rights', ru: 'Права модерации' },
  'gov.mod_role': { az: 'Platforma rolunuz: {r}', en: 'Your platform role: {r}', ru: 'Ваша роль на платформе: {r}' },
  'gov.withdraw_btn': { az: 'Müraciəti geri götür', en: 'Withdraw the application', ru: 'Отозвать заявку' },
  'gov.withdraw_q': { az: 'Müraciətiniz geri götürülsün?', en: 'Withdraw your application?', ru: 'Отозвать вашу заявку?' },
  'gov.withdraw_ok': { az: 'Müraciət geri götürüldü.', en: 'The application was withdrawn.', ru: 'Заявка отозвана.' },
  'gov.fail': { az: 'Alınmadı.', en: 'It did not work.', ru: 'Не получилось.' },
  'gov.locked_hint': { az: 'Yuxarıdakı bütün şərtlər ödəndikdə müraciət düyməsi aktivləşəcək.', en: 'The apply button becomes active once every requirement above is met.', ru: 'Кнопка заявки станет активной, когда все условия выше будут выполнены.' },
  'gov.apply_title': { az: 'Moderator müraciəti', en: 'Moderator application', ru: 'Заявка в модераторы' },
  'gov.apply_note': { az: 'Moderatorluq XP ilə avtomatik gəlmir — müraciət edilir və admin qərar verir.', en: 'Moderation is not granted automatically by XP — you apply and an admin decides.', ru: 'Модерация не выдаётся автоматически за XP — вы подаёте заявку, решает администратор.' },
  'gov.apply_ph': { az: 'Niyə moderator olmaq istəyirsiniz? İcmaya necə kömək edəcəksiniz?', en: 'Why do you want to be a moderator? How will you help the community?', ru: 'Почему вы хотите стать модератором? Чем поможете сообществу?' },
  'gov.apply_short': { az: 'Ən azı 30 simvol yazın.', en: 'Write at least 30 characters.', ru: 'Напишите минимум 30 символов.' },
  'gov.apply_sent': { az: 'Müraciətiniz göndərildi.', en: 'Your application was sent.', ru: 'Ваша заявка отправлена.' },
  'gov.send_err': { az: 'Göndərilmədi.', en: 'It was not sent.', ru: 'Не отправлено.' },
  'gov.inv_title': { az: 'Dəvətlər', en: 'Invites', ru: 'Приглашения' },
  'gov.inv_sub': { az: 'Dəvət etdiyiniz hər yeni üzv üçün +{x} XP. İndiyədək: {n} nəfər.', en: '+{x} XP for every new member you invite. So far: {n} people.', ru: '+{x} XP за каждого приглашённого участника. Пока: {n} чел.' },
  'gov.inv_none': { az: 'Aktiv dəvət kodunuz yoxdur.', en: 'You have no active invite code.', ru: 'У вас нет активного кода приглашения.' },
  'gov.inv_revoked': { az: 'Kod ləğv edildi.', en: 'The code was revoked.', ru: 'Код отозван.' },
  'gov.inv_copied': { az: 'Kod kopyalandı.', en: 'The code was copied.', ru: 'Код скопирован.' },
  'gov.inv_copy_err': { az: 'Kopyalanmadı — kodu əl ilə seçin.', en: 'Copy failed — select the code manually.', ru: 'Не скопировалось — выделите код вручную.' },
  'gov.inv_created': { az: 'Kod yaradıldı: {c}', en: 'Code created: {c}', ru: 'Код создан: {c}' },
  'gov.inv_create_err': { az: 'Yaradılmadı.', en: 'It was not created.', ru: 'Не создано.' },

  /* ---------- Nişan və nailiyyət adları ----------
     ⚠ Açar `badges.code` / `achievements.code` ilə EYNİDİR (miqrasiya 0031).
       Server etiketi yalnız `label_az` saxlayır, ona görə tərcümə client
       tərəfdədir; `tOr()` açar tapılmasa server mətnini göstərir. */
  'bdg.first_post': { az: 'İlk paylaşım', en: 'First post', ru: 'Первый пост' },
  'bdg.poster_10': { az: '10 paylaşım', en: '10 posts', ru: '10 постов' },
  'bdg.poster_50': { az: '50 paylaşım', en: '50 posts', ru: '50 постов' },
  'bdg.commenter_25': { az: '25 şərh', en: '25 comments', ru: '25 комментариев' },
  'bdg.solver_5': { az: '5 tapşırıq', en: '5 tasks', ru: '5 задач' },
  'bdg.solver_25': { az: '25 tapşırıq', en: '25 tasks', ru: '25 задач' },
  'bdg.streak_7': { az: '7 günlük seriya', en: '7-day streak', ru: 'Серия 7 дней' },
  'bdg.streak_30': { az: '30 günlük seriya', en: '30-day streak', ru: 'Серия 30 дней' },
  'bdg.xp_1000': { az: '1000 XP', en: '1000 XP', ru: '1000 XP' },
  'bdg.xp_10000': { az: '10000 XP', en: '10000 XP', ru: '10000 XP' },
  'bdg.reputable': { az: 'Etibarlı', en: 'Reputable', ru: 'Авторитетный' },
  'bdg.profile_master': { az: 'Profil tamamlandı', en: 'Profile completed', ru: 'Профиль заполнен' },
  'bdg.community_voice': { az: 'İcma səsi', en: 'Community voice', ru: 'Голос сообщества' },
  'bdg.mentor': { az: 'Mentor', en: 'Mentor', ru: 'Наставник' },
  'bdg.veteran': { az: 'Veteran', en: 'Veteran', ru: 'Ветеран' },

  'pf.cover_change': { az: 'Örtüyü dəyiş', en: 'Change cover', ru: 'Сменить обложку' },
  'pf.cover_pick': { az: 'Örtük naxışı', en: 'Cover pattern', ru: 'Узор обложки' },
  'pf.cover_saved': { az: 'Örtük yeniləndi', en: 'Cover updated', ru: 'Обложка обновлена' },

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
  'feed.sort_old': { az: 'Ən köhnə', en: 'Oldest', ru: 'Старые' },
  'feed.sort_commented': { az: 'Ən çox şərh', en: 'Most commented', ru: 'Обсуждаемые' },
  'feed.sort_trending': { az: 'Trenddə', en: 'Trending', ru: 'В тренде' },
  'feed.sort_label': { az: 'Sıralama', en: 'Sort by', ru: 'Сортировка' },
  'feed.sort_replies': { az: 'Ən çox cavab', en: 'Most replies', ru: 'Больше ответов' },
  /* şərh sistemi — AUDIT-UI yenidən dizayn */
  'cm.author': { az: 'Müəllif', en: 'Author', ru: 'Автор' },
  'cm.moderator': { az: 'Moderator', en: 'Moderator', ru: 'Модератор' },
  'cm.admin': { az: 'Admin', en: 'Admin', ru: 'Админ' },
  'cm.you': { az: 'Sən', en: 'You', ru: 'Вы' },
  'poll.votes': { az: '{n} səs', en: '{n} votes', ru: 'голосов: {n}' },
  'poll.closed': { az: 'Bağlanıb', en: 'Closed', ru: 'Завершён' },
  'poll.closes': { az: 'bitir {t}', en: 'ends {t}', ru: 'завершится {t}' },
  'poll.hidden_hint': { az: 'Nəticələr səsdən sonra görünür', en: 'Results shown after you vote', ru: 'Результаты — после голосования' },
  'poll.add': { az: 'Sorğu', en: 'Poll', ru: 'Опрос' },
  'poll.question_ph': { az: 'Sual…', en: 'Question…', ru: 'Вопрос…' },
  'poll.option_ph': { az: 'Variant {n}', en: 'Option {n}', ru: 'Вариант {n}' },
  'poll.add_option': { az: '+ Variant', en: '+ Option', ru: '+ Вариант' },
  /* kompozitor — yenidən dizayn */
  'cx.aria': { az: 'Paylaşım yaratma', en: 'Create a post', ru: 'Создание публикации' },
  'cx.title': { az: 'Nə paylaşırsan?', en: 'What are you sharing?', ru: 'Чем поделитесь?' },
  'cx.tools_aria': { az: 'Məzmun alətləri', en: 'Content tools', ru: 'Инструменты' },
  'cx.tip_text': { az: 'Mətn bloku — Markdown dəstəklənir', en: 'Text block — Markdown supported', ru: 'Текстовый блок — Markdown' },
  'cx.tip_code': { az: 'Kod bloku — dil seçimi və sintaksis rəngləmə', en: 'Code block — language + highlighting', ru: 'Блок кода — язык и подсветка' },
  'cx.tip_img': { az: 'Şəkil əlavə et', en: 'Add image', ru: 'Добавить изображение' },
  'cx.tip_poll': { az: 'Sorğu yarat', en: 'Create poll', ru: 'Создать опрос' },
  'cx.tag_search': { az: 'Sahə axtar…', en: 'Search topics…', ru: 'Поиск тем…' },
  'cx.tag_none': { az: 'Uyğun sahə tapılmadı', en: 'No matching topics', ru: 'Ничего не найдено' },
  'cx.vis_aria': { az: 'Kim görə bilər', en: 'Who can see this', ru: 'Кто может видеть' },
  'cx.vis_public': { az: 'Hamı', en: 'Public', ru: 'Все' },
  'cx.vis_followers': { az: 'İzləyicilər', en: 'Followers', ru: 'Подписчики' },
  'cx.vis_private': { az: 'Yalnız mən', en: 'Only me', ru: 'Только я' },
  'cx.more_aria': { az: 'Digər yayım seçimləri', en: 'More publishing options', ru: 'Другие варианты' },
  'cx.schedule': { az: 'Planlaşdır', en: 'Schedule', ru: 'Запланировать' },
  'cx.schedule_hint': { az: 'Post seçdiyin vaxta qədər yalnız sənə görünəcək.', en: 'The post stays visible only to you until then.', ru: 'До этого времени пост виден только вам.' },
  'cx.schedule_future': { az: 'Gələcək bir vaxt seç', en: 'Pick a future time', ru: 'Выберите будущее время' },
  'cx.scheduled_for': { az: 'Planlaşdırıldı: {t}', en: 'Scheduled for {t}', ru: 'Запланировано: {t}' },
  'cx.save_draft': { az: 'Qaralama saxla', en: 'Save draft', ru: 'Сохранить черновик' },
  'cx.saved': { az: 'Saxlanıldı', en: 'Saved', ru: 'Сохранено' },
  'cx.save_failed': { az: 'Saxlanıla bilmədi', en: 'Could not save', ru: 'Не удалось сохранить' },
  'cx.restored': { az: 'Qaralama bərpa olundu', en: 'Draft restored', ru: 'Черновик восстановлен' },
  'poll.multi': { az: 'Çoxlu seçim', en: 'Multiple choice', ru: 'Мультивыбор' },
  'poll.anonymous': { az: 'Anonim', en: 'Anonymous', ru: 'Анонимно' },
  'poll.duration': { az: 'Müddət', en: 'Duration', ru: 'Срок' },
  'poll.dur_none': { az: 'Müddətsiz', en: 'No limit', ru: 'Без срока' },
  'poll.dur_1': { az: '1 gün', en: '1 day', ru: '1 день' },
  'poll.dur_3': { az: '3 gün', en: '3 days', ru: '3 дня' },
  'poll.dur_7': { az: '7 gün', en: '7 days', ru: '7 дней' },
  'poll.multi_hint': { az: 'bir neçə variant seçmək olar', en: 'multiple choice', ru: 'можно выбрать несколько' },
  'poll.anon_hint': { az: 'anonim səsvermə', en: 'anonymous voting', ru: 'анонимное голосование' },
  'poll.incomplete': { az: 'Sorğu üçün sual və ən azı 2 variant lazımdır', en: 'A poll needs a question and at least 2 options', ru: 'Нужен вопрос и минимум 2 варианта' },
  'poll.hide_results': { az: 'Nəticələri səsdən sonra göstər', en: 'Hide results until voted', ru: 'Скрыть результаты до голосования' },
  'cm.prev_image': { az: 'Əvvəlki şəkil', en: 'Previous image', ru: 'Предыдущее изображение' },
  'cm.next_image': { az: 'Sonrakı şəkil', en: 'Next image', ru: 'Следующее изображение' },
  'cm.copy_link': { az: 'Linki kopyala', en: 'Copy link', ru: 'Копировать ссылку' },
  'cm.link_copied': { az: 'Şərh linki kopyalandı', en: 'Comment link copied', ru: 'Ссылка скопирована' },
  'cm.more': { az: 'Daha çox əməliyyat', en: 'More actions', ru: 'Ещё действия' },
  'cm.hide_replies': { az: 'Cavabları gizlət', en: 'Hide replies', ru: 'Скрыть ответы' },
  'cm.show_replies': { az: '{n} cavabı göstər', en: 'Show {n} replies', ru: 'Показать ответы ({n})' },
  'cm.sending': { az: 'Göndərilir…', en: 'Sending…', ru: 'Отправка…' },
  'cm.hint': { az: 'Enter — göndər · Shift+Enter — yeni sətir · Markdown dəstəklənir',
               en: 'Enter to send · Shift+Enter for new line · Markdown supported',
               ru: 'Enter — отправить · Shift+Enter — новая строка · Markdown' },
  'cm.load_error': { az: 'Şərhlər yüklənmədi.', en: 'Could not load comments.', ru: 'Не удалось загрузить комментарии.' },
  'cm.retry': { az: 'Yenidən cəhd et', en: 'Retry', ru: 'Повторить' },
  'cm.empty_title': { az: 'Hələ şərh yoxdur', en: 'No comments yet', ru: 'Пока нет комментариев' },
  /* reaksiya adları — ekran oxuyucusu və tooltip üçün */
  'cm.react_like':  { az: 'Bəyəndim', en: 'Like', ru: 'Нравится' },
  'cm.react_love':  { az: 'Sevdim', en: 'Love', ru: 'Любовь' },
  'cm.react_laugh': { az: 'Güldüm', en: 'Haha', ru: 'Смешно' },
  'cm.react_wow':   { az: 'Təəccübləndim', en: 'Wow', ru: 'Ух ты' },
  'cm.react_fire':  { az: 'Alovlu', en: 'Fire', ru: 'Огонь' },
  'cm.react_clap':  { az: 'Alqış', en: 'Clap', ru: 'Аплодисменты' },
  'cm.react_tada':  { az: 'Təbrik', en: 'Celebrate', ru: 'Праздник' },
  'cm.react_hundred': { az: 'Tam dəstək', en: 'Hundred', ru: 'Сто процентов' },
  'cm.react_rocket': { az: 'Uçuş', en: 'Rocket', ru: 'Ракета' },
  /* moderasiya */
  'cm.pin':      { az: 'Sancaqla', en: 'Pin', ru: 'Закрепить' },
  'cm.unpin':    { az: 'Sancağı götür', en: 'Unpin', ru: 'Открепить' },
  'cm.pinned':   { az: 'Sancaqlanıb', en: 'Pinned', ru: 'Закреплено' },
  'cm.hide':     { az: 'Gizlət', en: 'Hide', ru: 'Скрыть' },
  'cm.restore':  { az: 'Bərpa et', en: 'Restore', ru: 'Восстановить' },
  'cm.hidden':   { az: 'Gizlədilib', en: 'Hidden', ru: 'Скрыто' },
  'cm.report':   { az: 'Şikayət et', en: 'Report', ru: 'Пожаловаться' },
  'cm.report_q': { az: 'Şikayət səbəbi', en: 'Reason for report', ru: 'Причина жалобы' },
  'cm.report_ok': { az: 'Şikayət göndərildi', en: 'Report sent', ru: 'Жалоба отправлена' },
  'cm.report_dup': { az: 'Bu şərhi artıq şikayət etmisən', en: 'You already reported this comment', ru: 'Вы уже пожаловались' },
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

  /* ── Çat redizaynı: siyahı, detallar paneli, emoji, AI ─────────────────── */
  /* ── Mesaj əməliyyatları · reaksiyalar · thread (0047) ─────────────────── */
  'msg.show_more':   { az: 'Daha çox oxu', en: 'Read more', ru: 'Читать далее' },
  'msg.show_less':   { az: 'Yığ', en: 'Show less', ru: 'Свернуть' },
  'msg.actions':     { az: 'Mesaj əməliyyatları', en: 'Message actions', ru: 'Действия с сообщением' },
  'msg.react':       { az: 'Reaksiya ver', en: 'React', ru: 'Реакция' },
  'msg.reply':       { az: 'Cavabla', en: 'Reply', ru: 'Ответить' },
  'msg.copy':        { az: 'Mətni kopyala', en: 'Copy text', ru: 'Копировать текст' },
  'msg.copy_link':   { az: 'Mesaj linkini kopyala', en: 'Copy message link', ru: 'Скопировать ссылку' },
  'msg.forward':     { az: 'Yönləndir', en: 'Forward', ru: 'Переслать' },
  'msg.bookmark':    { az: 'Əlfəcinə əlavə et', en: 'Bookmark', ru: 'В закладки' },
  'msg.unbookmark':  { az: 'Əlfəcindən çıxar', en: 'Remove bookmark', ru: 'Убрать из закладок' },
  'msg.reply_gone':  { az: 'Cavablanan mesaj artıq yoxdur', en: 'The replied message is gone', ru: 'Исходное сообщение недоступно' },
  'msg.jump_to_reply': { az: '{who} adlı şəxsin mesajına keç', en: 'Jump to message by {who}', ru: 'Перейти к сообщению {who}' },
  'msg.replying_to': { az: 'Cavab verilir:', en: 'Replying to:', ru: 'Ответ на:' },
  'msg.cancel_reply': { az: 'Cavabı ləğv et', en: 'Cancel reply', ru: 'Отменить ответ' },
  'msg.forward_to':  { az: 'Hansı söhbətə yönləndirilsin?', en: 'Forward to which conversation?', ru: 'Переслать в какой чат?' },
  'msg.forwarded':   { az: 'Yönləndirildi', en: 'Forwarded', ru: 'Переслано' },
  'msg.link_copied': { az: 'Mesaj linki kopyalandı', en: 'Message link copied', ru: 'Ссылка скопирована' },

  'react.like':   { az: 'Bəyəndim', en: 'Like', ru: 'Нравится' },
  'react.love':   { az: 'Sevdim', en: 'Love', ru: 'Люблю' },
  'react.laugh':  { az: 'Güldüm', en: 'Haha', ru: 'Смешно' },
  'react.wow':    { az: 'Təəccübləndim', en: 'Wow', ru: 'Ого' },
  'react.fire':   { az: 'Alov', en: 'Fire', ru: 'Огонь' },
  'react.clap':   { az: 'Alqış', en: 'Clap', ru: 'Аплодисменты' },
  'react.party':  { az: 'Təbrik', en: 'Party', ru: 'Праздник' },
  'react.rocket': { az: 'Raket', en: 'Rocket', ru: 'Ракета' },

  'chat.unread_n':   { az: '{n} oxunmamış mesaj', en: '{n} unread messages', ru: '{n} непрочитанных сообщений' },
  /* Say bilinmədikdə (DM siyahısı — server yalnız `readAt` damğası verir). */
  'chat.unread_any': { az: 'Oxunmamış mesaj var', en: 'Has unread messages', ru: 'Есть непрочитанные' },
  'chat.prev_image': { az: 'Şəkil', en: 'Photo', ru: 'Фото' },
  'chat.prev_file':  { az: 'Fayl:', en: 'File:', ru: 'Файл:' },
  'chat.prev_code':  { az: 'Kod parçası', en: 'Code snippet', ru: 'Фрагмент кода' },
  'chat.room_sub':   { az: 'Hamı üçün açıqdır', en: 'Open to everyone', ru: 'Открыт для всех' },
  'chat.pinned_one': { az: 'Sabitlənmiş mesaj', en: 'Pinned message', ru: 'Закреплённое сообщение' },
  'chat.pinned_by':  { az: 'Sabitləyib: {who}', en: 'Pinned by {who}', ru: 'Закрепил(а): {who}' },
  'chat.pinned_count': { az: '{n} sabitlənmiş mesaj — hamısını göstər', en: '{n} pinned messages — show all', ru: '{n} закреплённых — показать все' },
  'chat.jump_pinned': { az: 'Sabitlənmiş mesaja keç', en: 'Jump to pinned message', ru: 'Перейти к закреплённому' },
  'chat.jump_pinned_n': { az: 'Sabitlənmiş {i}/{n} — keç və növbətiyə adla', en: 'Pinned {i} of {n} — jump and go to next', ru: 'Закреплённое {i}/{n} — перейти и далее' },
  'chat.pin':        { az: 'Sabitlə', en: 'Pin', ru: 'Закрепить' },
  'chat.unpin':      { az: 'Sabitləməni ləğv et', en: 'Unpin', ru: 'Открепить' },
  'chat.pin_fail':   { az: 'Sabitlənmədi', en: 'Could not pin', ru: 'Не удалось закрепить' },
  'chat.search_conv': { az: 'Söhbətlərdə axtar', en: 'Search conversations', ru: 'Поиск по чатам' },
  'chat.you':        { az: 'sən: ', en: 'you: ', ru: 'вы: ' },
  'chat.no_messages_yet': { az: 'Hələ mesaj yoxdur', en: 'No messages yet', ru: 'Сообщений пока нет' },

  /* Başlıq + söhbət tərcihləri (pin/mute) */
  'hdr.level':   { az: 'Səviyyə {n}', en: 'Level {n}', ru: 'Уровень {n}' },
  'room.set_icon':   { az: 'Otaq şəklini dəyiş', en: 'Change room picture', ru: 'Изменить фото комнаты' },
  'room.clear_icon': { az: 'Otaq şəklini sil', en: 'Remove room picture', ru: 'Удалить фото комнаты' },
  'room.clear_icon_conf': { az: 'Otaq şəkli silinsin?', en: 'Remove the room picture?', ru: 'Удалить фото комнаты?' },
  'room.icon_updated': { az: 'Otaq şəkli yeniləndi', en: 'Room picture updated', ru: 'Фото комнаты обновлено' },
  'hdr.search':  { az: 'Söhbətdə axtar', en: 'Search conversation', ru: 'Поиск в чате' },
  'conv.pin':    { az: 'Söhbəti sabitlə', en: 'Pin conversation', ru: 'Закрепить чат' },
  'conv.unpin':  { az: 'Sabitləməni ləğv et', en: 'Unpin conversation', ru: 'Открепить чат' },
  'conv.pinned': { az: 'Sabitlənmiş söhbət', en: 'Pinned conversation', ru: 'Закреплённый чат' },
  'conv.mute':   { az: 'Bildirişləri sustur', en: 'Mute notifications', ru: 'Отключить уведомления' },
  'conv.unmute': { az: 'Bildirişləri aç', en: 'Unmute notifications', ru: 'Включить уведомления' },
  'conv.muted':  { az: 'Susdurulmuş söhbət', en: 'Muted conversation', ru: 'Чат без уведомлений' },

  'cd.title':      { az: 'Söhbət detalları', en: 'Conversation details', ru: 'Детали чата' },
  'cd.toggle':     { az: 'Söhbət detallarını aç/bağla', en: 'Toggle conversation details', ru: 'Показать/скрыть детали' },
  'cd.close':      { az: 'Paneli bağla', en: 'Close panel', ru: 'Закрыть панель' },
  'cd.search':     { az: 'Axtarış', en: 'Search', ru: 'Поиск' },
  'cd.search_ph':  { az: 'Bu söhbətdə axtar…', en: 'Search this conversation…', ru: 'Искать в этом чате…' },
  'cd.no_hits':    { az: 'Nəticə tapılmadı.', en: 'No results.', ru: 'Ничего не найдено.' },
  'cd.people':     { az: 'İştirakçılar', en: 'Participants', ru: 'Участники' },
  'cd.no_people':  { az: 'İştirakçı məlumatı yoxdur.', en: 'No participant data.', ru: 'Нет данных об участниках.' },
  'cd.online':     { az: 'Onlayn', en: 'Online', ru: 'В сети' },
  'cd.pins':       { az: 'Sabitlənmiş', en: 'Pinned', ru: 'Закреплённые' },
  'cd.no_pins':    { az: 'Hələ sabitlənmiş mesaj yoxdur.', en: 'No pinned messages yet.', ru: 'Пока нет закреплённых сообщений.' },
  'cd.unpin':      { az: 'Sabitləməni ləğv et', en: 'Unpin', ru: 'Открепить' },
  'cd.filters':    { az: 'Növ üzrə filtr', en: 'Filter by type', ru: 'Фильтр по типу' },
  'cd.f_all':      { az: 'Hamısı', en: 'All', ru: 'Все' },
  'cd.f_msg':      { az: 'Mesaj', en: 'Messages', ru: 'Сообщения' },
  'cd.f_img':      { az: 'Şəkil', en: 'Images', ru: 'Фото' },
  'cd.f_file':     { az: 'Fayl', en: 'Files', ru: 'Файлы' },
  'cd.f_code':     { az: 'Kod', en: 'Code', ru: 'Код' },
  'cd.f_link':     { az: 'Link', en: 'Links', ru: 'Ссылки' },
  'cd.media':      { az: 'Media', en: 'Media', ru: 'Медиа' },
  'cd.no_media':   { az: 'Hələ şəkil paylaşılmayıb.', en: 'No images shared yet.', ru: 'Изображений пока нет.' },
  'cd.files':      { az: 'Fayllar', en: 'Files', ru: 'Файлы' },
  'cd.no_files':   { az: 'Hələ fayl paylaşılmayıb.', en: 'No files shared yet.', ru: 'Файлов пока нет.' },
  'cd.links':      { az: 'Linklər', en: 'Links', ru: 'Ссылки' },
  'cd.no_links':   { az: 'Hələ link paylaşılmayıb.', en: 'No links shared yet.', ru: 'Ссылок пока нет.' },
  'cd.jump_to_media': { az: 'Bu şəklin mesajına keç', en: 'Jump to this image', ru: 'Перейти к этому изображению' },
  'cd.summary':    { az: 'AI xülasə', en: 'AI summary', ru: 'AI-сводка' },
  'cd.summarize':  { az: 'Söhbəti xülasə et', en: 'Summarize conversation', ru: 'Сделать сводку' },

  /* Kompozitor */
  /* Kod bloku */
  'code.plain':  { az: 'kod', en: 'code', ru: 'код' },
  'code.toggle': { az: 'Kodu yığ / aç', en: 'Collapse / expand code', ru: 'Свернуть / развернуть код' },

  'cmp.bold':        { az: 'Qalın (Ctrl+B)', en: 'Bold (Ctrl+B)', ru: 'Жирный (Ctrl+B)' },
  'cmp.inline_code': { az: 'Kod (Ctrl+E)', en: 'Code (Ctrl+E)', ru: 'Код (Ctrl+E)' },
  'cmp.link':        { az: 'Link əlavə et', en: 'Insert link', ru: 'Вставить ссылку' },
  'cmp.preview':     { az: 'Önbaxış (markdown)', en: 'Preview (markdown)', ru: 'Предпросмотр (markdown)' },
  'cmp.preview_empty': { az: 'Önbaxış üçün mətn yazın.', en: 'Type something to preview.', ru: 'Введите текст для предпросмотра.' },
  'cmp.drop_here':   { az: 'Faylı bura buraxın', en: 'Drop files here', ru: 'Перетащите файлы сюда' },
  'cmp.uploading':   { az: 'Yüklənir…', en: 'Uploading…', ru: 'Загрузка…' },

  'emoji.open':        { az: 'Emoji əlavə et', en: 'Add emoji', ru: 'Добавить эмодзи' },
  'emoji.cat_smiley':  { az: 'Üzlər', en: 'Smileys', ru: 'Смайлы' },
  'emoji.cat_gesture': { az: 'Jestlər', en: 'Gestures', ru: 'Жесты' },
  'emoji.cat_object':  { az: 'Simvollar', en: 'Symbols', ru: 'Символы' },
  'emoji.cat_dev':     { az: 'Developer', en: 'Developer', ru: 'Разработка' },

  'ai.open':      { az: 'AI alətləri', en: 'AI tools', ru: 'AI-инструменты' },
  'ai.improve':   { az: 'Mətni yaxşılaşdır', en: 'Improve text', ru: 'Улучшить текст' },
  'ai.translate': { az: 'Tərcümə et → {lang}', en: 'Translate → {lang}', ru: 'Перевести → {lang}' },
  'ai.code':      { az: 'Kodu izah et / təkmilləşdir', en: 'Explain / improve code', ru: 'Объяснить / улучшить код' },
  'ai.summary':   { az: 'Söhbəti xülasə et', en: 'Summarize conversation', ru: 'Сделать сводку чата' },
  'ai.apply':     { az: 'Tətbiq et', en: 'Apply', ru: 'Применить' },
  'ai.cancel':    { az: 'Ləğv et', en: 'Cancel', ru: 'Отмена' },
  'ai.need_text': { az: 'Əvvəlcə mesaj yazın.', en: 'Type a message first.', ru: 'Сначала напишите сообщение.' },
  'ai.working':   { az: 'AI işləyir…', en: 'AI is working…', ru: 'AI работает…' },
  'ai.empty':     { az: 'AI cavab qaytarmadı.', en: 'AI returned nothing.', ru: 'AI ничего не вернул.' },
  'ai.fail':      { az: 'AI sorğusu alınmadı.', en: 'AI request failed.', ru: 'Запрос к AI не удался.' },
  'ai.summary_ready': { az: 'Xülasə detallar panelindədir', en: 'Summary is in the details panel', ru: 'Сводка в панели деталей' },
  /* ⚠ Bu qeyd QƏSDƏN göstərilir: nəticə birbaşa göndərilmir, istifadəçi
     təsdiqləyir. İstifadəçi AI-ın nə etdiyini əvvəlcədən bilməlidir. */
  'ai.note': {
    az: 'Nəticə əvvəlcə önbaxışda göstərilir — təsdiqləməsən mesaj dəyişmir.',
    en: 'The result is shown as a preview first — nothing changes until you apply it.',
    ru: 'Результат сначала показывается в предпросмотре — ничего не меняется, пока вы не примените.',
  },

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
  /* AUDIT-UI: kompozitor önbaxış şəkilləri üçün `alt` + hədd aşımı xəbərdarlığı. */
  'comp.img_preview_alt': { az: 'Yüklənəcək şəkil {n}', en: 'Image {n} to upload', ru: 'Изображение {n} для загрузки' },
  'comp.too_long':  { az: 'Mətn həddi aşıb: {n} / {max} simvol. Qısaldın və yenidən cəhd edin.', en: 'Text is too long: {n} / {max} characters. Shorten it and try again.', ru: 'Текст слишком длинный: {n} / {max} символов. Сократите и попробуйте снова.' },

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
  'badge.earned': { az: 'qazanılıb', en: 'earned', ru: 'получен' },
  'badge.locked': { az: 'hələ qazanılmayıb', en: 'not earned yet', ru: 'ещё не получен' },
  'badge.first_post': { az: 'İlk paylaşım', en: 'First post', ru: 'Первый пост' },
  'badge.streak_7': { az: '7 gün seriya', en: '7 day streak', ru: 'Серия 7 дней' },
  'badge.streak_30': { az: '30 gün seriya', en: '30 day streak', ru: 'Серия 30 дней' },
  'badge.task_1': { az: 'İlk tapşırıq', en: 'First task', ru: 'Первое задание' },
  'badge.task_10': { az: '10 tapşırıq', en: '10 tasks', ru: '10 заданий' },
  'badge.xp_500': { az: '500 XP', en: '500 XP', ru: '500 XP' },
  'badge.xp_2000': { az: '2000 XP', en: '2000 XP', ru: '2000 XP' }
};

// ⚠ YALNIZ BUILD VAXTI ÜÇÜN — runtime kodu bunu işlətməməlidir, `t()` var.
//
// `vite.config.ts`-dəki i18n ön-doldurma plagini `index.html`-dəki boş
// `data-i18n` elementlərini bu lüğətdən doldurur. Səbəb ölçülüb: 290
// elementdən 275-i HTML-də BOŞ idi, yəni səhifə 165 KiB JS enib icra
// olunana qədər hərfi mənada ağ qalırdı (LCP render gecikməsi 1350 ms).
//
// ⚠ NİYƏ `t()` YOX, XAM LÜĞƏT: `t()` açar tapılmasa açarı "oxunaqlı mətnə"
//   çevirib qaytarır ("nav.home" → "Home"). Build vaxtı bu, İNGİLİS
//   fallback-ını AZ səhifəyə yapışdırardı. Plagin isə açar yoxdursa
//   elementi toxunulmaz qoymalıdır — ona görə mövcudluq yoxlanılan xam
//   obyekt lazımdır.
export const DICT = D;

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
/**
 * Açar varsa tərcümə, yoxdursa VERİLƏN GERİ DÜŞMƏ.
 *
 * 🔴 NİYƏ `t()` KİFAYƏT ETMİR: `t()` naməlum açarı "oxunaqlı mətnə" çevirir
 *    ("bdg.first_post" → "First post") və `reportMissing` ilə xəbərdarlıq
 *    yazır. Serverdən gələn etiketlər üçün bu YANLIŞ davranışdır — orada
 *    real mətn var və o, açar adından daha yaxşıdır.
 *
 * İstifadə: nişan/nailiyyət adları serverdə YALNIZ Azərbaycanca saxlanılır
 * (`badges.label_az`). Client `code` üzrə tərcümə tapırsa onu, tapmırsa
 * server mətnini göstərir — yəni admin yeni nişan əlavə edəndə o, tərcüməsiz
 * olsa belə DÜZGÜN adla görünür.
 */
export function tOr(key, fallback){
  const e = D[key];
  if(!e) return fallback;
  return e[current] || e.az || fallback;
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

/* ⚠ AZ AY ADLARI ƏL İLƏ: brauzerin `az-AZ` ICU məlumatı natamam ola bilər və
   `month:'long'` üçün "M07" kimi xam nişan qaytarır (Chrome-da ölçüldü; Node
   eyni çağırışda "avqust" verir). Profil kartında "Qoşulub 2026 M07" çıxırdı.
   Cədvəl yalnız GERİ DÜŞMƏ yoludur — nəticə düzgün görünürsə ona toxunulmur. */
const AZ_MONTHS = ['yanvar','fevral','mart','aprel','may','iyun',
  'iyul','avqust','sentyabr','oktyabr','noyabr','dekabr'];

/**
 * "iyul 2026" / "July 2026" / "июль 2026".
 * @param {number|Date} ts
 */
export function fmtMonthYear(ts){
  const d = ts instanceof Date ? ts : new Date(Number(ts));
  if(isNaN(d.getTime())) return '';
  let month = '';
  try{ month = new Intl.DateTimeFormat(localeTag(), { month: 'long' }).format(d); }catch(e){}
  // ICU nişanı (`M07`, `L07`) və ya boş nəticə → əl ilə cədvəl.
  if(!month || /^[ML]\d{1,2}$/.test(month)) month = AZ_MONTHS[d.getMonth()] || String(d.getMonth() + 1);
  return month + ' ' + d.getFullYear();
}

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
/* Azərbaycanca nisbi vaxt adları.
 *
 * ⚠ NİYƏ ƏLLƏ: Chrome `Intl.RelativeTimeFormat.supportedLocalesOf(['az'])`
 *   üçün `az` QAYTARIR və `resolvedOptions().locale === 'az'` olur, LAKİN
 *   CLDR-in `az` nisbi-vaxt datası yoxdur → çıxış xam fallback olur:
 *   `format(-5,'hour')` → "-5 h". İstifadəçi feed-də "-5 h", sessiyalarda
 *   "son fəallıq: -27 s" görürdü. Rus/ingilis dilləri düzgün işləyir, ona
 *   görə yalnız `az` üçün öz cədvəlimiz var. */
const REL_AZ = {
  year: 'il', month: 'ay', week: 'həftə', day: 'gün',
  hour: 'saat', minute: 'dəqiqə', second: 'saniyə',
};

export function fmtRelTime(ts){
  const then = ts instanceof Date ? ts.getTime() : Number(ts);
  if(!isFinite(then)) return '';
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  /** @type {Array<[Intl.RelativeTimeFormatUnit, number]>} */
  const units = [
    ['year', 31536e6], ['month', 2592e6], ['week', 6048e5],
    ['day', 864e5], ['hour', 36e5], ['minute', 6e4], ['second', 1e3],
  ];

  if(current === 'az'){
    // 45 saniyədən yaxın — həm keçmiş, həm gələcək "indicə"dir. Bu, saat
    // fərqindən yaranan kiçik MƏNFİ fərqləri də udur.
    if(abs < 45e3) return 'indicə';
    for(const [unit, ms] of units){
      if(abs >= ms){
        const n = Math.round(abs / ms);
        return n + ' ' + REL_AZ[unit] + (diff < 0 ? ' əvvəl' : ' sonra');
      }
    }
    return 'indicə';
  }

  const rtf = new Intl.RelativeTimeFormat(localeTag(), { numeric: 'auto' });
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
