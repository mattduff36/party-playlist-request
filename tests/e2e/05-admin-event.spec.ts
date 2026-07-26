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
 * Prefer in-page fetch (browser cookies). Avoid Event Status dropdown
 * clicks under suite load — fan-out can leave isTransitioning stuck.
 */
async function ensureEventActive(page: import('@playwright/test').Page) {
  const activeStatus = page.getByRole('button', {
    name: /Event Status:\s*(live|standby)/i,
  });

  if (await activeStatus.isVisible({ timeout: 15_000 }).catch(() => false)) {
    return;
  }

  // Fallback: set standby in DB when status API hangs under suite load, then reload
  const { Client } = await import('pg');
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: 'config/jest/test.env' });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE events e
       SET status = 'standby', updated_at = NOW()
       FROM users u
       WHERE e.user_id = u.id AND u.username = $1`,
      [TEST_USERS.testuser1.username]
    );
  } finally {
    await client.end();
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await dismissSetupModal(page);
  await expect(page.getByText('Loading admin data...')).toHaveCount(0);
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
    await expect(main.getByRole('heading', { name: 'Song Requests' })).toBeVisible({ timeout: 30_000 });
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
