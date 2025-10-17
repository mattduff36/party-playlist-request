import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { generateToken, comparePassword, getCookieOptions } from '@/lib/auth';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check for existing active session (skip for superadmin - they can have multiple sessions)
    if (user.role !== 'superadmin' && user.active_session_id && user.active_session_created_at) {
      console.log(`⚠️ User ${user.username} has an existing active session`);
      return NextResponse.json(
        { 
          requiresTransfer: true,
          sessionInfo: {
            sessionId: user.active_session_id,
            created_at: user.active_session_created_at
          },
          userId: user.id,
          username: user.username
        },
        { status: 200 }
      );
    }

    // Use role from database, default to 'user' if not set
    const role = user.role === 'superadmin' ? 'superadmin' : 'user';

    // Generate new session ID
    const sessionId = crypto.randomUUID();

    // Update user with new session
    await pool.query(
      'UPDATE users SET active_session_id = $1, active_session_created_at = NOW() WHERE id = $2',
      [sessionId, user.id]
    );

    // Generate JWT with session ID
    const token = generateToken({
      user_id: user.id,
      username: user.username,
      email: user.email,
      role: role
    });

    // Create response with cookie
    const response = NextResponse.json(
      { 
        success: true,
        sessionId: sessionId,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: role
        }
      },
      { status: 200 }
    );

    // Set auth cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = getCookieOptions(isProduction);
    
    response.cookies.set('auth_token', token, cookieOptions);

    console.log('✅ User logged in:', user.username);

    return response;

  } catch (error) {
    console.error('❌ Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

