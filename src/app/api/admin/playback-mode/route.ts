import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import {
  getPlaybackMode,
  getProviderCapabilities,
  isPlaybackMode,
  setPlaybackMode,
} from '@/lib/playback';

/**
 * GET/POST organiser playback mode (spotify | manual) — PRD-07.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const { mode, capabilities } = await getProviderCapabilities(userId);
    const provider = await import('@/lib/playback').then((m) =>
      m.getProviderByMode(mode)
    );
    const connection = await provider.getConnectionStatus({ userId });

    return NextResponse.json({
      success: true,
      mode,
      capabilities,
      connection,
      explanation:
        mode === 'manual'
          ? 'Manual request mode collects and moderates song requests. PartyPlaylist does not play music or require Spotify.'
          : 'Spotify mode uses your connected Spotify account for search, queue add, and playback controls.',
    });
  } catch (error) {
    console.error('playback-mode GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load playback mode' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode;
    if (!isPlaybackMode(mode)) {
      return NextResponse.json(
        {
          error: 'mode must be "spotify" or "manual"',
          code: 'INVALID_MODE',
        },
        { status: 400 }
      );
    }

    const result = await setPlaybackMode(auth.user.user_id, mode, {
      username: auth.user.username,
      reason: typeof body.reason === 'string' ? body.reason : 'organiser',
    });

    const { capabilities } = await getProviderCapabilities(auth.user.user_id);

    return NextResponse.json({
      success: true,
      mode: result.mode,
      previous: result.previous,
      eventId: result.eventId,
      capabilities,
      note:
        result.previous !== result.mode && result.mode === 'spotify'
          ? 'Switched to Spotify without re-queuing approved requests'
          : undefined,
    });
  } catch (error) {
    console.error('playback-mode POST error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to set playback mode';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
