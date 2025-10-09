import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { hashPassword } from '@/lib/auth';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * GET /api/superadmin/users
 * List all users (super admin only)
 */
export async function GET(req: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = `
      SELECT 
        id, 
        username, 
        email, 
        status as account_status,
        role,
        created_at, 
        last_login
      FROM users
    `;
    const params: any[] = [];
    let paramCount = 0;

    // Add search filter
    if (search) {
      paramCount++;
      query += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Add status filter
    if (status !== 'all') {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    // Add pagination
    query += ` ORDER BY created_at DESC`;
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    // Execute query
    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams: any[] = [];
    let countParamCount = 0;

    if (search) {
      countParamCount++;
      countQuery += ` AND (username ILIKE $${countParamCount} OR email ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    if (status !== 'all') {
      countParamCount++;
      countQuery += ` AND status = $${countParamCount}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      users: result.rows,
      pagination: {
        total,
        limit,
        offset,
        has_more: total > offset + limit
      }
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/superadmin/users
 * Create new user (super admin only)
 */
export async function POST(req: NextRequest) {
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

    // Parse request body
    const body = await req.json();
    const { username, email, password, is_super_admin = false } = body;

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate username format
    if (!/^[a-z0-9-]{3,30}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-30 characters, lowercase letters, numbers, and hyphens only' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
        { error: 'Username already exists' },
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
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Determine role
    const role = is_super_admin ? 'superadmin' : 'user';

    // Create user - use columns that exist in the database
    const result = await pool.query(
      `INSERT INTO users (
        username, 
        email, 
        password_hash, 
        display_name,
        role,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING 
        id, username, email, role, status, created_at`,
      [username, email, passwordHash, username, role, 'active']
    );

    console.log(`✅ Super admin ${auth.user.username} created user: ${username}`);

    return NextResponse.json({
      success: true,
      user: result.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

