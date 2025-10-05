-- ============================================================================
-- SPIKE ROLLBACK: Remove Multi-Tenancy Support
-- Purpose: Revert to single-tenant architecture
-- Status: TESTING ONLY - DO NOT RUN ON PRODUCTION
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_user_settings_user_key;
DROP INDEX IF EXISTS idx_display_tokens_expires;
DROP INDEX IF EXISTS idx_display_tokens_event;
DROP INDEX IF EXISTS idx_display_tokens_token;
DROP INDEX IF EXISTS idx_requests_user_status;
DROP INDEX IF EXISTS idx_requests_user_event_id;
DROP INDEX IF EXISTS idx_requests_user_id;
DROP INDEX IF EXISTS idx_user_events_bypass_token;
DROP INDEX IF EXISTS idx_user_events_expires;
DROP INDEX IF EXISTS idx_user_events_active;
DROP INDEX IF EXISTS idx_user_events_user_id;
DROP INDEX IF EXISTS idx_users_deletion_scheduled;
DROP INDEX IF EXISTS idx_users_status;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_email;

-- ============================================================================
-- STEP 2: Remove columns from existing tables
-- ============================================================================

ALTER TABLE requests 
  DROP COLUMN IF EXISTS user_event_id,
  DROP COLUMN IF EXISTS user_id;

-- ============================================================================
-- STEP 3: Drop new tables (in reverse dependency order)
-- ============================================================================

DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS display_tokens CASCADE;
DROP TABLE IF EXISTS user_events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

COMMIT;

-- ============================================================================
-- VERIFICATION: Check schema is back to original
-- ============================================================================

-- Query 1: Verify tables are dropped
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('users', 'user_events', 'display_tokens', 'user_settings');
-- Expected: 0 rows

-- Query 2: Verify columns are removed
-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_name = 'requests' 
--   AND column_name IN ('user_id', 'user_event_id');
-- Expected: 0 rows

-- Query 3: List remaining tables (should match original)
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
