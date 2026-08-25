import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: 'automation-performance-isolated.spec.ts',
  timeout: 480_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100', headless: true, locale: 'it-IT', timezoneId: 'Europe/Rome',
    trace: 'off', video: 'off', screenshot: 'off',
  },
});
