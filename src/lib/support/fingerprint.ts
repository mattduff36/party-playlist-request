/**
 * Fingerprinting + classification for support_errors.
 * Groups near-identical noise into one durable issue; marks expected failures as handled.
 */

import type { SupportErrorClassification, SupportErrorSource } from '@/lib/support/types';

export interface ErrorFingerprintInput {
  source?: SupportErrorSource | string | null;
  message: string;
  stack?: string | null;
  route?: string | null;
  method?: string | null;
  meta?: Record<string, unknown> | null;
  classification?: SupportErrorClassification | null;
}

/** Normalize volatile tokens so similar messages share a fingerprint. */
export function normalizeErrorMessage(message: string): string {
  return message
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '<UUID>'
    )
    .replace(/\b[0-9a-f]{24,}\b/gi, '<ID>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIMESTAMP>')
    .replace(/https?:\/\/[^\s)]+/g, '<URL>')
    .replace(/\boffset=\d+/gi, 'offset=<N>')
    .replace(/\blimit=\d+/gi, 'limit=<N>')
    .replace(/\bretry in \d+s\b/gi, 'retry in <N>s')
    .replace(/\b\d{3,}\b/g, (match) => {
      // Keep HTTP status codes (3 digits); collapse longer numbers
      return match.length === 3 ? match : '<N>';
    })
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 240);
}

/** Normalize routes / Spotify paths for clustering. */
export function normalizeErrorRoute(route: string | null | undefined): string {
  if (!route) return '';
  try {
    const pathname = route.includes('://') ? new URL(route).pathname : route;
    return pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/<ID>')
      .replace(/\/\d+(?=\/|$)/g, '/<N>')
      .replace(/[?&]offset=\d+/gi, '')
      .replace(/[?&]limit=\d+/gi, '')
      .replace(/\?$/, '')
      .substring(0, 200);
  } catch {
    return route.substring(0, 200);
  }
}

/** Stable stack signature from the first app frames (ignores line noise slightly). */
export function stackSignature(stack: string | null | undefined): string {
  if (!stack) return '';
  const lines = stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.includes('node_modules'))
    .slice(0, 4)
    .map((line) =>
      line
        .replace(/:\d+:\d+/g, ':<L>:<C>')
        .replace(/:\d+/g, ':<L>')
        .replace(/\s+/g, ' ')
    );
  return lines.join('|').substring(0, 300);
}

function metaStatus(meta?: Record<string, unknown> | null): string {
  if (!meta || typeof meta !== 'object') return '';
  const status = meta.status;
  if (typeof status === 'number' || typeof status === 'string') {
    return String(status);
  }
  return '';
}

/**
 * Compact fingerprint key used for DB dedup of open errors.
 * Format: source|status|route|normalizedMessage|stackSig
 */
export function buildErrorFingerprint(input: ErrorFingerprintInput): string {
  const source = input.source || 'unknown';
  const status = metaStatus(input.meta);
  const route = normalizeErrorRoute(input.route);
  const message = normalizeErrorMessage(input.message || 'Unknown error');
  const stack = stackSignature(input.stack);
  return `${source}|${status}|${route}|${message}|${stack}`.substring(0, 500);
}

const HANDLED_MESSAGE_PATTERNS: RegExp[] = [
  /\b429\b/,
  /rate limit/i,
  /rate limited/i,
  /\bbackoff\b/i,
  /too many requests/i,
  /Spotify is rate limiting/i,
  /SPOTIFY_SEARCH_BUSY/i,
  /Spotify API (502|503|504)\b/i,
  /Spotify search (502|503|504)\b/i,
  /No token provided/i,
  /Admin access required/i,
  /Unauthorized/i,
  /Invalid credentials/i,
  /Invalid PIN/i,
  /PIN (required|incorrect|invalid)/i,
];

const TRANSIENT_UPSTREAM_STATUSES = new Set(['502', '503', '504']);

/**
 * Classify whether an error is an expected/handled failure vs a true unhandled issue.
 * Explicit classification on the input wins.
 */
export function classifySupportError(
  input: ErrorFingerprintInput
): SupportErrorClassification {
  if (input.classification === 'handled' || input.classification === 'unhandled') {
    return input.classification;
  }

  const meta = input.meta;
  if (meta && typeof meta === 'object') {
    if (
      meta.handled === true ||
      meta.expected === true ||
      meta.throttled === true ||
      meta.transient === true
    ) {
      return 'handled';
    }
    const status = meta.status;
    if (status === 429 || status === '429') return 'handled';
    if (status === 401 || status === '401' || status === 403 || status === '403') {
      return 'handled';
    }
    // Spotify upstream outages are external noise, not app bugs
    if (
      input.source === 'spotify' &&
      TRANSIENT_UPSTREAM_STATUSES.has(String(status))
    ) {
      return 'handled';
    }
  }

  const message = input.message || '';
  if (HANDLED_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'handled';
  }

  return 'unhandled';
}
