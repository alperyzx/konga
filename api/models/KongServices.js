'use strict';

var _ = require('lodash');

/**
 * ApiHealthCheck.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/#!documentation/models
 */
var defaultModel = _.merge(_.cloneDeep(require('../base/Model')), {
  tableName : "konga_kong_services",
  attributes: {
    id : {
      type: 'number',
      unique: true,
      autoIncrement : true
    },

    service_id : {
      type : "string",
      required : true,
      unique: true
    },

    kong_node_id: {
      type: "string",
      required: true
    },

    description : {
      type : 'string'
    },

    tags : {
      type : "json"
    }
  }
});

var mongoModel =  _.omit(_.cloneDeep(defaultModel),["attributes.id"]);

if(sails.config.models.datastore == 'postgres' && process.env.DB_PG_SCHEMA) {
  defaultModel.meta =  {
    schemaName: process.env.DB_PG_SCHEMA
  }
}


module.exports = sails.config.models.datastore == 'mongo' ? mongoModel : defaultModel
