(function() {
  'use strict';
  angular.module('frontend.security')
    .service('KeySetModel', ['DataModel', function(DataModel) { return new DataModel('kong/key-sets', true); }])
    .service('KeyModel', ['DataModel', function(DataModel) { return new DataModel('kong/keys', true); }])
    .service('VaultModel', ['DataModel', function(DataModel) { return new DataModel('kong/vaults', true); }]);
}());
