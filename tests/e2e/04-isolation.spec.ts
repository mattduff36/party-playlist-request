import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';
import { loginAs } from './helpers/login';

test.describe('Tenant isolation smoke', () => {
  test('public event-config titles differ by username', async ({ request }) => {
    const r1 = await request.get(
      `/api/public/event-config?username=${TEST_USERS.testuser1.username}`
    );
    const r2 = await request.get(
      `/api/public/event-config?username=${TEST_USERS.testuser2.username}`
    );
    expect(r1.ok()).toBeTruthy();
    expect(r2.ok()).toBeTruthy();
    const d1 = await r1.json();
    const d2 = await r2.json();
    const title1 = d1.config?.event_title || d1.event_title;
    const title2 = d2.config?.event_title || d2.event_title;
    expect(title1).toBe(TEST_USERS.testuser1.eventTitle);
    expect(title2).toBe(TEST_USERS.testuser2.eventTitle);
    expect(title1).not.toBe(title2);
  });

  test('DJ2 admin URL is distinct from DJ1', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, TEST_USERS.testuser2.username, TEST_USERS.testuser2.password);
    expect(page.url()).toContain('/testuser2/admin');
    expect(page.url()).not.toContain('/testuser1/admin');
  });
});
