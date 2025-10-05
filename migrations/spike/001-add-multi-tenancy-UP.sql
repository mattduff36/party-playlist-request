-- ============================================================================
-- SPIKE MIGRATION: Add Multi-Tenancy Support
-- Purpose: Transform single-tenant app to multi-tenant SaaS
-- Status: TESTING ONLY - DO NOT RUN ON PRODUCTION
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create new tables for multi-tenancy
-- ============================================================================

-- Users table: Core user accounts (DJs/Event Hosts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'superadmin')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
  
  -- Subscription/Pricing
  subscription_type VARCHAR(20) CHECK (subscription_type IN ('one-off', 'subscription', 'custom', 'free')),
  custom_price_amount DECIMAL(10, 2),
  stripe_customer_id VARCHAR(255),
  
  -- Cancellation tracking (30-day grace period)
  cancelled_at TIMESTAMP WITH TIME ZONE,
  deletion_scheduled_at TIMESTAMP WITH TIME ZONE,
  
  -- Spotify integration (per-user)
  spotify_access_token TEXT,
  spotify_refresh_token TEXT,
  spotify_token_expires_at TIMESTAMP WITH TIME ZONE,
  spotify_scope TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_login TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9-]{3,50}$'),
  CONSTRAINT email_format CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$')
);

-- User Events table: Individual party events (replaces global event system)
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Event details
  name VARCHAR(255),
  
  -- Security
  pin VARCHAR(4) NOT NULL CHECK (pin ~ '^[0-9]{4}$'),
  bypass_token VARCHAR(64) UNIQUE NOT NULL,
  
  -- Status
  active BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours') NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Constraints: Only ONE active event per user in Phase 1
  CONSTRAINT one_active_event_per_user UNIQUE (user_id) WHERE (active = true)
);

-- Display Tokens table: Temporary tokens for display page access
CREATE TABLE IF NOT EXISTS display_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES user_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  token VARCHAR(64) UNIQUE NOT NULL,
  uses_remaining INT DEFAULT 3 CHECK (uses_remaining >= 0),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- STEP 2: Add user_id and event_id columns to existing tables
-- ============================================================================

-- Add user_id to requests table
ALTER TABLE requests 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_event_id UUID REFERENCES user_events(id) ON DELETE SET NULL;

-- Note: Existing requests table already has event_id, but it references the old global events table
-- We'll keep both columns during migration, then clean up later

-- Create settings table if it doesn't exist (for per-user settings)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Setting key-value
  key VARCHAR(255) NOT NULL,
  value TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- One setting per key per user
  UNIQUE (user_id, key)
);

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

-- User lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled ON users(deletion_scheduled_at) WHERE deletion_scheduled_at IS NOT NULL;

-- Event lookups
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_active ON user_events(user_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_user_events_expires ON user_events(expires_at) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_user_events_bypass_token ON user_events(bypass_token);

-- Request lookups (critical for data isolation)
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_user_event_id ON requests(user_event_id);
CREATE INDEX IF NOT EXISTS idx_requests_user_status ON requests(user_id, status);

-- Display tokens
CREATE INDEX IF NOT EXISTS idx_display_tokens_token ON display_tokens(token);
CREATE INDEX IF NOT EXISTS idx_display_tokens_event ON display_tokens(event_id);
CREATE INDEX IF NOT EXISTS idx_display_tokens_expires ON display_tokens(expires_at) WHERE uses_remaining > 0;

-- Settings lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_key ON user_settings(user_id, key);

-- ============================================================================
-- STEP 4: Create test data for spike validation
-- ============================================================================

-- Test User 1: John Smith
INSERT INTO users (id, email, username, password_hash, display_name, role, status, subscription_type)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'john@test.com',
  'johnsmith',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIpKk7K9Zu', -- 'password123' hashed
  'John Smith DJ Services',
  'user',
  'active',
  'subscription'
) ON CONFLICT (email) DO NOTHING;

-- Test User 2: Jane Doe
INSERT INTO users (id, email, username, password_hash, display_name, role, status, subscription_type)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'jane@test.com',
  'janedoe',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIpKk7K9Zu', -- 'password123' hashed
  'Jane Doe Events',
  'user',
  'active',
  'one-off'
) ON CONFLICT (email) DO NOTHING;

-- Test User 3: Test DJ
INSERT INTO users (id, email, username, password_hash, display_name, role, status, subscription_type)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'testdj@test.com',
  'testdj',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIpKk7K9Zu', -- 'password123' hashed
  'Test DJ Productions',
  'user',
  'active',
  'free'
) ON CONFLICT (email) DO NOTHING;

