import crypto from 'crypto';
import { getSpotifyAuth, setSpotifyAuth } from './db';
import { logErrorAsync } from '@/lib/support/logger';

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  explicit: boolean;
  preview_url?: string;
  external_urls: any;
  image?: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  collaborative: boolean;
  public: boolean | null;
  image?: string;
  track_count: number;
  owner_name?: string;
}

/** Scopes required to list private / collaborative playlists via GET /me/playlists */
export const SPOTIFY_PLAYLIST_READ_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
] as const;

class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private baseURL = 'https://api.spotify.com/v1';
  private authURL = 'https://accounts.spotify.com';
  // NOTE: Existing connected users must disconnect + reconnect Spotify after deploy
  // so tokens pick up the new playlist-read-* scopes. Dashboard app settings do not
  // need changes — scopes are requested at authorize time from this list.
  private scopes = [
    'user-modify-playback-state',
    'user-read-playback-state',
    'user-read-currently-playing',
    'playlist-modify-public',
    'playlist-modify-private',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-read-private'
  ].join(' ');

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';
    
    // Check if environment variables are set
    console.log('Spotify service initialized:', {
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      hasRedirectUri: !!this.redirectUri,
      redirectUri: this.redirectUri
    });
  }

  async isConnected(userId?: string): Promise<boolean> {
    try {
      const auth = await getSpotifyAuth(userId);
      return !!(auth && auth.access_token && auth.refresh_token);
    } catch (error) {
      return false;
    }
  }

  async isConnectedAndValid(userId?: string): Promise<boolean> {
    try {
      const auth = await getSpotifyAuth(userId);
      if (!auth || !auth.access_token || !auth.refresh_token) {
        return false;
      }
      
      // Check if token is expired
      if (auth.expires_at && new Date(auth.expires_at) <= new Date()) {
        console.log('Access token expired, attempting refresh...');
        try {
          await this.refreshAccessToken(userId || auth.user_id);
          return true;
        } catch (refreshError) {
          // Error is already logged in refreshAccessToken, just return false
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking connection validity:', error);
      return false;
    }
  }

  async clearTokens(): Promise<void> {
    try {
      const { clearSpotifyAuth } = await import('./db');
      await clearSpotifyAuth();
      console.log('✅ Spotify tokens cleared from database');
    } catch (error) {
      console.error('Error clearing Spotify tokens:', error);
    }
  }

  async revokeTokens(): Promise<void> {
    try {
      const { getSpotifyAuth, clearSpotifyAuth } = await import('./db');
      const auth = await getSpotifyAuth();
      
      if (!auth?.access_token) {
        console.log('No Spotify tokens to revoke');
        return;
      }

      console.log('🔄 Clearing Spotify authentication (Spotify API does not support programmatic token revocation)');
      
      // Note: Spotify's Web API does not provide a direct token revocation endpoint for third-party apps
      // The tokens will remain valid until they expire, but we clear them from our system
      // This forces the user to re-authenticate when they try to connect again
      
      // Clear tokens from our database immediately
      await clearSpotifyAuth();
      console.log('✅ Spotify tokens cleared from database - user will need to re-authenticate');
      
    } catch (error) {
      console.error('Error clearing Spotify tokens:', error);
      // Still try to clear from database
      try {
        const { clearSpotifyAuth } = await import('./db');
        await clearSpotifyAuth();
        console.log('⚠️ Error occurred, but cleared tokens from database');
      } catch (clearError) {
        console.error('Failed to clear tokens from database:', clearError);
        throw clearError;
      }
    }
  }

  generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  getAuthorizationURL() {
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: this.scopes,
      redirect_uri: this.redirectUri,
      state: state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });

    const url = `${this.authURL}/authorize?${params.toString()}`;
    
    return {
      url,
      state,
      codeChallenge,
      codeVerifier
    };
  }

  async exchangeCodeForToken(code: string, codeVerifier: string, userId: string) {
    console.log('Spotify token exchange:', { 
      hasCode: !!code, 
      hasCodeVerifier: !!codeVerifier,
      userId,
      clientId: this.clientId ? 'SET' : 'MISSING',
      redirectUri: this.redirectUri,
      codeLength: code?.length,
      codeVerifierLength: codeVerifier?.length,
    });

    // Always use real Spotify endpoint
    const tokenUrl = `${this.authURL}/api/token`;

    console.log('🎯 Using token URL:', tokenUrl);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        code_verifier: codeVerifier
      })
    });

    console.log('Spotify token response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Spotify token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        requestDetails: {
          clientId: this.clientId,
          redirectUri: this.redirectUri,
          codeLength: code?.length,
          codeVerifierLength: codeVerifier?.length
        }
      });
      throw new Error(`Failed to exchange code for token: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    await this.saveTokens(tokenData, userId);
    return tokenData;
  }

  private async saveTokens(tokenData: any, userId: string) {
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    
    const authData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      scope: tokenData.scope,
      token_type: tokenData.token_type || 'Bearer'
    };

    await setSpotifyAuth(authData, userId);
    console.log(`✅ Spotify tokens saved to database for user ${userId}`);
  }

  async getAccessToken(userId?: string): Promise<string> {
    console.log(`🔑 Getting Spotify access token${userId ? ` for user ${userId}` : ''}...`);
    const startTime = Date.now();
    
    const auth = await getSpotifyAuth(userId);
    console.log(`🔑 Auth data retrieved (${Date.now() - startTime}ms)`);
    
    if (!auth || !auth.access_token) {
      throw new Error(`No Spotify authentication found${userId ? ` for user ${userId}` : ''}`);
    }

    // Check if token is expired
    if (auth.expires_at && new Date(auth.expires_at) <= new Date()) {
      console.log('🔄 Access token expired, refreshing...');
      return await this.refreshAccessToken(userId);
    }

    return auth.access_token;
  }

  async refreshAccessToken(userId?: string): Promise<string> {
    const auth = await getSpotifyAuth(userId);
    if (!auth || !auth.refresh_token) {
      throw new Error(`No refresh token available${userId ? ` for user ${userId}` : ''}`);
    }
    
    if (!userId && auth.user_id) {
      userId = auth.user_id;
    }

    try {
      const response = await fetch(`${this.authURL}/api/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: auth.refresh_token
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Determine if this is a permanent failure (invalid credentials) or temporary
        const isPermanentError = response.status === 400 || response.status === 401;
        
        if (isPermanentError) {
          console.warn('⚠️ Spotify token refresh failed with permanent error:', {
            status: response.status,
            error: errorText
          });
        }
        
        throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json();
      
      // Update tokens in database
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      const updatedAuth = {
        ...auth,
        access_token: tokenData.access_token,
        expires_at: expiresAt,
        // Keep existing refresh_token if not provided in response
        refresh_token: tokenData.refresh_token || auth.refresh_token
      };

      if (!userId) {
        throw new Error('userId is required for setSpotifyAuth');
      }
      await setSpotifyAuth(updatedAuth, userId);
      
      console.log(`✅ Access token refreshed for user ${userId}`);
      
      return tokenData.access_token;
    } catch (error) {
      // If it's already our Error, just rethrow
      if (error instanceof Error) {
        throw error;
      }
      
      // Otherwise wrap the error
      throw new Error('Failed to refresh Spotify token');
    }
  }

  async makeAuthenticatedRequest(method: string, endpoint: string, data?: any, userId?: string, retries = 1): Promise<any> {
    const requestId = Math.random().toString(36).substr(2, 6);
    const startTime = Date.now();
    console.log(`🌐 [${requestId}] Making Spotify API request: ${method} ${endpoint}${userId ? ` (user: ${userId})` : ''} (retries left: ${retries})`);
    
    // Always use real Spotify API
    
    let accessToken: string;
    try {
      const tokenStart = Date.now();
      accessToken = await this.getAccessToken(userId);
      console.log(`🔑 [${requestId}] Access token obtained (${Date.now() - tokenStart}ms)`);
    } catch (tokenError) {
      console.error(`❌ [${requestId}] Failed to get access token:`, (tokenError as Error).message);
      throw tokenError;
    }

    const url = `${this.baseURL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const requestStart = Date.now();
      const response = await fetch(url, options);
      const requestTime = Date.now() - requestStart;
      
      console.log(`🌐 [${requestId}] Response: ${response.status} ${response.statusText} (${requestTime}ms)`);

      if (response.status === 401 && retries > 0) {
        console.log(`🔄 [${requestId}] Unauthorized, attempting token refresh and retry...`);
        try {
          await this.refreshAccessToken(userId);
          return await this.makeAuthenticatedRequest(method, endpoint, data, userId, retries - 1);
        } catch (refreshError) {
          console.error(`❌ [${requestId}] Token refresh failed:`, (refreshError as Error).message);
          throw new Error('Authentication failed and token refresh unsuccessful');
        }
      }

      // Respect Spotify rate limits: backoff using Retry-After when present
      if (response.status === 429 && retries > 0) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
        const waitMs = Number.isFinite(retryAfterSeconds)
          ? Math.min(Math.max(retryAfterSeconds, 1) * 1000, 30_000)
          : Math.min(1000 * Math.pow(2, 2 - retries), 8_000);
        console.warn(`⏳ [${requestId}] Spotify 429 — waiting ${waitMs}ms before retry (${retries} left)`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return await this.makeAuthenticatedRequest(method, endpoint, data, userId, retries - 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [${requestId}] Request failed:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          endpoint,
          method
        });
        if (response.status === 429 || response.status >= 500 || retries === 0) {
          logErrorAsync({
            source: 'spotify',
            level: 'error',
            message: `Spotify API ${response.status} on ${method} ${endpoint}`,
            route: endpoint,
            method,
            userId: userId || null,
            meta: {
              status: response.status,
              statusText: response.statusText,
              body: errorText.slice(0, 400),
              retriesLeft: retries,
            },
          });
        }
        throw new Error(`Spotify API error: ${response.status} ${errorText}`);
      }

      // Handle empty responses (like for some POST requests)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log(`✅ [${requestId}] Request completed successfully (${Date.now() - startTime}ms total)`);
        return result;
      } else {
        console.log(`✅ [${requestId}] Request completed successfully - no JSON response (${Date.now() - startTime}ms total)`);
        return null;
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Request failed after ${Date.now() - startTime}ms:`, (error as Error).message);
      throw error;
    }
  }

  // Spotify API Methods (multi-tenant aware)
  async getCurrentPlayback(userId?: string) {
    const requestId = Math.random().toString(36).substr(2, 6);
    console.log(`🎵 [${requestId}] getCurrentPlayback() called${userId ? ` for user ${userId}` : ''} at ${new Date().toISOString()}`);
    
    try {
      console.log(`🌐 [${requestId}] Making authenticated request to /me/player...`);
      const result = await this.makeAuthenticatedRequest('GET', '/me/player', undefined, userId);
      console.log(`✅ [${requestId}] getCurrentPlayback() completed successfully`);
      return result;
    } catch (error) {
      console.error(`❌ [${requestId}] getCurrentPlayback() failed:`, (error as Error).message);
      throw error;
    }
  }

  async getQueue(userId?: string) {
    const requestId = Math.random().toString(36).substr(2, 6);
    console.log(`🎵 [${requestId}] getQueue() called${userId ? ` for user ${userId}` : ''} at ${new Date().toISOString()}`);
    
    try {
      console.log(`🌐 [${requestId}] Making authenticated request to /me/player/queue...`);
      const result = await this.makeAuthenticatedRequest('GET', '/me/player/queue', undefined, userId);
      console.log(`✅ [${requestId}] getQueue() completed successfully`);
      return result;
    } catch (error) {
      console.error(`❌ [${requestId}] getQueue() failed:`, (error as Error).message);
      throw error;
    }
  }

  async addToQueue(trackUri: string, deviceId?: string, userId?: string) {
    const url = deviceId 
      ? `/me/player/queue?uri=${encodeURIComponent(trackUri)}&device_id=${deviceId}`
      : `/me/player/queue?uri=${encodeURIComponent(trackUri)}`;
    return await this.makeAuthenticatedRequest('POST', url, undefined, userId);
  }

  async addToPlaylist(playlistId: string, trackUri: string, userId?: string) {
    // Feb 2026: POST /playlists/{id}/tracks removed → use /items
    // https://developer.spotify.com/documentation/web-api/references/changes/february-2026
    return await this.makeAuthenticatedRequest(
      'POST',
      `/playlists/${playlistId}/items`,
      { uris: [trackUri] },
      userId
    );
  }

  async play(contextUri?: string, trackUris?: string[], userId?: string) {
    const data: any = {};
    if (contextUri) data.context_uri = contextUri;
    if (trackUris) data.uris = trackUris;
    
    return await this.makeAuthenticatedRequest('PUT', '/me/player/play', data, userId);
  }

  async pause(userId?: string) {
    return await this.makeAuthenticatedRequest('PUT', '/me/player/pause', undefined, userId);
  }

  async next(userId?: string) {
    return await this.makeAuthenticatedRequest('POST', '/me/player/next', undefined, userId);
  }

  async skipToNext(deviceId?: string, userId?: string) {
    const url = deviceId
      ? `/me/player/next?device_id=${encodeURIComponent(deviceId)}`
      : '/me/player/next';
    return await this.makeAuthenticatedRequest('POST', url, undefined, userId);
  }

  async previous(userId?: string) {
    return await this.makeAuthenticatedRequest('POST', '/me/player/previous', undefined, userId);
  }

  async setVolume(volumePercent: number, userId?: string) {
    return await this.makeAuthenticatedRequest('PUT', `/me/player/volume?volume_percent=${volumePercent}`, undefined, userId);
  }

  async getAvailableDevices(userId?: string) {
    return await this.makeAuthenticatedRequest('GET', '/me/player/devices', undefined, userId);
  }

  async transferPlayback(deviceId: string, play: boolean = false, userId?: string) {
    return await this.makeAuthenticatedRequest('PUT', '/me/player', {
      device_ids: [deviceId],
      play
    }, userId);
  }

  async resumePlayback(deviceId?: string, userId?: string) {
    const url = deviceId ? `/me/player/play?device_id=${deviceId}` : '/me/player/play';
    return await this.makeAuthenticatedRequest('PUT', url, undefined, userId);
  }

  /**
   * Get app-only access token using Client Credentials flow
   * This is for public API calls that don't require user authorization
   */
  private appAccessToken: string | null = null;
  private appTokenExpiry: Date | null = null;

  async getAppAccessToken(): Promise<string> {
    // Reuse token if it's still valid (with 5 minute buffer)
    if (this.appAccessToken && this.appTokenExpiry && this.appTokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
      return this.appAccessToken;
    }

    console.log('🔑 Getting app-only access token via Client Credentials...');

    const response = await fetch(`${this.authURL}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get app access token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    this.appAccessToken = data.access_token;
    this.appTokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
    
    console.log('✅ App access token obtained');
    return this.appAccessToken;
  }

  async searchTracks(query: string, limit = 10, userId?: string) {
    // Feb 2026: search limit max reduced from 50 → 10
    const safeLimit = Math.min(Math.max(limit || 10, 1), 10);
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: safeLimit.toString()
    });
    
    // Try user-authenticated search first if userId provided
    if (userId) {
      try {
        return await this.makeAuthenticatedRequest('GET', `/search?${params.toString()}`, undefined, userId);
      } catch (error) {
        console.log('⚠️ User-authenticated search failed, falling back to app-only search');
      }
    }

    // Fall back to app-only search (Client Credentials)
    console.log('🔍 Using app-only search (no user auth required)');
    const appToken = await this.getAppAccessToken();
    const url = `${this.baseURL}/search?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${appToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Spotify search failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  async getTrack(trackId: string, userId?: string) {
    return await this.makeAuthenticatedRequest('GET', `/tracks/${trackId}`, undefined, userId);
  }

  async getUserProfile(userId?: string) {
    return await this.makeAuthenticatedRequest('GET', '/me', undefined, userId);
  }

  /**
   * List playlists for the connected Spotify user (owned + followed).
   * Paginates GET /me/playlists (max 50 per page). Requires playlist-read-private
   * (and playlist-read-collaborative for collaborative playlists).
   */
  async getUserPlaylists(userId?: string, options?: { maxPlaylists?: number }): Promise<SpotifyPlaylist[]> {
    const pageLimit = 50;
    const maxPlaylists = options?.maxPlaylists ?? 200;
    const playlists: SpotifyPlaylist[] = [];
    let offset = 0;

    while (playlists.length < maxPlaylists) {
      const limit = Math.min(pageLimit, maxPlaylists - playlists.length);
      const data = await this.makeAuthenticatedRequest(
        'GET',
        `/me/playlists?limit=${limit}&offset=${offset}`,
        undefined,
        userId
      );

      const items = Array.isArray(data?.items) ? data.items : [];
      for (const item of items) {
        if (!item?.id) continue;
        playlists.push({
          id: item.id,
          name: item.name || 'Untitled playlist',
          uri: item.uri || `spotify:playlist:${item.id}`,
          collaborative: !!item.collaborative,
          public: typeof item.public === 'boolean' ? item.public : null,
          image: item.images?.[0]?.url,
          track_count: item.tracks?.total ?? item.items?.total ?? 0,
          owner_name: item.owner?.display_name || undefined,
        });
      }

      if (!data?.next || items.length === 0) {
        break;
      }

      offset += items.length;
    }

    return playlists;
  }

  /** True if the stored token scope includes playlist list/read permissions. */
  async hasPlaylistReadScopes(userId?: string): Promise<boolean> {
    const auth = await getSpotifyAuth(userId);
    if (!auth?.scope) return false;
    const granted = new Set(auth.scope.split(/[\s,]+/).filter(Boolean));
    return SPOTIFY_PLAYLIST_READ_SCOPES.every((scope) => granted.has(scope));
  }

  async getAlbumArt(trackId: string, userId?: string): Promise<string | null> {
    try {
      const track = await this.getTrack(trackId, userId);
      return track?.album?.images?.[0]?.url || null;
    } catch (error) {
      console.error('Error getting album art:', error);
      return null;
    }
  }
}

export const spotifyService = new SpotifyService();
