# Collabix — İş sahəsi (Tapşırıqlar) və Çalışmalar: dizayn və icra sənədi

Bu sənəd **iki səhifəni** əhatə edir:

| Səhifə | Marşrut | Sistem | Nə üçündür |
|---|---|---|---|
| **Tapşırıqlar** | `#tasks` | `team_tasks` | Komanda layihə idarəetməsi (Kanban, sprint, Gantt) |
| **Çalışmalar** | `#drills` | `tasks` + `submissions` | Öyrənmə çalışmaları (həll göndər → admin təsdiqi → XP) |

> 🔴 **İkisi fərqli məhsul sahəsidir.** Bu ayrım sənədin ən vacib faktıdır —
> onları qarışdırmaq layihədəki ən böyük risk idi. Ətraflı: §1.1.

Bütün rəqəmlər koddan oxunub. Mənbələr:
`migrations/0054_workspace.sql` · `worker/routes/workspace/` ·
`js/workspace*.js` · `js/drills.js` · `css/92-workspace.css` · `css/93-drills.css`

---

## 1. UX rasionalı

### 1.1 Hansı «tapşırıq»?

Repoda iki tamamilə ayrı anlayış eyni sözlə adlanırdı:

| | `tasks` + `submissions` | `team_tasks` |
|---|---|---|
| Mahiyyət | öyrənmə çalışması | layihə tapşırığı |
| Sahələr | kateqoriya, təsvir | layihə, təyinat, prioritet, son tarix |
| Status | `pending` / `approved` / `rejected` | `To Do` … `Done` |
| İş axını | istifadəçi həll göndərir, admin təsdiqləyir | komanda kartı sütunlar arasında hərəkət etdirir |
| XP | admin təsdiqindən sonra | tamamlanma keçidində |

Spesifikasiya (Linear / Jira / ClickUp) **ikincinin** anlayışıdır, «Tapşırıqlar»
adlı səhifə isə **birincisi** idi. Qərar: `#tasks` komanda iş sahəsinə çevrildi,
çalışmalar isə **öz sxemi ilə** `#drills` səhifəsinə köçdü — funksiya itmədi,
yeri dəyişdi və naviqasiyada ayrıca bənd aldı.

### 1.2 Səkkiz prinsip

1. **Görünüşlər sorğu etmir.** Altı rejim eyni `S.tasks` massivini oxuyur.
2. **Görünürlük qapısı tək yerdədir** (`scopedWhere`) — §7.1.
3. **XP müqaviləsi təkrarlanmır** — mövcud servisə ötürülür (§7.4).
4. **Sıxlıq forma diktə edir:** lövhə kartı ≠ siyahı sətri (§4.2).
5. **Rəng tək siqnal deyil** — hər prioritetin ikonu, hər statusun mətni var.
6. **Yapışqan ofsetlər ölçülür**, sabit piksel yazılmır (§9.2).
7. **Forma idarəediciləri tip üzrə stillənir**, sinif üzrə yox (§9.1).
8. **Real-time mövcud kanaldan gedir** — ikinci soket açılmır (§8.3).

### 1.3 Spesifikasiyadan qəsdən fərqlənən qərarlar

| Spesifikasiya | Qərar | Səbəb |
|---|---|---|
| `#F7F9FC` fon, ağ kart | Sabit hex YOXDUR | Açıq temada `var(--bg)`/`var(--surface)` onsuz da bunu verir; sabit yazsaydıq dark/matrix/cyberpunk-da səhifə saytdan qoparadı |
| Gantt-da asılılıq oxları | Oxlar YOX, **nişan** var | Əyri xətt mütləq mövqe hesablaması tələb edir və hər sürüşmədə yenidən hesablanmalıdır; bloklanmış tapşırıqda kilid + `title`, tam qraf detal panelindədir |
| «Critical path» | YOXDUR | Kritik yol tam asılılıq qrafının topoloji sıralanmasını tələb edir; asılılıq datası indi toplanır, hesablama sonrakı mərhələdədir (§13) |
| Sürüşdürmə ilə təqvim/Gantt redaktəsi | YOXDUR | Native DnD toxunuş cihazlarında işləmir; tarix detal panelindən dəyişilir |
| «Typing indicator» | YOXDUR | Şərh sahəsi üçün ayrıca presence kanalı tələb edir; dəyəri xərcini qarşılamır |

