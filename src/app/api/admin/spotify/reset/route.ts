import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { clearSpotifyAuth } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    await authService.requireAdminAuth(req);
    
    console.log('🔄 Admin initiated Spotify connection reset');
    
    // Properly revoke tokens with Spotify before clearing from database
    const { spotifyService } = await import('@/lib/spotify');
    await spotifyService.revokeTokens();
    
    console.log('✅ Spotify connection reset completed - tokens revoked and cleared');
    
    return NextResponse.json({
      success: true,
      message: 'Spotify connection reset successfully. All tokens have been revoked. You will need to re-authenticate with Spotify.'
    });
    
  } catch (error) {
    console.error('Error resetting Spotify connection:', error);
    
    if (error instanceof Error && (error.message.includes('No token provided') || error.message.includes('Admin access required'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to reset Spotify connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
