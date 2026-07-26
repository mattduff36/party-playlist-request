/**
 * PRD-01 production lockdown regression tests.
 * Proves removed routes are gone and remaining surfaces reject unauthorized access.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  CLIENT_ERROR_MAX_BODY_BYTES,
  CLIENT_ERROR_MAX_PER_HOUR,
  isClientErrorRateLimited,
  parseClientErrorIntake,
  resetClientErrorRateLimitForTests,
} from '@/lib/support/client-error-intake';
import { resolveSecretEnv } from '@/lib/security/fail-closed-env';
import { hashIP } from '@/lib/db';
import { getIpHash } from '@/lib/support/withApiLogging';

const repoRoot = path.resolve(process.cwd());

function routeExists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function asNextRequest(url: string, init?: RequestInit): NextRequest {
  // NextRequest's RequestInit differs slightly from the DOM lib (signal: null).
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walkSourceFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
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

  it('does not reference SYSTEM_STARTUP_TOKEN or startup-system-token under src/**', () => {
    const files = walkSourceFiles(path.join(repoRoot, 'src'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text).not.toMatch(/SYSTEM_STARTUP_TOKEN|startup-system-token/);
    }
    const envExample = path.join(repoRoot, '.env.example');
    if (fs.existsSync(envExample)) {
      expect(fs.readFileSync(envExample, 'utf8')).not.toMatch(
        /SYSTEM_STARTUP_TOKEN|startup-system-token/
      );
    }
  });
});

describe('PRD-01: no request-path DDL bootstrap', () => {
  it('API routes never call initializeDefaults / initializeDatabase', () => {
    const apiRoot = path.join(repoRoot, 'src', 'app', 'api');
    const files = walkSourceFiles(apiRoot);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (
        /\binitializeDefaults\s*\(/.test(text) ||
        /\binitializeDatabase\s*\(/.test(text) ||
        /from\s+['"]@\/lib\/db['"][\s\S]*\binitializeDefaults\b/.test(text) ||
        /\binitializeDefaults\b/.test(text) ||
        /\binitializeDatabase\b/.test(text)
      ) {
        // Allow mentioning in comments only if not an identifier import/call —
        // any identifier usage under api/ is forbidden.
        offenders.push(path.relative(repoRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('public request/search handlers do not invoke initializeDefaults at runtime', async () => {
    jest.resetModules();
    const initializeDefaults = jest.fn(async () => {
      throw new Error('initializeDefaults must not be called from request paths');
    });
    jest.doMock('@/lib/db', () => {
      const actual = jest.requireActual('@/lib/db');
      return {
        ...actual,
        initializeDefaults,
        initializeDatabase: jest.fn(async () => {
          throw new Error('initializeDatabase must not be called from request paths');
        }),
      };
    });
    jest.doMock('@/lib/guest-access', () => ({
      requireGuestAccess: jest.fn(async () => ({
        ok: false,
        response: new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      })),
    }));

    const { GET: searchGet } = await import('@/app/api/search/route');
    const searchRes = await searchGet(
      asNextRequest('http://localhost/api/search?q=test&username=demo')
    );
    expect(searchRes.status).toBe(403);
    expect(initializeDefaults).not.toHaveBeenCalled();

    const { GET: spotifySearchGet } = await import('@/app/api/spotify/search/route');
    const spotifyRes = await spotifySearchGet(
      asNextRequest('http://localhost/api/spotify/search?q=test&username=demo')
    );
    expect(spotifyRes.status).toBe(403);
    expect(initializeDefaults).not.toHaveBeenCalled();
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
    jest.doMock('@/lib/db/neon-client', () => ({
      sql: Object.assign(
        jest.fn(async () => [
          {
            id: '11111111-1111-1111-1111-111111111111',
            username: 'organiser-a',
            email: 'a@example.com',
            role: 'user',
            active_session_id: 'sess-organiser',
            account_status: 'active',
            email_verified: true,
          },
        ]),
        { raw: jest.fn() }
      ),
    }));
    const { generateToken: mint } = await import('@/lib/auth');
    const token = mint({
      user_id: '11111111-1111-1111-1111-111111111111',
      username: 'organiser-a',
      email: 'a@example.com',
      role: 'user',
      session_id: 'sess-organiser',
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
    jest.doMock('@/lib/reliability/refresh-playback', () => ({
      refreshPlaybackState: jest.fn(
        async (userId: string, username: string) => ({
          tick: {
            userId,
            username,
            skipped: false,
            broadcast: false,
            isPlaying: false,
          },
          snapshot: {
            fetchedAt: new Date().toISOString(),
            providerStatus: 'healthy',
            stale: false,
            degraded: false,
          },
          redisBackend: 'none',
          debounced: false,
        })
      ),
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
    jest.doMock('@/lib/db/neon-client', () => ({
      sql: Object.assign(
        jest.fn(async () => [
          {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            username: 'organiser-a',
            email: 'a@example.com',
            role: 'user',
            active_session_id: 'sess-a',
            account_status: 'active',
            email_verified: true,
          },
        ]),
        { raw: jest.fn() }
      ),
    }));

    // Mint token from the same auth module instance the route will load after resetModules
    const { generateToken: mint } = await import('@/lib/auth');
    const tokenA = mint({
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      username: 'organiser-a',
      email: 'a@example.com',
      role: 'user',
      session_id: 'sess-a',
    });

    const { POST } = await import('@/app/api/admin/spotify-watcher/route');
    const { refreshPlaybackState } = await import(
      '@/lib/reliability/refresh-playback'
    );

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
    expect(refreshPlaybackState).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'organiser-a',
      expect.any(String),
      expect.any(Object)
    );
    expect(refreshPlaybackState).not.toHaveBeenCalledWith(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });
});

describe('PRD-01: client-error intake', () => {
  beforeEach(() => {
    resetClientErrorRateLimitForTests();
  });

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

  it('shared rate limiter trips after hourly budget', () => {
    const ip = 'rate-limit-test-ip';
    for (let i = 0; i < CLIENT_ERROR_MAX_PER_HOUR; i++) {
      expect(isClientErrorRateLimited(ip)).toBe(false);
    }
    expect(isClientErrorRateLimited(ip)).toBe(true);
  });

  it('POST /api/support/client-error returns 400 for oversized body', async () => {
    jest.resetModules();
    jest.doMock('@/lib/support/logger', () => ({
      logError: jest.fn(async () => 'err-id'),
    }));
    jest.doMock('@/lib/support/withApiLogging', () => ({
      getIpHash: () => 'ip-hash-oversized',
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

  it('POST /api/monitoring/errors rate-limits and rejects oversized bodies', async () => {
    jest.resetModules();
    const sendAlert = jest.fn(async () => undefined);
    jest.doMock('@/lib/support/logger', () => ({
      logError: jest.fn(async () => 'err-id'),
    }));
    jest.doMock('@/lib/support/withApiLogging', () => ({
      getIpHash: () => 'monitoring-errors-ip',
    }));
    jest.doMock('@/lib/monitoring/metrics', () => ({
      metricsCollector: { recordMetric: jest.fn() },
    }));
    jest.doMock('@/lib/monitoring/alerts', () => ({
      alertingSystem: { sendAlert },
    }));

    const { resetClientErrorRateLimitForTests: resetBuckets } = await import(
      '@/lib/support/client-error-intake'
    );
    resetBuckets();
    const { POST } = await import('@/app/api/monitoring/errors/route');

    const oversized = await POST(
      asNextRequest('http://localhost/api/monitoring/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(CLIENT_ERROR_MAX_BODY_BYTES + 1),
        },
        body: JSON.stringify({
          errorId: 'e1',
          message: 'x',
          level: 'fatal',
        }),
      })
    );
    expect(oversized.status).toBe(400);
    expect(sendAlert).not.toHaveBeenCalled();

    // Exhaust shared budget then assert 429 (alerting must not run).
    resetBuckets();
    for (let i = 0; i < CLIENT_ERROR_MAX_PER_HOUR; i++) {
      const ok = await POST(
        asNextRequest('http://localhost/api/monitoring/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            errorId: `e-${i}`,
            message: 'boom',
            level: 'fatal',
          }),
        })
      );
      expect(ok.status).toBe(200);
    }
    const limited = await POST(
      asNextRequest('http://localhost/api/monitoring/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId: 'e-limited',
          message: 'boom',
          level: 'fatal',
        }),
      })
    );
    expect(limited.status).toBe(429);
    expect(sendAlert).toHaveBeenCalledTimes(CLIENT_ERROR_MAX_PER_HOUR);
  });
});

describe('PRD-01: cron spotify-sync fail-closed', () => {
  const prevCron = process.env.CRON_SECRET;
  const prevMock = process.env.SPOTIFY_MOCK;

  afterEach(() => {
    if (prevCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCron;
    if (prevMock === undefined) delete process.env.SPOTIFY_MOCK;
    else process.env.SPOTIFY_MOCK = prevMock;
    jest.resetModules();
    jest.dontMock('@/lib/spotify-sync');
  });

  it('returns 401 when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;
    process.env.SPOTIFY_MOCK = 'false';
    jest.resetModules();
    jest.doMock('@/lib/spotify-sync', () => ({
      tickAllActiveParties: jest.fn(async () => ({
        checked: 0,
        broadcastCount: 0,
      })),
    }));

    const { GET } = await import('@/app/api/cron/spotify-sync/route');
    const res = await GET(
      asNextRequest('http://localhost/api/cron/spotify-sync', {
        headers: { 'x-vercel-cron': '1' },
      })
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong bearer token', async () => {
    process.env.CRON_SECRET = 'correct-cron-secret';
    process.env.SPOTIFY_MOCK = 'false';
    jest.resetModules();
    const tickAllActiveParties = jest.fn(async () => ({
      checked: 0,
      broadcastCount: 0,
    }));
    jest.doMock('@/lib/spotify-sync', () => ({ tickAllActiveParties }));

    const { GET } = await import('@/app/api/cron/spotify-sync/route');
    const res = await GET(
      asNextRequest('http://localhost/api/cron/spotify-sync', {
        headers: { Authorization: 'Bearer wrong-secret' },
      })
    );
    expect(res.status).toBe(401);
    expect(tickAllActiveParties).not.toHaveBeenCalled();
  });

  it('proceeds when Authorization Bearer matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'correct-cron-secret';
    process.env.SPOTIFY_MOCK = 'false';
    jest.resetModules();
    const tickAllActiveParties = jest.fn(async () => ({
      checked: 2,
      broadcastCount: 1,
    }));
    jest.doMock('@/lib/spotify-sync', () => ({ tickAllActiveParties }));

    const { GET } = await import('@/app/api/cron/spotify-sync/route');
    const res = await GET(
      asNextRequest('http://localhost/api/cron/spotify-sync', {
        headers: { Authorization: 'Bearer correct-cron-secret' },
      })
    );
    expect(res.status).toBe(200);
    expect(tickAllActiveParties).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.checked).toBe(2);
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

  it('getIpHash rethrows in production when IP_SALT missing', () => {
    delete process.env.IP_SALT;
    expect(() =>
      getIpHash(
        asNextRequest('http://localhost/', {
          headers: { 'x-forwarded-for': '1.2.3.4' },
        }),
        'production'
      )
    ).toThrow(/IP_SALT/);
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
