/**
 * Pusher private/presence channel authentication (PRD-04).
 * Allowlisted channel patterns only; organiser / guest / display proof required.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Pusher from 'pusher';
import { resolveSecretEnv } from '@/lib/security/fail-closed-env';
import { requireAuth } from '@/middleware/auth';
import { parseChannelName } from '@/lib/pusher/channel-contract';
import {
  proveDisplayForEvent,
  proveGuestForEvent,
  proveGuestForUserChannel,
} from '@/lib/event-access-policy';

function getPusherAuthServer(): Pusher {
  return new Pusher({
    appId: resolveSecretEnv('PUSHER_APP_ID', {
      insecureFallbacks: ['fallback-app-id', ''],
      devFallback: '',
    }),
    key: resolveSecretEnv('PUSHER_KEY', {
      insecureFallbacks: ['fallback-key', ''],
      devFallback: '',
    }),
    secret: resolveSecretEnv('PUSHER_SECRET', {
      insecureFallbacks: ['fallback-secret', ''],
      devFallback: '',
    }),
    cluster: process.env.PUSHER_CLUSTER?.trim() || 'eu',
    useTLS: true,
  });
}

function deny(message: string, status = 403): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

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

    const parsed = parseChannelName(channelName);
    if (parsed.kind === 'unknown') {
      return deny('Invalid channel name');
    }

    const pusher = getPusherAuthServer();

    if (parsed.kind === 'admin') {
      const auth = await requireAuth(req);
      if (!auth.authenticated || !auth.user?.user_id) {
        return auth.response || deny('Authentication required', 401);
      }
      const sessionUserId = auth.user.user_id;
      if (sessionUserId !== parsed.userId) {
        // Super-admin support override is deliberately not opened here without audit.
        return deny('Channel ownership mismatch');
      }
      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (parsed.kind === 'guest_event') {
      const event = await proveGuestForEvent(req, parsed.eventId!);
      if (!event) {
        return deny('Guest access required', 401);
      }
      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (parsed.kind === 'guest_legacy_user') {
      // Organiser may also subscribe to their legacy party channel
      const auth = await requireAuth(req);
      if (
        auth.authenticated &&
        auth.user?.user_id &&
        auth.user.user_id === parsed.userId
      ) {
        const authResponse = pusher.authorizeChannel(socketId, channelName);
        return NextResponse.json(authResponse);
      }

      const event = await proveGuestForUserChannel(req, parsed.userId!);
      if (!event) {
        return deny('Guest access required', 401);
      }
      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (parsed.kind === 'display_event') {
      // Guest cookie must NOT authorise display channels
      const event = await proveDisplayForEvent(req, parsed.eventId!);
      if (!event) {
        return deny('Display access required', 401);
      }
      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (parsed.kind === 'presence') {
      // Random scoped member — never hard-code a shared identity
      const memberId = `m_${crypto.randomBytes(12).toString('hex')}`;
      const authResponse = pusher.authorizeChannel(socketId, channelName, {
        user_id: memberId,
        user_info: { role: 'anonymous' },
      });
      return NextResponse.json(authResponse);
    }

    return deny('Invalid channel name');
  } catch (error) {
    console.error('[Pusher Auth] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
