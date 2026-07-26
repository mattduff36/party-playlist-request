import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/neon-client';
import { sendWelcomeEmail } from '@/lib/email/email-service';
import { generateAccessCode } from '@/lib/access-code';
import { hashOpaqueToken } from '@/lib/crypto/secret-hashes';

interface VerifyUserRow {
  id: string;
  username: string;
  email: string;
  account_status: string;
  email_verified: boolean;
  email_verification_expires: string | Date | null;
}

/**
 * Ensure the user has an offline events row.
 * events.pin is NOT NULL UNIQUE — inserts without pin always fail.
 * Failures here must not undo a successful email verification.
 */
async function ensureInitialEvent(userId: string): Promise<void> {
  const existing = await sql`
    SELECT id FROM events WHERE user_id = ${userId} LIMIT 1
  `;

  if (existing.length > 0) {
    return;
  }

  const pin = generateAccessCode(false);
  const config = {
    pages_enabled: {
      requests: false,
      display: false,
    },
  };

  await sql`
    INSERT INTO events (user_id, pin, status, config)
    VALUES (
      ${userId},
      ${pin},
      'offline',
      ${JSON.stringify(config)}::jsonb
    )
  `;
}

/**
 * POST /api/auth/verify-email
 * Verify user email with token (session-independent; works on any device).
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

    // Dual-verify (display-token rule): hash when present; plaintext only if hash null
    const tokenHash = hashOpaqueToken(token);
    const users = await sql`
      SELECT id, username, email, account_status, email_verified, email_verification_expires
      FROM users
      WHERE (
        email_verification_token_hash = ${tokenHash}
        OR (
          email_verification_token_hash IS NULL
          AND email_verification_token = ${token}
        )
      )
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    const user = users[0] as VerifyUserRow;

    // Idempotent re-clicks (email scanners, double-mount, retry after success)
    if (user.email_verified) {
      try {
        await ensureInitialEvent(user.id);
      } catch (eventError) {
        console.error('⚠️ Failed to ensure event for already-verified user:', eventError);
      }

      return NextResponse.json({
        success: true,
        message: 'Email already verified',
        alreadyVerified: true,
        user: {
          username: user.username,
          email: user.email,
        },
      });
    }

    if (!user.email_verification_expires) {
      return NextResponse.json(
        { error: 'Verification token has expired. Please request a new verification email.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(user.email_verification_expires);

    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Verification token has expired. Please request a new verification email.' },
        { status: 400 }
      );
    }

    // Mark verified but keep token until expiry so re-opens stay idempotent
    const updated = await sql`
      UPDATE users
      SET
        email_verified = true,
        updated_at = NOW()
      WHERE id = ${user.id}
        AND (
          email_verification_token_hash = ${tokenHash}
          OR (
            email_verification_token_hash IS NULL
            AND email_verification_token = ${token}
          )
        )
        AND email_verified = false
      RETURNING id, username, email
    `;

    // Concurrent verify won the race — treat as success
    if (updated.length === 0) {
      const again = await sql`
        SELECT id, username, email, email_verified
        FROM users
        WHERE (
          email_verification_token_hash = ${tokenHash}
          OR (
            email_verification_token_hash IS NULL
            AND email_verification_token = ${token}
          )
        )
      `;
      if (again.length > 0 && again[0].email_verified) {
        return NextResponse.json({
          success: true,
          message: 'Email already verified',
          alreadyVerified: true,
          user: {
            username: again[0].username,
            email: again[0].email,
          },
        });
      }

      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    const verifiedUser = updated[0] as Pick<VerifyUserRow, 'id' | 'username' | 'email'>;
    console.log('✅ Email verified for user:', verifiedUser.username);

    try {
      await ensureInitialEvent(verifiedUser.id);
      console.log('✅ Initial event ensured for user:', verifiedUser.username);
    } catch (eventError) {
      // Verification already committed — do not surface this as a failed link
      console.error('⚠️ Failed to create initial event after email verify:', eventError);
    }

    const emailResult = await sendWelcomeEmail({
      username: verifiedUser.username,
      email: verifiedUser.email,
    });

    if (!emailResult.success) {
      console.error('⚠️ Failed to send welcome email');
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! Your account is pending admin approval before you can use the DJ dashboard.',
      user: {
        username: verifiedUser.username,
        email: verifiedUser.email,
      },
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
 * Verify email via GET request (for email links / API clients).
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

  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  return POST(mockRequest as NextRequest);
}
