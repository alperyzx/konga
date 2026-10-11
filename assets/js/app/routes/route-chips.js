/**
 * Converts between the strings the route form edits and the shapes Kong stores.
 *
 * Kong types `sources` and `destinations` as sets of {ip, port} records and
 * `headers` as a map of header name to a list of values. The form edits all
 * three as free-text chips following a documented convention —
 * "192.168.1.2:3000", "x-some-header:foo,bar" — so something has to translate
 * in both directions.
 *
 * That translation lives here because it used to live in two controllers at
 * once: the add modal and the details page each carried their own copy of the
 * submit-side conversion, and only the details page carried the load-side one
 * back. Both copies read `parts[1]` without checking it was there, so a chip
 * typed without a colon threw a TypeError out of the submit handler — the save
 * never happened, and nothing told the user why. Nothing enforces the
 * convention, so chips that do not follow it are now reported as field errors.
 *
 * Kong's schema is the authority on these shapes, so the schema-driven entity
 * forms are expected to delete this file along with the hand-written route
 * form.
 *
 * Dependency-free on purpose: the test suite loads it directly in node.
 */
(function () {
  'use strict';

  function copy(obj) {
    var out = {};
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
    }
    return out;
  }

  function trim(str) {
    return String(str).trim();
  }

  function nonEmpty(str) {
    return !!str;
  }

  /**
   * Split "ip:port" without mangling an IPv6 address.
   *
   * An address is only followed by a port when there is exactly one colon
   * ("10.0.0.1:8000") or when the address is bracketed ("[::1]:8000"). More
   * than one bare colon means the colons belong to an IPv6 address, which
   * Kong accepts on its own. A trailing colon with nothing after it is a
   * truncated port rather than an address, so it is reported rather than
   * guessed at.
   */
  function splitHostPort(raw) {
    var bracketed = raw.match(/^\[(.+)\](?::(.*))?$/);
    if (bracketed) {
      return withPort(bracketed[1].trim(), bracketed[2]);
    }

    var colons = raw.split(':').length - 1;
    if (colons !== 1) return { ip: raw };

    return withPort(raw.slice(0, raw.indexOf(':')).trim(), raw.slice(raw.indexOf(':') + 1));
  }

  function withPort(ip, tail) {
    if (tail === undefined) return { ip: ip };

    tail = String(tail).trim();
    if (!tail) return null;
    if (!/^\d+$/.test(tail)) return null;

    return { ip: ip, port: parseInt(tail, 10) };
  }

  /**
   * Chip strings -> the shapes Kong's schema accepts.
   *
   * Returns {data, errors}. `errors` is keyed by field name and empty when
   * every chip parsed; a caller that finds it non-empty should show it and not
   * submit, because the fields it names have had their unreadable chips
   * dropped.
   */
  function toKong(route) {
    var data = copy(route);
    var errors = {};

    ['sources', 'destinations'].forEach(function (key) {
      if (!Array.isArray(data[key]) || !data[key].length) return;

      var bad = [];
      var parsed = [];

      data[key].forEach(function (chip) {
        var raw = trim(chip);
        var entry = raw ? splitHostPort(raw) : null;
        if (!entry || !entry.ip) {
          bad.push(chip);
          return;
        }
        parsed.push(entry);
      });

      if (bad.length) {
        errors[key] = 'Expected "ip" or "ip:port". Could not read: ' + bad.join(', ');
      }
      data[key] = parsed.length ? parsed : null;
    });

    if (Array.isArray(data.headers) && data.headers.length) {
      var bad = [];
      var map = {};

      data.headers.forEach(function (chip) {
        var raw = String(chip);
        var sep = raw.indexOf(':');
        // Split on the first colon only — a header value may contain one.
        var name = sep < 0 ? '' : raw.slice(0, sep).trim();
        var values = sep < 0 ? [] : raw.slice(sep + 1).split(',').map(trim).filter(nonEmpty);

        if (!name || !values.length) {
          bad.push(raw);
          return;
        }
        map[name] = (map[name] || []).concat(values);
      });

      if (bad.length) {
        errors.headers = 'Expected "name:value" or "name:v1,v2". Could not read: ' + bad.join(', ');
      }
      data.headers = Object.keys(map).length ? map : null;
    }

    return { data: data, errors: errors };
  }

  /**
   * The inverse: Kong's shapes -> chip strings, for loading an existing route
   * into the form. Idempotent, so a route that is already in chip form (an
   * unsaved edit, say) passes through untouched.
   */
  function toChips(route) {
    var out = copy(route);

    if (out.headers && !Array.isArray(out.headers)) {
      out.headers = Object.keys(out.headers).map(function (name) {
        var values = out.headers[name];
        return name + ':' + (Array.isArray(values) ? values.join(',') : values);
      });
    }

    ['sources', 'destinations'].forEach(function (key) {
      if (!Array.isArray(out[key])) return;
      out[key] = out[key].map(function (entry) {
        if (typeof entry === 'string') return entry;
        if (!entry.port) return entry.ip;
        // An IPv6 address needs brackets before a port can be appended to it,
        // or the result reads back as one longer address.
        var ip = entry.ip.indexOf(':') > -1 ? '[' + entry.ip + ']' : entry.ip;
        return ip + ':' + entry.port;
      });
    });

    return out;
  }

  var RouteChips = {
    toKong: toKong,
    toChips: toChips
  };

  // Registered as an angular factory for the app, exported as a module for the
  // node-side tests. Neither environment sees the other's branch.
  if (typeof angular !== 'undefined' && angular.module) {
    angular.module('frontend.routes')
      .factory('RouteChips', [function factory() {
        return RouteChips;
      }]);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RouteChips;
  }
}());
