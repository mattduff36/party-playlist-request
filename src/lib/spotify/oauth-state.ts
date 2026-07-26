/**
 * OAuth state hashing — raw state travels to Spotify; DB stores only the hash.
 */

import crypto from 'crypto';

export function hashOAuthState(rawState: string): string {
  return crypto.createHash('sha256').update(rawState, 'utf8').digest('hex');
}

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('base64url');
}