-- Super Admin User
INSERT INTO users (id, email, username, password_hash, display_name, role, status, subscription_type)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  'admin@partyplaylist.co.uk',
  'superadmin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIpKk7K9Zu', -- 'password123' hashed
  'Platform Administrator',
  'superadmin',
  'active',
  'free'
) ON CONFLICT (email) DO NOTHING;

-- Active Event for John Smith
INSERT INTO user_events (id, user_id, name, pin, bypass_token, active, expires_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Johns Birthday Party',
  '7429',
  'bypass_token_john_12345678901234567890',
  true,
  NOW() + INTERVAL '24 hours'
) ON CONFLICT ON CONSTRAINT one_active_event_per_user DO NOTHING;

-- Active Event for Jane Doe
INSERT INTO user_events (id, user_id, name, pin, bypass_token, active, expires_at)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  'Janes Wedding Reception',
  '5812',
  'bypass_token_jane_09876543210987654321',
  true,
  NOW() + INTERVAL '24 hours'
) ON CONFLICT ON CONSTRAINT one_active_event_per_user DO NOTHING;

-- No active event for Test DJ (to test "no active event" state)

-- Test Requests for John Smith
INSERT INTO requests (id, user_id, user_event_id, track_id, track_data, submitted_by, status, created_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'spotify:track:test1', '{"track_name": "Test Song 1", "artist_name": "Test Artist 1"}', 'Guest 1', 'pending', NOW() - INTERVAL '5 minutes'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'spotify:track:test2', '{"track_name": "Test Song 2", "artist_name": "Test Artist 2"}', 'Guest 2', 'approved', NOW() - INTERVAL '3 minutes'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'spotify:track:test3', '{"track_name": "Test Song 3", "artist_name": "Test Artist 3"}', 'Guest 3', 'rejected', NOW() - INTERVAL '1 minute');

-- Test Requests for Jane Doe
INSERT INTO requests (id, user_id, user_event_id, track_id, track_data, submitted_by, status, created_at)
VALUES
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   'spotify:track:test4', '{"track_name": "Test Song 4", "artist_name": "Test Artist 4"}', 'Guest 4', 'pending', NOW() - INTERVAL '4 minutes'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   'spotify:track:test5', '{"track_name": "Test Song 5", "artist_name": "Test Artist 5"}', 'Guest 5', 'approved', NOW() - INTERVAL '2 minutes');

-- User Settings (example)
INSERT INTO user_settings (user_id, key, value)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'event_title', 'Johns Party DJ'),
  ('11111111-1111-1111-1111-111111111111', 'welcome_message', 'Welcome to Johns party!'),
  ('22222222-2222-2222-2222-222222222222', 'event_title', 'Janes Wedding DJ'),
  ('22222222-2222-2222-2222-222222222222', 'welcome_message', 'Welcome to the wedding!')
ON CONFLICT (user_id, key) DO NOTHING;

COMMIT;

-- ============================================================================
-- SPIKE VALIDATION QUERIES (Run these after migration)
-- ============================================================================

-- Query 1: Verify data isolation - Get requests per user
-- SELECT u.username, COUNT(r.id) as request_count
-- FROM users u
-- LEFT JOIN requests r ON r.user_id = u.id
-- GROUP BY u.username
-- ORDER BY u.username;

-- Query 2: Verify active events per user
-- SELECT u.username, e.name, e.pin, e.active, e.expires_at
-- FROM users u
-- LEFT JOIN user_events e ON e.user_id = u.id AND e.active = true;

-- Query 3: Test cross-contamination (should return 0)
-- SELECT COUNT(*) as cross_contamination_count
-- FROM requests r1
-- INNER JOIN requests r2 ON r1.id = r2.id
-- WHERE r1.user_id != r2.user_id;

-- Query 4: Test unique active event constraint (this should fail)
-- INSERT INTO user_events (user_id, name, pin, bypass_token, active)
-- VALUES ('11111111-1111-1111-1111-111111111111', 'Second Event', '9999', 'test_token_fail', true);
-- Expected: ERROR: duplicate key value violates unique constraint

-- Query 5: Performance test - Filter requests by user
-- EXPLAIN ANALYZE
-- SELECT * FROM requests WHERE user_id = '11111111-1111-1111-1111-111111111111' AND status = 'pending';
-- Should use index: idx_requests_user_status
