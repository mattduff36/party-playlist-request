/**
 * Resolve whether Spotify currently has an active playback device.
 * Matches admin player widget truth (queue/details → /me/player + /me/player/devices),
 * not merely events.device_id which is often unset while playback is live.
 */

export interface ActiveDeviceResolution {
  hasActiveDevice: boolean;
  activeDeviceId: string | null;
  activeDeviceName: string | null;
  /** Where the positive signal came from */
  source: 'playback' | 'devices' | 'events' | 'sync' | 'none';
}

interface ResolveActiveDeviceOptions {
  /** Persisted organiser target from events.device_id */
  eventDeviceId?: string | null;
  /** Cached sync snapshot device_id (spotify_playback_sync.snapshot_json) */
  syncDeviceId?: string | null;
  /** Prefer skipping live Spotify calls when false */
  probeLive?: boolean;
}

export async function resolveActiveSpotifyDevice(
  userId: string,
  options: ResolveActiveDeviceOptions = {}
): Promise<ActiveDeviceResolution> {
  const probeLive = options.probeLive !== false;

  if (probeLive) {
    try {
      const { spotifyService } = await import('@/lib/spotify');
      const playback = await spotifyService.getCurrentPlayback(userId);
      const playbackDevice = playback?.device as
        | { id?: string; name?: string; is_active?: boolean }
        | undefined;
      if (playbackDevice?.id) {
        return {
          hasActiveDevice: true,
          activeDeviceId: String(playbackDevice.id),
          activeDeviceName: playbackDevice.name
            ? String(playbackDevice.name)
            : null,
          source: 'playback',
        };
      }

      const devicesData = await spotifyService.getAvailableDevices(userId);
      const devices = (devicesData?.devices ?? []) as Array<{
        id?: string;
        name?: string;
        is_active?: boolean;
      }>;
      const active = devices.find((d) => d.is_active && d.id);
      if (active?.id) {
        return {
          hasActiveDevice: true,
          activeDeviceId: String(active.id),
          activeDeviceName: active.name ? String(active.name) : null,
          source: 'devices',
        };
      }
    } catch {
      // Fall through to persisted / sync signals
    }
  }

  if (options.eventDeviceId) {
    return {
      hasActiveDevice: true,
      activeDeviceId: String(options.eventDeviceId),
      activeDeviceName: null,
      source: 'events',
    };
  }

  if (options.syncDeviceId) {
    return {
      hasActiveDevice: true,
      activeDeviceId: String(options.syncDeviceId),
      activeDeviceName: null,
      source: 'sync',
    };
  }

  return {
    hasActiveDevice: false,
    activeDeviceId: null,
    activeDeviceName: null,
    source: 'none',
  };
}
