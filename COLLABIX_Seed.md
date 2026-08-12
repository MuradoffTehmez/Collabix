# COLLABIX — 15 GÜNLÜK REALİSTİK SİNTETİK DEMO MƏLUMAT SİSTEMİ

Sən bu tapşırıqda **Senior Backend Engineer + Database Architect + QA Engineer + Product Data Engineer + UX Data Specialist** kimi fəaliyyət göstər.

Məqsədim Collabix saytının **bütün bölmələrinin boş görünməməsi**, bütün funksiyaların real məhsul kimi işləməsinin yoxlanılması və frontend/backend UI-nin real istifadəyə yaxın məlumatlarla test edilməsidir.

Bunun üçün Collabix sisteminə **tamamilə sintetik, lakin real görünüşlü və bir-biri ilə əlaqəli demo məlumatları** yarat.

---

# 1. ƏSAS QAYDA

Yaradılan bütün məlumatlar:

- sintetik olmalıdır;
- real şəxslərə aid olmamalıdır;
- real şəxslərin şəxsi məlumatlarından istifadə edilməməlidir;
- real email hesabları istifadə edilməməlidir;
- real telefon nömrələri istifadə edilməməlidir;
- real insanların sosial media hesabları istifadə edilməməlidir;
- məlumatlar yalnız development/test/demo məqsədli olmalıdır.

Amma məlumatlar **real istifadəçi davranışını imitasiya etməlidir**.

Məqsəd:

> Sayta daxil olan şəxs məlumatlara baxanda bunun boş `seed database` deyil, 15 gün ərzində aktiv istifadə edilmiş real bir platformanın demo mühiti olduğunu hiss etməlidir.

---

# 2. İLK ADDIM — COLLABIX-İ TAM ARAŞDIR

Əvvəlcə repository-ni və tətbiqin bütün strukturunu analiz et.

GitHub:

https://github.com/MuradoffTehmez/Collabix

Wiki:

https://github.com/MuradoffTehmez/Collabix/wiki

Əvvəlcə müəyyənləşdir:

- database schema;
- bütün tables;
- bütün relations;
- frontend pages;
- backend API;
- authentication;
- profiles;
- posts;
- comments;
- replies;
- likes;
- saves;
- reposts;
- notifications;
- messages;
- projects;
- teams;
- tasks;
- learning;
- categories;
- XP;
- leaderboard;
- files;
- search;
- settings;
- admin;
- analytics;
- digər mövcud modullar.

**Repository-də mövcud olmayan modul üçün özbaşına database strukturu yaratma.**

Əvvəlcə mövcud sistemə uyğunlaş.

---

# 3. DATA GENERATION STRATEGY

Sadəcə 100 istifadəçi yaratmaq kifayət deyil.

Məlumatlar bir-biri ilə əlaqəli olmalıdır.

Məsələn:

```text
User
 ↓
Profile
 ↓
Posts
 ↓
Comments
 ↓
Replies
 ↓
Likes
 ↓
Saves
 ↓
Reposts
 ↓
Notifications
 ↓
Messages
 ↓
Projects
 ↓
Tasks
 ↓
XP
 ↓
Leaderboard
```

Bütün əlaqələr real foreign key-lərlə qurulmalıdır.

---

# 4. İSTİFADƏÇİLƏR

Minimum:

## 100 sintetik istifadəçi

Tövsiyə olunan:

## 150–250 istifadəçi

İstifadəçiləri müxtəlif davranış qruplarına böl.

### Group A — Highly Active

15–20 istifadəçi.

Demək olar ki, hər gün aktivdir.

### Group B — Active

30–50 istifadəçi.

Həftənin böyük hissəsində aktivdir.

### Group C — Normal

50–100 istifadəçi.

Müəyyən günlərdə aktivdir.

### Group D — Low Activity

Qalan istifadəçilər.

Az aktivdir.

Bu vacibdir.

Çünki bütün istifadəçilər hər gün aktiv olarsa məlumatlar süni görünəcək.

---

# 5. USERNAME-LƏR

Username-lər real görünməlidir.

Azərbaycanlı istifadəçi adlarından istifadə edə bilərsən, məsələn:

```text
ali.mammadov
nigar.aliyeva
elvin.huseynov
aysel.mehdiyeva
kamran.hasanli
leyla.ismayilova
murad.rahimli
zəhra...
```

Lakin:

**REAL ŞƏXSLƏRİ KOPYALAMA.**

Ad + soyad kombinasiyalarını sintetik şəkildə yarat.

Username-lər:

