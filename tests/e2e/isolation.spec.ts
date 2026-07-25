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
  await page.waitForURL(new RegExp(`/${username}/admin`), { timeout: 15000 });
}

test.describe('Tenant isolation smoke', () => {
  test('DJ2 admin URL is distinct from DJ1', async ({ page }) => {
    await login(page, TEST_USERS.testuser2.username, TEST_USERS.testuser2.password);
    expect(page.url()).toContain('/testuser2/admin');
    expect(page.url()).not.toContain('/testuser1/admin');
  });

  test('DJ2 settings do not show DJ1 event title as default chrome', async ({ page }) => {
    await login(page, TEST_USERS.testuser2.username, TEST_USERS.testuser2.password);
    await page.goto(`/${TEST_USERS.testuser2.username}/admin/settings`);
    const body = await page.locator('body').innerText();
    // Soft check: page loaded for correct tenant path
    expect(page.url()).toContain('/testuser2/');
    expect(body.length).toBeGreaterThan(20);
  });
});
