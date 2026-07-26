/**
 * Interactive demo mode (PRD-08) — mock tracks, no real Spotify auth.
 * Distinct from SPOTIFY_MOCK test harness and from Manual event mode.
 */

export interface DemoTrack {
  id: string;
  title: string;
  artists: string;
  album: string;
  duration_ms: number;
  album_image_url: string | null;
}

const DEMO_TRACKS: DemoTrack[] = [
  {
    id: 'demo-track-1',
    title: 'Midnight Dancefloor',
    artists: 'Demo Artists',
    album: 'PartyPlaylist Demo',
    duration_ms: 210000,
    album_image_url: null,
  },
  {
    id: 'demo-track-2',
    title: 'Neon Lights',
    artists: 'Sample Band',
    album: 'PartyPlaylist Demo',
    duration_ms: 198000,
    album_image_url: null,
  },
  {
    id: 'demo-track-3',
    title: 'Celebration Anthem',
    artists: 'Fixture Voices',
    album: 'PartyPlaylist Demo',
    duration_ms: 224000,
    album_image_url: null,
  },
  {
    id: 'demo-track-4',
    title: 'Slow Burn',
    artists: 'Mock Ensemble',
    album: 'PartyPlaylist Demo',
    duration_ms: 245000,
    album_image_url: null,
  },
  {
    id: 'demo-track-5',
    title: 'Last Call Groove',
    artists: 'Demo Collective',
    album: 'PartyPlaylist Demo',
    duration_ms: 232000,
    album_image_url: null,
  },
];

export function isDemoModeEnabled(settings: {
  demo_mode?: boolean | null;
}): boolean {
  return Boolean(settings.demo_mode);
}

export function searchDemoTracks(query: string): DemoTrack[] {
  const q = query.trim().toLowerCase();
  if (!q) return DEMO_TRACKS.slice(0, 5);
  return DEMO_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artists.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
  );
}

export function getDemoTrack(id: string): DemoTrack | null {
  return DEMO_TRACKS.find((t) => t.id === id) ?? null;
}

/**
 * Demo mode must never read or write production Spotify credentials.
 * Call sites should short-circuit Spotify OAuth / token vault when demo is on.
 */
export function assertDemoDoesNotTouchSpotify(operation: string): void {
  const blocked = [
    'spotify_oauth',
    'spotify_token_read',
    'spotify_token_write',
    'spotify_refresh',
  ];
  if (blocked.includes(operation)) {
    throw new Error(
      `DEMO_MODE_BLOCKED: ${operation} is not allowed while demo mode is active`
    );
  }
}
