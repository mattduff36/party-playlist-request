-- Migration: 7-Table to 4-Table Schema Migration
-- This migration transforms the existing 7-table schema into the new 4-table design

-- Step 1: Create backup tables (rename existing tables)
ALTER TABLE requests RENAME TO requests_old;
ALTER TABLE settings RENAME TO settings_old;
ALTER TABLE admins RENAME TO admins_old;
ALTER TABLE spotify_auth RENAME TO spotify_auth_old;
ALTER TABLE event_settings RENAME TO event_settings_old;
ALTER TABLE oauth_sessions RENAME TO oauth_sessions_old;
ALTER TABLE notifications RENAME TO notifications_old;

-- Step 2: Create new 4-table schema
-- (This will be handled by the Drizzle migration 0000_nervous_the_renegades.sql)

-- Step 3: Migrate data from old tables to new schema

-- 3.1: Create events table with data from event_settings and settings
INSERT INTO events (id, status, version, config, updated_at)
SELECT 
  gen_random_uuid(),
  CASE 
    WHEN es.requests_page_enabled = true AND es.display_page_enabled = true THEN 'live'
    WHEN es.requests_page_enabled = false AND es.display_page_enabled = false THEN 'offline'
    ELSE 'standby'
  END as status,
  0 as version,
  jsonb_build_object(
    'pages_enabled', jsonb_build_object(
      'requests', COALESCE(es.requests_page_enabled, false),
      'display', COALESCE(es.display_page_enabled, false)
    ),
    'event_title', COALESCE(es.event_title, 'Party DJ Requests'),
    'dj_name', COALESCE(es.dj_name, ''),
    'venue_info', COALESCE(es.venue_info, ''),
    'welcome_message', COALESCE(es.welcome_message, 'Request your favorite songs!'),
    'secondary_message', COALESCE(es.secondary_message, 'Your requests will be reviewed by the DJ'),
    'tertiary_message', COALESCE(es.tertiary_message, 'Keep the party going!'),
    'show_qr_code', COALESCE(es.show_qr_code, true),
    'request_limit', COALESCE(es.request_limit, 10),
    'auto_approve', COALESCE(es.auto_approve, false),
    'message_text', es.message_text,
    'message_duration', es.message_duration,
    'message_created_at', es.message_created_at,
    'party_playlist_id', COALESCE(s_party.value, ''),
    'target_device_id', COALESCE(s_device.value, ''),
    'party_name', COALESCE(s_name.value, 'Party DJ Requests'),
    'max_requests_per_ip_per_hour', COALESCE(s_max.value, '10'),
    'request_cooldown_seconds', COALESCE(s_cooldown.value, '30')
  ) as config,
  COALESCE(es.updated_at, CURRENT_TIMESTAMP) as updated_at
FROM event_settings_old es
LEFT JOIN settings_old s_party ON s_party.key = 'party_playlist_id'
LEFT JOIN settings_old s_device ON s_device.key = 'target_device_id'
LEFT JOIN settings_old s_name ON s_name.key = 'party_name'
LEFT JOIN settings_old s_max ON s_max.key = 'max_requests_per_ip_per_hour'
LEFT JOIN settings_old s_cooldown ON s_cooldown.key = 'request_cooldown_seconds'
WHERE es.id = 1;

-- 3.2: Migrate admins (username → email)
INSERT INTO admins (id, email, password_hash, name, created_at)
SELECT 
  id,
  username as email,  -- Assuming username is email
  password_hash,
  username as name,   -- Use username as name initially
  created_at
FROM admins_old;

-- 3.3: Create spotify_tokens (one-to-one with first admin)
INSERT INTO spotify_tokens (admin_id, access_token, refresh_token, expires_at, scope, updated_at)
SELECT 
  (SELECT id FROM admins LIMIT 1) as admin_id,
  access_token,
  refresh_token,
  expires_at,
  scope,
  updated_at
FROM spotify_auth_old
WHERE id = 1;

-- 3.4: Update events table with active admin
UPDATE events 
SET active_admin_id = (SELECT id FROM admins LIMIT 1)
WHERE active_admin_id IS NULL;

-- 3.5: Migrate requests with event relationship and enhanced track data
INSERT INTO requests (id, event_id, track_id, track_data, submitted_by, status, idempotency_key, created_at, approved_at, rejected_at, played_at)
SELECT 
  r.id,
  (SELECT id FROM events LIMIT 1) as event_id,  -- Link to single event
  r.track_uri as track_id,
  jsonb_build_object(
    'id', r.track_uri,
    'uri', r.track_uri,
    'name', r.track_name,
    'artists', jsonb_build_array(
      jsonb_build_object('name', r.artist_name, 'id', '')
    ),
    'album', jsonb_build_object(
      'name', COALESCE(r.album_name, ''),
      'id', '',
      'images', jsonb_build_array()
    ),
    'duration_ms', r.duration_ms,
    'explicit', false,
    'external_urls', jsonb_build_object('spotify', ''),
    'preview_url', null
  ) as track_data,
  COALESCE(r.requester_nickname, 'Anonymous') as submitted_by,
  CASE 
    WHEN r.status = 'queued' THEN 'approved'
    WHEN r.status = 'failed' THEN 'rejected'
    ELSE r.status
  END as status,
  r.requester_ip_hash as idempotency_key,
  r.created_at,
  r.approved_at,
  CASE WHEN r.status = 'rejected' THEN r.created_at ELSE NULL END as rejected_at,
  CASE WHEN r.status = 'played' THEN r.approved_at ELSE NULL END as played_at
FROM requests_old r;

-- Step 4: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_updated_at ON events(updated_at);
CREATE INDEX IF NOT EXISTS idx_requests_event_id ON requests(event_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_event_status ON requests(event_id, status);
CREATE INDEX IF NOT EXISTS idx_spotify_tokens_admin_id ON spotify_tokens(admin_id);

-- Step 5: Clean up old tables (commented out for safety - uncomment after validation)
-- DROP TABLE IF EXISTS requests_old;
-- DROP TABLE IF EXISTS settings_old;
-- DROP TABLE IF EXISTS admins_old;
-- DROP TABLE IF EXISTS spotify_auth_old;
-- DROP TABLE IF EXISTS event_settings_old;
-- DROP TABLE IF EXISTS oauth_sessions_old;
-- DROP TABLE IF EXISTS notifications_old;
