/**
 * PRD-04: tenant / guest / display / realtime isolation security matrix.
 */

import {
  parseChannelName,
  assertSafePusherPayload,
  getGuestEventChannel,
  getDisplayEventChannel,
  getCanonicalAdminChannel,
  getEventRealtimePublishChannels,
  getLegacyPublicEventChannel,
} from '@/lib/pusher/channel-contract';
import { getEventChannel } from '@/lib/pusher/events';
import {
  hmacAccessCode,
  hashOpaqueToken,
  dualVerifySecret,
  timingSafeEqualHex,
} from '@/lib/crypto/secret-hashes';
import { POST as pusherAuth } from '@/app/api/pusher/auth/route';
import { GET as usersLookup } from '@/app/api/users/lookup/route';
import { NextRequest } from 'next/server';

jest.mock('@/middleware/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/event-access-policy', () => {
  const actual = jest.requireActual('@/lib/event-access-policy');
  return {
    ...actual,
    proveGuestForEvent: jest.fn(),
    proveGuestForUserChannel: jest.fn(),
    proveDisplayForEvent: jest.fn(),
  };
});

jest.mock('@/lib/security/fail-closed-env', () => ({
  resolveSecretEnv: (name: string) => `test-${name}`,
  isProductionRuntime: () => false,
}));

jest.mock('pusher', () => {
  return jest.fn().mockImplementation(() => ({
    authorizeChannel: jest.fn((_socket: string, channel: string, presence?: unknown) => ({
      auth: `test-auth:${channel}`,
      channel_data: presence ? JSON.stringify(presence) : undefined,
    })),
  }));
});

