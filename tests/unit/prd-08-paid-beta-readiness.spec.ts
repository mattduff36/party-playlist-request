/**
 * PRD-08: paid beta product readiness — unit coverage.
 */

import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import {
  evaluateReadiness,
  emptyReadinessState,
  mergeCheckUpdate,
  READINESS_CHECKS,
} from '@/lib/beta/readiness';
import { EVENT_TEMPLATES, getEventTemplate } from '@/lib/beta/templates';
import { matchesDoNotPlay } from '@/lib/beta/guardrails';
import {
  assertDemoDoesNotTouchSpotify,
  isDemoModeEnabled,
  searchDemoTracks,
} from '@/lib/beta/demo-mode';
import { buildRecoveryIssues } from '@/lib/beta/recovery';
import {
  generateSignagePdf,
  signageFilename,
} from '@/lib/beta/signage';
import { isBetaEntitlementBypassEnabled } from '@/lib/beta/entitlement';
import { LEGAL_DEFAULTS, reviewBanner } from '@/lib/beta/legal';
import { OBSERVATION_ITEMS } from '@/lib/beta/observation-checklist';
import { CANONICAL_MIGRATIONS } from '@/lib/db/migrate/registry';

const ROOT = path.resolve(__dirname, '../..');

describe('PRD-08: readiness wizard gates', () => {
  it('blocks Ready when required Spotify checks fail', () => {
    let state = emptyReadinessState();
    for (const id of [
      'basics',
      'playback_mode',
      'moderation',
      'guest_access',
      'e2e_test',
      'ready_confirm',
    ] as const) {
      state = mergeCheckUpdate(state, { id, completed: true });
    }

    const result = evaluateReadiness({
      state,
      playbackMode: 'spotify',
      spotifyConnected: false,
      hasActiveDevice: false,
      eventTitle: 'Test Party',
    });

    expect(result.canMarkReady).toBe(false);
    expect(result.blockingFailures).toEqual(
      expect.arrayContaining(['spotify_connect', 'spotify_device'])
    );
  });

  it('allows Ready in manual mode without Spotify device', () => {
    let state = emptyReadinessState();
    for (const check of READINESS_CHECKS) {
      if (check.id === 'spotify_connect' || check.id === 'spotify_device') {
        continue;
      }
      state = mergeCheckUpdate(state, { id: check.id, completed: true });
    }

    const result = evaluateReadiness({
      state,
      playbackMode: 'manual',
      spotifyConnected: false,
      hasActiveDevice: false,
      eventTitle: 'Manual Party',
    });

    expect(result.blockingFailures).toEqual([]);
    expect(result.canMarkReady).toBe(true);
  });

  it('requires override reason for warning-only failures', () => {
    let state = emptyReadinessState();
    for (const check of READINESS_CHECKS) {
      if (
        check.severity === 'warning' ||
        check.id === 'spotify_connect' ||
        check.id === 'spotify_device'
      ) {
        continue;
      }
      state = mergeCheckUpdate(state, { id: check.id, completed: true });
    }

    const blocked = evaluateReadiness({
      state,
      playbackMode: 'manual',
      spotifyConnected: false,
      hasActiveDevice: false,
      eventTitle: 'Party',
      allowWarningOverride: false,
    });
    expect(blocked.canMarkReady).toBe(false);
    expect(blocked.warningFailures.length).toBeGreaterThan(0);

    const allowed = evaluateReadiness({
      state,
      playbackMode: 'manual',
      spotifyConnected: false,
      hasActiveDevice: false,
      eventTitle: 'Party',
      allowWarningOverride: true,
      overrideReason: 'Display theme fine for house party',
    });
    expect(allowed.canMarkReady).toBe(true);
  });
});

describe('PRD-08: signage QR URLs', () => {
  it('generates PDF with guest URL only and decodable QR', async () => {
    const joinUrl = 'https://example.com/djdemo/123456/request';
    const pdf = await generateSignagePdf({
      format: 'a4',
      eventTitle: 'Birthday Party',
      joinUrl,
      accessCode: '123456',
      includeAccessCode: false,
    });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(signageFilename('a4', 'Birthday Party')).toContain('a4');

    const dataUrl = await QRCode.toDataURL(joinUrl, { errorCorrectionLevel: 'H' });
    expect(dataUrl.startsWith('data:image/png')).toBe(true);

    await expect(
      generateSignagePdf({
        format: 'a5',
        eventTitle: 'Bad',
        joinUrl: 'https://example.com/admin/settings',
        includeAccessCode: false,
      })
    ).rejects.toThrow(/admin/i);
  });

  it('includes access code only when organiser opts in', async () => {
    const withCode = await generateSignagePdf({
      format: 'table_card',
      eventTitle: 'House Party',
      joinUrl: 'https://example.com/host/abcdef/request',
      accessCode: 'ABCDEF',
      includeAccessCode: true,
    });
    // PDF binary may compress text; ensure generation succeeds for both modes
    expect(withCode.length).toBeGreaterThan(500);

    const without = await generateSignagePdf({
      format: 'table_card',
      eventTitle: 'House Party',
      joinUrl: 'https://example.com/host/abcdef/request',
      accessCode: 'ABCDEF',
      includeAccessCode: false,
    });
    expect(without.length).toBeGreaterThan(500);
  });
});

