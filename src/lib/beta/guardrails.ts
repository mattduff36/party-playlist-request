/**
 * Must-play / do-not-play / artist cooldown guardrails (PRD-08).
 */

import { getPool } from '@/lib/db';
import { normalizeTrackText } from '@/lib/playback';

export interface GuardrailTrackRef {
  track_name?: string;
  artist_name?: string;
  track_uri?: string | null;
  normalized_key?: string;
}

export interface GuardrailSettings {
  must_play_list: GuardrailTrackRef[];
  do_not_play_list: GuardrailTrackRef[];
  artist_cooldown_minutes: number;
  max_active_requests_per_guest: number | null;
}

export type GuardrailViolationCode =
  | 'DO_NOT_PLAY'
  | 'ARTIST_COOLDOWN'
  | 'MAX_ACTIVE_REQUESTS';

export interface GuardrailViolation {
  code: GuardrailViolationCode;
  message: string;
}

function asList(raw: unknown): GuardrailTrackRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => item && typeof item === 'object') as GuardrailTrackRef[];
}

export async function loadGuardrailSettings(
  userId: string
): Promise<GuardrailSettings> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT must_play_list, do_not_play_list, artist_cooldown_minutes,
            max_active_requests_per_guest
     FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0] || {};
  return {
    must_play_list: asList(row.must_play_list),
    do_not_play_list: asList(row.do_not_play_list),
    artist_cooldown_minutes: Number(row.artist_cooldown_minutes ?? 0) || 0,
    max_active_requests_per_guest:
      row.max_active_requests_per_guest == null
        ? null
        : Number(row.max_active_requests_per_guest),
  };
}

export function matchesDoNotPlay(
  list: GuardrailTrackRef[],
  track: GuardrailTrackRef
): boolean {
  const trackKey =
    track.normalized_key ||
    normalizeTrackText(`${track.artist_name || ''} ${track.track_name || ''}`);
  const uri = track.track_uri || null;
  const artistNorm = normalizeTrackText(track.artist_name || '');

  for (const item of list) {
    if (uri && item.track_uri && item.track_uri === uri) return true;
    const itemKey =
      item.normalized_key ||
      normalizeTrackText(`${item.artist_name || ''} ${item.track_name || ''}`);
    if (itemKey && trackKey && itemKey === trackKey) return true;
    // Artist-only block when track_name omitted
    if (
      item.artist_name &&
      !item.track_name &&
      normalizeTrackText(item.artist_name) === artistNorm
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluate submission against do-not-play, artist cooldown, and per-guest caps.
 * Must-play is organiser-facing (not a guest block).
 */
export async function evaluateSubmissionGuardrails(input: {
  userId: string;
  eventId: string | null;
  track: GuardrailTrackRef;
  guestSessionId?: string | null;
  /** Organiser override — auditable at call site */
  organiserOverride?: boolean;
}): Promise<GuardrailViolation | null> {
  if (input.organiserOverride) return null;

  const settings = await loadGuardrailSettings(input.userId);

  if (matchesDoNotPlay(settings.do_not_play_list, input.track)) {
    return {
      code: 'DO_NOT_PLAY',
      message:
        'This track or artist is on the organiser do-not-play list for this event.',
    };
  }

  const pool = getPool();
  const artistNorm = normalizeTrackText(input.track.artist_name || '');

  if (settings.artist_cooldown_minutes > 0 && artistNorm && input.eventId) {
    const cooldown = await pool.query(
      `SELECT artist_name FROM requests
       WHERE user_id = $1
         AND event_id = $2
         AND archived_at IS NULL
         AND status IN ('pending', 'approved', 'approving', 'played')
         AND created_at > NOW() - ($3::text || ' minutes')::interval
       ORDER BY created_at DESC
       LIMIT 40`,
      [input.userId, input.eventId, String(settings.artist_cooldown_minutes)]
    );
    const hit = cooldown.rows.some(
      (row) => normalizeTrackText(String(row.artist_name || '')) === artistNorm
    );
    if (hit) {
      return {
        code: 'ARTIST_COOLDOWN',
        message: `Please wait before requesting another track by this artist (cooldown ${settings.artist_cooldown_minutes} minutes).`,
      };
    }
  }

  if (
    settings.max_active_requests_per_guest != null &&
    settings.max_active_requests_per_guest > 0 &&
    input.guestSessionId &&
    input.eventId
  ) {
    const active = await pool.query(
      `SELECT COUNT(*)::int AS count FROM requests
       WHERE user_id = $1
         AND event_id = $2
         AND user_session_id = $3
         AND archived_at IS NULL
         AND status IN ('pending', 'approved', 'approving')`,
      [input.userId, input.eventId, input.guestSessionId]
    );
    const count = active.rows[0]?.count ?? 0;
    if (count >= settings.max_active_requests_per_guest) {
      return {
        code: 'MAX_ACTIVE_REQUESTS',
        message: `You already have ${count} active request(s). Wait until one is played or rejected.`,
      };
    }
  }

  return null;
}

export function guestGuardrailExplanation(settings: GuardrailSettings): string {
  const parts: string[] = [];
  if (settings.do_not_play_list.length > 0) {
    parts.push('Some tracks or artists are blocked by the organiser.');
  }
  if (settings.artist_cooldown_minutes > 0) {
    parts.push(
      `Artist cooldown: ${settings.artist_cooldown_minutes} minutes between requests for the same artist.`
    );
  }
  if (
    settings.max_active_requests_per_guest != null &&
    settings.max_active_requests_per_guest > 0
  ) {
    parts.push(
      `Maximum ${settings.max_active_requests_per_guest} active request(s) per guest.`
    );
  }
  parts.push('Duplicate requests for the same track are limited for fairness.');
  return parts.join(' ');
}
