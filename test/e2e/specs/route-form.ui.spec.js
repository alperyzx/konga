/**
 * The route form's three chip-edited fields, in a browser, against real Kong.
 *
 * `headers`, `sources` and `destinations` are a map and two sets of records in
 * Kong's schema, but the form edits them as free-text chips, so a conversion
 * sits in between. The static suite proves the conversion; this proves the
 * form is wired to it — that a malformed chip now says so instead of throwing
 * out of the submit handler, and that a well-formed one reaches Kong in the
 * shape the schema wants and comes back on reload.
 */

const { test, expect } = require('@playwright/test');
const { kong, PREFIX } = require('../helpers/kong');
const { collectErrors, errors, waitForAngular } = require('../helpers/konga');

const SERVICE = PREFIX + 'route-form-svc';

/** Type a chip and commit it — the control turns the text into a chip on Enter. */
async function addChip(page, label, text) {
  const group = page
    .locator('.form-group')
    .filter({ has: page.locator(`label:has-text("${label}")`) })
    .first();
  await group.locator('input[chip-control]').fill(text);
  await group.locator('input[chip-control]').press('Enter');
  return group;
}

async function openRouteForm(page, serviceId) {
  // Routes are a named view inside the service's read state, not a URL of
  // their own.
  await page.goto(`/#!/services/${serviceId}/read`);
  await waitForAngular(page);
  await page.locator('button:has-text("add route")').first().click();
  await expect(page.locator('.modal form, .modal .form-group').first()).toBeVisible({
    timeout: 15000,
  });
  await page.waitForTimeout(500);
}

let serviceId;

test.beforeAll(async () => {
  const { body } = await kong.post('/services', {
    name: SERVICE,
    url: 'http://httpbin.test:80',
  });
  serviceId = body.id;
});

test.afterAll(async () => {
  if (serviceId) await kong.del(`/services/${serviceId}`);
});

test.beforeEach(async ({ page }) => {
  await collectErrors(page);
});

test('a header chip without a colon is reported, not swallowed', async ({ page }) => {
  await openRouteForm(page, serviceId);

  await addChip(page, 'Paths', '/' + PREFIX + 'bad');
  await addChip(page, 'Headers', 'no-colon-here');
  await page.locator('.modal button:has-text("Submit Route")').first().click();
  await page.waitForTimeout(1500);

  // Before the fix this threw a TypeError out of $scope.submit: no request was
  // sent, no error was shown, and the modal just sat there.
  await expect(page.locator('.modal .text-danger:visible').first()).toContainText(
    'no-colon-here'
  );

  const { body } = await kong.get(`/services/${serviceId}/routes`);
  expect(body.data).toHaveLength(0);

  // And the crash is gone, not merely caught somewhere downstream.
  expect(await errors(page)).toEqual([]);
});

test('well-formed chips reach Kong in the schema shape and come back', async ({ page }) => {
  await openRouteForm(page, serviceId);

  const path = '/' + PREFIX + 'chips';
  await addChip(page, 'Paths', path);
  await addChip(page, 'Headers', 'x-konga-test:alpha,beta');
  await page.locator('.modal button:has-text("Submit Route")').first().click();
  await page.waitForTimeout(2500);

  const { body } = await kong.get(`/services/${serviceId}/routes`);
  const route = body.data.find((r) => (r.paths || []).includes(path));
  expect(route, 'the route was created').toBeTruthy();
  // A map of name -> list of values, which is what the schema types it as.
  expect(route.headers).toEqual({ 'x-konga-test': ['alpha', 'beta'] });

  // Reopening has to turn the map back into the chip the user typed, or the
  // next save would send Kong's shape through the parser a second time.
  await page.goto(`/#!/routes/${route.id}/read`);
  await waitForAngular(page);
  await page.waitForTimeout(1500);
  await expect(
    page.locator('.form-group').filter({ has: page.locator('label:has-text("Headers")') })
      .first()
  ).toContainText('x-konga-test:alpha,beta');

  await kong.del(`/routes/${route.id}`);
});
