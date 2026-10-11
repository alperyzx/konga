'use strict';

var expect = require('chai').expect;
var request = require('../../helpers/supertest');
var login = require('../../helpers/login');

describe('UserController', function UserController() {
    it('returns the populated node after activating a connection', function(done) {
        login.authenticate('admin', function(error, auth) {
            if (error) return done(error);

            sails.models.kongnode.findOne({name: 'default'}).exec(function(nodeError, node) {
                if (nodeError) return done(nodeError);

                request(sails.hooks.http.app)
                    .put('/api/user/' + auth.user.id)
                    .set('Authorization', 'bearer ' + auth.token)
                    .send({node: node.id})
                    .expect(200)
                    .end(function(updateError, result) {
                        if (updateError) return done(updateError);

                        expect(result.res.body.node).to.include({
                            id: node.id,
                            name: node.name
                        });

                        sails.models.user.updateOne({id: auth.user.id}).set({node: null})
                            .exec(done);
                    });
            });
        });
    });
});
