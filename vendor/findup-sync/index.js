'use strict';

const fs = require('fs');
const path = require('path');

function expandBraces(pattern) {
  const match = pattern.match(/\{([^{}]+)\}/);
  if (!match) return [pattern];
  return match[1].split(',').flatMap(function (part) {
    return expandBraces(pattern.slice(0, match.index) + part + pattern.slice(match.index + match[0].length));
  });
}

function patternToRegExp(pattern, nocase) {
  const escaped = pattern.replace(/[.+^$()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp('^' + escaped + '$', nocase ? 'i' : '');
}

function findMatch(directory, pattern, options) {
  const direct = path.resolve(directory, pattern);
  if (!/[?*{}]/.test(pattern) && fs.existsSync(direct)) return direct;

  let names;
  try {
    names = fs.readdirSync(directory);
  } catch (error) {
    return null;
  }

  const matchers = expandBraces(pattern).map(item => patternToRegExp(item, options.nocase));
  const name = names.find(item => matchers.some(matcher => matcher.test(item)));
  return name ? path.join(directory, name) : null;
}

module.exports = function findup(patterns, options) {
  options = options || {};
  patterns = Array.isArray(patterns) ? patterns : [patterns];
  let directory = path.resolve(options.cwd || process.cwd());

  while (true) {
    for (const pattern of patterns) {
      const match = findMatch(directory, pattern, options);
      if (match) return match;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
};
