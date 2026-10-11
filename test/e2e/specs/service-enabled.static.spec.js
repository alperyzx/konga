const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (file) => fs.readFileSync(path.join(REPO, file), 'utf8');

test.describe('Service enabled state', () => {
  test('uses the Service PATCH API for the list quick action', () => {
    const controller = read('assets/js/app/services/controllers/services-controller.js');
    const service = read('assets/js/app/services/services-service.js');
    const list = read('assets/js/app/services/views/services.html');

    expect(controller).toContain('ServiceService.update(id, data)');
    expect(controller).not.toMatch(/ServiceModel\.update\(/);
    expect(service).toContain("$http.patch('kong/services/' + serviceId");
    expect(list).toContain('data-service-enabled-toggle');
    expect(list).toContain('toggleServiceEnabled(service)');
  });

  test('offers enabled state when creating or editing Kong 3.4+ services', () => {
    const form = read('assets/js/app/services/partials/form-service-013.html');
    const service = read('assets/js/app/services/services-service.js');

    expect(form).toContain('ng-model="service.enabled"');
    expect(form).toContain("isGatewayVersionEqOrGreater('3.4.0')");
    expect(service).toContain('props.enabled = true');
  });
});
