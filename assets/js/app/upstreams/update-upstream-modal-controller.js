/**
 * This file contains all necessary Angular controller definitions for 'frontend.login-history' module.
 *
 * Note that this file should only contain controllers and nothing else.
 */
(function() {
  'use strict';

  angular.module('frontend.upstreams')
    .controller('UpdateUpstreamModalController', [
      '$scope', '$rootScope','$log', '$state','SettingsService',
        '$uibModalInstance','Upstream','MessageService','_item',
      function controller($scope,$rootScope, $log, $state, SettingsService,
                          $uibModalInstance, Upstream, MessageService,_item ) {

          $scope.upstream = _item
          $scope.activeHealthHeaders = []
          angular.forEach(_.get($scope.upstream, 'healthchecks.active.headers', {}), function (values, name) {
            $scope.activeHealthHeaders.push({name: name, values: values})
          })
          $scope.addActiveHealthHeader = function () { $scope.activeHealthHeaders.push({name: '', values: []}) }
          $scope.removeActiveHealthHeader = function (index) { $scope.activeHealthHeaders.splice(index, 1) }


          $scope.close = function() {
              $uibModalInstance.dismiss()
          }

          $scope.submit = function() {

              $scope.busy = true
              var data = angular.copy($scope.upstream)
              var headers = {}
              $scope.activeHealthHeaders.forEach(function (row) {
                if (row.name) headers[row.name] = row.values || []
              })
              _.set(data, 'healthchecks.active.headers', Object.keys(headers).length ? headers : null)
              Upstream.update($scope.upstream.id,data)
                  .then(
                      function onSuccess(result) {
                          $log.debug("UpdateUpstreamModalController:created upstream",result)
                          MessageService.success('Upstream updated successfully');
                          $scope.busy = false;
                          $rootScope.$broadcast('kong.upstream.updated',result.data)
                          $uibModalInstance.dismiss()
                      },function(err){
                          $log.error("UpdateUpstreamModalController:update upstream error",err)
                          $scope.busy = false
                          Upstream.handleError($scope,err)
                      }
                  )
          }
      }
    ])
  ;
}());