- unikal;
- oxunaqlı;
- real məhsulda istifadə edilə bilən;
- Azərbaycan və beynəlxalq istifadəçilərin qarışığından ibarət olsun.

Məsələn:

```text
turan.dev
ayla.codes
kamran.dev
nermin.ui
elvin.backend
orxan.cloud
sara.design
muradsec
```

---

# 6. PROFİLLƏR

Hər istifadəçiyə uyğun:

- first_name;
- last_name;
- username;
- bio;
- profession;
- skills;
- location;
- avatar;
- joined date;
- XP;
- reputation;
- activity statistics

yarat.

Bio-lar təkrarlanmasın.

Məsələn:

> Backend developer focused on distributed systems and API architecture.

və ya:

> UI/UX designer interested in accessible digital products.

Azərbaycan dilində istifadəçilər də olsun.

---

# 7. AVATARLAR

Avatarlar:

- real insan fotoşəkillərindən götürülməməlidir;
- copyright problemi yaratmamalıdır;
- mümkün olduqda generated/avatar placeholder istifadə edilməlidir.

Əgər sistem remote avatar URL tələb edirsə, development üçün etibarlı placeholder mexanizmi istifadə et.

Əgər lokal storage tələb edirsə, sintetik avatar faylları yarat.

---

# 8. 15 GÜNLÜK AKTİVLİK

Mütləq:

## SON 15 GÜN

üzrə activity yarat.

Tarixləri sistemin mövcud tarixindən hesabla.

Statik tarixlər yazma.

Əgər bu gün:

**2026-08-11**

dirsə:

```text
Day 01 → 2026-07-28
Day 02 → 2026-07-29
...
Day 15 → 2026-08-11
```

Əgər seed başqa tarixdə işlədilirsə, tarixlər avtomatik həmin tarixdən hesablanmalıdır.

---

# 9. GÜNLÜK AKTİVLİK

Hər gün eyni sayda əməliyyat yaratma.

Real davranış yarat.

Məsələn:

```text
Day 1  →  activity
Day 2  →  low activity
Day 3  →  high activity
Day 4  →  medium
Day 5  →  low
Day 6  →  high
...
```

Həftəsonu və iş günləri arasında da müəyyən fərq yaradıla bilər.

---

# 10. LOGIN / SESSION ACTIVITY

Əgər sistemdə bu məlumatlar varsa:

- login;
- logout;
- last_seen;
- session;
- online status;

realistik şəkildə yarat.

Məsələn:

Highly Active user:

```text
login
→ browse
→ post
→ comment
→ notification
→ message
→ logout
```

---

# 11. POSTS

Minimum:

## 300–500 post

və ya mövcud database limitlərinə uyğun real həcm.

Postlar müxtəlif mövzularda olsun:

- programming;
- C#;
- JavaScript;
- TypeScript;
- Python;
- AI;
- cybersecurity;
- databases;
- Cloud;
- DevOps;
- UI/UX;
- career;
- education;
- projects;
- technology;
- Azerbaijan tech community.

Postların hamısı eyni uzunluqda olmasın.

Bəziləri:

- qısa;
- orta;
- uzun;
- sual;
- müzakirə;
- announcement;
- tutorial;
- opinion;
- technical problem

olsun.

---

# 12. POSTS TARİXLƏRİ

Postlar 15 günə yayılmalıdır.

Bütün postları eyni gündə yaratma.

Məsələn:

```text
Day 1 → 12 posts
Day 2 → 19 posts
Day 3 → 7 posts
Day 4 → 25 posts
...
```

---

# 13. COMMENTS

Minimum:

## 1000+ comment

Əgər sistem performans baxımından uyğundursa daha çox yarat.

Comment-lər postlarla əlaqəli olmalıdır.

**Random comment yaratma.**

Məsələn post:

> “PostgreSQL və SQL Server arasında hansı hallarda seçim edirsiniz?”

Comment:

> “Transactional workload üçün SQL Server-in tooling tərəfi mənə daha rahat gəlir...”

kimi kontekstual olsun.

---

# 14. COMMENT REPLIES

Əgər sistem dəstəkləyirsə:

Minimum:

## 200–400 reply

Reply-lər:

- comment-lərə;
- digər reply-lərə;
- mention-lara

bağlansın.

Conversation thread-lər yaransın.

---

# 15. LIKES

Post və comment-lərə realistik like paylanması yarat.

Məsələn:

```text
Popular post → 80 likes
Normal post → 15 likes
New post → 2 likes
Low-interest → 0 likes
```

