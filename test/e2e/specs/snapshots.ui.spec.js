const {test, expect} = require('@playwright/test');
const {generateKeyPairSync} = require('crypto');
const {execFileSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {kong} = require('../helpers/kong');
const konga = require('../helpers/konga');

const PREFIX = 'e2e-snapshot-';
const BACKUP_TAG = 'e2e-snapshot-backup';

function selfSignedCertificate(commonName, keyType, isCa) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'konga-snapshot-cert-'));
  const keyPath = path.join(directory, 'key.pem');
  const certPath = path.join(directory, 'cert.pem');
  try {
    const keyArguments = keyType === 'ec'
      ? ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1']
      : ['-newkey', 'rsa:2048'];
    const certificateArguments = [
      'req', '-x509', ...keyArguments, '-nodes', '-days', '2',
      '-subj', `/CN=${commonName}`, '-keyout', keyPath, '-out', certPath
    ];
    if (isCa) certificateArguments.push('-addext', 'basicConstraints=critical,CA:TRUE');
    execFileSync('openssl', certificateArguments, {stdio: 'ignore'});
    return {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8')
    };
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
}

async function cleanupKongFixtures() {
  const services = (await kong.get('/services')).body.data || [];
  const serviceIds = new Set(services.filter((item) => (item.name || '').startsWith(PREFIX)).map((item) => item.id));

  for (const collection of ['routes', 'services', 'upstreams', 'consumers']) {
    const items = (await kong.get(`/${collection}`)).body.data || [];
    for (const item of items) {
      const label = item.name || item.username || '';
      const belongsToService = collection === 'routes' && item.service && serviceIds.has(item.service.id);
      if (label.startsWith(PREFIX) || belongsToService) await kong.del(`/${collection}/${item.id}`);
    }
  }

  for (const collection of ['snis', 'keys', 'key-sets', 'vaults', 'certificates', 'ca_certificates']) {
    const items = (await kong.get(`/${collection}`)).body.data || [];
    for (const item of items) {
      if ((item.tags || []).includes(BACKUP_TAG)) {
        await kong.del(`/${collection}/${item.id || item.prefix}`);
      }
    }
  }
}

async function kongaRequest(page, method, path, body) {
  return page.evaluate(async ({method, path, body}) => {
    const credentials = JSON.parse(localStorage.getItem('ngStorage-credentials'));
    const response = await fetch(path, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${credentials.token}`,
        'connection-id': '1'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    return {status: response.status, body: text ? JSON.parse(text) : null};
  }, {method, path, body});
}

async function proxyStatus(path, username, password) {
  const authorization = Buffer.from(`${username}:${password}`).toString('base64');
  const response = await fetch(`http://localhost:8000${path}`, {
    headers: {authorization: `Basic ${authorization}`}
  });
  return response.status;
}

test('manual and scheduled sensitive-data options default off and warn about one-way hashes', async ({page}) => {
  await page.goto('/#!/snapshots');
  await konga.waitForAngular(page);

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', {name: /import from file/i}).click()
  ]);
  expect(fileChooser.isMultiple()).toBe(false);

  await page.getByRole('button', {name: /instant snapshot/i}).click();
  let modal = page.locator('.modal-content');
  await expect(modal.getByRole('heading', {name: /Create instant snapshot/i})).toBeVisible();
  await expect.poll(async () => (await modal.boundingBox()).width).toBeGreaterThan(800);
  await expect(modal.getByRole('button', {name: /Create snapshot/i})).toBeVisible();
  await expect(modal.getByText(/Include sensitive credentials/)).toBeVisible();
  await expect(modal.locator('input[data-ng-model="snapshot.include_sensitive_data"]')).not.toBeChecked();
  await expect(modal.getByText(/hash_secret=true/)).toBeVisible();
  await modal.locator('.modal-close').click();

  await page.getByText('Scheduled tasks', {exact: true}).click();
  await page.getByRole('button', {name: /add schedule/i}).click();
  modal = page.locator('.modal-content');
  await expect(modal.getByText(/Include sensitive credentials/)).toBeVisible();
  await expect(modal.locator('input[ng-model="data.include_sensitive_data"]')).not.toBeChecked();
  await expect(modal.getByText(/hash_secret=true/)).toBeVisible();
  await modal.locator('.modal-close').click();
});

