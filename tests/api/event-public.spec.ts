/**
 * Event + public display API tests
 */

import { TEST_USERS } from '../fixtures/users';
import { apiFetch, loginAs } from '../utils/api-client';

describe('Event and public display APIs', () => {
  it('verifies access code for testuser1', async () => {
    const response = await apiFetch('/api/events/verify-pin', {
      method: 'POST',
      body: JSON.stringify({
        username: TEST_USERS.testuser1.username,
        accessCode: TEST_USERS.testuser1.pin,
      }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.event?.accessCode).toBe(TEST_USERS.testuser1.pin);
  });

  it('rejects wrong access code', async () => {
    const response = await apiFetch('/api/events/verify-pin', {
      method: 'POST',
      body: JSON.stringify({
        username: TEST_USERS.testuser1.username,
        accessCode: '000001',
      }),
    });
    expect([401, 429]).toContain(response.status);
  });

  it('returns public event-config for testuser1', async () => {
    const response = await apiFetch(
      `/api/public/event-config?username=${TEST_USERS.testuser1.username}`
    );
    expect(response.status).toBe(200);
  });

  it('denies display-data without access code', async () => {
    const response = await apiFetch(
      `/api/public/display-data?username=${TEST_USERS.testuser1.username}`
    );
    expect(response.status).toBe(401);
  });

  it('allows display-data with access code', async () => {
    const response = await apiFetch(
      `/api/public/display-data?username=${TEST_USERS.testuser1.username}&accessCode=${TEST_USERS.testuser1.pin}`
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.event_settings?.pin).toBeUndefined();
    expect(data.event_settings?.access_code).toBe(TEST_USERS.testuser1.pin);
  });

  it('denies now-playing without access code', async () => {
    const response = await apiFetch(
      `/api/public/now-playing?username=${TEST_USERS.testuser1.username}`
    );
    expect(response.status).toBe(401);
  });

  it('public-status does not leak access secrets', async () => {
    const response = await apiFetch(
      `/api/events/public-status?username=${TEST_USERS.testuser1.username}`
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.event?.pin).toBeUndefined();
    expect(data.event?.bypassToken).toBeUndefined();
    expect(data.event?.access_code).toBeUndefined();
  });

  it('allows authenticated DJ to read event status', async () => {
    const { cookie } = await loginAs(
      TEST_USERS.testuser1.username,
      TEST_USERS.testuser1.password
    );
    const response = await apiFetch('/api/event/status', { cookie });
    expect(response.status).toBe(200);
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
    expect(response.status).toBe(200);
  });
});