const { requireAuth } = jest.requireMock('@/middleware/auth') as {
  requireAuth: jest.Mock;
};
const {
  proveGuestForEvent,
  proveGuestForUserChannel,
  proveDisplayForEvent,
} = jest.requireMock('@/lib/event-access-policy') as {
  proveGuestForEvent: jest.Mock;
  proveGuestForUserChannel: jest.Mock;
  proveDisplayForEvent: jest.Mock;
};

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const EVENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function pusherAuthRequest(channelName: string): NextRequest {
  const body = new URLSearchParams({
    socket_id: '1.2',
    channel_name: channelName,
  }).toString();
  return new NextRequest('http://localhost:3000/api/pusher/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

describe('PRD-04: channel contract', () => {
  it('parses canonical and legacy admin channels', () => {
    expect(parseChannelName(getCanonicalAdminChannel(USER_A)).kind).toBe('admin');
    expect(parseChannelName(`private-admin-updates-${USER_A}`).kind).toBe('admin');
    expect(parseChannelName(`private-party-playlist-${USER_A}`).kind).toBe(
      'guest_legacy_user'
    );
    expect(parseChannelName(getGuestEventChannel(EVENT_A)).kind).toBe('guest_event');
    expect(parseChannelName(getDisplayEventChannel(EVENT_A)).kind).toBe(
      'display_event'
    );
  });

  it('rejects unknown / malformed channel names', () => {
    expect(parseChannelName('private-evil-channel').kind).toBe('unknown');
    expect(parseChannelName(`private-user-not-a-uuid-admin`).kind).toBe('unknown');
    expect(parseChannelName(`event-${EVENT_A}`).kind).toBe('unknown');
  });

  it('production publish targets exclude public event-{id}', () => {
    const channels = getEventRealtimePublishChannels(EVENT_A);
    expect(channels).toEqual([
      getGuestEventChannel(EVENT_A),
      getDisplayEventChannel(EVENT_A),
    ]);
    expect(channels).not.toContain(getLegacyPublicEventChannel(EVENT_A));
    expect(channels.every((c) => c.startsWith('private-'))).toBe(true);
    // Client helper must not point at retired public channel
    expect(getEventChannel(EVENT_A)).toBe(getGuestEventChannel(EVENT_A));
    expect(getEventChannel(EVENT_A)).not.toBe(getLegacyPublicEventChannel(EVENT_A));
  });
});

describe('PRD-04: Pusher auth ownership matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuth.mockResolvedValue({ authenticated: false, user: null });
    proveGuestForEvent.mockResolvedValue(null);
    proveGuestForUserChannel.mockResolvedValue(null);
    proveDisplayForEvent.mockResolvedValue(null);
  });

  it('denies organiser A on organiser B admin channel', async () => {
    requireAuth.mockResolvedValue({
      authenticated: true,
      user: { user_id: USER_A, username: 'a', role: 'user' },
    });
    const res = await pusherAuth(
      pusherAuthRequest(`private-admin-updates-${USER_B}`)
    );
    expect(res.status).toBe(403);
  });

  it('allows organiser A on own admin channel', async () => {
    requireAuth.mockResolvedValue({
      authenticated: true,
      user: { user_id: USER_A, username: 'a', role: 'user' },
    });
    const res = await pusherAuth(
      pusherAuthRequest(`private-admin-updates-${USER_A}`)
    );
    expect(res.status).toBe(200);
  });

  it('denies guest cookie on admin channel', async () => {
    proveGuestForUserChannel.mockResolvedValue({
      id: EVENT_A,
      user_id: USER_A,
    });
    const res = await pusherAuth(
      pusherAuthRequest(`private-admin-updates-${USER_A}`)
    );
    expect(res.status).toBe(401);
  });

  it('denies guest A on event B guest channel', async () => {
    proveGuestForEvent.mockResolvedValue(null);
    const res = await pusherAuth(
      pusherAuthRequest(getGuestEventChannel(EVENT_B))
    );
    expect(res.status).toBe(401);
  });

  it('allows guest A on event A guest channel', async () => {
    proveGuestForEvent.mockResolvedValue({ id: EVENT_A, user_id: USER_A });
    const res = await pusherAuth(
      pusherAuthRequest(getGuestEventChannel(EVENT_A))
    );
    expect(res.status).toBe(200);
  });

  it('denies guest cookie on display channel', async () => {
    proveGuestForEvent.mockResolvedValue({ id: EVENT_A, user_id: USER_A });
    proveDisplayForEvent.mockResolvedValue(null);
    const res = await pusherAuth(
      pusherAuthRequest(getDisplayEventChannel(EVENT_A))
    );
    expect(res.status).toBe(401);
  });

  it('allows display proof on display channel only', async () => {
    proveDisplayForEvent.mockResolvedValue({ id: EVENT_A, user_id: USER_A });
    const res = await pusherAuth(
      pusherAuthRequest(getDisplayEventChannel(EVENT_A))
    );
    expect(res.status).toBe(200);
  });

  it('rejects unknown private channel patterns', async () => {
    const res = await pusherAuth(pusherAuthRequest('private-anything-goes'));
    expect(res.status).toBe(403);
  });

  it('rejects presence-* without proof (403, no anonymous authorize)', async () => {
    const res = await pusherAuth(pusherAuthRequest('presence-room-1'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/presence/i);
  });

  it('denies guest proof on display channel even when guest event matches', async () => {
    proveGuestForEvent.mockResolvedValue({ id: EVENT_A, user_id: USER_A });
    proveDisplayForEvent.mockResolvedValue(null);
    const res = await pusherAuth(
      pusherAuthRequest(getDisplayEventChannel(EVENT_A))
    );
    expect(res.status).toBe(401);
  });

  it('denies guest proof on canonical admin channel', async () => {
    proveGuestForEvent.mockResolvedValue({ id: EVENT_A, user_id: USER_A });
    proveGuestForUserChannel.mockResolvedValue({
      id: EVENT_A,
      user_id: USER_A,
    });
    const res = await pusherAuth(
      pusherAuthRequest(getCanonicalAdminChannel(USER_A))
    );
    expect(res.status).toBe(401);
  });
});

describe('PRD-04: users/lookup retired', () => {
  it('returns 410 without disclosing UUID', async () => {
    const res = await usersLookup();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.userId).toBeUndefined();
    expect(body.code).toBe('USER_LOOKUP_RETIRED');
  });
});

