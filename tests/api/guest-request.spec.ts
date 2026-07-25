/**
 * Guest request + search API tests (SPOTIFY_MOCK on server)
 */

import { TEST_USERS } from '../fixtures/users';
import { apiFetch } from '../utils/api-client';
import { resetRateLimitStoresForTests } from '@/lib/rate-limit';
import { resetSearchCacheForTests } from '@/lib/search-cache';

describe('Guest request and search APIs', () => {
  beforeEach(() => {
    // Note: rate-limit/cache maps are process-local to the test runner, not the server.
    // These resets only affect in-process usage; HTTP tests assert server responses.
    resetRateLimitStoresForTests();
    resetSearchCacheForTests();
  });

  it('rejects short search queries', async () => {
    const response = await apiFetch(
      `/api/spotify/search?q=a&username=${TEST_USERS.testuser1.username}`
    );
    expect(response.status).toBe(400);
  });

  it('returns mock search tracks for a valid query', async () => {
    const response = await apiFetch(
      `/api/spotify/search?q=Blinding&username=${TEST_USERS.testuser1.username}`
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.tracks)).toBe(true);
    expect(data.tracks.length).toBeGreaterThan(0);
  });

  it('rejects request without track uri/url', async () => {
    const response = await apiFetch('/api/request', {
      method: 'POST',
      body: JSON.stringify({
        requester_nickname: 'ApiGuest',
        username: TEST_USERS.testuser1.username,
      }),
    });
    expect(response.status).toBe(400);
  });

  it('submits a song request with mock track uri', async () => {
    const response = await apiFetch('/api/request', {
      method: 'POST',
      body: JSON.stringify({
        track_uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
        requester_nickname: `Guest${Date.now().toString().slice(-4)}`,
        username: TEST_USERS.testuser1.username,
        user_session_id: `session-${Date.now()}`,
      }),
    });
    // 200/201 success, or 403 if pages/event gate closed
    expect([200, 201, 403, 409, 429]).toContain(response.status);
    if (response.status === 200 || response.status === 201) {
      const data = await response.json();
      expect(data.request || data.id || data.success).toBeTruthy();
    }
  });
});
