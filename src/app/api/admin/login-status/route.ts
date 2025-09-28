import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Try to verify if there's a valid admin token
    try {
      await authService.requireAdminAuth(req);
      return NextResponse.json({
        admin_logged_in: true,
        message: 'Admin is currently logged in'
      });
    } catch (error) {
      // No valid token found
      return NextResponse.json({
        admin_logged_in: false,
        message: 'No admin currently logged in'
      });
    }
  } catch (error) {
    console.error('Error checking admin login status:', error);
    return NextResponse.json({
      admin_logged_in: false,
      message: 'Error checking admin status'
    });
  }
}
