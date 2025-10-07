import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getOAuthSession, clearOAuthSession } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      console.log('❌ [spotify/oauth-session] Authentication failed');
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`✅ [spotify/oauth-session] User ${auth.user.username} (${userId}) retrieving OAuth session`);
    
    const { searchParams } = new URL(req.url);
    const state = searchParams.get('state');
    
    if (!state) {
      return NextResponse.json({ error: 'State parameter required' }, { status: 400 });
    }
    
    console.log('🔍 [spotify/oauth-session] Looking up OAuth session for state:', state);
    const session = await getOAuthSession(state);
    
    if (!session) {
      console.log('❌ [spotify/oauth-session] OAuth session not found for state:', state);
      return NextResponse.json({ error: 'OAuth session not found or expired' }, { status: 404 });
    }
    
    console.log('✅ [spotify/oauth-session] OAuth session found, returning code verifier');
    
    // Clean up the session after retrieving it (one-time use)
    await clearOAuthSession(state);
    
    return NextResponse.json({
      code_verifier: session.code_verifier
    });
    
  } catch (error) {
    console.error('❌ [spotify/oauth-session] Error:', error);
    
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ 
        error: 'Authentication required',
        details: 'Please log in to continue'
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to retrieve OAuth session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
