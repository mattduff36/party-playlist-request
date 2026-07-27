-- PRD-09 Class B: Party Pass payments + entitlements (additive only).
-- Backup: snap-odd-dream-abwtma9w
-- Safe: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Does NOT drop columns, backfill secrets, or purge rows (Class C/D out of scope).
-- Never store full card data.

-- Stripe customer mapping (one per organiser account)
CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id
  ON stripe_customers(stripe_customer_id);

-- Checkout / purchase ledger
CREATE TABLE IF NOT EXISTS party_pass_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_price_id TEXT,
  product_code TEXT NOT NULL DEFAULT 'party_pass',
  currency TEXT NOT NULL DEFAULT 'gbp',
  amount_pence INTEGER NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  -- pending | paid | refunded | partially_refunded | disputed | failed | cancelled
  refund_status TEXT,
  dispute_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_pass_purchases_user
  ON party_pass_purchases(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_party_pass_purchases_payment_intent
  ON party_pass_purchases(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Entitlement: purchase ≠ activation (30-day window starts on activate)
CREATE TABLE IF NOT EXISTS party_pass_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES party_pass_purchases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'purchased',
  -- purchased | activated | expired | revoked | refunded | disputed
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  use_by_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  linked_event_id UUID,
  source TEXT NOT NULL DEFAULT 'stripe_checkout',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (purchase_id)
);

CREATE INDEX IF NOT EXISTS idx_party_pass_entitlements_user_status
  ON party_pass_entitlements(user_id, status);

CREATE INDEX IF NOT EXISTS idx_party_pass_entitlements_expires
  ON party_pass_entitlements(expires_at)
  WHERE status = 'activated';

-- Idempotent Stripe webhook ledger
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'processed',
  -- processed | failed | ignored
  error_message TEXT,
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
  ON stripe_webhook_events(event_type, received_at DESC);

-- Audit trail (no card data)
CREATE TABLE IF NOT EXISTS party_pass_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  purchase_id UUID,
  entitlement_id UUID,
  action TEXT NOT NULL,
  actor_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_pass_audit_user
  ON party_pass_audit(user_id, created_at DESC);

-- Privacy-conscious funnel analytics (stable IDs only)
CREATE TABLE IF NOT EXISTS party_pass_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_name TEXT NOT NULL,
  -- pricing_viewed | checkout_started | purchase_completed | pass_activated
  -- | event_ready | event_started | event_ended | refund_requested | refund_completed
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_pass_funnel_name
  ON party_pass_funnel_events(event_name, created_at DESC);
