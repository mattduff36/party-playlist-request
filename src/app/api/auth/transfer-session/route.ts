import { NextRequest, NextResponse } from 'next/server';
import { generateToken, comparePassword, getCookieOptions } from '@/lib/auth';
import { transferActiveSession } from '@/lib/auth/session-authority';
import { setCsrfCookie } from '@/lib/auth/csrf';
import {
  enforceAuthRateLimit,
  hashLimiterId,
  genericAuthRateLimitResponse,
} from '@/lib/auth/auth-rate-limit';
import { emitSecurityAudit, newCorrelationId } from '@/lib/auth/security-audit';
import { getIpHash } from '@/lib/support/withApiLogging';
import { sql } from '@/lib/db/neon-client';
import { triggerForceLogout } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  const correlationId = newCorrelationId();
  try {
    const { username, password, oldSessionId } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const ipHash = getIpHash(req);
    const accountHash = hashLimiterId('username', String(username));
    const throttle = await enforceAuthRateLimit({
      action: 'transfer',
      ipHash: hashLimiterId('ip', ipHash),
      accountHash,
      maxPerIp: 20,
      maxPerAccount: 8,
    });
    if (!throttle.allowed) {
      return NextResponse.json(genericAuthRateLimitResponse(throttle.retryAfterSec), {
        status: 429,
        headers: throttle.retryAfterSec
          ? { 'Retry-After': String(throttle.retryAfterSec) }
          : undefined,
      });
    }

    const result = await sql`
      SELECT id, username, email, password_hash, role, active_session_id
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `;

    if (result.length === 0) {
      emitSecurityAudit('auth.login_failure', {
        correlationId,
        meta: { reason: 'unknown_user', flow: 'transfer' },
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = result[0] as {
      id: string;
      username: string;
      email: string;
      password_hash: string;
      role: string;
      active_session_id: string | null;
    };

    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      emitSecurityAudit('auth.login_failure', {
        correlationId,
        userId: user.id,
        meta: { reason: 'bad_password', flow: 'transfer' },
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const newSessionId = crypto.randomUUID();
    const transfer = await transferActiveSession(
      user.id,
      typeof oldSessionId === 'string' ? oldSessionId : null,
      newSessionId
    );

    if (transfer === 'mismatch') {
      // Password OK but oldSessionId does not match — do not steal a newer session.
      // Allow force transfer by claiming the current DB session when client omits match?
      // PRD: validate oldSessionId. Reject mismatch.
      emitSecurityAudit('auth.session_transfer', {
        correlationId,
        userId: user.id,
        meta: { result: 'rejected_mismatch' },
      });
      return NextResponse.json(
        {
          error: 'Session no longer active. Sign in again.',
          code: 'SESSION_MISMATCH',
        },
        { status: 409 }
      );
    }

    if (transfer === 'empty') {
      // Lock already cleared — claim a fresh session
      await sql`
        UPDATE users
        SET active_session_id = ${newSessionId},
            active_session_created_at = NOW()
        WHERE id = ${user.id}
          AND active_session_id IS NULL
      `;
    }

    const role = user.role === 'superadmin' ? 'superadmin' : 'user';

    // Revoke old JWTs server-side by rotating active_session_id (done above).
    if (oldSessionId && typeof oldSessionId === 'string') {
      try {
        await triggerForceLogout(
          user.id,
          oldSessionId,
          'Session transferred to another device'
        );
      } catch (pusherError) {
        console.error('❌ Failed to send force logout event:', pusherError);
      }
    }

    const token = generateToken({
      user_id: user.id,
      username: user.username,
      email: user.email,
      role,
      session_id: newSessionId,
    });

    emitSecurityAudit('auth.session_transfer', {
      correlationId,
      userId: user.id,
      meta: { result: 'ok' },
    });

    const response = NextResponse.json(
      {
        success: true,
        sessionId: newSessionId,
        message: 'Session transferred successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role,
        },
      },
      { status: 200 }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set('auth_token', token, getCookieOptions(isProduction));
    setCsrfCookie(response);

    return response;
  } catch (error) {
    console.error('❌ Session transfer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
