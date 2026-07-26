-- PRD-06 Class B: distributed reliability / event data integrity (additive only).
-- Backup: snap-odd-dream-abwtma9w
-- Safe: ADD COLUMN IF NOT EXISTS / CREATE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Does NOT drop columns, backfill secrets, or purge rows (Class C/D out of scope).

-- Event lifecycle archive (organiser control event)
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Guest party session archive stamp (user_events already has ended_at in some envs)
ALTER TABLE user_events ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE user_events ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Requests: event scope, idempotency, archive, retention
ALTER TABLE requests ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS nickname_retain_until TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS queue_error_category TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS provider_operation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_requests_event_id ON requests(event_id);
CREATE INDEX IF NOT EXISTS idx_requests_user_event_status ON requests(user_id, event_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_event_idempotency
  ON requests(event_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_archived_at ON requests(archived_at)
  WHERE archived_at IS NOT NULL;

-- Provider operation ledger (Spotify queue uncertainty mitigation)
CREATE TABLE IF NOT EXISTS provider_operations (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID,
  request_id TEXT,
  provider TEXT NOT NULL DEFAULT 'spotify',
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT,
  error_category TEXT,
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_ops_user_idempotency
  ON provider_operations(user_id, operation, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_ops_request
  ON provider_operations(request_id)
  WHERE request_id IS NOT NULL;

-- Playback sync: explicit freshness / degraded metadata for multi-instance clients
ALTER TABLE spotify_playback_sync ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;
ALTER TABLE spotify_playback_sync ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE spotify_playback_sync ADD COLUMN IF NOT EXISTS degraded BOOLEAN NOT NULL DEFAULT FALSE;
