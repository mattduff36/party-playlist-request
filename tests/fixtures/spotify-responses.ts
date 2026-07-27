/**
 * Re-export mock Spotify payloads used by unit/API helpers.
 * Runtime mock data lives in src/lib/spotify-mock.ts (SPOTIFY_MOCK=true).
 */

import {
  SPOTIFY_MOCK_PLAYBACK as playback,
  SPOTIFY_MOCK_QUEUE as queue,
  SPOTIFY_MOCK_DEVICES as devices,
  getMockSearchResults,
  getMockTrack,
} from '@/lib/spotify-mock';

export {
  playback,
  queue,
  devices,
  getMockSearchResults,
  getMockTrack,
};

export const SPOTIFY_MOCK_RESPONSES = {
  devices,
  playback: {
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
        images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273cover1' }],
      },
    },
    device: {
      id: 'device123',
      name: 'Test Device',
      type: 'Computer',
      volume_percent: 75,
    },
  },
  queue: {
    currently_playing: {
      name: 'Blinding Lights',
      uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
    },
    queue: [
      { name: 'Levitating', uri: 'spotify:track:3PfIrDoz19wz7qK7tYeu62', artists: [{ name: 'Dua Lipa' }] },
      { name: 'Save Your Tears', uri: 'spotify:track:5QO79kh1waicV47BqGRL3g', artists: [{ name: 'The Weeknd' }] },
    ],
  },
  search: {
    tracks: {
      items: [
        {
          id: '0VjIjW4GlUZAMYd2vXMi3b',
          name: 'Blinding Lights',
          uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
          duration_ms: 200000,
          artists: [{ name: 'The Weeknd' }],
          album: { name: 'After Hours', images: [{ url: 'https://i.scdn.co/image/cover1' }] },
        },
      ],
    },
  },
  token: {
    access_token: 'mock_access_token',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'mock_refresh_token',
    scope: 'user-read-playback-state user-modify-playback-state',
  },
};
