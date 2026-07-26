import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { clearSpotifyAuth, clearOAuthSessionsForUser } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`🔄 [spotify/reset] User ${auth.user.username} (${userId}) resetting Spotify connection`);
    
    // Clear this user's Spotify auth only (never fall back to another tenant)
    const { spotifyService } = await import('@/lib/spotify');
    await spotifyService.revokeTokens(userId);

    // revokeTokens already clears DB + playlist cache; keep explicit clear for safety
    await clearSpotifyAuth(userId);
    await clearOAuthSessionsForUser(userId);
    
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
