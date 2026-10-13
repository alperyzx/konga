'use strict';

var _ = require('lodash');
var Kong = require("../services/KongService");

module.exports = _.merge(_.cloneDeep(require('../base/Controller')), {

    subscribeHealthChecks: function(req, res) {

        if (!req.isSocket) {
            sails.log.error("KongNodeController:subscribe failed")
            return res.badRequest('Only a client socket can subscribe.');
        }

        var roomName = 'node.health_checks';
        sails.sockets.join(req.socket, roomName);
        res.json({
            room: roomName
        });
    },

    update : function(req,res){
        sails.models.kongnode.findOne({id:req.params.id}).exec(function afterwards(err, node){

            if (err) return res.negotiate(err);
            sails.models.kongnode.update({id:req.params.id},req.body).fetch().exec(function afterwards(err, resp){

                if (err) return res.negotiate(err);
                if(req.body.active && node.active != req.body.active) {
                    sails.models.kongnode.update({
                        where: { id:{ '!=': req.params.id } },

                    },{active:false}).fetch().exec(function afterwards(err, upd){
                        if (err) return res.negotiate(err);
                        return  res.json(resp[0])
                    })
                }else{
                    return  res.json(resp[0])
                }
            });
        });

    },


    create : function(req,res) {
        sails.models.kongnode.create(req.body).fetch()
            .exec(function(err, node){
                if(err) {
                    return res.negotiate(err);
                }

                if(process.env.NODE_ENV == 'test') {
                    return res.created(node);
                }

                Kong.nodeInfo(node, function(err,info){

                    if(err) {
                        sails.log.error("KongNodeController:create","Failed to get node info",err)
                    }

                    if(info) {
                        sails.models.kongnode.update(node.id,{
                            kong_version : info.version
                        }).fetch().exec(function (err, _node) {
                            if(err) {
                                return res.negotiate(err);
                            }

                            return res.created(_node[0]);
                        })
                    }else{
                        return res.created(node);
                    }
                })
            })
    }
});
