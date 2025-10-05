/**
 * Spike 2 Test: User-Specific Endpoint
 * Purpose: Validate ownership enforcement (users can only access their own resources)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndOwnership, sanitizeUsername } from '@/middleware/auth-spike';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  
  console.log('👤 [Spike Test] User-specific endpoint accessed:', username);
  
  // Security: Sanitize username
  if (!sanitizeUsername(username)) {
    return NextResponse.json(
      { error: 'Invalid username format', code: 'INVALID_FORMAT' },
      { status: 400 }
    );
  }
  
  // Check authentication and ownership
  const result = requireAuthAndOwnership(req, username);
  
  if (!result.authenticated || !result.authorized || !result.user) {
    return result.response!;
  }
  
  // Success - user is authenticated and accessing their own resource
  return NextResponse.json({
    success: true,
    message: `Welcome ${result.user.username}! You are accessing your own resource.`,
    resource_owner: username,
    authenticated_user: result.user.username,
    match: username === result.user.username,
    user: {
      user_id: result.user.user_id,
      username: result.user.username,
      email: result.user.email,
      role: result.user.role
    }
  });
}
