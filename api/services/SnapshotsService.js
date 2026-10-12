'use strict';

var cron = require('node-cron');
var _ = require('lodash');
var semver = require('semver');
var KongService = require('./KongService');
var async = require('async');
var Utils = require('../lib/utils');

const BACKUP_VERSION = 2;

const ENTITY_DEFINITIONS = [
  {key: 'services', endpoint: '/services', required: true, order: 40},
  {key: 'routes', endpoint: '/routes', required: true, order: 60},
  {key: 'consumers', endpoint: '/consumers', required: true, order: 40},
  {key: 'plugins', endpoint: '/plugins', required: true, order: 90},
  {key: 'upstreams', endpoint: '/upstreams', required: true, order: 30},
  {key: 'certificates', endpoint: '/certificates', required: true, order: 10},
  {key: 'snis', endpoint: '/snis', required: true, order: 80},
  {key: 'ca_certificates', endpoint: '/ca_certificates', order: 10},
  {key: 'key_sets', endpoint: '/key-sets', order: 20},
  {key: 'keys', endpoint: '/keys', order: 50},
  {key: 'vaults', endpoint: '/vaults', order: 20},
  {key: 'consumer_groups', endpoint: '/consumer_groups', order: 40},
  {key: 'degraphql_routes', endpoint: '/degraphql_routes', order: 70},
  {key: 'key_auth_credentials', endpoint: '/key-auths', consumerEndpoint: 'key-auth', order: 70},
  {key: 'hmac_auth_credentials', endpoint: '/hmac-auths', consumerEndpoint: 'hmac-auth', order: 70},
  {key: 'jwt_credentials', endpoint: '/jwts', consumerEndpoint: 'jwt', order: 70},
  {key: 'oauth2_credentials', endpoint: '/oauth2', consumerEndpoint: 'oauth2', order: 70},
  {key: 'acl_credentials', endpoint: '/acls', consumerEndpoint: 'acls', order: 70},
  {key: 'mtls_auth_credentials', endpoint: '/mtls-auth-credentials', consumerEndpoint: 'mtls-auth', order: 70},
  {key: 'oauth2_tokens', endpoint: '/oauth2_tokens', order: 100},
  {key: 'oauth2_authorization_codes', endpoint: '/oauth2_authorization_codes', order: 100}
];

const EXCLUDED_ENTITIES = [
  'basic_auth_credentials_one_way_password_hashes',
  'oauth2_credentials_with_one_way_hashed_client_secrets',
  'konga_users_connections_and_settings',
  'kong_runtime_metrics_logs_and_health_state',
  'kong_database_internal_state',
  'external_vault_secret_values',
  'enterprise_entities_unavailable_on_the_source_node'
];

const NON_RESTORABLE_ENTITIES = ['basic_auth_credentials'];

const SENSITIVE_ENTITY_KEYS = [
  'certificates',
  'snis',
  'keys',
  'key_auth_credentials',
  'hmac_auth_credentials',
  'jwt_credentials',
  'oauth2_credentials',
  'oauth2_tokens',
  'oauth2_authorization_codes'
];

function errorStatus(error) {
  return error && (error.statusCode || error.status || _.get(error, 'response.statusCode'));
}

async function fetchCollection(definition, req) {
  try {
    const response = await KongService.fetch(definition.endpoint, req);
    return {available: true, data: _.get(response, 'data', [])};
  } catch (error) {
    if (!definition.required && [400, 404, 405].indexOf(errorStatus(error)) > -1) {
      return {available: false, data: []};
    }
    throw error;
  }
}

function snapshotRecord(snapshotName, node, nodeInfo, data, included, unavailable, includeSensitiveData) {
  const excluded = EXCLUDED_ENTITIES.slice();
  if (!includeSensitiveData) {
    excluded.push('sensitive_credentials_oauth_state_certificates_and_private_keys_not_requested');
  }
  return {
    name: snapshotName || 'snap@' + Date.now(),
    kong_node_name: node.name,
    kong_node_url: Utils.withoutTrailingSlash(node.kong_admin_url),
    kong_version: nodeInfo.version || node.kong_version,
    backup_version: BACKUP_VERSION,
    includes_sensitive_data: includeSensitiveData,
    included_entities: included,
    unavailable_entities: unavailable,
    excluded_entities: excluded,
    data: data
  };
}

