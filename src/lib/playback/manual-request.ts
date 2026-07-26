/**
 * Manual text request helpers — normalize, validate, duplicate policy (PRD-07).
 */

import { validateRequesterName } from '@/lib/profanity-filter';

const TITLE_MAX = 120;
const ARTIST_MAX = 120;
const DEDICATION_MAX = 200;

export interface ManualTrackInput {
  title: string;
  artists: string;
  dedication?: string | null;
}

export interface NormalizedManualTrack {
  title: string;
  artists: string;
  dedication: string | null;
  /** Stable key for duplicate detection */
  normalizedKey: string;
}

export function normalizeTrackText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, '');
}

export function validateManualTrackInput(
  input: ManualTrackInput
): { ok: true; value: NormalizedManualTrack } | { ok: false; error: string } {
  const title = (input.title || '').trim();
  const artists = (input.artists || '').trim();
  const dedicationRaw = (input.dedication || '').trim();

  if (!title || title.length < 1) {
    return { ok: false, error: 'Song title is required' };
  }
  if (!artists || artists.length < 1) {
    return { ok: false, error: 'Artist name is required' };
  }
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Song title must be at most ${TITLE_MAX} characters` };
  }
  if (artists.length > ARTIST_MAX) {
    return { ok: false, error: `Artist name must be at most ${ARTIST_MAX} characters` };
  }
  if (dedicationRaw.length > DEDICATION_MAX) {
    return {
      ok: false,
      error: `Dedication must be at most ${DEDICATION_MAX} characters`,
    };
  }

  const titleCheck = validateRequesterName(title);
  if (!titleCheck.isValid) {
    return { ok: false, error: titleCheck.reason || 'Song title rejected by moderation' };
  }
  const artistCheck = validateRequesterName(artists);
  if (!artistCheck.isValid) {
    return { ok: false, error: artistCheck.reason || 'Artist name rejected by moderation' };
  }
  if (dedicationRaw) {
    const dedicationCheck = validateRequesterName(dedicationRaw);
    if (!dedicationCheck.isValid) {
      return {
        ok: false,
        error: dedicationCheck.reason || 'Dedication rejected by moderation',
      };
    }
  }

  const normalizedKey = `${normalizeTrackText(artists)}::${normalizeTrackText(title)}`;
  return {
    ok: true,
    value: {
      title,
      artists,
      dedication: dedicationRaw || null,
      normalizedKey,
    },
  };
}

/** Synthetic URI for expand-and-contract when track_uri still present in older code paths. */
export function manualTrackUri(normalizedKey: string): string {
  return `manual:track:${Buffer.from(normalizedKey).toString('base64url').slice(0, 64)}`;
}
