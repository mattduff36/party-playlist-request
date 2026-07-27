import { NextRequest, NextResponse } from 'next/server';
import { createRequest } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';
import { triggerRequestSubmitted } from '@/lib/pusher';
import { requireAuth } from '@/middleware/auth';
import { getTrackAlbumImageUrl } from '@/lib/spotify-album-art';

// Predefined list of popular songs for random selection
const POPULAR_SONGS = [
  // Electronic/Dance
  'Levels Avicii',
  'Titanium David Guetta',
  'Animals Martin Garrix',
  'Clarity Zedd',
  'Wake Me Up Avicii',
  'Lean On Major Lazer',
  'Closer Chainsmokers',
  'Something Just Like This Chainsmokers',
  'Don\'t Let Me Down Chainsmokers',
  'Silence Marshmello',
  
  // Pop Hits
  'Shape of You Ed Sheeran',
  'Blinding Lights The Weeknd',
  'Watermelon Sugar Harry Styles',
  'Levitating Dua Lipa',
  'Good 4 U Olivia Rodrigo',
  'Anti-Hero Taylor Swift',
  'As It Was Harry Styles',
  'Heat Waves Glass Animals',
  'Stay The Kid LAROI',
  'Industry Baby Lil Nas X',
  
  // Classic Party Songs
  'Mr. Brightside The Killers',
  'Don\'t Stop Me Now Queen',
  'Sweet Caroline Neil Diamond',
  'Livin\' on a Prayer Bon Jovi',
  'Dancing Queen ABBA',
  'I Want It That Way Backstreet Boys',
  'Uptown Funk Bruno Mars',
  'Can\'t Stop the Feeling Justin Timberlake',
  'Happy Pharrell Williams',
  'Shut Up and Dance Walk the Moon',
  
  // Hip Hop/R&B
  'God\'s Plan Drake',
  'HUMBLE. Kendrick Lamar',
  'Sicko Mode Travis Scott',
  'Old Town Road Lil Nas X',
  'Sunflower Post Malone',
  'Circles Post Malone',
  'Rockstar Post Malone',
  'Bad Guy Billie Eilish',
  'Therefore I Am Billie Eilish',
  'Peaches Justin Bieber',
  
  // Rock/Alternative
  'Somebody Told Me The Killers',
  'Use Somebody Kings of Leon',
  'Pumped Up Kicks Foster the People',
  'Radioactive Imagine Dragons',
  'Believer Imagine Dragons',
  'Thunder Imagine Dragons',
  'High Hopes Panic! At The Disco',
  'Bohemian Rhapsody Queen',
  'Sweet Child O\' Mine Guns N\' Roses',
  'Livin\' After Midnight Judas Priest'
];

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🎲 [${requestId}] Random song request endpoint called`);
  const startTime = Date.now();
  
  try {
    // Authenticate and get user info
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`✅ [${requestId}] User ${auth.user.username} (${userId}) adding random song`);

    // Select a random song from our list
    const randomQuery = POPULAR_SONGS[Math.floor(Math.random() * POPULAR_SONGS.length)];
    console.log(`🎲 [${requestId}] Selected random query: "${randomQuery}"`);

    // Search for the song on Spotify (with userId for multi-tenant)
    console.log(`🔍 [${requestId}] Searching Spotify for: "${randomQuery}"`);
    let searchResult;
    try {
      searchResult = await spotifyService.searchTracks(randomQuery, 10, userId);
      console.log(`✅ [${requestId}] Search completed (${Date.now() - startTime}ms)`);
    } catch (error) {
      console.log(`❌ [${requestId}] Search failed (${Date.now() - startTime}ms):`, error);
      return NextResponse.json({ 
        error: 'Unable to search for random song. Spotify may be unavailable.' 
      }, { status: 503 });
    }

    // Get the first track from search results
    const tracks = searchResult?.tracks?.items || [];
    if (tracks.length === 0) {
      console.log(`❌ [${requestId}] No tracks found for query: "${randomQuery}"`);
      return NextResponse.json({ 
        error: 'No tracks found for random selection. Please try again.' 
      }, { status: 404 });
    }

    // Select the first track (usually the most relevant)
    const selectedTrack = tracks[0];
    const albumImageUrl = getTrackAlbumImageUrl(selectedTrack) || null;
    console.log(`🎵 [${requestId}] Selected track: "${selectedTrack.name}" by ${selectedTrack.artists?.map((a: { name: string }) => a.name).join(', ')}`);

    // Create the request in the database
    console.log(`💾 [${requestId}] Creating database request...`);
    const newRequest = await createRequest({
      track_uri: selectedTrack.uri,
      track_name: selectedTrack.name,
      artist_name: selectedTrack.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
      album_name: selectedTrack.album?.name || 'Unknown Album',
      album_image_url: albumImageUrl,
      duration_ms: selectedTrack.duration_ms || 0,
      requester_ip_hash: 'admin_random', // Special identifier for admin-generated requests
      requester_nickname: 'PartyPlaylist Suggestion',
      status: 'pending',
      spotify_added_to_queue: false,
      spotify_added_to_playlist: false
    }, userId); // Multi-tenant: Pass userId as second parameter
    console.log(`✅ [${requestId}] Request created successfully (${Date.now() - startTime}ms total)`);

    // 🚀 PUSHER: Trigger real-time event for new request submission (with userId)
    try {
      await triggerRequestSubmitted({
        id: newRequest.id,
        track_name: selectedTrack.name,
        artist_name: selectedTrack.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
        album_name: selectedTrack.album?.name || 'Unknown Album',
        album_image_url: albumImageUrl,
        track_uri: selectedTrack.uri,
        requester_nickname: 'PartyPlaylist Suggestion',
        submitted_at: new Date().toISOString(),
        userId,
      });
      console.log(`🎉 [${requestId}] Pusher event sent for random request: ${selectedTrack.name}`);
    } catch (pusherError) {
      console.error(`❌ [${requestId}] Failed to send Pusher event:`, pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({
      success: true,
      message: 'Random song added successfully!',
      request: {
        id: newRequest.id,
        track: {
          name: selectedTrack.name,
          artists: selectedTrack.artists,
          album: selectedTrack.album,
          duration_ms: selectedTrack.duration_ms
        },
        requester_nickname: 'PartyPlaylist Suggestion',
        status: 'pending'
      }
    }, { status: 201 });

  } catch (error) {
    console.error(`❌ [${requestId}] Error adding random song (${Date.now() - startTime}ms):`, error);
    return NextResponse.json({ 
      error: 'Failed to add random song. Please try again.' 
    }, { status: 500 });
  }
}
