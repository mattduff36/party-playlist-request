import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { clearSpotifyAuth } from '@/lib/db';

async function handleDisconnect(req: NextRequest) {
  console.log('🔌 [spotify/disconnect] Request received');
  
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      console.log('❌ [spotify/disconnect] Authentication failed');
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`✅ [spotify/disconnect] User ${auth.user.username} (${userId}) disconnecting Spotify`);
    
    console.log('🗑️ [spotify/disconnect] Clearing Spotify authentication from database...');
    await clearSpotifyAuth();
    console.log('✅ [spotify/disconnect] Spotify authentication cleared successfully');
    
    const response = {
      success: true,
      message: 'Spotify account disconnected successfully'
    };
    
    console.log('📤 [spotify/disconnect] Sending success response');
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [spotify/disconnect] Error:', error);
    
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ 
        error: 'Authentication required',
        details: 'Please log in to continue'
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to disconnect Spotify account',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Support both POST and DELETE methods for disconnect
export async function POST(req: NextRequest) {
  return handleDisconnect(req);
}

export async function DELETE(req: NextRequest) {
  return handleDisconnect(req);
}