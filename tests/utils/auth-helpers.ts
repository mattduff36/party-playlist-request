/**
 * Authentication Test Utilities
 */

import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

export function generateTestToken(payload: {
  user_id: string;
  username: string;
  email: string;
  role?: string;
}) {
  return jwt.sign(
    {
      user_id: payload.user_id,
      username: payload.username,
      email: payload.email,
      role: payload.role || 'user',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyTestToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function parseAuthCookie(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'auth_token') {
      return value;
    }
  }
  return null;
}

export async function loginTestUser(baseURL: string, credentials: {
  username: string;
  password: string;
}): Promise<string | null> {
  const response = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  
  if (!response.ok) {
    return null;
  }
  
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    return null;
  }
  
  return parseAuthCookie(setCookie);
}


