import { NextRequest, NextResponse } from 'next/server';
import { triggerTokenExpired } from '@/lib/pusher';
import { TokenExpiredEvent } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    const { reason, message } = await req.json();
    console.log('Received token expiration notification:', { reason, message });

    const eventData: TokenExpiredEvent = {
      reason: reason || 'unknown',
      message: message || 'Admin token has expired or is invalid.',
      timestamp: Date.now(),
    };

    await triggerTokenExpired(eventData);

    return NextResponse.json({ 
      success: true, 
      message: 'Token expiration event triggered successfully' 
    });
  } catch (error) {
    console.error('Error triggering token expired event:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to trigger token expired event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
