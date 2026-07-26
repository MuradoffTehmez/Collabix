-- Nümunə/demo komanda (lokal dev + E2E dəsti üçün).
--
-- ⚠ FAYL ADI DƏYİŞMƏMƏLİDİR: bu miqrasiya artıq tətbiq olunub və wrangler
-- tətbiq olunmuşları FAYL ADINA görə izləyir. Ad dəyişsə miqrasiya təkrar
-- işləyər. Ona görə BÜTÜN INSERT-lər `OR IGNORE`-dur — təkrar icra zərərsizdir.
-- (0015/0016 nömrələri iki faylda təkrarlanır; wrangler əlifba sırası ilə
--  tətbiq edir və hazırkı sıra düzgündür — bax docs/TASK-11-REPORT.md §3.10.)
INSERT OR IGNORE INTO users (id, username, name, xp, joined_at, pass_hash, pass_salt)
VALUES ('team_owner_123', 'teamowner_123', 'Team Owner', 100, 1700000000000, 'hash', 'salt');

INSERT OR IGNORE INTO teams (id, slug, name, description, owner_id, status, created_at, updated_at)
VALUES ('team_1', 'alpha-team', 'Alpha Team', 'This is a test team for development.', 'team_owner_123', 'active', 1700000000000, 1700000000000);

INSERT OR IGNORE INTO team_roles (id, team_id, name, permissions, priority)
VALUES ('role_1', 'team_1', 'Admin', '["manage_projects", "manage_tasks", "manage_members"]', 10);

INSERT OR IGNORE INTO team_members (id, team_id, user_id, role_id, status, joined_at)
VALUES ('member_1', 'team_1', 'team_owner_123', 'role_1', 'active', 1700000000000);

INSERT OR IGNORE INTO team_projects (id, team_id, name, description, created_by, created_at)
VALUES ('proj_1', 'team_1', 'Collabix V2', 'Next gen features', 'team_owner_123', 1700000000000);

INSERT OR IGNORE INTO team_tasks (id, project_id, assignee_id, title, status, created_at)
VALUES ('task_1', 'proj_1', 'team_owner_123', 'Design UI', 'To Do', 1700000000000);

INSERT OR IGNORE INTO team_chat_rooms (id, team_id, name, type, created_at)
VALUES ('tcr_1', 'team_1', 'General', 'General', 1700000000000);
