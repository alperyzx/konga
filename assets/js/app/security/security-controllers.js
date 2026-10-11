(function() {
  'use strict';
  angular.module('frontend.security')
    .controller('KeySetsController', ['$scope','$uibModal','DialogService','MessageService','UserService','KeySetModel','ListConfig',
      function($scope,$uibModal,DialogService,MessageService,UserService,Model,ListConfig) {
        Model.setScope($scope,false,'items','itemCount'); $scope=angular.extend($scope,angular.copy(ListConfig.getConfig('key_set',Model))); $scope.user=UserService.user();
        $scope.add=function(item){ var m=$uibModal.open({templateUrl:'js/app/security/key-set-modal.html',controller:'KeySetModalController',resolve:{item:function(){return item;}}}); m.result.then(function(){Model.load({size:$scope.itemsFetchSize});}); };
        $scope.remove=function(i,item){DialogService.confirm('Confirm','Delete this key set?',["No don't",'Yes! delete it'],function(){Model.delete(item.id).then(function(){($scope.items.data||$scope.items).splice(i,1);MessageService.success('Key set deleted');});});};
      }])
    .controller('KeySetModalController',['$scope','$uibModalInstance','KeySetModel','MessageService','item',function($scope,$uibModalInstance,Model,MessageService,item){
      $scope.data=angular.copy(item||{tags:[]}); $scope.close=function(){$uibModalInstance.dismiss();}; $scope.submit=function(){if(!$scope.data.name&&$scope.data.name!==undefined){$scope.error='Name is required';return;} Model.create($scope.data).then(function(){MessageService.success('Key set saved');$uibModalInstance.close();},function(e){$scope.error='Unable to save key set';});};
    }])
    .controller('KeysController',['$scope','$uibModal','DialogService','MessageService','UserService','KeyModel','KeySetModel','ListConfig',function($scope,$uibModal,DialogService,MessageService,UserService,Model,KeySetModel,ListConfig){
      Model.setScope($scope,false,'items','itemCount'); $scope=angular.extend($scope,angular.copy(ListConfig.getConfig('key',Model))); $scope.user=UserService.user(); KeySetModel.load({size:1000}).then(function(r){$scope.keySets=r.data||r;});
      $scope.add=function(item){var m=$uibModal.open({templateUrl:'js/app/security/key-modal.html',controller:'KeyModalController',resolve:{item:function(){return item;},keySets:function(){return $scope.keySets;}}});m.result.then(function(){Model.load({size:$scope.itemsFetchSize});});};
      $scope.remove=function(i,item){DialogService.confirm('Confirm','Delete this key?',["No don't",'Yes! delete it'],function(){Model.delete(item.id).then(function(){($scope.items.data||$scope.items).splice(i,1);MessageService.success('Key deleted');});});};
    }])
    .controller('KeyModalController',['$scope','$uibModalInstance','KeyModel','MessageService','item','keySets',function($scope,$uibModalInstance,Model,MessageService,item,keySets){
      $scope.data=angular.copy(item||{tags:[],mode:'jwk'});$scope.keySets=keySets;$scope.close=function(){$uibModalInstance.dismiss();};$scope.submit=function(){var d=angular.copy($scope.data);if(!d.kid){$scope.error='Key ID (kid) is required';return;}delete d.mode;if(d.jwk){try{d.jwk=angular.fromJson(d.jwk);}catch(e){$scope.error='JWK must be valid JSON';return;}delete d.pem;}else if(d.pem){delete d.jwk;}else{$scope.error='Provide either JWK or PEM data';return;}Model.create(d).then(function(){MessageService.success('Key saved');$uibModalInstance.close();},function(){$scope.error='Unable to save key';});};
    }])
    .controller('VaultsController',['$scope','$uibModal','DialogService','MessageService','UserService','VaultModel','ListConfig',function($scope,$uibModal,DialogService,MessageService,UserService,Model,ListConfig){
      Model.setScope($scope,false,'items','itemCount');$scope=angular.extend($scope,angular.copy(ListConfig.getConfig('vault',Model)));$scope.user=UserService.user();$scope.add=function(item){var m=$uibModal.open({templateUrl:'js/app/security/vault-modal.html',controller:'VaultModalController',resolve:{item:function(){return item;}}});m.result.then(function(){Model.load({size:$scope.itemsFetchSize});});};$scope.remove=function(i,item){DialogService.confirm('Confirm','Delete this vault?',["No don't",'Yes! delete it'],function(){Model.delete(item.id).then(function(){($scope.items.data||$scope.items).splice(i,1);MessageService.success('Vault deleted');});});};
    }])
    .controller('VaultModalController',['$scope','$uibModalInstance','VaultModel','MessageService','item',function($scope,$uibModalInstance,Model,MessageService,item){$scope.data=angular.copy(item||{tags:[]});$scope.close=function(){$uibModalInstance.dismiss();};$scope.submit=function(){if(!$scope.data.prefix||!$scope.data.name){$scope.error='Prefix and name are required';return;}Model.create($scope.data).then(function(){MessageService.success('Vault saved');$uibModalInstance.close();},function(){$scope.error='Unable to save vault';});};}]);
}());
