/**
 * Pure clustering helpers shared by fixerrors and unit tests.
 */

import {
  buildErrorFingerprint,
  classifySupportError,
  normalizeErrorMessage,
  normalizeErrorRoute,
  stackSignature,
} from '@/lib/support/fingerprint';

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  lastSeen: string;
  error_message: string;
  error_stack: string | null;
  error_type: string;
  user_id: string | null;
  user_email: string | null;
  page_url: string;
  user_agent: string;
  component_name: string | null;
  additional_data: Record<string, unknown> | null;
  fingerprint: string | null;
  occurrence_count: number;
  classification: 'handled' | 'unhandled';
}

export interface SourceFileRef {
  file: string;
  line?: number;
  column?: number;
}

export interface ErrorPattern {
  patternKey: string;
  fingerprint: string;
  errorType: string;
  component: string;
  classification: 'handled' | 'unhandled';
  normalizedMessage: string;
  occurrences: ErrorLogEntry[];
  allErrorIds: string[];
  totalOccurrences: number;
  rowCount: number;
  sourceFiles: SourceFileRef[];
  affectedPages: string[];
  affectedUsers: string[];
  firstSeen: string;
  lastSeen: string;
  actionable: boolean;
  noiseReason: string | null;
}

const SAMPLE_IDS_PER_PATTERN = 12;

export function createPatternKey(error: ErrorLogEntry): string {
  if (error.fingerprint) return error.fingerprint;
  const type = error.error_type || 'Unknown';
  const component = error.component_name || 'NoComponent';
  const normalizedMsg = normalizeErrorMessage(error.error_message || '');
  const route = normalizeErrorRoute(error.page_url);
  const stack = stackSignature(error.error_stack);
  return `${type}::${component}::${route}::${normalizedMsg}::${stack}`;
}

export function noiseReasonForPattern(pattern: {
  classification: 'handled' | 'unhandled';
  normalizedMessage: string;
}): string | null {
  if (pattern.classification === 'handled') {
    return 'Expected/handled failure (rate limit, auth, or marked handled) — not a codebase bug';
  }
  if (/\b429\b|rate limit|backoff/i.test(pattern.normalizedMessage)) {
    return 'Spotify/API rate limiting — expected under load';
  }
  return null;
}

export function groupIntoPatterns(
  errors: ErrorLogEntry[],
  extractSourceFiles?: (error: ErrorLogEntry) => SourceFileRef[]
): ErrorPattern[] {
  const patternMap = new Map<string, ErrorPattern>();

  for (const error of errors) {
    const key = createPatternKey(error);

    if (!patternMap.has(key)) {
      const classification = error.classification;
      const normalizedMessage = normalizeErrorMessage(error.error_message || '');
      const noiseReason = noiseReasonForPattern({
        classification,
        normalizedMessage,
      });
      patternMap.set(key, {
        patternKey: key,
        fingerprint: error.fingerprint || key,
        errorType: error.error_type || 'Unknown',
        component: error.component_name || 'Unknown',
        classification,
        normalizedMessage,
        occurrences: [],
        allErrorIds: [],
        totalOccurrences: 0,
        rowCount: 0,
        sourceFiles: [],
        affectedPages: [],
        affectedUsers: [],
        firstSeen: error.timestamp,
        lastSeen: error.lastSeen || error.timestamp,
        actionable: !noiseReason,
        noiseReason,
      });
    }

    const pattern = patternMap.get(key)!;
    pattern.rowCount += 1;
    pattern.totalOccurrences += error.occurrence_count || 1;
    pattern.allErrorIds.push(error.id);

    if (pattern.occurrences.length < SAMPLE_IDS_PER_PATTERN) {
      pattern.occurrences.push(error);
    }

    if (error.timestamp < pattern.firstSeen) pattern.firstSeen = error.timestamp;
    const last = error.lastSeen || error.timestamp;
    if (last > pattern.lastSeen) pattern.lastSeen = last;

    if (error.classification === 'unhandled') {
      pattern.classification = 'unhandled';
      pattern.noiseReason = noiseReasonForPattern(pattern);
      pattern.actionable = !pattern.noiseReason;
    }

    const pagePath = error.page_url
      ? normalizeErrorRoute(error.page_url) || 'Unknown'
      : 'Unknown';
    if (!pattern.affectedPages.includes(pagePath)) {
      pattern.affectedPages.push(pagePath);
    }

    const userLabel = error.user_email || error.user_id || 'anonymous';
    if (!pattern.affectedUsers.includes(userLabel)) {
      pattern.affectedUsers.push(userLabel);
    }

    if (extractSourceFiles && pattern.sourceFiles.length < 10) {
      for (const ref of extractSourceFiles(error)) {
        const exists = pattern.sourceFiles.some(
          (s) => s.file === ref.file && s.line === ref.line
        );
        if (!exists) {
          pattern.sourceFiles.push(ref);
        }
      }
    }
  }

  return Array.from(patternMap.values()).sort((a, b) => {
    if (a.classification !== b.classification) {
      return a.classification === 'unhandled' ? -1 : 1;
    }
    return b.totalOccurrences - a.totalOccurrences;
  });
}

export function entryFromDbRow(row: Record<string, unknown>): ErrorLogEntry {
  const meta =
    row.meta && typeof row.meta === 'object'
      ? (row.meta as Record<string, unknown>)
      : null;
  const message = String(row.message || '');
  const stack = row.stack ? String(row.stack) : null;
  const route = String(row.route || '');
  const source = String(row.source || 'unknown');
  const classification =
    row.classification === 'handled' || row.classification === 'unhandled'
      ? row.classification
      : classifySupportError({
          source,
          message,
          stack,
          route,
          meta,
        });
  const fingerprint =
    (row.fingerprint ? String(row.fingerprint) : null) ||
    buildErrorFingerprint({
      source,
      message,
      stack,
      route,
      method: row.method ? String(row.method) : null,
      meta,
      classification,
    });

  return {
    id: String(row.id),
    timestamp: new Date(String(row.created_at)).toISOString(),
    lastSeen: new Date(String(row.last_seen_at || row.created_at)).toISOString(),
    error_message: message,
    error_stack: stack,
    error_type: String(row.level || 'error'),
    user_id: row.user_id ? String(row.user_id) : null,
    user_email: row.username ? String(row.username) : null,
    page_url: route,
    user_agent: row.user_agent ? String(row.user_agent) : '',
    component_name: source,
    additional_data: meta,
    fingerprint,
    occurrence_count: Number(row.occurrence_count || 1),
    classification,
  };
}
