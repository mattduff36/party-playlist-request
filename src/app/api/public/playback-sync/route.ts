import { NextRequest, NextResponse } from 'next/server';
import { requireGuestAccess } from '@/lib/guest-access';
import { tickUserPlayback } from '@/lib/spotify-sync';

/**
 * Access-code gated per-party Spotify sync tick for open display screens.
 * Coalesced server-side so multiple displays/admins share one Spotify poll.
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
    const force = body.force === true;

    const result = await tickUserPlayback(userId, username, { force });

    return NextResponse.json({
      success: true,
      coalesced: result.skipped && result.reason === 'lease',
      skipped: result.skipped,
      reason: result.reason,
      broadcast: result.broadcast,
      isPlaying: result.isPlaying,
    });
  } catch (error) {
    console.error('Public playback-sync error:', error);
    return NextResponse.json({ error: 'Playback sync failed' }, { status: 500 });
  }
}
