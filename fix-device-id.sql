-- Quick fix: Add missing device_id column to events table
-- Run this directly on your Neon database

ALTER TABLE events ADD COLUMN IF NOT EXISTS device_id TEXT;

COMMENT ON COLUMN events.device_id IS 'Spotify device ID for playback control';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name = 'device_id';


