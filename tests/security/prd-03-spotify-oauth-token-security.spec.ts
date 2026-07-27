/**
 * PRD-03: Spotify OAuth / PKCE / token vault security tests.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  decryptToken,
  encryptToken,
  parseEnvelope,
  resetTokenVaultForTests,
  serializeEnvelope,
  getTokenVaultWriteKid,
} from '@/lib/crypto/token-vault';
import { hashOAuthState, generateOAuthState } from '@/lib/spotify/oauth-state';
import {
  signOAuthBindValue,
  verifyOAuthBindValue,
} from '@/lib/spotify/oauth-binding';
import {
  completeSpotifyOAuthCallback,
  messageForSpotifyOAuthError,
} from '@/lib/spotify-oauth-client';
import { POST as callbackPost } from '@/app/api/spotify/callback/route';

const FIXTURE_ACCESS = 'spotify-access-token-fixture-prd03';
const FIXTURE_REFRESH = 'spotify-refresh-token-fixture-prd03';
const FIXTURE_VERIFIER = 'pkce-verifier-fixture-prd03-abcdefghijklmnopqrstuvwxyz';

describe('PRD-03: token vault envelope', () => {
  const prevV1 = process.env.TOKEN_ENCRYPTION_KEY_V1;
  const prevV2 = process.env.TOKEN_ENCRYPTION_KEY_V2;
  const prevWrite = process.env.TOKEN_ENCRYPTION_WRITE_KID;

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString('base64');
    delete process.env.TOKEN_ENCRYPTION_KEY_V2;
    process.env.TOKEN_ENCRYPTION_WRITE_KID = 'v1';
    resetTokenVaultForTests();
  });

  afterAll(() => {
    if (prevV1 === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_V1;
    else process.env.TOKEN_ENCRYPTION_KEY_V1 = prevV1;
    if (prevV2 === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_V2;
    else process.env.TOKEN_ENCRYPTION_KEY_V2 = prevV2;
    if (prevWrite === undefined) delete process.env.TOKEN_ENCRYPTION_WRITE_KID;
    else process.env.TOKEN_ENCRYPTION_WRITE_KID = prevWrite;
    resetTokenVaultForTests();
  });

  it('encrypts and decrypts with AAD binding', () => {
    const envelope = encryptToken({
      plaintext: FIXTURE_ACCESS,
      userId: 'user-1',
      purpose: 'spotify.access',
    });
    const raw = serializeEnvelope(envelope);
    expect(raw).not.toContain(FIXTURE_ACCESS);
    expect(decryptToken(raw, { userId: 'user-1', purpose: 'spotify.access' })).toBe(
      FIXTURE_ACCESS
    );
  });

  it('fails decryption when AAD userId is tampered', () => {
    const raw = serializeEnvelope(
      encryptToken({
        plaintext: FIXTURE_ACCESS,
        userId: 'user-1',
        purpose: 'spotify.access',
      })
    );
    expect(() =>
      decryptToken(raw, { userId: 'user-2', purpose: 'spotify.access' })
    ).toThrow();
  });

  it('fails decryption when ciphertext, IV, or tag is tampered', () => {
    const envelope = encryptToken({
      plaintext: FIXTURE_REFRESH,
      userId: 'user-1',
      purpose: 'spotify.refresh',
    });

    const badCt = { ...envelope, ct: Buffer.from('tampered').toString('base64') };
    expect(() =>
      decryptToken(serializeEnvelope(badCt), {
        userId: 'user-1',
        purpose: 'spotify.refresh',
      })
    ).toThrow();

    const badIv = {
      ...envelope,
      iv: Buffer.alloc(12, 9).toString('base64'),
    };
    expect(() =>
      decryptToken(serializeEnvelope(badIv), {
        userId: 'user-1',
        purpose: 'spotify.refresh',
      })
    ).toThrow();

    const badTag = {
      ...envelope,
      tag: Buffer.alloc(16, 3).toString('base64'),
    };
    expect(() =>
      decryptToken(serializeEnvelope(badTag), {
        userId: 'user-1',
        purpose: 'spotify.refresh',
      })
    ).toThrow();
  });

  it('reads old key version and writes with active write kid', () => {
    const v1Key = Buffer.alloc(32, 7).toString('base64');
    const v2Key = Buffer.alloc(32, 8).toString('base64');
    process.env.TOKEN_ENCRYPTION_KEY_V1 = v1Key;
    process.env.TOKEN_ENCRYPTION_KEY_V2 = v2Key;
    process.env.TOKEN_ENCRYPTION_WRITE_KID = 'v1';
    resetTokenVaultForTests();

    const oldRaw = serializeEnvelope(
      encryptToken({
        plaintext: FIXTURE_ACCESS,
        userId: 'user-1',
        purpose: 'spotify.access',
      })
    );
    expect(parseEnvelope(oldRaw).kid).toBe('v1');

    process.env.TOKEN_ENCRYPTION_WRITE_KID = 'v2';
    resetTokenVaultForTests();
    expect(getTokenVaultWriteKid()).toBe('v2');

    const stillReadable = decryptToken(oldRaw, {
      userId: 'user-1',
      purpose: 'spotify.access',
    });
    expect(stillReadable).toBe(FIXTURE_ACCESS);

    const newRaw = serializeEnvelope(
      encryptToken({
        plaintext: FIXTURE_REFRESH,
        userId: 'user-1',
        purpose: 'spotify.refresh',
      })
    );
    expect(parseEnvelope(newRaw).kid).toBe('v2');
    expect(
      decryptToken(newRaw, { userId: 'user-1', purpose: 'spotify.refresh' })
    ).toBe(FIXTURE_REFRESH);
  });

  it('stored envelope JSON does not contain plaintext fixtures', () => {
    const raw = serializeEnvelope(
      encryptToken({
        plaintext: FIXTURE_VERIFIER,
        userId: 'user-1',
        purpose: 'spotify.pkce',
        aadExtra: 'state-hash',
      })
    );
    expect(raw).not.toContain(FIXTURE_VERIFIER);
    expect(raw).not.toContain(FIXTURE_ACCESS);
  });
});

describe('PRD-03: OAuth state + binding', () => {
  it('hashes state so raw state is not equal to storage key', () => {
    const raw = generateOAuthState();
    const hash = hashOAuthState(raw);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(raw);
    expect(hashOAuthState(raw)).toBe(hash);
  });

  it('binding cookie is user+state specific', () => {
    const state = generateOAuthState();
    const cookie = signOAuthBindValue(state, 'user-a');
    expect(verifyOAuthBindValue(cookie, state, 'user-a')).toBe(true);
    expect(verifyOAuthBindValue(cookie, state, 'user-b')).toBe(false);
    expect(verifyOAuthBindValue(cookie, generateOAuthState(), 'user-a')).toBe(
      false
    );
  });
});

describe('PRD-03: oauth-session route removed', () => {
  it('does not ship /api/spotify/oauth-session', () => {
    const routePath = path.join(
      process.cwd(),
      'src/app/api/spotify/oauth-session/route.ts'
    );
    expect(fs.existsSync(routePath)).toBe(false);
  });

  it('client completeSpotifyOAuthCallback never succeeds with verifier exchange', async () => {
    const result = await completeSpotifyOAuthCallback('code', 'state');
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain(FIXTURE_VERIFIER);
    expect(JSON.stringify(result).toLowerCase()).not.toContain('code_verifier');
  });
});

describe('PRD-03: callback API surface', () => {
  it('POST callback is gone (no client verifier exchange)', async () => {
    const res = await callbackPost();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(JSON.stringify(body).toLowerCase()).not.toContain('code_verifier');
  });

  it('GET callback without session redirects with session_required', async () => {
    jest.resetModules();
    jest.doMock('@/middleware/auth', () => ({
      requireAuth: jest.fn(async () => ({
        authenticated: false,
        user: null,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
        }),
      })),
    }));

    const { GET } = await import('@/app/api/spotify/callback/route');
    const req = new NextRequest(
      'http://localhost:3000/api/spotify/callback?code=abc&state=xyz'
    );
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const location = res.headers.get('location') || '';
    expect(location).toContain('spotify_error=session_required');
    expect(location).not.toContain('code=');
    expect(location.toLowerCase()).not.toContain('verifier');

    jest.dontMock('@/middleware/auth');
  });
});

describe('PRD-03: source guarantees for single-use + CAS + disconnect', () => {
  it('consumeOAuthTransaction uses atomic UPDATE … RETURNING with user_id bind', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/db.ts'),
      'utf8'
    );
    expect(src).toContain('SET consumed_at = CURRENT_TIMESTAMP');
    expect(src).toMatch(/AND user_id = \$2/);
    expect(src).toContain('AND consumed_at IS NULL');
    expect(src).toContain('RETURNING *');
  });

  it('setSpotifyAuthCas increments refresh_lock_version', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/db.ts'),
      'utf8'
    );
    expect(src).toContain('refresh_lock_version = refresh_lock_version + 1');
    expect(src).toContain('AND refresh_lock_version = $8');
  });

  it('new token writes clear plaintext columns', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/db.ts'),
      'utf8'
    );
    expect(src).toContain('access_token = NULL');
    expect(src).toContain('refresh_token = NULL');
    expect(src).toContain('access_token_envelope');
  });

  it('disconnect clears oauth sessions', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/spotify/disconnect/route.ts'),
      'utf8'
    );
    expect(src).toContain('clearOAuthSessionsForUser');
  });

  it('migration does not drop plaintext token columns (Class D deferred)', () => {
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/lib/db/migrations/add_spotify_token_encryption.sql'
      ),
      'utf8'
    );
    expect(src.toLowerCase()).not.toMatch(/drop column.*access_token/);
    expect(src.toLowerCase()).not.toMatch(/drop column.*refresh_token/);
    expect(src).toContain('Class C');
    expect(src).toContain('DEFERRED');
  });
});

describe('PRD-03: client error messages never embed secrets', () => {
  it('maps known codes without leaking fixtures', () => {
    const msg = messageForSpotifyOAuthError('oauth_replay');
    expect(msg.toLowerCase()).not.toContain('verifier');
    expect(msg).not.toContain(FIXTURE_ACCESS);
  });
});
