-- Create admins table first (no dependencies)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create events table (without foreign key first)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'standby', 'live')),
  version INTEGER NOT NULL DEFAULT 0,
  active_admin_id UUID,
  device_id TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create spotify_tokens table (without foreign key first)
CREATE TABLE IF NOT EXISTS spotify_tokens (
  admin_id UUID PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create requests table (without foreign key first)
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  track_id TEXT NOT NULL,
  track_data JSONB NOT NULL,
  submitted_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'played')),
  idempotency_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  played_at TIMESTAMP WITH TIME ZONE
);

-- Skip foreign key constraints for now - they can be added later

-- Insert a default event
INSERT INTO events (id, status, version, config) 
VALUES (
  gen_random_uuid(),
  'offline',
  0,
  '{
    "pages_enabled": {
      "requests": false,
      "display": false
    },
    "event_title": "Party DJ Requests",
    "welcome_message": "Welcome to the party!",
    "secondary_message": "Request your favorite songs",
    "tertiary_message": "Have fun!"
  }'
) ON CONFLICT DO NOTHING;