Hər postun eyni sayda like-ı olmasın.

---

# 16. SAVES

İstifadəçilər faydalı postları save etsin.

Məsələn:

- tutorial;
- code snippets;
- career tips;
- security;
- database;
- AI.

---

# 17. REPOST / SHARE

Əgər sistemdə repost varsa:

Müəyyən postlar repost edilsin.

Original author və repost edən user düzgün əlaqələndirilsin.

---

# 18. FOLLOW / CONNECTIONS

Əgər sistemdə follow/friend/connection mexanizmi varsa:

Realistic social graph yarat.

Məsələn:

```text
User A → follows B
User B → follows C
User C → follows A
```

Amma hamı hamını follow etməsin.

Network müxtəlifliyi qorunsun.

---

# 19. NOTIFICATIONS

Notifications tam realistik olsun.

Minimum:

- like;
- comment;
- reply;
- mention;
- follow;
- repost;
- task;
- project;
- system notification.

Unread/read statusları qarışıq olsun.

Məsələn:

```text
Unread → 3
Read → 12
```

---

# 20. MESSAGES

Əgər messaging sistemi varsa:

Minimum:

## 100–300 conversation

yarat.

Conversation-lar:

- 1:1;
- group chat

ola bilər.

Mesajlar kontekstual olsun.

Random:

> hello

tipli yüzlərlə mesaj yaratma.

Məsələn:

> “API endpoint-in validation hissəsinə baxdım. DTO tərəfdə əlavə constraint lazımdır.”

---

# 21. PROJECTS

Əgər project sistemi varsa:

Minimum:

## 20–40 project

yarat.

Layihələr müxtəlif sahələrdə olsun:

- Web;
- Mobile;
- AI;
- Cloud;
- Cybersecurity;
- Education;
- Open Source.

Hər project-də:

- owner;
- members;
- description;
- status;
- created_at;
- activity

olsun.

---

# 22. TEAM TASKS

Əgər `team_tasks` və ya analoji modul varsa:

Minimum:

## 200–500 task

yarat.

Task statusları real şəkildə bölünsün:

```text
To Do
In Progress
Review
Done
```

Deadline-lar:

- keçmiş;
- bugünkü;
- gələcək

ola bilər.

Amma bütün task-ları Done etmə.

---

# 23. LEARNING / TASK PLATFORM

Əgər Collabix-də learning/task sistemi varsa:

Müxtəlif kateqoriyalar yarat:

- Programming;
- Algorithms;
- Database;
- Cybersecurity;
- Web;
- Cloud;
- DevOps.

Task-lar:

- pending;
- approved;
- submitted;
- reviewed;
- completed

və sistemdə mövcud olan digər statuslarla uyğunlaşdırılsın.

---

# 24. XP SYSTEM

Əgər XP sistemi varsa:

İstifadəçi fəaliyyətlərinə uyğun XP hesabla.

Məsələn:

```text
Post
Comment
Like
Task completed
Learning task
Project activity
Contribution
```

XP təsadüfi rəqəm kimi yazılmamalıdır.

Mümkündürsə:

**activity → XP**

məntiqi ilə hesablansın.

---

# 25. LEADERBOARD

Leaderboard real activity əsasında formalaşsın.

Ən aktiv istifadəçilər yuxarıda olsun.

Məsələn:

```text
#1 user
#2 user
#3 user
...
```

Leaderboard ilə XP məlumatları arasında consistency təmin et.

---

# 26. PROFILE STATISTICS

Profil səhifəsində görünən statistikalar database ilə uyğun olmalıdır.

Məsələn:

```text
Posts: 37
Comments: 142
Followers: 82
Following: 54
Likes received: 391
XP: 4,280
Projects: 6
Tasks completed: 24
```

Bu rəqəmləri ayrıca random yazma.

**Real database relation-larından hesabla.**

---

# 27. SEARCH

Əgər search sistemi varsa, müxtəlif nəticələr qaytaracaq məlumat yarat.

Search edilə biləcək:

- user;
- post;
- project;
- task;
- category;
- tag.

---

# 28. TAGS

Postlara uyğun tag-lər əlavə et.

Məsələn:

```text
#csharp
#dotnet
#python
#javascript
#typescript
#sql
#cloud
#security
#ai
#devops
```

Tag-lərin sayı və populyarlığı realistik olsun.

---

# 29. ADMIN / MODERATION

Əgər admin panel varsa:

Məlumat yarat:

- reports;
- flagged posts;
- moderation actions;
- user status;
- audit logs.

