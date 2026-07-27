/**
 * Short-lived HttpOnly cookie binding OAuth state to the browser that started it.
 */

import crypto from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const SPOTIFY_OAUTH_BIND_COOKIE = 'spotify_oauth_bind';
const BIND_MAX_AGE_SEC = 10 * 60;

function bindSecret(): string {
  return (
    process.env.TOKEN_ENCRYPTION_KEY_V1 ||
    process.env.JWT_SECRET ||
    'dev-oauth-bind-secret'
  );
}

export function signOAuthBindValue(rawState: string, userId: string): string {
  const payload = `${rawState}.${userId}`;
  const sig = crypto
    .createHmac('sha256', bindSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOAuthBindValue(
  cookieValue: string | undefined,
  rawState: string,
  userId: string
): boolean {
  if (!cookieValue) return false;
  const expected = signOAuthBindValue(rawState, userId);
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function setOAuthBindCookie(
  response: NextResponse,
  rawState: string,
  userId: string
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  response.cookies.set(SPOTIFY_OAUTH_BIND_COOKIE, signOAuthBindValue(rawState, userId), {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: BIND_MAX_AGE_SEC,
    path: '/',
  });
}

export function clearOAuthBindCookie(response: NextResponse): void {
  response.cookies.set(SPOTIFY_OAUTH_BIND_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export function readOAuthBindCookie(req: NextRequest): string | undefined {
  return req.cookies.get(SPOTIFY_OAUTH_BIND_COOKIE)?.value;
}
