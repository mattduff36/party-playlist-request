import {
  formatGuestTrackAlbum,
  formatGuestTrackArtists,
  mapSpotifySearchTrack,
  mapSpotifySearchTracks,
} from '@/lib/spotify-search-track';

describe('mapSpotifySearchTrack', () => {
  it('flattens Spotify album/artists objects into guest strings', () => {
    const mapped = mapSpotifySearchTrack({
      id: 'abc',
      uri: 'spotify:track:abc',
      name: 'Blinding Lights',
      duration_ms: 200000,
      explicit: false,
      artists: [{ name: 'The Weeknd' }, { name: 'Feature' }],
      album: {
        album_type: 'album',
        name: 'After Hours',
        images: [{ url: 'https://example.com/cover.jpg' }],
      },
    });

    expect(mapped).toEqual({
      id: 'abc',
      uri: 'spotify:track:abc',
      name: 'Blinding Lights',
      artists: ['The Weeknd', 'Feature'],
      album: 'After Hours',
      duration_ms: 200000,
      explicit: false,
      preview_url: undefined,
      image: 'https://example.com/cover.jpg',
    });
  });

  it('keeps already-normalized string album/artists', () => {
    const mapped = mapSpotifySearchTrack({
      id: 'xyz',
      uri: 'spotify:track:xyz',
      name: 'Levitating',
      artists: ['Dua Lipa'],
      album: 'Future Nostalgia',
      duration_ms: 203000,
      explicit: false,
    });

    expect(mapped?.album).toBe('Future Nostalgia');
    expect(mapped?.artists).toEqual(['Dua Lipa']);
  });

  it('drops invalid tracks and maps arrays', () => {
    const tracks = mapSpotifySearchTracks([
      null,
      { name: 'Missing URI' },
      {
        id: 'ok',
        uri: 'spotify:track:ok',
        name: 'Ok',
        artists: [{ name: 'Artist' }],
        album: { name: 'Album' },
        duration_ms: 1000,
      },
    ]);

    expect(tracks).toHaveLength(1);
    expect(tracks[0].album).toBe('Album');
    expect(typeof tracks[0].album).toBe('string');
  });

  it('formats artists/album from both legacy and normalized shapes', () => {
    expect(formatGuestTrackArtists([{ name: 'A' }, { name: 'B' }])).toBe('A, B');
    expect(formatGuestTrackArtists(['A', 'B'])).toBe('A, B');
    expect(formatGuestTrackAlbum({ name: 'Album' })).toBe('Album');
    expect(formatGuestTrackAlbum('Album')).toBe('Album');
  });

  it('produces a guest request payload with string album/artists', () => {
    const mapped = mapSpotifySearchTrack({
      id: 'abc',
      uri: 'spotify:track:abc',
      name: 'Song',
      artists: [{ name: 'Artist' }],
      album: {
        album_type: 'album',
        artists: [],
        available_markets: [],
        external_urls: {},
        href: '',
        id: 'alb',
        images: [],
        name: 'Album Object',
        release_date: '2020',
        release_date_precision: 'day',
        total_tracks: 1,
        type: 'album',
        uri: 'spotify:album:alb',
      },
      duration_ms: 1000,
    });

    expect(mapped).not.toBeNull();
    expect(typeof mapped!.album).toBe('string');
    expect(mapped!.album).toBe('Album Object');
    expect(mapped!.artists.every((name) => typeof name === 'string')).toBe(true);
  });
});
