'use strict';

var supertest = require('supertest');
var Test = require('supertest/lib/test');

// Supertest 7 exposes parsed response data on `response.body`.  Konga's
// legacy tests use the pre-2.x `response.res.body` location, so retain that
// alias while the Sails migration is in progress.
if (!Test.prototype._kongaLegacyBodyAlias) {
    var originalEnd = Test.prototype.end;

    Test.prototype.end = function end(callback) {
        return originalEnd.call(this, function completed(error, response) {
            if (response && response.res) {
                response.res.body = response.body;
            }

            callback(error, response);
        });
    };

    Test.prototype._kongaLegacyBodyAlias = true;
}

module.exports = supertest;
