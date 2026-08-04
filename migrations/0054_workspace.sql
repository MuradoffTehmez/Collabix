-- İş sahəsi (Tapşırıqlar) — müəssisə səviyyəli layihə idarəetməsi.
--
-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 HANSI TAPŞIRIQ SİSTEMİ
-- ════════════════════════════════════════════════════════════════════════════
--
-- Repoda İKİ ayrı "tapşırıq" var və onları qarışdırmaq ən böyük risk idi:
--
--   `tasks` + `submissions`        `team_tasks`  ← BU FAYL
--   ─────────────────────────      ────────────────────────────
--   öyrənmə çalışması              layihə tapşırığı
--   kateqoriya, həll göndərmə      layihə, təyinat, prioritet
--   status: pending/approved       status: To Do…Done
--   admin XP verir                 tamamlanma XP verir
--
-- Spesifikasiya (Linear/Jira/ClickUp) İKİNCİSİNİN anlayışıdır. Çalışma
-- sistemi TOXUNULMUR — o, öz sxemi ilə «Çalışmalar» səhifəsinə köçür.
--
-- ⚠ MÖVCUD SÜTUNLAR SAXLANILIR: `estimated_hours`, `deadline`, `priority`,
--   `status` olduğu kimi qalır və `TeamTaskService` işləməyə davam edir.
--   Yeni sütunlar YALNIZ ƏLAVƏDİR — komanda səhifəsindəki mövcud tapşırıq
--   siyahısı sınmamalıdır.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. TEAM_TASKS GENİŞLƏNMƏSİ
-- ════════════════════════════════════════════════════════════════════════════

-- İnsan-oxunaqlı açar (PRJ-12). UI-da tapşırığa istinad üçün lazımdır:
-- UUID danışıqda və şərhdə işlənə bilmir.
ALTER TABLE team_tasks ADD COLUMN task_key TEXT;

-- Alt-tapşırıq: valideyn tapşırıq.
-- ⚠ FK QOYULMUR: SQLite `ALTER TABLE` ilə FK əlavə etmir. Bütövlük tətbiq
--   qatındadır — valideyn silinəndə uşaqlar kök tapşırığa çevrilir.
ALTER TABLE team_tasks ADD COLUMN parent_id TEXT;

-- Sprint bağlantısı (aşağıdakı `sprints` cədvəli).
ALTER TABLE team_tasks ADD COLUMN sprint_id TEXT;

-- Kanban sütunu daxilində SIRA. Sürüşdürmə (drag & drop) yalnız bununla
-- sabit qala bilər — `created_at` ilə sıralasaydıq istifadəçinin əl ilə
-- verdiyi sıra hər yenilənmədə itərdi.
--
-- ⚠ REAL (float): iki kartın ARASINA buraxmaq üçün orta ədəd kifayətdir
--   (`(a+b)/2`), yəni bütün sütunu yenidən nömrələmək lazım gəlmir.
ALTER TABLE team_tasks ADD COLUMN position REAL NOT NULL DEFAULT 0;

-- Vaxt izləmə: təxmin DƏQİQƏ ilə (mövcud `estimated_hours` saatdır və
-- 30 dəqiqəlik işi ifadə edə bilmirdi), sərf olunan isə `task_time_logs`
-- cəmindən denormallaşdırılır.
ALTER TABLE team_tasks ADD COLUMN estimated_minutes INTEGER;
ALTER TABLE team_tasks ADD COLUMN spent_minutes INTEGER NOT NULL DEFAULT 0;

-- Planlama: başlama tarixi (Gantt zolağının solu; `deadline` sağıdır).
ALTER TABLE team_tasks ADD COLUMN start_date INTEGER;

-- Həyat dövrü nişanları.
ALTER TABLE team_tasks ADD COLUMN completed_at INTEGER;
ALTER TABLE team_tasks ADD COLUMN archived_at INTEGER;
ALTER TABLE team_tasks ADD COLUMN created_by TEXT;

-- Təkrarlanma qaydası — boş = təkrarlanmır. Forma: 'daily' | 'weekly:1,3' |
-- 'monthly:15'. Sadə mətn, çünki tam cron sintaksisi burada həddindən artıqdır.
ALTER TABLE team_tasks ADD COLUMN recurrence TEXT NOT NULL DEFAULT '';

