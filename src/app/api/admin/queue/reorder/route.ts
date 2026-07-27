import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import {
  getProviderCapabilities,
  reorderAppOwnedQueue,
} from '@/lib/playback';

/**
 * Reorder PartyPlaylist's app-owned approved queue (PRD-07).
 * Native Spotify queue reorder remains unsupported.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const body = await req.json().catch(() => ({}));
    const {
      orderedIds,
      expectedVersion,
      fromIndex,
      toIndex,
      target: reorderTarget,
    } = body as {
      orderedIds?: string[];
      expectedVersion?: number;
      fromIndex?: number;
      toIndex?: number;
      /** 'app' (default) | 'spotify' — spotify always refused */
      target?: string;
    };

    if (reorderTarget === 'spotify') {
      return NextResponse.json(
        {
          success: false,
          code: 'CAPABILITY_NOT_SUPPORTED',
          error:
            'Spotify playback queue reorder is not supported. PartyPlaylist request priority ordering is separate from the Spotify queue.',
          capability: 'spotify.queue.reorder',
        },
        { status: 501 }
      );
    }

    const { capabilities } = await getProviderCapabilities(userId);
    if (!capabilities.appOwnedQueueReorder) {
      return NextResponse.json(
        {
          success: false,
          code: 'CAPABILITY_NOT_SUPPORTED',
          error: 'App-owned queue reorder is not available',
          capability: 'app.queue.reorder',
        },
        { status: 501 }
      );
    }

    let ids = orderedIds;
    if ((!ids || ids.length === 0) && typeof fromIndex === 'number' && typeof toIndex === 'number') {
      const { listAppOwnedQueue } = await import('@/lib/playback');
      const current = await listAppOwnedQueue(userId);
      const next = current.map((r) => r.id);
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= next.length ||
        toIndex >= next.length
      ) {
        return NextResponse.json(
          { success: false, code: 'INVALID_INDEX', error: 'Invalid reorder indices' },
          { status: 400 }
        );
      }
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      ids = next;
    }

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_ORDER',
          error: 'orderedIds (or fromIndex/toIndex) required',
        },
        { status: 400 }
      );
    }

    const result = await reorderAppOwnedQueue(userId, ids, expectedVersion);
    if (!result.ok) {
      const status =
        result.code === 'VERSION_CONFLICT'
          ? 409
          : result.code === 'ORDER_MISMATCH'
            ? 409
            : 400;
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          error: result.message,
        },
        { status }
      );
    }

    console.log(
      `🔄 [admin/queue/reorder] App-owned queue reordered for ${auth.user.username} (v${result.queueVersion})`
    );

    return NextResponse.json({
      success: true,
      queueVersion: result.queueVersion,
      requests: result.requests,
      note: 'PartyPlaylist app-owned queue order updated (not the Spotify queue)',
    });
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
