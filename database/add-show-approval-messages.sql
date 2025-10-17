-- Add show_approval_messages column to user_settings table
-- This column enables automatic Notice Board messages when requests are approved

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS show_approval_messages BOOLEAN DEFAULT FALSE;

-- Add show_approval_messages to events config JSONB if needed (optional, as JSONB is flexible)
-- No schema change needed for events table as it uses JSONB config

