'use strict';
/**
 * Production environment settings
 *
 * This file can include shared settings for a production environment,
 * such as API keys or remote database passwords.  If you're using
 * a version control solution for your Sails app, this file will
 * be committed to your repository unless you add it to your .gitignore
 * file.  If your repository will be publicly viewable, don't add
 * any private information to this file!
 *
 */

var fs = require('fs');
var port = process.env.PORT || 1337;
var allowedOrigins = (process.env.KONGA_ALLOWED_ORIGINS ||
  'http://localhost:' + port + ',http://127.0.0.1:' + port)
  .split(',')
  .map(function(origin) { return origin.trim(); })
  .filter(Boolean);

module.exports = {
  /***************************************************************************
   * Set the default database connection for models in the production        *
   * environment (see config/datastores.js and config/models.js )            *
   ***************************************************************************/

  hookTimeout: process.env.KONGA_HOOK_TIMEOUT || 60000,

  // kong_admin_url : process.env.KONG_ADMIN_URL || 'http://127.0.0.1:8001',

  // models: {
  //   datastore: 'someMysqlServer'
  // },

  /***************************************************************************
   * Set the port in the production environment to 80                        *
   ***************************************************************************/

  port: port,

  explicitHost: process.env.HOST || "0.0.0.0",

  sockets: {
    beforeConnect: function(handshake, callback) {
      var origin = handshake.headers && handshake.headers.origin;
      // Same-origin polling and non-browser clients may omit Origin. Browsers
      // include it for cross-origin requests, which must match the allowlist.
      return callback(null, !origin || allowedOrigins.indexOf(origin) !== -1);
    }
  },

  models: {
    migrate: 'safe'
  },

  ssl: {
    key: process.env.SSL_KEY_PATH ? fs.readFileSync(process.env.SSL_KEY_PATH) : null,
    cert: process.env.SSL_CRT_PATH ? fs.readFileSync(process.env.SSL_CRT_PATH) : null
  },

  /***************************************************************************
   * Set the log level in production environment to "warn"                   *
   ***************************************************************************/
  log: {
      level: process.env.KONGA_LOG_LEVEL || "warn"
  },

  // Keep data of response errors in production mode
  keepResponseErrors : true


};
