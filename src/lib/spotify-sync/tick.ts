import { spotifyService } from '@/lib/spotify';
import { triggerPlaybackUpdate, triggerStatsUpdate } from '@/lib/pusher';
import {
  IDLE_QUEUE_MS,
  PLAYING_QUEUE_MS,
  STATS_UPDATE_MS,
} from './constants';
import {
  buildPlaybackFingerprint,
  ensurePlaybackSyncTable,
  getSyncRow,
  persistSyncState,
  tryAcquireTickLease,
} from './lease';

/** Process-local queue cache (optional); fingerprint/lease live in Neon. */
const lastQueueStates = new Map<string, any[]>();
const lastQueueChecks = new Map<string, number>();
const lastStatsStates = new Map<string, unknown>();
let lastStatsUpdate = 0;
let multiTenantTickRunning = false;

export interface TickResult {
  userId: string;
  username: string;
  skipped: boolean;
  reason?: 'lease' | 'disconnected' | 'error';
  broadcast: boolean;
  isPlaying: boolean;
}

async function autoMarkPlayed(
  userId: string,
  username: string,
  trackUri: string
): Promise<void> {
  try {
    const { sql } = await import('@/lib/db/neon-client');
    const matchingRequest = await sql`
      UPDATE requests
      SET status = 'played',
          played_at = NOW()
      WHERE id = (
        SELECT id FROM requests
        WHERE track_uri = ${trackUri}
          AND status = 'approved'
          AND user_id = ${userId}
        ORDER BY created_at ASC
        LIMIT 1
      )
      RETURNING id, track_name, artist_name, track_uri
    `;

    if (matchingRequest.length > 0) {
      const req = matchingRequest[0];
      console.log(
        `✅ [${username}] Auto-marked request as played: "${req.track_name}" by ${req.artist_name}`
      );
      try {
        const { triggerEvent, getAdminChannel, EVENTS } = await import(
          '@/lib/pusher'
        );
        await triggerEvent(getAdminChannel(userId), EVENTS.STATS_UPDATE, {
          message: `Song "${req.track_name}" marked as played`,
          userId,
        });
      } catch (pusherError) {
        console.error(
          `❌ [${username}] Failed to send auto-mark Pusher event:`,
          pusherError
        );
      }
    }
  } catch (markError) {
    console.error(`❌ [${username}] Error auto-marking song as played:`, markError);
  }
}

/**
 * Poll Spotify for one party and broadcast via Pusher when needed.
 * Coalesced via Neon lease unless `force` is set.
 */
