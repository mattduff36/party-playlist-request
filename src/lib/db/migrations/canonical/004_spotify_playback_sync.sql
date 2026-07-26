-- PRD-05 Class B: playback sync + cache tables (formerly request-time DDL).

CREATE TABLE IF NOT EXISTS spotify_playback_sync (
  user_id TEXT PRIMARY KEY,
  lease_until TIMESTAMPTZ,
  fingerprint TEXT,
  progress_ms INTEGER,
  is_playing BOOLEAN DEFAULT FALSE,
  snapshot_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spotify_playback_sync_lease
  ON spotify_playback_sync(lease_until);

CREATE TABLE IF NOT EXISTS cache_entries (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_expires
  ON cache_entries(expires_at);
