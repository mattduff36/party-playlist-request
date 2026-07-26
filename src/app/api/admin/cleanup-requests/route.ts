import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { sql } from '@/lib/db/neon-client';

/**
 * Permanently delete archived event request data (PRD-06).
 * Requires explicit confirmation. Never called implicitly on logout/offline.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const body = await req.json().catch(() => ({}));
    const confirm = typeof body.confirm === 'string' ? body.confirm : '';
    const eventId = typeof body.eventId === 'string' ? body.eventId : null;

    if (confirm !== 'DELETE_ARCHIVED_EVENT_DATA') {
      return NextResponse.json(
        {
          success: false,
          code: 'CONFIRMATION_REQUIRED',
          error:
            'Permanent deletion requires confirm: "DELETE_ARCHIVED_EVENT_DATA" and an archived eventId.',
        },
        { status: 400 }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required for archived event deletion' },
        { status: 400 }
      );
    }

    console.log(
      `🧹 [cleanup-requests] Confirmed delete of archived requests for user ${userId} event ${eventId}`
    );

    const result = await sql`
      DELETE FROM requests
      WHERE user_id = ${userId}
        AND event_id = ${eventId}
        AND archived_at IS NOT NULL
      RETURNING id
    `;

    const deletedCount = result.length;

    try {
      const { emitSecurityAudit } = await import('@/lib/auth/security-audit');
      emitSecurityAudit('event.archived_data_deleted', {
        correlationId: auth.correlationId,
        userId,
        eventId,
        meta: { deletedCount },
      });
    } catch {
      // non-fatal
    }

    try {
      const { triggerRequestsCleanup } = await import('@/lib/pusher');
      await triggerRequestsCleanup(userId);
    } catch (pusherError) {
      console.error('❌ [cleanup-requests] Failed to send Pusher event:', pusherError);
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} archived requests`,
      deleted_count: deletedCount,
    });
  } catch (error) {
    console.error('❌ [cleanup-requests] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup requests' },
      { status: 500 }
    );
  }
}
