import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';

async function login(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  const transfer = page.getByRole('button', { name: /transfer|yes/i });
  if (await transfer.isVisible({ timeout: 3000 }).catch(() => false)) {
    await transfer.click();
  }
}

test.describe('Authentication', () => {
  test('logs in with valid credentials', async ({ page }) => {
    await login(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password);
    await page.waitForURL(/\/testuser1\/admin/, { timeout: 15000 });
    await expect(page.getByText(/Overview/i).first()).toBeVisible({ timeout: 10000 });
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
    await page.goto('/testuser1/admin/overview');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('persists session after refresh', async ({ page }) => {
    await login(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password);
    await page.waitForURL(/\/testuser1\/admin/, { timeout: 15000 });
    await page.reload();
    await expect(page.getByText(/Overview/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('logs out', async ({ page }) => {
    await login(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password);
    await page.waitForURL(/\/testuser1\/admin/, { timeout: 15000 });
    const logoutButton = page.locator('button[title="Logout"], button:has-text("Logout")').first();
    await logoutButton.click();
    const confirm = page.getByRole('button', { name: /^Logout$/i }).last();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirm.click();
    }
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });
});
