const { defineConfig } = require('@playwright/test');

const nodeBinary = JSON.stringify(process.execPath);

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1366, height: 900 },
  },
  webServer: {
    command: `${nodeBinary} scripts/dev/static-server.mjs 4173`,
    port: 4173,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
