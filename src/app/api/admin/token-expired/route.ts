import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { triggerTokenExpired, type TokenExpiredEvent } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const body = await req.json().catch(() => ({}));
    const reason =
      body.reason === 'invalid' || body.reason === 'revoked' || body.reason === 'expired'
        ? body.reason
        : 'expired';
    const message =
      typeof body.message === 'string' && body.message.length <= 200
        ? body.message
        : 'Admin token has expired or is invalid.';

    console.log('Received token expiration notification:', {
      userId: auth.user.user_id,
      reason,
    });

    const eventData: TokenExpiredEvent = {
      reason,
      message,
      timestamp: Date.now(),
    };

    await triggerTokenExpired(eventData);

    return NextResponse.json({
      success: true,
      message: 'Token expiration event triggered successfully',
    });
  } catch (error) {
    console.error('Error triggering token expired event:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger token expired event',
      },
      { status: 500 }
    );
  }
}
