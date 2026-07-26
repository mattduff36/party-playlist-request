/**
 * Playlist cache multi-tenant isolation unit tests
 */

import {
  buildPlaylistCacheKey,
  getCachedPlaylists,
  invalidatePlaylistCacheForUser,
  resetPlaylistCacheForTests,
  setCachedPlaylists,
} from '@/lib/playlist-cache';

describe('playlist-cache', () => {
  beforeEach(() => {
    resetPlaylistCacheForTests();
  });

  it('builds a user-scoped key including Spotify account id', () => {
    expect(buildPlaylistCacheKey('user-a', 'spotify-1')).toBe(
      'playlists|user-a|spotify-1'
    );
    expect(buildPlaylistCacheKey('user-b', 'spotify-2')).toBe(
      'playlists|user-b|spotify-2'
    );
  });

  it('rejects empty userId in cache key', () => {
    expect(() => buildPlaylistCacheKey('', 'spotify-1')).toThrow(/userId/i);
    expect(() => buildPlaylistCacheKey('   ', 'spotify-1')).toThrow(/userId/i);
  });

  it('does not leak cached playlists across different userIds', () => {
    const keyA = buildPlaylistCacheKey('user-a', 'sp-1');
    const keyB = buildPlaylistCacheKey('user-b', 'sp-2');
    setCachedPlaylists(keyA, { playlists: [{ id: 'a1', name: 'A only' }] });
    setCachedPlaylists(keyB, { playlists: [{ id: 'b1', name: 'B only' }] });

    expect(getCachedPlaylists<{ playlists: { id: string }[] }>(keyA)?.playlists[0].id).toBe(
      'a1'
    );
    expect(getCachedPlaylists<{ playlists: { id: string }[] }>(keyB)?.playlists[0].id).toBe(
      'b1'
    );
    expect(keyA).not.toBe(keyB);
  });

  it('isolates same Spotify account id under different app users', () => {
    const keyA = buildPlaylistCacheKey('user-a', 'shared-spotify');
    const keyB = buildPlaylistCacheKey('user-b', 'shared-spotify');
    setCachedPlaylists(keyA, { playlists: [{ name: 'Tenant A view' }] });
    setCachedPlaylists(keyB, { playlists: [{ name: 'Tenant B view' }] });

    expect(
      getCachedPlaylists<{ playlists: { name: string }[] }>(keyA)?.playlists[0].name
    ).toBe('Tenant A view');
    expect(
      getCachedPlaylists<{ playlists: { name: string }[] }>(keyB)?.playlists[0].name
    ).toBe('Tenant B view');
  });

  it('invalidates all cache entries for one user without touching others', () => {
    const keyA1 = buildPlaylistCacheKey('user-a', 'sp-1');
    const keyA2 = buildPlaylistCacheKey('user-a', 'sp-2');
    const keyB = buildPlaylistCacheKey('user-b', 'sp-9');
    setCachedPlaylists(keyA1, { playlists: [1] });
    setCachedPlaylists(keyA2, { playlists: [2] });
    setCachedPlaylists(keyB, { playlists: [3] });

    invalidatePlaylistCacheForUser('user-a');

    expect(getCachedPlaylists(keyA1)).toBeNull();
    expect(getCachedPlaylists(keyA2)).toBeNull();
    expect(getCachedPlaylists(keyB)).toEqual({ playlists: [3] });
  });

  it('expires entries after TTL', () => {
    jest.useFakeTimers();
    const key = buildPlaylistCacheKey('user-a', 'sp-1');
    setCachedPlaylists(key, { playlists: [] }, 60_000);
    jest.advanceTimersByTime(60_001);
    expect(getCachedPlaylists(key)).toBeNull();
    jest.useRealTimers();
  });
});
