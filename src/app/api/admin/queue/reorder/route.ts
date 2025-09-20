import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const body = await req.json();
    const { fromIndex, toIndex } = body;
    
    if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') {
      return NextResponse.json({ 
        error: 'fromIndex and toIndex are required and must be numbers' 
      }, { status: 400 });
    }

    console.log(`🎵 Queue reorder requested: move item from ${fromIndex} to ${toIndex}`);
    
    // Get current Spotify queue to work with
    let currentQueue;
    let currentTrack;
    try {
      const [playbackState, queueData] = await Promise.all([
        spotifyService.getCurrentPlayback(),
        spotifyService.getQueue()
      ]);
      
      currentTrack = playbackState?.item;
      currentQueue = queueData?.queue || [];
      
      console.log(`📊 Current queue has ${currentQueue.length} items`);
    } catch (error) {
      console.error('Error fetching current queue:', error);
      
      // If Spotify API is failing, we can still allow UI-only reordering
      // This provides a better user experience even when Spotify API has issues
      console.log('⚠️ Spotify API unavailable, allowing UI-only reorder');
      
      // Don't try to send Pusher events when Spotify API is unavailable
      // The optimistic UI update in the frontend will handle the visual change
      return NextResponse.json({
        success: true,
        message: 'Queue reordered in UI only (Spotify API unavailable)',
        note: 'The visual order has been updated. Spotify API is currently unavailable.',
        fromIndex,
        toIndex,
        spotify_unavailable: true
      });
    }

    if (!currentQueue || currentQueue.length === 0) {
      return NextResponse.json({ 
        error: 'No items in queue to reorder' 
      }, { status: 400 });
    }

    if (fromIndex >= currentQueue.length || toIndex >= currentQueue.length) {
      return NextResponse.json({ 
        error: 'Invalid queue indices' 
      }, { status: 400 });
    }

    // Create the reordered queue
    const reorderedQueue = [...currentQueue];
    const [movedItem] = reorderedQueue.splice(fromIndex, 1);
    reorderedQueue.splice(toIndex, 0, movedItem);

    // Skip Pusher event for now - optimistic UI update handles the reordering
    // TODO: Implement proper cross-device sync later
    console.log('📊 Queue reordered locally, skipping Pusher event for now');
    
    return NextResponse.json({
      success: true,
      message: 'Queue reordered successfully in UI (Spotify API limitations apply)',
      note: 'The visual order has been updated. Due to Spotify API limitations, the actual playback order may differ.',
      fromIndex,
      toIndex,
      queueLength: currentQueue.length
    });
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error reordering queue:', error);
    return NextResponse.json({ 
      error: 'Failed to reorder queue' 
    }, { status: 500 });
  }
}
