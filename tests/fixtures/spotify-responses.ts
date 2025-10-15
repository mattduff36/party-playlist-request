/**
 * Mocked Spotify API Responses
 */

export const SPOTIFY_MOCK_RESPONSES = {
  // Current playback
  playback: {
    is_playing: true,
    progress_ms: 45000,
    item: {
      id: '0VjIjW4GlUZAMYd2vXMi3b',
      name: 'Blinding Lights',
      uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
      duration_ms: 200000,
      artists: [
        {
          name: 'The Weeknd',
          id: '1Xyo4u8uXC1ZmMpatF05PJ',
        },
      ],
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
  },
  
  // Queue
  queue: {
    currently_playing: {
      name: 'Blinding Lights',
      uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
    },
    queue: [
      {
        name: 'Levitating',
        uri: 'spotify:track:3PfIrDoz19wz7qK7tYeu62',
        artists: [{ name: 'Dua Lipa' }],
      },
      {
        name: 'Save Your Tears',
        uri: 'spotify:track:5QO79kh1waicV47BqGRL3g',
        artists: [{ name: 'The Weeknd' }],
      },
    ],
  },
  
  // Devices
  devices: {
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
  },
  
  // Search results
  search: {
    tracks: {
      items: [
        {
          id: '0VjIjW4GlUZAMYd2vXMi3b',
          name: 'Blinding Lights',
          uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
          duration_ms: 200000,
          artists: [{ name: 'The Weeknd' }],
          album: {
            name: 'After Hours',
            images: [{ url: 'https://i.scdn.co/image/cover1' }],
          },
        },
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
      ],
    },
  },
  
  // Token response
  token: {
    access_token: 'mock_access_token',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'mock_refresh_token',
    scope: 'user-read-playback-state user-modify-playback-state',
  },
};


