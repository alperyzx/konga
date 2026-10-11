/**
 * This file contains all necessary Angular controller definitions for 'frontend.admin.login-history' module.
 *
 * Note that this file should only contain controllers and nothing else.
 */
(function() {
  'use strict';

  angular.module('frontend.info')
    .controller('InfoController', [
      '$scope', '$log', '$state','InfoService',
      function controller($scope, $log, $state,InfoService) {

          function _getInfo() {
             InfoService.getInfo()
                 .then(function(response){
                     $scope.info = response.data
                 })
          }

          _getInfo()

          $scope.$on('user.node.updated',function(node){
              _getInfo()
          })
      }
    ])
    .controller('TagsController', [
      '$scope', '$log', 'InfoService',
      function controller($scope, $log, InfoService) {
        $scope.loading = true;
        $scope.filters = {searchWord: ''};

        InfoService.getTags().then(function(response) {
          $scope.tags = response.data.data || [];
          $scope.loading = false;
        }, function(error) {
          $log.error('TagsController: failed to load tags', error);
          $scope.tags = [];
          $scope.loading = false;
          $scope.error = 'Unable to load Kong tags.';
        });
      }
    ])
  ;
}());
