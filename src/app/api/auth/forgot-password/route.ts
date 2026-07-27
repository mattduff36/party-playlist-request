import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/neon-client';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email/email-service';
import { getIpHash } from '@/lib/support/withApiLogging';
import {
  enforceAuthRateLimit,
  hashLimiterId,
  genericAuthRateLimitResponse,
} from '@/lib/auth/auth-rate-limit';
import { hashOpaqueToken } from '@/lib/crypto/secret-hashes';

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    const throttle = await enforceAuthRateLimit({
      action: 'forgot',
      ipHash: hashLimiterId('ip', getIpHash(request)),
      accountHash: hashLimiterId('email', email),
      maxPerIp: 20,
      maxPerAccount: 5,
    });
    if (!throttle.allowed) {
      // Still generic — do not reveal account existence via rate-limit shape alone
      return NextResponse.json(genericAuthRateLimitResponse(throttle.retryAfterSec), {
        status: 429,
      });
    }

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: 'If an account exists with that email, you will receive password reset instructions.'
    });

    // Find user with this email
    const users = await sql`
      SELECT id, username, email, account_status, email_verified
      FROM users
      WHERE LOWER(email) = LOWER(${email})
    `;

    // If user doesn't exist, still return success (prevent enumeration)
    if (users.length === 0) {
      console.log('⚠️ Password reset requested for non-existent email:', email);
      return successResponse;
    }

    const user = users[0];

    // Only allow password reset for active, verified accounts
    if (user.account_status !== 'active' || !user.email_verified) {
      console.log('⚠️ Password reset requested for inactive/unverified account:', email);
      return successResponse;
    }

    // Generate reset token (32 bytes = 64 hex characters); store hash + plaintext dual-write (Class B)
    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = hashOpaqueToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Get IP and user agent for security tracking
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
      await sql`
        INSERT INTO password_reset_tokens (user_id, token, token_hash, expires_at, ip_address, user_agent)
        VALUES (${user.id}, ${resetToken}, ${tokenHash}, ${expiresAt.toISOString()}, ${ipAddress}, ${userAgent})
      `;
    } catch {
      await sql`
        INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address, user_agent)
        VALUES (${user.id}, ${resetToken}, ${expiresAt.toISOString()}, ${ipAddress}, ${userAgent})
      `;
    }

    console.log('✅ Password reset token created for user:', user.username);

    // Send password reset email
    const emailResult = await sendPasswordResetEmail({
      username: user.username,
      email: user.email,
      resetToken: resetToken
    });

    if (!emailResult.success) {
      console.error('⚠️ Failed to send password reset email');
      // Still return success to user
    }

    return successResponse;

  } catch (error) {
    console.error('❌ Error processing forgot password:', error);
    return NextResponse.json(
      { error: 'Failed to process request. Please try again.' },
      { status: 500 }
    );
  }
}
