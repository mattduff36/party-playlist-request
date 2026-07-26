/**
 * PRD-03 behavioral negatives: OAuth consume isolation / replay + decrypt leak guard.
 * DB is mocked — no live Postgres.
 */

const queryMock = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: (...args: any[]) => queryMock(...args),
    end: jest.fn(),
    on: jest.fn(),
  })),
}));

import {
  consumeOAuthTransaction,
  getSpotifyAuth,
} from '@/lib/db';
import {
  encryptToken,
  resetTokenVaultForTests,
  serializeEnvelope,
  assertTokenVaultConfiguredForProduction,
} from '@/lib/crypto/token-vault';
import { generateOAuthState, hashOAuthState } from '@/lib/spotify/oauth-state';

const FIXTURE_VERIFIER =
  'pkce-verifier-behavioral-prd03-abcdefghijklmnopqrstuvwxyz';
const LEAK_ACCESS = 'leak-me-access-token-prd03-behavioral';
const LEAK_REFRESH = 'leak-me-refresh-token-prd03-behavioral';

describe('PRD-03: behavioral OAuth + vault negatives', () => {
  const prevV1 = process.env.TOKEN_ENCRYPTION_KEY_V1;
  const prevWrite = process.env.TOKEN_ENCRYPTION_WRITE_KID;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 11).toString('base64');
    process.env.TOKEN_ENCRYPTION_WRITE_KID = 'v1';
    (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
    resetTokenVaultForTests();
    queryMock.mockReset();
  });

  afterAll(() => {
    if (prevV1 === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_V1;
    else process.env.TOKEN_ENCRYPTION_KEY_V1 = prevV1;
    if (prevWrite === undefined) delete process.env.TOKEN_ENCRYPTION_WRITE_KID;
    else process.env.TOKEN_ENCRYPTION_WRITE_KID = prevWrite;
    (process.env as { NODE_ENV?: string }).NODE_ENV = prevNodeEnv;
    resetTokenVaultForTests();
  });

  it('denies cross-user consumeOAuthTransaction (mocked DB returns no row)', async () => {
    const state = generateOAuthState();
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await consumeOAuthTransaction(state, 'attacker-user');
    expect(result).toBeNull();

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0] as [string, string[]];
    expect(String(sql)).toMatch(/AND user_id = \$2/);
    expect(String(sql)).toMatch(/consumed_at IS NULL/);
    expect(params[0]).toBe(hashOAuthState(state));
    expect(params[1]).toBe('attacker-user');
  });

  it('rejects double-callback / replay on the same state (second consume fails)', async () => {
    const state = generateOAuthState();
    const ownerId = 'owner-user';
    const stateHash = hashOAuthState(state);
    const verifierEnvelope = serializeEnvelope(
      encryptToken({
        plaintext: FIXTURE_VERIFIER,
        userId: ownerId,
        purpose: 'spotify.pkce',
        aadExtra: stateHash,
      })
    );

    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          state: stateHash,
          code_verifier: null,
          code_verifier_encrypted: verifierEnvelope,
          user_id: ownerId,
          username: 'dj-owner',
          redirect_id: 'admin_spotify',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          consumed_at: null,
        },
      ],
    });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const first = await consumeOAuthTransaction(state, ownerId);
    expect(first).not.toBeNull();
    expect(first?.codeVerifier).toBe(FIXTURE_VERIFIER);
    expect(first?.userId).toBe(ownerId);

    const second = await consumeOAuthTransaction(state, ownerId);
    expect(second).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('getSpotifyAuth decrypt failure does not return or leak plaintext tokens', async () => {
    const good = serializeEnvelope(
      encryptToken({
        plaintext: LEAK_ACCESS,
        userId: 'user-1',
        purpose: 'spotify.access',
      })
    );
    const tampered = JSON.parse(good) as {
      ct: string;
      iv: string;
      tag: string;
      kid: string;
      v: number;
      alg: string;
    };
    tampered.ct = Buffer.from('corrupted-ciphertext-prd03').toString('base64');

    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          access_token: LEAK_ACCESS,
          refresh_token: LEAK_REFRESH,
          access_token_envelope: JSON.stringify(tampered),
          refresh_token_envelope: null,
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
          scope: 'user-read-email',
          token_type: 'Bearer',
          updated_at: new Date().toISOString(),
          refresh_lock_version: 0,
        },
      ],
    });

    let caught: any;
    try {
      await getSpotifyAuth('user-1');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toBe('Failed to decrypt Spotify credentials');
    expect(message).not.toContain(LEAK_ACCESS);
    expect(message).not.toContain(LEAK_REFRESH);
    expect(JSON.stringify(caught)).not.toContain(LEAK_ACCESS);
    expect(JSON.stringify(caught)).not.toContain(LEAK_REFRESH);
  });

  it('assertTokenVaultConfiguredForProduction fails fast without key (no key leak)', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY_V1;
    resetTokenVaultForTests();
    (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';

    expect(() => assertTokenVaultConfiguredForProduction()).toThrow(
      'TOKEN_ENCRYPTION_KEY_V1 is required in production'
    );

    try {
      assertTokenVaultConfiguredForProduction();
    } catch (err) {
      const msg = String(err);
      expect(msg).not.toMatch(/AAAA|base64|hex=/i);
      expect(msg).not.toContain('Buffer');
    }
  });

  it('assertTokenVaultConfiguredForProduction is a no-op outside production', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY_V1;
    resetTokenVaultForTests();
    (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
    expect(() => assertTokenVaultConfiguredForProduction()).not.toThrow();
  });
});
