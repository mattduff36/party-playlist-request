import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { generateToken, comparePassword, getCookieOptions, verifyToken } from '@/lib/auth';
import { decideAdminSessionLogin } from '@/lib/admin-session';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function readCookieSessionId(req: NextRequest): string | null {
  const cookieToken = req.cookies.get('auth_token')?.value;
  if (!cookieToken) return null;
  const decoded = verifyToken(cookieToken);
  // Legacy tokens may omit session_id — treat as unknown, not a crash.
  return decoded?.session_id ?? null;
}

function completeLogin(params: {
  req: NextRequest;
  user: {
    id: string;
    username: string;
    email: string;
  };
  role: 'user' | 'superadmin';
  sessionId: string;
  resumed?: boolean;
}) {
  const { req, user, role, sessionId, resumed } = params;

  const token = generateToken({
    user_id: user.id,
    username: user.username,
    email: user.email,
    role,
    session_id: sessionId,
  });

  const response = NextResponse.json(
    {
      success: true,
      sessionId,
      resumed: Boolean(resumed),
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

  console.log(
    resumed
      ? `✅ User resumed same admin session: ${user.username}`
      : `✅ User logged in: ${user.username}`
  );

  reportActivity(req, 'auth.login', `User ${user.username} logged in`, {
    actorRole: role === 'superadmin' ? 'superadmin' : 'admin',
    user: {
      user_id: user.id,
      username: user.username,
      email: user.email,
      role,
      session_id: sessionId,
    },
    meta: resumed ? { resumed: true } : undefined,
  });

  return response;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    // Validation
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find user and check for existing session
    const result = await pool.query(
      'SELECT id, username, email, password_hash, role, active_session_id, active_session_created_at FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      reportActivity(req, 'auth.login_failed', `Failed login for ${username}`, {
        actorRole: 'guest',
        meta: { reason: 'unknown_user' },
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      reportActivity(req, 'auth.login_failed', `Failed login for ${username}`, {
        actorRole: 'guest',
        user: {
          user_id: user.id,
          username: user.username,
          email: user.email,
          role: user.role === 'superadmin' ? 'superadmin' : 'user',
        },
        meta: { reason: 'bad_password' },
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const role: 'user' | 'superadmin' =
      user.role === 'superadmin' ? 'superadmin' : 'user';
    const cookieSessionId = readCookieSessionId(req);

    const decision = decideAdminSessionLogin({
      role: user.role || 'user',
      lock: {
        activeSessionId: user.active_session_id,
        activeSessionCreatedAt: user.active_session_created_at,
      },
      cookieSessionId,
    });

    if (decision.action === 'require_transfer') {
      console.log(
        `⚠️ User ${user.username} has an existing active session (likelyDifferentClient=${decision.likelyDifferentClient})`
      );
      return NextResponse.json(
        {
          requiresTransfer: true,
          sessionInfo: {
            sessionId: decision.sessionId,
            created_at: decision.createdAt,
            likelyDifferentClient: decision.likelyDifferentClient,
          },
          userId: user.id,
          username: user.username,
        },
        { status: 200 }
      );
    }

    if (decision.action === 'clear_expired_then_proceed') {
      console.log(`⌛ Admin session lock expired for ${user.username}; clearing`);
      await pool.query(
        'UPDATE users SET active_session_id = NULL, active_session_created_at = NULL WHERE id = $1',
        [user.id]
      );
    }

    if (decision.action === 'resume_same') {
      await pool.query(
        'UPDATE users SET active_session_created_at = NOW() WHERE id = $1',
        [user.id]
      );
      return completeLogin({
        req,
        user,
        role,
        sessionId: decision.sessionId,
        resumed: true,
      });
    }

    // New session (proceed_new or after expired clear)
    const sessionId = crypto.randomUUID();

    await pool.query(
      'UPDATE users SET active_session_id = $1, active_session_created_at = NOW() WHERE id = $2',
      [sessionId, user.id]
    );

    return completeLogin({ req, user, role, sessionId });
  } catch (error) {
    console.error('❌ Login error:', error);
    reportApiError(req, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
