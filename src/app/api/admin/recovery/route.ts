/**
 * Event-day recovery centre diagnostics (PRD-08).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPool } from '@/lib/db';
import { getPlaybackMode } from '@/lib/playback';
import { buildRecoveryIssues } from '@/lib/beta/recovery';
import { resolveActiveSpotifyDevice } from '@/lib/spotify/active-device';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const userId = auth.user.user_id;
  const mode = await getPlaybackMode(userId);
  const pool = getPool();

  let spotifyConnected = false;
  let requiresManualReconnect = false;
  try {
    const { getSpotifyAuth } = await import('@/lib/db');
    const spotifyAuth = await getSpotifyAuth(userId);
    spotifyConnected = Boolean(spotifyAuth);
    if (spotifyAuth && 'requires_manual_reconnect' in spotifyAuth) {
      requiresManualReconnect = Boolean(
        (spotifyAuth as { requires_manual_reconnect?: boolean })
          .requires_manual_reconnect
      );
    }
  } catch {
    spotifyConnected = false;
  }

  const event = await pool.query(
    `SELECT id, version, device_id, status FROM events
     WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );

  let playbackFetchedAt: string | null = null;
  let playbackDegraded = false;
  let providerStatus: string | null = null;
  let syncDeviceId: string | null = null;
  try {
    const sync = await pool.query(
      `SELECT fetched_at, degraded, provider_status, snapshot_json
       FROM spotify_playback_sync WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (sync.rows[0]) {
      playbackFetchedAt = sync.rows[0].fetched_at
        ? new Date(sync.rows[0].fetched_at).toISOString()
        : null;
      playbackDegraded = Boolean(sync.rows[0].degraded);
      providerStatus = sync.rows[0].provider_status
        ? String(sync.rows[0].provider_status)
        : null;
      const snap = sync.rows[0].snapshot_json as
        | { device_id?: string }
        | null;
      if (snap?.device_id) syncDeviceId = String(snap.device_id);
    }
  } catch {
    // table/row optional
  }

  const displayStale = Boolean(
    playbackFetchedAt &&
      Date.now() - new Date(playbackFetchedAt).getTime() > 90_000
  );

  const pusherConfigured = Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_KEY &&
      process.env.PUSHER_SECRET
  );

  // Same truth as sidebar player: live Spotify playback/devices, not only events.device_id
  const activeDevice = spotifyConnected
    ? await resolveActiveSpotifyDevice(userId, {
        eventDeviceId: event.rows[0]?.device_id ?? null,
        syncDeviceId,
        probeLive: mode !== 'manual',
      })
    : {
        hasActiveDevice: false,
        activeDeviceId: null,
        activeDeviceName: null,
        source: 'none' as const,
      };

  const snapshot = {
    playbackMode: mode,
    spotifyConnected,
    requiresManualReconnect,
    hasActiveDevice: activeDevice.hasActiveDevice,
    providerStatus,
    playbackFetchedAt,
    playbackDegraded,
    pusherConfigured,
    displayStale,
    eventVersion: event.rows[0]?.version ?? null,
    online: true,
  };

  const issues = buildRecoveryIssues(snapshot);

  return NextResponse.json({
    success: true,
    issues,
    lastPlaybackRefreshAt: playbackFetchedAt,
    eventVersion: snapshot.eventVersion,
    playbackMode: mode,
    degraded: playbackDegraded,
    eventStatus: event.rows[0]?.status ?? null,
    activeDevice: {
      id: activeDevice.activeDeviceId,
      name: activeDevice.activeDeviceName,
      source: activeDevice.source,
      persistedDeviceId: event.rows[0]?.device_id ?? null,
    },
  });
}
