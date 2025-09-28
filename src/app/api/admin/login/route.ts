import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { initializeDefaults } from '@/lib/db';
import { triggerAdminLogin } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    console.log('🔐 Admin login attempt started');
    await initializeDefaults();
    
    const body = await req.json();
    const { username, password } = body;
    
    console.log('🔐 Login request:', { 
      username, 
      hasPassword: !!password,
      passwordLength: password?.length 
    });
    
    if (!username || !password) {
      console.log('❌ Missing username or password');
      return NextResponse.json({ 
        error: 'Username and password are required' 
      }, { status: 400 });
    }

    console.log('🔐 Calling authService.authenticateAdmin...');
    const authResult = await authService.authenticateAdmin(username, password);
    
    console.log('✅ Authentication successful:', {
      hasToken: !!authResult.token,
      tokenLength: authResult.token?.length,
      adminId: authResult.admin.id,
      username: authResult.admin.username
    });
    
    // Trigger Pusher event for admin login
    try {
      await triggerAdminLogin({
        admin_id: authResult.admin.id,
        username: authResult.admin.username,
        login_time: new Date().toISOString(),
        message: `Admin ${authResult.admin.username} logged in`
      });
      console.log('📡 Pusher: Admin login event sent');
    } catch (pusherError) {
      console.error('❌ Failed to send admin login Pusher event:', pusherError);
      // Don't fail the login if Pusher fails
    }
    
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token: authResult.token,
      admin: authResult.admin
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return NextResponse.json({ 
      error: 'Invalid credentials' 
    }, { status: 401 });
  }
}