Amma bütün istifadəçiləri problemli göstərmə.

Normal platforma davranışı yarat.

---

# 30. FILES

Əgər file upload sistemi varsa:

Sintetik fayllar yarat:

- PDF;
- TXT;
- PNG;
- JPG;
- code files.

Fayllar layihə/post/message ilə əlaqəli olsun.

Məsələn:

```text
api-design.pdf
database-schema.png
project-readme.md
security-checklist.pdf
```

---

# 31. DATA CONSISTENCY

ƏN VACİB TƏLƏB.

Bütün məlumatlar arasında consistency yoxla.

Məsələn:

Əgər user-in profile-də:

```text
Posts: 37
```

göstərilirsə,

database-də həqiqətən həmin user-ə aid 37 post olmalıdır.

Əgər:

```text
Followers: 82
```

göstərilirsə,

həqiqətən 82 əlaqə olmalıdır.

Əgər leaderboard:

```text
XP = 4280
```

göstərirsə,

XP sistemi ilə uyğun gəlməlidir.

---

# 32. TEMPORAL CONSISTENCY

Tarixlər məntiqli olmalıdır.

Məsələn:

```text
user.created_at
```

tarixindən əvvəl:

- post;
- comment;
- login;
- project

yaratma.

Project member olmadan project task yaratma.

Post mövcud olmadan comment yaratma.

Comment mövcud olmadan reply yaratma.

---

# 33. REALİSTİK DAVRANIŞ

İstifadəçilərin hamısı eyni davranmasın.

Məsələn:

### Developer

çox:

- code post;
- technical comment;
- project;
- task

etsin.

### Designer

çox:

- UI/UX post;
- design project;
- visual discussion

etsin.

### Student

çox:

- learning task;
- question;
- educational post

etsin.

### Security specialist

çox:

- cybersecurity;
- vulnerability;
- security discussion

etsin.

---

# 34. LANGUAGE DISTRIBUTION

Azərbaycan bazarını nəzərə al.

Məlumatların əsas hissəsi:

**Azərbaycan dili**

olsun.

Amma müəyyən hissə:

**English**

olsun.

Məsələn:

70% Azerbaijani  
30% English

---

# 35. CONTENT QUALITY

Content:

- təkrarlanmamalıdır;
- mənasız lorem ipsum olmamalıdır;
- “test post 123” olmamalıdır;
- “hello world” spamı olmamalıdır;
- eyni comment yüzlərlə dəfə təkrarlanmamalıdır.

Məlumat real istifadəçi davranışını imitasiya etməlidir.

---

# 36. DATABASE SEED SİSTEMİ

Mümkündürsə ayrıca:

```text
seed/
demo/
fixtures/
scripts/
```

strukturunda seed sistemi yarat.

Əsas məqsəd:

```bash
npm run seed
```

və ya repository-də mövcud uyğun command vasitəsilə bütün demo məlumatların yaradılması.

Əgər mövcud seed sistemi varsa, onu pozma.

---

# 37. RESET

Mütləq reset mexanizmi yarat.

Məsələn:

```bash
npm run seed:reset
npm run seed
```

və ya repository-də mövcud mexanizmə uyğun.

Reset:

- yalnız DEMO/TEST məlumatlarını silməlidir;
- real production məlumatlarını silməməlidir.

---

# 38. PRODUCTION TƏHLÜKƏSİZLİYİ

ÇOX VACİB:

Seed script production database-də real istifadəçi məlumatlarını silməməlidir.

Mümkündürsə:

```text
NODE_ENV=development
```

və ya:

```text
DEMO_MODE=true
```

olmadan seed işləməsin.

Production guard əlavə et.

---

# 39. SYNTHETIC EMAILS

Email-lər üçün real email provider istifadə etmə.

Məsələn:

```text
ali.mammadov@example.com
nigar.aliyeva@example.com
```

və ya layihənin development mühitinə uyğun reserved/test domain istifadə et.

Heç bir real email göndərilməməlidir.

---

# 40. PASSWORD-LAR

Bütün demo istifadəçilər üçün eyni sadə password istifadə etmə.

Əgər sistem password hash tələb edirsə:

- password-ları təhlükəsiz hash et;
- seed documentation-da yalnız development password göstər;
- production-a demo password yerləşdirmə.

---

# 41. DEMO ACCOUNTLAR

Ən aktiv 5–10 istifadəçini ayrıca müəyyənləşdir.

Məsələn:

```text
DEMO_USER_01
DEMO_USER_02
DEMO_USER_03
...
```

