/**
 * Multi-tenant isolation API checks
 */

import { TEST_USERS } from '../fixtures/users';
import { apiFetch, loginAs } from '../utils/api-client';

describe('Multi-tenant isolation', () => {
  it('scopes public event-config by username', async () => {
    const u1 = await apiFetch(
      `/api/public/event-config?username=${TEST_USERS.testuser1.username}`
    );
    const u2 = await apiFetch(
      `/api/public/event-config?username=${TEST_USERS.testuser2.username}`
    );
    expect(u1.status).toBe(200);
    expect(u2.status).toBe(200);
    const d1 = await u1.json();
    const d2 = await u2.json();
    const title1 = d1.config?.event_title || d1.event_title;
    const title2 = d2.config?.event_title || d2.event_title;
    if (title1 && title2) {
      expect(title1).not.toBe(title2);
    }
  });

  it('prevents DJ1 from approving a missing/foreign request id', async () => {
    const { cookie } = await loginAs(
      TEST_USERS.testuser1.username,
      TEST_USERS.testuser1.password
    );
    const fakeId = '00000000-0000-0000-0000-000000000099';
    const response = await apiFetch(`/api/admin/approve/${fakeId}`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({}),
    });
    expect([403, 404]).toContain(response.status);
  });

  it('lists admin requests only for the authenticated user', async () => {
    const dj1 = await loginAs(
      TEST_USERS.testuser1.username,
      TEST_USERS.testuser1.password
    );
    const dj2 = await loginAs(
      TEST_USERS.testuser2.username,
      TEST_USERS.testuser2.password
    );

    const r1 = await apiFetch('/api/admin/requests?status=all&limit=50', {
      cookie: dj1.cookie,
    });
    const r2 = await apiFetch('/api/admin/requests?status=all&limit=50', {
      cookie: dj2.cookie,
    });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const data1 = await r1.json();
    const data2 = await r2.json();
    const list1 = data1.requests || data1 || [];
    const list2 = data2.requests || data2 || [];

    if (Array.isArray(list1) && Array.isArray(list2) && list1.length && list2.length) {
      const ids1 = new Set(list1.map((r: { id: string }) => r.id));
      for (const req of list2) {
        expect(ids1.has(req.id)).toBe(false);
      }
    }
  });
});
