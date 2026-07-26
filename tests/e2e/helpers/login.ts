import type { Page } from '@playwright/test';

/**
 * Log in via /login, handling the single-session transfer modal when present.
 * Product copy: "Yes, Transfer" (SessionTransferModal).
 */
export async function loginAs(
  page: Page,
  username: string,
  password: string,
  options: { timeoutMs?: number } = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const adminPattern = new RegExp(`/${username}/admin`);

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (page.isClosed()) {
        break;
      }

      await page.context().clearCookies();
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.fill('#username', username);
      await page.fill('#password', password);
      await page.click('button[type="submit"]');

      const transferButton = page.getByRole('button', {
        name: /^Yes,?\s*Transfer/i,
      });

      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (page.isClosed()) {
          throw new Error('Page closed during login');
        }

        if (adminPattern.test(page.url())) {
          return;
        }

        if (await transferButton.isVisible().catch(() => false)) {
          await transferButton.click({ timeout: 5_000 });
          await page.waitForURL(adminPattern, { timeout: timeoutMs });
          return;
        }

        await page.waitForTimeout(200);
      }

      await page.waitForURL(adminPattern, { timeout: 10_000 });
      return;
    } catch (error) {
      lastError = error;
      if (page.isClosed()) {
        break;
      }
      await page.waitForTimeout(1_000 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`loginAs failed for ${username}`);
}
