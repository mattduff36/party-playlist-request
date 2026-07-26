-- PRD-06 Class B: widen requests.status CHECK for approving / queue_failed.
-- Backup: snap-odd-dream-abwtma9w
-- Neon current constraint (read-only inspect): pending|approved|rejected|queued|failed|played
-- Expand only (keep legacy queued/failed). DROP/re-ADD CHECK is the Postgres widen pattern.
-- Also adds claim_started_at for stuck-approving reclaim timeout.

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
