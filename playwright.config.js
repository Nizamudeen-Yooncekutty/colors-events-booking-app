const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/reports/artifacts',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: './e2e/reports/html', open: 'never' }],
    ['json', { outputFile: './e2e/reports/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5000',
    headless: true,
    screenshot: 'on',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'api',
      testMatch: /.*api-only\.spec\.js/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'chromium',
      testMatch: /^(?!.*api-only).*\.spec\.js/,
      use: { browserName: 'chromium' },
    },
  ],
});
