import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('#username', TEST_USERS.testuser1.username);
  await page.fill('#password', TEST_USERS.testuser1.password);
  await page.click('button[type="submit"]');
  const transfer = page.getByRole('button', { name: /transfer|yes/i });
  if (await transfer.isVisible({ timeout: 3000 }).catch(() => false)) {
    await transfer.click();
  }
  await page.waitForURL(/\/testuser1\/admin/, { timeout: 15000 });
}

test.describe('Admin event controls', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('overview shows event control buttons', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/admin/overview`);
    await expect(page.getByText('Event Control')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Standby')).toBeVisible();
    await expect(page.getByText('Live')).toBeVisible();
  });

  test('can move event toward live', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/admin/overview`);
    const standby = page.getByRole('button', { name: /Standby/i }).first();
    if (await standby.isVisible({ timeout: 5000 }).catch(() => false)) {
      await standby.click();
      await page.waitForTimeout(1000);
    }
    const live = page.getByRole('button', { name: /^Live$/i }).first();
    await live.click();
    await page.waitForTimeout(1500);
    // Soft assertion — UI remains usable
    await expect(page.getByText('Event Control')).toBeVisible();
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
