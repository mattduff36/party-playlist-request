/**
 * PRD-04 explicit Pusher channel allowlist.
 *
 * Canonical:
 *   private-user-{userId}-admin
 *   private-event-{eventId}-guest
 *   private-event-{eventId}-display
 *
 * Legacy (still authorised with proof during migration):
 *   private-admin-updates-{userId}
 *   private-party-playlist-{userId}
 *
 * Public `event-{eventId}` is retired — not published and not auth-gated.
 * Presence channels are rejected by default in `/api/pusher/auth`.
 */

export type ChannelKind =
  | 'admin'
  | 'guest_legacy_user'
  | 'guest_event'
  | 'display_event'
  | 'presence'
  | 'unknown';

export interface ParsedChannel {
  kind: ChannelKind;
  userId?: string;
  eventId?: string;
  raw: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Canonical admin channel (PRD-04). */
export function getCanonicalAdminChannel(userId: string): string {
  return `private-user-${userId}-admin`;
}

/** Canonical guest channel for an event. */
export function getGuestEventChannel(eventId: string): string {
  return `private-event-${eventId}-guest`;
}

/** Canonical display channel for an event. */
export function getDisplayEventChannel(eventId: string): string {
  return `private-event-${eventId}-display`;
}

/**
 * @deprecated Public `event-{id}` is retired (PRD-04). Kept only so tests can
 * assert the name is unknown / not used in the production publish path.
 */
export function getLegacyPublicEventChannel(eventId: string): string {
  return `event-${eventId}`;
}

/** Private channels that receive event-scoped realtime (no public dual-publish). */
export function getEventRealtimePublishChannels(eventId: string): string[] {
  return [getGuestEventChannel(eventId), getDisplayEventChannel(eventId)];
}

export function parseChannelName(channelName: string): ParsedChannel {
  const raw = channelName.trim();

  let m = /^private-user-([0-9a-f-]{36})-admin$/i.exec(raw);
  if (m && isUuid(m[1])) {
    return { kind: 'admin', userId: m[1], raw };
  }

  m = /^private-admin-updates-([0-9a-f-]{36})$/i.exec(raw);
  if (m && isUuid(m[1])) {
    return { kind: 'admin', userId: m[1], raw };
  }

  m = /^private-party-playlist-([0-9a-f-]{36})$/i.exec(raw);
  if (m && isUuid(m[1])) {
    return { kind: 'guest_legacy_user', userId: m[1], raw };
  }

  m = /^private-event-([0-9a-f-]{36})-guest$/i.exec(raw);
  if (m && isUuid(m[1])) {
    return { kind: 'guest_event', eventId: m[1], raw };
  }

  m = /^private-event-([0-9a-f-]{36})-display$/i.exec(raw);
  if (m && isUuid(m[1])) {
    return { kind: 'display_event', eventId: m[1], raw };
  }

  if (raw.startsWith('presence-')) {
    return { kind: 'presence', raw };
  }

  return { kind: 'unknown', raw };
}

/** Fields that must never appear in realtime payloads. */
export const BANNED_PUSHER_PAYLOAD_KEYS = [
  'email',
  'access_code',
  'accessCode',
  'pin',
  'password',
  'password_hash',
  'refresh_token',
  'access_token',
  'code_verifier',
  'bypass_token',
  'displayToken',
  'display_token',
  'requester_ip_hash',
  'ip_hash',
  'token',
] as const;

export function assertSafePusherPayload(data: unknown): string[] {
  const banned: string[] = [];
  if (!data || typeof data !== 'object') return banned;
  const walk = (obj: Record<string, unknown>, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        (BANNED_PUSHER_PAYLOAD_KEYS as readonly string[]).includes(key) ||
        /secret|password|token|access_code|verifier/i.test(key)
      ) {
        // Allow stable routing ids that are not secrets
        if (key === 'userId' || key === 'user_id' || key === 'sessionId') {
          continue;
        }
        banned.push(path);
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, path);
      }
    }
  };
  walk(data as Record<string, unknown>);
  return banned;
}
