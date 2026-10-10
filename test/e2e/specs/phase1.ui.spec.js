/**
 * Phase 1 — logged-in UI.
 *
 * The static spec proves the APIs module is gone from the source. This one
 * proves the app still works without it: the screens whose controllers were
 * rewired during the removal all load, and the riskiest change of all —
 * moving `AddPluginModalController` out of `frontend.apis` and into
 * `frontend.plugins` — still produces correctly-scoped plugins in Kong.
 */

const { test, expect } = require('@playwright/test');
const konga = require('../helpers/konga');
const { kong, createFixtures, cleanupFixtures } = require('../helpers/kong');
const {
  entityTab,
  pluginPicker,
  pluginForm,
  pluginCard,
  waitForPicker,
} = require('../helpers/picker');

let fixtures;

test.beforeAll(async () => {
  fixtures = await createFixtures();
});

test.afterAll(async () => {
  await cleanupFixtures();
});

test.beforeEach(async ({ page }) => {
  await konga.collectErrors(page);
});

test.describe('The APIs module is not reachable', () => {
  test('the sidebar lists the Kong 3.x entities and nothing retired', async ({ page }) => {
    await page.goto('/#!/dashboard');
    await konga.waitForAngular(page);

    const sidebar = page.locator('nav .sidebar-nav, aside nav').first();
    const labels = (await sidebar.locator('a').allInnerTexts())
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    expect(labels).not.toContain('APIS');
    for (const entity of ['SERVICES', 'ROUTES', 'CONSUMERS', 'PLUGINS', 'UPSTREAMS', 'CERTIFICATES']) {
      expect(labels, `sidebar should still link to ${entity}`).toContain(entity);
    }
  });

  test('#!/apis falls through to the otherwise handler', async ({ page }) => {
    await page.goto('/#!/dashboard');
    await konga.waitForAngular(page);

    const landed = await konga.goToState(page, '/apis');

    // The state is deregistered, so ui-router hands the URL to `otherwise`
    // rather than rendering a broken view.
    expect(landed).toBe('dashboard');
    expect(await konga.errors(page)).toEqual([]);
  });

  test('the module and its providers are absent from the injector', async ({ page }) => {
    await page.goto('/#!/dashboard');
    await konga.waitForAngular(page);

    expect(await konga.moduleExists(page, 'frontend.apis')).toBe(false);
    expect(await konga.isRegistered(page, 'ApiService')).toBe(false);
    expect(await konga.isRegistered(page, 'ApiModel')).toBe(false);

    // The modules that absorbed its controllers are still intact.
    expect(await konga.moduleExists(page, 'frontend.plugins')).toBe(true);
    expect(await konga.isRegistered(page, 'PluginHelperService')).toBe(true);

    const apiStates = await page.evaluate(() =>
      angular.element(document.body).injector()
        .get('$state').get()
        .map((s) => s.name)
        .filter((n) => /(^apis)|(\.apis$)|(apis\.)/.test(n || ''))
    );
    expect(apiStates).toEqual([]);
  });
});

test.describe('Every route still loads', () => {
  const ROUTES = [
    ['/dashboard', 'dashboard'],
    ['/info', 'info'],
    ['/services', 'services'],
    ['/routes', 'routes'],
    ['/consumers', 'consumers'],
    ['/plugins', 'plugins'],
    ['/upstreams', 'upstreams'],
    ['/certificates', 'certificates'],
    ['/healthchecks', 'healthchecks'],
    ['/users', 'users'],
    ['/connections', 'connections'],
    ['/snapshots', 'snapshots'],
    ['/settings', 'settings'],
  ];

  for (const [hash, expected] of ROUTES) {
    test(`${hash} reaches the ${expected} state cleanly`, async ({ page }) => {
      await page.goto('/#!/dashboard');
      await konga.waitForAngular(page);
      await konga.clearErrors(page);

      expect(await konga.goToState(page, hash)).toBe(expected);
      // A controller left with a stale injection fails here and nowhere else:
      // $injector:unpr is thrown at instantiation, not at load.
      expect(await konga.errors(page)).toEqual([]);
    });
  }
});

