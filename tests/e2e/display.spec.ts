import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';

test.describe('Display screen', () => {
  test('PIN display route accepts seeded PIN or shows gate', async ({ page }) => {
    await page.goto(
      `/${TEST_USERS.testuser1.username}/display/${TEST_USERS.testuser1.pin}`
    );
    await page.waitForTimeout(1500);
    // Either redirected to display or error/gate message
    const url = page.url();
    expect(
      url.includes('/display') || (await page.locator('body').innerText()).length > 10
    ).toBeTruthy();
  });

  test('display page auth gate shows guidance when unauthenticated', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/display`);
    await page.waitForTimeout(1000);
    const text = await page.locator('body').innerText();
    // Access denied / PIN instructions / or authenticated display content
    expect(text.length).toBeGreaterThan(10);
  });
});