const LEGACY_CREDENTIAL_MAP = {
  'key-auths': 'key_auth_credentials',
  'key-auth': 'key_auth_credentials',
  'hmac-auths': 'hmac_auth_credentials',
  'hmac-auth': 'hmac_auth_credentials',
  'jwts': 'jwt_credentials',
  'jwt': 'jwt_credentials',
  'oauth2': 'oauth2_credentials',
  'acls': 'acl_credentials'
};

function normalizeSnapshotData(snapshot) {
  const data = _.cloneDeep(snapshot.data || {});

  if (data.acls && !data.acl_credentials) {
    data.acl_credentials = data.acls;
    delete data.acls;
  }

  if (!data.targets) data.targets = [];
  (data.upstreams || []).forEach(function (upstream) {
    (upstream.targets || []).forEach(function (target) {
      data.targets.push(_.assign({}, target, {
        upstream: target.upstream || {id: upstream.id}
      }));
    });
    delete upstream.targets;
  });

  (data.consumers || []).forEach(function (consumer) {
    Object.keys(consumer.credentials || {}).forEach(function (legacyKey) {
      const key = LEGACY_CREDENTIAL_MAP[legacyKey] || legacyKey;
      if (!data[key]) data[key] = [];
      consumer.credentials[legacyKey].forEach(function (credential) {
        data[key].push(_.assign({}, credential, {
          consumer: credential.consumer || {id: consumer.id}
        }));
      });
    });
    delete consumer.credentials;
  });

  return data;
}

function responseBucket(responseData, key) {
  if (!responseData[key]) {
    responseData[key] = {
      imported: 0,
      skipped: 0,
      failed: {count: 0, items: []}
    };
  }
  return responseData[key];
}

function errorMessage(error) {
  const body = _.get(error, 'body');
  if (body && (body.fields || body.name || body.code)) return JSON.stringify(body);
  return _.get(body, 'message') || _.get(error, 'message') || _.get(error, 'raw_body') || JSON.stringify(error);
}

function recordRestoreError(responseData, key, error) {
  const bucket = responseBucket(responseData, key);
  const message = errorMessage(error);
  bucket.failed.count++;
  if (bucket.failed.items.indexOf(message) < 0) bucket.failed.items.push(message);
}

function cleanEntity(item) {
  return _.omit(item, ['id', 'created_at', 'updated_at', 'cache_key', 'extras', 'ttl']);
}

function entityDefinition(key) {
  return _.find(ENTITY_DEFINITIONS, {key: key});
}

async function restoreGeneric(key, items, connection, responseData) {
  const definition = entityDefinition(key);
  if (!definition) return;
  const bucket = responseBucket(responseData, key);

  for (const item of items) {
    try {
      const identifier = item.id || item.name || item.prefix;
      const payload = cleanEntity(item);
      // Certificates can embed an informational `snis` array in Admin API
      // responses. SNIs are restored from their own collection later.
      if (key === 'certificates') delete payload.snis;
      if (identifier) {
        await KongService.put(`${definition.endpoint}/${encodeURIComponent(identifier)}`, connection, payload);
      } else {
        await KongService.post(definition.endpoint, connection, payload);
      }
      bucket.imported++;
    } catch (error) {
      recordRestoreError(responseData, key, error);
    }
  }
}

async function restoreConsumerCredentials(key, items, connection, responseData) {
  const definition = entityDefinition(key);
  const bucket = responseBucket(responseData, key);
  let existingById = {};

  try {
    const current = await KongService.fetch(definition.endpoint, {connection: connection});
    existingById = _.keyBy(_.get(current, 'data', []), 'id');
  } catch (error) {
    recordRestoreError(responseData, key, error);
    return;
  }

  for (const item of items) {
    if (key === 'oauth2_credentials' && item.hash_secret === true) {
      bucket.skipped++;
      continue;
    }
    const consumerId = _.get(item, 'consumer.id') || item.consumer_id;
    if (!consumerId) {
      recordRestoreError(responseData, key, new Error('Credential has no consumer reference'));
      continue;
    }

    try {
      const endpoint = `/consumers/${encodeURIComponent(consumerId)}/${definition.consumerEndpoint}`;
      const payload = _.omit(cleanEntity(item), ['consumer', 'consumer_id']);
      if (item.id && existingById[item.id]) {
        await KongService.patch(`${definition.endpoint}/${encodeURIComponent(item.id)}`, connection, payload);
      } else {
        const created = await KongService.post(endpoint, connection,
          item.id ? _.assign({id: item.id}, payload) : payload);
        if (created && created.id) existingById[created.id] = created;
      }
      bucket.imported++;
    } catch (error) {
      recordRestoreError(responseData, key, error);
    }
  }
}

