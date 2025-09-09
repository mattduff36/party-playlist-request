const axios = require('axios');
const crypto = require('crypto');
const { getRow, runQuery } = require('../db/db');

class SpotifyService {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    this.baseURL = 'https://api.spotify.com/v1';
    this.authURL = 'https://accounts.spotify.com';
    
    // Required scopes for the application
    this.scopes = [
      'user-modify-playback-state',
      'user-read-playback-state', 
      'user-read-currently-playing',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-private'
    ].join(' ');
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate authorization URL for OAuth flow
   */
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

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, codeVerifier) {
    try {
      const response = await axios.post(`${this.authURL}/api/token`, {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        code_verifier: codeVerifier
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;
      await this.saveTokens(tokenData);
      
      return tokenData;
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for access token');
    }
  }

  /**
   * Save tokens to database
   */
  async saveTokens(tokenData) {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    await runQuery(`
      INSERT OR REPLACE INTO spotify_auth 
      (id, access_token, refresh_token, expires_at, scope, token_type, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      tokenData.access_token,
      tokenData.refresh_token,
      expiresAt.toISOString(),
      tokenData.scope,
      tokenData.token_type || 'Bearer'
    ]);
  }

  /**
   * Get stored access token, refresh if needed
   */
  async getAccessToken() {
    const auth = await getRow('SELECT * FROM spotify_auth WHERE id = 1');
    
    if (!auth || !auth.access_token) {
      throw new Error('No Spotify authentication found. Please authenticate first.');
    }

    const now = new Date();
    const expiresAt = new Date(auth.expires_at);

    // If token expires in less than 5 minutes, refresh it
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log('Access token expiring soon, refreshing...');
      return await this.refreshAccessToken(auth.refresh_token);
    }

    return auth.access_token;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(`${this.authURL}/api/token`, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;
      
      // Keep the existing refresh token if not provided in response
      if (!tokenData.refresh_token) {
        tokenData.refresh_token = refreshToken;
      }
      
      await this.saveTokens(tokenData);
      return tokenData.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Make authenticated request to Spotify API
   */
  async makeAuthenticatedRequest(method, endpoint, data = null, retries = 1) {
    try {
      const accessToken = await this.getAccessToken();
      
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      // Handle rate limiting
      if (error.response?.status === 429 && retries > 0) {
        const retryAfter = error.response.headers['retry-after'] || 1;
        console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.makeAuthenticatedRequest(method, endpoint, data, retries - 1);
      }

      // Handle unauthorized (token expired)
      if (error.response?.status === 401 && retries > 0) {
        console.log('Token expired, refreshing and retrying...');
        const auth = await getRow('SELECT refresh_token FROM spotify_auth WHERE id = 1');
        if (auth?.refresh_token) {
          await this.refreshAccessToken(auth.refresh_token);
          return this.makeAuthenticatedRequest(method, endpoint, data, retries - 1);
        }
      }

      console.error('Spotify API error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Search for tracks
   */
  async searchTracks(query, limit = 20) {
    try {
      const params = new URLSearchParams({
        q: query,
        type: 'track',
        limit: limit.toString(),
        market: 'US'
      });

      const data = await this.makeAuthenticatedRequest('GET', `/search?${params.toString()}`);
      
      return data.tracks.items.map(track => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: track.artists.map(artist => artist.name),
        album: track.album.name,
        duration_ms: track.duration_ms,
        explicit: track.explicit,
        preview_url: track.preview_url,
        external_urls: track.external_urls,
        image: track.album.images?.[0]?.url
      }));
    } catch (error) {
      console.error('Error searching tracks:', error);
      throw new Error('Failed to search tracks');
    }
  }

  /**
   * Get track info by URI or ID
   */
  async getTrack(trackId) {
    try {
      // Extract track ID from URI if needed
      const id = trackId.includes('spotify:track:') ? 
        trackId.split(':')[2] : 
        trackId.replace('https://open.spotify.com/track/', '').split('?')[0];

      const track = await this.makeAuthenticatedRequest('GET', `/tracks/${id}`);
      
      return {
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: track.artists.map(artist => artist.name),
        album: track.album.name,
        duration_ms: track.duration_ms,
        explicit: track.explicit,
        preview_url: track.preview_url,
        external_urls: track.external_urls,
        image: track.album.images?.[0]?.url
      };
    } catch (error) {
      console.error('Error getting track:', error);
      throw new Error('Failed to get track information');
    }
  }

  /**
   * Add track to playback queue
   */
  async addToQueue(trackUri, deviceId = null) {
    try {
      const params = new URLSearchParams({ uri: trackUri });
      if (deviceId) {
        params.append('device_id', deviceId);
      }

      await this.makeAuthenticatedRequest('POST', `/me/player/queue?${params.toString()}`);
      return true;
    } catch (error) {
      console.error('Error adding to queue:', error);
      throw new Error('Failed to add track to queue');
    }
  }

  /**
   * Add track to playlist
   */
  async addToPlaylist(playlistId, trackUri) {
    try {
      await this.makeAuthenticatedRequest('POST', `/playlists/${playlistId}/tracks`, {
        uris: [trackUri]
      });
      return true;
    } catch (error) {
      console.error('Error adding to playlist:', error);
      throw new Error('Failed to add track to playlist');
    }
  }

  /**
   * Get current playback state
   */
  async getCurrentPlayback() {
    try {
      const data = await this.makeAuthenticatedRequest('GET', '/me/player');
      return data;
    } catch (error) {
      if (error.response?.status === 204) {
        // No active device
        return null;
      }
      console.error('Error getting current playback:', error);
      throw new Error('Failed to get current playback state');
    }
  }

  /**
   * Get user's devices
   */
  async getDevices() {
    try {
      const data = await this.makeAuthenticatedRequest('GET', '/me/player/devices');
      return data.devices;
    } catch (error) {
      console.error('Error getting devices:', error);
      throw new Error('Failed to get user devices');
    }
  }

  /**
   * Skip to next track
   */
  async skipToNext(deviceId = null) {
    try {
      const params = deviceId ? `?device_id=${deviceId}` : '';
      await this.makeAuthenticatedRequest('POST', `/me/player/next${params}`);
      return true;
    } catch (error) {
      console.error('Error skipping track:', error);
      throw new Error('Failed to skip track');
    }
  }

  /**
   * Pause/resume playback
   */
  async pausePlayback(deviceId = null) {
    try {
      const params = deviceId ? `?device_id=${deviceId}` : '';
      await this.makeAuthenticatedRequest('PUT', `/me/player/pause${params}`);
      return true;
    } catch (error) {
      console.error('Error pausing playback:', error);
      throw new Error('Failed to pause playback');
    }
  }

  async resumePlayback(deviceId = null) {
    try {
      const params = deviceId ? `?device_id=${deviceId}` : '';
      await this.makeAuthenticatedRequest('PUT', `/me/player/play${params}`);
      return true;
    } catch (error) {
      console.error('Error resuming playback:', error);
      throw new Error('Failed to resume playback');
    }
  }

  /**
   * Check if service is authenticated
   */
  async isAuthenticated() {
    try {
      const auth = await getRow('SELECT * FROM spotify_auth WHERE id = 1');
      return !!(auth && auth.access_token && auth.refresh_token);
    } catch (error) {
      return false;
    }
  }
}

module.exports = new SpotifyService();