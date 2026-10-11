(function() {
    'use strict';

    angular.module('frontend.certificates')
        .controller('CaCertificatesController', [
            '$scope', '$rootScope', '$uibModal', 'DialogService', 'UserService',
            'MessageService', 'CaCertificateModel', 'ListConfig', '$timeout',
            function($scope, $rootScope, $uibModal, DialogService, UserService,
                     MessageService, CaCertificateModel, ListConfig, $timeout) {

                CaCertificateModel.setScope($scope, false, 'items', 'itemCount');
                $scope = angular.extend($scope, angular.copy(
                    ListConfig.getConfig('ca_certificate', CaCertificateModel)
                ));
                $scope.user = UserService.user();

                function fetchData() {
                    $scope.loading = true;
                    CaCertificateModel.load({size: $scope.itemsFetchSize}).then(function(response) {
                        $scope.items = response;
                        $scope.loading = false;
                    });
                }

                $scope.openAddCaCertificateModal = function() {
                    var modal = $uibModal.open({
                        animation: true,
                        ariaLabelledBy: 'modal-title',
                        ariaDescribedBy: 'modal-body',
                        templateUrl: 'js/app/certificates/add-ca-certificate-modal.html',
                        controller: 'AddCaCertificateModalController'
                    });

                    modal.result.then(function() {}, function(data) {
                        if (data && data.data) fetchData();
                    });
                };

                $scope.deleteItem = function(index, item) {
                    DialogService.confirm(
                        'Confirm', 'Really want to delete the selected CA certificate?',
                        ["No don't", 'Yes! delete it'],
                        function accept() {
                            CaCertificateModel.delete(item.id).then(function() {
                                var context = $scope.items.data || $scope.items;
                                context.splice(context.indexOf(item), 1);
                                MessageService.success('CA certificate deleted successfully');
                            });
                        }
                    );
                };

                fetchData();

                $scope.$on('user.node.updated', function() {
                    $timeout(fetchData);
                });
            }
        ]);
}());
