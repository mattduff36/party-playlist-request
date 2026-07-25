import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.TEST_SERVER_URL || 'http://127.0.0.1:3000';
const reuseServer =
  process.env.PLAYWRIGHT_REUSE_SERVER === '1' ||
  process.env.PLAYWRIGHT_REUSE_SERVER === 'true';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/playwright-report' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Finalise starts the production server; local ad-hoc runs can still use webServer
  webServer: reuseServer
    ? undefined
    : {
        command: 'npm run start -- --port 3000',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          SPOTIFY_MOCK: 'true',
        },
      },
});
