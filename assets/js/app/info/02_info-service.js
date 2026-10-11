/**
 * This file contains all necessary Angular controller definitions for 'frontend.admin.login-history' module.
 *
 * Note that this file should only contain controllers and nothing else.
 */
(function() {
  'use strict';

  angular.module('frontend.info')
    .service('InfoService', [
        '$log', '$state','$http',
      function( $log, $state, $http) {

          return {

              getInfo : function() {
                  console.log('InfoService:getInfo called');
                  return $http.get('kong')
              },
              nodeStatus : function(params) {
                  return $http.get('kong/status',{
                      params : params
                  })
              },

              getTags : function() {
                  return $http.get('kong/tags')
              },

              getLogLevel: function() { return $http.get('kong/debug/node/log-level'); },
              setLogLevel: function(level) { return $http.put('kong/debug/node/log-level', {level: level}); },
              getMetrics: function() { return $http.get('kong/metrics'); },

              clusterStatus : function() {
                  return $http.get('kong/cluster')
              },
          }
      }
    ])
  ;
}());
