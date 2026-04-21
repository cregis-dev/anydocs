// Playwright Configuration
import { defineConfig, devices } from '@playwright/test';

const STUDIO_RUNTIME_MODE_CLI = 'cli';
const isCliStudio = process.env.ANYDOCS_E2E_STUDIO_MODE === STUDIO_RUNTIME_MODE_CLI;
const webServer =
  process.env.STUDIO_SKIP_WEBSERVER === '1'
    ? undefined
    : {
        command: isCliStudio
          ? 'node --experimental-strip-types scripts/start-e2e-studio.mjs'
          : 'pnpm dev',
        url: 'http://127.0.0.1:3000/robots.txt',
        reuseExistingServer: isCliStudio ? false : !process.env.CI,
        timeout: 120000,
      };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: isCliStudio ? 1 : process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.STUDIO_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer,
});
