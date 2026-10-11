const fs = require('fs');
const path = require('path');
const {test, expect} = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.describe('security dependency upgrades', () => {
  test('removes the deprecated Slack SDK and uses built-in HTTPS', () => {
    const dependencies = require(path.join(ROOT, 'package.json')).dependencies;
    const helper = read('api/lib/utils.js');

    expect(dependencies['@slack/client']).toBeUndefined();
    expect(helper).toContain("require('https')");
    expect(helper).toContain('https.request(url');
    expect(helper).toContain("'Content-Type': 'application/json'");
  });

  test('uses the callback required by modern Passport logout', () => {
    const controller = read('api/controllers/AuthController.js');
    expect(controller).toMatch(/request\.logout\(function\(error\)/);
    expect(controller).toContain("response.serverError(error)");
  });

  test('pins the audited direct dependency upgrades', () => {
    const dependencies = require(path.join(ROOT, 'package.json')).dependencies;
    expect(dependencies.passport).toBe('^0.7.0');
    expect(dependencies.validator).toBe('^13.15.35');
    expect(dependencies.grunt).toBe('^1.6.3');
    expect(dependencies.sass).toBe('^1.105.1');
    expect(dependencies['node-sass']).toBeUndefined();
  });
});
