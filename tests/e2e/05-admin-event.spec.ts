import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';
import { loginAs } from './helpers/login';

async function dismissSetupModal(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('party_setup_prompt_seen', 'true');
  });

  const later = page.getByRole('button', { name: /Maybe Later/i });
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    await later.click();
    await expect(later).toBeHidden({ timeout: 5000 }).catch(() => undefined);
  }
}

/**
 * Settings Access code panel requires global event status live/standby.
 *
 * Prefer the top-bar Event Status button (authoritative client state).
 * Do NOT click Standby/Live under suite load — page fan-out can leave
 * local isTransitioning stuck even after status already changed.
 * If offline, POST via in-page fetch (browser cookies).
 */
async function ensureEventActive(page: import('@playwright/test').Page) {
  const activeStatus = page.getByRole('button', {
    name: /Event Status:\s*(live|standby)/i,
  });

  if (await activeStatus.isVisible({ timeout: 8_000 }).catch(() => false)) {
    return;
  }

  const result = await page.evaluate(async () => {
    const res = await fetch('/api/event/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'standby' }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  });

  expect(
    result.ok,
    `POST /api/event/status standby failed: ${result.status} ${result.text}`
  ).toBeTruthy();

  await expect(activeStatus).toBeVisible({ timeout: 20_000 });
}

/** Desktop sidebar Settings (AdminLayout: button + router.push). */
function desktopSettingsNav(page: import('@playwright/test').Page) {
  return page
    .locator('div.hidden.md\\:flex.md\\:fixed')
    .getByRole('button', { name: /^Settings$/i });
}

test.describe('Admin event controls', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('requests page toggles, top-nav controls, and settings access code', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password);
    await dismissSetupModal(page);

    await page.goto(`/${TEST_USERS.testuser1.username}/admin/requests`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await dismissSetupModal(page);

    await expect(page.getByText('Loading admin data...')).toHaveCount(0);

    const main = page.getByRole('main');
    await expect(main.getByText('Song Requests')).toBeVisible({ timeout: 30_000 });
    await expect(main.getByText('Auto-approve')).toBeVisible();
    await expect(main.getByText('No Explicit')).toBeVisible();

    // Top-nav Event Status + page toggles (replaces former Event/Page Control cards)
    await expect(
      page.getByRole('button', { name: /Event Status:/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Requests Page:/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Display Page:/i }).first()
    ).toBeVisible();

    await ensureEventActive(page);

    const settingsBtn = desktopSettingsNav(page);
    await expect(settingsBtn).toBeVisible();
    await Promise.all([
      page.waitForURL(
        new RegExp(`/${TEST_USERS.testuser1.username}/admin/settings`),
        { timeout: 20_000 }
      ),
      settingsBtn.click(),
    ]);

    await expect(page.getByText('Loading DJ admin...')).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(page.getByText('Event Settings')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Loading admin data...')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Advanced Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Secure URL access' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Access code' })).toBeVisible({
      timeout: 15_000,
    });
  });
});