---

## 2. Komponent ierarxiyası

```
#page-tasks                              #page-drills
├─ .ws-head    (başlıq + əməliyyatlar)   ├─ .dr-head
├─ .ws-dash    (12 statistika kartı)     ├─ .dr-dash   (5 kart)
├─ .ws-timer   (işləyən taymer)          ├─ .dr-controls
├─ .ws-controls                          │  ├─ .dr-search + status seçicisi
│  ├─ .ws-search  (Ctrl+K)               │  └─ .dr-cats (kateqoriya çipləri)
│  ├─ .ws-filterbtn + .ws-fbadge         ├─ .dr-form   (açılan təklif formu)
│  ├─ .ws-views   (6 rejim)              ├─ #drAdmin   (.dr-panel × 2)
│  ├─ .ws-filters (alt vərəqə ≤768px)    └─ .dr-grid   (.dr-item)
│  └─ .ws-chips   (aktiv filtrlər)
├─ .ws-bulk    (toplu əməliyyat)
└─ .ws-body--<rejim>
   ├─ kanban   → .ws-col × 6 › .ws-card-t--board
   ├─ list     → .ws-group › .ws-card-t--list
   ├─ table    → .ws-tbwrap › .ws-tb
   ├─ calendar → .ws-cal__nav + .ws-cal
   ├─ timeline → .ws-tl__g › .ws-tl
   └─ gantt    → .ws-gz + .ws-gwrap › .ws-gantt

body səviyyəsində (portal):
├─ .ws-panel + .ws-panel__back   — detal (sürüşən panel)
├─ .ws-menu                       — «Daha çox»
└─ #modalCard                     — yaratma / sprint / etiket / avtomatlaşdırma
```

**Niyə portal:** iş sahəsi `overflow` konteynerləri ilə doludur (Kanban
sütunları yan sürüşür). Panel onların içində qalsaydı **kəsilərdi**.

---

## 3. Fayl təşkili

```
worker/routes/workspace/     ← qovluq, `services/team/` naxışı
  index.ts   oxu     — filtr, siyahı, lövhə qruplaşması, statistika, meta
  task.ts    mutasiya — yaratma, redaktə, toplu, sürüşdürmə, detal
  sub.ts     alt-resurs — yoxlama, şərh, asılılıq, vaxt, etiket, sprint…

js/
  workspace.js         vəziyyət + qabıq (başlıq, panel, filtr, yükləmə)
  workspace-views.js   altı render mühərriki + kart şablonu
  workspace-detail.js  detal paneli + modallar
  drills.js            çalışmalar (ayrı sistem)

css/
  92-workspace.css   iş sahəsi
  93-drills.css      çalışmalar   ← ayrı səhifə = ayrı fayl
```

⚠ `93-drills.css` **92-dən sonra** yüklənir: `--ws-*` ton nişanları orada
`:root`-da elan olunur və çalışma faylı onları yalnız **işlədir**.

---

## 4. Layout və sıxlıq

### 4.1 Grid

| Blok | Qayda |
|---|---|
| Statistika | `repeat(auto-fit, minmax(148px, 1fr))` → ≤768px yan sürüşmə |
| Kanban | `flex`, sütun `--ws-col-w: 300px` (1024→260, 480→84vw) |
| Filtr paneli | `repeat(auto-fit, minmax(190px, 1fr))` → ≤768px alt vərəqə |
| Çalışma şəbəkəsi | `repeat(auto-fill, minmax(300px, 1fr))` → ≤768px tək sütun |
| Gantt | `220px repeat(var(--gc), minmax(46px, 1fr))` (≤768px `140px`) |
| Detal paneli | `min(460px, 100vw)` |

### 4.2 Lövhə kartı ≠ siyahı sətri

Eyni `taskCard()` funksiyası, **fərqli variant**:

