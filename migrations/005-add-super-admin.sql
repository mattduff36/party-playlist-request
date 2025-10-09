-- Add super_admin role to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Create index for super admin queries
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users(is_super_admin);

-- Add audit columns for super admin actions
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for soft deletes
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

