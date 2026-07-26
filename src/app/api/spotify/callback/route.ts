import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';
import { consumeOAuthTransaction } from '@/lib/db';
import {
  clearOAuthBindCookie,
  readOAuthBindCookie,
  verifyOAuthBindValue,
} from '@/lib/spotify/oauth-binding';
import {
  isAllowedOAuthRedirectId,
  mapSpotifyProviderError,
  resolveOAuthRedirectPath,
  type SpotifyOAuthRedirectId,
} from '@/lib/spotify/oauth-redirects';
import { SpotifyServiceError } from '@/lib/spotify/token-errors';

function redirectToResult(
  req: NextRequest,
  path: string,
  params: Record<string, string>
): NextResponse {
  const redirectUrl = new URL(path, req.url);
  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(redirectUrl);
  clearOAuthBindCookie(response);
  return response;
}

// Server-owned OAuth completion (PRD-03). No code/verifier returned to the browser.
export async function GET(req: NextRequest) {
  let fallbackPath = '/admin/spotify';

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const providerError = searchParams.get('error');

    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return redirectToResult(req, fallbackPath, {
        spotify_error: 'session_required',
      });
    }

    const userId = auth.user.user_id;
    const username = auth.user.username;
    fallbackPath = resolveOAuthRedirectPath('admin_spotify', username);

    if (providerError) {
      return redirectToResult(req, fallbackPath, {
        spotify_error: mapSpotifyProviderError(providerError),
      });
    }

    if (!code || !state) {
      return redirectToResult(req, fallbackPath, {
        spotify_error: 'missing_code',
      });
    }

    const bindCookie = readOAuthBindCookie(req);
    if (!verifyOAuthBindValue(bindCookie, state, userId)) {
      return redirectToResult(req, fallbackPath, {
        spotify_error: 'bind_mismatch',
      });
    }

    const txn = await consumeOAuthTransaction(state, userId);
    if (!txn) {
      return redirectToResult(req, fallbackPath, {
        spotify_error: 'oauth_replay',
      });
    }

    if (txn.userId && txn.userId !== userId) {
      return redirectToResult(req, fallbackPath, {
        spotify_error: 'user_mismatch',
      });
    }

    const redirectId: SpotifyOAuthRedirectId = isAllowedOAuthRedirectId(
      txn.redirectId
    )
      ? txn.redirectId
      : 'admin_spotify';
    const resultPath = resolveOAuthRedirectPath(
      redirectId,
      txn.username || username
    );

    try {
      await spotifyService.exchangeCodeForToken(code, txn.codeVerifier, userId);
    } catch (exchangeError) {
      const category =
        exchangeError instanceof SpotifyServiceError
          ? exchangeError.category
          : 'oauth_invalid';
      console.error('Spotify callback exchange failed (redacted)', { category });
      return redirectToResult(req, resultPath, {
        spotify_error: category,
      });
    }

    const { invalidatePlaylistCacheForUser } = await import(
      '@/lib/playlist-cache'
    );
    invalidatePlaylistCacheForUser(userId);

    return redirectToResult(req, resultPath, { spotify: 'connected' });
  } catch (error) {
    console.error('Error in Spotify callback (redacted)');
    return redirectToResult(req, fallbackPath, {
      spotify_error: 'callback_failed',
    });
  }
}

/** Client-supplied verifier exchange removed (PRD-03). */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Gone',
      message:
        'Client Spotify token exchange is no longer supported. OAuth completes on the server callback.',
    },
    { status: 410 }
  );
}
