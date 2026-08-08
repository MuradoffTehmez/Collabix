# 🏢 Komandalar və İş Sahələri (Teams and Workspaces)

> Collabix daxilində şəxslərin birgə işləməsi və layihə idarə etməsi üçün xüsusi əməkdaşlıq mərkəzi.

---

## 👥 Komanda (Team) İdarəetməsi

Platformada istifadəçilər yeni Komandalar (Teams) yarada, idarə edə və digərlərini dəvət edə bilərlər.

### Komandanın Yaradılması
İstifadəçi "Yeni Komanda Yarat" düyməsini klikləyir. Komandanın adı (Məsələn, "OpenAI Coderləri"), təsviri və avtarı müəyyən edilir. Yaranan komanda unikal bir URL "slug" (məs, `/team/openai-coderleri`) əldə edir. Yaradan şəxs avtomatik `Owner` (Sahib) olur.

### Üzvlərin Dəvət Edilməsi
Komandaya üzvlər fərdi **Dəvət Linkləri** və ya Email vasitəsilə çağırıla bilər. Dəvət sistemi Tokenlər üzərində qurulub.

---

## 💼 İş Sahəsi (Workspace) Xüsusiyyətləri

Komandanın daxilinə girdikdə bura tamamilə şəxsi bir ekosistemə (Workspace) çevrilir. Kənar istifadəçilər buranı görə bilməzlər (Guest icazəsi yoxdursa).

### 1. Workspace Dashboard (İdarə Paneli)
Komandanın cari ümumi vəziyyətini, son layihələri, yaxınlaşan tapşırıqları və üzvlərin fəaliyyət tarixçəsini (Activity Log) göstərən əsas ekran.

### 2. Workspace Feed (Qapalı Lent)
Tıpkı qlobal ana səhifə (Feed) kimi, lakin **yalnız komanda üzvlərinə aid** məzmunları (Elanlar, ideyalar, müzakirələr) saxlayan lent.

### 3. Team Chat (Komanda Söhbət Otağı)
Qlobal otaqlardan (Rooms) ayrılmış, qapalı komanda müzakirələri üçün xüsusi Real-vaxt WebSocket otağı.

### 4. Fayl Anbarı (Team Files)
Komandaya xas olan, R2 (Object Storage) arxasında saxlanılan sənədlərin, PDF-lərin, dizayn fayllarının toplandığı mərkəz.

---

## 📋 Layihə və Tapşırıqlar (Projects & Kanban)

Collabix Jira-a bənzər yüngül Agile idarəetmə funksiyalarına malikdir.

1. **Layihə Yaradılması (Project):** "Frontend Dizaynı", "Backend API Köçü" kimi yeni layihələr yaradılır.
2. **Kanban Lövhəsi:** Hər layihə daxilində vizual Tapşırıq (Task) idarəsi üçün lövhə (Board) mövcuddur. Sütunlar:
   - 📋 *Backlog* (Ediləcəklər)
   - 🔄 *In Progress* (İşdə)
   - 👀 *Review* (Yoxlamada)
   - ✅ *Done* (Tamamlanmış)
3. **Task Xüsusiyyətləri:** Tapşırığın məsul şəxsi (Assignee), prioritet (High, Medium, Low), təsvir və müzakirə bölməsi. Sürüşdürüb-buraxma (Drag-and-Drop) ilə sütunlar arası hərəkət etdirmək mümkündür.

---

**Əvvəlki:** [Realtime (WebSocket)](Realtime) | **Növbəti:** [Töhfə Vermə (Contributing)](Contributing)
