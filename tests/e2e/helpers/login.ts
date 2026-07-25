import type { Page } from '@playwright/test';

/**
 * Log in via /login, handling the single-session transfer modal when present.
 */
export async function loginAs(
  page: Page,
  username: string,
  password: string,
  options: { timeoutMs?: number } = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const adminPattern = new RegExp(`/${username}/admin`);

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.fill('#username', username);
      await page.fill('#password', password);
      await page.click('button[type="submit"]');

      const transferButton = page.getByRole('button', {
        name: /yes,?\s*transfer/i,
      });

      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (adminPattern.test(page.url())) {
          return;
        }
        if (await transferButton.isVisible().catch(() => false)) {
          await transferButton.click();
          await page.waitForURL(adminPattern, { timeout: timeoutMs });
          return;
        }
        await page.waitForTimeout(200);
      }

      await page.waitForURL(adminPattern, { timeout: 5_000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1_000 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`loginAs failed for ${username}`);
}
