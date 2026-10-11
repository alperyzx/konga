'use strict';

var _ = require('lodash');

/**
 * UserController
 *
 * @description :: Server-side logic for managing Users
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */
module.exports = _.merge(_.cloneDeep(require('../base/Controller')), {

    create: function(req, res) {
        var userData = _.omit(req.body, ['passports', 'password_confirmation']);
        var passportData = req.body.passports;

        sails.models.user.create(userData).fetch().exec(function(err, user) {
            if(err) return res.negotiate(err);
            if(!passportData || !passportData.password) return res.created(user);

            sails.models.passport.create({
                protocol: 'local',
                password: passportData.password,
                user: user.id
            }).exec(function(passportError) {
                if(passportError) return res.negotiate(passportError);
                return res.created(user);
            });
        });
    },



    subscribe: function(req, res) {

        if (!req.isSocket) {
            sails.log.error("UserController:subscribe failed")
            return res.badRequest('Only a client socket can subscribe.');
        }

        var roomName = 'user.' + req.param("id") + '.updated';
        sails.sockets.join(req.socket, roomName);
        res.json({
            room: roomName
        });
    },

    update : function(req,res) {

        sails.log(req.body)

        var user = _.cloneDeep(req.body);
        var passports = req.body.passports

        // Delete unwanted properties
        delete user.passports
        delete user.password_confirmation
        if (_.isObject(user.node)) user.node = user.node.id;


        sails.models.user
            .update({id : req.param('id')},user)
            .fetch()
            .exec(function(err,updated){
                if(err) return res.negotiate(err);

                var user = updated[0];

                if(!user) {
                  return  res.json()
                }

                function respondWithUser() {
                    if(!passports) return res.json(user)

                    sails.models.passport
                        .update({user:req.param('id')},{password:passports.password})
                        .fetch()
                        .exec(function(err){
                            if(err) return res.negotiate(err);
                            return res.json(user)
                        })
                }

                if(user.node) {
                    return sails.models.kongnode
                        .findOne({id : user.node})
                        .exec(function(err,node){
                            if(err) return res.negotiate(err)
                            user.node = node;
                            sails.sockets.blast('user.' + user.id + '.updated', user);
                            return respondWithUser()
                        })
                }

                sails.sockets.blast('user.' + user.id + '.updated', user);
                return respondWithUser()



        })
    }
});
