/**
 * Admin request lifecycle API tests
 */

import { TEST_USERS } from '../fixtures/users';
import { apiFetch, loginAs } from '../utils/api-client';

describe('Admin request lifecycle', () => {
  it('lists requests for authenticated DJ', async () => {
    const { cookie } = await loginAs(
      TEST_USERS.testuser1.username,
      TEST_USERS.testuser1.password
    );
    const response = await apiFetch('/api/admin/requests?status=pending&limit=20', {
      cookie,
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.requests || Array.isArray(data)).toBeTruthy();
  });

  it('rejects unauthorized approve', async () => {
    const response = await apiFetch(
      '/api/admin/approve/00000000-0000-0000-0000-000000000001',
      { method: 'POST', body: JSON.stringify({}) }
    );
    expect([401, 403]).toContain(response.status);
  });

  it('can reject a pending request when one exists', async () => {
    const { cookie } = await loginAs(
      TEST_USERS.testuser1.username,
      TEST_USERS.testuser1.password
    );
    const list = await apiFetch('/api/admin/requests?status=pending&limit=5', {
      cookie,
    });
    const data = await list.json();
    const requests = data.requests || [];
    if (!requests.length) {
      console.warn('No pending requests — skipping reject assertion');
      return;
    }
    const id = requests[0].id;
    const reject = await apiFetch(`/api/admin/reject/${id}`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ reason: 'api-test' }),
    });
    expect([200, 201]).toContain(reject.status);
  });

  it('can approve a pending request when one exists (mock Spotify)', async () => {
    // Submit a fresh request first
    await apiFetch('/api/request', {
      method: 'POST',
      body: JSON.stringify({
        track_uri: 'spotify:track:3PfIrDoz19wz7qK7tYeu62',
        requester_nickname: `Apr${Date.now().toString().slice(-4)}`,
        username: TEST_USERS.testuser1.username,
        user_session_id: `approve-${Date.now()}`,
      }),
    });

    const { cookie } = await loginAs(
      TEST_USERS.testuser1.username,
      TEST_USERS.testuser1.password
    );
    const list = await apiFetch('/api/admin/requests?status=pending&limit=5', {
      cookie,
    });
    const data = await list.json();
    const requests = data.requests || [];
    if (!requests.length) {
      console.warn('No pending requests — skipping approve assertion');
      return;
    }
    const id = requests[0].id;
    const approve = await apiFetch(`/api/admin/approve/${id}`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({}),
    });
    expect([200, 201]).toContain(approve.status);
  });
});
