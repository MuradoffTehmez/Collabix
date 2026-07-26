# TASK-11 Tam İcra Planı

Bu sənəd TASK-11 (Team Workspace & Collaboration Platform) modullarının tam şəkildə (CRUD və digər funksiyalarla birgə) inteqrasiya edilməsini və Admin panel daxil olmaqla bütün aspektlərin bitirilməsini əhatə edir.

Tapşırıq çox geniş olduğu üçün, onu **FAZA**-lara (mərhələlərə) bölərək ardıcıl icra edəcəyəm. Hər faza tamamlandıqca həm test ediləcək, həm də növbəti mərhələyə keçiləcək.

---

## ⚠️ User Review Required
Bu böyük dəyişikliklər bazada və arxitekturada əlavə əməliyyatlar tələb edəcək. Əgər bu ardıcıllıq və ya fazalar sizin üçün uyğundursa, zəhmət olmasa təsdiqləyin. 

---

## Faza 1: Əsas Core CRUD Əməliyyatlarının Tamamlanması
Hazırda `create` və `get` əməliyyatlarının bir hissəsi var, lakin tam deyil.
- **Teams**: Update və Delete əməliyyatları, həmçinin xüsusi komanda axtarışı.
- **Projects**: Project detallarına baxış, Update və Delete (Soft/Hard delete) funksiyallıqları.
- **Tasks**: Taskların statusunun dəyişdirilməsi, təyin edilməsi (Assign), Update və Delete funksionallıqları.
- **API Endpoints**: Bütün bu proseslər üçün `/api/teams/:id/projects/:id` və s. ardıcıl route-ların yığılması.

## Faza 2: İstifadəçi İdarəetməsi (Members, Roles, Invites)
- **Roles**: Owner, Admin, Developer və s. rolların tam yaradılması, Permission yoxlanışı (Middleware).
- **Invites**: İstifadıçiyə email (və ya daxili bildiriş) ilə komandaya dəvət göndərilməsi.
- **Member Management**: İstifadəçilərin komandaya qoşulması, komandadan çıxması, rollarının dəyişdirilməsi və kənarlaşdırılması (Kick).

## Faza 3: İnteqrasiya Edilmiş Alt Modullar (Chat, Feed, Files)
- **Team Chat (Durable Objects)**: Komandaya xas otaqlar (General, Development) və real-time WebSocket əlaqəsi.
- **Team Feed**: Komanda daxili elanların (Announcement) və paylaşımların (Posts) tam CRUD sistemi.
- **Team Files (R2)**: Sənədlərin, layihə materiallarının komanda workspace-inə (R2 Storage) yüklənməsi, idarə edilməsi.

## Faza 4: Müşahidə və Analitika (Activity, XP, Statistics)
- **Activity Logs**: Bütün yuxarıda edilən hərəkətlərin (Task bitdi, Fayl yükləndi) bazada `team_activity` olaraq loglanması.
- **Team XP & Reputation**: Komanda fəaliyyət göstərdikcə ortaq XP-nin hesablanması (Task +20 XP, və s.).
- **Statistics**: Dashboard üçün komandanın ümumi statistikalarının hesablanması və API kimi verilməsi.

## Faza 5: Admin Panel & Xüsusi İnteqrasiyalar (AI, Queues, Workflows)
- **Admin Panel**: Sayt adminlərinin bütün komandaları, layihələri, üzvləri izləyə biləcəyi `admin.js` dashboard-nun yenilənməsi.
- **Cloudflare Services**: Background proseslərin Queues və Workflows vasitəsilə asinxron işlənməsi (XP update, Invite email).
- **Workers AI & Vectorize**: (Əlavə olaraq) Komanda daxilində tapşırıq və axtarışlar üçün baza hazırlanması.

## Yoxlama və Doğrulama Planı (Verification Plan)
- **Avtomatlaşdırılmış Testlər**: `e2e/teams.spec.ts` faylına hər modul üzrə (Create Project, Chat, Invites) test ssenarilərinin əlavə edilib yoxlanılması.
- **Manual Yoxlama**: Local `wrangler dev` serverində istifadəçi və admin gözü ilə hər düymənin/formun əllə yoxlanılması. Məlumatların `d1` (lokal SQLite) içində real zamanda yazılmasının sübutu.
