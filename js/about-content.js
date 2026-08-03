// "Haqqımızda" səhifəsinin STRUKTUR məzmunu (AZ / EN / RU).
//
// ⚠ NİYƏ AYRICA MODUL, `legal.js`-in İÇİ DEYİL:
//   `legal.js` hüquqi mətnlərin (məxfilik, şərtlər, cookie) yeridir və onsuz
//   da 900+ sətirdir. Bu isə marketinq/izah məzmunudur — ayrı saxlanılanda
//   həm diff oxunaqlı qalır, həm də publik qat onu ayrıca chunk kimi yükləyə
//   bilir.
//
// ⚠ NİYƏ MARKDOWN DEYİL, DATA:
//   Əvvəl bu səhifə `LEGAL.about` daxilində tək markdown bloku idi və nəticədə
//   başlıq+abzas divarı kimi görünürdü — vizual iyerarxiya yox idi, ikon kimi
//   emoji (🔥) işlədilirdi, platformanın NƏ OLDUĞU isə üç bənd ilə keçilirdi.
//   Struktur data modul kartlarına, texnologiya cədvəlinə və dəyər kartlarına
//   render olunmağa imkan verir; hər sətir ayrıca `{az,en,ru}` obyektidir və
//   `tf()` cari dili seçir.
//
// ⚠ İKON ADLARI `js/icon-set.js`-dəki `ICONS` reyestrindən olmalıdır.
//   EMOJİ İŞLƏDİLMİR: platformadan asılıdır, `currentColor`-a tabe deyil və
//   dörd temanın heç birinə uyğunlaşmır.
//
// ⚠ TEXNOLOGİYA SİYAHISI UYDURULMAYIB — `wrangler deploy` çıxışındakı REAL
//   binding-lərdir. Yeni binding əlavə olunanda bu siyahı da yenilənməlidir.

