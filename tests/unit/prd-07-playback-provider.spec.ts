/**
 * PRD-07: Playback provider contract + manual mode helpers.
 */

import fs from 'fs';
import path from 'path';
import {
  getProviderByMode,
  manualPlaybackProvider,
  spotifyPlaybackProvider,
  unsupportedResult,
  validateManualTrackInput,
  normalizeTrackText,
  isPlaybackMode,
} from '@/lib/playback';
import { CANONICAL_MIGRATIONS } from '@/lib/db/migrate/registry';

const ROOT = path.resolve(__dirname, '../..');

describe('PRD-07: provider contract', () => {
  it('Spotify and manual providers expose capability flags', () => {
    const spotifyCaps = spotifyPlaybackProvider.getCapabilities();
    expect(spotifyCaps.search).toBe(true);
    expect(spotifyCaps.queueAdd).toBe(true);
    expect(spotifyCaps.playbackControls).toBe(true);
    expect(spotifyCaps.providerQueueReorder).toBe(false);
    expect(spotifyCaps.appOwnedQueueReorder).toBe(true);
    expect(spotifyCaps.manualTextRequest).toBe(false);

    const manualCaps = manualPlaybackProvider.getCapabilities();
    expect(manualCaps.search).toBe(false);
    expect(manualCaps.queueAdd).toBe(false);
    expect(manualCaps.playbackControls).toBe(false);
    expect(manualCaps.volume).toBe(false);
    expect(manualCaps.deviceSelection).toBe(false);
    expect(manualCaps.manualTextRequest).toBe(true);
    expect(manualCaps.appOwnedQueueReorder).toBe(true);
    expect(manualCaps.markPlaying).toBe(true);
    expect(manualCaps.nowPlaying).toBe(true);
  });

  it('resolve by mode returns correct provider id', () => {
    expect(getProviderByMode('spotify').id).toBe('spotify');
    expect(getProviderByMode('manual').id).toBe('manual');
  });

  it('manual provider refuses playback controls with typed capability error', async () => {
    const pause = await manualPlaybackProvider.pause!({
      userId: '00000000-0000-0000-0000-000000000001',
    });
    expect(pause.ok).toBe(false);
    expect(pause.code).toBe('CAPABILITY_NOT_SUPPORTED');

    const queue = await manualPlaybackProvider.addToQueue!(
      {
        providerId: 'manual',
        title: 'Song',
        artists: 'Artist',
      },
      { userId: '00000000-0000-0000-0000-000000000001' }
    );
    expect(queue.ok).toBe(false);
    expect(queue.code).toBe('CAPABILITY_NOT_SUPPORTED');
  });

  it('manual connection status is not_required', async () => {
    const status = await manualPlaybackProvider.getConnectionStatus({
      userId: '00000000-0000-0000-0000-000000000001',
    });
    expect(status.state).toBe('not_required');
    expect(status.providerId).toBe('manual');
  });

  it('unsupportedResult helper is typed', () => {
    const result = unsupportedResult('test.cap');
    expect(result.ok).toBe(false);
    expect(result.category).toBe('capability_not_supported');
  });
});

describe('PRD-07: manual request validation', () => {
  it('accepts valid artist/title and builds normalized key', () => {
    const result = validateManualTrackInput({
      title: '  Hello  ',
      artists: 'Adele',
      dedication: 'For Sam',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('Hello');
      expect(result.value.artists).toBe('Adele');
      expect(result.value.dedication).toBe('For Sam');
      expect(result.value.normalizedKey).toContain('adele');
      expect(result.value.normalizedKey).toContain('hello');
    }
  });

  it('rejects empty title/artist', () => {
    expect(validateManualTrackInput({ title: '', artists: 'A' }).ok).toBe(false);
    expect(validateManualTrackInput({ title: 'T', artists: '' }).ok).toBe(false);
  });

  it('normalizeTrackText collapses whitespace/case', () => {
    expect(normalizeTrackText('  Foo   Bar ')).toBe('foo bar');
  });

  it('isPlaybackMode validates modes', () => {
    expect(isPlaybackMode('spotify')).toBe(true);
    expect(isPlaybackMode('manual')).toBe(true);
    expect(isPlaybackMode('apple')).toBe(false);
  });
});

describe('PRD-07: migration + route guardrails', () => {
  it('registers Class B migration 009', () => {
    const mig = CANONICAL_MIGRATIONS.find((m) => m.id === '009_prd07_playback_provider');
    expect(mig).toBeDefined();
    expect(mig?.classification).toBe('B');
    const sql = fs.readFileSync(
      path.join(ROOT, 'src/lib/db/migrations/canonical', mig!.file),
      'utf8'
    );
    expect(sql).toMatch(/playback_mode/);
    expect(sql).toMatch(/manual_now_playing/);
    expect(sql).toMatch(/queue_position/);
    expect(sql).toMatch(/ALTER COLUMN track_uri DROP NOT NULL/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });

  it('core routes depend on playback provider helpers', () => {
    const approve = fs.readFileSync(
      path.join(ROOT, 'src/app/api/admin/approve/[id]/route.ts'),
      'utf8'
    );
    expect(approve).toMatch(/resolvePlaybackProvider/);
    expect(approve).toMatch(/assignNextQueuePosition/);

    const pause = fs.readFileSync(
      path.join(ROOT, 'src/app/api/admin/playback/pause/route.ts'),
      'utf8'
    );
    expect(pause).toMatch(/refuseIfCapabilityUnsupported/);

    const reorder = fs.readFileSync(
      path.join(ROOT, 'src/app/api/admin/queue/reorder/route.ts'),
      'utf8'
    );
    expect(reorder).toMatch(/reorderAppOwnedQueue/);
    expect(reorder).toMatch(/spotify\.queue\.reorder/);

    const requestRoute = fs.readFileSync(
      path.join(ROOT, 'src/app/api/request/route.ts'),
      'utf8'
    );
    expect(requestRoute).toMatch(/validateManualTrackInput/);
    expect(requestRoute).toMatch(/getPlaybackMode/);
  });

  it('Spotify adapter wraps existing service module', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/lib/playback/spotify-provider.ts'),
      'utf8'
    );
    expect(source).toMatch(/from '@\/lib\/spotify'/);
    expect(source).toMatch(/implements PlaybackProvider/);
  });

  it('display skips Spotify playback-sync heartbeat in manual mode', () => {
    const syncRoute = fs.readFileSync(
      path.join(ROOT, 'src/app/api/public/playback-sync/route.ts'),
      'utf8'
    );
    const displayHook = fs.readFileSync(
      path.join(ROOT, 'src/components/display/useDisplayData.ts'),
      'utf8'
    );
    expect(syncRoute).toMatch(/getPlaybackMode/);
    expect(syncRoute).toMatch(/manual_mode/);
    expect(displayHook).toMatch(/playbackMode === 'manual'/);
    expect(displayHook).toMatch(/mode_label/);
  });

  it('admin UI wires manual now-playing + mark-played APIs', () => {
    const panel = fs.readFileSync(
      path.join(ROOT, 'src/components/admin/ManualNowPlayingControls.tsx'),
      'utf8'
    );
    expect(panel).toMatch(/\/api\/admin\/manual-now-playing/);
    expect(panel).toMatch(/\/api\/admin\/requests\/\$\{.*\}\/mark-played/);
  });
});
