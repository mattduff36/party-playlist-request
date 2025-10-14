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
        // Clear active session
        await sql`
          UPDATE users
          SET active_session_id = NULL,
              active_session_created_at = NULL
          WHERE id = ${userId}
        `;
        
        console.log(`✅ Session cleared for user ${userId}`);
        
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
        
        // Delete all requests for this user
        const deleteResult = await sql`
          DELETE FROM requests
          WHERE user_id = ${userId}
          RETURNING id
        `;
        
        const deletedCount = deleteResult.length;
        console.log(`🧹 Deleted ${deletedCount} requests for user ${userId} on logout`);
        
        // Broadcast cleanup event via Pusher
        try {
          const { triggerRequestsCleanup } = await import('@/lib/pusher');
          await triggerRequestsCleanup(userId);
          console.log(`📡 Pusher cleanup event sent for user ${userId}`);
        } catch (pusherError) {
          console.error('❌ Failed to send Pusher cleanup event:', pusherError);
          // Don't fail logout if Pusher fails
        }
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

