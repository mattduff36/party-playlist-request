-- PRD-07 Class B: playback provider abstraction + manual mode (additive / expand only).
-- Backup: snap-odd-dream-abwtma9w
-- Safe: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / DROP NOT NULL (expand).
-- Does NOT drop columns, backfill secrets, or purge rows (Class C/D out of scope).

-- Event / settings provider selection
ALTER TABLE events ADD COLUMN IF NOT EXISTS playback_mode TEXT NOT NULL DEFAULT 'spotify';
ALTER TABLE events ADD COLUMN IF NOT EXISTS manual_now_playing JSONB;
ALTER TABLE user_events ADD COLUMN IF NOT EXISTS playback_mode TEXT NOT NULL DEFAULT 'spotify';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS playback_mode TEXT NOT NULL DEFAULT 'spotify';

-- Provider-neutral request fields + app-owned queue
ALTER TABLE requests ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS provider_track_id TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS queue_position INTEGER;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS queue_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS dedication TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS normalized_track_key TEXT;

-- Expand: manual requests need not carry a Spotify URI (existing rows keep URIs)
ALTER TABLE requests ALTER COLUMN track_uri DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_user_queue_position
  ON requests(user_id, queue_position)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_requests_user_normalized_track
  ON requests(user_id, normalized_track_key)
  WHERE normalized_track_key IS NOT NULL AND archived_at IS NULL;
