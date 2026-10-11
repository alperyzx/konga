'use strict';

/**
 * BaseController.js
 *
 * Base controller for all sails.js controllers. This just contains some common code
 * that every controller uses
 */
module.exports = {
  /**
   * Generic count action for controller.
   *
   * @param   {Request}   request
   * @param   {Response}  response
   */
  count: function count(request, response) {
    var modelIdentity = request.options.model || request.options.controller || request.path.split('/')[2];
    var Model = sails.models[modelIdentity];
    var where = request.query && request.query.where;

    if (!Model) {
      return response.serverError(new Error('No model found for count action: ' + modelIdentity));
    }

    if (typeof where === 'string') {
      try {
        where = JSON.parse(where);
      } catch (error) {
        return response.badRequest({
          message: 'Invalid JSON in the where query parameter'
        });
      }
    }

    if (!where || typeof where !== 'object' || Array.isArray(where)) {
      where = {};
    }

    Model
      .count(where)
      .exec(function found(error, count) {
        if (error) {
          response.negotiate(error);
        } else {
          response.ok({count: count});
        }
      })
    ;
  }
};
