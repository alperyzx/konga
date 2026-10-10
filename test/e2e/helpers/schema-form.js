/**
 * Shared scaffolding for the two SchemaFormService suites.
 *
 * `schema-form.static.spec.js` runs these against checked-in fixtures; the
 * `schema` project runs the same assertions against whatever Kong is actually
 * up. The assertions only mean the same thing in both places if they are
 * literally the same code, so they live here rather than being copied.
 */

const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const SchemaForm = require(path.join(REPO, 'assets/js/app/core/services/SchemaFormService.js'));

/**
 * serialize() omits values the user never set, so the round-trip is only an
 * identity once the same notion of "unset" is applied to the input. Note that
 * false and 0 survive this, deliberately — dropping them was the bug.
 */
function isUnset(value) {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function prune(value) {
  if (Array.isArray(value)) {
    return value.map(prune).filter((v) => !isUnset(v));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      const pruned = prune(value[key]);
      if (!isUnset(pruned)) out[key] = pruned;
    }
    return out;
  }
  return value;
}

/**
 * Build a config that exercises every leaf in a schema, rather than only the
 * ones Kong happens to give a default. Deterministic, so a failure reproduces.
 */
function sampleConfig(nodes, seed = 0) {
  const config = {};
  nodes.forEach((node, i) => {
    const n = seed + i;
    switch (node.control) {
      case 'record':
        config[node.name] = sampleConfig(node.fields, n + 1);
        break;
      case 'map-scalar':
        config[node.name] = { [`k${n}`]: `v${n}`, [`k${n}b`]: `v${n}b` };
        break;
      case 'map-record':
        config[node.name] = { [`k${n}`]: sampleConfig(node.template, n + 1) };
        break;
      case 'rows':
        config[node.name] = [sampleConfig(node.template, n + 1), sampleConfig(node.template, n + 2)];
        break;
      case 'chips':
        config[node.name] = node.elementType === 'integer' ? [n, n + 1] : [`a${n}`, `b${n}`];
        break;
      case 'select':
        config[node.name] = node.one_of[n % node.one_of.length];
        break;
      case 'boolean':
        // Alternate, so at least some fields carry `false` — the value the old
        // serializer silently dropped.
        config[node.name] = n % 2 === 0;
        break;
      case 'number':
        config[node.name] = n % 3 === 0 ? 0 : n + 1;
        break;
      default:
        config[node.name] = `s${n}`;
    }
  });
  return config;
}

/** Every control the renderer would reach for, at any depth. */
function controls(nodes, found = new Set()) {
  nodes.forEach((node) => {
    found.add(node.control);
    if (node.fields) controls(node.fields, found);
    if (node.template) controls(node.template, found);
  });
  return found;
}

/** How deep the schema nests. Depth 1 is a flat plugin. */
function depth(nodes) {
  return nodes.reduce((max, node) => {
    const children = node.fields || node.template;
    const below = Array.isArray(children) ? depth(children) : 0;
    return Math.max(max, 1 + below);
  }, 0);
}

module.exports = { SchemaForm, isUnset, prune, sampleConfig, controls, depth, REPO };
