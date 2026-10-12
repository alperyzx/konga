/**
 * SchemaFormService — the normalize/hydrate/serialize round-trip.
 *
 * The form renderer is only as correct as these three functions, and the bugs
 * worth catching are structural: a record one level too deep, a map whose
 * entries all alias the same node, a boolean set to false that never reaches
 * Kong. None of those need a browser to find.
 *
 * So this runs the whole of Kong's live schema surface — all 45 plugins,
 * captured in fixtures/plugin-schemas.json — through the service and asserts
 * the config comes back out intact. It needs no Konga, no Kong and no Chrome,
 * which is what makes it cheap enough to run on every change.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  SchemaForm, prune, sampleConfig, controls, depth,
} = require('../helpers/schema-form');

const SCHEMAS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'plugin-schemas.json'), 'utf8')
);

const META = SCHEMAS._meta;
const PLUGINS = Object.keys(SCHEMAS).filter((k) => k !== '_meta');

test.describe(`SchemaFormService against Kong ${META.kong_version}`, () => {
  test('the fixture covers every plugin the node serves', () => {
    expect(PLUGINS.length).toBe(META.count);
    expect(PLUGINS.length).toBeGreaterThan(40);
  });

  test('no schema contains a type the renderer would not draw', () => {
    const unsupported = [];
    for (const name of PLUGINS) {
      const nodes = SchemaForm.normalize(SCHEMAS[name].fields);
      for (const control of controls(nodes)) {
        if (control === 'unsupported') unsupported.push(name);
      }
    }
    // A failure here means Kong added a type. The form still renders — the
    // field shows a visible notice rather than a wrong input — but it needs a
    // control adding to SchemaFormService and schema-field.html.
    expect(unsupported).toEqual([]);
  });

  for (const name of PLUGINS) {
    test(`${name} round-trips a fully-populated config`, () => {
      const nodes = SchemaForm.normalize(SCHEMAS[name].fields);
      const config = sampleConfig(nodes);
      const out = SchemaForm.serialize(SchemaForm.hydrate(nodes, config));
      expect(out).toEqual(prune(config));
    });
  }

  test("Kong's own defaults survive a round-trip", () => {
    for (const name of PLUGINS) {
      const nodes = SchemaForm.normalize(SCHEMAS[name].fields);
      SchemaForm.applyDefaults(nodes);
      const first = SchemaForm.serialize(nodes);
      const again = SchemaForm.serialize(SchemaForm.hydrate(nodes, first));
      expect(again, `${name} is not stable under re-hydration`).toEqual(first);
    }
  });

  test.describe('the values the old serializer threw away', () => {
    const nodes = () =>
      SchemaForm.normalize([
        { enabled: { type: 'boolean' } },
        { retries: { type: 'integer' } },
        { name: { type: 'string' } },
      ]);

    test('false is kept', () => {
      expect(SchemaForm.serialize(SchemaForm.hydrate(nodes(), { enabled: false }))).toEqual({
        enabled: false,
      });
    });

    test('zero is kept', () => {
      expect(SchemaForm.serialize(SchemaForm.hydrate(nodes(), { retries: 0 }))).toEqual({
        retries: 0,
      });
    });

    test('an empty string is still dropped', () => {
      expect(SchemaForm.serialize(SchemaForm.hydrate(nodes(), { name: '' }))).toEqual({});
    });
  });

  test.describe('structure', () => {
    test('serverless Lua arrays preserve one complete multiline script', () => {
      const options = {
        multilineArrayFields: { access: true },
      };
      const nodes = SchemaForm.normalize(SCHEMAS['pre-function'].fields, options);
      const access = nodes.find((n) => n.name === 'access');
      const source = 'local value = "a,b"\n-- keep newlines and braces\nkong.log.notice(value)';

      expect(access.control).toBe('scripts');
      SchemaForm.hydrate(nodes, { access: [source] });
      expect(SchemaForm.serialize(nodes).access).toEqual([source]);
    });

    test('records nest to whatever depth Kong uses', () => {
      // ai-request-transformer is the deepest plugin on 3.9.3 at five levels.
      // The template this replaces hand-unrolled three.
      const nodes = SchemaForm.normalize(SCHEMAS['ai-request-transformer'].fields);
      expect(depth(nodes)).toBeGreaterThanOrEqual(5);
    });

    test('a map of records gives each entry its own subtree', () => {
      const nodes = SchemaForm.normalize(SCHEMAS['response-ratelimiting'].fields);
      SchemaForm.hydrate(nodes, { limits: { gold: { minute: 10 }, silver: { minute: 20 } } });

      const limits = nodes.find((n) => n.name === 'limits');
      expect(limits.control).toBe('map-record');
      expect(limits.entries).toHaveLength(2);

      // The override this replaces bound every row to one shared node, so
      // editing the second entry also rewrote the first.
      const [gold, silver] = limits.entries;
      expect(gold.fields).not.toBe(silver.fields);
      silver.fields.find((f) => f.name === 'minute').value = 999;
      expect(gold.fields.find((f) => f.name === 'minute').value).toBe(10);
    });

    test('a map of strings is editable as key/value pairs', () => {
      const nodes = SchemaForm.normalize(SCHEMAS['http-log'].fields);
      const headers = nodes.find((n) => n.name === 'headers');

      // This is the field that used to render as <input type="map">.
      expect(headers.control).toBe('map-scalar');
      SchemaForm.hydrate(nodes, { headers: { 'X-Api-Key': 'abc' } });
      expect(headers.entries).toEqual([{ key: 'X-Api-Key', value: 'abc' }]);
    });

    test('one_of becomes a select at any depth, not just the top level', () => {
      const nodes = SchemaForm.normalize(SCHEMAS['statsd'].fields);
      const metrics = nodes.find((n) => n.name === 'metrics');
      expect(metrics.control).toBe('rows');

      const statType = metrics.template.find((f) => f.name === 'stat_type');
      expect(statType.control).toBe('select');
      // statsd.html hardcoded six of these by hand; the schema is the source.
      expect(statType.one_of).toContain('histogram');
    });

    test('referenceable and deprecation reach the node', () => {
      const nodes = SchemaForm.normalize(SCHEMAS['http-log'].fields);
      expect(nodes.find((n) => n.name === 'http_endpoint').referenceable).toBe(true);
      expect(nodes.find((n) => n.name === 'retry_count').deprecation).toBeTruthy();
    });

    test('field order follows the schema, not object key order', () => {
      const nodes = SchemaForm.normalize(SCHEMAS['http-log'].fields);
      const fromSchema = SCHEMAS['http-log'].fields.map((f) => Object.keys(f)[0]);
      expect(nodes.map((n) => n.name)).toEqual(fromSchema);
    });
  });
});
