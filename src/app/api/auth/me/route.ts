import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { sql } from '@/lib/db/neon-client';
import { setCsrfCookie } from '@/lib/auth/csrf';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);

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

  const response = NextResponse.json({
    user: {
      id: authResult.user.user_id,
      username: authResult.user.username,
      email: authResult.user.email,
      role: authResult.user.role,
      account_status: dbUser?.account_status ?? 'active',
      email_verified: dbUser?.email_verified ?? true,
      session_id: authResult.sessionId,
    }
  });
  setCsrfCookie(response);
  return response;
}
