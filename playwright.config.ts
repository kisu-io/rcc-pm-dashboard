import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — golden-path E2E.
 * Boots `next dev` on port 4000 (matches project convention) with a dummy Supabase key
 * so the app runs in demo-data fallback mode (no real backend needed).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4000',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'NEXT_PUBLIC_SUPABASE_URL=https://demo.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_E2E_BYPASS_AUTH=1 npm run dev -- --port 4000',
    port: 4000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});