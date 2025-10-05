/**
 * Authentication Middleware
 * Route protection and user ownership enforcement
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractToken, type JWTPayload } from '@/lib/auth';

/**
 * Require authentication - validates JWT token
 * Returns 401 if no valid token
 */
export function requireAuth(req: NextRequest): { 
  authenticated: boolean; 
  user: JWTPayload | null; 
  response?: NextResponse 
} {
  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('auth_token')?.value;
  
  const token = extractToken(authHeader, cookieToken);
  
  if (!token) {
    return {
      authenticated: false,
      user: null,
      response: NextResponse.json(
        { error: 'Authentication required', code: 'NO_TOKEN' },
        { status: 401 }
      )
    };
  }
  
  const user = verifyToken(token);
  
  if (!user) {
    return {
      authenticated: false,
      user: null,
      response: NextResponse.json(
        { error: 'Invalid or expired token', code: 'INVALID_TOKEN' },
        { status: 401 }
      )
    };
  }
  
  return {
    authenticated: true,
    user,
    response: undefined
  };
}

/**
 * Require ownership - validates that username in URL matches JWT username
 * Returns 403 if user tries to access another user's resources
 * Super admin can access any resource
 */
export function requireOwnResource(
  req: NextRequest, 
  user: JWTPayload, 
  usernameInUrl: string
): { 
  authorized: boolean; 
  response?: NextResponse 
} {
  // Super admin can access any resource
  if (user.role === 'superadmin') {
    console.log('✅ Super admin override - access granted to', usernameInUrl);
    return { authorized: true };
  }
  
  // Check if username matches
  if (user.username !== usernameInUrl) {
    console.log(`❌ Access denied: ${user.username} tried to access ${usernameInUrl}`);
    return {
      authorized: false,
      response: NextResponse.json(
        { 
          error: 'Forbidden - You can only access your own resources',
          code: 'NOT_OWNER',
          your_username: user.username,
          requested_username: usernameInUrl
        },
        { status: 403 }
      )
    };
  }
  
  return { authorized: true };
}

/**
 * Require super admin role
 * Returns 403 if user is not super admin
 */
export function requireSuperAdmin(user: JWTPayload): { 
  authorized: boolean; 
  response?: NextResponse 
} {
  if (user.role !== 'superadmin') {
    return {
      authorized: false,
      response: NextResponse.json(
        { 
          error: 'Forbidden - Super admin access required',
          code: 'NOT_SUPERADMIN'
        },
        { status: 403 }
      )
    };
  }
  
  return { authorized: true };
}

/**
 * Combined middleware: Require auth + ownership
 * One-stop middleware for protecting user-specific routes
 */
export function requireAuthAndOwnership(
  req: NextRequest,
  usernameInUrl: string
): {
  authenticated: boolean;
  authorized: boolean;
  user: JWTPayload | null;
  response?: NextResponse;
} {
  // Step 1: Check authentication
  const authResult = requireAuth(req);
  if (!authResult.authenticated || !authResult.user) {
    return {
      authenticated: false,
      authorized: false,
      user: null,
      response: authResult.response
    };
  }
  
  // Step 2: Check ownership
  const ownershipResult = requireOwnResource(req, authResult.user, usernameInUrl);
  if (!ownershipResult.authorized) {
    return {
      authenticated: true,
      authorized: false,
      user: authResult.user,
      response: ownershipResult.response
    };
  }
  
  // Success!
  return {
    authenticated: true,
    authorized: true,
    user: authResult.user,
    response: undefined
  };
}

/**
 * Security: Validate username format
 * Only allow alphanumeric and hyphens
 */
export function sanitizeUsername(username: string): boolean {
  const validPattern = /^[a-z0-9-]{3,50}$/;
  return validPattern.test(username);
}

