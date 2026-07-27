/**
 * Active-device resolution for Recovery / Ready (matches player widget truth).
 */

jest.mock('@/lib/spotify', () => ({
  spotifyService: {
    getCurrentPlayback: jest.fn(),
    getAvailableDevices: jest.fn(),
  },
}));

import { resolveActiveSpotifyDevice } from '@/lib/spotify/active-device';
import { spotifyService } from '@/lib/spotify';

describe('resolveActiveSpotifyDevice', () => {
  const getCurrentPlayback = jest.mocked(spotifyService.getCurrentPlayback);
  const getAvailableDevices = jest.mocked(spotifyService.getAvailableDevices);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses live playback device even when events.device_id is null', async () => {
    getCurrentPlayback.mockResolvedValue({
      device: { id: 'dev-1', name: 'MPDEE-SERVER', is_active: true },
      is_playing: true,
    });

    const result = await resolveActiveSpotifyDevice('user-1', {
      eventDeviceId: null,
    });

    expect(result.hasActiveDevice).toBe(true);
    expect(result.activeDeviceName).toBe('MPDEE-SERVER');
    expect(result.source).toBe('playback');
    expect(getAvailableDevices).not.toHaveBeenCalled();
  });

  it('falls back to devices list when playback has no device', async () => {
    getCurrentPlayback.mockResolvedValue({ device: null, is_playing: false });
    getAvailableDevices.mockResolvedValue({
      devices: [
        { id: 'idle', name: 'Phone', is_active: false },
        { id: 'active', name: 'MPDEE-SERVER', is_active: true },
      ],
    });

    const result = await resolveActiveSpotifyDevice('user-1');
    expect(result.hasActiveDevice).toBe(true);
    expect(result.activeDeviceId).toBe('active');
    expect(result.source).toBe('devices');
  });

  it('falls back to events.device_id when Spotify probe fails', async () => {
    getCurrentPlayback.mockRejectedValue(new Error('rate limited'));

    const result = await resolveActiveSpotifyDevice('user-1', {
      eventDeviceId: 'persisted-device',
    });

    expect(result.hasActiveDevice).toBe(true);
    expect(result.source).toBe('events');
    expect(result.activeDeviceId).toBe('persisted-device');
  });

  it('reports none when live and persisted signals are empty', async () => {
    getCurrentPlayback.mockResolvedValue(null);
    getAvailableDevices.mockResolvedValue({ devices: [] });

    const result = await resolveActiveSpotifyDevice('user-1', {
      eventDeviceId: null,
      syncDeviceId: null,
    });

    expect(result.hasActiveDevice).toBe(false);
    expect(result.source).toBe('none');
  });

  it('uses sync snapshot when live probe is skipped and events.device_id empty', async () => {
    const result = await resolveActiveSpotifyDevice('user-1', {
      eventDeviceId: null,
      syncDeviceId: 'sync-device',
      probeLive: false,
    });

    expect(result.hasActiveDevice).toBe(true);
    expect(result.activeDeviceId).toBe('sync-device');
    expect(result.source).toBe('sync');
    expect(getCurrentPlayback).not.toHaveBeenCalled();
    expect(getAvailableDevices).not.toHaveBeenCalled();
  });

  it('prefers events.device_id over sync when both persisted', async () => {
    const result = await resolveActiveSpotifyDevice('user-1', {
      eventDeviceId: 'event-device',
      syncDeviceId: 'sync-device',
      probeLive: false,
    });

    expect(result.hasActiveDevice).toBe(true);
    expect(result.activeDeviceId).toBe('event-device');
    expect(result.source).toBe('events');
  });
});
