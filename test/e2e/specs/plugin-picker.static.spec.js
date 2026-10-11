/**
 * Plugin picker — source-tree parity guards.
 *
 * Four templates render Kong's plugin catalogue, backed by four controllers.
 * They are near-duplicates of each other, which is how the search box and the
 * enabled badge came to be added in four places at once — and how one of them
 * will quietly miss the next change.
 *
 * The UI specs prove the behaviour on two of the four. These assertions cover
 * the other two, and cost no browser and no running Konga.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');

// Template -> the controller that renders it.
const PICKERS = [
  [
    'assets/js/app/services/views/add-service-plugin-modal.html',
    'assets/js/app/services/controllers/add-service-plugin-modal-controller.js',
  ],
  [
    'assets/js/app/routes/views/add-route-plugin-modal.html',
    'assets/js/app/routes/controllers/add-route-plugin-modal-controller.js',
  ],
  [
    'assets/js/app/plugins/modals/add-consumer-plugin-modal.html',
    'assets/js/app/plugins/add-plugin-modal-controller.js',
  ],
  [
    'assets/js/app/plugins/add-plugins.html',
    'assets/js/app/plugins/add-plugins-controller.js',
  ],
];

test.describe('Every plugin picker offers the same affordances', () => {
  for (const [template, controller] of PICKERS) {
    const name = path.basename(template);

    test(`${name} has a search box wired to the controller`, () => {
      const html = read(template);
      const js = read(controller);

      expect(html, 'needs the free-text filter').toContain('data-ng-model="pluginSearch"');
      // Without the per-card guard the box would filter whole categories only.
      expect(html, 'needs the per-card guard').toContain('data-ng-if="pluginMatches(key, value)"');
      expect(html, 'needs an empty state').toMatch(/no plugins match/i);

      expect(js, 'controller must seed pluginSearch').toMatch(/\$scope\.pluginSearch\s*=/);
      expect(js, 'controller must expose pluginMatches').toMatch(/\$scope\.pluginMatches\s*=/);
      // The search spans the catalogue, so filterGroup has to consult it.
      expect(js, 'filterGroup must honour the search').toContain('groupHasMatch');
    });

    test(`${name} marks plugins that are already enabled`, () => {
      const html = read(template);

      // `panel-success` alone is a border colour on a panel with no heading —
      // present since forever, and invisible. The badge is the legible part.
      expect(html).toMatch(/label-success/);
      expect(html).toMatch(/enabled/);
    });
  }

  test('the matcher itself lives in one place', () => {
    const service = read('assets/js/app/core/services/KongPluginsService.js');

    expect(service).toContain('KongPluginsService.prototype.matchesSearch');
    expect(service).toContain('KongPluginsService.prototype.groupHasMatch');

    // Nobody should reimplement the matching rules locally.
    for (const [, controller] of PICKERS) {
      expect(read(controller), `${path.basename(controller)} must delegate`).not.toMatch(
        /toLowerCase\(\)\.indexOf/
      );
    }
  });
});
