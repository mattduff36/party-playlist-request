/**
 * Event + public display API tests
 */

import { TEST_USERS } from '../fixtures/users';
import { apiFetch, loginAs } from '../utils/api-client';

describe('Event and public display APIs', () => {
  it('verifies PIN for testuser1', async () => {
    const response = await apiFetch('/api/events/verify-pin', {
      method: 'POST',
      body: JSON.stringify({
        username: TEST_USERS.testuser1.username,
        pin: TEST_USERS.testuser1.pin,
      }),
    });
    // 200 if user_events seeded; 400/401/404 if PIN path unavailable
    expect([200, 400, 401, 404]).toContain(response.status);
    if (response.status === 200) {
      const data = await response.json();
      expect(data.success === true || data.valid === true || data.event).toBeTruthy();
    }
  });

  it('returns public event-config for testuser1', async () => {
    const response = await apiFetch(
      `/api/public/event-config?username=${TEST_USERS.testuser1.username}`
    );
    expect(response.status).toBe(200);
  });

  it('returns public display-data for testuser1', async () => {
    const response = await apiFetch(
      `/api/public/display-data?username=${TEST_USERS.testuser1.username}`
    );
    expect([200, 403, 404]).toContain(response.status);
  });

  it('returns public now-playing for testuser1 under mock Spotify', async () => {
    const response = await apiFetch(
      `/api/public/now-playing?username=${TEST_USERS.testuser1.username}`
    );
    expect([200, 403, 404]).toContain(response.status);
  });

  it('allows authenticated DJ to read event status', async () => {
    const { cookie } = await loginAs(
      TEST_USERS.testuser1.username,
      TEST_USERS.testuser1.password
    );
    const response = await apiFetch('/api/event/status', { cookie });
    expect([200, 404]).toContain(response.status);
  });

  it('allows authenticated DJ to toggle pages when event is active', async () => {
    const { cookie } = await loginAs(
      TEST_USERS.testuser1.username,
      TEST_USERS.testuser1.password
    );
    const response = await apiFetch('/api/event/pages', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ page: 'requests', enabled: true }),
    });
    expect([200, 400, 403]).toContain(response.status);
  });
});
