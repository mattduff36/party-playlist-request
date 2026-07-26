/**
 * Spotify adapter — wraps existing spotifyService behind PlaybackProvider (PRD-07).
 */

import { spotifyService } from '@/lib/spotify';
import {
  SpotifyServiceError,
  type SpotifyErrorCategory,
} from '@/lib/spotify/token-errors';
import { getTrackAlbumImageUrl } from '@/lib/spotify-album-art';
import { formatArtists } from '@/lib/format-artists';
import type { PlaybackProvider } from './provider';
import { unsupportedResult } from './provider';
import type {
  ConnectionStatus,
  EventPlaybackContext,
  OperationResult,
  PlaybackCapabilities,
  PlaybackSnapshot,
  ProviderErrorCategory,
  ProviderTrack,
  QueueOperationResult,
  TrackSearchResult,
} from './types';

const SPOTIFY_CAPABILITIES: PlaybackCapabilities = {
  search: true,
  queueAdd: true,
  providerQueueReorder: false,
  appOwnedQueueReorder: true,
  playbackControls: true,
  nowPlaying: true,
  deviceSelection: true,
  volume: true,
  manualTextRequest: false,
  markPlaying: false,
};

function mapSpotifyCategory(
  category: SpotifyErrorCategory
): ProviderErrorCategory {
  switch (category) {
    case 'rate_limit':
      return 'rate_limit';
    case 'no_active_device':
      return 'no_active_device';
    case 'provider_outage':
      return 'provider_outage';
    case 'expired_authorization':
    case 'development_mode_denial':
      return 'expired_authorization';
    default:
      return 'unknown';
  }
}

function failFromError(error: unknown, fallback: string): OperationResult {
  if (error instanceof SpotifyServiceError) {
    return {
      ok: false,
      category: mapSpotifyCategory(error.category),
      message: error.message || fallback,
      code: error.category,
    };
  }
  const message = error instanceof Error ? error.message : fallback;
  return { ok: false, category: 'unknown', message, code: 'UNKNOWN' };
}

function toProviderTrack(track: {
  id?: string;
  uri?: string;
  name?: string;
  artists?: Array<{ name: string } | string>;
  album?: { name?: string; images?: Array<{ url: string }> };
  duration_ms?: number;
  explicit?: boolean;
}): ProviderTrack {
  const artists = Array.isArray(track.artists)
    ? formatArtists(track.artists as Array<{ name: string }>)
    : '';
  return {
    providerId: 'spotify',
    providerTrackId: track.id ?? null,
    uri: track.uri ?? null,
    title: track.name ?? 'Unknown',
    artists,
    album: track.album?.name ?? null,
    artworkUrl: getTrackAlbumImageUrl(track as never) ?? null,
    durationMs: track.duration_ms ?? 0,
    explicit: Boolean(track.explicit),
  };
}

export class SpotifyPlaybackProvider implements PlaybackProvider {
  readonly id = 'spotify';

  getCapabilities(): PlaybackCapabilities {
    return { ...SPOTIFY_CAPABILITIES };
  }

  async getConnectionStatus(
    context: EventPlaybackContext
  ): Promise<ConnectionStatus> {
    try {
      const connected = await spotifyService.isConnectedAndValid(context.userId);
      return {
        state: connected ? 'connected' : 'disconnected',
        providerId: this.id,
        message: connected
          ? 'Spotify connected'
          : 'Spotify is not connected',
      };
    } catch (error) {
      return {
        state: 'error',
        providerId: this.id,
        message:
          error instanceof Error ? error.message : 'Spotify status check failed',
      };
    }
  }

  async searchTracks(
    query: string,
    context: EventPlaybackContext
  ): Promise<TrackSearchResult[]> {
    const tracks = await spotifyService.searchTracks(query, 20, context.userId);
    return (tracks || []).map((t: Parameters<typeof toProviderTrack>[0]) => ({
      ...toProviderTrack(t),
      previewUrl: null,
    }));
  }

  async getPlaybackState(
    context: EventPlaybackContext
  ): Promise<PlaybackSnapshot> {
    const playback = await spotifyService.getCurrentPlayback(context.userId);
    const item = playback?.item;
    return {
      providerId: this.id,
      isPlaying: Boolean(playback?.is_playing),
      progressMs: playback?.progress_ms ?? 0,
      durationMs: item?.duration_ms ?? 0,
      track: item ? toProviderTrack(item) : null,
      deviceName: playback?.device?.name ?? null,
      volumePercent: playback?.device?.volume_percent ?? null,
      fetchedAt: new Date().toISOString(),
      appOwned: false,
    };
  }

  async addToQueue(
    track: ProviderTrack,
    context: EventPlaybackContext
  ): Promise<QueueOperationResult> {
    if (!track.uri) {
      return {
        ok: false,
        category: 'validation',
        code: 'TRACK_URI_REQUIRED',
        message: 'Spotify queue add requires a track URI',
      };
    }
    try {
      await spotifyService.addToQueue(
        track.uri,
        context.deviceId,
        context.userId
      );
      return { ok: true };
    } catch (error) {
      return failFromError(error, 'Failed to add to Spotify queue');
    }
  }

  async pause(context: EventPlaybackContext): Promise<OperationResult> {
    try {
      await spotifyService.pause(context.deviceId, context.userId);
      return { ok: true };
    } catch (error) {
      return failFromError(error, 'Failed to pause playback');
    }
  }

  async resume(context: EventPlaybackContext): Promise<OperationResult> {
    try {
      await spotifyService.resumePlayback(context.deviceId, context.userId);
      return { ok: true };
    } catch (error) {
      return failFromError(error, 'Failed to resume playback');
    }
  }

  async skip(context: EventPlaybackContext): Promise<OperationResult> {
    try {
      await spotifyService.skipToNext(context.deviceId, context.userId);
      return { ok: true };
    } catch (error) {
      return failFromError(error, 'Failed to skip track');
    }
  }

  async setVolume(
    value: number,
    context: EventPlaybackContext
  ): Promise<OperationResult> {
    try {
      await spotifyService.setVolume(value, context.deviceId, context.userId);
      return { ok: true };
    } catch (error) {
      return failFromError(error, 'Failed to set volume');
    }
  }
}

export const spotifyPlaybackProvider = new SpotifyPlaybackProvider();

/** Spotify cannot reorder its opaque queue — always refuse. */
export function spotifyProviderQueueReorderUnsupported(): OperationResult {
  return unsupportedResult(
    'spotify.queue.reorder',
    'Spotify playback queue reorder is not supported'
  );
}
