/**
 * Turns a Kong schema into something a form can render, and turns it back again.
 *
 * Kong describes a plugin's config as an ordered array of single-key objects:
 *
 *   {fields: [{http_endpoint: {type: 'string', ...}}, {headers: {type: 'map', ...}}]}
 *
 * ...and uses that same shape at every depth, for record fields, for a map's
 * `values`, and for an array's `elements`. Konga used to flatten only the top
 * level and hand-unroll three levels of records in the template, which meant
 * anything deeper — and every `map` — fell through to a bare <input> that
 * silently accepted text Kong would reject. This service replaces that with one
 * recursive pass.
 *
 * Three functions do the work, and they are inverses:
 *
 *   normalize(fields)      schema            -> [node]   (shape, no values)
 *   hydrate(nodes, config) [node] + config   -> [node]   (values filled in)
 *   serialize(nodes)       [node]            -> config
 *
 * so that serialize(hydrate(normalize(schema), config)) returns config back,
 * modulo unset values. That round-trip is asserted against all of Kong's live
 * schemas in test/e2e — it is what stops a Kong upgrade from quietly breaking a
 * form.
 *
 * Deliberately dependency-free: no angular, no lodash. The test suite loads this
 * file directly in node to check the round-trip without a browser.
 */
(function () {
  'use strict';

  /**
   * Every composite a Kong schema can express, resolved once at normalize time
   * so the template switches on a single flat value instead of re-deriving
   * "is this a map of records?" on every digest.
   */
  var CONTROL = {
    RECORD: 'record',        // nested fieldset
    MAP_SCALAR: 'map-scalar',// key -> string
    MAP_RECORD: 'map-record',// key -> nested fieldset
    ROWS: 'rows',            // array of records, as repeating rows
    CHIPS: 'chips',          // array/set of scalars
    SCRIPTS: 'scripts',      // array of multiline source-code strings
    SELECT: 'select',        // anything with one_of, at any depth
    BOOLEAN: 'boolean',
    NUMBER: 'number',
    STRING: 'string',
    UNSUPPORTED: 'unsupported'
  };

  var NUMERIC = {integer: true, number: true};

  function deepClone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      var copy = [];
      for (var i = 0; i < value.length; i++) copy.push(deepClone(value[i]));
      return copy;
    }
    var out = {};
    for (var key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = deepClone(value[key]);
    }
    return out;
  }

  /**
   * Kong hands us [{name: descriptor}, ...]. Older Konga code and a few call
   * sites pass a plain {name: descriptor} map instead, so accept both; the
   * array form is the one that preserves Kong's field order, which is
   * meaningful and which object key order is not required to keep.
   */
  function toPairs(fields) {
    var pairs = [];
    if (!fields) return pairs;

    if (Array.isArray(fields)) {
      fields.forEach(function (entry) {
        if (!entry || typeof entry !== 'object') return;
        Object.keys(entry).forEach(function (name) {
          pairs.push([name, entry[name]]);
        });
      });
      return pairs;
    }

    Object.keys(fields).forEach(function (name) {
      pairs.push([name, fields[name]]);
    });
    return pairs;
  }

  function controlFor(name, descriptor, options) {
    var type = descriptor.type;

    if (descriptor.one_of && descriptor.one_of.length) return CONTROL.SELECT;
    if (type === 'record') return CONTROL.RECORD;
    if (type === 'boolean') return CONTROL.BOOLEAN;
    if (NUMERIC[type]) return CONTROL.NUMBER;
    if (type === 'string') return CONTROL.STRING;

    if (type === 'map') {
      var values = descriptor.values || {};
      return values.type === 'record' ? CONTROL.MAP_RECORD : CONTROL.MAP_SCALAR;
    }

    if (type === 'array' || type === 'set') {
      var elements = descriptor.elements || {};
      if (elements.type === 'string' && options &&
          options.multilineArrayFields && options.multilineArrayFields[name]) {
        return CONTROL.SCRIPTS;
      }
      return elements.type === 'record' ? CONTROL.ROWS : CONTROL.CHIPS;
    }

    // Anything Kong adds that we have not taught this service about. The
    // template renders this as a visible notice — never as an input, which is
    // the failure mode this whole service exists to remove.
    return CONTROL.UNSUPPORTED;
  }

  function buildNode(name, descriptor, options) {
    descriptor = descriptor || {};

    var node = {
      name: name,
      label: name,
      type: descriptor.type,
      control: controlFor(name, descriptor, options),
      help: descriptor.description || helpFor(options, name),
      required: !!descriptor.required,
      referenceable: !!descriptor.referenceable,
      encrypted: !!descriptor.encrypted,
      deprecation: descriptor.deprecation || null,
      one_of: descriptor.one_of || null,
      defaultValue: 'default' in descriptor ? deepClone(descriptor['default']) : undefined,
      value: undefined
    };

    switch (node.control) {
      case CONTROL.RECORD:
        node.fields = normalize(descriptor.fields, options);
        break;

      case CONTROL.MAP_RECORD:
        // Each entry owns a cloned subtree. The hand-written override this
        // replaces bound every row back to the one shared schema node, so
        // editing any entry wrote to all of them.
        node.template = normalize(descriptor.values.fields, options);
        node.entries = [];
        break;

      case CONTROL.MAP_SCALAR:
        node.valueType = (descriptor.values || {}).type || 'string';
        node.entries = [];
        break;

      case CONTROL.ROWS:
        node.template = normalize(descriptor.elements.fields, options);
        node.rows = [];
        break;

      case CONTROL.CHIPS:
      case CONTROL.SCRIPTS:
        node.elementType = (descriptor.elements || {}).type || 'string';
        node.value = [];
        break;
    }

    return node;
  }

  /**
   * Help text comes from the schema's own `description` first. Konga also ships
   * a hand-written table of help strings (KongPluginsService.pluginOptions),
   * richer for a handful of plugins but frozen at whatever Kong version it was
   * written against; it is the fallback, not the source of truth.
   */
  function helpFor(options, name) {
    if (!options || !options.fields || !options.fields[name]) return undefined;
    return options.fields[name].help;
  }

  function normalize(fields, options) {
    return toPairs(fields).map(function (pair) {
      return buildNode(pair[0], pair[1], options);
    });
  }

  // ---------------------------------------------------------------------------
  // Filling values in
  // ---------------------------------------------------------------------------

  function newRow(node) {
    return {fields: deepClone(node.template)};
  }

  function newEntry(node, key) {
    var entry = {key: key === undefined ? '' : key};
    if (node.control === CONTROL.MAP_RECORD) entry.fields = deepClone(node.template);
    else entry.value = undefined;
    return entry;
  }

  function removeAt(list, index) {
    if (list && index > -1 && index < list.length) list.splice(index, 1);
  }

  /**
   * Put one raw config value into one node. Every path that fills a form goes
   * through here, so hydrate and applyDefaults cannot drift apart.
   */
  function setValue(node, value) {
    switch (node.control) {
      case CONTROL.RECORD:
        // A record whose value is absent still needs its children seeded with
        // their own defaults, or the form opens blank where Kong would show
        // values it is about to apply anyway.
        if (value && typeof value === 'object') hydrate(node.fields, value);
        else applyDefaults(node.fields);
        break;

      case CONTROL.MAP_SCALAR:
        node.entries = [];
        if (value && typeof value === 'object') {
          Object.keys(value).forEach(function (key) {
            node.entries.push({key: key, value: value[key]});
          });
        }
        break;

      case CONTROL.MAP_RECORD:
        node.entries = [];
        if (value && typeof value === 'object') {
          Object.keys(value).forEach(function (key) {
            var entry = newEntry(node, key);
            hydrate(entry.fields, value[key] || {});
            node.entries.push(entry);
          });
        }
        break;

      case CONTROL.ROWS:
        node.rows = [];
        if (Array.isArray(value)) {
          value.forEach(function (item) {
            var row = newRow(node);
            hydrate(row.fields, item || {});
            node.rows.push(row);
          });
        }
        break;

      case CONTROL.CHIPS:
      case CONTROL.SCRIPTS:
        node.value = Array.isArray(value) ? deepClone(value) : [];
        break;

      default:
        node.value = value;
    }
  }

  function applyDefaults(nodes) {
    (nodes || []).forEach(function (node) {
      if (node.defaultValue !== undefined) setValue(node, deepClone(node.defaultValue));
      else if (node.control === CONTROL.RECORD) applyDefaults(node.fields);
    });
    return nodes;
  }

  function hydrate(nodes, config) {
    config = config || {};
    (nodes || []).forEach(function (node) {
      var present = Object.prototype.hasOwnProperty.call(config, node.name)
        && config[node.name] !== null
        && config[node.name] !== undefined;

      if (present) setValue(node, config[node.name]);
      else if (node.defaultValue !== undefined) setValue(node, deepClone(node.defaultValue));
      else if (node.control === CONTROL.RECORD) applyDefaults(node.fields);
    });
    return nodes;
  }

  // ---------------------------------------------------------------------------
  // Reading values back out
  // ---------------------------------------------------------------------------

  /**
   * What counts as "the user left this alone". Note what is absent: `false` and
   * `0`. The controller this replaces dropped every falsy value, so a boolean
   * turned off and a number set to zero never reached Kong.
   */
  function isUnset(value) {
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  function coerce(value, type) {
    if (!NUMERIC[type]) return value;
    if (value === '' || value === null || value === undefined) return undefined;
    var num = Number(value);
    return isNaN(num) ? value : num;
  }

  function valueOf(node) {
    var out;

    switch (node.control) {
      case CONTROL.RECORD:
        return serialize(node.fields);

      case CONTROL.MAP_SCALAR:
        out = {};
        (node.entries || []).forEach(function (entry) {
          if (isUnset(entry.key)) return;
          var value = coerce(entry.value, node.valueType);
          if (!isUnset(value)) out[entry.key] = value;
        });
        return out;

      case CONTROL.MAP_RECORD:
        out = {};
        (node.entries || []).forEach(function (entry) {
          if (isUnset(entry.key)) return;
          var inner = serialize(entry.fields);
          if (!isUnset(inner)) out[entry.key] = inner;
        });
        return out;

      case CONTROL.ROWS:
        out = [];
        (node.rows || []).forEach(function (row) {
          var inner = serialize(row.fields);
          if (!isUnset(inner)) out.push(inner);
        });
        return out;

      case CONTROL.CHIPS:
      case CONTROL.SCRIPTS:
        out = [];
        (node.value || []).forEach(function (item) {
          var value = coerce(item, node.elementType);
          if (!isUnset(value)) out.push(value);
        });
        return out;

      case CONTROL.BOOLEAN:
        return node.value;

      case CONTROL.NUMBER:
        return coerce(node.value, node.type);

      default:
        // A select over a numeric field still has to come back as a number.
        return coerce(node.value, node.type);
    }
  }

  function serialize(nodes) {
    var config = {};
    (nodes || []).forEach(function (node) {
      if (node.control === CONTROL.UNSUPPORTED) return;
      var value = valueOf(node);
      if (!isUnset(value)) config[node.name] = value;
    });
    return config;
  }

  var SchemaFormService = {
    CONTROL: CONTROL,
    normalize: normalize,
    applyDefaults: applyDefaults,
    hydrate: hydrate,
    serialize: serialize,
    newEntry: newEntry,
    newRow: newRow,
    removeAt: removeAt,
    isUnset: isUnset,
    deepClone: deepClone
  };

  // Registered as an angular factory for the app, exported as a module for the
  // node-side round-trip tests. Neither environment sees the other's branch.
  if (typeof angular !== 'undefined' && angular.module) {
    angular.module('frontend.core.services')
      .factory('SchemaFormService', [function factory() {
        return SchemaFormService;
      }]);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SchemaFormService;
  }
}());
