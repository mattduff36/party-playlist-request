import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getOAuthSession, clearOAuthSession } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const { searchParams } = new URL(req.url);
    const state = searchParams.get('state');
    
    if (!state) {
      return NextResponse.json({ error: 'State parameter required' }, { status: 400 });
    }
    
    console.log('Looking up OAuth session for state:', state);
    const session = await getOAuthSession(state);
    
    if (!session) {
      console.log('OAuth session not found for state:', state);
      return NextResponse.json({ error: 'OAuth session not found or expired' }, { status: 404 });
    }
    
    console.log('OAuth session found, returning code verifier');
    
    // Clean up the session after retrieving it (one-time use)
    await clearOAuthSession(state);
    
    return NextResponse.json({
      code_verifier: session.code_verifier
    });
    
  } catch (error) {
    console.error('Error retrieving OAuth session:', error);
    
    if (error instanceof Error && (error.message.includes('No token provided') || error.message.includes('Admin access required'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to retrieve OAuth session' 
    }, { status: 500 });
  }
}
