-- ============================================================================
-- HOTFIX MIGRATION: Add user_id to events table
-- Purpose: Fix missing user_id column in events table for multi-tenancy
-- ============================================================================

BEGIN;

-- Add user_id column to events table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='events' AND column_name='user_id') THEN
        
        -- Add the column as nullable first
        ALTER TABLE events ADD COLUMN user_id UUID;
        
        -- Create a default user if none exists (for existing events)
        INSERT INTO users (username, email, password_hash, display_name, role)
        SELECT 'admin', 'admin@example.com', '$2a$10$placeholder', 'Admin User', 'superadmin'
        WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);
        
        -- Set user_id for any existing events to the first user
        UPDATE events 
        SET user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        WHERE user_id IS NULL;
        
        -- Now make it NOT NULL and add foreign key
        ALTER TABLE events 
        ALTER COLUMN user_id SET NOT NULL,
        ADD CONSTRAINT events_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
        
        RAISE NOTICE 'Added user_id column to events table';
    ELSE
        RAISE NOTICE 'user_id column already exists in events table';
    END IF;
END $$;

COMMIT;
