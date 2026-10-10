/**
 * Locators for the plugin picker — the modal that lists Kong's plugin
 * catalogue as artwork cards grouped by category.
 *
 * Four templates render this same markup (service, route, consumer and the
 * global page), so the locators live here rather than in any one spec.
 */

/**
 * Tabs on an entity detail page are ui-sref anchors with an empty href, which
 * separates them from the sidebar. Their accessible name carries a leading
 * space from the mdi icon, so match on text rather than by role name.
 */
const entityTab = (page, label) => page.locator('a[href=""]').filter({ hasText: label });

/**
 * The picker is the only modal containing a category rail, which makes it
 * distinguishable from the per-plugin form stacked on top of it. Matching on
 * title text does not work: the form's submit button is also "add plugin".
 */
const pluginPicker = (page) => page.locator('.modal').filter({ has: page.locator('.nav-pills') });
const pluginForm = (page) => page.locator('.modal').filter({ hasNot: page.locator('.nav-pills') });

/**
 * Pick a plugin card by its Kong plugin key. The visible label is
 * `key.split('-').join(' ')` under a `capitalize` transform, so the artwork
 * path is the only place the exact key survives into the DOM.
 *
 * Scoped to `.col-md-4`, the column class the three modals use. The global
 * plugins page lays the same cards out in `.col-md-3`.
 */
const pluginCard = (page, key) =>
  pluginPicker(page)
    .locator('.col-md-4')
    .filter({ has: page.locator(`img[src$="/${key}.png"]`) });

/** The free-text filter above the category rail. */
const pluginSearch = (page) => pluginPicker(page).getByPlaceholder('search plugins...');

/**
 * The category rail only fills in once `makePluginGroups()` resolves, and the
 * `<ul>` itself is static markup — so the modal is "visible" well before it
 * has any content. Anything reading the rail has to wait for a pill.
 */
async function waitForPicker(page) {
  const picker = pluginPicker(page);
  await picker.locator('.nav-pills a').first().waitFor({ state: 'visible' });
  return picker;
}

module.exports = {
  entityTab,
  pluginPicker,
  pluginForm,
  pluginCard,
  pluginSearch,
  waitForPicker,
};
