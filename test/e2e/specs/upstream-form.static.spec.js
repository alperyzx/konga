/** Phase 3 — Kong 3.x upstream and target fields remain reachable. */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.describe('Phase 3: upstream load-balancer fields', () => {
  const form = () => read('assets/js/app/upstreams/partials/upstream-form.html');

  for (const field of ['upstream.algorithm', 'upstream.host_header', 'upstream.use_srv_name',
    'upstream.healthchecks.threshold']) {
    test(`${field} is bound in the upstream form`, () => {
      expect(form()).toContain(`ng-model="${field}"`);
    });
  }

  test('algorithm exposes all Kong 3.x choices', () => {
    const html = form();
    for (const choice of ['round-robin', 'consistent-hashing', 'least-connections', 'latency']) {
      expect(html).toContain(`value="${choice}"`);
    }
  });

  test('target tags are bound in the target modal', () => {
    expect(read('assets/js/app/upstreams/targets/add-target-modal.html'))
      .toContain('ng-model="item.tags"');
  });
});
