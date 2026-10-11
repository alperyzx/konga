'use strict';

const util = require('util');

function I18n(options) {
  options = options || {};
  Object.assign(this, options);
  this.defaultLocale = options.defaultLocale || (options.locales && options.locales[0]) || 'en';
  this.locale = this.defaultLocale;
}

I18n.resMethods = ['__', '__n', 'getLocale', 'isPreferredLocale'];

I18n.prototype.__ = function (message) {
  return util.format.apply(util, arguments);
};

I18n.prototype.__n = function (singular, plural, count) {
  if (typeof plural === 'number') {
    count = plural;
    plural = singular;
  }
  return util.format(Number(count) === 1 ? singular : plural, count);
};

I18n.prototype.getLocale = function () {
  return this.locale;
};

I18n.prototype.setLocale = function (locale) {
  this.locale = locale || this.defaultLocale;
  return this.locale;
};

I18n.prototype.isPreferredLocale = function (locale) {
  return this.locale === locale;
};

I18n.registerMethods = function (target, req) {
  I18n.resMethods.forEach(function (method) {
    target[method] = req.i18n[method].bind(req.i18n);
  });
  return target;
};

I18n.expressBind = function (app, options) {
  app.use(function (req, res, next) {
    req.i18n = new I18n(Object.assign({}, options, {request: req}));
    if (res.locals) I18n.registerMethods(res.locals, req);
    next();
  });
};

module.exports = I18n;
