-- Migrate spotify_auth table to multi-tenant structure
-- This allows each user to have their own Spotify connection

BEGIN;

-- Step 1: Drop the old primary key constraint on id
ALTER TABLE spotify_auth DROP CONSTRAINT IF EXISTS spotify_auth_pkey;

-- Step 2: Add user_id column (if it doesn't exist)
ALTER TABLE spotify_auth ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Step 2.5: Assign existing tokens to testspotify user (assuming id=1 was the testspotify user's tokens)
UPDATE spotify_auth 
SET user_id = (SELECT id FROM users WHERE username = 'testspotify' LIMIT 1)
WHERE user_id IS NULL;

-- Step 3: Make user_id the new primary key
-- First, clean up any duplicate rows (keep the most recent)
DELETE FROM spotify_auth a
USING spotify_auth b
WHERE a.id < b.id 
  AND (a.user_id = b.user_id OR (a.user_id IS NULL AND b.user_id IS NULL));

-- Now set user_id as primary key (if not null)
ALTER TABLE spotify_auth ADD CONSTRAINT spotify_auth_pkey PRIMARY KEY (user_id);

-- Step 4: Drop the old id column (no longer needed)
ALTER TABLE spotify_auth DROP COLUMN IF EXISTS id;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_spotify_auth_user_id ON spotify_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_auth_expires_at ON spotify_auth(expires_at);

COMMIT;
