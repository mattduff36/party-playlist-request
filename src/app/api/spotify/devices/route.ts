import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
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
      console.error('Error fetching Spotify devices:', error);
      return NextResponse.json({
        connected: true,
        devices: [],
        error: error instanceof Error ? error.message : 'Failed to fetch devices'
      });
    }

  } catch (error) {
    console.error('Error in /api/spotify/devices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


