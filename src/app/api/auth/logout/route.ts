import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/auth';
import { releaseActiveSessionIfMatch } from '@/lib/auth/session-authority';
import { assertCsrfForCookieMutation, CSRF_COOKIE_NAME } from '@/lib/auth/csrf';
import { emitSecurityAudit, newCorrelationId } from '@/lib/auth/security-audit';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';

function clearAuthCookies(response: NextResponse): void {
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

/**
 * Logout this browser only.
 * - Clears auth + CSRF cookies for this browser
 * - Releases active_session lock only when this session is still the active one
 * - Does NOT change event status, delete requests, or force event offline
 * - Revoked JWTs may still clear the local cookie (cannot clear a newer session)
 */
export async function POST(req: NextRequest) {
  const correlationId = newCorrelationId();
  try {
    const csrf = assertCsrfForCookieMutation(req);
    if (!csrf.ok) {
      return csrf.response!;
    }

    const authHeader = req.headers.get('authorization');
    const cookieToken = req.cookies.get('auth_token')?.value;
    const token = extractToken(authHeader, cookieToken);
    const payload = token ? verifyToken(token) : null;

    if (payload?.session_id) {
      try {
        const released = await releaseActiveSessionIfMatch(
          payload.user_id,
          payload.session_id
        );
        console.log(
          released
            ? `✅ Released active session for user ${payload.user_id}`
            : `ℹ️ Logout did not clear a newer active session for user ${payload.user_id}`
        );
      } catch (dbError) {
        console.error('❌ Failed to release session on logout:', dbError);
      }

      emitSecurityAudit('auth.logout', {
        correlationId,
        userId: payload.user_id,
      });
      reportActivity(req, 'auth.logout', `User ${payload.username} logged out`, {
        user: payload,
      });
    }

    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );
    clearAuthCookies(response);
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    reportApiError(req, error);

    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );
    clearAuthCookies(response);
    return response;
  }
}
