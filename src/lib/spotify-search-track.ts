/**
 * Normalize Spotify Web API track objects into the guest-request client shape.
 * Raw Spotify payloads use album/artists as objects — React cannot render those.
 */

export interface GuestSearchTrack {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  explicit: boolean;
  preview_url?: string;
  image?: string;
}

interface SpotifyArtistLike {
  name?: string;
}

interface SpotifyAlbumLike {
  name?: string;
  images?: Array<{ url?: string }>;
}

interface SpotifyTrackLike {
  id?: string;
  uri?: string;
  name?: string;
  artists?: SpotifyArtistLike[] | string[];
  album?: SpotifyAlbumLike | string;
  duration_ms?: number;
  explicit?: boolean;
  preview_url?: string | null;
}

function artistNames(artists: SpotifyTrackLike['artists']): string[] {
  if (!Array.isArray(artists)) return [];
  return artists
    .map((artist) => (typeof artist === 'string' ? artist : artist?.name || ''))
    .map((name) => name.trim())
    .filter(Boolean);
}

function albumName(album: SpotifyTrackLike['album']): string {
  if (typeof album === 'string') return album;
  return album?.name?.trim() || '';
}

function albumImage(album: SpotifyTrackLike['album']): string | undefined {
  if (!album || typeof album === 'string') return undefined;
  const url = album.images?.[0]?.url;
  return typeof url === 'string' && url.length > 0 ? url : undefined;
}

export function mapSpotifySearchTrack(raw: unknown): GuestSearchTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const track = raw as SpotifyTrackLike;
  if (!track.uri || !track.name) return null;

  return {
    id: track.id || track.uri,
    uri: track.uri,
    name: track.name,
    artists: artistNames(track.artists),
    album: albumName(track.album),
    duration_ms: typeof track.duration_ms === 'number' ? track.duration_ms : 0,
    explicit: Boolean(track.explicit),
    preview_url: track.preview_url || undefined,
    image: albumImage(track.album),
  };
}

export function mapSpotifySearchTracks(rawTracks: unknown[]): GuestSearchTrack[] {
  if (!Array.isArray(rawTracks)) return [];
  return rawTracks
    .map((track) => mapSpotifySearchTrack(track))
    .filter((track): track is GuestSearchTrack => track !== null);
}

/** Accepts normalized string[] or legacy Spotify artist objects. */
export function formatGuestTrackArtists(artists: unknown): string {
  if (!Array.isArray(artists)) return '';
  return artists
    .map((artist) =>
      typeof artist === 'string' ? artist : (artist as SpotifyArtistLike | undefined)?.name || ''
    )
    .map((name) => name.trim())
    .filter(Boolean)
    .join(', ');
}

/** Accepts normalized string or legacy Spotify album object. */
export function formatGuestTrackAlbum(album: unknown): string {
  if (typeof album === 'string') return album.trim();
  if (album && typeof album === 'object') {
    return albumName(album as SpotifyAlbumLike);
  }
  return '';
}
