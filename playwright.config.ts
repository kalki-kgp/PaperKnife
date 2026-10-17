/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { defineConfig, devices } from '@playwright/test'

// E2E_BASE_URL points the suite at a deployed site (production smoke test).
// Without it, the built dist/ is served by wrangler so the real _headers,
// including the CSP, apply exactly as they do in production.
const remote = process.env.E2E_BASE_URL
const PORT = 8788

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: remote ?? `http://localhost:${PORT}`,
    acceptDownloads: true,
    viewport: { width: 1280, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1000 } } }],
  webServer: remote ? undefined : {
    command: `node_modules/.bin/wrangler dev --local --port ${PORT} --show-interactive-dev-session=false`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: 'false' }
  }
})
