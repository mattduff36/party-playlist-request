import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getRequest, updateRequest, getSetting } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await authService.requireAdminAuth(req);
    const { id } = await params;
    
    const body = await req.json();
    const { add_to_queue = true, add_to_playlist = true } = body;
    
    const request = await getRequest(id);

    if (!request || request.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Request not found or already processed' 
      }, { status: 404 });
    }

    let queueSuccess = false;
    let playlistSuccess = false;
    let errors: string[] = [];

    // Add to Spotify queue if requested
    if (add_to_queue) {
      try {
        const deviceSetting = await getSetting('target_device_id');
        await spotifyService.addToQueue(request.track_uri, deviceSetting || undefined);
        queueSuccess = true;
      } catch (error) {
        console.error('Error adding to queue:', error);
        errors.push('Failed to add to Spotify queue');
      }
    }

    // Add to playlist if requested
    if (add_to_playlist) {
      try {
        const playlistSetting = await getSetting('party_playlist_id');

        if (!playlistSetting) {
          errors.push('Party playlist not configured');
        } else {
          await spotifyService.addToPlaylist(playlistSetting, request.track_uri);
          playlistSuccess = true;
        }
      } catch (error) {
        console.error('Error adding to playlist:', error);
        errors.push('Failed to add to party playlist');
      }
    }

    const newStatus = (queueSuccess || playlistSuccess) ? 'approved' : 'failed';
    
    await updateRequest(id, {
      status: newStatus,
      approved_at: new Date().toISOString(),
      approved_by: admin.username,
      spotify_added_to_queue: queueSuccess,
      spotify_added_to_playlist: playlistSuccess
    });

    return NextResponse.json({
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
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error approving request:', error);
    return NextResponse.json({ 
      error: 'Failed to approve request' 
    }, { status: 500 });
  }
}