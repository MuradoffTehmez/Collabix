-- TASK-11 düzəlişləri (docs/TASK-11-REPORT.md).
-- Team XP/Reputation, dəvətdə rol seçimi, fayl kateqoriyaları və indekslər.

-- Komanda səviyyəsində XP (PDR: Task +20, Bug +30, Project +100, Hackathon +500).
-- Frontend `team.total_xp` oxuyurdu, belə sütun yox idi → həmişə 0 görünürdü.
ALTER TABLE teams ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;

-- Dəvət yaradılarkən rol seçilə bilsin. NULL → default üzv rolu (Developer).
-- Əvvəl rol "ən aşağı prioritet" ilə seçilirdi və yeni komandada yeganə rol
-- Owner olduğu üçün dəvət qəbul edən tam səlahiyyət alırdı (K1).
ALTER TABLE team_invites ADD COLUMN role_id TEXT;
ALTER TABLE team_invites ADD COLUMN created_at INTEGER;
ALTER TABLE team_invites ADD COLUMN token TEXT;

-- R2 qovluq strukturu: /teams/{team_id}/{category}/...
ALTER TABLE team_files ADD COLUMN category TEXT NOT NULL DEFAULT 'documents';

-- Sahiblik köçürülməsinin izi + komanda üzvlərinin sürətli oxunuşu.
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_activity_team ON team_activity(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_projects_team ON team_projects(team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_tasks_project ON team_tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_team_posts_team ON team_posts(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_files_team ON team_files(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_invites_team ON team_invites(team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email, status);
CREATE INDEX IF NOT EXISTS idx_team_invites_user ON team_invites(user_id, status);
CREATE INDEX IF NOT EXISTS idx_team_roles_team ON team_roles(team_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_teams_visibility ON teams(visibility, status);

-- Mövcud dəvətlərə yaradılma vaxtı (expires_at - 7 gün).
UPDATE team_invites SET created_at = expires_at - 604800 WHERE created_at IS NULL;

-- Köhnə komandalarda görünürlük yazılışını vahidləşdir ('public' → 'Public').
UPDATE teams SET visibility = 'Public'  WHERE lower(visibility) = 'public';
UPDATE teams SET visibility = 'Private' WHERE lower(visibility) = 'private';
UPDATE teams SET visibility = 'Invite'  WHERE lower(visibility) IN ('invite', 'invite only', 'invite_only');
UPDATE team_projects SET visibility = 'Public'  WHERE lower(visibility) = 'public';
UPDATE team_projects SET visibility = 'Private' WHERE lower(visibility) = 'private';
