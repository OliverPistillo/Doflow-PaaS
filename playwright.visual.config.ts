import { defineConfig } from '@playwright/test';

const storageState = process.env.DOFLOW_VISUAL_STORAGE_STATE;

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['line']],
  outputDir: 'test-results/visual',
  use: {
    baseURL: process.env.DOFLOW_VISUAL_FRONTEND_URL || 'http://localhost:3100',
    browserName: 'chromium',
    colorScheme: 'light',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    storageState,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
});
