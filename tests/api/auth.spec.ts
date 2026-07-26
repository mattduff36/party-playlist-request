/**
 * Authentication API tests (requires running server + seeded users)
 */

import { TEST_USERS } from '../fixtures/users';
import { apiFetch, loginAs, BASE_URL } from '../utils/api-client';

describe('Authentication API', () => {
  it('rejects login with invalid credentials', async () => {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: TEST_USERS.testuser1.username,
        password: 'wrongpassword',
      }),
    });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toMatch(/invalid/i);
  });

  it('logs in testuser1 (or transfers session)', async () => {
    const result = await loginAs(
      TEST_USERS.testuser1.username,
      TEST_USERS.testuser1.password
    );
    expect([200, 201]).toContain(result.status);
    expect(result.data.success === true || result.data.user || result.data.token).toBeTruthy();
  });

  it('returns current user from /api/auth/me when authenticated', async () => {
    const { cookie } = await loginAs();
    const me = await apiFetch('/api/auth/me', { cookie });
    expect(me.status).toBe(200);
    const data = await me.json();
    expect(data.user?.username || data.username).toBe(TEST_USERS.testuser1.username);
  });

  it('logs out successfully', async () => {
    // Use testuser2 so logout's event-offline cleanup does not leave testuser1 offline for e2e
    const { cookie } = await loginAs(
      TEST_USERS.testuser2.username,
      TEST_USERS.testuser2.password
    );
    const logout = await apiFetch('/api/auth/logout', {
      method: 'POST',
      cookie,
    });
    expect([200, 204]).toContain(logout.status);
  });

  it('hits the expected base URL', () => {
    expect(BASE_URL).toMatch(/127\.0\.0\.1|localhost/);
  });
});
