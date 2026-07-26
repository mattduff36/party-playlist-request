/**
 * Interactive demo mode (PRD-08) — mock tracks, no real Spotify auth.
 * Distinct from SPOTIFY_MOCK test harness and from Manual event mode.
 */

export type DemoBlockedSpotifyOperation =
  | 'spotify_oauth'
  | 'spotify_token_read'
  | 'spotify_token_write'
  | 'spotify_refresh'
  | 'spotify_disconnect';

const BLOCKED_SPOTIFY_OPS: ReadonlySet<string> = new Set([
  'spotify_oauth',
  'spotify_token_read',
  'spotify_token_write',
  'spotify_refresh',
  'spotify_disconnect',
]);

export class DemoModeBlockedError extends Error {
  readonly operation: string;
  readonly code = 'DEMO_MODE_BLOCKED' as const;

  constructor(operation: string) {
    super(
      `DEMO_MODE_BLOCKED: ${operation} is not allowed while demo mode is active`
    );
    this.name = 'DemoModeBlockedError';
    this.operation = operation;
  }
}

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
 * Only throws when demo mode is active — safe to call from credential paths.
 * Do not call from the demo-mode toggle itself (that path does not touch Spotify).
 */
export function assertDemoDoesNotTouchSpotify(
  demoModeActive: boolean,
  operation: DemoBlockedSpotifyOperation | string
): void {
  if (!demoModeActive) return;
  if (!BLOCKED_SPOTIFY_OPS.has(operation)) return;
  throw new DemoModeBlockedError(operation);
}

export function isDemoModeBlockedError(error: unknown): error is DemoModeBlockedError {
  return (
    error instanceof DemoModeBlockedError ||
    (error instanceof Error && error.message.startsWith('DEMO_MODE_BLOCKED:'))
  );
}

/** Lightweight demo_mode flag lookup (no settings row creation). */
export async function isUserDemoModeActive(userId: string): Promise<boolean> {
  if (!userId?.trim()) return false;
  const { getPool } = await import('@/lib/db');
  const result = await getPool().query(
    `SELECT demo_mode FROM user_settings WHERE user_id = $1`,
    [userId.trim()]
  );
  return isDemoModeEnabled(
    (result.rows[0] as { demo_mode?: boolean | null } | undefined) ?? {}
  );
}

/**
 * Fail-closed guard for Spotify OAuth / token vault / refresh / disconnect.
 * Call before any production credential read or write.
 */
export async function assertUserDemoDoesNotTouchSpotify(
  userId: string,
  operation: DemoBlockedSpotifyOperation | string
): Promise<void> {
  const active = await isUserDemoModeActive(userId);
  assertDemoDoesNotTouchSpotify(active, operation);
}
