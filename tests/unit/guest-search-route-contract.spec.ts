/**
 * Contract: guest search endpoints return flat album/artists strings
 * (React cannot render Spotify album objects — error #31).
 */

import { NextRequest } from 'next/server';
import { getMockSearchResults } from '@/lib/spotify-mock';
import { resetSearchCacheForTests } from '@/lib/search-cache';

jest.mock('@/lib/guest-access', () => ({
  requireGuestAccess: jest.fn(async () => ({
    ok: true,
    event: { id: 'event-1', user_id: 'user-1' },
    user: { id: 'user-1', username: 'demo' },
  })),
}));

jest.mock('@/lib/reliability', () => ({
  enforceGuestRateLimit: jest.fn(async () => ({ allowed: true })),
  ensureGuestDeviceCookie: jest.fn(),
  resolveGuestDeviceId: jest.fn(() => ({ deviceId: 'device-1', minted: false })),
}));

jest.mock('@/lib/db', () => ({
  hashIP: jest.fn(() => 'hashed-ip'),
  getPool: jest.fn(() => ({
    query: jest.fn(async () => ({ rows: [{ id: 'user-1' }] })),
  })),
}));

jest.mock('@/lib/spotify', () => ({
  spotifyService: {
    searchTracks: jest.fn(async (query: string, limit: number) =>
      getMockSearchResults(query, limit)
    ),
    getAccessToken: jest.fn(async () => 'mock-token'),
  },
}));

function asNextRequest(url: string): NextRequest {
  return new NextRequest(url);
}

function expectGuestTrackShape(track: {
  album?: unknown;
  artists?: unknown;
  image?: unknown;
  name?: unknown;
  uri?: unknown;
}) {
  expect(typeof track.name).toBe('string');
  expect(typeof track.uri).toBe('string');
  expect(typeof track.album).toBe('string');
  expect(Array.isArray(track.artists)).toBe(true);
  expect(track.artists!.length).toBeGreaterThan(0);
  expect(typeof (track.artists as unknown[])[0]).toBe('string');
  expect(typeof track.image === 'string' || track.image === undefined).toBe(true);
}

describe('guest search route contracts', () => {
  const prevMock = process.env.SPOTIFY_MOCK;

  beforeEach(() => {
    resetSearchCacheForTests();
    process.env.SPOTIFY_MOCK = 'true';
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (prevMock === undefined) delete process.env.SPOTIFY_MOCK;
    else process.env.SPOTIFY_MOCK = prevMock;
  });

  it('GET /api/spotify/search returns normalized tracks', async () => {
    const { GET } = await import('@/app/api/spotify/search/route');
    const res = await GET(
      asNextRequest(
        'http://localhost/api/spotify/search?q=Blinding&username=demo&accessCode=123456'
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tracks)).toBe(true);
    expect(body.tracks.length).toBeGreaterThan(0);
    expectGuestTrackShape(body.tracks[0]);
  });

  it('GET /api/search returns normalized tracks', async () => {
    const { GET } = await import('@/app/api/search/route');
    const res = await GET(
      asNextRequest(
        'http://localhost/api/search?q=Blinding&username=demo&accessCode=123456'
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tracks)).toBe(true);
    expect(body.tracks.length).toBeGreaterThan(0);
    expectGuestTrackShape(body.tracks[0]);
  });
});
