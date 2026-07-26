-- Durable Spotify sync: cross-instance coalesce lease + playback fingerprint
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
