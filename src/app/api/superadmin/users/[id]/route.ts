import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { hashPassword } from '@/lib/auth';
import {
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
} from '@/lib/email/email-service';

const pool = getPool();

/**
 * GET /api/superadmin/users/[id]
 * Get single user details (super admin only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    // Check super admin permission
    const superAdminCheck = requireSuperAdmin(auth.user);
    if (!superAdminCheck.authorized) {
      return superAdminCheck.response!;
    }

    const { id } = await params;

    // Get user
    const result = await pool.query(
      `SELECT 
        id, 
        username, 
        email, 
        display_name,
        role,
        account_status,
        email_verified,
        created_at,
        updated_at,
        active_session_created_at
      FROM users
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Transform to match frontend expectations
    const user = {
      ...result.rows[0],
      account_status: result.rows[0].account_status || 'active',
      email_verified: Boolean(result.rows[0].email_verified),
      is_super_admin: result.rows[0].role === 'superadmin',
      last_login: result.rows[0].active_session_created_at
    };

    return NextResponse.json({ user });

  } catch (error) {
    console.error('❌ Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/superadmin/users/[id]
 * Update user (super admin only)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    // Check super admin permission
    const superAdminCheck = requireSuperAdmin(auth.user);
    if (!superAdminCheck.authorized) {
      return superAdminCheck.response!;
    }

    const { id } = await params;
    const body = await req.json();
    const { email, password, account_status, is_super_admin } = body;

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id, username, email, account_status FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userCheck.rows[0];
    const previousStatus = user.account_status as string | null;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (email !== undefined) {
      // Validate email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      // Check if email already exists for another user
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }

      paramCount++;
      updates.push(`email = $${paramCount}`);
      values.push(email);
    }

    if (password !== undefined && password.length > 0) {
      // Validate password
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(password);
      paramCount++;
      updates.push(`password_hash = $${paramCount}`);
      values.push(passwordHash);
    }

    if (account_status !== undefined) {
      const allowedStatuses = ['pending', 'active', 'rejected', 'suspended'];
      if (!allowedStatuses.includes(account_status)) {
        return NextResponse.json(
          { error: 'Invalid account_status. Allowed: pending, active, rejected, suspended' },
          { status: 400 }
        );
      }
      paramCount++;
      updates.push(`account_status = $${paramCount}`);
      values.push(account_status);
    }

    if (is_super_admin !== undefined) {
      const role = is_super_admin ? 'superadmin' : 'user';
      paramCount++;
      updates.push(`role = $${paramCount}`);
      values.push(role);
    }

    // Always update the updated_at timestamp
    updates.push(`updated_at = NOW()`);

    // Check if there are any updates beyond timestamp
    if (updates.length === 1) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add user ID as the last parameter
    paramCount++;
    values.push(id);

    // Execute update
    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id, username, email, display_name, role, account_status, email_verified,
        created_at, updated_at, active_session_created_at
    `;

    const result = await pool.query(updateQuery, values);

    // Transform to match frontend expectations
    const updatedUser = {
      ...result.rows[0],
      account_status: result.rows[0].account_status || 'active',
      email_verified: Boolean(result.rows[0].email_verified),
      is_super_admin: result.rows[0].role === 'superadmin',
      last_login: result.rows[0].active_session_created_at
    };

    console.log(`✅ Super admin ${auth.user.username} updated user: ${user.username}`);

    // Notify applicant when status changes to approved or rejected
    const newStatus = updatedUser.account_status;
    const recipientEmail = updatedUser.email as string;
    if (
      account_status !== undefined &&
      newStatus !== previousStatus &&
      recipientEmail
    ) {
      if (newStatus === 'active') {
        const emailResult = await sendAccountApprovedEmail({
          username: updatedUser.username,
          email: recipientEmail,
        });
        if (!emailResult.success) {
          console.error('⚠️ Failed to send approval email');
        }
      } else if (newStatus === 'rejected') {
        const emailResult = await sendAccountRejectedEmail({
          username: updatedUser.username,
          email: recipientEmail,
        });
        if (!emailResult.success) {
          console.error('⚠️ Failed to send rejection email');
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: updatedUser
    });

  } catch (error) {
    console.error('❌ Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/superadmin/users/[id]
 * Soft delete user (super admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    // Check super admin permission
    const superAdminCheck = requireSuperAdmin(auth.user);
    if (!superAdminCheck.authorized) {
      return superAdminCheck.response!;
    }

    const { id } = await params;

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userCheck.rows[0];

    // Prevent deleting yourself
    if (id === auth.user.user_id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Explicit credential cleanup before user delete (oauth_sessions may lack CASCADE)
    const { clearSpotifyAuth, clearOAuthSessionsForUser } = await import('@/lib/db');
    await clearSpotifyAuth(id);
    await clearOAuthSessionsForUser(id);

    // Delete the user
    await pool.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );

    console.log(`✅ Super admin ${auth.user.username} deleted user: ${user.username}`);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