-- Denormallaşdırılmış sayğaclar — kartın üzərində göstərilir.
-- ⚠ `posts.like_count` naxışı: kartlar səhifə-səhifə gəlir və hər kart üçün
--   ayrıca COUNT(*) N+1 olardı (Kanban-da 7 sütun × 20 kart = 140 sorğu).
ALTER TABLE team_tasks ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE team_tasks ADD COLUMN attach_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE team_tasks ADD COLUMN check_total   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE team_tasks ADD COLUMN check_done    INTEGER NOT NULL DEFAULT 0;

-- Mövcud sətirlərə açar və sıra verilir.
-- ⚠ `rowid` işlədilir: `ROW_NUMBER()` D1-in bu qurulmasında etibarlı deyil,
--   `rowid` isə hər SQLite cədvəlində var və unikaldır.
UPDATE team_tasks SET task_key = 'T-' || rowid WHERE task_key IS NULL;
UPDATE team_tasks SET position = rowid WHERE position = 0;
UPDATE team_tasks SET estimated_minutes = estimated_hours * 60
 WHERE estimated_minutes IS NULL AND estimated_hours IS NOT NULL;
UPDATE team_tasks SET completed_at = COALESCE(updated_at, created_at)
 WHERE completed_at IS NULL AND status = 'Done';

