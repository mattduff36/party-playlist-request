import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getSetting, setSetting } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const partyPlaylistId = (await getSetting('party_playlist_id')) || '';

    return NextResponse.json({
      party_playlist_id: partyPlaylistId,
    });
  } catch (error) {
    console.error('Error getting party playlist setting:', error);
    return NextResponse.json({ error: 'Failed to get party playlist' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const body = await req.json();
    const playlistId =
      typeof body?.playlist_id === 'string' ? body.playlist_id.trim() : '';

    if (!playlistId) {
      return NextResponse.json({ error: 'playlist_id is required' }, { status: 400 });
    }

    // Spotify playlist IDs are base62; reject obvious junk
    if (!/^[a-zA-Z0-9]{10,40}$/.test(playlistId)) {
      return NextResponse.json({ error: 'Invalid playlist_id' }, { status: 400 });
    }

    await setSetting('party_playlist_id', playlistId);

    console.log(
      `🎵 [admin/party-playlist] User ${auth.user.username} set party_playlist_id=${playlistId}`
    );

    return NextResponse.json({
      success: true,
      party_playlist_id: playlistId,
    });
  } catch (error) {
    console.error('Error saving party playlist setting:', error);
    return NextResponse.json({ error: 'Failed to save party playlist' }, { status: 500 });
  }
}
