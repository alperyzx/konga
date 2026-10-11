/** Phase 5 — Kong operations and capability surfaces. */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.describe('Phase 5: operations and capabilities', () => {
  test('exposes a tag browser route and navigation item', () => {
    expect(read('assets/js/app/info/00_info.js')).toContain(".state('tags'");
    expect(read('assets/js/app/info/00_info.js')).toContain("url: '/tags'");
    expect(read('assets/js/app/core/layout/01_layout-controllers.js')).toContain("state: 'tags'");
  });

  test('tag browser reads Kong’s tag endpoint and renders entity mappings', () => {
    expect(read('assets/js/app/info/02_info-service.js')).toContain("$http.get('kong/tags')");
    const html = read('assets/js/app/info/tags.html');
    for (const field of ['item.tag', 'item.entity_name', 'item.entity_id']) {
      expect(html).toContain(field);
    }
  });

  test('Info page surfaces deployment capability flags', () => {
    const html = read('assets/js/app/info/index.html');
    for (const field of ['Gateway.configuration.role', 'Gateway.configuration.router_flavor',
      'Gateway.configuration.database', 'Gateway.configuration.wasm',
      'Gateway.configuration.loaded_vaults']) {
      expect(html).toContain(field);
    }
  });

  test('operations endpoints already used by the dashboard remain wired', () => {
    expect(read('assets/js/app/info/02_info-service.js')).toContain("$http.get('kong/status'");
    expect(read('assets/js/app/dashboard/02_dashboard-controller.js'))
      .toMatch(/InfoService\s*\.nodeStatus\(\)/);
    expect(read('assets/js/app/dashboard/02_dashboard-controller.js'))
      .toMatch(/InfoService\s*\.getInfo\(\)/);
  });
});
