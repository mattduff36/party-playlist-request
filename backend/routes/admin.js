const express = require('express');
const { runQuery, getAllRows, getRow } = require('../db/db');
const authService = require('../services/authService');
const spotifyService = require('../services/spotifyService');

const router = express.Router();

/**
 * POST /api/admin/login
 * Admin login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    // Authenticate admin
    const authResult = await authService.authenticateAdmin(username, password);
    
    res.json({
      success: true,
      message: 'Login successful',
      token: authResult.token,
      admin: authResult.admin
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(401).json({ 
      error: 'Invalid credentials' 
    });
  }
});

/**
 * GET /api/admin/requests
 * Get requests with optional filtering
 */
router.get('/requests', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { 
      status = 'all', 
      limit = 50, 
      offset = 0,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    let whereClause = '';
    let params = [];

    if (status !== 'all') {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }

    const validSorts = ['created_at', 'track_name', 'artist_name', 'status'];
    const validOrders = ['ASC', 'DESC'];
    
    const sortColumn = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    const requests = await getAllRows(`
      SELECT 
        id, track_uri, track_name, artist_name, album_name,
        duration_ms, requester_nickname, status, created_at,
        approved_at, approved_by, rejection_reason,
        spotify_added_to_queue, spotify_added_to_playlist
      FROM requests 
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get total count for pagination
    const totalResult = await getAllRows(`
      SELECT COUNT(*) as total FROM requests ${whereClause}
    `, params);

    res.json({
      requests,
      pagination: {
        total: totalResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: totalResult[0].total > parseInt(offset) + parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error getting requests:', error);
    res.status(500).json({ 
      error: 'Failed to get requests' 
    });
  }
});

/**
 * POST /api/admin/approve/:id
 * Approve a request and add to Spotify queue/playlist
 */
router.post('/approve/:id', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { id } = req.params;
    const { add_to_queue = true, add_to_playlist = true } = req.body;
    
    // Get the request
    const request = await getRow(
      'SELECT * FROM requests WHERE id = ? AND status = ?',
      [id, 'pending']
    );

    if (!request) {
      return res.status(404).json({ 
        error: 'Request not found or already processed' 
      });
    }

    let queueSuccess = false;
    let playlistSuccess = false;
    let errors = [];

    // Add to Spotify queue if requested
    if (add_to_queue) {
      try {
        // Get target device from settings or use default
        const deviceSetting = await getRow(
          'SELECT value FROM settings WHERE key = ?',
          ['target_device_id']
        );
        
        await spotifyService.addToQueue(
          request.track_uri, 
          deviceSetting?.value || null
        );
        queueSuccess = true;
      } catch (error) {
        console.error('Error adding to queue:', error);
        errors.push('Failed to add to Spotify queue');
      }
    }

    // Add to playlist if requested
    if (add_to_playlist) {
      try {
        // Get party playlist ID from settings
        const playlistSetting = await getRow(
          'SELECT value FROM settings WHERE key = ?',
          ['party_playlist_id']
        );

        if (!playlistSetting?.value) {
          errors.push('Party playlist not configured');
        } else {
          await spotifyService.addToPlaylist(
            playlistSetting.value,
            request.track_uri
          );
          playlistSuccess = true;
        }
      } catch (error) {
        console.error('Error adding to playlist:', error);
        errors.push('Failed to add to party playlist');
      }
    }

    // Update request status
    const newStatus = (queueSuccess || playlistSuccess) ? 'approved' : 'failed';
    
    await runQuery(`
      UPDATE requests SET 
        status = ?,
        approved_at = CURRENT_TIMESTAMP,
        approved_by = ?,
        spotify_added_to_queue = ?,
        spotify_added_to_playlist = ?
      WHERE id = ?
    `, [
      newStatus,
      req.admin.username,
      queueSuccess,
      playlistSuccess,
      id
    ]);

    res.json({
      success: true,
      message: 'Request processed',
      result: {
        status: newStatus,
        queue_added: queueSuccess,
        playlist_added: playlistSuccess,
        errors: errors.length > 0 ? errors : null
      }
    });

  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ 
      error: 'Failed to approve request' 
    });
  }
});

/**
 * POST /api/admin/reject/:id
 * Reject a request
 */
router.post('/reject/:id', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Check if request exists and is pending
    const request = await getRow(
      'SELECT id FROM requests WHERE id = ? AND status = ?',
      [id, 'pending']
    );

    if (!request) {
      return res.status(404).json({ 
        error: 'Request not found or already processed' 
      });
    }

    // Update request status to rejected
    await runQuery(`
      UPDATE requests SET 
        status = 'rejected',
        approved_at = CURRENT_TIMESTAMP,
        approved_by = ?,
        rejection_reason = ?
      WHERE id = ?
    `, [req.admin.username, reason || 'No reason provided', id]);

    res.json({
      success: true,
      message: 'Request rejected successfully'
    });

  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ 
      error: 'Failed to reject request' 
    });
  }
});

/**
 * GET /api/admin/queue
 * Get current Spotify playback queue
 */
router.get('/queue', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const playbackState = await spotifyService.getCurrentPlayback();
    
    if (!playbackState) {
      return res.json({
        is_playing: false,
        current_track: null,
        queue: [],
        device: null,
        message: 'No active playback device found'
      });
    }

    res.json({
      is_playing: playbackState.is_playing,
      current_track: playbackState.item ? {
        name: playbackState.item.name,
        artists: playbackState.item.artists.map(a => a.name),
        album: playbackState.item.album.name,
        duration_ms: playbackState.item.duration_ms,
        progress_ms: playbackState.progress_ms,
        uri: playbackState.item.uri
      } : null,
      device: playbackState.device ? {
        id: playbackState.device.id,
        name: playbackState.device.name,
        type: playbackState.device.type,
        volume_percent: playbackState.device.volume_percent
      } : null,
      shuffle_state: playbackState.shuffle_state,
      repeat_state: playbackState.repeat_state
    });

  } catch (error) {
    console.error('Error getting queue:', error);
    res.status(500).json({ 
      error: 'Failed to get playback queue' 
    });
  }
});

/**
 * GET /api/admin/devices
 * Get available Spotify devices
 */
router.get('/devices', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const devices = await spotifyService.getDevices();
    
    res.json({
      devices: devices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type,
        is_active: device.is_active,
        is_private_session: device.is_private_session,
        is_restricted: device.is_restricted,
        volume_percent: device.volume_percent
      }))
    });

  } catch (error) {
    console.error('Error getting devices:', error);
    res.status(500).json({ 
      error: 'Failed to get devices' 
    });
  }
});

/**
 * POST /api/admin/playback/skip
 * Skip to next track
 */
router.post('/playback/skip', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { device_id } = req.body;
    
    await spotifyService.skipToNext(device_id);
    
    res.json({
      success: true,
      message: 'Skipped to next track'
    });

  } catch (error) {
    console.error('Error skipping track:', error);
    res.status(500).json({ 
      error: 'Failed to skip track' 
    });
  }
});

/**
 * POST /api/admin/playback/pause
 * Pause playback
 */
router.post('/playback/pause', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { device_id } = req.body;
    
    await spotifyService.pausePlayback(device_id);
    
    res.json({
      success: true,
      message: 'Playback paused'
    });

  } catch (error) {
    console.error('Error pausing playback:', error);
    res.status(500).json({ 
      error: 'Failed to pause playback' 
    });
  }
});

/**
 * POST /api/admin/playback/resume
 * Resume playback
 */
router.post('/playback/resume', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { device_id } = req.body;
    
    await spotifyService.resumePlayback(device_id);
    
    res.json({
      success: true,
      message: 'Playback resumed'
    });

  } catch (error) {
    console.error('Error resuming playback:', error);
    res.status(500).json({ 
      error: 'Failed to resume playback' 
    });
  }
});

/**
 * GET /api/admin/stats
 * Get admin statistics
 */
router.get('/stats', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    // Get various statistics
    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      todayRequests,
      recentRequests
    ] = await Promise.all([
      getAllRows('SELECT COUNT(*) as count FROM requests'),
      getAllRows('SELECT COUNT(*) as count FROM requests WHERE status = "pending"'),
      getAllRows('SELECT COUNT(*) as count FROM requests WHERE status = "approved"'),
      getAllRows('SELECT COUNT(*) as count FROM requests WHERE status = "rejected"'),
      getAllRows('SELECT COUNT(*) as count FROM requests WHERE DATE(created_at) = DATE("now")'),
      getAllRows('SELECT COUNT(*) as count FROM requests WHERE created_at > datetime("now", "-1 hour")')
    ]);

    // Get top requested artists (last 7 days)
    const topArtists = await getAllRows(`
      SELECT artist_name, COUNT(*) as request_count
      FROM requests 
      WHERE created_at > datetime('now', '-7 days')
      GROUP BY artist_name
      ORDER BY request_count DESC
      LIMIT 10
    `);

    res.json({
      total_requests: totalRequests[0].count,
      pending_requests: pendingRequests[0].count,
      approved_requests: approvedRequests[0].count,
      rejected_requests: rejectedRequests[0].count,
      today_requests: todayRequests[0].count,
      recent_requests: recentRequests[0].count,
      top_artists: topArtists,
      spotify_connected: await spotifyService.isAuthenticated()
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ 
      error: 'Failed to get statistics' 
    });
  }
});

/**
 * GET /api/admin/settings
 * Get admin settings
 */
router.get('/settings', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const settings = await getAllRows('SELECT key, value FROM settings');
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });

    res.json({ settings: settingsObj });

  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ 
      error: 'Failed to get settings' 
    });
  }
});

/**
 * POST /api/admin/settings
 * Update admin settings
 */
router.post('/settings', authService.requireAdminAuth.bind(authService), async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ 
        error: 'Settings object is required' 
      });
    }

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      await runQuery(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [key, value]);
    }

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ 
      error: 'Failed to update settings' 
    });
  }
});

module.exports = router;