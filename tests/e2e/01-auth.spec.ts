import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';
import { loginAs } from './helpers/login';

test.describe('Authentication', () => {
  test('logs in with valid credentials', async ({ page }) => {
    await loginAs(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password);
    await expect(page).toHaveURL(/\/testuser1\/admin\/spotify/);
    await expect(page.getByText(/Spotify/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('fails login with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', TEST_USERS.testuser1.username);
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/Invalid credentials/i)).toBeVisible({ timeout: 8000 });
    expect(page.url()).toContain('/login');
  });

  test('redirects unauthenticated admin access to login', async ({ page }) => {
    await page.goto('/testuser1/admin/requests');
    await page.waitForURL(/\/login/, { timeout: 15000, waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/login');
  });

  test('persists session after refresh', async ({ page }) => {
    await loginAs(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password);
    await page.reload();
    await expect(page.getByText(/Spotify/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('logs out', async ({ page }) => {
    // Use testuser2 so logout's event-offline side effect does not break later admin e2e for testuser1
    await loginAs(page, TEST_USERS.testuser2.username, TEST_USERS.testuser2.password);
    // Prefer the visible header control (desktop/mobile both use title="Logout").
    await page.locator('button[title="Logout"]').locator('visible=true').first().click();
    const confirm = page.getByRole('button', { name: /^Logout$/i }).last();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirm.click();
    }
    await page.waitForURL(/\/login/, { timeout: 15000, waitUntil: 'domcontentloaded' });
  });
});
