PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
  github_id INTEGER PRIMARY KEY,
  login TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL REFERENCES users(github_id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(github_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiration ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(github_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);

CREATE TABLE IF NOT EXISTS watchlist (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY(workspace_id,repo_full_name)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_workspace ON watchlist(workspace_id);

CREATE TABLE IF NOT EXISTS preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(github_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
