import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/neon-client';
import { sendWelcomeEmail } from '@/lib/email/email-service';

/**
 * POST /api/auth/verify-email
 * Verify user email with token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find user with this token
    const users = await sql`
      SELECT id, username, email, account_status, email_verified, email_verification_expires
      FROM users
      WHERE email_verification_token = ${token}
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    const user = users[0];

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json({
        success: true,
        message: 'Email already verified',
        alreadyVerified: true
      });
    }

    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(user.email_verification_expires);
    
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Verification token has expired. Please request a new verification email.' },
        { status: 400 }
      );
    }

    // Update user - verify email and activate account
    await sql`
      UPDATE users
      SET 
        email_verified = true,
        account_status = 'active',
        email_verification_token = NULL,
        email_verification_expires = NULL,
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    console.log('✅ Email verified for user:', user.username);

    // Create initial event for the user
    await sql`
      INSERT INTO events (user_id, status, config)
      VALUES (
        ${user.id}, 
        'offline',
        '{
          "pages_enabled": {
            "requests": false,
            "display": false
          }
        }'::jsonb
      )
    `;

    console.log('✅ Initial event created for user:', user.username);

    // Send welcome email
    const emailResult = await sendWelcomeEmail({
      username: user.username,
      email: user.email
    });

    if (!emailResult.success) {
      console.error('⚠️ Failed to send welcome email');
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! Your account is now active.',
      user: {
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('❌ Error verifying email:', error);
    return NextResponse.json(
      { error: 'Failed to verify email. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/verify-email?token=xxx
 * Verify email via GET request (for email links)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Verification token is required' },
      { status: 400 }
    );
  }

  // Call POST handler with token
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });

  return POST(mockRequest as NextRequest);
}
