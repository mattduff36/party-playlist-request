/**
 * Spike 2: JWT Authentication Helpers
 * Purpose: Validate JWT-based authentication for multi-tenant routes
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-spike';
const JWT_EXPIRES_IN = '7d'; // 7 days

export interface JWTPayload {
  user_id: string;
  username: string;
  email: string;
  role: 'user' | 'superadmin';
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const token = jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  
  console.log('🔑 [Spike] Generated JWT for user:', user.username);
  return token;
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    console.log('✅ [Spike] Token verified for user:', decoded.username);
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log('❌ [Spike] Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log('❌ [Spike] Invalid token:', error.message);
    } else {
      console.log('❌ [Spike] Token verification error:', error);
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
  console.log('🔒 [Spike] Password hashed');
  return hash;
}

/**
 * Compare plaintext password with hash
 */
export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
  const isMatch = await bcrypt.compare(plaintext, hash);
  console.log(`🔍 [Spike] Password comparison: ${isMatch ? 'MATCH' : 'NO MATCH'}`);
  return isMatch;
}

/**
 * Extract token from Authorization header or cookie
 */
export function extractToken(authHeader?: string | null, cookieValue?: string | null): string | null {
  // Try Authorization header first (Bearer token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('🔍 [Spike] Token extracted from Authorization header');
    return token;
  }
  
  // Try cookie
  if (cookieValue) {
    console.log('🔍 [Spike] Token extracted from cookie');
    return cookieValue;
  }
  
  console.log('⚠️ [Spike] No token found in request');
  return null;
}

/**
 * Create a test user for spike validation
 */
export const TEST_USERS = {
  johnsmith: {
    user_id: '11111111-1111-1111-1111-111111111111',
    username: 'johnsmith',
    email: 'john@test.com',
    role: 'user' as const,
    password: 'password123' // For testing only
  },
  janedoe: {
    user_id: '22222222-2222-2222-2222-222222222222',
    username: 'janedoe',
    email: 'jane@test.com',
    role: 'user' as const,
    password: 'password123'
  },
  superadmin: {
    user_id: '99999999-9999-9999-9999-999999999999',
    username: 'superadmin',
    email: 'admin@partyplaylist.co.uk',
    role: 'superadmin' as const,
    password: 'admin123'
  }
};

/**
 * Performance benchmark helper
 */
export function benchmarkStart(): number {
  return performance.now();
}

export function benchmarkEnd(start: number, operation: string): number {
  const duration = performance.now() - start;
  console.log(`⏱️ [Spike] ${operation}: ${duration.toFixed(2)}ms`);
  return duration;
}