Amma frontend-də onların username-ləri real görünüşlü olsun.

---

# 42. PERFORMANCE

Əvvəlcə database limitlərini yoxla.

Sonra seed həcmini sistemin:

- D1;
- PostgreSQL;
- MySQL;
- SQLite;
- API;
- Cloudflare;
- storage

strukturuna uyğun seç.

Database-i lazımsız milyonlarla record ilə doldurma.

---

# 43. TEST

Seed-dən sonra avtomatik audit apar.

Yoxla:

- broken foreign keys;
- orphan records;
- duplicate usernames;
- duplicate emails;
- invalid dates;
- invalid references;
- negative counts;
- inconsistent XP;
- inconsistent statistics;
- invalid notifications;
- invalid messages;
- invalid project members;
- invalid tasks.

---

# 44. FRONTEND AUDIT

Seed-dən sonra saytın bütün səhifələrini aç.

Yoxla:

- Home;
- Feed;
- Explore;
- Profile;
- Notifications;
- Messages;
- Projects;
- Tasks;
- Learning;
- Leaderboard;
- Search;
- Settings;
- Admin;
- digər mövcud səhifələr.

Hər səhifə boş görünürsə səbəbini tap.

---

# 45. EMPTY STATE AUDIT

Bəzi səhifələr məqsədli olaraq boş qala bilər.

Amma demo mühitində:

**əsas funksional səhifələr boş qalmamalıdır.**

Əgər səhifə boşdursa:

1. database data çatışmır;
2. query səhvdir;
3. frontend mapping səhvdir;
4. API səhvdir;

hansı olduğunu müəyyənləşdir.

Sadəcə data əlavə etməklə bug-u gizlətmə.

---

# 46. UI REALISM

Frontend aşağıdakıları göstərə bilməlidir:

- real avatarlar;
- usernames;
- timestamps;
- comments;
- likes;
- notifications;
- activity;
- project data;
- tasks;
- XP;
- leaderboard;
- messages.

Bütün bunlar bir-biri ilə əlaqəli görünməlidir.

---

# 47. 15 GÜNLÜK ACTIVITY TIMELINE

Mütləq activity timeline yarat.

Məsələn:

```text
28 Jul
├── Users joined
├── Posts
├── Comments
├── Projects
└── Tasks

29 Jul
├── Posts
├── Comments
└── Messages

...

11 Aug
├── Login
├── Posts
├── Comments
└── Notifications
```

---

# 48. FINAL REPORT

Seed tamamlandıqdan sonra aşağıdakı hesabatı çıxar:

```text
Users:
Posts:
Comments:
Replies:
Likes:
Saves:
Reposts:
Followers:
Notifications:
Messages:
Projects:
Tasks:
Learning Tasks:
Files:
Tags:
Reports:
XP records:
```

Sonra son 15 gün üzrə:

```text
Day 1:
Users active:
Posts:
Comments:
Likes:
Messages:
Tasks:

Day 2:
...
```

---

# 49. ERROR REPORT

Əgər seed zamanı hər hansı xəta çıxarsa:

xətanı gizlətmə.

Yaz:

```text
ERROR
TABLE:
COLUMN:
QUERY:
CAUSE:
IMPACT:
FIX:
```

Problemi düzəlt və yenidən seed et.

---

# 50. ƏN VACİB PRİNSİP

Bu tapşırığın nəticəsində mən:

**“100 istifadəçi + 500 random post”**

istəmirəm.

Mən istəyirəm:

> **15 günlük virtual Collabix istifadəçi ekosistemi.**

İstifadəçilər bir-biri ilə əlaqədə olsun.

Onlar:

- post paylaşsın;
- comment yazsın;
- reply versin;
- like etsin;
- save etsin;
- repost etsin;
- bir-birini izləsin;
- mesajlaşsın;
- project yaratsın;
- project-ə qoşulsun;
- task yaratsın;
- task tamamlasın;
- learning activity etsin;
- XP qazansın;
- leaderboard-da sıralansın;
- notification alsın.

Bütün bunlar **15 günlük zaman xətti daxilində** baş versin.

---

# 51. FINAL ACCEPTANCE CRITERIA

İşi yalnız aşağıdakıların hamısı tamamlandıqdan sonra bitmiş hesab et:

### DATA

