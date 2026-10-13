'use strict';

module.exports = {
  jwt: {
    secret: process.env.TOKEN_SECRET,
    sign: {
      algorithm: 'HS512',
      expiresInMinutes: 1,
      noTimestamp: false
    },
    verify: {
      ignoreExpiration: false
    }
  }
};
