/**
 * Strict allowlist of post-OAuth redirect destinations.
 */

export type SpotifyOAuthRedirectId = 'admin_spotify';

const ALLOWED: ReadonlySet<string> = new Set(['admin_spotify']);

export function isAllowedOAuthRedirectId(
  value: string | null | undefined
): value is SpotifyOAuthRedirectId {
  return typeof value === 'string' && ALLOWED.has(value);
}

export function resolveOAuthRedirectPath(
  redirectId: SpotifyOAuthRedirectId,
  username: string | null | undefined
): string {
  if (redirectId === 'admin_spotify') {
    if (username && username !== 'admin') {
      return `/${encodeURIComponent(username)}/admin/spotify`;
    }
    return '/admin/spotify';
  }
  return '/admin/spotify';
}

export function mapSpotifyProviderError(error: string | null): string {
  switch (error) {
    case 'access_denied':
      return 'access_denied';
    case null:
    case undefined:
    case '':
      return 'provider_error';
    default:
      return 'provider_error';
  }
}
