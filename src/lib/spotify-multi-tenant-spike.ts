/**
 * Spike 3: Multi-Tenant Spotify Service
 * Purpose: Validate that multiple users can use their own Spotify accounts simultaneously
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface SpotifyUser {
  user_id: string;
  username: string;
  spotify_access_token: string | null;
  spotify_refresh_token: string | null;
  spotify_token_expires_at: string | null;
}

/**
 * Multi-Tenant Spotify Service
 * Each instance is tied to a specific user
 */
export class SpotifyMultiTenantService {
  private userId: string;
  private username: string;
  private clientId: string;
  private clientSecret: string;
  private baseURL = 'https://api.spotify.com/v1';
  private authURL = 'https://accounts.spotify.com';

  constructor(userId: string, username: string) {
    this.userId = userId;
    this.username = username;
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    
    console.log(`🎵 [Spike] SpotifyMultiTenantService created for user: ${username} (${userId})`);
  }

  /**
   * Get user's Spotify tokens from database
   */
  async getTokens(): Promise<SpotifyTokens | null> {
    try {
      const result = await pool.query(
        'SELECT spotify_access_token, spotify_refresh_token, spotify_token_expires_at FROM users WHERE id = $1',
        [this.userId]
      );

      if (result.rows.length === 0) {
        console.log(`❌ [Spike] User ${this.username} not found in database`);
        return null;
      }

      const row = result.rows[0];

      if (!row.spotify_access_token) {
        console.log(`⚠️ [Spike] User ${this.username} has no Spotify tokens`);
        return null;
      }

      console.log(`✅ [Spike] Retrieved Spotify tokens for ${this.username}`);
      return {
        access_token: row.spotify_access_token,
        refresh_token: row.spotify_refresh_token,
        expires_at: row.spotify_token_expires_at
      };
    } catch (error) {
      console.error(`❌ [Spike] Error fetching tokens for ${this.username}:`, error);
      return null;
    }
  }

  /**
   * Store user's Spotify tokens in database
   */
  async storeTokens(tokens: SpotifyTokens): Promise<boolean> {
    try {
      await pool.query(
        `UPDATE users 
         SET spotify_access_token = $1, 
             spotify_refresh_token = $2, 
             spotify_token_expires_at = $3
         WHERE id = $4`,
        [tokens.access_token, tokens.refresh_token, tokens.expires_at, this.userId]
      );

      console.log(`✅ [Spike] Stored Spotify tokens for ${this.username}`);
      return true;
    } catch (error) {
      console.error(`❌ [Spike] Error storing tokens for ${this.username}:`, error);
      return false;
    }
  }

  /**
   * Check if user's token is expired
   */
  isTokenExpired(expiresAt: string): boolean {
    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const isExpired = now >= expiryTime;
    
    console.log(`🔍 [Spike] Token expiry check for ${this.username}: ${isExpired ? 'EXPIRED' : 'VALID'}`);
    return isExpired;
  }

  /**
   * Refresh user's access token
   */
  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      console.log(`🔄 [Spike] Refreshing token for ${this.username}...`);

      const response = await fetch(`${this.authURL}/api/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        console.error(`❌ [Spike] Token refresh failed for ${this.username}:`, response.status);
        return null;
      }

      const data = await response.json();
      
      // Store new token
      const newTokens: SpotifyTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken, // Some responses don't include new refresh token
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
      };

      await this.storeTokens(newTokens);

      console.log(`✅ [Spike] Token refreshed for ${this.username}`);
      return data.access_token;
    } catch (error) {
      console.error(`❌ [Spike] Error refreshing token for ${this.username}:`, error);
      return null;
    }
  }

  /**
   * Get valid access token (refreshes if needed)
   */
  async getValidAccessToken(): Promise<string | null> {
    const tokens = await this.getTokens();

    if (!tokens) {
      console.log(`❌ [Spike] No tokens available for ${this.username}`);
      return null;
    }

    // Check if token is expired
    if (this.isTokenExpired(tokens.expires_at)) {
      console.log(`⚠️ [Spike] Token expired for ${this.username}, refreshing...`);
      return await this.refreshAccessToken(tokens.refresh_token);
    }

    return tokens.access_token;
  }

  /**
   * Make authenticated Spotify API request
   */
  async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const requestId = Math.random().toString(36).substr(2, 6);
    console.log(`🌐 [Spike ${this.username}] ${method} ${endpoint} [${requestId}]`);

    // Get valid token
    const accessToken = await this.getValidAccessToken();

    if (!accessToken) {
      throw new Error(`No valid Spotify token for ${this.username}`);
    }

    const url = `${this.baseURL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status === 429) {
        console.error(`❌ [Spike ${this.username}] RATE LIMITED! [${requestId}]`);
        throw new Error('RATE_LIMITED');
      }

      console.error(`❌ [Spike ${this.username}] API error ${response.status} [${requestId}]`);
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ [Spike ${this.username}] Request successful [${requestId}]`);
    
    return result;
  }

  /**
   * Get user's current playback
   */
  async getCurrentPlayback(): Promise<any> {
    return await this.makeRequest('GET', '/me/player');
  }

  /**
   * Add track to queue
   */
  async addToQueue(trackUri: string): Promise<void> {
    await this.makeRequest('POST', `/me/player/queue?uri=${trackUri}`);
  }
}

/**
 * Get all users with Spotify connections
 */
export async function getUsersWithSpotify(): Promise<SpotifyUser[]> {
  try {
    const result = await pool.query(`
      SELECT id as user_id, username, 
             spotify_access_token, 
             spotify_refresh_token, 
             spotify_token_expires_at
      FROM users
      WHERE spotify_access_token IS NOT NULL
      ORDER BY username
    `);

    console.log(`📊 [Spike] Found ${result.rows.length} users with Spotify connections`);
    return result.rows;
  } catch (error) {
    console.error('❌ [Spike] Error fetching users with Spotify:', error);
    return [];
  }
}

/**
 * Create Spotify service instance for user
 */
export function createSpotifyServiceForUser(userId: string, username: string): SpotifyMultiTenantService {
  return new SpotifyMultiTenantService(userId, username);
}