☐ Sintetik istifadəçilər yaradılıb  
☐ Username-lər unikaldır  
☐ Profile məlumatları var  
☐ Avatarlar var  
☐ 15 günlük activity var  
☐ Posts var  
☐ Comments var  
☐ Replies var  
☐ Likes var  
☐ Saves var  
☐ Reposts var  
☐ Notifications var  
☐ Messages var  
☐ Projects var  
☐ Tasks var  
☐ Learning data var  
☐ XP var  
☐ Leaderboard var  
☐ Files var  
☐ Tags var  

### CONSISTENCY

☐ Foreign keys düzgündür  
☐ Statistics real record-lardan hesablanır  
☐ XP real activity ilə uyğundur  
☐ Leaderboard düzgündür  
☐ Timestamps məntiqlidir  
☐ Orphan record yoxdur  

### SECURITY

☐ Real şəxsi məlumat yoxdur  
☐ Real email yoxdur  
☐ Real password yoxdur  
☐ Real payment data yoxdur  
☐ Production guard var  
☐ Seed yalnız demo/test mühitində işləyir  

### UI

☐ Home doludur  
☐ Feed doludur  
☐ Profile doludur  
☐ Notifications doludur  
☐ Messages doludur  
☐ Projects doludur  
☐ Tasks doludur  
☐ Learning doludur  
☐ Leaderboard doludur  
☐ Search nəticələri var  
☐ Digər əsas səhifələr doludur  

### FINAL

☐ Seed script işləyir  
☐ Reset işləyir  
☐ Audit keçir  
☐ Error yoxdur  
☐ Documentation hazırlanıb  

---

# SON TƏLƏB

İşə başlamazdan əvvəl repository-ni tam analiz et.

Mənə sadəcə “seed data yaradıldı” demə.

Əvvəl:

**ANALYZE → PLAN → IMPLEMENT → SEED → TEST → AUDIT → FIX → FINAL REPORT**

ardıcıllığını tətbiq et.

Mövcud kodu və database strukturunu lazımsız şəkildə dəyişmə.

Əgər data yaratmaq üçün mövcud backend/API mexanizmləri varsa, mümkün qədər onları istifadə et ki, demo məlumatlar real production flow-dan keçsin.

Əsas məqsəd:

# “Collabix 15 gündür real istifadəçilər tərəfindən aktiv istifadə olunmuş kimi görünməlidir.”

Lakin bütün məlumatlar **100% sintetik və development/demo məqsədli** olmalıdır.


# COLLABIX — REALİSTİK MİQYASLI DEMO DATA / SIMULATION MODE

Əvvəlki 15 günlük synthetic activity tapşırığına bu tələbləri əlavə et.

## ƏSAS MƏQSƏD

Demo mühitində Collabix-in bütün bölmələri **real platforma miqyasında və real istifadə davranışına uyğun** görünməlidir.

Lakin yaradılan bütün məlumatlar açıq şəkildə:

**SYNTHETIC DEMO DATA**

kimi işarələnməlidir.

Heç bir demo göstəricisini real istifadəçi statistikası kimi təqdim etmə.

---

# 1. REALİSTİK MİQYAS

Məlumatların həcmini çox kiçik seçmə.

Demo mühitinin vizual və funksional baxımdan dolu görünməsi üçün aşağıdakı təxmini miqyasdan istifadə et:

### USERS

**500–1,000 synthetic users**

### POSTS

**3,000–7,000 posts**

### COMMENTS

**15,000–35,000 comments**

### REPLIES

**3,000–8,000 replies**

### LIKES

**40,000–100,000 likes**

### SAVES

**8,000–20,000 saves**

### REPOSTS

**3,000–10,000 reposts**

### FOLLOW / CONNECTIONS

**10,000–30,000 relationships**

### NOTIFICATIONS

**30,000–80,000 notifications**

### MESSAGES

**10,000–30,000 messages**

### PROJECTS

**100–300 projects**

### TASKS

**2,000–6,000 tasks**

### LEARNING ACTIVITY

Mövcud sistemin strukturuna uyğun olaraq:

**1,000–5,000 learning/task records**

Bu rəqəmləri repository-dəki real schema və performansa uyğunlaşdır.

Əgər database və frontend bu həcmi rahat daşıya bilmirsə, daha aşağı rəqəm seç.

---

# 2. STATİSTİKİ PAYLANMA

Ən böyük səhv:

bütün istifadəçiləri eyni aktivlikdə yaratmaqdır.

Pareto tipli realistik paylanma istifadə et.

Məsələn:

### 5%

Çox yüksək aktivlik.

### 15%

Yüksək aktivlik.

### 30%

Orta aktivlik.

### 30%

Aşağı aktivlik.

### 20%

Çox aşağı / passiv aktivlik.

