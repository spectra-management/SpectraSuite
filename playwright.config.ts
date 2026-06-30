import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for browser / e2e UI verification (screenshots).
 *
 * Usage:
 *   npm run test:e2e            # starts the Vite dev server and runs the e2e specs
 *   npm run test:e2e:ui         # interactive UI mode
 *   PW_BASE_URL=http://localhost:5173 npm run test:e2e   # reuse a server you already started
 *
 * Screenshots taken via the `screenshot()` helper land in `e2e/screenshots/` for review.
 */

const PORT = Number(process.env.PW_PORT ?? 5173)
const BASE_URL = process.env.PW_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Start the dev server automatically (unless you point PW_BASE_URL at a running one).
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
