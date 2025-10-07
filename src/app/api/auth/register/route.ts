import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/neon-client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { sendVerificationEmail } from '@/lib/email/email-service';

/**
 * POST /api/auth/register
 * Register a new user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    // Username validation
    const usernameRegex = /^[a-z0-9_-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-30 characters long and contain only lowercase letters, numbers, hyphens, and underscores' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Password validation
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
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
        { error: 'This username is reserved' },
        { status: 400 }
      );
    }

    // Check if username or email already exists
    const existing = await sql`
      SELECT id, username, email FROM users 
      WHERE LOWER(username) = LOWER(${username}) OR LOWER(email) = LOWER(${email})
    `;

    if (existing.length > 0) {
      const existingUser = existing[0];
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        );
      }
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email address is already registered' },
          { status: 409 }
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate email verification token (32 bytes = 64 hex characters)
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const result = await sql`
      INSERT INTO users (
        username, 
        email, 
        password_hash, 
        account_status, 
        email_verified,
        email_verification_token,
        email_verification_expires,
        role
      )
      VALUES (
        ${username.toLowerCase()}, 
        ${email.toLowerCase()}, 
        ${passwordHash}, 
        'pending',
        false,
        ${verificationToken},
        ${verificationExpires.toISOString()},
        'user'
      )
      RETURNING id, username, email, created_at
    `;

    const newUser = result[0];

    console.log('✅ User created:', newUser.username);

    // Send verification email
    const emailResult = await sendVerificationEmail({
      username: newUser.username,
      email: newUser.email,
      verificationToken: verificationToken
    });

    if (!emailResult.success) {
      console.error('⚠️ Failed to send verification email, but user was created');
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        created_at: newUser.created_at
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error creating user:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      if (error.message.includes('username')) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        );
      }
      if (error.message.includes('email')) {
        return NextResponse.json(
          { error: 'Email address is already registered' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}