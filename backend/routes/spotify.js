const express = require('express');
const spotifyService = require('../services/spotifyService');
const authService = require('../services/authService');

const router = express.Router();

/**
 * GET /api/spotify/auth
 * Start Spotify OAuth flow
 */
router.get('/auth', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const authData = spotifyService.getAuthorizationURL();
    
    // Store code verifier in session or temporary storage
    // For simplicity, we'll return it to be stored client-side
    // In production, consider using server-side session storage
    
    res.json({
      auth_url: authData.url,
      state: authData.state,
      code_challenge: authData.codeChallenge
    });

  } catch (error) {
    console.error('Error starting Spotify auth:', error);
    res.status(500).json({ 
      error: 'Failed to start Spotify authentication' 
    });
  }
});

/**
 * POST /api/spotify/callback
 * Handle Spotify OAuth callback
 */
router.post('/callback', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { code, state, code_verifier } = req.body;
    
    if (!code || !code_verifier) {
      return res.status(400).json({ 
        error: 'Authorization code and code verifier are required' 
      });
    }

    // Exchange authorization code for access token
    const tokenData = await spotifyService.exchangeCodeForToken(code, code_verifier);
    
    res.json({
      success: true,
      message: 'Spotify authentication successful',
      expires_in: tokenData.expires_in,
      scope: tokenData.scope
    });

  } catch (error) {
    console.error('Error in Spotify callback:', error);
    res.status(400).json({ 
      error: 'Failed to complete Spotify authentication' 
    });
  }
});

/**
 * GET /api/spotify/status
 * Check Spotify authentication status
 */
router.get('/status', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const isAuthenticated = await spotifyService.isAuthenticated();
    
    let userInfo = null;
    let devices = [];
    
    if (isAuthenticated) {
      try {
        // Get current user info
        const userData = await spotifyService.makeAuthenticatedRequest('GET', '/me');
        userInfo = {
          id: userData.id,
          display_name: userData.display_name,
          email: userData.email,
          country: userData.country,
          product: userData.product
        };

        // Get available devices
        devices = await spotifyService.getDevices();
      } catch (error) {
        console.error('Error getting Spotify user info:', error);
      }
    }

    res.json({
      authenticated: isAuthenticated,
      user: userInfo,
      devices: devices
    });

  } catch (error) {
    console.error('Error checking Spotify status:', error);
    res.status(500).json({ 
      error: 'Failed to check Spotify status' 
    });
  }
});

/**
 * DELETE /api/spotify/disconnect
 * Disconnect Spotify account
 */
router.delete('/disconnect', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { runQuery } = require('../db/db');
    
    // Remove stored tokens
    await runQuery('DELETE FROM spotify_auth WHERE id = 1');
    
    res.json({
      success: true,
      message: 'Spotify account disconnected successfully'
    });

  } catch (error) {
    console.error('Error disconnecting Spotify:', error);
    res.status(500).json({ 
      error: 'Failed to disconnect Spotify account' 
    });
  }
});

/**
 * GET /api/spotify/playlists
 * Get user's playlists for configuration
 */
router.get('/playlists', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const playlists = await spotifyService.makeAuthenticatedRequest('GET', '/me/playlists?limit=50');
    
    const userPlaylists = playlists.items
      .filter(playlist => playlist.owner.id) // Only user's playlists
      .map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        public: playlist.public,
        collaborative: playlist.collaborative,
        tracks_total: playlist.tracks.total,
        images: playlist.images
      }));

    res.json({
      playlists: userPlaylists
    });

  } catch (error) {
    console.error('Error getting playlists:', error);
    res.status(500).json({ 
      error: 'Failed to get playlists' 
    });
  }
});

/**
 * POST /api/spotify/create-playlist
 * Create a new party playlist
 */
router.post('/create-playlist', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { name = 'Party DJ Requests', description = 'Songs requested at the party', public: isPublic = false } = req.body;
    
    // Get current user ID
    const userData = await spotifyService.makeAuthenticatedRequest('GET', '/me');
    
    // Create playlist
    const playlist = await spotifyService.makeAuthenticatedRequest('POST', `/users/${userData.id}/playlists`, {
      name: name,
      description: description,
      public: isPublic
    });

    // Update settings with new playlist ID
    const { runQuery } = require('../db/db');
    await runQuery(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('party_playlist_id', ?, CURRENT_TIMESTAMP)
    `, [playlist.id]);

    res.json({
      success: true,
      message: 'Party playlist created successfully',
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        external_urls: playlist.external_urls
      }
    });

  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ 
      error: 'Failed to create playlist' 
    });
  }
});

module.exports = router;