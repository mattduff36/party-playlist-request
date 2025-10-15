/**
 * Test Song Request Fixtures
 */

import { faker } from '@faker-js/faker';

export const TEST_TRACKS = [
  {
    uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
    name: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273cover1',
  },
  {
    uri: 'spotify:track:3PfIrDoz19wz7qK7tYeu62',
    name: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273cover2',
  },
  {
    uri: 'spotify:track:5QO79kh1waicV47BqGRL3g',
    name: 'Save Your Tears',
    artist: 'The Weeknd',
    album: 'After Hours',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273cover3',
  },
  {
    uri: 'spotify:track:4iJyoBOLtHqaGxP12qzhQI',
    name: 'Peaches',
    artist: 'Justin Bieber',
    album: 'Justice',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273cover4',
  },
  {
    uri: 'spotify:track:4ZtFanR9U6ndgddUvNcjcG',
    name: 'Good 4 U',
    artist: 'Olivia Rodrigo',
    album: 'SOUR',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273cover5',
  },
];

export function generateTestRequest(overrides?: Partial<typeof TEST_TRACKS[0]>) {
  const baseTrack = faker.helpers.arrayElement(TEST_TRACKS);
  
  return {
    track_uri: overrides?.uri || baseTrack.uri,
    track_name: overrides?.name || baseTrack.name,
    artist_name: overrides?.artist || baseTrack.artist,
    album_name: overrides?.album || baseTrack.album,
    album_image_url: overrides?.imageUrl || baseTrack.imageUrl,
    requester_nickname: faker.person.firstName(),
    status: faker.helpers.arrayElement(['pending', 'approved', 'rejected', 'played']),
  };
}


