const fs = require('fs');
const path = require('path');
const { test: setup, expect } = require('@playwright/test');
const { login } = require('../helpers/konga');

const AUTH_STATE = path.join(__dirname, '..', '.auth', 'konga.json');

/**
 * Log in once and hand the session to every UI spec via storageState.
 * Konga keeps its JWT in localStorage under `ngStorage-credentials`, which
 * storageState captures along with cookies.
 */
setup('authenticate', async ({ page, baseURL }) => {
  const username = process.env.KONGA_USER || 'admin';
  const password = process.env.KONGA_PASSWORD;

  expect(
    password,
    'Set KONGA_PASSWORD to your Konga admin password before running the UI specs.'
  ).toBeTruthy();

  await login(page, { username, password, baseURL });

  // ngStorage mirrors its scope into localStorage at the end of a digest, so
  // the key can lag the redirect by a tick. Poll rather than read once.
  await page.waitForFunction(
    () => !!window.localStorage.getItem('ngStorage-credentials'),
    null,
    { timeout: 15000 }
  );

  fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE });
});
