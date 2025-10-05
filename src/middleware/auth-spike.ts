/**
 * Spike 2: Authentication Middleware
 * Purpose: Validate route protection and user ownership enforcement
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractToken, type JWTPayload } from '@/lib/auth-spike';

/**
 * Require authentication - validates JWT token
 * Returns 401 if no valid token
 */
export function requireAuth(req: NextRequest): { 
  authenticated: boolean; 
  user: JWTPayload | null; 
  response?: NextResponse 
} {
  console.log('🔐 [Spike Middleware] requireAuth called for:', req.url);
  
  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('auth_token')?.value;
  
  const token = extractToken(authHeader, cookieToken);
  
  if (!token) {
    console.log('❌ [Spike Middleware] No token provided');
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
    console.log('❌ [Spike Middleware] Invalid token');
    return {
      authenticated: false,
      user: null,
      response: NextResponse.json(
        { error: 'Invalid or expired token', code: 'INVALID_TOKEN' },
        { status: 401 }
      )
    };
  }
  
  console.log('✅ [Spike Middleware] User authenticated:', user.username);
  return {
    authenticated: true,
    user,
    response: undefined
  };
}

/**
 * Require ownership - validates that username in URL matches JWT username
 * Returns 403 if user tries to access another user's resources
 */
export function requireOwnResource(
  req: NextRequest, 
  user: JWTPayload, 
  usernameInUrl: string
): { 
  authorized: boolean; 
  response?: NextResponse 
} {
  console.log('🔒 [Spike Middleware] requireOwnResource check');
  console.log('   User in JWT:', user.username);
  console.log('   Username in URL:', usernameInUrl);
  
  // Super admin can access any resource
  if (user.role === 'superadmin') {
    console.log('✅ [Spike Middleware] Super admin override - access granted');
    return { authorized: true };
  }
  
  // Check if username matches
  if (user.username !== usernameInUrl) {
    console.log('❌ [Spike Middleware] Username mismatch - access denied');
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
  
  console.log('✅ [Spike Middleware] Ownership verified');
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
  console.log('👑 [Spike Middleware] requireSuperAdmin check for:', user.username);
  
  if (user.role !== 'superadmin') {
    console.log('❌ [Spike Middleware] User is not super admin');
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
  
  console.log('✅ [Spike Middleware] Super admin verified');
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
 * Security: Check for path traversal attacks
 */
export function sanitizeUsername(username: string): boolean {
  // Only allow alphanumeric and hyphens
  const validPattern = /^[a-z0-9-]{3,50}$/;
  const isValid = validPattern.test(username);
  
  if (!isValid) {
    console.log('⚠️ [Spike Middleware] Invalid username format:', username);
  }
  
  return isValid;
}