export const ABOUT = {
  lead: {
    az: 'Collabix — proqramlaşdırma və xarici dilləri birlikdə öyrənmək istəyən 18+ istifadəçilər üçün icma platformasıdır. Tək öyrənmək yavaş və tənhadır; icma içində isə sual vermək, kod paylaşmaq və davam etmək asanlaşır. Platforma məhz bunun üçün qurulub.',
    en: 'Collabix is a community platform for people 18+ who want to learn programming and languages together. Learning alone is slow and lonely; in a community it becomes easier to ask, to share code and to keep going. That is what this platform is built for.',
    ru: 'Collabix — платформа-сообщество для людей 18+, которые хотят изучать программирование и языки вместе. Учиться в одиночку медленно и одиноко; в сообществе проще спросить, поделиться кодом и не бросить. Ради этого платформа и создана.',
  },

  modulesTitle: { az: 'Platforma nədən ibarətdir', en: 'What the platform is made of', ru: 'Из чего состоит платформа' },
  modulesLead: {
    az: 'Collabix bir-birinə bağlı bir neçə moduldan ibarətdir. Aşağıda hər birinin nə etdiyi göstərilib.',
    en: 'Collabix consists of several connected modules. Here is what each of them does.',
    ru: 'Collabix состоит из нескольких связанных модулей. Ниже — что делает каждый.',
  },
  modules: [
    {
      icon: 'hash',
      t: { az: 'Otaqlar', en: 'Rooms', ru: 'Комнаты' },
      d: {
        az: 'Mövzu üzrə real vaxtlı söhbət otaqları: dil praktikası, proqramlaşdırma dilləri, ümumi müzakirə. Sabitlənmiş mesajlar, reaksiyalar, cavab zəncirləri, fayl və sintaksis rəngləməli kod paylaşımı.',
        en: 'Topic-based real-time chat rooms: language practice, programming languages, general discussion. Pinned messages, reactions, reply threads, file sharing and syntax-highlighted code.',
        ru: 'Тематические чат-комнаты в реальном времени: языковая практика, языки программирования, общие обсуждения. Закреплённые сообщения, реакции, ветки ответов, файлы и код с подсветкой.',
      },
    },
    {
      icon: 'message',
      t: { az: 'Birbaşa mesajlar', en: 'Direct messages', ru: 'Личные сообщения' },
      d: {
        az: 'Study-partner və ya mentorla təkbətək yazışma — otaqlarla eyni redaktor: kod blokları, fayllar, reaksiyalar və oxunma vəziyyəti.',
        en: 'One-to-one conversations with a study partner or mentor — the same editor as rooms: code blocks, files, reactions and read state.',
        ru: 'Личная переписка с партнёром по учёбе или ментором — тот же редактор, что и в комнатах: блоки кода, файлы, реакции и статус прочтения.',
      },
    },
    {
      icon: 'type',
      t: { az: 'Lent', en: 'Feed', ru: 'Лента' },
      d: {
        az: 'İcma paylaşımları: mətn, kod, şəkil və sorğular. Şərhlər, reaksiyalar, link önizləməsi, sıralama (ən yeni / bəyənilən / trending) və paylaşımı planlaşdırma.',
        en: 'Community posts: text, code, images and polls. Comments, reactions, link previews, sorting (newest / liked / trending) and post scheduling.',
        ru: 'Публикации сообщества: текст, код, изображения и опросы. Комментарии, реакции, превью ссылок, сортировка (новое / популярное / в тренде) и отложенная публикация.',
      },
    },
    {
      icon: 'tasks',
      t: { az: 'Tapşırıqlar', en: 'Tasks', ru: 'Задания' },
      d: {
        az: 'Praktik çalışmalar — oxumaqdan yazmağa keçid. Həll göndərilir, yoxlanılır və XP ilə mükafatlandırılır.',
        en: 'Practical exercises — the step from reading to writing. You submit a solution, it gets reviewed, and it earns XP.',
        ru: 'Практические упражнения — переход от чтения к написанию кода. Решение отправляется, проверяется и приносит XP.',
      },
    },
    {
      icon: 'users',
      t: { az: 'Komandalar', en: 'Teams', ru: 'Команды' },
      d: {
        az: 'Birgə layihələr üçün ayrıca iş sahəsi: rol əsaslı icazələr, layihə və tapşırıq idarəsi, komandanın öz lenti, faylları və söhbəti.',
        en: 'A separate workspace for joint projects: role-based permissions, project and task management, the team’s own feed, files and chat.',
        ru: 'Отдельное пространство для совместных проектов: права по ролям, управление проектами и задачами, собственная лента, файлы и чат команды.',
      },
    },
    {
      icon: 'zap',
      t: { az: 'XP, səviyyə və seriya', en: 'XP, levels and streaks', ru: 'XP, уровни и серии' },
      d: {
        az: 'Fəaliyyət XP qazandırır, XP səviyyə açır. Gündəlik seriya və aktivlik xəritəsi davamlılığı görünən edir — əsas məqsəd yarış deyil, vərdiş.',
        en: 'Activity earns XP, XP unlocks levels. A daily streak and activity map make consistency visible — the point is the habit, not the competition.',
        ru: 'Активность приносит XP, XP открывает уровни. Ежедневная серия и карта активности делают регулярность заметной — цель в привычке, а не в соревновании.',
      },
    },
    {
      icon: 'shield',
      t: { az: 'Moderasiya və təhlükəsizlik', en: 'Moderation and safety', ru: 'Модерация и безопасность' },
      d: {
        az: '18+ icma, şikayət sistemi, moderator namizədliyi və admin paneli. Sessiya idarəsi, sorğu limitləri və bot qoruması platformanın bir hissəsidir.',
        en: 'An 18+ community, a reporting system, moderator applications and an admin panel. Session management, rate limiting and bot protection are part of the platform.',
        ru: 'Сообщество 18+, система жалоб, заявки в модераторы и админ-панель. Управление сессиями, лимиты запросов и защита от ботов — часть платформы.',
      },
    },
    {
      icon: 'search',
      t: { az: 'Axtarış və kəşf', en: 'Search and discovery', ru: 'Поиск и навигация' },
      d: {
        az: 'İstifadəçi, paylaşım və otaqlar üzrə tam mətn axtarışı; sahə üzrə filtrlər və populyar mövzular yeni gələni bir neçə klikdə lazım olan yerə aparır.',
        en: 'Full-text search across people, posts and rooms; field filters and popular topics get a newcomer to the right place in a few clicks.',
        ru: 'Полнотекстовый поиск по людям, публикациям и комнатам; фильтры по направлениям и популярные темы приводят новичка куда нужно за пару кликов.',
      },
    },
  ],

  techTitle: { az: 'Nəyin üzərində işləyir', en: 'What it runs on', ru: 'На чём это работает' },
  techLead: {
    az: 'Collabix tam şəkildə Cloudflare-in edge infrastrukturunda işləyir — ayrıca server saxlanılmır, kod istifadəçiyə ən yaxın nöqtədə icra olunur.',
    en: 'Collabix runs entirely on Cloudflare’s edge infrastructure — there is no server to maintain; the code executes at the point closest to the user.',
    ru: 'Collabix полностью работает на edge-инфраструктуре Cloudflare — отдельный сервер не поддерживается, код выполняется в ближайшей к пользователю точке.',
  },
  tech: [
    { k: 'Workers', v: { az: 'Bütün backend məntiqi — edge runtime', en: 'All backend logic — edge runtime', ru: 'Вся серверная логика — edge-среда' } },
    { k: 'D1', v: { az: 'Əsas verilənlər bazası (SQLite)', en: 'Primary database (SQLite)', ru: 'Основная база данных (SQLite)' } },
    { k: 'R2', v: { az: 'Fayl və media saxlancı', en: 'File and media storage', ru: 'Хранилище файлов и медиа' } },
    { k: 'KV', v: { az: 'Sessiyalar və qısamüddətli keş', en: 'Sessions and short-lived cache', ru: 'Сессии и краткоживущий кеш' } },
    { k: 'Durable Objects', v: { az: 'Real vaxtlı çat, onlayn statusu, sorğu limitləri', en: 'Real-time chat, presence, rate limiting', ru: 'Чат в реальном времени, статус онлайн, лимиты' } },
    { k: 'Vectorize', v: { az: 'Semantik axtarış indeksi', en: 'Semantic search index', ru: 'Индекс семантического поиска' } },
    { k: 'Queues + Workflows', v: { az: 'Fon işləri: bildirişlər, arxivləşdirmə', en: 'Background jobs: notifications, archiving', ru: 'Фоновые задачи: уведомления, архивация' } },
  ],

  valuesTitle: { az: 'Nəyə əsaslanırıq', en: 'What we stand on', ru: 'На чём мы стоим' },
  values: [
    {
      icon: 'globe',
      t: { az: 'Açıqlıq', en: 'Openness', ru: 'Открытость' },
      d: {
        az: 'Hər səviyyədən öyrənənə hörmət. "Sadə sual" deyə bir şey yoxdur — interfeys üç dildə (AZ / EN / RU) işləyir ki, dil maneə olmasın.',
        en: 'Respect for learners at every level. There is no such thing as a "basic question" — the interface works in three languages (AZ / EN / RU) so language is not a barrier.',
        ru: 'Уважение к учащимся любого уровня. «Глупых вопросов» не бывает — интерфейс работает на трёх языках (AZ / EN / RU), чтобы язык не был преградой.',
      },
    },
    {
      icon: 'lock',
      t: { az: 'Təhlükəsizlik', en: 'Safety', ru: 'Безопасность' },
      d: {
        az: '18+ icma, şəffaf moderasiya və şikayət yolu. Məlumatlarınızı ixrac edə, hesabınızı silə bilərsiniz — bu, sonradan əlavə edilən deyil, əsas funksiyadır.',
        en: 'An 18+ community, transparent moderation and a clear reporting path. You can export your data and delete your account — that is a core feature, not an afterthought.',
        ru: 'Сообщество 18+, прозрачная модерация и понятный путь жалобы. Вы можете выгрузить свои данные и удалить аккаунт — это базовая функция, а не дополнение.',
      },
    },
    {
      icon: 'flame',
      t: { az: 'Davamlılıq', en: 'Consistency', ru: 'Регулярность' },
      d: {
        az: 'Kiçik gündəlik addım böyük, amma bir dəfəlik cəhddən güclüdür. XP, seriya və aktivlik xəritəsi məhz bunu — davam etməyi — mükafatlandırır.',
        en: 'A small daily step beats one big burst. XP, streaks and the activity map are built to reward exactly that: showing up again.',
        ru: 'Маленький ежедневный шаг сильнее одного большого рывка. XP, серии и карта активности вознаграждают именно это — возвращаться снова.',
      },
    },
  ],

  teamTitle: { az: 'Komanda', en: 'Team', ru: 'Команда' },
  team: {
    az: 'Collabix hazırda müstəqil, tək nəfərlik layihədir — Tahmaz Muradov (fərdi sahibkar) tərəfindən qurulur və idarə olunur. Platforma istifadəçi rəyləri əsasında inkişaf etdirilir; komanda böyüdükcə bu bölmə real adlarla yenilənəcək.',
    en: 'Collabix is currently an independent, one-person project — built and run by Tahmaz Muradov (sole proprietor). The platform evolves from user feedback; as the team grows, this section will be updated with real names.',
    ru: 'Collabix сейчас — независимый проект одного человека, который создаёт и ведёт Тахмаз Мурадов (индивидуальный предприниматель). Платформа развивается на основе отзывов; по мере роста команды этот раздел будет дополнен.',
  },

  // ⚠ CTA mətni BURADA DEYİL, `js/i18n.js`-dədir (`about.ctaTitle` /
  //   `about.ctaText`). Səbəb: CTA bloku `index.html`-də STATİKDİR və
  //   `data-i18n` ilə işarələnib — belə olanda build vaxtı ön-doldurulur
  //   (SEO/FCP) və `applyI18n` onu avtomatik yeniləyir. Mətni həm burada,
  //   həm orada saxlamaq iki mənbə, yəni ayrılma riski demək idi.
};