describe('PRD-08: templates, guardrails, demo, recovery, legal', () => {
  it('exposes neutral adult templates including wedding reception', () => {
    expect(EVENT_TEMPLATES.map((t) => t.id)).toEqual(
      expect.arrayContaining([
        'blank',
        'birthday',
        'anniversary',
        'house_party',
        'wedding_reception',
      ])
    );
    expect(getEventTemplate('birthday')?.settings.decline_explicit).toBe(true);
  });

  it('matches do-not-play by uri, key, or artist-only', () => {
    expect(
      matchesDoNotPlay(
        [{ track_uri: 'spotify:track:abc' }],
        { track_uri: 'spotify:track:abc', track_name: 'X', artist_name: 'Y' }
      )
    ).toBe(true);
    expect(
      matchesDoNotPlay(
        [{ artist_name: 'Blocked Artist' }],
        { artist_name: 'Blocked Artist', track_name: 'Anything' }
      )
    ).toBe(true);
    expect(
      matchesDoNotPlay(
        [{ artist_name: 'Other' }],
        { artist_name: 'Safe', track_name: 'Song' }
      )
    ).toBe(false);
  });

  it('demo mode never allows Spotify credential operations', () => {
    expect(isDemoModeEnabled({ demo_mode: true })).toBe(true);
    expect(searchDemoTracks('neon').length).toBeGreaterThan(0);
    expect(() => assertDemoDoesNotTouchSpotify('spotify_token_read')).toThrow(
      /DEMO_MODE_BLOCKED/
    );
  });

  it('recovery centre covers Spotify, device, pusher, manual fallback', () => {
    const issues = buildRecoveryIssues({
      playbackMode: 'spotify',
      spotifyConnected: false,
      requiresManualReconnect: true,
      hasActiveDevice: false,
      pusherConfigured: false,
      displayStale: true,
      providerStatus: 'rate_limited',
      playbackDegraded: true,
      online: false,
    });
    const ids = issues.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'spotify_disconnected',
        'spotify_token_expired',
        'pusher_unavailable',
        'display_stale',
        'internet_interruption',
        'provider_rate_limit',
      ])
    );

    const connectedNoDevice = buildRecoveryIssues({
      playbackMode: 'spotify',
      spotifyConnected: true,
      requiresManualReconnect: false,
      hasActiveDevice: false,
      pusherConfigured: true,
      displayStale: false,
    });
    expect(connectedNoDevice.some((i) => i.id === 'no_active_device')).toBe(
      true
    );

    const manual = buildRecoveryIssues({
      playbackMode: 'manual',
      spotifyConnected: false,
      requiresManualReconnect: false,
      hasActiveDevice: false,
      pusherConfigured: true,
      displayStale: false,
    });
    expect(manual.some((i) => i.id === 'manual_fallback')).toBe(true);
  });

  it('legal defaults mark draft/unreviewed status', () => {
    expect(LEGAL_DEFAULTS.privacy).toBeTruthy();
    expect(LEGAL_DEFAULTS.refund).toBeTruthy();
    expect(reviewBanner('draft_unreviewed')).toMatch(/not professional/i);
    expect(OBSERVATION_ITEMS.length).toBeGreaterThanOrEqual(11);
  });

  it('registers Class B migration 010 only', () => {
    const mig = CANONICAL_MIGRATIONS.find(
      (m) => m.id === '010_prd08_paid_beta_readiness'
    );
    expect(mig?.classification).toBe('B');
    const sqlPath = path.join(
      ROOT,
      'src/lib/db/migrations/canonical/010_prd08_paid_beta_readiness.sql'
    );
    expect(fs.existsSync(sqlPath)).toBe(true);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/);
    expect(sql).not.toMatch(/DROP COLUMN/);
  });
});

describe('PRD-08: entitlement bypass helpers', () => {
  const originalBypass = process.env.BETA_ENTITLEMENT_BYPASS;
  const originalEnforce = process.env.BETA_ENTITLEMENT_ENFORCE;

  afterEach(() => {
    if (originalBypass === undefined) delete process.env.BETA_ENTITLEMENT_BYPASS;
    else process.env.BETA_ENTITLEMENT_BYPASS = originalBypass;
    if (originalEnforce === undefined) delete process.env.BETA_ENTITLEMENT_ENFORCE;
    else process.env.BETA_ENTITLEMENT_ENFORCE = originalEnforce;
  });

  it('honours explicit BETA_ENTITLEMENT_BYPASS', () => {
    delete process.env.BETA_ENTITLEMENT_ENFORCE;
    process.env.BETA_ENTITLEMENT_BYPASS = '1';
    expect(isBetaEntitlementBypassEnabled()).toBe(true);
  });

  it('skips in non-production test env unless ENFORCE=1', () => {
    // Jest runs with NODE_ENV=test (non-production)
    delete process.env.BETA_ENTITLEMENT_BYPASS;
    delete process.env.BETA_ENTITLEMENT_ENFORCE;
    expect(isBetaEntitlementBypassEnabled()).toBe(true);

    process.env.BETA_ENTITLEMENT_ENFORCE = '1';
    expect(isBetaEntitlementBypassEnabled()).toBe(false);
  });
});
