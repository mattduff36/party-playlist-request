-- Class B repair: re-assert widened requests.status CHECK (approving / queue_failed).
-- 008_prd06_request_status_check was recorded applied, but live Neon drifted back to
-- pending|approved|rejected|queued|failed|played (legacy bootstrap / older CHECK).
-- Expand-only DROP/re-ADD; keeps claim_started_at if present.

ALTER TABLE requests ADD COLUMN IF NOT EXISTS claim_started_at TIMESTAMPTZ;

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'approving'::text,
        'approved'::text,
        'rejected'::text,
        'played'::text,
        'queue_failed'::text,
        'failed'::text,
        'queued'::text
      ]
    )
  );
