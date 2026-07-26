-- Team Workspace & Collaboration Platform Schema
-- Contains definitions for Teams, Roles, Projects, Tasks, Chat, Files, and Activity.

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  banner TEXT,
  visibility TEXT DEFAULT 'Private', -- Public, Private, Invite Only
  owner_id TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active, deleted
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE team_roles (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT NOT NULL, -- JSON object
  priority INTEGER DEFAULT 0,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  joined_at INTEGER NOT NULL,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(role_id) REFERENCES team_roles(id) ON DELETE CASCADE,
  UNIQUE(team_id, user_id)
);

CREATE TABLE team_invites (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  email TEXT,
  user_id TEXT,
  invited_by TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE team_projects (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  visibility TEXT DEFAULT 'Private',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE team_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  assignee_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'To Do',
  deadline INTEGER,
  estimated_hours INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(project_id) REFERENCES team_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE team_posts (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  visibility TEXT DEFAULT 'Team',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE team_chat_rooms (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'General',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE team_files (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT,
  size INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE team_activity (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata TEXT, -- JSON details
  created_at INTEGER NOT NULL,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE CASCADE
);
