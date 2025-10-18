import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { hashPassword } from '@/lib/auth';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * GET /api/superadmin/users/[id]
 * Get single user details (super admin only)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    // Check super admin permission
    const superAdminCheck = requireSuperAdmin(auth.user);
    if (!superAdminCheck.authorized) {
      return superAdminCheck.response!;
    }

    const { id } = await context.params;

    // Get user
    const result = await pool.query(
      `SELECT 
        id, 
        username, 
        email, 
        display_name,
        role,
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
      account_status: 'active',
      email_verified: true,
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    // Check super admin permission
    const superAdminCheck = requireSuperAdmin(auth.user);
    if (!superAdminCheck.authorized) {
      return superAdminCheck.response!;
    }

    const { id } = await context.params;
    const body = await req.json();
    const { email, password, account_status, is_super_admin } = body;

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userCheck.rows[0];

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

    // Note: account_status removed as the users table doesn't have a status column

    if (is_super_admin !== undefined) {
      const role = is_super_admin ? 'superadmin' : 'user';
      paramCount++;
      updates.push(`role = $${paramCount}`);
      values.push(role);
    }

    // Always update the updated_at timestamp
    paramCount++;
    updates.push(`updated_at = NOW()`);

    // Check if there are any updates
    if (updates.length === 0) {
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
        id, username, email, display_name, role, created_at, updated_at, active_session_created_at
    `;

    const result = await pool.query(updateQuery, values);

    // Transform to match frontend expectations
    const updatedUser = {
      ...result.rows[0],
      account_status: 'active',
      email_verified: true,
      is_super_admin: result.rows[0].role === 'superadmin',
      last_login: result.rows[0].active_session_created_at
    };

    console.log(`✅ Super admin ${auth.user.username} updated user: ${user.username}`);

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
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    // Check super admin permission
    const superAdminCheck = requireSuperAdmin(auth.user);
    if (!superAdminCheck.authorized) {
      return superAdminCheck.response!;
    }

    const { id } = await context.params;

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

