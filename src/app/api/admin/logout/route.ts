import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { triggerAdminLogout } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`🔐 [logout] User ${auth.user.username} (${userId}) logging out`);
    
    // Trigger Pusher event for admin logout
    try {
      await triggerAdminLogout({
        admin_id: userId,
        username: auth.user.username,
        logout_time: new Date().toISOString(),
        message: `User ${auth.user.username} logged out`
      });
      console.log('📡 Pusher: Logout event sent');
    } catch (pusherError) {
      console.error('❌ Failed to send logout Pusher event:', pusherError);
      // Don't fail the logout if Pusher fails
    }
    
    return NextResponse.json({
      success: true,
      message: 'Logout event triggered successfully'
    });

  } catch (error) {
    console.error('❌ Admin logout error:', error);
    
    // Even if auth fails, still trigger a generic logout event
    try {
      await triggerAdminLogout({
        logout_time: new Date().toISOString(),
        message: 'Admin logged out'
      });
      console.log('📡 Pusher: Generic logout event sent');
    } catch (pusherError) {
      console.error('❌ Failed to send generic logout Pusher event:', pusherError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Logout event triggered'
    });
  }
}
