import { defineConfig } from '@playwright/test';

const viewport = process.env.DOFLOW_TEAM_ACCOUNT_VIEWPORT === 'tablet'
  ? { width: 1024, height: 768 }
  : process.env.DOFLOW_TEAM_ACCOUNT_VIEWPORT === 'mobile'
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 };

export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: 'team-account-isolated.spec.ts',
  timeout: 600_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    headless: true,
    viewport,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
});
