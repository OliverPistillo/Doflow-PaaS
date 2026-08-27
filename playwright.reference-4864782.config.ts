import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: ["doflow-final-matrix.mocked.spec.ts", "auth-final.spec.ts"],
  timeout: 1_800_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/reference-4864782",
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  webServer: {
    command: "pnpm -C apps/frontend exec next dev -H localhost -p 3100",
    url: "http://localhost:3100/login",
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      INTERNAL_BACKEND_URL: "http://localhost:3401",
      NEXT_PUBLIC_API_URL: "",
    },
  },
})
