/**
 * Support system logger — durable activity + error records in Postgres.
 * Inserts never throw into callers (fire-and-forget with internal catch).
 *
 * Errors are fingerprinted and deduplicated: repeated identical/similar open
 * issues bump occurrence_count instead of inserting thousands of rows.
 */

import { getPool } from '@/lib/db';
import {
  buildErrorFingerprint,
  classifySupportError,
} from '@/lib/support/fingerprint';
import type { LogActivityInput, LogErrorInput } from '@/lib/support/types';

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_UA = 512;
const MAX_SUMMARY = 500;
const SENSITIVE_KEY =
  /password|token|secret|authorization|cookie|refresh_token|access_token|code_verifier|api[_-]?key/i;

export function redactMeta(
  meta?: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactMeta(value as Record<string, unknown>);
    } else if (typeof value === 'string' && value.length > 500) {
      out[key] = `${value.slice(0, 500)}…`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

async function bumpExistingError(
  fingerprint: string,
  message: string,
  stack: string | null,
  metaJson: string | null,
  classification: string
): Promise<string | null> {
  const client = getPool();
  const result = await client.query(
    `UPDATE support_errors
     SET occurrence_count = COALESCE(occurrence_count, 1) + 1,
         last_seen_at = NOW(),
         message = $2,
         stack = COALESCE($3, stack),
         meta = COALESCE($4::jsonb, meta),
         classification = $5
     WHERE fingerprint = $1
       AND resolved = FALSE
     RETURNING id`,
    [fingerprint, message, stack, metaJson, classification]
  );
  return result.rows[0]?.id ? String(result.rows[0].id) : null;
}

export async function logError(input: LogErrorInput): Promise<string | null> {
  try {
    const client = getPool();
    const id = crypto.randomUUID();
    const meta = redactMeta(input.meta);
    const message = truncate(input.message, MAX_MESSAGE) || 'Unknown error';
    const stack = truncate(input.stack, MAX_STACK);
    const route = truncate(input.route, 500);
    const method = truncate(input.method, 16);
    const source = input.source || 'unknown';
    const classification = classifySupportError({
      source,
      message,
      stack,
      route,
      method,
      meta,
      classification: input.classification,
    });
    const fingerprint = buildErrorFingerprint({
      source,
      message,
      stack,
      route,
      method,
      meta,
      classification,
    });
    const metaJson = meta ? JSON.stringify(meta) : null;

    // DB-backed dedup (works across serverless instances; in-memory maps do not)
    const existingId = await bumpExistingError(
      fingerprint,
      message,
      stack,
      metaJson,
      classification
    );
    if (existingId) return existingId;

    try {
      await client.query(
        `INSERT INTO support_errors (
          id, level, source, message, stack, route, method,
          user_id, username, event_id, ip_hash, user_agent, meta,
          fingerprint, occurrence_count, last_seen_at, classification
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb,
          $14, 1, NOW(), $15
        )`,
        [
          id,
          input.level || 'error',
          source,
          message,
          stack,
          route,
          method,
          input.userId || null,
          truncate(input.username, 120),
          input.eventId || null,
          truncate(input.ipHash, 128),
          truncate(input.userAgent, MAX_UA),
          metaJson,
          fingerprint,
          classification,
        ]
      );
      return id;
    } catch (insertErr) {
      // Race: another instance inserted the same open fingerprint
      const code = (insertErr as { code?: string }).code;
      if (code === '23505') {
        const racedId = await bumpExistingError(
          fingerprint,
          message,
          stack,
          metaJson,
          classification
        );
        if (racedId) return racedId;
      }
      throw insertErr;
    }
  } catch (err) {
    console.error('[support] Failed to log error:', (err as Error).message);
    return null;
  }
}

export async function logActivity(input: LogActivityInput): Promise<string | null> {
  try {
    const client = getPool();
    const id = crypto.randomUUID();
    const meta = redactMeta(input.meta);
    await client.query(
      `INSERT INTO support_activity (
        id, action, actor_role, user_id, username, event_id, route, ip_hash, summary, meta
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
      )`,
      [
        id,
        truncate(input.action, 120) || 'unknown',
        input.actorRole,
        input.userId || null,
        truncate(input.username, 120),
        input.eventId || null,
        truncate(input.route, 500),
        truncate(input.ipHash, 128),
        truncate(input.summary, MAX_SUMMARY) || input.action,
        meta ? JSON.stringify(meta) : null,
      ]
    );
    return id;
  } catch (err) {
    console.error('[support] Failed to log activity:', (err as Error).message);
    return null;
  }
}

/** Fire-and-forget wrappers for sync call sites */
export function logErrorAsync(input: LogErrorInput): void {
  void logError(input);
}

export function logActivityAsync(input: LogActivityInput): void {
  void logActivity(input);
}

export async function pruneSupportLogsOlderThan(days = 90): Promise<{
  errorsDeleted: number;
  activityDeleted: number;
}> {
  try {
    const client = getPool();
    const errors = await client.query(
      `DELETE FROM support_errors WHERE created_at < NOW() - ($1::text || ' days')::interval`,
      [String(days)]
    );
    const activity = await client.query(
      `DELETE FROM support_activity WHERE created_at < NOW() - ($1::text || ' days')::interval`,
      [String(days)]
    );
    return {
      errorsDeleted: errors.rowCount ?? 0,
      activityDeleted: activity.rowCount ?? 0,
    };
  } catch (err) {
    console.error('[support] Failed to prune logs:', (err as Error).message);
    return { errorsDeleted: 0, activityDeleted: 0 };
  }
}

/** Unresolved true issues only (excludes expected handled noise). */
export async function getUnresolvedErrorCount(): Promise<number> {
  try {
    const client = getPool();
    const result = await client.query(
      `SELECT COUNT(*)::int AS count FROM support_errors
       WHERE resolved = FALSE
         AND COALESCE(classification, 'unhandled') = 'unhandled'`
    );
    return result.rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}
