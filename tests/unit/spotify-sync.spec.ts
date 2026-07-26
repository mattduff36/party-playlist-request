import { PLAYBACK_STALE_MS, TICK_LEASE_MS } from '@/lib/spotify-sync/constants';
import { buildPlaybackFingerprint } from '@/lib/spotify-sync/lease';

describe('spotify-sync helpers', () => {
  it('builds stable fingerprints for track identity', () => {
    expect(
      buildPlaybackFingerprint({
        trackUri: 'spotify:track:abc',
        isPlaying: true,
        deviceId: 'dev-1',
      })
    ).toBe('spotify:track:abc|1|dev-1');

    expect(
      buildPlaybackFingerprint({
        trackUri: 'spotify:track:abc',
        isPlaying: false,
        deviceId: 'dev-1',
      })
    ).toBe('spotify:track:abc|0|dev-1');
  });

  it('treats missing track/device as empty segments', () => {
    expect(
      buildPlaybackFingerprint({
        trackUri: null,
        isPlaying: false,
        deviceId: null,
      })
    ).toBe('|0|');
  });

  it('keeps SLA budgets within 5s', () => {
    expect(PLAYBACK_STALE_MS).toBe(5_000);
    expect(TICK_LEASE_MS).toBeLessThanOrEqual(PLAYBACK_STALE_MS);
  });
});
