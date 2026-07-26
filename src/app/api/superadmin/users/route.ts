import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { hashPassword } from '@/lib/auth';
import { SEED_USERNAMES } from '@/lib/seed-users';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';

const pool = getPool();

/**
 * GET /api/superadmin/users
 * List users (super admin only). Durable seed fixtures are omitted from
 * list + pagination totals so they stay available for finalise/tests only.
 */
export async function GET(req: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const allowedStatuses = ['pending', 'active', 'rejected', 'suspended'];

    // Build query
    let query = `
      SELECT 
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
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    // Hide durable seed fixtures from User Management UI
    paramCount++;
    query += ` AND NOT (username = ANY($${paramCount}::text[]))`;
    params.push(SEED_USERNAMES);

    // Add search filter
    if (search) {
      paramCount++;
      query += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (status !== 'all' && allowedStatuses.includes(status)) {
      paramCount++;
      query += ` AND account_status = $${paramCount}`;
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

    // Transform the results to match frontend expectations
    const users = result.rows.map((user: any) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      account_status: user.account_status || 'active',
      email_verified: Boolean(user.email_verified),
      is_super_admin: user.role === 'superadmin',
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.active_session_created_at // Use session created as proxy for last login
    }));

    // Get total count (same seed exclusion so pagination stays correct)
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams: any[] = [];
    let countParamCount = 0;

    countParamCount++;
    countQuery += ` AND NOT (username = ANY($${countParamCount}::text[]))`;
    countParams.push(SEED_USERNAMES);

    if (search) {
      countParamCount++;
      countQuery += ` AND (username ILIKE $${countParamCount} OR email ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    if (status !== 'all' && allowedStatuses.includes(status)) {
      countParamCount++;
      countQuery += ` AND account_status = $${countParamCount}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      users,
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
    const auth = await requireAuth(req);
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

    // Superadmin-created users are immediately usable
    const result = await pool.query(
      `INSERT INTO users (
        username, 
        email, 
        password_hash, 
        display_name,
        role,
        account_status,
        email_verified,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'active', true, NOW(), NOW())
      RETURNING 
        id, username, email, role, account_status, email_verified, created_at`,
      [username, email, passwordHash, username, role]
    );

    console.log(`✅ Super admin ${auth.user.username} created user: ${username}`);

    reportActivity(req, 'superadmin.user_create', `Created user ${username}`, {
      user: auth.user,
      meta: { createdUsername: username, role },
    });

    return NextResponse.json({
      success: true,
      user: result.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    reportApiError(req, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

