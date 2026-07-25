import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.TEST_SERVER_URL || 'http://127.0.0.1:3000';
const reuseServer =
  process.env.PLAYWRIGHT_REUSE_SERVER === '1' ||
  process.env.PLAYWRIGHT_REUSE_SERVER === 'true';

export default defineConfig({
  testDir: 'tests/e2e',
  // Run lighter guest/auth checks before admin flows that start watchers.
  testMatch: [
    '**/01-auth.spec.ts',
    '**/02-display.spec.ts',
    '**/03-guest-request.spec.ts',
    '**/04-isolation.spec.ts',
    '**/05-admin-event.spec.ts',
  ],
  outputDir: 'test-results/e2e-artifacts',
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
        command: 'node .next/standalone/server.js',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          SPOTIFY_MOCK: 'true',
          PORT: '3000',
          HOSTNAME: '127.0.0.1',
        },
      },
});
