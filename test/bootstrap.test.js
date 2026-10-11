/**
 * Mocha bootstrap file for backend application tests.
 */

var Sails = require('sails');

process.env.NODE_ENV = 'test';

/**
 * Mocha bootstrap before function, that is run before any tests are being processed. This will lift sails.js with
 * test configuration.
 *
 * Tests use an in-memory sails-disk datastore and never touch local development data.
 *
 * @param   {Function}  next    Callback function
 */
before(function before(next) {
    Sails.lift({
        // configuration for testing purposes
        models: {
            datastore: 'localDiskDb',
            migrate: 'drop'
        },
        port: 1336,
        environment: 'test',
        log: {
            level: 'error'
        },
        hooks: {
            grunt: false,
            helpers: false
        }
    }, function callback(error, sails) {
        // Yeah sails is lifted now!
        next(error, sails);
    });
});

/**
 * Mocha bootstrap after function, that is run after all tests are processed. Main purpose of this is just to
 * lower sails test instance.
 *
 * @param   {Function}  next    Callback function
 */
after(function after(next) {
    sails.lower(next);
});