test('an exported snapshot JSON file imports into the snapshot library', async ({page}) => {
  const importedName = PREFIX + 'file-import-' + Date.now();
  await page.goto('/#!/snapshots');
  await konga.waitForAngular(page);

  try {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', {name: /import from file/i}).click()
    ]);
    await fileChooser.setFiles({
      name: 'snapshot.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        name: importedName,
        kong_node_name: 'file-import-test',
        kong_node_url: 'http://localhost:8001',
        kong_version: '3.9.3',
        backup_version: 2,
        includes_sensitive_data: false,
        included_entities: ['services'],
        unavailable_entities: [],
        excluded_entities: ['sensitive_data_not_requested'],
        data: {services: []}
      }))
    });

    await expect(page.getByText('Snapshot imported successfully')).toBeVisible();
    await expect(page.getByText(new RegExp(importedName))).toBeVisible();
  } finally {
    const listing = await kongaRequest(page, 'GET', '/api/snapshot?limit=1000');
    const imported = (listing.body || []).filter((snapshot) => (snapshot.name || '').includes(importedName));
    for (const snapshot of imported) {
      await kongaRequest(page, 'DELETE', `/api/snapshot/${snapshot.id}`);
    }
  }
});

test('a complete backup restores entities, relationships, and credential secrets', async ({page}) => {
  let snapshotId;
  let safeSnapshotId;
  await cleanupKongFixtures();

  try {
    const primaryPair = selfSignedCertificate('snapshot-primary.example');
    const alternatePair = selfSignedCertificate('snapshot-alternate.example', 'ec');
    const caPair = selfSignedCertificate('snapshot-ca.example', 'rsa', true);
    const certificate = (await kong.post('/certificates', {
      cert: primaryPair.cert, key: primaryPair.key,
      cert_alt: alternatePair.cert, key_alt: alternatePair.key,
      tags: [BACKUP_TAG]
    })).body;
    const sni = (await kong.post(`/certificates/${certificate.id}/snis`, {
      name: PREFIX + 'sni.example', tags: [BACKUP_TAG]
    })).body;
    const caCertificate = (await kong.post('/ca_certificates', {
      cert: caPair.cert, tags: [BACKUP_TAG]
    })).body;
    const service = (await kong.post('/services', {
      name: PREFIX + 'service', url: 'https://snapshot.example', tags: [BACKUP_TAG],
      tls_verify: true, ca_certificates: [caCertificate.id]
    })).body;
    const route = (await kong.post(`/services/${service.id}/routes`, {
      name: PREFIX + 'route', paths: ['/' + PREFIX + 'route'], strip_path: false, preserve_host: true
    })).body;
    const upstream = (await kong.post('/upstreams', {
      name: PREFIX + 'upstream.test', tags: ['backup-test']
    })).body;
    await kong.post(`/upstreams/${upstream.id}/targets`, {target: '127.0.0.1:32123', weight: 73});
    const consumer = (await kong.post('/consumers', {
      username: PREFIX + 'consumer', tags: ['backup-test']
    })).body;
    const credential = (await kong.post(`/consumers/${consumer.id}/key-auth`, {
      key: PREFIX + 'secret-key', tags: [BACKUP_TAG]
    })).body;
    const hmacCredential = (await kong.post(`/consumers/${consumer.id}/hmac-auth`, {
      username: PREFIX + 'hmac-user', secret: PREFIX + 'hmac-secret', tags: [BACKUP_TAG]
    })).body;
    const jwtCredential = (await kong.post(`/consumers/${consumer.id}/jwt`, {
      key: PREFIX + 'jwt-key', secret: PREFIX + 'jwt-secret', algorithm: 'HS256', tags: [BACKUP_TAG]
    })).body;
    const oauthCredential = (await kong.post(`/consumers/${consumer.id}/oauth2`, {
      name: PREFIX + 'oauth-app', client_id: PREFIX + 'oauth-client',
      client_secret: PREFIX + 'oauth-secret', hash_secret: false,
      redirect_uris: ['https://snapshot.example/callback'], tags: [BACKUP_TAG]
    })).body;
    const hashedOauthCredential = (await kong.post(`/consumers/${consumer.id}/oauth2`, {
      name: PREFIX + 'hashed-oauth-app', client_id: PREFIX + 'hashed-oauth-client',
      client_secret: PREFIX + 'hashed-oauth-secret', hash_secret: true,
      redirect_uris: ['https://snapshot.example/hashed-callback'], tags: [BACKUP_TAG]
    })).body;
    const aclCredential = (await kong.post(`/consumers/${consumer.id}/acls`, {
      group: PREFIX + 'acl-group', tags: [BACKUP_TAG]
    })).body;
    const oauthToken = (await kong.post('/oauth2_tokens', {
      credential: {id: oauthCredential.id}, service: {id: service.id}, token_type: 'bearer',
      expires_in: 3600, access_token: PREFIX + 'access-token', refresh_token: PREFIX + 'refresh-token',
      authenticated_userid: PREFIX + 'user', scope: 'read write'
    })).body;
    const basicPassword = 'SnapshotBasicPassword123!';
    const basicCredential = (await kong.post(`/consumers/${consumer.id}/basic-auth`, {
      username: PREFIX + 'basic-user', password: basicPassword, tags: ['backup-test']
    })).body;
    const plugin = (await kong.post(`/services/${service.id}/plugins`, {
      name: 'request-termination', config: {status_code: 418, message: PREFIX + 'plugin'}
    })).body;
    await kong.post(`/services/${service.id}/plugins`, {name: 'basic-auth', config: {hide_credentials: false}});
    await expect.poll(
      () => proxyStatus('/' + PREFIX + 'route', basicCredential.username, basicPassword),
      {timeout: 15000}
    ).toBe(418);
    const keySet = (await kong.post('/key-sets', {
      name: PREFIX + 'set', tags: [BACKUP_TAG]
    })).body;
    const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
    const privateJwk = {...privateKey.export({format: 'jwk'}), kid: PREFIX + 'kid'};
    const key = (await kong.post('/keys', {
      name: PREFIX + 'key', kid: PREFIX + 'kid', set: {id: keySet.id},
      jwk: JSON.stringify(privateJwk), tags: [BACKUP_TAG]
    })).body;
    const pemKey = (await kong.post('/keys', {
      name: PREFIX + 'pem-key', kid: PREFIX + 'pem-kid', set: {id: keySet.id},
      pem: {
        public_key: publicKey.export({type: 'spki', format: 'pem'}),
        private_key: privateKey.export({type: 'pkcs8', format: 'pem'})
      },
      tags: [BACKUP_TAG]
    })).body;
    const vault = (await kong.post('/vaults', {
      name: 'env', prefix: 'e2esnapshotbackup', description: PREFIX + 'vault',
      config: {prefix: 'E2E_SNAPSHOT_'}, tags: [BACKUP_TAG]
    })).body;

    await page.goto('/#!/snapshots');
    await konga.waitForAngular(page);
    const safeSnapshot = await kongaRequest(page, 'POST', '/api/snapshots/snapshot', {
      name: PREFIX + 'safe-' + Date.now(), node_id: 1, include_sensitive_data: false
    });
    expect(safeSnapshot.status).toBe(200);
    safeSnapshotId = safeSnapshot.body.id;
    expect(safeSnapshot.body.includes_sensitive_data).toBe(false);
    for (const entity of ['certificates', 'snis', 'keys', 'key_auth_credentials',
      'hmac_auth_credentials', 'jwt_credentials', 'oauth2_credentials', 'oauth2_tokens']) {
      expect(safeSnapshot.body.data[entity], entity).toBeUndefined();
      expect(safeSnapshot.body.included_entities).not.toContain(entity);
    }
    expect(safeSnapshot.body.included_entities).toContain('ca_certificates');
    expect(safeSnapshot.body.included_entities).toContain('acl_credentials');
    expect(safeSnapshot.body.excluded_entities)
      .toContain('sensitive_credentials_oauth_state_certificates_and_private_keys_not_requested');

    const captured = await kongaRequest(page, 'POST', '/api/snapshots/snapshot', {
      name: PREFIX + Date.now(), node_id: 1, include_sensitive_data: true
    });
    expect(captured.status).toBe(200);
    snapshotId = captured.body.id;
    expect(captured.body.backup_version).toBe(2);
    expect(captured.body.includes_sensitive_data).toBe(true);
    for (const entity of ['services', 'routes', 'consumers', 'plugins', 'upstreams', 'targets',
      'certificates', 'snis', 'ca_certificates', 'key_auth_credentials', 'hmac_auth_credentials',
      'jwt_credentials', 'oauth2_credentials', 'acl_credentials', 'oauth2_tokens',
      'key_sets', 'keys', 'vaults']) {
      expect(captured.body.included_entities).toContain(entity);
    }
    for (const entity of ['consumer_groups', 'degraphql_routes', 'mtls_auth_credentials',
      'oauth2_authorization_codes']) {
      expect(captured.body.unavailable_entities).toContain(entity);
    }
    expect(captured.body.data.basic_auth_credentials).toBeUndefined();
    expect(captured.body.data.oauth2_credentials.map((item) => item.id)).toContain(oauthCredential.id);
    expect(captured.body.data.oauth2_credentials.map((item) => item.id)).not.toContain(hashedOauthCredential.id);
    expect(captured.body.excluded_entities).toContain('basic_auth_credentials_one_way_password_hashes');
    expect(captured.body.excluded_entities)
      .toContain('oauth2_credentials_with_one_way_hashed_client_secrets');
    expect(captured.body.excluded_entities).toContain('external_vault_secret_values');

    await kong.del(`/routes/${route.id}`);
    await kong.del(`/services/${service.id}`);
    await kong.del(`/upstreams/${upstream.id}`);
    await kong.del(`/consumers/${consumer.id}`);
    await kong.del(`/keys/${key.id}`);
    await kong.del(`/keys/${pemKey.id}`);
    await kong.del(`/key-sets/${keySet.id}`);
    await kong.del(`/vaults/${vault.id || vault.prefix}`);
    await kong.del(`/snis/${sni.id}`);
    await kong.del(`/certificates/${certificate.id}`);
    await kong.del(`/ca_certificates/${caCertificate.id}`);

    const restored = await kongaRequest(page, 'POST', `/api/snapshots/${snapshotId}/restore`, {
      imports: captured.body.included_entities.concat(['basic_auth_credentials'])
    });
    expect(restored.status).toBe(200);
    for (const entity of ['key_sets', 'vaults', 'services', 'upstreams', 'consumers', 'keys',
      'routes', 'targets', 'certificates', 'snis', 'ca_certificates', 'key_auth_credentials',
      'hmac_auth_credentials', 'jwt_credentials', 'oauth2_credentials', 'acl_credentials',
      'oauth2_tokens', 'plugins']) {
      expect(restored.body[entity].failed.count, `${entity}: ${JSON.stringify(restored.body[entity])}`).toBe(0);
    }
    expect(restored.body.basic_auth_credentials).toEqual({
      imported: 0, skipped: 0, failed: {count: 0, items: []}
    });

    const restoredService = (await kong.get(`/services/${service.id}`)).body;
    const restoredRoute = (await kong.get(`/routes/${route.id}`)).body;
    const restoredConsumer = (await kong.get(`/consumers/${consumer.id}`)).body;
    const restoredUpstream = (await kong.get(`/upstreams/${upstream.id}`)).body;
    const targets = (await kong.get(`/upstreams/${upstream.id}/targets`)).body.data;
    const restoredCredential = (await kong.get(`/key-auths/${credential.id}`)).body;
    const restoredHmac = (await kong.get(`/hmac-auths/${hmacCredential.id}`)).body;
    const restoredJwt = (await kong.get(`/jwts/${jwtCredential.id}`)).body;
    const restoredOauth = (await kong.get(`/oauth2/${oauthCredential.id}`)).body;
    const skippedHashedOauth = await kong.get(`/oauth2/${hashedOauthCredential.id}`);
    const restoredAcl = (await kong.get(`/acls/${aclCredential.id}`)).body;
    const restoredOauthToken = (await kong.get(`/oauth2_tokens/${oauthToken.id}`)).body;
    const restoredPlugin = (await kong.get(`/plugins/${plugin.id}`)).body;
    const restoredKeySet = (await kong.get(`/key-sets/${keySet.id}`)).body;
    const restoredKey = (await kong.get(`/keys/${key.id}`)).body;
    const restoredPemKey = (await kong.get(`/keys/${pemKey.id}`)).body;
    const restoredVault = (await kong.get(`/vaults/${vault.id || vault.prefix}`)).body;
    const restoredCertificate = (await kong.get(`/certificates/${certificate.id}`)).body;
    const restoredSni = (await kong.get(`/snis/${sni.id}`)).body;
    const restoredCa = (await kong.get(`/ca_certificates/${caCertificate.id}`)).body;

    expect(restoredService.name).toBe(PREFIX + 'service');
    expect(restoredService.ca_certificates).toContain(caCertificate.id);
    expect(restoredRoute.service.id).toBe(service.id);
    expect(restoredRoute.strip_path).toBe(false);
    expect(restoredRoute.preserve_host).toBe(true);
    expect(restoredConsumer.username).toBe(PREFIX + 'consumer');
    expect(restoredUpstream.name).toBe(PREFIX + 'upstream.test');
    expect(targets).toEqual(expect.arrayContaining([expect.objectContaining({target: '127.0.0.1:32123', weight: 73})]));
    expect(restoredCredential.consumer.id).toBe(consumer.id);
    expect(restoredCredential.key).toBe(PREFIX + 'secret-key');
    expect(restoredHmac.secret).toBe(PREFIX + 'hmac-secret');
    expect(restoredJwt.secret).toBe(PREFIX + 'jwt-secret');
    expect(restoredOauth.client_secret).toBe(PREFIX + 'oauth-secret');
    expect(restoredOauth.hash_secret).toBe(false);
    expect(skippedHashedOauth.status).toBe(404);
    expect(restoredAcl.group).toBe(PREFIX + 'acl-group');
    expect(restoredOauthToken.access_token).toBe(PREFIX + 'access-token');
    expect(restoredOauthToken.refresh_token).toBe(PREFIX + 'refresh-token');
    expect(restoredOauthToken.credential.id).toBe(oauthCredential.id);
    await expect.poll(
      () => proxyStatus('/' + PREFIX + 'route', basicCredential.username, basicPassword),
      {timeout: 15000}
    ).toBe(401);
    expect(restoredPlugin.service.id).toBe(service.id);
    expect(restoredPlugin.config).toEqual(expect.objectContaining({status_code: 418, message: PREFIX + 'plugin'}));
    expect(restoredKeySet.name).toBe(PREFIX + 'set');
    expect(restoredKey.set.id).toBe(keySet.id);
    expect(JSON.parse(restoredKey.jwk).d).toBe(privateJwk.d);
    expect(restoredPemKey.set.id).toBe(keySet.id);
    expect(restoredPemKey.pem.private_key).toBe(pemKey.pem.private_key);
    expect(restoredVault.config.prefix).toBe('E2E_SNAPSHOT_');
    expect(restoredCertificate.key).toBe(primaryPair.key);
    expect(restoredCertificate.key_alt).toBe(alternatePair.key);
    expect(restoredSni.certificate.id).toBe(certificate.id);
    expect(restoredCa.cert).toBe(caPair.cert);
  } finally {
    await cleanupKongFixtures();
    if (snapshotId) await kongaRequest(page, 'DELETE', `/api/snapshot/${snapshotId}`);
    if (safeSnapshotId) await kongaRequest(page, 'DELETE', `/api/snapshot/${safeSnapshotId}`);
  }
});
