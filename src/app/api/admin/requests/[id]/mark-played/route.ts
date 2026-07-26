import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getRequest, updateRequest } from '@/lib/db';
import {
  clearManualNowPlaying,
  getManualNowPlaying,
  getPlaybackMode,
} from '@/lib/playback';

/**
 * Mark a request as played (manual mode / app-owned queue) — PRD-07.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const { id } = await params;
    const request = await getRequest(id, userId);
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const updated = await updateRequest(
      id,
      { status: 'played' },
      userId
    );

    const mode = await getPlaybackMode(userId);
    if (mode === 'manual') {
      const nowPlaying = await getManualNowPlaying(userId);
      if (nowPlaying?.requestId === id) {
        await clearManualNowPlaying(userId);
      }
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error('mark-played error:', error);
    return NextResponse.json(
      { error: 'Failed to mark request as played' },
      { status: 500 }
    );
  }
}
