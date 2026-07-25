/**
 * Spotify mock mode unit tests
 */

import { spotifyService } from '@/lib/spotify';
import { isSpotifyMockEnabled } from '@/lib/spotify-mock';

describe('SPOTIFY_MOCK mode', () => {
  const prev = process.env.SPOTIFY_MOCK;

  beforeAll(() => {
    process.env.SPOTIFY_MOCK = 'true';
  });

  afterAll(() => {
    process.env.SPOTIFY_MOCK = prev;
  });

  it('reports mock enabled', () => {
    expect(isSpotifyMockEnabled()).toBe(true);
  });

  it('reports connected without real tokens', async () => {
    expect(await spotifyService.isConnected('any-user')).toBe(true);
    expect(await spotifyService.isConnectedAndValid('any-user')).toBe(true);
  });

  it('returns mock playback and queue', async () => {
    const playback = await spotifyService.getCurrentPlayback('u1');
    expect(playback?.item?.name).toBe('Blinding Lights');
    const queue = await spotifyService.getQueue('u1');
    expect(queue?.queue?.length).toBeGreaterThan(0);
  });

  it('returns mock search results', async () => {
    const result = await spotifyService.searchTracks('Blinding', 5, 'u1');
    expect(result.tracks.items.length).toBeGreaterThan(0);
    expect(result.tracks.items[0].name).toMatch(/Blinding/i);
  });

  it('addToQueue is a no-op success', async () => {
    await expect(
      spotifyService.addToQueue('spotify:track:0VjIjW4GlUZAMYd2vXMi3b', undefined, 'u1')
    ).resolves.toBeNull();
  });
});
