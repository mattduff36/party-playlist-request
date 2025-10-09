import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { sql } from '@/lib/db/neon-client';

export async function POST(req: NextRequest) {
  try {
    // Get user info before clearing token
    const auth = requireAuth(req);
    
    // If authenticated, clean up event state
    if (auth.authenticated && auth.user) {
      const userId = auth.user.user_id;
      console.log(`👋 User ${auth.user.username} logging out, cleaning up event state...`);
      
      try {
        // Set event to offline and disable pages
        await sql`
          UPDATE events
          SET status = 'offline',
              config = jsonb_set(
                jsonb_set(
                  config,
                  '{pages_enabled,display}',
                  'false'::jsonb
                ),
                '{pages_enabled,requests}',
                'false'::jsonb
              ),
              updated_at = NOW()
          WHERE user_id = ${userId}
        `;
        
        console.log(`✅ Event disabled for user ${userId} on logout`);
      } catch (dbError) {
        console.error('❌ Failed to clean up event on logout:', dbError);
        // Don't fail logout if cleanup fails
      }
    }
    
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );

    // Clear auth cookie
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/'
    });

    return response;
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still clear cookie even if there's an error
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );

    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });

    return response;
  }
}

