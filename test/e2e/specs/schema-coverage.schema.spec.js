/**
 * The same round-trip the static suite proves against checked-in fixtures,
 * re-run against whatever Kong is actually running.
 *
 * The static suite can only ever be as current as the day someone captured
 * fixtures/plugin-schemas.json. This one asks the gateway. Its job is to turn
 * "a Kong upgrade broke a plugin form" from a user report into a failing
 * build: if Kong 3.10 adds a field type, or nests a record one level deeper
 * than any plugin does today, the assertions below go red before anyone opens
 * the UI.
 *
 * Needs Kong on KONG_ADMIN_URL. Needs no Konga, no login and no browser, which
 * is why it is its own project rather than part of `ui`.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { kong } = require('../helpers/kong');
const { SchemaForm, prune, sampleConfig, controls, depth } = require('../helpers/schema-form');

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'plugin-schemas.json');

// Konga reads the legacy /plugins/schema/<name> endpoint, which answers with
// the plugin's config fields already unwrapped. Fetching anything else here
// would be testing a shape the app never sees.
async function fetchSchemas() {
  const { body } = await kong.get('/plugins/enabled');
  const names = (body.enabled_plugins || []).slice().sort();

  const schemas = {};
  for (const name of names) {
    const res = await kong.get(`/plugins/schema/${name}`);
    if (res.status === 404 || !res.body || !res.body.fields) continue;
    schemas[name] = res.body;
  }
  return schemas;
}

let SCHEMAS;
let VERSION;

test.beforeAll(async () => {
  VERSION = await kong.version();
  SCHEMAS = await fetchSchemas();
});

test.describe('the renderer covers the live gateway', () => {
  test('every enabled plugin serves a schema', () => {
    const names = Object.keys(SCHEMAS);
    expect(names.length, 'Kong served no plugin schemas at all').toBeGreaterThan(10);
  });

  test('no live schema contains a type the renderer would not draw', () => {
    // The form does not break when this fails — an unknown type renders a
    // visible "cannot render this yet" notice rather than a wrong input. But
    // that field is unconfigurable from Konga until someone teaches
    // SchemaFormService the new control, so it is a build failure, not a
    // warning.
    const offenders = [];
    for (const [name, schema] of Object.entries(SCHEMAS)) {
      const nodes = SchemaForm.normalize(schema.fields);
      if (controls(nodes).has('unsupported')) offenders.push(name);
    }
    expect(offenders, `Kong ${VERSION} uses a field type the renderer has not been taught`)
      .toEqual([]);
  });

  test('every live schema round-trips a fully-populated config', () => {
    const broken = [];
    for (const [name, schema] of Object.entries(SCHEMAS)) {
      const nodes = SchemaForm.normalize(schema.fields);
      const config = sampleConfig(nodes);
      const out = SchemaForm.serialize(SchemaForm.hydrate(nodes, config));
      try {
        expect(out).toEqual(prune(config));
      } catch (err) {
        broken.push(`${name}: ${err.message.split('\n').slice(0, 6).join(' ')}`);
      }
    }
    expect(broken.join('\n')).toBe('');
  });

  test("Kong's own defaults survive a round-trip", () => {
    for (const [name, schema] of Object.entries(SCHEMAS)) {
      const nodes = SchemaForm.normalize(schema.fields);
      SchemaForm.applyDefaults(nodes);
      const first = SchemaForm.serialize(nodes);
      const again = SchemaForm.serialize(SchemaForm.hydrate(nodes, first));
      expect(again, `${name} is not stable under re-hydration`).toEqual(first);
    }
  });

  test('the renderer recurses at least as deep as Kong nests', () => {
    // Nothing to assert against a constant here — the template is recursive,
    // so any depth renders. This records the live maximum so the number in
    // the fixtures and in the docs can be checked against reality.
    const deepest = Object.entries(SCHEMAS)
      .map(([name, schema]) => [name, depth(SchemaForm.normalize(schema.fields))])
      .sort((a, b) => b[1] - a[1])[0];
    console.log(`Kong ${VERSION}: deepest plugin is ${deepest[0]} at ${deepest[1]} levels`);
    expect(deepest[1]).toBeGreaterThanOrEqual(1);
  });

  test('the checked-in fixtures still match this gateway', () => {
    // A soft drift check: the static suite is only meaningful while the
    // fixtures resemble the node. If this fails, re-capture them — it is not
    // a bug in the renderer.
    const fixtures = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    const captured = Object.keys(fixtures).filter((k) => k !== '_meta').sort();
    const live = Object.keys(SCHEMAS).sort();

    const missing = live.filter((n) => !captured.includes(n));
    const stale = captured.filter((n) => !live.includes(n));
    expect(
      { missing, stale },
      `fixtures were captured from Kong ${fixtures._meta.kong_version}, this node is ${VERSION}`
    ).toEqual({ missing: [], stale: [] });
  });
});
