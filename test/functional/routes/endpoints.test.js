'use strict';

var async = require('async');
var expect = require('chai').expect;
var login = require('../../helpers/login');
var request = require('../../helpers/supertest');

function routePathForRequest(path) {
  var parameterValues = {
    action: 'authenticated',
    child_entity: 'targets',
    entity: 'status',
    id: '1',
    provider: 'local'
  };

  return path
    .replace(/\*/g, 'status')
    .replace(/:([A-Za-z0-9_]+)\??/g, function replaceParameter(match, name) {
      return parameterValues[name] || '1';
    });
}

function registeredHttpRoutes() {
  var seen = {};
  var routes = [];

  sails.router._privateRouter.stack.forEach(function eachLayer(layer) {
    if (!layer.route || typeof layer.route.path !== 'string') return;

    Object.keys(layer.route.methods || {}).forEach(function eachMethod(method) {
      method = method.toLowerCase();
      if (['get', 'post', 'put', 'patch', 'delete', 'options'].indexOf(method) === -1) return;

      var key = method + ' ' + layer.route.path;
      if (seen[key]) return;
      seen[key] = true;
      routes.push({method: method, path: layer.route.path});
    });
  });

  return routes;
}

describe('HTTP endpoint inventory', function endpointInventory() {
  var adminToken;

  before(function authenticateAdmin(done) {
    login.authenticate('admin', function authenticated(error, result) {
      if (!error) adminToken = result.token;
      done(error);
    });
  });

  it('routes every registered endpoint without an unauthenticated server error', function testEveryRoute(done) {
    var routes = registeredHttpRoutes();

    expect(routes.length).to.be.greaterThan(50);

    async.eachSeries(routes, function exerciseRoute(route, next) {
      var path = routePathForRequest(route.path);
      var call = request(sails.hooks.http.app)[route.method](path)
        .set('Content-Type', 'application/json');

      if (['post', 'put', 'patch'].indexOf(route.method) !== -1) call.send({});

      call.end(function routeComplete(error, response) {
        if (error && !response) return next(error);

        try {
          expect(response.status, route.method.toUpperCase() + ' ' + route.path)
            .to.be.below(500);
          next();
        } catch (assertionError) {
          next(assertionError);
        }
      });
    }, done);
  });

  it('supports sorted collections and filtered counts on every model-backed API', function testModelApis(done) {
    var actionNames = Object.keys(sails._actions);
    var resources = Object.keys(sails.models).filter(function modelHasController(identity) {
      return identity !== 'passport' && actionNames.some(function actionBelongsToController(action) {
        return action.indexOf(identity + '/') === 0;
      });
    });

    expect(resources).to.include.members([
      'apihealthcheck',
      'emailtransport',
      'kongnode',
      'kongservices',
      'netdataconnection',
      'settings',
      'snapshot',
      'snapshotschedule',
      'upstreamalert',
      'user'
    ]);

    async.eachSeries(resources, function exerciseResource(resource, next) {
      var headers = {
        Authorization: 'bearer ' + adminToken,
        'connection-id': '1'
      };

      request(sails.hooks.http.app)
        .get('/api/' + resource)
        .query({where: JSON.stringify({}), limit: 25, skip: 0, sort: 'createdAt DESC'})
        .set(headers)
        .expect(200)
        .end(function collectionComplete(collectionError) {
          if (collectionError) return next(collectionError);

          request(sails.hooks.http.app)
            .get('/api/' + resource + '/count')
            .query({where: JSON.stringify({})})
            .set(headers)
            .expect(200)
            .end(function countComplete(countError, response) {
              if (countError) return next(countError);

              try {
                expect(response.body, resource + ' count response').to.have.property('count');
                expect(response.body.count).to.be.a('number');
                next();
              } catch (assertionError) {
                next(assertionError);
              }
            });
        });
    }, done);
  });

  it('rejects malformed count filters as a client error', function rejectMalformedWhere(done) {
    request(sails.hooks.http.app)
      .get('/api/user/count')
      .query({where: '{not-json'})
      .set('Authorization', 'bearer ' + adminToken)
      .expect(400, done);
  });
});
