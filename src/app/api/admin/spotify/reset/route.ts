import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { clearSpotifyAuth } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    await authService.requireAdminAuth(req);
    
    // Clear all Spotify authentication data
    await clearSpotifyAuth();
    
    console.log('Admin reset Spotify connection - all auth data cleared');
    
    return NextResponse.json({
      success: true,
      message: 'Spotify connection reset successfully. You can now reconnect to Spotify.'
    });
    
  } catch (error) {
    console.error('Error resetting Spotify connection:', error);
    
    if (error instanceof Error && (error.message.includes('No token provided') || error.message.includes('Admin access required'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to reset Spotify connection' 
    }, { status: 500 });
  }
}
