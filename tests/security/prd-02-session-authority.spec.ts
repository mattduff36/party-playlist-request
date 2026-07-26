/**
 * PRD-02 session authority, logout separation, CSRF, and refresh abuse tests.
 */

import { NextRequest } from 'next/server';
import {
  isActiveSession,
  isAccountAllowed,
  type SessionUserRecord,
} from '@/lib/auth/session-authority';
import {
  assertCsrfForCookieMutation,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  isSameOriginRequest,
} from '@/lib/auth/csrf';
import {
  enforceAuthRateLimit,
  hashLimiterId,
  resetAuthRateLimitForTests,
} from '@/lib/auth/auth-rate-limit';

function asNextRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

describe('PRD-02: active session equality', () => {
  it('rejects missing token session_id even when DB has a lock', () => {
    expect(isActiveSession(undefined, 'abc')).toBe(false);
    expect(isActiveSession('', 'abc')).toBe(false);
  });

  it('rejects mismatched session ids', () => {
    expect(isActiveSession('old', 'new')).toBe(false);
  });

  it('accepts exact match', () => {
    expect(isActiveSession('sess-1', 'sess-1')).toBe(true);
  });

  it('rejects disabled accounts', () => {
    const record: SessionUserRecord = {
      id: 'u1',
      username: 'dj',
      email: 'dj@example.com',
      role: 'user',
      active_session_id: 's1',
      account_status: 'disabled',
      email_verified: true,
    };
    expect(isAccountAllowed(record)).toBe(false);
  });
});

describe('PRD-02: CSRF / same-origin', () => {
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  });

  it('allows safe methods without CSRF', () => {
    const req = asNextRequest('http://localhost:3000/api/admin/requests', {
      method: 'GET',
      headers: { cookie: 'auth_token=abc' },
    });
    expect(assertCsrfForCookieMutation(req).ok).toBe(true);
  });

  it('rejects cookie mutation without CSRF header', () => {
    const req = asNextRequest('http://localhost:3000/api/admin/approve/1', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        cookie: `auth_token=abc; ${CSRF_COOKIE_NAME}=tok`,
      },
      body: '{}',
    });
    const result = assertCsrfForCookieMutation(req);
    expect(result.ok).toBe(false);
  });

  it('accepts matching double-submit CSRF on same origin', () => {
    const token = generateCsrfToken();
    const req = asNextRequest('http://localhost:3000/api/admin/approve/1', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        [CSRF_HEADER_NAME]: token,
        cookie: `auth_token=abc; ${CSRF_COOKIE_NAME}=${token}`,
      },
      body: '{}',
    });
    expect(assertCsrfForCookieMutation(req).ok).toBe(true);
  });

  it('rejects cross-origin mutations', () => {
    const token = generateCsrfToken();
    const req = asNextRequest('http://localhost:3000/api/admin/approve/1', {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example',
        'Content-Type': 'application/json',
        [CSRF_HEADER_NAME]: token,
        cookie: `auth_token=abc; ${CSRF_COOKIE_NAME}=${token}`,
      },
      body: '{}',
    });
    expect(isSameOriginRequest(req)).toBe(false);
    expect(assertCsrfForCookieMutation(req).ok).toBe(false);
  });

  it('rejects form-urlencoded cookie mutations', () => {
    const token = generateCsrfToken();
    const req = asNextRequest('http://localhost:3000/api/admin/approve/1', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/x-www-form-urlencoded',
        [CSRF_HEADER_NAME]: token,
        cookie: `auth_token=abc; ${CSRF_COOKIE_NAME}=${token}`,
      },
      body: 'x=1',
    });
    expect(assertCsrfForCookieMutation(req).ok).toBe(false);
  });
});

