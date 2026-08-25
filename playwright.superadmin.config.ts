import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: 'final-global-isolated.spec.ts',
  grep: /Context E Superadmin/,
  timeout: 600_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/superadmin',
  use: {
    baseURL: 'http://localhost:3100',
    headless: true,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
});
