'use strict';

/**
 * Policy Mappings
 * (sails.config.policies)
 *
 * Policies are simple functions which run **before** your controllers.
 * You can apply one or more policies to a given controller, or protect
 * its actions individually.
 *
 * Any policy file (e.g. `api/policies/authenticated.js`) can be accessed
 * below by its filename, minus the extension, (e.g. "authenticated")
 *
 * For more information on how policies work, see:
 * http://sailsjs.org/#/documentation/concepts/Policies
 *
 * For more information on configuring policies, check out:
 * http://sailsjs.org/#/documentation/reference/sails.config/sails.config.policies.html
 */
module.exports.policies = {
  // Default policy for all controllers and actions
  '*': ['authenticated'],

  AuthController: {
    'checkPassword': ['authenticated'],
    'signup': ['signup', 'createUser'],
    '*': ['passport'],

  },

  KongConsumersController: {
    '*': ['authenticated', 'dynamicNode']
  },

  KongSchemasController: {
    '*': ['authenticated'],
  },

  KongPluginsController: {
    '*': ['authenticated', 'dynamicNode'],
  },

  KongServicesController: {
    '*': ['authenticated', 'dynamicNode'],
  },

  KongRoutesController: {
    '*': ['authenticated', 'dynamicNode'],
  },

  KongCertificatesController: {
    '*': ['authenticated', 'dynamicNode'],
  },

  ApiHealthCheckController: {
    '*': ['authenticated', 'dynamicNode'],
    'subscribeHealthChecks': ['authenticated'],
    'reset' : ['authenticated', 'dynamicNode', 'isAdmin']
  },


  // User controller
  UserController: {
    '*': ['authenticated'],
    'count': ['authenticated'],
    'find': ['authenticated'],
    'findOne': ['authenticated'],
    'create': ['authenticated', 'isAdmin', 'addDataCreate', 'createUser'],
    'update': ['authenticated', 'addDataUpdate', 'updateUser'],
    'destroy': ['authenticated', 'isAdmin', 'deleteUser'],
    'add': ['authenticated', 'isAdmin'],
    'remove': ['authenticated', 'isAdmin']
  },

  KongNodeController: {
    '*': ['authenticated'],
    'count': ['authenticated'],
    'find': ['authenticated'],
    'findOne': ['authenticated'],
    'create': ['authenticated', 'isAdmin', 'addDataCreate'],
    'update': ['authenticated', 'isAdmin', 'addDataUpdate'],
    'destroy': ['authenticated', 'isAdmin'],
    'add': ['authenticated', 'isAdmin'],
    'remove': ['authenticated', 'isAdmin']
  },

  NetdataConnectionController: {
    '*': ['authenticated'],
    'count': ['authenticated'],
    'find': ['authenticated'],
    'findOne': ['authenticated'],
    'create': ['authenticated', 'isAdmin', 'addDataCreate'],
    'update': ['authenticated', 'isAdmin', 'addDataUpdate'],
    'destroy': ['authenticated', 'isAdmin']
  },

  SnapshotController: {
    '*': ['authenticated'],
    'takeSnapShot': ['authenticated', 'isAdmin', 'dynamicNode', 'createUser'],
    'snapshot': ['authenticated', 'isAdmin', 'dynamicNode', 'createUser'],
    'restore': ['authenticated', 'isAdmin', 'dynamicNode'],
    'remove': ['authenticated', 'isAdmin'],
    'find': ['authenticated', 'isAdmin']
  },

  SnapshotScheduleController: {
    'create': ['authenticated', 'isAdmin', 'addDataCreate'],
    'update': ['authenticated', 'isAdmin', 'addDataUpdate'],
    'remove': ['authenticated', 'isAdmin'],
    'find': ['authenticated', 'isAdmin']
  },

  UpstreamAlertController: {
    'create': ['authenticated', 'isAdmin', 'addDataCreate'],
    'update': ['authenticated', 'isAdmin', 'addDataUpdate'],
    'remove': ['authenticated', 'isAdmin'],
    'find': ['authenticated', 'isAdmin']
  },

  SettingsController: {
    'find': true,
    '*': ['authenticated', 'isAdmin'],
  },


  KongProxyController: {
    "*": ['authenticated', 'dynamicNode']
  }


};
