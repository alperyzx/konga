(function() {
  'use strict';

  angular.module('frontend.certificates')
    .controller('SnisController', [
      '$scope', '$uibModal', 'SnisModel', 'CertificateModel', 'DialogService', 'MessageService', 'UserService', 'ListConfig',
      function($scope, $uibModal, SnisModel, CertificateModel, DialogService, MessageService, UserService, ListConfig) {
        SnisModel.setScope($scope, false, 'items', 'itemCount');
        $scope = angular.extend($scope, angular.copy(ListConfig.getConfig('sni', SnisModel)));
        $scope.user = UserService.user();
        $scope.certificates = [];

        function load() {
          return SnisModel.load({size: $scope.itemsFetchSize}).then(function(items) {
            $scope.items = items;
          });
        }
        CertificateModel.load({size: 1000}).then(function(response) {
          $scope.certificates = response.data || response;
        });

        $scope.open = function(item) {
          var modal = $uibModal.open({
            templateUrl: 'js/app/certificates/sni-modal.html',
            controller: 'SniModalController',
            resolve: {
              item: function() { return item; },
              certificates: function() { return $scope.certificates; }
            }
          });
          modal.result.then(load);
        };

        $scope.remove = function(index, item) {
          DialogService.confirm('Confirm', 'Delete this SNI?', ["No don't", 'Yes! delete it'], function() {
            SnisModel.delete(item.id || item.name).then(function() {
              ($scope.items.data || $scope.items).splice(index, 1);
              MessageService.success('SNI deleted');
            });
          });
        };

        load();
      }
    ])
    .controller('SniModalController', [
      '$scope', '$uibModalInstance', 'SnisModel', 'MessageService', 'item', 'certificates',
      function($scope, $uibModalInstance, SnisModel, MessageService, item, certificates) {
        $scope.data = angular.copy(item || {tags: []});
        $scope.certificates = certificates;
        $scope.data.certificate_id = _.get($scope.data, 'certificate.id');
        $scope.close = function() { $uibModalInstance.dismiss(); };
        $scope.submit = function() {
          if (!$scope.data.name || !$scope.data.certificate_id) {
            $scope.error = 'Name and Certificate are required';
            return;
          }
          var payload = angular.copy($scope.data);
          var identifier = payload.id || (item && item.name);
          payload.certificate = {id: payload.certificate_id};
          delete payload.certificate_id;
          delete payload.id;
          var request = identifier ? SnisModel.patch(identifier, payload) : SnisModel.create(payload);
          request.then(function() {
            MessageService.success('SNI saved');
            $uibModalInstance.close();
          }, function(err) {
            $scope.error = _.get(err, 'data.body.message', 'Unable to save SNI');
          });
        };
      }
    ]);
}());
