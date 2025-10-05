import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';

export async function GET(req: NextRequest) {
  const authResult = requireAuth(req);

  if (!authResult.authenticated || !authResult.user) {
    return authResult.response!;
  }

  return NextResponse.json({
    user: {
      id: authResult.user.user_id,
      username: authResult.user.username,
      email: authResult.user.email,
      role: authResult.user.role
    }
  });
}

