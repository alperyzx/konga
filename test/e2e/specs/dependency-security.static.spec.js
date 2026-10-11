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

  test('uses stateless Passport login and normalizes Waterline associations', () => {
    const authController = read('api/controllers/AuthController.js');
    const userController = read('api/controllers/UserController.js');
    const nodeController = read('api/controllers/KongNodeController.js');

    expect(authController).toContain('request.login(user, {session: false}');
    expect(userController).toContain('if (_.isObject(user.node)) user.node = user.node.id;');
    expect(nodeController).toContain('return res.created(_node[0]);');
  });

  test('pins the audited direct dependency upgrades', () => {
    const dependencies = require(path.join(ROOT, 'package.json')).dependencies;
    expect(dependencies.passport).toBe('^0.7.0');
    expect(dependencies.validator).toBe('^13.15.35');
    expect(dependencies.grunt).toBe('^1.6.3');
    expect(dependencies.sass).toBe('^1.105.1');
    expect(dependencies['node-sass']).toBeUndefined();
    expect(dependencies.unirest).toBeUndefined();
    expect(dependencies.ip).toBeUndefined();
    expect(dependencies['sails-sqlserver']).toBeUndefined();
    expect(dependencies.uuid).toBe('^11.1.1');
    expect(dependencies.jsonwebtoken).toBe('^9.0.2');
  });
});
