(function() {
  'use strict';

  function cleanEntity(data) {
    delete data.id;
    delete data.created_at;
    delete data.updated_at;
    return data;
  }

  angular.module('frontend.security')
    .controller('KeySetsController', ['$scope', '$uibModal', 'DialogService', 'MessageService', 'UserService', 'KeySetModel', 'ListConfig',
      function($scope, $uibModal, DialogService, MessageService, UserService, Model, ListConfig) {
        Model.setScope($scope, false, 'items', 'itemCount');
        $scope = angular.extend($scope, angular.copy(ListConfig.getConfig('key_set', Model)));
        $scope.user = UserService.user();
        function reload() {
          return Model.load({size: $scope.itemsFetchSize}).then(function(items) { $scope.items = items; });
        }
        $scope.add = function(item) {
          var modal = $uibModal.open({
            templateUrl: 'js/app/security/key-set-modal.html',
            controller: 'KeySetModalController',
            resolve: {item: function() { return item; }}
          });
          modal.result.then(reload);
        };
        $scope.remove = function(index, item) {
          DialogService.confirm('Confirm', 'Delete this key set?', ["No don't", 'Yes! delete it'], function() {
            Model.delete(item.id).then(function() {
              ($scope.items.data || $scope.items).splice(index, 1);
              MessageService.success('Key set deleted');
            });
          });
        };
      }])
    .controller('KeySetModalController', ['$scope', '$uibModalInstance', 'KeySetModel', 'MessageService', 'item',
      function($scope, $uibModalInstance, Model, MessageService, item) {
        $scope.data = angular.copy(item || {tags: []});
        $scope.close = function() { $uibModalInstance.dismiss(); };
        $scope.submit = function() {
          var identifier = $scope.data.id;
          var data = cleanEntity(angular.copy($scope.data));
          var request = identifier ? Model.update(identifier, data) : Model.create(data);
          request.then(function() {
            MessageService.success('Key set saved');
            $uibModalInstance.close();
          }, function() { $scope.error = 'Unable to save key set'; });
        };
      }])
    .controller('KeysController', ['$scope', '$uibModal', 'DialogService', 'MessageService', 'UserService', 'KeyModel', 'KeySetModel', 'ListConfig',
      function($scope, $uibModal, DialogService, MessageService, UserService, Model, KeySetModel, ListConfig) {
        Model.setScope($scope, false, 'items', 'itemCount');
        $scope = angular.extend($scope, angular.copy(ListConfig.getConfig('key', Model)));
        $scope.user = UserService.user();
        function reload() {
          return Model.load({size: $scope.itemsFetchSize}).then(function(items) { $scope.items = items; });
        }
        KeySetModel.load({size: 1000}).then(function(response) { $scope.keySets = response.data || response; });
        $scope.add = function(item) {
          var modal = $uibModal.open({
            templateUrl: 'js/app/security/key-modal.html',
            controller: 'KeyModalController',
            resolve: {
              item: function() { return item; },
              keySets: function() { return $scope.keySets; }
            }
          });
          modal.result.then(reload);
        };
        $scope.remove = function(index, item) {
          DialogService.confirm('Confirm', 'Delete this key?', ["No don't", 'Yes! delete it'], function() {
            Model.delete(item.id).then(function() {
              ($scope.items.data || $scope.items).splice(index, 1);
              MessageService.success('Key deleted');
            });
          });
        };
      }])
    .controller('KeyModalController', ['$scope', '$uibModalInstance', 'KeyModel', 'MessageService', 'item', 'keySets',
      function($scope, $uibModalInstance, Model, MessageService, item, keySets) {
        $scope.data = angular.copy(item || {tags: [], mode: 'jwk'});
        $scope.keySets = keySets;
        if (item) {
          $scope.data.mode = item.jwk ? 'jwk' : 'pem';
          if (item.jwk) {
            try { $scope.data.jwk = angular.toJson(angular.fromJson(item.jwk), 2); }
            catch (error) { $scope.data.jwk = item.jwk; }
          }
          if (item.set && item.set.id) $scope.data.set = item.set.id;
        }
        $scope.close = function() { $uibModalInstance.dismiss(); };
        $scope.submit = function() {
          var data = angular.copy($scope.data);
          var identifier = data.id;
          if (!data.kid) { $scope.error = 'Key ID (kid) is required'; return; }
          delete data.mode;
          if ($scope.data.mode === 'jwk' && data.jwk) {
            try { data.jwk = angular.toJson(angular.fromJson(data.jwk)); }
            catch (error) { $scope.error = 'JWK must be valid JSON'; return; }
            delete data.pem;
          } else if ($scope.data.mode === 'pem' && data.pem) {
            delete data.jwk;
          } else { $scope.error = 'Provide either JWK or PEM data'; return; }
          if (data.set && typeof data.set === 'string') data.set = {id: data.set};
          if (!data.set) delete data.set;
          cleanEntity(data);
          var request = identifier ? Model.update(identifier, data) : Model.create(data);
          request.then(function() {
            MessageService.success('Key saved');
            $uibModalInstance.close();
          }, function(err) { $scope.error = _.get(err, 'data.body.message', 'Unable to save key'); });
        };
      }])
    .controller('VaultsController', ['$scope', '$uibModal', 'DialogService', 'MessageService', 'UserService', 'VaultModel', 'ListConfig',
      function($scope, $uibModal, DialogService, MessageService, UserService, Model, ListConfig) {
        Model.setScope($scope, false, 'items', 'itemCount');
        $scope = angular.extend($scope, angular.copy(ListConfig.getConfig('vault', Model)));
        $scope.user = UserService.user();
        function reload() {
          return Model.load({size: $scope.itemsFetchSize}).then(function(items) { $scope.items = items; });
        }
        $scope.add = function(item) {
          var modal = $uibModal.open({
            templateUrl: 'js/app/security/vault-modal.html',
            controller: 'VaultModalController',
            resolve: {item: function() { return item; }}
          });
          modal.result.then(reload);
        };
        $scope.remove = function(index, item) {
          DialogService.confirm('Confirm', 'Delete this vault?', ["No don't", 'Yes! delete it'], function() {
            Model.delete(item.id || item.prefix).then(function() {
              ($scope.items.data || $scope.items).splice(index, 1);
              MessageService.success('Vault deleted');
            });
          });
        };
      }])
    .controller('VaultModalController', ['$scope', '$uibModalInstance', 'VaultModel', 'MessageService', 'item',
      function($scope, $uibModalInstance, Model, MessageService, item) {
        $scope.data = angular.copy(item || {tags: [], name: 'env', config: {}});
        $scope.data.config = $scope.data.config || {};
        $scope.configJson = angular.toJson($scope.data.config, 2);
        $scope.close = function() { $uibModalInstance.dismiss(); };
        $scope.submit = function() {
          if (!$scope.data.prefix || !$scope.data.name) { $scope.error = 'Prefix and name are required'; return; }
          var data = angular.copy($scope.data);
          var identifier = data.id || (item && item.prefix);
          if (data.name !== 'env') {
            try { data.config = angular.fromJson($scope.configJson || '{}'); }
            catch (error) { $scope.error = 'Backend Config must be valid JSON'; return; }
          }
          cleanEntity(data);
          var request = identifier ? Model.update(identifier, data) : Model.create(data);
          request.then(function() {
            MessageService.success('Vault saved');
            $uibModalInstance.close();
          }, function(err) { $scope.error = _.get(err, 'data.body.message', 'Unable to save vault'); });
        };
      }]);
}());
