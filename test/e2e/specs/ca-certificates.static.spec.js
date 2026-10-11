/** Phase 4 — CA Certificates are a first-class Kong entity in Konga. */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.describe('Phase 4: CA Certificates', () => {
  test('registers a sibling route under the certificates module', () => {
    const source = read('assets/js/app/certificates/00_certificates.js');
    expect(source).toContain(".state('ca-certificates'");
    expect(source).toContain("url: '/ca-certificates'");
    expect(source).toContain("templateUrl: 'js/app/certificates/ca-certificates.html'");
  });

  test('uses Kong’s CA Certificates endpoint', () => {
    expect(read('assets/js/app/certificates/ca-certificate-model.js'))
      .toContain("new DataModel('kong/ca_certificates', true)");
  });

  test('form exposes the required certificate and optional tags', () => {
    const html = read('assets/js/app/certificates/add-ca-certificate-modal.html');
    expect(html).toContain('ng-model="data.cert"');
    expect(html).toContain('ng-model="data.tags"');
  });

  test('list exposes Kong’s generated certificate digest', () => {
    const html = read('assets/js/app/certificates/ca-certificates.html');
    expect(html).toContain('item.cert_digest');
    expect(html).toContain('deleteItem($index,item)');
  });

  test('the existing Certificates page links to CA Certificates', () => {
    expect(read('assets/js/app/certificates/certificates.html'))
      .toContain('ui-sref="ca-certificates"');
  });
});
