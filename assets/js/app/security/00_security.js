(function() {
  'use strict';
  angular.module('frontend.security', [])
    .config(['$stateProvider', function($stateProvider) {
      function state(name, url, page, template, controller) {
        return { parent: 'frontend', url: url, data: {activeNode: true, pageName: page,
          pageDescription: 'Manage Kong ' + page.toLowerCase() + '.', prefix: '<i class="material-icons text-primary">vpn_key</i>'},
          views: {'content@': {templateUrl: template, controller: controller}} };
      }
      $stateProvider.state('key-sets', state('key-sets', '/key-sets', 'Key Sets',
        'js/app/security/key-sets.html', 'KeySetsController'))
        .state('keys', state('keys', '/keys', 'Keys', 'js/app/security/keys.html', 'KeysController'))
        .state('vaults', state('vaults', '/vaults', 'Vaults', 'js/app/security/vaults.html', 'VaultsController'));
    }]);
}());
