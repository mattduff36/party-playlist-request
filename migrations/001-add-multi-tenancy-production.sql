-- ============================================================================
-- PRODUCTION MIGRATION: Add Multi-Tenancy Support
-- Purpose: Transform single-tenant app to multi-tenant SaaS
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create new tables for multi-tenancy
-- ============================================================================

-- User Events table: Individual party events
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create unique partial index for one active event per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_event_per_user 
  ON user_events(user_id) 
  WHERE active = true;

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

-- Add user_id to requests table (if not already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='requests' AND column_name='user_id') THEN
        ALTER TABLE requests ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='requests' AND column_name='user_event_id') THEN
        ALTER TABLE requests ADD COLUMN user_event_id UUID REFERENCES user_events(id) ON DELETE SET NULL;
    END IF;
END $$;

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

COMMIT;

