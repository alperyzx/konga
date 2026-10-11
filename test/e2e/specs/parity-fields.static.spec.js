const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (file) => fs.readFileSync(path.join(REPO, file), 'utf8');

test.describe('Kong Manager field parity', () => {
  test('services expose upstream TLS trust fields', () => {
    const form = read('assets/js/app/services/partials/form-service-013.html');
    const service = read('assets/js/app/services/services-service.js');

    for (const field of ['tls_verify', 'tls_verify_depth', 'ca_certificates']) {
      expect(form).toContain(`service.${field}`);
      expect(service).toContain(`props.${field}`);
    }
  });

  test('routes expose request and response buffering', () => {
    const service = read('assets/js/app/routes/routes-service.js');

    for (const field of ['request_buffering', 'response_buffering']) {
      expect(service).toContain(`${field}: true`);
      for (const version of ['013', '015']) {
        expect(read(`assets/js/app/routes/partials/form-route-${version}.html`))
          .toContain(`route.${field}`);
      }
    }
  });

  test('upstreams expose every remaining Kong Manager field', () => {
    const form = read('assets/js/app/upstreams/partials/upstream-form.html');
    const add = read('assets/js/app/upstreams/add-upstream-modal-controller.js');
    const update = read('assets/js/app/upstreams/update-upstream-modal-controller.js');
    const details = read('assets/js/app/upstreams/edit-upstream-details-controller.js');

    for (const field of [
      'client_certificate',
      'hash_on_query_arg',
      'hash_fallback_query_arg',
      'hash_on_uri_capture',
      'hash_fallback_uri_capture',
    ]) expect(form).toContain(`upstream.${field}`);

    expect(form).toContain('activeHealthHeaders');
    expect(add).toContain('healthchecks.active.headers');
    expect(update).toContain('healthchecks.active.headers');
    expect(details).toContain('healthchecks.active.headers');
  });

  test('certificates support alternate pairs and standalone tagged SNIs', () => {
    const certificate = read('assets/js/app/certificates/add-certificates-modal.html');
    const routes = read('assets/js/app/certificates/00_certificates.js');
    const sni = read('assets/js/app/certificates/sni-modal.html');

    expect(certificate).toContain('data.cert_alt');
    expect(certificate).toContain('data.key_alt');
    expect(routes).toContain(".state('snis'");
    expect(sni).toContain('data.certificate_id');
    expect(sni).toContain('data.tags');
  });

  test('security entities support backend config, names, editing, and direct navigation', () => {
    const controller = read('assets/js/app/security/security-controllers.js');
    const key = read('assets/js/app/security/key-modal.html');
    const vault = read('assets/js/app/security/vault-modal.html');
    const navigation = read('assets/js/app/core/layout/01_layout-controllers.js');
    const states = read('assets/js/app/security/00_security.js');

    expect(key).toContain('data.name');
    expect(vault).toContain('data.config.prefix');
    expect(vault).toContain('configJson');
    expect(controller).toMatch(/identifier \? Model\.update/);
    expect(navigation).toContain("state: 'key-sets'");
    expect(navigation).toContain("title: 'Keys & Vaults'");
    for (const state of ['key-sets', 'keys', 'vaults']) {
      expect(states).toContain(`.state('${state}'`);
    }
  });
});
