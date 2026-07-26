/**
 * PRD-01 production lockdown regression tests.
 * Proves removed routes are gone and remaining surfaces reject unauthorized access.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  CLIENT_ERROR_MAX_BODY_BYTES,
  parseClientErrorIntake,
} from '@/lib/support/client-error-intake';
import { resolveSecretEnv } from '@/lib/security/fail-closed-env';
import { hashIP } from '@/lib/db';

const repoRoot = path.resolve(process.cwd());

function routeExists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function asNextRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

describe('PRD-01: removed maintenance / startup surfaces', () => {
  it('does not ship create-schema, migrate/user-settings, startup, or init-db routes', () => {
    expect(routeExists('src/app/api/create-schema/route.ts')).toBe(false);
    expect(routeExists('src/app/api/migrate/user-settings/route.ts')).toBe(false);
    expect(routeExists('src/app/api/startup/route.ts')).toBe(false);
    expect(routeExists('src/app/api/init-db/route.ts')).toBe(false);
    expect(routeExists('src/components/ServerStartup.tsx')).toBe(false);
    expect(routeExists('src/app/api/notifications/route.ts')).toBe(false);
  });

  it('does not reference SYSTEM_STARTUP_TOKEN or startup-system-token in source', () => {
    const sources = [
      'src/app/api/admin/spotify-watcher/route.ts',
      'src/app/api/admin/approve/[id]/route.ts',
      'src/app/layout.tsx',
      '.env.example',
    ];
    for (const file of sources) {
      const full = path.join(repoRoot, file);
      if (!fs.existsSync(full)) continue;
      const text = fs.readFileSync(full, 'utf8');
      expect(text).not.toMatch(/SYSTEM_STARTUP_TOKEN|startup-system-token/);
    }
  });
});

describe('PRD-01: legacy display routes', () => {
  it('GET /api/display/current returns 410 with no event data', async () => {
    const { GET } = await import('@/app/api/display/current/route');
    const res = await GET();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.current_track).toBeUndefined();
    expect(body.event_settings).toBeUndefined();
    expect(body.upcoming_songs).toBeUndefined();
    expect(body.code).toBe('LEGACY_DISPLAY_RETIRED');
  });

  it('GET /api/display/requests returns 410 with no request data', async () => {
    const { GET } = await import('@/app/api/display/requests/route');
    const res = await GET();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.approved_requests).toBeUndefined();
    expect(body.recently_played_requests).toBeUndefined();
    expect(body.code).toBe('LEGACY_DISPLAY_RETIRED');
  });
});

describe('PRD-01: public liveness', () => {
  it('GET /api/monitoring/health returns only { status: "ok" }', async () => {
    const { GET } = await import('@/app/api/monitoring/health/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
    expect(Object.keys(body)).toEqual(['status']);
  });
});

describe('PRD-01: monitoring unauthorized', () => {
  it('metrics/dashboard reject anonymous callers with 401', async () => {
    jest.resetModules();
    const { GET: getMetrics } = await import('@/app/api/monitoring/metrics/route');
    const { GET: getDashboard } = await import(
      '@/app/api/monitoring/dashboard/route'
    );

    const metricsRes = await getMetrics(
      asNextRequest('http://localhost/api/monitoring/metrics')
    );
    const dashboardRes = await getDashboard(
      asNextRequest('http://localhost/api/monitoring/dashboard')
    );

    expect(metricsRes.status).toBe(401);
    expect(dashboardRes.status).toBe(401);
  });

  it('metrics rejects normal organiser with 403', async () => {
    const prev = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'unit_test_jwt_secret_prd01';
    jest.resetModules();
    const { generateToken: mint } = await import('@/lib/auth');
    const token = mint({
      user_id: '11111111-1111-1111-1111-111111111111',
      username: 'organiser-a',
      email: 'a@example.com',
      role: 'user',
    });

    const { GET } = await import('@/app/api/monitoring/metrics/route');
    const res = await GET(
      asNextRequest('http://localhost/api/monitoring/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(403);
    process.env.JWT_SECRET = prev;
  });
});

describe('PRD-01: spotify-watcher auth', () => {
  const prevMock = process.env.SPOTIFY_MOCK;
  const prevJwt = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'unit_test_jwt_secret_prd01';
    process.env.SPOTIFY_MOCK = 'false';
  });

  afterAll(() => {
    process.env.JWT_SECRET = prevJwt;
    if (prevMock === undefined) delete process.env.SPOTIFY_MOCK;
    else process.env.SPOTIFY_MOCK = prevMock;
  });

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/lib/spotify-sync', () => ({
      PLAYING_QUEUE_MS: 5000,
      tickUserPlayback: jest.fn(async (userId: string, username: string) => ({
        userId,
        username,
        skipped: false,
        broadcast: false,
        isPlaying: false,
      })),
      tickAllActiveParties: jest.fn(),
    }));
  });

  it('returns 401 without cookie/token', async () => {
    const { POST } = await import('@/app/api/admin/spotify-watcher/route');
    const res = await POST(
      asNextRequest('http://localhost/api/admin/spotify-watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tick' }),
      })
    );
    expect(res.status).toBe(401);
  });

  it('rejects Bearer startup-system-token with 401', async () => {
    const { POST } = await import('@/app/api/admin/spotify-watcher/route');
    const res = await POST(
      asNextRequest('http://localhost/api/admin/spotify-watcher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer startup-system-token',
        },
        body: JSON.stringify({ action: 'tick' }),
      })
    );
    expect(res.status).toBe(401);
  });

  it('organiser A cannot tick as organiser B via body userId', async () => {
    // Mint token from the same auth module instance the route will load after resetModules
    const { generateToken: mint } = await import('@/lib/auth');
    const tokenA = mint({
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      username: 'organiser-a',
      email: 'a@example.com',
      role: 'user',
    });

    const { POST } = await import('@/app/api/admin/spotify-watcher/route');
    const { tickUserPlayback } = await import('@/lib/spotify-sync');

    const res = await POST(
      asNextRequest('http://localhost/api/admin/spotify-watcher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          action: 'tick',
          userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          force: true,
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(tickUserPlayback).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'organiser-a',
      expect.any(Object)
    );
    expect(tickUserPlayback).not.toHaveBeenCalledWith(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      expect.anything(),
      expect.anything()
    );
  });
});

describe('PRD-01: client-error intake', () => {
  it('rejects oversized payloads', () => {
    const huge = JSON.stringify({ message: 'x'.repeat(CLIENT_ERROR_MAX_BODY_BYTES) });
    const parsed = parseClientErrorIntake(huge);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.status).toBe(400);
      expect(parsed.error).toMatch(/too large/i);
    }
  });

  it('rejects unexpected fields and redacts stacks', () => {
    const bad = parseClientErrorIntake(
      JSON.stringify({ message: 'oops', cookie: 'secret' })
    );
    expect(bad.ok).toBe(false);

    const good = parseClientErrorIntake(
      JSON.stringify({
        message: 'boom',
        stack: 'Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb\nError: boom',
        url: 'https://example.com/page?token=abc&ok=1',
      })
    );
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.data.stack).not.toMatch(/eyJ/);
      expect(good.data.stack).toMatch(/\[redacted\]|\[jwt-redacted\]/);
      expect(good.data.route).toMatch(/token=%5Bredacted%5D|token=\[redacted\]/);
      expect(good.data.route).not.toContain('token=abc');
    }
  });

  it('POST /api/support/client-error returns 400 for oversized body', async () => {
    jest.resetModules();
    jest.doMock('@/lib/support/logger', () => ({
      logError: jest.fn(async () => 'err-id'),
    }));
    jest.doMock('@/lib/support/withApiLogging', () => ({
      getIpHash: () => 'ip-hash',
    }));

    const { POST } = await import('@/app/api/support/client-error/route');
    const res = await POST(
      asNextRequest('http://localhost/api/support/client-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(CLIENT_ERROR_MAX_BODY_BYTES + 1),
        },
        body: JSON.stringify({ message: 'x' }),
      })
    );
    expect(res.status).toBe(400);
  });
});

describe('PRD-01: fail-closed secrets', () => {
  const prevPusher = process.env.PUSHER_KEY;
  const prevSalt = process.env.IP_SALT;

  afterEach(() => {
    if (prevPusher === undefined) delete process.env.PUSHER_KEY;
    else process.env.PUSHER_KEY = prevPusher;
    if (prevSalt === undefined) delete process.env.IP_SALT;
    else process.env.IP_SALT = prevSalt;
  });

  it('resolveSecretEnv throws in production for missing/fallback secrets', () => {
    delete process.env.PUSHER_KEY;
    expect(() =>
      resolveSecretEnv('PUSHER_KEY', {
        insecureFallbacks: ['fallback-key'],
        devFallback: 'fallback-key',
        nodeEnv: 'production',
      })
    ).toThrow(/fail-closed/i);

    process.env.PUSHER_KEY = 'fallback-key';
    expect(() =>
      resolveSecretEnv('PUSHER_KEY', {
        insecureFallbacks: ['fallback-key'],
        devFallback: 'fallback-key',
        nodeEnv: 'production',
      })
    ).toThrow(/fail-closed/i);
  });

  it('hashIP throws in production without IP_SALT', () => {
    delete process.env.IP_SALT;
    expect(() => hashIP('1.2.3.4', 'production')).toThrow(/IP_SALT/);
  });

  it('allows dev/test fallbacks outside production', () => {
    delete process.env.PUSHER_KEY;
    expect(
      resolveSecretEnv('PUSHER_KEY', {
        insecureFallbacks: ['fallback-key'],
        devFallback: 'fallback-key',
        nodeEnv: 'test',
      })
    ).toBe('fallback-key');

    delete process.env.IP_SALT;
    expect(hashIP('1.2.3.4', 'test')).toHaveLength(64);
  });
});

describe('PRD-01: token-expired auth gate', () => {
  it('rejects unauthenticated POST', async () => {
    const { POST } = await import('@/app/api/admin/token-expired/route');
    const res = await POST(
      asNextRequest('http://localhost/api/admin/token-expired', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'expired' }),
      })
    );
    expect(res.status).toBe(401);
  });
});
