const { defineConfig } = require('@playwright/test');
const os = require('node:os');
const path = require('node:path');

module.exports = defineConfig({
  testDir: './tests/visual',
  // Keep transient screenshots out of the OneDrive-backed workspace; OneDrive
  // can briefly lock failed-run artifacts while Playwright prepares a rerun.
  outputDir: path.join(os.tmpdir(), 'golden-table-playwright-results'),
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'line',
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    channel: 'msedge',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node scripts/test-server.js',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 10_000
  }
});
