const express = require('express');
const rateLimit = require('express-rate-limit');
const { runQuery, getAllRows, hashIP, generateUUID } = require('../db/db');
const spotifyService = require('../services/spotifyService');

const router = express.Router();

// Specific rate limiting for guest requests
const requestLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 1, // 1 request per 30 seconds per IP
  message: { error: 'Please wait 30 seconds before making another request.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const hourlyRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per IP
  message: { error: 'Maximum 10 requests per hour exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/request
 * Submit a song request
 */
router.post('/request', requestLimiter, hourlyRequestLimiter, async (req, res) => {
  try {
    const { track_uri, track_url, requester_nickname } = req.body;
    
    // Validate input
    if (!track_uri && !track_url) {
      return res.status(400).json({ 
        error: 'Either track_uri or track_url is required' 
      });
    }

    let trackUri = track_uri;
    
    // Convert Spotify URL to URI if needed
    if (track_url && !track_uri) {
      if (track_url.includes('open.spotify.com/track/')) {
        const trackId = track_url.split('/track/')[1].split('?')[0];
        trackUri = `spotify:track:${trackId}`;
      } else if (track_url.includes('spotify:track:')) {
        trackUri = track_url;
      } else {
        return res.status(400).json({ 
          error: 'Invalid Spotify URL or URI format' 
        });
      }
    }

    // Validate track URI format
    if (!trackUri.startsWith('spotify:track:')) {
      return res.status(400).json({ 
        error: 'Invalid Spotify track URI format' 
      });
    }

    // Get track information from Spotify
    let trackInfo;
    try {
      trackInfo = await spotifyService.getTrack(trackUri);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Unable to find track on Spotify. Please check the URL/URI.' 
      });
    }

    // Check if track has already been requested recently (last 30 minutes)
    const recentDuplicate = await getAllRows(`
      SELECT id FROM requests 
      WHERE track_uri = ? 
      AND created_at > datetime('now', '-30 minutes')
      AND status IN ('pending', 'approved', 'queued')
    `, [trackUri]);

    if (recentDuplicate.length > 0) {
      return res.status(409).json({ 
        error: 'This track has already been requested recently. Please choose a different song.' 
      });
    }

    // Get requester IP hash
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const ipHash = hashIP(clientIP);

    // Create request record
    const requestId = generateUUID();
    
    await runQuery(`
      INSERT INTO requests (
        id, track_uri, track_name, artist_name, album_name, 
        duration_ms, requester_ip_hash, requester_nickname, 
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `, [
      requestId,
      trackInfo.uri,
      trackInfo.name,
      trackInfo.artists.join(', '),
      trackInfo.album,
      trackInfo.duration_ms,
      ipHash,
      requester_nickname || null
    ]);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Your request has been submitted successfully!',
      request: {
        id: requestId,
        track: {
          name: trackInfo.name,
          artists: trackInfo.artists,
          album: trackInfo.album,
          duration_ms: trackInfo.duration_ms
        },
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Error submitting request:', error);
    res.status(500).json({ 
      error: 'Failed to submit request. Please try again.' 
    });
  }
});

/**
 * GET /api/search
 * Search for tracks on Spotify
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search query must be at least 2 characters long' 
      });
    }

    // Limit search results
    const searchLimit = Math.min(parseInt(limit) || 20, 50);
    
    // Search tracks using Spotify service
    const tracks = await spotifyService.searchTracks(query.trim(), searchLimit);
    
    res.json({
      tracks: tracks,
      query: query.trim(),
      total: tracks.length
    });

  } catch (error) {
    console.error('Error searching tracks:', error);
    
    if (error.message.includes('authentication')) {
      return res.status(503).json({ 
        error: 'Music search is temporarily unavailable. Please try again later.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to search tracks. Please try again.' 
    });
  }
});

/**
 * GET /api/track/:id
 * Get track information by ID or URI
 */
router.get('/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        error: 'Track ID or URI is required' 
      });
    }

    // Get track information from Spotify
    const trackInfo = await spotifyService.getTrack(id);
    
    res.json({
      track: trackInfo
    });

  } catch (error) {
    console.error('Error getting track:', error);
    
    if (error.message.includes('Failed to get track')) {
      return res.status(404).json({ 
        error: 'Track not found' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get track information. Please try again.' 
    });
  }
});

/**
 * GET /api/status
 * Get public status information
 */
router.get('/status', async (req, res) => {
  try {
    // Get recent requests count (last hour)
    const recentRequests = await getAllRows(`
      SELECT COUNT(*) as count FROM requests 
      WHERE created_at > datetime('now', '-1 hour')
    `);

    // Get pending requests count
    const pendingRequests = await getAllRows(`
      SELECT COUNT(*) as count FROM requests 
      WHERE status = 'pending'
    `);

    // Check if Spotify is authenticated
    const spotifyAuth = await spotifyService.isAuthenticated();

    res.json({
      system_status: 'online',
      spotify_connected: spotifyAuth,
      recent_requests_count: recentRequests[0]?.count || 0,
      pending_requests_count: pendingRequests[0]?.count || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ 
      error: 'Failed to get system status' 
    });
  }
});

module.exports = router;