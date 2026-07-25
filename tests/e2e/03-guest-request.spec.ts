import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';
import { loginAs } from './helpers/login';

async function fetchAccessCode(page: import('@playwright/test').Page): Promise<string | null> {
  await loginAs(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password);
  const code = await page.evaluate(async () => {
    const response = await fetch('/api/events/current', { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    return (data.event?.access_code || data.event?.pin || null) as string | null;
  });
  return code;
}

test.describe('Guest request flow', () => {
  test('bare request page shows access code entry for testuser1', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/request`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/Loading/i)).toHaveCount(0, { timeout: 15000 });
    await expect(
      page.getByText(/access code|Party Playlist|Party Not Started|request|Continue/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('access-code URL opens request flow without manual entry', async ({ page }) => {
    const accessCode = await fetchAccessCode(page);
    test.skip(!accessCode, 'No active event access code available');

    await page.goto(
      `/${TEST_USERS.testuser1.username}/${accessCode}/request`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );

    await expect(page.getByText(/Access Denied/i)).toHaveCount(0, { timeout: 15000 });

    const nickname = page
      .locator('input[placeholder*="name" i], input[name="nickname"], #nickname')
      .first();
    if (await nickname.isVisible({ timeout: 8000 }).catch(() => false)) {
      await nickname.fill(`E2E${Date.now().toString().slice(-4)}`);
      const search = page.locator('input[placeholder*="search" i], input[type="search"]').first();
      if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
        await search.fill('Blinding');
        await page.waitForTimeout(800);
      }
    }

    await expect(page.locator('body')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(10);
  });

  test('can enter access code on bare URL and reach request UI', async ({ page }) => {
    const accessCode = await fetchAccessCode(page);
    test.skip(!accessCode, 'No active event access code available');

    await page.goto(`/${TEST_USERS.testuser1.username}/request`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const codeInput = page.locator('#accessCode, input[id="accessCode"]').first();
    await expect(codeInput).toBeVisible({ timeout: 15000 });
    await codeInput.fill(accessCode!);
    const submit = page.getByRole('button', { name: /continue|enter|submit|verify/i }).first();
    await submit.click();
    await page.waitForURL(new RegExp(`/${accessCode}/request`), { timeout: 15000 });
    await expect(page.locator('body')).toBeVisible();
  });
});
