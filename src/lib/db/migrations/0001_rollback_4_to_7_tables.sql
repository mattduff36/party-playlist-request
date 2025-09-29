-- Rollback Migration: 4-Table to 7-Table Schema Rollback
-- This rollback restores the original 7-table schema from the new 4-table design

-- Step 1: Restore old tables from backup
ALTER TABLE requests_old RENAME TO requests;
ALTER TABLE settings_old RENAME TO settings;
ALTER TABLE admins_old RENAME TO admins;
ALTER TABLE spotify_auth_old RENAME TO spotify_auth;
ALTER TABLE event_settings_old RENAME TO event_settings;
ALTER TABLE oauth_sessions_old RENAME TO oauth_sessions;
ALTER TABLE notifications_old RENAME TO notifications;

-- Step 2: Drop new 4-table schema
DROP TABLE IF EXISTS requests_new;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS admins_new;
DROP TABLE IF EXISTS spotify_tokens;

-- Step 3: Recreate original indexes
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status, created_at);

-- Note: This rollback assumes the backup tables still exist
-- If backup tables were dropped, a more complex data reconstruction would be needed
