/**
 * Authentication Library
 * JWT token generation, verification, and password hashing
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = '7d'; // 7 days

if (!JWT_SECRET) {
  console.warn('⚠️ WARNING: JWT_SECRET not set in environment variables!');
}

export interface JWTPayload {
  user_id: string;
  username: string;
  email: string;
  role: 'user' | 'superadmin';
  /** Admin single-session id. Optional for legacy tokens minted before this claim existed. */
  session_id?: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const payload: Record<string, string> = {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
  // Omit session_id when absent so legacy callers stay valid; parsers tolerate missing claim.
  if (user.session_id) {
    payload.session_id = user.session_id;
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  
  console.log('🔑 Generated JWT for user:', user.username);
  return token;
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log('❌ Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log('❌ Invalid token:', error.message);
    } else {
      console.log('❌ Token verification error:', error);
    }
    return null;
  }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const saltRounds = 12;
  const hash = await bcrypt.hash(plaintext, saltRounds);
  return hash;
}

/**
 * Compare plaintext password with hash
 */
export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
  const isMatch = await bcrypt.compare(plaintext, hash);
  return isMatch;
}

/**
 * Extract token from cookie or Authorization header.
 *
 * PRD-02 decision: cookie-first. HttpOnly `auth_token` is canonical for browser
 * organiser/superadmin sessions. Preferring Bearer first let stale
 * `localStorage.admin_token` override a valid cookie and skip the intended
 * cookie+CSRF path while credentials still attached the cookie.
 * Bearer remains supported when no auth cookie is present (API/tests).
 */
export function extractToken(authHeader?: string | null, cookieValue?: string | null): string | null {
  if (cookieValue) {
    return cookieValue;
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Create cookie options for auth token
 */
export function getCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/'
  };
}

/**
 * @deprecated PRD-02: Does NOT enforce active-session authority or CSRF.
 * Use `requireAuth` + `requireSuperAdmin` from `@/middleware/auth` instead.
 * Throws if called — kept only so accidental imports fail loudly.
 */
export async function requireSuperAdmin(_req: Request): Promise<{
  authorized: boolean;
  user?: JWTPayload;
  error?: string;
}> {
  throw new Error(
    'DEPRECATED: @/lib/auth requireSuperAdmin is unsafe (no session authority). ' +
      'Use requireAuth + requireSuperAdmin from @/middleware/auth.'
  );
}