// playwright.config.ts
// E2E test configuration for the Progressive Generation pipeline (Req 22.1).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e/',
  timeout: 120_000,
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
