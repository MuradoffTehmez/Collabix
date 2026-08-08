# 👑 RBAC (Rol Əsaslı İcazə Sistemi)

> Tətbiq daxilində kimin nə edə biləcəyini idarə edən sistem: **R**ole-**B**ased **A**ccess **C**ontrol.

---

## 🌍 Qlobal Rollar (Platform Səviyyəsi)

Platforma daxilində hər bir istifadəçiyə aid qlobal rol mövcuddur. Bu rol `users` cədvəlində `role` sütununda və API tərəfində `rbac.ts` faylı ilə idarə olunur.

| Rol | Səlahiyyət Təsviri |
|-----|--------------------|
| **User (İstifadəçi)** | Qeydiyyatdan keçmiş adi istifadəçi. Yalnız öz məlumatlarını oxuya və dəyişə, ümumi otaqlarda yaza, komanda yarada və s. edə bilər. |
| **Moderator** | Platformadakı məzmun nizamnaməsini qoruyur. Təhqiramiz şərhləri silə, istifadəçilərə xəbərdarlıq edə və spam paylaşımları qaldıra bilər. |
| **Admin** | Tətbiq idarəçisi. Rolları dəyişdirə bilər (User -> Moderator), şikayətləri incələyib hesabı bloklaya (Ban) bilər, statistikanı görə bilir. |
| **Super Admin** | Mütləq nəzarət sahibi. Digər Adminləri təyin etmək, sistem səviyyəsində audit loglarını ixrac etmək, taksonomiya redaktə etmək (faq, skills) icazələri yalnız ona məxsusdur. |

> Bütün idarəetmə Endpoint-ləri (`/api/admin/*`) həm JWT, həm də RBAC qoruyucusu tərəfindən filterlənir.

---

## 🏢 Komanda (Workspace) Rolları

Collabix Workspace (İş sahəsi) xüsusiyyətinə də sahib olduğundan, komanda daxilindəki icazələr **qlobal rollardan asılı olmayaraq** xüsusi idarə olunur. Bu, `team_roles` və `team_members` cədvəllərində saxlanılır.

### Standart Komanda Rolları

| Rol | Səlahiyyət |
|-----|------------|
| **Owner (Sahib)** | Komandanı yaradan şəxs. Komandanı silə, sahibliyi başqasına verə bilər. Qalan bütün səlahiyyətlərə malikdir. |
| **Admin** | Üzvləri dəvət etmək/xaric etmək, layihələr yaratmaq, komanda məlumatlarını yeniləmək. |
| **Moderator** | Məzmunu təmizləmək (komanda içi şərhləri silmək, fayllara nəzarət etmək). |
| **Member (Üzv)** | Tapşırıqlar əlavə etmək, şərh yazmaq, layihələrdə işləmək. |
| **Guest (Qonaq)** | Yalnız oxuma (Read-only) hüququ olan, komandanın işinə baxa bilən şəxs. |

### Xüsusi Rollar (Custom Roles)

Adminlər tərəfindən komandaya **yeni fərdi rollar** yaradıla bilər. Məsələn, "Frontend Developer" adlı bir rol yaradıb, ona yalnız `create_task` və `view_project` icazələrini təyin edə, rolun rəngini fərqləndirə bilərlər.

### İcazə Qərar Ağacı (Decision Tree)

Məsələn, bir istifadəçi komandadan kimsə çıxarmaq istədikdə API necə qərar verir:

1. İstifadəçi sistemə daxil olubmu? (JWT Validasiyası)
2. İstifadəçi komandanın üzvüdürmü? (Database Check)
3. İstifadəçinin bu komandadakı rolunda `remove_member` icazəsi varmı? (Workspace RBAC)
4. Hədəf istifadəçinin rol prioriteti (Priority) çıxarmaq istəyən şəxsin rolundan yüksəkdirmi? (Owner, Admini çıxara bilər, lakin Admin Owneri çıxara bilməz).

Hər bir şərt ödənildikdə, API əməliyyatı icra edir.

---

**Əvvəlki:** [← Autentifikasiya Sistemi](Authentication) | **Növbəti:** [Xüsusiyyətlər →](Features)
