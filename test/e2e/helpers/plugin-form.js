/**
 * Driving the plugin config modal.
 *
 * The form is generated from Kong's schema, so a spec cannot hardcode "the
 * third input". These helpers locate a field by the label the renderer gives
 * it and reach for the control inside that field's block, which keeps the
 * specs readable and lets them survive Kong reordering a schema.
 */

const { expect } = require('@playwright/test');
const { goToState, waitForAngular } = require('./konga');

/**
 * Dismiss whatever modal is open, if any.
 *
 * The modal lives on <body>, outside the ui-router view, so navigating does
 * not close it — and while it is up its backdrop covers the page, which makes
 * every subsequent click hang on actionability rather than fail. Specs that
 * open one form after another have to close the previous one explicitly.
 */
async function closeModal(page) {
  const modal = page.locator('.modal');
  if (!(await modal.count())) return;
  await page.keyboard.press('Escape');
  await modal.first().waitFor({ state: 'detached', timeout: 5000 }).catch(async () => {
    await page.locator('.modal [ng-click="close()"], .modal .close').first().click();
    await modal.first().waitFor({ state: 'detached', timeout: 5000 });
  });
}

/** Open the add-plugin picker and launch the modal for one plugin. */
async function openAddForm(page, pluginName) {
  await closeModal(page);
  if (!page.url().includes('#!/plugins/add')) {
    await page.goto('/#!/plugins/add');
    await waitForAngular(page);
  }
  await page.waitForTimeout(500);
  await page.getByPlaceholder('search plugins...').fill(pluginName.split('-').join(' '));
  await page.waitForTimeout(500);

  const card = page.locator('.add-plugin .panel').filter({
    has: page.locator('h5', { hasText: new RegExp(`^\\s*${pluginName.split('-').join(' ')}\\s*$`, 'i') }),
  });
  await card.first().locator('button:has-text("Add Plugin")').click();

  await expect(page.locator('.modal form')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(600);
}

/** Open the edit modal for an already-created plugin, from the plugins list. */
async function openEditForm(page, pluginName) {
  await closeModal(page);
  await goToState(page, '/plugins');
  await page.waitForTimeout(500);
  await page.locator('th a', { hasText: pluginName }).first().click();
  await expect(page.locator('.modal form')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(600);
}

/**
 * The block the renderer wrapped one field in — label plus control.
 * Nested fields carry `.plugin-nested-field`; top-level ones are `.form-group`.
 */
function field(page, label) {
  const human = label.split('_').join(' ');
  return page
    .locator('.modal .form-group, .modal .plugin-nested-field')
    .filter({ has: page.locator(`label:has-text("${human}")`) })
    .last();
}

/** Read the normalised node tree straight off the form's scope. */
function nodes(page) {
  return page.evaluate(() => {
    const form = document.querySelector('.modal form');
    const scope = window.angular.element(form).scope();
    const strip = (list) =>
      list.map((n) => ({
        name: n.name,
        control: n.control,
        fields: n.fields ? strip(n.fields) : undefined,
        template: Array.isArray(n.template) ? strip(n.template) : undefined,
      }));
    return strip(scope.nodes);
  });
}

/** Flatten the tree to "name:control". */
function flatten(tree, out = []) {
  tree.forEach((n) => {
    out.push(`${n.name}:${n.control}`);
    if (n.fields) flatten(n.fields, out);
    if (n.template) flatten(n.template, out);
  });
  return out;
}

/** How deep the rendered tree goes. */
function treeDepth(tree) {
  return tree.reduce((max, n) => {
    const kids = n.fields || n.template;
    return Math.max(max, 1 + (kids ? treeDepth(kids) : 0));
  }, 0);
}

module.exports = { openAddForm, openEditForm, closeModal, field, nodes, flatten, treeDepth };
