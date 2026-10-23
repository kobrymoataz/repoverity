PRAGMA foreign_keys=ON;

-- Private user-owned planning notes. No GitHub issues or pull requests are modified.
CREATE TABLE IF NOT EXISTS maintainer_queue (
  user_id INTEGER NOT NULL REFERENCES users(github_id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('issue','pull')),
  item_number INTEGER NOT NULL CHECK(item_number BETWEEN 1 AND 999999999),
  stage TEXT NOT NULL CHECK(stage IN ('inbox','next','waiting','done')),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 600),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id,repo_full_name,kind,item_number)
);
CREATE INDEX IF NOT EXISTS idx_maintainer_queue_user_time ON maintainer_queue (user_id,updated_at DESC);
