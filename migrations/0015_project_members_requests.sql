CREATE TABLE IF NOT EXISTS team_project_members (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'Member',
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY(project_id) REFERENCES team_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_project_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(project_id) REFERENCES team_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE users ADD COLUMN active_project_id TEXT REFERENCES team_projects(id) ON DELETE SET NULL;
