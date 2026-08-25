import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: 'final-global-visual.spec.ts',
  timeout: 1_800_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/final-global-visual',
  use: {
    baseURL: 'http://localhost:3100',
    browserName: 'chromium',
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
});