| | `--board` | `--list` |
|---|---|---|
| İstiqamət | `column` | `row` (açıq sıfırlama!) |
| Hündürlük | məzmuna görə (~84px) | 38px |
| Başlıq | 3 sətir clamp | 1 sətir, `order: 3` |
| Etiket / irəliləyiş | var | gizli |
| Meta | hamısı | layihə + son tarix + icraçı |

⚠ **Flex, grid deyil.** Grid variantında sütun sayı sabitdir, element sayı isə
tapşırıqdan-tapşırığa dəyişir (icraçı var/yox, tarix var/yox) — ölçüldü:
sütun tükənəndə **avatar ikinci sətrə düşürdü**.

---

## 5. Rəng nişanları

Hamısı `:root`-dadır (portal olunan qatlar üçün — §9.3).

| Nişan | Tünd | Açıq | Məna |
|---|---|---|---|
| `--ws-blue` | `#3b82f6` | `#1d63d1` | To Do, həcm |
| `--ws-violet` | `#a855f7` | `#7e22ce` | İşdə, irəliləyiş |
| `--ws-amber` | `#f59e0b` | `#b45309` | Baxış, diqqət |
| `--ws-teal` | `#14b8a6` | `#0f766e` | Test, komanda |
| `--ws-green` | `#22c55e` | `#15803d` | Bitdi, nəticə |
| `--ws-rose` | `#e5484d` | `#be123c` | Bloklanıb, risk |
| `--ws-cyan` | `#06b6d4` | `#0e7490` | Planlama |
| `--ws-slate` | `#94a3b8` | `#64748b` | Backlog, neytral |

**Prioritet AYRI şkaladır** (`--ws-crit #dc2626`, `--ws-urgent #ea580c`,
`--ws-high #d97706`, `--ws-med #64748b`, `--ws-low #94a3b8`) — status və
prioritet eyni kartda yan-yana durur; eyni rəngdən qidalansaydılar
bir-birini oxunmaz edərdi.

**Ölçü nişanları:** `--ws-col-w: 300px`, `--ws-panel-w: 460px`,
`--ws-gap: var(--sp-3)`, `--ws-topbar` / `--ws-ctrl-h` — **ölçülür** (§9.2).

---

## 6. Görünüş rejimləri

| Rejim | Nə üçün | Səhifələmə |
|---|---|---|
| **Lövhə** | vəziyyət axını, sürüşdürmə | sütun başına 25 + «daha çox» |
| **Siyahı** | sürətli oxuma, status qrupları | 60, sonsuz sürüşmə |
| **Cədvəl** | müqayisə, sıralama | 60, sonsuz sürüşmə |
| **Təqvim** | son tarix paylanması | 200 (ay tam görünsün) |
| **Zaman xətti** | «nə vaxt nə baş verir» + sprint | 200 |
| **Gantt** | müddət, üst-üstə düşmə | 200, sütun ≤60 |

Seçim `localStorage` (`collabix_ws_view`); qısayollar `1…6`.

⚠ **Cədvəl sıralaması SERVERDƏDİR.** Client-də sıralasaydıq yalnız yüklənmiş
səhifə sıralanardı və istifadəçi «ən yüksək prioritet» deyəndə əslində
«yüklənmişlərin ən yüksəyini» görərdi — səssiz yalan.

⚠ **Gantt sütun sayı ≤60:** 5 illik aralıq gündəlik zoom-da 1800 sütun
yaradardı və brauzer donardı.

---

## 7. Data müqaviləsi

### 7.1 🔴 Görünürlük qapısı

Komanda endpoint-lərində `teamId` URL-dədir və `requireTeamPermission`
işləyir. Burada sorğu **bir komandaya aid deyil** — «mənim bütün
tapşırıqlarım». Hər sətir üçün ayrıca yoxlama N+1 olardı və **unudulması
sızma** deməkdir.

```sql
t.project_id IN (
  SELECT p.id FROM team_projects p
    JOIN team_members m ON m.team_id = p.team_id
   WHERE m.user_id = ?N AND m.status = 'active' AND p.status != 'deleted')
```

