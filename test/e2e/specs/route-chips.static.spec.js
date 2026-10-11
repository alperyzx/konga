/**
 * The route form edits three of Kong's structured fields as free-text chips.
 * RouteChips translates, and these are the cases that used to break it.
 */
const path = require('path');
const { test, expect } = require('@playwright/test');

const REPO = path.resolve(__dirname, '..', '..', '..');
const RouteChips = require(path.join(REPO, 'assets/js/app/routes/route-chips.js'));

test.describe('route chips -> Kong', () => {
  test('a chip without a colon is a field error, not a crash', () => {
    // This threw `Cannot read properties of undefined` straight out of the
    // submit handler, so the save never happened and nothing said why.
    const { data, errors } = RouteChips.toKong({ headers: ['foo'] });
    expect(errors.headers).toContain('foo');
    expect(data.headers).toBeNull();
  });

  test('a readable chip still parses while an unreadable one is reported', () => {
    const { data, errors } = RouteChips.toKong({ headers: ['x-a:1,2', 'nope'] });
    expect(data.headers).toEqual({ 'x-a': ['1', '2'] });
    expect(errors.headers).toContain('nope');
  });

  test('a header value may contain a colon', () => {
    const { data, errors } = RouteChips.toKong({ headers: ['x-origin:http://a.test'] });
    expect(data.headers).toEqual({ 'x-origin': ['http://a.test'] });
    expect(errors).toEqual({});
  });

  test('repeated header names collect their values', () => {
    const { data } = RouteChips.toKong({ headers: ['x-a:1', 'x-a:2'] });
    expect(data.headers).toEqual({ 'x-a': ['1', '2'] });
  });

  test('sources parse with and without a port', () => {
    const { data, errors } = RouteChips.toKong({ sources: ['10.0.0.1:8000', '10.0.0.2'] });
    expect(data.sources).toEqual([{ ip: '10.0.0.1', port: 8000 }, { ip: '10.0.0.2' }]);
    expect(errors).toEqual({});
  });

  test('an IPv6 address keeps its colons', () => {
    const { data } = RouteChips.toKong({ sources: ['2001:db8::1', '[2001:db8::1]:8000'] });
    expect(data.sources).toEqual([
      { ip: '2001:db8::1' },
      { ip: '2001:db8::1', port: 8000 },
    ]);
  });

  test('a truncated or non-numeric port is reported', () => {
    for (const chip of ['10.0.0.1:', '10.0.0.1:http']) {
      const { data, errors } = RouteChips.toKong({ destinations: [chip] });
      expect(errors.destinations, chip).toContain(chip);
      expect(data.destinations, chip).toBeNull();
    }
  });

  test('empty fields are left alone', () => {
    const { data, errors } = RouteChips.toKong({ headers: [], sources: null, name: 'r' });
    expect(errors).toEqual({});
    expect(data).toEqual({ headers: [], sources: null, name: 'r' });
  });
});

test.describe('Kong -> route chips', () => {
  test('every shape survives a round trip', () => {
    const chips = {
      headers: ['x-a:1,2', 'x-origin:http://a.test'],
      sources: ['10.0.0.1:8000', '::1', '[2001:db8::1]:9000'],
      destinations: ['10.0.0.2'],
    };
    expect(RouteChips.toChips(RouteChips.toKong(chips).data)).toEqual(chips);
  });

  test('a route already in chip form passes through untouched', () => {
    // The details page loads once and may re-render before a save.
    const chips = { headers: ['x-a:1'], sources: ['10.0.0.1:80'] };
    expect(RouteChips.toChips(chips)).toEqual(chips);
  });

  test('fields Kong omits stay omitted', () => {
    expect(RouteChips.toChips({ name: 'r' })).toEqual({ name: 'r' });
  });
});
