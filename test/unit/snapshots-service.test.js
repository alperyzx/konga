'use strict';

const assert = require('assert');
const KongService = require('../../api/services/KongService');
const SnapshotsService = require('../../api/services/SnapshotsService');

describe('SnapshotsService complete backups', function () {
  const originals = {};
  let originalSails;

  beforeEach(function () {
    originalSails = global.sails;
    ['info', 'fetch', 'put', 'post', 'patch'].forEach(function (method) {
      originals[method] = KongService[method];
    });
  });

  afterEach(function () {
    Object.keys(originals).forEach(function (method) {
      KongService[method] = originals[method];
    });
    global.sails = originalSails;
  });

  it('captures every available collection and awaits relationship data', async function () {
    let stored;
    global.sails = {
      models: {
        snapshot: {
          create: function (record) {
            stored = record;
            return {
              fetch: function () {
                return {
                  exec: function (callback) { callback(null, Object.assign({id: 7}, record)); }
                };
              }
            };
          }
        }
      }
    };
    KongService.info = async function () { return {version: '3.9.3'}; };
    KongService.fetch = async function (endpoint) {
      if (endpoint === '/upstreams') return {data: [{id: 'upstream-1'}]};
      if (endpoint === '/upstreams/upstream-1/targets') {
        return {data: [{id: 'target-1', target: '127.0.0.1:8080', weight: 100}]};
      }
      if (endpoint === '/consumer_groups') return {data: [{id: 'group-1'}]};
      if (endpoint === '/consumer_groups/group-1/consumers') {
        return {data: [{consumer: {id: 'consumer-1'}}]};
      }
      if (endpoint === '/oauth2') {
        return {data: [
          {id: 'oauth-plain', client_secret: 'restorable', hash_secret: false},
          {id: 'oauth-hashed', client_secret: '$pbkdf2-sha512$hash', hash_secret: true}
        ]};
      }
      return {data: []};
    };

    const created = await SnapshotsService.snapshot('complete', {
      name: 'local',
      kong_admin_url: 'http://localhost:8001',
      kong_version: '3.9.3'
    }, {includeSensitiveData: true});

    assert.strictEqual(created.id, 7);
    assert.strictEqual(stored.backup_version, 2);
    assert.strictEqual(stored.kong_version, '3.9.3');
    assert.deepStrictEqual(stored.data.targets, [{
      id: 'target-1',
      target: '127.0.0.1:8080',
      weight: 100,
      upstream: {id: 'upstream-1'}
    }]);
    assert.deepStrictEqual(stored.data.consumer_group_consumers, [{
      consumer: {id: 'consumer-1'},
      consumer_group: {id: 'group-1'}
    }]);
    for (const key of ['ca_certificates', 'key_sets', 'keys', 'vaults', 'oauth2_tokens']) {
      assert(stored.included_entities.includes(key), key + ' should be included');
    }
    assert.deepStrictEqual(stored.unavailable_entities, []);
    assert(stored.excluded_entities.includes('konga_users_connections_and_settings'));
    assert.deepStrictEqual(stored.data.oauth2_credentials, [
      {id: 'oauth-plain', client_secret: 'restorable', hash_secret: false}
    ]);
    assert(stored.excluded_entities.includes('oauth2_credentials_with_one_way_hashed_client_secrets'));
  });

  it('omits known sensitive collections unless explicitly requested', async function () {
    let stored;
    const fetched = [];
    global.sails = {
      models: {
        snapshot: {
          create: function (record) {
            stored = record;
            return {fetch: function () {
              return {exec: function (callback) { callback(null, record); }};
            }};
          }
        }
      }
    };
    KongService.info = async function () { return {version: '3.9.3'}; };
    KongService.fetch = async function (endpoint) {
      fetched.push(endpoint);
      return {data: []};
    };

    await SnapshotsService.snapshot('safe-default', {
      name: 'local', kong_admin_url: 'http://localhost:8001', kong_version: '3.9.3'
    });

    assert.strictEqual(stored.includes_sensitive_data, false);
    for (const key of SnapshotsService.SENSITIVE_ENTITY_KEYS) {
      assert.strictEqual(stored.data[key], undefined, key + ' should be omitted');
    }
    assert(!fetched.includes('/key-auths'));
    assert(stored.included_entities.includes('ca_certificates'));
    assert(stored.excluded_entities.includes(
      'sensitive_credentials_oauth_state_certificates_and_private_keys_not_requested'
    ));
  });

  it('restores parents before dependants and skips existing relationships', async function () {
    const calls = [];
    KongService.put = async function (endpoint, connection, payload) {
      calls.push(['put', endpoint, payload]);
      return {};
    };
    KongService.post = async function (endpoint) {
      calls.push(['post', endpoint]);
      return {};
    };
    KongService.patch = async function (endpoint) {
      calls.push(['patch', endpoint]);
      return {};
    };
    KongService.fetch = async function (endpoint) {
      calls.push(['fetch', endpoint]);
      if (endpoint.indexOf('/targets') > -1) {
        return {data: [{id: 'target-1', target: '127.0.0.1:8080', weight: 100, tags: null}]};
      }
      if (endpoint.indexOf('/consumer_groups/') === 0) {
        return {data: [{consumer: {id: 'consumer-1'}}]};
      }
      return {data: []};
    };

    const result = await SnapshotsService.restore({
      backup_version: 2,
      data: {
        services: [{id: 'service-1', name: 'service'}],
        routes: [{id: 'route-1', service: {id: 'service-1'}}],
        consumers: [{id: 'consumer-1', username: 'consumer'}],
        consumer_groups: [{id: 'group-1', name: 'group'}],
        consumer_group_consumers: [{consumer_group: {id: 'group-1'}, consumer: {id: 'consumer-1'}}],
        upstreams: [{id: 'upstream-1', name: 'upstream'}],
        certificates: [{id: 'certificate-1', cert: 'cert', key: 'key', snis: ['example.test']}],
        snis: [{id: 'sni-1', name: 'example.test', certificate: {id: 'certificate-1'}}],
        targets: [{id: 'target-1', upstream: {id: 'upstream-1'}, target: '127.0.0.1:8080', weight: 100}],
        plugins: [{id: 'plugin-1', name: 'request-termination', service: {id: 'service-1'}}]
      }
    }, {kong_admin_url: 'http://localhost:8001'});

    const endpoints = calls.filter(call => call[0] === 'put').map(call => call[1]);
    assert(endpoints.indexOf('/services/service-1') < endpoints.indexOf('/routes/route-1'));
    assert(endpoints.indexOf('/routes/route-1') < endpoints.indexOf('/plugins/plugin-1'));
    assert.strictEqual(result.targets.skipped, 1);
    assert.strictEqual(result.targets.failed.count, 0);
    assert.strictEqual(result.consumer_group_consumers.skipped, 1);
    const certificateWrite = calls.find(call => call[0] === 'put' && call[1] === '/certificates/certificate-1');
    assert.strictEqual(certificateWrite[2].snis, undefined);
  });

  it('restores legacy nested credentials and targets', async function () {
    const calls = [];
    KongService.put = async function (endpoint) {
      calls.push(['put', endpoint]);
      return {};
    };
    KongService.post = async function (endpoint) {
      calls.push(['post', endpoint]);
      return {id: 'created'};
    };
    KongService.patch = async function (endpoint) {
      calls.push(['patch', endpoint]);
      throw {status: 404};
    };
    KongService.fetch = async function () { return {data: []}; };

    const result = await SnapshotsService.restore({
      data: {
        consumers: [{
          id: 'consumer-1',
          username: 'legacy',
          credentials: {
            'key-auths': [{id: 'credential-1', key: 'secret'}]
          }
        }],
        upstreams: [{
          id: 'upstream-1',
          name: 'legacy-upstream',
          targets: [{target: '127.0.0.1:8080', weight: 100}]
        }]
      }
    }, {kong_admin_url: 'http://localhost:8001'}, ['consumers', 'upstreams']);

    assert(calls.some(call => call[0] === 'post' && call[1] === '/consumers/consumer-1/key-auth'));
    assert(calls.some(call => call[1] === '/upstreams/upstream-1/targets'));
    assert.strictEqual(result.key_auth_credentials.imported, 1);
    assert.strictEqual(result.targets.imported, 1);
  });

  it('never restores Basic Auth hashes from older snapshots', async function () {
    let writes = 0;
    KongService.put = async function () { writes++; };
    KongService.post = async function () { writes++; };
    KongService.patch = async function () { writes++; };

    const result = await SnapshotsService.restore({
      backup_version: 2,
      data: {
        basic_auth_credentials: [{
          id: 'basic-1', consumer: {id: 'consumer-1'},
          username: 'user', password: '$2b$12$exportedHash'
        }]
      }
    }, {kong_admin_url: 'http://localhost:8001'});

    assert.strictEqual(writes, 0);
    assert.strictEqual(result.basic_auth_credentials.imported, 0);
    assert.strictEqual(result.basic_auth_credentials.skipped, 1);
    assert.strictEqual(result.basic_auth_credentials.failed.count, 0);
  });

  it('skips one-way OAuth2 client-secret hashes from older snapshots', async function () {
    const writes = [];
    KongService.fetch = async function () { return {data: []}; };
    KongService.post = async function (endpoint, connection, payload) {
      writes.push({endpoint: endpoint, payload: payload});
      return {id: payload.id};
    };

    const result = await SnapshotsService.restore({
      backup_version: 2,
      data: {
        oauth2_credentials: [
          {id: 'oauth-hashed', consumer: {id: 'consumer-1'}, hash_secret: true,
            client_secret: '$pbkdf2-sha512$exportedHash'},
          {id: 'oauth-plain', consumer: {id: 'consumer-1'}, hash_secret: false,
            client_secret: 'restorable'}
        ]
      }
    }, {kong_admin_url: 'http://localhost:8001'});

    assert.strictEqual(writes.length, 1);
    assert.strictEqual(writes[0].payload.client_secret, 'restorable');
    assert.strictEqual(result.oauth2_credentials.imported, 1);
    assert.strictEqual(result.oauth2_credentials.skipped, 1);
    assert.strictEqual(result.oauth2_credentials.failed.count, 0);
  });
});