Bu **filtr deyil, təhlükəsizlik qapısıdır** — `scopedWhere()` köməkçisi məhz
unudulmaması üçündür. Sayt admini də istisna deyil: iş sahəsi şəxsi ekrandır.

### 7.2 Sxem (miqrasiya 0054)

`team_tasks`-a 15 sütun: `task_key`, `parent_id`, `sprint_id`, `position`
(REAL), `estimated_minutes`, `spent_minutes`, `start_date`, `completed_at`,
`archived_at`, `created_by`, `recurrence`, `comment_count`, `attach_count`,
`check_total`, `check_done`.

11 yeni cədvəl: `sprints`, `task_labels`, `task_label_links`,
`task_checklist`, `task_comments`, `task_attachments`, `task_watchers`,
`task_dependencies`, `task_time_logs`, `task_activity`, `task_automations`,
`task_saved_views`.

⚠ **Mövcud sütunlar saxlanıldı** (`estimated_hours`, `deadline`, `priority`,
`status`) — komanda səhifəsindəki tapşırıq siyahısı sınmadı.

⚠ `position` **REAL**-dır: iki kartın arasına buraxmaq üçün orta ədəd
kifayətdir (`(a+b)/2`), bütün sütunu yenidən nömrələmək lazım gəlmir.

### 7.3 Endpoint-lər (34)

| Qrup | Yollar |
|---|---|
| Oxu | `GET /ws/tasks` · `stats` · `trend` · `meta` · `timer` · `automations` · `tasks/:id` |
| Tapşırıq | `POST /ws/tasks` · `PATCH /ws/tasks/:id` · `POST /ws/bulk` · `POST /ws/tasks/:id/move` |
| Alt-resurs | `checklist` · `comments` · `deps` · `watch` · `labels` · `timer/start|stop` · `time` · `attachments/:id` |
| Katalog | `labels` · `sprints` · `views` · `automations` (CRUD) |
| Qoşma | `POST /upload?kind=task&taskId=…` |

### 7.4 🔴 XP müqaviləsi təkrarlanmır

Status dəyişikliyi `TeamTaskService.updateTask`-a **ötürülür**, çünki
«Done keçidində ver, geri açılanda `compensateXp` ilə al» qaydası orada
auditdən keçib (AUDIT-TASK-9). Burada təkrarlasaydıq, iki yol ayrılan kimi
«Done → To Do → Done» **XP fabrikinə** çevrilərdi.

⚠ Servis yalnız dörd köhnə statusu tanıyır; yeni statuslar (`Backlog`,
`Planning`, `Testing`, `Blocked`) birbaşa yazılır — XP yalnız `Done`
keçidinə bağlıdır və o, köhnə çoxluqdadır, yəni müqavilə pozulmur.

### 7.5 Hədlər

| Sabit | Dəyər |
|---|---|
| `PAGE` / `COL_PAGE` | 60 / 25 |
| `BULK_MAX` | 100 |
| `TIMELINE_PAGE` | 20 |
| `MAX_DEPTH` (dövr axtarışı) | 40 |
| Qoşma ölçüsü | 10 MB |
| Gantt sütunu | ≤60 |

---

## 8. İcazə modeli

**İki səviyyə, qəsdən:**

| Səviyyə | Nə əhatə edir | Tələb |
|---|---|---|
| `own` | status, sıra, yoxlama, şərh, vaxt, qoşma | komanda **üzvlüyü** |
| `manage` | başlıq, təyinat, prioritet, sprint, tarix, arxiv, silinmə | `manage_tasks` |

🔴 **Düzəliş tarixçəsi:** `own` əvvəl yalnız təyin olunana/yaradana açıq idi.
Nəticə: təyin olunmamış kart (`assignee_id IS NULL`) sıravi üzv üçün
**sürüşdürülə bilmirdi** — hər buraxma 403 verirdi, yəni Kanban-ın özəyi
işləmirdi. Linear/Jira-da da kartı hərəkət etdirmək üçün ayrıca icazə
tələb olunmur.

**Əlavə sahiblik yoxlamaları:** şərh redaktəsi yalnız müəllifə
(`author_id` şərti UPDATE-də); şərh/qoşma silinməsi müəllifə **və ya**
`manage_tasks`-a.

