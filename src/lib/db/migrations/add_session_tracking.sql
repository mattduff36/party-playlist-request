-- Add session tracking to users table
-- This allows us to enforce single active session per user

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS active_session_id TEXT,
ADD COLUMN IF NOT EXISTS active_session_created_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_users_active_session ON users(active_session_id) WHERE active_session_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.active_session_id IS 'Unique identifier for the current active admin session';
COMMENT ON COLUMN users.active_session_created_at IS 'Timestamp when the current session was created';


