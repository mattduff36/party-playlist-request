-- Add device_id column to events table
-- This column stores the Spotify device ID for playback control

ALTER TABLE events
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN events.device_id IS 'Spotify device ID for playback control';

-- No index needed as this column is rarely queried directly


