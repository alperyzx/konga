/**
 * This file contains all necessary Angular controller definitions for 'frontend.login-history' module.
 *
 * Note that this file should only contain controllers and nothing else.
 */
(function () {
  'use strict';

  angular.module('frontend.routes')
    .controller('RouteDetailsController', [
      '_', '$scope', '$rootScope', '$log', '$state', 'RoutesService', 'RouteChips', 'MessageService', 'SettingsService', '_route',
      function controller(_, $scope, $rootScope, $log, $state, RoutesService, RouteChips, MessageService, SettingsService, _route) {

        var availableFormattedVersion = RoutesService.getLastAvailableFormattedVersion($rootScope.Gateway.version);
        $scope.route = $scope.route || _route;

        // Kong stores headers as a map and sources/destinations as records; the
        // form edits all three as chips.
        $scope.route = RouteChips.toChips($scope.route);

        $scope.settings = SettingsService.getSettings();
        $scope.partial = 'js/app/routes/partials/form-route-' + availableFormattedVersion + '.html?r=' + Date.now();

        $scope.onTagInputKeyPress = function ($event) {
          if($event.keyCode === 13) {
            if(!$scope.route.tags) $scope.route.tags = [];
            $scope.route.tags = $scope.route.tags.concat($event.currentTarget.value);
            $event.currentTarget.value = null;
          }
        }

        $scope.submit = function () {

          $scope.loading = true

          let data = _.cloneDeep($scope.route);

          if(!data.hosts || !data.hosts.length) data.hosts = null;
          if(!data.paths || !data.paths.length) data.paths = null;
          if(!data.headers || !data.headers.length) data.headers = null;
          if(!data.methods || !data.methods.length) data.methods = null;
          if(!data.protocols || !data.protocols.length) data.protocols = null;
          if(!data.snis || !data.snis.length) data.snis = null;
          if(!data.sources || !data.sources.length) data.sources = null;
          if(!data.destinations || !data.destinations.length) data.destinations = null;

          const formatted = RouteChips.toKong(data);
          if (!_.isEmpty(formatted.errors)) {
            $scope.errors = formatted.errors;
            $scope.loading = false;
            MessageService.error(_.values(formatted.errors).join(' '));
            return;
          }
          data = formatted.data;


          RoutesService.update($scope.route.id, _.omit(data,["id", "data"]))
            .then(function (res) {
              $log.debug("Update Route: ", res)
              $scope.loading = false
              MessageService.success('Route updated successfully!')
            }).catch(function (err) {
            console.log("err", err)
            $scope.loading = false
            var errors = {}
            Object.keys(err.data.body).forEach(function (key) {
              MessageService.error(key + " : " + err.data.body[key])
            })
            $scope.errors = errors
          })

        }

      }
    ])
  ;
}());
