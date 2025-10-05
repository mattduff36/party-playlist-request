/**
 * Spike 2 Test: Protected Endpoint
 * Purpose: Validate basic authentication (any logged-in user can access)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth-spike';

export async function GET(req: NextRequest) {
  console.log('🔒 [Spike Test] Protected endpoint accessed');
  
  // Check authentication
  const authResult = requireAuth(req);
  
  if (!authResult.authenticated || !authResult.user) {
    return authResult.response!;
  }
  
  // Success - user is authenticated
  return NextResponse.json({
    success: true,
    message: 'You are authenticated!',
    user: {
      user_id: authResult.user.user_id,
      username: authResult.user.username,
      email: authResult.user.email,
      role: authResult.user.role
    }
  });
}