async function restoreTargets(targets, connection, responseData) {
  const bucket = responseBucket(responseData, 'targets');
  const cache = {};

  for (const target of targets) {
    const upstreamId = _.get(target, 'upstream.id') || target.upstream_id;
    if (!upstreamId) {
      recordRestoreError(responseData, 'targets', new Error('Target has no upstream reference'));
      continue;
    }

    try {
      if (!cache[upstreamId]) {
        const req = {connection: connection};
        const current = await KongService.fetch(`/upstreams/${upstreamId}/targets`, req);
        cache[upstreamId] = _.get(current, 'data', []);
      }
      const existing = _.find(cache[upstreamId], {target: target.target});
      const payload = _.pick(target, ['target', 'weight', 'tags']);

      if (existing) {
        if (existing.weight === target.weight && _.isEqual(existing.tags || null, target.tags || null)) {
          bucket.skipped++;
        } else {
          await KongService.patch(`/upstreams/${upstreamId}/targets/${existing.id}`, connection,
            _.pick(payload, ['weight', 'tags']));
          bucket.imported++;
        }
      } else {
        const created = await KongService.post(`/upstreams/${upstreamId}/targets`, connection, payload);
        cache[upstreamId].push(created);
        bucket.imported++;
      }
    } catch (error) {
      recordRestoreError(responseData, 'targets', error);
    }
  }
}

async function restoreConsumerGroupMemberships(memberships, connection, responseData) {
  const key = 'consumer_group_consumers';
  const bucket = responseBucket(responseData, key);
  const cache = {};

  for (const membership of memberships) {
    const groupId = _.get(membership, 'consumer_group.id') || membership.consumer_group_id;
    const consumerId = _.get(membership, 'consumer.id') || membership.consumer_id;
    if (!groupId || !consumerId) {
      recordRestoreError(responseData, key, new Error('Consumer-group membership is incomplete'));
      continue;
    }
    try {
      if (!cache[groupId]) {
        const current = await KongService.fetch(`/consumer_groups/${groupId}/consumers`, {connection: connection});
        cache[groupId] = _.get(current, 'data', []);
      }
      const exists = cache[groupId].some(function (item) {
        return (_.get(item, 'consumer.id') || item.consumer_id || item.id) === consumerId;
      });
      if (exists) {
        bucket.skipped++;
      } else {
        const created = await KongService.post(`/consumer_groups/${groupId}/consumers`, connection, {consumer: consumerId});
        cache[groupId].push(created);
        bucket.imported++;
      }
    } catch (error) {
      recordRestoreError(responseData, key, error);
    }
  }
}

