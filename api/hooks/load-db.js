'use strict';

var async = require('async');
var _ = require('lodash')
var defSeedData = require('../../config/default-seed-data.js');

/**
 * load-db.js
 *
 * This file contains a custom hook, that will be run after sails.js orm hook is loaded. Purpose of this hook is to
 * check that database contains necessary initial data for application.
 */
module.exports = function hook(sails) {
  return {
    /**
     * Private hook method to do actual database data population. Note that fixture data are only loaded if there
     * isn't any users in current database.
     *
     * @param {Function}  next  Callback function to call after all is done
     */
    process: function process(next) {

        if(sails.config.environment != 'test') {
            var seedPassports = function(cb) {
                sails.models.user
                    .find()
                    .exec(function callback(error, users) {
                        if(error) return cb(error)

                        var passportsFns = []
                        users.forEach(function(user){
                            passportsFns.push(function(_cb){
                                var passwordToSetArr = defSeedData.userSeedData.filter( function (orig) {
                                  return (orig.username == user.username)
                                });
                                var passwordToSet = undefined;
                                if (passwordToSetArr.length == [1]) {
                                  passwordToSet = passwordToSetArr[0].password;
                                }
                                // Only set the password if we have one
                                if (typeof(passwordToSet) != 'undefined') {
                                  sails.models.passport
                                      .create({
                                          protocol: "local",
                                          password : passwordToSet,
                                          user : user.id
                                      }).exec(function(err,passport){
                                      if(err) return _cb(err)
                                      return _cb(null)
                                  })
                                }else {
                                  return _cb();
                                }
                            })
                        })

                        async.series(passportsFns,cb)

                    })
            }
            async.series([
                sails.models.user.seed.bind(sails.models.user),
                seedPassports,
                sails.models.kongnode.seed.bind(sails.models.kongnode),
                sails.models.emailtransport.seed.bind(sails.models.emailtransport),
                function seedOrMergeSettings(cb) {
                    var seeds = sails.models.settings.seedData[0]
                    sails.models.settings.find().limit(1)
                        .exec(function(err,data){
                            if(err) return cb(err)
                            var _data = _.merge(seeds,data[0] || {})
                            sails.models.settings.updateOrCreate({
                                id : _data.id
                            },_data,function(err,coa){
                                if(err) return cb(err)
                                return cb()
                            })
                        })
                },
                function activateExistingUsers(cb) {

                    // Assign the same activation token to existing users
                    // for simplicity.
                    // After all, it's not like they're
                    // going to use it again.
                    var uuidv4 = require('uuid/v4');

                    sails.models.user
                        .update({
                            activationToken : undefined

                        },{active : true,activationToken : uuidv4()})
                        .exec(cb)
                }
                //sails.models.settings.seed
            ],next);
        }else{
            sails.models.user
              .find()
              .exec(function callback(error, users) {
                if (error) {
                  next(error);
                } else if (users.length !== 0 && JSON.stringify(users[0]) !== '{}') {
                  next();
                } else {
                  sails.log.verbose(__filename + ':' + __line + ' [Hook.load-db] Populating database with fixture data...');

                  var populatedUsers;
                  async.series([
                    function populateUsers(callback) {
                      sails.models.user.createEach(require('../../test/fixtures/User.json')).fetch().exec(function(error, users) {
                        populatedUsers = users;
                        callback(error);
                      });
                    },
                    function populatePassports(callback) {
                      async.eachOfSeries(require('../../test/fixtures/Passport.json'), function createPassport(passport, index, nextPassport) {
                        passport = _.assign({}, passport, {user: populatedUsers[index].id});
                        sails.models.passport.create(passport).exec(nextPassport);
                      }, callback);
                    },
                    function populateNodes(callback) {
                      sails.models.kongnode.createEach(require('../../test/fixtures/KongNode.json')).exec(callback);
                    }
                  ], next);
                }
              })
            ;
        }





    },

    /**
     * Method that runs automatically when the hook initializes itself.
     *
     * @param {Function}  next  Callback function to call after all is done
     */
    initialize: function initialize(next) {
      var self = this;

      // Wait for sails orm hook to be loaded
      sails.after('hook:orm:loaded', function onAfter() {
        self.process(next);
      });
    }
  };
};
