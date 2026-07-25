import { getPool } from '@/lib/db';
import type { SupportActivityRow, SupportErrorRow } from '@/lib/support/types';

export async function listSupportErrors(options: {
  resolved?: 'all' | 'open' | 'resolved';
  source?: string;
  username?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: SupportErrorRow[]; total: number }> {
  const client = getPool();
  const clauses: string[] = ['1=1'];
  const params: unknown[] = [];
  let i = 1;

  if (options.resolved === 'open') {
    clauses.push('resolved = FALSE');
  } else if (options.resolved === 'resolved') {
    clauses.push('resolved = TRUE');
  }
  if (options.source && options.source !== 'all') {
    clauses.push(`source = $${i++}`);
    params.push(options.source);
  }
  if (options.username) {
    clauses.push(`username ILIKE $${i++}`);
    params.push(`%${options.username}%`);
  }

  const where = clauses.join(' AND ');
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  const countResult = await client.query(
    `SELECT COUNT(*)::int AS count FROM support_errors WHERE ${where}`,
    params
  );
  const rowsResult = await client.query(
    `SELECT * FROM support_errors WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );

  return {
    total: countResult.rows[0]?.count ?? 0,
    rows: rowsResult.rows as SupportErrorRow[],
  };
}

export async function listSupportActivity(options: {
  action?: string;
  username?: string;
  limit?: number;
  offset?: number;
  since?: string | null;
}): Promise<{ rows: SupportActivityRow[]; total: number }> {
  const client = getPool();
  const clauses: string[] = ['1=1'];
  const params: unknown[] = [];
  let i = 1;

  if (options.action && options.action !== 'all') {
    clauses.push(`action = $${i++}`);
    params.push(options.action);
  }
  if (options.username) {
    clauses.push(`username ILIKE $${i++}`);
    params.push(`%${options.username}%`);
  }
  if (options.since) {
    clauses.push(`created_at >= $${i++}`);
    params.push(options.since);
  }

  const where = clauses.join(' AND ');
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  const countResult = await client.query(
    `SELECT COUNT(*)::int AS count FROM support_activity WHERE ${where}`,
    params
  );
  const rowsResult = await client.query(
    `SELECT * FROM support_activity WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );

  return {
    total: countResult.rows[0]?.count ?? 0,
    rows: rowsResult.rows as SupportActivityRow[],
  };
}

export async function resolveSupportError(
  id: string,
  resolvedBy: string
): Promise<SupportErrorRow | null> {
  const client = getPool();
  const result = await client.query(
    `UPDATE support_errors
     SET resolved = TRUE, resolved_at = NOW(), resolved_by = $2
     WHERE id = $1
     RETURNING *`,
    [id, resolvedBy]
  );
  return (result.rows[0] as SupportErrorRow) || null;
}

export async function getEntityTimeline(options: {
  username?: string;
  eventId?: string;
  limit?: number;
}): Promise<{
  errors: SupportErrorRow[];
  activity: SupportActivityRow[];
}> {
  const client = getPool();
  const limit = Math.min(options.limit ?? 40, 100);
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (options.username) {
    clauses.push(`username ILIKE $${i++}`);
    params.push(options.username);
  }
  if (options.eventId) {
    clauses.push(`event_id = $${i++}`);
    params.push(options.eventId);
  }
  if (clauses.length === 0) {
    return { errors: [], activity: [] };
  }

  const where = clauses.join(' AND ');
  const limitIdx = params.length + 1;
  const queryParams = [...params, limit];
  const [errors, activity] = await Promise.all([
    client.query(
      `SELECT * FROM support_errors WHERE ${where}
       ORDER BY created_at DESC LIMIT $${limitIdx}`,
      queryParams
    ),
    client.query(
      `SELECT * FROM support_activity WHERE ${where}
       ORDER BY created_at DESC LIMIT $${limitIdx}`,
      queryParams
    ),
  ]);

  return {
    errors: errors.rows as SupportErrorRow[],
    activity: activity.rows as SupportActivityRow[],
  };
}
