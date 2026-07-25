import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';

/**
 * Legacy party-playlist destination API.
 * Playlists are read-only; approved requests go to the play queue only.
 * Kept so old clients get a clear disabled response instead of writing settings.
 */

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    return NextResponse.json({
      party_playlist_id: null,
      disabled: true,
      message:
        'Party playlist destination is disabled. Playlists are browse-only; approvals go to the play queue.',
    });
  } catch (error) {
    console.error('Error getting party playlist setting:', error);
    return NextResponse.json({ error: 'Failed to get party playlist' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    // Intentionally no-op: do not persist party_playlist_id anymore
    return NextResponse.json(
      {
        success: false,
        disabled: true,
        party_playlist_id: null,
        error:
          'Party playlist destination is disabled. Use Playlists to browse and queue tracks instead.',
      },
      { status: 410 }
    );
  } catch (error) {
    console.error('Error saving party playlist setting:', error);
    return NextResponse.json({ error: 'Failed to save party playlist' }, { status: 500 });
  }
}
