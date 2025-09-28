import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { triggerAdminLogout } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication to get admin info before logout
    const admin = await authService.requireAdminAuth(req);
    
    console.log('🔐 Admin logout initiated:', admin.username);
    
    // Trigger Pusher event for admin logout
    try {
      await triggerAdminLogout({
        admin_id: admin.id,
        username: admin.username,
        logout_time: new Date().toISOString(),
        message: `Admin ${admin.username} logged out`
      });
      console.log('📡 Pusher: Admin logout event sent');
    } catch (pusherError) {
      console.error('❌ Failed to send admin logout Pusher event:', pusherError);
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
