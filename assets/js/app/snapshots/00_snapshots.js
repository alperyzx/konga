
(function() {
    'use strict';

    angular.module('frontend.snapshots', [
    ]);

    // Module configuration
    angular.module('frontend.snapshots')
        .config([
            '$stateProvider',
            function config($stateProvider) {
                $stateProvider
                    .state('snapshots', {
                        url: '/snapshots',
                        parent : 'frontend',
                        data : {
                            access : 2,
                            pageName : "Snapshots",
                            pageDescription : "Back up and restore the complete Kong configuration exposed by the active node's Admin API." +
                            "<br>Konga accounts/settings, runtime metrics/logs, database internals, and external vault secret values are not included.",
                            prefix : '<i class="mdi mdi-camera"></i>'
                        },
                        views: {
                            'content@': {
                                templateUrl: 'js/app/snapshots/index.html',
                                controller: 'SnapshotsController'
                            },
                            'list@snapshots': {
                                templateUrl: 'js/app/snapshots/views/snapshots-list.html',
                                controller: 'SnapshotsListController',
                            },
                            'scheduled@snapshots': {
                                templateUrl: 'js/app/snapshots/views/snapshots-scheduled.html',
                                controller: 'SnapshotsScheduledController',
                            },

                        }
                    })
                    .state('snapshots.show', {
                        url: '/:id',
                        parent : 'snapshots',
                        data : {
                            access :  2,
                            pageName : "Snapshot Details",
                            displayName : "snapshot details",
                            pageDescription : null,
                            prefix : '<i class="mdi mdi-36px mdi-camera"></i>'
                        },
                        views: {
                            'content@': {
                                templateUrl: 'js/app/snapshots/views/snapshot.html',
                                controller: 'SnapshotController'
                            },
                        }
                    });
            }
        ])
    ;
}());
