/**
 * Typed Spotify API / OAuth error categories (user-safe).
 */

export type SpotifyErrorCategory =
  | 'expired_authorization'
  | 'development_mode_denial'
  | 'rate_limit'
  | 'no_active_device'
  | 'provider_outage'
  | 'oauth_invalid'
  | 'oauth_replay'
  | 'oauth_session_required'
  | 'oauth_user_mismatch'
  | 'unknown';

export class SpotifyServiceError extends Error {
  readonly category: SpotifyErrorCategory;
  readonly status?: number;

  constructor(
    category: SpotifyErrorCategory,
    message: string,
    status?: number
  ) {
    super(message);
    this.name = 'SpotifyServiceError';
    this.category = category;
    this.status = status;
  }
}

export function classifySpotifyHttpError(
  status: number,
  bodyText: string
): SpotifyErrorCategory {
  const lower = bodyText.toLowerCase();
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) {
    if (lower.includes('user not registered') || lower.includes('development mode')) {
      return 'development_mode_denial';
    }
    return 'expired_authorization';
  }
  if (status === 404 && lower.includes('device')) return 'no_active_device';
  if (status >= 500) return 'provider_outage';
  if (status === 400) return 'oauth_invalid';
  return 'unknown';
}

export function userSafeSpotifyMessage(category: SpotifyErrorCategory): string {
  switch (category) {
    case 'expired_authorization':
      return 'Spotify authorization expired. Please reconnect.';
    case 'development_mode_denial':
      return 'Spotify app is in development mode and this account is not allowlisted.';
    case 'rate_limit':
      return 'Spotify is rate limiting requests. Please try again shortly.';
    case 'no_active_device':
      return 'No active Spotify device found.';
    case 'provider_outage':
      return 'Spotify is temporarily unavailable. Please try again later.';
    case 'oauth_invalid':
      return 'Spotify authorization failed. Please try connecting again.';
    case 'oauth_replay':
      return 'This Spotify authorization link was already used or expired.';
    case 'oauth_session_required':
      return 'Please sign in again, then reconnect Spotify.';
    case 'oauth_user_mismatch':
      return 'Spotify authorization does not match the signed-in account.';
    default:
      return 'Spotify request failed. Please try again.';
  }
}
