import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { generateToken, getCookieOptions } from '@/lib/auth';

/**
 * Refresh the user's session by generating a new JWT token
 */
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = auth.user;

    // Generate a new token with extended expiry
    const newToken = generateToken({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    console.log(`🔄 Session refreshed for user: ${user.username}`);

    // Set the new token in a cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({
      success: true,
      message: 'Session extended successfully',
      token: newToken
    });

    response.cookies.set('auth_token', newToken, getCookieOptions(isProduction));

    return response;
  } catch (error) {
    console.error('Error refreshing session:', error);
    return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 });
  }
}


