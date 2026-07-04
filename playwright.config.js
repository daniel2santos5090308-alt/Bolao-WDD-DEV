const { defineConfig, devices } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '.env.e2e');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm start',
    url: process.env.E2E_BASE_URL || 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 30000
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
