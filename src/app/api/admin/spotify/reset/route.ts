import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { clearSpotifyAuth } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`🔄 [spotify/reset] User ${auth.user.username} (${userId}) resetting Spotify connection`);
    
    // Properly revoke tokens with Spotify before clearing from database
    const { spotifyService } = await import('@/lib/spotify');
    await spotifyService.revokeTokens();
    
    // Clear user's Spotify auth from database
    await clearSpotifyAuth(userId);
    
    console.log(`✅ Spotify connection reset completed for user ${userId}`);
    
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
