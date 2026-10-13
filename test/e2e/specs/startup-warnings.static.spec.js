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

  test('Waterline criteria use supported inequality modifiers', () => {
    expect(read('api/services/KongProxyHooks.js')).not.toMatch(/['\"]!['\"]\s*:/);
    expect(read('api/controllers/KongNodeController.js')).not.toMatch(/['\"]!['\"]\s*:/);
  });

  test('legacy Bootstrap Sass notices are narrowly silenced', () => {
    const sass = read('webpack.config.js');
    for (const warning of ['import', 'global-builtin', 'color-functions', 'slash-div']) {
      expect(sass).toContain(`'${warning}'`);
    }
  });

  test('asset builds cannot rewrite tracked server views', () => {
    const build = read('scripts/build-assets.js');
    const webpack = read('webpack.config.js');
    const layout = read('views/layout.ejs');
    expect(build).not.toContain('views/layout.ejs');
    expect(layout).toContain('min/vendor.min.js');
    expect(layout).toContain('min/application.min.js');
    expect(layout).toContain('min/production.min.css');
    expect(layout).not.toContain('bower_components');
    expect(webpack).toMatch(/compress:\s*false/);
    expect(webpack).toMatch(/mangle:\s*false/);
    expect(webpack).toMatch(/minimize:\s*false/);
  });

  test('Bower and Grunt are absent from install and build paths', () => {
    const packageJson = JSON.parse(read('package.json'));
    const run = read('run.sh');
    const docker = read('Dockerfile');
    expect(packageJson.dependencies).not.toHaveProperty('bower');
    expect(packageJson.dependencies).not.toHaveProperty('grunt');
    expect(packageJson.scripts.build).toContain('build-assets.js');
    expect(run).not.toMatch(/bower/i);
    expect(docker).not.toMatch(/bower/i);
  });
});
