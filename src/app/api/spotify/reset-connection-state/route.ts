/**
 * Spotify Connection State Reset API Route
 * 
 * Allows manual reset of connection state (e.g., after admin fixes Spotify credentials)
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetSpotifyConnectionState } from '@/lib/spotify-connection-state';
import { authService } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const isValid = await authService.verifyToken(token);
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Reset the connection state
    resetSpotifyConnectionState();
    
    return NextResponse.json({
      success: true,
      message: 'Spotify connection state has been reset. Retry attempts will resume.'
    });

  } catch (error) {
    console.error('Error resetting Spotify connection state:', error);
    return NextResponse.json({
      error: 'Failed to reset connection state'
    }, { status: 500 });
  }
}

