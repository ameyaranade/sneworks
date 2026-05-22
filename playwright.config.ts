import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,  // Tests share emulator state; run sequentially by default
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:5173',
    // Simulate an iPhone 14 Pro — matches mobile-first design
    ...devices['iPhone 14 Pro'],
    // Override viewport to match the portrait layout
    viewport: { width: 393, height: 852 },
    // Keep traces on first retry only (useful for CI debugging)
    trace: 'on-first-retry',
    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['iPhone 14 Pro'],
        // Use Chromium (Desktop engine but with mobile UA + viewport)
        channel: undefined,
      },
    },
  ],

  // Start the Vite dev server pointing at the Firebase Emulator
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    env: {
      VITE_USE_EMULATOR: 'true',
    },
  },

  // HTML report for easy viewing
  reporter: [['list'], ['html', { open: 'never' }]],
});
