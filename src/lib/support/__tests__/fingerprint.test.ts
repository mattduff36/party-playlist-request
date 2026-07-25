import {
  buildErrorFingerprint,
  classifySupportError,
  normalizeErrorMessage,
  normalizeErrorRoute,
} from '@/lib/support/fingerprint';

describe('support fingerprint helpers', () => {
  it('normalizes UUIDs, timestamps, and playlist offsets in messages', () => {
    const raw =
      'Spotify API 429 on GET /me/playlists?limit=50&offset=50 at 2026-07-25T15:30:48.787Z id=15b6e434-29b3-4f20-b48d-b9d68eac6e4d';
    const normalized = normalizeErrorMessage(raw);
    expect(normalized).toContain('<UUID>');
    expect(normalized).toContain('offset=<N>');
    expect(normalized).toContain('limit=<N>');
    expect(normalized).not.toContain('15b6e434');
  });

  it('builds the same fingerprint for near-identical Spotify 429s', () => {
    const a = buildErrorFingerprint({
      source: 'spotify',
      message: 'Spotify API 429 on GET /me/player/devices',
      route: '/me/player/devices',
      method: 'GET',
      meta: { status: 429, throttled: true },
    });
    const b = buildErrorFingerprint({
      source: 'spotify',
      message: 'Spotify API 429 on GET /me/player/devices',
      route: '/me/player/devices',
      method: 'GET',
      meta: { status: 429, expected: true },
    });
    expect(a).toBe(b);
  });

  it('classifies rate limits and auth failures as handled', () => {
    expect(
      classifySupportError({
        source: 'spotify',
        message: 'Spotify API 429 on GET /me/player',
        meta: { status: 429 },
      })
    ).toBe('handled');

    expect(
      classifySupportError({
        source: 'api',
        message: 'No token provided',
      })
    ).toBe('handled');
  });

  it('classifies unknown crashes as unhandled', () => {
    expect(
      classifySupportError({
        source: 'client',
        message: 'Cannot read properties of undefined (reading map)',
      })
    ).toBe('unhandled');
  });

  it('normalizes dynamic route segments', () => {
    expect(
      normalizeErrorRoute('/admin/approve/15b6e434-29b3-4f20-b48d-b9d68eac6e4d')
    ).toBe('/admin/approve/<ID>');
  });
});
