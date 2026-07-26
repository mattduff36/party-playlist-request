-- PRD-08 Class B: paid beta product readiness (additive only).
-- Backup: snap-odd-dream-abwtma9w
-- Safe: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Does NOT drop columns, backfill secrets, or purge rows (Class C/D out of scope).

-- Lifecycle / readiness alongside operational events.status (offline|standby|live)
ALTER TABLE events ADD COLUMN IF NOT EXISTS lifecycle_phase TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE events ADD COLUMN IF NOT EXISTS readiness_state JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS readiness_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_label TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS readiness_override JSONB;

-- Guardrails + signage / demo flags on organiser settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS must_play_list JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS do_not_play_list JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS artist_cooldown_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS max_active_requests_per_guest INTEGER;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS print_access_code_on_signage BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS demo_mode BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS pre_event_requests_enabled BOOLEAN NOT NULL DEFAULT false;

-- Time-limited beta entitlement (activation gate; history remains readable)
CREATE TABLE IF NOT EXISTS beta_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'superadmin_grant',
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_entitlements_user_status
  ON beta_entitlements(user_id, status);

CREATE TABLE IF NOT EXISTS beta_entitlement_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id UUID,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_entitlement_audit_user
  ON beta_entitlement_audit(user_id, created_at DESC);

-- Legal pages with explicit review status (not presented as approved counsel)
CREATE TABLE IF NOT EXISTS legal_pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'draft_unreviewed',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

INSERT INTO legal_pages (id, title, body_markdown, review_status)
VALUES
  ('privacy', 'Privacy notice', '', 'draft_unreviewed'),
  ('terms', 'Terms of service', '', 'draft_unreviewed'),
  ('cookies', 'Cookie information', '', 'draft_unreviewed'),
  ('retention', 'Retention and deletion summary', '', 'draft_unreviewed'),
  ('refund', 'Refund and cancellation policy (placeholder)', '', 'draft_unreviewed'),
  ('spotify_disconnect', 'Spotify disconnect and data deletion', '', 'draft_unreviewed'),
  ('organiser_responsibility', 'Organiser responsibilities', '', 'draft_unreviewed')
ON CONFLICT (id) DO NOTHING;

-- Observed beta operator checklist (reusable across rehearsals)
CREATE TABLE IF NOT EXISTS beta_observation_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,
  organiser_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_observation_organiser
  ON beta_observation_checklists(organiser_user_id, updated_at DESC);
