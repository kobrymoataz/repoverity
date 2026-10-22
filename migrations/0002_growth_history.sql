PRAGMA foreign_keys=ON;

-- V1.7 history is strictly opt-in. A watchlist entry alone never starts collection.
CREATE TABLE IF NOT EXISTS growth_targets (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(github_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('profile','repository')),
  resource TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  next_due_at INTEGER NOT NULL,
  last_attempt_at INTEGER,
  last_success_at INTEGER,
  last_status TEXT NOT NULL DEFAULT 'pending' CHECK(last_status IN ('pending','ok','limited','not_found','error')),
  UNIQUE(user_id,kind,resource)
);
CREATE INDEX IF NOT EXISTS idx_growth_targets_owner ON growth_targets(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_growth_targets_due ON growth_targets(next_due_at);

-- One measurement per UTC day per target. No dates are synthesized or backfilled.
CREATE TABLE IF NOT EXISTS growth_observations (
  target_id TEXT NOT NULL REFERENCES growth_targets(id) ON DELETE CASCADE,
  observed_day TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  followers INTEGER,
  public_repos INTEGER,
  stars INTEGER,
  forks INTEGER,
  PRIMARY KEY(target_id,observed_day),
  CHECK(followers IS NULL OR followers >= 0),
  CHECK(public_repos IS NULL OR public_repos >= 0),
  CHECK(stars IS NULL OR stars >= 0),
  CHECK(forks IS NULL OR forks >= 0)
);
CREATE INDEX IF NOT EXISTS idx_growth_observations_time ON growth_observations(observed_at);

-- On-site milestones only, never a claim that an email or push was delivered.
CREATE TABLE IF NOT EXISTS growth_milestones (
  target_id TEXT NOT NULL REFERENCES growth_targets(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK(metric IN ('followers','stars')),
  threshold INTEGER NOT NULL,
  observed_at INTEGER NOT NULL,
  PRIMARY KEY(target_id,metric,threshold)
);
