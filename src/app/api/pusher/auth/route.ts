/**
 * Pusher Authentication Endpoint
 * 
 * Authenticates Pusher private channels
 * Required for private-* channel subscriptions
 */

import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';

// Initialize Pusher server
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.PUSHER_CLUSTER || 'eu',
  useTLS: true,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const socketId = params.get('socket_id');
    const channelName = params.get('channel_name');

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: 'socket_id and channel_name are required' },
        { status: 400 }
      );
    }

    console.log(`🔐 [Pusher Auth] Authenticating channel: ${channelName} for socket: ${socketId}`);

    // For private channels, authenticate without user data
    if (channelName.startsWith('private-')) {
      const authResponse = pusher.authorizeChannel(socketId, channelName);
      console.log(`✅ [Pusher Auth] Authorized private channel: ${channelName}`);
      return NextResponse.json(authResponse);
    }

    // For presence channels (future use)
    if (channelName.startsWith('presence-')) {
      // Get user from auth token if needed
      const authResponse = pusher.authorizeChannel(socketId, channelName, {
        user_id: 'default-user',
        user_info: {
          name: 'Guest'
        }
      });
      console.log(`✅ [Pusher Auth] Authorized presence channel: ${channelName}`);
      return NextResponse.json(authResponse);
    }

    return NextResponse.json(
      { error: 'Invalid channel name' },
      { status: 403 }
    );

  } catch (error) {
    console.error('❌ [Pusher Auth] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

