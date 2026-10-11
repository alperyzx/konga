(function() {
    'use strict';

    angular.module('frontend.certificates')
        .service('CaCertificateModel', [
            'DataModel',
            function(DataModel) {
                return new DataModel('kong/ca_certificates', true);
            }
        ]);
}());
