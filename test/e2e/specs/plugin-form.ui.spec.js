/**
 * The schema-driven plugin form, in a browser, against real Kong.
 *
 * The static and schema suites prove the node tree and the round-trip. What
 * they cannot prove is that the template draws a control for each node, that
 * the control is bound to the right place, and that what the user typed is
 * what Kong ends up storing. That is what this file is for, so it sticks to
 * the shapes that were previously broken or hand-written:
 *
 *   - a map, which used to render as <input type="map">;
 *   - a record nested deeper than the old template's three hardcoded levels;
 *   - an array of records, which used to need a bespoke statsd form;
 *   - `false` and `0`, which the old serializer deleted on the way out.
 */

const { test, expect } = require('@playwright/test');
const { kong } = require('../helpers/kong');
const { collectErrors, errors, goToState } = require('../helpers/konga');
const { openAddForm, openEditForm, field, nodes, flatten, treeDepth } =
  require('../helpers/plugin-form');

/** Global plugins carry no name of their own, so clean up by plugin type. */
async function removeGlobalPlugins(name) {
  const { body } = await kong.get('/plugins');
  for (const plugin of (body && body.data) || []) {
    if (plugin.name === name && !plugin.service && !plugin.route && !plugin.consumer) {
      await kong.del(`/plugins/${plugin.id}`);
    }
  }
}

async function globalPlugin(name) {
  const { body } = await kong.get('/plugins');
  return (body.data || []).find(
    (p) => p.name === name && !p.service && !p.route && !p.consumer
  );
}

test.beforeEach(async ({ page }) => {
  await collectErrors(page);
});

test.describe('rendering', () => {
  test('a map renders as key/value rows, not a text box', async ({ page }) => {
    await openAddForm(page, 'http-log');

    const headers = field(page, 'headers');
    await expect(headers.locator('button:has-text("add entry")')).toBeVisible();
    // The bug this replaces: a single input whose type attribute was "map".
    await expect(page.locator('.modal input[type="map"]')).toHaveCount(0);

    const tree = await nodes(page);
    expect(flatten(tree)).toContain('headers:map-scalar');
  });

  test('records nest past the three levels the old template hardcoded', async ({ page }) => {
    await openAddForm(page, 'ai-request-transformer');

    const tree = await nodes(page);
    expect(treeDepth(tree)).toBeGreaterThanOrEqual(5);

    // Depth is only useful if it reached the DOM, so check a field that only
    // exists below level three.
    const flat = flatten(tree);
    expect(flat).toContain('llm:record');
    await expect(page.locator('.modal .plugin-nested-field').first()).toBeVisible();
  });

  test('statsd shows the fields its hand-written form hid', async ({ page }) => {
    await openAddForm(page, 'statsd');

    const flat = flatten(await nodes(page));
    // The bespoke form offered four: host, port, prefix and metrics.
    expect(flat).toContain('metrics:rows');
    for (const hidden of [
      'queue:record', 'retry_count:number', 'tag_style:select',
      'hostname_in_prefix:boolean', 'consumer_identifier_default:select',
    ]) {
      expect(flat, `${hidden} is still not reachable from the form`).toContain(hidden);
    }

    // Its option lists came from hardcoded arrays; they now come from the
    // schema, so they cannot drift from Kong.
    const statType = await page.evaluate(() => {
      const scope = window.angular.element(document.querySelector('.modal form')).scope();
      const metrics = scope.nodes.find((n) => n.name === 'metrics');
      return metrics.template.find((f) => f.name === 'stat_type').one_of;
    });
    expect(statType).toContain('histogram');

    await expect(field(page, 'metrics').locator('button:has-text("add")')).toBeVisible();
  });

  test('no form falls back to the unsupported-type notice', async ({ page }) => {
    for (const name of ['http-log', 'statsd', 'response-ratelimiting', 'key-auth']) {
      await openAddForm(page, name);
      await expect(
        page.locator('.modal', { hasText: 'Konga cannot render' }),
        `${name} rendered an unsupported field`
      ).toHaveCount(0);
    }
  });

  test('the form bootstraps without an Angular error', async ({ page }) => {
    await openAddForm(page, 'http-log');
    expect(await errors(page)).toEqual([]);
  });
});

test.describe('saving', () => {
  test.beforeEach(async () => {
    await removeGlobalPlugins('http-log');
    await removeGlobalPlugins('key-auth');
  });

  test.afterEach(async () => {
    await removeGlobalPlugins('http-log');
    await removeGlobalPlugins('key-auth');
  });

  test('a map entry and a zero reach Kong, and come back on edit', async ({ page }) => {
    await openAddForm(page, 'http-log');

    await field(page, 'http endpoint').locator('textarea, input').first()
      .fill('http://logs.konga.test/ingest');

    await field(page, 'headers').locator('button:has-text("add entry")').click();
    const entry = field(page, 'headers').locator('.row').first();
    await entry.locator('input[placeholder="key"]').fill('X-Konga-Test');
    await entry.locator('input[placeholder="value"]').fill('phase2');

    // 0 is in range for this field and differs from Kong's default of 1, so
    // if the old falsy-dropping serializer were still in place Kong would
    // store 1 and this assertion would fail.
    await field(page, 'max coalescing delay').locator('input[type="number"]').fill('0');

    await page.locator('.modal button:has-text("add plugin")').click();
    await page.waitForTimeout(2500);

    const created = await globalPlugin('http-log');
    expect(created, 'the plugin was not created').toBeTruthy();
    expect(created.config.headers).toEqual({ 'X-Konga-Test': 'phase2' });
    expect(created.config.queue.max_coalescing_delay).toBe(0);

    // And the edit form has to put them back where the user left them.
    await openEditForm(page, 'http-log');
    const headers = field(page, 'headers');
    await expect(headers.locator('input[placeholder="key"]')).toHaveValue('X-Konga-Test');
    await expect(headers.locator('input[placeholder="value"]')).toHaveValue('phase2');
    await expect(
      field(page, 'max coalescing delay').locator('input[type="number"]')
    ).toHaveValue('0');
  });

  test('a boolean turned off reaches Kong as false', async ({ page }) => {
    await openAddForm(page, 'key-auth');

    // key_in_header defaults to true, so `false` here is both a real change
    // and exactly the value the old serializer deleted.
    await field(page, 'key in header').locator('.bootstrap-switch').click();
    await page.waitForTimeout(300);

    await page.locator('.modal button:has-text("add plugin")').click();
    await page.waitForTimeout(2500);

    const created = await globalPlugin('key-auth');
    expect(created, 'the plugin was not created').toBeTruthy();
    expect(created.config.key_in_header).toBe(false);
  });
});
