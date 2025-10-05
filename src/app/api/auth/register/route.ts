import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { generateToken, hashPassword, getCookieOptions } from '@/lib/auth';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate username format (lowercase alphanumeric + hyphens, 3-50 chars)
    const usernamePattern = /^[a-z0-9-]{3,50}$/;
    if (!usernamePattern.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-50 characters, lowercase letters, numbers, and hyphens only' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const usernameCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (usernameCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 }
      );
    }

    // Check if email already exists
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, username, email, password_hash, role, display_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, username, email, passwordHash, 'user', username]
    );

    // Generate JWT
    const token = generateToken({
      user_id: userId,
      username,
      email,
      role: 'user'
    });

    // Create response with cookie
    const response = NextResponse.json(
      { 
        success: true,
        user: {
          id: userId,
          username,
          email,
          role: 'user'
        }
      },
      { status: 201 }
    );

    // Set auth cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = getCookieOptions(isProduction);
    
    response.cookies.set('auth_token', token, cookieOptions);

    console.log('✅ User registered:', username);

    return response;

  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

