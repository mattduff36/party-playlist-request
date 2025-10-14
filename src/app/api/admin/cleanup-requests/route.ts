import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { sql } from '@/lib/db/neon-client';

/**
 * Cleanup All Requests for a User
 * Called when event goes offline (logout, expiry, manual status change)
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`🧹 [cleanup-requests] Cleaning up all requests for user ${userId}...`);

    // Delete all requests for this user
    const result = await sql`
      DELETE FROM requests
      WHERE user_id = ${userId}
      RETURNING id
    `;

    const deletedCount = result.length;
    console.log(`✅ [cleanup-requests] Deleted ${deletedCount} requests for user ${userId}`);

    // Broadcast cleanup event via Pusher
    try {
      const { triggerRequestsCleanup } = await import('@/lib/pusher');
      await triggerRequestsCleanup(userId);
      console.log(`📡 [cleanup-requests] Pusher cleanup event sent`);
    } catch (pusherError) {
      console.error('❌ [cleanup-requests] Failed to send Pusher event:', pusherError);
      // Don't fail the cleanup if Pusher fails
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} requests`,
      deleted_count: deletedCount
    });

  } catch (error) {
    console.error('❌ [cleanup-requests] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup requests' },
      { status: 500 }
    );
  }
}

