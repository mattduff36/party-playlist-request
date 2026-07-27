/**
 * PRD-04: one-way hashes / keyed HMAC for access codes and one-time tokens.
 * Dual-verify matches display-token SQL: hash/HMAC when present; plaintext only
 * when storedHash is null/empty (expand-and-contract until Class D).
 */

import crypto from 'crypto';

const ACCESS_CODE_HMAC_VERSION = 'v1';

function requirePepper(): string {
  const pepper =
    process.env.ACCESS_CODE_HMAC_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    '';
  if (!pepper) {
    throw new Error('ACCESS_CODE_HMAC_SECRET or JWT_SECRET is required for HMAC');
  }
  return pepper;
}

export function getAccessCodeHmacVersion(): string {
  return ACCESS_CODE_HMAC_VERSION;
}

/** Keyed HMAC for event access codes (organiser may re-display original). */
export function hmacAccessCode(accessCode: string): string {
  return crypto
    .createHmac('sha256', requirePepper())
    .update(`access-code:${accessCode}`, 'utf8')
    .digest('hex');
}

/** SHA-256 for one-time tokens (reset / email verify / display / bypass). */
export function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function tokenPrefix(token: string, length = 8): string {
  return token.slice(0, Math.min(length, token.length));
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length === 0 || ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function timingSafeEqualUtf8(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Dual-verify (Class B expand-and-contract).
 * When storedHash is non-empty: hash/HMAC only — no plaintext fallthrough.
 * When storedHash is null/empty: plaintext equality (legacy rows).
 */
export function dualVerifySecret(options: {
  presented: string;
  storedHash?: string | null;
  storedPlaintext?: string | null;
  hashFn: (value: string) => string;
}): boolean {
  const { presented, storedHash, storedPlaintext, hashFn } = options;
  if (!presented) return false;

  const hash =
    typeof storedHash === 'string' && storedHash.trim().length > 0
      ? storedHash
      : null;

  if (hash) {
    const computed = hashFn(presented);
    return timingSafeEqualHex(computed, hash);
  }

  if (storedPlaintext) {
    return timingSafeEqualUtf8(presented, storedPlaintext);
  }

  return false;
}
