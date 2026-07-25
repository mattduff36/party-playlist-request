/**
 * Normalize Spotify artist payloads (string, string[], or { name }[]) into a display string.
 */
export function formatArtists(
  artists?: string | string[] | Array<{ name?: string }> | null
): string {
  if (!artists) return 'Unknown Artist';
  if (typeof artists === 'string') {
    return artists.trim() || 'Unknown Artist';
  }
  if (!Array.isArray(artists) || artists.length === 0) {
    return 'Unknown Artist';
  }
  const names = artists
    .map((artist) => (typeof artist === 'string' ? artist : artist?.name || ''))
    .filter(Boolean);
  return names.length > 0 ? names.join(', ') : 'Unknown Artist';
}
