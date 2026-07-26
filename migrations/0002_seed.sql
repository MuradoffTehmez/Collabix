-- Default məzmun: taksonomiya, ümumi otaq, FAQ, rəylər
INSERT OR IGNORE INTO rooms (id, name, created_by, created_at) VALUES ('general', 'ümumi', 'system', 0);

INSERT OR IGNORE INTO taxonomies (type, id, label, color, icon, highlight_id, sort_order, active) VALUES
 ('prog','python','Python','#3776ab','🐍','python',1,1),
 ('prog','javascript','JavaScript','#f7df1e','⚡','javascript',2,1),
 ('prog','typescript','TypeScript','#3178c6','🔷','typescript',3,1),
 ('prog','cpp','C++','#659ad2','⚙️','cpp',4,1),
 ('prog','csharp','C#','#68217a','♯','csharp',5,1),
 ('prog','java','Java','#e76f00','☕','java',6,1),
 ('prog','go','Go','#00add8','🐹','go',7,1),
 ('prog','rust','Rust','#dea584','🦀','rust',8,1),
 ('prog','php','PHP','#777bb4','🐘','php',9,1),
 ('prog','kotlin','Kotlin','#7f52ff','🅺','kotlin',10,1),
 ('prog','swift','Swift','#f05138','🕊','swift',11,1),
 ('prog','sql','SQL','#e38c00','🗄','sql',12,1),
 ('prog','htmlcss','HTML/CSS','#e34c26','🎨','xml',13,1),
 ('prog','bash','Bash','#4eaa25','💲','bash',14,1),
 ('prog','arduino','Arduino/C','#00979d','🔌','c',15,1);

INSERT OR IGNORE INTO taxonomies (type, id, label, flag, sort_order, active) VALUES
 ('spoken','ingilis','İngilis','🇬🇧',1,1),
 ('spoken','alman','Alman','🇩🇪',2,1),
 ('spoken','rus','Rus','🇷🇺',3,1),
 ('spoken','fransiz','Fransız','🇫🇷',4,1),
 ('spoken','ispan','İspan','🇪🇸',5,1),
 ('spoken','ereb','Ərəb','🇸🇦',6,1),
 ('spoken','turk','Türk','🇹🇷',7,1),
 ('spoken','cin','Çin','🇨🇳',8,1);

INSERT OR IGNORE INTO faqs (id, q, a, category, sort_order, active, created_at) VALUES
 ('reg1','{"az":"Qeydiyyat pulludur?","en":"Is registration paid?","ru":"Регистрация платная?"}','{"az":"Xeyr, Collabix tam pulsuzdur.","en":"No, Collabix is completely free.","ru":"Нет, Collabix полностью бесплатен."}','account',1,1,0),
 ('reg2','{"az":"Email tələb olunur?","en":"Do I need an email?","ru":"Нужен ли email?"}','{"az":"Xeyr — yalnız istifadəçi adı və şifrə kifayətdir.","en":"No — just a username and password.","ru":"Нет — достаточно имени пользователя и пароля."}','account',2,1,0),
 ('age','{"az":"Neçə yaşdan qoşulmaq olar?","en":"What is the minimum age?","ru":"С какого возраста можно?"}','{"az":"Platforma yalnız 18 yaşdan yuxarı istifadəçilər üçündür.","en":"The platform is for users 18 and older only.","ru":"Платформа только для пользователей 18+."}','account',3,1,0),
 ('sec1','{"az":"Şifrəm təhlükəsizdirmi?","en":"Is my password safe?","ru":"Мой пароль в безопасности?"}','{"az":"Şifrələr PBKDF2 ilə heşlənmiş saxlanılır — heç kim onları görə bilmir.","en":"Passwords are stored hashed with PBKDF2 — nobody can see them.","ru":"Пароли хранятся в хешированном виде (PBKDF2)."}','security',4,1,0),
 ('use1','{"az":"XP və nişanlar necə qazanılır?","en":"How do I earn XP and badges?","ru":"Как заработать XP и бейджи?"}','{"az":"Post paylaş (+10), şərh yaz (+5), tapşırıq həllin təsdiqlənsin (+50).","en":"Share posts (+10), comment (+5), get task solutions approved (+50).","ru":"Посты (+10), комментарии (+5), одобренные решения (+50)."}','usage',5,1,0),
 ('use2','{"az":"Seriya (🔥) necə işləyir?","en":"How do streaks work?","ru":"Как работает серия?"}','{"az":"Hər gün aktiv olsan seriya artır; bir gün ötürsən sıfırlanır.","en":"Be active daily to grow your streak; missing a day resets it.","ru":"Будьте активны каждый день; пропуск обнуляет серию."}','usage',6,1,0);

INSERT OR IGNORE INTO testimonials (id, author_name, author_title, text, rating, featured, approved, created_at) VALUES
 ('t1','Aysel M.','{"az":"Python öyrənən","en":"Python learner","ru":"Изучает Python"}','{"az":"Study-partner tapmaq heç vaxt bu qədər asan olmamışdı 🔥","en":"Finding a study partner was never this easy 🔥","ru":"Найти партнёра по учёбе никогда не было так просто 🔥"}',5,1,1,0),
 ('t2','Rauf H.','{"az":"Frontend developer","en":"Frontend developer","ru":"Frontend-разработчик"}','{"az":"Kod bloklarının highlighting-i və tapşırıq sistemi əladır.","en":"Code highlighting and the task system are great.","ru":"Подсветка кода и система заданий — отлично."}',5,1,1,0),
 ('t3','Nigar Q.','{"az":"İngilis dili həvəskarı","en":"English enthusiast","ru":"Изучает английский"}','{"az":"Dil otaqlarında hər gün praktika edirəm. İcma çox dəstəkləyicidir!","en":"I practice daily in the language rooms!","ru":"Практикуюсь каждый день в языковых комнатах!"}',4,1,1,0);
