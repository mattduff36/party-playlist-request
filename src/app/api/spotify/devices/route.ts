import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    
    // Check if Spotify is connected
    const isConnected = await spotifyService.isConnected(userId);
    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        devices: []
      });
    }

    try {
      const devicesData = await spotifyService.getAvailableDevices(userId);
      
      return NextResponse.json({
        connected: true,
        devices: devicesData?.devices || []
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch devices';
      const isRateLimited =
        message.includes('429') ||
        message.includes('backoff') ||
        message.includes('rate limited');
      // Non-OK so clients keep last-known devices instead of treating as empty
      if (isRateLimited) {
        return NextResponse.json(
          { connected: true, devices: [], error: message },
          { status: 429 }
        );
      }
      console.error('Error fetching Spotify devices:', error);
      return NextResponse.json(
        { connected: true, devices: [], error: message },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error('Error in /api/spotify/devices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


