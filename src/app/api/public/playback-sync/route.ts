import { NextRequest, NextResponse } from 'next/server';
import { requireGuestAccess } from '@/lib/guest-access';
import { getPlaybackMode } from '@/lib/playback';
import { refreshPlaybackState } from '@/lib/reliability/refresh-playback';

/**
 * Access-code gated per-party Spotify sync tick for open display screens.
 * Coalesced server-side so multiple displays/admins share one Spotify poll.
 * Uses PRD-06 refreshPlaybackState (debounce / fetched_at / degraded).
 * Skipped entirely when the event is in manual mode (no Spotify heartbeat).
 */
export async function POST(req: NextRequest) {
  if (process.env.SPOTIFY_MOCK === 'true') {
    return NextResponse.json({ success: true, mocked: true, coalesced: false });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const username =
      (typeof body.username === 'string' && body.username) ||
      new URL(req.url).searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const access = await requireGuestAccess(
      req,
      username,
      body as Record<string, unknown>
    );
    if (!access.ok) {
      return access.response;
    }

    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id as string;
    const mode = await getPlaybackMode(userId);
    if (mode === 'manual') {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'manual_mode',
        coalesced: false,
        playback_mode: 'manual',
      });
    }

    const force = body.force === true;

    const refresh = await refreshPlaybackState(
      userId,
      username,
      'public-playback-sync',
      { force }
    );

    return NextResponse.json({
      success: true,
      coalesced: refresh.debounced || (refresh.tick.skipped && refresh.tick.reason === 'lease'),
      skipped: refresh.tick.skipped,
      reason: refresh.tick.reason,
      broadcast: refresh.tick.broadcast,
      isPlaying: refresh.tick.isPlaying,
      snapshot: {
        fetchedAt: refresh.snapshot.fetchedAt,
        providerStatus: refresh.snapshot.providerStatus,
        stale: refresh.snapshot.stale,
        degraded: refresh.snapshot.degraded,
      },
    });
  } catch (error) {
    console.error('Public playback-sync error:', error);
    return NextResponse.json({ error: 'Playback sync failed' }, { status: 500 });
  }
}
