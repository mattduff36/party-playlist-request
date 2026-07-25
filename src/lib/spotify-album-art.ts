export interface SpotifyAlbumImage {
  url?: string;
  width?: number;
  height?: number;
}

export interface TrackWithAlbumArt {
  image_url?: string | null;
  album?:
    | string
    | {
        name?: string;
        images?: SpotifyAlbumImage[];
      }
    | null;
}

/**
 * Pick a single album-art URL already present on a Spotify track object.
 * Prefers medium (~300px) then large then any — no extra API calls.
 */
export function getTrackAlbumImageUrl(
  track: TrackWithAlbumArt | null | undefined
): string | undefined {
  if (!track) return undefined;
  if (track.image_url) return track.image_url;
  if (track.album && typeof track.album === 'object') {
    const images = track.album.images;
    if (!images?.length) return undefined;
    return (
      images[1]?.url || images[0]?.url || images[images.length - 1]?.url || undefined
    );
  }
  return undefined;
}
