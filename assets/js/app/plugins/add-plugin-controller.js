/**
 * Controller for the "add plugin" modal.
 *
 * The form itself is generic: SchemaFormService turns Kong's schema into an
 * ordered tree of nodes, forms/default.html renders it to whatever depth the
 * schema goes, and serialize() turns it back into a config object. This
 * controller only has to decide what the plugin is attached to.
 */
(function () {
  'use strict';

  angular.module('frontend.plugins')
    .controller('AddPluginController', [
      '_', '$scope', '$rootScope', '$log', '$state',
      'MessageService', 'PluginHelperService', 'SchemaFormService',
      'KongPluginsService', '$uibModalInstance', '_pluginName', '_schema', '_context',
      function controller(_, $scope, $rootScope, $log, $state,
                          MessageService, PluginHelperService, SchemaFormService,
                          KongPluginsService, $uibModalInstance, _pluginName, _schema, _context) {


        if(_.isArray(_context)) {
          _context.forEach(function (ctx) {
            $scope[ctx.name] = ctx.data;
          })
        }else if(_context){
          $scope[_context.name] = _context.data;
        }

        $scope.context = 'create';

        var options = new KongPluginsService().pluginOptions(_pluginName)
        if (_pluginName === 'pre-function' || _pluginName === 'post-function') {
          options.multilineArrayFields = {
            certificate: true,
            rewrite: true,
            access: true,
            header_filter: true,
            body_filter: true,
            log: true
          };
        }

        $scope.pluginName = _pluginName
        $scope.close = close

        // The recursive field templates include each other, so their URLs are
        // resolved once here rather than built inline. Konga busts the template
        // cache with `?r=` + a timestamp; an expression like that re-evaluated
        // inside a recursive ng-include would mint a new URL on every digest at
        // every level and never settle.
        var cacheBust = '?r=' + Date.now();
        $scope.SCHEMA_FIELD_TPL = 'js/app/plugins/forms/schema-field.html' + cacheBust;
        $scope.SCHEMA_CONTROL_TPL = 'js/app/plugins/forms/schema-control.html' + cacheBust;

        $scope.humanizeLabel = function (key) {
          return key.split("_").join(" ");
        }

        // Map and array-of-record editors add and remove rows from the node
        // tree. Child scopes inherit these, so they work at any depth.
        $scope.schemaForm = {
          addEntry: function (node) {
            node.entries.push(SchemaFormService.newEntry(node));
          },
          addRow: function (node) {
            node.rows.push(SchemaFormService.newRow(node));
          },
          addScript: function (node) {
            node.value.push('');
          },
          removeAt: SchemaFormService.removeAt
        };

        function initialize() {
          $scope.data = {consumer: {}};

          $scope.description = options.fields && options.fields.meta
            ? options.fields.meta.description
            : 'Configure the Plugin.'

          // Kong's legacy /plugins/schema/<name> returns the config fields
          // already unwrapped, as an ordered array of single-key objects.
          $scope.nodes = SchemaFormService.normalize(_schema.data.fields, options);
          SchemaFormService.applyDefaults($scope.nodes);
        }


        $scope.addPlugin = function (back) {

          $scope.busy = true;

          // Initialize request data
          var request_data = {
            name: _pluginName,
          }

          // Add api_id to request_data if defined
          if ($scope.api) {
            request_data.api = {
              id: $scope.api.id
            };
          }

          // Add service_id to request_data if defined
          if ($scope.service) {
            request_data.service = {
              id: $scope.service.id
            };
          }

          // Add route_id to request_data if defined
          if ($scope.route) {
            request_data.route = {
              id: $scope.route.id
            };
          }

          // If a consumer is defined, add consumer id to request data
          if ($scope.consumer) {
            request_data.consumer = {
              id: $scope.consumer.id
            };
          }

          // Overwrite consumer if explicitly set
          const explicitlySetConsumer = _.get($scope, 'data.consumer.id');
          if (explicitlySetConsumer) {
            request_data.consumer = {
              id: explicitlySetConsumer
            };
          }

          // serialize() already drops what the user left unset — and, unlike
          // the code this replaces, keeps `false` and `0`, which are values
          // rather than absences.
          var config = SchemaFormService.serialize($scope.nodes);
          if (!SchemaFormService.isUnset(config)) request_data.config = config;

          PluginHelperService.addPlugin(
            request_data,
            function success(res) {
              $scope.busy = false;
              $rootScope.$broadcast('plugin.added', res.data)
              MessageService.success('Plugin added successfully!')
              $uibModalInstance.dismiss(res.data)
              if (back) $state.go('plugins');// return to plugins page if specified
            }, function (err) {
              $scope.busy = false;
              $log.error("create plugin", err)

              $scope.errors = {};
              const errorBody = _.get(err, 'data.body');
              if (errorBody) {
                if (errorBody.fields) {

                  for (let key in errorBody.fields) {
                    $scope.errors[key] = errorBody.fields[key]
                  }
                }
                $scope.errorMessage = errorBody.message || '';
              } else {
                $scope.errorMessage = "An unknown error has occured"
              }

              MessageService.error($scope.errorMessage);


            }, function evt(event) {
              var progressPercentage = parseInt(100.0 * event.loaded / event.total);
              $log.debug('progress: ' + progressPercentage + '% ' + event.config.data.file.name);
            })
        }

        function close() {
          $uibModalInstance.dismiss()
        }


        initialize();
      }
    ]);
}());
