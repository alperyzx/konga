const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const AUTH_STATE = path.join(__dirname, '.auth', 'konga.json');

module.exports = defineConfig({
  testDir: './specs',

  // Konga drives a single shared Kong node. Running specs in parallel would let
  // two workers race on the same fixture entities, so keep it serial.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60000,
  reporter: process.env.CI ? [['list']] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.KONGA_URL || 'http://localhost:1337',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Source-tree assertions. Needs no browser and no running Konga, so it is
    // listed first and has no dependencies — it is the fast feedback loop.
    {
      name: 'static',
      testMatch: /.*\.static\.spec\.js/,
    },
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || 'chrome' },
    },
    {
      name: 'ui',
      testMatch: /.*\.ui\.spec\.js/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chrome',
        storageState: AUTH_STATE,
      },
    },
  ],
});

module.exports.AUTH_STATE = AUTH_STATE;
