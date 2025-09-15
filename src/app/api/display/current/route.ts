import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';
import { getEventSettings, getRequestsByStatus } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Get event settings and current playback (no auth required for display)
    const [eventSettings, playbackState] = await Promise.all([
      getEventSettings(),
      spotifyService.getCurrentPlayback().catch(() => null)
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

    // Get queue data with album art from existing data and approved requests
    let upcomingSongs = [];
    try {
      const [queueData, approvedRequests] = await Promise.all([
        spotifyService.getQueue().catch(() => null),
        getRequestsByStatus('approved', 10).catch(() => [])
      ]);
      
      if (queueData?.queue) {
        upcomingSongs = queueData.queue.slice(0, 5).map((item: any) => {
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
    
    return NextResponse.json({
      event_settings: eventSettings,
      current_track: currentTrack,
      upcoming_songs: upcomingSongs,
      is_playing: playbackState?.is_playing || false
    });
    
  } catch (error) {
    console.error('Error getting display data:', error);
    
    // Return minimal data even if there's an error
    try {
      const eventSettings = await getEventSettings();
      return NextResponse.json({
        event_settings: eventSettings,
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
          display_refresh_interval: 20
        },
        current_track: null,
        upcoming_songs: [],
        is_playing: false
      });
    }
  }
}
