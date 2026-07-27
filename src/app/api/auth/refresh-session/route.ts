import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { generateToken, getCookieOptions } from '@/lib/auth';
import { setCsrfCookie } from '@/lib/auth/csrf';

/**
 * Refresh session — only after authoritative active-session validation.
 * Never mints a token from cookie claims alone.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user || !auth.sessionId) {
      return (
        auth.response ||
        NextResponse.json(
          { error: 'Session revoked', code: 'SESSION_REVOKED' },
          { status: 401 }
        )
      );
    }

    const user = auth.user;

    const newToken = generateToken({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
      session_id: auth.sessionId,
    });

    console.log(`🔄 Session refreshed for user: ${user.username}`);

    const isProduction = process.env.NODE_ENV === 'production';
    // Prefer HttpOnly cookie; omit token from JSON body for browser clients.
    const response = NextResponse.json({
      success: true,
      message: 'Session extended successfully',
    });

    response.cookies.set('auth_token', newToken, getCookieOptions(isProduction));
    setCsrfCookie(response);

    return response;
  } catch (error) {
    console.error('Error refreshing session:', error);
    return NextResponse.json(
      { error: 'Failed to refresh session' },
      { status: 500 }
    );
  }
}
