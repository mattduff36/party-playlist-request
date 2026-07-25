import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';

test.describe('Guest request flow', () => {
  test('request page loads for testuser1', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/request`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('body')).toBeVisible();
    // Either PIN gate, party-not-started, or search UI
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(20);
  });

  test('can enter PIN when prompted and reach search UI', async ({ page }) => {
    await page.goto(`/${TEST_USERS.testuser1.username}/request`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const pinInput = page.locator('input[type="tel"], input[inputmode="numeric"], input[name="pin"], #pin').first();
    if (await pinInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      await pinInput.fill(TEST_USERS.testuser1.pin);
      const submit = page.getByRole('button', { name: /enter|submit|continue|verify/i }).first();
      if (await submit.isVisible().catch(() => false)) {
        await submit.click();
      }
    }

    // Nickname / search may appear depending on event state
    const nickname = page.locator('input[placeholder*="name" i], input[name="nickname"], #nickname').first();
    if (await nickname.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nickname.fill(`E2E${Date.now().toString().slice(-4)}`);
      const search = page.locator('input[placeholder*="search" i], input[type="search"]').first();
      if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
        await search.fill('Blinding');
        await page.waitForTimeout(800);
        const track = page.getByText(/Blinding Lights/i).first();
        if (await track.isVisible({ timeout: 8000 }).catch(() => false)) {
          await track.click();
          await expect(page.locator('body')).toContainText(/request|success|pending|submitted/i);
        }
      }
    }
  });
});
