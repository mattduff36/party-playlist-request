import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/neon-client';
import bcrypt from 'bcrypt';

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'New password is required' },
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

    // Find valid reset token
    const tokens = await sql`
      SELECT 
        prt.id as token_id,
        prt.user_id,
        prt.expires_at,
        prt.used,
        u.username,
        u.email,
        u.account_status
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token = ${token}
      ORDER BY prt.created_at DESC
      LIMIT 1
    `;

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const tokenData = tokens[0];

    // Check if token already used
    if (tokenData.used) {
      return NextResponse.json(
        { error: 'This reset link has already been used' },
        { status: 400 }
      );
    }

    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Reset token has expired. Please request a new password reset.' },
        { status: 400 }
      );
    }

    // Check if account is active
    if (tokenData.account_status !== 'active') {
      return NextResponse.json(
        { error: 'Account is not active' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password
    await sql`
      UPDATE users
      SET 
        password_hash = ${passwordHash},
        updated_at = NOW()
      WHERE id = ${tokenData.user_id}
    `;

    // Mark token as used
    await sql`
      UPDATE password_reset_tokens
      SET 
        used = true,
        used_at = NOW()
      WHERE id = ${tokenData.token_id}
    `;

    console.log('✅ Password reset successful for user:', tokenData.username);

    // Invalidate all other unused tokens for this user (security)
    await sql`
      UPDATE password_reset_tokens
      SET 
        used = true,
        used_at = NOW()
      WHERE user_id = ${tokenData.user_id} AND used = false AND id != ${tokenData.token_id}
    `;

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    });

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    return NextResponse.json(
      { error: 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
}
