/**
 * Support system logger — durable activity + error records in Postgres.
 * Inserts never throw into callers (fire-and-forget with internal catch).
 */

import { getPool } from '@/lib/db';
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

export async function logError(input: LogErrorInput): Promise<string | null> {
  try {
    const client = getPool();
    const id = crypto.randomUUID();
    const meta = redactMeta(input.meta);
    await client.query(
      `INSERT INTO support_errors (
        id, level, source, message, stack, route, method,
        user_id, username, event_id, ip_hash, user_agent, meta
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
      )`,
      [
        id,
        input.level || 'error',
        input.source || 'unknown',
        truncate(input.message, MAX_MESSAGE) || 'Unknown error',
        truncate(input.stack, MAX_STACK),
        truncate(input.route, 500),
        truncate(input.method, 16),
        input.userId || null,
        truncate(input.username, 120),
        input.eventId || null,
        truncate(input.ipHash, 128),
        truncate(input.userAgent, MAX_UA),
        meta ? JSON.stringify(meta) : null,
      ]
    );
    return id;
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

export async function getUnresolvedErrorCount(): Promise<number> {
  try {
    const client = getPool();
    const result = await client.query(
      `SELECT COUNT(*)::int AS count FROM support_errors WHERE resolved = FALSE`
    );
    return result.rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}
