import { NextRequest, NextResponse } from 'next/server';
import { getOAuthSession } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get('state');

    console.log(`🔍 [oauth-session] Looking up OAuth session for state: ${state?.substring(0, 8)}...`);

    if (!state) {
      console.log('❌ [oauth-session] No state parameter provided');
      return NextResponse.json({ 
        error: 'State parameter is required' 
      }, { status: 400 });
    }

    // Fetch OAuth session from database
    // The state parameter itself is the security token - it's cryptographically random
    // and stored server-side, so we don't need additional authentication here
    const session = await getOAuthSession(state);

    if (!session) {
      console.log(`❌ [oauth-session] No OAuth session found for state: ${state.substring(0, 8)}...`);
      return NextResponse.json({ 
        error: 'OAuth session not found or expired' 
      }, { status: 404 });
    }

    console.log(`✅ [oauth-session] OAuth session found for user: ${session.username} (${session.user_id})`);

    // Return only the code_verifier (don't expose sensitive data)
    return NextResponse.json({
      code_verifier: session.code_verifier,
      state: session.state
    });

  } catch (error) {
    console.error('❌ [oauth-session] Error fetching OAuth session:', error);
    
    return NextResponse.json({ 
      error: 'Failed to fetch OAuth session' 
    }, { status: 500 });
  }
}
