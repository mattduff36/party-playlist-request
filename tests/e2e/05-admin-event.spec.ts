import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';
import { loginAs } from './helpers/login';

test.describe('Admin event controls', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password);
  });

  test('overview shows event control buttons', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/admin/overview`);
    await expect(page.getByText('Event Control')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Standby')).toBeVisible();
    await expect(page.getByText('Live')).toBeVisible();
  });

  test('live and standby controls are available', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/admin/overview`);
    await expect(page.getByText('Event Control')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Standby/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Live$/i }).first()).toBeVisible();
  });

  test('page controls are visible when event is active', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/admin/overview`);
    await expect(page.getByText('Page Controls')).toBeVisible({ timeout: 10000 });
  });

  test('settings page loads', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/admin/settings`);
    await expect(page.locator('body')).toContainText(/Settings|Event|Request/i);
  });
});
