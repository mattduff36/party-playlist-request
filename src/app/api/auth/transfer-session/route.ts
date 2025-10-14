import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { generateToken, comparePassword, getCookieOptions } from '@/lib/auth';
import { triggerForceLogout } from '@/lib/pusher';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest) {
  try {
    const { username, password, oldSessionId } = await req.json();

    // Validation
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const result = await pool.query(
      'SELECT id, username, email, password_hash, role, active_session_id FROM users WHERE username = $1',
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

    // Verify the old session ID matches
    if (user.active_session_id !== oldSessionId) {
      console.log(`⚠️ Session ID mismatch for user ${user.username}`);
      // Session already changed, proceed with new session anyway
    }

    // Use role from database, default to 'user' if not set
    const role = user.role === 'superadmin' ? 'superadmin' : 'user';

    // Generate new session ID
    const newSessionId = crypto.randomUUID();

    // Update user with new session
    await pool.query(
      'UPDATE users SET active_session_id = $1, active_session_created_at = NOW() WHERE id = $2',
      [newSessionId, user.id]
    );

    // Broadcast force logout to old session via Pusher
    if (oldSessionId) {
      try {
        await triggerForceLogout(user.id, oldSessionId, 'Session transferred to another device');
        console.log(`📡 Sent force logout event for old session: ${oldSessionId}`);
      } catch (pusherError) {
        console.error('❌ Failed to send force logout event:', pusherError);
        // Don't fail the transfer if Pusher fails
      }
    }

    // Generate JWT
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
        sessionId: newSessionId,
        message: 'Session transferred successfully',
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

    console.log(`✅ Session transferred for user: ${user.username}`);

    return response;

  } catch (error) {
    console.error('❌ Session transfer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

