import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';
import { getEventSettings } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Get event settings and current playback (no auth required for display)
    const [eventSettings, playbackState] = await Promise.all([
      getEventSettings(),
      spotifyService.getCurrentPlayback().catch(() => null)
    ]);
    
    // Add album art to current track
    let currentTrack = null;
    if (playbackState?.item) {
      const albumArt = await spotifyService.getAlbumArt(playbackState.item.uri);
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

    // Get queue data
    let upcomingSongs = [];
    try {
      const queueData = await spotifyService.getQueue();
      if (queueData?.queue) {
        upcomingSongs = await Promise.all(
          queueData.queue.slice(0, 3).map(async (item: any) => {
            const albumArt = await spotifyService.getAlbumArt(item.uri);
            return {
              name: item.name,
              artists: item.artists.map((a: any) => a.name),
              album: item.album.name,
              uri: item.uri,
              image_url: albumArt
            };
          })
        );
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
