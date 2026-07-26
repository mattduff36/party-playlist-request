import fs from 'fs';
import path from 'path';
import { CANONICAL_MIGRATIONS } from '@/lib/db/migrate/registry';
import {
  isValidIdempotencyKey,
  isGuestDeviceId,
  isStaleFetchedAt,
  resetDistributedRateLimitForTests,
  enforceGuestRateLimit,
  classifySpotifyQueueError,
  shouldAttemptSpotifyQueueAdd,
} from '@/lib/reliability';

const ROOT = path.join(__dirname, '..', '..');

describe('PRD-06: migration Class B only', () => {
  it('registers 007_prd06_reliability as Class B with additive SQL', () => {
    const migration = CANONICAL_MIGRATIONS.find((m) => m.id === '007_prd06_reliability');
    expect(migration).toBeDefined();
    expect(migration!.classification).toBe('B');
    const sql = fs.readFileSync(
      path.join(ROOT, 'src/lib/db/migrations/canonical', migration!.file),
      'utf8'
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/);
    expect(sql).toMatch(/provider_operations/);
    expect(sql).toMatch(/idempotency_key/);
    expect(sql).not.toMatch(/^\s*DROP COLUMN\b/im);
    expect(sql).not.toMatch(/^\s*DELETE FROM requests\b/im);
  });

  it('registers 008 status CHECK widen as Class B with IF EXISTS patterns', () => {
    const migration = CANONICAL_MIGRATIONS.find(
      (m) => m.id === '008_prd06_request_status_check'
    );
    expect(migration).toBeDefined();
    expect(migration!.classification).toBe('B');
    const sql = fs.readFileSync(
      path.join(ROOT, 'src/lib/db/migrations/canonical', migration!.file),
      'utf8'
    );
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS requests_status_check/);
    expect(sql).toMatch(/approving/);
    expect(sql).toMatch(/queue_failed/);
    expect(sql).toMatch(/claim_started_at/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS claim_started_at/);
    expect(sql).not.toMatch(/^\s*DROP COLUMN\b/im);
    expect(sql).not.toMatch(/^\s*DELETE FROM\b/im);
  });
});

