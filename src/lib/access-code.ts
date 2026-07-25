/**
 * Access code generation and format validation (no DB / auth imports).
 */

import crypto from 'crypto';

const AVOIDED_SIX_DIGIT = new Set([
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123456',
  '654321',
  '012345',
  '123123',
  '112233',
]);

/** Crockford base32 without I, L, O, U */
const SECURE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function isSixDigitAccessCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function isSecureAccessCode(code: string): boolean {
  return /^[0-9A-HJ-NP-Z]{8}$/i.test(code);
}

export function isValidAccessCodeFormat(code: string): boolean {
  // 4-digit allowed briefly for legacy events still on old PINs
  return (
    isSixDigitAccessCode(code) ||
    isSecureAccessCode(code) ||
    /^\d{4}$/.test(code)
  );
}

export function generateSixDigitAccessCode(): string {
  let code: string;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (AVOIDED_SIX_DIGIT.has(code));
  return code;
}

export function generateSecureAccessCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SECURE_ALPHABET[bytes[i]! % SECURE_ALPHABET.length];
  }
  return out;
}

export function generateAccessCode(secureUrlAccess: boolean): string {
  return secureUrlAccess ? generateSecureAccessCode() : generateSixDigitAccessCode();
}

export function guestRequestUrl(origin: string, username: string, accessCode: string): string {
  return `${origin}/${username}/${accessCode}/request`;
}

export function guestDisplayUrl(origin: string, username: string, accessCode: string): string {
  return `${origin}/${username}/${accessCode}/display`;
}
