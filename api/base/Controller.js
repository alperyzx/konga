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

    if (!Model) {
      return response.serverError(new Error('No model found for count action: ' + modelIdentity));
    }

    Model
      .count(request.query || {})
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
