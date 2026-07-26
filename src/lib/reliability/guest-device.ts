/**
 * Event-scoped opaque guest device identifier for fair rate limiting (PRD-06).
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const GUEST_DEVICE_COOKIE = 'pp_guest_device';
const GUEST_DEVICE_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isGuestDeviceId(value: string | undefined | null): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function guestDeviceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: GUEST_DEVICE_MAX_AGE_SEC,
  };
}

/**
 * Read existing guest device id or mint a new one.
 * Caller should set the cookie on the response via ensureGuestDeviceCookie.
 */
export function resolveGuestDeviceId(req: NextRequest): {
  deviceId: string;
  minted: boolean;
} {
  const existing = req.cookies.get(GUEST_DEVICE_COOKIE)?.value;
  if (isGuestDeviceId(existing)) {
    return { deviceId: existing, minted: false };
  }
  return { deviceId: randomUUID(), minted: true };
}

export function ensureGuestDeviceCookie(
  response: NextResponse,
  deviceId: string
): void {
  response.cookies.set(GUEST_DEVICE_COOKIE, deviceId, guestDeviceCookieOptions());
}
