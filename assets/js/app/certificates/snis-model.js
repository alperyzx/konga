(function() {
    'use strict';

    /**
     * Model for Author API, this is used to wrap all Author objects specified actions and data change actions.
     */
    angular.module('frontend.certificates')
        .service('SnisModel', [
            'DataModel', '$http',
            function(DataModel, $http) {

                var model = new DataModel('kong/snis',true);
                model.patch = function(identifier, data) {
                    return $http.patch('kong/snis/' + identifier, data);
                };


                model.handleError = function($scope,err) {
                    $scope.errors = {}
                    if(err.data && err.data.body){

                        Object.keys(err.data.body).forEach(function(key){
                            $scope.errors[key] = err.data.body[key];
                        });
                    }
                }

                return model;
            }
        ])
    ;
}());
