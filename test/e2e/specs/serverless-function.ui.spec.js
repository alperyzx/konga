const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { createFixtures, cleanupFixtures, kong } = require('../helpers/kong');
const { waitForAngular } = require('../helpers/konga');

const LUA_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'test.lua'),
  'utf8'
);

let fixtures;

test.beforeAll(async () => {
  fixtures = await createFixtures();
});

test.afterAll(async () => {
  await cleanupFixtures();
});

test('pre-function access preserves a pasted Lua file exactly', async ({ page, context }) => {
  // The production bundle keeps the application version in its URL, so clear
  // the browser cache to exercise the bundle built by this test run.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');

  await page.goto(`/#!/routes/${fixtures.route.id}/read`);
  await waitForAngular(page);
  await page.getByRole('link', { name: /Plugins/ }).click();
  await page.getByRole('button', { name: /add plugin/i }).click();
  await page.getByRole('link', { name: 'Serverless' }).click();

  const card = page.locator('div').filter({
    has: page.getByText('pre function', { exact: true }),
  }).filter({
    has: page.getByRole('button', { name: 'Add Plugin' }),
  }).last();
  await card.getByRole('button', { name: 'Add Plugin' }).click();

  const dialog = page.getByRole('dialog').first();
  const access = dialog.locator('.form-group').filter({
    has: page.locator('strong', { hasText: /^access$/ }),
  });
  await access.getByRole('button', { name: /add script/i }).click();

  const editor = access.locator('textarea.plugin-script-editor');
  await expect(editor).toHaveAttribute('ng-trim', 'false');
  await editor.fill(LUA_SOURCE);

  const [response] = await Promise.all([
    page.waitForResponse((res) =>
      res.url().includes('/kong/plugins') && res.request().method() === 'POST'
    ),
    dialog.getByRole('button', { name: /add plugin/i }).click(),
  ]);
  expect(response.status()).toBe(200);

  const plugins = await kong.plugins('routes', fixtures.route.id);
  const preFunction = plugins.find((plugin) => plugin.name === 'pre-function');
  expect(preFunction).toBeTruthy();
  expect(preFunction.config.access).toEqual([LUA_SOURCE]);
});
