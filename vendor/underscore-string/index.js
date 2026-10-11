'use strict';

const methods = {
  capitalize: value => String(value).charAt(0).toUpperCase() + String(value).slice(1),
  endsWith: (value, suffix) => String(value).endsWith(suffix),
  ltrim: value => String(value).replace(/^\s+/, ''),
  rtrim: value => String(value).replace(/\s+$/, ''),
  startsWith: (value, prefix) => String(value).startsWith(prefix),
  trim: value => String(value).trim()
};

methods.exports = function () {
  return methods;
};

module.exports = methods;
