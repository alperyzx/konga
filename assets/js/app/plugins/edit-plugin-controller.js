/**
 * Controller for the "edit plugin" modal.
 *
 * Mirrors AddPluginController: SchemaFormService normalizes Kong's schema into
 * a node tree, hydrate() fills it from the plugin's existing config, and
 * serialize() turns it back. The only real difference is the starting values.
 */
(function () {
  'use strict';

  angular.module('frontend.plugins')
    .controller('EditPluginController', [
      '_', '$scope', '$rootScope', '$log',
      'MessageService', 'SchemaFormService',
      'KongPluginsService', '$uibModalInstance', 'PluginsService', '_plugin', '_schema',
      function controller(_, $scope, $rootScope, $log,
                          MessageService, SchemaFormService,
                          KongPluginsService, $uibModalInstance, PluginsService, _plugin, _schema) {

        $scope.plugin = _plugin;
        $scope.context = 'update';

        var options = new KongPluginsService().pluginOptions(_plugin.name);

        $scope.close = close;

        // Resolved once — see the note in add-plugin-controller.js on why these
        // cannot be built inline inside a recursive ng-include.
        var cacheBust = '?r=' + Date.now();
        $scope.SCHEMA_FIELD_TPL = 'js/app/plugins/forms/schema-field.html' + cacheBust;
        $scope.SCHEMA_CONTROL_TPL = 'js/app/plugins/forms/schema-control.html' + cacheBust;

        $scope.humanizeLabel = function (key) {
          return key.split("_").join(" ");
        };

        $scope.schemaForm = {
          addEntry: function (node) {
            node.entries.push(SchemaFormService.newEntry(node));
          },
          addRow: function (node) {
            node.rows.push(SchemaFormService.newRow(node));
          },
          removeAt: SchemaFormService.removeAt
        };

        function initialize() {
          $scope.data = {
            consumer: {
              id: _.get($scope, 'plugin.consumer.id')
            }
          };

          $scope.description = options.fields && options.fields.meta
            ? options.fields.meta.description
            : 'Configure the Plugin.';

          $scope.nodes = SchemaFormService.normalize(_schema.data.fields, options);
          SchemaFormService.hydrate($scope.nodes, _plugin.config || {});
        }


        $scope.updatePlugin = function () {

          $scope.busy = true;

          var data = _.omit($scope.plugin, ['config']);

          const consumerId = _.get($scope, 'data.consumer.id');
          if (consumerId) {
            data.consumer = {
              id: consumerId
            };
          }

          data.config = SchemaFormService.serialize($scope.nodes);

          PluginsService.update(_plugin.id, data)
            .then(function (res) {
              $log.debug("updatePlugin", res);
              $scope.busy = false;
              $rootScope.$broadcast('plugin.updated', res.data);
              MessageService.success('"' + _plugin.name + '" plugin updated successfully!');
              $uibModalInstance.close({
                data: res.data
              });
            }).catch(function (err) {
            $scope.busy = false;
            $log.error("update plugin", err);
            var errors = {};

            if (err.data.customMessage) {
              Object.keys(err.data.customMessage).forEach(function (key) {
                errors[key.replace('config.', '')] = err.data.customMessage[key];
                MessageService.error(key + " : " + err.data.customMessage[key])
              })
            } else if (err.data.body && err.data.body.message) {
              MessageService.error(err.data.body.message)
            }

            $scope.errors = errors
          })
        };

        function close() {
          $uibModalInstance.dismiss()
        }

        initialize();
      }
    ])
  ;
}());