### 8.3 Real-time

Layihədə **artıq** fan-out kanalı var: `userPush` presence soketinə kiçik
paket göndərir, client isə məzmunu REST-dən çəkir (bildiriş və DM eyni
naxışdadır). Tapşırıq üçün `{ t: 'task' }` siqnalı əlavə edildi.

⚠ Ayrıca soket açsaydıq, hər istifadəçidə **ikinci daimi bağlantı** və
ikinci yenidən-qoşulma məntiqi olardı.

⚠ Client siqnalı **1.2 s debounce** ilə birləşdirir və **detal paneli
açıqkən siyahını yeniləmir** — fokus və sürüşmə pozulmasın.

---

## 9. Ölçülmüş tələlər

Bu bölmə sənədin ən dəyərli hissəsidir: hər bənd **real ölçmə** ilə tapılıb.

### 9.1 Forma idarəediciləri sinif üzrə stillənməməlidir

Layihədə **qlobal `input {}` qaydası yoxdur** — stil yalnız `.field input`
altındadır. Sinifi unudulan hər sahə brauzer defaultunda qalır
(`border: 2px inset rgb(118,118,118)`, ağ fon). Ölçüldü: detal panelindəki
**yeddi sahə** belə idi. Həll: **tip üzrə** qayda
(`#page-tasks input/select/textarea`).

### 9.2 Yapışqan ofset ölçülməlidir

- `.ws-group { overflow: hidden }` yapışqan başlığı **tamamilə söndürürdü**:
  `overflow` dəyəri `visible`-dan fərqli olan ata element sticky üçün
  scrollport olur, o isə sürüşmür. Ölçüldü: başlıq 115px-də dayanmalı ikən
  **−204px**-də idi.
- Sabit ofset (`topbar + 58px`) idarə sətrinin **11px altında** qalırdı →
  `ResizeObserver` ilə `--ws-ctrl-h` ölçülür.
- Seçici dəqiq `.app-topbar` olmalıdır: `'header'` yazanda `querySelector`
  sənəddəki **birinci** `<header>`-i — gizli publik başlığı (hündürlük 0) —
  tapır və zolaq real topbar-ın altına sürüşür.

### 9.3 `:not()` spesifikliyi artırır

`#page-tasks input:not([type=checkbox]):not([type=file]):not([type=range])`
= **(1,3,1)** — `:not()` daxilindəki ən spesifik arqument sayılır. Bu,
`.ws-search > input` qaydasını (0,1,1) udurdu və `padding-left` 38px→10px
olurdu: **ikon placeholder mətninin üstünə düşürdü** (16px örtmə).

Həll spesifiklik yarışı **deyil**, istisna: `:not([type=search])`.

### 9.4 Digər tələlər

| Tələ | Nəticə | Həll |
|---|---|---|
| D1 `UNION ALL` ≤5 term | taymlayn icra vaxtı çökür | ayrı sorğular + JS birləşməsi |
| D1 bind sayı = ən böyük indeks | `?author=` əlavə olunanda **bütün lent 500** | şərti yer tutucu = şərti bind |
| Portal `:root`-dan kənar nişanları görmür | `color-mix` səssizcə atılır | nişanlar `:root`-da |
| `hidden` `display` qaydasına uduzur | boş toplu sətir görünür | `[hidden]{display:none}` açıq |
| `<button>` default rəngi | tünd temada mətn itir | `color` açıq |
| Grid-də dəyişkən element sayı | avatar ikinci sətrə düşür | flex + `order` |
| `flex-direction` mirası | sətir şaquli yığılır | açıq `row` |
| Mobil sütun məhdudiyyətsiz | səhifə 2277px uzanır | `max-height: 68vh` |
| az-AZ ICU `month:'long'` | «2026 M08» | `fmtMonthYear()` |
| `api()` FormData üçün `form` gözləyir | fayl boş gedir (400) | `form:`, `body:` yox |
| `batch()` ardıcıldır | `COUNT(*)+1` ikiqat sayır | `+1` yoxdur |
| Sinif toqquşması (`dr-card`) | məzmun mərkəzə yığılır | `dr-item` |
| `str.replace()` səssiz uğursuzluq | qayda faylda yaranmır | hər redaktədə `assert` |

