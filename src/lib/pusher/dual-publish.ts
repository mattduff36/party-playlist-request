/**
 * Server-only dual-publish helpers (PRD-04).
 * Kept out of client bundles — do not import from client components.
 */

import 'server-only';
import Pusher from 'pusher';
import { getActiveEvent } from '@/lib/event-service';
import { getUserChannel } from '@/lib/pusher/client-shared';
import { getEventRealtimePublishChannels } from '@/lib/pusher/channel-contract';
import { resolveSecretEnv } from '@/lib/security/fail-closed-env';

function getDualPublishPusher(): Pusher {
  return new Pusher({
    appId: resolveSecretEnv('PUSHER_APP_ID', {
      insecureFallbacks: ['fallback-app-id'],
      devFallback: 'fallback-app-id',
    }),
    key: resolveSecretEnv('PUSHER_KEY', {
      insecureFallbacks: ['fallback-key'],
      devFallback: 'fallback-key',
    }),
    secret: resolveSecretEnv('PUSHER_SECRET', {
      insecureFallbacks: ['fallback-secret'],
      devFallback: 'fallback-secret',
    }),
    cluster: process.env.PUSHER_CLUSTER?.trim() || 'us2',
    useTLS: true,
  });
}

async function publish(
  channel: string,
  eventName: string,
  data: Record<string, unknown>
): Promise<void> {
  const safe =
    data && typeof data === 'object'
      ? Object.fromEntries(
          Object.entries(data).filter(
            ([key]) =>
              !/^(email|access_code|accessCode|pin|password|refresh_token|access_token|code_verifier|bypass_token|displayToken|display_token|requester_ip_hash)$/i.test(
                key
              )
          )
        )
      : data;
  await getDualPublishPusher().trigger(channel, eventName, {
    ...safe,
    timestamp: Date.now(),
  });
}

/**
 * Publish to organiser user channel + private event guest/display channels.
 * Never publishes to public `event-{id}`.
 */
export async function dualPublishUserAndGuest(
  userId: string,
  eventName: string,
  data: Record<string, unknown>,
  eventId?: string | null
): Promise<void> {
  await publish(getUserChannel(userId), eventName, data);
  let resolvedEventId = eventId || null;
  if (!resolvedEventId) {
    try {
      const active = await getActiveEvent(userId);
      resolvedEventId = active?.id ?? null;
    } catch {
      resolvedEventId = null;
    }
  }
  if (resolvedEventId) {
    for (const channel of getEventRealtimePublishChannels(resolvedEventId)) {
      await publish(channel, eventName, data);
    }
  }
}