export async function tickUserPlayback(
  userId: string,
  username: string,
  options: {
    force?: boolean;
    /** 0 = always refresh queue */
    queueInterval?: number;
  } = {}
): Promise<TickResult> {
  const force = options.force === true;
  const queueInterval =
    options.queueInterval === undefined ? PLAYING_QUEUE_MS : options.queueInterval;

  try {
    await ensurePlaybackSyncTable();

    const wonLease = await tryAcquireTickLease(userId, { force });
    if (!wonLease) {
      return {
        userId,
        username,
        skipped: true,
        reason: 'lease',
        broadcast: false,
        isPlaying: false,
      };
    }

    const isConnected = await spotifyService.isConnected(userId);
    if (!isConnected) {
      return {
        userId,
        username,
        skipped: true,
        reason: 'disconnected',
        broadcast: false,
        isPlaying: false,
      };
    }

    const now = Date.now();
    const syncRow = await getSyncRow(userId);
    const userLastQueue = lastQueueStates.get(userId);
    const userLastQueueCheck = lastQueueChecks.get(userId) || 0;

    const currentPlayback = await spotifyService
      .getCurrentPlayback(userId)
      .catch(() => null);

    const prevFingerprint = syncRow?.fingerprint ?? null;
    const nextFingerprint = buildPlaybackFingerprint({
      trackUri: currentPlayback?.item?.uri ?? null,
      isPlaying: Boolean(currentPlayback?.is_playing),
      deviceId: currentPlayback?.device?.id ?? null,
    });
    const trackChanged =
      (prevFingerprint?.split('|')[0] || '') !==
      (currentPlayback?.item?.uri || '');

    const effectiveQueueInterval = currentPlayback?.is_playing
      ? queueInterval
      : IDLE_QUEUE_MS;
    const shouldCheckQueue =
      force ||
      queueInterval === 0 ||
      trackChanged ||
      now - userLastQueueCheck >= effectiveQueueInterval;

    let queue: { queue?: any[] } | null = null;
    if (shouldCheckQueue) {
      if (trackChanged && currentPlayback?.item?.uri) {
        await autoMarkPlayed(userId, username, currentPlayback.item.uri);
      }
      queue = await spotifyService.getQueue(userId).catch(() => null);
      lastQueueChecks.set(userId, now);
      if (queue?.queue) {
        lastQueueStates.set(userId, queue.queue as any[]);
      }
    } else {
      queue = userLastQueue ? { queue: userLastQueue } : null;
    }

    const fingerprintChanged = prevFingerprint !== nextFingerprint;
    const isPlaying = Boolean(currentPlayback?.is_playing);
    const queueChanged =
      shouldCheckQueue &&
      JSON.stringify(queue?.queue) !== JSON.stringify(userLastQueue);

    // Always broadcast while playing (progress cadence) or when identity/queue changes.
    const shouldBroadcast =
      fingerprintChanged ||
      queueChanged ||
      isPlaying ||
      (!currentPlayback && Boolean(prevFingerprint));

    let broadcast = false;

    if (shouldBroadcast) {
      const { getRequestsByStatus } = await import('@/lib/db');
      const userApprovedRequests = await getRequestsByStatus(
        'approved',
        100,
        0,
        userId
      );

      const enhancedQueue = (queue?.queue || userLastQueue || []).map(
        (track: unknown) => {
          const trackRecord = (track ?? {}) as Record<string, any>;
          const matchingRequest = userApprovedRequests.find(
            (req) => req.track_uri === trackRecord.uri
          );
          return {
            ...trackRecord,
            requester_nickname: matchingRequest?.requester_nickname || null,
          };
        }
      );

      const formattedCurrentTrack = currentPlayback?.item
        ? {
            name: currentPlayback.item.name,
            artists:
              currentPlayback.item.artists?.map(
                (a: { name?: string }) => a.name
              ) || [],
            album: currentPlayback.item.album,
            duration_ms: currentPlayback.item.duration_ms,
            uri: currentPlayback.item.uri,
            id: currentPlayback.item.id,
          }
        : null;

      try {
        await triggerPlaybackUpdate({
          current_track: formattedCurrentTrack,
          queue: enhancedQueue,
          is_playing: isPlaying,
          progress_ms: currentPlayback?.progress_ms || 0,
          device: currentPlayback?.device || null,
          timestamp: Date.now(),
          userId,
        });
        broadcast = true;
      } catch (pusherError) {
        console.error(
          `❌ [${username}] Failed to trigger playback update:`,
          pusherError
        );
      }
    }

    await persistSyncState(userId, {
      fingerprint: nextFingerprint,
      progressMs: currentPlayback?.progress_ms || 0,
      isPlaying,
      snapshot: currentPlayback
        ? {
            track_uri: currentPlayback.item?.uri ?? null,
            progress_ms: currentPlayback.progress_ms ?? 0,
            is_playing: isPlaying,
            device_id: currentPlayback.device?.id ?? null,
          }
        : null,
    });

    // Stats (shared cadence across users in this isolate)
    if (now - lastStatsUpdate > STATS_UPDATE_MS) {
      const { getAllRequests: getUserRequests } = await import('@/lib/db');
      const allRequests = await getUserRequests(1000, 0, userId);
      const stats = {
        total_requests: allRequests.length,
        pending_requests: allRequests.filter((r) => r.status === 'pending').length,
        approved_requests: allRequests.filter((r) => r.status === 'approved')
          .length,
        rejected_requests: allRequests.filter((r) => r.status === 'rejected')
          .length,
        played_requests: allRequests.filter((r) => r.status === 'played').length,
        unique_requesters: new Set(
          allRequests.map((r) => r.requester_nickname || 'Anonymous')
        ).size,
        spotify_connected: isConnected,
      };
      const lastStats = lastStatsStates.get(userId);
      if (!lastStats || JSON.stringify(lastStats) !== JSON.stringify(stats)) {
        try {
          await triggerStatsUpdate({ ...stats, userId });
          lastStatsStates.set(userId, stats);
        } catch (pusherError) {
          console.error(
            `❌ [${username}] Failed to trigger stats update:`,
            pusherError
          );
        }
      }
      lastStatsUpdate = now;
    }

    return {
      userId,
      username,
      skipped: false,
      broadcast,
      isPlaying,
    };
  } catch (error) {
    console.error(`🎵 [${username}] Spotify tick error:`, error);
    return {
      userId,
      username,
      skipped: true,
      reason: 'error',
      broadcast: false,
      isPlaying: false,
    };
  }
}

export interface MultiTenantTickResult {
  results: TickResult[];
  checked: number;
  broadcastCount: number;
}

/** Tick all live/standby parties with Spotify connected (LIMIT 10). */
export async function tickAllActiveParties(
  options: { force?: boolean; queueInterval?: number } = {}
): Promise<MultiTenantTickResult> {
  if (multiTenantTickRunning) {
    console.log('🎵 Spotify sync: multi-tenant tick already running — skip');
    return { results: [], checked: 0, broadcastCount: 0 };
  }
  multiTenantTickRunning = true;

  try {
    await ensurePlaybackSyncTable();
    const { sql } = await import('@/lib/db/neon-client');
    const usersWithSpotify = await sql`
      SELECT u.id as user_id, u.username, e.status as event_status
      FROM users u
      INNER JOIN events e ON e.user_id = u.id
      WHERE EXISTS (
        SELECT 1 FROM spotify_auth sa
        WHERE sa.user_id = u.id
        AND (
          (sa.access_token IS NOT NULL AND sa.refresh_token IS NOT NULL)
          OR (
            sa.access_token_envelope IS NOT NULL
            AND sa.refresh_token_envelope IS NOT NULL
          )
        )
      )
      AND e.status IN ('live', 'standby')
      LIMIT 10
    `;

    const results: TickResult[] = [];
    for (const row of usersWithSpotify) {
      const result = await tickUserPlayback(row.user_id, row.username, {
        force: options.force,
        queueInterval: options.queueInterval,
      });
      results.push(result);
    }

    return {
      results,
      checked: results.filter((r) => !r.skipped).length,
      broadcastCount: results.filter((r) => r.broadcast).length,
    };
  } finally {
    multiTenantTickRunning = false;
  }
}
