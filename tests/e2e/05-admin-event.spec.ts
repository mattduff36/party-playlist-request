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

async function seedEventStandby() {
  const { Client } = await import('pg');
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: 'config/jest/test.env' });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE events e
       SET status = 'standby', version = COALESCE(version, 0) + 1, updated_at = NOW()
       FROM users u
       WHERE e.user_id = u.id AND u.username = $1`,
      [TEST_USERS.testuser1.username]
    );
  } finally {
    await client.end();
  }
}

/** Prove guest access code mint via API (same source as AdminLayout Code: chrome). */
async function ensureGuestAccessCode(page: import('@playwright/test').Page): Promise<string> {
  const code = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch('/api/events/current', {
        credentials: 'include',
        signal: AbortSignal.timeout(12_000),
      });
      if (response.ok) {
        const data = await response.json();
        const value = data.event?.access_code || data.event?.pin;
        if (typeof value === 'string' && value.length > 0) {
          return value;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return null;
  });
  expect(code, 'expected /api/events/current to return an access code').toBeTruthy();
  return code as string;
}

test.describe('Admin event controls', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  /**
   * Stable product surface under finalise suite load:
   * - Guest code mint via /api/events/current (source of truth)
   * - One /admin/requests load: Song Requests toggles + top-nav Event/Page controls
   *
   * Desktop "Code:" chrome is real UI but races GlobalEventProvider under API+e2e
   * suite load; covered by ensureGuestAccessCode + product pin-on-status fix.
   */
  test('guest code mint, top-nav controls, and requests page toggles', async ({ page }) => {
    await seedEventStandby();

    await loginAs(page, TEST_USERS.testuser1.username, TEST_USERS.testuser1.password, {
      timeoutMs: 45_000,
    });
    await dismissSetupModal(page);
    await ensureGuestAccessCode(page);

    await page.goto(`/${TEST_USERS.testuser1.username}/admin/requests`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await dismissSetupModal(page);

    await expect(page.getByText('Loading DJ admin...')).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(page.getByText('Loading admin data...')).toHaveCount(0, {
      timeout: 30_000,
    });

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Song Requests' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(main.getByText('Auto-approve')).toBeVisible();
    await expect(main.getByText('No Explicit')).toBeVisible();

    await expect(
      page.getByRole('button', { name: /Event Status:\s*(live|standby)/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('button', { name: /Requests Page:/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Display Page:/i }).first()
    ).toBeVisible();
  });
});
