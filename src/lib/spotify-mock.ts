/**
 * Spotify mock mode for automated tests / finalise full.
 * Enabled only when SPOTIFY_MOCK=true (never implied for normal dev/prod).
 */

export function isSpotifyMockEnabled(): boolean {
  return process.env.SPOTIFY_MOCK === 'true';
}

export const SPOTIFY_MOCK_PLAYBACK = {
  is_playing: true,
  progress_ms: 45000,
  item: {
    id: '0VjIjW4GlUZAMYd2vXMi3b',
    name: 'Blinding Lights',
    uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
    duration_ms: 200000,
    artists: [{ name: 'The Weeknd', id: '1Xyo4u8uXC1ZmMpatF05PJ' }],
    album: {
      name: 'After Hours',
      images: [
        {
          url: 'https://i.scdn.co/image/ab67616d0000b273cover1',
          height: 640,
          width: 640,
        },
      ],
    },
  },
  device: {
    id: 'device123',
    name: 'Test Device',
    type: 'Computer',
    volume_percent: 75,
  },
};

export const SPOTIFY_MOCK_QUEUE = {
  currently_playing: SPOTIFY_MOCK_PLAYBACK.item,
  queue: [
    {
      id: '3PfIrDoz19wz7qK7tYeu62',
      name: 'Levitating',
      uri: 'spotify:track:3PfIrDoz19wz7qK7tYeu62',
      duration_ms: 203000,
      artists: [{ name: 'Dua Lipa' }],
      album: {
        name: 'Future Nostalgia',
        images: [{ url: 'https://i.scdn.co/image/cover2' }],
      },
    },
    {
      id: '5QO79kh1waicV47BqGRL3g',
      name: 'Save Your Tears',
      uri: 'spotify:track:5QO79kh1waicV47BqGRL3g',
      duration_ms: 215000,
      artists: [{ name: 'The Weeknd' }],
      album: {
        name: 'After Hours',
        images: [{ url: 'https://i.scdn.co/image/cover1' }],
      },
    },
  ],
};

export const SPOTIFY_MOCK_DEVICES = {
  devices: [
    {
      id: 'device123',
      name: 'Test Device 1',
      type: 'Computer',
      is_active: true,
      volume_percent: 75,
    },
    {
      id: 'device456',
      name: 'Test Device 2',
      type: 'Smartphone',
      is_active: false,
      volume_percent: 50,
    },
  ],
};

export function getMockSearchResults(query: string, limit = 10) {
  const items = [
    {
      id: '0VjIjW4GlUZAMYd2vXMi3b',
      name: 'Blinding Lights',
      uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
      duration_ms: 200000,
      explicit: false,
      artists: [{ name: 'The Weeknd' }],
      album: {
        name: 'After Hours',
        images: [{ url: 'https://i.scdn.co/image/cover1' }],
      },
      external_urls: { spotify: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b' },
    },
    {
      id: '3PfIrDoz19wz7qK7tYeu62',
      name: 'Levitating',
      uri: 'spotify:track:3PfIrDoz19wz7qK7tYeu62',
      duration_ms: 203000,
      explicit: false,
      artists: [{ name: 'Dua Lipa' }],
      album: {
        name: 'Future Nostalgia',
        images: [{ url: 'https://i.scdn.co/image/cover2' }],
      },
      external_urls: { spotify: 'https://open.spotify.com/track/3PfIrDoz19wz7qK7tYeu62' },
    },
  ].filter((t) =>
    !query.trim()
      ? true
      : `${t.name} ${t.artists.map((a) => a.name).join(' ')}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()) || query.trim().length < 2
  );

  // Always return at least the first track so short/random queries still work in e2e
  const resolved = items.length > 0 ? items : [
    {
      id: '0VjIjW4GlUZAMYd2vXMi3b',
      name: 'Blinding Lights',
      uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
      duration_ms: 200000,
      explicit: false,
      artists: [{ name: 'The Weeknd' }],
      album: {
        name: 'After Hours',
        images: [{ url: 'https://i.scdn.co/image/cover1' }],
      },
      external_urls: { spotify: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b' },
    },
  ];

  return {
    tracks: {
      items: resolved.slice(0, Math.min(limit, 10)),
    },
  };
}

export function getMockTrack(trackId: string) {
  const fromSearch = getMockSearchResults('').tracks.items.find((t) => t.id === trackId);
  if (fromSearch) return fromSearch;
  return {
    id: trackId,
    name: 'Mock Track',
    uri: `spotify:track:${trackId}`,
    duration_ms: 180000,
    explicit: false,
    artists: [{ name: 'Mock Artist' }],
    album: {
      name: 'Mock Album',
      images: [{ url: 'https://i.scdn.co/image/mock' }],
    },
    external_urls: { spotify: `https://open.spotify.com/track/${trackId}` },
  };
}