Beləliklə istifadəçi activity distribution təbii görünsün.

---

# 3. DAILY ACTIVE USERS

15 gün ərzində bütün istifadəçilər aktiv olmasın.

Məsələn:

```text
Day 01 → 82 active users
Day 02 → 117
Day 03 → 96
Day 04 → 143
Day 05 → 131
Day 06 → 74
Day 07 → 68
Day 08 → 152
Day 09 → 161
Day 10 → 139
Day 11 → 176
Day 12 → 121
Day 13 → 83
Day 14 → 155
Day 15 → 192
```

Bu rəqəmləri sadəcə kopyalama.

Seed zamanı **randomized but statistically controlled distribution** yarat.

---

# 4. DAU / WAU / MAU

Əgər analytics sistemi varsa, aşağıdakı göstəriciləri database activity-dən hesablamaq mümkün olmalıdır:

* DAU;
* WAU;
* MAU;
* new users;
* returning users;
* posts/day;
* comments/day;
* engagement rate;
* retention.

Bu rəqəmləri ayrıca hard-code etmə.

**Raw activity records → aggregation → analytics**

prinsipindən istifadə et.

---

# 5. GÜNLÜK POST HƏCMİ

Postlar belə paylana bilər:

```text
Low activity day
→ 80–120 posts

Normal day
→ 150–300 posts

High activity day
→ 300–500 posts
```

Amma bütün günlər eyni olmamalıdır.

---

# 6. ENGAGEMENT

Postların hamısı viral olmamalıdır.

Məsələn:

### Viral

100+ interaction

### Popular

40–100

### Normal

10–40

### Low

1–10

### No engagement

0–2

Bu paylanmanı realistik random distribution ilə yarat.

---

# 7. USER BEHAVIOR MODEL

Hər istifadəçi üçün ayrıca davranış profili yarat.

Məsələn:

```text
POWER_USER
ACTIVE_CONTRIBUTOR
TECHNICAL_USER
LEARNER
PROJECT_MANAGER
DESIGNER
CASUAL_USER
READER
PASSIVE_USER
```

Sonra fəaliyyətləri həmin profilə uyğun yarat.

---

# 8. REALİSTİK SOCIAL GRAPH

İstifadəçilər arasında random əlaqələr yaratmaq kifayət deyil.

Community clusters yarat.

Məsələn:

```text
Software Development
        ↓
Backend Developers
        ↓
C# / .NET
        ↓
Database
```

və:

```text
Frontend
 ↓
React
 ↓
TypeScript
 ↓
UI/UX
```

və:

```text
Cybersecurity
 ↓
Network Security
 ↓
Cloud Security
```

İstifadəçilər maraq sahələrinə uyğun bir-biri ilə əlaqələndirilsin.

---

# 9. CONTENT DISTRIBUTION

Məzmunun böyük hissəsi proqramlaşdırma və texnologiya mövzularında olsun.

Məsələn:

```text
Programming      20%
Web Development  15%
Backend          10%
Frontend         10%
AI               10%
Cybersecurity    10%
Database          8%
Cloud             7%
DevOps            5%
UI/UX             5%
Career/Education  5%
```

Bu faizləri sistemə uyğun dəyişmək olar.

---

# 10. CONTENT RECENCY

Feed-də:

* çox yeni;
* yeni;
* orta yaşlı;
* köhnə

postlar qarışıq görünsün.

Bütün postlar son saatlarda yaradılmış kimi görünməsin.

15 günlük timeline qorunsun.

---

# 11. PROFILE REALISM

İstifadəçi profillərində statistikalar activity ilə uyğun olsun.

Məsələn:

```text
Posts
Comments
Likes received
Followers
Following
Projects
Tasks
XP
```

Bu məlumatları ayrıca random rəqəm kimi yazma.

Database relation-larından hesabla.

---

# 12. XP DISTRIBUTION

XP aşağıdakı kimi paylansın:

```text
Passive users
→ 0–500 XP

Normal
→ 500–2,000 XP

Active
→ 2,000–5,000 XP

Power users
→ 5,000–15,000 XP
```

Əgər Collabix-in real XP qaydaları fərqlidirsə, həmin qaydalara üstünlük ver.

---

# 13. LEADERBOARD

Leaderboard:

* activity;
* XP;
* contributions

ilə əlaqəli olsun.

Top istifadəçilər sistemdə ən çox fəaliyyət göstərən istifadəçilərdən formalaşmalıdır.

---

# 14. NOTIFICATION VOLUME

