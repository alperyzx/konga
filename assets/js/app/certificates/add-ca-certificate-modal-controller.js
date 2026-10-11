(function() {
    'use strict';

    angular.module('frontend.certificates')
        .controller('AddCaCertificateModalController', [
            '$scope', '$uibModalInstance', 'CaCertificateModel', 'MessageService',
            function($scope, $uibModalInstance, CaCertificateModel, MessageService) {
                $scope.data = {cert: '', tags: []};

                $scope.close = function() {
                    $uibModalInstance.dismiss();
                };

                $scope.onTagInputKeyPress = function($event) {
                    if ($event.keyCode === 13 && $event.currentTarget.value) {
                        $scope.data.tags.push($event.currentTarget.value);
                        $event.currentTarget.value = null;
                    }
                };

                $scope.submit = function() {
                    $scope.errorMessage = '';
                    if (!$scope.data.cert || !$scope.data.cert.trim()) {
                        $scope.errorMessage = 'The Certificate field cannot be empty';
                        return;
                    }

                    $scope.busy = true;
                    var data = angular.copy($scope.data);
                    data.cert = data.cert.trim();
                    CaCertificateModel.create(data).then(function(response) {
                        MessageService.success('CA certificate added successfully');
                        $uibModalInstance.dismiss({data: response});
                    }, function(err) {
                        $scope.busy = false;
                        $scope.errors = {};
                        var body = _.get(err, 'data.body', {});
                        $scope.errorMessage = body.message || 'Unable to create CA certificate';
                        angular.extend($scope.errors, body.fields || {});
                    });
                };
            }
        ]);
}());
