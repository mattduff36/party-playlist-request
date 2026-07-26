/**
 * Shared validation for public client-error intake endpoints (PRD-01).
 * Bounds payload size, allowlists fields, and redacts stack traces.
 */

export const CLIENT_ERROR_MAX_BODY_BYTES = 8_192;
export const CLIENT_ERROR_MAX_MESSAGE_LEN = 500;
export const CLIENT_ERROR_MAX_STACK_LEN = 1_024;
export const CLIENT_ERROR_MAX_ROUTE_LEN = 300;

const ALLOWED_FIELDS = new Set([
  'message',
  'stack',
  'componentStack',
  'url',
  'level',
  'classification',
  'errorId',
  'username',
  'userId',
  'userAgent',
  'timestamp',
]);

export interface ClientErrorIntake {
  message: string;
  stack: string | null;
  route: string | null;
  level: 'error' | 'fatal';
  classification: 'handled' | 'unhandled';
  errorId: string | null;
  username: string | null;
  userId: string | null;
  userAgent: string | null;
}

export interface ClientErrorIntakeResult {
  ok: true;
  data: ClientErrorIntake;
}

export interface ClientErrorIntakeError {
  ok: false;
  status: number;
  error: string;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

/** Drop obvious secret-bearing query params and truncate. */
export function sanitizeRoute(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let cleaned = raw;
  try {
    const url = new URL(raw, 'http://localhost');
    const sensitive = [
      'token',
      'access_token',
      'refresh_token',
      'code',
      'password',
      'secret',
      'authorization',
      'auth',
      'pin',
      'accessCode',
      'access_code',
    ];
    for (const key of sensitive) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, '[redacted]');
      }
    }
    cleaned = url.pathname + (url.search ? url.search : '');
  } catch {
    cleaned = raw.split('?')[0] || raw;
  }
  return truncate(cleaned, CLIENT_ERROR_MAX_ROUTE_LEN);
}

export function redactStack(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const redacted = raw
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt-redacted]')
    .replace(/(api[_-]?key|secret|password|token)\s*[:=]\s*\S+/gi, '$1=[redacted]');
  return truncate(redacted, CLIENT_ERROR_MAX_STACK_LEN);
}

/**
 * Parse and validate a raw request body string for client-error intake.
 */
export function parseClientErrorIntake(
  rawBody: string,
  refererFallback?: string | null
): ClientErrorIntakeResult | ClientErrorIntakeError {
  if (rawBody.length > CLIENT_ERROR_MAX_BODY_BYTES) {
    return { ok: false, status: 400, error: 'Payload too large' };
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'Invalid payload' };
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) {
      return { ok: false, status: 400, error: `Unexpected field: ${key}` };
    }
  }

  const messageRaw =
    typeof record.message === 'string' ? record.message : 'Client error';
  const message = truncate(messageRaw, CLIENT_ERROR_MAX_MESSAGE_LEN);

  const stackSource =
    typeof record.stack === 'string'
      ? record.stack
      : typeof record.componentStack === 'string'
        ? record.componentStack
        : null;

  const routeSource =
    typeof record.url === 'string' ? record.url : refererFallback || null;

  const level =
    record.level === 'fatal' ||
    record.level === 'page' ||
    record.level === 'critical'
      ? 'fatal'
      : 'error';

  const classification =
    record.classification === 'handled' ? 'handled' : 'unhandled';

  return {
    ok: true,
    data: {
      message,
      stack: redactStack(stackSource),
      route: sanitizeRoute(routeSource),
      level,
      classification,
      errorId:
        typeof record.errorId === 'string'
          ? truncate(record.errorId, 80)
          : null,
      username:
        typeof record.username === 'string'
          ? truncate(record.username, 50)
          : null,
      userId:
        typeof record.userId === 'string' ? truncate(record.userId, 80) : null,
      userAgent:
        typeof record.userAgent === 'string'
          ? truncate(record.userAgent, 300)
          : null,
    },
  };
}
