'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const httpClient = require('../../api/lib/http-client');
const KongPluginService = require('../../api/services/KongPluginService');
const KongService = require('../../api/services/KongService');
const underscoreString = require('../../vendor/underscore-string');

describe('CodeQL security remediations', function () {
  describe('query parameter handling', function () {
    let originalGet;

    beforeEach(function () {
      originalGet = httpClient.get;
    });

    afterEach(function () {
      httpClient.get = originalGet;
    });

    function requestedUrl(endpoint) {
      return new Promise(function (resolve) {
        httpClient.get = function (url) {
          resolve(url);
          return {
            headers: function () { return this; },
            end: function (callback) { callback({error: new Error('stop after URL capture')}); }
          };
        };

        KongService.listAllCb({
          connection: {kong_admin_url: 'http://localhost:8001'}
        }, endpoint, function () {});
      });
    }

    it('adds the default page size to URLs without a size parameter', async function () {
      assert.strictEqual(
        await requestedUrl('/services?name=example'),
        'http://localhost:8001/services?name=example&size=1000'
      );
    });

    it('preserves an existing encoded size parameter', async function () {
      assert.strictEqual(
        await requestedUrl('/services?filter=a%5Cb&size=250'),
        'http://localhost:8001/services?filter=a%5Cb&size=250'
      );
    });
  });

  describe('self-signed certificate generation', function () {
    this.timeout(15000);

    function generateCertificate() {
      return new Promise(function (resolve, reject) {
        KongPluginService.makeSelfSignedCerts(function (error, certs) {
          if (error) return reject(error);
          resolve(certs);
        });
      });
    }

    it('safely generates independent certificate and key pairs concurrently', async function () {
      const generated = await Promise.all([
        generateCertificate(),
        generateCertificate()
      ]);

      generated.forEach(function (certs) {
        assert.strictEqual(certs.length, 2);
        assert.match(certs[0].toString(), /-----BEGIN CERTIFICATE-----/);
        assert.match(certs[1].toString(), /-----BEGIN (?:RSA )?PRIVATE KEY-----/);
      });
      assert.notStrictEqual(generated[0][0].toString(), generated[1][0].toString());
    });
  });

  it('uses native linear-time trimming for vendored string helpers', function () {
    const whitespace = ' '.repeat(100000);
    assert.strictEqual(underscoreString.rtrim('value' + whitespace), 'value');
    assert.strictEqual(underscoreString.rtrim(whitespace + 'value'), whitespace + 'value');
    assert.strictEqual(underscoreString.ltrim(whitespace + 'value'), 'value');
  });

  it('uses Web Crypto for mass-assigned credential secrets', function () {
    const source = fs.readFileSync(path.resolve(
      __dirname,
      '../../assets/js/app/consumers/credentials/mass-assign-credentials-controller.js'
    ), 'utf8');

    assert.match(source, /crypto\.getRandomValues\(bytes\)/);
    assert.match(source, /generateSecureSecret\(32\)/);
    assert.doesNotMatch(source, /Math\.random\(/);
  });

  it('generates a distinct 256-bit HMAC secret for every consumer', function () {
    const controllerPath = path.resolve(
      __dirname,
      '../../assets/js/app/consumers/credentials/mass-assign-credentials-controller.js'
    );
    const calls = [];
    let controllerDefinition;
    let nextByte = 0;

    global.window = {
      crypto: {
        getRandomValues: function (bytes) {
          for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = nextByte;
            nextByte = (nextByte + 1) % 256;
          }
          return bytes;
        }
      }
    };
    global.angular = {
      module: function () {
        return {
          controller: function (name, definition) {
            controllerDefinition = definition;
          }
        };
      }
    };

    try {
      delete require.cache[controllerPath];
      require(controllerPath);

      const controller = controllerDefinition[controllerDefinition.length - 1];
      const scope = {};
      const consumers = [
        {id: 'one', username: 'first'},
        {id: 'two', username: 'second'}
      ];
      const consumerService = {
        addCredential: function (id, credential, data) {
          calls.push({id: id, credential: credential, data: data});
          return Promise.resolve();
        }
      };
      const dialogService = {
        confirm: function (title, message, buttons, accept) { accept(); }
      };

      controller(
        {},
        {all: Promise.all.bind(Promise)},
        scope,
        {$broadcast: function () {}},
        {dismiss: function () {}},
        consumerService,
        dialogService,
        {success: function () {}},
        consumers
      );
      scope.onCredentialSelected('hmac-auth');

      assert.strictEqual(calls.length, 2);
      calls.forEach(function (call) {
        assert.strictEqual(call.credential, 'hmac-auth');
        assert.match(call.data.secret, /^[0-9a-f]{64}$/);
      });
      assert.notStrictEqual(calls[0].data.secret, calls[1].data.secret);
    } finally {
      delete require.cache[controllerPath];
      delete global.angular;
      delete global.window;
    }
  });

  it('invokes OpenSSL without a command shell', function () {
    const source = fs.readFileSync(path.resolve(
      __dirname,
      '../../api/services/KongPluginService.js'
    ), 'utf8');

    assert.match(source, /execFile\('openssl', args, \{shell: false\}/);
    assert.doesNotMatch(source, /child_process['"]\)\.exec\b/);
    assert.doesNotMatch(source, /\bcd ['"]? \+/);
  });

  it('does not use a hard-coded JWT signing secret', function () {
    const source = fs.readFileSync(path.resolve(
      __dirname,
      '../../api/services/Token.js'
    ), 'utf8');
    const configSource = fs.readFileSync(path.resolve(
      __dirname,
      '../../config/jwt.js'
    ), 'utf8');

    assert.match(source, /crypto\.randomBytes\(32\)/);
    assert.doesNotMatch(source + configSource, /oursecret|8fe171f1-0046-4df5-9216-14099434339f|some_secret_token/);
  });

  it('escapes values inserted into notification HTML', function () {
    const source = fs.readFileSync(path.resolve(
      __dirname,
      '../../api/lib/utils.js'
    ), 'utf8');
    const securitySource = fs.readFileSync(path.resolve(
      __dirname,
      '../../config/security.js'
    ), 'utf8');
    const userEventsSource = fs.readFileSync(path.resolve(
      __dirname,
      '../../api/events/user-events.js'
    ), 'utf8');

    assert.match(source, /escapeHtml/);
    assert.doesNotMatch(securitySource, /allowOrigins:\s*['"]\*['"]/);
    assert.match(userEventsSource, /Utils\.escapeHtml\(link\)/);
  });
});
