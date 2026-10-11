'use strict';

var _ = require('lodash');
var async = require('async');
var defSeedData = require('../../config/default-seed-data.js');

/**
 * User.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/#!documentation/models
 */


var defaultModel = _.merge(_.cloneDeep(require('../base/Model')), {
  tableName: "konga_users",
  attributes: {
    id: {
      type: 'number',
      unique: true,
      autoIncrement: true
    },
    username: {
      type: 'string',
      unique: true,
      required: true
    },
    email: {
      type: 'string',
      unique: true,
      required: true
    },
    firstName: {
      type: 'string'
    },
    lastName: {
      type: 'string'
    },
    admin: {
      type: 'boolean',
      defaultsTo: false
    },

    node_id: {
      type: 'string',
      defaultsTo: ''
    },

    active: {
      type: 'boolean',
      defaultsTo: false
    },

    activationToken: {
      type: 'string'
    },

    node: {
      model: 'kongnode'
    },

    // Passport configurations
    passports: {
      collection: 'Passport',
      via: 'user'
    },
  },

  afterDestroy: function (values, cb) {

    sails.log("User:afterDestroy:called => ", values);


    var fns = [];

    [].concat(values || []).forEach(function (user) {
      fns.push(function (callback) {
        // Delete passports
        sails.models.passport.destroy({user: user.id})
          .exec(callback)
      })
    })

    async.series(fns, cb);

  },

  seedData: defSeedData.userSeedData.map(function (orig) {
    return {
      "username": orig.username,
      "email": orig.email,
      "firstName": orig.firstName,
      "lastName": orig.lastName,
      "admin": orig.admin,
      "active": orig.active
    }
  })
});

var mongoModel = function () {
  var obj = _.cloneDeep(defaultModel)
  delete obj.attributes.id
  return obj;
}

if(sails.config.models.datastore == 'postgres' && process.env.DB_PG_SCHEMA) {
  defaultModel.meta =  {
    schemaName: process.env.DB_PG_SCHEMA
  }
}

module.exports = sails.config.models.datastore == 'mongo' ? mongoModel() : defaultModel
