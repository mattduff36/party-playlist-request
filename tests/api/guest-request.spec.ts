/**
 * Guest request + search API tests (SPOTIFY_MOCK on server)
 */

import { TEST_USERS } from '../fixtures/users';
import { apiFetch } from '../utils/api-client';
import { resetRateLimitStoresForTests } from '@/lib/rate-limit';
import { resetSearchCacheForTests } from '@/lib/search-cache';

describe('Guest request and search APIs', () => {
  beforeEach(() => {
    resetRateLimitStoresForTests();
    resetSearchCacheForTests();
  });

  it('rejects short search queries', async () => {
    const response = await apiFetch(
      `/api/spotify/search?q=a&username=${TEST_USERS.testuser1.username}&accessCode=${TEST_USERS.testuser1.pin}`
    );
    expect(response.status).toBe(400);
  });

  it('denies search without access code', async () => {
    const response = await apiFetch(
      `/api/spotify/search?q=Blinding&username=${TEST_USERS.testuser1.username}`
    );
    expect(response.status).toBe(401);
  });

  it('returns mock search tracks with access code', async () => {
    const response = await apiFetch(
      `/api/spotify/search?q=Blinding&username=${TEST_USERS.testuser1.username}&accessCode=${TEST_USERS.testuser1.pin}`
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.tracks)).toBe(true);
    expect(data.tracks.length).toBeGreaterThan(0);
  });

  it('rejects request without track uri/url when authorized', async () => {
    const verify = await apiFetch('/api/events/verify-pin', {
      method: 'POST',
      body: JSON.stringify({
        username: TEST_USERS.testuser1.username,
        accessCode: TEST_USERS.testuser1.pin,
      }),
    });
    expect(verify.status).toBe(200);
    const headers = verify.headers as Headers & { getSetCookie?: () => string[] };
    const cookie =
      typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie().join('; ')
        : headers.get('set-cookie') || '';

    const response = await apiFetch('/api/request', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        requester_nickname: 'ApiGuest',
        username: TEST_USERS.testuser1.username,
        accessCode: TEST_USERS.testuser1.pin,
      }),
    });
    expect(response.status).toBe(400);
  });

  it('denies song request without access code', async () => {
    const response = await apiFetch('/api/request', {
      method: 'POST',
      body: JSON.stringify({
        track_uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
        requester_nickname: `Guest${Date.now().toString().slice(-4)}`,
        username: TEST_USERS.testuser1.username,
        user_session_id: `session-${Date.now()}`,
      }),
    });
    expect(response.status).toBe(401);
  });

  it('submits a song request with access code and mock track uri', async () => {
    const response = await apiFetch('/api/request', {
      method: 'POST',
      body: JSON.stringify({
        track_uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
        requester_nickname: `Guest${Date.now().toString().slice(-4)}`,
        username: TEST_USERS.testuser1.username,
        accessCode: TEST_USERS.testuser1.pin,
        user_session_id: `session-${Date.now()}`,
      }),
    });
    expect([200, 201, 409]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      const data = await response.json();
      expect(data.request || data.id || data.success).toBeTruthy();
    }
  });
});
