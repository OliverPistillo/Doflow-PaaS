import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual', testMatch: 'team-invite-feedback.spec.ts',
  timeout: 90_000, expect: { timeout: 15_000 }, workers: 1, retries: 0,
  reporter: [['list']], outputDir: 'test-results/team-invite',
  use: {
    baseURL: 'http://localhost:3100', browserName: 'chromium', headless: true,
    viewport: { width: 1440, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome',
    trace: 'off', video: 'off', screenshot: 'off', serviceWorkers: 'block',
    actionTimeout: 15_000,
  },
});
