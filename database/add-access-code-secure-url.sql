-- Per-event access codes + secure URL preference
-- pin historically stored 4-digit codes (VARCHAR(4)); guest access now uses
-- 6-digit or 8-char secure codes, so widen pin and mirror into access_code.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS secure_url_access BOOLEAN DEFAULT FALSE;

ALTER TABLE user_events
  ALTER COLUMN pin TYPE TEXT;

-- Drop legacy 4-digit-only check (pin ~ '^[0-9]{4}$')
ALTER TABLE user_events
  DROP CONSTRAINT IF EXISTS user_events_pin_check;

ALTER TABLE user_events
  ADD COLUMN IF NOT EXISTS access_code TEXT;

-- Allow legacy 4-digit, default 6-digit, or secure 8-char Crockford codes
ALTER TABLE user_events
  DROP CONSTRAINT IF EXISTS user_events_access_code_format_check;

ALTER TABLE user_events
  ADD CONSTRAINT user_events_access_code_format_check
  CHECK (
    pin ~ '^[0-9]{4}$'
    OR pin ~ '^[0-9]{6}$'
    OR pin ~ '^[0-9A-HJ-NP-Z]{8}$'
  );

UPDATE user_events
SET access_code = pin
WHERE access_code IS NULL AND pin IS NOT NULL;
