/**
 * Phase 1 — source-tree guards.
 *
 * Phase 1 retired the APIs module: Kong dropped the `/apis` entity in 1.0, but
 * Konga carried the whole feature for another five years. Deleting it was not
 * a straight `rm -rf` — `AddPluginModalController` lived in `frontend.apis`,
 * and nine other files injected `ApiService`/`ApiModel` without calling them.
 *
 * These assertions are what keeps the module from growing back, and they cost
 * no browser and no running Konga.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const REPO = path.resolve(__dirname, '..', '..', '..');
const APP_JS = path.join(REPO, 'assets', 'js', 'app');

/** Every file under a directory, skipping vendored trees. */
function walk(dir, filter, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'bower_components' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, acc);
    else if (filter(full)) acc.push(full);
  }
  return acc;
}

const appScripts = () => walk(APP_JS, (f) => f.endsWith('.js'));
const appSources = () => [
  ...walk(APP_JS, (f) => f.endsWith('.js') || f.endsWith('.html')),
  ...walk(path.join(REPO, 'api'), (f) => f.endsWith('.js')),
];

const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(REPO, f);

test.describe('Phase 1: the APIs module is gone', () => {
  test('its directories no longer exist', () => {
    for (const dir of ['assets/js/app/apis', 'assets/js/app/consumers/apis']) {
      expect(fs.existsSync(path.join(REPO, dir)), `${dir} should be deleted`).toBe(false);
    }
  });

  test('nothing references the frontend.apis module', () => {
    const offenders = appSources()
      .filter((f) => /frontend\.apis/.test(read(f)))
      .map(rel);

    expect(
      offenders,
      'frontend.apis is not registered at runtime; referencing it throws $injector:modulerr'
    ).toEqual([]);
  });

  test('nothing injects ApiService or ApiModel', () => {
    // Both providers were deleted with the module, so an injection that
    // survived would fail at $injector:unpr — but only when the controller is
    // instantiated, which is why a grep is worth more than a smoke test here.
    const offenders = [];

    for (const file of appSources()) {
      const source = read(file);
      for (const symbol of ['ApiService', 'ApiModel']) {
        if (new RegExp(`\\b${symbol}\\b`).test(source)) {
          offenders.push(`${rel(file)} -> ${symbol}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test('the sidebar has no APIs entry', () => {
    const layout = read(path.join(APP_JS, 'core', 'layout', '03_layout-services.js'));

    expect(layout).not.toMatch(/state\s*:\s*'apis'/);
    expect(layout).not.toMatch(/title\s*:\s*'APIs'/);
  });
});

test.describe('Phase 1: Kong 3.x dead code', () => {
  test('the upstream form no longer offers orderlist', () => {
    // Kong removed `orderlist` from upstreams in 0.12 and now rejects it with
    // `400 orderlist: unknown field`. The control was version-gated so it never
    // rendered on 3.x, but it had no reason to stay.
    const form = read(path.join(APP_JS, 'upstreams', 'partials', 'upstream-form.html'));

    expect(form).not.toMatch(/orderlist/i);
  });

  test('the Kong proxy no longer coerces orderlist', () => {
    const proxy = read(path.join(REPO, 'api', 'controllers', 'KongProxyController.js'));

    expect(proxy).not.toMatch(/orderlist/i);
  });
});

test.describe('App integrity', () => {
  test('every DI annotation matches its function arity', () => {
    // AngularJS gives no error for a short annotation array — it just injects
    // the wrong service into every later parameter, silently. Phase 1 stripped
    // injections from nine files with a regex; this is the check that would
    // have caught a slip.
    const registration =
      /\.(controller|service|factory|directive|filter|provider)\(\s*['"]([^'"]+)['"]\s*,\s*\[([\s\S]*?)\]\s*\)/g;

    const mismatches = [];
    let checked = 0;

    for (const file of appScripts()) {
      const source = read(file);
      let match;

      while ((match = registration.exec(source)) !== null) {
        const [, , name, body] = match;

        const fnIndex = body.indexOf('function');
        if (fnIndex < 0) continue; // arrow-style or a plain reference

        const annotations = (body.slice(0, fnIndex).match(/['"][^'"]+['"]/g) || []).length;
        const params = /function[^(]*\(([^)]*)\)/.exec(body.slice(fnIndex));
        if (!params) continue;

        const arity = params[1].split(',').filter((p) => p.trim()).length;
        checked++;

        if (annotations !== arity) {
          mismatches.push(`${rel(file)} -> ${name}: ${annotations} annotations vs ${arity} params`);
        }
      }
    }

    expect(checked, 'expected to find DI registrations to check').toBeGreaterThan(100);
    expect(mismatches).toEqual([]);
  });

  test('every ui-router templateUrl resolves to a real file', () => {
    // Deleting a module can leave a state pointing at a template that is no
    // longer there. ui-router fails worse than silently: the transition aborts,
    // $state.current.name is left empty, and the whole layout fails to render.
    const dangling = [];

    for (const file of appScripts()) {
      const source = read(file);
      const refs = source.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/g) || [];

      for (const ref of refs) {
        // Strip Konga's `?v=` cache-buster before touching the filesystem.
        const url = /['"]([^'"]+)['"]/.exec(ref)[1].split('?')[0];
        const onDisk = path.join(REPO, 'assets', url.replace(/^\//, ''));
        if (!fs.existsSync(onDisk)) {
          dangling.push(`${rel(file)} -> ${url}`);
        }
      }
    }

    expect(dangling).toEqual([]);
  });
});
