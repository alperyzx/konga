
(function() {
    'use strict';

    angular.module('frontend.certificates', []);

    // Module configuration
    angular.module('frontend.certificates')
        .config([
            '$stateProvider',
            function config($stateProvider) {
                $stateProvider
                    .state('certificates', {
                        parent : 'frontend',
                        url: '/certificates',
                        data : {
                            activeNode : true,
                            pageName : "Certificates",
                            pageDescription : "A certificate object represents a public certificate/private key pair for an SSL certificate. These objects are used by Kong to handle SSL/TLS termination for encrypted requests. Certificates are optionally associated with SNI objects to tie a cert/key pair to one or more hostnames.",
                            //displayName : "certificates",
                            prefix : '<i class="material-icons text-primary">perm_identity</i>'
                        },
                        resolve: {
                          _gateway: [
                            'InfoService',
                            '$rootScope',
                            function (InfoService, $rootScope) {
                              return new Promise((resolve, reject) => {
                                var watcher = $rootScope.$watch('Gateway', function (newValue, oldValue) {
                                  if (newValue) {
                                    watcher(); // clear watcher
                                    resolve(newValue)
                                  }
                                })
                              })
                            }
                          ],
                        },
                        views: {
                            'content@': {
                                templateUrl: 'js/app/certificates/certificates.html',
                                controller: 'CertificatesController',
                                //resolve: {
                                //    _certificates : [
                                //        'PluginsService',
                                //        function(PluginsService) {
                                //            return PluginsService.load()
                                //        }
                                //    ]
                                //}
                            }
                        }
                    })
                    .state('ca-certificates', {
                        parent: 'frontend',
                        url: '/ca-certificates',
                        data: {
                            activeNode: true,
                            pageName: 'CA Certificates',
                            pageDescription: 'CA certificates used to verify upstream TLS certificates.',
                            prefix: '<i class="material-icons text-primary">perm_identity</i>'
                        },
                        resolve: {
                            _gateway: [
                                'InfoService',
                                '$rootScope',
                                function (InfoService, $rootScope) {
                                    return new Promise((resolve) => {
                                        var watcher = $rootScope.$watch('Gateway', function (newValue) {
                                            if (newValue) {
                                                watcher();
                                                resolve(newValue);
                                            }
                                        });
                                    });
                                }
                            ]
                        },
                        views: {
                            'content@': {
                                templateUrl: 'js/app/certificates/ca-certificates.html',
                                controller: 'CaCertificatesController'
                            }
                        }
                    })
                    .state('snis', {
                        parent: 'frontend',
                        url: '/snis',
                        data: {
                            activeNode: true,
                            pageName: 'SNIs',
                            pageDescription: 'Map TLS hostnames to Kong certificates.',
                            prefix: '<i class="material-icons text-primary">security</i>'
                        },
                        views: {
                            'content@': {
                                templateUrl: 'js/app/certificates/snis.html',
                                controller: 'SnisController'
                            }
                        }
                    })
            }
        ])
    ;
}());