module.exports = {

  BACKUP_VERSION: BACKUP_VERSION,
  ENTITY_DEFINITIONS: ENTITY_DEFINITIONS,
  EXCLUDED_ENTITIES: EXCLUDED_ENTITIES,
  NON_RESTORABLE_ENTITIES: NON_RESTORABLE_ENTITIES,
  SENSITIVE_ENTITY_KEYS: SENSITIVE_ENTITY_KEYS,

  snapshot: async(snapshotName, node, options) => {
    const includeSensitiveData = _.get(options, 'includeSensitiveData') === true;
    const req = {
      connection: node
    }

    const nodeInfo = await KongService.info(node);
    const data = {};
    const included = [];
    const unavailable = [];

    for (const definition of ENTITY_DEFINITIONS) {
      if (!includeSensitiveData && SENSITIVE_ENTITY_KEYS.indexOf(definition.key) > -1) continue;
      const result = await fetchCollection(definition, req);
      if (result.available) {
        data[definition.key] = result.data;
        included.push(definition.key);
      } else {
        unavailable.push(definition.key);
      }
    }

    // Kong returns only a PBKDF2 hash for OAuth2 credentials created with
    // hash_secret=true. Posting that value hashes it again, just like Basic Auth.
    if (data.oauth2_credentials) {
      data.oauth2_credentials = data.oauth2_credentials.filter(function (credential) {
        return credential.hash_secret !== true;
      });
    }

    data.targets = [];
    for (const upstream of data.upstreams || []) {
      const response = await KongService.fetch(`/upstreams/${upstream.id}/targets`, req);
      for (const target of _.get(response, 'data', [])) {
        data.targets.push(_.assign({}, target, {
          upstream: target.upstream || {id: upstream.id}
        }));
      }
    }
    included.push('targets');

    if (data.consumer_groups) {
      data.consumer_group_consumers = [];
      let membershipsAvailable = true;
      for (const group of data.consumer_groups) {
        const result = await fetchCollection({
          endpoint: `/consumer_groups/${group.id}/consumers`
        }, req);
        if (!result.available) {
          membershipsAvailable = false;
          break;
        }
        result.data.forEach(function (membership) {
          data.consumer_group_consumers.push(_.assign({}, membership, {
            consumer_group: membership.consumer_group || {id: group.id}
          }));
        });
      }
      if (membershipsAvailable) included.push('consumer_group_consumers');
      else {
        delete data.consumer_group_consumers;
        unavailable.push('consumer_group_consumers');
      }
    }

    const record = snapshotRecord(
      snapshotName, node, nodeInfo, data, included, unavailable, includeSensitiveData
    );
    return new Promise((resolve, reject) => {
      sails.models.snapshot.create(record).fetch().exec(function (err, created) {
        if (err) return reject(err);
        return resolve(created);
      });
    });
  },

  restore: async(snapshot, connection, requestedImports) => {
    const data = normalizeSnapshotData(snapshot);
    const requested = new Set(requestedImports && requestedImports.length ? requestedImports : Object.keys(data));
    const blockedRestores = [];

    NON_RESTORABLE_ENTITIES.forEach(function (key) {
      if (requested.has(key)) {
        requested.delete(key);
        blockedRestores.push(key);
      }
    });

    if (requested.has('acls')) {
      requested.delete('acls');
      requested.add('acl_credentials');
    }
    if (requested.has('upstreams') && data.targets) requested.add('targets');
    if (requested.has('consumer_groups') && data.consumer_group_consumers) {
      requested.add('consumer_group_consumers');
    }
    if (requested.has('consumers')) {
      Object.keys(LEGACY_CREDENTIAL_MAP).forEach(function (legacyKey) {
        const key = LEGACY_CREDENTIAL_MAP[legacyKey];
        if (data[key]) requested.add(key);
      });
    }

    const restoreOrder = function (key) {
      if (key === 'targets' || key === 'consumer_group_consumers') return 70;
      const definition = entityDefinition(key);
      return definition ? definition.order : 1000;
    };
    const keys = Array.from(requested)
      .filter(function (key) { return Array.isArray(data[key]); })
      .sort(function (left, right) { return restoreOrder(left) - restoreOrder(right); });
    const responseData = {};

    blockedRestores.forEach(function (key) {
      responseBucket(responseData, key).skipped = Array.isArray(data[key]) ? data[key].length : 0;
    });

    for (const key of keys) {
      if (key === 'targets') {
        await restoreTargets(data[key], connection, responseData);
      } else if (key === 'consumer_group_consumers') {
        await restoreConsumerGroupMemberships(data[key], connection, responseData);
      } else if (_.get(entityDefinition(key), 'consumerEndpoint')) {
        await restoreConsumerCredentials(key, data[key], connection, responseData);
      } else {
        await restoreGeneric(key, data[key], connection, responseData);
      }
    }

    return responseData;
  },

  takeSnapShot: function (name, node, cb) {


    // Get node
    KongService.nodeInfo(node, function (err, status) {
      if (err) {
        return cb(err);
      }

      var result = {}

      var endpoints = ['/apis', '/plugins', '/consumers']

      status.version = Utils.ensureSemverFormat(status.version);

      if (semver.gte(status.version, '0.10.0')) {
        endpoints = endpoints.concat(['/upstreams']);
      }

      if (semver.gte(status.version, '0.13.0')) {
        endpoints = endpoints.concat(['/services', '/routes']);
      }


      var fns = []

      endpoints.forEach(function (endpoint) {
        fns.push(function (cb) {
          KongService.listAllCb(node, endpoint, function (err, data) {
            if (err) {
              return cb(err);
            }
            result[endpoint.replace("/", "")] = data.data
            return cb();
          });
        });
      });


      async.series(fns, function (err, data) {
        if (err) {
          return cb(err);
        }


        var servicePluginsMap = {};
        var consumerPluginsMap = {};
        var routePluginsMap = {};
        var pluginsUpdated = [];
        var routesUpdated = [];


        _.forEach(result.plugins, function (plugin) {
          if (plugin.service_id) {

            if (!(plugin.service_id in servicePluginsMap)) {
              servicePluginsMap[plugin.service_id] = [];
            }
            servicePluginsMap[plugin.service_id].push(plugin);

          } else if (plugin.route_id) {

            if (!(plugin.route_id in routePluginsMap)) {
              routePluginsMap[plugin.route_id] = [];
            }
            routePluginsMap[plugin.route_id].push(plugin);

          } else if(plugin.consumer_id) {
            if (!(plugin.consumer_id in consumerPluginsMap)) {
              consumerPluginsMap[plugin.consumer_id] = [];
            }
            consumerPluginsMap[plugin.consumer_id].push(plugin);
          } else {
            pluginsUpdated.push(plugin);
          }
        });

        result.plugins = pluginsUpdated;

        _.forEach(servicePluginsMap, function (arr, service_id) {
          var service = _.find(result.services, {id: service_id});

          if (service) {
            service.plugins = arr
          }

        });

        _.forEach(routePluginsMap, function (arr, route_id) {
          var route = _.find(result.routes, {id: route_id});

          if (route) {
            route.plugins = arr
          }
        });

        _.forEach(result.routes, function (route) {
          var routes = routesUpdated;
          if (route.service && route.service.id) {
            var service = _.find(result.services, {id: route.service.id});

            if (service) {
              if (!service.routes) {
                service.routes = [];
              }
              routes = service.routes;
            }
          }
          routes.push(route);
        });

        result.routes = [];


        // Foreach consumer get it's acls & plugins
        var consumerFns = []
        result.consumers.forEach(function (consumer) {
          consumerFns.push(function (cb) {
            KongService.listAllCb(node, '/consumers/' + consumer.id + '/acls', function (err, data) {
              if (err) {
                return cb();
              }
              sails.log(data)
              if (!consumer.acls) {
                consumer.acls = [];
              }
              data.data.forEach(function (item) {
                consumer.acls.push(item);
              })

              // Also get the consumer's plugins
              KongService.listAllCb(node, '/consumers/' + consumer.id + '/plugins', function (err, data) {
                if (err) {
                  return cb();
                }
                sails.log(data)
                if (!consumer.plugins) {
                  consumer.plugins = [];
                }
                data.data.forEach(function (item) {
                  consumer.plugins.push(item);
                })

                return cb();
              });
            });
          })


          var credentials = ["basic-auth", "key-auth", "hmac-auth", "jwt", "oauth2"]
          credentials.forEach(function (credential) {
            consumerFns.push(function (cb) {
              KongService.listAllCb(node, '/consumers/' + consumer.id + '/' + credential, function (err, data) {
                if (err) {
                  return cb();
                }
                if (!consumer.credentials) {
                  consumer.credentials = {};
                }
                if (!consumer.credentials[credential]) {
                  consumer.credentials[credential] = [];
                }
                data.data.forEach(function (item) {
                  consumer.credentials[credential].push(item);
                })

                return cb();
              });
            });
          });
        })

        async.series(consumerFns, function (err, data) {
          if (err) {
            return cb(err);
          }

          if (semver.gte(status.version, '0.10.0')) {
            // Foreach upstream get it's targets
            var fns = []
            result.upstreams.forEach(function (upstream) {
              fns.push(function (cb) {
                KongService.listAllCb(node, '/upstreams/' + upstream.id + '/targets', function (err, data) {
                  if (err) return cb()
                  sails.log(data.data)
                  if (!result.upstream_targets) result.upstream_targets = []
                  data.data.forEach(function (item) {
                    result.upstream_targets.push(item);
                  })

                  return cb();
                });
              });
            })


            async.series(fns, function (err, data) {
              if (err) {
                return cb(err);
              }


              sails.models.snapshot.create({
                name: name || "snap@" + Date.now(),
                kong_node_name: node.name,
                kong_node_url: Utils.withoutTrailingSlash(node.kong_admin_url),
                kong_version: status.version,
                data: result
              }).exec(function (err, created) {
                if (err) {
                  sails.sockets.blast('events.snapshots', {
                    verb: 'failed',
                    data: {
                      name: node.name + "@" + Date.now()
                    }
                  });
                }

              });
            })
          } else {
            sails.models.snapshot.create({
              name: name || "snap@" + Date.now(),
              kong_node_name: node.name,
              kong_version: node.kong_version,
              data: result
            }).exec(function (err, created) {
              if (err) {
                sails.sockets.blast('events.snapshots', {
                  verb: 'failed',
                  data: {
                    name: node.name + "@" + Date.now()
                  }
                });
              }

            });
          }
        });
      });

    });
  },

}
