const { test, expect } = require('@playwright/test');
const { generateKeyPairSync } = require('crypto');
const konga = require('../helpers/konga');
const { kong, createFixtures, cleanupFixtures, PREFIX } = require('../helpers/kong');

let fixtures;
const tag = PREFIX + 'parity';

async function cleanupParityEntities() {
  for (const collection of ['keys', 'key-sets', 'vaults', 'snis']) {
    const response = await kong.get(`/${collection}`);
    for (const entity of (response.body && response.body.data) || []) {
      if ((entity.tags || []).includes(tag)) await kong.del(`/${collection}/${entity.id || entity.prefix || entity.name}`);
    }
  }
}

async function hardReload(page, context, path) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.goto(path);
  await konga.waitForAngular(page);
  await page.reload({ waitUntil: 'networkidle' });
  await konga.waitForAngular(page);
  await konga.clearErrors(page);
  return cdp;
}

test.beforeAll(async () => {
  await cleanupParityEntities();
  fixtures = await createFixtures();
});

test.afterAll(async () => {
  await cleanupParityEntities();
  await cleanupFixtures();
});

test.beforeEach(async ({ page }) => konga.collectErrors(page));

test('the consolidated parity navigation is clean after a hard reload', async ({ page, context }) => {
  const cdp = await hardReload(page, context, '/#!/dashboard');
  try {
    const sidebar = page.locator('.sidebar-nav, nav, aside').first();
    await expect(sidebar.getByText('KEYS & VAULTS', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('CA CERTIFICATES', { exact: true })).toHaveCount(0);
    await expect(sidebar.getByText('SNIS', { exact: true })).toHaveCount(0);
    expect(await konga.errors(page)).toEqual([]);
  } finally {
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  }
});

test('service TLS verification fields persist through Konga and Kong', async ({ page, context }) => {
  const path = `/services/${fixtures.service.id}`;
  const original = (await kong.get(path)).body;
  await kong.patch(path, { protocol: 'https' });
  const cdp = await hardReload(page, context, `/#!/services/${fixtures.service.id}/read`);
  try {
    await page.locator('[ng-model="service.tls_verify"]').selectOption({ label: 'Disabled' });
    await page.locator('[ng-model="service.tls_verify_depth"]').fill('2');
    await page.getByRole('button', { name: /submit changes/i }).click();
    await expect.poll(async () => {
      const value = (await kong.get(path)).body;
      return [value.tls_verify, value.tls_verify_depth];
    }).toEqual([false, 2]);

    await page.reload({ waitUntil: 'networkidle' });
    await konga.waitForAngular(page);
    await expect(page.locator('[ng-model="service.tls_verify"] option:checked')).toHaveText('Disabled');
    await expect(page.locator('[ng-model="service.tls_verify_depth"]')).toHaveValue('2');
    expect(await konga.errors(page)).toEqual([]);
  } finally {
    await kong.patch(path, {
      protocol: original.protocol,
      tls_verify: original.tls_verify,
      tls_verify_depth: original.tls_verify_depth,
    });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  }
});

test('route request and response buffering persist through Konga and Kong', async ({ page, context }) => {
  const path = `/routes/${fixtures.route.id}`;
  const original = (await kong.get(path)).body;
  const cdp = await hardReload(page, context, `/#!/routes/${fixtures.route.id}/read`);
  try {
    for (const field of ['request_buffering', 'response_buffering']) {
      await page.locator(`[ng-model="route.${field}"]`).locator('xpath=..').locator('.bootstrap-switch-label').click();
    }
    await page.getByRole('button', { name: /submit changes/i }).click();
    await expect.poll(async () => {
      const value = (await kong.get(path)).body;
      return [value.request_buffering, value.response_buffering];
    }).toEqual([!original.request_buffering, !original.response_buffering]);

    await page.reload({ waitUntil: 'networkidle' });
    await konga.waitForAngular(page);
    for (const field of ['request_buffering', 'response_buffering']) {
      await expect(page.locator(`[ng-model="route.${field}"]`)).toBeChecked({ checked: !original[field] });
    }
    expect(await konga.errors(page)).toEqual([]);
  } finally {
    await kong.patch(path, {
      request_buffering: original.request_buffering,
      response_buffering: original.response_buffering,
    });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  }
});

test('upstream query hashing and active health headers persist', async ({ page, context }) => {
  const path = `/upstreams/${fixtures.upstream.id}`;
  const original = (await kong.get(path)).body;
  const cdp = await hardReload(page, context, `/#!/upstreams/${fixtures.upstream.id}`);
  try {
    await page.locator('[ng-model="upstream.hash_on"]').selectOption('query_arg');
    await page.locator('[ng-model="upstream.hash_on_query_arg"]').fill('tenant');
    await page.locator('[ng-model="upstream.hash_fallback"]').selectOption('uri_capture');
    await page.locator('[ng-model="upstream.hash_fallback_uri_capture"]').fill('account');
    await page.getByText('Active health checks', { exact: true }).click();
    await page.getByRole('button', { name: 'Add header' }).click();
    await page.locator('[ng-model="row.name"]').last().fill('X-Parity-Probe');
    await page.locator('[ng-model="row.values"]').last().fill('one,two');
    await page.getByRole('button', { name: /submit changes/i }).click();

    await expect.poll(async () => {
      const value = (await kong.get(path)).body;
      return [
        value.hash_on, value.hash_on_query_arg,
        value.hash_fallback, value.hash_fallback_uri_capture,
        value.healthchecks.active.headers && value.healthchecks.active.headers['X-Parity-Probe'],
      ];
    }).toEqual(['query_arg', 'tenant', 'uri_capture', 'account', ['one', 'two']]);

    await page.reload({ waitUntil: 'networkidle' });
    await konga.waitForAngular(page);
    await expect(page.locator('[ng-model="upstream.hash_on_query_arg"]')).toHaveValue('tenant');
    await page.getByText('Active health checks', { exact: true }).click();
    await expect(page.locator('[ng-model="row.name"]')).toHaveValue('X-Parity-Probe');
    expect(await konga.errors(page)).toEqual([]);
  } finally {
    await kong.patch(path, {
      hash_on: original.hash_on,
      hash_on_query_arg: original.hash_on_query_arg,
      hash_fallback: original.hash_fallback,
      hash_fallback_uri_capture: original.hash_fallback_uri_capture,
      healthchecks: original.healthchecks,
    });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  }
});

test('SNI and certificate parity fields render without runtime errors', async ({ page, context }) => {
  const cdp = await hardReload(page, context, '/#!/snis');
  try {
    await page.getByRole('button', { name: /add sni/i }).click();
    const modal = page.locator('.modal');
    for (const label of ['Name', 'Certificate', 'Tags']) await expect(modal.getByText(label, { exact: true })).toBeVisible();
    await modal.getByRole('button', { name: /cancel/i }).click();

    await page.goto('/#!/certificates');
    await konga.waitForAngular(page);
    const add = page.getByRole('button', { name: /add certificate/i });
    if (await add.count()) {
      await add.click();
      await expect(page.locator('[ng-model="data.cert_alt"]')).toBeVisible();
      await expect(page.locator('[ng-model="data.key_alt"]')).toBeVisible();
    }
    expect(await konga.errors(page)).toEqual([]);
  } finally {
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  }
});

test('key set, key name, and Env vault create/edit workflows persist', async ({ page, context }) => {
  const cdp = await hardReload(page, context, '/#!/key-sets');
  let keySet;
  let key;
  let vault;
  try {
    await page.getByRole('button', { name: /add key set/i }).click();
    await page.locator('[ng-model="data.name"]').fill(PREFIX + 'set');
    await page.locator('[ng-model="data.tags"]').fill(tag);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(async () => {
      const data = (await kong.get('/key-sets')).body.data;
      keySet = data.find((item) => (item.tags || []).includes(tag));
      return keySet && keySet.name;
    }).toBe(PREFIX + 'set');

    let row = page.locator('tr').filter({ hasText: PREFIX + 'set' });
    await row.getByRole('button', { name: /edit/i }).click();
    await page.locator('[ng-model="data.name"]').fill(PREFIX + 'set-edited');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(async () => (await kong.get(`/key-sets/${keySet.id}`)).body.name)
      .toBe(PREFIX + 'set-edited');

    await konga.goToState(page, '/keys');
    await page.getByRole('button', { name: /add key$/i }).click();
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...privateKey.export({ format: 'jwk' }), kid: PREFIX + 'kid' };
    await page.locator('[ng-model="data.name"]').fill(PREFIX + 'key');
    await page.locator('[ng-model="data.kid"]').fill(PREFIX + 'kid');
    await page.locator('[ng-model="data.set"]').selectOption({ label: PREFIX + 'set-edited' });
    await page.locator('[ng-model="data.jwk"]').fill(JSON.stringify(jwk));
    await page.locator('[ng-model="data.tags"]').fill(tag);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(async () => {
      const data = (await kong.get('/keys')).body.data;
      key = data.find((item) => (item.tags || []).includes(tag));
      return key && key.name;
    }).toBe(PREFIX + 'key');

    row = page.locator('tr').filter({ hasText: PREFIX + 'key' });
    await row.getByRole('button', { name: /edit/i }).click();
    await page.locator('[ng-model="data.name"]').fill(PREFIX + 'key-edited');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(async () => (await kong.get(`/keys/${key.id}`)).body.name)
      .toBe(PREFIX + 'key-edited');

    await konga.goToState(page, '/vaults');
    await page.getByRole('button', { name: /add vault/i }).click();
    await page.locator('[ng-model="data.prefix"]').fill('e2eparity');
    await page.locator('[ng-model="data.config.prefix"]').fill('E2E_');
    await page.locator('[ng-model="data.description"]').fill('created in parity test');
    await page.locator('[ng-model="data.tags"]').fill(tag);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(async () => {
      const data = (await kong.get('/vaults')).body.data;
      vault = data.find((item) => (item.tags || []).includes(tag));
      return vault && vault.config.prefix;
    }).toBe('E2E_');

    row = page.locator('tr').filter({ hasText: 'e2eparity' });
    await row.getByRole('button', { name: /edit/i }).click();
    await page.locator('[ng-model="data.config.prefix"]').fill('E2E_EDIT_');
    await page.locator('[ng-model="data.description"]').fill('edited in parity test');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(async () => (await kong.get(`/vaults/${vault.id || vault.prefix}`)).body.config.prefix)
      .toBe('E2E_EDIT_');
    expect(await konga.errors(page)).toEqual([]);
  } finally {
    await cleanupParityEntities();
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false }).catch(() => {});
  }
});
