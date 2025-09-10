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
    const { codeChallenge } = this.generatePKCE();
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
      codeChallenge
    };
  }

  async exchangeCodeForToken(code: string, codeVerifier: string) {
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

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await response.json();
    await this.saveTokens(tokenData);
    
    return tokenData;
  }

  private async saveTokens(tokenData: any) {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    await setSpotifyAuth({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
      scope: tokenData.scope,
      token_type: tokenData.token_type || 'Bearer',
      updated_at: new Date().toISOString()
    });
  }

  async getAccessToken(): Promise<string> {
    const auth = await getSpotifyAuth();
    
    if (!auth || !auth.access_token) {
      throw new Error('No Spotify authentication found');
    }

    const now = new Date();
    const expiresAt = new Date(auth.expires_at);

    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      return await this.refreshAccessToken(auth.refresh_token);
    }

    return auth.access_token;
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await fetch(`${this.authURL}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const tokenData = await response.json();
    
    if (!tokenData.refresh_token) {
      tokenData.refresh_token = refreshToken;
    }
    
    await this.saveTokens(tokenData);
    return tokenData.access_token;
  }

  async makeAuthenticatedRequest(method: string, endpoint: string, data?: any, retries = 1): Promise<any> {
    const accessToken = await this.getAccessToken();
    
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

    const response = await fetch(`${this.baseURL}${endpoint}`, config);

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

  async addToQueue(trackUri: string, deviceId?: string): Promise<boolean> {
    const params = new URLSearchParams({ uri: trackUri });
    if (deviceId) {
      params.append('device_id', deviceId);
    }

    await this.makeAuthenticatedRequest('POST', `/me/player/queue?${params.toString()}`);
    return true;
  }

  async addToPlaylist(playlistId: string, trackUri: string): Promise<boolean> {
    await this.makeAuthenticatedRequest('POST', `/playlists/${playlistId}/tracks`, {
      uris: [trackUri]
    });
    return true;
  }

  async getCurrentPlayback(): Promise<any> {
    return await this.makeAuthenticatedRequest('GET', '/me/player');
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

  async isAuthenticated(): Promise<boolean> {
    try {
      const auth = await getSpotifyAuth();
      return !!(auth && auth.access_token && auth.refresh_token);
    } catch (error) {
      return false;
    }
  }

  async getPlaylists(): Promise<any[]> {
    const playlists = await this.makeAuthenticatedRequest('GET', '/me/playlists?limit=50');
    
    return playlists.items
      .filter((playlist: any) => playlist.owner.id)
      .map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        public: playlist.public,
        collaborative: playlist.collaborative,
        tracks_total: playlist.tracks.total,
        images: playlist.images
      }));
  }

  async createPlaylist(name: string, description: string, isPublic = false): Promise<any> {
    const userData = await this.makeAuthenticatedRequest('GET', '/me');
    
    const playlist = await this.makeAuthenticatedRequest('POST', `/users/${userData.id}/playlists`, {
      name: name,
      description: description,
      public: isPublic
    });

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      external_urls: playlist.external_urls
    };
  }

  async getUserInfo(): Promise<any> {
    const userData = await this.makeAuthenticatedRequest('GET', '/me');
    return {
      id: userData.id,
      display_name: userData.display_name,
      email: userData.email,
      country: userData.country,
      product: userData.product
    };
  }
}

export const spotifyService = new SpotifyService();