# 👥 Komandalar və İş Sahələri (Workspaces)

Collabix-də Komandalar və İş Sahələri sadəcə istifadəçilərin qruplaşması deyil, müəssisə səviyyəli (enterprise-grade) layihə idarəetməsi, Kanban lövhələri və tapşırıq planlaması ekosistemidir.

## 🏗️ Verilənlər Bazası Strukturu

Sistem iki fərqli tapşırıq tipini ayırır:
1. **Çalışmalar (Learning Tasks):** `tasks` + `submissions` cədvəllərində saxlanılır. İstifadəçilərin öyrənmək üçün etdiyi tapşırıqlardır (admin XP verir).
2. **Layihə Tapşırıqları (Project Tasks):** `team_tasks` cədvəlində saxlanılır. Komanda daxilində layihə işlərini (Jira/Linear alternativi) idarə etmək üçündür.

### 1. `team_tasks` (Əsas Tapşırıqlar Cədvəli)

Bu cədvəl hər bir layihə tapşırığının əsas məlumatlarını saxlayır. Mövcud sütunlara (`estimated_hours`, `deadline`, `priority`, `status`) əlavə olaraq aşağıdakı inkişaf etmiş xüsusiyyətlərə malikdir:

- **İnsan-oxunaqlı Açar (`task_key`)**: Məsələn, `T-1024`. UUID əvəzinə danışıqlarda, şərhlərdə və UI-da rahat istinad üçün istifadə olunur (PRJ-12).
- **Alt-tapşırıq İyerarxiyası (`parent_id`)**: Böyük tapşırıqları daha kiçik parçalara bölməyə imkan verir.
- **Sprint Bağlantısı (`sprint_id`)**: Tapşırığın hansı zaman çərçivəsində (sprint) icra olunduğunu göstərir.
- **Kanban Sıralaması (`position`)**: Sürüşdürmə (drag & drop) əməliyyatlarının sabit qalması üçün hər tapşırığa REAL (float) tipində bir mövqe dəyəri verilir. İki kartın arasına yeni kart düşdükdə, riyazi orta (`(a+b)/2`) hesablanır və beləcə bütün sütunun yenidən nömrələnməsinə ehtiyac qalmır.
- **Zaman İzləmə (`estimated_minutes`, `spent_minutes`)**: Saat və dəqiqə səviyyəsində dəqiq zaman izləmə imkanı verir. Sərf olunan zamanlar denormallaşdırılaraq toplanır.
- **Təkrarlanma (`recurrence`)**: Məsələn, `'daily'`, `'weekly:1,3'`, `'monthly:15'`. Gündəlik, həftəlik və ya aylıq avtomatik təkrarlanan tapşırıqların idarə edilməsi.
- **Denormallaşdırılmış Sayğaclar**: `comment_count`, `attach_count`, `check_total`, `check_done` kimi məlumatlar N+1 sorğu probleminin qarşısını almaq üçün birbaşa kartın üzərində yenilənir və saxlanılır (səhifələmə zamanı performansı kəskin artırır).

### 2. Sprints (`sprints`)

- **Komanda Səviyyəli Sprintlər**: Jira və Linear modelində olduğu kimi, sprintlər konkret bir layihəyə yox, **bütün komandaya** aiddir. Bu sayədə bir komanda eyni sprint ərzində bir neçə fərqli layihə üzərindəki tapşırıqları eyni anda icra edib idarə edə bilir.

### 3. Digər Bağlı Strukturlar

İş sahəsi ekosistemi yalnız kartlardan ibarət deyil, onun həmçinin aşağıdakı bağlı cədvəlləri var:
- `task_time_logs`: Hər bir inkişaf etdiricinin tapşırığa sərf etdiyi vaxtı (time-tracking) dəqiqəbədəqiqə izləyir.
- `task_comments` və `task_attachments`: Tapşırıq daxilindəki müzakirələr və əlavə edilmiş fayllar (R2 üzərindən).
- `project_members_requests`: Layihələrə giriş üçün üzvlük tələbləri.

## 🚀 Performans Optimallaşdırmaları

- **İndeksləmə**: İş sahəsi sorğuları ("mənim bütün komandalarımdakı tapşırıqlar" və ya "bu sprintdəki tapşırıqlar") üçün mürəkkəb indekslər yaradılıb. Məsələn:
  - `ix_tt_assignee_status`: İstifadiçiyə təyin olunmuş kartları ən qısa zamanda gətirir.
  - `ix_tt_project_pos`: Kanban lövhəsində sütunları və sıraları dərhal render etmək üçün.
  
---
**Əvvəlki**: [Real-vaxt Arxitekturası ←](Realtime)
