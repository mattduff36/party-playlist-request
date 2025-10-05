/**
 * Spike 2 Test: Super Admin Endpoint
 * Purpose: Validate role-based access control (only super admins can access)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth-spike';

export async function GET(req: NextRequest) {
  console.log('👑 [Spike Test] Super admin endpoint accessed');
  
  // Check authentication
  const authResult = requireAuth(req);
  
  if (!authResult.authenticated || !authResult.user) {
    return authResult.response!;
  }
  
  // Check super admin role
  const superAdminResult = requireSuperAdmin(authResult.user);
  
  if (!superAdminResult.authorized) {
    return superAdminResult.response!;
  }
  
  // Success - user is super admin
  return NextResponse.json({
    success: true,
    message: 'Welcome super admin!',
    user: {
      user_id: authResult.user.user_id,
      username: authResult.user.username,
      email: authResult.user.email,
      role: authResult.user.role
    }
  });
}
