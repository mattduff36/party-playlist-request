import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { clearSpotifyAuth } from '@/lib/db';

async function handleDisconnect(req: NextRequest) {
  console.log('🔌 Spotify disconnect request received');
  
  try {
    console.log('🔐 Verifying admin authentication...');
    await authService.requireAdminAuth(req);
    console.log('✅ Admin authentication verified');
    
    console.log('🗑️ Clearing Spotify authentication from database...');
    await clearSpotifyAuth();
    console.log('✅ Spotify authentication cleared successfully');
    
    const response = {
      success: true,
      message: 'Spotify account disconnected successfully'
    };
    
    console.log('📤 Sending success response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error in disconnect handler:', error);
    
    if (error instanceof Error && error.message.includes('token')) {
      console.log('🔐 Authentication error, returning 401');
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('💥 Unexpected error disconnecting Spotify:', error);
    return NextResponse.json({ 
      error: 'Failed to disconnect Spotify account' 
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