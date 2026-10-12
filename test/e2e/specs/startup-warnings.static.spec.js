const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.describe('warning-free local startup', () => {
  test('custom responses use the supported JSON response API', () => {
    for (const file of ['ok', 'badRequest', 'forbidden', 'notFound', 'serverError']) {
      expect(read(`api/responses/${file}.js`)).not.toContain('.jsonx(');
    }
  });

  test('policies do not target retired controllers', () => {
    const policies = read('config/policies.js');
    for (const retired of [
      'ApiController',
      'ConsumerController',
      'KongApiController',
      'KongGroupController',
      'KongInfoController',
      'UpstreamAlertsController',
    ]) {
      expect(policies).not.toContain(`${retired}:`);
    }
    expect(policies).toContain('UpstreamAlertController:');
  });

  test('wildcard GET and OPTIONS routes declare asset handling', () => {
    const routes = read('config/routes.js');
    expect(routes).toMatch(/'OPTIONS \/\*':\s*\{[\s\S]*?skipAssets:\s*false/);
    expect(routes).toMatch(/'GET \/kong\/\*':\s*\{[\s\S]*?skipAssets:\s*false/);
  });

  test('legacy Bootstrap Sass notices are narrowly silenced', () => {
    const sass = read('tasks/config/sass.js');
    for (const warning of ['import', 'global-builtin', 'color-functions', 'slash-div']) {
      expect(sass).toContain(`'${warning}'`);
    }
  });

  test('asset builds cannot rewrite tracked server views', () => {
    const linker = read('tasks/config/sails-linker.js');
    const layout = read('views/layout.ejs');
    expect(linker).not.toContain("'views/**/*.ejs'");
    expect(linker).not.toContain("'views/**/*.html'");
    expect(layout).toContain('<% if (angularDebugEnabled) { %>');
    expect(layout).toContain('min/production.min.js');
    expect(layout).toContain('js/app/app.js');
  });

  test('Bower has no redundant bootstrap-switch resolution', () => {
    const bower = JSON.parse(read('bower.json'));
    expect(bower.resolutions).not.toHaveProperty('bootstrap-switch');
  });
});
