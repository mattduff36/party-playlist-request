-- PRD programme Class B: align live Neon user_events with code that stamps updated_at.
-- Backup: snap-odd-dream-abwtma9w
-- Root cause: baseline CREATE IF NOT EXISTS skipped column add on pre-existing user_events
-- (live table had created_at/started_at but never updated_at). setPlaybackMode and related
-- paths write updated_at = NOW() and fail Guided setup when the column is missing.
-- Safe: ADD COLUMN IF NOT EXISTS only. No drops / Class C/D.

ALTER TABLE user_events
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill nulls for any rows created before DEFAULT applied on existing rows
UPDATE user_events
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;
