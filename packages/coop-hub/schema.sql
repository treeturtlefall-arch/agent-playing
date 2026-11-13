CREATE TABLE IF NOT EXISTS guests (
  agent_id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  title TEXT NOT NULL,
  target_axis TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reached_floor INTEGER NOT NULL,
  epitaph TEXT NOT NULL,
  avatar_base64 TEXT NOT NULL,
  guest_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guests_updated_at ON guests(updated_at DESC);
