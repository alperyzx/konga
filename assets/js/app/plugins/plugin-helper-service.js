/**
 * Helper for submitting a plugin.
 *
 * This used to also shape the schema into something the form could render and
 * flatten it back out on submit. SchemaFormService does both of those now, for
 * any depth and any type, so all that is left here is the POST itself.
 */
(function() {
    'use strict';

    angular.module('frontend.plugins')
        .service('PluginHelperService', [
            '_','$log','BackendConfig','Upload','PluginsService',
            function( _,$log,BackendConfig,Upload,PluginsService) {

                var handlers  = {
                    common : function(data,success,error) {

                        PluginsService.add(data)
                            .then(function(resp){
                                success(resp);
                            }).catch(function(err){
                            error(err);
                        });
                    },
                    // Kong 3.x has no `ssl` plugin — `GET /plugins/schema/ssl`
                    // answers "No plugin named 'ssl'" — so this path is
                    // unreachable on a modern gateway. Left in place because
                    // dropping the plugin from Konga's catalogue is a separate
                    // call from fixing the renderer.
                    ssl : function(data, success,error,event) {
                        var files = [];

                        files.push(data['config.cert'])
                        files.push(data['config.key'])

                        Upload.upload({
                            url: 'kong/plugins',
                            arrayKey: '',
                            data: {
                                file: files,
                                'name' : data.name,
                                'config.only_https': data['config.only_https'],
                                'config.accept_http_if_already_terminated': data['config.accept_http_if_already_terminated']
                            }
                        }).then(function (resp) {
                            success(resp)
                        }, function (err) {
                            error(err)
                        }, function (evt) {
                            event(evt)
                        });
                    }
                }

                return {
                    addPlugin : function(data, success,error,event) {

                        if(handlers[data.name]) {
                            return handlers[data.name](data, success,error,event);
                        }else{
                            return handlers['common'](data, success,error,event);
                        }
                    }
                };
            }
        ])
    ;
}());
