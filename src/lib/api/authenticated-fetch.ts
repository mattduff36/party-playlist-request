/**
 * Central fetch helper for organiser/superadmin cookie-authenticated calls.
 * Attaches CSRF double-submit header for mutations.
 */

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/auth/csrf';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function getCsrfTokenFromDocument(): string | null {
  return readCookie(CSRF_COOKIE_NAME);
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});

  if (!SAFE_READ.has(method)) {
    const csrf = getCsrfTokenFromDocument();
    if (csrf && !headers.has(CSRF_HEADER_NAME)) {
      headers.set(CSRF_HEADER_NAME, csrf);
    }
    if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });
}

const SAFE_READ = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Handle SESSION_REVOKED without refresh loops — clear local hints and redirect once.
 */
export async function handleSessionRevokedResponse(
  res: Response
): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    const body = (await res.clone().json()) as { code?: string };
    if (body?.code !== 'SESSION_REVOKED') return false;
    if (typeof window === 'undefined') return true;
    try {
      sessionStorage.setItem('pp_session_revoked', '1');
    } catch {
      // ignore
    }
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login?reason=session_revoked');
    }
    return true;
  } catch {
    return false;
  }
}
