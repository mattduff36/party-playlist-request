import { NextRequest, NextResponse } from 'next/server';
import { getEventSettings, getRequestsByStatus } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Get user_id from username
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;

    // Get event settings
    const settings = await getEventSettings();

    // Get current playback
    let currentTrack = null;
    let upcomingSongs = [];
    
    try {
      const playbackState = await spotifyService.getCurrentPlayback();
      
      if (playbackState && playbackState.item) {
        // Album art is already in the playback response
        const albumArt = playbackState.item.album?.images?.[0]?.url || null;
        
        currentTrack = {
          name: playbackState.item.name,
          artists: playbackState.item.artists.map((a: any) => a.name),
          album: playbackState.item.album.name,
          duration_ms: playbackState.item.duration_ms,
          progress_ms: playbackState.progress_ms,
          uri: playbackState.item.uri,
          image_url: albumArt
        };
      }

      // Get queue (upcoming songs) - these come from approved requests
      const approvedRequests = await getRequestsByStatus('approved', 20, 0, userId);
      upcomingSongs = approvedRequests.map(req => ({
        name: req.track_name,
        artists: req.artist_name.split(', '),
        album: req.album_name,
        uri: req.track_uri,
        requester_nickname: req.requester_nickname
      }));
    } catch (error) {
      console.error('Error fetching Spotify data:', error);
      // Continue without playback data
    }

    return NextResponse.json({
      event_settings: {
        event_title: settings.event_title || 'Party DJ Requests',
        welcome_message: settings.welcome_message || 'Request your favorite songs!',
        secondary_message: settings.secondary_message || 'Your requests will be reviewed by the DJ',
        tertiary_message: settings.tertiary_message || 'Keep the party going!',
        show_qr_code: settings.show_qr_code ?? true,
        display_refresh_interval: settings.display_refresh_interval || 20,
      },
      current_track: currentTrack,
      upcoming_songs: upcomingSongs
    });

  } catch (error) {
    console.error('Error fetching display data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch display data' },
      { status: 500 }
    );
  }
}