describe('PRD-04: secret hashing dual-verify', () => {
  const prevJwt = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-prd04-hmac-checks!!';
  });

  afterAll(() => {
    if (prevJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevJwt;
  });

  it('HMAC access codes verify constant-time and reject wrong codes', () => {
    const code = '123456';
    const hmac = hmacAccessCode(code);
    expect(timingSafeEqualHex(hmac, hmacAccessCode(code))).toBe(true);
    expect(
      dualVerifySecret({
        presented: code,
        storedHash: hmac,
        storedPlaintext: null,
        hashFn: hmacAccessCode,
      })
    ).toBe(true);
    expect(
      dualVerifySecret({
        presented: '654321',
        storedHash: hmac,
        storedPlaintext: null,
        hashFn: hmacAccessCode,
      })
    ).toBe(false);
  });

  it('opaque token hash cannot be used as bearer (hash ≠ plaintext)', () => {
    const token = 'dt_' + 'ab'.repeat(29);
    const hashed = hashOpaqueToken(token);
    expect(hashed).not.toBe(token);
    expect(
      dualVerifySecret({
        presented: hashed,
        storedHash: hashed,
        storedPlaintext: null,
        hashFn: hashOpaqueToken,
      })
    ).toBe(false);
    expect(
      dualVerifySecret({
        presented: token,
        storedHash: hashed,
        storedPlaintext: null,
        hashFn: hashOpaqueToken,
      })
    ).toBe(true);
  });

  it('falls back to plaintext when hash missing (expand-and-contract)', () => {
    expect(
      dualVerifySecret({
        presented: '123456',
        storedHash: null,
        storedPlaintext: '123456',
        hashFn: hmacAccessCode,
      })
    ).toBe(true);
  });
});

describe('PRD-04: repository tenant requirements (source)', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const dbSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/db.ts'),
    'utf8'
  );

  it('getRequest / updateRequest require userId', () => {
    expect(dbSrc).toMatch(
      /export async function getRequest\(id: string, userId: string\)/
    );
    expect(dbSrc).toMatch(
      /export async function updateRequest\(\s*id: string,\s*updates: Partial<Request>,\s*userId: string/
    );
    expect(dbSrc).toContain('REQUEST_UPDATE_ALLOWLIST');
    expect(dbSrc).toContain('Arbitrary update columns are not permitted');
  });

  it('getRequestsByStatusOld requires userId and scopes by user_id', () => {
    expect(dbSrc).toContain(
      'user_id is required for multi-tenant data isolation'
    );
    expect(dbSrc).toContain(
      'SELECT * FROM requests WHERE status = $1 AND user_id = $2'
    );
  });

  it('broadcaster production path does not dual-publish public event-{id}', () => {
    const broadcasterSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/pusher/broadcaster.ts'),
      'utf8'
    );
    expect(broadcasterSrc).toContain('getEventRealtimePublishChannels');
    expect(broadcasterSrc).not.toContain('getLegacyPublicEventChannel');
    expect(broadcasterSrc).not.toMatch(/event-\$\{eventId\}/);
  });

  it('getRequestsByUserId filters by user_id', () => {
    expect(dbSrc).toContain(
      'SELECT * FROM requests WHERE user_id = $1 AND status = $2'
    );
  });

  it('display token consume uses atomic UPDATE … RETURNING', () => {
    const eventSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/event-service.ts'),
      'utf8'
    );
    expect(eventSrc).toContain('uses_remaining = uses_remaining - 1');
    expect(eventSrc).toContain('RETURNING');
    expect(eventSrc).toContain('uses_remaining > 0');
  });

  it('Class B migration does not drop plaintext columns', () => {
    const mig = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/lib/db/migrations/add_prd04_token_hash_columns.sql'
      ),
      'utf8'
    );
    expect(mig).toMatch(/ADD COLUMN IF NOT EXISTS access_code_hmac/);
    expect(mig).toMatch(/ADD COLUMN IF NOT EXISTS token_hash/);
    expect(mig).not.toMatch(/DROP COLUMN/i);
  });
});

describe('PRD-04: realtime payload hygiene', () => {
  it('flags banned sensitive fields', () => {
    const banned = assertSafePusherPayload({
      id: 'r1',
      track_name: 'Song',
      email: 'x@y.com',
      accessCode: '123456',
      requester_ip_hash: 'abc',
    });
    expect(banned).toEqual(
      expect.arrayContaining(['email', 'accessCode', 'requester_ip_hash'])
    );
  });
});