test.describe('AddPluginModalController after the move to frontend.plugins', () => {
  test('creates a service-scoped plugin from the service detail page', async ({ page }) => {
    await page.goto(`/#!/services/${fixtures.service.id}/read`);
    await konga.waitForAngular(page);
    await konga.clearErrors(page);

    await entityTab(page, 'Plugins').click();
    await page.getByRole('button', { name: /add plugin/i }).click();

    const picker = pluginPicker(page);
    await expect(picker).toBeVisible();

    // key-auth's schema has no required fields, so it submits on defaults —
    // the point of this spec is the scoping, not the form.
    await pluginCard(page, 'key-auth').getByRole('button', { name: /add plugin/i }).click();

    const form = pluginForm(page);
    await expect(form).toBeVisible();

    // The form is generated from Kong's own schema, so the field labels are
    // evidence the schema round-trip survived the module move.
    for (const field of ['key names', 'hide credentials', 'key in header', 'run on preflight']) {
      await expect(form.getByText(field, { exact: true })).toBeVisible();
    }

    await form.getByRole('button', { name: /add plugin/i }).click();

    await expect
      .poll(
        async () => (await kong.plugins('services', fixtures.service.id)).map((p) => p.name),
        { timeout: 15000 }
      )
      .toEqual(['key-auth']);

    const [plugin] = await kong.plugins('services', fixtures.service.id);
    expect(plugin.service.id).toBe(fixtures.service.id);
    expect(plugin.consumer, 'a service-scoped plugin must not carry a consumer').toBeNull();
    expect(plugin.route, 'a service-scoped plugin must not carry a route').toBeNull();

    expect(await konga.errors(page)).toEqual([]);

    await kong.del(`/plugins/${plugin.id}`);
  });

  test('creates a consumer-scoped plugin and hides auth plugins there', async ({ page }) => {
    await page.goto(`/#!/consumers/${fixtures.consumer.id}`);
    await konga.waitForAngular(page);
    await konga.clearErrors(page);

    await entityTab(page, 'Plugins').click();
    await page.getByRole('button', { name: /add new plugin/i }).click();

    const picker = await waitForPicker(page);

    // getExistingPlugins() filters the catalogue by what Kong will accept on a
    // consumer. Removing the ApiService branch from it must not have widened
    // the list — authentication plugins cannot be consumer-scoped.
    const categories = (await picker.locator('.nav-pills a').allInnerTexts()).map((c) => c.trim());
    expect(categories).not.toContain('Authentication');
    expect(categories).toContain('Traffic Control');

    await picker.getByRole('link', { name: 'Traffic Control' }).click();
    await pluginCard(page, 'rate-limiting')
      .getByRole('button', { name: /add plugin/i })
      .click();

    const form = pluginForm(page);
    await expect(form).toBeVisible();

    // rate-limiting rejects a config with every window unset.
    await form.getByRole('spinbutton').nth(1).fill('60');
    await form.getByRole('button', { name: /add plugin/i }).click();

    await expect
      .poll(
        async () => (await kong.plugins('consumers', fixtures.consumer.id)).length,
        { timeout: 15000 }
      )
      .toBe(1);

    const [plugin] = await kong.plugins('consumers', fixtures.consumer.id);
    expect(plugin.name).toBe('rate-limiting');
    expect(plugin.config.minute).toBe(60);
    expect(plugin.consumer.id).toBe(fixtures.consumer.id);
    expect(plugin.service, 'a consumer-scoped plugin must not carry a service').toBeNull();

    expect(await konga.errors(page)).toEqual([]);

    await kong.del(`/plugins/${plugin.id}`);
  });
});

test.describe('Screens whose controllers lost an injection', () => {
  test('consumer details still binds the tags control', async ({ page }) => {
    // The orphaned `edit-consumer-modal.html` was deleted in Phase 1. This is
    // the template that was always the live edit surface, and it already had
    // tags — worth pinning so the two are not confused again.
    await page.goto(`/#!/consumers/${fixtures.consumer.id}`);
    await konga.waitForAngular(page);

    // $state.current.name is set before the state's resolves land, so waiting
    // on Angular alone can sample the DOM mid-render. Wait on the content.
    await page.waitForSelector('[ng-model^="consumer."]', { timeout: 20000 });

    const models = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[ng-model]'), (e) => e.getAttribute('ng-model'))
    );

    expect(models).toContain('consumer.tags');
    expect(await konga.errors(page)).toEqual([]);
  });

  test('the upstream form renders its Kong 3.x fields and no orderlist', async ({ page }) => {
    await page.goto(`/#!/upstreams/${fixtures.upstream.id}`);
    await konga.waitForAngular(page);
    await page.waitForSelector('[ng-model^="upstream."]', { timeout: 20000 });

    const { models, html } = await page.evaluate(() => ({
      models: Array.from(document.querySelectorAll('[ng-model]'), (e) => e.getAttribute('ng-model'))
        .filter((m) => m && m.startsWith('upstream.')),
      html: document.body.innerHTML,
    }));

    expect(html).not.toMatch(/orderlist/i);
    for (const field of ['upstream.name', 'upstream.slots', 'upstream.hash_on', 'upstream.tags']) {
      expect(models).toContain(field);
    }
    // Active and passive healthcheck blocks both render.
    expect(models.filter((m) => m.includes('healthchecks.active')).length).toBeGreaterThan(5);
    expect(models.filter((m) => m.includes('healthchecks.passive')).length).toBeGreaterThan(5);

    expect(await konga.errors(page)).toEqual([]);
  });

  test('health checks loads without ApiService', async ({ page }) => {
    // HealthChecksController used to call ApiService.findById on every row to
    // flag orphans. That call went with the module.
    await page.goto('/#!/dashboard');
    await konga.waitForAngular(page);
    await konga.clearErrors(page);

    expect(await konga.goToState(page, '/healthchecks')).toBe('healthchecks');
    expect(await konga.errors(page)).toEqual([]);
  });
});