Notification-lar activity-dən törəsin.

Məsələn:

```text
Like
Comment
Reply
Mention
Follow
Repost
Task
Project
System
```

İstifadəçi activity etmədən onun notification sayı yüksək olmasın.

---

# 15. MESSAGES

Mesajlar da social graph ilə əlaqəli olsun.

Ən çox əlaqədə olan istifadəçilər arasında daha çox conversation olsun.

Məsələn:

Developer ↔ Developer

Designer ↔ Developer

Project Manager ↔ Team Member

Learner ↔ Mentor

---

# 16. PROJECT ACTIVITY

Project-lər sadəcə database-də mövcud olmasın.

Hər project-də:

* members;
* tasks;
* comments;
* activity;
* status;
* updates

olsun.

Bəzi project-lər:

**Active**

bəziləri:

**Completed**

bəziləri:

**On Hold**

olsun.

---

# 17. TASK DISTRIBUTION

Task-lar:

```text
To Do
In Progress
Review
Done
```

statuslarında realistik paylansın.

Məsələn:

```text
To Do       25%
In Progress 20%
Review      10%
Done        45%
```

Bu faizlər sistemə uyğun dəyişdirilə bilər.

---

# 18. DEMO LABEL

Əgər frontend-də analytics/statistics göstərilirsə, demo mühitində görünən bir işarə əlavə et:

**DEMO ENVIRONMENT**

və ya

**SYNTHETIC DATA**

Bu label:

* admin panelində;
* analytics səhifəsində;
* mümkün olduqda dashboard-da

görünməlidir.

---

# 19. STATISTICS SOURCE OF TRUTH

Ən vacib texniki prinsip:

Dashboard statistikalarını hard-code etmə.

Yanlış:

```text
users = 842
posts = 5241
```

Düzgün:

```text
SELECT COUNT(*) FROM users
SELECT COUNT(*) FROM posts
```

və ya tətbiqin ORM/query layer-i vasitəsilə real aggregation.

Beləliklə data dəyişdikdə statistikalar avtomatik dəyişsin.

---

# 20. ANALYTICS

Əgər dashboard-da:

```text
Total Users
Active Users
Posts
Engagement
Projects
Tasks
```

göstərilirsə, hamısı database-dən real vaxtda və ya düzgün aggregation ilə hesablansın.

---

# 21. PERFORMANCE

500–1,000 user və on minlərlə activity record yaradarkən:

* N+1 queries;
* inefficient joins;
* missing indexes;
* pagination problemləri;
* slow feed queries

axtar.

Seed yaratmaqla yanaşı application performance-i də test et.

---

# 22. SCALE TEST

Aşağıdakı mərhələləri test et:

### LEVEL 1

500 users

### LEVEL 2

1,000 users

### LEVEL 3

2,500 users

### LEVEL 4

5,000 users

Bütün mərhələləri production database-də tətbiq etmə.

Development/staging mühitində benchmark et.

Hansı həcmdə:

* feed;
* search;
* profile;
* notifications;
* messages;
* leaderboard

yavaşlayırsa qeyd et.

---

# 23. FINAL REPORT

Sonda mənə real seed statistikasını çıxar:

```text
Synthetic Users:
Posts:
Comments:
Replies:
Likes:
Saves:
Reposts:
Followers:
Notifications:
Messages:
Projects:
Tasks:
Learning Records:
Files:
Tags:
```

15 günlük:

```text
DAU
WAU
New Users
Returning Users
Posts/Day
Comments/Day
Engagement
```

göstəricilərini də hesabla.

Bunların hamısı **synthetic demo data** əsasında hesablanmalıdır.

---

# 24. QƏTİ QADAĞA

Bu məlumatları:

* real istifadəçi statistikası;
* real müştəri sayı;
* real platforma aktivliyi;
* real revenue;
* real user growth

kimi təqdim etmə.

Dövlət qurumuna təqdimatda istifadə olunarsa açıq şəkildə:

> **“Demo mühitində sintetik məlumatlar əsasında hazırlanmış simulyasiya göstəriciləri”**

kimi qeyd edilməlidir.

---

# SON MƏQSƏD

Nəticədə Collabix:

**boş test layihəsi kimi yox,**

**real istifadə ssenarilərini və gələcək platforma miqyasını nümayiş etdirən professional demo/simulation environment kimi**

işləməlidir.

Ardıcıllıq:

**ANALYZE → DESIGN DATA MODEL → GENERATE → SEED → RUN APPLICATION → AUDIT → BENCHMARK → FIX → REPORT**
