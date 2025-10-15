-- Migration: Add user_id to requests table for proper multi-tenant isolation
-- This is a CRITICAL SECURITY FIX for multi-tenant data isolation

-- Step 1: Add user_id column (nullable initially to allow migration of existing data)
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Step 2: Add foreign key constraint to users table
ALTER TABLE requests 
ADD CONSTRAINT fk_requests_user_id 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Step 3: Create index for performance (requests are frequently queried by user_id)
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);

-- Step 4: Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_requests_user_status ON requests(user_id, status);

-- Note: Existing requests without user_id will need to be either:
-- 1. Deleted (safest for production)
-- 2. Assigned to a specific user (if you know which user they belong to)
-- 3. Left as orphaned data (user_id = NULL) and handled in application logic

-- After this migration, the application MUST be updated to:
-- 1. Always INSERT requests with user_id
-- 2. Always SELECT/UPDATE/DELETE requests filtered by user_id
-- 3. Never allow cross-tenant access to requests

