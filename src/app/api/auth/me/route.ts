import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { sql } from '@/lib/db/neon-client';

export async function GET(req: NextRequest) {
  const authResult = requireAuth(req);

  if (!authResult.authenticated || !authResult.user) {
    return authResult.response!;
  }

  const rows = await sql`
    SELECT account_status, email_verified
    FROM users
    WHERE id = ${authResult.user.user_id}
    LIMIT 1
  `;

  const dbUser = rows[0];

  return NextResponse.json({
    user: {
      id: authResult.user.user_id,
      username: authResult.user.username,
      email: authResult.user.email,
      role: authResult.user.role,
      account_status: dbUser?.account_status ?? 'active',
      email_verified: dbUser?.email_verified ?? true,
    }
  });
}
