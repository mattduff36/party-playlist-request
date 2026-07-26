/**
 * Versioned authenticated token vault (AES-256-GCM).
 * Server-only — never import from client components.
 */

import crypto from 'crypto';

export type TokenVaultPurpose =
  | 'spotify.access'
  | 'spotify.refresh'
  | 'spotify.pkce';

export interface TokenEnvelopeV1 {
  v: 1;
  alg: 'aes-256-gcm';
  kid: string;
  iv: string;
  tag: string;
  ct: string;
}

export interface EncryptInput {
  plaintext: string;
  userId: string;
  purpose: TokenVaultPurpose;
  /** Extra binding material (e.g. state hash for PKCE). */
  aadExtra?: string;
}

const ALG = 'aes-256-gcm' as const;
const IV_BYTES = 12;
const KEY_BYTES = 32;

let cachedKeys: Map<string, Buffer> | null = null;
let cachedWriteKid: string | null = null;

function parseKeyMaterial(raw: string, envName: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${envName} is empty`);
  }

  // Prefer base64 (44 chars for 32 bytes) then hex (64 chars).
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(trimmed, 'base64');
  } catch {
    throw new Error(`${envName} must be 32-byte base64 or 64-char hex`);
  }

  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `${envName} must decode to exactly ${KEY_BYTES} bytes (got ${buf.length})`
    );
  }
  return buf;
}

function loadKeys(): { keys: Map<string, Buffer>; writeKid: string } {
  if (cachedKeys && cachedWriteKid) {
    return { keys: cachedKeys, writeKid: cachedWriteKid };
  }

  const keys = new Map<string, Buffer>();
  const v1 = process.env.TOKEN_ENCRYPTION_KEY_V1;
  const v2 = process.env.TOKEN_ENCRYPTION_KEY_V2;

  if (v1) {
    keys.set('v1', parseKeyMaterial(v1, 'TOKEN_ENCRYPTION_KEY_V1'));
  }
  if (v2) {
    keys.set('v2', parseKeyMaterial(v2, 'TOKEN_ENCRYPTION_KEY_V2'));
  }

  const writeKid = (process.env.TOKEN_ENCRYPTION_WRITE_KID || 'v1').trim();
  if (!keys.has(writeKid)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `TOKEN_ENCRYPTION_KEY_${writeKid.toUpperCase()} is required in production (write kid=${writeKid})`
      );
    }
    // Dev/test fallback: derive a deterministic non-production key from JWT_SECRET.
    const seed = process.env.JWT_SECRET || 'dev-token-vault-fallback-not-for-production';
    const derived = crypto.createHash('sha256').update(`token-vault:${seed}`).digest();
    keys.set(writeKid, derived);
  }

  cachedKeys = keys;
  cachedWriteKid = writeKid;
  return { keys, writeKid };
}

/** Reset cached keys — for unit tests only. */
export function resetTokenVaultForTests(): void {
  cachedKeys = null;
  cachedWriteKid = null;
}

export function getTokenVaultWriteKid(): string {
  return loadKeys().writeKid;
}

function buildAad(input: Omit<EncryptInput, 'plaintext'> | EncryptInput): Buffer {
  const parts = [input.userId, input.purpose];
  if (input.aadExtra) parts.push(input.aadExtra);
  return Buffer.from(parts.join('|'), 'utf8');
}

export function encryptToken(input: EncryptInput): TokenEnvelopeV1 {
  const { keys, writeKid } = loadKeys();
  const key = keys.get(writeKid);
  if (!key) {
    throw new Error(`Missing encryption key for write kid=${writeKid}`);
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const aad = buildAad(input);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([
    cipher.update(input.plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: ALG,
    kid: writeKid,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ciphertext.toString('base64'),
  };
}

export function serializeEnvelope(envelope: TokenEnvelopeV1): string {
  return JSON.stringify(envelope);
}

export function parseEnvelope(raw: string): TokenEnvelopeV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid token envelope JSON');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as TokenEnvelopeV1).v !== 1 ||
    (parsed as TokenEnvelopeV1).alg !== ALG ||
    typeof (parsed as TokenEnvelopeV1).kid !== 'string' ||
    typeof (parsed as TokenEnvelopeV1).iv !== 'string' ||
    typeof (parsed as TokenEnvelopeV1).tag !== 'string' ||
    typeof (parsed as TokenEnvelopeV1).ct !== 'string'
  ) {
    throw new Error('Invalid token envelope shape');
  }

  return parsed as TokenEnvelopeV1;
}

export function decryptToken(
  envelopeRaw: string,
  input: Omit<EncryptInput, 'plaintext'>
): string {
  const envelope = parseEnvelope(envelopeRaw);
  const { keys } = loadKeys();
  const key = keys.get(envelope.kid);
  if (!key) {
    throw new Error(`Unknown token encryption key version: ${envelope.kid}`);
  }

  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ct = Buffer.from(envelope.ct, 'base64');
  if (iv.length !== IV_BYTES) {
    throw new Error('Invalid token envelope IV length');
  }

  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAAD(buildAad(input));
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString('utf8');
}

export function assertTokenVaultConfiguredForProduction(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const v1 = process.env.TOKEN_ENCRYPTION_KEY_V1;
  if (!v1) {
    throw new Error('TOKEN_ENCRYPTION_KEY_V1 is required in production');
  }
  parseKeyMaterial(v1, 'TOKEN_ENCRYPTION_KEY_V1');
}
