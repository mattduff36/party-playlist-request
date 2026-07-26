/**
 * Manual / request-only provider — no Spotify OAuth, Premium, or device (PRD-07).
 */

import { getPool } from '@/lib/db';
import type { PlaybackProvider } from './provider';
import { unsupportedResult } from './provider';
import type {
  ConnectionStatus,
  EventPlaybackContext,
  ManualNowPlaying,
  OperationResult,
  PlaybackCapabilities,
  PlaybackSnapshot,
  ProviderTrack,
  QueueOperationResult,
} from './types';

const MANUAL_CAPABILITIES: PlaybackCapabilities = {
  search: false,
  queueAdd: false,
  providerQueueReorder: false,
  appOwnedQueueReorder: true,
  playbackControls: false,
  nowPlaying: true,
  deviceSelection: false,
  volume: false,
  manualTextRequest: true,
  markPlaying: true,
};

export class ManualPlaybackProvider implements PlaybackProvider {
  readonly id = 'manual';

  getCapabilities(): PlaybackCapabilities {
    return { ...MANUAL_CAPABILITIES };
  }

  async getConnectionStatus(
    _context: EventPlaybackContext
  ): Promise<ConnectionStatus> {
    return {
      state: 'not_required',
      providerId: this.id,
      message:
        'Manual request mode — PartyPlaylist does not play music; use any playback device separately.',
    };
  }

  async getPlaybackState(
    context: EventPlaybackContext
  ): Promise<PlaybackSnapshot> {
    const nowPlaying = await getManualNowPlaying(context.userId);
    if (!nowPlaying) {
      return {
        providerId: this.id,
        isPlaying: false,
        track: null,
        fetchedAt: new Date().toISOString(),
        appOwned: true,
        label: 'Manual mode',
      };
    }
    return {
      providerId: this.id,
      isPlaying: true,
      track: {
        providerId: this.id,
        providerTrackId: nowPlaying.requestId ?? null,
        title: nowPlaying.title,
        artists: nowPlaying.artists,
        album: nowPlaying.album ?? null,
        artworkUrl: nowPlaying.artworkUrl ?? null,
        durationMs: 0,
      },
      fetchedAt: nowPlaying.setAt,
      appOwned: true,
      label: 'Manual now playing',
    };
  }

  async addToQueue(
    _track: ProviderTrack,
    _context: EventPlaybackContext
  ): Promise<QueueOperationResult> {
    return unsupportedResult(
      'manual.queueAdd',
      'Manual mode has no provider queue; use the PartyPlaylist request queue'
    );
  }

  async pause(_context: EventPlaybackContext): Promise<OperationResult> {
    return unsupportedResult('manual.pause');
  }

  async resume(_context: EventPlaybackContext): Promise<OperationResult> {
    return unsupportedResult('manual.resume');
  }

  async skip(_context: EventPlaybackContext): Promise<OperationResult> {
    return unsupportedResult('manual.skip');
  }

  async setVolume(
    _value: number,
    _context: EventPlaybackContext
  ): Promise<OperationResult> {
    return unsupportedResult('manual.volume');
  }
}

export const manualPlaybackProvider = new ManualPlaybackProvider();

export async function getManualNowPlaying(
  userId: string
): Promise<ManualNowPlaying | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT manual_now_playing
     FROM events
     WHERE user_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [userId]
  );
  const raw = result.rows[0]?.manual_now_playing;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as ManualNowPlaying;
  if (!row.title || !row.artists) return null;
  return row;
}

export async function setManualNowPlaying(
  userId: string,
  value: ManualNowPlaying | null
): Promise<ManualNowPlaying | null> {
  const pool = getPool();
  const payload = value ? JSON.stringify(value) : null;
  await pool.query(
    `UPDATE events
     SET manual_now_playing = $2::jsonb,
         updated_at = NOW()
     WHERE user_id = $1
       AND id = (
         SELECT id FROM events
         WHERE user_id = $1
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT 1
       )`,
    [userId, payload]
  );
  return value;
}

export async function clearManualNowPlaying(userId: string): Promise<void> {
  await setManualNowPlaying(userId, null);
}
