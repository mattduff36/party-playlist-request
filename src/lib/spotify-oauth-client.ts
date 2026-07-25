/**
 * Client-side Spotify OAuth helpers.
 * Used when returning from Spotify authorization and while connection is pending.
 */

export const SPOTIFY_OAUTH_PENDING_KEY = 'spotify_oauth_pending';

export interface SpotifyOAuthResult {
  success: boolean;
  error?: string;
}

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

export async function completeSpotifyOAuthCallback(
  code: string,
  oauthState: string
): Promise<SpotifyOAuthResult> {
  let codeVerifier: string | null = null;

  try {
    const sessionResponse = await fetch(
      `/api/spotify/oauth-session?state=${encodeURIComponent(oauthState)}`,
      { credentials: 'include' }
    );

    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      codeVerifier = sessionData.code_verifier ?? null;
    }
  } catch {
    // Fall back to localStorage
  }

  if (!codeVerifier) {
    const storedState = localStorage.getItem('spotify_state');
    codeVerifier = localStorage.getItem('spotify_code_verifier');

    if (!storedState || oauthState !== storedState) {
      localStorage.removeItem('spotify_state');
      localStorage.removeItem('spotify_code_verifier');
      return {
        success: false,
        error: 'Authorization session expired or was invalid. Please try connecting again.',
      };
    }
  }

  if (!codeVerifier) {
    return {
      success: false,
      error: 'Authorization session not found. Please try connecting again.',
    };
  }

  try {
    const response = await fetch('/api/spotify/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        code,
        state: oauthState,
        code_verifier: codeVerifier,
      }),
    });

    localStorage.removeItem('spotify_state');
    localStorage.removeItem('spotify_code_verifier');

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          (errorData as { error?: string }).error ||
          'Failed to complete Spotify connection',
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: 'Network error while connecting to Spotify. Please try again.',
    };
  }
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
