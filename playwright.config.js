const { defineConfig, devices } = require('@playwright/test');

/**
 * E2E com Supabase simulado (tests/e2e/support/mockSupabase.js): nao usa senha
 * nem toca no Supabase DEV/PROD. Sobe o Vite numa porta propria.
 */
const port = 4173;
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 30000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } }
  ]
});
