/**
 * Password reset API — hash-present dual-verify (no plaintext fallthrough)
 */

import { hashOpaqueToken } from '@/lib/crypto/secret-hashes';

type SqlCall = { strings: TemplateStringsArray; values: unknown[] };

function createSqlMock(handlers: Array<(call: SqlCall) => unknown>) {
  let index = 0;
  const calls: SqlCall[] = [];

  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const call = { strings, values };
    calls.push(call);
    const handler = handlers[index];
    index += 1;
    if (!handler) {
      throw new Error(`Unexpected sql call #${index}: ${strings.join('?')}`);
    }
    return Promise.resolve(handler(call));
  };

  return { sql, calls };
}

jest.mock('@/lib/auth/auth-rate-limit', () => ({
  enforceAuthRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  hashLimiterId: jest.fn((_k: string, v: string) => v),
  genericAuthRateLimitResponse: (retryAfterSec: number) => ({
    error: 'Too many requests',
    retryAfterSec,
  }),
}));

jest.mock('@/lib/support/withApiLogging', () => ({
  getIpHash: () => 'test-ip-hash',
}));

jest.mock('@/lib/auth/security-audit', () => ({
  emitSecurityAudit: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('POST /api/auth/reset-password', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.resetModules();
    process.env.DATABASE_URL =
      originalDatabaseUrl || 'postgresql://user:pass@localhost:5432/test';
  });

  afterAll(() => {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  async function loadPost(sql: ReturnType<typeof createSqlMock>['sql']) {
    jest.doMock('@/lib/db/neon-client', () => ({ sql }));
    const mod = await import('@/app/api/auth/reset-password/route');
    return mod.POST;
  }

  function postRequest(token: string, password = 'newpassword1') {
    return new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    }) as unknown as import('next/server').NextRequest;
  }

  /** Simulate dual-verify SQL: hash match OR (hash IS NULL AND plaintext). */
  function dualVerifyResetRow(
    call: SqlCall,
    stored: { hash: string | null; plaintext: string }
  ): unknown[] {
    const sqlText = call.strings.join(' ');
    expect(sqlText).toMatch(/token_hash IS NULL/i);
    const presentedHash = String(call.values[0]);
    const presentedPlain = String(call.values[1]);
    if (stored.hash && presentedHash === stored.hash) {
      return [
        {
          token_id: 'tok-1',
          user_id: 'user-1',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used: false,
          username: 'dj',
          email: 'dj@example.com',
          account_status: 'active',
        },
      ];
    }
    if (!stored.hash && presentedPlain === stored.plaintext) {
      return [
        {
          token_id: 'tok-1',
          user_id: 'user-1',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used: false,
          username: 'dj',
          email: 'dj@example.com',
          account_status: 'active',
        },
      ];
    }
    return [];
  }

  it('hash present ⇒ diverged plaintext denied', async () => {
    const realToken = 'r'.repeat(64);
    const divergedPlain = 'd'.repeat(64);
    const storedHash = hashOpaqueToken(realToken);

    const { sql } = createSqlMock([
      (call) =>
        dualVerifyResetRow(call, { hash: storedHash, plaintext: divergedPlain }),
    ]);

    const POST = await loadPost(sql);
    const response = await POST(postRequest(divergedPlain));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/invalid or expired/i);
  });

  it('hash present ⇒ correct token still accepted', async () => {
    const realToken = 'r'.repeat(64);
    const storedHash = hashOpaqueToken(realToken);

    const { sql } = createSqlMock([
      (call) =>
        dualVerifyResetRow(call, { hash: storedHash, plaintext: realToken }),
      () => [], // UPDATE users password
      () => [], // mark token used
      () => [], // invalidate other tokens
    ]);

    const POST = await loadPost(sql);
    const response = await POST(postRequest(realToken));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