describe('PRD-06: helpers', () => {
  it('validates idempotency UUID keys', () => {
    expect(isValidIdempotencyKey('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidIdempotencyKey('not-a-uuid')).toBe(false);
    expect(isValidIdempotencyKey(null)).toBe(false);
  });

  it('validates guest device ids', () => {
    expect(isGuestDeviceId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isGuestDeviceId('bad')).toBe(false);
  });

  it('detects stale playback snapshots', () => {
    expect(isStaleFetchedAt(new Date().toISOString(), 5000)).toBe(false);
    expect(isStaleFetchedAt(new Date(0).toISOString(), 5000)).toBe(true);
    expect(isStaleFetchedAt(null, 5000)).toBe(true);
  });

  it('classifies Spotify queue errors', () => {
    expect(classifySpotifyQueueError(new Error('401 unauthorized'))).toBe(
      'provider_auth'
    );
    expect(classifySpotifyQueueError(new Error('429 rate limit'))).toBe(
      'rate_limited'
    );
    expect(classifySpotifyQueueError(new Error('No active device'))).toBe(
      'no_active_device'
    );
    expect(classifySpotifyQueueError(new Error('timeout aborted'))).toBe(
      'uncertain_timeout'
    );
  });

  it('never retries Spotify queue when ledger status is uncertain', () => {
    expect(shouldAttemptSpotifyQueueAdd('uncertain')).toBe(false);
    expect(shouldAttemptSpotifyQueueAdd('succeeded')).toBe(false);
    expect(shouldAttemptSpotifyQueueAdd('pending')).toBe(true);
    expect(shouldAttemptSpotifyQueueAdd('failed')).toBe(true);
  });
});

describe('PRD-06: distributed guest rate limit fail policy', () => {
  beforeEach(() => {
    resetDistributedRateLimitForTests();
  });

  it('limits by primary guest key with memory fallback when Redis unavailable', async () => {
    for (let i = 0; i < 30; i++) {
      expect(
        (
          await enforceGuestRateLimit({
            bucket: 'guestSearch',
            primaryKey: 'e1:d1',
          })
        ).allowed
      ).toBe(true);
    }
    const blocked = await enforceGuestRateLimit({
      bucket: 'guestSearch',
      primaryKey: 'e1:d1',
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.backend).toBe('memory');
  });

  it('does not share primary guest quotas across devices behind same IP', async () => {
    const ip = 'shared-ip-hash';
    const a = await enforceGuestRateLimit({
      bucket: 'guestSearch',
      primaryKey: 'evt:device-1',
      secondaryKey: ip,
    });
    const b = await enforceGuestRateLimit({
      bucket: 'guestSearch',
      primaryKey: 'evt:device-2',
      secondaryKey: ip,
    });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it('memory secondary uses secondaryMaxMultiplier ceiling under NAT (not tiny primary)', async () => {
    const ip = 'nat-shared-ip';
    const multiplier = 15;
    // guestSearch primary max=30 → secondary ceiling 450
    const secondaryCeiling = 30 * multiplier;
    let allowed = 0;
    for (let i = 0; i < secondaryCeiling; i++) {
      const result = await enforceGuestRateLimit({
        bucket: 'guestSearch',
        primaryKey: `evt:device-${i}`,
        secondaryKey: ip,
        secondaryMaxMultiplier: multiplier,
      });
      if (result.allowed) allowed += 1;
      else break;
    }
    expect(allowed).toBe(secondaryCeiling);

    const blocked = await enforceGuestRateLimit({
      bucket: 'guestSearch',
      primaryKey: `evt:device-${secondaryCeiling}`,
      secondaryKey: ip,
      secondaryMaxMultiplier: multiplier,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.backend).toBe('memory');
  });
});

describe('PRD-06: route guardrails', () => {
  it('queue reorder returns CAPABILITY_NOT_SUPPORTED (no false success)', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/app/api/admin/queue/reorder/route.ts'),
      'utf8'
    );
    expect(source).toMatch(/CAPABILITY_NOT_SUPPORTED/);
    expect(source).not.toMatch(/success:\s*true/);
  });

  it('cleanup-requests requires confirmation and only deletes archived rows', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/app/api/admin/cleanup-requests/route.ts'),
      'utf8'
    );
    expect(source).toMatch(/DELETE_ARCHIVED_EVENT_DATA/);
    expect(source).toMatch(/archived_at IS NOT NULL/);
  });

  it('approve route claims atomically, releases on catch, and skips uncertain re-queue', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/app/api/admin/approve/[id]/route.ts'),
      'utf8'
    );
    expect(source).toMatch(/claimRequestForApproval/);
    expect(source).toMatch(/releaseApprovalClaim/);
    expect(source).toMatch(/createProviderOperation/);
    expect(source).toMatch(/shouldAttemptSpotifyQueueAdd/);
    expect(source).toMatch(/op\.status === 'uncertain'/);
    const claimIdx = source.indexOf('claimRequestForApproval');
    const spotifyIdx = source.indexOf('addToQueue');
    expect(claimIdx).toBeGreaterThan(-1);
    expect(spotifyIdx).toBeGreaterThan(claimIdx);
    // uncertain branch must appear before any addToQueue call site logic
    const uncertainIdx = source.indexOf("op.status === 'uncertain'");
    expect(uncertainIdx).toBeGreaterThan(-1);
    expect(uncertainIdx).toBeLessThan(spotifyIdx);
  });

  it('auto-approve path does not re-queue when ledger is uncertain', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/app/api/request/route.ts'),
      'utf8'
    );
    expect(source).toMatch(/shouldAttemptSpotifyQueueAdd/);
    expect(source).toMatch(/releaseApprovalClaim/);
    const attemptIdx = source.indexOf('shouldAttemptSpotifyQueueAdd');
    const addIdx = source.indexOf('spotifyService.addToQueue');
    expect(attemptIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeGreaterThan(attemptIdx);
  });

  it('admin spotify-watcher and public playback-sync use refreshPlaybackState', () => {
    const watcher = fs.readFileSync(
      path.join(ROOT, 'src/app/api/admin/spotify-watcher/route.ts'),
      'utf8'
    );
    const publicSync = fs.readFileSync(
      path.join(ROOT, 'src/app/api/public/playback-sync/route.ts'),
      'utf8'
    );
    expect(watcher).toMatch(/refreshPlaybackState/);
    expect(watcher).not.toMatch(/tickUserPlayback/);
    expect(publicSync).toMatch(/refreshPlaybackState/);
    expect(publicSync).not.toMatch(/tickUserPlayback/);
  });

  it('guest request route requires idempotency_key and uses distributed limiter', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/app/api/request/route.ts'),
      'utf8'
    );
    expect(source).toMatch(/IDEMPOTENCY_KEY_REQUIRED/);
    expect(source).toMatch(/enforceGuestRateLimit/);
    expect(source).toMatch(/createIdempotentRequest/);
  });

  it('event offline archives rather than deleting requests inline', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/app/api/event/status/route.ts'),
      'utf8'
    );
    expect(source).toMatch(/archiveEventOnEnd/);
    expect(source).not.toMatch(/DELETE FROM requests/);
  });
});
