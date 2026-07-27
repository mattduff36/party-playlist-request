/**
 * HTTP helpers for API integration tests against a running server.
 */

import { TEST_USERS } from '../fixtures/users';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from '@/lib/auth/csrf-constants';

export const BASE_URL =
  process.env.TEST_SERVER_URL || 'http://127.0.0.1:3000';

export interface LoginResult {
  status: number;
  data: Record<string, unknown>;
  cookie: string;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Convert Set-Cookie header values into a Cookie request header
 * (name=value pairs only — strip Path/HttpOnly/etc attributes).
 */
function collectSetCookie(response: Response): string {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const raw: string[] =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (() => {
          const single = response.headers.get('set-cookie');
          return single ? [single] : [];
        })();

  return raw
    .map((entry) => entry.split(';')[0]?.trim())
    .filter((pair): pair is string => Boolean(pair && pair.includes('=')))
    .join('; ');
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) {
      return trimmed.slice(eq + 1);
    }
  }
  return null;
}

/** Merge cookie jars, later values win for the same name. */
export function mergeCookies(...jars: Array<string | undefined>): string {
  const map = new Map<string, string>();
  for (const jar of jars) {
    if (!jar) continue;
    for (const part of jar.split(';')) {
      const trimmed = part.trim();
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export async function apiFetch(
  path: string,
  init: RequestInit & { cookie?: string } = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const method = (init.method || 'GET').toUpperCase();

  if (init.cookie) {
    headers.set('cookie', init.cookie);
    if (!SAFE_METHODS.has(method) && !headers.has(CSRF_HEADER_NAME)) {
      const csrf = getCookieValue(init.cookie, CSRF_COOKIE_NAME);
      if (csrf) {
        headers.set(CSRF_HEADER_NAME, csrf);
      }
    }
  }

  // Production standalone server enforces same-origin; tests must send Origin.
  if (!headers.has('origin')) {
    headers.set('origin', new URL(BASE_URL).origin);
  }

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function loginAs(
  username: string = TEST_USERS.testuser1.username,
  password: string = TEST_USERS.testuser1.password
): Promise<LoginResult> {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const data = (await response.json()) as Record<string, unknown>;
  let cookie = collectSetCookie(response);

  if (data.requiresTransfer) {
    const sessionInfo = data.sessionInfo as { sessionId?: string } | undefined;
    const transfer = await apiFetch('/api/auth/transfer-session', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        oldSessionId: sessionInfo?.sessionId || data.sessionId,
      }),
    });
    const transferData = (await transfer.json()) as Record<string, unknown>;
    cookie = mergeCookies(cookie, collectSetCookie(transfer));
    return { status: transfer.status, data: transferData, cookie };
  }

  return { status: response.status, data, cookie };
}
