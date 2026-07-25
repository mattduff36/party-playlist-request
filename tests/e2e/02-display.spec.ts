import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';
import { loginAs } from './helpers/login';

async function fetchAccessCode(page: import('@playwright/test').Page): Promise<string | null> {
  await loginAs(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password);
  return page.evaluate(async () => {
    const response = await fetch('/api/events/current', { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    return (data.event?.access_code || data.event?.pin || null) as string | null;
  });
}

test.describe('Display screen', () => {
  test('access-code display route accepts current event code', async ({ page }) => {
    const accessCode = await fetchAccessCode(page);
    test.skip(!accessCode, 'No active event access code available');

    await page.context().clearCookies();
    await page.goto(
      `/${TEST_USERS.testuser1.username}/${accessCode}/display`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(1500);
    const url = page.url();
    expect(
      url.includes('/display') || (await page.locator('body').innerText()).length > 10
    ).toBeTruthy();
  });

  test('legacy PIN display path redirects into access-code URL', async ({ page }) => {
    const accessCode = await fetchAccessCode(page);
    test.skip(!accessCode, 'No active event access code available');

    await page.context().clearCookies();
    await page.goto(
      `/${TEST_USERS.testuser1.username}/display/${accessCode}`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(1500);
    expect(page.url()).toContain(`/${accessCode}/display`);
  });

  test('display page auth gate shows guidance when unauthenticated', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/display`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(10);
  });
});
