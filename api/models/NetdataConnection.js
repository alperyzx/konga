'use strict';

var _ = require('lodash');

/**
 * KongNode.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/#!documentation/models
 */
var defaultModel = _.merge(_.cloneDeep(require('../base/Model')), {
  tableName: "konga_netdata_connections",
  attributes: {
    id: {
      type: 'number',
      unique: true,
      autoIncrement: true
    },
    // name: {
    //   type: 'string',
    //   required: true,
    //   unique: true
    // },

    apiId: {
      type: 'string',
      required: true
    },

    url: {
      type: 'string',
      required: true
    }
  }
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


module.exports = sails.config.models.datastore == 'mongo' ? mongoModel() : defaultModel;
