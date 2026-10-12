const fs = require('fs');
const path = require('path');
const {test, expect} = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('modern Kong navigation follows the active Gateway instead of stale user node state', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'assets/js/app/core/layout/01_layout-controllers.js'),
    'utf8'
  );

  for (const state of ['upstreams', 'certificates', 'key-sets']) {
    const start = source.indexOf(`state: '${state}'`);
    expect(start).toBeGreaterThan(-1);
    const item = source.slice(start, source.indexOf('access:', start));
    expect(item).toContain('$rootScope.Gateway');
    expect(item).not.toContain('UserService.user().node');
  }
});
