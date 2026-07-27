/**
 * Post-event archive report + CSV (PRD-08).
 */

import { getPool } from '@/lib/db';
import { getEventSummary, type EventSummary } from '@/lib/reliability/event-archive';

export interface EventReport extends EventSummary {
  uniqueGuestSessionsApprox: number;
  peakPeriod: { hourLabel: string; count: number } | null;
  providerInterruptions: Array<{
    created_at: string;
    operation: string;
    status: string;
  }>;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  eventTitle: string | null;
}

export interface EventReportRequestRow {
  id: string;
  status: string;
  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  requester_nickname: string | null;
  dedication: string | null;
  created_at: string | Date | null;
  approved_at: string | Date | null;
  played_at: string | Date | null;
  provider_id: string | null;
}

export interface EventReportAuditRow {
  id: string;
  created_at: string | Date | null;
  action: string;
  actor_role: string;
  username: string | null;
  summary: string;
  route: string | null;
  event_id: string | null;
}

export async function getFullEventReport(
  userId: string,
  eventId: string
): Promise<EventReport | null> {
  const pool = getPool();
  const event = await pool.query(
    `SELECT id, user_id, archived_at, ended_at, started_at, config, created_at
     FROM events WHERE id = $1 AND user_id = $2`,
    [eventId, userId]
  );
  if (!event.rows[0]) return null;

  const summary = await getEventSummary(userId, eventId);

  const guests = await pool.query(
    `SELECT COUNT(DISTINCT user_session_id)::int AS count
     FROM requests
     WHERE user_id = $1 AND event_id = $2 AND user_session_id IS NOT NULL`,
    [userId, eventId]
  );

  const peak = await pool.query(
    `SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') AS hour_label,
            COUNT(*)::int AS count
     FROM requests
     WHERE user_id = $1 AND event_id = $2
     GROUP BY 1
     ORDER BY count DESC
     LIMIT 1`,
    [userId, eventId]
  );

  let interruptions: EventReport['providerInterruptions'] = [];
  try {
    const ops = await pool.query(
      `SELECT created_at, operation, status
       FROM provider_operations
       WHERE user_id = $1
         AND created_at >= COALESCE(
           (SELECT COALESCE(started_at, created_at) FROM events WHERE id = $2),
           NOW() - INTERVAL '7 days'
         )
         AND created_at <= COALESCE(
           (SELECT COALESCE(ended_at, archived_at, NOW()) FROM events WHERE id = $2),
           NOW()
         )
         AND status IN ('uncertain', 'failed', 'error', 'rate_limited', 'degraded')
       ORDER BY created_at ASC
       LIMIT 50`,
      [userId, eventId]
    );
    interruptions = ops.rows.map((row) => ({
      created_at: new Date(row.created_at).toISOString(),
      operation: String(row.operation ?? ''),
      status: String(row.status ?? ''),
    }));
  } catch {
    interruptions = [];
  }

  const startedAt = event.rows[0].started_at
    ? new Date(event.rows[0].started_at).toISOString()
    : null;
  const endedAt = event.rows[0].ended_at
    ? new Date(event.rows[0].ended_at).toISOString()
    : event.rows[0].archived_at
      ? new Date(event.rows[0].archived_at).toISOString()
      : null;

  let durationMinutes: number | null = null;
  if (startedAt && endedAt) {
    durationMinutes = Math.max(
      0,
      Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000
      )
    );
  }

  const config = event.rows[0].config || {};
  const eventTitle =
    typeof config === 'object' && config && 'event_title' in config
      ? String((config as { event_title?: string }).event_title || '')
      : null;

  return {
    ...summary,
    uniqueGuestSessionsApprox: guests.rows[0]?.count ?? 0,
    peakPeriod: peak.rows[0]
      ? {
          hourLabel: String(peak.rows[0].hour_label),
          count: peak.rows[0].count,
        }
      : null,
    providerInterruptions: interruptions,
    startedAt,
    endedAt,
    durationMinutes,
    eventTitle,
  };
}

export async function listArchivedEvents(userId: string): Promise<
  Array<{
    id: string;
    status: string;
    lifecycle_phase: string | null;
    ended_at: string | null;
    archived_at: string | null;
    started_at: string | null;
    event_title: string | null;
    request_count: number;
  }>
> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT e.id, e.status, e.lifecycle_phase, e.ended_at, e.archived_at, e.started_at,
            e.config->>'event_title' AS event_title,
            (
              SELECT COUNT(*)::int FROM requests r
              WHERE r.user_id = e.user_id AND r.event_id = e.id
            ) AS request_count
     FROM events e
     WHERE e.user_id = $1
       AND (e.archived_at IS NOT NULL OR e.ended_at IS NOT NULL OR e.status = 'offline')
     ORDER BY COALESCE(e.ended_at, e.archived_at, e.updated_at) DESC
     LIMIT 50`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    status: String(row.status),
    lifecycle_phase: row.lifecycle_phase ? String(row.lifecycle_phase) : null,
    ended_at: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    archived_at: row.archived_at
      ? new Date(row.archived_at).toISOString()
      : null,
    started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
    event_title: row.event_title ? String(row.event_title) : null,
    request_count: row.request_count ?? 0,
  }));
}

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoOrEmpty(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

/** Pure CSV builder for request rows (unit-testable; no raw IP columns). */
export function formatRequestsCsvSection(
  rows: EventReportRequestRow[]
): string {
  const header = [
    'record_type',
    'id',
    'status',
    'track_name',
    'artist_name',
    'album_name',
    'requester_nickname',
    'dedication',
    'created_at',
    'approved_at',
    'played_at',
    'provider_id',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        'request',
        row.id,
        row.status,
        row.track_name,
        row.artist_name,
        row.album_name,
        row.requester_nickname,
        row.dedication,
        isoOrEmpty(row.created_at),
        isoOrEmpty(row.approved_at),
        isoOrEmpty(row.played_at),
        row.provider_id,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n');
}

/** Pure CSV builder for audit action rows (no ip_hash). */
export function formatAuditActionsCsvSection(
  rows: EventReportAuditRow[]
): string {
  const header = [
    'record_type',
    'id',
    'created_at',
    'action',
    'actor_role',
    'username',
    'summary',
    'route',
    'event_id',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        'audit_action',
        row.id,
        isoOrEmpty(row.created_at),
        row.action,
        row.actor_role,
        row.username,
        row.summary,
        row.route,
        row.event_id,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n');
}

/** Combine request + audit CSV sections for a full event report download. */
export function combineEventReportCsv(
  requestsSection: string,
  auditSection: string
): string {
  return `${requestsSection}\n\n${auditSection}\n`;
}

/**
 * CSV of requests and audit actions — no raw IP identifiers (PRD-08).
 */
export async function buildEventReportCsv(
  userId: string,
  eventId: string
): Promise<string> {
  const pool = getPool();

  const requests = await pool.query(
    `SELECT id, status, track_name, artist_name, album_name, requester_nickname,
            dedication, created_at, approved_at, played_at, provider_id
     FROM requests
     WHERE user_id = $1 AND event_id = $2
     ORDER BY created_at ASC`,
    [userId, eventId]
  );

  let auditRows: EventReportAuditRow[] = [];
  try {
    const audits = await pool.query(
      `SELECT id, created_at, action, actor_role, username, summary, route, event_id
       FROM support_activity
       WHERE user_id = $1
         AND (
           event_id = $2::uuid
           OR (
             event_id IS NULL
             AND created_at >= COALESCE(
               (SELECT COALESCE(started_at, created_at) FROM events WHERE id = $2::uuid AND user_id = $1),
               NOW() - INTERVAL '7 days'
             )
             AND created_at <= COALESCE(
               (SELECT COALESCE(ended_at, archived_at, NOW()) FROM events WHERE id = $2::uuid AND user_id = $1),
               NOW()
             )
           )
         )
       ORDER BY created_at ASC
       LIMIT 5000`,
      [userId, eventId]
    );
    auditRows = audits.rows.map((row) => ({
      id: String(row.id),
      created_at: row.created_at,
      action: String(row.action ?? ''),
      actor_role: String(row.actor_role ?? ''),
      username: row.username != null ? String(row.username) : null,
      summary: String(row.summary ?? ''),
      route: row.route != null ? String(row.route) : null,
      event_id: row.event_id != null ? String(row.event_id) : null,
    }));
  } catch {
    // support_activity may be unavailable in partial envs — still return requests
    auditRows = [];
  }

  const requestRows: EventReportRequestRow[] = requests.rows.map((row) => ({
    id: String(row.id),
    status: String(row.status ?? ''),
    track_name: row.track_name != null ? String(row.track_name) : null,
    artist_name: row.artist_name != null ? String(row.artist_name) : null,
    album_name: row.album_name != null ? String(row.album_name) : null,
    requester_nickname:
      row.requester_nickname != null ? String(row.requester_nickname) : null,
    dedication: row.dedication != null ? String(row.dedication) : null,
    created_at: row.created_at,
    approved_at: row.approved_at,
    played_at: row.played_at,
    provider_id: row.provider_id != null ? String(row.provider_id) : null,
  }));

  return combineEventReportCsv(
    formatRequestsCsvSection(requestRows),
    formatAuditActionsCsvSection(auditRows)
  );
}

/** @deprecated Prefer buildEventReportCsv (includes audit actions). */
export async function buildRequestsCsv(
  userId: string,
  eventId: string
): Promise<string> {
  return buildEventReportCsv(userId, eventId);
}