---

## 10. Animasiya

| Hadisə | Müddət | Qeyd |
|---|---|---|
| Kart hover | `--mo-fast` | `translateY(-1px)` + kölgə |
| Sütun buraxma zonası | `--mo-fast` | haşiyə + fon |
| Detal paneli | `--mo-base` | sağdan sürüşmə |
| Filtr paneli | `--mo-base` | yuxarıdan düşmə / ≤768px alt vərəqə |
| Skelet | 1.3s sonsuz | `linear` |
| Sayğac (`countUp`) | 500ms | görünəndə |
| Yoxlama zolağı | `--mo-base` | eni |

`prefers-reduced-motion: reduce` → skelet, panel, vərəqə, transformlar söndürülür.

---

## 11. Əlçatanlıq

- Kart `<article tabindex="0">`, Enter/Space açır; `aria-label` = açar + başlıq.
- Görünüş keçidi `role="tablist"` + `aria-selected`.
- Filtr düyməsi `aria-expanded`.
- Prioritetin **ikonu** var — rəng tək siqnal deyil.
- Cədvəl sətri fokuslanır; mobil kart rejimində `td::before` sütun adını verir.
- Detal paneli `role="dialog"`, Escape bağlayır, fon örtüyü kliklə bağlanır.
- ≤768px: görünüş düymələri, sancaq və silmə `var(--tap)` = 44px.
- Ölçmə: layihənin responsive auditi — `touch: 0`, `text-clip: 0`.

---

## 12. Responsive

| Kəsim | Dəyişiklik |
|---|---|
| ≤1024 | sütun 260px, statistika 118px |
| ≤768 | başlıq şaquli; statistika **yan sürüşür**; sütun `max-height: 68vh`; filtr **alt vərəqə**; cədvəl **kart rejimi**; siyahıda layihə/status gizlənir; lövhə **kart olan ilk sütuna** sürüşür |
| ≤480 | sütun 84vw; Gantt ad sütunu 140px; `Ctrl K` nişanı gizlənir |

---

## 13. Açıq qalan bəndlər

- `e2e/workspace.spec.ts` yoxdur.
- Gantt-da **kritik yol** hesablanmır (asılılıq datası toplanır).
- Avtomatlaşdırma qaydaları **oxunur**, icra mühərriki qurulmayıb.
- Təkrarlanan tapşırıq (`recurrence`) sütunu var, planlayıcı yoxdur.
- Təqvim/Gantt-da sürüşdürmə ilə tarix dəyişmir.
- Şərhdə `@mention` avtomatik tamamlanması yoxdur.
- Çalışmalarda çətinlik səviyyəsi və teqlər yoxdur.

---

## 14. Dəyişiklik jurnalı

**Miqrasiya:** `0054_workspace.sql` (50 əmr)
**Yeni:** `worker/routes/workspace/` (3) · `js/workspace*.js` (3) ·
`js/drills.js` (yenidən quruldu) · `css/92-workspace.css` · `css/93-drills.css`
**Adı dəyişən:** `js/tasks.js` → `js/drills.js`; `#page-tasks` → iş sahəsi,
çalışmalar `#page-drills`-ə

**Tapılan və bağlanan qüsurlar (21)** — §9-da sadalanıb. Ən ağır üçü:

1. `/api/feed` **tamamilə çökmüşdü** (D1 bind sayı qaydası) — və onu doğuran
   səhv şərh də düzəldildi.
2. Detal paneli bağlananda **fon örtüyü qalırdı** və bütün səhifəni
   kliklənməz edirdi.
3. Sıravi komanda üzvü **kartı sürüşdürə bilmirdi** (403).

**Yoxlama:** typecheck ✓ · lint ✓ · 82 unit test ✓ · responsive audit
(overflow-x 0, element-overflow 0, touch 0, text-clip 0) ✓ ·
4 tema × 2 səhifə × 119 idarəedici → stilsiz 0 ·
prod: miqrasiya 56, `db: ok`, `xp_invariant: ok`.
