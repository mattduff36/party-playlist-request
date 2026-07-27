/**
 * Client-side Spotify OAuth helpers.
 * OAuth token exchange is server-owned (PRD-03); the browser only handles result codes.
 */

export const SPOTIFY_OAUTH_PENDING_KEY = 'spotify_oauth_pending';

export interface SpotifyOAuthResult {
  success: boolean;
  error?: string;
}

const RESULT_MESSAGES: Record<string, string> = {
  access_denied: 'Spotify authorization was denied.',
  session_required: 'Please sign in again, then reconnect Spotify.',
  missing_code: 'Spotify did not return an authorization code. Please try again.',
  bind_mismatch:
    'Spotify authorization could not be verified for this browser session. Please try again.',
  oauth_replay:
    'This Spotify authorization link was already used or expired. Please try again.',
  user_mismatch:
    'Spotify authorization does not match the signed-in account. Please try again.',
  expired_authorization: 'Spotify authorization expired. Please reconnect.',
  development_mode_denial:
    'Spotify app is in development mode and this account is not allowlisted.',
  rate_limit: 'Spotify is rate limiting requests. Please try again shortly.',
  provider_outage: 'Spotify is temporarily unavailable. Please try again later.',
  oauth_invalid: 'Spotify authorization failed. Please try connecting again.',
  provider_error: 'Spotify authorization failed. Please try again.',
  callback_failed: 'Failed to complete Spotify connection. Please try again.',
};

export function markSpotifyOAuthPending(): void {
  try {
    sessionStorage.setItem(SPOTIFY_OAUTH_PENDING_KEY, '1');
  } catch {
    // sessionStorage may be unavailable
  }
}

export function clearSpotifyOAuthPending(): void {
  try {
    sessionStorage.removeItem(SPOTIFY_OAUTH_PENDING_KEY);
  } catch {
    // sessionStorage may be unavailable
  }
}

export function isSpotifyOAuthPending(): boolean {
  try {
    return sessionStorage.getItem(SPOTIFY_OAUTH_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

/** Map server redirect error codes to user-safe messages. */
export function messageForSpotifyOAuthError(code: string | null): string {
  if (!code) {
    return 'Failed to complete Spotify connection. Please try again.';
  }
  return (
    RESULT_MESSAGES[code] ||
    'Failed to complete Spotify connection. Please try again.'
  );
}

/**
 * Legacy client exchange removed. Kept as a stub so accidental callers fail closed
 * without contacting /oauth-session or posting a verifier.
 */
export async function completeSpotifyOAuthCallback(
  _code: string,
  _oauthState: string
): Promise<SpotifyOAuthResult> {
  return {
    success: false,
    error:
      'Client Spotify token exchange is no longer supported. Reload and reconnect Spotify.',
  };
}

export async function waitForSpotifyConnected(options?: {
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<SpotifyOAuthResult> {
  const timeoutMs = options?.timeoutMs ?? 30000;
  const intervalMs = options?.intervalMs ?? 1000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include',
      });
      const data = await response.json();

      if (response.ok && data.connected) {
        return { success: true };
      }
    } catch {
      // Keep polling until timeout
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    success: false,
    error:
      'Spotify connection is taking longer than expected. Please try again.',
  };
}
