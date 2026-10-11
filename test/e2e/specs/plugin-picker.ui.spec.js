/**
 * The plugin picker.
 *
 * Two things are under test here, both fallout from the Phase 1 audit:
 *
 *  1. `services.plugins.manage` and `routes.plugins.manage` pointed at a
 *     template and a controller that were never written — an abandoned port of
 *     the old API-scoped plugin page. ui-router does not fail gracefully on a
 *     missing templateUrl: the transition aborts, `$state.current.name` is left
 *     empty and the whole layout disappears. The states are now deleted.
 *
 *  2. Kong ships around forty plugins across eight categories, which the
 *     category rail alone does not make findable — Kong Manager pairs its
 *     catalogue with a "Filter plugins" box. The picker now has the equivalent,
 *     and marks plugins already enabled on the entity with a legible badge
 *     rather than a border colour nobody can see.
 */

const { test, expect } = require('@playwright/test');
const konga = require('../helpers/konga');
const { kong, createFixtures, cleanupFixtures } = require('../helpers/kong');
const {
  entityTab,
  pluginPicker,
  pluginCard,
  pluginSearch,
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

/** Open the picker from an entity's Plugins tab and wait for the rail. */
async function openServicePicker(page) {
  await page.goto(`/#!/services/${fixtures.service.id}/read`);
  await konga.waitForAngular(page);
  await konga.clearErrors(page);

  await entityTab(page, 'Plugins').click();
  await page.getByRole('button', { name: /add plugin/i }).click();

  return waitForPicker(page);
}

test.describe('The abandoned plugin-manage states are gone', () => {
  // Cold-loading these used to leave `$state.current.name` empty, which takes
  // the sidebar and header down with it — a blank white page that a refresh
  // cannot recover from, because the URL persists.
  const RETIRED = [
    ['services', (f) => f.service.id],
    ['routes', (f) => f.route.id],
  ];

  for (const [collection, id] of RETIRED) {
    test(`#!/${collection}/:id/plugins/manage no longer blanks the page`, async ({ page }) => {
      await page.goto('/#!/dashboard');
      await konga.waitForAngular(page);
      await konga.clearErrors(page);

      const landed = await konga.goToState(page, `/${collection}/${id(fixtures)}/plugins/manage`);

      // Deregistered, so ui-router hands the URL to `otherwise` instead of
      // aborting the transition on a template that is not there.
      expect(landed).toBe('dashboard');

      // The real symptom was the chrome vanishing, so assert on the chrome.
      await expect(page.locator('nav .sidebar-nav, aside nav').first()).toBeVisible();
      expect(await konga.errors(page)).toEqual([]);
    });
  }
});

test.describe('Filtering the catalogue', () => {
  test('a search reaches plugins outside the open category', async ({ page }) => {
    const picker = await openServicePicker(page);

    // The picker opens on Authentication, so rate-limiting — Traffic Control —
    // is not on screen yet. That is the precondition the search has to beat.
    await expect(pluginCard(page, 'key-auth')).toBeVisible();
    await expect(pluginCard(page, 'rate-limiting')).toHaveCount(0);

    await pluginSearch(page).fill('rate limit');

    // Searching spans the whole catalogue: you browse by tab, but you look up
    // by name. The category heading proves we crossed a group boundary.
    await expect(pluginCard(page, 'rate-limiting')).toBeVisible();
    // By heading, not by text: the category rail carries the same words.
    await expect(picker.getByRole('heading', { name: /traffic control/i })).toBeVisible();
    await expect(pluginCard(page, 'key-auth')).toHaveCount(0);

    expect(await konga.errors(page)).toEqual([]);
  });

  test('the hyphen in a plugin key is optional', async ({ page }) => {
    await openServicePicker(page);

    // `rate-limiting` is matched in both its raw and spaced form, so a user
    // typing what they see on the card finds the same plugin as one typing
    // what Kong calls it.
    await pluginSearch(page).fill('rate-limiting');
    await expect(pluginCard(page, 'rate-limiting')).toBeVisible();

    await pluginSearch(page).fill('rate limiting');
    await expect(pluginCard(page, 'rate-limiting')).toBeVisible();
  });

  test('a search also matches the description', async ({ page }) => {
    await openServicePicker(page);

    // "token" appears nowhere in the key `jwt` — only in its description. This
    // is the case the key-only match would miss.
    await pluginSearch(page).fill('token');
    await expect(pluginCard(page, 'jwt')).toBeVisible();
  });

  test('a search with no hits says so rather than showing nothing', async ({ page }) => {
    const picker = await openServicePicker(page);

    await pluginSearch(page).fill('definitely-not-a-plugin');

    await expect(picker.getByText(/no plugins match/i)).toBeVisible();
    await expect(picker.locator('.col-md-4')).toHaveCount(0);

    // Clearing the box restores the category the user was browsing.
    await pluginSearch(page).fill('');
    await expect(pluginCard(page, 'key-auth')).toBeVisible();
    await expect(picker.getByText(/no plugins match/i)).toHaveCount(0);
  });
});

test.describe('Plugins already enabled on the entity', () => {
  test('are badged in the picker', async ({ page }) => {
    const { body: plugin } = await kong.post(`/services/${fixtures.service.id}/plugins`, {
      name: 'key-auth',
    });

    try {
      const picker = await openServicePicker(page);

      // The picker has always marked these with `panel-success`, but on a panel
      // with no `panel-heading` that is a border colour and nothing more. The
      // badge is the part a user can actually read.
      const enabled = pluginCard(page, 'key-auth');
      await expect(enabled.getByText('enabled', { exact: true })).toBeVisible();

      // Scoped to the plugins actually on the service, not every card.
      await expect(pluginCard(page, 'basic-auth')).toBeVisible();
      await expect(pluginCard(page, 'basic-auth').getByText('enabled')).toHaveCount(0);

      // And it survives the filter, which re-renders the cards.
      await pluginSearch(page).fill('key auth');
      await expect(enabled.getByText('enabled', { exact: true })).toBeVisible();

      expect(await konga.errors(page)).toEqual([]);
      await expect(picker).toBeVisible();
    } finally {
      await kong.del(`/plugins/${plugin.id}`);
    }
  });
});

test.describe('The global plugins page', () => {
  // Same catalogue, different template: a full page rather than a modal, laid
  // out in `.col-md-3`, and keyed on `value.isAdded` because there is no entity
  // to scope `existingPlugins` to.
  const globalCard = (page, key) =>
    page.locator('.add-plugin .col-md-3').filter({ has: page.locator(`img[src$="/${key}.png"]`) });

  test('filters, and badges what is already applied globally', async ({ page }) => {
    // correlation-id only adds a response header, so enabling it gateway-wide
    // for the length of this spec cannot affect anything else.
    const { body: plugin } = await kong.post('/plugins', { name: 'correlation-id' });

    try {
      await page.goto('/#!/dashboard');
      await konga.waitForAngular(page);
      await konga.clearErrors(page);

      expect(await konga.goToState(page, '/plugins/add')).toBe('plugins.add');

      const search = page.getByPlaceholder('search plugins...');
      await expect(search).toBeVisible();

      // The page opens on Authentication, so correlation-id is reachable only
      // by search.
      await expect(globalCard(page, 'correlation-id')).toHaveCount(0);
      await search.fill('correlation');

      const added = globalCard(page, 'correlation-id');
      await expect(added).toBeVisible();
      await expect(added.getByText('enabled', { exact: true })).toBeVisible();

      await search.fill('definitely-not-a-plugin');
      await expect(page.getByText(/no plugins match/i)).toBeVisible();

      expect(await konga.errors(page)).toEqual([]);
    } finally {
      await kong.del(`/plugins/${plugin.id}`);
    }
  });
});
