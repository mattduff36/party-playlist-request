import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/neon-client';

/**
 * POST /api/auth/check-username
 * Check if username is available
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    // Validate username
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Username validation rules
    const usernameRegex = /^[a-z0-9_-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { 
          available: false,
          error: 'Username must be 3-30 characters long and contain only lowercase letters, numbers, hyphens, and underscores'
        },
        { status: 200 }
      );
    }

    // Reserved usernames
    const reservedUsernames = [
      'admin', 'api', 'app', 'auth', 'dashboard', 'login', 'logout', 
      'register', 'signup', 'signin', 'signout', 'settings', 'account',
      'help', 'support', 'about', 'contact', 'terms', 'privacy', 'legal',
      'www', 'mail', 'ftp', 'localhost', 'test', 'demo', 'example',
      'user', 'users', 'profile', 'profiles', 'billing', 'payments',
      'oauth', 'callback', 'verify', 'reset', 'forgot', 'password'
    ];

    if (reservedUsernames.includes(username.toLowerCase())) {
      return NextResponse.json(
        { 
          available: false,
          error: 'This username is reserved'
        },
        { status: 200 }
      );
    }

    // Check if username exists in database
    const result = await sql`
      SELECT id FROM users WHERE LOWER(username) = LOWER(${username})
    `;

    const available = result.length === 0;

    return NextResponse.json({
      available,
      ...(available ? {} : { error: 'Username is already taken' })
    });

  } catch (error) {
    console.error('❌ Error checking username:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