describe('PRD-02: auth rate limit', () => {
  beforeEach(() => {
    resetAuthRateLimitForTests();
  });

  it('hashes identifiers without returning raw values', () => {
    const h = hashLimiterId('email', 'User@Example.com');
    expect(h).not.toMatch(/user@example/i);
    expect(h.length).toBe(32);
  });

  it('trips after repeated attempts on the same IP bucket', async () => {
    const ipHash = hashLimiterId('ip', 'test-ip-1');
    for (let i = 0; i < 5; i++) {
      const r = await enforceAuthRateLimit({
        action: 'login-test',
        ipHash,
        maxPerIp: 5,
        windowMs: 60_000,
      });
      expect(r.allowed).toBe(true);
    }
    const blocked = await enforceAuthRateLimit({
      action: 'login-test',
      ipHash,
      maxPerIp: 5,
      windowMs: 60_000,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

describe('PRD-02: requireAuth session revocation', () => {
  const prevJwt = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'unit_test_jwt_secret_prd02';
  });

  afterAll(() => {
    process.env.JWT_SECRET = prevJwt;
  });

  beforeEach(() => {
    jest.resetModules();
  });

  it('returns SESSION_REVOKED when JWT session_id does not match DB', async () => {
    jest.doMock('@/lib/db/neon-client', () => ({
      sql: Object.assign(
        jest.fn(async () => [
          {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            username: 'organiser-a',
            email: 'a@example.com',
            role: 'user',
            active_session_id: 'active-session',
            account_status: 'active',
            email_verified: true,
          },
        ]),
        { raw: jest.fn() }
      ),
    }));

    const { generateToken } = await import('@/lib/auth');
    const { requireAuth } = await import('@/middleware/auth');

    const token = generateToken({
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      username: 'organiser-a',
      email: 'a@example.com',
      role: 'user',
      session_id: 'stale-session',
    });

    const res = await requireAuth(
      asNextRequest('http://localhost/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.authenticated).toBe(false);
    expect(res.response?.status).toBe(401);
    const body = await res.response!.json();
    expect(body.code).toBe('SESSION_REVOKED');
  });

  it('accepts JWT when session_id matches active_session_id', async () => {
    jest.doMock('@/lib/db/neon-client', () => ({
      sql: Object.assign(
        jest.fn(async () => [
          {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            username: 'organiser-a',
            email: 'a@example.com',
            role: 'user',
            active_session_id: 'live-session',
            account_status: 'active',
            email_verified: true,
          },
        ]),
        { raw: jest.fn() }
      ),
    }));

    const { generateToken } = await import('@/lib/auth');
    const { requireAuth } = await import('@/middleware/auth');

    const token = generateToken({
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      username: 'organiser-a',
      email: 'a@example.com',
      role: 'user',
      session_id: 'live-session',
    });

    const res = await requireAuth(
      asNextRequest('http://localhost/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.authenticated).toBe(true);
    expect(res.sessionId).toBe('live-session');
  });

  it('refresh rejects revoked sessions and does not mint from claims alone', async () => {
    jest.doMock('@/lib/db/neon-client', () => ({
      sql: Object.assign(
        jest.fn(async () => [
          {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            username: 'organiser-a',
            email: 'a@example.com',
            role: 'user',
            active_session_id: 'other-session',
            account_status: 'active',
            email_verified: true,
          },
        ]),
        { raw: jest.fn() }
      ),
    }));

    const { generateToken } = await import('@/lib/auth');
    const { POST } = await import('@/app/api/auth/refresh-session/route');

    const token = generateToken({
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      username: 'organiser-a',
      email: 'a@example.com',
      role: 'user',
      session_id: 'revoked-session',
    });

    const res = await POST(
      asNextRequest('http://localhost/api/auth/refresh-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('SESSION_REVOKED');
  });
});

describe('PRD-02: logout does not destroy event data', () => {
  it('logout route source never deletes requests or forces offline', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/auth/logout/route.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/DELETE\s+FROM\s+requests/i);
    expect(src).not.toMatch(/status\s*=\s*'offline'/);
    expect(src).toMatch(/releaseActiveSessionIfMatch/);
  });

  it('event offline path no longer deletes requests', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/event/status/route.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/DELETE\s+FROM\s+requests/i);
    expect(src).toMatch(/emitSecurityAudit\(\s*'event\.end'/);
  });
});
