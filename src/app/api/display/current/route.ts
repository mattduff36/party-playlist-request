import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';
import { getEventSettings, getRequestsByStatus } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Extract username from query params for multi-tenant support
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Get user_id from username
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    // Get user-specific event settings and current playback (MULTI-TENANT!)
    const [eventSettings, playbackState] = await Promise.all([
      getEventSettings(userId),
      spotifyService.getCurrentPlayback(userId).catch(() => null)
    ]);
    
    // Process current track with album art from existing data
    let currentTrack = null;
    if (playbackState?.item) {
      // Use album art from the playback response instead of making additional API calls
      const albumImages = playbackState.item.album?.images || [];
      const imageUrl = albumImages.length > 0 ? 
        (albumImages[1]?.url || albumImages[0]?.url) : null;
      
      currentTrack = {
        name: playbackState.item.name,
        artists: playbackState.item.artists.map((a: any) => a.name),
        album: playbackState.item.album.name,
        duration_ms: playbackState.item.duration_ms,
        progress_ms: playbackState.progress_ms,
        uri: playbackState.item.uri,
        image_url: imageUrl
      };
    }

    // Get queue data with album art from existing data and approved requests (MULTI-TENANT!)
    let upcomingSongs = [];
    try {
      const [queueData, approvedRequests] = await Promise.all([
        spotifyService.getQueue(userId).catch(() => null),
        getRequestsByStatus('approved', 10, 0, userId).catch(() => [])
      ]);
      
      if (queueData?.queue) {
        upcomingSongs = queueData.queue.map((item: any) => {
          // Use album art from the queue response instead of making additional API calls
          const albumImages = item.album?.images || [];
          const imageUrl = albumImages.length > 0 ? 
            (albumImages[1]?.url || albumImages[0]?.url) : null;
          
          // Find matching approved request to get requester name
          const matchingRequest = approvedRequests.find((req: any) => req.track_uri === item.uri);
          
          return {
            name: item.name,
            artists: item.artists.map((a: any) => a.name),
            album: item.album.name,
            uri: item.uri,
            image_url: imageUrl,
            requester_nickname: matchingRequest?.requester_nickname || null
          };
        });
      }
    } catch (error) {
      console.error('Error getting queue for display:', error);
      // Continue without queue data
    }
    
    // Ensure complete settings with all display customization fields
    const completeSettings = {
      ...eventSettings,
      theme_primary_color: (eventSettings as any).theme_primary_color || '#1DB954',
      theme_secondary_color: (eventSettings as any).theme_secondary_color || '#191414',
      theme_tertiary_color: (eventSettings as any).theme_tertiary_color || '#1ed760',
      show_approval_messages: (eventSettings as any).show_approval_messages ?? false,
      show_scrolling_bar: (eventSettings as any).show_scrolling_bar ?? true,
      qr_boost_duration: (eventSettings as any).qr_boost_duration || 5,
    };

    return NextResponse.json({
      event_settings: completeSettings,
      current_track: currentTrack,
      upcoming_songs: upcomingSongs,
      is_playing: playbackState?.is_playing || false
    });
    
  } catch (error) {
    console.error('Error getting display data:', error);
    
    // Return minimal data even if there's an error
    try {
      // Try to get userId from username for settings
      const { searchParams } = new URL(req.url);
      const username = searchParams.get('username');
      let userId: string | undefined;
      
      if (username) {
        const { getPool } = await import('@/lib/db');
        const pool = getPool();
        const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        userId = userResult.rows[0]?.id;
      }
      
      const eventSettings = await getEventSettings(userId);
      const completeSettings = {
        ...eventSettings,
        theme_primary_color: (eventSettings as any).theme_primary_color || '#1DB954',
        theme_secondary_color: (eventSettings as any).theme_secondary_color || '#191414',
        theme_tertiary_color: (eventSettings as any).theme_tertiary_color || '#1ed760',
        show_approval_messages: (eventSettings as any).show_approval_messages ?? false,
        show_scrolling_bar: (eventSettings as any).show_scrolling_bar ?? true,
        qr_boost_duration: (eventSettings as any).qr_boost_duration || 5,
      };
      return NextResponse.json({
        event_settings: completeSettings,
        current_track: null,
        upcoming_songs: [],
        is_playing: false
      });
    } catch (settingsError) {
      return NextResponse.json({
        event_settings: {
          event_title: 'Party DJ Requests',
          dj_name: '',
          venue_info: '',
          welcome_message: 'Request your favorite songs!',
          secondary_message: 'Your requests will be reviewed by the DJ',
          tertiary_message: 'Keep the party going!',
          show_qr_code: true,
          display_refresh_interval: 20,
          theme_primary_color: '#1DB954',
          theme_secondary_color: '#191414',
          theme_tertiary_color: '#1ed760',
          show_approval_messages: false,
          show_scrolling_bar: true,
          qr_boost_duration: 5,
        },
        current_track: null,
        upcoming_songs: [],
        is_playing: false
      });
    }
  }
}
