/**
 * HTTP helpers for API integration tests against a running server.
 */

import { TEST_USERS } from '../fixtures/users';

export const BASE_URL =
  process.env.TEST_SERVER_URL || 'http://127.0.0.1:3000';

export interface LoginResult {
  status: number;
  data: Record<string, unknown>;
  cookie: string;
}

function collectSetCookie(response: Response): string {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().join('; ');
  }
  const single = response.headers.get('set-cookie');
  return single || '';
}

export async function apiFetch(
  path: string,
  init: RequestInit & { cookie?: string } = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (init.cookie) {
    headers.set('cookie', init.cookie);
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
    cookie = collectSetCookie(transfer) || cookie;
    return { status: transfer.status, data: transferData, cookie };
  }

  return { status: response.status, data, cookie };
}
