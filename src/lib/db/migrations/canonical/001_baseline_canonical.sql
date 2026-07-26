-- PRD-05 Class B: idempotent baseline for the live multi-tenant Neon schema.
-- Canonical = shape used by src/lib/db.ts + event-service (NOT the Drizzle 4-table model).
-- Backup: snap-odd-dream-abwtma9w
-- Safe on existing DBs: CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS only.
-- Does NOT drop columns, backfill secrets, or purge rows (Class C/D out of scope).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  active_session_id TEXT,
  active_session_created_at TIMESTAMPTZ,
  account_status TEXT NOT NULL DEFAULT 'active',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_token TEXT,
  email_verification_expires TIMESTAMPTZ,
  email_verification_token_hash TEXT,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_admin_id UUID,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  device_id TEXT
);

CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  pin TEXT NOT NULL,
  access_code TEXT,
  bypass_token TEXT,
  access_code_hmac TEXT,
  access_code_hmac_version TEXT,
  bypass_token_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS display_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES user_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT,
  token_hash TEXT,
  token_prefix TEXT,
  uses_remaining INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  track_uri TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_name TEXT,
  album_image_url TEXT,
  duration_ms INTEGER,
  requester_ip_hash TEXT,
  requester_nickname TEXT,
  user_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by TEXT,
  rejection_reason TEXT,
  spotify_added_to_queue BOOLEAN DEFAULT FALSE,
  spotify_added_to_playlist BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  played_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Legacy username/password admins table (live bootstrap shape). Not Drizzle email-admins.
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS spotify_auth (
  id INTEGER PRIMARY KEY DEFAULT 1,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  scope TEXT,
  token_type TEXT DEFAULT 'Bearer',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  access_token_envelope TEXT,
  refresh_token_envelope TEXT,
  token_key_version TEXT,
  refresh_lock_version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS oauth_sessions (
  state TEXT PRIMARY KEY,
  code_verifier TEXT,
  code_verifier_encrypted TEXT,
  redirect_uri TEXT,
  user_id UUID,
  username TEXT,
  redirect_id TEXT DEFAULT 'admin_spotify',
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS event_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  event_title TEXT DEFAULT 'Party DJ Requests',
  dj_name TEXT DEFAULT '',
  venue_info TEXT DEFAULT '',
  welcome_message TEXT DEFAULT 'Request your favorite songs!',
  secondary_message TEXT DEFAULT '',
  tertiary_message TEXT DEFAULT '',
  show_qr_code BOOLEAN DEFAULT TRUE,
  display_refresh_interval INTEGER DEFAULT 20,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  event_title TEXT DEFAULT 'Party DJ Requests',
  dj_name TEXT DEFAULT '',
  venue_info TEXT DEFAULT '',
  welcome_message TEXT DEFAULT 'Request your favorite songs!',
  secondary_message TEXT DEFAULT '',
  tertiary_message TEXT DEFAULT '',
  show_qr_code BOOLEAN DEFAULT TRUE,
  display_refresh_interval INTEGER DEFAULT 20,
  admin_polling_interval INTEGER DEFAULT 15,
  display_polling_interval INTEGER DEFAULT 10,
  now_playing_polling_interval INTEGER DEFAULT 5,
  sse_update_interval INTEGER DEFAULT 2,
  request_limit INTEGER DEFAULT 10,
  auto_approve BOOLEAN DEFAULT FALSE,
  decline_explicit BOOLEAN DEFAULT FALSE,
  force_polling BOOLEAN DEFAULT FALSE,
  requests_page_enabled BOOLEAN DEFAULT TRUE,
  display_page_enabled BOOLEAN DEFAULT TRUE,
  message_text TEXT,
  message_duration INTEGER,
  secure_url_access BOOLEAN DEFAULT FALSE,
  display_mood TEXT,
  show_approval_messages BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE,
  token_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_session_id TEXT,
  message TEXT NOT NULL,
  type TEXT,
  shown BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT,
  user_id UUID,
  route TEXT,
  method TEXT,
  status_code INTEGER,
  message TEXT,
  stack TEXT,
  classification TEXT,
  fingerprint TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  meta JSONB
);

CREATE TABLE IF NOT EXISTS support_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT,
  user_id UUID,
  action TEXT NOT NULL,
  meta JSONB
);

CREATE TABLE IF NOT EXISTS spotify_playback_sync (
  user_id TEXT PRIMARY KEY,
  lease_until TIMESTAMPTZ,
  fingerprint TEXT,
  progress_ms INTEGER,
  is_playing BOOLEAN DEFAULT FALSE,
  snapshot_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cache_entries (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_active ON user_events(user_id, active);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_spotify_playback_sync_lease ON spotify_playback_sync(lease_until);
