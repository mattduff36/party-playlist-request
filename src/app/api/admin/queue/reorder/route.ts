import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';

/**
 * Spotify Web API cannot reorder the playback queue.
 * Until PRD-07 provides an app-owned provider queue, this endpoint refuses
 * with a typed capability error (PRD-06) — never false success.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const body = await req.json().catch(() => ({}));
    const { fromIndex, toIndex } = body as {
      fromIndex?: number;
      toIndex?: number;
    };

    console.log(
      `🔄 [admin/queue/reorder] CAPABILITY_NOT_SUPPORTED for user ${auth.user.username} (${fromIndex}→${toIndex})`
    );

    return NextResponse.json(
      {
        success: false,
        code: 'CAPABILITY_NOT_SUPPORTED',
        error:
          'Spotify playback queue reorder is not supported. PartyPlaylist request priority ordering is separate from the Spotify queue.',
        capability: 'spotify.queue.reorder',
        note:
          'Use request priority (pending/approved list order) until an app-owned queue is available (PRD-07).',
      },
      { status: 501 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error in queue reorder:', error);
    return NextResponse.json(
      { error: 'Failed to process reorder request' },
      { status: 500 }
    );
  }
}
