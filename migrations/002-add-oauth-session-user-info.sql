-- Add user_id and username columns to oauth_sessions table
-- This allows us to redirect OAuth callbacks to the correct user page

ALTER TABLE oauth_sessions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON oauth_sessions(user_id);
