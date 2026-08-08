/goal — Sərt Texniki Audit, Təhlükəsizlik Yoxlaması və Tam Analiz Tapşırığı

Sən bu layihəyə **sərt auditor**, **senior software architect**, **security reviewer**, **QA lead** və **technical due diligence specialist** kimi yanaşacaqsan. Bu tapşırığın məqsədi layihəni “işləyir” səviyyəsində deyil, **həqiqətən tamamlanıb-tamamlanmadığı**, **arxitektura baxımından sağlam olub-olmadığı**, **təhlükəsizlik riskləri daşıyıb-daşımadığı**, və **istehsal mühitinə çıxmağa hazır olub-olmadığı** aspektlərindən tam və qərəzsiz qiymətləndirməkdir.

Səthi baxış qadağandır. Heç bir qovluğu ötüb keçmə. Heç bir faylı nəzərdən qaçırma. Heç bir taskı fərziyyə ilə tamamlanmış sayma. Əgər bir hissə kodda yoxdur, sənəddə yazılıbsa belə onu tamamlanmış kimi qəbul etmə. Əgər implementasiya natamamdırsa, bunu açıq şəkildə qeyd et.

## Əsas audit məqsədi

Layihənin bütün kod bazasını, sənədlərini, task-larını, modullarını, frontend və backend hissələrini, təhlükəsizlik səviyyəsini, test vəziyyətini, texniki borcunu və çatışmayan funksionallıqlarını tam analiz et və nəticəni sərt, dəqiq, hesabat formatında təqdim et.

## İcra çərçivəsi

### 1) Tam struktur auditi

* Layihədə olan bütün qovluqları bir-bir analiz et.
* Hər faylın nə iş gördüyünü müəyyən et.
* Lazımsız, təkrarlanan, köhnəlmiş, boş, istifadəsiz və ya ziddiyyətli faylları üzə çıxar.
* Hər modulun arxitektura daxilində rolunu yaz.
* Layihənin hazırkı strukturunun peşəkar standartlara uyğun olub-olmadığını qiymətləndir.

### 2) Task və tələb auditi

* Bütün task-ları, TODO-ları, issue-ları, PRD/TDD sənədlərini, planları və izahları oxu.
* Hər task üçün ayrıca hökm ver:

  * tamamlanıb
  * qismən tamamlanıb
  * başlanmayıb
  * yanlış implementasiya olunub
  * sənəddə var, kodda yoxdur
* Hər task üzrə tamamlanma faizini ayrıca göstər.
* Hər task üçün çatışmayan işləri konkret maddələrlə yaz.
* “Var” ilə “düzgün və istehsala hazırdır” anlayışlarını ayır.

### 3) Tamamlanma faizinin sərt hesablanması

Aşağıdakı hissələri ayrıca və əsaslandırılmış şəkildə faizlə qiymətləndir:

* backend
* frontend
* database
* authentication / authorization
* security
* UI/UX
* state management
* API layer
* test coverage
* deployment / DevOps
* monitoring / logging
* error handling
* responsiveness
* performance

Faiz verərkən aşağıdakıları nəzərə al:

* kodun real vəziyyəti
* task-larla uyğunluq
* edge-case-lərin örtülməsi
* sənəd-kod uyğunluğu
* işlək amma natamam olan hissələr
* yalnız nominal olaraq mövcud olan, amma funksional olmayan hissələr

Heç vaxt “təxminən tamamdır” kimi yumşaq ifadələrə sığınma. Nəticə obyektiv, sərt və əsaslandırılmış olmalıdır.

### 4) Təhlükəsizlik auditi

Layihəni təhlükəsizlik baxımından ciddi şəkildə yoxla:

* authentication axını
* authorization və role enforcement
* session / token qorunması
* CSRF
* XSS
* SQL injection
* IDOR
* SSRF
* path traversal
* file upload/download təhlükəsizliyi
* API endpoint qorunması
* rate limiting
* brute force müdafiəsi
* secrets və env sızması
* CORS konfiqurasiyası
* CSP və security headers
* audit logging
* admin panel təhlükəsizliyi
* privilege escalation riskləri
* input validation və sanitization

Tapdığın hər təhlükə üçün bunları yaz:

* riskin adı
* konkret yerləşdiyi hissə
* niyə risk olduğu
* mümkün təsiri
* prioritet səviyyəsi
* düzəliş tövsiyəsi

Təhlükəsizlik problemi varsa, onu “xırda problem” kimi yumşaltma. Risk riskdir.

### 5) Modul səviyyəsində çatışmazlıq analizi

Hər modul üzrə yoxla:

* nə var
* nə yoxdur
* nə yarımçıqdır
* nə səhv qurulub
* hansı biznes qaydaları itkin düşüb
* hansı edge-case-lər nəzərə alınmayıb
* hansı dependency və ya data flow qüsurludur
* hansı hissə yalnız vizualdır, amma məntiq yoxdur

Aşağıdakı modulları ayrıca dəyərləndir:

* auth
* user/profile
* feed/post
* comment/reaction/share
* notification
* admin panel
* settings
* search/filter
* upload/media
* rooms/chat/collaboration
* XP / role / progression sistemi
* database schema
* API layer
* routing
* responsive layout
* error states
* logging
* test layer

Hər modul üçün açıq şəkildə yaz:

* “bu modul hazırdır” demək üçün nə çatmalıdır
* hazırkı vəziyyət hansı səviyyədədir
* hansı funksiya və ya qayda əskikdir
* hansı hissə refactor tələb edir

### 6) Frontend və backend ayrıca hökm

#### Frontend audit

* komponent strukturu
* page və layout vəziyyəti
* responsive problemlər
* state management keyfiyyəti
* data fetching modeli
* loading / empty / error state-lər
* accessibility
* performans
* UX ardıcıllığı
* visual inconsistency
* browser davranış fərqləri

#### Backend audit

* API dizaynı
* business logic
* data integrity
* transaction istifadəsi
* validation
* error handling
* security
* scalability
* maintainability
* test coverage
* dependency və module separation

Frontend və backend üçün ayrıca tamamlanma faizi ver və bunu real kod vəziyyətinə söykə.

### 7) Problem prioritetləşdirmə

Bütün tapdığın çatışmazlıqları aşağıdakı sıralama ilə ver:

* Critical
* High
* Medium
* Low

Hər problem üçün:

* səbəb
* təsir
* bu problemin nəticəsi nə ola bilər
* hansı modul və ya hissəyə təsir edir
* düzəliş planı
* təxmini iş həcmi

### 8) Sənəd-kod uyğunsuzluğu yoxlaması

Əgər sənəddə yazılanlarla kod arasında fərq varsa:

* bunu ayrıca göstər
* hansı tərəfin yanlış olduğunu qeyd et
* hansı hissənin faktiki vəziyyətə daha yaxın olduğunu yaz
* yalnız sənəd əsasında tamamlanmış sayma

### 9) Final raportun formatı

Nəticəni aşağıdakı strukturla ver:

1. **İcra xülasəsi**
2. **Layihə arxitekturası**
3. **Qovluq və fayl analizi**
4. **Task status cədvəli**
5. **Backend audit nəticəsi**
6. **Frontend audit nəticəsi**
7. **Security audit nəticəsi**
8. **Çatışmayan modullar və funksiyalar**
9. **Texniki borc və risklər**
10. **Prioritetli düzəliş planı**
11. **Ümumi tamamlanma faizi**
12. **Nəticə və sərt hökm**

## Qaydalar

* Heç nə uydurma.
* Görmədiyin fayl barədə tam hökm vermə.
* Məlumat yoxdursa, bunu açıq yaz.
* Təxmin edirsənsə, bunun təxmin olduğunu açıq qeyd et.
* “İşləyir” ilə “tamamlanıb”ı ayır.
* “Mövcuddur” ilə “istehsala hazırdır”ı ayır.
* Kod, sənəd və task arasında ziddiyyət varsa, onu gizlətmə.
* Sadəcə problem siyahısı vermə; düzəliş və prioritet də ver.
* Nəticə peşəkar, sərt, dəqiq və audit dili ilə yazılmalıdır.

## Gözlənilən nəticə

Mənə layihənin:

* faktiki tamamlanma dərəcəsini
* qalan iş həcmini
* təhlükəsizlik risklərini
* çatışmayan modulları
* yanlış və ya natamam implementasiyaları
* prioritet düzəlişləri

qısa yumşaldılmamış, sərt və konkret formatda təqdim et.