-- İş sahəsi sorğuları: "mənim bütün komandalarımdakı tapşırıqlar".
CREATE INDEX IF NOT EXISTS ix_tt_assignee_status ON team_tasks(assignee_id, status, deadline);
CREATE INDEX IF NOT EXISTS ix_tt_project_pos     ON team_tasks(project_id, status, position);
CREATE INDEX IF NOT EXISTS ix_tt_sprint          ON team_tasks(sprint_id, status);
CREATE INDEX IF NOT EXISTS ix_tt_deadline        ON team_tasks(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tt_parent          ON team_tasks(parent_id) WHERE parent_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. SPRINTLƏR
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ SPRINT KOMANDAYA AİDDİR, LAYİHƏYƏ YOX: bir sprint çox vaxt bir neçə
--   layihəni əhatə edir (Jira/Linear modeli). Layihəyə bağlasaydıq,
--   "bu iki həftədə nə edirik?" sualı layihə sayı qədər parçalanardı.
CREATE TABLE IF NOT EXISTS sprints (
  id         TEXT PRIMARY KEY,
  team_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  goal       TEXT NOT NULL DEFAULT '',
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  -- 'planned' | 'active' | 'completed'
  status     TEXT NOT NULL DEFAULT 'planned',
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sprints_team ON sprints(team_id, starts_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. ETİKETLƏR
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ ETİKET KOMANDA SƏVİYYƏSİNDƏDİR: hər layihədə eyni etiketi yenidən
--   yaratmaq lazım olsaydı, filtr komanda üzrə işləməzdi.
CREATE TABLE IF NOT EXISTS task_labels (
  id       TEXT PRIMARY KEY,
  team_id  TEXT NOT NULL,
  name     TEXT NOT NULL,
  -- Nişan açarı, xam hex YOX: rəng 4 temada uyğun olmalıdır (profil örtüyü
  -- ilə eyni qərar). Ağ siyahı tətbiq qatındadır.
  color    TEXT NOT NULL DEFAULT 'slate',
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_task_labels ON task_labels(team_id, name);

CREATE TABLE IF NOT EXISTS task_label_links (
  task_id  TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (task_id, label_id)
);
CREATE INDEX IF NOT EXISTS ix_tll_label ON task_label_links(label_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. YOXLAMA SİYAHISI
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ ALT-TAPŞIRIQDAN FƏRQLİDİR: yoxlama bəndinin təyinatı, statusu, tarixi
--   YOXDUR — o, bir tapşırığın daxili addımıdır. Alt-tapşırıq isə tam
--   hüquqlu tapşırıqdır (`team_tasks.parent_id`). İkisini birləşdirmək
--   ya yoxlama siyahısını ağırlaşdırardı, ya alt-tapşırığı kasıblaşdırardı.
CREATE TABLE IF NOT EXISTS task_checklist (
  id        TEXT PRIMARY KEY,
  task_id   TEXT NOT NULL,
  parent_id TEXT,                       -- iç-içə yoxlama (bir səviyyə)
  text      TEXT NOT NULL,
  done      INTEGER NOT NULL DEFAULT 0,
  position  REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_checklist_task ON task_checklist(task_id, position);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. ŞƏRHLƏR
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_comments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL,
  author_id  TEXT NOT NULL,
  parent_id  TEXT,                      -- bir səviyyəli cavab (post rəyləri ilə eyni model)
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  edited_at  INTEGER
);
CREATE INDEX IF NOT EXISTS ix_tcomments_task ON task_comments(task_id, created_at);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. QOŞMALAR
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ R2 AÇARI `team_files` NAXIŞI İLƏ: fayl serveri onsuz da komanda
--   sahəsindədir və icazə yoxlaması oradan gəlir (AUDIT C-1 dərsi —
--   `/files/` prefiksi TƏK BAŞINA icazə demək deyil).
CREATE TABLE IF NOT EXISTS task_attachments (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  r2_key      TEXT NOT NULL,
  name        TEXT NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  mime        TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tattach_task ON task_attachments(task_id, created_at);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. İZLƏYİCİLƏR
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_watchers (
  task_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_watchers_user ON task_watchers(user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. ASILILIQLAR
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ DÖVR (cycle) TƏTBİQ QATINDA BAĞLANIR: SQLite-da rekursiv yoxlama
--   `CHECK` ilə mümkün deyil. A→B→A yaradılması Gantt-ın kritik yolunu
--   sonsuz döngüyə salardı.
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id       TEXT NOT NULL,   -- bu tapşırıq
  depends_on_id TEXT NOT NULL,   -- bundan asılıdır (əvvəl bitməlidir)
  kind          TEXT NOT NULL DEFAULT 'blocks',
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (task_id, depends_on_id)
);
CREATE INDEX IF NOT EXISTS ix_deps_target ON task_dependencies(depends_on_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. VAXT JURNALI
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ AÇIQ SESSİYA: `ended_at IS NULL` = taymer İŞLƏYİR. İstifadəçi başına
--   yalnız BİR açıq sessiya ola bilər (qismi unikal indeks) — əks halda
--   iki tapşırıqda eyni vaxt sayılardı.
CREATE TABLE IF NOT EXISTS task_time_logs (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  minutes    INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  ended_at   INTEGER,
  note       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_timelogs_task ON task_time_logs(task_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_timelog_open ON task_time_logs(user_id) WHERE ended_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. FƏALİYYƏT JURNALI
-- ════════════════════════════════════════════════════════════════════════════
--
-- Tapşırığın "tarixçə" bölməsi. `activities` cədvəlindən AYRIDIR: ora
-- istifadəçi profilinin taymlaynı yazılır, bura isə tapşırıq üzrə dəyişiklik.
CREATE TABLE IF NOT EXISTS task_activity (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL,
  actor_id   TEXT NOT NULL,
  -- 'created' | 'status' | 'assignee' | 'priority' | 'due' | 'sprint'
  -- | 'label' | 'comment' | 'attach' | 'time' | 'checklist'
  kind       TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tactivity_task ON task_activity(task_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 11. AVTOMATLAŞDIRMA QAYDALARI
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ MÜHƏRRİK SERVERDƏ İCRA OLUNUR (`worker/services/workspace/automation.ts`).
--   Qayda client-də saxlanılsaydı istifadəçi özünə istənilən status/təyinat
--   verə bilərdi.
CREATE TABLE IF NOT EXISTS task_automations (
  id         TEXT PRIMARY KEY,
  team_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  -- 'created' | 'status_changed' | 'due_soon'
  trigger    TEXT NOT NULL,
  -- JSON: {"status":"Done"} kimi şərt
  conditions TEXT NOT NULL DEFAULT '{}',
  -- JSON: {"setStatus":"Review","assign":"<uid>","addLabel":"<id>"}
  actions    TEXT NOT NULL DEFAULT '{}',
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_automations_team ON task_automations(team_id, trigger, enabled);

-- ════════════════════════════════════════════════════════════════════════════
-- 12. SAXLANILMIŞ FİLTRLƏR
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_saved_views (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  -- Sorğu sətri (query string) — UI onu olduğu kimi bərpa edir.
  query      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_saved_views_user ON task_saved_views(user_id, created_at DESC);
