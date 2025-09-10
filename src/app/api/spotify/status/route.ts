import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const isAuthenticated = await spotifyService.isAuthenticated();
    
    let userInfo = null;
    let devices = [];
    
    if (isAuthenticated) {
      try {
        userInfo = await spotifyService.getUserInfo();
        devices = await spotifyService.getDevices();
      } catch (error) {
        console.error('Error getting Spotify user info:', error);
      }
    }

    return NextResponse.json({
      authenticated: isAuthenticated,
      user: userInfo,
      devices: devices
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error checking Spotify status:', error);
    return NextResponse.json({ 
      error: 'Failed to check Spotify status' 
    }, { status: 500 });
  }
}