/**
 * Canonical migration registry (PRD-05).
 *
 * Order is immutable. Filenames under migrations/canonical/ must match.
 * Do not include Class C/D destructive steps here — those require human approval.
 */

export interface MigrationDefinition {
  /** Stable id recorded in schema_migrations.id */
  id: string;
  /** Relative path under src/lib/db/migrations/canonical/ */
  file: string;
  /**
   * Classification for production apply:
   * - A: docs / no-op stamp
   * - B: additive DDL (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / indexes)
   * - C/D: never auto-run without human approval (not listed here)
   */
  classification: 'A' | 'B';
  description: string;
}

export const CANONICAL_MIGRATIONS: MigrationDefinition[] = [
  {
    id: '001_baseline_canonical',
    file: '001_baseline_canonical.sql',
    classification: 'B',
    description:
      'Idempotent CREATE IF NOT EXISTS for live multi-tenant tables (users, events, user_events, requests, spotify_auth, …)',
  },
  {
    id: '002_auth_session_email',
    file: '002_auth_session_email.sql',
    classification: 'B',
    description: 'Session tracking + auth email / password_reset_tokens columns',
  },
  {
    id: '003_requests_user_id',
    file: '003_requests_user_id.sql',
    classification: 'B',
    description: 'Multi-tenant user_id on requests (+ indexes)',
  },
  {
    id: '004_spotify_playback_sync',
    file: '004_spotify_playback_sync.sql',
    classification: 'B',
    description: 'spotify_playback_sync lease table + cache_entries',
  },
  {
    id: '005_prd03_token_encryption',
    file: '005_prd03_token_encryption.sql',
    classification: 'B',
    description: 'PRD-03 Class B encrypted Spotify credential envelopes (already applied on Neon)',
  },
  {
    id: '006_prd04_token_hashes',
    file: '006_prd04_token_hashes.sql',
    classification: 'B',
    description: 'PRD-04 Class B access-code / token hash columns (already applied on Neon)',
  },
  {
    id: '007_prd06_reliability',
    file: '007_prd06_reliability.sql',
    classification: 'B',
    description:
      'PRD-06 event archive stamps, request event_id/idempotency, provider_operations ledger, playback freshness',
  },
  {
    id: '008_prd06_request_status_check',
    file: '008_prd06_request_status_check.sql',
    classification: 'B',
    description:
      'PRD-06 widen requests.status CHECK for approving/queue_failed + claim_started_at',
  },
  {
    id: '009_prd07_playback_provider',
    file: '009_prd07_playback_provider.sql',
    classification: 'B',
    description:
      'PRD-07 playback_mode, manual_now_playing, provider-neutral request fields, app-owned queue; track_uri nullable',
  },
  {
    id: '010_prd08_paid_beta_readiness',
    file: '010_prd08_paid_beta_readiness.sql',
    classification: 'B',
    description:
      'PRD-08 lifecycle/readiness fields, guardrail settings, beta entitlements, legal_pages, observation checklists',
  },
  {
    id: '011_prd09_party_pass_payments',
    file: '011_prd09_party_pass_payments.sql',
    classification: 'B',
    description:
      'PRD-09 Party Pass purchases, entitlements, Stripe customer/webhook ledger, audit + funnel (no card data)',
  },
  {
    id: '012_user_events_updated_at',
    file: '012_user_events_updated_at.sql',
    classification: 'B',
    description:
      'Add user_events.updated_at (live Neon gap vs baseline / setPlaybackMode)',
  },
];
