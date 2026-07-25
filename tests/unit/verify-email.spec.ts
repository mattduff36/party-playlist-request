/**
 * Email verification API — pin-required event create + idempotent verify
 */

const sendWelcomeEmail = jest.fn().mockResolvedValue({ success: true });
const generateAccessCode = jest.fn().mockReturnValue('482913');

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

jest.mock('@/lib/email/email-service', () => ({
  sendWelcomeEmail: (...args: unknown[]) => sendWelcomeEmail(...args),
}));

jest.mock('@/lib/access-code', () => ({
  generateAccessCode: (...args: unknown[]) => generateAccessCode(...args),
}));

describe('POST /api/auth/verify-email', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.resetModules();
    sendWelcomeEmail.mockClear();
    generateAccessCode.mockClear();
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
    const mod = await import('@/app/api/auth/verify-email/route');
    return mod.POST;
  }

  function postRequest(token: string) {
    return new Request('http://localhost/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }) as unknown as import('next/server').NextRequest;
  }

  it('verifies email and inserts events row with a generated pin', async () => {
    const token = 'a'.repeat(64);
    const user = {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'newdj',
      email: 'newdj@example.com',
      account_status: 'pending',
      email_verified: false,
      email_verification_expires: new Date(Date.now() + 60_000).toISOString(),
    };

    const { sql, calls } = createSqlMock([
      () => [user], // SELECT by token
      () => [{ id: user.id, username: user.username, email: user.email }], // UPDATE verify
      () => [], // SELECT existing event
      () => [], // INSERT event
    ]);

    const POST = await loadPost(sql);
    const response = await POST(postRequest(token));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.username).toBe('newdj');
    expect(generateAccessCode).toHaveBeenCalledWith(false);

    const insertCall = calls.find((call) =>
      call.strings.join(' ').toLowerCase().includes('insert into events')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall!.values).toContain('482913');
    expect(insertCall!.values).toContain(user.id);
    expect(sendWelcomeEmail).toHaveBeenCalled();
  });

  it('still returns success when event insert fails after verify', async () => {
    const token = 'b'.repeat(64);
    const user = {
      id: '22222222-2222-2222-2222-222222222222',
      username: 'partialdj',
      email: 'partial@example.com',
      account_status: 'pending',
      email_verified: false,
      email_verification_expires: new Date(Date.now() + 60_000).toISOString(),
    };

    const { sql } = createSqlMock([
      () => [user],
      () => [{ id: user.id, username: user.username, email: user.email }],
      () => [],
      () => {
        throw new Error('null value in column "pin" violates not-null constraint');
      },
    ]);

    const POST = await loadPost(sql);
    const response = await POST(postRequest(token));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toMatch(/verified successfully/i);
  });

  it('is idempotent when email is already verified for the same token', async () => {
    const token = 'c'.repeat(64);
    const user = {
      id: '33333333-3333-3333-3333-333333333333',
      username: 'verifieddj',
      email: 'verified@example.com',
      account_status: 'pending',
      email_verified: true,
      email_verification_expires: new Date(Date.now() + 60_000).toISOString(),
    };

    const { sql } = createSqlMock([
      () => [user],
      () => [{ id: 'event-1' }], // existing event
    ]);

    const POST = await loadPost(sql);
    const response = await POST(postRequest(token));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.alreadyVerified).toBe(true);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
