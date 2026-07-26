-- PRD-05 Class B: multi-tenant user_id on requests.
-- Does NOT backfill NULL user_id rows (Class C — human approval).

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_requests_user_id'
  ) THEN
    ALTER TABLE requests
      ADD CONSTRAINT fk_requests_user_id
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_user_status ON requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status, created_at);
