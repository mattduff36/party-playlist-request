import crypto from 'crypto';
import { getSpotifyAuth, setSpotifyAuth } from './db';

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

class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private baseURL = 'https://api.spotify.com/v1';
  private authURL = 'https://accounts.spotify.com';
  private scopes = [
    'user-modify-playback-state',
    'user-read-playback-state',
    'user-read-currently-playing',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-private'
  ].join(' ');

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';
    
    // Debug: Check if environment variables are set
    console.log('Spotify service initialized:', {
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      hasRedirectUri: !!this.redirectUri,
      redirectUri: this.redirectUri
    });
  }

  async isConnected(): Promise<boolean> {
    try {
      const auth = await getSpotifyAuth();
      return !!(auth && auth.access_token && auth.refresh_token);
    } catch (error) {
      return false;
    }
  }

  async isConnectedAndValid(): Promise<boolean> {
    try {
      const auth = await getSpotifyAuth();
      if (!auth || !auth.access_token || !auth.refresh_token) {
        return false;
      }
      
      // Full validation - try to get access token (this will refresh if needed)
      try {
        await this.getAccessToken();
        return true;
      } catch (error) {
        // If token refresh fails, we're not connected
        console.log('Token validation failed:', (error as Error).message);
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async clearTokens(): Promise<void> {
    try {
      const { clearSpotifyAuth } = await import('./db');
      await clearSpotifyAuth();
      console.log('Cleared invalid Spotify tokens from database');
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
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return { codeVerifier, codeChallenge };
  }

  getAuthorizationURL() {
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state: state,
      scope: this.scopes
    });

    return {
      url: `${this.authURL}/authorize?${params.toString()}`,
      state,
      codeChallenge,
      codeVerifier
    };
  }

  async exchangeCodeForToken(code: string, codeVerifier: string) {
    console.log('Spotify token exchange:', { 
      hasCode: !!code, 
      hasCodeVerifier: !!codeVerifier,
      clientId: this.clientId ? 'SET' : 'MISSING',
      redirectUri: this.redirectUri,
      codeLength: code?.length,
      codeVerifierLength: codeVerifier?.length
    });

    const response = await fetch(`${this.authURL}/api/token`, {
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
    console.log('Token exchange successful, saving tokens...');
    await this.saveTokens(tokenData);
    
    return tokenData;
  }

  private async saveTokens(tokenData: any) {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    console.log('Saving Spotify tokens:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      expiresAt: expiresAt.toISOString(),
      scope: tokenData.scope
    });
    
    await setSpotifyAuth({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
      scope: tokenData.scope,
      token_type: tokenData.token_type || 'Bearer',
      updated_at: new Date().toISOString()
    });
    
    console.log('Spotify tokens saved successfully');
  }

  async getAccessToken(): Promise<string> {
    const startTime = Date.now();
    console.log('🔑 Getting Spotify access token...');
    
    const auth = await getSpotifyAuth();
    console.log(`🔑 Auth data retrieved (${Date.now() - startTime}ms)`);
    
    if (!auth || !auth.access_token) {
      throw new Error('No Spotify authentication found');
    }

    if (!auth.refresh_token) {
      throw new Error('No Spotify refresh token available');
    }

    const now = new Date();
    const expiresAt = new Date(auth.expires_at);

    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log('🔄 Token needs refresh, refreshing...');
      const refreshStart = Date.now();
      const newToken = await this.refreshAccessToken(auth.refresh_token);
      console.log(`🔄 Token refreshed (${Date.now() - refreshStart}ms)`);
      return newToken;
    }

    console.log(`🔑 Using existing token (${Date.now() - startTime}ms total)`);
    return auth.access_token;
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    if (!refreshToken) {
      throw new Error('No refresh token provided');
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(`${this.authURL}/api/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Spotify token refresh failed:', response.status, errorText);
        
        // If refresh token is invalid/revoked, clear stored auth
        if (response.status === 400 && errorText.includes('invalid_grant')) {
          console.log('Clearing invalid Spotify tokens');
          await this.clearTokens();
        }
        
        throw new Error(`Failed to refresh access token: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json();
      
      if (!tokenData.access_token) {
        throw new Error('No access token received from Spotify');
      }
      
      if (!tokenData.refresh_token) {
        tokenData.refresh_token = refreshToken;
      }
      
      await this.saveTokens(tokenData);
      return tokenData.access_token;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Spotify token refresh timed out after 10 seconds');
        throw new Error('Spotify token refresh timeout');
      }
      throw error;
    }
  }

  async makeAuthenticatedRequest(method: string, endpoint: string, data?: any, retries = 1): Promise<any> {
    const requestId = Math.random().toString(36).substr(2, 6);
    const startTime = Date.now();
    console.log(`🌐 [${requestId}] Making Spotify API request: ${method} ${endpoint} (retries left: ${retries})`);
    
    let accessToken: string;
    try {
      const tokenStart = Date.now();
      accessToken = await this.getAccessToken();
      console.log(`🔑 [${requestId}] Access token obtained (${Date.now() - tokenStart}ms)`);
    } catch (tokenError) {
      console.error(`❌ [${requestId}] Failed to get access token: ${(tokenError as Error).message}`);
      throw tokenError;
    }
    
    const config: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const fetchStart = Date.now();
    console.log(`🌐 [${requestId}] Starting HTTP request to ${this.baseURL}${endpoint}...`);
    
    // Add reasonable timeout to prevent hanging requests (Vercel serverless limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ [${requestId}] Request timeout after 8 seconds, aborting...`);
      controller.abort();
    }, 8000); // 8 second timeout
    
    config.signal = controller.signal;
    
    let response;
    try {
      console.log(`📡 [${requestId}] Sending fetch request...`);
      response = await fetch(`${this.baseURL}${endpoint}`, config);
      clearTimeout(timeoutId);
      console.log(`📡 [${requestId}] Fetch completed: ${response.status} ${response.statusText} (${Date.now() - fetchStart}ms)`);
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = (error as Error).message;
      console.error(`❌ [${requestId}] Fetch failed after ${Date.now() - fetchStart}ms: ${errorMessage}`);
      
      if (error.name === 'AbortError') {
        throw new Error(`Spotify API request timeout after 8 seconds: ${method} ${endpoint}`);
      }
      throw error;
    }

    if (response.status === 429 && retries > 0) {
      const retryAfter = response.headers.get('retry-after') || '1';
      await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
      return this.makeAuthenticatedRequest(method, endpoint, data, retries - 1);
    }

    if (response.status === 401 && retries > 0) {
      const auth = await getSpotifyAuth();
      if (auth?.refresh_token) {
        await this.refreshAccessToken(auth.refresh_token);
        return this.makeAuthenticatedRequest(method, endpoint, data, retries - 1);
      }
    }

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async searchTracks(query: string, limit = 20): Promise<SpotifyTrack[]> {
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: limit.toString(),
      market: 'US'
    });

    const data = await this.makeAuthenticatedRequest('GET', `/search?${params.toString()}`);
    
    return data.tracks.items.map((track: any) => ({
      id: track.id,
      uri: track.uri,
      name: track.name,
      artists: track.artists.map((artist: any) => artist.name),
      album: track.album.name,
      duration_ms: track.duration_ms,
      explicit: track.explicit,
      preview_url: track.preview_url,
      external_urls: track.external_urls,
      image: track.album.images?.[0]?.url
    }));
  }

  async getTrack(trackId: string): Promise<SpotifyTrack> {
    const id = trackId.includes('spotify:track:') ? 
      trackId.split(':')[2] : 
      trackId.replace('https://open.spotify.com/track/', '').split('?')[0];

    const track = await this.makeAuthenticatedRequest('GET', `/tracks/${id}`);
    
    return {
      id: track.id,
      uri: track.uri,
      name: track.name,
      artists: track.artists.map((artist: any) => artist.name),
      album: track.album.name,
      duration_ms: track.duration_ms,
      explicit: track.explicit,
      preview_url: track.preview_url,
      external_urls: track.external_urls,
      image: track.album.images?.[0]?.url
    };
  }


  async addToPlaylist(playlistId: string, trackUri: string): Promise<boolean> {
    await this.makeAuthenticatedRequest('POST', `/playlists/${playlistId}/tracks`, {
      uris: [trackUri]
    });
    return true;
  }

  async getCurrentPlayback(): Promise<any> {
    const callId = Math.random().toString(36).substr(2, 6);
    const startTime = Date.now();
    console.log(`🎵 [${callId}] getCurrentPlayback() called at ${new Date().toISOString()}`);
    
    try {
      console.log(`🌐 [${callId}] Making authenticated request to /me/player...`);
      const result = await this.makeAuthenticatedRequest('GET', '/me/player');
      
      console.log(`✅ [${callId}] getCurrentPlayback() completed (${Date.now() - startTime}ms)`);
      if (result) {
        console.log(`🎵 [${callId}] Playback data: device=${result.device?.name || 'unknown'}, is_playing=${result.is_playing}, track=${result.item?.name || 'unknown'}`);
      } else {
        console.log(`🎵 [${callId}] No active playback session found`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ [${callId}] getCurrentPlayback() failed after ${Date.now() - startTime}ms:`, error);
      throw error;
    }
  }

  async getDevices(): Promise<any[]> {
    const data = await this.makeAuthenticatedRequest('GET', '/me/player/devices');
    return data.devices;
  }

  async skipToNext(deviceId?: string): Promise<boolean> {
    const params = deviceId ? `?device_id=${deviceId}` : '';
    await this.makeAuthenticatedRequest('POST', `/me/player/next${params}`);
    return true;
  }

  async pausePlayback(deviceId?: string): Promise<boolean> {
    const params = deviceId ? `?device_id=${deviceId}` : '';
    await this.makeAuthenticatedRequest('PUT', `/me/player/pause${params}`);
    return true;
  }

  async resumePlayback(deviceId?: string): Promise<boolean> {
    const params = deviceId ? `?device_id=${deviceId}` : '';
    await this.makeAuthenticatedRequest('PUT', `/me/player/play${params}`);
    return true;
  }

  async addToQueue(trackUri: string, deviceId?: string): Promise<boolean> {
    const params = new URLSearchParams({ uri: trackUri });
    if (deviceId) params.append('device_id', deviceId);
    
    await this.makeAuthenticatedRequest('POST', `/me/player/queue?${params.toString()}`);
    return true;
  }

  async getQueue(): Promise<any> {
    const callId = Math.random().toString(36).substr(2, 6);
    const startTime = Date.now();
    console.log(`🎵 [${callId}] getQueue() called at ${new Date().toISOString()}`);
    
    try {
      console.log(`🌐 [${callId}] Making authenticated request to /me/player/queue...`);
      const result = await this.makeAuthenticatedRequest('GET', '/me/player/queue');
      
      console.log(`✅ [${callId}] getQueue() completed (${Date.now() - startTime}ms)`);
      if (result?.queue) {
        console.log(`🎵 [${callId}] Queue data: ${result.queue.length} items in queue`);
        if (result.queue.length > 0) {
          console.log(`🎵 [${callId}] Next track: ${result.queue[0]?.name || 'unknown'}`);
        }
      } else {
        console.log(`🎵 [${callId}] No queue data found`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ [${callId}] getQueue() failed after ${Date.now() - startTime}ms:`, error);
      throw error;
    }
  }

  async getTrackDetails(trackId: string): Promise<any> {
    return await this.makeAuthenticatedRequest('GET', `/tracks/${trackId}`);
  }

  async getAlbumArt(trackUri: string): Promise<string | null> {
    try {
      const trackId = trackUri.replace('spotify:track:', '');
      const track = await this.getTrackDetails(trackId);
      
      if (track.album?.images?.length > 0) {
        // Return the medium-sized image (usually index 1, or largest if only one)
        const images = track.album.images;
        return images[1]?.url || images[0]?.url || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting album art:', error);
      return null;
    }
  }

  // Legacy methods removed - using modern approach with isConnected() and admin/stats endpoint
}

export const spotifyService = new SpotifyService();