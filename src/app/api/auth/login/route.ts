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

    // Find user
    const result = await pool.query(
      'SELECT id, username, email, password_hash, role FROM users WHERE username = $1',
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

    // Generate JWT
    const token = generateToken({
      user_id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    // Create response with cookie
    const response = NextResponse.json(
      { 
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
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

