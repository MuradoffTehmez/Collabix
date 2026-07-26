-- Collabix D1 sxeması (Firestore kolleksiyalarının relyasion ekvivalenti)
-- Vaxtlar: epoch millisaniyə (INTEGER). JSON sahələri TEXT-də saxlanılır.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  age INTEGER DEFAULT 18,
  birth_date TEXT DEFAULT '',
  gender TEXT DEFAULT '',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  photo_url TEXT,
  prog_levels TEXT DEFAULT '{}',
  lang_levels TEXT DEFAULT '{}',
  goals TEXT DEFAULT '',
  looking_for TEXT DEFAULT '[]',
  instagram TEXT DEFAULT '',
  github TEXT DEFAULT '',
  linkedin TEXT DEFAULT '',
  telegram TEXT DEFAULT '',
  website TEXT DEFAULT '',
  streak INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  last_active_day TEXT DEFAULT '',
  last_active_at INTEGER DEFAULT 0,
  activity_days TEXT DEFAULT '{}',
  joined_at INTEGER NOT NULL,
  blocked INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user',
  settings TEXT DEFAULT '{}',
  must_reset_password INTEGER DEFAULT 0,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  blocks TEXT DEFAULT '[]',
  image_keys TEXT DEFAULT '[]',
  text TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  edited_at INTEGER
);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_author ON posts(author_id);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_comments_post ON comments(post_id, created_at);

CREATE TABLE likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_likes_user ON likes(user_id);

CREATE TABLE bookmarks (
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE follows (
  follower_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, target_id)
);
CREATE INDEX idx_follows_target ON follows(target_id);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT DEFAULT 'system',
  created_at INTEGER NOT NULL
);

CREATE TABLE room_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  text TEXT DEFAULT '',
  file_key TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  language TEXT,
  created_at INTEGER NOT NULL,
  edited_at INTEGER
);
CREATE INDEX idx_roommsg ON room_messages(room_id, created_at);

CREATE TABLE dm_threads (
  pair_id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  last_msg TEXT DEFAULT '',
  last_from TEXT DEFAULT '',
  last_at INTEGER DEFAULT 0,
  read_a INTEGER DEFAULT 0,
  read_b INTEGER DEFAULT 0
);
CREATE INDEX idx_dmthreads_a ON dm_threads(user_a, last_at DESC);
CREATE INDEX idx_dmthreads_b ON dm_threads(user_b, last_at DESC);

CREATE TABLE dm_messages (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES dm_threads(pair_id) ON DELETE CASCADE,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  text TEXT DEFAULT '',
  file_key TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  language TEXT,
  created_at INTEGER NOT NULL,
  edited_at INTEGER
);
CREATE INDEX idx_dmmsg ON dm_messages(pair_id, created_at);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  descr TEXT NOT NULL,
  category TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_by_name TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  approved_by TEXT,
  approved_at INTEGER
);
CREATE INDEX idx_tasks_status ON tasks(status, created_at DESC);

CREATE TABLE submissions (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT DEFAULT '',
  name TEXT DEFAULT '',
  task_title TEXT DEFAULT '',
  category TEXT DEFAULT '',
  text TEXT DEFAULT '',
  link TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  submitted_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX idx_sub_user ON submissions(user_id);
CREATE INDEX idx_sub_status ON submissions(status);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  reporter_name TEXT DEFAULT '',
  target_id TEXT NOT NULL,
  target_username TEXT DEFAULT '',
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at INTEGER NOT NULL
);

CREATE TABLE admins (
  user_id TEXT PRIMARY KEY,
  added_at INTEGER NOT NULL,
  added_by TEXT DEFAULT ''
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  from_id TEXT DEFAULT '',
  from_name TEXT DEFAULT '',
  post_id TEXT,
  text TEXT DEFAULT '',
  read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

CREATE TABLE taxonomies (
  type TEXT NOT NULL,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  flag TEXT,
  highlight_id TEXT,
  sort_order INTEGER DEFAULT 99,
  active INTEGER DEFAULT 1,
  PRIMARY KEY (type, id)
);

CREATE TABLE faqs (
  id TEXT PRIMARY KEY,
  q TEXT NOT NULL,
  a TEXT NOT NULL,
  category TEXT DEFAULT 'usage',
  sort_order INTEGER DEFAULT 99,
  active INTEGER DEFAULT 1,
  created_at INTEGER
);

CREATE TABLE testimonials (
  id TEXT PRIMARY KEY,
  author_name TEXT NOT NULL,
  author_title TEXT DEFAULT '{}',
  text TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  featured INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE newsletter (
  email TEXT PRIMARY KEY,
  lang TEXT DEFAULT 'az',
  created_at INTEGER NOT NULL
);

CREATE TABLE contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE admin_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_id TEXT DEFAULT '',
  by_id TEXT NOT NULL,
  by_name TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE progress (
  user_id TEXT NOT NULL,
  field TEXT NOT NULL,
  posts INTEGER DEFAULT 0,
  tasks INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, field)
);

CREATE TABLE presence (
  user_id TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);
