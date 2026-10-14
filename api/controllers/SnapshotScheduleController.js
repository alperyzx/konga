'use strict';

var _ = require('lodash');
var cron = require('node-cron');

module.exports = _.merge(_.cloneDeep(require('../base/Controller')), {



    create : function (req,res) {


        // Validate cron
        if(!cron.validate(req.body.cron)) {
            return res.badRequest({
                message : "Cron parameters are not valid",
                fields : ["cron"]
            });
        }

        // Check if another schedule using the defined
        // connection already exists.
        sails.models.snapshotschedule.find({
            connection : req.body.connection
        }).exec(function(err,results){
            if(err) {
                return res.negotiate(err);
            }

            if(results && results.length > 0) {
                return res.badRequest({
                    message : "A schedule for the defined connection already exists",
                    fields : ["connection"]
                });
            }


            sails.models.snapshotschedule.create(req.body).fetch()
                .exec(function (err,created) {
                    if(err) {
                        return res.negotiate(err);
                    }

                    if(!created) {
                        sails.log.error('SnapshotScheduleController:create: Schedule was not returned after creation');
                        return res.serverError({
                            message: 'The schedule was created, but its details could not be returned.'
                        });
                    }

                    return res.json(created);
                });
        });





    }
});
